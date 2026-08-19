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
  const coords = points.length
    ? points.map((value, index) => {
        const x = points.length === 1 ? 0 : (index / (points.length - 1)) * 600;
        const y = 36 - (value / peak) * 30;
        return [x, y];
      })
    : [[0, 36], [600, 36]];
  const polyline = coords.map(([x, y]) => `${x},${y}`).join(" ");
  // Closed area path under the line, matching the translucent fill the old
  // canvas-based drawSpeedChart() painted via ctx.fill() + hexToRgba(...,0.12).
  const areaPoints = `${polyline} 600,40 0,40`;

  return (
    <div className="speed-graph-bar" role="img" aria-label={`Current download speed ${fmt(totalSpeed)} per second`}>
      <svg id="speedChart" viewBox="0 0 600 40" preserveAspectRatio="none" aria-hidden="true">
        {/* 50% grid line — present in the old canvas render, dropped in the SVG port */}
        <line x1="0" y1="20" x2="600" y2="20" stroke="rgba(255,255,255,0.04)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <polygon points={areaPoints} fill="var(--accent)" fillOpacity="0.12" stroke="none" />
        <polyline points={polyline} fill="none" stroke="var(--accent)" strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
      </svg>
      <span className="sg-label">{fmt(totalSpeed)}/s</span>
    </div>
  );
}