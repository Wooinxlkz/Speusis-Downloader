import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

// ES-module port of the old dist/renderer/downloadManagerBridge.js -
// every method name, param name, and event name below is copied verbatim
// from that file's own comment: "verified against the actual source"
// (src-tauri/src/commands.rs). Only the transport changed (real `invoke`/
// `listen` imports instead of the window.__TAURI__ global that file used
// because the old app shipped with no bundler) - nothing on the Rust side
// needed to change for this rewrite.
export const api = {
  addDownload: (input) => invoke("download_add", { input }),
  batchAddDownloads: (urls) => invoke("download_batch_add", { urls }),
  listDownloads: () => invoke("download_list"),
  cancelDownload: (id) => invoke("download_cancel", { id }),
  removeDownload: (id, deleteFromDisk = false) => invoke("download_remove", { id, deleteFromDisk }),
  pauseDownload: (id) => invoke("download_pause", { id }),
  resumeDownload: (id) => invoke("download_resume", { id }),
  getSegmentMap: (id) => invoke("download_segment_map", { id }),
  addTorrentFile: () => invoke("download_add_torrent_file"),
  previewDownload: (id) => invoke("download_preview", { id }),
  getStreamingUrl: (id) => invoke("download_streaming_url", { id }),
  openFile: (id) => invoke("download_open_file", { id }),
  openFolder: (id) => invoke("download_open_folder", { id }),
  openWith: (id) => invoke("download_open_with", { id }),

  getTorrentFiles: (id) => invoke("torrent_get_files", { id }),
  selectTorrentFile: (id, fileIndex, selected) => invoke("torrent_select_file", { id, fileIndex, selected }),

  grabberScan: (url) => invoke("grabber_scan", { url }),
  listPlugins: () => invoke("plugin_list"),

  openBasket: () => invoke("basket_open"),
  closeBasket: () => invoke("basket_close"),
  openPanel: (panel, id) => invoke("panel_open", { panel, id }),
  resizePanel: (panel, width, height) => invoke("panel_resize", { panel, width, height }),
  closePanel: (panel) => invoke("panel_close", { panel }),
  reportPanelResult: (panel, result) => invoke("panel_result", { panel, result }),
  onPanelResult: (handler) => {
    let unlisten;
    listen("panel-result", (event) => handler(event.payload)).then((fn) => (unlisten = fn));
    return () => unlisten && unlisten();
  },

  getSettings: () => invoke("settings_get"),
  updateSettings: (patch) => invoke("settings_update", { patch }),
  chooseDownloadDir: () => invoke("settings_choose_download_dir"),
  getAutoStart: () => invoke("settings_get_auto_start"),
  setAutoStart: (enabled) => invoke("settings_set_auto_start", { enabled }),

  addCredential: (cred) => invoke("settings_add_credential", { cred }),
  removeCredential: (domain) => invoke("settings_remove_credential", { domain }),

  scanDownloadDir: () => invoke("settings_scan_download_dir"),
  listDrives: () => invoke("settings_list_drives"),

  listRssFeeds: () => invoke("rss_list"),
  addRssFeed: (feed) => invoke("rss_add", { feed }),
  updateRssFeed: (id, patch) => invoke("rss_update", { id, patch }),
  removeRssFeed: (id) => invoke("rss_remove", { id }),
  fetchRssNow: (id) => invoke("rss_fetch_now", { id }),

  createTorrent: (sourcePath, outputDir, name, tracker) =>
    invoke("torrent_create", { sourcePath, outputDir, name, tracker }),
  chooseFile: (options) => invoke("dialog_choose_file", { options }),

  onClipboardUrl: (handler) => {
    let unlisten;
    listen("clipboard-url-detected", (event) => handler(event.payload)).then((fn) => (unlisten = fn));
    return () => unlisten && unlisten();
  },

  getVersion: () => invoke("app_get_version"),
  activateLicense: (name, email, key) => invoke("license_activate", { name, email, key }),
  getLicenseStatus: () => invoke("license_get_status"),

  onEvent: (handler) => {
    let unlisten;
    listen("event-bus", (event) => handler(event.payload.event, event.payload.data)).then((fn) => (unlisten = fn));
    return () => unlisten && unlisten();
  },
  onMenuCommand: (handler) => {
    let unlisten;
    listen("menu-command", (event) => handler(event.payload)).then((fn) => (unlisten = fn));
    return () => unlisten && unlisten();
  },

  checkForUpdate: () => invoke("update_check"),
  getPendingUpdate: () => invoke("update_get_pending"),
  openUpdateDownload: (url) => invoke("update_open_download", { url }),
  onUpdateAvailable: (handler) => {
    let unlisten;
    listen("update-available", (event) => handler(event.payload)).then((fn) => (unlisten = fn));
    return () => unlisten && unlisten();
  },
  onStartupUpdateAvailable: (handler) => {
    let unlisten;
    listen("update-available-startup", (event) => handler(event.payload)).then((fn) => (unlisten = fn));
    return () => unlisten && unlisten();
  },
  onSettingsUpdated: (handler) => {
    let unlisten;
    listen("settings-updated", (event) => handler(event.payload)).then((fn) => (unlisten = fn));
    return () => unlisten && unlisten();
  },

  downloadPatch: (asarUrl) => invoke("update_download_patch", { asarUrl }),
  applyPatch: () => invoke("update_apply_patch"),
  relaunchApp: () => invoke("update_relaunch"),
  onPatchProgress: (handler) => {
    let unlisten;
    listen("patch-progress", (event) => handler(event.payload)).then((fn) => (unlisten = fn));
    return () => unlisten && unlisten();
  },

  onDownloadProgress: (callback) => {
    let unlisten;
    listen("download-progress", (event) => callback(event.payload)).then((fn) => (unlisten = fn));
    return () => unlisten && unlisten();
  },
};

export const currentWindow = getCurrentWindow();
export const startDrag = () => currentWindow.startDragging?.().catch(() => {});
export const startResize = (direction) => currentWindow.startResizeDragging?.(direction).catch(() => {});
