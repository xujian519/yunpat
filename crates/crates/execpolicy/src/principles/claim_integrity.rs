//! 权利要求完整性原则 — 检测权利要求范围扩大。

use crate::constitutional::{ConstitutionalPrinciple, ConstitutionalVerdict};

/// 权利要求范围扩大指示词
const BROADENING_PATTERNS: &[&str] = &[
    "扩大权利要求范围",
    "增加独立权利要求",
    "修改为更宽泛",
    "删除限定条件",
    "移除从属权利要求限制",
];

pub struct ClaimIntegrityPrinciple;

impl ConstitutionalPrinciple for ClaimIntegrityPrinciple {
    fn name(&self) -> &'static str {
        "claim_integrity"
    }

    fn check(&self, tool_name: &str, params: &serde_json::Value) -> ConstitutionalVerdict {
        // 仅检查权利要求相关工具
        if !matches!(tool_name, "patent_draft_full" | "patent_amend_claims") {
            return ConstitutionalVerdict::Pass;
        }

        let content = params.to_string();
        let matched: Vec<&str> = BROADENING_PATTERNS
            .iter()
            .filter(|p| content.contains(**p))
            .copied()
            .collect();

        if !matched.is_empty() {
            return ConstitutionalVerdict::RequireHuman {
                reason: format!("检测到权利要求范围扩大指示: {}", matched.join(", ")),
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
    fn require_human_for_broadening() {
        let v = ClaimIntegrityPrinciple.check(
            "patent_amend_claims",
            &json!({"instruction": "扩大权利要求范围到包含所有变体"}),
        );
        assert!(matches!(v, ConstitutionalVerdict::RequireHuman { .. }));
    }

    #[test]
    fn pass_for_normal_claim_edit() {
        assert!(
            ClaimIntegrityPrinciple
                .check("patent_amend_claims", &json!({"instruction": "修正错别字"}))
                .is_pass()
        );
    }

    #[test]
    fn pass_for_unrelated_tool() {
        assert!(
            ClaimIntegrityPrinciple
                .check("patent_search", &json!({}))
                .is_pass()
        );
    }
}
