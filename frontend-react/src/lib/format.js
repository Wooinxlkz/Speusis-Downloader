export function fmt(bytesPerSec) {
  if (!bytesPerSec || bytesPerSec <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = bytesPerSec, i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 2)} ${units[i]}`;
}

export function fmtTime(seconds) {
  if (!seconds || !isFinite(seconds) || seconds <= 0) return "--";
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.ceil(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

export function displayName(task) {
  return task?.filename || (task?.url || "").split("/").pop() || "download";
}

export const VIDEO_EXT = /\.(mp4|mkv|avi|mov|wmv|flv|webm|m3u8|ts)$/i;
export const AUDIO_EXT = /\.(mp3|flac|wav|aac|ogg|m4a|wma)$/i;

export function isMediaFile(name) {
  return VIDEO_EXT.test(name || "") || AUDIO_EXT.test(name || "");
}

// Restored from dist/renderer/utils.js (v0.5.43) — per-extension colors for
// the small file-type badge that was dropped in the React rewrite pass.
export const EXT_COLORS = {
  zip: "#f59e0b", rar: "#f59e0b", "7z": "#f59e0b", tar: "#f59e0b", gz: "#f59e0b", bz2: "#f59e0b",
  pdf: "#ef4444", doc: "#3b82f6", docx: "#3b82f6", txt: "#94a3b8",
  xls: "#22c55e", xlsx: "#22c55e", csv: "#22c55e",
  mp3: "#a78bfa", flac: "#a78bfa", wav: "#a78bfa", aac: "#a78bfa", ogg: "#a78bfa",
  mp4: "#ec4899", mkv: "#ec4899", avi: "#ec4899", mov: "#ec4899", wmv: "#ec4899",
  exe: "#f97316", msi: "#f97316", dmg: "#f97316", apk: "#22c55e",
  iso: "#64748b", img: "#64748b",
  jpg: "#06b6d4", jpeg: "#06b6d4", png: "#06b6d4", gif: "#06b6d4", webp: "#06b6d4", svg: "#06b6d4",
  m3u8: "#ec4899", mpd: "#a78bfa", ts: "#ec4899",
  torrent: "#10b981",
};

export function fileTypeColor(name) {
  const ext = (name || "").split(".").pop()?.toLowerCase() || "?";
  return EXT_COLORS[ext] || "#6366f1";
}
