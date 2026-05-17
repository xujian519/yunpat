//! Welcome screen content for onboarding.

use ratatui::style::{Modifier, Style};
use ratatui::text::{Line, Span};

use crate::palette;

pub fn lines() -> Vec<Line<'static>> {
    vec![
        Line::from(Span::styled(
            "YunPat Agent",
            Style::default().fg(palette::YUNPAT_BLUE).add_modifier(Modifier::BOLD),
        )),
        Line::from(Span::styled(
            format!("Version {}", env!("CARGO_PKG_VERSION")),
            Style::default().fg(palette::TEXT_MUTED),
        )),
        Line::from(""),
        Line::from(Span::styled(
            "知识产权全生命周期智能体操作系统",
            Style::default().fg(palette::TEXT_PRIMARY),
        )),
        Line::from(Span::styled(
            "接下来需要配置 API 密钥、设置工作目录信任，然后进入对话界面。",
            Style::default().fg(palette::TEXT_MUTED),
        )),
        Line::from(Span::styled(
            "Composer 支持多行输入，无需将所有内容挤在一行中。",
            Style::default().fg(palette::TEXT_MUTED),
        )),
        Line::from(""),
        Line::from(Span::styled(
            "按 Enter 继续。",
            Style::default().fg(palette::TEXT_PRIMARY),
        )),
        Line::from(Span::styled(
            "Ctrl+C 随时退出。",
            Style::default().fg(palette::TEXT_MUTED),
        )),
    ]
}
