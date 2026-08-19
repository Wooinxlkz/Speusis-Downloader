import { useRef, useState } from "react";
import { api, startDrag } from "../lib/tauri";

// The basket is a separate floating OS window and, in the original app,
// deliberately used its OWN color palette (navy/blue) instead of the main
// window's grayscale theme — see the old dist/renderer/basket.html <style>
// block. Scoping these as CSS custom properties on the root div keeps that
// distinct look instead of inheriting the shared grayscale --accent/--bg
// tokens from index.css.
const THEME = {
  "--bk-bg": "#1a1c28",
  "--bk-panel": "#20233a",
  "--bk-accent": "#2563eb",
  "--bk-border": "#2e3250",
  "--bk-text": "#d0d3e8",
  "--bk-muted": "#7880a4",
};

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
    <div
      style={{
        ...THEME,
        background: "var(--bk-bg)",
        color: "var(--bk-text)",
        borderRadius: 10,
        border: "1px solid var(--bk-border)",
        fontFamily: '"Segoe UI",sans-serif',
        fontSize: 12,
      }}
      className="flex h-screen w-screen flex-col overflow-hidden"
    >
      <div
        onPointerDown={(e) => { if (e.button === 0 && e.target === e.currentTarget) startDrag(); }}
        style={{ WebkitAppRegion: "drag", borderBottom: "1px solid var(--bk-border)" }}
        className="flex shrink-0 items-center justify-between px-3 py-2"
      >
        <div
          style={{ color: "var(--bk-muted)" }}
          className="flex items-center gap-2 font-semibold pointer-events-none"
        >
          <span style={{ background: "var(--bk-panel)" }} className="h-4 w-4 rounded-full" />
          Speusis Basket
        </div>
        <button
          onClick={() => api.closeBasket().catch(() => {})}
          style={{ WebkitAppRegion: "no-drag", color: "var(--bk-muted)" }}
          className="rounded px-1.5 py-0.5 hover:bg-red-500/25 hover:text-white"
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
            style={{
              margin: 10,
              borderRadius: 8,
              border: `2px dashed ${dragOver ? "var(--bk-accent)" : "transparent"}`,
              background: dragOver ? "rgba(37,99,235,0.18)" : "transparent",
            }}
            className="flex flex-1 cursor-pointer flex-col items-center justify-center gap-2.5 p-4 text-center hover:bg-white/5"
          >
            <span style={{ background: "var(--bk-panel)" }} className="h-[52px] w-[52px] rounded-full" />
            <div style={{ color: "var(--bk-muted)" }} className="text-[12.5px] leading-relaxed">
              <strong style={{ color: "var(--bk-text)" }} className="block text-[13.5px] mb-0.5">Drop links here</strong>
              Drag a link from your browser,<br />or click to paste a URL
            </div>
            <div style={{ color: "var(--bk-accent)" }} className="min-h-[16px] text-[11px] font-semibold">{status}</div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col justify-center gap-2.5 p-4">
            <input
              ref={inputRef}
              style={{
                background: "var(--bk-panel)",
                border: "1px solid var(--bk-border)",
                color: "var(--bk-text)",
              }}
              className="rounded-md px-2.5 py-2 text-[12px] outline-none focus:border-[var(--bk-accent)]"
              placeholder="Paste URL…"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") submitForm(); if (e.key === "Escape") setShowForm(false); }}
            />
            <div className="flex gap-2">
              <button
                style={{ border: "1px solid var(--bk-border)", color: "var(--bk-text)" }}
                className="flex-1 rounded-md py-2 hover:border-[var(--bk-muted)]"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </button>
              <button
                style={{ background: "var(--bk-accent)", borderColor: "var(--bk-accent)", color: "#fff" }}
                className="flex-1 rounded-md border py-2 font-semibold hover:brightness-110"
                onClick={submitForm}
              >
                Add
              </button>
            </div>
          </div>
        )}

        {recent.length > 0 && (
          <div style={{ borderTop: "1px solid var(--bk-border)" }} className="max-h-[120px] shrink-0 overflow-y-auto px-2.5 py-2">
            {recent.map((r, i) => (
              <div
                key={i}
                style={{ color: r.ok ? "#4ade80" : "#ef4444" }}
                className="truncate text-[11px] py-1"
              >
                {r.ok ? "✓ " : "✗ "}{r.text}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
