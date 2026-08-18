import { useEffect, useMemo, useState } from "react";
import { fmt } from "../lib/format";

const MAX_POINTS = 48;

export default function SpeedGraph({ speeds }) {
  const totalSpeed = useMemo(
    () => [...speeds.values()].reduce((sum, speed) => sum + Number(speed || 0), 0),
    [speeds]
  );
  const [points, setPoints] = useState([]);

  useEffect(() => {
    setPoints((current) => [...current, totalSpeed].slice(-MAX_POINTS));
  }, [totalSpeed]);

  const peak = Math.max(1, ...points);
  const polyline = points.length
    ? points.map((value, index) => {
        const x = points.length === 1 ? 0 : (index / (points.length - 1)) * 600;
        const y = 36 - (value / peak) * 30;
        return `${x},${y}`;
      }).join(" ")
    : "0,36 600,36";

  return (
    <div className="speed-graph-bar" role="img" aria-label={`Current download speed ${fmt(totalSpeed)} per second`}>
      <svg id="speedChart" viewBox="0 0 600 40" preserveAspectRatio="none" aria-hidden="true">
        <polyline points={polyline} fill="none" stroke="var(--accent)" strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
      </svg>
      <span className="sg-label">{fmt(totalSpeed)}/s</span>
    </div>
  );
}