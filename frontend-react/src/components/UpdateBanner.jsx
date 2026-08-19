import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../lib/tauri";
import { fmt } from "../lib/format";

// The manual flow (About -> Check for Updates -> this banner -> Download
// button): deliberately kept separate from the automatic startup dialog
// (AutoUpdateDialog). They're two independent event names
// (update-available vs update-available-startup) and always have been -
// see the long investigation in project history for why that separation
// matters.
export default function UpdateBanner() {
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => api.onUpdateAvailable(setInfo), []);

  const download = async () => {
    setBusy(true);
    try {
      await api.addDownload({ url: info.downloadUrl, filename: `Speusis.Downloader_${info.version}_x64-setup.exe`, start: true, label: "Speusis Update" });
      setInfo(null);
    } catch {
      window.open(info.downloadUrl, "_blank");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {info && (
        <motion.div
          id="updateBanner"
          className="visible"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <div className="ub-icon" />
          <div className="ub-msg">
            <span>Speusis <strong>{info.version}</strong> is available{info.downloadSize ? ` (${fmt(info.downloadSize)})` : ""}</span>
            {info.notes && <span className="ub-notes">{info.notes}</span>}
          </div>
          <motion.button whileHover={{ opacity: 0.85 }} whileTap={{ scale: 0.95 }} disabled={busy} className="ub-btn" onClick={download}>
            {busy ? "Adding…" : "Download Update"}
          </motion.button>
          <motion.button whileHover={{ opacity: 0.85 }} whileTap={{ scale: 0.95 }} className="ub-dismiss" onClick={() => setInfo(null)}>
            Remind me later
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
