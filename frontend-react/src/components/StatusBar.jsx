import { fmt } from "../lib/format";

export default function StatusBar({ tasks, speeds, statusText, version }) {
  const list = [...tasks.values()];
  const total = list.length;
  const active = list.filter((t) => t.status === "running").length;
  const done = list.filter((t) => t.status === "completed").length;
  const totalSpeed = [...speeds.values()].reduce((a, b) => a + b, 0);

  return (
    <div className="statusbar justify-between">
      <div className="flex items-center gap-2.5">
        <span>{statusText || "Ready"}</span>
      </div>
      <div className="flex items-center gap-2.5">
        <span>Total {total}</span>
        <span className="sb-sep" />
        <span>Active {active}</span>
        <span className="sb-sep" />
        <span>Done {done}</span>
        <span className="sb-sep" />
        <span>{fmt(totalSpeed)}/s</span>
        <span className="sb-sep" />
        <span className="text-dim">Speusis v{version}</span>
      </div>
    </div>
  );
}
