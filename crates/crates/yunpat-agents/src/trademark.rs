use crate::agent::PatentAgent;
use crate::context::LlmProvider;
use crate::flow::{AgentCall, FlowStep, OrchestrationFlow, QualityCheckConfig, QualityDimension};
use crate::types::*;
use anyhow::Result;
use async_trait::async_trait;
use futures_core::Stream;
use std::pin::Pin;

use crate::helpers::{AgentBase, extract_case_id, keyword_confidence, llm_generate};

pub struct TrademarkAgent {
    base: AgentBase,
}

impl Default for TrademarkAgent {
    fn default() -> Self {
        Self::new()
    }
}

impl TrademarkAgent {
    pub fn new() -> Self {
        Self {
            base: AgentBase::new("trademark"),
        }
    }

    pub fn with_llm(self, provider: Box<dyn LlmProvider>) -> Self {
        Self {
            base: self.base.with_llm(provider),
        }
    }

    pub fn has_llm(&self) -> bool {
        self.base.has_llm()
    }
}

const TRADEMARK_KEYWORDS: &[&str] = &[
    "商标",
    "trademark",
    "brand",
    "品牌",
    "注册",
    "异议",
    "撤销",
    "无效宣告",
    "近似",
    "显著性",
    "复审",
    "评审",
    "驰名",
    "尼斯分类",
    "商品服务",
];

#[async_trait]
impl PatentAgent for TrademarkAgent {
    fn id(&self) -> &AgentId {
        self.base.id()
    }

    fn name(&self) -> &str {
        "商标智能体"
    }

    fn description(&self) -> &str {
        "处理商标工作流：检索、显著性评估、近似分析、注册策略和风险评估"
    }

    fn capabilities(&self) -> &[String] {
        static CAPS: std::sync::OnceLock<Vec<String>> = std::sync::OnceLock::new();
        CAPS.get_or_init(|| {
            vec![
                "trademark_search".to_string(),
                "distinctiveness_assessment".to_string(),
                "similarity_analysis".to_string(),
                "filing_strategy".to_string(),
                "risk_evaluation".to_string(),
                "opposition_strategy".to_string(),
            ]
        })
    }

    fn can_handle(&self, intent: &UserIntent) -> Confidence {
        keyword_confidence(&intent.raw_input, TRADEMARK_KEYWORDS, 0.6, 0.1, 0.4)
    }

    fn stages(&self) -> Vec<StageDefinition> {
        vec![
            StageDefinition {
                stage_id: "search_analysis".to_string(),
                stage_name: "商标检索分析".to_string(),
                description: "分析商标标识，制定检索策略，查询在先权利".to_string(),
                requires_approval: false,
            },
            StageDefinition {
                stage_id: "distinctiveness".to_string(),
                stage_name: "显著性评估".to_string(),
                description: "评估商标的固有显著性和获得显著性".to_string(),
                requires_approval: true,
            },
            StageDefinition {
                stage_id: "similarity".to_string(),
                stage_name: "近似判断".to_string(),
                description: "与在先商标进行近似度分析和混淆可能性评估".to_string(),
                requires_approval: true,
            },
            StageDefinition {
                stage_id: "filing_strategy".to_string(),
                stage_name: "申请策略".to_string(),
                description: "制定申请方案，包括类别选择和商品项目".to_string(),
                requires_approval: false,
            },
            StageDefinition {
                stage_id: "risk_eval".to_string(),
                stage_name: "风险评估".to_string(),
                description: "综合评估注册成功概率和潜在风险".to_string(),
                requires_approval: true,
            },
        ]
    }

    async fn initialize(&mut self) -> Result<()> {
        self.base.initialized = true;
        Ok(())
    }

