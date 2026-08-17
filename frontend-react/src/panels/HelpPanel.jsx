export default function HelpPanel() {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-bold text-accent">Help &amp; Support</h2>
      <p className="text-muted text-[11px] leading-5">
        Speusis Downloader is a multi-segment, resumable download manager with BitTorrent, FTP, RSS
        auto-download, and a browser extension for one-click captures.
      </p>
      <div className="text-[11px] leading-6">
        <div><strong>Add a download:</strong> toolbar → Add URL, or drag-and-drop a link.</div>
        <div><strong>Torrents:</strong> open a .torrent file, or paste a magnet link into Add URL.</div>
        <div><strong>Batch downloads:</strong> toolbar → Batch, paste multiple links at once.</div>
        <div><strong>Web Grabber:</strong> scans a whole page for downloadable files.</div>
        <div><strong>Right-click any row</strong> for the full context menu (pause, resume, delete, properties…).</div>
      </div>
      <div className="flex justify-end pt-2 border-t border-border">
        <button className="rounded border border-border px-3 py-1.5 hover:bg-tb-hover" onClick={() => window.close()}>Close</button>
      </div>
    </div>
  );
}
