use regex::Regex;
use crate::types::*;

/// 技术特征提取器
///
/// 源自 Athena: domains/patents/drafting/technical_feature_extractor.py
pub struct FeatureExtractor;

impl FeatureExtractor {
    /// 从技术交底书全文或章节中提取技术特征
    pub fn extract_features(
        text: &str,
        sections: Option<&std::collections::HashMap<String, String>>,
    ) -> Vec<TechnicalFeature> {
        let solution_text = sections
            .and_then(|s| s.get("技术方案"))
            .map(|s| s.as_str())
            .unwrap_or_else(|| Self::extract_solution_section(text));

        let mut features = Vec::new();
        features.extend(Self::extract_component_features(&solution_text));
        features.extend(Self::extract_step_features(&solution_text));
        features.extend(Self::extract_parameter_features(&solution_text));
        Self::classify_features(&mut features);
        features
    }

    /// 提取问题-特征-效果三元组
    pub fn extract_problem_feature_effects(
        text: &str,
        sections: Option<&std::collections::HashMap<String, String>>,
        features: Option<&[TechnicalFeature]>,
    ) -> Vec<ProblemFeatureEffect> {
        let problem = sections
            .and_then(|s| s.get("技术问题"))
            .cloned()
            .unwrap_or_else(|| Self::extract_problem_section(text).to_string());

        let effects_text = sections
            .and_then(|s| s.get("技术效果"))
            .cloned()
            .unwrap_or_else(|| Self::extract_effects_section(text).to_string());

        let effects = Self::parse_effects(&effects_text);

        let related_features: Vec<TechnicalFeature> = features
            .map(|fs| {
                fs.iter()
                    .filter(|f| f.feature_type == FeatureType::Essential)
                    .cloned()
                    .collect()
            })
            .unwrap_or_default();

        let mut tuples = Vec::new();
        if !problem.is_empty() && !related_features.is_empty() {
            tuples.push(ProblemFeatureEffect {
                id: "PFE_1".to_string(),
                technical_problem: problem,
                technical_features: related_features,
                technical_effects: effects,
            });
        }
        tuples
    }

    fn extract_solution_section(text: &str) -> &str {
        let patterns = [
            r"(?s)技术方案[：:](.+?)(?=\n技术效果|\n具体实施方式|$)",
            r"(?s)采用[^\n]*?(?=\n技术效果|\n具体实施方式|$)",
        ];
        for pat in &patterns {
            if let Ok(re) = Regex::new(pat) {
                if let Some(m) = re.find(text) {
                    return m.as_str().trim();
                }
            }
        }
        text
    }

    fn extract_problem_section(text: &str) -> &str {
        let patterns = [
            r"(?s)技术问题[：:](.+?)(?=\n技术方案|$)",
            r"(?s)所要解决的技术问题[：:](.+?)(?=\n技术方案|$)",
        ];
        for pat in &patterns {
            if let Ok(re) = Regex::new(pat) {
                if let Some(m) = re.find(text) {
                    return m.as_str().trim();
                }
            }
        }
        ""
    }

    fn extract_effects_section(text: &str) -> &str {
        let patterns = [
            r"(?s)技术效果[：:](.+?)(?=\n具体实施方式|$)",
            r"(?s)有益效果[：:](.+?)(?=\n具体实施方式|$)",
        ];
        for pat in &patterns {
            if let Ok(re) = Regex::new(pat) {
                if let Some(m) = re.find(text) {
                    return m.as_str().trim();
                }
            }
        }
        ""
    }

    fn extract_component_features(solution_text: &str) -> Vec<TechnicalFeature> {
        let mut features = Vec::new();
        let patterns = [
            r"([\w\u4e00-\u9fff]{1,8})(?:层|模块|单元|部件|装置|器件)",
            r"([\w\u4e00-\u9fff]{1,8})(?:器|机|设备)",
        ];

        for pat in &patterns {
            if let Ok(re) = Regex::new(pat) {
                for cap in re.captures_iter(solution_text) {
                    if let Some(m) = cap.get(1) {
                        let component = m.as_str().to_string();
                        let id = format!("COMP_{}", features.len() + 1);
                        features.push(TechnicalFeature {
                            id,
                            description: component.clone(),
                            feature_type: FeatureType::Essential,
                            category: FeatureCategory::Structural,
                            component: Some(component.clone()),
                            function: Some(Self::infer_function(&component, solution_text)),
                        });
                    }
                }
            }
        }
        features
    }

