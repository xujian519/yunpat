//! Sub-agent UI state extracted from `App`.

use std::collections::HashMap;
use std::time::Instant;

use crate::tools::subagent::SubAgentResult;

/// Mutable state for the sub-agent tracking system.
#[derive(Debug)]
pub struct SubagentState {
    /// Cached sub-agent snapshots for UI views.
    pub cache: Vec<SubAgentResult>,
    /// Last known per-agent progress text for running sub-agents.
    pub progress: HashMap<String, String>,
    /// In-transcript sub-agent card index by `agent_id` (issue #128).
    /// Maps each live sub-agent to the `HistoryCell::SubAgent` it renders
    /// into, so successive mailbox envelopes mutate the same cell rather
    /// than spawning duplicates.
    pub card_index: HashMap<String, usize>,
    /// History index of the most recent FanoutCard. Sibling sub-agents
    /// spawned by the same `rlm` invocation route into this card; reset
    /// when a fresh fanout-family tool call starts.
    pub last_fanout_card_index: Option<usize>,
    /// Most recently observed sub-agent dispatch tool name (set on
    /// `ToolCallStarted` for `agent_spawn` / `rlm` / etc., cleared
    /// after the first `Started` mailbox envelope routes through it).
    pub pending_dispatch: Option<String>,
    /// Animation anchor for status-strip active sub-agent spinner.
    pub activity_started_at: Option<Instant>,
}

impl Default for SubagentState {
    fn default() -> Self {
        Self {
            cache: Vec::new(),
            progress: HashMap::new(),
            card_index: HashMap::new(),
            last_fanout_card_index: None,
            pending_dispatch: None,
            activity_started_at: None,
        }
    }
}
