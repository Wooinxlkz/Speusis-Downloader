/* Speusis Extension — Download Dialog v0.23 */
"use strict";

const SPEUSIS_ENDPOINT = "http://127.0.0.1:9999/downloads";

/* ── DOM refs ──────────────────────────────────────────────────── */
const urlField      = document.getElementById("urlField");
const filenameField = document.getElementById("filenameField");
const saveDirField  = document.getElementById("saveDirField");
const categoryField = document.getElementById("categoryField");
const catLabel      = document.getElementById("catLabel");
const fileIconSvg   = document.getElementById("fileIconSvg");
const fileSize      = document.getElementById("fileSize");
const ytNotice      = document.getElementById("ytNotice");
const torNotice     = document.getElementById("torNotice");
const spinner       = document.getElementById("spinner");
const statusLine    = document.getElementById("statusLine");
const statusText    = document.getElementById("statusText");
const rememberCb    = document.getElementById("rememberPath");
const rememberBox   = document.getElementById("rememberBox");
const videoSection  = document.getElementById("videoSection");
const qualityList   = document.getElementById("qualityList");
const modalOverlay  = document.getElementById("modalOverlay");
const newCatInput   = document.getElementById("newCatInput");

/* ── Quality labels ────────────────────────────────────────────── */
const QUALITY_LABELS = ["1080p HD","720p HD","480p","360p","240p","144p"];
const BADGE_COLORS   = { HD:"#1d4ed8",SD:"#065f46",LOW:"#6b21a8",HLS:"#dc2626",DASH:"#7c3aed",CMAF:"#7c3aed",Stream:"#6b7280",Subtitle:"#0891b2",MP4:"#ec4899" };

/* ── File type colours ─────────────────────────────────────────── */
const FILE_TYPES = {
  zip:{color:"#f59e0b",bg:"#7c3b00",ext:"ZIP"},rar:{color:"#f59e0b",bg:"#7c3b00",ext:"RAR"},
  "7z":{color:"#f59e0b",bg:"#7c3b00",ext:"7Z"},tar:{color:"#f59e0b",bg:"#7c3b00",ext:"TAR"},
  gz:{color:"#f59e0b",bg:"#7c3b00",ext:"GZ"},bz2:{color:"#f59e0b",bg:"#7c3b00",ext:"BZ2"},
  pdf:{color:"#ef4444",bg:"#7f1d1d",ext:"PDF"},doc:{color:"#3b82f6",bg:"#1e3a8a",ext:"DOC"},
  docx:{color:"#3b82f6",bg:"#1e3a8a",ext:"DOCX"},txt:{color:"#94a3b8",bg:"#374151",ext:"TXT"},
  xls:{color:"#22c55e",bg:"#14532d",ext:"XLS"},xlsx:{color:"#22c55e",bg:"#14532d",ext:"XLSX"},
  csv:{color:"#22c55e",bg:"#14532d",ext:"CSV"},
  mp3:{color:"#a78bfa",bg:"#4c1d95",ext:"MP3"},flac:{color:"#a78bfa",bg:"#4c1d95",ext:"FLAC"},
  wav:{color:"#a78bfa",bg:"#4c1d95",ext:"WAV"},aac:{color:"#a78bfa",bg:"#4c1d95",ext:"AAC"},
  ogg:{color:"#a78bfa",bg:"#4c1d95",ext:"OGG"},m4a:{color:"#a78bfa",bg:"#4c1d95",ext:"M4A"},
  mp4:{color:"#ec4899",bg:"#831843",ext:"MP4"},mkv:{color:"#ec4899",bg:"#831843",ext:"MKV"},
  avi:{color:"#ec4899",bg:"#831843",ext:"AVI"},mov:{color:"#ec4899",bg:"#831843",ext:"MOV"},
  wmv:{color:"#ec4899",bg:"#831843",ext:"WMV"},flv:{color:"#ec4899",bg:"#831843",ext:"FLV"},
  webm:{color:"#ec4899",bg:"#831843",ext:"WEBM"},m3u8:{color:"#ec4899",bg:"#831843",ext:"HLS"},
  mpd:{color:"#a78bfa",bg:"#4c1d95",ext:"DASH"},
  exe:{color:"#f97316",bg:"#7c2d12",ext:"EXE"},msi:{color:"#f97316",bg:"#7c2d12",ext:"MSI"},
  apk:{color:"#22c55e",bg:"#14532d",ext:"APK"},deb:{color:"#f97316",bg:"#7c2d12",ext:"DEB"},
  iso:{color:"#64748b",bg:"#1e293b",ext:"ISO"},img:{color:"#64748b",bg:"#1e293b",ext:"IMG"},
  jpg:{color:"#06b6d4",bg:"#164e63",ext:"JPG"},jpeg:{color:"#06b6d4",bg:"#164e63",ext:"JPEG"},
  png:{color:"#06b6d4",bg:"#164e63",ext:"PNG"},gif:{color:"#06b6d4",bg:"#164e63",ext:"GIF"},
};

