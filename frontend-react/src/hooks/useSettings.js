import { useEffect, useState, useCallback } from "react";
import { api } from "../lib/tauri";

export function useSettings() {
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.getSettings().then((s) => { if (!cancelled) setSettings(s); }).catch(() => {});
    const unlisten = api.onSettingsUpdated((updated) => setSettings(updated));
    return () => { cancelled = true; unlisten(); };
  }, []);

  // Every window applies theme/accent to its own <body> the moment settings
  // change - this is the fix for the old cross-window theme bug: settings
  // changed from any single window (e.g. the Options panel) now broadcast
  // via the "settings-updated" event above, so every open window (main +
  // every dialog) re-applies it, not just whichever one you changed it from.
  useEffect(() => {
    if (!settings) return;
    const sysDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    const resolved = settings.themeMode === "system" ? (sysDark ? "dark" : "light") : settings.themeMode;
    document.body.dataset.theme = resolved || "dark";
    document.body.dataset.accent = settings.accentColor || "slate";
  }, [settings]);

  const update = useCallback(async (patch) => {
    const updated = await api.updateSettings(patch);
    setSettings(updated);
    return updated;
  }, []);

  return { settings, update };
}
