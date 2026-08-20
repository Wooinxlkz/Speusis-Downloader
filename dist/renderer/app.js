/* ─── Speusis v0.5.53 — Renderer ────────────────────────────────────── */
"use strict";

import { fmt, fmtSecs, displayName, escHtml, hexToRgba, fileTypeBadge, scanBadge, statusBadge, BTN_SVG } from "./utils.js";
import { initConfigPanels } from "./panels-config.js";
import { initTransferPanels } from "./panels-transfer.js";
import { initMediaPlayer } from "./panels-media.js";
import { initDialogs } from "./dialogs.js";

const api = window.downloadManager;
const nativePanelQuery = new URLSearchParams(window.location.search);
const nativePanelName = nativePanelQuery.get("panel");
const nativePanelTaskId = nativePanelQuery.get("id");
const isNativePanelWindow = Boolean(nativePanelName);
if (isNativePanelWindow) document.body.classList.add("native-panel-window");
/* ── App version (populated async at startup) ───────────────────── */
let _appVersion = "0.5.53";
api.getVersion().then(v => { if (v) { _appVersion = v; updateRegBadge(); } }).catch(() => {});

/* ── State ─────────────────────────────────────────────────────── */
const taskStore  = new Map();
const rowEls     = new Map();
const speedMap   = new Map();
let selectedId   = null;
let activeFilter = "all";
let ctxTargetId  = null;
let catPanelOpen = true;
let rowRenderFrame = 0;
let statsRenderFrame = 0;
let catTreeTimer = 0;
let cachedDrives = null;
const pendingRows = new Set();

/* ── Speed history ─────────────────────────────────────────────── */
const SPEED_HISTORY_LEN = 60;
const speedHistory = new Array(SPEED_HISTORY_LEN).fill(0);
let speedChartRaf = 0;

/* ── DOM refs ───────────────────────────────────────────────────── */
const dlList          = document.getElementById("downloadList");
const emptyState      = document.getElementById("emptyState");
const addUrlPanel     = document.getElementById("addUrlPanel");
const settingsPanel   = document.getElementById("settingsPanel");
const schedulerPanel  = document.getElementById("schedulerPanel");
const loginsPanel     = document.getElementById("loginsPanel");
const rssPanel        = document.getElementById("rssPanel");
const batchPanel      = document.getElementById("batchPanel");
const createTorrentPanel = document.getElementById("createTorrentPanel");
const aboutPanel      = document.getElementById("aboutPanel");
const helpPanel       = document.getElementById("helpPanel");
const registrationPanel = document.getElementById("registrationPanel");
const grabberPanel    = document.getElementById("grabberPanel");
const torrentFilesPanel = document.getElementById("torrentFilesPanel");
const mediaPlayerPanel  = document.getElementById("mediaPlayerPanel");
const dlForm          = document.getElementById("downloadForm");
const urlInput        = document.getElementById("urlInput");
const filenameInput   = document.getElementById("filenameInput");
const labelInput      = document.getElementById("labelInput");
const ctxMenu         = document.getElementById("contextMenu");
const renameDialog    = document.getElementById("renameDialog");
const propertiesDialog= document.getElementById("propertiesDialog");
const segmentMapDialog= document.getElementById("segmentMapDialog");
const tracerPanel     = document.getElementById("tracerPanel");
const autoUpdateDialog= document.getElementById("autoUpdateDialog");
const updateWarnDialog= document.getElementById("updateWarnDialog");
const deleteConfirmDialog = document.getElementById("deleteConfirmDialog");
const catTree         = document.getElementById("catTree");
const catPanel        = document.getElementById("catPanel");
const themeMode       = document.getElementById("themeMode");
const accentColor     = document.getElementById("accentColor");
const scanCompletedFiles = document.getElementById("scanCompletedFiles");
const settingsDet     = document.getElementById("settingsDetails");
const maxConcurrentEl  = document.getElementById("maxConcurrentDownloads");
const defaultSegmentsEl = document.getElementById("defaultSegments");
const downloadLimitKbEl = document.getElementById("downloadLimitKb");
const uploadLimitKbEl   = document.getElementById("uploadLimitKb");
const listenerPortEl    = document.getElementById("listenerPort");
const remoteAccessEl    = document.getElementById("remoteAccess");
const allowInvalidTlsEl = document.getElementById("allowInvalidTls");
const seedRatioEl       = document.getElementById("seedRatio");
const tempDirEl         = document.getElementById("tempDir");
const menuDropdown    = document.getElementById("menuDropdown");
const statTotal       = document.getElementById("statTotal");
const statActive      = document.getElementById("statActive");
const statCompleted   = document.getElementById("statCompleted");
const statSpeed       = document.getElementById("statSpeed");
const statCount       = document.getElementById("statCount");
const statusMsg       = document.getElementById("statusMsg");
const speedChart      = document.getElementById("speedChart");
const sgLabel         = document.getElementById("sgLabel");

/* ── All panels (for closeAllPanels) ──────────────────────────── */
const ALL_PANELS = [addUrlPanel, settingsPanel, schedulerPanel, loginsPanel, rssPanel, batchPanel, createTorrentPanel, aboutPanel, helpPanel, registrationPanel, renameDialog, propertiesDialog, deleteConfirmDialog, grabberPanel, torrentFilesPanel, mediaPlayerPanel, segmentMapDialog, tracerPanel, autoUpdateDialog, updateWarnDialog];

/* ── Keyboard shortcuts ─────────────────────────────────────────── */
document.addEventListener("keydown", e => {
  if ((e.ctrlKey || e.metaKey) && e.key === "n") {
    e.preventDefault(); openPanel(addUrlPanel); urlInput.focus();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === "m") {
    e.preventDefault(); if (selectedId && !isPanelOpen()) openRenameDialog(selectedId);
  }
  if (e.key === "Escape") { closeMenuDropdown(); closeAllPanels(); }
  if (e.key === "Delete" && selectedId && !isPanelOpen()) {
    handleRowAction(selectedId, "delete");
  }
});

/* ── Panels ─────────────────────────────────────────────────────── */
function resetDialogPosition(panel) {
  const box = panel?.querySelector(".panel-box");
  if (!box) return;
  box.style.position = "";
  box.style.left = "";
  box.style.top = "";
  box.style.margin = "";
  box.style.transform = "";
  box.classList.remove("is-dragging");
}

function stopPanelActivity(panel) {
  if (panel === segmentMapDialog && typeof stopSegMapPoll === "function") stopSegMapPoll();
  if (panel === tracerPanel && typeof stopTracerPoll === "function") stopTracerPoll();
  // Pauses any <video>/<audio> left playing inside a panel that's being
  // closed/hidden (e.g. clicking outside it, Escape, or switching to a
  // different panel) — covers mediaPlayerPanel without a hardcoded
  // reference to it, and is a no-op for every panel with no media in it.
  panel?.querySelectorAll?.("video, audio").forEach(el => { el.pause(); });
}

function openPanel(panel, taskId) {
  if (!panel) return;

  if (!isNativePanelWindow) {
    ALL_PANELS.forEach(other => {
      if (other !== panel) {
        stopPanelActivity(other);
        other.classList.add("hidden");
        other.setAttribute("aria-hidden", "true");
        delete other.dataset.taskId;
        resetDialogPosition(other);
      }
    });
    resetDialogPosition(panel);
    if (taskId) panel.dataset.taskId = taskId;
    else delete panel.dataset.taskId;
    panel.classList.remove("hidden");
    panel.setAttribute("aria-hidden", "false");
    return;
  }

  ALL_PANELS.forEach(other => {
    if (other !== panel) closePanel(other);
  });

  resetDialogPosition(panel);
  if (taskId) panel.dataset.taskId = taskId;
  else delete panel.dataset.taskId;
  panel.classList.remove("hidden");
  panel.setAttribute("aria-hidden", "false");
}

function closePanel(panel) {
  if (!panel) return;

  if (!isNativePanelWindow) {
    stopPanelActivity(panel);
    panel.classList.add("hidden");
    panel.setAttribute("aria-hidden", "true");
    delete panel.dataset.taskId;
    resetDialogPosition(panel);
    return;
  }
  if (panel.id === nativePanelName) {
    stopPanelActivity(panel);
    api.closePanel(panel.id).catch(() => {});
    return;
  }

  panel.classList.add("hidden");
  stopPanelActivity(panel);
  panel.setAttribute("aria-hidden", "true");
  delete panel.dataset.taskId;
  resetDialogPosition(panel);
}

function isPanelOpen() {
  return ALL_PANELS.some(panel => !panel.classList.contains("hidden"));
}

function closeAllPanels() {
  ALL_PANELS.forEach(panel => closePanel(panel));
}

ALL_PANELS.forEach(p => {
  p.addEventListener("click", e => { if (e.target === p) closePanel(p); });
});

/* ── Basket-style dialog headers and dragging ───────────────────── */
/*
 * The Basket is a separate native window and uses Tauri's drag region.
 * These panels live inside the main window, so their title strips move
 * the card without moving the whole application window. Form controls
 * remain outside the handle and keep their normal behavior.
 */