    fn execute(&mut self, input: AgentInput) -> Pin<Box<dyn Stream<Item = StageOutput> + Send>> {
        let topic = input.intent.raw_input.clone();
        let case_id = extract_case_id(&input.extra);
        let llm_provider = self.base.llm_provider.take();

        Box::pin(async_stream::stream! {
            yield StageOutput {
                stage_id: "search_analysis".to_string(),
                stage_name: "商标检索分析".to_string(),
                stage_type: StageType::Analysis,
                content: generate_search_content(&topic, case_id.as_deref()),
                multimodal_content: vec![],
                artifacts: vec![Artifact {
                    name: "检索策略报告".to_string(),
                    artifact_type: "search_strategy".to_string(),
                    content: generate_search_json(&topic),
                    path: None,
                }],
                requires_approval: false,
                approval_request: None,
                metadata: StageMetadata {
                    duration_ms: Some(1500),
                    ..Default::default()
                },
            };

            let distinctiveness_content = if let Some(ref provider) = llm_provider {
                llm_generate(provider.as_ref(),
                    "你是一位资深商标代理师。请评估以下商标的显著性，\
                     分析其属于固有显著性还是获得显著性，并给出法律依据。",
                    &format!("请评估以下商标的显著性：\n\n{}", topic),
                ).await
            } else {
                generate_distinctiveness_content(&topic)
            };
            yield StageOutput {
                stage_id: "distinctiveness".to_string(),
                stage_name: "显著性评估".to_string(),
                stage_type: StageType::Analysis,
                content: distinctiveness_content,
                multimodal_content: vec![],
                artifacts: vec![Artifact {
                    name: "显著性评估报告".to_string(),
                    artifact_type: "distinctiveness_report".to_string(),
                    content: generate_distinctiveness_json(&topic),
                    path: None,
                }],
                requires_approval: true,
                approval_request: Some(ApprovalRequest {
                    prompt: "显著性评估完成，是否继续近似判断？".to_string(),
                    options: vec![
                        ApprovalOption { label: "继续".to_string(), value: "continue".to_string(), is_default: true },
                        ApprovalOption { label: "重新评估".to_string(), value: "reassess".to_string(), is_default: false },
                        ApprovalOption { label: "中止".to_string(), value: "abort".to_string(), is_default: false },
                    ],
                }),
                metadata: StageMetadata { duration_ms: Some(2500), ..Default::default() },
            };

            let similarity_content = if let Some(ref provider) = llm_provider {
                llm_generate(provider.as_ref(),
                    "你是一位商标近似判断专家。请根据商标审查审理指南，\
                     对以下商标与在先商标进行近似度分析，评估混淆可能性。",
                    &format!("请进行近似判断分析：\n\n{}", topic),
                ).await
            } else {
                generate_similarity_content(&topic)
            };
            yield StageOutput {
                stage_id: "similarity".to_string(),
                stage_name: "近似判断".to_string(),
                stage_type: StageType::Analysis,
                content: similarity_content,
                multimodal_content: vec![],
                artifacts: vec![
                    Artifact {
                        name: "近似判断报告".to_string(),
                        artifact_type: "similarity_report".to_string(),
                        content: generate_similarity_json(&topic),
                        path: None,
                    },
                ],
                requires_approval: true,
                approval_request: Some(ApprovalRequest {
                    prompt: "近似判断完成，是否制定申请策略？".to_string(),
                    options: vec![
                        ApprovalOption { label: "制定策略".to_string(), value: "strategy".to_string(), is_default: true },
                        ApprovalOption { label: "修改商标".to_string(), value: "modify".to_string(), is_default: false },
                        ApprovalOption { label: "保存结果".to_string(), value: "save".to_string(), is_default: false },
                    ],
                }),
                metadata: StageMetadata { duration_ms: Some(3000), ..Default::default() },
            };

            let strategy_content = if let Some(ref provider) = llm_provider {
                llm_generate(provider.as_ref(),
                    "你是一位商标策略专家。请根据检索和近似分析结果，\
                     制定最优的商标申请策略，包括类别选择和商品项目。",
                    &format!("请制定申请策略：\n\n{}", topic),
                ).await
            } else {
                generate_strategy_content(&topic)
            };
            yield StageOutput {
                stage_id: "filing_strategy".to_string(),
                stage_name: "申请策略".to_string(),
                stage_type: StageType::Suggestion,
                content: strategy_content,
                multimodal_content: vec![],
                artifacts: vec![
                    Artifact {
                        name: "申请方案".to_string(),
                        artifact_type: "filing_plan".to_string(),
                        content: generate_filing_plan(&topic),
                        path: None,
                    },
                ],
                requires_approval: false,
                approval_request: None,
                metadata: StageMetadata { duration_ms: Some(2800), ..Default::default() },
            };

            let risk_report = generate_risk_report();
            let overall_score = risk_report.overall_score;
            yield StageOutput {
                stage_id: "risk_eval".to_string(),
                stage_name: "风险评估".to_string(),
                stage_type: StageType::Completed,
                content: format!(
                    "# 商标风险评估报告\n\n\
                     综合评分: **{:.1}/10.0**\n\n\
                     ## 评估维度\n\n\
                     | 维度 | 评分 | 状态 |\n\
                     |------|------|------|\n\
                     | 显著性 | {:.1} | {} |\n\
                     | 近似风险 | {:.1} | {} |\n\
                     | 类别覆盖 | {:.1} | {} |\n\
                     | 法律合规 | {:.1} | {} |\n\
                     | 注册成功率 | {:.1} | {} |\n\n\
                     评估完成，请确认是否提交申请。",
                    overall_score,
                    risk_report.dimensions[0].score,
                    pass_mark(risk_report.dimensions[0].score),
                    risk_report.dimensions[1].score,
                    pass_mark(risk_report.dimensions[1].score),
                    risk_report.dimensions[2].score,
                    pass_mark(risk_report.dimensions[2].score),
                    risk_report.dimensions[3].score,
                    pass_mark(risk_report.dimensions[3].score),
                    risk_report.dimensions[4].score,
                    pass_mark(risk_report.dimensions[4].score),
                ),
                multimodal_content: vec![],
                artifacts: vec![Artifact {
                    name: "完整商标申请包".to_string(),
                    artifact_type: "trademark_package".to_string(),
                    content: generate_trademark_package(&topic),
                    path: None,
                }],
                requires_approval: true,
                approval_request: Some(ApprovalRequest {
                    prompt: "风险评估完成，是否确认提交申请？".to_string(),
                    options: vec![
                        ApprovalOption { label: "确认提交".to_string(), value: "submit".to_string(), is_default: true },
                        ApprovalOption { label: "需要修改".to_string(), value: "revise".to_string(), is_default: false },
                        ApprovalOption { label: "重新评估".to_string(), value: "reassess".to_string(), is_default: false },
                    ],
                }),
                metadata: StageMetadata { duration_ms: Some(2000), ..Default::default() },
            };
        })
    }

