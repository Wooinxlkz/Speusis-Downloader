/* ─── Speusis v0.5.35 — Renderer ────────────────────────────────────── */
"use strict";

const api = window.downloadManager;
const nativePanelQuery = new URLSearchParams(window.location.search);
const nativePanelName = nativePanelQuery.get("panel");
const nativePanelTaskId = nativePanelQuery.get("id");
const isNativePanelWindow = Boolean(nativePanelName);
if (isNativePanelWindow) document.body.classList.add("native-panel-window");
/* ── App version (populated async at startup) ───────────────────── */
let _appVersion = "0.5.35";
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
const dlForm          = document.getElementById("downloadForm");
const urlInput        = document.getElementById("urlInput");
const filenameInput   = document.getElementById("filenameInput");
const labelInput      = document.getElementById("labelInput");
const ctxMenu         = document.getElementById("contextMenu");
const renameDialog    = document.getElementById("renameDialog");
const propertiesDialog= document.getElementById("propertiesDialog");
const segmentMapDialog= document.getElementById("segmentMapDialog");
const tracerPanel     = document.getElementById("tracerPanel");
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
const ALL_PANELS = [addUrlPanel, settingsPanel, schedulerPanel, loginsPanel, rssPanel, batchPanel, createTorrentPanel, aboutPanel, helpPanel, registrationPanel, renameDialog, propertiesDialog, deleteConfirmDialog, grabberPanel, torrentFilesPanel, segmentMapDialog, tracerPanel];

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
  "minmax(96px, .7fr)", "minmax(124px, 1fr)", "minmax(128px, 1fr)",
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
function fmt(bytes) {
  if (!bytes || bytes <= 0) return "0 B";
  const u = ["B","KB","MB","GB","TB"];
  const i = Math.min(u.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 2)} ${u[i]}`;
}

function fmtSecs(s) {
  if (!Number.isFinite(s) || s <= 0) return "—";
  if (s < 60)   return `${Math.round(s)}s`;
  if (s < 3600) return `${Math.floor(s/60)}m ${Math.round(s%60)}s`;
  return `${Math.floor(s/3600)}h ${Math.floor((s%3600)/60)}m`;
}

function displayName(t) {
  return t.filename || t.outputPath?.split(/[\\/]/).pop() || t.url?.split("/").pop()?.split("?")[0] || "download";
}

function escHtml(v) {
  return String(v ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[c]);
}

/* ── File-type icon ──────────────────────────────────────────────── */
const EXT_COLORS = {
  zip:"#f59e0b",rar:"#f59e0b","7z":"#f59e0b",tar:"#f59e0b",gz:"#f59e0b",bz2:"#f59e0b",
  pdf:"#ef4444",doc:"#3b82f6",docx:"#3b82f6",txt:"#94a3b8",
  xls:"#22c55e",xlsx:"#22c55e",csv:"#22c55e",
  mp3:"#a78bfa",flac:"#a78bfa",wav:"#a78bfa",aac:"#a78bfa",ogg:"#a78bfa",
  mp4:"#ec4899",mkv:"#ec4899",avi:"#ec4899",mov:"#ec4899",wmv:"#ec4899",
  exe:"#f97316",msi:"#f97316",dmg:"#f97316",apk:"#22c55e",
  iso:"#64748b",img:"#64748b",
  jpg:"#06b6d4",jpeg:"#06b6d4",png:"#06b6d4",gif:"#06b6d4",webp:"#06b6d4",svg:"#06b6d4",
  m3u8:"#ec4899",mpd:"#a78bfa",ts:"#ec4899",
  torrent:"#10b981",
};

function fileTypeBadge(name) {
  const ext = (name || "").split(".").pop()?.toLowerCase() || "?";
  const color = EXT_COLORS[ext] || "#6366f1";
  const label = ext.slice(0, 4).toUpperCase();
  return `<svg width="28" height="20" viewBox="0 0 28 20" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0">
    <rect x="0.5" y="0.5" width="27" height="19" rx="2" fill="${color}" fill-opacity="0.16" stroke="${color}" stroke-opacity="0.32"/>
    <text x="14" y="14" font-family="monospace" font-size="7" font-weight="700"
          fill="${color}" text-anchor="middle" letter-spacing="0.3">${label}</text>
  </svg>`;
}

/* ── Row SVG action buttons ─────────────────────────────────────── */
const BTN_SVG = {
  play:    `<svg width="12" height="12" viewBox="0 0 20 20"><polygon points="4,3 17,10 4,17" fill="#6ee7b7"/></svg>`,
  pause:   `<svg width="12" height="12" viewBox="0 0 20 20"><rect x="4" y="4" width="4" height="12" rx="1" fill="#fcd34d"/><rect x="12" y="4" width="4" height="12" rx="1" fill="#fcd34d"/></svg>`,
  stop:    `<svg width="12" height="12" viewBox="0 0 20 20"><rect x="4" y="4" width="12" height="12" rx="2" fill="#f87171"/></svg>`,
  retry:   `<svg width="12" height="12" viewBox="0 0 20 20"><path d="M4 10a6 6 0 106-6" stroke="#60a5fa" stroke-width="2" fill="none" stroke-linecap="round"/><polyline points="4,5 4,10 9,10" stroke="#60a5fa" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  del:     `<svg width="12" height="12" viewBox="0 0 20 20"><polyline points="3,6 17,6" stroke="#f87171" stroke-width="1.8" fill="none"/><path d="M8 6V4h4v2M5 6l1 11h8l1-11" stroke="#f87171" stroke-width="1.5" fill="none"/></svg>`,
  preview: `<svg width="12" height="12" viewBox="0 0 20 20"><polygon points="4,3 17,10 4,17" fill="#e8e8e8"/></svg>`,
};

