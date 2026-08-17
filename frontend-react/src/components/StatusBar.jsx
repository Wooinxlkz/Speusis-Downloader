import { fmt } from "../lib/format";

export default function StatusBar({ tasks, speeds, statusText, version }) {
  const list = [...tasks.values()];
  const total = list.length;
  const active = list.filter((t) => t.status === "running").length;
  const done = list.filter((t) => t.status === "completed").length;
  const totalSpeed = [...speeds.values()].reduce((a, b) => a + b, 0);

  return (
    <div className="flex items-center justify-between border-t border-border bg-sb-bg px-3 py-1 text-[11px] text-muted shrink-0">
      <div className="flex gap-4">
        <span>{statusText || "Ready"}</span>
      </div>
      <div className="flex gap-4">
        <span>Total {total}</span>
        <span>Active {active}</span>
        <span>Done {done}</span>
        <span>{fmt(totalSpeed)}/s</span>
        <span className="text-dim">Speusis v{version}</span>
      </div>
    </div>
  );
}
