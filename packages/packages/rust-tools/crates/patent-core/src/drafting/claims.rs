use crate::types::*;

/// 权利要求生成选项
#[derive(Debug, Clone)]
pub struct ClaimOptions {
    pub claim_count: usize,
    pub include_method_claims: bool,
}

impl Default for ClaimOptions {
    fn default() -> Self {
        Self {
            claim_count: 5,
            include_method_claims: true,
        }
    }
}

/// 发明类型
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum InventionType {
    Product,
    Method,
    Use,
}

/// 发明理解结果（简化版，用于权利要求生成）
#[derive(Debug, Clone)]
pub struct InventionUnderstanding {
    pub title: String,
    pub invention_type: InventionType,
    pub essential_features: Vec<TechnicalFeature>,
    pub optional_features: Vec<TechnicalFeature>,
}

/// 权利要求生成器
///
/// 源自 Athena: domains/patents/drafting/claim_generator.py
/// 规则化权利要求构建，不依赖 LLM
pub struct ClaimGenerator;

impl ClaimGenerator {
    /// 生成独立权利要求
    pub fn generate_independent_claim(
        understanding: &InventionUnderstanding,
        _options: &ClaimOptions,
    ) -> ClaimDraft {
        let preamble = Self::build_preamble(&understanding.title, &understanding.invention_type);
        let elements = Self::build_elements(&understanding.essential_features, &understanding.invention_type);
        let transitional = "其特征在于，".to_string();

        ClaimDraft {
            id: "1".to_string(),
            claim_type: ClaimType::Independent,
            preamble,
            transitional_phrase: transitional,
            elements,
            dependent_on: None,
        }
    }

    /// 生成从属权利要求
    pub fn generate_dependent_claims(
        understanding: &InventionUnderstanding,
        options: &ClaimOptions,
    ) -> Vec<ClaimDraft> {
        let features: &[TechnicalFeature] = if understanding.optional_features.is_empty() {
            if understanding.essential_features.len() > 1 {
                &understanding.essential_features[1..]
            } else {
                &[]
            }
        } else {
            &understanding.optional_features
        };

        let max_count = options.claim_count.saturating_sub(1);
        features
            .iter()
            .take(max_count)
            .enumerate()
            .map(|(i, feature)| {
                let claim_num = (i + 2).to_string();
                let limitation = if let Some(ref component) = feature.component {
                    format!("所述{}{}", component, feature.function.as_deref().unwrap_or(""))
                } else {
                    format!("其特征在于{}", feature.description)
                };

                ClaimDraft {
                    id: claim_num.clone(),
                    claim_type: ClaimType::Dependent,
                    preamble: format!("根据权利要求{}所述的{}", i + 1, understanding.title),
                    transitional_phrase: String::new(),
                    elements: vec![limitation],
                    dependent_on: Some((i + 1).to_string()),
                }
            })
            .collect()
    }

    /// 生成所有权利要求
    pub fn generate_all_claims(
        understanding: &InventionUnderstanding,
        options: &ClaimOptions,
    ) -> Vec<ClaimDraft> {
        let independent = Self::generate_independent_claim(understanding, options);
        let dependent = Self::generate_dependent_claims(understanding, options);
        std::iter::once(independent).chain(dependent).collect()
    }

    /// 将 ClaimDraft 渲染为中文权利要求文本
    pub fn render_claim(claim: &ClaimDraft) -> String {
        match claim.claim_type {
            ClaimType::Independent => {
                format!(
                    "{}. {}{}{}。",
                    claim.id,
                    claim.preamble,
                    claim.transitional_phrase,
                    claim.elements.join("；")
                )
            }
            ClaimType::Dependent => {
                format!(
                    "{}. {}{}。",
                    claim.id,
                    claim.preamble,
                    claim.elements.join("，")
                )
            }
        }
    }

    fn build_preamble(title: &str, invention_type: &InventionType) -> String {
        match invention_type {
            InventionType::Method => format!("一种{}", title),
            InventionType::Use => format!("{}的用途", title),
            InventionType::Product => format!("一种{}", title),
        }
    }

