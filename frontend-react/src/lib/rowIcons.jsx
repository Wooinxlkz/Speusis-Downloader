// Restored from dist/renderer/utils.js's BTN_SVG (v0.5.43) — the row's
// always-visible quick-action icons (pause/stop/resume/preview) that sat
// next to the "..." dropdown. The React rewrite folded these into the
// dropdown too, alongside Delete/Redownload — but the v0.5.43 source itself
// says only Delete/Redownload were meant to move there; pause/stop/resume/
// preview were meant to stay one click away on the row.
export const ROW_ICONS = {
  play: (
    <svg width="12" height="12" viewBox="0 0 20 20"><polygon points="4,3 17,10 4,17" fill="#6ee7b7" /></svg>
  ),
  pause: (
    <svg width="12" height="12" viewBox="0 0 20 20">
      <rect x="4" y="4" width="4" height="12" rx="1" fill="#fcd34d" />
      <rect x="12" y="4" width="4" height="12" rx="1" fill="#fcd34d" />
    </svg>
  ),
  stop: (
    <svg width="12" height="12" viewBox="0 0 20 20"><rect x="4" y="4" width="12" height="12" rx="2" fill="#f87171" /></svg>
  ),
  preview: (
    <svg width="12" height="12" viewBox="0 0 20 20"><polygon points="4,3 17,10 4,17" fill="#e8e8e8" /></svg>
  ),
};