    async fn terminate(&mut self) -> Result<()> {
        self.base.initialized = false;
        Ok(())
    }
}

impl crate::agent::OrchestrationAgent for TrademarkAgent {
    fn flow_definition(&self) -> OrchestrationFlow {
        OrchestrationFlow {
            flow_id: "trademark".to_string(),
            flow_name: "商标申请".to_string(),
            description: "完整的商标申请流程：检索→显著性→近似判断→策略→风险评估".to_string(),
            steps: vec![
                FlowStep {
                    step_id: "search_analysis".to_string(),
                    step_name: "商标检索分析".to_string(),
                    order: 1,
                    agent_calls: vec![AgentCall {
                        agent_id: "trademark".to_string(),
                        input_mapping: std::collections::HashMap::new(),
                        output_key: "search_result".to_string(),
                        condition: None,
                        r#loop: None,
                    }],
                    requires_approval: false,
                    approval_prompt: None,
                    quality_check: None,
                    condition: None,
                },
                FlowStep {
                    step_id: "distinctiveness".to_string(),
                    step_name: "显著性评估".to_string(),
                    order: 2,
                    agent_calls: vec![AgentCall {
                        agent_id: "trademark".to_string(),
                        input_mapping: std::collections::HashMap::new(),
                        output_key: "distinctiveness".to_string(),
                        condition: Some("search_result.exists".to_string()),
                        r#loop: None,
                    }],
                    requires_approval: true,
                    approval_prompt: Some("显著性评估完成，是否继续？".to_string()),
                    quality_check: None,
                    condition: Some("search_result.exists".to_string()),
                },
                FlowStep {
                    step_id: "similarity".to_string(),
                    step_name: "近似判断".to_string(),
                    order: 3,
                    agent_calls: vec![AgentCall {
                        agent_id: "trademark".to_string(),
                        input_mapping: std::collections::HashMap::new(),
                        output_key: "similarity".to_string(),
                        condition: Some("distinctiveness.exists".to_string()),
                        r#loop: None,
                    }],
                    requires_approval: true,
                    approval_prompt: Some("近似判断完成，是否制定策略？".to_string()),
                    quality_check: None,
                    condition: Some("distinctiveness.exists".to_string()),
                },
                FlowStep {
                    step_id: "filing_strategy".to_string(),
                    step_name: "申请策略".to_string(),
                    order: 4,
                    agent_calls: vec![AgentCall {
                        agent_id: "trademark".to_string(),
                        input_mapping: std::collections::HashMap::new(),
                        output_key: "strategy".to_string(),
                        condition: Some("similarity.exists".to_string()),
                        r#loop: None,
                    }],
                    requires_approval: false,
                    approval_prompt: None,
                    quality_check: None,
                    condition: Some("similarity.exists".to_string()),
                },
                FlowStep {
                    step_id: "risk_eval".to_string(),
                    step_name: "风险评估".to_string(),
                    order: 5,
                    agent_calls: vec![AgentCall {
                        agent_id: "trademark".to_string(),
                        input_mapping: std::collections::HashMap::new(),
                        output_key: "final_package".to_string(),
                        condition: Some("strategy.exists".to_string()),
                        r#loop: None,
                    }],
                    requires_approval: true,
                    approval_prompt: Some("风险评估完成，是否确认提交？".to_string()),
                    quality_check: Some(QualityCheckConfig {
                        dimensions: vec![
                            "显著性".to_string(),
                            "近似风险".to_string(),
                            "类别覆盖".to_string(),
                            "法律合规".to_string(),
                            "注册成功率".to_string(),
                        ],
                        threshold: 7.0,
                        max_auto_retries: 2,
                        escalate_to_human: true,
                    }),
                    condition: Some("strategy.exists".to_string()),
                },
            ],
            quality_dimensions: vec![
                QualityDimension {
                    name: "显著性".to_string(),
                    description: "商标的显著性强弱".to_string(),
                    weight: 0.25,
                },
                QualityDimension {
                    name: "近似风险".to_string(),
                    description: "与在先商标的近似度".to_string(),
                    weight: 0.25,
                },
                QualityDimension {
                    name: "类别覆盖".to_string(),
                    description: "尼斯分类覆盖完整性".to_string(),
                    weight: 0.15,
                },
                QualityDimension {
                    name: "法律合规".to_string(),
                    description: "符合商标法及相关法规".to_string(),
                    weight: 0.20,
                },
                QualityDimension {
                    name: "注册成功率".to_string(),
                    description: "综合注册成功概率".to_string(),
                    weight: 0.15,
                },
            ],
        }
    }
}

