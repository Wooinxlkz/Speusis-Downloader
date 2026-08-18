import { useState } from "react";
import ActionMenu from "./ActionMenu";
import { buildMenuItems } from "../lib/menuItems";
import { displayName, fmt, fmtTime, isMediaFile } from "../lib/format";
import { api } from "../lib/tauri";

// Exact colors from the old .st-* classes in dist/renderer/styles.css —
// note running/completed are green (not blue), paused is yellow (not
// orange), and queued/cancelled are slate (not yellow).
const STATUS_STYLES = {
  running: { color: "#6ee7b7", background: "rgba(110,231,183,.14)" },
  paused: { color: "#fcd34d", background: "rgba(252,211,77,.13)" },
  queued: { color: "#94a3b8", background: "rgba(148,163,184,.11)" },
  completed: { color: "#86efac", background: "rgba(134,239,172,.12)" },
  failed: { color: "#f87171", background: "rgba(248,113,113,.12)" },
  cancelled: { color: "#94a3b8", background: "rgba(148,163,184,.11)" },
};
const SCAN_STYLES = {
  pending: ["Scanning", { color: "#6ee7b7", background: "rgba(110,231,183,.14)" }],
  clean: ["Clean", { color: "#86efac", background: "rgba(134,239,172,.12)" }],
  "threats-found": ["Threat", { color: "#f87171", background: "rgba(248,113,113,.12)" }],
  failed: ["Scan failed", { color: "#f87171", background: "rgba(248,113,113,.12)" }],
  skipped: ["Not scanned", { color: "#94a3b8", background: "rgba(148,163,184,.11)" }],
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
      className={`dl-row grid items-center gap-2 text-[12px] cursor-default ${selected ? "selected" : ""}`}
      style={{ gridTemplateColumns: "var(--tbl-cols)" }}
    >
      <div className="dl-cell flex flex-col min-w-0 gap-0.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="shrink-0 rounded bg-panel2 px-1 text-[9px] uppercase text-dim">
            {name.split(".").pop()?.slice(0, 4) || "?"}
          </span>
          <span className="truncate" title={task.url}>{name}</span>
        </div>
        {task.status === "running" && (
          <div className="dl-prog-bar">
            <div className="dl-prog-fill" style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>

      <div className="dl-cell dl-q">{task.kind === "torrent" ? "T" : ""}</div>
      <div className="dl-cell dl-muted">{size ? fmt(size) : "—"}</div>

      <div className="flex flex-wrap gap-1">
        <span className="st-badge" style={STATUS_STYLES[task.status]}>
          {task.status === "running" ? `${pct.toFixed(1)}%` : task.status}
        </span>
        {scan?.status && SCAN_STYLES[scan.status] && (
          <span className="st-badge" style={SCAN_STYLES[scan.status][1]}>
            {SCAN_STYLES[scan.status][0]}
          </span>
        )}
      </div>

      <div className="dl-cell dl-muted">{task.status === "running" ? fmtTime(eta) : "—"}</div>
      <div className="dl-cell dl-rate-value active">{task.status === "running" ? fmt(speed) + "/s" : "—"}</div>

      <div className="dl-cell dl-actions flex justify-end">
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
