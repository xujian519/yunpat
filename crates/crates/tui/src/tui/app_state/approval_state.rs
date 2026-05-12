//! Approval state extracted from `App`.

use std::collections::HashSet;

/// Mutable state for tool approval gating.
pub struct ApprovalState {
    /// Approval keys (or tool names) the user has approved in this session.
    pub session_approved: HashSet<String>,
    /// Approval keys the user has denied or aborted in this session.
    pub session_denied: HashSet<String>,
    /// Current approval interaction mode.
    pub mode: crate::tui::approval::ApprovalMode,
}

impl std::fmt::Debug for ApprovalState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("ApprovalState")
            .field("session_approved", &self.session_approved)
            .field("session_denied", &self.session_denied)
            .field("mode", &self.mode)
            .finish()
    }
}
