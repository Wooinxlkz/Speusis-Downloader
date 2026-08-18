import { useEffect, useRef, useState } from "react";

const MENUS = {
  File: [
    ["Add URL…", "add-url", "Ctrl+N"],
    ["Open Torrent…", "open-torrent"],
    ["Choose Download Folder…", "choose-dir"],
    ["", "separator"],
    ["Close Menu", "close-menu", "Esc"],
  ],
  Downloads: [
    ["Resume All", "resume-all"],
    ["Pause Selected", "pause-selected"],
    ["Stop Selected", "stop-selected"],
    ["Stop All", "stop-all"],
    ["", "separator"],
    ["Delete Selected", "delete-selected", "Delete"],
    ["Delete Completed", "delete-completed"],
  ],
  View: [
    ["Show / Hide Toolbar", "toggle-toolbar"],
    ["Show / Hide Categories", "toggle-categories"],
    ["Show Speed Graph", "toggle-speed-graph"],
  ],
  Tools: [
    ["Options…", "settings"],
    ["Site Logins…", "logins"],
    ["Scheduler…", "scheduler"],
    ["RSS Feeds…", "rss"],
    ["Web Grabber…", "web-grabber"],
    ["Download Basket", "basket"],
    ["Create Torrent…", "create-torrent"],
    ["", "separator"],
    ["Registration", "registration"],
  ],
  Help: [
    ["Help & Support", "help"],
    ["About Speusis Downloader", "about"],
  ],
};

export default function MenuBar({ onAction }) {
  const [openMenu, setOpenMenu] = useState(null);
  const barRef = useRef(null);

  useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (!barRef.current?.contains(event.target)) setOpenMenu(null);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  const choose = (action) => {
    setOpenMenu(null);
    onAction(action);
  };

  return (
    <nav ref={barRef} className="menubar" id="appMenuBar" aria-label="Application menu">
      {Object.entries(MENUS).map(([name, items]) => (
        <div key={name} className="menu-wrap">
          <button
            type="button"
            className={`menu-item ${openMenu === name ? "open" : ""}`}
            aria-haspopup="true"
            aria-expanded={openMenu === name}
            onClick={() => setOpenMenu((current) => current === name ? null : name)}
          >
            {name}
          </button>
          {openMenu === name && (
            <div className="menu-dropdown" role="menu" style={{ position: "absolute", left: 0, top: "calc(100% + 2px)" }}>
              {items.map(([label, action, shortcut], index) =>
                action === "separator" ? (
                  <div key={`${name}-separator-${index}`} className="md-sep" role="separator" />
                ) : (
                  <button
                    type="button"
                    key={action}
                    className="md-item"
                    role="menuitem"
                    onClick={() => choose(action)}
                  >
                    <span>{label}</span>
                    {shortcut && <span className="md-shortcut">{shortcut}</span>}
                  </button>
                )
              )}
            </div>
          )}
        </div>
      ))}
    </nav>
  );
}