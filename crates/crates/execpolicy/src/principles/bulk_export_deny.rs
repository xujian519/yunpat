//! 批量导出拒绝原则 — 禁止批量导出专利数据。

use crate::constitutional::{ConstitutionalPrinciple, ConstitutionalVerdict};

/// 批量导出命令模式
const BULK_PATTERNS: &[&str] = &[
    "export_all",
    "batch_export",
    "bulk_download",
    "export_full_database",
];

pub struct BulkExportDenyPrinciple;

impl ConstitutionalPrinciple for BulkExportDenyPrinciple {
    fn name(&self) -> &'static str {
        "bulk_export_deny"
    }

    fn check(&self, tool_name: &str, params: &serde_json::Value) -> ConstitutionalVerdict {
        // 检查工具名
        if BULK_PATTERNS.iter().any(|p| tool_name.contains(p)) {
            return ConstitutionalVerdict::HardDeny {
                reason: "批量导出操作被宪法层禁止".to_string(),
            };
        }

        // 检查参数中的批量导出指示
        if let Some(action) = params.get("action").and_then(|v| v.as_str())
            && BULK_PATTERNS.iter().any(|p| action.contains(p))
        {
            return ConstitutionalVerdict::HardDeny {
                reason: "批量导出操作被宪法层禁止".to_string(),
            };
        }

        // 检查多种可能的数量字段
        let max_export = 100u64;
        for field in &["count", "limit", "max_results", "size", "batch_size"] {
            if let Some(count) = params.get(*field).and_then(|v| v.as_u64())
                && count > max_export
            {
                return ConstitutionalVerdict::HardDeny {
                    reason: format!("导出数量 {count} (字段 '{field}') 超过限制 ({max_export})"),
                };
            }
        }

        ConstitutionalVerdict::Pass
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn hard_deny_bulk_export_tool() {
        let v = BulkExportDenyPrinciple.check("export_all_patents", &json!({}));
        assert!(matches!(v, ConstitutionalVerdict::HardDeny { .. }));
    }

    #[test]
    fn hard_deny_excessive_count() {
        let v = BulkExportDenyPrinciple.check("patent_export", &json!({"count": 500}));
        assert!(matches!(v, ConstitutionalVerdict::HardDeny { .. }));
    }

    #[test]
    fn hard_deny_excessive_limit() {
        let v = BulkExportDenyPrinciple.check("patent_export", &json!({"limit": 200}));
        assert!(matches!(v, ConstitutionalVerdict::HardDeny { .. }));
    }

    #[test]
    fn hard_deny_excessive_batch_size() {
        let v = BulkExportDenyPrinciple.check("patent_export", &json!({"batch_size": 150}));
        assert!(matches!(v, ConstitutionalVerdict::HardDeny { .. }));
    }

    #[test]
    fn pass_for_normal_export() {
        assert!(
            BulkExportDenyPrinciple
                .check("patent_export", &json!({"count": 10}))
                .is_pass()
        );
    }
}
