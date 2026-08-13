//! Local HTTP listener for the browser extension - a scoped port of
//! src/browser-integration/listener.ts. The ORIGINAL Electron listener also
//! served a remote web UI (/ui) and video streaming (/stream/:id) - neither
//! of those is ever called by the actual extension (checked service-worker.js
//! and download-dialog.js directly), so this only implements what the
//! extension needs: POST /downloads (submit a link) and GET /health (used
//! by some browsers' extension UI to show a connected/disconnected dot).
//! If you want the remote web UI or streaming back later, port the rest of
//! listener.ts the same way this was done.
use crate::scheduler::Scheduler;
use crate::types::{DownloadKind, DownloadRequest};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, RwLock as StdRwLock};
use tiny_http::{Header, Method, Response, Server};

#[derive(Debug, Deserialize)]
struct IncomingDownload {
    url: String,
    filename: Option<String>,
    start: Option<bool>,
    /// Optional save directory sent by the browser extension.
    /// When present it overrides the app's default download directory
    /// for this one download only — the setting itself is not changed.
    #[serde(rename = "saveDir")]
    save_dir: Option<String>,
}

#[derive(Debug, Serialize)]
struct AcceptedResponse {
    id: String,
    status: String,
}

#[derive(Debug, Serialize)]
struct ErrorResponse {
    error: String,
}

#[derive(Debug, Serialize)]
struct HealthResponse {
    status: &'static str,
    app: &'static str,
    version: &'static str,
}

fn cors_headers() -> Vec<Header> {
    vec![
        Header::from_bytes(&b"Access-Control-Allow-Origin"[..], &b"*"[..]).unwrap(),
        Header::from_bytes(&b"Access-Control-Allow-Methods"[..], &b"GET, POST, OPTIONS"[..]).unwrap(),
        Header::from_bytes(&b"Access-Control-Allow-Headers"[..], &b"content-type, range"[..]).unwrap(),
    ]
}

fn json_header() -> Header {
    Header::from_bytes(&b"Content-Type"[..], &b"application/json"[..]).unwrap()
}

fn url_scheme(url: &str) -> Option<String> {
    url.split_once(':')
        .map(|(scheme, _)| scheme.trim().to_ascii_lowercase())
        .filter(|scheme| !scheme.is_empty())
}

fn is_extension_default_dir(path: &str) -> bool {
    path.trim_matches(|ch| ch == '\\' || ch == '/')
        .eq_ignore_ascii_case("downloads")
}

pub fn start(scheduler: Arc<Scheduler>, settings_snapshot: Arc<StdRwLock<crate::types::AppSettings>>, runtime_handle: tokio::runtime::Handle) {
    let (port, remote_access) = {
        let s = settings_snapshot.read().ok();
        s.map(|s| (s.listener_port, s.remote_access)).unwrap_or((9999, false))
    };
    let host = if remote_access { "0.0.0.0" } else { "127.0.0.1" };
    let addr = format!("{host}:{port}");

    let server = match Server::http(&addr) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("[listener] Failed to bind {addr}: {e} - browser extension capture will not work until this is resolved (port already in use?).");
            return;
        }
    };

    std::thread::spawn(move || {
        for request in server.incoming_requests() {
            handle_request(request, &scheduler, &settings_snapshot, &runtime_handle);
        }
    });
}

