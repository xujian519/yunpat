//! Sidebar and panel state extracted from `App`.

use crate::tui::file_tree::FileTreeState;

use super::super::app::SidebarFocus;

/// Mutable state for sidebar and panels.
#[derive(Debug)]
pub struct SidebarState {
    /// Sidebar width as a percentage of the terminal width.
    pub width_percent: u16,
    /// Currently focused sidebar panel.
    pub focus: SidebarFocus,
    /// Whether the session-context panel is enabled (#504).
    pub context_panel: bool,
    /// File-tree pane state. `None` when hidden; `Some` when visible.
    pub file_tree: Option<FileTreeState>,
}
