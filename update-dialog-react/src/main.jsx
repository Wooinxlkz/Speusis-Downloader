import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

// The shared theme stylesheet lives one folder up (dist/renderer/styles.css)
// from this window's own output (dist/renderer/update-dialog/index.html).
// Linked at runtime rather than as a Vite-processed <link> in index.html so
// the build never copies/hashes it - this window always reads the app's
// real, current stylesheet, byte-for-byte the same file every other window
// uses, so theme/accent colors and the auto-update-box/panel-box rules stay
// in sync automatically if that file is ever edited.
const link = document.createElement("link");
link.rel = "stylesheet";
link.href = "../styles.css";
document.head.appendChild(link);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