    fn build_elements(features: &[TechnicalFeature], invention_type: &InventionType) -> Vec<String> {
        match invention_type {
            InventionType::Method => {
                features
                    .iter()
                    .map(|f| {
                        if let Some(ref func) = f.function {
                            if func.len() > 5 {
                                format!("{}，用于{}", f.description, func)
                            } else {
                                f.description.clone()
                            }
                        } else {
                            f.description.clone()
                        }
                    })
                    .collect()
            }
            _ => {
                features
                    .iter()
                    .map(|f| {
                        match (&f.component, &f.function) {
                            (Some(comp), Some(func)) if func.len() > 5 => {
                                format!("{}，用于{}", comp, func)
                            }
                            (Some(comp), _) => comp.clone(),
                            _ => f.description.clone(),
                        }
                    })
                    .collect()
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_understanding() -> InventionUnderstanding {
        InventionUnderstanding {
            title: "基于深度学习的图像识别方法".to_string(),
            invention_type: InventionType::Method,
            essential_features: vec![
                TechnicalFeature {
                    id: "F1".into(),
                    description: "接收待识别图像".into(),
                    feature_type: FeatureType::Essential,
                    category: FeatureCategory::Method,
                    component: Some("输入层".into()),
                    function: Some("接收图像".into()),
                },
                TechnicalFeature {
                    id: "F2".into(),
                    description: "提取图像特征".into(),
                    feature_type: FeatureType::Essential,
                    category: FeatureCategory::Method,
                    component: Some("卷积层".into()),
                    function: Some("提取特征".into()),
                },
                TechnicalFeature {
                    id: "F3".into(),
                    description: "降维处理".into(),
                    feature_type: FeatureType::Essential,
                    category: FeatureCategory::Method,
                    component: Some("池化层".into()),
                    function: Some("降维".into()),
                },
            ],
            optional_features: vec![
                TechnicalFeature {
                    id: "F4".into(),
                    description: "卷积核大小为3x3".into(),
                    feature_type: FeatureType::Optional,
                    category: FeatureCategory::Functional,
                    component: Some("卷积核".into()),
                    function: Some("3x3大小".into()),
                },
                TechnicalFeature {
                    id: "F5".into(),
                    description: "池化窗口为2x2".into(),
                    feature_type: FeatureType::Optional,
                    category: FeatureCategory::Functional,
                    component: Some("池化窗口".into()),
                    function: Some("2x2大小".into()),
                },
            ],
        }
    }

    #[test]
    fn test_generate_independent_claim() {
        let u = test_understanding();
        let opts = ClaimOptions::default();
        let claim = ClaimGenerator::generate_independent_claim(&u, &opts);
        assert_eq!(claim.claim_type, ClaimType::Independent);
        assert!(claim.preamble.contains("一种"));
        assert!(!claim.elements.is_empty());

        let text = ClaimGenerator::render_claim(&claim);
        assert!(text.starts_with("1."));
        assert!(text.contains("其特征在于"));
    }

    #[test]
    fn test_generate_dependent_claims() {
        let u = test_understanding();
        let opts = ClaimOptions { claim_count: 5, include_method_claims: true };
        let claims = ClaimGenerator::generate_dependent_claims(&u, &opts);
        assert_eq!(claims.len(), 2); // 2个可选特征
        assert_eq!(claims[0].claim_type, ClaimType::Dependent);
    }

    #[test]
    fn test_generate_all_claims() {
        let u = test_understanding();
        let opts = ClaimOptions { claim_count: 5, ..Default::default() };
        let claims = ClaimGenerator::generate_all_claims(&u, &opts);
        assert_eq!(claims.len(), 3); // 1独立 + 2从属
        assert_eq!(claims[0].claim_type, ClaimType::Independent);
        assert_eq!(claims[1].claim_type, ClaimType::Dependent);
    }

    #[test]
    fn test_render_product_claim() {
        let u = InventionUnderstanding {
            title: "折叠铰链装置".to_string(),
            invention_type: InventionType::Product,
            essential_features: vec![
                TechnicalFeature {
                    id: "F1".into(),
                    description: "第一连接臂".into(),
                    feature_type: FeatureType::Essential,
                    category: FeatureCategory::Structural,
                    component: Some("第一连接臂".into()),
                    function: None,
                },
            ],
            optional_features: vec![],
        };
        let claim = ClaimGenerator::generate_independent_claim(&u, &ClaimOptions::default());
        let text = ClaimGenerator::render_claim(&claim);
        assert!(text.contains("一种折叠铰链装置"));
    }
}
