import { useEffect, useState } from "react";
import { api } from "../lib/tauri";
import { fmt } from "../lib/format";

// The manual flow (About -> Check for Updates -> this banner -> Download
// button): deliberately kept separate from the automatic startup dialog
// (AutoUpdateDialog). They're two independent event names
// (update-available vs update-available-startup) and always have been -
// see the long investigation in project history for why that separation
// matters.
export default function UpdateBanner() {
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => api.onUpdateAvailable(setInfo), []);

  if (!info) return null;

  const download = async () => {
    setBusy(true);
    try {
      await api.addDownload({ url: info.downloadUrl, filename: `Speusis.Downloader_${info.version}_x64-setup.exe`, start: true, label: "Speusis Update" });
      setInfo(null);
    } catch {
      window.open(info.downloadUrl, "_blank");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 border-b border-accent/40 bg-accent/10 px-3 py-1.5 text-[12px] shrink-0">
      <span>
        v{info.version} is available{info.downloadSize ? ` (${fmt(info.downloadSize)})` : ""}
      </span>
      <div className="flex gap-2">
        <button disabled={busy} className="rounded bg-accent text-bg px-2 py-1 font-semibold disabled:opacity-50" onClick={download}>
          {busy ? "Adding…" : "Download Update"}
        </button>
        <button className="rounded px-2 py-1 text-muted hover:bg-tb-hover" onClick={() => setInfo(null)}>✕</button>
      </div>
    </div>
  );
}