/* ── Helpers ───────────────────────────────────────────────────── */
function guessFilename(url) {
  try { const p=new URL(url).pathname; return decodeURIComponent(p.split("/").filter(Boolean).pop()||"download"); }
  catch { return "download"; }
}
function isYouTubeUrl(url) {
  try { const h=new URL(url).hostname; return h.includes("youtube.com")||h.includes("youtu.be"); }
  catch { return false; }
}
function isVideoOrStreamUrl(url, filename) {
  const VIDEO_EXTS=/\.(mp4|mkv|avi|mov|wmv|flv|webm|m3u8|mpd|ts)(\?|#|$)/i;
  try { if (VIDEO_EXTS.test(new URL(url).pathname)) return true; } catch {}
  if (VIDEO_EXTS.test(filename||"")) return true;
  return isYouTubeUrl(url);
}
function isTorrentUrl(url) { return url.startsWith("magnet:")||/\.torrent(\?|#|$)/i.test(url); }
function guessCategory(filename) {
  const ext=(filename||"").split(".").pop()?.toLowerCase();
  const map={
    zip:"Compressed",rar:"Compressed","7z":"Compressed",tar:"Compressed",gz:"Compressed",
    pdf:"Documents",doc:"Documents",docx:"Documents",txt:"Documents",xls:"Documents",xlsx:"Documents",
    mp3:"Music",flac:"Music",wav:"Music",aac:"Music",ogg:"Music",m4a:"Music",
    mp4:"Video",mkv:"Video",avi:"Video",mov:"Video",wmv:"Video",flv:"Video",webm:"Video",m3u8:"Video",
    exe:"Programs",msi:"Programs",apk:"Programs",deb:"Programs",
  };
  return map[ext]||"General";
}
function formatBytes(b) {
  if (!b||b<=0) return "Unknown size";
  const units=["B","KB","MB","GB"];
  const i=Math.min(units.length-1,Math.floor(Math.log(b)/Math.log(1024)));
  return `${(b/1024**i).toFixed(2)} ${units[i]}`;
}
function qualitySlug(label) {
  const m=String(label||"").match(/(\d{3,4})p/i);
  return m?m[1]+"p":String(label||"video").replace(/\s+/g,"-").toLowerCase();
}
function makeVideoFilename(title, quality) {
  return `${sanitize(title)}${quality?`_${qualitySlug(quality)}`:""}.mp4`;
}
const YT_ITAG_RANK={"22":1,"18":3,"36":5,"17":7};
function rankStream(s) {
  if (s.type==="Subtitle") return 900; // always sort after video/audio options
  if (s.ytItag && !s.needsMux) return YT_ITAG_RANK[s.ytItag]??99;
  // Muxed/adaptive entries carry a real resolution in .quality ("1080p60 (muxed)") —
  // sort by that number so 4K/1440p actually outrank 1080p/720p, instead of
  // falling through to the URL-text guess below (googlevideo URLs don't contain
  // human-readable resolution text, so that guess never matched adaptive URLs).
  const qm=String(s.quality||"").match(/(\d{3,4})p/i);
  if (qm) return 1000-parseInt(qm[1],10);
  const u=(s.url||"").toLowerCase();
  if (/2160|4k|uhd/.test(u)) return 0; if (/1440|2k/.test(u)) return 1;
  if (/1080/.test(u)) return 2; if (/720/.test(u)) return 3;
  if (/480/.test(u)) return 4; if (/360/.test(u)) return 5;
  if (/240/.test(u)) return 6; if (/144/.test(u)) return 7; return 99;
}
function labelStream(s, i) {
  if (s.quality) return s.quality;
  const u=(s.url||"").toLowerCase();
  if (/2160|4k|uhd/.test(u)) return "2160p 4K"; if (/1440|2k/.test(u)) return "1440p QHD";
  if (/1080/.test(u)) return "1080p HD"; if (/720/.test(u)) return "720p HD";
  if (/480/.test(u)) return "480p"; if (/360/.test(u)) return "360p";
  if (/240/.test(u)) return "240p"; if (/144/.test(u)) return "144p";
  return QUALITY_LABELS[i]||`Stream ${i+1}`;
}
function getSaveDirs() { try { return JSON.parse(localStorage.getItem("__speusis_saveDirs")||"{}"); } catch { return {}; } }
function setSaveDirs(d) { try { localStorage.setItem("__speusis_saveDirs",JSON.stringify(d)); } catch {} }

/* ── Render file icon ──────────────────────────────────────────── */
function renderFileIcon(filename, isYT) {
  const ext=(filename||"").split(".").pop()?.toLowerCase()||"";
  if (isYT) {
    fileIconSvg.innerHTML=`<rect x="1" y="1" width="50" height="58" rx="5" fill="#7f1d1d" stroke="#dc2626" stroke-width="1.5"/>
      <rect x="10" y="20" width="32" height="22" rx="4" fill="#dc2626"/>
      <path d="M22 26l14 5-14 5V26z" fill="white"/>
      <text x="26" y="56" font-family="monospace" font-size="7" font-weight="700" fill="#fca5a5" text-anchor="middle">YouTube</text>`;
    return;
  }
  if (isTorrentUrl(filename||"")) {
    fileIconSvg.innerHTML=`<rect x="1" y="1" width="50" height="58" rx="5" fill="#451a03" stroke="#d97706" stroke-width="1.5"/>
      <path d="M26 14c-7 0-12 5-12 12s5 12 12 12 12-5 12-12" stroke="#d97706" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <polyline points="19,21 26,14 33,21" stroke="#d97706" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="5" y="38" width="42" height="18" rx="3" fill="#d97706"/>
      <text x="26" y="51" font-family="monospace,sans-serif" font-size="8" font-weight="800" fill="white" text-anchor="middle">TORRENT</text>`;
    return;
  }
  const ft=FILE_TYPES[ext];
  if (!ft) {
    fileIconSvg.innerHTML=`<rect x="1" y="1" width="50" height="58" rx="5" fill="#27272a" stroke="#3f3f46" stroke-width="1.5"/>
      <path d="M26 18v16M19.5 28l6.5 8 6.5-8" stroke="#fafafa" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
      <line x1="16" y1="45" x2="36" y2="45" stroke="#fafafa" stroke-width="2" stroke-linecap="round"/>`;
    return;
  }
  const fs=ft.ext.length<=3?"10":ft.ext.length===4?"8.5":"7.5";
  fileIconSvg.innerHTML=`<rect x="1" y="1" width="50" height="58" rx="5" fill="${ft.bg}" stroke="${ft.color}" stroke-width="1.5"/>
    <path d="M33 1v12h12" stroke="${ft.color}" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity=".6"/>
    <rect x="3" y="38" width="46" height="18" rx="3" fill="${ft.color}"/>
    <text x="26" y="51" font-family="monospace,sans-serif" font-size="${fs}" font-weight="800" fill="white" text-anchor="middle" letter-spacing=".5">${ft.ext}</text>
    <line x1="9" y1="20" x2="31" y2="20" stroke="${ft.color}" stroke-width="1.5" stroke-linecap="round" opacity=".6"/>
    <line x1="9" y1="26" x2="27" y2="26" stroke="${ft.color}" stroke-width="1.5" stroke-linecap="round" opacity=".4"/>
    <line x1="9" y1="32" x2="23" y2="32" stroke="${ft.color}" stroke-width="1.5" stroke-linecap="round" opacity=".3"/>`;
}

/* ── Quality rows ──────────────────────────────────────────────── */
let _pendingYtQuality="";
let _pendingMux=null; // {videoUrl, audioUrl} when the chosen row needs backend muxing
let _pendingPageUrl=null; // the tab this download was captured from - sent as Referer so hotlink-protected CDNs (most video/stream URLs) don't 403
function chooseQuality(row, fallbackUrl, pageTitle) {
  const dlUrl   = row.dataset.url||fallbackUrl;
  const quality = row.dataset.quality||row.dataset.type||"";
  const fname   = row.dataset.filename||makeVideoFilename(pageTitle,quality);
  _pendingYtQuality=quality;
  _pendingMux = row.dataset.needsMux==="1"
    ? { videoUrl: row.dataset.videoUrl, audioUrl: row.dataset.audioUrl }
    : null;
  urlField.value=dlUrl; filenameField.value=fname;
  categoryField.value="Video"; catLabel.textContent="Video";
  renderFileIcon(fname,false);
  fileSize.textContent=row.dataset.type?"Stream":fileSize.textContent;
  videoSection.style.display="none";
  document.body.classList.remove("quality-mode");
  setStatus(`Selected ${quality||"video stream"}${_pendingMux?" — desktop app will mux video+audio":""}. Press Start Download or Download Later.`,"");
  filenameField.focus(); filenameField.select();
}
function buildQualityRows(data) {
  const url=data.url||"", isYT=isYouTubeUrl(url);
  const pageTitle=data.pageTitle||guessFilename(url)||"video";
  const streams=(data.streams||[]).filter(s=>s&&s.url);
  if (streams.length===0 && data.needsMux && data.videoUrl && data.audioUrl) {
    // Single muxed item sent directly from the badge (no full streams list attached).
    streams.push({ url:data.videoUrl, videoUrl:data.videoUrl, audioUrl:data.audioUrl, needsMux:true, type:"MP4", quality:"Selected quality (muxed)" });
  }
  if (streams.length>0) {
    const sorted=[...streams].sort((a,b)=>rankStream(a)-rankStream(b));
    qualityList.innerHTML=sorted.map((s,i)=>{
      const ql=labelStream(s,i),bt=s.type||"HLS",bc=BADGE_COLORS[bt]||"#1d4ed8";
      const fname=s.type==="Subtitle"?`${sanitize(pageTitle)}.${(s.quality||"en").slice(0,5).replace(/[^a-z0-9]/gi,"")}.vtt`:makeVideoFilename(pageTitle,ql);
      const info=`${pageTitle.slice(0,44)} — ${bt} — ${ql}`;
      return `<div class="vq-row" data-url="${escAttr(s.url)}" data-type="${escAttr(bt)}" data-quality="${escAttr(ql)}" data-filename="${escAttr(fname)}" data-idx="${i}" data-needs-mux="${s.needsMux?"1":"0"}" data-video-url="${escAttr(s.videoUrl||"")}" data-audio-url="${escAttr(s.audioUrl||"")}">
        <span class="vq-num">${i+1}.</span>
        <span class="vq-info" title="${escAttr(info)}">${escHtml(info)}</span>
        <span class="vq-badge" style="background:${bc}">${bt}</span>
        <button class="vq-dl-btn" data-idx="${i}">↓</button></div>`;
    }).join("");
    wireQualityRows(url,pageTitle);
    document.getElementById("btnVideoDownload")?.addEventListener("click",()=>{
      const r=qualityList.querySelector(".vq-row"); if(r) chooseQuality(r,url,pageTitle);
    });
    // Only one real stream was detected (the common case: clicking a
    // single quality badge, or a page with just one video source) -
    // skip the picker screen and go straight to the final Save-As
    // screen instead of making the user click through a 1-item list.
    if (sorted.length === 1) {
      const onlyRow = qualityList.querySelector(".vq-row");
      if (onlyRow) chooseQuality(onlyRow, url, pageTitle);
    }
  } else if (isYT) {
    qualityList.innerHTML=`<div style="padding:18px 12px;text-align:center;color:#a1a1aa;font-size:12px;line-height:1.6">
      <div style="font-size:22px;margin-bottom:8px">▶</div>
      <div style="color:#fafafa;font-weight:600;margin-bottom:6px">No streams detected yet</div>
      <div>Play the YouTube video in the browser tab first,<br>then click the <strong>Speusis</strong> button that appears on the page.</div>
      <div style="margin-top:10px;padding:8px;background:#18181b;border-radius:4px;font-size:11px;color:#71717a">
        The extension captures the stream URL automatically while the video loads.</div></div>`;
    document.getElementById("btnVideoDownload")?.addEventListener("click",()=>{
      setStatus("Play the video in your browser tab first, then use the Speusis button on the page.","error");
    });
    const btnStart=document.getElementById("btnStart"),btnLater=document.getElementById("btnLater");
    if(btnStart) btnStart.disabled=true; if(btnLater) btnLater.disabled=true;
    setStatus("Play the video first to detect the stream URL.","");
  } else {
    const qualities=[{label:"Best Quality",fmt:"MP4",badge:"HD"},{label:"Medium Quality",fmt:"MP4",badge:"SD"}];
    qualityList.innerHTML=qualities.map((q,i)=>{
      const bc=BADGE_COLORS[q.badge]||"#1d4ed8",fname=makeVideoFilename(pageTitle,q.label);
      const info=`${pageTitle.slice(0,44)} — ${q.fmt} — ${q.label}`;
      return `<div class="vq-row" data-url="${escAttr(url)}" data-quality="${escAttr(q.label)}" data-filename="${escAttr(fname)}" data-idx="${i}">
        <span class="vq-num">${i+1}.</span>
        <span class="vq-info" title="${escAttr(info)}">${escHtml(info)}</span>
        <span class="vq-badge" style="background:${bc}">${q.badge}</span>
        <button class="vq-dl-btn" data-idx="${i}">↓</button></div>`;
    }).join("");
    wireQualityRows(url,pageTitle);
    document.getElementById("btnVideoDownload")?.addEventListener("click",()=>{
      const r=qualityList.querySelector(".vq-row"); if(r) chooseQuality(r,url,pageTitle);
    });
  }
  document.getElementById("btnDlAll")?.addEventListener("click",()=>{
    document.getElementById("btnDlAll").classList.toggle("collapsed");
    qualityList.classList.toggle("collapsed");
  });
  document.getElementById("btnVideoClose")?.addEventListener("click",()=>window.close());
}
function wireQualityRows(url, pageTitle) {
  qualityList.querySelectorAll(".vq-dl-btn").forEach(btn=>btn.addEventListener("click",e=>{
    e.stopPropagation(); chooseQuality(btn.closest(".vq-row"),url,pageTitle);
  }));
  qualityList.querySelectorAll(".vq-row").forEach(row=>row.addEventListener("click",e=>{
    if(e.target.classList.contains("vq-dl-btn")) return; chooseQuality(row,url,pageTitle);
  }));
}

/* ── Init ──────────────────────────────────────────────────────── */
async function init() {
  const verEl = document.getElementById("titlebarVersion");
  if (verEl) verEl.textContent = "v" + chrome.runtime.getManifest().version;

  const data=await new Promise(res=>
    chrome.runtime.sendMessage({type:"speusis-get-dialog-data"},d=>res(d||null))
  );
  if (!data) { setStatus("No download data received. Close this window.","error"); return; }

  _pendingPageUrl = data.pageUrl || null;

  const url=data.url||"", filename=data.suggestedFilename||guessFilename(url);
  const isYT=data.isYouTube||isYouTubeUrl(url), isTor=isTorrentUrl(url);
  const isVideo=isVideoOrStreamUrl(url,filename);

  urlField.value=url; filenameField.value=filename;

  const cat=guessCategory(filename);
  for (const opt of categoryField.options) {
    if (opt.value===cat||opt.text===cat){categoryField.value=opt.value;break;}
  }
  catLabel.textContent=categoryField.value||"General";

  // Load custom categories from localStorage
  const customCats=JSON.parse(localStorage.getItem("__speusis_categories")||"[]");
  customCats.forEach(c=>{ if(![...categoryField.options].some(o=>o.value===c)){
    const o=document.createElement("option"); o.value=o.textContent=c; categoryField.appendChild(o);
  }});

  const dirs=getSaveDirs();
  saveDirField.value=dirs[cat]||"Downloads\\";

  renderFileIcon(filename,isYT);
  if (data.fileSize) fileSize.textContent=formatBytes(data.fileSize);
  else if (!isYT&&!isTor) fetchFileSize(url);

  if (isYT||data.isStream||isVideo) {
    fileSize.textContent=isYT?"Stream":(fileSize.textContent||"Stream");
    document.body.classList.add("quality-mode");
    videoSection.style.display="flex";
    buildQualityRows(data);
  }
  if (isYT) ytNotice.style.display="block";
  if (isTor){torNotice.style.display="block";fileSize.textContent="P2P";}
}

async function fetchFileSize(url) {
  try {
    const r=await fetch(url,{method:"HEAD",mode:"cors"});
    const l=r.headers.get("content-length");
    if (l&&Number(l)>0) fileSize.textContent=formatBytes(Number(l));
  } catch {}
}

/* ── Category / path sync ──────────────────────────────────────── */
categoryField.addEventListener("change",()=>{
  const cat=categoryField.value||"General";
  catLabel.textContent=cat;
  saveDirField.value=getSaveDirs()[cat]||"Downloads\\";
});
saveDirField.addEventListener("change",()=>{
  if(!rememberCb.checked) return;
  const dirs=getSaveDirs(); dirs[categoryField.value||"General"]=saveDirField.value; setSaveDirs(dirs);
});
rememberCb.addEventListener("change",()=>{
  rememberBox.style.display=rememberCb.checked?"":"none";
  if(rememberCb.checked){const dirs=getSaveDirs();dirs[categoryField.value||"General"]=saveDirField.value;setSaveDirs(dirs);}
});
filenameField.addEventListener("input",()=>{
  renderFileIcon(filenameField.value,false);
  const cat=guessCategory(filenameField.value);
  for(const opt of categoryField.options){if(opt.value===cat||opt.text===cat){categoryField.value=opt.value;break;}}
  catLabel.textContent=categoryField.value||"General";
});

/* ── Browse button — native folder picker ──────────────────────── */
document.getElementById("btnBrowse").addEventListener("click",async()=>{
  if (!window.showDirectoryPicker) {
    setStatus("Folder picker not supported in this browser. Type the path manually.","error"); return;
  }
  try {
    const handle=await window.showDirectoryPicker({mode:"readwrite"});
    saveDirField.value=handle.name;
    if(rememberCb.checked){
      const dirs=getSaveDirs(); dirs[categoryField.value||"General"]=handle.name; setSaveDirs(dirs);
    }
  } catch(e){
    if(e.name!=="AbortError") setStatus("Could not open folder picker: "+e.message,"error");
  }
});

/* ── Add Category modal ────────────────────────────────────────── */
document.getElementById("btnAddCat").addEventListener("click",()=>{
  newCatInput.value="";
  modalOverlay.classList.add("open");
  setTimeout(()=>newCatInput.focus(),60);
});
document.getElementById("modalCancel").addEventListener("click",()=>modalOverlay.classList.remove("open"));
document.getElementById("modalOk").addEventListener("click",()=>addCategory());
newCatInput.addEventListener("keydown",e=>{ if(e.key==="Enter") addCategory(); if(e.key==="Escape") modalOverlay.classList.remove("open"); });
function addCategory(){
  const name=newCatInput.value.trim();
  if(!name){newCatInput.focus();return;}
  if(![...categoryField.options].some(o=>o.value===name)){
    const opt=document.createElement("option"); opt.value=opt.textContent=name; categoryField.appendChild(opt);
    const cats=JSON.parse(localStorage.getItem("__speusis_categories")||"[]");
    if(!cats.includes(name)){cats.push(name);localStorage.setItem("__speusis_categories",JSON.stringify(cats));}
  }
  categoryField.value=name; catLabel.textContent=name;
  saveDirField.value=getSaveDirs()[name]||"Downloads\\";
  modalOverlay.classList.remove("open");
}

/* ── Main buttons ──────────────────────────────────────────────── */
document.getElementById("btnStart" ).addEventListener("click",()=>startDownload(false));
document.getElementById("btnLater" ).addEventListener("click",()=>startDownload(true));
document.getElementById("btnCancel").addEventListener("click",()=>window.close());

async function startDownload(later) {
  const url=urlField.value.trim();
  if(!url){setStatus("URL is empty.","error");return;}
  const isYtWatchPage=isYouTubeUrl(url)&&!url.includes("googlevideo.com")&&!url.includes(".m3u8")&&!url.includes(".mpd");
  if(isYtWatchPage){setStatus("Play the video in your browser tab first so the stream is detected, then click the Speusis button on the page.","error");return;}
  const filename=filenameField.value.trim();
  if(rememberCb.checked&&saveDirField.value.trim()){
    const dirs=getSaveDirs(); dirs[categoryField.value||"General"]=saveDirField.value.trim(); setSaveDirs(dirs);
  }
  doDownload(url,filename,later,_pendingYtQuality||undefined);
}

async function doDownload(url, filename, later, ytQuality) {
  setSpinner(true);
  setStatus(later?"Adding to queue…":"Connecting to Speusis…","");
  try {
    const body={url, filename:filename||undefined, start:!later};
    if(ytQuality) body.ytQuality=ytQuality;
    if(_pendingPageUrl) body.pageUrl=_pendingPageUrl;
    if(_pendingMux){
      // Two-source download — video-only + audio-only streams that the
      // desktop app's Rust backend needs to fetch and mux into one file.
      // NOTE: this requires mux support added on that side — the extension
      // can only detect and hand off the pair, not merge them itself.
      body.needsMux=true; body.videoUrl=_pendingMux.videoUrl; body.audioUrl=_pendingMux.audioUrl;
    }
    const saveDir=saveDirField.value.trim();
    if(saveDir) body.saveDir=saveDir;

    const res=await fetch(SPEUSIS_ENDPOINT,{
      method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify(body),
    });
    if(!res.ok){const b=await res.json().catch(()=>({}));throw new Error(b.error||`Speusis returned HTTP ${res.status}`);}
    setSpinner(false);
    setStatus(later?"✔ Added to queue!":"✔ Download started!","success");
    setTimeout(()=>window.close(),1200);
  } catch(err){
    setSpinner(false);
    const msg=String(err.message||err);
    if(msg.toLowerCase().includes("fetch")||msg.toLowerCase().includes("networkerror")||msg.toLowerCase().includes("failed to fetch"))
      setStatus("Speusis is not running. Please open the Speusis Downloader desktop app first.","error");
    else setStatus(msg,"error");
  }
}

function setSpinner(show){spinner.style.display=show?"inline-block":"none";}
function setStatus(msg,type){statusText.textContent=msg;statusLine.className=type==="error"?"error":type==="success"?"success":"";}
function escHtml(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
function escAttr(s){return String(s).replace(/"/g,"&quot;");}
function sanitize(s){return(s||"video").replace(/[<>:"/\\|?*\x00-\x1f]/g,"").trim().slice(0,100)||"video";}

init();
