import { useSettings } from "../hooks/useSettings";
import { CATEGORIES, STATUS_FILTERS, taskMatchFilter } from "../lib/categories";
import { displayName } from "../lib/format";

export default function Sidebar({ visible = true, onHide, tasks, activeFilter, setActiveFilter }) {
  const { settings } = useSettings();
  const taskList = [...tasks.values()];
  const count = (key) => taskList.filter((t) => taskMatchFilter(t, key, displayName)).length;
  const active = taskList.filter((t) => t.status === "running").length;
  const done = taskList.filter((t) => t.status === "completed").length;

  const Item = ({ filterKey, label }) => (
    <button
      onClick={() => setActiveFilter(filterKey)}
      className={`cat-node w-full text-left ${activeFilter === filterKey ? "active" : ""}`}
    >
      <span className="cat-label">{label}</span>
      <span className="cat-count">{count(filterKey)}</span>
    </button>
  );

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
        {CATEGORIES.map((c) => <Item key={c.key} filterKey={c.key} label={c.label} />)}
        <div className="cat-section-label">Status</div>
        {STATUS_FILTERS.map((c) => <Item key={c.key} filterKey={c.key} label={c.label} />)}
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
