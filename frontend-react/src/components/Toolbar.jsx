import {
  Settings, KeyRound, FolderOpen, Plus, Download as TorrentIcon, ListPlus,
  Search, ShoppingBasket, Play, Pause, Square, StopCircle, Trash2, Trash,
  Clock, Rss, FileSignature, ChevronsRight, ChevronsLeft, Award, HelpCircle, Info,
} from "lucide-react";
import { api } from "../lib/tauri";

function Btn({ icon: Icon, label, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`flex flex-col items-center gap-0.5 rounded px-2 py-1 text-[10px] hover:bg-tb-hover ${danger ? "text-red-400" : "text-text"}`}
    >
      <Icon size={16} strokeWidth={1.6} />
      <span className="max-w-[54px] truncate">{label}</span>
    </button>
  );
}

function Sep() {
  return <div className="mx-1 h-8 w-px bg-border" />;
}

export default function Toolbar({ selectedId, tasks, onBulkAction }) {
  const openPanel = (panel) => api.openPanel(panel).catch(() => {});

  const openTorrentFile = async () => {
    try { await api.addTorrentFile(); } catch {}
  };
  const chooseDir = async () => {
    const dir = await api.chooseDownloadDir();
    if (dir) await api.updateSettings({ downloadDir: dir });
  };

  return (
    <div className="flex items-center border-b border-border bg-toolbar px-2 py-1 overflow-x-auto shrink-0">
      <Btn icon={Settings} label="Options" onClick={() => openPanel("settingsPanel")} />
      <Btn icon={KeyRound} label="Logins" onClick={() => openPanel("loginsPanel")} />
      <Btn icon={FolderOpen} label="Folder" onClick={chooseDir} />
      <Sep />
      <Btn icon={Plus} label="Add URL" onClick={() => openPanel("addUrlPanel")} />
      <Btn icon={TorrentIcon} label="Torrent" onClick={openTorrentFile} />
      <Btn icon={ListPlus} label="Batch" onClick={() => openPanel("batchPanel")} />
      <Btn icon={Search} label="Grabber" onClick={() => openPanel("grabberPanel")} />
      <Btn icon={ShoppingBasket} label="Basket" onClick={() => api.openBasket().catch(() => {})} />
      <Sep />
      <Btn icon={Play} label="Resume" onClick={() => onBulkAction("resumeAll")} />
      <Btn icon={Pause} label="Pause" onClick={() => selectedId && onBulkAction("pause", selectedId)} />
      <Btn icon={Square} label="Stop" onClick={() => selectedId && onBulkAction("stop", selectedId)} />
      <Btn icon={StopCircle} label="Stop All" onClick={() => onBulkAction("stopAll")} />
      <Sep />
      <Btn icon={Trash2} label="Delete" danger onClick={() => selectedId && onBulkAction("delete", selectedId)} />
      <Btn icon={Trash} label="Delete C…" danger onClick={() => onBulkAction("deleteCompleted")} />
      <Sep />
      <Btn icon={Clock} label="Scheduler" onClick={() => openPanel("schedulerPanel")} />
      <Btn icon={Rss} label="RSS" onClick={() => openPanel("rssPanel")} />
      <Btn icon={FileSignature} label="Mk Torrent" onClick={() => openPanel("createTorrentPanel")} />
      <Sep />
      <Btn icon={ChevronsRight} label="Start Qu…" onClick={() => onBulkAction("resumeAll")} />
      <Btn icon={ChevronsLeft} label="Stop Qu…" onClick={() => onBulkAction("stopQueued")} />
      <Sep />
      <Btn icon={Award} label="Register" onClick={() => openPanel("registrationPanel")} />
      <Btn icon={HelpCircle} label="Help" onClick={() => openPanel("helpPanel")} />
      <Btn icon={Info} label="About" onClick={() => openPanel("aboutPanel")} />
    </div>
  );
}
