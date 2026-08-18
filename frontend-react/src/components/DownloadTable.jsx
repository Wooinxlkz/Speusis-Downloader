import { useEffect, useRef, useState } from "react";
import DownloadRow from "./DownloadRow";
import { COLUMN_LABELS, COLUMN_MINIMUMS, loadColumnWidths, saveColumnWidths, columnsToTemplate } from "../lib/columns";

export default function DownloadTable({ tasks, speeds, selectedId, onSelect, onAction }) {
  const panelRef = useRef(null);
  const [widths, setWidths] = useState(loadColumnWidths);
  const dragRef = useRef(null);

  useEffect(() => {
    panelRef.current?.style.setProperty("--tbl-cols", columnsToTemplate(widths));
  }, [widths]);

  const onHandleDown = (index, e) => {
    e.preventDefault();
    dragRef.current = { index, startX: e.clientX, startWidth: e.currentTarget.parentElement.getBoundingClientRect().width };
    document.body.classList.add("select-none");
    window.addEventListener("pointermove", onHandleMove);
    window.addEventListener("pointerup", onHandleUp);
  };
  const onHandleMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const next = Math.max(COLUMN_MINIMUMS[d.index], Math.round(d.startWidth + (e.clientX - d.startX)));
    setWidths((prev) => {
      const copy = [...prev];
      copy[d.index] = next;
      return copy;
    });
  };
  const onHandleUp = () => {
    dragRef.current = null;
    document.body.classList.remove("select-none");
    window.removeEventListener("pointermove", onHandleMove);
    window.removeEventListener("pointerup", onHandleUp);
    setWidths((prev) => { saveColumnWidths(prev); return prev; });
  };

  const rows = [...tasks.values()].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  return (
    <div ref={panelRef} className="table-panel flex flex-1 flex-col overflow-hidden">
      <div
        className="tbl-header"
        style={{ gridTemplateColumns: "var(--tbl-cols)" }}
      >
        {COLUMN_LABELS.map((label, i) => (
          <div key={label} className="tbl-cell">
            {label}
            {i < COLUMN_LABELS.length - 1 && (
              <div
                onPointerDown={(e) => onHandleDown(i, e)}
                className="absolute -right-[3px] top-0 h-full w-[7px] cursor-col-resize z-10"
              />
            )}
          </div>
        ))}
      </div>

      <div className="download-list">
        {rows.length === 0 && (
          <div className="empty-state">
            <svg width="52" height="52" viewBox="0 0 52 52" fill="none" aria-hidden="true">
              <circle cx="26" cy="26" r="24" stroke="var(--border)" strokeWidth="2" />
              <path d="M26 14v14M18 22l8 8 8-8" stroke="var(--muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="16" y1="36" x2="36" y2="36" stroke="var(--muted)" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            <div className="empty-text">No downloads yet</div>
            <div className="empty-sub">Click "Add URL" in the toolbar or let the extension capture links</div>
          </div>
        )}
        {rows.map((task) => (
          <DownloadRow
            key={task.id}
            task={task}
            speed={speeds.get(task.id) || 0}
            selected={selectedId === task.id}
            onSelect={onSelect}
            onAction={onAction}
          />
        ))}
      </div>
    </div>
  );
}
