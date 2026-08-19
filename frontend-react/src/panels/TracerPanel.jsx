import { useEffect, useRef, useState } from "react";
import { ArrowDown, Check, Pause as PauseIcon, X, Clock, Play, Square } from "lucide-react";
import { api } from "../lib/tauri";
import { fmt, fmtTime, displayName } from "../lib/format";

const TABS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "done", label: "Done" },
];

function traceState(status) {
  if (["running", "active", "downloading"].includes(status)) return "active";
  if (["completed", "done"].includes(status)) return "done";
  if (status === "paused") return "paused";
  if (status === "failed") return "failed";
  if (status === "queued") return "waiting";
  return "cancelled";
}

// class names map 1:1 to .trace-waiting/.trace-active/.trace-done/etc in
// index.css (ported from the old app) so state colors match exactly:
// active/done are green, waiting/cancelled are slate, paused is yellow.
const STATE_CLASS = {
  active: "trace-active",
  done: "trace-done",
  paused: "trace-paused",
  failed: "trace-failed",
  waiting: "trace-waiting",
  cancelled: "trace-waiting",
};

const STATE_ICONS = {
  active: ArrowDown,
  done: Check,
  paused: PauseIcon,
  failed: X,
  waiting: Clock,
  cancelled: X,
};

export default function TracerPanel() {
  const [tasks, setTasks] = useState([]);
  const [speeds, setSpeeds] = useState(new Map());
  const [filter, setFilter] = useState("all");
  const pollRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      try { setTasks(await api.listDownloads()); } catch { setTasks([]); }
    };
    load();
    pollRef.current = setInterval(load, 1500);
    const unlisten = api.onEvent((event, payload) => {
      if (event === "DownloadProgress" && payload?.id) {
        setSpeeds((prev) => new Map(prev).set(payload.id, payload.speed || 0));
      }
    });
    return () => { clearInterval(pollRef.current); unlisten(); };
  }, []);

  const runningCount = tasks.filter((t) => ["running", "active", "downloading"].includes(t.status)).length;
  const doneCount = tasks.filter((t) => ["completed", "done"].includes(t.status)).length;
  const totalSpeed = [...speeds.values()].reduce((a, b) => a + b, 0);

  const filtered = tasks.filter((t) => {
    if (filter === "active") return !["completed", "done"].includes(t.status);
    if (filter === "done") return ["completed", "done"].includes(t.status);
    return true;
  });

  const act = async (action, id) => {
    try {
      if (action === "pause") await api.pauseDownload(id);
      else if (action === "resume") await api.resumeDownload(id);
      else if (action === "stop") await api.cancelDownload(id);
    } catch {}
  };

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="tracer-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`tracer-tab ${filter === t.key ? "active" : ""}`}
          >
            {t.label} <span>{t.key === "all" ? tasks.length : t.key === "active" ? runningCount : doneCount}</span>
          </button>
        ))}
        <div className="tracer-tab-spacer" />
        <span className="tracer-summary">{fmt(totalSpeed)}/s</span>
      </div>

      <div className="tracer-list flex-1">
        {filtered.length === 0 && <div className="trace-empty">No downloads to show.</div>}
        {filtered.map((t) => {
          const size = Number(t.size || 0);
          const received = Number(t.receivedBytes || 0);
          const pct = size > 0 ? Math.min(100, Math.round((received / size) * 100)) : 0;
          const state = traceState(t.status);
          const isActive = state === "active";
          const isPaused = t.status === "paused";
          const speed = speeds.get(t.id) || 0;
          const remaining = size > 0 ? size - received : 0;
          const eta = speed > 0 && remaining > 0 ? fmtTime(remaining / speed) : "—";
          const Icon = STATE_ICONS[state];
          const segments = t.segmentCount ?? "—";

          return (
            <div key={t.id} className="tracer-item">
              <div className="tracer-item-top">
                <span className={`trace-state-icon ${STATE_CLASS[state]}`}>
                  <Icon size={16} />
                </span>
                <span className="tracer-item-name">{displayName(t)}</span>
                <span className="tracer-item-rate">{speed > 0 ? fmt(speed) + "/s" : "—"}</span>
              </div>
              <div className="tracer-item-meta">
                {received > 0 ? fmt(received) : "0 B"} · {size > 0 ? fmt(size) : "size unknown"} · {state}
              </div>
              <div className="tracer-item-meta">
                {isActive ? `ETA ${eta}` : t.status === "failed" ? "download failed" : state} · {segments} segs
              </div>
              <div className="tracer-progress">
                <div className={`tracer-progress-fill ${STATE_CLASS[state]}`} style={{ width: `${pct}%` }} />
              </div>
              <div className="tracer-item-footer">
                <span>
                  {t.outputPath ? "saved to " + t.outputPath : "source: " + (t.url || "").slice(0, 48)}
                </span>
                {(isActive || isPaused) && (
                  <span className="tracer-item-actions">
                    {isActive && <button onClick={() => act("pause", t.id)} className="trace-action" title="Pause"><PauseIcon size={11} /></button>}
                    {isPaused && <button onClick={() => act("resume", t.id)} className="trace-action" title="Resume"><Play size={11} /></button>}
                    <button onClick={() => act("stop", t.id)} className="trace-action" title="Stop"><Square size={11} /></button>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-end pt-1 border-t border-border">
        <button className="rounded border border-border px-3 py-1.5 hover:bg-tb-hover" onClick={() => window.close()}>Close</button>
      </div>
    </div>
  );
}