function prepareDialogHeaders() {
  ALL_PANELS.forEach(panel => {
    const box = panel?.querySelector(".panel-box");
    const handle = box?.querySelector(".panel-title, .delete-confirm-title");
    if (!box || !handle || handle.dataset.headerReady === "1") return;
    handle.dataset.headerReady = "1";
    handle.classList.add("dialog-titlebar", "panel-drag-handle");

    const existingClose = handle.querySelector(":scope > .dialog-close");
    const existingIcon = handle.querySelector(":scope > svg");
    if (existingIcon) existingIcon.remove();

    const icon = document.createElement("img");
    icon.className = "dialog-title-icon";
    icon.src = "./speusis-icon.png";
    icon.alt = "";
    icon.draggable = false;

    const titleText = document.createElement("span");
    titleText.className = "dialog-title-text";
    [...handle.childNodes].forEach(node => {
      if (node !== existingClose) titleText.appendChild(node);
    });
    handle.replaceChildren(icon, titleText);

    const close = existingClose || document.createElement("button");
    close.classList.add("dialog-close");
    close.type = "button";
    close.dataset.closePanel = panel.id;
    close.setAttribute("aria-label", "Close dialog");
    close.title = "Close";
    close.innerHTML = `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
    handle.appendChild(close);
  });
}

prepareDialogHeaders();
document.addEventListener("click", event => {
  const close = event.target.closest(".dialog-close");
  if (!close) return;
  event.preventDefault();
  event.stopPropagation();
  const panel = document.getElementById(close.dataset.closePanel);
  if (panel) closePanel(panel);
}, true);

function installDialogDragging() {
  document.querySelectorAll(".overlay-panel .panel-box").forEach(box => {
    const handle = box.querySelector(".panel-title, .delete-confirm-title");
    if (!handle || handle.dataset.dragReady === "1") return;
    handle.dataset.dragReady = "1";
    handle.style.touchAction = "none";
    handle.addEventListener("pointerdown", event => {
      if (event.button !== 0 || event.isPrimary === false) return;
      if (event.target.closest("button, a, input, select, textarea")) return;
      event.preventDefault();

      if (isNativePanelWindow) {
        const currentWindow = window.__TAURI__?.window?.getCurrentWindow?.();
        if (currentWindow?.startDragging) {
          Promise.resolve(currentWindow.startDragging()).catch(() => {});
          return;
        }
      }

      const rect = box.getBoundingClientRect();
      const startX = event.clientX;
      const startY = event.clientY;
      const originX = rect.left;
      const originY = rect.top;
      let moved = false;
      handle.setPointerCapture?.(event.pointerId);
      const move = moveEvent => {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        if (!moved && Math.abs(dx) + Math.abs(dy) < 2) return;
        moved = true;
        const maxX = Math.max(8, window.innerWidth - box.offsetWidth - 8);
        const maxY = Math.max(8, window.innerHeight - box.offsetHeight - 8);
        box.style.position = "fixed";
        box.style.left = `${Math.min(maxX, Math.max(8, originX + dx))}px`;
        box.style.top = `${Math.min(maxY, Math.max(8, originY + dy))}px`;
        box.style.margin = "0";
        box.style.transform = "none";
        box.classList.add("is-dragging");
        document.body.classList.add("dialog-dragging");
      };
      const end = () => {
        handle.releasePointerCapture?.(event.pointerId);
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", end);
        document.removeEventListener("pointercancel", end);
        box.classList.remove("is-dragging");
        document.body.classList.remove("dialog-dragging");
      };
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", end);
      document.addEventListener("pointercancel", end);
    });
  });
}
installDialogDragging();

// Every window - main and every open dialog - keeps its own theme/accent in
// sync now, instead of only whichever single window's Options dropdown you
// happened to change it from.
api.onSettingsUpdated?.(applyAppearance);

/* ── Resizable download-list columns ───────────────────────────── */
const tablePanel = document.querySelector(".table-panel");
const tableHeader = tablePanel?.querySelector(".tbl-header");
const columnStorageKey = "speusis.downloadTable.columnWidths.v2";
const columnDefaults = [
  "minmax(220px, 1.8fr)", "38px", "minmax(84px, .7fr)", "minmax(150px, 1.1fr)",
  "minmax(96px, .7fr)", "minmax(124px, 1fr)", "112px",
];
const columnMinimums = [190, 32, 78, 132, 88, 108, 112];
let columnWidths = columnDefaults.map(() => null);

try {
  const storedWidths = JSON.parse(localStorage.getItem(columnStorageKey) || "null");
  if (Array.isArray(storedWidths) && storedWidths.length === columnDefaults.length) {
    columnWidths = storedWidths.map((width, index) => (
      Number.isFinite(width) && width >= columnMinimums[index] ? Math.round(width) : null
    ));
  }
} catch {}

function applyColumnWidths() {
  if (!tablePanel) return;
  const tracks = columnWidths.map((width, index) => (
    width ? `${width}px` : columnDefaults[index]
  ));
  tablePanel.style.setProperty("--tbl-cols", tracks.join(" "));
}

function saveColumnWidths() {
  try {
    localStorage.setItem(columnStorageKey, JSON.stringify(columnWidths));
  } catch {}
}

function installColumnResizing() {
  if (!tablePanel || !tableHeader) return;
  tableHeader.querySelectorAll(".tbl-cell").forEach((cell, index) => {
    const handle = document.createElement("div");
    handle.className = "tbl-resize-handle";
    handle.setAttribute("aria-hidden", "true");
    cell.appendChild(handle);

    handle.addEventListener("pointerdown", event => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();

      const startX = event.clientX;
      const startWidth = cell.getBoundingClientRect().width;
        const otherMinimumWidth = columnWidths.reduce((sum, width, otherIndex) => (
          otherIndex === index
            ? sum
            : sum + Math.max(columnMinimums[otherIndex], width || columnMinimums[otherIndex])
        ), 0);
        const maxWidth = Math.max(columnMinimums[index], tablePanel.clientWidth - otherMinimumWidth);
        columnWidths[index] = Math.min(maxWidth, Math.max(columnMinimums[index], Math.round(startWidth)));
      applyColumnWidths();
      handle.setPointerCapture?.(event.pointerId);
      document.body.classList.add("tbl-column-resizing");

      const move = moveEvent => {
        const nextWidth = Math.min(
          maxWidth,
          Math.max(columnMinimums[index], Math.round(startWidth + moveEvent.clientX - startX)),
        );
        columnWidths[index] = nextWidth;
        applyColumnWidths();
      };
      const end = () => {
        handle.releasePointerCapture?.(event.pointerId);
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", end);
        document.removeEventListener("pointercancel", end);
        document.body.classList.remove("tbl-column-resizing");
        saveColumnWidths();
      };

      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", end);
      document.addEventListener("pointercancel", end);
    });
  });
  applyColumnWidths();
}

installColumnResizing();

/* ── Helpers ─────────────────────────────────────────────────────── */
/* fmt, fmtSecs, displayName, escHtml, hexToRgba, fileTypeBadge,
   scanBadge, statusBadge moved to ./utils.js (v0.5.43 split, Pass 1) */

/* ── Row SVG action buttons ─────────────────────────────────────── */
/* BTN_SVG moved to ./utils.js (v0.5.43 split, Pass 3) — imported above */

const VIDEO_EXT = /\.(mp4|mkv|avi|mov|wmv|flv|webm|ts|m3u8|mpd|m4v)$/i;
const AUDIO_EXT = /\.(mp3|flac|wav|aac|ogg|m4a|wma)$/i;
// Archive Manager (v0.5.50) — kept in sync with speusis-core::archive_manager
// ::detect_archive_kind. RAR/7z aren't extracted yet, so they're deliberately
// left out here too (the menu items just won't show for those files).
const ARCHIVE_EXT = /\.(zip|tar|tar\.gz|tgz)$/i;
function isMediaName(name) { return VIDEO_EXT.test(name || "") || AUDIO_EXT.test(name || ""); }
function isArchiveName(name) { return ARCHIVE_EXT.test(name || ""); }

function actionMenuMarkup(status, kind, taskName) {
  if (!ctxMenu) return "";
  const isDone = status === "completed";
  const isActive = ["running", "queued"].includes(status);
  const isPlayable = ["running", "paused", "completed"].includes(status);
  const isPausedOrFailed = ["paused", "failed", "cancelled"].includes(status);
  const isMedia = isMediaName(taskName);
  const isArchive = isArchiveName(taskName);
  // Items hidden outright (wrong file type / kind for this row) rather than
  // just grayed — same convention torrent-files already used.
  const irrelevant = action => (
    (action === "torrent-files" && kind !== "torrent") ||
    (action === "play" && !isMedia) ||
    (["extract-here", "extract-to"].includes(action) && !isArchive) ||
    (action === "create-zip" && !isDone)
  );
  const disabled = action => (
    (["open", "openwith", "openfolder"].includes(action) && !isDone && !isActive) ||
    (action === "resume" && !isPausedOrFailed) ||
    (["pause", "stop"].includes(action) && !isActive) ||
    (action === "play" && !isPlayable) ||
    (["extract-here", "extract-to"].includes(action) && !isDone)
  );

  return [...ctxMenu.children].map(source => {
    if (source.classList.contains("ctx-sep")) {
      return source.id === "ctxArchiveSep" ? (isArchive ? source.outerHTML.replace(" hidden", "") : "") : source.outerHTML;
    }
    if (!source.classList.contains("ctx-item")) return "";
    const action = source.dataset.action;
    if (irrelevant(action)) return "";
    const item = source.cloneNode(true);
    item.removeAttribute("id");
    item.className = `row-menu-item${disabled(action) ? " ctx-grayed" : ""}`;
    return item.outerHTML;
  }).join("");
}

function buildActionButtons(status, taskName, kind) {
  const b = [];
  const isMedia = VIDEO_EXT.test(taskName || "") || AUDIO_EXT.test(taskName || "");
  if (status === "running") {
    b.push(`<button class="row-btn rb-pause" data-action="pause" title="Pause">${BTN_SVG.pause}</button>`);
    b.push(`<button class="row-btn rb-stop"  data-action="stop"  title="Stop">${BTN_SVG.stop}</button>`);
    if (isMedia) b.push(`<button class="row-btn rb-preview" data-action="preview" title="Preview">${BTN_SVG.preview}</button>`);
  } else if (status === "paused") {
    b.push(`<button class="row-btn rb-play" data-action="resume" title="Resume">${BTN_SVG.play}</button>`);
    b.push(`<button class="row-btn rb-stop" data-action="stop"   title="Stop">${BTN_SVG.stop}</button>`);
    if (isMedia) b.push(`<button class="row-btn rb-preview" data-action="preview" title="Preview">${BTN_SVG.preview}</button>`);
  } else if (status === "queued") {
    b.push(`<button class="row-btn rb-stop" data-action="stop" title="Cancel">${BTN_SVG.stop}</button>`);
  } else if (status === "completed") {
    if (isMedia) b.push(`<button class="row-btn rb-preview" data-action="preview" title="Preview">${BTN_SVG.preview}</button>`);
  }
  // Delete and Re-download used to be their own standalone icons alongside
  // the 3-dot menu (3 icons total for a completed row). Folded into the
  // dropdown instead, so the row only ever shows the "..." button plus
  // whichever transfer-control buttons (pause/stop/resume/preview) are
  // actually relevant to the current status.

  return `${b.join("")}
    <span class="row-action-menu">
      <button class="row-more" type="button" title="More actions" aria-label="More actions" aria-expanded="false">
        <svg width="14" height="14" viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="4" cy="10" r="1.5" fill="currentColor"/>
          <circle cx="10" cy="10" r="1.5" fill="currentColor"/>
          <circle cx="16" cy="10" r="1.5" fill="currentColor"/>
        </svg>
      </button>
      <span class="row-action-dropdown hidden" role="menu">${actionMenuMarkup(status, kind, taskName)}</span>
    </span>`;
}

function closeRowActionMenus(except = null) {
  document.querySelectorAll(".row-action-dropdown:not(.hidden)").forEach(menu => {
    if (menu !== except) {
      menu.classList.add("hidden");
      menu.previousElementSibling?.setAttribute("aria-expanded", "false");
    }
  });
}

function positionRowActionMenu(more, menu) {
  if (!more || !menu) return;
  const rect = more.getBoundingClientRect();
  // Switch to fixed positioning FIRST, then measure. Reading offsetWidth
  // before this was the actual bug: it measured the menu while it was
  // still laid out under its default (non-fixed) CSS positioning, which
  // gives a different, unreliable width depending on that particular row's
  // surrounding layout - so every placement calculation below was already
  // working from a wrong number, which is why it looked like it opened in
  // a different, inconsistent place depending on the row.
  menu.style.position = "fixed";
  menu.style.right = "auto";
  const menuWidth = menu.offsetWidth || 236;
  const preferredLeft = rect.left;
  const left = preferredLeft + menuWidth <= window.innerWidth - 8
    ? preferredLeft
    : rect.right - menuWidth;
  menu.style.left = `${Math.max(8, Math.min(window.innerWidth - menuWidth - 8, left))}px`;
  menu.style.top = `${Math.min(window.innerHeight - 12, rect.bottom + 6)}px`;
  if (rect.bottom + 6 + menu.offsetHeight > window.innerHeight) {
    menu.style.top = `${Math.max(8, rect.top - menu.offsetHeight - 6)}px`;
  }
}

/* ── Category config ────────────────────────────────────────────── */
const CAT_SVGS = {
  all:        `<svg class="cat-ico" viewBox="0 0 14 14"><rect x="1" y="1" width="5" height="5" rx="1" fill="#60a5fa"/><rect x="8" y="1" width="5" height="5" rx="1" fill="#60a5fa"/><rect x="1" y="8" width="5" height="5" rx="1" fill="#60a5fa"/><rect x="8" y="8" width="5" height="5" rx="1" fill="#60a5fa"/></svg>`,
  compressed: `<svg class="cat-ico" viewBox="0 0 14 14"><rect x="1" y="1" width="12" height="12" rx="2" fill="none" stroke="#fb923c" stroke-width="1.3"/><line x1="5" y1="1" x2="5" y2="13" stroke="#fb923c" stroke-width="1.2"/><line x1="5" y1="4" x2="9" y2="4" stroke="#fb923c" stroke-width="1.2"/><line x1="5" y1="7" x2="9" y2="7" stroke="#fb923c" stroke-width="1.2"/><line x1="5" y1="10" x2="9" y2="10" stroke="#fb923c" stroke-width="1.2"/></svg>`,
  documents:  `<svg class="cat-ico" viewBox="0 0 14 14"><path d="M2 2h7l3 3v7H2V2z" fill="none" stroke="#60a5fa" stroke-width="1.3"/><path d="M9 2v3h3" stroke="#60a5fa" stroke-width="1.2" fill="none"/><line x1="4" y1="7" x2="10" y2="7" stroke="#60a5fa" stroke-width="1.1"/><line x1="4" y1="9.5" x2="10" y2="9.5" stroke="#60a5fa" stroke-width="1.1"/></svg>`,
  music:      `<svg class="cat-ico" viewBox="0 0 14 14"><path d="M5 11V3l7-2v8" stroke="#a78bfa" stroke-width="1.3" fill="none" stroke-linecap="round"/><circle cx="4" cy="11" r="2" fill="#a78bfa" opacity="0.8"/><circle cx="11" cy="9" r="2" fill="#a78bfa" opacity="0.8"/></svg>`,
  programs:   `<svg class="cat-ico" viewBox="0 0 14 14"><rect x="2" y="2" width="10" height="10" rx="1.5" fill="none" stroke="#fb923c" stroke-width="1.3"/><polyline points="4.5,7 6.5,5 8.5,7 10,5.5" stroke="#fb923c" stroke-width="1.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  video:      `<svg class="cat-ico" viewBox="0 0 14 14"><rect x="1" y="3" width="9" height="8" rx="1.5" fill="none" stroke="#f472b6" stroke-width="1.3"/><path d="M10 5.5l3-2v7l-3-2V5.5z" fill="#f472b6" opacity="0.8"/></svg>`,
  unfinished: `<svg class="cat-ico" viewBox="0 0 14 14"><circle cx="7" cy="7" r="5.5" fill="none" stroke="#fcd34d" stroke-width="1.3"/><polyline points="7,3.5 7,7 9.5,9" stroke="#fcd34d" stroke-width="1.3" fill="none" stroke-linecap="round"/></svg>`,
  finished:   `<svg class="cat-ico" viewBox="0 0 14 14"><circle cx="7" cy="7" r="5.5" fill="none" stroke="#86efac" stroke-width="1.3"/><polyline points="4,7 6,9 10,5" stroke="#86efac" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  queued:     `<svg class="cat-ico" viewBox="0 0 14 14"><rect x="1" y="2" width="12" height="2.5" rx="1.2" fill="#94a3b8"/><rect x="1" y="6" width="12" height="2.5" rx="1.2" fill="#94a3b8"/><rect x="1" y="10" width="8"  height="2.5" rx="1.2" fill="#94a3b8"/></svg>`,
  drive:      `<svg class="cat-ico" viewBox="0 0 14 14"><rect x="1" y="4" width="12" height="6" rx="2" fill="none" stroke="#909090" stroke-width="1.3"/><circle cx="10.5" cy="7" r="1.2" fill="#909090"/></svg>`,
};

const CAT_EXT = {
  compressed: /\.(zip|rar|7z|tar|gz|bz2|xz)$/i,
  documents:  /\.(pdf|doc|docx|txt|xls|xlsx|csv|ppt|pptx)$/i,
  music:      /\.(mp3|flac|wav|aac|ogg|m4a|wma)$/i,
  programs:   /\.(exe|msi|dmg|apk|deb|rpm)$/i,
  video:      /\.(mp4|mkv|avi|mov|wmv|flv|webm|ts|m3u8|mpd)$/i,
};

function taskMatchFilter(task, filter) {
  if (filter === "all")        return true;
  if (filter === "finished")   return task.status === "completed";
  if (filter === "unfinished") return ["running","paused","queued","failed"].includes(task.status);
  if (filter === "queued")     return task.status === "queued";
  if (filter.startsWith("lbl:")) return task.label === filter.slice(4);
  const name = displayName(task);
  return CAT_EXT[filter]?.test(name) ?? true;
}

function countByFilter(filter) {
  return [...taskStore.values()].filter(t => taskMatchFilter(t, filter)).length;
}

/* ── Category panel ─────────────────────────────────────────────── */
async function buildCatTree() {
  const cats = [
    { key:"all",        label:"All Downloads" },
    { key:"compressed", label:"Compressed" },
    { key:"documents",  label:"Documents" },
    { key:"music",      label:"Music" },
    { key:"programs",   label:"Programs" },
    { key:"video",      label:"Video" },
  ];
  const sub = [
    { key:"unfinished", label:"Unfinished" },
    { key:"finished",   label:"Finished" },
    { key:"queued",     label:"Queues" },
  ];

  let html = `<div class="cat-section-label">Downloads</div>`;
  for (const c of cats) {
    const count = countByFilter(c.key);
    const active = c.key === activeFilter ? " active" : "";
    html += `<div class="cat-node${active}" data-filter="${c.key}">
      ${CAT_SVGS[c.key] || ""}
      <span class="cat-label">${escHtml(c.label)}</span>
      ${count > 0 ? `<span class="cat-count">${count}</span>` : ""}
    </div>`;
  }

  html += `<div class="cat-section-label" style="margin-top:6px">Status</div>`;
  for (const c of sub) {
    const count = countByFilter(c.key);
    const active = c.key === activeFilter ? " active" : "";
    html += `<div class="cat-node${active}" data-filter="${c.key}">
      ${CAT_SVGS[c.key] || ""}
      <span class="cat-label">${escHtml(c.label)}</span>
      ${count > 0 ? `<span class="cat-count">${count}</span>` : ""}
    </div>`;
  }

  // Labels
  const labels = new Set([...taskStore.values()].map(t => t.label).filter(Boolean));
  if (labels.size > 0) {
    html += `<div class="cat-section-label" style="margin-top:6px">Labels</div>`;
    for (const lbl of labels) {
      const filter = "lbl:" + lbl;
      const count = countByFilter(filter);
      const active = activeFilter === filter ? " active" : "";
      html += `<div class="cat-node${active}" data-filter="${escHtml(filter)}">
        <svg class="cat-ico" viewBox="0 0 14 14"><path d="M2 2h7l3 5-3 5H2V2z" fill="none" stroke="#60a5fa" stroke-width="1.3"/></svg>
        <span class="cat-label">${escHtml(lbl)}</span>
        ${count > 0 ? `<span class="cat-count">${count}</span>` : ""}
      </div>`;
    }
  }

  try {
    if (!cachedDrives) cachedDrives = await api.listDrives();
    if (cachedDrives && cachedDrives.length > 0) {
      html += `<div class="cat-section-label" style="margin-top:6px">Drives</div>`;
      for (const d of cachedDrives) {
        html += `<div class="cat-drive">${CAT_SVGS.drive}<span>${escHtml(d)}</span></div>`;
      }
    }
  } catch { /* ignore */ }

  catTree.innerHTML = html;
  catTree.querySelectorAll(".cat-node[data-filter]").forEach(el => {
    el.addEventListener("click", () => {
      activeFilter = el.dataset.filter;
      catTree.querySelectorAll(".cat-node").forEach(n => n.classList.remove("active"));
      el.classList.add("active");
      renderAll();
    });
  });
}

function scheduleRowRender(id) {
  pendingRows.add(id);
  if (rowRenderFrame) return;
  rowRenderFrame = requestAnimationFrame(() => {
    rowRenderFrame = 0;
    const ids = [...pendingRows]; pendingRows.clear();
    for (const pendingId of ids) {
      const task = taskStore.get(pendingId);
      if (task) upsertRow(task);
    }
    scheduleStatsRender();
  });
}

function scheduleStatsRender() {
  if (statsRenderFrame) return;
  statsRenderFrame = requestAnimationFrame(() => {
    statsRenderFrame = 0;
    updateStats();
  });
}

function scheduleCatTreeRender() {
  clearTimeout(catTreeTimer);
  catTreeTimer = setTimeout(() => { catTreeTimer = 0; buildCatTree(); }, 180);
}

/* ── Row rendering ──────────────────────────────────────────────── */
function upsertRow(task) {
  taskStore.set(task.id, { ...taskStore.get(task.id), ...task });
  const t = taskStore.get(task.id);
  if (!taskMatchFilter(t, activeFilter)) { removeRow(task.id); return; }

  let row = rowEls.get(task.id);
  if (!row) {
    row = document.createElement("div");
    row.className = "dl-row";
    row.dataset.id = task.id;
    row.innerHTML = `
      <div class="dl-cell dl-file">
        <span data-role="badge"></span>
        <span class="dl-name" data-role="name"></span>
        <span data-role="label"></span>
      </div>
      <div class="dl-cell dl-q" data-role="retry"></div>
      <div class="dl-cell" data-role="size"></div>
      <div class="dl-cell dl-prog-wrap">
        <span data-role="status"></span>
        <div class="dl-prog-bar" data-role="bar"><div class="dl-prog-fill" data-role="fill"></div></div>
        <div class="dl-pct" data-role="pct"></div>
      </div>
      <div class="dl-cell dl-muted" data-role="eta"></div>
      <div class="dl-cell dl-rate-value" data-role="speed"></div>
      <div class="dl-cell dl-actions" data-role="actions"></div>
    `;
    dlList.insertBefore(row, dlList.firstChild);
    rowEls.set(task.id, row);
    row.addEventListener("click",       () => selectRow(task.id));
    row.addEventListener("contextmenu", e  => openCtxMenu(e, task.id));
  }

  const name     = displayName(t);
  const received = t.receivedBytes || 0;
  const size     = Number(t.size || 0);
  const pct      = size > 0 ? Math.min(100, (received / size) * 100) : 0;
  const speed    = speedMap.get(task.id) || 0;
  const remaining= size > 0 ? size - received : 0;
  const eta      = speed > 0 && remaining > 0 ? remaining / speed : 0;
  const running  = t.status === "running";

  if (row.dataset.name !== name) {
    row.dataset.name = name;
    row.querySelector('[data-role="badge"]').innerHTML = fileTypeBadge(name);
    const nameEl = row.querySelector('[data-role="name"]');
    nameEl.textContent = name;
    nameEl.title = t.url || "";
  }

  // Label badge
  const labelEl = row.querySelector('[data-role="label"]');
  if (t.label) {
    labelEl.innerHTML = `<span class="lbl-badge" title="${escHtml(t.label)}">${escHtml(t.label)}</span>`;
  } else {
    labelEl.innerHTML = "";
  }

  const scanKey = t.securityScan ? `${t.securityScan.status}:${t.securityScan.message || ""}` : "";
  if (row.dataset.status !== t.status || row.dataset.scan !== scanKey) {
    row.dataset.status = t.status;
    row.dataset.scan = scanKey;
    row.querySelector('[data-role="status"]').innerHTML = statusBadge(t);
    const actions = row.querySelector('[data-role="actions"]');
    actions.innerHTML = buildActionButtons(t.status, name, t.kind);
    actions.querySelectorAll(".row-btn").forEach(btn => {
      btn.addEventListener("click", e => { e.stopPropagation(); handleRowAction(task.id, btn.dataset.action); });
    });
    const more = actions.querySelector(".row-more");
    const menu = actions.querySelector(".row-action-dropdown");
    more?.addEventListener("click", e => {
      e.stopPropagation();
      const shouldOpen = menu?.classList.contains("hidden");
      closeRowActionMenus(menu);
      if (menu && shouldOpen) {
        menu.classList.remove("hidden");
        more.setAttribute("aria-expanded", "true");
        positionRowActionMenu(more, menu);
      }
    });
    actions.querySelectorAll(".row-menu-item").forEach(btn => {
      btn.addEventListener("click", e => {
        e.stopPropagation();
        if (btn.classList.contains("ctx-grayed")) return;
        closeRowActionMenus();
        handleRowAction(task.id, btn.dataset.action);
      });
    });
  }

  // Peers count for torrents
  const qEl = row.querySelector('[data-role="retry"]');
  if (t.kind === "torrent" && t.peers > 0) {
    qEl.innerHTML = `<span class="peers-badge">${t.peers}P</span>`;
  } else {
    qEl.textContent = t.retryCount || "";
  }

  row.querySelector('[data-role="size"]').textContent = size > 0 ? fmt(size) : received > 0 ? "≈"+fmt(received) : "—";
  row.querySelector('[data-role="bar"]').style.display = running ? "" : "none";
  row.querySelector('[data-role="pct"]').style.display = running ? "" : "none";
  row.querySelector('[data-role="fill"]').style.width = `${pct.toFixed(1)}%`;
  row.querySelector('[data-role="pct"]').textContent = `${pct.toFixed(1)}%`;
  row.querySelector('[data-role="eta"]').textContent = running ? fmtSecs(eta) : "—";
  const speedEl = row.querySelector('[data-role="speed"]');
  speedEl.textContent = speed > 0 ? fmt(speed)+"/s" : "—";
  speedEl.classList.toggle("active", speed > 0);

  row.classList.toggle("selected", selectedId === task.id);
  emptyState.style.display = "none";
}

function removeRow(id) {
  rowEls.get(id)?.remove();
  rowEls.delete(id);
  if (selectedId === id) selectedId = null;
  if (rowEls.size === 0) emptyState.style.display = "";
}

function renderAll() {
  for (const [id, el] of rowEls) {
    if (!taskStore.has(id) || !taskMatchFilter(taskStore.get(id), activeFilter)) {
      el.remove(); rowEls.delete(id);
    }
  }
  const tasks = [...taskStore.values()].sort((a,b) => b.createdAt - a.createdAt);
  for (const t of tasks) { if (taskMatchFilter(t, activeFilter)) upsertRow(t); }
  emptyState.style.display = rowEls.size === 0 ? "" : "none";
  updateStats();
  scheduleCatTreeRender();
}

/* ── Row actions ────────────────────────────────────────────────── */
async function handleRowAction(id, action) {
  const task = taskStore.get(id);
  if (!task) return;

  switch (action) {
    case "pause": {
      await api.pauseDownload(id);
      taskStore.set(id, { ...task, status: "paused" });
      speedMap.set(id, 0); upsertRow(taskStore.get(id));
      setStatus("Paused: " + displayName(task)); break;
    }
    case "resume": {
      if (task.status === "paused") {
        await api.resumeDownload(id);
        taskStore.set(id, { ...task, status: "queued" });
        upsertRow(taskStore.get(id)); setStatus("Resuming: " + displayName(task));
      } else if (task.status === "failed" || task.status === "cancelled") {
        const fresh = await api.addDownload({ url: task.url, filename: task.filename, label: task.label });
        if (fresh?.id) {
          taskStore.delete(id); speedMap.delete(id); removeRow(id);
          taskStore.set(fresh.id, { ...fresh, createdAt: Date.now() });
          upsertRow(taskStore.get(fresh.id));
          setStatus("Restarted: " + displayName(fresh));
        }
      } else {
        setStatus("Cannot resume — download is " + (task.status || "unknown"));
      }
      break;
    }
    case "stop": {
      await api.cancelDownload(id);
      taskStore.set(id, { ...task, status: "cancelled" });
      speedMap.set(id, 0); upsertRow(taskStore.get(id));
      setStatus("Stopped: " + displayName(task)); break;
    }
    case "redownload": {
      const fresh = await api.addDownload({ url: task.url, filename: task.filename, label: task.label });
      if (fresh?.id) {
        taskStore.delete(id); speedMap.delete(id); removeRow(id);
        taskStore.set(fresh.id, { ...fresh, createdAt: Date.now() });
        upsertRow(taskStore.get(fresh.id));
        setStatus("Re-queued: " + displayName(fresh));
      }
      break;
    }
    case "delete": {
      await showDeleteConfirm(id);
      break;
    }
    case "copyurl": {
      if (task.url) navigator.clipboard?.writeText(task.url);
      setStatus("URL copied to clipboard"); break;
    }
    case "preview":
    case "play": {
      try {
        await openMediaPlayerPanel(id);
        setStatus("Playing: " + displayName(task));
      } catch (e) { setStatus("Couldn't open the player — " + (e?.message || e)); }
      break;
    }
    case "extract-here": {
      setStatus("Extracting: " + displayName(task) + "…");
      try {
        const result = await api.archiveExtractHere(id);
        setStatus(`Extracted ${result.fileCount} file${result.fileCount !== 1 ? "s" : ""} to ${result.destDir}`);
      } catch (e) { setStatus("Extract failed — " + (e?.message || e)); }
      break;
    }
    case "extract-to": {
      try {
        const result = await api.archiveExtractTo(id);
        setStatus(`Extracted ${result.fileCount} file${result.fileCount !== 1 ? "s" : ""} to ${result.destDir}`);
      } catch (e) {
        // A cancelled folder picker rejects too — don't show that as an error.
        if (!/no destination folder/i.test(String(e?.message || e))) {
          setStatus("Extract failed — " + (e?.message || e));
        }
      }
      break;
    }
    case "create-zip": {
      try {
        const outputPath = await api.archiveCreateZip(id);
        setStatus("Archive created: " + outputPath);
      } catch (e) {
        if (!/no output location/i.test(String(e?.message || e))) {
          setStatus("Couldn't create archive — " + (e?.message || e));
        }
      }
      break;
    }
    case "open": {
      try {
        const result = await api.openFile(id);
        if (result?.ok) setStatus("Opening: " + displayName(task));
        else setStatus("Cannot open — " + (result?.error || "file not ready"));
      } catch { setStatus("Cannot open — file may not be complete."); }
      break;
    }
    case "openwith": {
      try {
        const result = await api.openWith(id);
        if (result?.ok) setStatus("Opening with system dialog…");
        else setStatus("Cannot open — " + (result?.error || "file not ready"));
      } catch { setStatus("Open with failed."); }
      break;
    }
    case "openfolder": {
      try {
        const result = await api.openFolder(id);
        if (result?.ok) setStatus("Opened folder for: " + displayName(task));
        else setStatus("Cannot open folder — " + (result?.error || "file not ready"));
      } catch { setStatus("Cannot open folder."); }
      break;
    }
    case "rename": {
      openRenameDialog(id); break;
    }
    case "refreshurl": {
      setStatus("Refresh download address — re-queuing…");
      const fresh = await api.addDownload({ url: task.url, filename: task.filename, label: task.label });
      if (fresh?.id) {
        taskStore.delete(id); speedMap.delete(id); removeRow(id);
        taskStore.set(fresh.id, { ...fresh, createdAt: Date.now() });
        upsertRow(taskStore.get(fresh.id));
        setStatus("Download refreshed: " + displayName(fresh));
      }
      break;
    }
    case "addqueue": {
      setStatus("Added to queue: " + displayName(task)); break;
    }
    case "removequeue": {
      setStatus("Removed from queue: " + displayName(task)); break;
    }
    case "ondblclick": {
      setStatus("Double-click action not changed."); break;
    }
    case "properties": {
      openPropertiesDialog(id); break;
    }
    case "segmentmap": {
      openSegmentMapDialog(id); break;
    }
    case "tracer": {
      openTracerPanel(); break;
    }
    case "torrent-files": {
      openTorrentFilesPanel(id); break;
    }
  }
  updateStats(); scheduleCatTreeRender();
}

/* ── Rename / Properties / Segment Map / Tracer / Delete-confirm ──
 * Moved to dialogs.js (v0.5.43 split, Pass 3). Wired up via
 * initDialogs() — see the import block up top and the init call
 * near the other panel init calls below. */

/* ── Selection ──────────────────────────────────────────────────── */
function selectRow(id) {
  rowEls.get(selectedId)?.classList.remove("selected");
  selectedId = id;
  rowEls.get(id)?.classList.add("selected");
}

/* ── Context menu ───────────────────────────────────────────────── */
function openCtxMenu(e, id) {
  e.preventDefault();
  selectRow(id);
  ctxTargetId = id;

  const task = taskStore.get(id);
  const status = task?.status || "";
  const isDone = status === "completed";
  const isActive = ["running","queued"].includes(status);
  const isPausedOrFailed = ["paused","failed","cancelled"].includes(status);

  /* Update enabled/grayed items based on task status */
  const ctxResume = document.getElementById("ctxResume");
  const ctxPause  = document.getElementById("ctxPause");
  const ctxStop   = document.getElementById("ctxStop");
  if (ctxResume) ctxResume.classList.toggle("ctx-grayed", !isPausedOrFailed);
  if (ctxPause)  ctxPause.classList.toggle("ctx-grayed",  !isActive);
  if (ctxStop)   ctxStop.classList.toggle("ctx-grayed",   !isActive);
  const ctxTorrentFiles = document.getElementById("ctxTorrentFiles");
  if (ctxTorrentFiles) ctxTorrentFiles.classList.toggle("hidden", task?.kind !== "torrent");

  /* Gray out file-access items when file isn't available */
  ctxMenu.querySelectorAll('[data-action="open"],[data-action="openwith"],[data-action="openfolder"]').forEach(el => {
    el.classList.toggle("ctx-grayed", !isDone && !isActive);
  });

  /* Media Player + Archive Manager (v0.5.50) — shown only for the relevant
   * file types, grayed until the underlying file actually exists on disk. */
  const taskName = task ? displayName(task) : "";
  const isPlayable = ["running", "paused", "completed"].includes(status);
  const isMedia = isMediaName(taskName);
  const isArchive = isArchiveName(taskName);

  const ctxPlay = document.getElementById("ctxPlay");
  if (ctxPlay) {
    ctxPlay.classList.toggle("hidden", !isMedia);
    ctxPlay.classList.toggle("ctx-grayed", !isPlayable);
  }
  const ctxExtractHere = document.getElementById("ctxExtractHere");
  const ctxExtractTo = document.getElementById("ctxExtractTo");
  const ctxCreateZip = document.getElementById("ctxCreateZip");
  const ctxArchiveSep = document.getElementById("ctxArchiveSep");
  [ctxExtractHere, ctxExtractTo].forEach(el => {
    if (!el) return;
    el.classList.toggle("hidden", !isArchive);
    el.classList.toggle("ctx-grayed", !isDone);
  });
  if (ctxCreateZip) {
    ctxCreateZip.classList.toggle("hidden", false);
    ctxCreateZip.classList.toggle("ctx-grayed", !isDone);
  }
  if (ctxArchiveSep) ctxArchiveSep.classList.toggle("hidden", !isArchive);

  ctxMenu.classList.remove("hidden");
  const vw = window.innerWidth, vh = window.innerHeight;
  let x = e.clientX, y = e.clientY;
  const menuH = ctxMenu.offsetHeight || 340;
  const menuW = ctxMenu.offsetWidth  || 215;
  if (x + menuW > vw) x = vw - menuW - 4;
  if (y + menuH > vh) y = Math.max(4, vh - menuH - 4);
  ctxMenu.style.left = Math.max(0, x) + "px";
  ctxMenu.style.top  = Math.max(0, y) + "px";
}
document.addEventListener("click", () => {
  ctxMenu.classList.add("hidden");
  closeRowActionMenus();
});
ctxMenu.addEventListener("click", e => {
  const item = e.target.closest(".ctx-item");
  if (!item || item.classList.contains("ctx-grayed")) return;
  e.stopPropagation();
  if (ctxTargetId) handleRowAction(ctxTargetId, item.dataset.action);
  ctxMenu.classList.add("hidden");
});

/* ── Stats ──────────────────────────────────────────────────────── */
function updateStats() {
  const tasks  = [...taskStore.values()];
  const active = tasks.filter(t => t.status === "running").length;
  const done   = tasks.filter(t => t.status === "completed").length;
  const speed  = [...speedMap.values()].reduce((s,v) => s+v, 0);
  statTotal.textContent     = tasks.length;
  statActive.textContent    = active;
  statCompleted.textContent = done;
  statSpeed.textContent     = fmt(speed) + "/s";
  statCount.textContent     = `${tasks.length} download${tasks.length!==1?"s":""}`;
}

function setStatus(msg) {
  statusMsg.textContent = msg;
  clearTimeout(setStatus._t);
  setStatus._t = setTimeout(() => { statusMsg.textContent = "Ready"; }, 4000);
}

/* ── Speed Graph ────────────────────────────────────────────────── */
function drawSpeedChart(totalSpeed) {
  speedHistory.push(totalSpeed);
  speedHistory.shift();

  const dpr = window.devicePixelRatio || 1;
  const W = speedChart.parentElement.clientWidth - 100;
  const H = 40;
  speedChart.width  = W * dpr;
  speedChart.height = H * dpr;
  speedChart.style.width  = W + "px";
  speedChart.style.height = H + "px";

  const ctx = speedChart.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);

  const max = Math.max(...speedHistory, 1024);
  const step = W / (speedHistory.length - 1);

  ctx.beginPath();
  speedHistory.forEach((v, i) => {
    const x = i * step;
    const y = H - (v / max) * (H - 6) - 3;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  const lineColor = getComputedStyle(document.body).getPropertyValue("--text").trim() || "#e8e8e8";
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fillStyle = hexToRgba(lineColor, 0.12);
  ctx.fill();

  // Grid line at 50%
  ctx.beginPath();
  ctx.moveTo(0, H / 2);
  ctx.lineTo(W, H / 2);
  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.lineWidth = 1;
  ctx.stroke();

  if (sgLabel) sgLabel.textContent = fmt(totalSpeed) + "/s";
}

/* Update speed graph every second */
setInterval(() => {
  const totalSpeed = [...speedMap.values()].reduce((s, v) => s + v, 0);
  drawSpeedChart(totalSpeed);
}, 1000);

/* ── Event bus ──────────────────────────────────────────────────── */
api.onEvent((event, payload) => {
  if (event === "DownloadStarted") {
    const existing = taskStore.get(payload.id) || { id: payload.id, createdAt: Date.now() };
    upsertRow({ ...existing, ...payload, status: "running" });
    setStatus("Started: " + (payload.url || "").split("/").pop());
    scheduleCatTreeRender();
  }
  if (event === "DownloadProgress") {
    const task = taskStore.get(payload.id);
    if (!task) return;
    speedMap.set(payload.id, payload.speed || 0);
    taskStore.set(payload.id, { ...task, receivedBytes: payload.bytesReceived, size: payload.size || task.size });
    scheduleRowRender(payload.id);
    return;
  }
  if (event === "DownloadCompleted") {
    const task = taskStore.get(payload.id) || {};
    taskStore.set(payload.id, { ...task, ...payload, status: "completed" });
    speedMap.set(payload.id, 0);
    upsertRow(taskStore.get(payload.id));
    setStatus("Completed: " + displayName(task));
    scheduleCatTreeRender();
  }
  if (event === "SecurityScanStarted") {
    const task = taskStore.get(payload.id) || {};
    taskStore.set(payload.id, { ...task, securityScan: { status: "pending", scanner: payload.scanner, message: "Scanning downloaded file..." } });
    upsertRow(taskStore.get(payload.id));
    setStatus("Security scan started: " + displayName(taskStore.get(payload.id)));
  }
  if (event === "SecurityScanCompleted") {
    const task = taskStore.get(payload.id) || {};
    taskStore.set(payload.id, {
      ...task,
      securityScan: {
        status: payload.status,
        scanner: payload.scanner,
        message: payload.message,
        scannedAt: Date.now(),
      },
    });
    upsertRow(taskStore.get(payload.id));
    setStatus(`Security scan ${payload.status}: ${payload.message}`);
  }
  if (event === "DownloadFailed") {
    const task = taskStore.get(payload.id) || {};
    if (task.status === "paused" || task.status === "cancelled") return;
    taskStore.set(payload.id, { ...task, status: "failed", lastError: payload.reason || null });
    speedMap.set(payload.id, 0);
    upsertRow(taskStore.get(payload.id));
    setStatus("Failed: " + (payload.reason || "unknown error"));
    scheduleCatTreeRender();
  }
  if (event === "DownloadPaused") {
    const task = taskStore.get(payload.id);
    if (task) {
      taskStore.set(payload.id, { ...task, status: "paused" });
      speedMap.set(payload.id, 0); upsertRow(taskStore.get(payload.id));
      scheduleCatTreeRender();
    }
  }
  if (event === "DownloadResumed") {
    const task = taskStore.get(payload.id);
    if (task) {
      taskStore.set(payload.id, { ...task, status: "queued" });
      upsertRow(taskStore.get(payload.id)); scheduleCatTreeRender();
    }
  }
  if (event === "TorrentPeerAdded") {
    const task = taskStore.get(payload.torrentId);
    if (task) {
      taskStore.set(payload.torrentId, { ...task, peers: payload.peerCount || (task.peers || 0) + 1 });
      scheduleRowRender(payload.torrentId);
    }
  }
  scheduleStatsRender();
});

/* ── Toolbar buttons ────────────────────────────────────────────── */
document.getElementById("btnAddUrl").addEventListener("click", () => {
  openPanel(addUrlPanel); urlInput.focus();
});

document.getElementById("btnOpenTorrent").addEventListener("click", async () => {
  const tasks = await api.addTorrentFile();
  if (!tasks || tasks.length === 0) return;
  for (const task of tasks) {
    if (task?.id) {
      taskStore.set(task.id, { ...task, createdAt: Date.now() }); upsertRow(taskStore.get(task.id));
    }
  }
  setStatus(`Added ${tasks.length} torrent${tasks.length !== 1 ? "s" : ""}`);
  updateStats(); scheduleCatTreeRender();
});

document.getElementById("btnBatchDownload").addEventListener("click", () => openBatchPanel());
document.getElementById("btnScheduler").addEventListener("click",     () => openSchedulerPanel());
document.getElementById("btnLogins").addEventListener("click",         () => openLoginsPanel());
document.getElementById("btnRss").addEventListener("click",            () => openRssPanel());
document.getElementById("btnCreateTorrent").addEventListener("click",  () => openPanel(createTorrentPanel));

document.getElementById("btnCancelAdd").addEventListener("click", () => { closePanel(addUrlPanel); dlForm.reset(); });

document.getElementById("btnLaterDownload").addEventListener("click", async () => {
  const url = urlInput.value.trim();
  if (!url) return;
  const label = labelInput.value.trim() || undefined;
  closePanel(addUrlPanel); dlForm.reset();
  const task = await api.addDownload({ url, filename: filenameInput.value.trim() || undefined, label, start: false });
  if (task?.id) {
    taskStore.set(task.id, { ...task, createdAt: Date.now() }); upsertRow(taskStore.get(task.id));
    taskStore.set(task.id, { ...taskStore.get(task.id), status: "queued" }); upsertRow(taskStore.get(task.id));
    setStatus("Queued: " + displayName(task)); updateStats(); scheduleCatTreeRender();
  }
});

dlForm.addEventListener("submit", async e => {
  e.preventDefault();
  const url = urlInput.value.trim();
  if (!url) return;
  const label = labelInput.value.trim() || undefined;
  closePanel(addUrlPanel); dlForm.reset();
  const task = await api.addDownload({ url, filename: filenameInput.value.trim() || undefined, label });
  if (task?.id) {
    taskStore.set(task.id, { ...task, createdAt: Date.now() }); upsertRow(taskStore.get(task.id));
    setStatus("Added: " + displayName(task)); updateStats();
  }
});

document.getElementById("btnResumeAll").addEventListener("click", resumeAllPaused);
async function resumeAllPaused() {
  const paused = [...taskStore.values()].filter(t => t.status === "paused");
  for (const t of paused) await handleRowAction(t.id, "resume");
  if (paused.length === 0) setStatus("No paused downloads to resume");
}

document.getElementById("btnPauseSelected").addEventListener("click", () => {
  if (selectedId) {
    const task = taskStore.get(selectedId);
    if (task && ["running","queued"].includes(task.status)) {
      handleRowAction(selectedId, "pause");
    } else {
      setStatus("Select an active download to pause");
    }
  } else {
    setStatus("Select a download first");
  }
});

document.getElementById("btnStopSelected").addEventListener("click", () => {
  if (selectedId) handleRowAction(selectedId, "stop"); else setStatus("Select a download first");
});
document.getElementById("btnStopAll").addEventListener("click", async () => {
  const active = [...taskStore.values()].filter(t => ["running","queued"].includes(t.status));
  for (const t of active) await handleRowAction(t.id, "stop");
  setStatus(`Stopped ${active.length} download${active.length !== 1 ? "s" : ""}`);
});
document.getElementById("btnDelete").addEventListener("click", () => {
  if (selectedId) handleRowAction(selectedId, "delete"); else setStatus("Select a download first");
});
document.getElementById("btnDeleteCompleted").addEventListener("click", () => deleteByStatus(["completed","cancelled"]));
async function deleteByStatus(statuses) {
  const items = [...taskStore.values()].filter(t => statuses.includes(t.status));
  for (const t of items) await handleRowAction(t.id, "delete");
  setStatus(`Deleted ${items.length} item${items.length !== 1 ? "s" : ""}`);
}
document.getElementById("btnStartQueue").addEventListener("click", resumeAllPaused);
document.getElementById("btnStopQueue").addEventListener("click", stopAllQueued);
async function stopAllQueued() {
  const queued = [...taskStore.values()].filter(t => t.status === "queued");
  for (const t of queued) await handleRowAction(t.id, "stop");
  setStatus(`Queue stopped (${queued.length} items)`);
}

document.getElementById("btnOptions").addEventListener("click", openSettings);
document.getElementById("btnSettings")?.addEventListener("click", openSettings);
document.getElementById("btnRegister")?.addEventListener("click", openRegistrationPanel);
document.getElementById("btnAbout")?.addEventListener("click", () => openPanel(aboutPanel));
document.getElementById("btnHelp")?.addEventListener("click", () => {
  const helpVersionEl = document.getElementById("helpVersionText");
  if (helpVersionEl) helpVersionEl.textContent = `v${_appVersion}`;
  const helpLicenseEl = document.getElementById("helpLicenseType");
  if (helpLicenseEl) {
    const stored = getStoredLicense?.();
    helpLicenseEl.textContent = stored?.plan ? (stored.plan.charAt(0).toUpperCase() + stored.plan.slice(1)) : "Unregistered";
  }
  openPanel(helpPanel);
});

document.getElementById("btnChooseDir").addEventListener("click", chooseDir);
async function chooseDir() {
  await api.chooseDownloadDir(); await refreshSettings(); setStatus("Download folder updated");
}

document.getElementById("btnToggleCat").addEventListener("click", toggleCatPanel);
function toggleCatPanel() {
  catPanelOpen = !catPanelOpen;
  catPanel.classList.toggle("hidden", !catPanelOpen);
}
function toggleToolbar() {
  const tb = document.getElementById("toolbar");
  tb.style.display = tb.style.display === "none" ? "" : "none";
}

/* ── Speusis application menu ──────────────────────────────────── */
const appMenus = {
  File: [
    ["Add URL…", "add-url", "Ctrl+N"],
    ["Open Torrent…", "open-torrent"],
    ["Choose Download Folder…", "choose-dir"],
    ["", "separator"],
    ["Close Menu", "close-menu", "Esc"],
  ],
  Downloads: [
    ["Resume All", "resume-all"],
    ["Pause Selected", "pause-selected"],
    ["Stop Selected", "stop-selected"],
    ["Stop All", "stop-all"],
    ["", "separator"],
    ["Delete Selected", "delete-selected", "Delete"],
    ["Delete Completed", "delete-completed"],
  ],
  View: [
    ["Show / Hide Toolbar", "toggle-toolbar"],
    ["Show / Hide Categories", "toggle-categories"],
    ["Show Speed Graph", "toggle-speed-graph"],
  ],
  Tools: [
    ["Options…", "settings"],
    ["Site Logins…", "logins"],
    ["Scheduler…", "scheduler"],
    ["RSS Feeds…", "rss"],
    ["Web Grabber…", "web-grabber"],
    ["Download Basket", "basket"],
    ["Create Torrent…", "create-torrent"],
    ["", "separator"],
    ["Registration", "registration"],
  ],
  Help: [
    ["Help & Support", "help"],
    ["About Speusis Downloader", "about"],
  ],
};

function closeMenuDropdown() {
  if (!menuDropdown) return;
  menuDropdown.classList.add("hidden");
  document.querySelectorAll(".menu-item.open").forEach(item => {
    item.classList.remove("open");
    item.setAttribute("aria-expanded", "false");
  });
}

function openMenuDropdown(button) {
  if (!menuDropdown) return;
  const menu = appMenus[button.dataset.menu];
  if (!menu) return;
  if (button.classList.contains("open")) {
    closeMenuDropdown();
    return;
  }
  closeMenuDropdown();
  menuDropdown.innerHTML = menu.map(([label, action, shortcut]) => {
    if (action === "separator") return `<div class="md-sep" role="separator"></div>`;
    return `<button class="md-item" role="menuitem" data-menu-action="${action}">
      <span>${escHtml(label)}</span>${shortcut ? `<span class="md-shortcut">${escHtml(shortcut)}</span>` : ""}
    </button>`;
  }).join("");
  button.classList.add("open");
  button.setAttribute("aria-expanded", "true");
  menuDropdown.classList.remove("hidden");
  const rect = button.getBoundingClientRect();
  menuDropdown.style.left = `${Math.max(4, rect.left)}px`;
  menuDropdown.style.top = `${rect.bottom + 2}px`;
}

document.querySelectorAll(".menu-item").forEach(button => {
  button.addEventListener("click", e => {
    e.stopPropagation();
    openMenuDropdown(button);
  });
});
menuDropdown?.addEventListener("click", e => {
  const item = e.target.closest("[data-menu-action]");
  if (!item) return;
  const action = item.dataset.menuAction;
  closeMenuDropdown();
  if (action === "close-menu") return;
  if (action === "toggle-speed-graph") {
    document.getElementById("speedGraphBar")?.classList.toggle("hidden");
    return;
  }
  nativeMenuActions[action]?.();
});
document.addEventListener("click", closeMenuDropdown);

const nativeMenuActions = {
  "add-url": () => { openPanel(addUrlPanel); urlInput.focus(); },
  "open-torrent": () => document.getElementById("btnOpenTorrent")?.click(),
  "batch-download": () => openBatchPanel(),
  "resume-all": () => resumeAllPaused(),
  "pause-selected": () => document.getElementById("btnPauseSelected")?.click(),
  "stop-selected": () => document.getElementById("btnStopSelected")?.click(),
  "stop-all": () => document.getElementById("btnStopAll")?.click(),
  "delete-selected": () => document.getElementById("btnDelete")?.click(),
  "delete-completed": () => deleteByStatus(["completed","cancelled"]),
  "choose-dir": () => chooseDir(),
  "logins": () => openLoginsPanel(),
  "start-queue": () => resumeAllPaused(),
  "stop-queue": () => stopAllQueued(),
  "scheduler": () => openSchedulerPanel(),
  "rss": () => openRssPanel(),
  "create-torrent": () => openPanel(createTorrentPanel),
  "web-grabber": () => openGrabberPanel(),
  "basket": () => api.openBasket?.(),
  "toggle-toolbar": () => toggleToolbar(),
  "toggle-categories": () => toggleCatPanel(),
  "settings": () => openSettings(),
  "about": () => openPanel(aboutPanel),
  "help": () => document.getElementById("btnHelp")?.click(),
  "registration": () => openRegistrationPanel(),
};

api.onMenuCommand?.((command) => {
  const action = nativeMenuActions[command];
  if (action) action();
});

/* ── Settings ───────────────────────────────────────────────────── */
async function openSettings() {
  await refreshSettings();
  selectSettingsTab("general");
  openPanel(settingsPanel);
}
document.getElementById("btnCloseSettings").addEventListener("click", () => closePanel(settingsPanel));
document.getElementById("btnCloseAbout").addEventListener("click", () => closePanel(aboutPanel));

function selectSettingsTab(tabName) {
  document.querySelectorAll(".settings-tab").forEach(tab => {
    const active = tab.dataset.settingsTab === tabName;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", active ? "true" : "false");
  });
  document.querySelectorAll(".settings-tab-panel").forEach(panel => {
    panel.classList.toggle("active", panel.dataset.settingsPanel === tabName);
  });
}
document.querySelectorAll(".settings-tab").forEach(tab => {
  tab.addEventListener("click", () => selectSettingsTab(tab.dataset.settingsTab));
});
document.getElementById("btnCloseHelp")?.addEventListener("click", () => closePanel(helpPanel));

document.getElementById("btnCheckUpdate")?.addEventListener("click", async () => {
  const statusEl = document.getElementById("updateCheckStatus");
  if (!statusEl) return;
  statusEl.style.color = "var(--muted)";
  statusEl.textContent = "Checking for updates…";
  try {
    const result = await api.checkForUpdate();
    const info  = result?.info  ?? null;
    const error = result?.error ?? null;
    if (info) {
      statusEl.style.color = "#86efac";
      statusEl.textContent = `v${info.version} is available! Downloading now starts from the update banner.`;
      // The main window shows the actual banner via the update-available
      // event the backend now emits (see update_check in commands.rs) -
      // toggling #updateBanner here only ever touched this popup's own
      // isolated copy of the DOM, which the user never sees.
    } else if (error) {
      statusEl.style.color = "#f87171";
      statusEl.textContent = "Could not reach update server.";
      console.warn("[Speusis] Update check failed:", error);
    } else {
      statusEl.style.color = "#86efac";
      statusEl.textContent = `You're up to date! (v${_appVersion} is the latest)`;
    }
  } catch {
    statusEl.style.color = "#f87171";
    statusEl.textContent = "Could not reach update server.";
  }
  setTimeout(() => { if (statusEl) statusEl.textContent = ""; }, 6000);
});

