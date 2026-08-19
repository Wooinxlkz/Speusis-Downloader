import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ActionMenu from "./ActionMenu";
import { buildMenuItems } from "../lib/menuItems";
import { displayName, fmt, fmtTime, isMediaFile, fileTypeColor } from "../lib/format";
import { ROW_ICONS } from "../lib/rowIcons";

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

  // Quick-access transfer-control buttons that sit directly on the row —
  // restored from the old buildActionButtons(). Delete/Redownload stay
  // dropdown-only, per that function's own v0.5.43 comment; everything
  // else (pause/stop/resume/preview) is meant to be one click away.
  const quickButtons = [];
  if (task.status === "running") {
    quickButtons.push({ action: "pause", icon: ROW_ICONS.pause, title: "Pause", cls: "rb-pause" });
    quickButtons.push({ action: "stop", icon: ROW_ICONS.stop, title: "Stop", cls: "rb-stop" });
    if (isMedia) quickButtons.push({ action: "preview", icon: ROW_ICONS.preview, title: "Preview", cls: "rb-preview" });
  } else if (task.status === "paused") {
    quickButtons.push({ action: "resume", icon: ROW_ICONS.play, title: "Resume", cls: "rb-play" });
    quickButtons.push({ action: "stop", icon: ROW_ICONS.stop, title: "Stop", cls: "rb-stop" });
    if (isMedia) quickButtons.push({ action: "preview", icon: ROW_ICONS.preview, title: "Preview", cls: "rb-preview" });
  } else if (task.status === "queued") {
    quickButtons.push({ action: "stop", icon: ROW_ICONS.stop, title: "Cancel", cls: "rb-stop" });
  } else if (task.status === "completed" && isMedia) {
    quickButtons.push({ action: "preview", icon: ROW_ICONS.preview, title: "Preview", cls: "rb-preview" });
  }

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
          {/* Colored file-type badge — restored from the old dist/renderer
              styles.css / utils.js fileTypeBadge(), dropped during the React
              rewrite in favor of a plain gray tag. */}
          <span
            className="shrink-0 rounded px-1 text-[9px] font-bold uppercase"
            style={{
              color: fileTypeColor(name),
              background: `${fileTypeColor(name)}29`,
              border: `1px solid ${fileTypeColor(name)}52`,
            }}
          >
            {name.split(".").pop()?.slice(0, 4) || "?"}
          </span>
          <span className="truncate" title={task.url}>{name}</span>
          {task.label && (
            <span className="lbl-badge" title={task.label}>{task.label}</span>
          )}
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
        {quickButtons.map((b) => (
          <motion.button
            key={b.action}
            type="button"
            title={b.title}
            aria-label={b.title}
            whileHover={{ background: "var(--tb-hover)" }}
            whileTap={{ scale: 0.92 }}
            transition={{ duration: 0.1 }}
            onClick={(e) => { e.stopPropagation(); runAction(b.action); }}
            className={`row-btn ${b.cls}`}
          >
            {b.icon}
          </motion.button>
        ))}
        <ActionMenu items={items} onAction={runAction} />
      </div>

      <AnimatePresence>
        {ctxPos && (
          <RowContextMenu
            x={ctxPos.x} y={ctxPos.y} items={items}
            onClose={() => setCtxPos(null)}
            onAction={(a) => { setCtxPos(null); runAction(a); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function RowContextMenu({ x, y, items, onClose, onAction }) {
  useEffect(() => {
    const close = () => onClose();
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [onClose]);
  const left = Math.min(x, window.innerWidth - 210);
  const top = Math.min(y, window.innerHeight - Math.min(items.length * 30, 400));
  return (
    <motion.div
      initial={{ opacity: 0, y: -4, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.97 }}
      transition={{ duration: 0.1, ease: "easeOut" }}
      style={{ position: "fixed", top, left }}
      className="ctx-menu"
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((item, i) =>
        item.sep ? (
          <div key={i} className="my-1 h-px bg-border" />
        ) : (
          <motion.button
            key={item.action}
            disabled={item.disabled}
            whileHover={item.disabled ? {} : { background: item.danger ? "rgba(248,113,113,.15)" : "var(--tb-hover)" }}
            transition={{ duration: 0.08 }}
            onClick={() => onAction(item.action)}
            className={`ctx-item ${item.disabled ? "ctx-grayed" : item.danger ? "ctx-danger" : ""}`}
          >
            {item.label}
          </motion.button>
        )
      )}
    </motion.div>
  );
}
