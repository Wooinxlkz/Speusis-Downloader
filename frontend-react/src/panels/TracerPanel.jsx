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

const STATE_STYLES = {
  active: "text-blue-400 bg-blue-400/10",
  done: "text-green-400 bg-green-400/10",
  paused: "text-orange-400 bg-orange-400/10",
  failed: "text-red-400 bg-red-400/10",
  waiting: "text-yellow-400 bg-yellow-400/10",
  cancelled: "text-dim bg-dim/10",
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
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={`rounded px-3 py-1 text-[11px] ${filter === t.key ? "bg-accent text-bg font-semibold" : "text-muted hover:bg-tb-hover"}`}
            >
              {t.label} ({t.key === "all" ? tasks.length : t.key === "active" ? runningCount : doneCount})
            </button>
          ))}
        </div>
        <span className="text-dim text-[11px]">{fmt(totalSpeed)}/s</span>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col gap-2">
        {filtered.length === 0 && <div className="text-muted text-[11px] p-4 text-center">No downloads to show.</div>}
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
            <div key={t.id} className="rounded border border-border bg-panel2 p-2 flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className={`flex h-5 w-5 items-center justify-center rounded ${STATE_STYLES[state]}`}>
                  <Icon size={12} />
                </span>
                <span className="flex-1 truncate text-[12px]">{displayName(t)}</span>
                <span className="text-dim text-[11px]">{speed > 0 ? fmt(speed) + "/s" : "—"}</span>
              </div>
              <div className="text-dim text-[10px] pl-7">
                {received > 0 ? fmt(received) : "0 B"} · {size > 0 ? fmt(size) : "size unknown"} · {state}
              </div>
              <div className="text-dim text-[10px] pl-7">
                {isActive ? `ETA ${eta}` : t.status === "failed" ? "download failed" : state} · {segments} segs
              </div>
              <div className="h-1 rounded bg-panel overflow-hidden">
                <div className={`h-full ${STATE_STYLES[state].split(" ")[0].replace("text-", "bg-")}`} style={{ width: `${pct}%` }} />
              </div>
              <div className="flex items-center justify-between pl-7">
                <span className="truncate text-dim text-[10px] max-w-[70%]">
                  {t.outputPath ? "saved to " + t.outputPath : "source: " + (t.url || "").slice(0, 48)}
                </span>
                {(isActive || isPaused) && (
                  <span className="flex gap-1">
                    {isActive && <button onClick={() => act("pause", t.id)} className="rounded p-1 hover:bg-tb-hover" title="Pause"><PauseIcon size={12} /></button>}
                    {isPaused && <button onClick={() => act("resume", t.id)} className="rounded p-1 hover:bg-tb-hover" title="Resume"><Play size={12} /></button>}
                    <button onClick={() => act("stop", t.id)} className="rounded p-1 hover:bg-tb-hover" title="Stop"><Square size={12} /></button>
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
