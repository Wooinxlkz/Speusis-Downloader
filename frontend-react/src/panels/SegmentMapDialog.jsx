import { useEffect, useRef, useState } from "react";
import { api } from "../lib/tauri";
import { fmt, displayName } from "../lib/format";

const SEGMENT_COUNTS = [1, 2, 4, 8, 16, 32];

export default function SegmentMapDialog({ taskId }) {
  const [map, setMap] = useState(null);
  const [name, setName] = useState("");
  const [speed, setSpeed] = useState(0);
  const pollRef = useRef(null);

  useEffect(() => {
    api.listDownloads().then((list) => {
      const task = list.find((t) => t.id === taskId);
      if (task) setName(displayName(task));
    }).catch(() => {});

    const load = async () => {
      try { setMap(await api.getSegmentMap(taskId)); } catch { setMap(null); }
    };
    load();
    pollRef.current = setInterval(load, 1500);
    return () => clearInterval(pollRef.current);
  }, [taskId]);

  const selectSegments = async (count) => {
    try { await api.updateSettings({ defaultSegments: count }); } catch {}
  };

  if (!map || !map.totalSegments) {
    return (
      <div className="flex flex-col gap-3">
        <div className="font-semibold">{name}</div>
        <p className="text-muted text-[11px]">No live segment map for this download right now.</p>
        <SegmentCountPicker current={null} onSelect={selectSegments} />
        <div className="flex justify-end pt-2 border-t border-border">
          <button className="rounded border border-border px-3 py-1.5 hover:bg-tb-hover" onClick={() => window.close()}>Close</button>
        </div>
      </div>
    );
  }

  const doneCount = map.segments.filter((s) => s.done).length;
  const remaining = Math.max(0, map.totalBytes - map.downloadedBytes);
  const activeCount = map.segments.filter((s) => !s.done && s.received > 0).length;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="font-semibold">{name}</div>
        <div className="text-muted text-[11px]">
          {map.totalSegments} segments · {speed > 0 ? `${fmt(speed)}/s` : "—"} · {activeCount} active
        </div>
      </div>

      <div className="grid grid-cols-10 gap-1">
        {map.segments.map((seg) => {
          const len = seg.end - seg.start + 1;
          const partial = !seg.done && seg.received > 0;
          const pct = len > 0 ? Math.round((seg.received / len) * 100) : 0;
          return (
            <div
              key={seg.index}
              title={`Segment ${seg.index + 1}: ${pct}%`}
              className={`flex h-7 items-center justify-center rounded-sm text-[9px] font-semibold border border-border ${
                seg.done ? "bg-accent text-bg" : partial ? "bg-accent/30 text-accent" : "bg-panel2 text-dim"
              }`}
            >
              {seg.done ? "✓" : partial ? pct : ""}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          ["Downloaded", fmt(map.downloadedBytes)],
          ["Remaining", fmt(remaining)],
          ["Segments", `${doneCount} / ${map.totalSegments}`],
          ["Total size", fmt(map.totalBytes)],
        ].map(([label, value]) => (
          <div key={label} className="rounded border border-border bg-panel2 py-2">
            <div className="text-dim text-[10px] uppercase">{label}</div>
            <div className="text-[12px] font-semibold">{value}</div>
          </div>
        ))}
      </div>

      <SegmentCountPicker current={map.totalSegments} onSelect={selectSegments} />

      <div className="flex justify-end pt-2 border-t border-border">
        <button className="rounded border border-border px-3 py-1.5 hover:bg-tb-hover" onClick={() => window.close()}>Close</button>
      </div>
    </div>
  );
}

function SegmentCountPicker({ current, onSelect }) {
  return (
    <div>
      <div className="text-dim text-[10px] uppercase mb-1">Segments per file for new downloads</div>
      <div className="flex gap-1">
        {SEGMENT_COUNTS.map((count) => (
          <button
            key={count}
            onClick={() => onSelect(count)}
            className={`flex-1 rounded border py-1 text-[11px] ${
              current === count ? "border-accent bg-accent text-bg font-semibold" : "border-border hover:bg-tb-hover"
            }`}
          >
            {count}
          </button>
        ))}
      </div>
    </div>
  );
}
