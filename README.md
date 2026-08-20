# Speusis Downloader

**A native desktop download manager — Tauri v2 / Rust, HTTP, FTP, and BitTorrent in one app, with a matching browser extension.**

`v0.5.53` · Windows-first (NSIS/MSI installer) · Rust core + Tauri shell + JS renderer

[![License: Proprietary](https://img.shields.io/badge/license-proprietary-red.svg)](./LICENSE.md)
[![Version](https://img.shields.io/badge/version-0.5.53-blue.svg)](#)
[![Platform](https://img.shields.io/badge/platform-Windows-lightgrey.svg)](#)

> **This is proprietary, source-available software.** The code lives in a public GitHub
> repository so it can be reviewed, but visibility is not a license. See
> [`LICENSE.md`](./LICENSE.md) before you install, copy, modify, or distribute anything from
> this repository.

---

## Table of contents

- [What's new in v0.5.53](#whats-new-in-v0553)
- [What's new in v0.5.52](#whats-new-in-v0552)
- [What's new in v0.5.51](#whats-new-in-v0551)
- [What Speusis is](#what-speusis-is)
- [Feature matrix](#feature-matrix)
- [Architecture](#architecture)
- [Project layout](#project-layout)
- [Getting started](#getting-started)
- [Browser extension](#browser-extension)
- [Configuration](#configuration)
- [Licensing / activation](#licensing--activation)
- [Security model — read this before you rely on it](#security-model--read-this-before-you-rely-on-it)
- [Known limitations](#known-limitations)
- [Roadmap](#roadmap)
- [Legal](#legal)
- [Support](#support)

---

## What's new in v0.5.53

Fix release, backend + browser extension:

- **Fixed the browser extension dialog never showing a file size.** Three separate bugs:
  the display fallback (`fileSize.textContent || "Stream"`) never fell through because the
  placeholder text (`—`) is itself a non-empty, truthy string; YouTube/googlevideo stream
  captures never carried a size at all (`interceptor.js` never read the `clen` query param
  that Google puts right in the URL); and the plain-file size fetch (`fetchFileSize`'s HEAD
  request) was blocked by CORS for almost every site, since `manifest.json` only granted
  host permissions for `127.0.0.1:9999` and the cipher resolver. All three fixed:
  `clen` is now extracted and threaded through `content.js` → `service-worker.js` → the
  dialog; the display fallback uses an explicit `sizeKnown` flag instead of testing
  `textContent`; and `<all_urls>` host permission was added so the CORS HEAD fetch can
  actually succeed. Extension bumped to **v0.34.0**.
- **Failure reasons are no longer thrown away.** A download's error was previously only
  ever emitted as a one-shot `DownloadFailed` event and written to `debug.log` — once a
  task sat in the list as "Failed", there was no way to see why without digging through
  the log file. Added a `lastError` field to `DownloadTask` (set by every downloader —
  HTTP, FTP, torrent — on failure, cleared on resume/retry) and wired it into the UI:
  hovering the "Failed" badge on a download now shows the actual reason (HTTP status,
  network error, etc.) as a tooltip.
- Extension mux (adaptive-quality, e.g. 1080p/4K) downloads now carry an estimated
  combined file size (video-only + audio-only) through to the dialog as well, for parity
  with the size fix above. Note: end-to-end muxed downloading itself is still not
  implemented on the backend (see Known limitations) — this only fixes what the dialog
  displays for those entries.

## What's new in v0.5.52

Fix release, backend + browser extension:

- **Fixed the real cause of stream/video downloads always failing.** Extension-captured
  video/stream URLs (HLS segments, DASH manifests, CDN video files) very often have
  hotlink protection — the CDN rejects the request unless it carries a `Referer` header
  matching the page it came from. The extension detected the page URL but never actually
  sent it anywhere, and the backend had **no support anywhere** for a referer or custom
  header on any request — not in the listener's JSON, not in `DownloadRequest`, not in the
  HTTP client. The result: every such download's metadata probe (HEAD, then a Range-GET
  fallback) got rejected with no Referer, and the task was marked **Failed** instantly
  with an unresolvable size — exactly the "download started but instantly shows Failed"
  symptom. Confirmed with a real compile (see below), not just read through: both the
  browser extension (`download-dialog.js`, `service-worker.js`) and the desktop app's Rust
  backend (`types.rs`, `listener.rs`, `network_manager.rs`, `http_direct_downloader.rs`)
  now thread the originating page through as `Referer` on every request for the download
  — the HEAD probe, the Range-GET fallback, and the actual segment/full-file transfers.
- **Compile-verified, not just read through.** Installed a Rust 1.75 toolchain in the
  build environment (working around this environment's dependency-resolution ceiling by
  pinning ~15 transitive crates to MSRV-compatible versions) and ran a real `cargo check`
  — `speusis-core`, the crate containing every line of the fix, compiles clean. `src-tauri`
  hits the same toolchain ceiling via Tauri's own much larger dependency tree and wasn't
  independently compiled; its changes are the same mechanical `referer: None` addition
  already verified to compile in `speusis-core`.
- Extension bumped to **v0.33.0** (was v0.32.0) to reflect this fix.

## What's new in v0.5.51

Fix release, no new features:

- **Fixed:** "View map" in Settings → Downloads did nothing when no download was
  selected. Two separate call sites were both silently checking for a selection before
  handing off to the segment-map dialog, so it never opened — no error, no feedback,
  nothing. Both are fixed; the dialog now always opens, showing a clear "no download
  selected" message when that's the case instead of doing nothing.
- **Fixed:** app startup (`init()`) used to run every step — settings, category tree,
  download list, window setup, speed chart, update banner, clipboard monitor — in one
  chain with a single empty `.catch(() => {})` at the end. One failure anywhere silently
  aborted every step after it, with no logging. Each step is now isolated and logged
  independently, so a problem in one (say, the clipboard monitor) can no longer take the
  download list down with it.
- **Fixed:** the Basket popup used its own hardcoded navy/blue color scheme and a
  different font, completely disconnected from the rest of the app and blind to your
  theme/accent settings. It now reads your actual theme (dark/light) and accent color
  from Settings and renders using the same design language as the main window.
- **Fixed:** settings toggle switches were nearly invisible in the light theme (white
  knob on a near-white track). Toggle track now uses proper contrast in both themes, plus
  a subtle border so the control reads clearly at a glance.
- **Fixed:** two hover states (`dialog-close`, `rb-preview`) used colors hardcoded to the
  dark theme, making them unreadable in light mode. Both now adapt correctly.
- **Fixed:** a CSS custom property (`--font-mono`) was referenced in two places but never
  actually defined — a silently-invalid `font` shorthand rule, no visible symptom, fixed
  for correctness.
- **Added:** `LICENSE.md` — a substantially stronger proprietary software license
  (ownership, trade secrets, anti-circumvention, liability, indemnification — see
  [Legal](#legal)), replacing the previous minimal installer-only license text as the
  governing agreement.
- **Added:** [`THIRD-PARTY-NOTICES.md`](./THIRD-PARTY-NOTICES.md) — attribution for the
  open-source crates bundled inside the app (all permissive MIT/Apache-2.0, no copyleft).
- **Added:** [`SECURITY.md`](./SECURITY.md) — a responsible-disclosure policy for
  reporting vulnerabilities privately instead of via public issues.

---

## What Speusis is

Speusis Downloader is an IDM-style hybrid download manager: one desktop app that handles
direct HTTP/HTTPS downloads, FTP transfers, and BitTorrent/magnet links through a single
scheduler and UI, with a browser extension that hands off downloads from the page you're
on. The desktop app is a **Tauri v2** shell around a standalone Rust engine
(`speusis-core`) — the protocol handling, scheduling, RSS polling, security scanning, and
license validation all run as native compiled code, not in the renderer's JavaScript.

It's built as a full replacement for the Electron/JS version it was ported from: every
subsystem below is a real, working implementation against the actual renderer
(`dist/renderer/*`), not a stub that only satisfies the UI's expected shape.

## Feature matrix

| Module | Status | Detail |
|---|---|---|
| HTTP/HTTPS downloader | ✅ Real | Multi-segment, resumable, credential-aware, speed-limited, crash-safe header handling |
| FTP downloader | ✅ Real | Passive mode, `SIZE`-based resume, resume-safe `.part` finalization, progress + cancellation |
| BitTorrent / magnet | ✅ Real | [`librqbit`](https://crates.io/crates/librqbit) v8 — DHT, tracker, peer-wire protocol, piece verification, seeding |
| Torrent file parsing | ✅ Real | [`lava_torrent`](https://crates.io/crates/lava_torrent) — lists files before download, per-file selection |
| Torrent file creation | ✅ Real | Build a `.torrent` from a local file/folder |
| Archive manager (v0.5.50) | ✅ Real | ZIP read/write, TAR/TAR.GZ read, pure-Rust deflate backend (no system 7z/unzip dependency). RAR and 7z are **not** supported yet — no free extraction crate exists for RAR, 7z is planned |
| Scheduler | ✅ Real | Concurrency-limited queue; HTTP, FTP, and torrent tasks dispatched uniformly |
| Browser extension bridge | ✅ Real | Local `tiny_http` listener on `127.0.0.1:9999` — `/health` + `POST /downloads` |
| Streaming server | ✅ Real | `127.0.0.1:47811`, RFC 7233 byte-range (`206 Partial Content`) support for in-app `<video>`/`<audio>` seeking on partially-downloaded files |
| RSS manager | ✅ Real | Per-feed poll timers, RSS 2.0 + Atom, feeds new items directly into the scheduler |
| Settings | ✅ Real | Full schema, persisted to the OS app-config directory, live snapshot shared across closures |
| Security scanner | ✅ Real | Runs Windows Defender against every completed download automatically |
| IP blocklist | ✅ Real | Loaded from a configurable `ipBlocklistUrl` at startup |
| Web grabber | ✅ Real | Extracts downloadable links from a page in the exact shape the renderer expects |
| Clipboard monitor | ✅ Real | Polls the OS clipboard, emits `clipboard-url-detected` events |
| License activation | ✅ Real | Salted-hash key validation compiled into the Rust binary, device-locked plans tied to a per-install device ID — see [Security model](#security-model--read-this-before-you-rely-on-it) |
| Update checker | ✅ Real | GitHub Releases API polling, semver comparison |
| Hot-patch / update apply | ✅ Real | Downloads the new installer, runs it silently (`/S` for NSIS, `/qn` for MSI) |
| System tray | ✅ Real | Show / Quit menu |
| Auto-start | ✅ Real | `tauri-plugin-autostart` |
| Browser extension — Chrome/Edge | ✅ Pre-built | `browser-extension/dist/speusis-chromium.zip` |
| Browser extension — Firefox | ✅ Pre-built | `browser-extension/dist/speusis-firefox.zip` |
| Plugin manager | ⚠️ Partial | Manifest loading, permission checks, handler registry, and the `PluginAPI` surface are ported and compile. `load()` deliberately returns "not implemented" rather than executing plugin code — the original relies on Node's `vm` module to sandbox-run arbitrary plugin JS, which has no direct Rust equivalent. Next step is either embedding a JS engine (`boa`/`deno_core`) or requiring compiled Rust/WASM plugins instead |

## Architecture

```
Browser extension (Chrome/Firefox)
        │  POST http://127.0.0.1:9999/downloads
        ▼
┌───────────────────────────────────────────────────────────┐
│  src-tauri  (Tauri v2 shell)                                │
│  ├─ main.rs        wires EventBus, Scheduler, listener,     │
│  │                  streaming server, system tray            │
│  ├─ commands.rs     ~50 #[tauri::command] handlers exposed   │
│  │                  to the renderer over Tauri IPC           │
│  └─ state.rs        shared AppState                          │
└───────────────────────────────────────────────────────────┘
        │  calls into
        ▼
┌───────────────────────────────────────────────────────────┐
│  speusis-core  (protocol- and platform-agnostic Rust engine)│
│  http_direct_downloader · ftp_downloader · torrent_downloader│
│  archive_manager · scheduler · rss_manager · listener        │
│  streaming_server · settings_manager · security_scanner      │
│  ip_blocklist · web_grabber · update_checker · license       │
│  plugin_manager · event_bus · network_manager · file_manager │
└───────────────────────────────────────────────────────────┘
        ▲
        │  Tauri IPC (window.downloadManager)
┌───────────────────────────────────────────────────────────┐
│  dist/renderer  (HTML/CSS/JS UI — unchanged from the         │
│  original app)                                                │
│  downloadManagerBridge.js translates window.downloadManager  │
│  calls into Tauri `invoke()`, so the renderer needed no       │
│  rewrite to move off Electron                                 │
└───────────────────────────────────────────────────────────┘
```

## Project layout

```
speusis/
├── speusis-core/                # Protocol-agnostic Rust engine
│   └── src/
│       ├── http_direct_downloader.rs
│       ├── ftp_downloader.rs
│       ├── torrent_downloader.rs    # librqbit v8 + lava_torrent
│       ├── archive_manager.rs       # ZIP/TAR(.GZ) extraction + creation
│       ├── scheduler.rs
│       ├── listener.rs              # port 9999 — browser-extension bridge
│       ├── streaming_server.rs      # port 47811 — in-app media streaming
│       ├── rss_manager.rs
│       ├── settings_manager.rs
│       ├── security_scanner.rs
│       ├── ip_blocklist.rs
│       ├── web_grabber.rs
│       ├── update_checker.rs
│       ├── license.rs
│       ├── plugin_manager.rs
│       ├── network_manager.rs
│       ├── file_manager.rs
│       ├── event_bus.rs
│       ├── debug_log.rs
│       └── types.rs
│   └── examples/
│       ├── genkey.rs             # license key generation (dev/ops use only)
│       └── checkkey.rs           # license key validation (dev/ops use only)
├── src-tauri/                    # Tauri v2 shell — thin wrappers over speusis-core
│   ├── src/
│   │   ├── main.rs
│   │   ├── commands.rs
│   │   └── state.rs
│   ├── capabilities/default.json # Tauri v2 permission scoping
│   ├── icons/                    # App + installer icons
│   ├── installer-hooks.nsh       # NSIS custom install/uninstall steps
│   ├── license.txt                # Installer-time license text shown by NSIS (see LICENSE.md for the full agreement)
│   └── tauri.conf.json
├── browser-extension/            # Chrome/Firefox extension source
│   ├── manifest.json / manifest.firefox.json
│   ├── service-worker.js · content.js · inject.js · interceptor.js
│   ├── popup.html · download-dialog.html/js
│   └── dist/
│       ├── speusis-chromium.zip  # pre-built, ready to load unpacked
│       └── speusis-firefox.zip   # pre-built, ready to install
├── dist/renderer/                 # UI: index.html, app.js, styles.css, basket.html
│   └── downloadManagerBridge.js  # window.downloadManager → Tauri IPC shim
├── src/downloadManagerBridge.js  # source copy of the bridge (mirrored into dist/)
├── README.md
├── LICENSE.md
├── THIRD-PARTY-NOTICES.md
└── SECURITY.md
```

## Getting started

### Prerequisites

- **Rust** (stable toolchain)
- **Node.js** (for the Tauri CLI and any renderer tooling)
- **Tauri CLI v2**

```bash
cargo install tauri-cli --version "^2"
```

### Build the desktop app

```bash
git clone https://github.com/Wooinxlkz/Speusis-Downloader.git
cd Speusis-Downloader
cargo tauri build
```

The installer (`.exe` NSIS or `.msi`) lands in `src-tauri/target/release/bundle/`.

### Run in dev mode

```bash
cargo tauri dev
```

## Browser extension

Load the pre-built extension directly — no build step required:

- **Chrome / Edge:** unzip `browser-extension/dist/speusis-chromium.zip`, then
  `chrome://extensions` → enable *Developer mode* → **Load unpacked** → select the
  unzipped folder.
- **Firefox:** `about:addons` → gear icon → **Install Add-on From File** → select
  `speusis-firefox.zip` directly.

The extension talks to the desktop app over `http://127.0.0.1:9999`. `listener.rs` binds
that port at app startup, so the extension only reports "Speusis Downloader is running"
when the desktop app is actually open — there's no polling against a fake/always-on
state.

To rebuild the extension packages from source:

```bash
node browser-extension/build-extension.cjs
```

## Configuration

Settings persist to the OS-standard app-config directory, covering:

- Default download directory, per-download-type overrides
- Global and per-task speed limits
- Site credentials (FTP/HTTP auth)
- Remote listener host/port and remote-access toggle
- IP blocklist source URL
- RSS feed list and poll intervals
- Auto-start on login

All of it round-trips through `settings_manager.rs` and the `settings_*` Tauri commands —
there's no separate config format the UI and the backend can drift out of sync on.

## Licensing / activation

Speusis ships with three plan tiers — `Trial`, `Monthly`, `Lifetime` — validated by
`speusis-core/src/license.rs`. Two admin-only binaries are provided for key management
and are **not** meant to ship to end users:

```bash
cargo run --example genkey   -p speusis-core   # issue a key
cargo run --example checkkey -p speusis-core   # validate a key offline
```

See [Security model](#security-model--read-this-before-you-rely-on-it) below for exactly
what this protects against and what it doesn't.

## Security model — read this before you rely on it

Being direct here, because overselling this is how people get burned:

- License keys are checksummed against name + email using a salted SHA-256 hash and
  validated **inside the compiled Rust binary**, with device-locked plans tied to a
  per-install device-ID file. That's a real improvement over the previous Electron
  version, where the only valid key was a literal hardcoded string readable via
  view-source, and "registered" status was one unauthenticated `localStorage.setItem()`
  call away from being spoofed by anyone with devtools open.
- It is **not** uncrackable. No purely local, offline license check ever is, absent a
  server-side activation call on every launch. Reverse-engineering a compiled binary is a
  meaningfully higher bar than reading plaintext JS, but it is not an unbreakable one —
  don't market it, sell it, or rely on it as such.
- The security scanner invokes Windows Defender after each completed download as a
  convenience layer, not a guarantee of file safety — see [`LICENSE.md`](./LICENSE.md) §6 for
  the user-facing disclaimer this maps to.

## Known limitations

- **Windows-only** in this release (NSIS/MSI packaging, Windows Defender integration for
  the security scanner). macOS/Linux packaging is not currently configured in
  `tauri.conf.json`.
- **RAR / 7z** are not extractable by the built-in Archive Manager — no free/open
  extraction crate exists for RAR, and 7z support is planned but not shipped in v0.5.50.
- **Plugin system** loads manifests and enforces permissions but does not execute plugin
  code yet (see the feature matrix above).
- The listener is local-loopback (`127.0.0.1`) only unless `remote_access` is explicitly
  enabled in settings.
- **Muxed (adaptive-quality) YouTube downloads don't work end-to-end yet.** Everything
  above the four legacy "combined" itags (720p/360p/240p/144p) requires downloading a
  separate video-only and audio-only stream and merging them — the extension detects and
  labels these, but `IncomingDownload` in `listener.rs` doesn't carry `needsMux` /
  `videoUrl` / `audioUrl` yet, and there's no muxing step (e.g. ffmpeg) in the backend.
  Picking one of these qualities currently fails client-side with "URL is empty" before it
  ever reaches the app. Only the four combined itags are actually downloadable today.

## Roadmap

- [ ] 7z archive support
- [ ] Plugin execution (JS engine embed or WASM-only plugin model — decision pending)
- [ ] macOS/Linux build targets
- [ ] Server-side license activation option for higher-assurance deployments

## Legal

Speusis Downloader is **proprietary, source-available software** — the repository being
public does not make it open source, and no license to use, copy, modify, or redistribute
it is granted by virtue of being able to read the code. Full terms, including the
end-user license agreement, intellectual-property notices, and usage restrictions, are in
[`LICENSE.md`](./LICENSE.md). The `src-tauri/license.txt` file is the condensed version
shown inside the installer at install time; **`LICENSE.md` is the governing agreement**
and takes precedence if the two ever conflict. Open-source components bundled inside the
app are covered separately in [`THIRD-PARTY-NOTICES.md`](./THIRD-PARTY-NOTICES.md), and
[`SECURITY.md`](./SECURITY.md) covers how to report a vulnerability.

By downloading, building, installing, or using any part of this repository, you agree to
the terms in `LICENSE.md`.

## Support

Open an issue on this repository for bugs or feature requests. For licensing, permissions
requests, or anything covered by the license agreement, contact the repository owner directly through
GitHub.