/* ── Registration Panel ─────────────────────────────────────────── */
const SPEUSIS_SAMPLE_LICENSES = {
  lifetime: { name: "Speusis Sample User", email: "sample@speusis.local", key: "SPEUSIS-LIFE-E0D6-551E4FD0" },
  monthly:  { name: "Speusis Sample User", email: "sample@speusis.local", key: "SPEUSIS-MTH-2442-100E322A" },
};
const REGISTERED_LICENSE = "speusis_registered_license";
// Real source of truth is the Rust-side license_get_status() call on
// startup (see checkLicenseStatus below) - this localStorage flag is only
// an optimistic placeholder shown before that async check resolves, so the
// UI doesn't flash "not registered" every launch. It's no longer what
// actually grants registered status; setting it from devtools alone does
// nothing now, since checkLicenseStatus() overwrites it either way.
let _isRegistered = localStorage.getItem("speusis_registered") === "1";

async function checkLicenseStatus() {
  try {
    const status = await api.getLicenseStatus();
    if (status) {
      _isRegistered = true;
      localStorage.setItem("speusis_registered", "1");
      localStorage.setItem(REGISTERED_LICENSE, JSON.stringify(status));
    } else {
      _isRegistered = false;
      localStorage.removeItem("speusis_registered");
      localStorage.removeItem(REGISTERED_LICENSE);
    }
  } catch {
    // Backend unreachable for some reason - fall back to whatever the
    // optimistic localStorage value already was, rather than locking
    // a legitimately-activated user out.
  }
  updateRegBadge();
}
checkLicenseStatus();

