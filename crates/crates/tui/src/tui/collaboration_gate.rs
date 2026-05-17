//! Collaboration gate — thin routing layer for tool execution approval.
//!
//! Maps `(ToolCategory, RiskLevel)` to one of four gate levels, determining
//! which UI to present when a tool requires approval. All classification
//! signals come from existing code in `approval.rs`.
//!
//! The core types have been migrated to `yunpat_protocol` to break the
//! `core ↔ tui` circular dependency.

pub use yunpat_protocol::{CollaborationGate, determine_gate};

#[cfg(test)]
mod tests {
    use super::*;
    use yunpat_protocol::{RiskLevel, ToolCategory};

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
