//! Plan mode state extracted from `App`.

use crate::tools::plan::SharedPlanState;

/// Mutable state for plan mode.
#[derive(Debug)]
pub struct PlanState {
    /// Shared plan state for tracking tasks.
    pub shared: SharedPlanState,
    /// Whether a plan follow-up prompt is waiting for user input.
    pub prompt_pending: bool,
    /// Whether update_plan was called during the current turn.
    pub tool_used_in_turn: bool,
}
