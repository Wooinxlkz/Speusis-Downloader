import { PANEL_REGISTRY } from "./registry";
import PanelChrome from "./PanelChrome";

export default function PanelShell({ panelName, taskId }) {
  const entry = PANEL_REGISTRY[panelName];
  if (!entry) {
    return (
      <PanelChrome title="Speusis" panelName={panelName}>
        <p className="text-muted">Unknown panel: {panelName}</p>
      </PanelChrome>
    );
  }
  const [title, Component] = entry;
  return (
    <PanelChrome title={title} panelName={panelName}>
      <Component taskId={taskId} />
    </PanelChrome>
  );
}
