import { useEffect, useState } from "react";
import { api } from "../lib/tauri";
import { displayName, fmt } from "../lib/format";

export default function PropertiesDialog({ taskId }) {
  const [task, setTask] = useState(null);

  useEffect(() => {
    api.listDownloads().then((list) => setTask(list.find((t) => t.id === taskId) || null)).catch(() => {});
  }, [taskId]);

  if (!task) return <p className="text-muted">Loading…</p>;

  const received = task.receivedBytes || 0;
  const size = Number(task.size || 0);
  const pct = size > 0 ? ((received / size) * 100).toFixed(1) + "%" : "—";

  // Field set matches the reference dialogs.js's openPropertiesDialog
  // exactly - Downloaded/Progress/Label/Created were missing from an
  // earlier pass of this component.
  const rows = [
    ["File name", displayName(task)],
    ["URL", task.url || "—"],
    ["Status", task.status || "—"],
    ["Size", size > 0 ? fmt(size) : "—"],
    ["Downloaded", received > 0 ? fmt(received) : "—"],
    ["Progress", pct],
    ["Label", task.label || "—"],
    ["Created", task.createdAt ? new Date(task.createdAt).toLocaleString() : "—"],
    ["Type", task.kind || "http"],
  ];

  return (
    <div className="flex flex-col">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between border-b border-border/50 py-1.5 gap-4">
          <span className="text-muted">{label}</span>
          <span className="text-right break-all max-w-[300px]">{value}</span>
        </div>
      ))}
      <div className="flex justify-end mt-3">
        <button className="rounded border border-border px-3 py-1.5 hover:bg-tb-hover" onClick={() => window.close()}>Close</button>
      </div>
    </div>
  );
}
