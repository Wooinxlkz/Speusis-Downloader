//! Layer 1 — file-type spoof detection.
//!
//! Reads the first bytes of a downloaded file and compares its *actual*
//! type (from well-known magic-byte signatures) against what its file
//! extension claims. Purely local, purely deterministic — either the
//! bytes match a known signature or they don't, so this can never
//! produce a "maybe" and never calls out to the network. No new crate
//! dependency: this only needs a handful of bytes and a match statement.
//!
//! Deliberately conservative: an extension/signature mismatch is only
//! ever reported when we *positively identified* the real type from its
//! magic bytes AND that identified type actively disagrees with the
//! extension. Anything we don't recognize is left alone rather than
//! guessed at — the goal is zero false positives, not maximum coverage.

use std::path::Path;
use tokio::fs::File;
use tokio::io::AsyncReadExt;

/// The broad type family a signature maps to. Extensions are grouped
/// into the same families below so that e.g. "jpg" vs "jpeg", or
/// "docx"/"xlsx"/"zip" (all actually PK-zip containers), don't get
/// flagged against each other.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum TypeFamily {
    Executable,
    Pdf,
    ZipContainer, // zip, docx, xlsx, pptx, jar, apk - all share the PK signature
    Jpeg,
    Png,
    Gif,
    RarArchive,
    SevenZipArchive,
    GzipArchive,
    Mp3,
    Elf, // Linux/Unix executable
    MachO, // macOS executable
}

/// Identify the real type from the first bytes of a file, matching the
/// longest/most specific signature first (e.g. Office files are zip
/// containers, so they'd otherwise also match the bare PK signature).
fn identify(bytes: &[u8]) -> Option<TypeFamily> {
    if bytes.len() < 4 {
        return None;
    }
    match bytes {
        [0x4D, 0x5A, ..] => Some(TypeFamily::Executable), // "MZ"
        [0x7F, 0x45, 0x4C, 0x46, ..] => Some(TypeFamily::Elf),
        [0xCF, 0xFA, 0xED, 0xFE, ..]
        | [0xFE, 0xED, 0xFA, 0xCF, ..]
        | [0xCA, 0xFE, 0xBA, 0xBE, ..] => Some(TypeFamily::MachO),
        [0x25, 0x50, 0x44, 0x46, ..] => Some(TypeFamily::Pdf), // "%PDF"
        [0x50, 0x4B, 0x03, 0x04, ..] | [0x50, 0x4B, 0x05, 0x06, ..] => Some(TypeFamily::ZipContainer),
        [0xFF, 0xD8, 0xFF, ..] => Some(TypeFamily::Jpeg),
        [0x89, 0x50, 0x4E, 0x47, ..] => Some(TypeFamily::Png),
        [0x47, 0x49, 0x46, 0x38, ..] => Some(TypeFamily::Gif),
        [0x52, 0x61, 0x72, 0x21, ..] => Some(TypeFamily::RarArchive), // "Rar!"
        [0x37, 0x7A, 0xBC, 0xAF, ..] => Some(TypeFamily::SevenZipArchive),
        [0x1F, 0x8B, ..] => Some(TypeFamily::GzipArchive),
        [0x49, 0x44, 0x33, ..] => Some(TypeFamily::Mp3), // ID3 tag
        [0xFF, 0xFB, ..] | [0xFF, 0xF3, ..] | [0xFF, 0xF2, ..] => Some(TypeFamily::Mp3), // frame sync, no ID3 tag
        _ => None,
    }
}

fn family_for_extension(ext: &str) -> Option<TypeFamily> {
    match ext.to_ascii_lowercase().as_str() {
        "exe" | "dll" | "scr" | "com" | "cpl" | "msi" => Some(TypeFamily::Executable),
        "elf" | "bin" | "out" | "so" => Some(TypeFamily::Elf),
        "app" | "dylib" => Some(TypeFamily::MachO),
        "pdf" => Some(TypeFamily::Pdf),
        "zip" | "docx" | "xlsx" | "pptx" | "jar" | "apk" | "epub" => Some(TypeFamily::ZipContainer),
        "jpg" | "jpeg" | "jfif" => Some(TypeFamily::Jpeg),
        "png" => Some(TypeFamily::Png),
        "gif" => Some(TypeFamily::Gif),
        "rar" => Some(TypeFamily::RarArchive),
        "7z" => Some(TypeFamily::SevenZipArchive),
        "gz" | "tgz" => Some(TypeFamily::GzipArchive),
        "mp3" => Some(TypeFamily::Mp3),
        _ => None, // unrecognized extension - never flagged, never guessed at
    }
}

