import { useState } from "react";
import { api } from "../lib/tauri";

export default function AddUrlPanel() {
  const [url, setUrl] = useState("");
  const [filename, setFilename] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const add = async () => {
    if (!url.trim()) return;
    setBusy(true); setError("");
    try {
      await api.addDownload({ url: url.trim(), filename: filename.trim() || undefined, start: true });
      setUrl(""); setFilename("");
      window.close();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <label className="text-muted text-[11px]">URL</label>
      <input autoFocus className="bg-panel2 border border-border rounded px-2 py-1.5" placeholder="https://example.com/file.zip"
        value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
      <label className="text-muted text-[11px]">Save as (optional)</label>
      <input className="bg-panel2 border border-border rounded px-2 py-1.5" placeholder="Auto-detected from URL"
        value={filename} onChange={(e) => setFilename(e.target.value)} />
      {error && <div className="text-red-400 text-[11px]">{error}</div>}
      <div className="flex justify-end gap-2 mt-2">
        <button className="rounded border border-border px-3 py-1.5 hover:bg-tb-hover" onClick={() => window.close()}>Cancel</button>
        <button disabled={busy || !url.trim()} className="rounded bg-accent text-bg px-3 py-1.5 font-semibold disabled:opacity-50" onClick={add}>
          {busy ? "Adding…" : "Download"}
        </button>
      </div>
    </div>
  );
}
