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
        <div className="seg-map-file-row">
          <span>{name}</span>
        </div>
        <p className="text-muted text-[11px] px-3.5">No live segment map for this download right now.</p>
        <SegmentCountPicker current={null} onSelect={selectSegments} />
        <div className="flex justify-end pt-2 border-t border-border px-3.5 pb-3">
          <button className="rounded border border-border px-3 py-1.5 hover:bg-tb-hover" onClick={() => window.close()}>Close</button>
        </div>
      </div>
    );
  }

  const doneCount = map.segments.filter((s) => s.done).length;
  const remaining = Math.max(0, map.totalBytes - map.downloadedBytes);
  const activeCount = map.segments.filter((s) => !s.done && s.received > 0).length;

  return (
    <div className="flex flex-col">
      <div className="seg-map-file-row">
        <span>{name}</span>
        <span className="seg-map-title-speed">{speed > 0 ? `${fmt(speed)}/s` : "—"} · {activeCount} active</span>
      </div>

      <div className="seg-map-grid">
        {map.segments.map((seg) => {
          const len = seg.end - seg.start + 1;
          const partial = !seg.done && seg.received > 0;
          const pct = len > 0 ? Math.round((seg.received / len) * 100) : 0;
          return (
            <div
              key={seg.index}
              title={`Segment ${seg.index + 1}: ${pct}%`}
              className={`seg-tile ${seg.done ? "seg-done" : partial ? "seg-partial" : ""}`}
            >
              {seg.done ? "✓" : partial ? pct : ""}
            </div>
          );
        })}
      </div>

      <div className="seg-map-stats">
        {[
          ["Downloaded", fmt(map.downloadedBytes)],
          ["Remaining", fmt(remaining)],
          ["Segments", `${doneCount} / ${map.totalSegments}`],
          ["Total size", fmt(map.totalBytes)],
        ].map(([label, value]) => (
          <div key={label} className="sms-item">
            <div className="sms-label">{label}</div>
            <div className="sms-value">{value}</div>
          </div>
        ))}
      </div>

      <SegmentCountPicker current={map.totalSegments} onSelect={selectSegments} />

      <div className="flex justify-end pt-2 border-t border-border px-3.5 pb-3 mt-2">
        <button className="rounded border border-border px-3 py-1.5 hover:bg-tb-hover" onClick={() => window.close()}>Close</button>
      </div>
    </div>
  );
}

function SegmentCountPicker({ current, onSelect }) {
  return (
    <div className="seg-map-footer">
      <span>
        <strong>Segments per file</strong>
        <small>Applies to new downloads</small>
      </span>
      <span className="seg-map-controls">
        {SEGMENT_COUNTS.map((count) => (
          <button
            key={count}
            onClick={() => onSelect(count)}
            className={current === count ? "active" : ""}
          >
            {count}
          </button>
        ))}
      </span>
    </div>
  );
}
