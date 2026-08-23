/* ── Rename / Properties / Segment Map / Tracer / Delete-confirm ─────
 * Extracted from app.js (v0.5.43 split, Pass 3).
 * These dialogs read and write shared task state (taskStore, speedMap)
 * and call back into the core row-render functions (upsertRow,
 * removeRow, updateStats, scheduleCatTreeRender), so — unlike Pass 2's
 * panels — they need those passed in via initDialogs(). taskStore and
 * speedMap are Maps passed by reference: this module reads/writes the
 * exact same Map instances app.js uses, not copies.
 * ──────────────────────────────────────────────────────────────── */

import { fmt, fmtSecs, displayName, escHtml, BTN_SVG } from "./utils.js";

export function initDialogs({ api, openPanel, closePanel, setStatus, taskStore, speedMap, upsertRow, removeRow, updateStats, scheduleCatTreeRender }) {
  const renameDialog        = document.getElementById("renameDialog");
  const propertiesDialog    = document.getElementById("propertiesDialog");
  const segmentMapDialog    = document.getElementById("segmentMapDialog");
  const tracerPanel         = document.getElementById("tracerPanel");
  const deleteConfirmDialog = document.getElementById("deleteConfirmDialog");
  const defaultSegmentsEl   = document.getElementById("defaultSegments");

  /* ── Rename dialog ─────────────────────────────────────────────── */
  function openRenameDialog(id) {
    const task = taskStore.get(id);
    if (!task) return;
    const input = document.getElementById("renameInput");
    input.value = displayName(task);
    openPanel(renameDialog, id);
    input.focus(); input.select();

    const doRename = () => {
      const newName = input.value.trim();
      if (newName) {
        taskStore.set(id, { ...task, filename: newName });
        upsertRow(taskStore.get(id));
        setStatus("Renamed to: " + newName);
      }
      closePanel(renameDialog);
    };

    document.getElementById("btnRenameOk").onclick = doRename;
    document.getElementById("btnRenameCancel").onclick = () => closePanel(renameDialog);
    input.onkeydown = (e) => { if (e.key === "Enter") doRename(); if (e.key === "Escape") closePanel(renameDialog); };
  }

  /* ── Properties dialog ────────────────────────────────────────── */
  function openPropertiesDialog(id) {
    const task = taskStore.get(id);
    if (!task) return;
    const name = displayName(task);
    const received = task.receivedBytes || 0;
    const size = Number(task.size || 0);
    const pct = size > 0 ? ((received / size) * 100).toFixed(1) + "%" : "—";
    const rows = [
      ["File name",    name],
      ["URL",          task.url || "—"],
      ["Status",       task.status || "—"],
      ["Size",         size > 0 ? fmt(size) : "—"],
      ["Downloaded",   received > 0 ? fmt(received) : "—"],
      ["Progress",     pct],
      ["Label",        task.label || "—"],
      ["Created",      task.createdAt ? new Date(task.createdAt).toLocaleString() : "—"],
      ["Type",         task.kind || "http"],
    ];
    const content = document.getElementById("propertiesContent");
    content.innerHTML = rows.map(([k, v]) =>
      `<div class="sd-row"><span>${escHtml(window.tt ? window.tt(k) : k)}</span><strong style="word-break:break-all;text-align:right;max-width:300px;">${escHtml(String(v))}</strong></div>`
    ).join("");
    openPanel(propertiesDialog);
    document.getElementById("btnCloseProperties").onclick = () => closePanel(propertiesDialog);
  }

  /* ── Segment map dialog ───────────────────────────────────────── */
  let _segMapPoll = null;
  function stopSegMapPoll() { if (_segMapPoll) { clearInterval(_segMapPoll); _segMapPoll = null; } }

  async function renderSegmentMap(id) {
    const grid = document.getElementById("segMapGrid");
    const stats = document.getElementById("segMapStats");
    const empty = document.getElementById("segMapEmpty");
    const summary = document.getElementById("segMapSummary");
    const speedEl = document.getElementById("segMapSpeed");
    const activeEl = document.getElementById("segMapActive");
    let map;
    try { map = await api.getSegmentMap(id); } catch { map = null; }

    if (!map || !map.totalSegments) {
      grid.innerHTML = ""; stats.innerHTML = "";
      grid.classList.add("hidden"); stats.classList.add("hidden");
      // Always reset to the "no live data" copy here - openSegmentMapDialog's
      // no-selection branch below reuses this same element with different
      // text, so this render path has to restore the default wording itself
      // rather than assume it was never changed.
      empty.textContent = (window.tt ? window.tt("No live segment data yet — segment info is only available while a multi-segment download is actively running.") : "No live segment data yet — segment info is only available while a multi-segment download is actively running.");
      empty.classList.remove("hidden");
      if (summary) summary.textContent = (window.tt ? window.tt("— segments") : "— segments");
      if (speedEl) speedEl.textContent = "—";
      if (activeEl) activeEl.textContent = (window.tt ? window.tt("NO LIVE MAP") : "NO LIVE MAP");
      return;
    }
    grid.classList.remove("hidden"); stats.classList.remove("hidden"); empty.classList.add("hidden");
    if (summary) summary.textContent = `${map.totalSegments} segments`;
    if (speedEl) speedEl.textContent = speedMap.get(id) > 0 ? `${fmt(speedMap.get(id))}/s` : "—";
    if (activeEl) activeEl.textContent = `${map.segments.filter(s => !s.done && s.received > 0).length} active`;
    document.querySelectorAll("#segMapControls [data-segment-count]").forEach(button => {
      button.classList.toggle("active", Number(button.dataset.segmentCount) === map.totalSegments);
    });

    grid.innerHTML = map.segments.map(seg => {
      const len = seg.end - seg.start + 1;
      const partial = !seg.done && seg.received > 0;
      const cls = seg.done ? "seg-done" : partial ? "seg-partial" : "";
      const pct = len > 0 ? Math.round((seg.received / len) * 100) : 0;
      return `<div class="seg-tile ${cls}" title="Segment ${seg.index + 1}: ${pct}%">${seg.done ? "✓" : (partial ? pct : "")}</div>`;
    }).join("");

    const doneCount = map.segments.filter(s => s.done).length;
    const remaining = Math.max(0, map.totalBytes - map.downloadedBytes);
    stats.innerHTML = [
      ["Downloaded", fmt(map.downloadedBytes)],
      ["Remaining",  fmt(remaining)],
      ["Segments",   `${doneCount} / ${map.totalSegments}`],
      ["Total size", fmt(map.totalBytes)],
    ].map(([label, value]) => `<div class="sms-item"><div class="sms-label">${escHtml(window.tt ? window.tt(label) : label)}</div><div class="sms-value">${escHtml(value)}</div></div>`).join("");
  }

  async function openSegmentMapDialog(id) {
    const task = id ? taskStore.get(id) : null;
    document.getElementById("btnCloseSegMap").onclick = () => { stopSegMapPoll(); closePanel(segmentMapDialog); };

    // Previously this bailed out silently on a missing/stale selection -
    // a status-bar line easy to miss behind an open Settings panel, which
    // read to users as "the dialog just doesn't show up". Now the card
    // always opens; it just explains itself when there's nothing to show.
    if (!id || !task) {
      stopSegMapPoll();
      document.getElementById("segMapName").textContent = "";
      document.getElementById("segMapGrid").innerHTML = "";
      document.getElementById("segMapGrid").classList.add("hidden");
      document.getElementById("segMapStats").innerHTML = "";
      document.getElementById("segMapStats").classList.add("hidden");
      document.getElementById("segMapSummary").textContent = (window.tt ? window.tt("— segments") : "— segments");
      document.getElementById("segMapSpeed").textContent = "—";
      document.getElementById("segMapActive").textContent = (window.tt ? window.tt("NO LIVE MAP") : "NO LIVE MAP");
      const empty = document.getElementById("segMapEmpty");
      empty.textContent = (window.tt ? window.tt("No download selected — pick one in the list, then open View map again.") : "No download selected — pick one in the list, then open View map again.");
      empty.classList.remove("hidden");
      openPanel(segmentMapDialog, null);
      setStatus("Select a download first to view its segment map");
      return;
    }

    document.getElementById("segMapName").textContent = displayName(task);
    await renderSegmentMap(id);
    openPanel(segmentMapDialog, id);
    stopSegMapPoll();
    _segMapPoll = setInterval(() => renderSegmentMap(id), 1500);
  }
  document.querySelectorAll("#segMapControls [data-segment-count]").forEach(button => {
    button.addEventListener("click", async () => {
      const count = Number(button.dataset.segmentCount);
      if (!Number.isFinite(count)) return;
      document.querySelectorAll("#segMapControls [data-segment-count]").forEach(b => b.classList.toggle("active", b === button));
      if (defaultSegmentsEl) defaultSegmentsEl.value = count;
      try {
        await api.updateSettings({ defaultSegments: count });
        setStatus(`${count} segments per file selected for new downloads`);
      } catch {
        setStatus("Could not update segments per file");
      }
    });
  });

  /* ── Tracer panel (FlexD-style all/active/done trace view) ─────── */
  let _tracerFilter = "all";
  let _tracerPoll = null;
  function stopTracerPoll() { if (_tracerPoll) { clearInterval(_tracerPoll); _tracerPoll = null; } }

  function traceState(status) {
    if (status === "running" || status === "active" || status === "downloading") return ["active", "active", "trace-active"];
    if (status === "completed" || status === "done") return ["done", "done", "trace-done"];
    if (status === "paused") return ["paused", "paused", "trace-paused"];
    if (status === "failed") return ["failed", "failed", "trace-failed"];
    if (status === "queued") return ["waiting", "waiting", "trace-waiting"];
    return ["cancelled", "cancelled", "trace-failed"];
  }

  function traceIcon(state) {
    if (state === "active") return `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3v9M6.5 9.5L10 13l3.5-3.5M4 16h12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    if (state === "done") return `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 10.5l3 3 7-7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    if (state === "paused") return `<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="5" y="4" width="3.5" height="12" rx="1" fill="currentColor"/><rect x="11.5" y="4" width="3.5" height="12" rx="1" fill="currentColor"/></svg>`;
    if (state === "failed") return `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 6l8 8M14 6l-8 8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
    return `<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10 6.5v4l2.5 1.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;
  }

  async function renderTracerList() {
    const list = document.getElementById("tracerList");
    if (!list) return;
    let tasks = [];
    try { tasks = await api.listDownloads(); } catch { tasks = []; }

    const runningCount = tasks.filter(t => ["running", "active", "downloading"].includes(t.status)).length;
    const doneCount = tasks.filter(t => ["completed", "done"].includes(t.status)).length;
    const totalSpeed = [...speedMap.values()].reduce((sum, value) => sum + value, 0);
    document.getElementById("tracerAllCount")?.replaceChildren(document.createTextNode(String(tasks.length)));
    document.getElementById("tracerActiveTabCount")?.replaceChildren(document.createTextNode(String(runningCount)));
    document.getElementById("tracerActiveCount")?.replaceChildren(document.createTextNode(String(runningCount)));
    document.getElementById("tracerDoneCount")?.replaceChildren(document.createTextNode(String(doneCount)));
    const tracerSpeed = document.getElementById("tracerSpeed");
    if (tracerSpeed) tracerSpeed.textContent = `${fmt(totalSpeed)} /s`;

    const filtered = tasks.filter(t => {
      if (_tracerFilter === "active") return !["completed", "done"].includes(t.status);
      if (_tracerFilter === "done") return ["completed", "done"].includes(t.status);
      return true;
    });

    if (!filtered.length) {
      list.innerHTML = `<div class="trace-empty">No downloads to show.</div>`;
      return;
    }

    list.innerHTML = filtered.map(t => {
      const size = Number(t.size || 0);
      const received = Number(t.receivedBytes || 0);
      const pct = size > 0 ? Math.min(100, Math.round((received / size) * 100)) : 0;
      const [state, label, iconClass] = traceState(t.status);
      const isActive = state === "active";
      const isPaused = t.status === "paused";
      const rate = speedMap.get(t.id) > 0 ? fmt(speedMap.get(t.id)) + "/s" : "—";
      const segments = t.totalSegments || t.segmentCount || t.segments || "—";
      const receivedLabel = received > 0 ? fmt(received) : "0 B";
      return `<div class="tracer-item" data-id="${escHtml(t.id)}">
        <div class="tracer-item-top">
          <span class="trace-state-icon ${iconClass}">${traceIcon(state)}</span>
          <span class="tracer-item-name">${escHtml(displayName(t))}</span>
          <span class="tracer-item-rate">${escHtml(rate)}</span>
        </div>
        <div class="tracer-item-meta">${escHtml(receivedLabel)} · ${size > 0 ? escHtml(fmt(size)) : (window.tt ? window.tt("size unknown") : "size unknown")} · ${escHtml(label)}</div>
        <div class="tracer-item-meta trace-submeta">${isActive ? "ETA " + escHtml(fmtSecs(t.etaSeconds || 0)) : (t.status === "failed" ? (window.tt ? window.tt("download failed") : "download failed") : label)} · ${escHtml(String(segments))} segs</div>
        <div class="tracer-progress"><div class="tracer-progress-fill ${iconClass}" style="width:${pct}%"></div></div>
        <div class="tracer-item-footer">
          <span>${escHtml(t.outputPath ? "saved to " + t.outputPath : "source: " + (t.url || "").slice(0, 48))}</span>
          ${(isActive || isPaused) ? `<span class="tracer-item-actions">
            ${isActive ? `<button class="trace-action" data-tracer-action="pause" title="Pause">${BTN_SVG.pause}</button>` : ""}
            ${isPaused ? `<button class="trace-action" data-tracer-action="resume" title="Resume">${BTN_SVG.play}</button>` : ""}
            <button class="trace-action" data-tracer-action="stop" title="Stop">${BTN_SVG.stop}</button>
          </span>` : ""}
        </div>
      </div>`;
    }).join("");
  }

  async function openTracerPanel() {
    _tracerFilter = "all";
    document.querySelectorAll(".tracer-tab").forEach(t => t.classList.toggle("active", t.dataset.tracerFilter === "all"));
    await renderTracerList();
    openPanel(tracerPanel);
    stopTracerPoll();
    _tracerPoll = setInterval(renderTracerList, 1500);
  }

  document.getElementById("btnCloseTracer")?.addEventListener("click", () => { stopTracerPoll(); closePanel(tracerPanel); });
  document.querySelectorAll(".tracer-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      _tracerFilter = tab.dataset.tracerFilter;
      document.querySelectorAll(".tracer-tab").forEach(t => t.classList.toggle("active", t === tab));
      renderTracerList();
    });
  });
  document.getElementById("tracerList")?.addEventListener("click", async e => {
    const btn = e.target.closest("[data-tracer-action]");
    if (!btn) return;
    const id = btn.closest(".tracer-item")?.dataset.id;
    if (!id) return;
    const action = btn.dataset.tracerAction;
    try {
      if (action === "pause") await api.pauseDownload(id);
      else if (action === "resume") await api.resumeDownload(id);
      else if (action === "stop") await api.cancelDownload(id);
    } catch {}
    renderTracerList();
  });

  /* ── Delete confirmation (IDM-style) ────────────────────────────── */
  let _skipDeleteConfirm = localStorage.getItem("speusis_skipDeleteConfirm") === "1";

  async function performActualDelete(id, deleteFromDisk) {
    const task = taskStore.get(id);
    if (!task) return;
    if (api.removeDownload) {
      await api.removeDownload(id, !!deleteFromDisk);
    } else {
      await api.cancelDownload(id);
    }
    taskStore.delete(id); speedMap.delete(id); removeRow(id);
    setStatus((deleteFromDisk ? window.tt("Completely deleted:") + " " : window.tt("Deleted:") + " ") + displayName(task));
    updateStats(); scheduleCatTreeRender();
  }

  function showDeleteConfirm(id) {
    return new Promise((resolve) => {
      if (_skipDeleteConfirm) {
        performActualDelete(id, false).then(resolve);
        return;
      }
      openPanel(deleteConfirmDialog, id);
      const chkDisk   = document.getElementById("chkDeleteFromDisk");
      const chkSkip   = document.getElementById("chkDontShowDeleteAgain");
      const btnYes    = document.getElementById("btnDeleteConfirmYes");
      const btnNo     = document.getElementById("btnDeleteConfirmNo");
      if (chkDisk)  chkDisk.checked  = false;
      if (chkSkip)  chkSkip.checked  = false;

      const cleanup = () => {
        closePanel(deleteConfirmDialog);
        btnYes.onclick = null;
        btnNo.onclick  = null;
      };
      btnYes.onclick = async () => {
        const fromDisk = chkDisk?.checked ?? false;
        const skip     = chkSkip?.checked ?? false;
        if (skip) {
          _skipDeleteConfirm = true;
          localStorage.setItem("speusis_skipDeleteConfirm", "1");
        }
        cleanup();
        await performActualDelete(id, fromDisk);
        resolve();
      };
      btnNo.onclick = () => { cleanup(); resolve(); };
    });
  }

  return { openRenameDialog, openPropertiesDialog, openSegmentMapDialog, openTracerPanel, showDeleteConfirm, stopSegMapPoll, stopTracerPoll };
}
