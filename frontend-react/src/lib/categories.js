export const CAT_EXT = {
  compressed: /\.(zip|rar|7z|tar|gz|bz2|xz)$/i,
  documents:  /\.(pdf|doc|docx|txt|xls|xlsx|csv|ppt|pptx)$/i,
  music:      /\.(mp3|flac|wav|aac|ogg|m4a|wma)$/i,
  programs:   /\.(exe|msi|dmg|apk|deb|rpm)$/i,
  video:      /\.(mp4|mkv|avi|mov|wmv|flv|webm|ts|m3u8|mpd)$/i,
};

export const CATEGORIES = [
  { key: "all", label: "All Downloads" },
  { key: "compressed", label: "Compressed" },
  { key: "documents", label: "Documents" },
  { key: "music", label: "Music" },
  { key: "programs", label: "Programs" },
  { key: "video", label: "Video" },
];

export const STATUS_FILTERS = [
  { key: "unfinished", label: "Unfinished" },
  { key: "finished", label: "Finished" },
  { key: "queued", label: "Queues" },
];

export function taskMatchFilter(task, filter, displayNameFn) {
  if (filter === "all") return true;
  if (filter === "finished") return task.status === "completed";
  if (filter === "unfinished") return ["running", "paused", "queued", "failed"].includes(task.status);
  if (filter === "queued") return task.status === "queued";
  if (filter.startsWith("lbl:")) return task.label === filter.slice(4);
  const name = displayNameFn(task);
  return CAT_EXT[filter]?.test(name) ?? true;
}
