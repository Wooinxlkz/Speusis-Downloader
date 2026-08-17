import { useRef, useState } from "react";
import { api, startDrag } from "../lib/tauri";

export default function Basket() {
  const [dragOver, setDragOver] = useState(false);
  const [status, setStatus] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [recent, setRecent] = useState([]);
  const inputRef = useRef(null);

  const addUrl = async (url) => {
    const trimmed = (url || "").trim();
    if (!trimmed) return;
    setStatus("Adding…");
    try {
      await api.addDownload({ url: trimmed, start: true });
      setStatus("Added!");
      setRecent((prev) => [{ text: trimmed, ok: true }, ...prev].slice(0, 5));
    } catch {
      setStatus("Failed");
      setRecent((prev) => [{ text: trimmed, ok: false }, ...prev].slice(0, 5));
    } finally {
      setTimeout(() => setStatus(""), 1500);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const url = e.dataTransfer?.getData("text/uri-list") || e.dataTransfer?.getData("text/plain") || "";
    addUrl(url);
  };

  const submitForm = () => {
    const url = inputRef.current?.value.trim();
    setShowForm(false);
    if (url) addUrl(url);
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden rounded-[10px] border border-border bg-panel text-text">
      <div
        className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2"
        onPointerDown={(e) => { if (e.button === 0 && e.target === e.currentTarget) startDrag(); }}
        style={{ WebkitAppRegion: "drag" }}
      >
        <div className="flex items-center gap-2 font-semibold text-muted pointer-events-none">
          <span className="h-4 w-4 rounded-full bg-panel2" />
          Speusis Basket
        </div>
        <button
          onClick={() => api.closeBasket().catch(() => {})}
          style={{ WebkitAppRegion: "no-drag" }}
          className="rounded px-1.5 py-0.5 text-muted hover:bg-red-500/25 hover:text-white"
        >
          ✕
        </button>
      </div>

      {/* This drop zone is explicitly no-drag - the original vanilla basket
          had the whole window as app-region:drag, which silently ate every
          HTML5 drop event since the OS treated the whole surface as "move
          the window" instead of "drop here". Keeping that fix. */}
      <div className="flex flex-1 flex-col" style={{ WebkitAppRegion: "no-drag" }}>
        {!showForm ? (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => { setShowForm(true); setTimeout(() => inputRef.current?.focus(), 0); }}
            className={`m-2.5 flex flex-1 cursor-pointer flex-col items-center justify-center gap-2.5 rounded-lg border-2 border-dashed p-4 text-center ${
              dragOver ? "border-accent bg-accent/15" : "border-transparent hover:bg-white/5"
            }`}
          >
            <span className="h-12 w-12 rounded-full bg-panel2" />
            <div className="text-muted text-[12.5px] leading-relaxed">
              <strong className="block text-text text-[13.5px] mb-0.5">Drop links here</strong>
              Drag a link from your browser,<br />or click to paste a URL
            </div>
            <div className="min-h-[16px] text-[11px] font-semibold text-accent">{status}</div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col justify-center gap-2.5 p-4">
            <input
              ref={inputRef}
              className="rounded-md border border-border bg-panel2 px-2.5 py-2 text-[12px] outline-none focus:border-accent"
              placeholder="Paste URL…"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") submitForm(); if (e.key === "Escape") setShowForm(false); }}
            />
            <div className="flex gap-2">
              <button className="flex-1 rounded-md border border-border py-2 hover:border-muted" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="flex-1 rounded-md bg-accent py-2 font-semibold text-bg" onClick={submitForm}>Add</button>
            </div>
          </div>
        )}

        {recent.length > 0 && (
          <div className="max-h-[120px] shrink-0 overflow-y-auto border-t border-border px-2.5 py-2">
            {recent.map((r, i) => (
              <div key={i} className={`truncate text-[11px] py-1 ${r.ok ? "text-green-400" : "text-red-400"}`}>
                {r.ok ? "✓ " : "✗ "}{r.text}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
