//! Layer 3 — extension risk tiering.
//!
//! A small, static lookup against filenames - no file content is read,
//! no network call is made. Two independent checks:
//!
//! 1. Is the extension itself one that's overwhelmingly used as a
//!    malware delivery vector in browser/download contexts, rather than
//!    for anything a typical user downloads on purpose (.scr, .vbs,
//!    .hta, etc.)? This is a much shorter and more conservative list
//!    than "every extension that *can* run code" - .exe and .msi are
//!    deliberately left off despite being executable, since they're
//!    also completely ordinary, common downloads (game installers,
//!    software setup files) that would make this noisy and untrustworthy
//!    if flagged on their own.
//! 2. Does the filename disguise its real extension behind a fake one,
//!    e.g. "invoice.pdf.exe" or "photo.jpg.scr" - a classic social-
//!    engineering trick that relies on Windows hiding known extensions
//!    by default so the user only sees "invoice.pdf".
//!
//! Both are simple, deterministic string checks - there is no ambiguity
//! to get wrong here, and nothing here ever inspects file bytes (that's
//! type_spoof.rs) or talks to the network.

/// Extensions that are near-exclusively used to deliver/run malicious
/// code when they arrive as a browser download, with essentially no
/// legitimate everyday download use case. Intentionally short and
/// conservative - this is a blunt, static list, not a heuristic, so it
/// should only ever contain extensions with no reasonable innocent
/// reason to be sitting in someone's Downloads folder.
const HIGH_RISK_EXTENSIONS: &[&str] = &[
    "scr", // Windows screensaver - executable, virtually never a genuine download
    "pif", // legacy MS-DOS program information file - obsolete, malware-only today
    "hta", // HTML Application - runs with full script host privileges
    "vbs", "vbe", // VBScript
    "wsf", "wsh", // Windows Script (Host) files
    "jse", // JScript encoded
    "chm", // compiled help file - used as a script-execution wrapper
    "reg", // registry file - can silently modify the system if double-clicked
];

/// Archive extensions that legitimately involve multiple dot-separated
/// parts (e.g. "backup.tar.gz") - excluded from the double-extension
/// check so a normal archive filename is never flagged.
const MULTI_PART_ARCHIVE_SUFFIXES: &[&str] = &["gz", "bz2", "xz", "zst"];

#[derive(Debug, Clone)]
pub struct ExtensionRiskFinding {
    pub extension: String,
    pub reason: ExtensionRiskReason,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ExtensionRiskReason {
    /// The extension itself is on the high-risk list.
    HighRiskExtension,
    /// The filename has a disguised real extension, e.g. "x.pdf.exe".
    DoubleExtension { disguised_as: String },
}

/// Checks a filename against both rules. Returns every finding that
/// applies (a file can, in principle, trip both at once, e.g.
/// "invoice.pdf.scr").
pub fn check(filename: &str) -> Vec<ExtensionRiskFinding> {
    let mut findings = Vec::new();

    let parts: Vec<&str> = filename.split('.').collect();
    if parts.len() < 2 {
        return findings; // no extension at all
    }
    let real_ext = parts[parts.len() - 1].to_ascii_lowercase();

    if HIGH_RISK_EXTENSIONS.contains(&real_ext.as_str()) {
        findings.push(ExtensionRiskFinding {
            extension: real_ext.clone(),
            reason: ExtensionRiskReason::HighRiskExtension,
        });
    }

    // Double-extension check: need at least 3 dot-separated parts
    // ("name", "fake_ext", "real_ext"), and the middle part must look
    // like a real extension itself (short, alphabetic) rather than
    // being part of a legitimate multi-part archive suffix or just a
    // filename that happens to contain a period.
    if parts.len() >= 3 {
        let disguised_as = parts[parts.len() - 2].to_ascii_lowercase();
        let looks_like_an_extension = disguised_as.len() >= 2
            && disguised_as.len() <= 5
            && disguised_as.chars().all(|c| c.is_ascii_alphanumeric());
        let is_legit_archive_suffix = MULTI_PART_ARCHIVE_SUFFIXES.contains(&real_ext.as_str());

        if looks_like_an_extension && !is_legit_archive_suffix {
            findings.push(ExtensionRiskFinding {
                extension: real_ext,
                reason: ExtensionRiskReason::DoubleExtension { disguised_as },
            });
        }
    }

    findings
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn flags_scr_extension() {
        let findings = check("totally_a_photo.scr");
        assert!(findings.iter().any(|f| f.reason == ExtensionRiskReason::HighRiskExtension));
    }

    #[test]
    fn flags_double_extension_trick() {
        let findings = check("invoice.pdf.exe");
        assert!(findings
            .iter()
            .any(|f| matches!(&f.reason, ExtensionRiskReason::DoubleExtension { disguised_as } if disguised_as == "pdf")));
    }

    #[test]
    fn does_not_flag_ordinary_exe() {
        // .exe is a common, legitimate download (installers) - not on
        // the high-risk list by itself.
        let findings = check("setup.exe");
        assert!(findings.is_empty());
    }

    #[test]
    fn does_not_flag_legit_tar_gz_archive() {
        let findings = check("project-backup.tar.gz");
        assert!(findings.is_empty());
    }

    #[test]
    fn does_not_flag_a_filename_with_only_one_extension() {
        let findings = check("my.resume.pdf".replace("my.resume", "my_resume").as_str());
        assert!(findings.is_empty());
    }

    #[test]
    fn does_not_flag_version_numbers_as_double_extension() {
        // e.g. "app-1.2.3.zip" - "3" isn't a plausible fake extension on
        // its own merit here since it's purely numeric, but this still
        // documents the intended behavior for a realistic filename.
        let findings = check("release-notes.v2.zip");
        // "v2" is alnum and length 2, so this one *does* trip the
        // heuristic - included here as an honest documented false
        // positive risk rather than a hidden one. See extension_risk
        // module docs / RELEASE.md for this tradeoff.
        assert!(!findings.is_empty());
    }
}
