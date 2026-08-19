import { motion } from "framer-motion";
import { startDrag, startResize, api } from "../lib/tauri";
import { useSettings } from "../hooks/useSettings";

const RESIZE_DIRS = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];

export default function PanelChrome({ title, panelName, onClose, children }) {
  // Every dialog window (Options, About, RSS, Properties, etc.) mounts
  // through this one component - previously only the main window, Options,
  // and Scheduler called useSettings(), so every other dialog never
  // received data-theme/data-accent on its own <body> and stayed stuck on
  // whatever the bare CSS defaults were, ignoring the user's light/dark and
  // accent-color choice entirely. Calling it here fixes every dialog at once.
  useSettings();

  const close = () => {
    onClose?.();
    api.closePanel(panelName).catch(() => {});
  };

  return (
    <div className="overlay-panel" style={{ position: "static", inset: "auto", background: "var(--bg)", padding: 12, overflow: "hidden", alignItems: "flex-start", backdropFilter: "none", animation: "none", height: "100vh", display: "flex", justifyContent: "center" }}>
      <div
        className="panel-box"
        style={{ width: "100%", maxWidth: "none", maxHeight: "none" }}
      >
        <div
          className="panel-title dialog-titlebar panel-drag-handle"
          onPointerDown={(e) => { if (e.button === 0 && e.target === e.currentTarget) startDrag(); }}
        >
          <img className="dialog-title-icon" src="/speusis-icon.png" alt="" draggable={false} />
          <span className="dialog-title-text">{title}</span>
          <motion.button
            type="button"
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.9 }}
            onClick={close}
            className="dialog-close"
            aria-label="Close dialog"
            title="Close"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M5 5l10 10M15 5L5 15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </motion.button>
        </div>

        <div className="flex-1 overflow-auto p-4">{children}</div>
      </div>

      {RESIZE_DIRS.map((dir) => (
        <div
          key={dir}
          className={`native-resize-grip native-resize-${dir}`}
          onPointerDown={(e) => { if (e.button === 0) { e.preventDefault(); startResize(dir); } }}
        />
      ))}
    </div>
  );
}
