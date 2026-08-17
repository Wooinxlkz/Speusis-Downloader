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
      className={`flex w-full items-center justify-between rounded px-2 py-1 text-left text-[12px] ${
        activeFilter === filterKey ? "bg-cat-active text-accent font-semibold" : "text-muted hover:bg-cat-hover hover:text-text"
      }`}
    >
      <span>{label}</span>
      <span className="text-dim text-[10px]">{count(filterKey)}</span>
    </button>
  );

  return (
    <div className="w-48 shrink-0 border-r border-border bg-cat-bg flex flex-col overflow-y-auto p-2 gap-3">
      <div>
        <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-dim">Downloads</div>
        <div className="flex flex-col gap-0.5">
          {CATEGORIES.map((c) => <Item key={c.key} filterKey={c.key} label={c.label} />)}
        </div>
      </div>
      <div>
        <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-dim">Status</div>
        <div className="flex flex-col gap-0.5">
          {STATUS_FILTERS.map((c) => <Item key={c.key} filterKey={c.key} label={c.label} />)}
        </div>
      </div>
      <div className="mt-auto pt-2 border-t border-border text-dim text-[10px]">
        Listener: 127.0.0.1:{settings?.listenerPort ?? "9999"}
      </div>
    </div>
  );
}
