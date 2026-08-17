import { useEffect, useState } from "react";
import { api } from "../lib/tauri";

export default function RegistrationPanel() {
  const [status, setStatus] = useState(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.getLicenseStatus().then(setStatus).catch(() => {}); }, []);

  const activate = async () => {
    if (!name.trim() || !email.trim() || !key.trim()) return;
    setBusy(true); setError("");
    try {
      const result = await api.activateLicense(name.trim(), email.trim(), key.trim());
      setStatus(result);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  if (status?.plan) {
    return (
      <div className="flex flex-col gap-2">
        <h2 className="font-bold text-accent">Registered</h2>
        <p className="text-[11px]">Licensed to <strong>{status.name}</strong> ({status.email})</p>
        <p className="text-[11px] text-muted">Plan: {status.plan}</p>
        <div className="flex justify-end pt-2 border-t border-border mt-2">
          <button className="rounded border border-border px-3 py-1.5 hover:bg-tb-hover" onClick={() => window.close()}>Close</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted text-[11px]">Enter your license details to register Speusis Downloader.</p>
      <input className="bg-panel2 border border-border rounded px-2 py-1.5" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
      <input className="bg-panel2 border border-border rounded px-2 py-1.5" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input className="bg-panel2 border border-border rounded px-2 py-1.5" placeholder="License key" value={key} onChange={(e) => setKey(e.target.value)} />
      {error && <div className="text-red-400 text-[11px]">{error}</div>}
      <div className="flex justify-end gap-2 mt-2">
        <button className="rounded border border-border px-3 py-1.5 hover:bg-tb-hover" onClick={() => window.close()}>Cancel</button>
        <button disabled={busy} className="rounded bg-accent text-bg px-3 py-1.5 font-semibold disabled:opacity-50" onClick={activate}>
          {busy ? "Activating…" : "Activate"}
        </button>
      </div>
    </div>
  );
}
