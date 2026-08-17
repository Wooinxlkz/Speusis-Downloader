import { useEffect, useState } from "react";
import { api } from "../lib/tauri";

export default function LoginsPanel() {
  const [creds, setCreds] = useState([]);
  const [domain, setDomain] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const load = () => api.getSettings().then((s) => setCreds(s.credentials || [])).catch(() => {});
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!domain.trim() || !username.trim()) return;
    await api.addCredential({ domain: domain.trim(), username: username.trim(), password });
    setDomain(""); setUsername(""); setPassword("");
    load();
  };
  const remove = async (d) => { await api.removeCredential(d); load(); };

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex-1 overflow-auto border border-border rounded">
        {creds.length === 0 && <div className="text-muted text-[11px] p-3">No saved site logins yet.</div>}
        {creds.map((c) => (
          <div key={c.domain} className="flex items-center justify-between px-2 py-1.5 border-b border-border/50">
            <div className="text-[11px]"><strong>{c.domain}</strong> <span className="text-dim">— {c.username}</span></div>
            <button className="text-[11px] text-red-400 hover:underline" onClick={() => remove(c.domain)}>Remove</button>
          </div>
        ))}
      </div>
      <div className="border-t border-border pt-2 flex flex-col gap-2">
        <input className="bg-panel2 border border-border rounded px-2 py-1" placeholder="Domain (e.g. example.com)" value={domain} onChange={(e) => setDomain(e.target.value)} />
        <input className="bg-panel2 border border-border rounded px-2 py-1" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
        <input type="password" className="bg-panel2 border border-border rounded px-2 py-1" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2 pt-2 border-t border-border">
        <button className="rounded border border-border px-3 py-1.5 hover:bg-tb-hover" onClick={() => window.close()}>Close</button>
        <button className="rounded bg-accent text-bg px-3 py-1.5 font-semibold" onClick={add}>Add Login</button>
      </div>
    </div>
  );
}
