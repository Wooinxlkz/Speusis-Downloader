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
    <div className="clipboard-banner">
      <div className="clipboard-message">
        <span className="clipboard-label">Clipboard URL detected</span>
        <span className="truncate" title={url}>{url}</span>
      </div>
      <button className="clipboard-add" onClick={add}>Add download</button>
      <button className="clipboard-dismiss" onClick={() => setUrl(null)}>Ignore</button>
    </div>
  );
}
