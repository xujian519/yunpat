//! App state sub-modules — extracted from the App God Object.
//!
//! Each module groups related fields from the monolithic `App` struct into
//! focused sub-structs. `App` holds these as `pub` fields and delegates
//! access, so callers gradually migrate from `app.xxx` to `app.sub.xxx`.

pub mod plan_state;
pub mod queue_state;
pub mod sidebar_state;
pub mod subagent_state;
pub mod tool_state;

pub use plan_state::PlanState;
pub use queue_state::QueueState;
pub use sidebar_state::SidebarState;
pub use subagent_state::SubagentState;
pub use tool_state::{ToolDetailRecord, ToolState};
