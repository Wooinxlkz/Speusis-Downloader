import { useSettings } from "../hooks/useSettings";

function TimeSelect({ hour, minute, onHour, onMinute }) {
  return (
    <div className="flex items-center gap-1">
      <select className="bg-panel2 border border-border rounded px-2 py-1" value={hour} onChange={(e) => onHour(Number(e.target.value))}>
        {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2, "0")}</option>)}
      </select>
      :
      <select className="bg-panel2 border border-border rounded px-2 py-1" value={minute} onChange={(e) => onMinute(Number(e.target.value))}>
        {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => <option key={m} value={m}>{String(m).padStart(2, "0")}</option>)}
      </select>
    </div>
  );
}

export default function SchedulerPanel() {
  const { settings, update } = useSettings();
  if (!settings) return <p className="text-muted">Loading…</p>;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="flex items-center gap-2 cursor-pointer mb-2">
          <input type="checkbox" checked={settings.scheduleEnabled} onChange={(e) => update({ scheduleEnabled: e.target.checked })} />
          Only run downloads during a scheduled window
        </label>
        {settings.scheduleEnabled && (
          <div className="flex items-center gap-4 pl-6">
            <div>
              <div className="text-muted text-[11px] mb-1">Start</div>
              <TimeSelect hour={settings.scheduleStartHour} minute={settings.scheduleStartMinute}
                onHour={(h) => update({ scheduleStartHour: h })} onMinute={(m) => update({ scheduleStartMinute: m })} />
            </div>
            <div>
              <div className="text-muted text-[11px] mb-1">Stop</div>
              <TimeSelect hour={settings.scheduleStopHour} minute={settings.scheduleStopMinute}
                onHour={(h) => update({ scheduleStopHour: h })} onMinute={(m) => update({ scheduleStopMinute: m })} />
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-border pt-3">
        <label className="flex items-center gap-2 cursor-pointer mb-2">
          <input type="checkbox" checked={settings.peakHoursEnabled} onChange={(e) => update({ peakHoursEnabled: e.target.checked })} />
          Limit bandwidth during peak hours
        </label>
        {settings.peakHoursEnabled && (
          <div className="flex flex-col gap-2 pl-6">
            <div className="flex items-center gap-4">
              <div>
                <div className="text-muted text-[11px] mb-1">Peak start</div>
                <select className="bg-panel2 border border-border rounded px-2 py-1" value={settings.peakStartHour} onChange={(e) => update({ peakStartHour: Number(e.target.value) })}>
                  {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2, "0")}:00</option>)}
                </select>
              </div>
              <div>
                <div className="text-muted text-[11px] mb-1">Peak stop</div>
                <select className="bg-panel2 border border-border rounded px-2 py-1" value={settings.peakStopHour} onChange={(e) => update({ peakStopHour: Number(e.target.value) })}>
                  {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2, "0")}:00</option>)}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-[11px]">
                Download limit (KB/s)
                <input type="number" min={0} className="w-20 bg-panel2 border border-border rounded px-2 py-1"
                  value={settings.peakDownloadLimit ? Math.round(settings.peakDownloadLimit / 1024) : 0}
                  onChange={(e) => update({ peakDownloadLimit: Math.max(0, Number(e.target.value) || 0) * 1024 })} />
              </label>
              <label className="flex items-center gap-2 text-[11px]">
                Upload limit (KB/s)
                <input type="number" min={0} className="w-20 bg-panel2 border border-border rounded px-2 py-1"
                  value={settings.peakUploadLimit ? Math.round(settings.peakUploadLimit / 1024) : 0}
                  onChange={(e) => update({ peakUploadLimit: Math.max(0, Number(e.target.value) || 0) * 1024 })} />
              </label>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end pt-2 border-t border-border">
        <button className="rounded border border-border px-3 py-1.5 hover:bg-tb-hover" onClick={() => window.close()}>Close</button>
      </div>
    </div>
  );
}
