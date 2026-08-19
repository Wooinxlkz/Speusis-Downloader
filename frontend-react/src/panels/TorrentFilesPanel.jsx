import { useEffect, useState } from "react";
import { api } from "../lib/tauri";
import { fmt } from "../lib/format";

export default function TorrentFilesPanel({ taskId }) {
  const [files, setFiles] = useState([]);

  useEffect(() => {
    api.getTorrentFiles(taskId).then(setFiles).catch(() => setFiles([]));
  }, [taskId]);

  const toggle = async (index, current) => {
    setFiles((prev) => prev.map((f) => (f.index === index ? { ...f, selected: !current } : f)));
    try { await api.selectTorrentFile(taskId, index, !current); } catch {}
  };

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex-1 overflow-auto border border-border rounded">
        {files.length === 0 && <div className="text-muted text-[11px] p-3">No files.</div>}
        {files.map((f) => (
          <label key={f.index} className="flex items-center justify-between gap-2 px-2 py-1.5 border-b border-border/50 hover:bg-tb-hover cursor-pointer">
            <span className="flex items-center gap-2 min-w-0">
              <input type="checkbox" checked={f.selected} onChange={() => toggle(f.index, f.selected)} />
              <span className="truncate text-[11px]">{f.path}</span>
            </span>
            <span className="text-dim text-[11px] shrink-0">{fmt(f.length)}</span>
          </label>
        ))}
      </div>
      <div className="flex justify-end pt-2 border-t border-border">
        <button className="rounded border border-border px-3 py-1.5 hover:bg-tb-hover" onClick={() => window.close()}>Close</button>
      </div>
    </div>
  );
}
