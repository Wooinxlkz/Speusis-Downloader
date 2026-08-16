/* ── Scheduler / Logins / RSS / Create-Torrent panels ────────────────
 * Extracted from app.js (v0.5.43 split, Pass 2).
 * These four panels are self-contained: they only touch their own
 * DOM elements and never get called into by the core task-list
 * engine (upsertRow/renderAll/etc). initConfigPanels() takes the
 * few app-wide things they need (api, openPanel, closePanel,
 * setStatus) as arguments rather than importing app.js, so there's
 * no circular import and no risk of running before those are ready.
 * ──────────────────────────────────────────────────────────────── */

import { escHtml } from "./utils.js";

export function initConfigPanels({ api, openPanel, closePanel, setStatus }) {
  const schedulerPanel     = document.getElementById("schedulerPanel");
  const loginsPanel        = document.getElementById("loginsPanel");
  const rssPanel           = document.getElementById("rssPanel");
  const createTorrentPanel = document.getElementById("createTorrentPanel");

  /* ── Scheduler Panel ──────────────────────────────────────────── */
  function buildHourOptions(selId, value) {
    const sel = document.getElementById(selId);
    if (!sel) return;
    sel.innerHTML = "";
    for (let h = 0; h < 24; h++) {
      const opt = document.createElement("option");
      opt.value = h;
      opt.textContent = String(h).padStart(2,"0") + ":00";
      if (h === value) opt.selected = true;
      sel.appendChild(opt);
    }
  }
  function buildMinOptions(selId, value) {
    const sel = document.getElementById(selId);
    if (!sel) return;
    sel.innerHTML = "";
    for (let m = 0; m < 60; m += 5) {
      const opt = document.createElement("option");
      opt.value = m;
      opt.textContent = ":" + String(m).padStart(2,"0");
      if (m === value || (value !== undefined && Math.abs(m - value) < 5 && !sel.querySelector("[selected]"))) opt.selected = true;
      sel.appendChild(opt);
    }
  }

  async function openSchedulerPanel() {
    const s = await api.getSettings();
    document.getElementById("schedEnabled").checked = s.scheduleEnabled;
    buildHourOptions("schedStartH", s.scheduleStartHour);
    buildMinOptions("schedStartM",  s.scheduleStartMinute);
    buildHourOptions("schedStopH",  s.scheduleStopHour);
    buildMinOptions("schedStopM",   s.scheduleStopMinute);
    document.getElementById("peakEnabled").checked = s.peakHoursEnabled;
    buildHourOptions("peakStartH",  s.peakStartHour);
    buildHourOptions("peakStopH",   s.peakStopHour);
    document.getElementById("peakDlLimit").value = s.peakDownloadLimit ? Math.round(s.peakDownloadLimit/1024) : "";
    document.getElementById("peakUlLimit").value = s.peakUploadLimit  ? Math.round(s.peakUploadLimit/1024) : "";
    openPanel(schedulerPanel);
  }

  document.getElementById("btnCloseScheduler").addEventListener("click", () => closePanel(schedulerPanel));
  document.getElementById("btnSaveScheduler").addEventListener("click", async () => {
    const patch = {
      scheduleEnabled:     document.getElementById("schedEnabled").checked,
      scheduleStartHour:   parseInt(document.getElementById("schedStartH").value) || 0,
      scheduleStartMinute: parseInt(document.getElementById("schedStartM").value) || 0,
      scheduleStopHour:    parseInt(document.getElementById("schedStopH").value) || 23,
      scheduleStopMinute:  parseInt(document.getElementById("schedStopM").value) || 0,
      peakHoursEnabled:    document.getElementById("peakEnabled").checked,
      peakStartHour:       parseInt(document.getElementById("peakStartH").value) || 9,
      peakStopHour:        parseInt(document.getElementById("peakStopH").value) || 18,
      peakDownloadLimit:   (parseInt(document.getElementById("peakDlLimit").value) || 0) * 1024,
      peakUploadLimit:     (parseInt(document.getElementById("peakUlLimit").value) || 0) * 1024,
    };
    await api.updateSettings(patch);
    closePanel(schedulerPanel);
    setStatus("Scheduler settings saved");
  });

  /* ── Site Logins Panel ────────────────────────────────────────── */
  async function openLoginsPanel() {
    await renderCredList();
    openPanel(loginsPanel);
  }

  async function renderCredList() {
    const s = await api.getSettings();
    const creds = s.credentials || [];
    const list = document.getElementById("credentialList");
    if (creds.length === 0) {
      list.innerHTML = `<div style="padding:12px 16px;color:var(--muted);font-size:12px;">No saved credentials yet.</div>`;
      return;
    }
    list.innerHTML = creds.map(c => `
      <div class="cred-row">
        <div class="cred-info">
          <div class="cred-domain">${escHtml(c.domain)}</div>
          <div class="cred-user">${escHtml(c.username)} / ••••••</div>
        </div>
        <button class="cred-remove" data-domain="${escHtml(c.domain)}">Remove</button>
      </div>`).join("");

    list.querySelectorAll(".cred-remove").forEach(btn => {
      btn.addEventListener("click", async () => {
        await api.removeCredential(btn.dataset.domain);
        await renderCredList();
        setStatus("Credential removed: " + btn.dataset.domain);
      });
    });
  }

  document.getElementById("btnCloseLogins").addEventListener("click", () => closePanel(loginsPanel));
  document.getElementById("btnAddCred").addEventListener("click", async () => {
    const domain = document.getElementById("credDomain").value.trim();
    const user   = document.getElementById("credUser").value.trim();
    const pass   = document.getElementById("credPass").value;
    if (!domain || !user) { setStatus("Domain and username required"); return; }
    await api.addCredential({ domain, username: user, password: pass });
    document.getElementById("credDomain").value = "";
    document.getElementById("credUser").value   = "";
    document.getElementById("credPass").value   = "";
    await renderCredList();
    setStatus("Credential saved: " + domain);
  });

  /* ── RSS Panel ─────────────────────────────────────────────────── */
  async function openRssPanel() {
    await renderRssFeeds();
    openPanel(rssPanel);
  }

  async function renderRssFeeds() {
    const feeds = await api.listRssFeeds();
    const list = document.getElementById("rssFeedList");
    if (!feeds || feeds.length === 0) {
      list.innerHTML = `<div style="padding:12px 16px;color:var(--muted);font-size:12px;">No RSS feeds configured yet.</div>`;
      return;
    }
    list.innerHTML = feeds.map(f => `
      <div class="rss-row">
        <span class="rss-enabled ${f.enabled ? "on" : "off"}" title="${f.enabled ? "Active" : "Disabled"}"></span>
        <div class="rss-info">
          <div class="rss-name">${escHtml(f.name)}</div>
          <div class="rss-url">${escHtml(f.url)}</div>
        </div>
        <div class="rss-actions">
          <button class="rss-btn rss-fetch" data-id="${f.id}" title="Fetch now">↻</button>
          <button class="rss-btn rss-toggle" data-id="${f.id}" data-enabled="${f.enabled}">${f.enabled ? "Disable" : "Enable"}</button>
          <button class="rss-btn rss-del" data-id="${f.id}">✕</button>
        </div>
      </div>`).join("");

    list.querySelectorAll(".rss-fetch").forEach(btn => {
      btn.addEventListener("click", async () => {
        btn.textContent = "…";
        try { await api.fetchRssNow(btn.dataset.id); setStatus("RSS feed fetched"); }
        catch { setStatus("RSS fetch failed"); }
        btn.textContent = "↻";
      });
    });
    list.querySelectorAll(".rss-toggle").forEach(btn => {
      btn.addEventListener("click", async () => {
        const enabled = btn.dataset.enabled === "true";
        await api.updateRssFeed(btn.dataset.id, { enabled: !enabled });
        await renderRssFeeds();
      });
    });
    list.querySelectorAll(".rss-del").forEach(btn => {
      btn.addEventListener("click", async () => {
        await api.removeRssFeed(btn.dataset.id);
        await renderRssFeeds(); setStatus("RSS feed removed");
      });
    });
  }

  document.getElementById("btnCloseRss").addEventListener("click", () => closePanel(rssPanel));
  document.getElementById("btnAddRss").addEventListener("click", async () => {
    const name     = document.getElementById("rssFeedName").value.trim();
    const url      = document.getElementById("rssFeedUrl").value.trim();
    const filter   = document.getElementById("rssFeedFilter").value.trim() || undefined;
    const interval = parseInt(document.getElementById("rssFeedInterval").value) || 1800;
    const auto     = document.getElementById("rssFeedAuto").checked;
    if (!name || !url) { setStatus("Name and URL required"); return; }
    try {
      await api.addRssFeed({ name, url, enabled: true, autoDownload: auto, fetchInterval: interval, filter });
      document.getElementById("rssFeedName").value   = "";
      document.getElementById("rssFeedUrl").value    = "";
      document.getElementById("rssFeedFilter").value = "";
      await renderRssFeeds(); setStatus("RSS feed added: " + name);
    } catch (e) { setStatus("Failed to add feed: " + e.message); }
  });

  /* ── Create Torrent Panel ─────────────────────────────────────── */
  document.getElementById("btnCloseCreateTorrent").addEventListener("click", () => closePanel(createTorrentPanel));
  document.getElementById("btnChooseSource").addEventListener("click", async () => {
    const path = await api.chooseFile({ directory: false });
    if (path) document.getElementById("torrentSourcePath").value = path;
  });
  document.getElementById("btnDoCreateTorrent").addEventListener("click", async () => {
    const src     = document.getElementById("torrentSourcePath").value.trim();
    const name    = document.getElementById("torrentName").value.trim() || undefined;
    const tracker = document.getElementById("torrentTracker").value.trim() || undefined;
    const statusEl = document.getElementById("torrentCreateStatus");
    statusEl.className = "torrent-status";
    statusEl.textContent = "";
    if (!src) { setStatus("Choose a source file or folder first"); return; }
    try {
      const result = await api.createTorrent(src, "", name, tracker);
      if (result?.ok) {
        statusEl.className = "torrent-status ok";
        statusEl.textContent = "Created: " + result.outputPath;
        setStatus(".torrent created successfully");
      } else {
        statusEl.className = "torrent-status err";
        statusEl.textContent = "Error: " + (result?.error || "Unknown error");
      }
    } catch (e) {
      statusEl.className = "torrent-status err";
      statusEl.textContent = "Error: " + e.message;
    }
  });

  return { openSchedulerPanel, openLoginsPanel, openRssPanel };
}
