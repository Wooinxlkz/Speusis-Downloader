import { useEffect, useState } from "react";
import { api } from "../lib/tauri";
import { fmt } from "../lib/format";

export default function AutoUpdateDialog() {
  const [info, setInfo] = useState(null);
  const [warn, setWarn] = useState(false);

  useEffect(() => { api.getPendingUpdate().then(setInfo).catch(() => {}); }, []);

  const updateNow = async () => {
    if (info?.downloadUrl) await api.openUpdateDownload(info.downloadUrl);
    window.close();
  };

  if (warn) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-[11px] leading-5">
          Because of frequent changes to sites and servers, Speusis needs to keep up with those
          changes, and that's why Speusis is updated frequently. It's important to always use the
          latest version to keep everything working correctly.
          <br /><br />
          Are you sure you don't want to update?
        </p>
        <div className="flex justify-end">
          <button className="rounded bg-accent text-bg px-3 py-1.5 font-semibold" onClick={() => setWarn(false)}>Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="font-semibold">Version {info?.version || "…"} is available{info?.downloadSize ? ` (${fmt(info.downloadSize)})` : ""}</div>
      {info?.releaseNotes && <div className="text-[11px] text-muted whitespace-pre-wrap max-h-32 overflow-auto">{info.releaseNotes}</div>}
      <div className="flex justify-end gap-2">
        <button className="rounded border border-border px-3 py-1.5 hover:bg-tb-hover" onClick={() => setWarn(true)}>Cancel</button>
        <button className="rounded bg-accent text-bg px-3 py-1.5 font-semibold" onClick={updateNow}>Update now</button>
      </div>
    </div>
  );
}
