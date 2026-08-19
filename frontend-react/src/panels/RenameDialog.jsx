import { useEffect, useRef, useState } from "react";
import { api } from "../lib/tauri";
import { displayName } from "../lib/format";

export default function RenameDialog({ taskId }) {
  const [name, setName] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    api.listDownloads().then((list) => {
      const task = list.find((t) => t.id === taskId);
      if (task) setName(displayName(task));
    }).catch(() => {});
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [taskId]);

  const doRename = async () => {
    const newName = name.trim();
    if (newName) {
      // Rename is local-display-only in this app (matches the old
      // app.js's actual behavior - it never called a rename command
      // either), reported back to the main window via panel-result.
      await api.reportPanelResult("renameDialog", { id: taskId, filename: newName });
    }
    window.close();
  };

  return (
    <div className="flex flex-col gap-3">
      <label className="text-muted text-[11px]">New name</label>
      <input ref={inputRef} className="bg-panel2 border border-border rounded px-2 py-1.5" value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") doRename(); if (e.key === "Escape") window.close(); }} />
      <div className="flex justify-end gap-2 mt-2">
        <button className="rounded border border-border px-3 py-1.5 hover:bg-tb-hover" onClick={() => window.close()}>Cancel</button>
        <button className="rounded bg-accent text-bg px-3 py-1.5 font-semibold" onClick={doRename}>OK</button>
      </div>
    </div>
  );
}
