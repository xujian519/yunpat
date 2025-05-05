//! 不可逆操作原则 — patent_submit/delete 等操作需人工审批。

use crate::constitutional::{ConstitutionalPrinciple, ConstitutionalVerdict};

/// 不可逆工具列表
const IRREVERSIBLE_TOOLS: &[&str] = &[
    "patent_submit",
    "patent_delete",
    "patent_abandon",
    "patent_withdraw",
];

pub struct IrreversibleActionPrinciple;

impl ConstitutionalPrinciple for IrreversibleActionPrinciple {
    fn name(&self) -> &'static str {
        "irreversible_action"
    }

    fn check(&self, tool_name: &str, _params: &serde_json::Value) -> ConstitutionalVerdict {
        if IRREVERSIBLE_TOOLS.contains(&tool_name) {
            return ConstitutionalVerdict::RequireHuman {
                reason: format!("`{tool_name}` 是不可逆操作，需要人工确认后方可执行"),
            };
        }
        ConstitutionalVerdict::Pass
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn require_human_for_submit() {
        let v = IrreversibleActionPrinciple.check("patent_submit", &json!({}));
        assert!(matches!(v, ConstitutionalVerdict::RequireHuman { .. }));
    }

    #[test]
    fn require_human_for_delete() {
        let v = IrreversibleActionPrinciple.check("patent_delete", &json!({}));
        assert!(matches!(v, ConstitutionalVerdict::RequireHuman { .. }));
    }

    #[test]
    fn pass_for_reversible_tool() {
        assert!(
            IrreversibleActionPrinciple
                .check("patent_search", &json!({}))
                .is_pass()
        );
    }
}
