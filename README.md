# Speusis Downloader v0.4.0 — Tauri/Rust Desktop Download Manager

A full-featured Tauri v2 / Rust port of Speusis Downloader with real implementations of every
major subsystem — no stubs, no placeholder commands.

---

## What's implemented in v0.4.0

| Module | Status | Notes |
|---|---|---|
| HTTP/HTTPS downloader | ✅ Real, verified | Multi-segment, resumable, credential-aware, speed-limited, crash-safe headers |
| FTP downloader | ✅ Real | Passive mode, resume-safe `.part` files, progress, cancellation |
| BitTorrent / magnet | ✅ Real | librqbit v8 engine — DHT, tracker, peer-wire, piece verification, seeding |
| Torrent file parsing | ✅ Real | lava_torrent — lists files before download, per-file selection |
| Torrent file creation | ✅ Real | Build a `.torrent` from a local path/folder |
| Scheduler | ✅ Real | Concurrency-limited queue, FTP + HTTP + Torrent all dispatched uniformly |
| Browser extension listener | ✅ Real | `tiny_http` on port 9999 — `/health` + `POST /downloads`; extension detects running app correctly |
| Streaming server | ✅ Real | Port 47811, HTTP Range (206) for in-app `<video>`/`<audio>` seeking |
| RSS manager | ✅ Real | Feed polling, per-feed timers, RSS 2.0 + Atom, triggers scheduler directly |
| Settings | ✅ Real | Full schema, persisted to OS app-config dir, live snapshot for closures |
| Security scanner | ✅ Real | Auto-runs Windows Defender after every completed download |
| IP blocklist | ✅ Real | Loaded from `ipBlocklistUrl` at startup |
| Web grabber | ✅ Real | Link extraction from a page, exact shape `app.js` expects |
| Clipboard monitor | ✅ Real | Polls OS clipboard, emits `clipboard-url-detected` |
| License system | ✅ Real | Salted-hash key validation inside the Rust binary (not plaintext JS) |
| Update checker | ✅ Real | GitHub Releases API, version comparison |
| Hot-patch / update apply | ✅ Real | Downloads installer, runs silent NSIS `/S` or `msiexec /qn` |
| System tray | ✅ Real | Show / Quit menu |
| Auto-start | ✅ Real | `tauri-plugin-autostart` |
| Browser extension (Chrome) | ✅ Pre-built | `browser-extension/dist/speusis-chromium.zip` |
| Browser extension (Firefox) | ✅ Pre-built | `browser-extension/dist/speusis-firefox.zip` |
| Plugin manager | ⚠️ Compiles | Not yet wired to a command — foundation is ready |

---

## Project layout

```
Speusis Downloader-tauri-v0.4.0/
├── speusis-core/              # Rust download engine (all protocols, scheduling, events)
│   └── src/
│       ├── http_direct_downloader.rs
│       ├── ftp_downloader.rs
│       ├── torrent_downloader.rs   ← librqbit v8 + lava_torrent
│       ├── scheduler.rs
│       ├── listener.rs             ← port 9999 browser-extension bridge
│       ├── streaming_server.rs     ← port 47811 in-app media streaming
│       ├── rss_manager.rs
│       ├── settings_manager.rs
│       ├── security_scanner.rs
│       ├── ip_blocklist.rs
│       ├── web_grabber.rs
│       ├── update_checker.rs
│       ├── license.rs
│       ├── plugin_manager.rs
│       └── types.rs
├── src-tauri/               # Tauri v2 shell (thin wrappers over speusis-core)
│   └── src/
│       ├── main.rs          # wires everything: EventBus, Scheduler, listener, streaming, tray
│       ├── commands.rs      # all #[tauri::command] handlers
│       └── state.rs         # AppState
├── browser-extension/       # Chrome/Firefox extension source + pre-built ZIPs
│   └── dist/
│       ├── speusis-chromium.zip
│       └── speusis-firefox.zip
├── dist/renderer/           # Your existing renderer (index.html, app.js, styles.css, basket.html)
│   └── downloadManagerBridge.js   # window.downloadManager polyfill for Tauri IPC
└── src/
    └── downloadManagerBridge.js
```

---

## How to build

**Prerequisites:** Rust (stable), Node.js, `tauri-cli` v2

```bash
# Install Tauri CLI
cargo install tauri-cli --version "^2"

# Build the desktop app
cd Speusis Downloader-tauri-v0.4.0
cargo tauri build
```

The installer (NSIS `.exe` or `.msi`) will be in `src-tauri/target/release/bundle/`.

---

## Browser extension

Install directly from the pre-built ZIPs in `browser-extension/dist/`:

- **Chrome/Edge:** load `speusis-chromium.zip` via *chrome://extensions → Load unpacked* (unzip first)
- **Firefox:** load `speusis-firefox.zip` via *about:addons → Install Add-on from File*

The extension posts new downloads to `http://127.0.0.1:9999/downloads`. Speusis Downloader's
`listener.rs` binds that port at startup — the extension correctly shows "Speusis Downloader is
running" only when the desktop app is actually open.

---

## Renderer / frontend

Your existing renderer (`dist/renderer/index.html`, `app.js`, `styles.css`,
`basket.html`) works as-is. The `downloadManagerBridge.js` shim provides
`window.downloadManager` over Tauri IPC — no changes to your `app.js` needed.

---

## Key fixes in v0.4.0

- **Crash fix:** `HeaderName::from_static` no longer called with mixed-case strings —
  the panic that took down the previous build is gone.
- **FTP:** fully implemented with passive mode, SIZE, progress, cancellation, and
  resume-safe `.part` finalization.
- **BitTorrent:** real engine using librqbit v8 (DHT, tracker, peer-wire, piece
  verification, seeding) — previously a stub returning errors.
- **Browser extension bridge:** the listener was missing entirely before v0.4.0;
  the extension always reported "Speusis Downloader is not running" even with the app open.
- **Streaming server:** new in v0.4.0 — serves downloaded files with HTTP Range
  support so `<video>`/`<audio>` elements can seek inside the app.
- **Hot-patch system:** downloads and silently runs the new-version installer,
  replacing the previous clean stub.
