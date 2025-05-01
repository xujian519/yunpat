use std::collections::HashMap;
use regex::Regex;
use crate::types::DisclosureDoc;
use crate::Result;

/// 技术交底书解析器
///
/// 源自 Athena: domains/patents/drafting/disclosure_parser.py
pub struct DisclosureParser;

impl DisclosureParser {
    /// 解析技术交底书文本
    pub fn parse(text: &str) -> DisclosureDoc {
        let sections = Self::extract_sections(text);
        let confidence = Self::calculate_confidence(&sections, text);
        DisclosureDoc {
            raw_text: text.to_string(),
            sections,
            confidence,
        }
    }

    /// 从文件解析
    pub fn parse_file(path: &std::path::Path) -> Result<DisclosureDoc> {
        let text = std::fs::read_to_string(path)?;
        Ok(Self::parse(&text))
    }

    fn extract_sections(text: &str) -> HashMap<String, String> {
        let mut sections = HashMap::new();

        let section_patterns: &[(&str, &str)] = &[
            ("发明名称", r"(?:发明名称|名称)[：:]\s*(.+?)(?:\n|$)"),
            ("技术领域", r"(?s)(?:技术领域)[：:]\s*(.+?)(?=\n(?:背景技术|发明内容|现有技术)|$)"),
            ("背景技术", r"(?s)(?:背景技术|现有技术)[：:]\s*(.+?)(?=\n(?:发明内容|技术问题|技术方案)|$)"),
            ("发明内容", r"(?s)(?:发明内容)[：:]\s*(.+?)(?=\n(?:具体实施方式|附图说明)|$)"),
            ("技术问题", r"(?s)(?:技术问题|所要解决的技术问题)[：:]\s*(.+?)(?=\n|$)"),
            ("技术方案", r"(?s)(?:技术方案|技术解决方案)[：:]\s*(.+?)(?=\n|$)"),
            ("技术效果", r"(?s)(?:技术效果|有益效果)[：:]\s*(.+?)(?=\n|$)"),
            ("具体实施方式", r"(?s)(?:具体实施方式|实施例)[：:]\s*(.+)$"),
            ("附图说明", r"(?s)(?:附图说明)[：:]\s*(.+?)(?=\n(?:具体实施方式|发明内容)|$)"),
        ];

        for (name, pattern) in section_patterns {
            if let Ok(re) = Regex::new(pattern) {
                if let Some(cap) = re.captures(text) {
                    if let Some(m) = cap.get(1) {
                        let content = m.as_str().trim();
                        let cleaned = Regex::new(r"\n{3,}")
                            .map(|r| r.replace_all(content, "\n\n").to_string())
                            .unwrap_or_else(|_| content.to_string());
                        sections.insert(name.to_string(), cleaned);
                        continue;
                    }
                }
            }
            sections.insert(name.to_string(), String::new());
        }

        // 如果关键章节为空，尝试从全文提取
        if sections.get("技术领域").map_or(true, |s| s.is_empty()) {
            if let Some(v) = Self::extract_by_patterns(text, &[
                r"(?:所属)?技术领域[：:][^\n]*",
                r"本发明涉及[^\n]*",
            ]) {
                sections.insert("技术领域".into(), v);
            }
        }

        if sections.get("技术问题").map_or(true, |s| s.is_empty()) {
            if let Some(v) = Self::extract_by_patterns(text, &[
                r"(?:所要解决)?技术问题[：:][^\n]*",
                r"为了解决[^\n]*",
            ]) {
                sections.insert("技术问题".into(), v);
            }
        }

        if sections.get("技术方案").map_or(true, |s| s.is_empty()) {
            if let Some(v) = Self::extract_by_patterns(text, &[
                r"技术方案[：:][^\n]*",
                r"采用[^\n]*",
            ]) {
                sections.insert("技术方案".into(), v);
            }
        }

        sections
    }

    fn extract_by_patterns(text: &str, patterns: &[&str]) -> Option<String> {
        for pat in patterns {
            if let Ok(re) = Regex::new(pat) {
                let matches: Vec<&str> = re.find_iter(text).map(|m| m.as_str()).take(3).collect();
                if !matches.is_empty() {
                    return Some(matches.join(" "));
                }
            }
        }
        None
    }

    fn calculate_confidence(sections: &HashMap<String, String>, raw_text: &str) -> f32 {
        let key_sections = [
            ("技术领域", 0.1),
            ("背景技术", 0.1),
            ("技术问题", 0.2),
            ("技术方案", 0.3),
            ("技术效果", 0.2),
            ("具体实施方式", 0.1),
        ];

        let mut confidence: f32 = 0.0;
        for (name, weight) in &key_sections {
            if sections.get(*name).map_or(false, |s| !s.is_empty()) {
                confidence += weight;
            }
        }

        if (100..50000).contains(&raw_text.len()) {
            confidence += 0.1;
        }

        confidence.min(1.0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_disclosure() {
        let text = r#"
发明名称：一种基于深度学习的图像识别方法

技术领域：
本发明涉及计算机视觉和人工智能技术领域。

背景技术：
现有图像识别方法准确率低。

技术问题：
本发明要解决如何提高图像识别准确率的技术问题。

技术方案：
本发明提供一种图像识别方法，包括输入层、卷积层和输出层。

技术效果：
本发明能够提高识别准确率，具有良好的鲁棒性。

具体实施方式：
如图1所示，本发明的图像识别方法采用深度卷积神经网络结构。
"#;
        let doc = DisclosureParser::parse(text);
        assert!(doc.confidence > 0.5, "置信度应大于0.5，实际: {}", doc.confidence);
        assert!(!doc.sections.get("发明名称").unwrap().is_empty());
        assert!(!doc.sections.get("技术方案").unwrap().is_empty());
    }

    #[test]
    fn test_calculate_confidence() {
        let mut sections = HashMap::new();
        sections.insert("技术方案".into(), "有内容".into());
        sections.insert("技术问题".into(), "有内容".into());
        let confidence = DisclosureParser::calculate_confidence(&sections, "一段合理长度的文本");
        assert!(confidence > 0.3);
    }
}
