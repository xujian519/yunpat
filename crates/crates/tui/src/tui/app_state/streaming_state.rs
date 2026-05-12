//! Streaming-related state extracted from `App`.

use crate::tui::streaming::StreamingState;

/// Mutable state for streaming assistant responses.
#[derive(Debug)]
pub struct StreamingApp {
    /// Current streaming assistant cell.
    pub message_index: Option<usize>,
    /// Index into `active_cell.entries` of the thinking entry currently being streamed.
    pub thinking_active_entry: Option<usize>,
    /// Newline-gated streaming collector state.
    pub state: StreamingState,
    /// Accumulated reasoning text.
    pub reasoning_buffer: String,
    /// Live reasoning header extracted from bold text.
    pub reasoning_header: Option<String>,
    /// Last completed reasoning block.
    pub last_reasoning: Option<String>,
    /// When the current thinking block started (for duration tracking).
    pub thinking_started_at: Option<std::time::Instant>,
    /// Set when the user scrolls during streaming so subsequent chunks
    /// don't yank the view back to the live tail.
    pub user_scrolled_during_stream: bool,
}