struct RiskReport {
    overall_score: f32,
    dimensions: Vec<RiskDimension>,
}

struct RiskDimension {
    #[expect(dead_code)]
    name: String,
    score: f32,
}

fn generate_search_content(topic: &str, case_id: Option<&str>) -> String {
    let case_info = case_id
        .map(|id| format!("\n关联案件: {}", id))
        .unwrap_or_default();
    format!(
        "# 商标检索分析\n\n\
         商标: {}\n{}\n\n\
         ## 检索策略\n\n\
         ### 检索范围\n\
         - 文字商标：完全相同、近似变体、谐音、拼音\n\
         - 图形商标：视觉近似、组合要素\n\
         - 类别：核心类别 + 关联类别\n\n\
         ### 数据库\n\
         - 中国商标网官方数据库\n\
         - 马德里国际注册\n\
         - 欧盟商标（EUTM）\n\n\
         ## 初步分析\n\n\
         1. **相同/高度近似商标**: 未发现完全相同商标\n\
         2. **近似商标**: 发现3件疑似近似商标（待详细比对）\n\
         3. **类别冲突**: 核心类别（第9类）无冲突\n\n\
         *Phase 1 模板输出。*",
        topic, case_info
    )
}

fn generate_search_json(topic: &str) -> String {
    serde_json::json!({
        "search_type": "trademark",
        "topic": topic,
        "databases": ["中国商标网", "马德里体系", "EUTM"],
        "categories_checked": [9, 35, 42],
        "exact_matches": 0,
        "similar_matches": 3,
        "risk_level": "medium",
        "stage": "template_phase1"
    })
    .to_string()
}

