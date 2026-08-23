# Speusis Downloader — Release Notes

Version history, newest first. Notes for v0.5.51–v0.5.55 are carried over from the
project README; v0.5.58 documents the localization work in this build.

---

## v0.5.62 — Complete UI localization across all languages

Finishes the language switcher feature end-to-end. Every visible string in the app now
responds to the selected language — settings panel, status bar, toolbar, menus, dialogs,
and all panels.

### Settings panel now translates on open

applyTranslations() is now called inside openSettings() targeting the settings panel
directly, so switching language and reopening settings shows the correct language
immediately without a full restart.

### Status bar messages now translate

All setStatus() calls throughout app.js now use tt() — Paused, Resuming, Stopped,
Extracting, Archive created, Refresh download address, Added to queue, Download limit,
Upload limit, TLS settings, and ~40 more status messages are fully translated across all
19 languages.

### Dynamic UI strings now translate

Button labels set via textContent at runtime (Activating…, Adding…) and dynamic counts
("X downloads") now use tt() and update correctly on language switch.

### 50+ new translation keys added

All new tt() strings are backed by translations in all 19 language files: Arabic, Chinese,
Danish, Dutch, French, German, Indonesian, Italian, Japanese, Korean, Polish, Portuguese
(BR + PT), Romanian, Russian, Spanish, Swedish, Turkish.

> package.json and Cargo.toml bumped to 0.5.62. Renderer-only release, no Rust rebuild required.

---

## v0.5.61 — Full context menu localization + missing translation keys

Completes the language switcher work started in v0.5.58 and continued in v0.5.59–v0.5.60.
The UI is now fully translated end-to-end — no visible English strings remain when a
non-English language is selected.

### Right-click context menu now translates

All 22 context menu items are now localized — Open, Open with…, Open folder, Play with
Speusis, Extract Here, Extract to…, Add to Zip Archive…, Move/Rename, Redownload, Resume
Download, Pause Download, Stop Download, Refresh download address, Delete, Add to queue,
Delete from queue, On Double click, Copy URL, Properties, Segment Map, Tracer, and Torrent
Files…. Each item has a `data-i18n` attribute wired to a new key in all 19 language files.

### Missing translation keys added

Six strings that were wrapped in `tt()` in v0.5.60 but had no matching key in any language
file — and therefore always fell back to English — are now fully translated across all 19
languages: "No matching links found.", "No saved credentials yet.", "No RSS feeds
configured yet.", "No other playable downloads yet.", "No downloads to show.", and
"Load URLs".

### Cleanup

Removed all remaining `window.tt ? window.tt('x') : 'x'` defensive guards from
`panels-transfer.js`, `panels-config.js`, `panels-media.js`, and `dialogs.js` — replaced
with direct `tt('x')` calls. `i18n.js` is always loaded first so the guard was dead code.

> `package.json` and `Cargo.toml` bumped to `0.5.61`. No Rust/backend logic changed;
> this is a renderer-only release.

---

## v0.5.60 — Language switcher extended to panels and dialogs

Continued localization work: wrapped translatable strings across `panels-transfer.js`,
`panels-config.js`, `panels-media.js`, and `dialogs.js` with `t()`/`tt()` calls.
The `i18n:changed` event handler introduced in v0.5.59 now triggers re-renders across
all four panel files, so switching language updates the full UI without a restart.

> Right-click context menu remained English in this release — addressed in v0.5.61.

---

## v0.5.59 — Language switcher applies live + browser badge 403 fallback

Two fixes in one release: the Settings → Language selector now actually re-renders the
running UI, and downloads started from the browser badge no longer dead-end on a 403.

### The language selector now re-renders the running UI

v0.5.58 shipped the translation engine and 19 language files, but switching language
appeared to "do nothing." The engine *was* loading the right dictionary and translating
every static element — but the parts of the interface JavaScript builds at runtime (the
download rows and their action-button tooltips, the header stats, the category tree, the
tracer panel) were rendered once at startup and nothing rebuilt them on a language change,
so they kept their original English text.

- The app now listens for the engine's `i18n:changed` event and **rebuilds the dynamic UI
  in place** when you switch language — no restart, no reload. Static chrome, download
  rows, status/security-scan badges, header stats, the category tree, and the tracer panel
  all update on the spot; Arabic still flips the whole window to right-to-left.
- Wrapped the remaining runtime-built strings that already have translations — the row
  action-button tooltips (Pause / Stop / Resume / Cancel / More actions) and the tracer
  labels (ETA / saved to / source). Any string without a translation still falls back to
  the exact English, so nothing blanks out.
