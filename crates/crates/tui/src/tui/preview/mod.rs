//! File preview panel widget.
//!
//! Renders a preview of the selected file in the left-middle panel of the
//! three-panel layout. Supports text files (with line numbers), Markdown
//! (via ParsedMarkdown), and binary file placeholders.

pub mod text_preview;

use ratatui::buffer::Buffer;
use ratatui::layout::Rect;
use ratatui::prelude::Widget;
use ratatui::style::Style;
use ratatui::text::{Line, Span};
use ratatui::widgets::{Block, Borders, Paragraph, Wrap};

use crate::palette;
use crate::tui::app_state::preview_state::{PreviewContent, PreviewFileType, PreviewState};
use crate::tui::widgets::Renderable;

/// Minimum terminal width for the preview panel to be visible.
pub const PREVIEW_VISIBLE_MIN_WIDTH: u16 = 120;

/// Default preview panel width as percentage of terminal width.
pub const PREVIEW_WIDTH_PERCENT: u16 = 30;

/// Maximum file size to preview (1 MB). Larger files show a placeholder.
pub const MAX_PREVIEW_SIZE: u64 = 1_048_576;

/// Maximum number of lines to render for a text file.
const MAX_PREVIEW_LINES: usize = 10_000;

/// Classify a file by its extension.
pub fn classify_file(path: &std::path::Path) -> PreviewFileType {
    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
    match ext.to_lowercase().as_str() {
        "md" | "markdown" | "mdx" => PreviewFileType::Markdown,
        "rs" | "toml" | "yaml" | "yml" | "json" | "xml" | "html" | "css" | "js" | "ts" | "tsx"
        | "jsx" | "py" | "go" | "java" | "c" | "cpp" | "h" | "sh" | "bash" | "sql" | "graphql"
        | "proto" | "zig" | "nim" => PreviewFileType::Code(ext.to_string()),
        "png" | "jpg" | "jpeg" | "gif" | "bmp" | "ico" | "webp" | "svg" => PreviewFileType::Image,
        "zip" | "tar" | "gz" | "bz2" | "xz" | "7z" | "rar" | "exe" | "dll" | "so" | "dylib"
        | "wasm" | "pdf" | "doc" | "docx" | "xls" | "xlsx" | "ppt" | "pptx" | "odt" | "ods" => {
            PreviewFileType::Binary
        }
        _ => PreviewFileType::Text,
    }
}

/// Load file content into PreviewState.
pub fn load_preview(state: &mut PreviewState, path: std::path::PathBuf) {
    let file_type = classify_file(&path);
    let metadata = std::fs::metadata(&path);

    let content = match metadata {
        Ok(meta) if meta.len() > MAX_PREVIEW_SIZE => PreviewContent::Binary {
            name: path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default(),
            size_bytes: meta.len(),
            mime_hint: format!("{:?}", file_type),
        },
        Ok(_) => {
            match std::fs::read_to_string(&path) {
                Ok(text) => {
                    let line_count = text.lines().count();
                    match &file_type {
                        PreviewFileType::Markdown => {
                            PreviewContent::Markdown { raw: text, rendered_height: 0 }
                        }
                        _ => {
                            let lines: Vec<String> =
                                text.lines().take(MAX_PREVIEW_LINES).map(String::from).collect();
                            PreviewContent::Text { lines, line_count }
                        }
                    }
                }
                Err(_) => {
                    // Binary or unreadable
                    PreviewContent::Binary {
                        name: path
                            .file_name()
                            .map(|n| n.to_string_lossy().to_string())
                            .unwrap_or_default(),
                        size_bytes: metadata.map(|m| m.len()).unwrap_or(0),
                        mime_hint: format!("{:?}", file_type),
                    }
                }
            }
        }
        Err(e) => PreviewContent::Error(e.to_string()),
    };

    state.current_file = Some(path);
    state.file_type = file_type;
    state.content = content;
    state.scroll_offset = 0;
}

/// Preview panel widget.
pub struct PreviewPanel<'a> {
    pub state: &'a PreviewState,
    pub focused: bool,
}

impl<'a> PreviewPanel<'a> {
    pub fn new(state: &'a PreviewState, focused: bool) -> Self {
        Self { state, focused }
    }
}