fn generate_distinctiveness_content(topic: &str) -> String {
    format!(
        "# 显著性评估\n\n\
         商标: {}\n\n\
         ## 评估结果\n\n\
         ### 固有显著性\n\
         - **独创性**: 中（非通用词汇，但含常见词根）\n\
         - **描述性**: 弱（部分描述商品特点）\n\
         - **暗示性**: 中（需联想才能理解）\n\n\
         ### 获得显著性\n\
         - **市场使用**: 需提供使用证据\n\
         - **知名度**: 新商标，暂无知名度\n\n\
         ### 法律依据\n\
         - 商标法第11条：不得注册的标志\n\
         - 商标审查审理指南：显著性判断标准\n\n\
         ### 结论\n\
         **建议**: 该商标具有中等显著性，建议通过使用获得第二含义后申请，或选择更具显著性的标识。",
        topic
    )
}

fn generate_distinctiveness_json(topic: &str) -> String {
    serde_json::json!({
        "topic": topic,
        "inherent_distinctiveness": "medium",
        "acquired_distinctiveness": "none",
        "legal_basis": ["商标法第11条", "商标审查审理指南"],
        "recommendation": "建议使用或选择更具显著性的标识",
        "risk_factors": ["含常见词根", "部分描述性"]
    })
    .to_string()
}

fn generate_similarity_content(topic: &str) -> String {
    format!(
        "# 近似判断分析\n\n\
         商标: {}\n\n\
         ## 比对结果\n\n\
         ### 引证商标1: CNXXXXXX（第9类）\n\
         - **音**: 发音不同\n\
         - **形**: 字形结构差异较大\n\
         - **义**: 含义不同\n\
         - **结论**: 不构成近似\n\n\
         ### 引证商标2: CNYYYYYY（第35类）\n\
         - **音**: 发音相近\n\
         - **形**: 字形有一定相似度\n\
         - **义**: 含义关联\n\
         - **结论**: **疑似近似**，需进一步评估混淆可能性\n\n\
         ### 混淆可能性评估\n\
         - 商品/服务类似度：中\n\
         - 相关公众注意力：一般\n\
         - 知名度影响：低\n\n\
         **综合结论**: 与引证商标2存在中等近似风险，建议在申请前进行修改或准备争辩理由。",
        topic
    )
}

fn generate_similarity_json(topic: &str) -> String {
    serde_json::json!({
        "topic": topic,
        "comparison_results": [
            {"citation": "CNXXXXXX", "class": 9, "sound": "different", "shape": "different", "meaning": "different", "conclusion": "not_similar"},
            {"citation": "CNYYYYYY", "class": 35, "sound": "similar", "shape": "similar", "meaning": "related", "conclusion": "potentially_similar"}
        ],
        "overall_risk": "medium",
        "recommendation": "修改或准备争辩理由"
    }).to_string()
}

fn generate_strategy_content(topic: &str) -> String {
    format!(
        "# 商标申请策略\n\n\
         商标: {}\n\n\
         ## 方案A（推荐）: 全面保护\n\n\
         **类别选择**: 核心类别 + 防御类别\n\
         - 第9类：核心商品（软件、APP）\n\
         - 第35类：广告销售\n\
         - 第42类：技术服务\n\n\
         **优点**: 保护范围最广\n\
         **缺点**: 成本较高\n\n\
         ## 方案B: 核心保护\n\n\
         **类别选择**: 仅核心类别\n\
         - 第9类：核心商品\n\n\
         **优点**: 成本最低\n\
         **缺点**: 保护范围有限\n\n\
         ## 方案C: 分阶段申请\n\n\
         **第一阶段**: 第9类（核心）\n\
         **第二阶段**: 第35、42类（视注册情况）\n\n\
         **建议**: 推荐方案C，分阶段降低风险。",
        topic
    )
}

fn generate_filing_plan(topic: &str) -> String {
    format!(
        "# 申请方案\n\n\
         商标: {}\n\n\
         ## 申请信息\n\n\
         - **申请方式**: 单一申请\n\
         - **优先类别**: 第9类\n\
         - **商品项目**: 软件、计算机程序、APP等\n\
         - **申请人类型**: 企业/个人\n\n\
         ## 时间节点\n\n\
         1. 形式审查：1-2个月\n\
         2. 实质审查：4-6个月\n\
         3. 公告期：3个月\n\
         4. 注册证书：公告期满后1-2个月\n\n\
         **预计总时长**: 9-12个月",
        topic
    )
}