const VIDEO_EXT = /\.(mp4|mkv|avi|mov|wmv|flv|webm|ts|m3u8|mpd|m4v)$/i;
const AUDIO_EXT = /\.(mp3|flac|wav|aac|ogg|m4a|wma)$/i;

function actionMenuMarkup(status, kind) {
  if (!ctxMenu) return "";
  const isDone = status === "completed";
  const isActive = ["running", "queued"].includes(status);
  const isPausedOrFailed = ["paused", "failed", "cancelled"].includes(status);
  const disabled = action => (
    (["open", "openwith", "openfolder"].includes(action) && !isDone && !isActive) ||
    (action === "resume" && !isPausedOrFailed) ||
    (["pause", "stop"].includes(action) && !isActive)
  );

  return [...ctxMenu.children].map(source => {
    if (source.classList.contains("ctx-sep")) return source.outerHTML;
    if (!source.classList.contains("ctx-item")) return "";
    const action = source.dataset.action;
    if (action === "torrent-files" && kind !== "torrent") return "";
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
      <span class="row-action-dropdown hidden" role="menu">${actionMenuMarkup(status, kind)}</span>
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
  const menuWidth = menu.offsetWidth || 236;
  menu.style.position = "fixed";
  menu.style.right = "auto";
  menu.style.left = `${Math.max(8, Math.min(window.innerWidth - menuWidth - 8, rect.right - menuWidth))}px`;
  menu.style.top = `${Math.min(window.innerHeight - 12, rect.bottom + 6)}px`;
  if (rect.bottom + 6 + menu.offsetHeight > window.innerHeight) {
    menu.style.top = `${Math.max(8, rect.top - menu.offsetHeight - 6)}px`;
  }
}

function scanBadge(scan) {
  if (!scan?.status) return "";
  const labels = {
    pending: ["st-running", "Scanning"],
    clean: ["st-completed", "Clean"],
    "threats-found": ["st-failed", "Threat"],
    failed: ["st-failed", "Scan failed"],
    skipped: ["st-paused", "Not scanned"],
  };
  const [cls, label] = labels[scan.status] || ["st-paused", scan.status];
  const title = scan.message ? ` title="${escHtml(scan.message)}"` : "";
  return ` <span class="st-badge ${cls}"${title}>${label}</span>`;
}

function statusBadge(task) {
  const status = task?.status;
  const map = {
    running:   ["st-running",   "Downloading"],
    completed: ["st-completed", "Complete"],
    paused:    ["st-paused",    "Paused"],
    queued:    ["st-queued",    "Queued"],
    failed:    ["st-failed",    "Failed"],
    cancelled: ["st-cancelled", "Cancelled"],
  };
  const [cls, label] = map[status] || ["st-queued", status || "Unknown"];
  return `<span class="st-badge ${cls}">${label}</span>${scanBadge(task?.securityScan)}`;
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
    case "preview": {
      try {
        const result = await api.previewDownload(id);
        if (result?.ok) setStatus("Preview opened: " + displayName(task));
        else setStatus("Preview unavailable: " + (result?.error || "no file"));
      } catch { setStatus("Preview failed"); }
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

/* ── Rename dialog ──────────────────────────────────────────────── */
function openRenameDialog(id) {
  const task = taskStore.get(id);
  if (!task) return;
  const input = document.getElementById("renameInput");
  input.value = displayName(task);
  openPanel(renameDialog, id);
  input.focus(); input.select();

  const doRename = () => {
    const newName = input.value.trim();
    if (newName) {
      taskStore.set(id, { ...task, filename: newName });
      upsertRow(taskStore.get(id));
      setStatus("Renamed to: " + newName);
    }
    closePanel(renameDialog);
  };

  document.getElementById("btnRenameOk").onclick = doRename;
  document.getElementById("btnRenameCancel").onclick = () => closePanel(renameDialog);
  input.onkeydown = (e) => { if (e.key === "Enter") doRename(); if (e.key === "Escape") closePanel(renameDialog); };
}

/* ── Properties dialog ──────────────────────────────────────────── */
function openPropertiesDialog(id) {
  const task = taskStore.get(id);
  if (!task) return;
  const name = displayName(task);
  const received = task.receivedBytes || 0;
  const size = Number(task.size || 0);
  const pct = size > 0 ? ((received / size) * 100).toFixed(1) + "%" : "—";
  const rows = [
    ["File name",    name],
    ["URL",          task.url || "—"],
    ["Status",       task.status || "—"],
    ["Size",         size > 0 ? fmt(size) : "—"],
    ["Downloaded",   received > 0 ? fmt(received) : "—"],
    ["Progress",     pct],
    ["Label",        task.label || "—"],
    ["Created",      task.createdAt ? new Date(task.createdAt).toLocaleString() : "—"],
    ["Type",         task.kind || "http"],
  ];
  const content = document.getElementById("propertiesContent");
  content.innerHTML = rows.map(([k, v]) =>
    `<div class="sd-row"><span>${escHtml(k)}</span><strong style="word-break:break-all;text-align:right;max-width:300px;">${escHtml(String(v))}</strong></div>`
  ).join("");
  openPanel(propertiesDialog);
  document.getElementById("btnCloseProperties").onclick = () => closePanel(propertiesDialog);
}

/* ── Segment map dialog ─────────────────────────────────────────── */
let _segMapPoll = null;
function stopSegMapPoll() { if (_segMapPoll) { clearInterval(_segMapPoll); _segMapPoll = null; } }

async function renderSegmentMap(id) {
  const grid = document.getElementById("segMapGrid");
  const stats = document.getElementById("segMapStats");
  const empty = document.getElementById("segMapEmpty");
  const summary = document.getElementById("segMapSummary");
  const speedEl = document.getElementById("segMapSpeed");
  const activeEl = document.getElementById("segMapActive");
  let map;
  try { map = await api.getSegmentMap(id); } catch { map = null; }

  if (!map || !map.totalSegments) {
    grid.innerHTML = ""; stats.innerHTML = "";
    grid.classList.add("hidden"); stats.classList.add("hidden");
    empty.classList.remove("hidden");
    if (summary) summary.textContent = "— segments";
    if (speedEl) speedEl.textContent = "—";
    if (activeEl) activeEl.textContent = "NO LIVE MAP";
    return;
  }
  grid.classList.remove("hidden"); stats.classList.remove("hidden"); empty.classList.add("hidden");
  if (summary) summary.textContent = `${map.totalSegments} segments`;
  if (speedEl) speedEl.textContent = speedMap.get(id) > 0 ? `${fmt(speedMap.get(id))}/s` : "—";
  if (activeEl) activeEl.textContent = `${map.segments.filter(s => !s.done && s.received > 0).length} active`;

  grid.innerHTML = map.segments.map(seg => {
    const len = seg.end - seg.start + 1;
    const partial = !seg.done && seg.received > 0;
    const cls = seg.done ? "seg-done" : partial ? "seg-partial" : "";
    const pct = len > 0 ? Math.round((seg.received / len) * 100) : 0;
    return `<div class="seg-tile ${cls}" title="Segment ${seg.index + 1}: ${pct}%">${seg.done ? "✓" : (partial ? pct : "")}</div>`;
  }).join("");

  const doneCount = map.segments.filter(s => s.done).length;
  const remaining = Math.max(0, map.totalBytes - map.downloadedBytes);
  stats.innerHTML = [
    ["Downloaded", fmt(map.downloadedBytes)],
    ["Remaining",  fmt(remaining)],
    ["Segments",   `${doneCount} / ${map.totalSegments}`],
    ["Total size", fmt(map.totalBytes)],
  ].map(([label, value]) => `<div class="sms-item"><div class="sms-label">${escHtml(label)}</div><div class="sms-value">${escHtml(value)}</div></div>`).join("");
}

async function openSegmentMapDialog(id) {
  const task = taskStore.get(id);
  if (!id || !task) {
    setStatus("Select a download first to view its segment map");
    return;
  }
  document.getElementById("segMapName").textContent = task ? displayName(task) : "";
  await renderSegmentMap(id);
  openPanel(segmentMapDialog, id);
  stopSegMapPoll();
  _segMapPoll = setInterval(() => renderSegmentMap(id), 1500);
  document.getElementById("btnCloseSegMap").onclick = () => { stopSegMapPoll(); closePanel(segmentMapDialog); };
}

/* ── Tracer panel (FlexD-style all/active/done trace view) ─────── */
let _tracerFilter = "all";
let _tracerPoll = null;
function stopTracerPoll() { if (_tracerPoll) { clearInterval(_tracerPoll); _tracerPoll = null; } }

function traceState(status) {
  if (status === "running" || status === "active" || status === "downloading") return ["active", "active", "trace-active"];
  if (status === "completed" || status === "done") return ["done", "done", "trace-done"];
  if (status === "paused") return ["paused", "paused", "trace-paused"];
  if (status === "failed") return ["failed", "failed", "trace-failed"];
  if (status === "queued") return ["waiting", "waiting", "trace-waiting"];
  return ["cancelled", "cancelled", "trace-failed"];
}

function traceIcon(state) {
  if (state === "active") return `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3v9M6.5 9.5L10 13l3.5-3.5M4 16h12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  if (state === "done") return `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 10.5l3 3 7-7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  if (state === "paused") return `<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="5" y="4" width="3.5" height="12" rx="1" fill="currentColor"/><rect x="11.5" y="4" width="3.5" height="12" rx="1" fill="currentColor"/></svg>`;
  if (state === "failed") return `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 6l8 8M14 6l-8 8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
  return `<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10 6.5v4l2.5 1.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;
}

async function renderTracerList() {
  const list = document.getElementById("tracerList");
  if (!list) return;
  let tasks = [];
  try { tasks = await api.listDownloads(); } catch { tasks = []; }

  const runningCount = tasks.filter(t => ["running", "active", "downloading"].includes(t.status)).length;
  const doneCount = tasks.filter(t => ["completed", "done"].includes(t.status)).length;
  const totalSpeed = [...speedMap.values()].reduce((sum, value) => sum + value, 0);
  document.getElementById("tracerAllCount")?.replaceChildren(document.createTextNode(String(tasks.length)));
  document.getElementById("tracerActiveTabCount")?.replaceChildren(document.createTextNode(String(runningCount)));
  document.getElementById("tracerActiveCount")?.replaceChildren(document.createTextNode(String(runningCount)));
  document.getElementById("tracerDoneCount")?.replaceChildren(document.createTextNode(String(doneCount)));
  const tracerSpeed = document.getElementById("tracerSpeed");
  if (tracerSpeed) tracerSpeed.textContent = `${fmt(totalSpeed)} /s`;

  const filtered = tasks.filter(t => {
    if (_tracerFilter === "active") return !["completed", "done"].includes(t.status);
    if (_tracerFilter === "done") return ["completed", "done"].includes(t.status);
    return true;
  });

  if (!filtered.length) {
    list.innerHTML = `<div class="trace-empty">No downloads to show.</div>`;
    return;
  }

  list.innerHTML = filtered.map(t => {
    const size = Number(t.size || 0);
    const received = Number(t.receivedBytes || 0);
    const pct = size > 0 ? Math.min(100, Math.round((received / size) * 100)) : 0;
    const [state, label, iconClass] = traceState(t.status);
    const isActive = state === "active";
    const isPaused = t.status === "paused";
    const rate = speedMap.get(t.id) > 0 ? fmt(speedMap.get(t.id)) + "/s" : "—";
    const segments = t.totalSegments || t.segmentCount || t.segments || "—";
    const receivedLabel = received > 0 ? fmt(received) : "0 B";
    return `<div class="tracer-item" data-id="${escHtml(t.id)}">
      <div class="tracer-item-top">
        <span class="trace-state-icon ${iconClass}">${traceIcon(state)}</span>
        <span class="tracer-item-name">${escHtml(displayName(t))}</span>
        <span class="tracer-item-rate">${escHtml(rate)}</span>
      </div>
      <div class="tracer-item-meta">${escHtml(receivedLabel)} · ${size > 0 ? escHtml(fmt(size)) : "size unknown"} · ${escHtml(label)}</div>
      <div class="tracer-item-meta trace-submeta">${isActive ? "ETA " + escHtml(fmtSecs(t.etaSeconds || 0)) : (t.status === "failed" ? "download failed" : label)} · ${escHtml(String(segments))} segs</div>
      <div class="tracer-progress"><div class="tracer-progress-fill ${iconClass}" style="width:${pct}%"></div></div>
      <div class="tracer-item-footer">
        <span>${escHtml(t.outputPath ? "saved to " + t.outputPath : "source: " + (t.url || "").slice(0, 48))}</span>
        ${(isActive || isPaused) ? `<span class="tracer-item-actions">
          ${isActive ? `<button class="trace-action" data-tracer-action="pause" title="Pause">${BTN_SVG.pause}</button>` : ""}
          ${isPaused ? `<button class="trace-action" data-tracer-action="resume" title="Resume">${BTN_SVG.play}</button>` : ""}
          <button class="trace-action" data-tracer-action="stop" title="Stop">${BTN_SVG.stop}</button>
        </span>` : ""}
      </div>
    </div>`;
  }).join("");
}

async function openTracerPanel() {
  _tracerFilter = "all";
  document.querySelectorAll(".tracer-tab").forEach(t => t.classList.toggle("active", t.dataset.tracerFilter === "all"));
  await renderTracerList();
  openPanel(tracerPanel);
  stopTracerPoll();
  _tracerPoll = setInterval(renderTracerList, 1500);
}

document.getElementById("btnCloseTracer")?.addEventListener("click", () => { stopTracerPoll(); closePanel(tracerPanel); });
document.querySelectorAll(".tracer-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    _tracerFilter = tab.dataset.tracerFilter;
    document.querySelectorAll(".tracer-tab").forEach(t => t.classList.toggle("active", t === tab));
    renderTracerList();
  });
});
document.getElementById("tracerList")?.addEventListener("click", async e => {
  const btn = e.target.closest("[data-tracer-action]");
  if (!btn) return;
  const id = btn.closest(".tracer-item")?.dataset.id;
  if (!id) return;
  const action = btn.dataset.tracerAction;
  try {
    if (action === "pause") await api.pauseDownload(id);
    else if (action === "resume") await api.resumeDownload(id);
    else if (action === "stop") await api.cancelDownload(id);
  } catch {}
  renderTracerList();
});

/* ── Delete confirmation (IDM-style) ────────────────────────────── */
let _skipDeleteConfirm = localStorage.getItem("speusis_skipDeleteConfirm") === "1";

async function performActualDelete(id, deleteFromDisk) {
  const task = taskStore.get(id);
  if (!task) return;
  if (api.removeDownload) {
    await api.removeDownload(id, !!deleteFromDisk);
  } else {
    await api.cancelDownload(id);
  }
  taskStore.delete(id); speedMap.delete(id); removeRow(id);
  setStatus((deleteFromDisk ? "Completely deleted: " : "Deleted: ") + displayName(task));
  updateStats(); scheduleCatTreeRender();
}

function showDeleteConfirm(id) {
  return new Promise((resolve) => {
    if (_skipDeleteConfirm) {
      performActualDelete(id, false).then(resolve);
      return;
    }
    openPanel(deleteConfirmDialog, id);
    const chkDisk   = document.getElementById("chkDeleteFromDisk");
    const chkSkip   = document.getElementById("chkDontShowDeleteAgain");
    const btnYes    = document.getElementById("btnDeleteConfirmYes");
    const btnNo     = document.getElementById("btnDeleteConfirmNo");
    if (chkDisk)  chkDisk.checked  = false;
    if (chkSkip)  chkSkip.checked  = false;

    const cleanup = () => {
      closePanel(deleteConfirmDialog);
      btnYes.onclick = null;
      btnNo.onclick  = null;
    };
    btnYes.onclick = async () => {
      const fromDisk = chkDisk?.checked ?? false;
      const skip     = chkSkip?.checked ?? false;
      if (skip) {
        _skipDeleteConfirm = true;
        localStorage.setItem("speusis_skipDeleteConfirm", "1");
      }
      cleanup();
      await performActualDelete(id, fromDisk);
      resolve();
    };
    btnNo.onclick = () => { cleanup(); resolve(); };
  });
}

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
function hexToRgba(hex, alpha) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
  const n = parseInt(full, 16);
  if (Number.isNaN(n) || full.length !== 6) return `rgba(232,232,232,${alpha})`;
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}
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
    taskStore.set(payload.id, { ...task, status: "failed" });
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
  const v = Math.max(1, Math.min(16, parseInt(e.target.value) || 1));
  e.target.value = v;
  await api.updateSettings({ defaultSegments: v });
  setStatus("Segments per download set to " + v + " (applies to new downloads)");
});
document.getElementById("btnViewSegmentMap")?.addEventListener("click", () => {
  if (selectedId) openSegmentMapDialog(selectedId);
  else setStatus("Select a download first to view its segment map");
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

/* ── Scheduler Panel ────────────────────────────────────────────── */
function buildHourOptions(selId, value) {
  const sel = document.getElementById(selId);
  if (!sel) return;
  sel.innerHTML = "";
  for (let h = 0; h < 24; h++) {
    const opt = document.createElement("option");
    opt.value = h;
    opt.textContent = String(h).padStart(2,"0") + ":00";
    if (h === value) opt.selected = true;
    sel.appendChild(opt);
  }
}
function buildMinOptions(selId, value) {
  const sel = document.getElementById(selId);
  if (!sel) return;
  sel.innerHTML = "";
  for (let m = 0; m < 60; m += 5) {
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = ":" + String(m).padStart(2,"0");
    if (m === value || (value !== undefined && Math.abs(m - value) < 5 && !sel.querySelector("[selected]"))) opt.selected = true;
    sel.appendChild(opt);
  }
}

async function openSchedulerPanel() {
  const s = await api.getSettings();
  document.getElementById("schedEnabled").checked = s.scheduleEnabled;
  buildHourOptions("schedStartH", s.scheduleStartHour);
  buildMinOptions("schedStartM",  s.scheduleStartMinute);
  buildHourOptions("schedStopH",  s.scheduleStopHour);
  buildMinOptions("schedStopM",   s.scheduleStopMinute);
  document.getElementById("peakEnabled").checked = s.peakHoursEnabled;
  buildHourOptions("peakStartH",  s.peakStartHour);
  buildHourOptions("peakStopH",   s.peakStopHour);
  document.getElementById("peakDlLimit").value = s.peakDownloadLimit ? Math.round(s.peakDownloadLimit/1024) : "";
  document.getElementById("peakUlLimit").value = s.peakUploadLimit  ? Math.round(s.peakUploadLimit/1024) : "";
  openPanel(schedulerPanel);
}

document.getElementById("btnCloseScheduler").addEventListener("click", () => closePanel(schedulerPanel));
document.getElementById("btnSaveScheduler").addEventListener("click", async () => {
  const patch = {
    scheduleEnabled:     document.getElementById("schedEnabled").checked,
    scheduleStartHour:   parseInt(document.getElementById("schedStartH").value) || 0,
    scheduleStartMinute: parseInt(document.getElementById("schedStartM").value) || 0,
    scheduleStopHour:    parseInt(document.getElementById("schedStopH").value) || 23,
    scheduleStopMinute:  parseInt(document.getElementById("schedStopM").value) || 0,
    peakHoursEnabled:    document.getElementById("peakEnabled").checked,
    peakStartHour:       parseInt(document.getElementById("peakStartH").value) || 9,
    peakStopHour:        parseInt(document.getElementById("peakStopH").value) || 18,
    peakDownloadLimit:   (parseInt(document.getElementById("peakDlLimit").value) || 0) * 1024,
    peakUploadLimit:     (parseInt(document.getElementById("peakUlLimit").value) || 0) * 1024,
  };
  await api.updateSettings(patch);
  closePanel(schedulerPanel);
  setStatus("Scheduler settings saved");
});

/* ── Site Logins Panel ──────────────────────────────────────────── */
async function openLoginsPanel() {
  await renderCredList();
  openPanel(loginsPanel);
}

async function renderCredList() {
  const s = await api.getSettings();
  const creds = s.credentials || [];
  const list = document.getElementById("credentialList");
  if (creds.length === 0) {
    list.innerHTML = `<div style="padding:12px 16px;color:var(--muted);font-size:12px;">No saved credentials yet.</div>`;
    return;
  }
  list.innerHTML = creds.map(c => `
    <div class="cred-row">
      <div class="cred-info">
        <div class="cred-domain">${escHtml(c.domain)}</div>
        <div class="cred-user">${escHtml(c.username)} / ••••••</div>
      </div>
      <button class="cred-remove" data-domain="${escHtml(c.domain)}">Remove</button>
    </div>`).join("");

  list.querySelectorAll(".cred-remove").forEach(btn => {
    btn.addEventListener("click", async () => {
      await api.removeCredential(btn.dataset.domain);
      await renderCredList();
      setStatus("Credential removed: " + btn.dataset.domain);
    });
  });
}

document.getElementById("btnCloseLogins").addEventListener("click", () => closePanel(loginsPanel));
document.getElementById("btnAddCred").addEventListener("click", async () => {
  const domain = document.getElementById("credDomain").value.trim();
  const user   = document.getElementById("credUser").value.trim();
  const pass   = document.getElementById("credPass").value;
  if (!domain || !user) { setStatus("Domain and username required"); return; }
  await api.addCredential({ domain, username: user, password: pass });
  document.getElementById("credDomain").value = "";
  document.getElementById("credUser").value   = "";
  document.getElementById("credPass").value   = "";
  await renderCredList();
  setStatus("Credential saved: " + domain);
});

/* ── RSS Panel ──────────────────────────────────────────────────── */
async function openRssPanel() {
  await renderRssFeeds();
  openPanel(rssPanel);
}

async function renderRssFeeds() {
  const feeds = await api.listRssFeeds();
  const list = document.getElementById("rssFeedList");
  if (!feeds || feeds.length === 0) {
    list.innerHTML = `<div style="padding:12px 16px;color:var(--muted);font-size:12px;">No RSS feeds configured yet.</div>`;
    return;
  }
  list.innerHTML = feeds.map(f => `
    <div class="rss-row">
      <span class="rss-enabled ${f.enabled ? "on" : "off"}" title="${f.enabled ? "Active" : "Disabled"}"></span>
      <div class="rss-info">
        <div class="rss-name">${escHtml(f.name)}</div>
        <div class="rss-url">${escHtml(f.url)}</div>
      </div>
      <div class="rss-actions">
        <button class="rss-btn rss-fetch" data-id="${f.id}" title="Fetch now">↻</button>
        <button class="rss-btn rss-toggle" data-id="${f.id}" data-enabled="${f.enabled}">${f.enabled ? "Disable" : "Enable"}</button>
        <button class="rss-btn rss-del" data-id="${f.id}">✕</button>
      </div>
    </div>`).join("");

  list.querySelectorAll(".rss-fetch").forEach(btn => {
    btn.addEventListener("click", async () => {
      btn.textContent = "…";
      try { await api.fetchRssNow(btn.dataset.id); setStatus("RSS feed fetched"); }
      catch { setStatus("RSS fetch failed"); }
      btn.textContent = "↻";
    });
  });
  list.querySelectorAll(".rss-toggle").forEach(btn => {
    btn.addEventListener("click", async () => {
      const enabled = btn.dataset.enabled === "true";
      await api.updateRssFeed(btn.dataset.id, { enabled: !enabled });
      await renderRssFeeds();
    });
  });
  list.querySelectorAll(".rss-del").forEach(btn => {
    btn.addEventListener("click", async () => {
      await api.removeRssFeed(btn.dataset.id);
      await renderRssFeeds(); setStatus("RSS feed removed");
    });
  });
}

document.getElementById("btnCloseRss").addEventListener("click", () => closePanel(rssPanel));
document.getElementById("btnAddRss").addEventListener("click", async () => {
  const name     = document.getElementById("rssFeedName").value.trim();
  const url      = document.getElementById("rssFeedUrl").value.trim();
  const filter   = document.getElementById("rssFeedFilter").value.trim() || undefined;
  const interval = parseInt(document.getElementById("rssFeedInterval").value) || 1800;
  const auto     = document.getElementById("rssFeedAuto").checked;
  if (!name || !url) { setStatus("Name and URL required"); return; }
  try {
    await api.addRssFeed({ name, url, enabled: true, autoDownload: auto, fetchInterval: interval, filter });
    document.getElementById("rssFeedName").value   = "";
    document.getElementById("rssFeedUrl").value    = "";
    document.getElementById("rssFeedFilter").value = "";
    await renderRssFeeds(); setStatus("RSS feed added: " + name);
  } catch (e) { setStatus("Failed to add feed: " + e.message); }
});

/* ── Batch Download Panel ───────────────────────────────────────── */
let batchLinks = [];

async function openBatchPanel() {
  batchLinks = [];
  document.getElementById("batchLinkList").innerHTML = `<div class="batch-empty">Click "Scan Active Tab" to detect downloadable links on the current browser page.</div>`;
  openPanel(batchPanel);
}

document.getElementById("btnCloseBatch").addEventListener("click", () => closePanel(batchPanel));
document.getElementById("btnScanLinks").addEventListener("click", async () => {
  setStatus("Scanning page for links…");
  try {
    // Send message to browser extension via the listener port
    const resp = await fetch("http://127.0.0.1:9999/health");
    if (!resp.ok) throw new Error("Speusis listener not running");
    // The extension scanner is triggered from the browser side.
    // Here we show instructions and handle manual URL input as fallback.
    renderBatchPlaceholder();
    setStatus("Extension will push links — or paste URLs below");
  } catch {
    renderBatchPlaceholder();
    setStatus("Enter URLs manually in the list");
  }
});

function renderBatchPlaceholder() {
  const list = document.getElementById("batchLinkList");
  list.innerHTML = `<div class="batch-empty">
    <div style="margin-bottom:8px;">Paste one URL per line below, or use the browser extension's "Scan Links" button.</div>
    <textarea id="batchManualUrls" style="width:100%;height:100px;background:var(--panel2);border:1px solid var(--border);border-radius:4px;color:var(--text);padding:8px;font:inherit;font-size:11px;resize:vertical;" placeholder="https://example.com/file1.zip
https://example.com/file2.mp4
..."></textarea>
    <button id="btnParseBatchUrls" class="btn-start" style="margin-top:8px;">Load URLs</button>
  </div>`;
  document.getElementById("btnParseBatchUrls")?.addEventListener("click", () => {
    const raw = document.getElementById("batchManualUrls")?.value || "";
    const urls = raw.split(/\n/).map(s => s.trim()).filter(s => s.startsWith("http"));
    batchLinks = urls.map(url => ({ url, name: url.split("/").pop()?.split("?")[0] || url }));
    renderBatchList(batchLinks);
  });
}

function renderBatchList(links) {
  const filterVal = (document.getElementById("batchFilter")?.value || "").toLowerCase();
  const filtered = filterVal ? links.filter(l => l.name.toLowerCase().includes(filterVal) || l.url.toLowerCase().includes(filterVal)) : links;
  const list = document.getElementById("batchLinkList");
  if (filtered.length === 0) {
    list.innerHTML = `<div class="batch-empty">No matching links found.</div>`;
    return;
  }
  list.innerHTML = filtered.map((l, i) => {
    const ext = l.url.split(".").pop()?.split("?")[0]?.slice(0,5).toUpperCase() || "—";
    const shortName = l.name.length > 60 ? l.name.slice(0, 57) + "…" : l.name;
    return `<div class="batch-item">
      <input type="checkbox" class="batch-cb" data-url="${escHtml(l.url)}" data-name="${escHtml(l.name)}" checked />
      <span class="batch-name" title="${escHtml(l.url)}">${escHtml(shortName)}</span>
      <span class="batch-ext">${ext}</span>
    </div>`;
  }).join("");
}

document.getElementById("batchFilter").addEventListener("input", () => renderBatchList(batchLinks));
document.getElementById("btnSelectAll").addEventListener("click", () => {
  document.querySelectorAll(".batch-cb").forEach(cb => { cb.checked = true; });
});
document.getElementById("btnSelectNone").addEventListener("click", () => {
  document.querySelectorAll(".batch-cb").forEach(cb => { cb.checked = false; });
});

document.getElementById("btnDownloadSelected").addEventListener("click", async () => {
  const checked = [...document.querySelectorAll(".batch-cb:checked")];
  if (checked.length === 0) { setStatus("No links selected"); return; }
  const urls = checked.map(cb => ({ url: cb.dataset.url, filename: cb.dataset.name }));
  closePanel(batchPanel);
  const results = await api.batchAddDownloads(urls);
  let added = 0;
  for (const r of (results || [])) {
    if (r.ok) { added++; }
  }
  setStatus(`Batch: ${added} of ${urls.length} downloads added`);
  await loadDownloads();
});

/* ── Toolbar: Grabber + Basket ──────────────────────────────────── */
document.getElementById("btnGrabber")?.addEventListener("click", () => openGrabberPanel());
document.getElementById("btnBasket")?.addEventListener("click", () => api.openBasket?.());

/* ── Web Grabber Panel ──────────────────────────────────────────── */
let grabberLinks = [];

function openGrabberPanel() {
  grabberLinks = [];
  const list = document.getElementById("grabberLinkList");
  if (list) list.innerHTML = `<div class="batch-empty">Enter a URL above and click "Scan Page" to find downloadable links.</div>`;
  const status = document.getElementById("grabberStatus");
  if (status) status.textContent = "";
  openPanel(grabberPanel);
  document.getElementById("grabberUrl")?.focus();
}

document.getElementById("btnCloseGrabber")?.addEventListener("click", () => closePanel(grabberPanel));

document.getElementById("btnGrabberScan")?.addEventListener("click", async () => {
  const url = document.getElementById("grabberUrl")?.value?.trim();
  if (!url) { setStatus("Enter a URL to scan"); return; }
  const statusEl = document.getElementById("grabberStatus");
  if (statusEl) statusEl.textContent = "Scanning…";
  setStatus("Web Grabber: scanning page…");
  try {
    const result = await api.grabberScan?.(url);
    if (!result || !result.ok) {
      if (statusEl) statusEl.textContent = result?.error || "Scan failed";
      return;
    }
    grabberLinks = result.links || [];
    renderGrabberList();
    if (statusEl) statusEl.textContent = `Found ${grabberLinks.length} downloadable link${grabberLinks.length !== 1 ? "s" : ""}.`;
    setStatus(`Grabber: ${grabberLinks.length} links found`);
  } catch (e) {
    if (statusEl) statusEl.textContent = "Error: " + e.message;
    setStatus("Grabber scan failed");
  }
});

document.getElementById("grabberFilter")?.addEventListener("input", renderGrabberList);

function renderGrabberList() {
  const filterVal = (document.getElementById("grabberFilter")?.value || "").toLowerCase();
  const filtered = filterVal
    ? grabberLinks.filter(l => l.name.toLowerCase().includes(filterVal) || l.ext.toLowerCase().includes(filterVal) || l.url.toLowerCase().includes(filterVal))
    : grabberLinks;
  const list = document.getElementById("grabberLinkList");
  if (!list) return;
  if (filtered.length === 0) {
    list.innerHTML = `<div class="batch-empty">${grabberLinks.length ? "No links match the filter." : "Enter a URL above and click 'Scan Page'."}</div>`;
    return;
  }
  list.innerHTML = filtered.map(l => {
    const shortName = l.name.length > 65 ? l.name.slice(0, 62) + "…" : l.name;
    const ext = (l.ext || "").toUpperCase().slice(0, 6);
    return `<div class="batch-item">
      <input type="checkbox" class="grabber-cb" data-url="${escHtml(l.url)}" data-name="${escHtml(l.name)}" checked />
      <span class="batch-name" title="${escHtml(l.url)}">${escHtml(shortName)}</span>
      <span class="batch-ext">${ext}</span>
    </div>`;
  }).join("");
}

document.getElementById("btnGrabberSelectAll")?.addEventListener("click", () => {
  document.querySelectorAll(".grabber-cb").forEach(cb => { cb.checked = true; });
});
document.getElementById("btnGrabberSelectNone")?.addEventListener("click", () => {
  document.querySelectorAll(".grabber-cb").forEach(cb => { cb.checked = false; });
});

document.getElementById("btnGrabberDownload")?.addEventListener("click", async () => {
  const checked = [...document.querySelectorAll(".grabber-cb:checked")];
  if (checked.length === 0) { setStatus("No links selected"); return; }
  const urls = checked.map(cb => ({ url: cb.dataset.url, filename: cb.dataset.name }));
  closePanel(grabberPanel);
  const results = await api.batchAddDownloads?.(urls);
  let added = 0;
  for (const r of (results || [])) { if (r.ok) added++; }
  setStatus(`Grabber: ${added} of ${urls.length} downloads added`);
  await loadDownloads();
});

/* ── Torrent Files Dialog ───────────────────────────────────────── */
let torrentFilesTaskId = null;

async function openTorrentFilesPanel(taskId) {
  torrentFilesTaskId = taskId;
  const list = document.getElementById("torrentFilesList");
  if (!list) return;
  list.innerHTML = `<div class="batch-empty">Loading…</div>`;
  openPanel(torrentFilesPanel, taskId);
  try {
    const files = await api.getTorrentFiles?.(taskId) || [];
    if (files.length === 0) {
      list.innerHTML = `<div class="batch-empty">No file list available yet (torrent may still be loading metadata).</div>`;
      return;
    }
    list.innerHTML = files.map(f => {
      const name = f.name || f.path || `File ${f.index}`;
      const size = f.length ? fmt(f.length) : "—";
      return `<div class="batch-item">
        <input type="checkbox" class="tf-cb" data-index="${f.index}" ${f.selected ? "checked" : ""} />
        <span class="batch-name" title="${escHtml(f.path || name)}">${escHtml(name)}</span>
        <span class="batch-ext">${size}</span>
      </div>`;
    }).join("");
    list.querySelectorAll(".tf-cb").forEach(cb => {
      cb.addEventListener("change", async () => {
        await api.selectTorrentFile?.(torrentFilesTaskId, parseInt(cb.dataset.index), cb.checked);
      });
    });
  } catch (e) {
    list.innerHTML = `<div class="batch-empty">Error: ${escHtml(e.message)}</div>`;
  }
}

document.getElementById("btnCloseTorrentFiles")?.addEventListener("click", () => closePanel(torrentFilesPanel));

/* ── Create Torrent Panel ───────────────────────────────────────── */
document.getElementById("btnCloseCreateTorrent").addEventListener("click", () => closePanel(createTorrentPanel));
document.getElementById("btnChooseSource").addEventListener("click", async () => {
  const path = await api.chooseFile({ directory: false });
  if (path) document.getElementById("torrentSourcePath").value = path;
});
document.getElementById("btnDoCreateTorrent").addEventListener("click", async () => {
  const src     = document.getElementById("torrentSourcePath").value.trim();
  const name    = document.getElementById("torrentName").value.trim() || undefined;
  const tracker = document.getElementById("torrentTracker").value.trim() || undefined;
  const statusEl = document.getElementById("torrentCreateStatus");
  statusEl.className = "torrent-status";
  statusEl.textContent = "";
  if (!src) { setStatus("Choose a source file or folder first"); return; }
  try {
    const result = await api.createTorrent(src, "", name, tracker);
    if (result?.ok) {
      statusEl.className = "torrent-status ok";
      statusEl.textContent = "Created: " + result.outputPath;
      setStatus(".torrent created successfully");
    } else {
      statusEl.className = "torrent-status err";
      statusEl.textContent = "Error: " + (result?.error || "Unknown error");
    }
  } catch (e) {
    statusEl.className = "torrent-status err";
    statusEl.textContent = "Error: " + e.message;
  }
});

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

async function init() {
  await refreshSettings();
  await buildCatTree();
  await loadDownloads();
  await initializeNativePanel();
  installNativePanelSizing();
  drawSpeedChart(0);
  initUpdateBanner();
  initClipboardMonitor();
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
      const result = await api.addDownload({ url, start: true, label: "Speusis v0.5.35 Setup" });
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

init().catch(() => {});
