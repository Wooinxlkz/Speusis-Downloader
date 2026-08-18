// Restored 1:1 from dist/renderer/app.js's CAT_SVGS (v0.5.43) — these were
// dropped when the sidebar was rewritten in React, leaving every category
// row without its colored icon.
export const CAT_ICONS = {
  all: (
    <svg className="cat-ico" viewBox="0 0 14 14">
      <rect x="1" y="1" width="5" height="5" rx="1" fill="#60a5fa" />
      <rect x="8" y="1" width="5" height="5" rx="1" fill="#60a5fa" />
      <rect x="1" y="8" width="5" height="5" rx="1" fill="#60a5fa" />
      <rect x="8" y="8" width="5" height="5" rx="1" fill="#60a5fa" />
    </svg>
  ),
  compressed: (
    <svg className="cat-ico" viewBox="0 0 14 14">
      <rect x="1" y="1" width="12" height="12" rx="2" fill="none" stroke="#fb923c" strokeWidth="1.3" />
      <line x1="5" y1="1" x2="5" y2="13" stroke="#fb923c" strokeWidth="1.2" />
      <line x1="5" y1="4" x2="9" y2="4" stroke="#fb923c" strokeWidth="1.2" />
      <line x1="5" y1="7" x2="9" y2="7" stroke="#fb923c" strokeWidth="1.2" />
      <line x1="5" y1="10" x2="9" y2="10" stroke="#fb923c" strokeWidth="1.2" />
    </svg>
  ),
  documents: (
    <svg className="cat-ico" viewBox="0 0 14 14">
      <path d="M2 2h7l3 3v7H2V2z" fill="none" stroke="#60a5fa" strokeWidth="1.3" />
      <path d="M9 2v3h3" stroke="#60a5fa" strokeWidth="1.2" fill="none" />
      <line x1="4" y1="7" x2="10" y2="7" stroke="#60a5fa" strokeWidth="1.1" />
      <line x1="4" y1="9.5" x2="10" y2="9.5" stroke="#60a5fa" strokeWidth="1.1" />
    </svg>
  ),
  music: (
    <svg className="cat-ico" viewBox="0 0 14 14">
      <path d="M5 11V3l7-2v8" stroke="#a78bfa" strokeWidth="1.3" fill="none" strokeLinecap="round" />
      <circle cx="4" cy="11" r="2" fill="#a78bfa" opacity="0.8" />
      <circle cx="11" cy="9" r="2" fill="#a78bfa" opacity="0.8" />
    </svg>
  ),
  programs: (
    <svg className="cat-ico" viewBox="0 0 14 14">
      <rect x="2" y="2" width="10" height="10" rx="1.5" fill="none" stroke="#fb923c" strokeWidth="1.3" />
      <polyline points="4.5,7 6.5,5 8.5,7 10,5.5" stroke="#fb923c" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  video: (
    <svg className="cat-ico" viewBox="0 0 14 14">
      <rect x="1" y="3" width="9" height="8" rx="1.5" fill="none" stroke="#f472b6" strokeWidth="1.3" />
      <path d="M10 5.5l3-2v7l-3-2V5.5z" fill="#f472b6" opacity="0.8" />
    </svg>
  ),
  unfinished: (
    <svg className="cat-ico" viewBox="0 0 14 14">
      <circle cx="7" cy="7" r="5.5" fill="none" stroke="#fcd34d" strokeWidth="1.3" />
      <polyline points="7,3.5 7,7 9.5,9" stroke="#fcd34d" strokeWidth="1.3" fill="none" strokeLinecap="round" />
    </svg>
  ),
  finished: (
    <svg className="cat-ico" viewBox="0 0 14 14">
      <circle cx="7" cy="7" r="5.5" fill="none" stroke="#86efac" strokeWidth="1.3" />
      <polyline points="4,7 6,9 10,5" stroke="#86efac" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  queued: (
    <svg className="cat-ico" viewBox="0 0 14 14">
      <rect x="1" y="2" width="12" height="2.5" rx="1.2" fill="#94a3b8" />
      <rect x="1" y="6" width="12" height="2.5" rx="1.2" fill="#94a3b8" />
      <rect x="1" y="10" width="8" height="2.5" rx="1.2" fill="#94a3b8" />
    </svg>
  ),
  drive: (
    <svg className="cat-ico" viewBox="0 0 14 14">
      <rect x="1" y="4" width="12" height="6" rx="2" fill="none" stroke="#909090" strokeWidth="1.3" />
      <circle cx="10.5" cy="7" r="1.2" fill="#909090" />
    </svg>
  ),
};

// Old app.js used this exact path/stroke for every "lbl:" custom-label row.
export const LABEL_ICON = (
  <svg className="cat-ico" viewBox="0 0 14 14">
    <path d="M2 2h7l3 5-3 5H2V2z" fill="none" stroke="#60a5fa" strokeWidth="1.3" />
  </svg>
);
