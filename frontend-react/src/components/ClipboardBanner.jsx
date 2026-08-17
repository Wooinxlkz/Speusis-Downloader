import { useEffect, useRef, useState } from "react";
import { api } from "../lib/tauri";

// Was entirely missing from the first React pass - the app already had a
// real ClipboardUrl detector wired into the bridge (onClipboardUrl) but
// nothing in the UI ever listened for it. Ported from app.js's
// initClipboardMonitor exactly.
export default function ClipboardBanner({ onAdded }) {
  const [url, setUrl] = useState(null);
  const lastOffered = useRef("");

  useEffect(() => {
    if (!api.onClipboardUrl) return;
    return api.onClipboardUrl((detected) => {
      if (detected === lastOffered.current) return;
      lastOffered.current = detected;
      setUrl(detected);
    });
  }, []);

  if (!url) return null;

  const add = async () => {
    setUrl(null);
    try {
      const result = await api.addDownload({ url, start: true });
      if (result?.id) onAdded(result);
    } catch {}
  };

  return (
    <div className="flex items-center justify-between gap-3 border-b border-border bg-panel2 px-3 py-1.5 text-[12px] shrink-0">
      <span className="truncate" title={url}>Clipboard link detected: {url}</span>
      <div className="flex gap-2 shrink-0">
        <button className="rounded bg-accent text-bg px-2 py-1 font-semibold" onClick={add}>Add</button>
        <button className="rounded px-2 py-1 text-muted hover:bg-tb-hover" onClick={() => setUrl(null)}>Dismiss</button>
      </div>
    </div>
  );
}