fn handle_request(
    request: tiny_http::Request,
    scheduler: &Arc<Scheduler>,
    settings_snapshot: &Arc<StdRwLock<crate::types::AppSettings>>,
    runtime_handle: &tokio::runtime::Handle,
) {
    let method = request.method().clone();
    let url = request.url().to_string();

    if method == Method::Options {
        let response = Response::empty(204);
        let response = cors_headers().into_iter().fold(response, |r, h| r.with_header(h));
        let _ = request.respond(response);
        return;
    }

    if method == Method::Get && (url == "/health" || url == "/") {
        let body = serde_json::to_string(&HealthResponse { status: "ok", app: "Speusis Downloader", version: env!("CARGO_PKG_VERSION") }).unwrap_or_default();
        respond_json(request, 200, &body);
        return;
    }

    if method == Method::Post && url == "/downloads" {
        handle_add_download(request, scheduler, settings_snapshot, runtime_handle);
        return;
    }

    respond_json(request, 404, r#"{"error":"Not found"}"#);
}

fn handle_add_download(
    mut request: tiny_http::Request,
    scheduler: &Arc<Scheduler>,
    settings_snapshot: &Arc<StdRwLock<crate::types::AppSettings>>,
    runtime_handle: &tokio::runtime::Handle,
) {
    let mut body = String::new();
    if std::io::Read::read_to_string(request.as_reader(), &mut body).is_err() {
        respond_json(request, 400, r#"{"error":"Failed to read request body"}"#);
        return;
    }

    let incoming: IncomingDownload = match serde_json::from_str(&body) {
        Ok(v) => v,
        Err(_) => {
            let err = serde_json::to_string(&ErrorResponse { error: "Invalid JSON body".to_string() }).unwrap_or_default();
            respond_json(request, 400, &err);
            return;
        }
    };

    if incoming.url.trim().is_empty() {
        let err = serde_json::to_string(&ErrorResponse { error: "Missing URL".to_string() }).unwrap_or_default();
        respond_json(request, 400, &err);
        return;
    }

    // Keep the extension listener in sync with the in-app Add URL flow.
    // Magnet URIs use "magnet:" (not "magnet://"), so split_once("://")
    // would never recognize them.
    let scheme = url_scheme(&incoming.url);
    let (kind, segment_count, label) = match scheme.as_deref() {
        Some("http") | Some("https") => (DownloadKind::Http, Some(0u32), "Browser capture"),
        Some("ftp") => (DownloadKind::Ftp, Some(0u32), "Browser capture"),
        Some("magnet") => (DownloadKind::Torrent, None, "Browser capture (Torrent)"),
        _ => {
            let err = serde_json::to_string(&ErrorResponse {
                error: "Only http://, https://, ftp://, and magnet: links are supported.".to_string(),
            })
            .unwrap_or_default();
            respond_json(request, 400, &err);
            return;
        }
    };

    let (default_download_dir, segments) = {
        let s = settings_snapshot.read().ok();
        s.map(|s| (s.download_dir.clone(), s.default_segments)).unwrap_or_else(|| (String::new(), 8))
    };

    // The extension displays "Downloads\\" as a placeholder when the user has
    // not selected a real folder. Do not treat that relative placeholder as an
    // override, otherwise the app writes relative to its process directory
    // instead of the configured Downloads folder.
    let target_dir = incoming
        .save_dir
        .as_deref()
        .map(|d| d.trim())
        .filter(|d| !d.is_empty() && !is_extension_default_dir(d))
        .map(|d| d.to_string())
        .unwrap_or(default_download_dir);

    let scheduler = Arc::clone(scheduler);
    let start_flag = incoming.start.unwrap_or(true);
    let req = DownloadRequest {
        url: incoming.url,
        target_dir,
        filename: incoming.filename,
        segment_count: if segment_count == Some(0) { Some(segments) } else { segment_count },
        kind: Some(kind),
        label: Some(label.to_string()),
        speed_limit: None,
        sequential: None,
    };

    let task = runtime_handle.block_on(async move { scheduler.add(req, start_flag).await });
    let body = serde_json::to_string(&AcceptedResponse { id: task.id, status: format!("{:?}", task.status).to_lowercase() }).unwrap_or_default();
    respond_json(request, 202, &body);
}

fn respond_json(request: tiny_http::Request, status: u16, body: &str) {
    let response = Response::from_string(body).with_status_code(status).with_header(json_header());
    let response = cors_headers().into_iter().fold(response, |r, h| r.with_header(h));
    let _ = request.respond(response);
}