function getStoredLicense() {
  try {
    return JSON.parse(localStorage.getItem(REGISTERED_LICENSE) || "null");
  } catch {
    return null;
  }
}

function normalizeLicenseKey(value) {
  return String(value || "").trim().toUpperCase();
}

function updateRegBadge() {
  const badge = document.getElementById("regStatusBadge");
  const menuItem = document.querySelector('.menu-item[data-menu="Registration"]');
  const aboutVersionEl = document.getElementById("aboutVersionText");
  if (aboutVersionEl) aboutVersionEl.textContent = `Version ${_appVersion} — Windows`;
  document.title = `Speusis v${_appVersion}`;
  const settingsVersionEl = document.getElementById("settingsVersionText");
  if (settingsVersionEl) settingsVersionEl.textContent = `Speusis v${_appVersion}`;
  const regSuccessVersionEl = document.getElementById("regSuccessVersionText");
  if (regSuccessVersionEl) regSuccessVersionEl.textContent = `Speusis v${_appVersion}`;
  const regFormVersionEl = document.getElementById("regFormVersionText");
  if (regFormVersionEl) regFormVersionEl.textContent = `Speusis v${_appVersion}`;
  if (_isRegistered) {
    const license = getStoredLicense();
    if (badge) { badge.textContent = license?.name ? `Speusis v${_appVersion} • Registered to ${license.name}` : `Speusis v${_appVersion} • Registered`; badge.style.color = "#86efac"; }
    if (menuItem) { menuItem.style.color = "#86efac"; menuItem.style.fontWeight = "700"; }
  } else {
    if (badge) { badge.textContent = `Speusis v${_appVersion}`; badge.style.color = "var(--accent)"; }
    if (menuItem) { menuItem.style.color = "#fcd34d"; menuItem.style.fontWeight = "600"; }
  }
}