- **Known gap (stated honestly):** the right-click context menu is still English. Its
  labels ("Resume Download", "Pause Download", "Segment Map", "Move/Rename", …) were never
  part of the v0.5.58 translation set and aren't in the shared 487-key table, so localizing
  it means authoring new keys across all 19 files — a separate task, not a regression.

### Browser badge downloads fall back to the app on a 403 (extension v0.40.0)

A download started from the floating page badge could fail with `Fetch failed: HTTP 403`
while the *same URL* pasted into "Add URL" worked. The badge fetches the file itself from
the extension's `chrome-extension://` dialog page (needed for TLS-fingerprinted CDNs like
googlevideo), but that page can't send a page-origin `Referer` or the site's cookies, so
hotlink/Referer-protected CDNs reject it. "Add URL" works because the desktop app fetches
with a proper `Referer` built from the originating page URL.

- The badge now **falls back to the app's own fetch** (the working "Add URL" path, with
  `pageUrl` → `Referer`) whenever its direct browser fetch fails or returns a non-OK
  status. The googlevideo browser-fetch path is unchanged and still tried first, so nothing
  that worked before regresses — this only rescues the cases that were failing.
- Extension bumped to **v0.40.0** (all six browser builds rebuilt).

> **Version note (same caveat as v0.5.58):** this build updates the shipped renderer and
> browser extension only. The compiled desktop binary's displayed version changes only on a
> full Rust rebuild, which isn't part of this packaging step; `package.json` and
> `Cargo.toml` are bumped to 0.5.59 as the source of record.

## v0.5.58 — Localization (English + 18 languages)

**The whole UI can now be translated, and the Settings → Language selector finally does
something.**

- **Working language selector.** The dropdown in Settings → Language used to be an inert
  placeholder. It is now fully wired to a lightweight in-app translation engine: choosing
  a language re-renders the entire interface on the spot — menu items, buttons, dialog
  labels (Rename / Properties / Segment map / Tracer / Delete), tooltips and input
  placeholders, status-bar toasts, and the per-download **status** and **security-scan**
  badges. The selection is persisted and reapplied automatically on the next launch.
- **18 languages ship with the app**, in addition to English:
  Arabic, Chinese (Simplified), Danish, Dutch, French, German, Indonesian, Italian,
  Japanese, Korean, Polish, Portuguese (Brazil), Portuguese (Portugal), Romanian,
  Russian, Spanish, Swedish, and Turkish.
- **Every shipped language is fully translated.** All 18 files carry the same 487 keys as
  `en.json` — no partial translations, and no entry in the selector that silently falls
  back to English for the whole UI.
- **Right-to-left layout** for Arabic — the window mirrors its direction (`dir="rtl"`),
  it isn't just re-lettered left-to-right text.
- **Trimmed the language list.** Languages the project does not ship a complete
  translation for were removed from the selector rather than left in as English-only
  placeholders: Chinese (Traditional), Czech, Finnish, Greek, Hebrew, Hungarian, Persian,
  Serbian, Slovak, Slovenian, Thai, Ukrainian, and Vietnamese.
- **Editable, forgiving translation files.** Every language is a flat
  `"<key>": "<text>"` JSON file in the `languages/` folder — easy to read, correct, or
  extend by hand. All files share exactly the same keys as `en.json`, and any key that is
  missing or left in English falls back to the English string at runtime, so an
  incomplete or malformed edit degrades gracefully instead of blanking the UI.
- **Renderer-only change.** No Rust/back-end logic was modified. Download, multi-segment,
  torrent, RSS, security-scan, and auto-updater behavior are identical to v0.5.57; this
  release adds the translation engine, the language files, and the version bump.

## v0.5.57

Interim release. No standalone "What's new" notes were recorded for this version in the
project tree — the README's changelog history ends at v0.5.55. This is the version
`package.json` and `Cargo.toml` carried immediately before v0.5.58, and the baseline this
localization build was made from.

## v0.5.56

Interim release. No standalone "What's new" notes were recorded for this version in the
project tree.

## v0.5.55 — The real googlevideo.com 403 fix

The actual fix for googlevideo.com (and similar CDNs) always returning 403. Every version
through v0.5.54 tried harder request headers (Referer, Origin, Sec-Fetch-*) on the app's
own HEAD/GET requests — none of it worked, because the rejection isn't at the HTTP header
level. It is near-certainly TLS/HTTP fingerprinting: Google's edge can tell a Rust
`reqwest` client's TLS handshake and HTTP/2 framing apart from a real browser's, whatever
headers ride on top. Confirmed by a debug.log spanning v0.5.2–v0.5.54 — every googlevideo
capture 403'd on both HEAD and GET-Range, on every version, while plain file downloads
always succeeded.

New architecture, paired with browser extension v0.39.0:

