//! Leveled, rotating debug/trace logging - separate from main.rs's
//! crash-only panic log (crash.log). This build has no console
//! attached in release (windows_subsystem = "windows"), so
//! eprintln! output goes nowhere - writing to a file is the only way
//! to see what's actually happening.
//!
//! v0.5.68: replaced the old always-on, ungated logger (every one of
//! the 50+ call sites fired unconditionally, and the file had no size
//! cap so it grew forever on a long-running install) with:
//!   - Levels (Error/Warn/Info/Debug/Trace). A message below the
//!     current level is skipped before any formatting or file I/O
//!     happens - just one atomic load per call site.
//!   - A runtime level, "debug_log_level" in Settings (default
//!     "info"), read at startup and re-applied instantly whenever the
//!     user changes it - see main.rs's setup() and
//!     commands::settings_update.
//!   - Size-based rotation: once debug.log passes ROTATE_AT_BYTES it's
//!     renamed to debug.log.1 (the previous .1, if any, is dropped)
//!     and a fresh debug.log is started, so this file can no longer
//!     grow without bound.
//!
//! All pre-existing call sites (`debug_log::log(...)`) are untouched
//! and behave exactly as before once debug_log_level is set to
//! "debug" or "trace" - `log()` is now a thin alias for `debug()` so
//! nothing at any of those call sites needed to change. Under the new
//! "info" default they simply stay quiet, which is the actual fix:
//! the module was documented as "temporary/diagnostic" and meant to be
//! gated behind a flag, and now it is.

use std::io::Write;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU8, Ordering};
use std::sync::OnceLock;

/// debug.log is rotated to debug.log.1 once it reaches this size.
const ROTATE_AT_BYTES: u64 = 5 * 1024 * 1024; // 5 MB

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
#[repr(u8)]
pub enum Level {
    Error = 0,
    Warn = 1,
    Info = 2,
    Debug = 3,
    Trace = 4,
}

impl Level {
    fn as_str(self) -> &'static str {
        match self {
            Level::Error => "ERROR",
            Level::Warn => "WARN",
            Level::Info => "INFO",
            Level::Debug => "DEBUG",
            Level::Trace => "TRACE",
        }
    }

    /// Unrecognized/empty strings fall back to Info rather than
    /// erroring - a bad or missing setting should never take logging
    /// down entirely.
    pub fn from_str(s: &str) -> Level {
        match s.trim().to_ascii_lowercase().as_str() {
            "error" => Level::Error,
            "warn" | "warning" => Level::Warn,
            "info" => Level::Info,
            "debug" => Level::Debug,
            "trace" => Level::Trace,
            _ => Level::Info,
        }
    }
}

static LOG_PATH: OnceLock<Option<PathBuf>> = OnceLock::new();
static CURRENT_LEVEL: AtomicU8 = AtomicU8::new(Level::Info as u8);

pub fn init(path: PathBuf) {
    let _ = LOG_PATH.set(Some(path));
}

/// Sets the minimum level that gets written; anything less severe is
/// skipped. Safe to call at any time, from any thread - takes effect
/// on the very next log call, no restart needed.
pub fn set_level(level: Level) {
    CURRENT_LEVEL.store(level as u8, Ordering::Relaxed);
}

/// Convenience wrapper for callers holding the setting as a String
/// (as it's stored in AppSettings/settings.json).
pub fn set_level_from_str(s: &str) {
    set_level(Level::from_str(s));
}

fn enabled(level: Level) -> bool {
    (level as u8) <= CURRENT_LEVEL.load(Ordering::Relaxed)
}

/// Renames debug.log -> debug.log.1 (dropping any previous .1) once
/// it crosses ROTATE_AT_BYTES. Best-effort: any failure here (locked
/// file, permissions, etc.) just means rotation is skipped for this
/// write, never a crash or a lost log line.
fn rotate_if_needed(path: &PathBuf) {
    let Ok(meta) = std::fs::metadata(path) else { return };
    if meta.len() < ROTATE_AT_BYTES {
        return;
    }
    let rotated = path.with_extension("log.1");
    let _ = std::fs::remove_file(&rotated);
    let _ = std::fs::rename(path, &rotated);
}

fn write_line(level: Level, msg: &str) {
    if !enabled(level) {
        return;
    }
    let path = LOG_PATH.get_or_init(|| None);
    let Some(path) = path else { return };
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    rotate_if_needed(path);
    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(path) {
        let _ = writeln!(f, "[unix:{secs}] [{}] {msg}", level.as_str());
    }
}

pub fn error(msg: &str) {
    write_line(Level::Error, msg);
}

pub fn warn(msg: &str) {
    write_line(Level::Warn, msg);
}

pub fn info(msg: &str) {
    write_line(Level::Info, msg);
}

pub fn debug(msg: &str) {
    write_line(Level::Debug, msg);
}

pub fn trace(msg: &str) {
    write_line(Level::Trace, msg);
}

/// Back-compat alias: every call site from before v0.5.68 uses
/// `log(&str)`, at what was in effect debug severity (the module was
/// "debug tracing"). Kept so none of those 50+ existing call sites
/// need to change - they now honor the level filter instead of
/// always firing.
pub fn log(msg: &str) {
    debug(msg);
}
