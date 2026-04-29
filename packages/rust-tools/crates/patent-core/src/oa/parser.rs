use regex::Regex;
use crate::types::*;
use crate::Result;

/// 审查意见解析器
///
/// 源自 Athena: domains/patents/oa_document_parser.py
pub struct OaParser;

impl OaParser {
    /// 解析审查意见通知书文本
    pub fn parse(text: &str) -> Result<OfficeAction> {
        let oa_type = Self::detect_oa_type(text);
        let citations = Self::extract_citations(text);
        let affected_claims = Self::extract_affected_claims(text);
        let examiner_arguments = Self::extract_examiner_arguments(text);

        Ok(OfficeAction {
            oa_type,
            citations,
            examiner_arguments,
            affected_claims,
        })
    }

    /// 检测审查意见类型
    fn detect_oa_type(text: &str) -> OaType {
        let text_lower = text.to_lowercase();

        // 创造性优先级高于新颖性（因为创造性审查常同时提及新颖性）
        if text_lower.contains("创造性") || text_lower.contains("显而易见") || text_lower.contains("22条第3款") {
            return OaType::InventiveStep;
        }
        if text_lower.contains("新颖性") || text_lower.contains("不具备新颖性") || text_lower.contains("22条第2款") {
            return OaType::Novelty;
        }
        if text_lower.contains("清楚") || text_lower.contains("26条第4款") || text_lower.contains("简明") {
            return OaType::Clarity;
        }
        if text_lower.contains("支持") || text_lower.contains("超范围") {
            return OaType::Support;
        }
        if text_lower.contains("保护范围") || text_lower.contains("33条") {
            return OaType::Scope;
        }
        if text_lower.contains("形式") || text_lower.contains("格式") {
            return OaType::Formal;
        }

        OaType::Other("未知类型".to_string())
    }

    /// 提取引用文献
    fn extract_citations(text: &str) -> Vec<CitedReference> {
        let mut citations = Vec::new();

        // 匹配专利号格式：CNxxxxxxA, USxxxxxx, WOxxxxxx 等
        if let Ok(re) = Regex::new(r"(?i)(CN|US|WO|EP|JP|KR)\d{6,}[A-Z]?") {
            for cap in re.captures_iter(text) {
                if let Some(m) = cap.get(0) {
                    citations.push(CitedReference {
                        document_number: m.as_str().to_string(),
                        relevancy: "X".to_string(), // 默认X类
                        claims_affected: vec![1],
                    });
                }
            }
        }

        citations.dedup_by(|a, b| a.document_number == b.document_number);
        citations
    }

    /// 提取受影响的权利要求编号
    fn extract_affected_claims(text: &str) -> Vec<usize> {
        let mut claims = Vec::new();

        // 匹配"权利要求1"、"第1-3项"等
        if let Ok(re) = Regex::new(r"权利要求\s*(\d+)") {
            for cap in re.captures_iter(text) {
                if let Some(m) = cap.get(1) {
                    if let Ok(n) = m.as_str().parse::<usize>() {
                        if !claims.contains(&n) {
                            claims.push(n);
                        }
                    }
                }
            }
        }

        // 匹配范围"第1-3项"、"第1至5项"
        if let Ok(re) = Regex::new(r"第\s*(\d+)\s*[-至到]\s*(\d+)\s*项") {
            for cap in re.captures_iter(text) {
                if let (Some(start), Some(end)) = (cap.get(1), cap.get(2)) {
                    if let (Ok(s), Ok(e)) = (start.as_str().parse::<usize>(), end.as_str().parse::<usize>()) {
                        for n in s..=e {
                            if !claims.contains(&n) {
                                claims.push(n);
                            }
                        }
                    }
                }
            }
        }

        if claims.is_empty() {
            claims.push(1);
        }
        claims.sort();
        claims
    }

    /// 提取审查员论点
    fn extract_examiner_arguments(text: &str) -> String {
        let patterns = [
            r"(?s)审查意见[：:](.+?)(?=\n答复|$)",
            r"(?s)驳回理由[：:](.+?)(?=\n答复|$)",
            r"(?s)认为[：:](.+?)(?=\n|$)",
        ];

        for pat in &patterns {
            if let Ok(re) = Regex::new(pat) {
                if let Some(cap) = re.captures(text) {
                    if let Some(m) = cap.get(1) {
                        let content = m.as_str().trim();
                        if !content.is_empty() {
                            return content.to_string();
                        }
                    }
                }
            }
        }

        // 回退：返回全文前500字符
        text.chars().take(500).collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_oa_novelty() {
        let text = r#"
审查意见：
权利要求1-3不具备新颖性。
对比文件CN1234567A公开了权利要求1的全部技术特征。
根据专利法第22条第2款，权利要求1不具备新颖性。
"#;
        let oa = OaParser::parse(text).unwrap();
        assert_eq!(oa.oa_type, OaType::Novelty);
        assert!(oa.affected_claims.contains(&1));
        assert!(!oa.citations.is_empty());
    }

    #[test]
    fn test_parse_oa_inventive() {
        let text = r#"
审查意见：
权利要求1不具备创造性。
对比文件1公开了...特征，且该区别特征是显而易见的。
根据专利法第22条第3款，权利要求1-2不具备创造性。
"#;
        let oa = OaParser::parse(text).unwrap();
        assert_eq!(oa.oa_type, OaType::InventiveStep);
    }

    #[test]
    fn test_extract_citations() {
        let text = "对比文件CN1234567A和US7654321B2";
        let citations = OaParser::extract_citations(text);
        assert!(citations.len() >= 2);
    }

    #[test]
    fn test_extract_affected_claims() {
        let text = "权利要求1-3不具备新颖性，权利要求5不具备创造性";
        let claims = OaParser::extract_affected_claims(text);
        assert!(claims.contains(&1));
        assert!(claims.contains(&5));
    }
}
