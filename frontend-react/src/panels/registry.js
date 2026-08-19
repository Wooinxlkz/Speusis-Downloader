import AddUrlPanel from "./AddUrlPanel";
import OptionsPanel from "./OptionsPanel";
import SchedulerPanel from "./SchedulerPanel";
import LoginsPanel from "./LoginsPanel";
import RssPanel from "./RssPanel";
import BatchPanel from "./BatchPanel";
import CreateTorrentPanel from "./CreateTorrentPanel";
import AboutPanel from "./AboutPanel";
import HelpPanel from "./HelpPanel";
import RegistrationPanel from "./RegistrationPanel";
import GrabberPanel from "./GrabberPanel";
import TorrentFilesPanel from "./TorrentFilesPanel";
import RenameDialog from "./RenameDialog";
import PropertiesDialog from "./PropertiesDialog";
import DeleteConfirmDialog from "./DeleteConfirmDialog";
import SegmentMapDialog from "./SegmentMapDialog";
import TracerPanel from "./TracerPanel";
import AutoUpdateDialog from "./AutoUpdateDialog";
import UpdateWarnDialog from "./UpdateWarnDialog";

// (title, Component) - title copied verbatim from native_panel_config in
// src-tauri/src/commands.rs so the window title bar text can never drift
// from what Rust actually set the OS window title to.
export const PANEL_REGISTRY = {
  addUrlPanel: ["Add Download", AddUrlPanel],
  settingsPanel: ["Options", OptionsPanel],
  schedulerPanel: ["Scheduler", SchedulerPanel],
  loginsPanel: ["Site Login Manager", LoginsPanel],
  rssPanel: ["RSS Feed Manager", RssPanel],
  batchPanel: ["Batch Download from Page", BatchPanel],
  createTorrentPanel: ["Create Torrent File", CreateTorrentPanel],
  aboutPanel: ["About Speusis", AboutPanel],
  helpPanel: ["Help & Support", HelpPanel],
  registrationPanel: ["Registration", RegistrationPanel],
  grabberPanel: ["Web Grabber", GrabberPanel],
  torrentFilesPanel: ["Torrent File Selection", TorrentFilesPanel],
  renameDialog: ["Move / Rename", RenameDialog],
  propertiesDialog: ["Download Properties", PropertiesDialog],
  deleteConfirmDialog: ["Confirm Deletion", DeleteConfirmDialog],
  segmentMapDialog: ["Segment Map", SegmentMapDialog],
  tracerPanel: ["Download Trace", TracerPanel],
  autoUpdateDialog: ["Speusis Update", AutoUpdateDialog],
  updateWarnDialog: ["Speusis", UpdateWarnDialog],
};