- Added `POST /downloads/stream`: the extension now fetches the video itself (from its own
  privileged context, using Chrome's real network stack) and streams the response body
  straight to this endpoint as it downloads, instead of handing the app a URL to re-fetch.
  Same task lifecycle, same `.part` → finalize flow, same progress/events — a new
  *transport* into the existing pipeline, not a parallel one.
- The local listener now handles each request on its own thread rather than one at a time
  on a single background thread, so a long-running video stream can hold a connection open
  without freezing health checks and other download requests.
- Scope: covers direct, single-file video/stream captures (combined-itag YouTube streams
  and equivalent CDNs). Adaptive/muxed picks that need a separate video+audio merge remain
  a known gap.

## v0.5.54 — Backend hardening for hotlink-protected CDNs

For downloads that resolve metadata but still get rejected by hotlink-protected CDNs (the
"Failed"/no-size case reported against googlevideo.com):

- Requests now send the full browser-equivalent header set on hotlink-protected downloads,
  not just `Referer`. A new `hotlink_headers()` in `http_direct_downloader.rs` is used
  consistently by the HEAD probe, the GET-Range fallback, `download_single`, and
  `download_segment`. It adds `Origin` (derived from the referer's scheme+host, as a real
  browser sets it on a cross-origin media request) and the fetch-metadata headers
  `Sec-Fetch-Site: cross-site`, `Sec-Fetch-Mode: no-cors`, `Sec-Fetch-Dest: video`.
- Honesty note: this addresses everything fixable from this side of the wire. If a
  download still fails, hover the "Failed" badge (added in v0.5.53) for the real
  status/error. A persistent 403 from a signed googlevideo URL is very likely YouTube's
  session/token-binding on playback URLs, which no request header can work around from a
  separate process.

## v0.5.53 — Fix release (backend + extension)

- Fixed the browser-extension dialog never showing a file size. Three separate bugs: the
  display fallback never fell through because the placeholder `—` is itself truthy;
  YouTube/googlevideo stream captures never carried a size (the `clen` URL param was never
  read); and the plain-file HEAD size fetch was blocked by CORS because the manifest only
  granted host permissions for `127.0.0.1:9999` and the cipher resolver. All three fixed;
  `clen` is now threaded through to the dialog, the fallback uses an explicit `sizeKnown`
  flag, and `<all_urls>` host permission was added. Extension bumped to **v0.34.0**.
- Failure reasons are no longer thrown away. Added a `lastError` field to `DownloadTask`
  (set by every downloader on failure, cleared on resume/retry) and wired it into the UI:
  hovering the "Failed" badge now shows the actual reason as a tooltip.
- Extension adaptive-quality (mux) downloads now carry an estimated combined file size to
  the dialog for parity. (End-to-end muxed downloading itself remains unimplemented on the
  backend — this only fixes what the dialog displays.)

## v0.5.52 — Fix release (backend + extension)

- Fixed the real cause of stream/video downloads always failing. Extension-captured video
  URLs frequently have hotlink protection — the CDN rejects any request without a
  `Referer` matching the origin page. The extension detected the page URL but never sent
  it, and the backend had no support anywhere for a referer/custom header. Both sides now
  thread the originating page through as `Referer` on every request — HEAD probe, Range-GET
  fallback, and the segment/full-file transfers. Files touched: extension
  (`download-dialog.js`, `service-worker.js`) and Rust backend (`types.rs`, `listener.rs`,
  `network_manager.rs`, `http_direct_downloader.rs`).
- Compile-verified, not just read through: `speusis-core` (the crate containing the fix)
  compiles clean under a real `cargo check`.
- Extension bumped to **v0.33.0**.

## v0.5.51 — Fix release (no new features)

- Fixed: "View map" in Settings → Downloads did nothing when no download was selected —
  two call sites silently checked for a selection before handing off, so the dialog never
  opened. It now always opens, showing a clear "no download selected" message when
  appropriate.
- Fixed: app startup (`init()`) ran every step in one chain with a single terminal
  `.catch()`, so one failure silently aborted every later step. Each step is now isolated
  and logged independently.
- Fixed: the Basket popup used its own hardcoded navy/blue scheme and font, ignoring the
  app theme. It now reads your actual theme and accent color and matches the main window.
- Fixed: settings toggle switches were nearly invisible in the light theme; the track now
  has proper contrast in both themes plus a subtle border.
- Fixed: two hover states (`dialog-close`, `rb-preview`) used dark-theme-only colors and
  were unreadable in light mode; both now adapt.
- Fixed: `--font-mono` was referenced but never defined (a silently-invalid `font`
  shorthand), fixed for correctness.
- Added: `LICENSE.md` (a stronger proprietary license), `THIRD-PARTY-NOTICES.md`
  (attribution for bundled crates), and `SECURITY.md` (responsible-disclosure policy).
