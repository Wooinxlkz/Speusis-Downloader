/* Speusis Extension — Service Worker v0.27 — Cross-Browser */
"use strict";

const SPEUSIS_ENDPOINT = "http://127.0.0.1:9999/downloads";
// kikkia/yt-cipher (MIT) public instance - see interceptor.js's v0.27
// comment for the full explanation of what this does and doesn't do.
const YT_CIPHER_ENDPOINT = "https://cipher.kikkia.dev/resolve_url";
const DIALOG_WIDTH   = 640;
const DIALOG_HEIGHT  = 600;
const PENDING_KEY    = "__speusis_pending_download";
const DIALOG_ID_KEY  = "__speusis_dialog_id";

/*
 * In-memory flag blocks concurrent openDownloadDialog() calls within one SW
 * activation (handles the "multiple onCreated at once" race on session restore).
 * DIALOG_ID_KEY in storage handles the cross-SW-restart case.
 */
let _opening = false;

/* ── Startup: wipe stale state from the previous browser session ── */
chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.remove([PENDING_KEY, DIALOG_ID_KEY]);
});

/* ── Install / Context Menus ─────────────────────────────────────── */
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id:"speusis-download-link",  title:"Download with Speusis",              contexts:["link"] });
  chrome.contextMenus.create({ id:"speusis-download-video", title:"Download Video with Speusis",         contexts:["video","audio"] });
  chrome.contextMenus.create({ id:"speusis-download-page",  title:"Download Page Target with Speusis",   contexts:["page"] });
});

/* ── Context Menu Clicks ─────────────────────────────────────────── */
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  let url = null;
  if (info.menuItemId === "speusis-download-link"  && info.linkUrl) url = info.linkUrl;
  if (info.menuItemId === "speusis-download-video" && info.srcUrl)  url = info.srcUrl;
  if (info.menuItemId === "speusis-download-page"  && tab?.url)     url = tab.url;
  if (url && !isUnsupportedScheme(url))
    await openDownloadDialog({ url, pageUrl: tab?.url, pageTitle: tab?.title });
});

/* ── Intercept Browser Downloads ─────────────────────────────────── */
chrome.downloads.onCreated.addListener(async (item) => {
  const url = item.url || item.finalUrl || "";
  if (isUnsupportedScheme(url)) return;
  if (!isDownloadable(url)) return;
  try { await chrome.downloads.cancel(item.id); chrome.downloads.erase({ id: item.id }); } catch {}
  await openDownloadDialog({
    url,
    suggestedFilename: item.filename || guessFilename(url),
    fileSize: item.totalBytes > 0 ? item.totalBytes : null,
  });
});

/* ── Messages from content scripts ──────────────────────────────── */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "speusis-subframe-stream") {
    // A cross-origin iframe detected a stream and can't render its own
    // badge usefully (too small/clipped) - relay it to the tab's top
    // frame so the one visible badge picks it up.
    if (sender.tab?.id != null) {
      chrome.tabs.sendMessage(
        sender.tab.id,
        { type: "speusis-subframe-stream-relay", url: message.url, streamType: message.streamType, encrypted: message.encrypted },
        { frameId: 0 }
      ).catch(() => {});
    }
    return;
  }
  if (message?.type === "speusis-resolve-yt-cipher") {
    resolveYtCipherFormats(message.playerUrl, message.formats || [], sender.tab?.id);
    return;
  }
  if (message?.type === "speusis-download") {
    openDownloadDialog({
      url:               message.url,
      suggestedFilename: message.filename,
      fileSize:          message.fileSize,
      pageUrl:           sender.tab?.url,
      pageTitle:         sender.tab?.title,
      isYouTube:         message.isYouTube,
      isStream:          message.isStream,
      streams:           message.streams,
      needsMux:          message.needsMux,
      videoUrl:          message.videoUrl,
      audioUrl:          message.audioUrl,
    }).then(() => sendResponse({ ok: true }))
      .catch(err => sendResponse({ ok: false, error: String(err) }));
    return true;
  }
  if (message?.type === "speusis-start-download") {
    sendToSpeusis(message.url, message.filename, message.later)
      .then(() => sendResponse({ ok: true }))
      .catch(err => sendResponse({ ok: false, error: String(err) }));
    return true;
  }
  if (message?.type === "speusis-get-dialog-data") {
    chrome.storage.local.get([PENDING_KEY], (res) => {
      const data = res[PENDING_KEY] || null;
      sendResponse(data);
      if (data) chrome.storage.local.remove(PENDING_KEY);
    });
    return true;
  }
});

