import { useCallback, useEffect, useRef, useState } from "react";
import Toolbar from "./Toolbar";
import Sidebar from "./Sidebar";
import DownloadTable from "./DownloadTable";
import StatusBar from "./StatusBar";
import UpdateBanner from "./UpdateBanner";
import ClipboardBanner from "./ClipboardBanner";
import { useTasks } from "../hooks/useTasks";
import { useSettings } from "../hooks/useSettings";
import { taskMatchFilter } from "../lib/categories";
import { displayName } from "../lib/format";
import { api } from "../lib/tauri";

export default function MainWindow() {
  useSettings(); // applies theme/accent to <body> as a side effect
  const { tasks, speeds, removeTask, upsert } = useTasks();
  const [activeFilter, setActiveFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const [statusText, setStatusText] = useState("Ready");
  const [version, setVersion] = useState("");

  useEffect(() => { api.getVersion().then(setVersion).catch(() => {}); }, []);

  // Native panel windows (Options/Batch/etc) call reportPanelResult to hand
  // data back to the window that opened them - e.g. Rename reporting the
  // new display name, since rename is local-state-only in this app.
  useEffect(() => api.onPanelResult((result) => {
    if (!result?.id) return;
    if (result.deleted) removeTask(result.id);
    else if (result.filename) upsert(result.id, { filename: result.filename });
  }), [upsert, removeTask]);

  // Tray menu items (Add URL, Resume All, Stop All, Options, etc.) forward
  // here the same way the vanilla app.js's nativeMenuActions table did.
  // Uses a ref instead of depending on handleBulkAction directly: that
  // function's identity changes every time `tasks`/`selectedId` change, and
  // re-subscribing listen() on every task update would be wasteful - but
  // naively closing over it once at mount would capture a permanently
  // stale, empty task list, silently breaking "Resume All"/"Stop All" from
  // the tray after the very first render.
  const bulkActionRef = useRef(() => {});
  useEffect(() => api.onMenuCommand((command) => {
    if (command === "add-url") api.openPanel("addUrlPanel");
    else if (command === "resume-all") bulkActionRef.current("resumeAll");
    else if (command === "stop-all") bulkActionRef.current("stopAll");
    else if (command === "settings") api.openPanel("settingsPanel");
    else if (command === "registration") api.openPanel("registrationPanel");
    else if (command === "about") api.openPanel("aboutPanel");
  }), []);

  const filteredTasks = new Map(
    [...tasks].filter(([, t]) => taskMatchFilter(t, activeFilter, displayName))
  );

  const handleAction = useCallback(async (action, id) => {
    const task = tasks.get(id);
    if (!task) return;
    const name = displayName(task);

    const requeue = async (label) => {
      const fresh = await api.addDownload({ url: task.url, filename: task.filename, label: task.label });
      if (fresh?.id) {
        removeTask(id);
        upsert(fresh.id, { ...fresh, createdAt: Date.now() });
        setStatusText(`${label}: ${displayName(fresh)}`);
      }
    };

    switch (action) {
      case "pause":
        await api.pauseDownload(id);
        upsert(id, { status: "paused" });
        setStatusText("Paused: " + name);
        break;
      case "resume":
        if (task.status === "paused") {
          await api.resumeDownload(id);
          upsert(id, { status: "queued" });
          setStatusText("Resuming: " + name);
        } else if (task.status === "failed" || task.status === "cancelled") {
          await requeue("Restarted");
        }
        break;
      case "stop":
        await api.cancelDownload(id);
        upsert(id, { status: "cancelled" });
        setStatusText("Stopped: " + name);
        break;
      case "redownload":
        await requeue("Re-queued");
        break;
      case "refreshurl":
        setStatusText("Refresh download address — re-queuing…");
        await requeue("Download refreshed");
        break;
      case "delete":
        setSelectedId(id);
        // Matches dialogs.js's showDeleteConfirm: check the skip flag
        // before ever opening the confirm dialog at all, not inside it.
        if (localStorage.getItem("speusis_skipDeleteConfirm") === "1") {
          await api.removeDownload(id, false);
          removeTask(id);
          setStatusText("Deleted: " + name);
        } else {
          await api.openPanel("deleteConfirmDialog", id);
        }
        break;
      case "preview": {
        try {
          const result = await api.previewDownload(id);
          setStatusText(result?.ok ? "Preview opened: " + name : "Preview unavailable: " + (result?.error || "no file"));
        } catch { setStatusText("Preview failed"); }
        break;
      }
      case "open": {
        try {
          const result = await api.openFile(id);
          setStatusText(result?.ok ? "Opening: " + name : "Cannot open — " + (result?.error || "file not ready"));
        } catch { setStatusText("Cannot open — file may not be complete."); }
        break;
      }
      case "openwith": {
        try {
          const result = await api.openWith(id);
          setStatusText(result?.ok ? "Opening with system dialog…" : "Cannot open — " + (result?.error || "file not ready"));
        } catch { setStatusText("Open with failed."); }
        break;
      }
      case "openfolder": {
        try {
          const result = await api.openFolder(id);
          setStatusText(result?.ok ? "Opened folder for: " + name : "Cannot open folder — " + (result?.error || "file not ready"));
        } catch { setStatusText("Cannot open folder."); }
        break;
      }
      case "rename":
        await api.openPanel("renameDialog", id);
        break;
      case "properties":
        await api.openPanel("propertiesDialog", id);
        break;
      case "segmentmap":
        await api.openPanel("segmentMapDialog", id);
        break;
      case "tracer":
        await api.openPanel("tracerPanel", id);
        break;
      case "torrent-files":
        await api.openPanel("torrentFilesPanel", id);
        break;
      case "addqueue":
        setStatusText("Added to queue: " + name);
        break;
      default:
        break;
    }
  }, [tasks, removeTask, upsert]);

  const handleBulkAction = useCallback(async (action) => {
    switch (action) {
      case "resumeAll": {
        const paused = [...tasks.values()].filter((t) => t.status === "paused");
        for (const t of paused) await api.resumeDownload(t.id).catch(() => {});
        setStatusText(`Resumed ${paused.length} download(s)`);
        break;
      }
      case "stopAll": {
        const running = [...tasks.values()].filter((t) => ["running", "queued", "paused"].includes(t.status));
        for (const t of running) await api.cancelDownload(t.id).catch(() => {});
        setStatusText(`Stopped ${running.length} download(s)`);
        break;
      }
      case "stopQueued": {
        const queued = [...tasks.values()].filter((t) => t.status === "queued");
        for (const t of queued) await api.cancelDownload(t.id).catch(() => {});
        setStatusText(`Stopped ${queued.length} queued download(s)`);
        break;
      }
      case "deleteCompleted": {
        const completed = [...tasks.values()].filter((t) => ["completed", "cancelled"].includes(t.status));
        for (const t of completed) { await api.removeDownload(t.id, false).catch(() => {}); removeTask(t.id); }
        setStatusText(`Removed ${completed.length} completed download(s)`);
        break;
      }
      case "pause":
      case "stop":
      case "delete":
        if (selectedId) await handleAction(action, selectedId);
        break;
      default:
        break;
    }
  }, [tasks, selectedId, handleAction, removeTask]);

  bulkActionRef.current = handleBulkAction;

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-bg text-text">
      <UpdateBanner />
      <ClipboardBanner onAdded={(fresh) => upsert(fresh.id, { ...fresh, createdAt: Date.now() })} />
      <Toolbar selectedId={selectedId} tasks={tasks} onBulkAction={handleBulkAction} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar tasks={tasks} activeFilter={activeFilter} setActiveFilter={setActiveFilter} />
        <DownloadTable
          tasks={filteredTasks}
          speeds={speeds}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onAction={handleAction}
        />
      </div>
      <StatusBar tasks={tasks} speeds={speeds} statusText={statusText} version={version} />
    </div>
  );
}
