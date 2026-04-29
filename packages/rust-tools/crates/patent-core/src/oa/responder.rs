use crate::types::*;

/// OA 答复策略选择器
///
/// 源自 Athena: domains/patents/smart_oa_responder.py
/// 规则化策略推荐，不依赖 LLM
pub struct OaResponder;

impl OaResponder {
    /// 分析审查意见并推荐答复策略
    pub fn analyze_and_recommend(oa: &OfficeAction) -> Vec<ResponseStrategy> {
        let mut strategies = Vec::new();

        match &oa.oa_type {
            OaType::Novelty => {
                // 新颖性问题：优先争辩区别特征，备选修改权利要求
                strategies.push(ResponseStrategy {
                    strategy_type: ResponseStrategyType::Argue,
                    reasoning: "审查意见基于新颖性，可争辩存在区别技术特征未被对比文件公开".to_string(),
                    confidence: 0.6,
                });
                strategies.push(ResponseStrategy {
                    strategy_type: ResponseStrategyType::AmendClaims,
                    reasoning: "将区别特征写入独立权利要求，增强新颖性".to_string(),
                    confidence: 0.8,
                });
            }
            OaType::InventiveStep => {
                // 创造性问题：三步法争辩，或修改权利要求引入新特征
                strategies.push(ResponseStrategy {
                    strategy_type: ResponseStrategyType::Hybrid,
                    reasoning: "创造性争辩需证明区别特征非显而易见，同时修改权利要求增加限定".to_string(),
                    confidence: 0.5,
                });
                strategies.push(ResponseStrategy {
                    strategy_type: ResponseStrategyType::AmendClaims,
                    reasoning: "缩小保护范围，增加从属权利要求中的特征到独立权利要求".to_string(),
                    confidence: 0.7,
                });
            }
            OaType::Clarity => {
                strategies.push(ResponseStrategy {
                    strategy_type: ResponseStrategyType::AmendClaims,
                    reasoning: "澄清模糊表述，使权利要求清楚明确".to_string(),
                    confidence: 0.9,
                });
            }
            OaType::Support => {
                strategies.push(ResponseStrategy {
                    strategy_type: ResponseStrategyType::Hybrid,
                    reasoning: "修改说明书增加支持内容，同时调整权利要求范围".to_string(),
                    confidence: 0.7,
                });
            }
            OaType::Scope => {
                strategies.push(ResponseStrategy {
                    strategy_type: ResponseStrategyType::AmendClaims,
                    reasoning: "调整保护范围，确保不超范围修改".to_string(),
                    confidence: 0.8,
                });
            }
            _ => {
                strategies.push(ResponseStrategy {
                    strategy_type: ResponseStrategyType::Argue,
                    reasoning: "一般性争辩".to_string(),
                    confidence: 0.3,
                });
            }
        }

        // 按置信度排序
        strategies.sort_by(|a, b| b.confidence.partial_cmp(&a.confidence).unwrap());
        strategies
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_novelty_strategy() {
        let oa = OfficeAction {
            oa_type: OaType::Novelty,
            citations: vec![CitedReference {
                document_number: "CN1234567A".into(),
                relevancy: "X".into(),
                claims_affected: vec![1],
            }],
            examiner_arguments: "不具备新颖性".into(),
            affected_claims: vec![1],
        };
        let strategies = OaResponder::analyze_and_recommend(&oa);
        assert!(!strategies.is_empty());
        assert!(strategies.iter().any(|s| matches!(s.strategy_type, ResponseStrategyType::Argue)));
        assert!(strategies.iter().any(|s| matches!(s.strategy_type, ResponseStrategyType::AmendClaims)));
    }

    #[test]
    fn test_inventive_strategy() {
        let oa = OfficeAction {
            oa_type: OaType::InventiveStep,
            citations: vec![],
            examiner_arguments: "显而易见".into(),
            affected_claims: vec![1, 2],
        };
        let strategies = OaResponder::analyze_and_recommend(&oa);
        assert!(strategies.iter().any(|s| matches!(s.strategy_type, ResponseStrategyType::Hybrid)));
    }

    #[test]
    fn test_clarity_strategy() {
        let oa = OfficeAction {
            oa_type: OaType::Clarity,
            citations: vec![],
            examiner_arguments: "不清楚".into(),
            affected_claims: vec![1],
        };
        let strategies = OaResponder::analyze_and_recommend(&oa);
        assert_eq!(strategies[0].strategy_type, ResponseStrategyType::AmendClaims);
        assert!(strategies[0].confidence > 0.8);
    }
}
