//! Local, zero-cost, zero-network security checks - separate from
//! `security_scanner.rs` (which shells out to Windows Defender/ClamAV
//! and needs those installed and running). Everything in this module:
//!
//!   - runs entirely offline, with no external process or API call
//!   - is independently toggleable per-check via AppSettings
//!   - only ever *reports* a finding - never blocks, quarantines, or
//!     deletes a file. The user always keeps full control.
//!   - degrades to "nothing found" on any I/O error rather than ever
//!     reporting a false positive from a failure
//!
//! Two layers today:
//!   1. type_spoof   - does the file's real (magic-byte) type match its
//!                     extension?
//!   2. extension_risk - is the extension itself high-risk, or does the
//!                       filename hide a real extension behind a fake
//!                       one (double-extension trick)?
//!
//! Both write into the *same* `LocalSecurityReport` but as clearly
//! separate, independently-labeled findings - so the UI (and the user)
//! can always tell exactly which check said what, and any one check
//! being off never hides or changes what another check reports.

pub mod extension_risk;
pub mod type_spoof;

use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalSecurityFinding {
    /// Which check produced this - "type-spoof" or "extension-risk".
    /// Kept as a plain string (not an enum) so new layers can be added
    /// later without a breaking change to this struct's shape.
    pub layer: String,
    /// Short, human-readable summary safe to show directly in a badge
    /// or list item.
    pub summary: String,
    /// Always "warning" today - every finding here is informational,
    /// never a hard block. Kept as a field (not implied) so a future
    /// layer could introduce a lower "info" severity without a
    /// breaking change.
    pub severity: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct LocalSecurityReport {
    pub findings: Vec<LocalSecurityFinding>,
    /// Which layers actually ran (respecting each one's own on/off
    /// setting) - so the UI can honestly show "Extension check: off"
    /// rather than silently implying a clean result covered everything.
    pub type_spoof_checked: bool,
    pub extension_risk_checked: bool,
}

impl LocalSecurityReport {
    pub fn is_clean(&self) -> bool {
        self.findings.is_empty()
    }
}

/// Runs whichever of the two local checks are enabled and returns a
/// combined report. `path` is the completed file on disk; `filename`
/// is its display name (used for the extension-based checks - kept
/// separate from `path` since callers already have both on hand from
/// `DownloadCompleted`/`DownloadTask` and this avoids re-deriving it
/// from a full path here).
///
/// Never returns `Err` - an I/O failure inside one layer (e.g. the file
/// vanished between download-complete and this running) just means
/// that layer contributes no findings, exactly like "nothing to
/// report". A local-checks failure should never surface as a security
/// warning; the alternative (treating an I/O error as suspicious) is
/// exactly the kind of false positive this module exists to avoid.
pub async fn run_local_checks(
    path: impl AsRef<Path>,
    filename: &str,
    type_spoof_enabled: bool,
    extension_risk_enabled: bool,
) -> LocalSecurityReport {
    let mut report = LocalSecurityReport {
        type_spoof_checked: type_spoof_enabled,
        extension_risk_checked: extension_risk_enabled,
        ..Default::default()
    };

    if type_spoof_enabled {
        if let Ok(Some(finding)) = type_spoof::check(&path, filename).await {
            report.findings.push(LocalSecurityFinding {
                layer: "type-spoof".to_string(),
                summary: format!(
                    "File is named .{} but is actually {}",
                    finding.claimed_extension, finding.detected_type
                ),
                severity: "warning".to_string(),
            });
        }
        // Ok(None) = agrees, nothing to report. Err = I/O failure,
        // silently skipped - see doc comment above.
    }

    if extension_risk_enabled {
        for finding in extension_risk::check(filename) {
            let summary = match finding.reason {
                extension_risk::ExtensionRiskReason::HighRiskExtension => format!(
                    ".{} is a file type almost never used for legitimate downloads",
                    finding.extension
                ),
                extension_risk::ExtensionRiskReason::DoubleExtension { disguised_as } => format!(
                    "Filename disguises a .{} file as .{}",
                    finding.extension, disguised_as
                ),
            };
            report.findings.push(LocalSecurityFinding {
                layer: "extension-risk".to_string(),
                summary,
                severity: "warning".to_string(),
            });
        }
    }

    report
}
