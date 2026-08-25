import React, { useEffect, useRef, useState } from "react";

const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;
const currentWindow = window.__TAURI__.window.getCurrentWindow();

function fmt(bytes) {
  if (!bytes || bytes <= 0) return "0 B";
  const u = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(u.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 2)} ${u[i]}`;
}

// The renderer has no bundler and ships i18n as `data-i18n="<key>"`
// attributes resolved from /languages/<lang>.json at startup, with the
// chosen language persisted client-side (i18n.js: localStorage key
// "speusis_lang", not part of the Rust settings). All native panel
// windows share the same origin/localStorage in this app already (see
// the license-registration flag in app.js), so this reads the same key
// directly. Only mirrors the two strings the vanilla dialog markup
// actually marks with data-i18n ("update_now", "cancel") - the title/
// body copy was never wrapped in tt() there either, so this stays
// consistent with the app as it exists today rather than introducing
// new translations no other part of this dialog has.
let dict = null;
async function loadDict() {
  try {
    const lang = localStorage.getItem("speusis_lang") || "en";
    const res = await fetch(`../languages/${lang}.json`);
    dict = await res.json();
  } catch {
    dict = null;
  }
}
function tKey(key, fallback) {
  return dict?.[key] ?? fallback;
}

const RESIZE_DIRS = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];

export default function App() {
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const dragRef = useRef(null);

  useEffect(() => {
    (async () => {
      // Theme/accent - same source of truth as the main window
      // (settings_get), applied the same way (body dataset).
      try {
        const s = await invoke("settings_get");
        const sysDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
        const resolved = s.themeMode === "system" ? (sysDark ? "dark" : "light") : s.themeMode;
        document.body.dataset.theme = resolved || "dark";
        document.body.dataset.accent = s.accentColor || "blue";
      } catch {}

      await loadDict();

      try {
        const pending = await invoke("update_get_pending");
        setInfo(pending);
      } catch {}

      setReady(true);
    })();

    // Live theme changes while this window is open (matches the main
    // window's onSettingsUpdated -> applyAppearance behavior).
    let unlisten;
    listen("settings-updated", (event) => {
      const s = event.payload;
      if (!s) return;
      const sysDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
      const resolved = s.themeMode === "system" ? (sysDark ? "dark" : "light") : s.themeMode;
      document.body.dataset.theme = resolved || "dark";
      document.body.dataset.accent = s.accentColor || "blue";
    }).then((fn) => (unlisten = fn));
    return () => unlisten && unlisten();
  }, []);

  function close() {
    invoke("panel_close", { panel: "autoUpdateDialog" }).catch(() => {});
  }

  async function handleUpdateNow() {
    if (!info?.downloadUrl) { close(); return; }
    setBusy(true);
    try {
      const result = await invoke("download_add", {
        input: { url: info.downloadUrl, start: true, label: `Speusis v${info.version} Setup` },
      });
      if (!result?.id) {
        setTimeout(() => invoke("update_open_download", { url: info.downloadUrl }), 600);
      }
    } catch {
      setTimeout(() => invoke("update_open_download", { url: info.downloadUrl }), 600);
    }
    close();
  }

  function handleCancel() {
    close();
    invoke("panel_open", { panel: "updateWarnDialog" }).catch(() => {});
  }

  function onTitlePointerDown(e) {
    if (e.button !== 0) return;
    if (e.target.closest(".dialog-close")) return;
    currentWindow.startDragging?.().catch(() => {});
  }

  // Fallback so the whole window drags, not just the thin title strip -
  // this dialog is small and has no obvious "grab here" affordance
  // outside the header, so clicking the surrounding background (rather
  // than precisely the title row) should still move the window instead
  // of doing nothing. Guarded to the empty background area and the
  // notes text specifically, so it never intercepts clicks meant for
  // the buttons or the title bar's own close button.
  function onBackgroundPointerDown(e) {
    if (e.button !== 0) return;
    if (e.target.closest("button, .dialog-titlebar")) return;
    currentWindow.startDragging?.().catch(() => {});
  }

  if (!ready) return null;

  return (
    <div className="overlay-panel" style={{ alignItems: "center" }} onPointerDown={onBackgroundPointerDown}>
      <div className="panel-box auto-update-box">
        <div
          ref={dragRef}
          className="delete-confirm-title panel-drag-handle dialog-titlebar"
          onPointerDown={onTitlePointerDown}
        >
          <img src="../speusis-icon.png" className="dialog-title-icon" alt="" draggable={false} />
          <span className="dialog-title-text">New version of Speusis is available</span>
          <button
            type="button"
            className="dialog-close"
            aria-label="Close dialog"
            title="Close"
            onClick={close}
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M5 5l10 10M15 5L5 15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="auto-update-body">
          <div className="auto-update-version">
            {info
              ? `Version ${info.version} is available` + (info.downloadSize ? ` (${fmt(info.downloadSize)})` : "")
              : ""}
          </div>
          <div className="auto-update-notes">
            {info?.releaseNotes || "Download the installer for your platform from the assets below."}
          </div>
        </div>

        <div className="delete-confirm-btns">
          <button
            type="button"
            className="btn-start"
            style={{ minWidth: 100 }}
            disabled={busy}
            onClick={handleUpdateNow}
          >
            {busy ? "Adding…" : tKey("update_now", "Update now")}
          </button>
          <button type="button" className="btn-cancel" style={{ minWidth: 80 }} onClick={handleCancel}>
            {tKey("cancel", "Cancel")}
          </button>
        </div>
      </div>

      {RESIZE_DIRS.map((dir) => (
        <div
          key={dir}
          className={`native-resize-grip native-resize-${dir}`}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            currentWindow.startResizeDragging?.(dir).catch(() => {});
          }}
        />
      ))}
    </div>
  );
}
