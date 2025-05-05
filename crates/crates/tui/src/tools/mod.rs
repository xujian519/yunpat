//! Tool system modules and re-exports.

pub mod apply_patch;
pub mod approval_cache;
pub mod arg_repair;
pub mod automation;
pub mod diagnostics;
pub mod diff_format;
pub mod file;
pub mod file_search;
pub mod finance;
pub mod mcp_tool_adapter;
pub mod patent_specs;

pub mod fetch_url;
pub mod fim;
pub mod git;
pub mod git_history;
pub mod github;
pub mod large_output_router;
pub mod parallel;
pub mod patent_batch_analysis;
pub mod patent_parallel_search;
pub mod patent_workflow;
pub mod plan;
pub mod project;
pub mod recall_archive;
pub mod registry;
pub mod remember;
pub mod revert_turn;
pub mod review;
pub mod rlm;
pub mod schema_sanitize;
pub mod search;
pub mod shell;
mod shell_output;
pub mod skill;
pub mod spec;
pub mod subagent;
pub mod tasks;
pub mod test_runner;
pub mod todo;
pub mod truncate;
pub mod user_input;
pub mod validate_data;
pub mod web_run;
pub mod web_search;

#[allow(unused_imports)]
pub use mcp_tool_adapter::{McpToolAdapter, McpToolRegistryExt};
// Patent tool specs — 导出以供工具注册使用
#[allow(unused_imports)]
pub use patent_specs::{
    InvalidDecisionSearchSpec, LegalKnowledgeSearchSpec, PatentAnalyzeSpec, PatentClaimGenSpec,
    PatentCompareSpec, PatentQualitySpec, PatentRespondSpec, PatentRuleSearchSpec,
    PatentSearchSpec, PatentWriteSpec, ProjectScanSpec,
};
pub use registry::{ToolRegistry, ToolRegistryBuilder};
pub use review::ReviewOutput;
pub use spec::ToolContext;
pub use user_input::UserInputResponse;
