import { useSettings } from "../hooks/useSettings";
import { CATEGORIES, STATUS_FILTERS, taskMatchFilter } from "../lib/categories";
import { displayName } from "../lib/format";

export default function Sidebar({ tasks, activeFilter, setActiveFilter }) {
  const { settings } = useSettings();
  const taskList = [...tasks.values()];
  const count = (key) => taskList.filter((t) => taskMatchFilter(t, key, displayName)).length;

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
    <div className="cat-panel">
      <div className="cat-header">
        <span>Categories</span>
      </div>
      <div className="cat-tree">
        <div className="cat-section-label">Downloads</div>
        {CATEGORIES.map((c) => <Item key={c.key} filterKey={c.key} label={c.label} />)}
        <div className="cat-section-label">Status</div>
        {STATUS_FILTERS.map((c) => <Item key={c.key} filterKey={c.key} label={c.label} />)}
      </div>
      <div className="listener-note">
        Listener: 127.0.0.1:{settings?.listenerPort ?? "9999"}
      </div>
    </div>
  );
}
