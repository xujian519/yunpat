//! 提交审计原则 — patent_submit 操作强制审计标记和参数完整性检查。

use crate::constitutional::{ConstitutionalPrinciple, ConstitutionalVerdict};

/// patent_submit 必须包含的字段
const REQUIRED_SUBMIT_FIELDS: &[&str] = &["patent_id", "submitter", "submission_type"];

pub struct SubmissionAuditPrinciple;

impl ConstitutionalPrinciple for SubmissionAuditPrinciple {
    fn name(&self) -> &'static str {
        "submission_audit"
    }

    fn check(&self, tool_name: &str, params: &serde_json::Value) -> ConstitutionalVerdict {
        if tool_name != "patent_submit" {
            return ConstitutionalVerdict::Pass;
        }

        // 检查必需字段是否存在
        let missing: Vec<&str> = REQUIRED_SUBMIT_FIELDS
            .iter()
            .filter(|field| {
                params.get(field).is_none_or(|v| {
                    v.is_null()
                        || (v.is_string() && v.as_str().unwrap_or_default().trim().is_empty())
                })
            })
            .copied()
            .collect();

        if !missing.is_empty() {
            return ConstitutionalVerdict::RequireHuman {
                reason: format!(
                    "patent_submit 缺少必需审计字段: {} — 提交必须包含完整的审计信息",
                    missing.join(", ")
                ),
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
    fn require_human_for_missing_fields() {
        let v = SubmissionAuditPrinciple.check("patent_submit", &json!({"patent_id": "CN123"}));
        assert!(matches!(v, ConstitutionalVerdict::RequireHuman { .. }));
    }

    #[test]
    fn pass_with_all_required_fields() {
        let v = SubmissionAuditPrinciple.check(
            "patent_submit",
            &json!({
                "patent_id": "CN123",
                "submitter": "张三",
                "submission_type": "invention"
            }),
        );
        assert!(v.is_pass());
    }

    #[test]
    fn require_human_for_empty_fields() {
        let v = SubmissionAuditPrinciple.check(
            "patent_submit",
            &json!({"patent_id": "CN123", "submitter": "", "submission_type": "  "}),
        );
        assert!(matches!(v, ConstitutionalVerdict::RequireHuman { .. }));
    }

    #[test]
    fn pass_for_other_tools() {
        assert!(SubmissionAuditPrinciple.check("patent_search", &json!({})).is_pass());
    }
}
