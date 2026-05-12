//! Collaboration gate — thin routing layer for tool execution approval.
//!
//! Maps `(ToolCategory, RiskLevel)` to one of four gate levels, determining
//! which UI to present when a tool requires approval. All classification
//! signals come from existing code in `approval.rs`.

use super::approval::{RiskLevel, ToolCategory};

/// Gate level for a tool execution request.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CollaborationGate {
    /// Auto-execute, no UI needed (read-only tools).
    None,
    /// Toast with summary + ApprovalView (benign file writes, shell queries).
    ConfirmPlan,
    /// Preview panel shows diff + ApprovalView (destructive file writes).
    ReviewDiff,
    /// Sidebar switches to Plan + ApprovalView (destructive shell, unknown).
    RequirePlan,
}

/// Determine the collaboration gate level for a tool.
pub fn determine_gate(category: ToolCategory, risk: RiskLevel) -> CollaborationGate {
    match (category, risk) {
        // Safe / read-only → always auto-execute
        (ToolCategory::Safe | ToolCategory::McpRead, _) => CollaborationGate::None,
        // File writes: benign → confirm, destructive → diff review
        (ToolCategory::FileWrite, RiskLevel::Benign) => CollaborationGate::ConfirmPlan,
        (ToolCategory::FileWrite, RiskLevel::Destructive) => CollaborationGate::ReviewDiff,
        // Shell: destructive → require plan, benign → confirm
        (ToolCategory::Shell, RiskLevel::Destructive) => CollaborationGate::RequirePlan,
        (ToolCategory::Shell, RiskLevel::Benign) => CollaborationGate::ConfirmPlan,
        // Network → confirm with URL info
        (ToolCategory::Network, _) => CollaborationGate::ConfirmPlan,
        // MCP actions: destructive → require plan, benign → confirm
        (ToolCategory::McpAction, RiskLevel::Destructive) => CollaborationGate::RequirePlan,
        (ToolCategory::McpAction, RiskLevel::Benign) => CollaborationGate::ConfirmPlan,
        // Unknown → safest path
        (ToolCategory::Unknown, _) => CollaborationGate::RequirePlan,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn safe_tools_are_none() {
        assert_eq!(
            determine_gate(ToolCategory::Safe, RiskLevel::Benign),
            CollaborationGate::None
        );
    }

    #[test]
    fn mcp_read_is_none() {
        assert_eq!(
            determine_gate(ToolCategory::McpRead, RiskLevel::Benign),
            CollaborationGate::None
        );
    }

    #[test]
    fn file_write_benign_is_confirm() {
        assert_eq!(
            determine_gate(ToolCategory::FileWrite, RiskLevel::Benign),
            CollaborationGate::ConfirmPlan
        );
    }

    #[test]
    fn file_write_destructive_is_review_diff() {
        assert_eq!(
            determine_gate(ToolCategory::FileWrite, RiskLevel::Destructive),
            CollaborationGate::ReviewDiff
        );
    }

    #[test]
    fn shell_destructive_is_require_plan() {
        assert_eq!(
            determine_gate(ToolCategory::Shell, RiskLevel::Destructive),
            CollaborationGate::RequirePlan
        );
    }

    #[test]
    fn shell_benign_is_confirm() {
        assert_eq!(
            determine_gate(ToolCategory::Shell, RiskLevel::Benign),
            CollaborationGate::ConfirmPlan
        );
    }

    #[test]
    fn network_is_confirm() {
        assert_eq!(
            determine_gate(ToolCategory::Network, RiskLevel::Benign),
            CollaborationGate::ConfirmPlan
        );
        assert_eq!(
            determine_gate(ToolCategory::Network, RiskLevel::Destructive),
            CollaborationGate::ConfirmPlan
        );
    }

    #[test]
    fn unknown_is_require_plan() {
        assert_eq!(
            determine_gate(ToolCategory::Unknown, RiskLevel::Benign),
            CollaborationGate::RequirePlan
        );
    }
}