function fillRegLicenseCard(license) {
  const cardName = document.getElementById("regCardName");
  const cardEmail = document.getElementById("regCardEmail");
  const cardKey = document.getElementById("regCardKey");
  const cardPlan = document.getElementById("regCardPlan");
  if (cardName) cardName.textContent = license?.name || "";
  if (cardEmail) cardEmail.textContent = license?.email || "";
  if (cardKey) cardKey.textContent = license?.key || "";
  const planRaw = license?.plan || "lifetime";
  if (cardPlan) cardPlan.textContent = planRaw.charAt(0).toUpperCase() + planRaw.slice(1);
}

function openRegistrationPanel() {
  const formView = document.getElementById("regFormView");
  const successView = document.getElementById("regSuccessView");

  if (_isRegistered) {
    /* Already registered — show the card view, not the form */
    const license = getStoredLicense();
    if (formView) formView.classList.add("hidden");
    if (successView) successView.classList.remove("hidden");
    fillRegLicenseCard(license);
  } else {
    /* Not registered — show the form, clear inputs */
    if (formView) formView.classList.remove("hidden");
    if (successView) successView.classList.add("hidden");
    const nameInput = document.getElementById("regNameInput");
    const emailInput = document.getElementById("regEmailInput");
    const keyInput = document.getElementById("regKeyInput");
    if (nameInput) { nameInput.value = ""; nameInput.focus(); }
    if (emailInput) emailInput.value = "";
    if (keyInput) keyInput.value = "";
  }
  openPanel(registrationPanel);
}

