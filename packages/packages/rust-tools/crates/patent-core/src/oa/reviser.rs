use crate::types::*;

/// 权利要求修订器
///
/// 源自 Athena: domains/patents/ai_services/claim_reviser.py
/// 规则化修订策略，不依赖 LLM
pub struct ClaimReviser;

impl ClaimReviser {
    /// 根据答复策略修订权利要求
    pub fn revise(
        claims: &[ClaimDraft],
        strategy: &ResponseStrategy,
    ) -> Vec<ClaimDraft> {
        match strategy.strategy_type {
            ResponseStrategyType::AmendClaims => Self::amend_claims(claims),
            ResponseStrategyType::Argue => claims.to_vec(), // 争辩策略不修改权利要求
            ResponseStrategyType::Hybrid => Self::hybrid_revise(claims),
            ResponseStrategyType::Withdraw => vec![],
        }
    }

    /// 修改权利要求策略
    fn amend_claims(claims: &[ClaimDraft]) -> Vec<ClaimDraft> {
        claims
            .iter()
            .map(|claim| {
                if claim.claim_type == ClaimType::Independent {
                    // 独立权利要求：添加"进一步限定"标记
                    let mut amended = claim.clone();
                    if !amended.elements.is_empty() {
                        let last = amended.elements.last().unwrap().clone();
                        amended.elements.last_mut().unwrap().clone_from(&format!("{}（经修改，增加了进一步限定）", last));
                    }
                    amended
                } else {
                    claim.clone()
                }
            })
            .collect()
    }

    /// 混合策略修订
    fn hybrid_revise(claims: &[ClaimDraft]) -> Vec<ClaimDraft> {
        let mut revised = Self::amend_claims(claims);
        // 确保至少有一个从属权利要求的特征被提升
        if revised.len() > 1 {
            if let Some(dep) = claims.iter().find(|c| c.claim_type == ClaimType::Dependent) {
                if let Some(ind) = revised.iter_mut().find(|c| c.claim_type == ClaimType::Independent) {
                    ind.elements.extend(dep.elements.iter().cloned());
                }
            }
        }
        revised
    }

    /// 评估修订质量
    pub fn assess_revision(original: &[ClaimDraft], revised: &[ClaimDraft]) -> f32 {
        if revised.is_empty() {
            return 0.0;
        }
        let mut score: f32 = 0.5;

        // 修改幅度适中
        let change_ratio = Self::count_changes(original, revised) as f32 / original.len().max(1) as f32;
        if change_ratio > 0.0 && change_ratio <= 0.5 {
            score += 0.2;
        }

        // 保留了权利要求的层次结构
        let has_independent = revised.iter().any(|c| c.claim_type == ClaimType::Independent);
        let has_dependent = revised.iter().any(|c| c.claim_type == ClaimType::Dependent);
        if has_independent && has_dependent {
            score += 0.15;
        }

        // 修改后的独立权利要求仍有要素
        if let Some(ind) = revised.iter().find(|c| c.claim_type == ClaimType::Independent) {
            if !ind.elements.is_empty() {
                score += 0.15;
            }
        }

        score.min(1.0)
    }

    fn count_changes(original: &[ClaimDraft], revised: &[ClaimDraft]) -> usize {
        let mut changes = 0;
        for (i, rev) in revised.iter().enumerate() {
            if let Some(orig) = original.get(i) {
                if orig.elements != rev.elements {
                    changes += 1;
                }
            }
        }
        changes
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_claims() -> Vec<ClaimDraft> {
        vec![
            ClaimDraft {
                id: "1".into(),
                claim_type: ClaimType::Independent,
                preamble: "一种装置".into(),
                transitional_phrase: "其特征在于".into(),
                elements: vec!["特征A".into(), "特征B".into()],
                dependent_on: None,
            },
            ClaimDraft {
                id: "2".into(),
                claim_type: ClaimType::Dependent,
                preamble: "根据权利要求1".into(),
                transitional_phrase: String::new(),
                elements: vec!["特征C".into()],
                dependent_on: Some("1".into()),
            },
        ]
    }

    #[test]
    fn test_amend_strategy() {
        let claims = test_claims();
        let strategy = ResponseStrategy {
            strategy_type: ResponseStrategyType::AmendClaims,
            reasoning: "修改权利要求".into(),
            confidence: 0.8,
        };
        let revised = ClaimReviser::revise(&claims, &strategy);
        assert_eq!(revised.len(), 2);
        // 独立权利要求应有修改标记
        assert!(revised[0].elements.last().unwrap().contains("修改"));
    }

    #[test]
    fn test_argue_strategy() {
        let claims = test_claims();
        let strategy = ResponseStrategy {
            strategy_type: ResponseStrategyType::Argue,
            reasoning: "争辩".into(),
            confidence: 0.6,
        };
        let revised = ClaimReviser::revise(&claims, &strategy);
        assert_eq!(revised.len(), claims.len()); // 不修改
    }

    #[test]
    fn test_assess_revision() {
        let original = test_claims();
        let revised = test_claims(); // 相同
        let score = ClaimReviser::assess_revision(&original, &revised);
        assert!(score > 0.5);
    }
}
