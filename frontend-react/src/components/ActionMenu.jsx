import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";

export default function ActionMenu({ items, onAction }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  // Position is computed with useLayoutEffect, AFTER the menu has actually
  // rendered at position:fixed - this is the fix for the old vanilla bug
  // where offsetWidth was read before the element switched to fixed
  // positioning, giving an unreliable measurement and making the menu open
  // in a different wrong place depending on each row's surrounding layout.
  useLayoutEffect(() => {
    if (!open || !btnRef.current || !menuRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const menuWidth = menuRef.current.offsetWidth || 200;
    const menuHeight = menuRef.current.offsetHeight || 200;
    let left = rect.left + menuWidth <= window.innerWidth - 8 ? rect.left : rect.right - menuWidth;
    left = Math.max(8, Math.min(window.innerWidth - menuWidth - 8, left));
    let top = rect.bottom + 6;
    if (top + menuHeight > window.innerHeight) top = Math.max(8, rect.top - menuHeight - 6);
    setPos({ top, left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (!menuRef.current?.contains(e.target) && !btnRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [open]);

  return (
    <span className="relative inline-block">
      <button
        ref={btnRef}
        type="button"
        title="More actions"
        aria-label="More actions"
        aria-expanded={open}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="flex h-6 w-6 items-center justify-center rounded hover:bg-tb-hover"
      >
        <MoreHorizontal size={14} />
      </button>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          style={{ position: "fixed", top: pos.top, left: pos.left, visibility: pos.left === 0 && pos.top === 0 ? "hidden" : "visible" }}
          className="z-[720] min-w-[190px] rounded border border-border bg-menu-bg py-1 shadow-lg"
        >
          {items.map((item, i) =>
            item.sep ? (
              <div key={i} className="my-1 h-px bg-border" />
            ) : (
              <button
                key={item.action}
                disabled={item.disabled}
                onClick={() => { setOpen(false); onAction(item.action); }}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] ${
                  item.disabled ? "text-dim cursor-not-allowed" : "text-text hover:bg-tb-hover"
                }`}
              >
                {item.label}
              </button>
            )
          )}
        </div>
      )}
    </span>
  );
}