function showRegFormView() {
  const formView = document.getElementById("regFormView");
  const successView = document.getElementById("regSuccessView");
  if (formView) formView.classList.remove("hidden");
  if (successView) successView.classList.add("hidden");
  const nameInput = document.getElementById("regNameInput");
  if (nameInput) { nameInput.value = ""; nameInput.focus(); }
  const emailInput = document.getElementById("regEmailInput");
  const keyInput = document.getElementById("regKeyInput");
  if (emailInput) emailInput.value = "";
  if (keyInput) keyInput.value = "";
  const btnBack = document.getElementById("btnRegBack");
  const btnCancel = document.getElementById("btnRegCancel");
  if (btnBack) btnBack.classList.remove("hidden");
  if (btnCancel) btnCancel.classList.add("hidden");
}

function showRegSuccessView() {
  const formView = document.getElementById("regFormView");
  const successView = document.getElementById("regSuccessView");
  if (formView) formView.classList.add("hidden");
  if (successView) successView.classList.remove("hidden");
  const btnBack = document.getElementById("btnRegBack");
  const btnCancel = document.getElementById("btnRegCancel");
  if (btnBack) btnBack.classList.add("hidden");
  if (btnCancel) btnCancel.classList.remove("hidden");
}

function fillSampleLicense(plan) {
  const sample = SPEUSIS_SAMPLE_LICENSES[plan];
  if (!sample) return;
  const nameInput = document.getElementById("regNameInput");
  const emailInput = document.getElementById("regEmailInput");
  const keyInput = document.getElementById("regKeyInput");
  if (nameInput) nameInput.value = sample.name;
  if (emailInput) emailInput.value = sample.email;
  if (keyInput) keyInput.value = sample.key;
}

const btnRegCancel       = document.getElementById("btnRegCancel");
const btnRegBack         = document.getElementById("btnRegBack");
const btnRegActivate     = document.getElementById("btnRegActivate");
const btnRegSuccessClose = document.getElementById("btnRegSuccessClose");
const btnRegSwitchLicense= document.getElementById("btnRegSwitchLicense");
const btnRegUseLifetime  = document.getElementById("btnRegUseLifetime");
const btnRegUseMonthly   = document.getElementById("btnRegUseMonthly");

if (btnRegCancel)        btnRegCancel.addEventListener("click", () => closePanel(registrationPanel));
if (btnRegBack)          btnRegBack.addEventListener("click", showRegSuccessView);
if (btnRegSuccessClose)  btnRegSuccessClose.addEventListener("click", () => closePanel(registrationPanel));
if (btnRegSwitchLicense) btnRegSwitchLicense.addEventListener("click", showRegFormView);
if (btnRegUseLifetime)   btnRegUseLifetime.addEventListener("click", () => fillSampleLicense("lifetime"));
if (btnRegUseMonthly)    btnRegUseMonthly.addEventListener("click", () => fillSampleLicense("monthly"));

