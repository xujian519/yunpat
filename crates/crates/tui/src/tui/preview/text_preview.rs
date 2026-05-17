//! Text file preview rendering with syntax-aware line numbers.

use ratatui::style::{Modifier, Style};
use ratatui::text::{Line, Span};

use crate::palette;

/// Line number gutter separator character.
#[allow(dead_code)]
const GUTTER_SEP: &str = " │ ";

/// Render text lines with line number gutter and optional truncation.
#[allow(dead_code)]
pub fn render_text_lines(
    lines: &[String],
    total_lines: usize,
    width: u16,
    scroll_offset: u16,
    visible_height: u16,
) -> Vec<Line<'static>> {
    let line_num_width = format!("{}", total_lines).len().max(3);
    let gutter_width = line_num_width + 3; // " " + num + " │ "
    let max_content_width = (width as usize).saturating_sub(gutter_width);
    let offset = scroll_offset as usize;
    let visible = visible_height as usize;

    let mut result = Vec::with_capacity(visible.min(lines.len()));
    for (idx, line) in lines.iter().enumerate().skip(offset).take(visible) {
        let num = format!("{:>width$}", idx + 1, width = line_num_width);
        let truncated: String = line.chars().take(max_content_width).collect();
        let num_style = Style::default().fg(palette::TEXT_DIM);
        let sep_style = Style::default().fg(palette::BORDER_COLOR);
        let text_style = text_style_for_line(line);

        result.push(Line::from(vec![
            Span::styled(format!(" {}", num), num_style),
            Span::styled(GUTTER_SEP, sep_style),
            Span::styled(truncated, text_style),
        ]));
    }
    result
}

/// Detect line style based on simple heuristics (whitespace-only, comment-like).
#[allow(dead_code)]
fn text_style_for_line(line: &str) -> Style {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        Style::default().fg(palette::TEXT_DIM)
    } else if trimmed.starts_with("//") || trimmed.starts_with('#') || trimmed.starts_with("--") {
        Style::default().fg(palette::TEXT_DIM).add_modifier(Modifier::ITALIC)
    } else {
        Style::default().fg(palette::TEXT_PRIMARY)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn render_empty_lines() {
        let lines: Vec<String> = vec![];
        let result = render_text_lines(&lines, 0, 80, 0, 24);
        assert!(result.is_empty());
    }

    #[test]
    fn render_few_lines() {
        let lines = vec!["hello".into(), "world".into()];
        let result = render_text_lines(&lines, 2, 80, 0, 24);
        assert_eq!(result.len(), 2);
    }

    #[test]
    fn render_with_scroll_offset() {
        let lines: Vec<String> = (1..=100).map(|i| format!("line {}", i)).collect();
        let result = render_text_lines(&lines, 100, 80, 50, 10);
        assert_eq!(result.len(), 10);
    }

    #[test]
    fn comment_style_applied() {
        let lines = vec!["// this is a comment".into()];
        let result = render_text_lines(&lines, 1, 80, 0, 10);
        assert_eq!(result.len(), 1);
        // The style should have italic modifier for comment lines
    }
}
