use ratatui::{
    Frame,
    layout::Rect,
    style::{Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Borders, Paragraph},
};

use crate::palette;
use crate::tui::app_state::patent_state::{PatentWorkflowState, StepStatus};

pub struct PatentWorkflowWidget<'a> {
    pub state: &'a PatentWorkflowState,
}

impl<'a> PatentWorkflowWidget<'a> {
    pub fn new(state: &'a PatentWorkflowState) -> Self {
        Self { state }
    }

    pub fn render(self, frame: &mut Frame, area: Rect) {
        if !self.state.is_active {
            return;
        }

        let block = Block::default()
            .title(format!(
                " 专利工作流: {} ",
                self.state.workflow_type.as_deref().unwrap_or("Unknown")
            ))
            .borders(Borders::TOP | Borders::BOTTOM)
            .border_style(Style::default().fg(palette::BORDER_COLOR))
            .style(Style::default().bg(palette::YUNPAT_SLATE));

        let inner_area = block.inner(area);
        frame.render_widget(block, area);

        let mut lines = Vec::new();

        for (i, step) in self.state.steps.iter().enumerate() {
            let (icon, color) = match step.status {
                StepStatus::Pending => ("○", palette::TEXT_DIM),
                StepStatus::Running => ("●", palette::STATUS_WARNING),
                StepStatus::Completed => ("✓", palette::STATUS_SUCCESS),
                StepStatus::Failed => ("✗", palette::STATUS_ERROR),
                StepStatus::WaitingHitl => ("!", palette::ACCENT_REASONING_LIVE),
            };

            let duration_str = step.duration_ms.map(|ms| format!(" {}ms", ms)).unwrap_or_default();

            lines.push(Line::from(vec![
                Span::styled(
                    format!("{} Step {}/{} · ", icon, i + 1, self.state.total_steps),
                    Style::default().fg(color),
                ),
                Span::styled(
                    &step.name,
                    Style::default().fg(palette::TEXT_BODY).add_modifier(Modifier::BOLD),
                ),
                Span::styled(duration_str, Style::default().fg(palette::TEXT_DIM)),
            ]));

            if step.status == StepStatus::Running {
                let progress_bar = "█".repeat((step.progress * 20.0) as usize)
                    + &"░".repeat(20 - (step.progress * 20.0) as usize);
                lines.push(Line::from(vec![
                    Span::raw("  ["),
                    Span::styled(progress_bar, Style::default().fg(palette::TEXT_ACCENT)),
                    Span::raw(format!("] {:.0}%", step.progress * 100.0)),
                ]));
            }

            if let Some(details) = &step.details {
                lines.push(Line::from(vec![Span::styled(
                    format!("  → {}", details),
                    Style::default().fg(palette::TEXT_MUTED),
                )]));
            }

            // Add a small spacing
            lines.push(Line::from(""));
        }

        let p = Paragraph::new(lines);
        frame.render_widget(p, inner_area);
    }
}