if (btnRegActivate) {
  btnRegActivate.addEventListener("click", async () => {
    const name = document.getElementById("regNameInput")?.value?.trim();
    const email = document.getElementById("regEmailInput")?.value?.trim();
    const key   = document.getElementById("regKeyInput")?.value?.trim();
    const ki = document.getElementById("regKeyInput");
    const origText = btnRegActivate.textContent;
    btnRegActivate.disabled = true;
    btnRegActivate.textContent = "Activating…";
    try {
      // Real validation now happens in the Rust backend (checksummed
      // against name+email, device-locked for Monthly/Trial) instead of
      // a plaintext string comparison here in the renderer.
      const licenseData = await api.activateLicense(name, email, key);
      _isRegistered = true;
      localStorage.setItem("speusis_registered", "1");
      localStorage.setItem(REGISTERED_LICENSE, JSON.stringify(licenseData));
      updateRegBadge();
      const formView    = document.getElementById("regFormView");
      const successView = document.getElementById("regSuccessView");
      if (formView)    formView.classList.add("hidden");
      if (successView) successView.classList.remove("hidden");
      fillRegLicenseCard(licenseData);
    } catch (err) {
      if (ki) { ki.style.borderColor = "#f87171"; setTimeout(() => ki.style.borderColor = "", 1500); }
      const statusText = typeof err === "string" ? err : (err?.message || "Activation failed.");
      console.warn("[Speusis] License activation failed:", statusText);
    } finally {
      btnRegActivate.disabled = false;
      btnRegActivate.textContent = origText;
    }
  });
}

updateRegBadge();

async function refreshSettings() {
  const s = await api.getSettings();
  applyAppearance(s);

  const autoStartEl = document.getElementById("autoStartWithSystem");
  const minimizeEl  = document.getElementById("minimizeToTray");
  const routingEl   = document.getElementById("fileTypeRouting");
  const blocklistEl = document.getElementById("ipBlocklistUrl");
  const retriesEl   = document.getElementById("maxRetries");

  if (autoStartEl) {
    try { autoStartEl.checked = await api.getAutoStart?.() ?? s.autoStartWithSystem ?? false; }
    catch { autoStartEl.checked = s.autoStartWithSystem ?? false; }
  }
  if (minimizeEl)  minimizeEl.checked  = s.minimizeToTray  ?? true;
  if (routingEl)   routingEl.checked   = s.fileTypeRouting ?? false;
  if (blocklistEl) blocklistEl.value   = s.ipBlocklistUrl  ?? "";
  if (retriesEl)   retriesEl.value     = s.maxRetries      ?? 5;

  if (maxConcurrentEl)   maxConcurrentEl.value   = s.maxConcurrentDownloads ?? 3;
  if (defaultSegmentsEl) defaultSegmentsEl.value = s.defaultSegments ?? 8;
  if (downloadLimitKbEl) downloadLimitKbEl.value = s.downloadLimit ? Math.round(s.downloadLimit / 1024) : 0;
  if (uploadLimitKbEl)   uploadLimitKbEl.value   = s.uploadLimit   ? Math.round(s.uploadLimit / 1024)   : 0;
  if (listenerPortEl)    listenerPortEl.value    = s.listenerPort ?? 9999;
  if (remoteAccessEl)    remoteAccessEl.checked  = s.remoteAccess ?? false;
  if (allowInvalidTlsEl) allowInvalidTlsEl.checked = s.allowInvalidTls ?? false;
  if (seedRatioEl)       seedRatioEl.value       = s.seedRatio ?? 1.0;
  if (tempDirEl)         tempDirEl.value         = s.tempDir ?? "";

  const fields = { "Download Directory": s.downloadDir };
  settingsDet.innerHTML = Object.entries(fields)
    .map(([k,v]) => `<div class="sd-row"><span>${escHtml(k)}</span><strong>${escHtml(String(v??"-"))}</strong></div>`)
    .join("");
  const advancedDetails = document.querySelector(".settings-details-advanced");
  if (advancedDetails) {
    advancedDetails.innerHTML = [["Engine", "Speusis multi-segment core"]]
      .map(([k, v]) => `<div class="sd-row"><span>${escHtml(k)}</span><strong>${escHtml(String(v ?? "-"))}</strong></div>`).join("");
  }
  return s;
}

function applyAppearance(s) {
  const sysDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  const resolved = s.themeMode === "system" ? (sysDark ? "dark" : "light") : s.themeMode;
  document.body.dataset.theme  = resolved || "dark";
  document.body.dataset.accent = s.accentColor || "blue";
  if (themeMode)   themeMode.value   = s.themeMode   || "system";
  if (accentColor) accentColor.value = s.accentColor || "blue";
  if (scanCompletedFiles) scanCompletedFiles.checked = s.scanCompletedFiles !== false;
}
function applyTheme(mode) {
  document.body.dataset.theme = mode;
  api.updateSettings({ themeMode: mode, accentColor: accentColor?.value || "blue" });
}

themeMode?.addEventListener("change",   () => api.updateSettings({ themeMode: themeMode.value,   accentColor: accentColor?.value || "blue" }).then(applyAppearance));
accentColor?.addEventListener("change", () => api.updateSettings({ themeMode: themeMode?.value || "dark", accentColor: accentColor.value }).then(applyAppearance));
scanCompletedFiles?.addEventListener("change", () => api.updateSettings({ scanCompletedFiles: scanCompletedFiles.checked }).then(refreshSettings));

document.getElementById("autoStartWithSystem")?.addEventListener("change", async e => {
  await api.setAutoStart?.(e.target.checked);
  await api.updateSettings({ autoStartWithSystem: e.target.checked });
  setStatus(e.target.checked ? "Speusis will start with Windows" : "Auto-start disabled");
});
document.getElementById("minimizeToTray")?.addEventListener("change", async e => {
  await api.updateSettings({ minimizeToTray: e.target.checked });
  setStatus(e.target.checked ? "Minimize to tray enabled" : "Minimize to tray disabled");
});
document.getElementById("fileTypeRouting")?.addEventListener("change", async e => {
  await api.updateSettings({ fileTypeRouting: e.target.checked });
  setStatus(e.target.checked ? "File routing enabled (Video, Music, Documents…)" : "File routing disabled");
});
document.getElementById("ipBlocklistUrl")?.addEventListener("change", async e => {
  await api.updateSettings({ ipBlocklistUrl: e.target.value.trim() });
  setStatus("IP blocklist URL saved" + (e.target.value.trim() ? " — reloading…" : " (cleared)"));
});
document.getElementById("maxRetries")?.addEventListener("change", async e => {
  const v = parseInt(e.target.value) || 0;
  await api.updateSettings({ maxRetries: Math.max(0, Math.min(20, v)) });
  setStatus("Max retries set to " + v);
});

maxConcurrentEl?.addEventListener("change", async e => {
  const v = Math.max(1, Math.min(20, parseInt(e.target.value) || 1));
  e.target.value = v;
  await api.updateSettings({ maxConcurrentDownloads: v });
  setStatus("Max concurrent downloads set to " + v);
});
defaultSegmentsEl?.addEventListener("change", async e => {
  const v = Math.max(1, Math.min(32, parseInt(e.target.value) || 1));
  e.target.value = v;
  await api.updateSettings({ defaultSegments: v });
  setStatus("Segments per download set to " + v + " (applies to new downloads)");
});
document.getElementById("btnViewSegmentMap")?.addEventListener("click", () => {
  // openSegmentMapDialog() already handles a missing/null selectedId by
  // opening the dialog with an explanatory empty state (see dialogs.js) -
  // it must always be called so the card actually appears, instead of
  // this handler swallowing the no-selection case before the dialog ever
  // gets a chance to open.
  openSegmentMapDialog(selectedId);
});
downloadLimitKbEl?.addEventListener("change", async e => {
  const kb = Math.max(0, parseInt(e.target.value) || 0);
  e.target.value = kb;
  await api.updateSettings({ downloadLimit: kb * 1024 });
  setStatus(kb ? `Download limit set to ${kb} KB/s` : "Download limit removed");
});
uploadLimitKbEl?.addEventListener("change", async e => {
  const kb = Math.max(0, parseInt(e.target.value) || 0);
  e.target.value = kb;
  await api.updateSettings({ uploadLimit: kb * 1024 });
  setStatus(kb ? `Upload limit set to ${kb} KB/s` : "Upload limit removed");
});
listenerPortEl?.addEventListener("change", async e => {
  const v = Math.max(1024, Math.min(65535, parseInt(e.target.value) || 9999));
  e.target.value = v;
  await api.updateSettings({ listenerPort: v });
  setStatus("Listener port set to " + v + " — restart Speusis to apply");
});
remoteAccessEl?.addEventListener("change", async e => {
  if (e.target.checked) {
    const ok = confirm("Accept browser-extension connections from other devices on your network? Only enable this on networks you trust.");
    if (!ok) { e.target.checked = false; return; }
  }
  await api.updateSettings({ remoteAccess: e.target.checked });
  setStatus((e.target.checked ? "Remote access enabled" : "Remote access disabled") + " — restart Speusis to apply");
});
allowInvalidTlsEl?.addEventListener("change", async e => {
  await api.updateSettings({ allowInvalidTls: e.target.checked });
  setStatus(e.target.checked ? "Invalid TLS certificates allowed" : "Strict TLS certificates required");
});
seedRatioEl?.addEventListener("change", async e => {
  const v = Math.max(0, parseFloat(e.target.value) || 0);
  e.target.value = v;
  await api.updateSettings({ seedRatio: v });
  setStatus("Default seed ratio goal set to " + v);
});
tempDirEl?.addEventListener("change", async e => {
  const v = e.target.value.trim();
  await api.updateSettings({ tempDir: v });
  setStatus(v ? "Temp directory set — applies to new downloads" : "Temp directory cleared — using download folder");
});

/* ── Scheduler / Logins / RSS / Batch / Grabber / Torrent panels ──
 * Moved to panels-config.js and panels-transfer.js (v0.5.43 split,
 * Pass 2). Wired up via initConfigPanels()/initTransferPanels()
 * near the top of this file — see the `import` block up top and
 * the init calls right after settingsPanel wiring below. */

const { openSchedulerPanel, openLoginsPanel, openRssPanel } =
  initConfigPanels({ api, openPanel, closePanel, setStatus });

const { openBatchPanel, openGrabberPanel, openTorrentFilesPanel } =
  initTransferPanels({ api, openPanel, closePanel, setStatus, loadDownloads });

const { openMediaPlayerPanel } =
  initMediaPlayer({ api, openPanel, closePanel, setStatus, taskStore });

const { openRenameDialog, openPropertiesDialog, openSegmentMapDialog, openTracerPanel, showDeleteConfirm, stopSegMapPoll, stopTracerPoll } =
  initDialogs({ api, openPanel, closePanel, setStatus, taskStore, speedMap, upsertRow, removeRow, updateStats, scheduleCatTreeRender });

/* ── Init ───────────────────────────────────────────────────────── */
async function initializeNativePanel() {
  if (!isNativePanelWindow || !nativePanelName) return;

  switch (nativePanelName) {
    case "schedulerPanel":
      await openSchedulerPanel();
      break;
    case "loginsPanel":
      await openLoginsPanel();
      break;
    case "rssPanel":
      await openRssPanel();
      break;
    case "batchPanel":
      await openBatchPanel();
      break;
    case "grabberPanel":
      openGrabberPanel();
      break;
    case "torrentFilesPanel":
      await openTorrentFilesPanel(nativePanelTaskId);
      break;
    case "renameDialog":
      openRenameDialog(nativePanelTaskId);
      break;
    case "propertiesDialog":
      openPropertiesDialog(nativePanelTaskId);
      break;
    case "segmentMapDialog":
      openSegmentMapDialog(nativePanelTaskId);
      break;
    case "tracerPanel":
      openTracerPanel();
      break;
    case "deleteConfirmDialog":
      showDeleteConfirm(nativePanelTaskId);
      break;
    case "registrationPanel":
      openRegistrationPanel();
      break;
    case "autoUpdateDialog":
      openAutoUpdateDialog();
      break;
    default: {
      const nativePanel = document.getElementById(nativePanelName);
      if (nativePanel) openPanel(nativePanel, nativePanelTaskId);
      break;
    }
  }
}

