# Auto-update dialog (React)

Standalone React source for the "New version of Speusis is available" dialog.
This is the *only* part of the renderer built with React/Vite — the rest of
the app is plain HTML/JS with no bundler, so this lives in its own small
project instead of being folded into it.

## Build

```
npm install
npm run build
```

Outputs a single self-contained `dist/renderer/update-dialog/index.html`
(React/ReactDOM inlined via vite-plugin-singlefile) via `outDir` in
`vite.config.js` — commit that output file, it's what actually ships.

## How it stays in sync with the rest of the app

- **Theme/accent**: links `../styles.css` (the app's real, shared stylesheet)
  at runtime in `main.jsx`, rather than duplicating any CSS. Reads
  `themeMode`/`accentColor` via the same `settings_get` Tauri command the
  main window uses, and listens for the same `settings-updated` event so a
  live theme change while this window is open is reflected immediately.
- **Language**: reads the same `speusis_lang` localStorage key `i18n.js`
  writes (shared across all native panel windows on this app's origin), and
  looks up the `update_now`/`cancel` keys directly from `../languages/<lang>.json`
  — the only two strings the original dialog markup ever had `data-i18n` on.
- **Window chrome/dragging/resizing**: reuses the exact same CSS classes and
  `startDragging()` / `startResizeDragging()` Tauri window APIs every other
  native panel window (Options, RSS, Basket, etc.) already uses.
- **Backend calls**: `settings_get`, `update_get_pending`, `download_add`,
  `update_open_download`, `panel_open`, `panel_close` — same Tauri commands
  `downloadManagerBridge.js` exposes to the vanilla renderer, called directly
  via `window.__TAURI__.core.invoke` (enabled by `withGlobalTauri: true` in
  `tauri.conf.json`, so no `@tauri-apps/api` dependency is needed).
