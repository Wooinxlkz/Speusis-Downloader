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
