import { motion } from "framer-motion";
import { startDrag, startResize, api } from "../lib/tauri";

const RESIZE_DIRS = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];

export default function PanelChrome({ title, panelName, onClose, children }) {
  const close = () => {
    onClose?.();
    api.closePanel(panelName).catch(() => {});
  };

  return (
    <motion.div
      className="flex h-screen w-screen flex-col bg-bg text-text overflow-hidden"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      <div
        className="panel-drag-handle dialog-titlebar flex items-center gap-2 border-b border-border bg-panel2 px-3.5 py-2.5 shrink-0"
        onPointerDown={(e) => { if (e.button === 0 && e.target === e.currentTarget) startDrag(); }}
      >
        <span className="dialog-title-icon inline-block h-4 w-4 rounded-full bg-panel2 pointer-events-none" />
        <div className="dialog-title-text text-[11px] font-bold uppercase tracking-[.12em] pointer-events-none">
          {title}
        </div>
        <motion.button
          type="button"
          whileHover={{ background: "var(--tb-hover)" }}
          whileTap={{ scale: 0.9 }}
          onClick={close}
          className="dialog-close"
          aria-label="Close"
        >
          ✕
        </motion.button>
      </div>

      <div className="flex-1 overflow-auto p-4">{children}</div>

      {RESIZE_DIRS.map((dir) => (
        <div
          key={dir}
          className={`native-resize-grip native-resize-${dir}`}
          onPointerDown={(e) => { if (e.button === 0) { e.preventDefault(); startResize(dir); } }}
        />
      ))}
    </motion.div>
  );
}