fn generate_risk_report() -> RiskReport {
    RiskReport {
        overall_score: 7.8,
        dimensions: vec![
            RiskDimension {
                name: "显著性".to_string(),
                score: 7.5,
            },
            RiskDimension {
                name: "近似风险".to_string(),
                score: 7.0,
            },
            RiskDimension {
                name: "类别覆盖".to_string(),
                score: 8.5,
            },
            RiskDimension {
                name: "法律合规".to_string(),
                score: 8.0,
            },
            RiskDimension {
                name: "注册成功率".to_string(),
                score: 8.0,
            },
        ],
    }
}

fn pass_mark(score: f32) -> &'static str {
    crate::helpers::pass_mark(score, 7.0)
}

fn generate_trademark_package(topic: &str) -> String {
    format!(
        "# 商标申请包\n\n\
         商标: {}\n\
         状态: 已通过风险评估\n\n\
         ## 包含文件\n\n\
         1. 检索策略报告\n\
         2. 显著性评估报告\n\
         3. 近似判断报告\n\
         4. 申请方案\n\
         5. 风险评估报告\n\n\
         ## 质量评分\n\n\
         综合评分: 7.8/10.0 (合格，≥7.0阈值)\n\n\
         ---\n\
         *Phase 1 模板生成。*",
        topic
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::agent::OrchestrationAgent;

    #[test]
    fn test_trademark_agent_metadata() {
        let agent = TrademarkAgent::new();
        assert_eq!(agent.id().0, "trademark");
        assert_eq!(agent.name(), "商标智能体");
        assert!(!agent.capabilities().is_empty());
        assert_eq!(agent.stages().len(), 5);
    }

    #[test]
    fn test_can_handle_trademark_intent() {
        let agent = TrademarkAgent::new();
        let intent = UserIntent {
            raw_input: "商标注册策略".to_string(),
            parsed_topic: None,
            parsed_scope: None,
            parsed_depth: None,
        };
        let conf = agent.can_handle(&intent);
        assert!(
            conf > 0.6,
            "Expected high confidence for trademark intent, got {}",
            conf
        );
    }

    #[test]
    fn test_can_handle_non_trademark() {
        let agent = TrademarkAgent::new();
        let intent = UserIntent {
            raw_input: "今天天气怎么样".to_string(),
            parsed_topic: None,
            parsed_scope: None,
            parsed_depth: None,
        };
        let conf = agent.can_handle(&intent);
        assert_eq!(
            conf, 0.0,
            "Expected zero confidence for non-trademark intent"
        );
    }

    #[tokio::test]
    async fn test_execute_returns_five_stages() {
        let mut agent = TrademarkAgent::new();
        agent.initialize().await.unwrap();

        let input = AgentInput {
            intent: UserIntent {
                raw_input: "商标申请分析".to_string(),
                parsed_topic: Some("商标".to_string()),
                parsed_scope: None,
                parsed_depth: None,
            },
            extra: serde_json::Value::Null,
        };

        use futures_util::StreamExt;
        let stages: Vec<StageOutput> = agent.execute(input).collect().await;

        assert_eq!(stages.len(), 5);
        assert_eq!(stages[0].stage_id, "search_analysis");
        assert_eq!(stages[1].stage_id, "distinctiveness");
        assert_eq!(stages[2].stage_id, "similarity");
        assert_eq!(stages[3].stage_id, "filing_strategy");
        assert_eq!(stages[4].stage_id, "risk_eval");

        assert!(!stages[0].requires_approval);
        assert!(stages[1].requires_approval);
        assert!(stages[2].requires_approval);
        assert!(!stages[3].requires_approval);
        assert!(stages[4].requires_approval);
    }

    #[test]
    fn test_flow_definition() {
        let agent = TrademarkAgent::new();
        let flow = agent.flow_definition();

        assert_eq!(flow.flow_id, "trademark");
        assert_eq!(flow.steps.len(), 5);
        assert_eq!(flow.quality_dimensions.len(), 5);

        let orders: Vec<u32> = flow.steps.iter().map(|s| s.order).collect();
        assert_eq!(orders, vec![1, 2, 3, 4, 5]);

        let last_step = flow.steps.last().unwrap();
        assert!(last_step.quality_check.is_some());
        let qc = last_step.quality_check.as_ref().unwrap();
        assert_eq!(qc.threshold, 7.0);
        assert_eq!(qc.dimensions.len(), 5);
    }
}
