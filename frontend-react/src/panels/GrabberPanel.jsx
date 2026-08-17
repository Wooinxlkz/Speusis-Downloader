import { useState } from "react";
import { api } from "../lib/tauri";

export default function GrabberPanel() {
  const [url, setUrl] = useState("");
  const [results, setResults] = useState([]);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [scanning, setScanning] = useState(false);

  const scan = async () => {
    if (!url.trim()) return;
    setScanning(true);
    try {
      const result = await api.grabberScan(url.trim());
      const links = result?.links || [];
      setResults(links);
      setSelected(new Set(links.map((_, i) => i)));
    } catch {
      setResults([]);
    } finally {
      setScanning(false);
    }
  };

  const filtered = results.filter((l) => !filter || (l.url || "").toLowerCase().includes(filter.toLowerCase()));
  const toggle = (i) => setSelected((prev) => { const next = new Set(prev); next.has(i) ? next.delete(i) : next.add(i); return next; });

  const downloadSelected = async () => {
    const chosen = results.filter((_, i) => selected.has(i));
    if (!chosen.length) return;
    // Same fix as BatchPanel: needs Vec<DownloadInput> objects, not
    // plain URL strings, or Rust rejects every item at deserialization.
    await api.batchAddDownloads(chosen.map((l) => ({ url: l.url, filename: l.name, start: true })));
    window.close();
  };

  return (
    <div className="flex h-full flex-col gap-2">
      <p className="text-muted text-[11px]">Enter a page URL to scan for all downloadable links (videos, audio, files, documents).</p>
      <div className="flex gap-2">
        <input className="flex-1 bg-panel2 border border-border rounded px-2 py-1" placeholder="https://example.com/page"
          value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && scan()} />
        <button disabled={scanning} className="rounded bg-accent text-bg px-3 py-1 font-semibold disabled:opacity-50" onClick={scan}>
          {scanning ? "Scanning…" : "Scan Page"}
        </button>
      </div>
      <div className="flex gap-2">
        <input className="flex-1 bg-panel2 border border-border rounded px-2 py-1" placeholder="Filter by extension or keyword"
          value={filter} onChange={(e) => setFilter(e.target.value)} />
        <button className="rounded border border-border px-2 py-1 hover:bg-tb-hover" onClick={() => setSelected(new Set(results.map((_, i) => i)))}>All</button>
        <button className="rounded border border-border px-2 py-1 hover:bg-tb-hover" onClick={() => setSelected(new Set())}>None</button>
      </div>
      <div className="flex-1 overflow-auto border border-border rounded">
        {filtered.length === 0 && <div className="text-muted text-[11px] p-3 text-center">Enter a URL above and click "Scan Page" to find downloadable links.</div>}
        {filtered.map((l, i) => (
          <label key={i} className="flex items-center gap-2 px-2 py-1 border-b border-border/50 hover:bg-tb-hover cursor-pointer">
            <input type="checkbox" checked={selected.has(i)} onChange={() => toggle(i)} />
            <span className="truncate text-[11px]">{l.name || l.url}</span>
          </label>
        ))}
      </div>
      <div className="flex justify-end gap-2 pt-2 border-t border-border">
        <button className="rounded border border-border px-3 py-1.5 hover:bg-tb-hover" onClick={() => window.close()}>Close</button>
        <button disabled={!selected.size} className="rounded bg-accent text-bg px-3 py-1.5 font-semibold disabled:opacity-50" onClick={downloadSelected}>
          Download Selected
        </button>
      </div>
    </div>
  );
}
