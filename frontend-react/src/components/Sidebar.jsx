import { useEffect, useState } from "react";
import { useSettings } from "../hooks/useSettings";
import { CATEGORIES, STATUS_FILTERS, taskMatchFilter } from "../lib/categories";
import { displayName } from "../lib/format";
import { CAT_ICONS, LABEL_ICON } from "../lib/catIcons";
import { api } from "../lib/tauri";

export default function Sidebar({ visible = true, onHide, tasks, activeFilter, setActiveFilter }) {
  const { settings } = useSettings();
  const [drives, setDrives] = useState([]);
  const taskList = [...tasks.values()];
  const count = (key) => taskList.filter((t) => taskMatchFilter(t, key, displayName)).length;
  const active = taskList.filter((t) => t.status === "running").length;
  const done = taskList.filter((t) => t.status === "completed").length;

  // Drive list barely ever changes mid-session, so fetch it once — same
  // caching behavior as the old cachedDrives variable in app.js.
  useEffect(() => {
    api.listDrives?.().then(setDrives).catch(() => {});
  }, []);

  // Labels section, restored from the old buildCatTree()'s dynamic label
  // scan — was dropped entirely in the React rewrite.
  const labels = [...new Set(taskList.map((t) => t.label).filter(Boolean))];

  const Item = ({ filterKey, label, icon }) => {
    const n = count(filterKey);
    return (
      <button
        onClick={() => setActiveFilter(filterKey)}
        className={`cat-node w-full text-left ${activeFilter === filterKey ? "active" : ""}`}
      >
        {icon}
        <span className="cat-label">{label}</span>
        {n > 0 && <span className="cat-count">{n}</span>}
      </button>
    );
  };

  return (
    <div className={`cat-panel ${visible ? "" : "hidden"}`}>
      <div className="cat-header">
        <span>Categories</span>
        <button type="button" className="icon-btn" title="Hide categories" aria-label="Hide categories" onClick={onHide}>
          <svg width="10" height="10" viewBox="0 0 14 14" aria-hidden="true">
            <line x1="2" y1="2" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="12" y1="2" x2="2" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div className="cat-tree">
        <div className="cat-section-label">Downloads</div>
        {CATEGORIES.map((c) => <Item key={c.key} filterKey={c.key} label={c.label} icon={CAT_ICONS[c.key]} />)}
        <div className="cat-section-label" style={{ marginTop: 6 }}>Status</div>
        {STATUS_FILTERS.map((c) => <Item key={c.key} filterKey={c.key} label={c.label} icon={CAT_ICONS[c.key]} />)}
        {labels.length > 0 && (
          <>
            <div className="cat-section-label" style={{ marginTop: 6 }}>Labels</div>
            {labels.map((lbl) => (
              <Item key={"lbl:" + lbl} filterKey={"lbl:" + lbl} label={lbl} icon={LABEL_ICON} />
            ))}
          </>
        )}
        {drives.length > 0 && (
          <>
            <div className="cat-section-label" style={{ marginTop: 6 }}>Drives</div>
            {drives.map((d) => (
              <div key={d} className="cat-drive">
                {CAT_ICONS.drive}
                <span>{d}</span>
              </div>
            ))}
          </>
        )}
      </div>
      <div className="cat-stats">
        <div className="cs-row"><span>Total</span><strong>{taskList.length}</strong></div>
        <div className="cs-row"><span>Active</span><strong>{active}</strong></div>
        <div className="cs-row"><span>Done</span><strong>{done}</strong></div>
      </div>
      <div className="listener-note">
        Listener: 127.0.0.1:{settings?.listenerPort ?? "9999"}
      </div>
    </div>
  );
}
