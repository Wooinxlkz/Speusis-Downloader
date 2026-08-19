import { useState } from "react";
import { api } from "../lib/tauri";

export default function BatchPanel() {
  const [links, setLinks] = useState([]);
  const [manual, setManual] = useState("");
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [busy, setBusy] = useState(false);

  const loadManual = () => {
    const urls = manual.split("\n").map((s) => s.trim()).filter(Boolean);
    const items = urls.map((url) => ({ url, name: url.split("/").pop() }));
    setLinks(items);
    setSelected(new Set(items.map((_, i) => i)));
  };

  const filtered = links
    .map((link, index) => ({ link, index }))
    .filter(({ link }) => !filter || link.url.toLowerCase().includes(filter.toLowerCase()) || link.name.toLowerCase().includes(filter.toLowerCase()));

  const toggle = (i) => setSelected((prev) => {
    const next = new Set(prev);
    next.has(i) ? next.delete(i) : next.add(i);
    return next;
  });

  const downloadSelected = async () => {
    const chosen = links.filter((_, i) => selected.has(i));
    if (!chosen.length) return;
    setBusy(true);
    try {
      // download_batch_add expects Vec<DownloadInput> - objects with at
      // least a `url` field - not an array of plain strings. Passing raw
      // strings here would fail Rust-side deserialization and silently
      // reject every batch download.
      await api.batchAddDownloads(chosen.map((l) => ({ url: l.url, filename: l.name, start: true })));
      window.close();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex gap-2">
        <input className="flex-1 bg-panel2 border border-border rounded px-2 py-1" placeholder="Filter by extension or name (e.g. .mp4)"
          value={filter} onChange={(e) => setFilter(e.target.value)} />
        <button className="rounded border border-border px-2 py-1 hover:bg-tb-hover" onClick={() => setSelected(new Set(links.map((_, i) => i)))}>Select All</button>
        <button className="rounded border border-border px-2 py-1 hover:bg-tb-hover" onClick={() => setSelected(new Set())}>None</button>
      </div>
      <p className="text-muted text-[11px]">Paste one URL per line below, or use the browser extension's "Scan Links" button.</p>
      <textarea className="bg-panel2 border border-border rounded px-2 py-1.5 h-24 font-mono text-[11px]"
        placeholder={"https://example.com/file1.zip\nhttps://example.com/file2.mp4"} value={manual} onChange={(e) => setManual(e.target.value)} />
      <button className="self-start rounded bg-accent text-bg px-3 py-1.5 font-semibold" onClick={loadManual}>Load URLs</button>

      <div className="flex-1 overflow-auto border border-border rounded mt-1">
        {filtered.length === 0 && <div className="text-muted text-[11px] p-3">No links loaded yet.</div>}
        {filtered.map(({ link, index }) => (
          <label key={index} className="flex items-center gap-2 px-2 py-1 border-b border-border/50 hover:bg-tb-hover cursor-pointer">
            <input type="checkbox" checked={selected.has(index)} onChange={() => toggle(index)} />
            <span className="truncate text-[11px]">{link.name}</span>
          </label>
        ))}
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-border">
        <button className="rounded border border-border px-3 py-1.5 hover:bg-tb-hover" onClick={() => window.close()}>Close</button>
        <button disabled={busy || !selected.size} className="rounded bg-accent text-bg px-3 py-1.5 font-semibold disabled:opacity-50" onClick={downloadSelected}>
          Download Selected
        </button>
      </div>
    </div>
  );
}
