import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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

  const add = async () => {
    setUrl(null);
    try {
      const result = await api.addDownload({ url, start: true });
      if (result?.id) onAdded(result);
    } catch {}
  };

  return (
    <AnimatePresence>
      {url && (
        <motion.div
          className="clipboard-banner"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <div className="clipboard-message">
            <span className="clipboard-label">Clipboard URL detected</span>
            <span className="truncate" title={url}>{url}</span>
          </div>
          <motion.button whileHover={{ opacity: 0.85 }} whileTap={{ scale: 0.95 }} className="clipboard-add" onClick={add}>
            Add download
          </motion.button>
          <motion.button whileHover={{ opacity: 0.85 }} whileTap={{ scale: 0.95 }} className="clipboard-dismiss" onClick={() => setUrl(null)}>
            Ignore
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