fn family_label(family: TypeFamily) -> &'static str {
    match family {
        TypeFamily::Executable => "an executable program",
        TypeFamily::Elf => "a Linux executable",
        TypeFamily::MachO => "a macOS executable",
        TypeFamily::Pdf => "a PDF document",
        TypeFamily::ZipContainer => "a ZIP-based file (archive/Office document)",
        TypeFamily::Jpeg => "a JPEG image",
        TypeFamily::Png => "a PNG image",
        TypeFamily::Gif => "a GIF image",
        TypeFamily::RarArchive => "a RAR archive",
        TypeFamily::SevenZipArchive => "a 7-Zip archive",
        TypeFamily::GzipArchive => "a GZIP archive",
        TypeFamily::Mp3 => "an MP3 audio file",
    }
}

/// Result of a type-spoof check. `None` from `check()` means "nothing to
/// report" - either the extension isn't in our known list, the magic
/// bytes weren't recognized, or (the common case) they simply agree.
#[derive(Debug, Clone)]
pub struct TypeSpoofFinding {
    pub claimed_extension: String,
    pub detected_type: String,
}

/// Reads up to 16 bytes from the start of `path` and compares the
/// detected type against `filename`'s extension. Returns `Ok(None)` for
/// "no mismatch / nothing conclusive" - the normal, expected result for
/// the overwhelming majority of files. Returns `Err` only for an I/O
/// failure (file missing, permissions) - callers should treat that the
/// same as `None` (skip silently) rather than as a security finding.
pub async fn check(path: impl AsRef<Path>, filename: &str) -> std::io::Result<Option<TypeSpoofFinding>> {
    let ext = match Path::new(filename).extension().and_then(|e| e.to_str()) {
        Some(e) => e.to_string(),
        None => return Ok(None), // no extension to compare against
    };
    let Some(expected_family) = family_for_extension(&ext) else {
        return Ok(None); // extension not in our known list - never guess
    };

    let mut file = File::open(path.as_ref()).await?;
    let mut buf = [0u8; 16];
    let n = file.read(&mut buf).await?;
    let Some(detected_family) = identify(&buf[..n]) else {
        return Ok(None); // couldn't positively identify the real type - stay silent
    };

    if detected_family == expected_family {
        return Ok(None); // agrees - nothing to report
    }

    Ok(Some(TypeSpoofFinding {
        claimed_extension: ext,
        detected_type: family_label(detected_family).to_string(),
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn identifies_exe_by_mz_header() {
        assert_eq!(identify(&[0x4D, 0x5A, 0x90, 0x00]), Some(TypeFamily::Executable));
    }

    #[test]
    fn identifies_pdf() {
        assert_eq!(identify(b"%PDF-1.7"), Some(TypeFamily::Pdf));
    }

    #[test]
    fn unrecognized_bytes_return_none() {
        assert_eq!(identify(&[0x00, 0x01, 0x02, 0x03]), None);
    }

    #[test]
    fn jpg_and_jpeg_extensions_share_a_family() {
        assert_eq!(family_for_extension("jpg"), family_for_extension("jpeg"));
    }

    #[test]
    fn office_and_zip_extensions_share_the_zip_container_family() {
        // docx/xlsx/pptx are genuinely PK-zip containers under the hood,
        // so these must never cross-flag each other.
        assert_eq!(family_for_extension("docx"), family_for_extension("zip"));
        assert_eq!(family_for_extension("xlsx"), family_for_extension("zip"));
    }

    #[test]
    fn unknown_extension_yields_no_expected_family() {
        assert_eq!(family_for_extension("xyz123"), None);
    }
}
