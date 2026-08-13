// Drop-in replacement for the real preload.ts, verified against the
// actual source (not the compiled bundle this was first built from).
// Same `window.downloadManager` method names/signatures your real
// app.js already calls.
//
// Uses Tauri's injected window.__TAURI__ global (enabled via
// "withGlobalTauri": true in tauri.conf.json) instead of importing
// "@tauri-apps/api" as an ES module - this project has no bundler
// (no vite/webpack/esbuild step), and dist/renderer ships as raw
// static files, so a bare npm-style import specifier can't resolve
// in the webview at runtime. This is a plain classic script now, not
// type="module", so it also runs synchronously in document order
// before app.js instead of being deferred like a module script would be.
const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;

window.downloadManager = {
  addDownload: (input) => invoke("download_add", { input }),
  batchAddDownloads: (urls) => invoke("download_batch_add", { urls }),
  listDownloads: () => invoke("download_list"),
  cancelDownload: (id) => invoke("download_cancel", { id }),
  removeDownload: (id, deleteFromDisk = false) => invoke("download_remove", { id, deleteFromDisk }),
  pauseDownload: (id) => invoke("download_pause", { id }),
  resumeDownload: (id) => invoke("download_resume", { id }),
  addTorrentFile: () => invoke("download_add_torrent_file"),
  previewDownload: (id) => invoke("download_preview", { id }),
  getStreamingUrl: (id) => invoke("download_streaming_url", { id }),
  openFile: (id) => invoke("download_open_file", { id }),
  openFolder: (id) => invoke("download_open_folder", { id }),
  openWith: (id) => invoke("download_open_with", { id }),

  getTorrentFiles: (id) => invoke("torrent_get_files", { id }),
  selectTorrentFile: (id, fileIndex, selected) => invoke("torrent_select_file", { id, fileIndex, selected }),

  grabberScan: (url) => invoke("grabber_scan", { url }),
  listPlugins: () => invoke("plugin_list"), // discovery only - see README "What's stubbed"

  openBasket: () => invoke("basket_open"),
  closeBasket: () => invoke("basket_close"),
  openPanel: (panel, id) => invoke("panel_open", { panel, id }),
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
  openUpdateDownload: (url) => invoke("update_open_download", { url }),
  onUpdateAvailable: (handler) => {
    let unlisten;
    listen("update-available", (event) => handler(event.payload)).then((fn) => (unlisten = fn));
    return () => unlisten && unlisten();
  },

  // --- Hot-patch system ---
  // Found in the real preload.ts but NOT built out on the Rust side yet.
  // These currently reject cleanly rather than silently no-op-ing, so
  // your renderer's error handling (not a crash) is what runs if it
  // calls these. See README "What's stubbed".
  downloadPatch: (asarUrl) => invoke("update_download_patch", { asarUrl }),
  applyPatch: () => invoke("update_apply_patch"),
  relaunchApp: () => invoke("update_relaunch"),
  onPatchProgress: (handler) => {
    let unlisten;
    listen("patch-progress", (event) => handler(event.payload)).then((fn) => (unlisten = fn));
    return () => unlisten && unlisten();
  },

  // --- Download progress (used internally by app.js's polling/refresh
  // logic - not in the original preload, but harmless to expose the
  // same way as the other event subscriptions) ---
  onDownloadProgress: (callback) => {
    let unlisten;
    listen("download-progress", (event) => callback(event.payload)).then((fn) => (unlisten = fn));
    return () => unlisten && unlisten();
  },
};
