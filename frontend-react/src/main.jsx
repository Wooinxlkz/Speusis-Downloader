import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import MainWindow from "./components/MainWindow";
import PanelShell from "./panels/PanelShell";

// Same detection the old app.js used: every native dialog window (Options,
// About, RSS, etc.) loads this exact same index.html, just with a
// ?panel=<name>&id=<taskId> query string appended. The main window has
// neither.
const params = new URLSearchParams(window.location.search);
const panelName = params.get("panel");
const panelTaskId = params.get("id");
const isPanelWindow = Boolean(panelName);

if (isPanelWindow) document.body.classList.add("native-panel-window");

createRoot(document.getElementById("root")).render(
  <StrictMode>
    {isPanelWindow
      ? <PanelShell panelName={panelName} taskId={panelTaskId} />
      : <MainWindow />}
  </StrictMode>
);
