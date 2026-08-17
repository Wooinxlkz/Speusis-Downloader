// Mirrors actionMenuMarkup() + the #contextMenu template from the old
// index.html exactly: same action ids, same disabled-state rules. Used by
// both the row "..." dropdown and the right-click context menu so they can
// never drift apart from each other.
export function buildMenuItems({ status, kind, isMedia }) {
  const isDone = status === "completed";
  const isActive = ["running", "queued"].includes(status);
  const isPausedOrFailed = ["paused", "failed", "cancelled"].includes(status);
  const canOpen = isDone || isActive;

  const items = [
    { action: "open", label: "Open", disabled: !canOpen },
    { action: "openwith", label: "Open with…", disabled: !canOpen },
    { action: "openfolder", label: "Open folder", disabled: !canOpen },
  ];
  if (isMedia) items.push({ action: "preview", label: "Preview" });
  items.push({ sep: true });
  items.push({ action: "rename", label: "Move / rename" });
  if (["completed", "failed", "cancelled"].includes(status)) {
    items.push({ action: "redownload", label: "Redownload" });
  }
  items.push({ action: "resume", label: "Resume Download", disabled: !isPausedOrFailed });
  items.push({ action: "pause", label: "Pause Download", disabled: !isActive });
  items.push({ action: "stop", label: "Stop Download", disabled: !isActive });
  items.push({ action: "refreshurl", label: "Refresh download address" });
  items.push({ sep: true });
  items.push({ action: "delete", label: "Delete" });
  items.push({ sep: true });
  items.push({ action: "addqueue", label: "Add to queue" });
  if (kind === "torrent") items.push({ action: "torrent-files", label: "Torrent files" });
  items.push({ action: "properties", label: "Properties" });
  items.push({ action: "segmentmap", label: "Segment map" });
  items.push({ action: "tracer", label: "Download trace" });

  return items;
}
