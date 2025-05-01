use ratatui::{
    layout::{Alignment, Constraint, Direction, Layout, Margin, Rect},
    style::{Color, Modifier, Style},
    text::{Line, Span, Text},
    widgets::{Block, Borders, Clear, Paragraph, Wrap},
    Frame,
};
use yunpat_agents::types::{ApprovalOption, ApprovalRequest};

/// 审批 UI 组件，用于显示审批选项并收集用户输入。
pub struct ApprovalUI {
    options: Vec<ApprovalOption>,
    selected: usize,
}

impl ApprovalUI {
    pub fn new(request: &ApprovalRequest) -> Self {
        Self {
            options: request.options.clone(),
            selected: request.options.iter().position(|o| o.is_default).unwrap_or(0),
        }
    }

    pub fn next_option(&mut self) {
        if !self.options.is_empty() {
            self.selected = (self.selected + 1) % self.options.len();
        }
    }

    pub fn prev_option(&mut self) {
        if !self.options.is_empty() {
            self.selected = if self.selected == 0 {
                self.options.len() - 1
            } else {
                self.selected - 1
            };
        }
    }

    pub fn selected_value(&self) -> Option<&str> {
        self.options.get(self.selected).map(|o| o.value.as_str())
    }

    pub fn render(&self, frame: &mut Frame, area: Rect, prompt: &str) {
        let popup_area = Self::centered_rect(60, 40, area);

        frame.render_widget(Clear, popup_area);

        let block = Block::default()
            .title(" 审批 ")
            .borders(Borders::ALL)
            .border_style(Style::default().fg(Color::Yellow));

        let inner = popup_area.inner(Margin {
            horizontal: 2,
            vertical: 1,
        });

        let chunks = Layout::default()
            .direction(Direction::Vertical)
            .constraints([
                Constraint::Length(2),
                Constraint::Min(1),
                Constraint::Length(self.options.len() as u16 + 2),
            ])
            .split(inner);

        let prompt_text = Text::from(vec![Line::from(prompt)]);
        let prompt_para = Paragraph::new(prompt_text).wrap(Wrap { trim: true });
        frame.render_widget(prompt_para, chunks[0]);

        let options_text: Vec<Line> = self
            .options
            .iter()
            .enumerate()
            .map(|(i, opt)| {
                let marker = if i == self.selected { "▸ " } else { "  " };
                let style = if i == self.selected {
                    Style::default()
                        .fg(Color::Green)
                        .add_modifier(Modifier::BOLD)
                } else {
                    Style::default()
                };
                Line::from(vec![
                    Span::styled(marker, style),
                    Span::styled(&opt.label, style),
                ])
            })
            .collect();

        let options_para = Paragraph::new(Text::from(options_text));
        frame.render_widget(options_para, chunks[2]);
        frame.render_widget(block, popup_area);
    }

    fn centered_rect(percent_x: u16, percent_y: u16, r: Rect) -> Rect {
        let popup_layout = Layout::default()
            .direction(Direction::Vertical)
            .constraints([
                Constraint::Percentage((100 - percent_y) / 2),
                Constraint::Percentage(percent_y),
                Constraint::Percentage((100 - percent_y) / 2),
            ])
            .split(r);

        Layout::default()
            .direction(Direction::Horizontal)
            .constraints([
                Constraint::Percentage((100 - percent_x) / 2),
                Constraint::Percentage(percent_x),
                Constraint::Percentage((100 - percent_x) / 2),
            ])
            .split(popup_layout[1])[1]
    }
}
