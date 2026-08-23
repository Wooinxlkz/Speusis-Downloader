/* ── Batch / Grabber / Torrent-Files panels ───────────────────────────
 * Extracted from app.js (v0.5.43 split, Pass 2).
 * openTorrentFilesPanel is the one function here the core task-list
 * engine calls into (from handleRowAction's "torrent-files" case) —
 * app.js imports it back directly. Everything else here is only
 * reached via toolbar buttons.
 * ──────────────────────────────────────────────────────────────── */

import { escHtml, fmt } from "./utils.js";

export function initTransferPanels({ api, openPanel, closePanel, setStatus, loadDownloads }) {
  const batchPanel        = document.getElementById("batchPanel");
  const grabberPanel      = document.getElementById("grabberPanel");
  const torrentFilesPanel = document.getElementById("torrentFilesPanel");

  /* ── Batch Download Panel ─────────────────────────────────────── */
  let batchLinks = [];

  async function openBatchPanel() {
    batchLinks = [];
    document.getElementById("batchLinkList").innerHTML = `<div class="batch-empty">Click "Scan Active Tab" to detect downloadable links on the current browser page.</div>`;
    openPanel(batchPanel);
  }

  document.getElementById("btnCloseBatch").addEventListener("click", () => closePanel(batchPanel));
  document.getElementById("btnScanLinks").addEventListener("click", async () => {
    setStatus("Scanning page for links…");
    try {
      // Send message to browser extension via the listener port
      const resp = await fetch("http://127.0.0.1:9999/health");
      if (!resp.ok) throw new Error("Speusis listener not running");
      // The extension scanner is triggered from the browser side.
      // Here we show instructions and handle manual URL input as fallback.
      renderBatchPlaceholder();
      setStatus("Extension will push links — or paste URLs below");
    } catch {
      renderBatchPlaceholder();
      setStatus("Enter URLs manually in the list");
    }
  });

  function renderBatchPlaceholder() {
    const list = document.getElementById("batchLinkList");
    list.innerHTML = `<div class="batch-empty">
      <div style="margin-bottom:8px;">Paste one URL per line below, or use the browser extension's "Scan Links" button.</div>
      <textarea id="batchManualUrls" style="width:100%;height:100px;background:var(--panel2);border:1px solid var(--border);border-radius:4px;color:var(--text);padding:8px;font:inherit;font-size:11px;resize:vertical;" placeholder="https://example.com/file1.zip
https://example.com/file2.mp4
..."></textarea>
      <button id="btnParseBatchUrls" class="btn-start" style="margin-top:8px;">Load URLs</button>
    </div>`;
    document.getElementById("btnParseBatchUrls")?.addEventListener("click", () => {
      const raw = document.getElementById("batchManualUrls")?.value || "";
      const urls = raw.split(/\n/).map(s => s.trim()).filter(s => s.startsWith("http"));
      batchLinks = urls.map(url => ({ url, name: url.split("/").pop()?.split("?")[0] || url }));
      renderBatchList(batchLinks);
    });
  }

  function renderBatchList(links) {
    const filterVal = (document.getElementById("batchFilter")?.value || "").toLowerCase();
    const filtered = filterVal ? links.filter(l => l.name.toLowerCase().includes(filterVal) || l.url.toLowerCase().includes(filterVal)) : links;
    const list = document.getElementById("batchLinkList");
    if (filtered.length === 0) {
      list.innerHTML = `<div class="batch-empty">No matching links found.</div>`;
      return;
    }
    list.innerHTML = filtered.map((l, i) => {
      const ext = l.url.split(".").pop()?.split("?")[0]?.slice(0,5).toUpperCase() || "—";
      const shortName = l.name.length > 60 ? l.name.slice(0, 57) + "…" : l.name;
      return `<div class="batch-item">
        <input type="checkbox" class="batch-cb" data-url="${escHtml(l.url)}" data-name="${escHtml(l.name)}" checked />
        <span class="batch-name" title="${escHtml(l.url)}">${escHtml(shortName)}</span>
        <span class="batch-ext">${ext}</span>
      </div>`;
    }).join("");
  }

  document.getElementById("batchFilter").addEventListener("input", () => renderBatchList(batchLinks));
  document.getElementById("btnSelectAll").addEventListener("click", () => {
    document.querySelectorAll(".batch-cb").forEach(cb => { cb.checked = true; });
  });
  document.getElementById("btnSelectNone").addEventListener("click", () => {
    document.querySelectorAll(".batch-cb").forEach(cb => { cb.checked = false; });
  });

  document.getElementById("btnDownloadSelected").addEventListener("click", async () => {
    const checked = [...document.querySelectorAll(".batch-cb:checked")];
    if (checked.length === 0) { setStatus("No links selected"); return; }
    const urls = checked.map(cb => ({ url: cb.dataset.url, filename: cb.dataset.name }));
    closePanel(batchPanel);
    const results = await api.batchAddDownloads(urls);
    let added = 0;
    for (const r of (results || [])) {
      if (r.ok) { added++; }
    }
    setStatus(`Batch: ${added} of ${urls.length} downloads added`);
    await loadDownloads();
  });

  /* ── Toolbar: Grabber + Basket ────────────────────────────────── */
  document.getElementById("btnGrabber")?.addEventListener("click", () => openGrabberPanel());
  document.getElementById("btnBasket")?.addEventListener("click", () => api.openBasket?.());

  /* ── Web Grabber Panel ────────────────────────────────────────── */
  let grabberLinks = [];

  function openGrabberPanel() {
    grabberLinks = [];
    const list = document.getElementById("grabberLinkList");
    if (list) list.innerHTML = `<div class="batch-empty">Enter a URL above and click "Scan Page" to find downloadable links.</div>`;
    const status = document.getElementById("grabberStatus");
    if (status) status.textContent = "";
    openPanel(grabberPanel);
    document.getElementById("grabberUrl")?.focus();
  }

  document.getElementById("btnCloseGrabber")?.addEventListener("click", () => closePanel(grabberPanel));

  document.getElementById("btnGrabberScan")?.addEventListener("click", async () => {
    const url = document.getElementById("grabberUrl")?.value?.trim();
    if (!url) { setStatus("Enter a URL to scan"); return; }
    const statusEl = document.getElementById("grabberStatus");
    if (statusEl) statusEl.textContent = "Scanning…";
    setStatus("Web Grabber: scanning page…");
    try {
      const result = await api.grabberScan?.(url);
      if (!result || !result.ok) {
        if (statusEl) statusEl.textContent = result?.error || (window.tt ? window.tt("Scan failed") : "Scan failed");
        return;
      }
      grabberLinks = result.links || [];
      renderGrabberList();
      if (statusEl) statusEl.textContent = `Found ${grabberLinks.length} downloadable link${grabberLinks.length !== 1 ? "s" : ""}.`;
      setStatus(`Grabber: ${grabberLinks.length} links found`);
    } catch (e) {
      if (statusEl) statusEl.textContent = window.tt("Error:") + " " + e.message;
      setStatus("Grabber scan failed");
    }
  });

  document.getElementById("grabberFilter")?.addEventListener("input", renderGrabberList);

  function renderGrabberList() {
    const filterVal = (document.getElementById("grabberFilter")?.value || "").toLowerCase();
    const filtered = filterVal
      ? grabberLinks.filter(l => l.name.toLowerCase().includes(filterVal) || l.ext.toLowerCase().includes(filterVal) || l.url.toLowerCase().includes(filterVal))
      : grabberLinks;
    const list = document.getElementById("grabberLinkList");
    if (!list) return;
    if (filtered.length === 0) {
      list.innerHTML = `<div class="batch-empty">${grabberLinks.length ? (window.tt ? window.tt("No links match the filter.") : "No links match the filter.") : (window.tt ? window.tt("Enter a URL above and click 'Scan Page'.") : "Enter a URL above and click 'Scan Page'.")}</div>`;
      return;
    }
    list.innerHTML = filtered.map(l => {
      const shortName = l.name.length > 65 ? l.name.slice(0, 62) + "…" : l.name;
      const ext = (l.ext || "").toUpperCase().slice(0, 6);
      return `<div class="batch-item">
        <input type="checkbox" class="grabber-cb" data-url="${escHtml(l.url)}" data-name="${escHtml(l.name)}" checked />
        <span class="batch-name" title="${escHtml(l.url)}">${escHtml(shortName)}</span>
        <span class="batch-ext">${ext}</span>
      </div>`;
    }).join("");
  }

  document.getElementById("btnGrabberSelectAll")?.addEventListener("click", () => {
    document.querySelectorAll(".grabber-cb").forEach(cb => { cb.checked = true; });
  });
  document.getElementById("btnGrabberSelectNone")?.addEventListener("click", () => {
    document.querySelectorAll(".grabber-cb").forEach(cb => { cb.checked = false; });
  });

  document.getElementById("btnGrabberDownload")?.addEventListener("click", async () => {
    const checked = [...document.querySelectorAll(".grabber-cb:checked")];
    if (checked.length === 0) { setStatus("No links selected"); return; }
    const urls = checked.map(cb => ({ url: cb.dataset.url, filename: cb.dataset.name }));
    closePanel(grabberPanel);
    const results = await api.batchAddDownloads?.(urls);
    let added = 0;
    for (const r of (results || [])) { if (r.ok) added++; }
    setStatus(`Grabber: ${added} of ${urls.length} downloads added`);
    await loadDownloads();
  });

  /* ── Torrent Files Dialog ─────────────────────────────────────── */
  let torrentFilesTaskId = null;

  async function openTorrentFilesPanel(taskId) {
    torrentFilesTaskId = taskId;
    const list = document.getElementById("torrentFilesList");
    if (!list) return;
    list.innerHTML = `<div class="batch-empty">Loading…</div>`;
    openPanel(torrentFilesPanel, taskId);
    try {
      const files = await api.getTorrentFiles?.(taskId) || [];
      if (files.length === 0) {
        list.innerHTML = `<div class="batch-empty">No file list available yet (torrent may still be loading metadata).</div>`;
        return;
      }
      list.innerHTML = files.map(f => {
        const name = f.name || f.path || `File ${f.index}`;
        const size = f.length ? fmt(f.length) : "—";
        return `<div class="batch-item">
          <input type="checkbox" class="tf-cb" data-index="${f.index}" ${f.selected ? "checked" : ""} />
          <span class="batch-name" title="${escHtml(f.path || name)}">${escHtml(name)}</span>
          <span class="batch-ext">${size}</span>
        </div>`;
      }).join("");
      list.querySelectorAll(".tf-cb").forEach(cb => {
        cb.addEventListener("change", async () => {
          await api.selectTorrentFile?.(torrentFilesTaskId, parseInt(cb.dataset.index), cb.checked);
        });
      });
    } catch (e) {
      list.innerHTML = `<div class="batch-empty">Error: ${escHtml(e.message)}</div>`;
    }
  }

  document.getElementById("btnCloseTorrentFiles")?.addEventListener("click", () => closePanel(torrentFilesPanel));

  return { openBatchPanel, openGrabberPanel, openTorrentFilesPanel };
}