// Mirrors native_panel_config's (width, height) in commands.rs. Used as a
// floor so tabbed/dynamic panels (Options especially - only the active tab
// is in the DOM, the rest are display:none) never shrink to fit whichever
// tab happens to be showing instead of their intended comfortable size.
const NATIVE_PANEL_SIZES = {
  addUrlPanel: [560, 420],
  settingsPanel: [700, 620],
  schedulerPanel: [560, 520],
  loginsPanel: [560, 460],
  rssPanel: [620, 520],
  batchPanel: [640, 520],
  createTorrentPanel: [560, 400],
  aboutPanel: [440, 430],
  helpPanel: [440, 450],
  registrationPanel: [520, 600],
  grabberPanel: [660, 560],
  torrentFilesPanel: [600, 460],
  renameDialog: [480, 300],
  propertiesDialog: [520, 420],
  deleteConfirmDialog: [520, 360],
  segmentMapDialog: [340, 300],
  tracerPanel: [380, 560],
  autoUpdateDialog: [480, 340],
  updateWarnDialog: [440, 260],
};

function installNativePanelSizing() {
  if (!isNativePanelWindow || !nativePanelName) return;
  const panel = document.getElementById(nativePanelName);
  if (!panel) return;

  // The window is already built at its exact correct size from
  // native_panel_config (Rust) before this ever runs - no measuring or
  // auto-resizing here. That loop (ResizeObserver -> measure -> resizePanel
  // -> repeat) has now caused this same "broken looking dialog" complaint
  // twice - it kept re-measuring shared index.html content and overwriting
  // an already-correct size with a wrong one. Trusting the Rust-side size
  // as final removes the loop instead of patching it again.
  const currentWindow = window.__TAURI__?.window?.getCurrentWindow?.();
  if (!currentWindow?.startResizeDragging) return;
  const DIRS = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];
  DIRS.forEach(dir => {
    const grip = document.createElement("div");
    grip.className = `native-resize-grip native-resize-${dir}`;
    grip.addEventListener("pointerdown", event => {
      if (event.button !== 0) return;
      event.preventDefault();
      currentWindow.startResizeDragging(dir).catch(() => {});
    });
    panel.appendChild(grip);
  });
}

async function loadDownloads() {
  const items = await api.listDownloads();
  for (const t of items) {
    taskStore.set(t.id, { ...t, status: t.status === "running" ? "paused" : t.status });
  }
  renderAll();
}

/* Each startup step used to run in one unguarded await chain, and the
 * only error handling anywhere was `init().catch(() => {})` at the
 * bottom of this file - so a single throw in any one step (a null
 * element, a settings shape mismatch, anything) silently killed every
 * step after it, with zero feedback anywhere the user could see it.
 * That's the kind of bug that looks like "the app just doesn't show
 * X" for reasons that have nothing to do with X's own code. Each step
 * below is now isolated: a failure is logged and, for the steps the
 * rest of startup actually depends on, surfaced in the status bar,
 * but it can no longer prevent the remaining steps from running. */
async function init() {
  const criticalSteps = [
    ["settings", refreshSettings],
    ["category tree", buildCatTree],
    ["download list", loadDownloads],
    ["window setup", initializeNativePanel],
  ];
  for (const [label, fn] of criticalSteps) {
    try {
      await fn();
    } catch (err) {
      console.error(`[init] ${label} failed to load:`, err);
      setStatus(`Startup warning: ${label} failed to load`);
    }
  }

  const secondarySteps = [
    ["panel sizing", installNativePanelSizing],
    ["speed chart", () => drawSpeedChart(0)],
    ["update banner", initUpdateBanner],
    ["auto-update prompt", initAutoUpdatePrompt],
    ["clipboard monitor", initClipboardMonitor],
  ];
  for (const [label, fn] of secondarySteps) {
    try {
      await fn();
    } catch (err) {
      console.error(`[init] ${label} failed to start:`, err);
    }
  }
}

/* ── Update notification banner ──────────────────────────────────── */
function initUpdateBanner() {
  const banner        = document.getElementById("updateBanner");
  const ubVersion     = document.getElementById("ubVersion");
  const ubNotes       = document.getElementById("ubNotes");
  const ubDownload    = document.getElementById("ubDownloadBtn");
  const ubQuickPatch  = document.getElementById("ubQuickPatchBtn");
  const ubDismiss     = document.getElementById("ubDismissBtn");

  if (!banner || !api.onUpdateAvailable) return;

  const ubCurrent = document.getElementById("ubCurrentVersion");
  if (ubCurrent) ubCurrent.textContent = "v" + _appVersion;

  function showBanner(info) {
    ubVersion.textContent = "v" + info.version;
    ubNotes.textContent   = info.releaseNotes ? info.releaseNotes.split("\n")[0].replace(/^#+\s*/, "") : "";
    banner.dataset.url    = info.downloadUrl || "";
    banner.dataset.asarUrl = info.asarUrl || "";
    banner.dataset.version = info.version || "";
    if (ubQuickPatch) ubQuickPatch.style.display = info.asarUrl ? "" : "none";
    if (ubDownload) {
      ubDownload.disabled = false;
      ubDownload.textContent = info.downloadSize ? `Download Update (${fmt(info.downloadSize)})` : "Download Update";
    }
    banner.classList.add("visible");
  }

  function hideBanner() {
    banner.classList.remove("visible");
  }

  api.onUpdateAvailable(showBanner);

  /* Wire up patch progress events */
  if (api.onPatchProgress) {
    api.onPatchProgress((pct) => {
      if (ubQuickPatch) {
        ubQuickPatch.textContent = pct < 100 ? `Downloading… ${pct}%` : "Applying patch…";
      }
    });
  }

  /* Full installer download — stays in Speusis download list */
  ubDownload.addEventListener("click", async () => {
    const url = banner.dataset.url;
    if (!url) return;
    const origText = ubDownload.textContent;
    ubDownload.disabled = true;
    ubDownload.textContent = "Adding…";
    try {
      const result = await api.addDownload({ url, start: true, label: banner.dataset.version ? `Speusis v${banner.dataset.version} Setup` : "Speusis Update Setup" });
      if (result?.id) {
        taskStore.set(result.id, { ...result, createdAt: Date.now() });
        upsertRow(taskStore.get(result.id));
        setStatus("Speusis update added to downloads — check the download list.");
        scheduleCatTreeRender();
        hideBanner();
      } else {
        ubDownload.disabled = false;
        ubDownload.textContent = origText;
        setStatus("Could not add update to download list — opening in browser…");
        setTimeout(() => api.openUpdateDownload(url), 600);
      }
    } catch {
      ubDownload.disabled = false;
      ubDownload.textContent = origText;
      setStatus("Update error — opening in browser…");
      setTimeout(() => api.openUpdateDownload(url), 600);
    }
  });

  /* Quick Patch — downloads 3MB asar and swaps it */
  if (ubQuickPatch) {
    ubQuickPatch.addEventListener("click", async () => {
      const asarUrl = banner.dataset.asarUrl;
      if (!asarUrl) return;
      ubQuickPatch.disabled = true;
      ubQuickPatch.textContent = "Starting download…";
      if (ubDownload) ubDownload.disabled = true;

      try {
        const dlResult = await api.downloadPatch(asarUrl);
        if (!dlResult?.success) {
          ubQuickPatch.disabled = false;
          ubQuickPatch.textContent = "Quick Patch (~3MB)";
          if (ubDownload) ubDownload.disabled = false;
          setStatus("Patch download failed: " + (dlResult?.error || "unknown error"));
          return;
        }

        ubQuickPatch.textContent = "Applying patch…";
        const applyResult = await api.applyPatch();
        if (!applyResult?.success) {
          ubQuickPatch.disabled = false;
          ubQuickPatch.textContent = "Quick Patch (~3MB)";
          if (ubDownload) ubDownload.disabled = false;
          setStatus("Could not apply patch: " + (applyResult?.error || "unknown error"));
          return;
        }

        hideBanner();
        setStatus(applyResult.method === "elevated"
          ? "Approve the admin prompt to apply the patch — Speusis will restart automatically."
          : "Patch applied! Restarting Speusis…");
      } catch (err) {
        ubQuickPatch.disabled = false;
        ubQuickPatch.textContent = "Quick Patch (~3MB)";
        if (ubDownload) ubDownload.disabled = false;
        setStatus("Patch error: " + String(err));
      }
    });
  }

  ubDismiss.addEventListener("click", hideBanner);
}

/* ── Automatic startup update prompt (IDM-style) ─────────────────── */
function initAutoUpdatePrompt() {
  if (!autoUpdateDialog || !api.onStartupUpdateAvailable) return;

  api.onStartupUpdateAvailable(info => {
    openAutoUpdateDialog(info);
  });
}

async function openAutoUpdateDialog(info) {
  if (!info) {
    try { info = await api.getPendingUpdate?.(); } catch { info = null; }
  }
  if (!info) return;

  autoUpdateDialog.dataset.url = info.downloadUrl || "";
  const versionLine = document.getElementById("auVersionLine");
  const notesEl = document.getElementById("auNotes");
  if (versionLine) versionLine.textContent = `Version ${info.version} is available` + (info.downloadSize ? ` (${fmt(info.downloadSize)})` : "");
  if (notesEl) notesEl.textContent = info.releaseNotes || "";

  openPanel(autoUpdateDialog);
}

document.getElementById("btnAutoUpdateYes")?.addEventListener("click", async () => {
  const btn = document.getElementById("btnAutoUpdateYes");
  const url = autoUpdateDialog.dataset.url;
  if (!url) { closePanel(autoUpdateDialog); return; }
  const origText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Adding…";
  try {
    const result = await api.addDownload({ url, start: true, label: `Speusis v${_appVersion} Setup` });
    if (result?.id) {
      taskStore.set(result.id, { ...result, createdAt: Date.now() });
      upsertRow(taskStore.get(result.id));
      setStatus("Speusis update added to downloads — check the download list.");
      scheduleCatTreeRender();
      closePanel(autoUpdateDialog);
    } else {
      btn.disabled = false;
      btn.textContent = origText;
      setStatus("Could not add update to download list — opening in browser…");
      setTimeout(() => api.openUpdateDownload(url), 600);
      closePanel(autoUpdateDialog);
    }
  } catch {
    btn.disabled = false;
    btn.textContent = origText;
    setStatus("Update error — opening in browser…");
    setTimeout(() => api.openUpdateDownload(url), 600);
    closePanel(autoUpdateDialog);
  }
});

document.getElementById("btnAutoUpdateNo")?.addEventListener("click", () => {
  closePanel(autoUpdateDialog);
  openPanel(updateWarnDialog);
});

document.getElementById("btnUpdateWarnBack")?.addEventListener("click", () => {
  closePanel(updateWarnDialog);
  openAutoUpdateDialog();
});

/* ── Clipboard URL monitor ───────────────────────────────────────── */
function initClipboardMonitor() {
  if (!api.onClipboardUrl) return;

  const banner   = document.getElementById("clipboardBanner");
  const cbUrlEl  = document.getElementById("cbUrl");
  const cbAddBtn = document.getElementById("cbAddBtn");
  const cbDismiss= document.getElementById("cbDismissBtn");
  if (!banner || !cbUrlEl || !cbAddBtn || !cbDismiss) return;

  let lastOfferedUrl = "";

  api.onClipboardUrl((url) => {
    if (url === lastOfferedUrl) return;
    lastOfferedUrl = url;
    cbUrlEl.textContent = url;
    cbUrlEl.title = url;
    banner.dataset.url = url;
    banner.style.display = "flex";
  });

  cbAddBtn.addEventListener("click", async () => {
    const url = banner.dataset.url;
    if (!url) return;
    banner.style.display = "none";
    const result = await api.addDownload({ url, start: true });
    if (result?.id) {
      taskStore.set(result.id, { ...result, createdAt: Date.now() });
      upsertRow(taskStore.get(result.id));
      setStatus("Added from clipboard: " + (result.filename || url.split("/").pop()?.split("?")[0] || url));
      scheduleCatTreeRender();
    } else {
      setStatus("Could not add clipboard URL");
    }
  });

  cbDismiss.addEventListener("click", () => {
    banner.style.display = "none";
  });
}

init().catch((err) => console.error("[init] fatal error:", err));