    fn extract_step_features(solution_text: &str) -> Vec<TechnicalFeature> {
        let mut features = Vec::new();
        let patterns = [
            r"步骤[一二三四五六七八九十\d]+[：:]\s*([^\n，。；]+)",
            r"第[一二三四五六七八九十\d]+步[：:]\s*([^\n，。；]+)",
        ];

        for pat in &patterns {
            if let Ok(re) = Regex::new(pat) {
                for cap in re.captures_iter(solution_text) {
                    if let Some(m) = cap.get(1) {
                        let desc = m.as_str().trim().to_string();
                        let id = format!("STEP_{}", features.len() + 1);
                        features.push(TechnicalFeature {
                            id,
                            description: desc.clone(),
                            feature_type: FeatureType::Essential,
                            category: FeatureCategory::Method,
                            component: None,
                            function: Some(desc),
                        });
                    }
                }
            }
        }
        features
    }

    fn extract_parameter_features(solution_text: &str) -> Vec<TechnicalFeature> {
        let mut features = Vec::new();
        let patterns = [
            r"([^\s，。]{2,10})(?:大小|数量|长度|宽度|厚度|重量)[：:]\s*([^\n，。]+)",
            r"([^\s，。]{2,10})为\s*([^\n，。]+?)(?:，|。|$)",
        ];

        for pat in &patterns {
            if let Ok(re) = Regex::new(pat) {
                for cap in re.captures_iter(solution_text) {
                    if let (Some(name), Some(value)) = (cap.get(1), cap.get(2)) {
                        let param_name = name.as_str().to_string();
                        let param_value = value.as_str().to_string();
                        let id = format!("PARAM_{}", features.len() + 1);
                        features.push(TechnicalFeature {
                            id,
                            description: format!("{}为{}", param_name, param_value),
                            feature_type: FeatureType::Optional,
                            category: FeatureCategory::Functional,
                            component: Some(param_name),
                            function: Some(param_value),
                        });
                    }
                }
            }
        }
        features
    }

    fn classify_features(features: &mut [TechnicalFeature]) {
        let optional_keywords = ["可选", "可以", "优选", "例如"];
        for feature in features.iter_mut() {
            if optional_keywords.iter().any(|kw| feature.description.contains(kw)) {
                feature.feature_type = FeatureType::Optional;
            }
        }
    }

    fn infer_function(component: &str, context: &str) -> String {
        let pat = format!("{}[^\n]*?[，。；]", regex::escape(component));
        if let Ok(re) = Regex::new(&pat) {
            if let Some(m) = re.find(context) {
                return m.as_str().trim().to_string();
            }
        }
        String::new()
    }

    fn parse_effects(effects_text: &str) -> Vec<String> {
        effects_text
            .split(&['，', '。', '；', ';'][..])
            .map(|s| s.trim().to_string())
            .filter(|s| s.len() > 5)
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_features() {
        let mut sections = std::collections::HashMap::new();
        sections.insert("技术方案".to_string(), "本发明提供一种图像识别方法，包括：输入层，用于接收图像；卷积层，用于提取特征；池化层，用于降维；全连接层，用于分类；输出层，输出结果。其中卷积核大小为3x3，池化窗口为2x2。".to_string());
        let features = FeatureExtractor::extract_features("", Some(&sections));
        assert!(!features.is_empty(), "应提取到技术特征，实际: {:?}", features);
        assert!(features.iter().any(|f| f.component.is_some()));
    }

    #[test]
    fn test_extract_component_features() {
        let text = "包括输入层、卷积层、池化层和全连接层";
        let features = FeatureExtractor::extract_component_features(text);
        assert!(features.len() >= 3, "应至少提取到3个组件特征");
    }

    #[test]
    fn test_extract_step_features() {
        let text = "步骤一：输入图像数据；步骤二：进行特征提取；步骤三：分类识别";
        let features = FeatureExtractor::extract_step_features(text);
        assert!(!features.is_empty(), "应提取到步骤特征");
    }

    #[test]
    fn test_extract_parameter_features() {
        let text = "卷积核大小为3x3，池化窗口为2x2";
        let features = FeatureExtractor::extract_parameter_features(text);
        assert!(!features.is_empty(), "应提取到参数特征");
    }

    #[test]
    fn test_classify_features() {
        let mut features = vec![
            TechnicalFeature {
                id: "1".into(),
                description: "核心模块".into(),
                feature_type: FeatureType::Essential,
                category: FeatureCategory::Structural,
                component: None,
                function: None,
            },
            TechnicalFeature {
                id: "2".into(),
                description: "可选的辅助模块".into(),
                feature_type: FeatureType::Essential,
                category: FeatureCategory::Structural,
                component: None,
                function: None,
            },
        ];
        FeatureExtractor::classify_features(&mut features);
        assert_eq!(features[0].feature_type, FeatureType::Essential);
        assert_eq!(features[1].feature_type, FeatureType::Optional);
    }
}
