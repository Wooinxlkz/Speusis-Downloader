export const COLUMN_LABELS = ["File name", "Q", "Size", "Status", "Time left", "Transfer rate", "Actions"];
export const COLUMN_DEFAULTS = [
  "minmax(220px, 1.8fr)", "38px", "minmax(84px, .7fr)", "minmax(150px, 1.1fr)",
  "minmax(96px, .7fr)", "minmax(124px, 1fr)", "112px",
];
export const COLUMN_MINIMUMS = [190, 32, 78, 132, 88, 108, 112];
export const COLUMN_STORAGE_KEY = "speusis.downloadTable.columnWidths.v2";

export function loadColumnWidths() {
  try {
    const stored = JSON.parse(localStorage.getItem(COLUMN_STORAGE_KEY) || "null");
    if (Array.isArray(stored) && stored.length === COLUMN_DEFAULTS.length) {
      return stored.map((w, i) => (Number.isFinite(w) && w >= COLUMN_MINIMUMS[i] ? Math.round(w) : null));
    }
  } catch { /* ignore */ }
  return COLUMN_DEFAULTS.map(() => null);
}

export function saveColumnWidths(widths) {
  try { localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(widths)); } catch { /* ignore */ }
}

export function columnsToTemplate(widths) {
  return widths.map((w, i) => (w ? `${w}px` : COLUMN_DEFAULTS[i])).join(" ");
}