impl Renderable for PreviewPanel<'_> {
    fn render(&self, area: Rect, buf: &mut Buffer) {
        if area.is_empty() {
            return;
        }

        let border_style = if self.focused {
            Style::default().fg(palette::SELECTION_TEXT).bg(palette::SELECTION_BG)
        } else {
            Style::default().fg(palette::BORDER_COLOR)
        };

        let title = self
            .state
            .current_file
            .as_ref()
            .and_then(|p| p.file_name())
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "Preview".to_string());

        let block = Block::default()
            .borders(Borders::ALL)
            .border_style(border_style)
            .title(format!(" {} ", title));

        let inner = block.inner(area);
        block.render(area, buf);

        if inner.is_empty() {
            return;
        }

        let lines = match &self.state.content {
            PreviewContent::Empty => {
                let dim = Style::default().fg(palette::TEXT_DIM);
                vec![Line::from(Span::styled("  Select a file to preview", dim))]
            }
            PreviewContent::Loading => {
                let dim = Style::default().fg(palette::TEXT_DIM);
                vec![Line::from(Span::styled("  Loading...", dim))]
            }
            PreviewContent::Error(msg) => {
                let err_style = Style::default().fg(palette::STATUS_ERROR);
                vec![Line::from(Span::styled(
                    format!("  Error: {}", msg),
                    err_style,
                ))]
            }
            PreviewContent::Text { lines, line_count } => render_text_preview(
                lines,
                *line_count,
                inner.width,
                self.state.scroll_offset,
                inner.height,
            ),
            PreviewContent::Markdown { raw, .. } => {
                let parsed = crate::tui::markdown_render::parse(raw);
                let rendered = crate::tui::markdown_render::render_parsed(
                    &parsed,
                    inner.width,
                    Style::default().fg(palette::TEXT_PRIMARY),
                );
                apply_scroll(rendered, self.state.scroll_offset, inner.height)
            }
            PreviewContent::Binary { name, size_bytes, mime_hint } => {
                render_binary_placeholder(name, *size_bytes, mime_hint, inner.width)
            }
        };

        let paragraph = Paragraph::new(lines).wrap(Wrap { trim: false });
        paragraph.render(inner, buf);
    }

    fn desired_height(&self, _width: u16) -> u16 {
        match &self.state.content {
            PreviewContent::Empty | PreviewContent::Loading => 1,
            PreviewContent::Error(_) => 2,
            PreviewContent::Text { line_count, .. } => (*line_count as u16).min(50),
            PreviewContent::Markdown { .. } => 50,
            PreviewContent::Binary { .. } => 5,
        }
    }
}

/// Render text file with line numbers.
fn render_text_preview(
    lines: &[String],
    total_lines: usize,
    width: u16,
    scroll_offset: u16,
    visible_height: u16,
) -> Vec<Line<'static>> {
    let line_num_width = format!("{}", total_lines).len().max(3);
    let max_content_width = (width as usize).saturating_sub(line_num_width + 3);
    let offset = scroll_offset as usize;
    let visible = visible_height as usize;

    let mut result = Vec::new();
    for (idx, line) in lines.iter().enumerate().skip(offset).take(visible) {
        let num = format!("{:>width$}", idx + 1, width = line_num_width);
        let truncated: String = line.chars().take(max_content_width).collect();
        let num_style = Style::default().fg(palette::TEXT_DIM);
        let sep_style = Style::default().fg(palette::BORDER_COLOR);
        let text_style = Style::default().fg(palette::TEXT_PRIMARY);

        result.push(Line::from(vec![
            Span::styled(format!(" {}", num), num_style),
            Span::styled(" │ ", sep_style),
            Span::styled(truncated, text_style),
        ]));
    }
    result
}

/// Apply scroll offset to rendered lines.
fn apply_scroll(
    lines: Vec<Line<'static>>,
    scroll_offset: u16,
    visible_height: u16,
) -> Vec<Line<'static>> {
    let offset = scroll_offset as usize;
    let visible = visible_height as usize;
    lines.into_iter().skip(offset).take(visible).collect()
}

/// Render binary file placeholder.
fn render_binary_placeholder(
    name: &str,
    size_bytes: u64,
    mime_hint: &str,
    _width: u16,
) -> Vec<Line<'static>> {
    let dim = Style::default().fg(palette::TEXT_DIM);
    let warning = Style::default().fg(palette::STATUS_WARNING);
    let size_str = if size_bytes < 1024 {
        format!("{} B", size_bytes)
    } else if size_bytes < 1024 * 1024 {
        format!("{:.1} KB", size_bytes as f64 / 1024.0)
    } else {
        format!("{:.1} MB", size_bytes as f64 / (1024.0 * 1024.0))
    };

    vec![
        Line::from(""),
        Line::from(Span::styled(format!("  Binary file: {}", name), warning)),
        Line::from(Span::styled(format!("  Size: {}", size_str), dim)),
        Line::from(Span::styled(format!("  Type: {}", mime_hint), dim)),
        Line::from(Span::styled("  (preview not available)", dim)),
    ]
}
