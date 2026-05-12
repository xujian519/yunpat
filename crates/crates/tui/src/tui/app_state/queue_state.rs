//! Queue and steering state extracted from `App`.

use std::collections::VecDeque;

use crate::tui::app::QueuedMessage;

/// Mutable state for message queuing and steering.
#[derive(Debug)]
pub struct QueueState {
    /// User messages queued while a turn is running.
    pub queued_messages: VecDeque<QueuedMessage>,
    /// Draft queued message being edited.
    pub queued_draft: Option<QueuedMessage>,
    /// Legacy pending-steer bucket retained for session compatibility.
    pub pending_steers: VecDeque<QueuedMessage>,
    /// Steer messages rejected by the engine (string summaries).
    pub rejected_steers: VecDeque<String>,
    /// Whether to submit pending steers after interrupt.
    pub submit_pending_steers_after_interrupt: bool,
}

#[allow(clippy::derivable_impls)]
impl Default for QueueState {
    fn default() -> Self {
        Self {
            queued_messages: VecDeque::new(),
            queued_draft: None,
            pending_steers: VecDeque::new(),
            rejected_steers: VecDeque::new(),
            submit_pending_steers_after_interrupt: false,
        }
    }
}
