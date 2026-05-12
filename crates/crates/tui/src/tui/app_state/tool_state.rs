//! Tool execution UI state extracted from `App`.

use std::collections::{HashMap, HashSet};

use serde_json::Value;

use crate::tui::active_cell::ActiveCell;

/// Detailed tool payload attached to a history cell.
#[derive(Debug, Clone)]
pub struct ToolDetailRecord {
    pub tool_id: String,
    pub tool_name: String,
    pub input: Value,
    pub output: Option<String>,
}

/// Mutable state for tool execution tracking.
#[derive(Debug)]
pub struct ToolState {
    /// Whether tool details are shown expanded in the transcript.
    pub show_tool_details: bool,
    /// Tool execution log.
    pub tool_log: Vec<String>,
    /// Tool call cells by tool id (for cells already finalized in `history`).
    pub tool_cells: HashMap<String, usize>,
    /// Full tool input/output keyed by history cell index.
    pub tool_details_by_cell: HashMap<usize, ToolDetailRecord>,
    /// In-flight tool/exec group for the current turn.
    pub active_cell: Option<ActiveCell>,
    /// Revision counter for `active_cell`.
    pub active_cell_revision: u64,
    /// Pending tool details for entries inside `active_cell`.
    pub active_tool_details: HashMap<String, ToolDetailRecord>,
    /// Active exploring cell entry index (within `active_cell.entries`).
    pub exploring_cell: Option<usize>,
    /// Mapping of exploring tool ids to entry indices.
    pub exploring_entries: HashMap<String, (usize, usize)>,
    /// Tool calls that should be ignored by the UI.
    pub ignored_tool_calls: HashSet<String>,
    /// Last exec wait command shown (for duplicate suppression).
    pub last_exec_wait_command: Option<String>,
    /// Tool calls captured for the pending assistant message.
    pub pending_tool_uses: Vec<(String, String, Value)>,
}

#[allow(clippy::derivable_impls)]
impl Default for ToolState {
    fn default() -> Self {
        Self {
            show_tool_details: false,
            tool_log: Vec::new(),
            tool_cells: HashMap::new(),
            tool_details_by_cell: HashMap::new(),
            active_cell: None,
            active_cell_revision: 0,
            active_tool_details: HashMap::new(),
            exploring_cell: None,
            exploring_entries: HashMap::new(),
            ignored_tool_calls: HashSet::new(),
            last_exec_wait_command: None,
            pending_tool_uses: Vec::new(),
        }
    }
}
