import { api } from "../lib/tauri";

// Original hand-drawn toolbar icons, ported 1:1 from the old dist/renderer/index.html
// so the toolbar looks identical to the pre-React app instead of using generic
// lucide-react glyphs.
const ICONS = {
  options: (
    <>
      <rect x="9.15" y="0.8" width="1.7" height="2.6" rx="0.5" fill="currentColor" transform="rotate(0 10 10)" />
      <rect x="9.15" y="0.8" width="1.7" height="2.6" rx="0.5" fill="currentColor" transform="rotate(45 10 10)" />
      <rect x="9.15" y="0.8" width="1.7" height="2.6" rx="0.5" fill="currentColor" transform="rotate(90 10 10)" />
      <rect x="9.15" y="0.8" width="1.7" height="2.6" rx="0.5" fill="currentColor" transform="rotate(135 10 10)" />
      <rect x="9.15" y="0.8" width="1.7" height="2.6" rx="0.5" fill="currentColor" transform="rotate(180 10 10)" />
      <rect x="9.15" y="0.8" width="1.7" height="2.6" rx="0.5" fill="currentColor" transform="rotate(225 10 10)" />
      <rect x="9.15" y="0.8" width="1.7" height="2.6" rx="0.5" fill="currentColor" transform="rotate(270 10 10)" />
      <rect x="9.15" y="0.8" width="1.7" height="2.6" rx="0.5" fill="currentColor" transform="rotate(315 10 10)" />
      <circle cx="10" cy="10" r="6.3" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="10" cy="10" r="2.1" fill="none" stroke="currentColor" strokeWidth="1.7" />
    </>
  ),
  logins: (
    <>
      <rect x="3" y="9" width="14" height="9" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M7 9V6a3 3 0 016 0v3" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <circle cx="10" cy="13.5" r="1.4" fill="currentColor" />
    </>
  ),
  folder: <path d="M2 6a2 2 0 012-2h4l2 2h6a2 2 0 012 2v7a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" fill="none" stroke="currentColor" strokeWidth="1.6" />,
  addUrl: (
    <>
      <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <line x1="10" y1="6" x2="10" y2="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="6" y1="10" x2="14" y2="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  torrent: (
    <>
      <circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M10 13.5V8M7 10.5l3 3 3-3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <line x1="6.5" y1="15" x2="13.5" y2="15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </>
  ),
  batch: (
    <>
      <rect x="2" y="3" width="16" height="2.5" rx="1.2" fill="currentColor" />
      <rect x="2" y="8" width="12" height="2.5" rx="1.2" fill="currentColor" />
      <rect x="2" y="13" width="9" height="2.5" rx="1.2" fill="currentColor" />
      <polyline points="15,9 15,17 13,15" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="15,17 17,15" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  grabber: (
    <>
      <circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <line x1="12.2" y1="12.2" x2="17" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <polyline points="8,5.5 8,8 10,8" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" />
    </>
  ),
  basket: (
    <>
      <path d="M4 9h12l-1 8H5L4 9z" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <polyline points="2,9 4,4 8,4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="18,9 16,4 12,4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="10" y1="12" x2="10" y2="14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </>
  ),
  resume: <polygon points="5,3 17,10 5,17" fill="currentColor" />,
  pause: (
    <>
      <rect x="4" y="3" width="4.5" height="14" rx="1.2" fill="currentColor" />
      <rect x="11.5" y="3" width="4.5" height="14" rx="1.2" fill="currentColor" />
    </>
  ),
  stop: <rect x="4" y="4" width="12" height="12" rx="2" fill="currentColor" />,
  stopAll: (
    <>
      <rect x="2" y="4" width="9" height="12" rx="1.5" fill="currentColor" />
      <rect x="12" y="4" width="6" height="12" rx="1.5" fill="currentColor" opacity="0.7" />
    </>
  ),
  delete: (
    <>
      <polyline points="3,6 17,6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <path d="M8 6V4h4v2" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="M5 6l1 11h8l1-11" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
      <line x1="8.5" y1="9" x2="8.5" y2="14" stroke="currentColor" strokeWidth="1.3" />
      <line x1="11.5" y1="9" x2="11.5" y2="14" stroke="currentColor" strokeWidth="1.3" />
    </>
  ),
  deleteCompleted: (
    <>
      <polyline points="3,6 17,6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <path d="M8 6V4h4v2" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="M5 6l1 11h8l1-11" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <polyline points="8,11 10,13 13,9" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  scheduler: (
    <>
      <circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <polyline points="10,5.5 10,10 13,12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />
    </>
  ),
  rss: (
    <>
      <circle cx="5" cy="15" r="2" fill="currentColor" />
      <path d="M3 8.5a8.5 8.5 0 018.5 8.5" stroke="currentColor" strokeWidth="1.7" fill="none" strokeLinecap="round" />
      <path d="M3 4a13 13 0 0113 13" stroke="currentColor" strokeWidth="1.7" fill="none" strokeLinecap="round" />
    </>
  ),
  createTorrent: (
    <>
      <circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M6.5 10.5A3.5 3.5 0 0110 7a3.5 3.5 0 013.5 3.5" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <polyline points="7.5,13 10,10 12.5,13" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  startQueue: (
    <>
      <polygon points="3,3 11,10 3,17" fill="currentColor" />
      <polygon points="10,3 18,10 10,17" fill="currentColor" opacity="0.65" />
    </>
  ),
  stopQueue: (
    <>
      <rect x="4" y="4" width="4" height="12" rx="1" fill="currentColor" />
      <rect x="12" y="4" width="4" height="12" rx="1" fill="currentColor" />
    </>
  ),
  register: <path d="M10 2l2.4 5H18l-4.3 3.2 1.6 5.2L10 12.3l-5.3 3.1 1.6-5.2L2 7h5.6z" fill="currentColor" />,
  help: (
    <>
      <circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M7.8 7.8a2.2 2.2 0 1 1 3.3 1.9c-.7.4-1.1.9-1.1 1.8" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <circle cx="10" cy="14" r="0.9" fill="currentColor" />
    </>
  ),
  about: (
    <>
      <circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <line x1="10" y1="9" x2="10" y2="14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="10" cy="6.5" r="1.3" fill="currentColor" />
    </>
  ),
};

function Btn({ icon, label, onClick }) {
  return (
    <button className="tb-btn" title={label} onClick={onClick}>
      <svg className="tb-icon" viewBox="0 0 20 20">{ICONS[icon]}</svg>
      <span className="tb-label">{label}</span>
    </button>
  );
}

function Sep() {
  return <div className="tb-sep" />;
}

export default function Toolbar({ selectedId, onBulkAction }) {
  const openPanel = (panel) => api.openPanel(panel).catch(() => {});

  const openTorrentFile = async () => {
    try { await api.addTorrentFile(); } catch {}
  };
  const chooseDir = async () => {
    const dir = await api.chooseDownloadDir();
    if (dir) await api.updateSettings({ downloadDir: dir });
  };

  return (
    <div className="toolbar" id="toolbar">
      <Btn icon="options" label="Options" onClick={() => openPanel("settingsPanel")} />
      <Btn icon="logins" label="Logins" onClick={() => openPanel("loginsPanel")} />
      <Btn icon="folder" label="Folder" onClick={chooseDir} />
      <Sep />
      <Btn icon="addUrl" label="Add URL" onClick={() => openPanel("addUrlPanel")} />
      <Btn icon="torrent" label="Torrent" onClick={openTorrentFile} />
      <Btn icon="batch" label="Batch" onClick={() => openPanel("batchPanel")} />
      <Btn icon="grabber" label="Grabber" onClick={() => openPanel("grabberPanel")} />
      <Btn icon="basket" label="Basket" onClick={() => api.openBasket().catch(() => {})} />
      <Sep />
      <Btn icon="resume" label="Resume" onClick={() => onBulkAction("resumeAll")} />
      <Btn icon="pause" label="Pause" onClick={() => selectedId && onBulkAction("pause", selectedId)} />
      <Btn icon="stop" label="Stop" onClick={() => selectedId && onBulkAction("stop", selectedId)} />
      <Btn icon="stopAll" label="Stop All" onClick={() => onBulkAction("stopAll")} />
      <Sep />
      <Btn icon="delete" label="Delete" onClick={() => selectedId && onBulkAction("delete", selectedId)} />
      <Btn icon="deleteCompleted" label="Delete C…" onClick={() => onBulkAction("deleteCompleted")} />
      <Sep />
      <Btn icon="scheduler" label="Scheduler" onClick={() => openPanel("schedulerPanel")} />
      <Btn icon="rss" label="RSS" onClick={() => openPanel("rssPanel")} />
      <Btn icon="createTorrent" label="Mk Torrent" onClick={() => openPanel("createTorrentPanel")} />
      <Sep />
      <Btn icon="startQueue" label="Start Qu…" onClick={() => onBulkAction("resumeAll")} />
      <Btn icon="stopQueue" label="Stop Qu…" onClick={() => onBulkAction("stopQueued")} />
      <div style={{ flex: 1 }} />
      <Sep />
      <Btn icon="register" label="Register" onClick={() => openPanel("registrationPanel")} />
      <Btn icon="help" label="Help" onClick={() => openPanel("helpPanel")} />
      <Btn icon="about" label="About" onClick={() => openPanel("aboutPanel")} />
    </div>
  );
}
