import { useState } from "react";
import ActionMenu from "./ActionMenu";
import { buildMenuItems } from "../lib/menuItems";
import { displayName, fmt, fmtTime, isMediaFile } from "../lib/format";
import { api } from "../lib/tauri";

const STATUS_STYLES = {
  running: "text-blue-400 bg-blue-400/10",
  queued: "text-yellow-400 bg-yellow-400/10",
  paused: "text-orange-400 bg-orange-400/10",
  completed: "text-green-400 bg-green-400/10",
  failed: "text-red-400 bg-red-400/10",
  cancelled: "text-dim bg-dim/10",
};
const SCAN_STYLES = {
  pending: ["Scanning", "text-blue-400 bg-blue-400/10"],
  clean: ["Clean", "text-green-400 bg-green-400/10"],
  "threats-found": ["Threat", "text-red-400 bg-red-400/10"],
  failed: ["Scan failed", "text-red-400 bg-red-400/10"],
  skipped: ["Not scanned", "text-dim bg-dim/10"],
};

export default function DownloadRow({ task, speed, selected, onSelect, onAction }) {
  const [ctxPos, setCtxPos] = useState(null);
  const name = displayName(task);
  const isMedia = isMediaFile(name);
  const received = task.receivedBytes || 0;
  const size = Number(task.size || 0);
  const pct = size > 0 ? Math.min(100, (received / size) * 100) : 0;
  const remaining = size > 0 ? size - received : 0;
  const eta = speed > 0 && remaining > 0 ? remaining / speed : 0;
  const scan = task.securityScan;

  const items = buildMenuItems({ status: task.status, kind: task.kind, isMedia });

  const runAction = (action) => onAction(action, task.id);

  const onContextMenu = (e) => {
    e.preventDefault();
    onSelect(task.id);
    setCtxPos({ x: e.clientX, y: e.clientY });
  };

  return (
    <div
      onClick={() => onSelect(task.id)}
      onContextMenu={onContextMenu}
      onDoubleClick={() => runAction(task.status === "completed" ? "open" : "properties")}
      className={`grid items-center gap-2 border-b border-border/60 px-2 py-1.5 text-[12px] cursor-default ${
        selected ? "bg-row-sel" : "hover:bg-row-hover"
      }`}
      style={{ gridTemplateColumns: "var(--tbl-cols)" }}
    >
      <div className="flex flex-col min-w-0 gap-0.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="shrink-0 rounded bg-panel2 px-1 text-[9px] uppercase text-dim">
            {name.split(".").pop()?.slice(0, 4) || "?"}
          </span>
          <span className="truncate" title={task.url}>{name}</span>
        </div>
        {task.status === "running" && (
          <div className="h-1 w-full overflow-hidden rounded bg-panel2">
            <div className="h-full bg-accent transition-[width]" style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>

      <div className="text-dim text-center">{task.kind === "torrent" ? "T" : ""}</div>
      <div className="text-muted">{size ? fmt(size) : "—"}</div>

      <div className="flex flex-wrap gap-1">
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[task.status] || ""}`}>
          {task.status === "running" ? `${pct.toFixed(1)}%` : task.status}
        </span>
        {scan?.status && SCAN_STYLES[scan.status] && (
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${SCAN_STYLES[scan.status][1]}`}>
            {SCAN_STYLES[scan.status][0]}
          </span>
        )}
      </div>

      <div className="text-muted">{task.status === "running" ? fmtTime(eta) : "—"}</div>
      <div className="text-muted">{task.status === "running" ? fmt(speed) + "/s" : "—"}</div>

      <div className="flex justify-end">
        <ActionMenu items={items} onAction={runAction} />
      </div>

      {ctxPos && (
        <RowContextMenu
          x={ctxPos.x} y={ctxPos.y} items={items}
          onClose={() => setCtxPos(null)}
          onAction={(a) => { setCtxPos(null); runAction(a); }}
        />
      )}
    </div>
  );
}

function RowContextMenu({ x, y, items, onClose, onAction }) {
  useState(() => {
    const close = () => onClose();
    document.addEventListener("click", close, { once: true });
    return () => document.removeEventListener("click", close);
  });
  const left = Math.min(x, window.innerWidth - 210);
  const top = Math.min(y, window.innerHeight - Math.min(items.length * 30, 400));
  return (
    <div
      style={{ position: "fixed", top, left }}
      className="z-[730] min-w-[190px] rounded border border-border bg-menu-bg py-1 shadow-lg"
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((item, i) =>
        item.sep ? (
          <div key={i} className="my-1 h-px bg-border" />
        ) : (
          <button
            key={item.action}
            disabled={item.disabled}
            onClick={() => onAction(item.action)}
            className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] ${
              item.disabled ? "text-dim cursor-not-allowed" : "text-text hover:bg-tb-hover"
            }`}
          >
            {item.label}
          </button>
        )
      )}
    </div>
  );
}
