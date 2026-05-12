//! File preview panel state extracted from `App`.

use std::path::PathBuf;

/// File type classification for preview rendering.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PreviewFileType {
    Text,
    Markdown,
    Code(String),
    Binary,
    Image,
    Unknown,
}

/// Content stored for the preview panel.
#[derive(Debug, Clone)]
pub enum PreviewContent {
    /// No file selected or panel hidden.
    Empty,
    /// Raw text lines with line numbers.
    Text {
        lines: Vec<String>,
        line_count: usize,
    },
    /// Pre-rendered Markdown lines (using ParsedMarkdown).
    Markdown {
        raw: String,
        #[allow(dead_code)]
        rendered_height: usize,
    },
    /// Binary file metadata placeholder.
    Binary {
        name: String,
        size_bytes: u64,
        mime_hint: String,
    },
    /// File is being loaded asynchronously.
    #[allow(dead_code)]
    Loading,
    /// File read failed.
    Error(String),
}

/// Mutable state for the file preview panel.
#[derive(Debug, Clone)]
pub struct PreviewState {
    /// Whether the preview panel is visible.
    pub visible: bool,
    /// Currently previewed file path.
    pub current_file: Option<PathBuf>,
    /// Classified file type.
    pub file_type: PreviewFileType,
    /// Rendered content.
    pub content: PreviewContent,
    /// Vertical scroll offset (0-based line index).
    pub scroll_offset: u16,
    /// Whether the preview panel has keyboard focus.
    pub focused: bool,
}

impl Default for PreviewState {
    fn default() -> Self {
        Self {
            visible: false,
            current_file: None,
            file_type: PreviewFileType::Unknown,
            content: PreviewContent::Empty,
            scroll_offset: 0,
            focused: false,
        }
    }
}

impl PreviewState {
    /// Reset to empty state (e.g. when closing the panel).
    pub fn clear(&mut self) {
        self.current_file = None;
        self.file_type = PreviewFileType::Unknown;
        self.content = PreviewContent::Empty;
        self.scroll_offset = 0;
    }
}
