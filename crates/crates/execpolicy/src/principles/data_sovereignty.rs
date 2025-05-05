//! 数据主权原则 — 高敏感技术交底内容禁止发送到外部 API。

use crate::constitutional::{ConstitutionalPrinciple, ConstitutionalVerdict};

/// 敏感技术关键词（技术交底书常见内容，包含常见变体）
const SENSITIVE_KEYWORDS: &[&str] = &[
    // 中文
    "技术交底书",
    "技术方案详述",
    "核心算法",
    "商业秘密",
    "核心工艺",
    "实验数据原始",
    "配方",
    "工艺参数详细",
    "核心技术指标",
    "内部研发数据",
    // 英文变体
    "technical disclosure",
    "trade secret",
    "proprietary algorithm",
    "core formulation",
    "internal r&d data",
];

pub struct DataSovereigntyPrinciple;

/// 递归提取 JSON 值中的所有字符串
fn collect_strings(value: &serde_json::Value, out: &mut String) {
    match value {
        serde_json::Value::String(s) => {
            out.push_str(s);
            out.push(' ');
        }
        serde_json::Value::Array(arr) => {
            for v in arr {
                collect_strings(v, out);
            }
        }
        serde_json::Value::Object(map) => {
            for v in map.values() {
                collect_strings(v, out);
            }
        }
        _ => {}
    }
}

impl ConstitutionalPrinciple for DataSovereigntyPrinciple {
    fn name(&self) -> &'static str {
        "data_sovereignty"
    }

    fn check(&self, tool_name: &str, params: &serde_json::Value) -> ConstitutionalVerdict {
        // 仅检查会向外部发送数据的工具
        let external_tools = [
            "patent_search",
            "patent_analyze",
            "prior_art_search",
            "patent_draft_full",
        ];
        if !external_tools.contains(&tool_name) {
            return ConstitutionalVerdict::Pass;
        }

        // 递归提取所有字符串值进行匹配（不依赖 JSON 序列化格式）
        let mut all_text = String::new();
        collect_strings(params, &mut all_text);
        let content_lower = all_text.to_lowercase();

        let matched: Vec<&str> = SENSITIVE_KEYWORDS
            .iter()
            .filter(|kw| content_lower.contains(&kw.to_lowercase()))
            .copied()
            .collect();

        if !matched.is_empty() {
            return ConstitutionalVerdict::RouteToLocal {
                reason: format!("检测到敏感技术内容: {}", matched.join(", ")),
            };
        }

        ConstitutionalVerdict::Pass
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn check(tool: &str, params: &serde_json::Value) -> ConstitutionalVerdict {
        DataSovereigntyPrinciple.check(tool, params)
    }

    #[test]
    fn pass_for_non_external_tool() {
        assert!(check("file_read", &json!({"content": "技术交底书"})).is_pass());
    }

    #[test]
    fn route_to_local_for_sensitive_content() {
        let v = check(
            "patent_draft_full",
            &json!({"disclosure": "核心技术指标: 99.7%"}),
        );
        assert!(matches!(v, ConstitutionalVerdict::RouteToLocal { .. }));
    }

    #[test]
    fn pass_for_non_sensitive_content() {
        assert!(check("patent_search", &json!({"query": "电池专利"})).is_pass());
    }
}
