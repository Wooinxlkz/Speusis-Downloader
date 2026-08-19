/* ── Media Player panel (v0.5.50) ──────────────────────────────────
 * "Play with Speusis" from the row's Preview button / the right-click
 * context menu opens this. No new backend plumbing was needed for
 * this feature — it reuses the streaming server (speusis_core::
 * streaming_server, already running on 127.0.0.1:47811 with HTTP
 * Range support) and the existing api.getStreamingUrl(id) bridge call
 * that the row's "Preview" button already called but never did
 * anything with.
 *
 * Controls are the browser's native <video>/<audio> controls rather
 * than a custom transport bar — play/pause, seek, volume and
 * fullscreen all come for free that way, and don't need Speusis to
 * reinvent (and maintain) a scrubber. The playlist sidebar is the
 * only custom UI here.
 * ──────────────────────────────────────────────────────────────── */
import { escHtml, fileTypeBadge } from "./utils.js";

const VIDEO_EXT = /\.(mp4|mkv|avi|mov|wmv|flv|webm|ts|m3u8|mpd|m4v)$/i;
const AUDIO_EXT = /\.(mp3|flac|wav|aac|ogg|m4a|wma)$/i;

function displayNameOf(t) {
  return t.filename || t.outputPath?.split(/[\\/]/).pop() || t.url?.split("/").pop()?.split("?")[0] || "download";
}

function kindOf(name) {
  if (VIDEO_EXT.test(name || "")) return "video";
  if (AUDIO_EXT.test(name || "")) return "audio";
  return null;
}

export function initMediaPlayer({ api, openPanel, closePanel, setStatus, taskStore }) {
  const panel      = document.getElementById("mediaPlayerPanel");
  const video      = document.getElementById("mediaPlayerVideo");
  const audioStage = document.getElementById("mediaPlayerAudioStage");
  const audio      = document.getElementById("mediaPlayerAudio");
  const audioName  = document.getElementById("mediaPlayerAudioName");
  const empty      = document.getElementById("mediaPlayerEmpty");
  const listEl     = document.getElementById("mediaPlayerPlaylist");

  if (!panel || !video || !audio) {
    // Markup missing (shouldn't happen outside of a broken build) —
    // fail soft instead of throwing on every call.
    return { openMediaPlayerPanel: async () => setStatus?.("Media Player isn't available.") };
  }

  let playlist = [];
  let activeId = null;

  function buildPlaylist() {
    return [...taskStore.values()]
      .filter(t => t.status === "completed")
      .map(t => ({ id: t.id, name: displayNameOf(t), kind: kindOf(displayNameOf(t)) }))
      .filter(t => t.kind);
  }

  function renderPlaylist() {
    if (!playlist.length) {
      listEl.innerHTML = `<div class="media-player-empty-list">No other playable downloads yet.</div>`;
      return;
    }
    listEl.innerHTML = playlist.map(item => `
      <div class="media-player-item${item.id === activeId ? " active" : ""}" data-id="${escHtml(item.id)}">
        ${fileTypeBadge(item.name)}
        <span class="media-player-item-name" title="${escHtml(item.name)}">${escHtml(item.name)}</span>
      </div>
    `).join("");
  }

  function stopAll() {
    video.pause();
    video.removeAttribute("src");
    video.load();
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
  }

  async function playItem(id) {
    const item = playlist.find(p => p.id === id);
    if (!item) return;
    activeId = id;
    renderPlaylist();

    let url;
    try {
      url = await api.getStreamingUrl(id);
    } catch {
      setStatus?.("Couldn't start playback for " + item.name);
      return;
    }

    empty.classList.add("hidden");
    if (item.kind === "video") {
      audioStage.classList.add("hidden");
      audio.pause();
      audio.removeAttribute("src");
      video.classList.remove("hidden");
      video.src = url;
      video.play().catch(() => {});
    } else {
      video.classList.add("hidden");
      video.pause();
      video.removeAttribute("src");
      audioStage.classList.remove("hidden");
      audioName.textContent = item.name;
      audio.src = url;
      audio.play().catch(() => {});
    }
  }

  function playAdjacent(step) {
    if (!playlist.length) return;
    const idx = playlist.findIndex(p => p.id === activeId);
    const next = playlist[(idx + step + playlist.length) % playlist.length];
    if (next) playItem(next.id);
  }

  video.addEventListener("ended", () => playAdjacent(1));
  audio.addEventListener("ended", () => playAdjacent(1));

  listEl.addEventListener("click", e => {
    const row = e.target.closest(".media-player-item");
    if (row?.dataset.id) playItem(row.dataset.id);
  });

  document.getElementById("btnCloseMediaPlayer")?.addEventListener("click", () => {
    stopAll();
    closePanel(panel);
  });

  async function openMediaPlayerPanel(taskId) {
    playlist = buildPlaylist();

    // The item that was actually clicked might still be mid-download
    // (matches what the old "Preview" button allowed) — include it even
    // though buildPlaylist() only looks at completed downloads.
    const task = taskId ? taskStore.get(taskId) : null;
    if (task && !playlist.some(p => p.id === taskId)) {
      const name = displayNameOf(task);
      const kind = kindOf(name);
      if (kind) playlist = [{ id: taskId, name, kind }, ...playlist];
    }

    openPanel(panel, taskId);
    renderPlaylist();

    const startId = (taskId && playlist.some(p => p.id === taskId)) ? taskId : playlist[0]?.id;
    if (startId) {
      await playItem(startId);
    } else {
      empty.classList.remove("hidden");
      video.classList.add("hidden");
      audioStage.classList.add("hidden");
    }
  }

  return { openMediaPlayerPanel };
}
