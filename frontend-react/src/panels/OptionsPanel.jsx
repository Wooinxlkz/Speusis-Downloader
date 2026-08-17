import { useState } from "react";
import { useSettings } from "../hooks/useSettings";
import { api } from "../lib/tauri";

const TABS = ["General", "Downloads", "Connection", "Security", "Advanced"];

const ACCENTS = ["blue", "green", "purple", "orange", "red", "teal", "slate"];

function Row({ label, children }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <label className="w-32 shrink-0 text-muted">{label}</label>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange, children }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} className="accent-accent" />
      {children}
    </label>
  );
}

function Heading({ children }) {
  return <div className="mt-3 mb-1 text-[11px] font-semibold uppercase tracking-wide text-accent">{children}</div>;
}

function Note({ children }) {
  return <div className="mt-1 text-[11px] text-dim">{children}</div>;
}

export default function OptionsPanel() {
  const { settings, update } = useSettings();
  const [tab, setTab] = useState("General");

  if (!settings) return <p className="text-muted">Loading…</p>;

  const set = (patch) => update(patch);

  return (
    <div className="flex h-full flex-col">
      <div className="flex gap-1 border-b border-border pb-2 mb-3">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-[12px] rounded-t ${tab === t ? "text-accent border-b-2 border-accent font-semibold" : "text-muted hover:text-text"}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto pr-1">
        {tab === "General" && (
          <>
            <Heading>Appearance</Heading>
            <Row label="Theme">
              <select className="bg-panel2 border border-border rounded px-2 py-1" value={settings.themeMode} onChange={(e) => set({ themeMode: e.target.value })}>
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </Row>
            <Row label="Accent">
              <select className="bg-panel2 border border-border rounded px-2 py-1 capitalize" value={settings.accentColor} onChange={(e) => set({ accentColor: e.target.value })}>
                {ACCENTS.map((a) => <option key={a} value={a} className="capitalize">{a[0].toUpperCase() + a.slice(1)}</option>)}
              </select>
            </Row>
            <Heading>Startup &amp; window</Heading>
            <Row label="Auto-start">
              <Toggle checked={settings.autoStartWithSystem} onChange={async (v) => { await api.setAutoStart(v); set({ autoStartWithSystem: v }); }}>
                Start Speusis with Windows
              </Toggle>
            </Row>
            <Row label="Minimize to tray">
              <Toggle checked={settings.minimizeToTray} onChange={(v) => set({ minimizeToTray: v })}>
                Hide to system tray on close/minimize
              </Toggle>
            </Row>
          </>
        )}

        {tab === "Downloads" && (
          <>
            <Heading>File handling</Heading>
            <Row label="File routing">
              <Toggle checked={settings.fileTypeRouting} onChange={(v) => set({ fileTypeRouting: v })}>
                Sort downloads into subfolders by type
              </Toggle>
            </Row>
            <Row label="Max retries">
              <input type="number" min={0} max={20} className="w-20 bg-panel2 border border-border rounded px-2 py-1"
                value={settings.maxRetries} onChange={(e) => set({ maxRetries: Math.max(0, Math.min(20, Number(e.target.value) || 0)) })} />
            </Row>
            <Note>Completed files stay in their original location. Routing only affects new downloads.</Note>

            <Heading>Performance</Heading>
            <Row label="Max concurrent">
              <input type="number" min={1} max={20} className="w-20 bg-panel2 border border-border rounded px-2 py-1"
                value={settings.maxConcurrentDownloads} onChange={(e) => set({ maxConcurrentDownloads: Math.max(1, Math.min(20, Number(e.target.value) || 1)) })} />
            </Row>
            <Row label="Segments/file">
              <input type="number" min={1} max={32} className="w-20 bg-panel2 border border-border rounded px-2 py-1"
                value={settings.defaultSegments} onChange={(e) => set({ defaultSegments: Math.max(1, Math.min(32, Number(e.target.value) || 1)) })} />
            </Row>
            <Note>Max concurrent applies immediately. Segments apply to new downloads only.</Note>

            <Heading>Paths</Heading>
            <Row label="Download dir">
              <div className="flex gap-2 flex-1">
                <input type="text" readOnly className="flex-1 bg-panel2 border border-border rounded px-2 py-1" value={settings.downloadDir || ""} />
                <button
                  className="rounded border border-border px-2 py-1 hover:bg-tb-hover"
                  onClick={async () => { const dir = await api.chooseDownloadDir(); if (dir) set({ downloadDir: dir }); }}
                >
                  Browse…
                </button>
              </div>
            </Row>
          </>
        )}

        {tab === "Connection" && (
          <>
            <Heading>Bandwidth</Heading>
            <Row label="Download limit">
              <input type="number" min={0} className="w-24 bg-panel2 border border-border rounded px-2 py-1"
                value={settings.downloadLimit ? Math.round(settings.downloadLimit / 1024) : 0}
                onChange={(e) => set({ downloadLimit: Math.max(0, Number(e.target.value) || 0) * 1024 })} />
              <span className="text-dim text-[11px] ml-2">KB/s (0 = unlimited)</span>
            </Row>
            <Row label="Upload limit">
              <input type="number" min={0} className="w-24 bg-panel2 border border-border rounded px-2 py-1"
                value={settings.uploadLimit ? Math.round(settings.uploadLimit / 1024) : 0}
                onChange={(e) => set({ uploadLimit: Math.max(0, Number(e.target.value) || 0) * 1024 })} />
              <span className="text-dim text-[11px] ml-2">KB/s (0 = unlimited)</span>
            </Row>

            <Heading>Listener &amp; access</Heading>
            <Row label="Port">
              <input type="number" min={1024} max={65535} className="w-24 bg-panel2 border border-border rounded px-2 py-1"
                value={settings.listenerPort} onChange={(e) => set({ listenerPort: Number(e.target.value) || settings.listenerPort })} />
            </Row>
            <Row label="Remote access">
              <Toggle checked={settings.remoteAccess} onChange={(v) => set({ remoteAccess: v })}>
                Accept connections from other devices (0.0.0.0)
              </Toggle>
            </Row>
            <Note>Port and remote access changes take effect after restarting Speusis.</Note>

            <Heading>Network protection</Heading>
            <Row label="IP Blocklist">
              <input type="text" placeholder="http://… or local file path (optional)" className="flex-1 bg-panel2 border border-border rounded px-2 py-1"
                value={settings.ipBlocklistUrl || ""} onChange={(e) => set({ ipBlocklistUrl: e.target.value })} />
            </Row>
            <Row label="Invalid TLS">
              <Toggle checked={settings.allowInvalidTls} onChange={(v) => set({ allowInvalidTls: v })}>
                Allow invalid/self-signed certificates
              </Toggle>
            </Row>
          </>
        )}

        {tab === "Security" && (
          <>
            <Heading>Completed file scanning</Heading>
            <Row label="Windows Defender">
              <Toggle checked={settings.scanCompletedFiles} onChange={(v) => set({ scanCompletedFiles: v })}>
                Scan completed files automatically
              </Toggle>
            </Row>
            <Note>Runs after a file finishes downloading. You can disable it anytime.</Note>
            <div className="mt-4 rounded border border-border bg-panel2 p-3">
              <strong className="block mb-1">Safer downloads, fewer surprises</strong>
              <span className="text-muted text-[11px]">Speusis hands completed files to Windows Defender and reports the result beside the download.</span>
            </div>
          </>
        )}

        {tab === "Advanced" && (
          <>
            <Heading>Torrent seeding</Heading>
            <Row label="Seed ratio">
              <input type="number" min={0} step={0.1} className="w-20 bg-panel2 border border-border rounded px-2 py-1"
                value={settings.seedRatio} onChange={(e) => set({ seedRatio: Math.max(0, Number(e.target.value) || 0) })} />
            </Row>
            <Note>Default seeding ratio for new torrents. Existing torrents keep their own setting.</Note>
          </>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-border pt-3 mt-3">
        <span className="text-[11px] text-dim">Changes save automatically</span>
      </div>
    </div>
  );
}
