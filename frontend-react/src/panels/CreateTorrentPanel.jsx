import { useState } from "react";
import { api } from "../lib/tauri";

export default function CreateTorrentPanel() {
  const [source, setSource] = useState("");
  const [name, setName] = useState("");
  const [tracker, setTracker] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");

  const browse = async () => {
    const path = await api.chooseFile({ directory: false });
    if (path) setSource(path);
  };

  const create = async () => {
    if (!source.trim()) return;
    setBusy(true); setResult("");
    try {
      const outDir = source.substring(0, Math.max(source.lastIndexOf("/"), source.lastIndexOf("\\")));
      const path = await api.createTorrent(source.trim(), outDir, name.trim() || undefined, tracker.trim() || undefined);
      setResult("Created: " + path);
    } catch (e) {
      setResult("Failed: " + String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <label className="text-muted text-[11px]">Source</label>
      <div className="flex gap-2">
        <input className="flex-1 bg-panel2 border border-border rounded px-2 py-1.5" placeholder="Choose file or folder…"
          value={source} onChange={(e) => setSource(e.target.value)} />
        <button className="rounded border border-border px-3 py-1.5 hover:bg-tb-hover" onClick={browse}>Browse…</button>
      </div>
      <label className="text-muted text-[11px]">Name</label>
      <input className="bg-panel2 border border-border rounded px-2 py-1.5" placeholder="Torrent name (auto-detected)" value={name} onChange={(e) => setName(e.target.value)} />
      <label className="text-muted text-[11px]">Tracker</label>
      <input className="bg-panel2 border border-border rounded px-2 py-1.5" placeholder="Custom tracker URL (optional)" value={tracker} onChange={(e) => setTracker(e.target.value)} />
      {result && <div className="text-[11px] text-muted break-all">{result}</div>}
      <div className="flex justify-end gap-2 mt-2">
        <button className="rounded border border-border px-3 py-1.5 hover:bg-tb-hover" onClick={() => window.close()}>Close</button>
        <button disabled={busy || !source.trim()} className="rounded bg-accent text-bg px-3 py-1.5 font-semibold disabled:opacity-50" onClick={create}>
          {busy ? "Creating…" : "Create .torrent"}
        </button>
      </div>
    </div>
  );
}