/* ── Open Dialog Window ──────────────────────────────────────────── */
async function openDownloadDialog(data) {
  /*
   * 1. Check storage for a dialog window ID that survived a SW restart.
   *    Chrome MV3 kills the SW after ~30 s idle; on next wake _opening resets
   *    to false but the window may still be open — storage catches that case.
   */
  const stored = await chrome.storage.local.get([DIALOG_ID_KEY]);
  const existingId = stored[DIALOG_ID_KEY] ?? null;
  if (existingId !== null) {
    try {
      await chrome.windows.update(existingId, { focused: true });
      return; // dialog still alive — just focus it
    } catch {
      // window was closed without triggering onRemoved (e.g. browser crash)
      await chrome.storage.local.remove(DIALOG_ID_KEY);
    }
  }

  /*
   * 2. In-memory lock stops the race when several onCreated events fire at
   *    once (session restore on Windows startup replays queued downloads).
   */
  if (_opening) return;
  _opening = true;

  try {
    await chrome.storage.local.set({ [PENDING_KEY]: data });

    let left = 200, top = 120;
    try {
      const win = await chrome.windows.getCurrent({ populate: false });
      left = Math.round((win.left || 0) + ((win.width  || 1200) - DIALOG_WIDTH)  / 2);
      top  = Math.round((win.top  || 0) + ((win.height || 800)  - DIALOG_HEIGHT) / 2);
    } catch {}

    const created = await chrome.windows.create({
      url: chrome.runtime.getURL("download-dialog.html"),
      type: "popup", width: DIALOG_WIDTH, height: DIALOG_HEIGHT,
      left: Math.max(0, left), top: Math.max(0, top), focused: true,
    });

    const dialogId = created.id ?? null;
    await chrome.storage.local.set({ [DIALOG_ID_KEY]: dialogId });

    const onRemoved = (windowId) => {
      if (windowId === dialogId) {
        chrome.storage.local.remove([DIALOG_ID_KEY, PENDING_KEY]);
        chrome.windows.onRemoved.removeListener(onRemoved);
      }
    };
    chrome.windows.onRemoved.addListener(onRemoved);
  } finally {
    _opening = false;
  }
}

/* ── YouTube cipher resolution (v0.27) ──────────────────────────────
 * Best-effort, purely additive: turns "locked" adaptive formats into
 * real playable URLs by asking kikkia/yt-cipher's public instance to
 * decipher each one, then reports successes back to the tab that asked.
 * Anything that fails (network error, rate limit, bad player URL) is
 * silently skipped - that format just stays locked, exactly like v0.26.
 * Requests are sent one at a time with a small stagger to stay well
 * under the public instance's stated 10 req/sec limit, and capped to
 * the first 20 formats per video (a full adaptive ladder rarely exceeds
 * that, and it keeps a single page load from hammering a free service). */
async function resolveYtCipherFormats(playerUrl, formats, tabId) {
  if (!playerUrl || !formats.length || tabId == null) return;
  const capped = formats.slice(0, 20);
  for (const f of capped) {
    try {
      const res = await fetch(YT_CIPHER_ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          stream_url: f.streamUrl,
          player_url: playerUrl,
          encrypted_signature: f.encryptedSignature,
          signature_key: f.signatureKey,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.resolved_url) {
          chrome.tabs.sendMessage(tabId, {
            type: "speusis-yt-cipher-resolved",
            url: data.resolved_url,
            itag: f.itag,
            quality: f.quality,
            kind: f.hasVideo ? "video" : "audio",
          }).catch(() => {});
        }
      }
    } catch {
      // Network error, offline, service down, etc. - skip this one format
      // silently and move on to the next; never blocks the rest.
    }
    await new Promise((r) => setTimeout(r, 150)); // ~6-7 req/sec, under the 10/sec limit
  }
}

/* ── Send to Speusis ───────────────────────────────────────────────── */
async function sendToSpeusis(url, filename, later = false) {
  const response = await fetch(SPEUSIS_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url, filename, start: !later }),
  });
  if (!response.ok) throw new Error("Speusis is not running or rejected the request");
  chrome.notifications.create({
    type: "basic", iconUrl: "icon128.png",
    title:   later ? "Added to Speusis Queue" : "Sent to Speusis",
    message: filename || url,
  });
}

/* ── Helpers ─────────────────────────────────────────────────────── */
const DOWNLOADABLE = /\.(7z|apk|avi|bin|bz2|csv|deb|dmg|doc|docx|exe|flac|flv|gz|img|iso|jar|mkv|mov|mp3|mp4|msi|ogg|pdf|pkg|rar|rpm|tar|ts|wav|webm|wmv|xls|xlsx|xz|zip)(\?|#|$)/i;

function isUnsupportedScheme(url) {
  return url.startsWith("blob:") || url.startsWith("data:") || url.startsWith("javascript:");
}
function isDownloadable(url) {
  try { return DOWNLOADABLE.test(new URL(url).pathname); } catch { return DOWNLOADABLE.test(url); }
}
function guessFilename(url) {
  try {
    const p = new URL(url).pathname;
    return decodeURIComponent(p.split("/").filter(Boolean).pop() || "download");
  } catch { return "download"; }
}
