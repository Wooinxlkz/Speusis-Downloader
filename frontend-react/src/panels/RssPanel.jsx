import { useEffect, useState } from "react";
import { api } from "../lib/tauri";

const INTERVALS = [
  [10, "10 min"], [30, "30 min"], [60, "1 hour"], [180, "3 hours"], [720, "12 hours"], [1440, "24 hours"],
];

export default function RssPanel() {
  const [feeds, setFeeds] = useState([]);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [filter, setFilter] = useState("");
  const [interval, setInterval_] = useState(30);
  const [autoDl, setAutoDl] = useState(true);

  const load = () => api.listRssFeeds().then(setFeeds).catch(() => {});
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!name.trim() || !url.trim()) return;
    await api.addRssFeed({
      id: crypto.randomUUID(), name: name.trim(), url: url.trim(),
      enabled: true, lastFetched: null, filter: filter.trim() || null,
      targetDir: null, autoDownload: autoDl, fetchInterval: interval,
    });
    setName(""); setUrl(""); setFilter("");
    load();
  };

  const remove = async (id) => { await api.removeRssFeed(id); load(); };
  const toggle = async (feed) => { await api.updateRssFeed(feed.id, { enabled: !feed.enabled }); load(); };
  const fetchNow = async (id) => { await api.fetchRssNow(id); load(); };

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex-1 overflow-auto border border-border rounded">
        {feeds.length === 0 && <div className="text-muted text-[11px] p-3">No RSS feeds configured yet.</div>}
        {feeds.map((f) => (
          <div key={f.id} className="flex items-center justify-between gap-2 px-2 py-1.5 border-b border-border/50">
            <label className="flex items-center gap-2 min-w-0 cursor-pointer">
              <input type="checkbox" checked={f.enabled} onChange={() => toggle(f)} />
              <span className="truncate text-[11px]">{f.name}</span>
            </label>
            <div className="flex gap-2 shrink-0">
              <button className="text-[11px] text-accent hover:underline" onClick={() => fetchNow(f.id)}>Fetch now</button>
              <button className="text-[11px] text-red-400 hover:underline" onClick={() => remove(f.id)}>Remove</button>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-border pt-2">
        <div className="text-accent text-[11px] font-semibold mb-2 uppercase tracking-wide">Add RSS Feed</div>
        <div className="flex flex-col gap-2">
          <input className="bg-panel2 border border-border rounded px-2 py-1" placeholder="Feed name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="bg-panel2 border border-border rounded px-2 py-1" placeholder="https://…/feed.xml" value={url} onChange={(e) => setUrl(e.target.value)} />
          <input className="bg-panel2 border border-border rounded px-2 py-1" placeholder="Optional regex filter (e.g. .mkv$)" value={filter} onChange={(e) => setFilter(e.target.value)} />
          <div className="flex items-center gap-3">
            <select className="bg-panel2 border border-border rounded px-2 py-1" value={interval} onChange={(e) => setInterval_(Number(e.target.value))}>
              {INTERVALS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <label className="flex items-center gap-2 cursor-pointer text-[11px]">
              <input type="checkbox" checked={autoDl} onChange={(e) => setAutoDl(e.target.checked)} />
              Auto-download matches
            </label>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-border">
        <button className="rounded border border-border px-3 py-1.5 hover:bg-tb-hover" onClick={() => window.close()}>Close</button>
        <button className="rounded bg-accent text-bg px-3 py-1.5 font-semibold" onClick={add}>Add Feed</button>
      </div>
    </div>
  );
}
