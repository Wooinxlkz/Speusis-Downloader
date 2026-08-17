import { startDrag, startResize, api } from "../lib/tauri";

const RESIZE_DIRS = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];

export default function PanelChrome({ title, panelName, onClose, children }) {
  const close = () => {
    onClose?.();
    api.closePanel(panelName).catch(() => {});
  };

  return (
    <div className="flex h-screen w-screen flex-col bg-bg text-text overflow-hidden">
      <div
        className="panel-drag-handle flex items-center justify-between border-b border-border bg-toolbar px-3 py-2 shrink-0"
        onPointerDown={(e) => { if (e.button === 0 && e.target === e.currentTarget) startDrag(); }}
      >
        <div className="flex items-center gap-2 text-[13px] font-semibold pointer-events-none">
          <span className="inline-block h-4 w-4 rounded-full bg-panel2" />
          {title}
        </div>
        <button
          type="button"
          onClick={close}
          className="rounded px-2 py-0.5 text-muted hover:bg-tb-hover hover:text-text"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4">{children}</div>

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
