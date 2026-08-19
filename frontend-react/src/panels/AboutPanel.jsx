import { useEffect, useState } from "react";
import { api } from "../lib/tauri";

const FEATURES = [
  "Multi-segment HTTP", "BitTorrent + DHT/PEX", "FTP/FTPS",
  "Per-file Priority", "Sequential Torrent", "Seeding Ratio",
  "IP Blocklist", "Web Grabber", "Download Basket",
  "Auto-start", "System Tray", "File-type Routing",
  "RSS Auto-Download", "Scheduler", "Speed Graph",
  "Batch Download", "Create .torrent", "Site Logins",
  "Windows Defender Scan", "Clipboard URL Monitor", "IDM-style UI",
];

export default function AboutPanel() {
  const [version, setVersion] = useState("");
  const [status, setStatus] = useState("");
  const [checking, setChecking] = useState(false);

  useEffect(() => { api.getVersion().then(setVersion).catch(() => {}); }, []);

  const checkUpdate = async () => {
    setChecking(true); setStatus("");
    try {
      const result = await api.checkForUpdate();
      const info = result?.info;
      if (info) {
        setStatus(`v${info.version} is available! Downloading now starts from the update banner.`);
      } else {
        setStatus("You're on the latest version.");
      }
    } catch (e) {
      setStatus("Couldn't check for updates: " + String(e));
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="flex flex-col items-center text-center gap-2">
      <h1 className="text-xl font-bold text-accent">Speusis Downloader</h1>
      <div className="font-semibold">Version {version || "…"} — Windows</div>
      <div className="text-muted text-[11px]">Multi-segment, resumable download manager.</div>
      <div className="text-accent text-[11px] mb-2">Developed by Nulltrace</div>
      <div className="text-muted text-[11px] leading-5">
        {FEATURES.reduce((rows, f, i) => {
          const row = Math.floor(i / 3);
          rows[row] = rows[row] || [];
          rows[row].push(f);
          return rows;
        }, []).map((row, i) => <div key={i}>{row.join(" · ")}</div>)}
      </div>
      {status && <div className="text-[11px] text-green-400 mt-2">{status}</div>}
      <div className="flex gap-2 mt-3">
        <button disabled={checking} className="rounded bg-accent text-bg px-3 py-1.5 font-semibold disabled:opacity-50" onClick={checkUpdate}>
          {checking ? "Checking…" : "Check for Updates"}
        </button>
        <button className="rounded border border-border px-3 py-1.5 hover:bg-tb-hover" onClick={() => window.close()}>Close</button>
      </div>
    </div>
  );
}
