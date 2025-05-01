//! 文本分类工具
//!
//! 基于关键词和规则的轻量级文本分类器

use std::collections::HashMap;

/// 预定义分类及关键词权重
struct CategoryRule {
    name: &'static str,
    keywords: &'static [&'static str],
    weight: f32,
}

/// 分类规则表
fn get_rules() -> Vec<CategoryRule> {
    vec![
        CategoryRule {
            name: "patent",
            keywords: &[
                "专利",
                "权利要求",
                "发明",
                "实用新型",
                "外观设计",
                "审查",
                " IPC",
                "说明书",
                "摘要",
                "从属权利要求",
                "独立权利要求",
                "patent",
                "claim",
                "invention",
                "utility model",
            ],
            weight: 1.5,
        },
        CategoryRule {
            name: "tech",
            keywords: &[
                "算法",
                "系统",
                "架构",
                "实现",
                "模块",
                "接口",
                "编程",
                "代码",
                "框架",
                "数据结构",
                "机器学习",
                "深度学习",
                "algorithm",
                "system",
                "architecture",
                "framework",
            ],
            weight: 1.2,
        },
        CategoryRule {
            name: "law",
            keywords: &[
                "法律",
                "法规",
                "条文",
                "司法解释",
                "判决",
                "诉讼",
                "合同",
                "侵权",
                "知识产权",
                "保护",
                "law",
                "legal",
                "regulation",
                "statute",
            ],
            weight: 1.3,
        },
        CategoryRule {
            name: "science",
            keywords: &[
                "研究",
                "实验",
                "分析",
                "数据",
                "论文",
                "期刊",
                "理论",
                "假设",
                "验证",
                "结论",
                "方法",
                "research",
                "experiment",
                "analysis",
                "hypothesis",
            ],
            weight: 1.0,
        },
        CategoryRule {
            name: "business",
            keywords: &[
                "市场",
                "商业",
                "投资",
                "融资",
                "竞争",
                "战略",
                "营销",
                "产品",
                "用户",
                "收入",
                "利润",
                "market",
                "business",
                "investment",
                "strategy",
            ],
            weight: 1.0,
        },
    ]
}

/// 对文本进行分类
///
/// 返回 (分类标签, 置信度, 全部分类得分)
pub fn classify_text(text: &str) -> (String, f32, HashMap<String, f32>) {
    if text.trim().is_empty() {
        return ("unknown".to_string(), 0.0, HashMap::new());
    }

    let text_lower = text.to_lowercase();
    let rules = get_rules();
    let mut scores: HashMap<String, f32> = HashMap::new();

    for rule in &rules {
        let mut score = 0.0f32;
        for keyword in rule.keywords {
            if text_lower.contains(&keyword.to_lowercase()) {
                score += rule.weight;
            }
        }
        scores.insert(rule.name.to_string(), score);
    }

    // 找到最高分的分类
    let (best_label, best_score) = scores
        .iter()
        .max_by(|a, b| a.1.partial_cmp(b.1).unwrap_or(std::cmp::Ordering::Equal))
        .map(|(k, v)| (k.clone(), *v))
        .unwrap_or_else(|| ("unknown".to_string(), 0.0));

    // 计算置信度：基于最高分与次高分的差距
    let total: f32 = scores.values().sum();
    let confidence = if total > 0.0 { best_score / total } else { 0.0 };

    (best_label, confidence.min(1.0).max(0.0), scores)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_classify_patent() {
        let (label, confidence, _) = classify_text("本发明涉及一种专利权利要求书的撰写方法");
        assert_eq!(label, "patent");
        assert!(confidence > 0.5);
    }

    #[test]
    fn test_classify_tech() {
        let (label, _, _) = classify_text("该系统采用微服务架构，包含多个模块和接口");
        assert_eq!(label, "tech");
    }

    #[test]
    fn test_classify_empty() {
        let (label, confidence, _) = classify_text("");
        assert_eq!(label, "unknown");
        assert_eq!(confidence, 0.0);
    }
}
