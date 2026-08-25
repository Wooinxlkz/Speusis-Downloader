/* ── Pure formatting / render helpers ──────────────────────────────
 * Extracted from app.js (v0.5.43 split, Pass 1).
 * These have zero shared state and zero DOM references — they take
 * arguments in, return a value out. Safe to move as-is, no logic
 * changed from the originals.
 * ──────────────────────────────────────────────────────────────── */

export function fmt(bytes) {
  if (!bytes || bytes <= 0) return "0 B";
  const u = ["B","KB","MB","GB","TB"];
  const i = Math.min(u.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 2)} ${u[i]}`;
}

export function fmtSecs(s) {
  if (!Number.isFinite(s) || s <= 0) return "—";
  if (s < 60)   return `${Math.round(s)}s`;
  if (s < 3600) return `${Math.floor(s/60)}m ${Math.round(s%60)}s`;
  return `${Math.floor(s/3600)}h ${Math.floor((s%3600)/60)}m`;
}

export function displayName(t) {
  return t.filename || t.outputPath?.split(/[\\/]/).pop() || t.url?.split("/").pop()?.split("?")[0] || "download";
}

export function escHtml(v) {
  return String(v ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[c]);
}

export function hexToRgba(hex, alpha) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
  const n = parseInt(full, 16);
  if (Number.isNaN(n) || full.length !== 6) return `rgba(232,232,232,${alpha})`;
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

/* ── File-type icon ──────────────────────────────────────────────── */
const EXT_COLORS = {
  zip:"#f59e0b",rar:"#f59e0b","7z":"#f59e0b",tar:"#f59e0b",gz:"#f59e0b",bz2:"#f59e0b",
  pdf:"#ef4444",doc:"#3b82f6",docx:"#3b82f6",txt:"#94a3b8",
  xls:"#22c55e",xlsx:"#22c55e",csv:"#22c55e",
  mp3:"#a78bfa",flac:"#a78bfa",wav:"#a78bfa",aac:"#a78bfa",ogg:"#a78bfa",
  mp4:"#ec4899",mkv:"#ec4899",avi:"#ec4899",mov:"#ec4899",wmv:"#ec4899",
  exe:"#f97316",msi:"#f97316",dmg:"#f97316",apk:"#22c55e",
  iso:"#64748b",img:"#64748b",
  jpg:"#06b6d4",jpeg:"#06b6d4",png:"#06b6d4",gif:"#06b6d4",webp:"#06b6d4",svg:"#06b6d4",
  m3u8:"#ec4899",mpd:"#a78bfa",ts:"#ec4899",
  torrent:"#10b981",
};

export function fileTypeBadge(name) {
  const ext = (name || "").split(".").pop()?.toLowerCase() || "?";
  const color = EXT_COLORS[ext] || "#6366f1";
  const label = ext.slice(0, 4).toUpperCase();
  return `<svg width="28" height="20" viewBox="0 0 28 20" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0">
    <rect x="0.5" y="0.5" width="27" height="19" rx="2" fill="${color}" fill-opacity="0.16" stroke="${color}" stroke-opacity="0.32"/>
    <text x="14" y="14" font-family="monospace" font-size="7" font-weight="700"
          fill="${color}" text-anchor="middle" letter-spacing="0.3">${label}</text>
  </svg>`;
}

export function scanBadge(scan) {
  if (!scan?.status) return "";
  const labels = {
    pending: ["st-running", "Scanning"],
    clean: ["st-completed", "Clean"],
    "threats-found": ["st-failed", "Threat"],
    failed: ["st-failed", "Scan failed"],
    skipped: ["st-paused", "Not scanned"],
  };
  const [cls, label] = labels[scan.status] || ["st-paused", scan.status];
  const title = scan.message ? ` title="${escHtml(scan.message)}"` : "";
  return ` <span class="st-badge ${cls}"${title}>${window.tt ? window.tt(label) : label}</span>`;
}

// Badge for the local, offline security checks (speusis-core/src/security -
// type-spoof + extension-risk) - deliberately separate from scanBadge()
// above (the Windows Defender scan) so one can never overwrite or hide the
// other; both can render side by side in the same Status cell. Only ever
// informational: a count + tooltip, never anything that implies the file
// was blocked or altered.
export function localFindingsBadge(report) {
  if (!report) return "";
  const count = report.findings?.length || 0;
  if (count === 0) {
    // Nothing to show when clean - scanBadge()'s "Clean" already covers
    // the reassuring case, so this stays silent rather than adding a
    // second redundant "Clean"-looking pill next to it.
    return "";
  }
  const title = report.findings.map(f => f.summary).join(" \u2022 ");
  // Not run through tt() - the count makes this a different string every
  // time, so there's no fixed dictionary entry to match against anyway.
  const label = count === 1 ? "1 finding" : `${count} findings`;
  return ` <span class="st-badge st-failed" title="${escHtml(title)}">${label}</span>`;
}

export function statusBadge(task) {
  const status = task?.status;
  const map = {
    running:   ["st-running",   "Downloading"],
    completed: ["st-completed", "Complete"],
    paused:    ["st-paused",    "Paused"],
    queued:    ["st-queued",    "Queued"],
    failed:    ["st-failed",    "Failed"],
    cancelled: ["st-cancelled", "Cancelled"],
  };
  const [cls, label] = map[status] || ["st-queued", status || "Unknown"];
  const title = status === "failed" && task?.lastError
    ? ` title="${escHtml(task.lastError)}"`
    : "";
  return `<span class="st-badge ${cls}"${title}>${window.tt ? window.tt(label) : label}</span>${scanBadge(task?.securityScan)}${localFindingsBadge(task?.localSecurityFindings)}`;
}

/* ── Row SVG action buttons (shared by row actions + tracer panel) ── */
export const BTN_SVG = {
  play:    `<svg width="12" height="12" viewBox="0 0 20 20"><polygon points="4,3 17,10 4,17" fill="#6ee7b7"/></svg>`,
  pause:   `<svg width="12" height="12" viewBox="0 0 20 20"><rect x="4" y="4" width="4" height="12" rx="1" fill="#fcd34d"/><rect x="12" y="4" width="4" height="12" rx="1" fill="#fcd34d"/></svg>`,
  stop:    `<svg width="12" height="12" viewBox="0 0 20 20"><rect x="4" y="4" width="12" height="12" rx="2" fill="#f87171"/></svg>`,
  retry:   `<svg width="12" height="12" viewBox="0 0 20 20"><path d="M4 10a6 6 0 106-6" stroke="#60a5fa" stroke-width="2" fill="none" stroke-linecap="round"/><polyline points="4,5 4,10 9,10" stroke="#60a5fa" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  del:     `<svg width="12" height="12" viewBox="0 0 20 20"><polyline points="3,6 17,6" stroke="#f87171" stroke-width="1.8" fill="none"/><path d="M8 6V4h4v2M5 6l1 11h8l1-11" stroke="#f87171" stroke-width="1.5" fill="none"/></svg>`,
  preview: `<svg width="12" height="12" viewBox="0 0 20 20"><polygon points="4,3 17,10 4,17" fill="#e8e8e8"/></svg>`,
};
