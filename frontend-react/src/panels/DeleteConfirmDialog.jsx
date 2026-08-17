import { useState } from "react";
import { api } from "../lib/tauri";

export default function DeleteConfirmDialog({ taskId }) {
  const [deleteFromDisk, setDeleteFromDisk] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const confirm = async () => {
    if (dontShowAgain) {
      // Tauri windows on Windows share the same WebView2 storage
      // partition, so this is readable by the main window next time -
      // same mechanism the reference dialogs.js relies on.
      localStorage.setItem("speusis_skipDeleteConfirm", "1");
    }
    await api.removeDownload(taskId, deleteFromDisk);
    await api.reportPanelResult("deleteConfirmDialog", { id: taskId, deleted: true });
    window.close();
  };

  return (
    <div className="flex flex-col gap-3">
      <p>Remove this download from the list?</p>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={deleteFromDisk} onChange={(e) => setDeleteFromDisk(e.target.checked)} />
        Also delete the file from disk
      </label>
      <label className="flex items-center gap-2 cursor-pointer text-muted text-[11px]">
        <input type="checkbox" checked={dontShowAgain} onChange={(e) => setDontShowAgain(e.target.checked)} />
        Don't ask me again
      </label>
      <div className="flex justify-end gap-2 mt-2">
        <button className="rounded border border-border px-3 py-1.5 hover:bg-tb-hover" onClick={() => window.close()}>Cancel</button>
        <button className="rounded bg-red-500 text-white px-3 py-1.5 font-semibold" onClick={confirm}>Delete</button>
      </div>
    </div>
  );
}
