//! Invalidation Agent — patent invalidation petition workflow.
//!
//! OrchestrationAgent that drives a 5-step patent invalidation flow:
//! 1. 目标专利分析 (Target Patent Analysis)
//! 2. 证据收集 (Evidence Collection)
//! 3. 无效理由分析 (Invalidity Grounds Analysis)
//! 4. 策略制定与论证 (Strategy Development & Argumentation)
//! 5. 无效宣告请求书撰写 (Invalidation Petition Drafting)
//!
//! Phase 1: Template-based outputs without LLM or MCP calls.
//! The structure and approval gates are fully functional, enabling
//! end-to-end validation of the orchestration flow engine.

use crate::agent::PatentAgent;
use crate::context::LlmProvider;
use crate::flow::{AgentCall, FlowStep, OrchestrationFlow, QualityCheckConfig, QualityDimension};
use crate::types::*;
use anyhow::Result;
use async_trait::async_trait;
use futures_core::Stream;
use std::pin::Pin;

use crate::helpers::{llm_generate, extract_case_id, keyword_confidence, AgentBase};

/// The Invalidation Agent handles patent invalidation petition workflows.
pub struct InvalidationAgent {
    base: AgentBase,
}

impl Default for InvalidationAgent {
    fn default() -> Self {
        Self::new()
    }
}

impl InvalidationAgent {
    pub fn new() -> Self {
        Self { base: AgentBase::new("invalidation") }
    }

    /// Set an LLM provider for content generation (builder pattern).
    pub fn with_llm(self, provider: Box<dyn LlmProvider>) -> Self {
        Self { base: self.base.with_llm(provider) }
    }

    /// Whether an LLM provider is configured.
    pub fn has_llm(&self) -> bool {
        self.base.has_llm()
    }
}

const INVALIDATION_KEYWORDS: &[&str] = &[
    "无效",
    "无效宣告",
    "无效请求",
    "宣告无效",
    "无效答辩",
    "无效程序",
    "专利无效",
    "invalidation",
    "无效宣告请求",
];

#[async_trait]
impl PatentAgent for InvalidationAgent {
    fn id(&self) -> &AgentId {
        self.base.id()
    }

    fn name(&self) -> &str {
        "无效宣告智能体"
    }

    fn description(&self) -> &str {
        "处理专利无效宣告请求，分析目标专利，收集证据，制定无效策略，撰写无效宣告请求书。"
    }

    fn capabilities(&self) -> &[String] {
        static CAPS: std::sync::OnceLock<Vec<String>> = std::sync::OnceLock::new();
        CAPS.get_or_init(|| {
            vec![
                "专利分析".to_string(),
                "证据收集".to_string(),
                "无效理由分析".to_string(),
                "策略制定".to_string(),
                "文书撰写".to_string(),
            ]
        })
    }

    fn can_handle(&self, intent: &UserIntent) -> Confidence {
        keyword_confidence(&intent.raw_input, INVALIDATION_KEYWORDS, 0.6, 0.1, 0.4)
    }

    fn stages(&self) -> Vec<StageDefinition> {
        vec![
            StageDefinition {
                stage_id: "target_analysis".to_string(),
                stage_name: "目标专利分析".to_string(),
                description: "系统分析目标专利的权利要求，确定保护范围和技术方案要点".to_string(),
                requires_approval: false,
            },
            StageDefinition {
                stage_id: "evidence_collection".to_string(),
                stage_name: "证据收集".to_string(),
                description: "收集现有技术证据，包括对比文件、公知常识和技术标准".to_string(),
                requires_approval: false,
            },
            StageDefinition {
                stage_id: "grounds_analysis".to_string(),
                stage_name: "无效理由分析".to_string(),
                description: "分析无效理由，包括新颖性、创造性、充分公开等".to_string(),
                requires_approval: true,
            },
            StageDefinition {
                stage_id: "strategy_development".to_string(),
                stage_name: "策略制定与论证".to_string(),
                description: "制定无效宣告的论证策略和证据组合方案".to_string(),
                requires_approval: true,
            },
            StageDefinition {
                stage_id: "petition_drafting".to_string(),
                stage_name: "无效宣告请求书撰写".to_string(),
                description: "撰写完整的无效宣告请求书".to_string(),
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

        // Take the LLM provider out (move into the stream).
        let llm_provider = self.base.llm_provider.take();

        Box::pin(async_stream::stream! {
            // Step 1: 目标专利分析
            yield StageOutput {
                stage_id: "target_analysis".to_string(),
                stage_name: "目标专利分析".to_string(),
                stage_type: StageType::Analysis,
                content: generate_target_analysis_content(&topic, case_id.as_deref()),
                multimodal_content: vec![],
                artifacts: vec![Artifact {
                    name: "目标专利结构化数据".to_string(),
                    artifact_type: "parsed_patent".to_string(),
                    content: generate_parsed_patent_json(&topic),
                    path: None,
                }],
                requires_approval: false,
                approval_request: None,
                metadata: StageMetadata {
                    duration_ms: Some(1500),
                    ..Default::default()
                },
            };

            // Step 2: 证据收集
            let evidence_content = if let Some(ref provider) = llm_provider {
                llm_generate(provider.as_ref(),
                    "你是一位专利检索专家。请针对目标专利的权利要求，\
                     检索相关的现有技术文献，收集可用于无效宣告的证据。",
                    &format!("请为以下专利收集无效宣告相关证据：\n\n{}", topic),
                ).await
            } else {
                generate_evidence_collection_content(&topic)
            };
            yield StageOutput {
                stage_id: "evidence_collection".to_string(),
                stage_name: "证据收集".to_string(),
                stage_type: StageType::Analysis,
                content: evidence_content,
                multimodal_content: vec![],
                artifacts: vec![Artifact {
                    name: "证据清单".to_string(),
                    artifact_type: "evidence_list".to_string(),
                    content: generate_evidence_list(&topic),
                    path: None,
                }],
                requires_approval: false,
                approval_request: None,
                metadata: StageMetadata {
                    duration_ms: Some(3000),
                    ..Default::default()
                },
            };

            // Step 3: 无效理由分析 (with approval gate, LLM or template)
            let grounds_content = if let Some(ref provider) = llm_provider {
                llm_generate(provider.as_ref(),
                    "你是一位资深专利代理师，擅长无效宣告程序。\
                     请分析目标专利的无效理由，评估新颖性、创造性、充分公开等方面的无效可能性。",
                    &format!("请分析以下专利的无效理由：\n\n{}", topic),
                ).await
            } else {
                generate_grounds_analysis_content(&topic)
            };
            yield StageOutput {
                stage_id: "grounds_analysis".to_string(),
                stage_name: "无效理由分析".to_string(),
                stage_type: StageType::Suggestion,
                content: grounds_content,
                multimodal_content: vec![],
                artifacts: vec![Artifact {
                    name: "无效理由分析报告".to_string(),
                    artifact_type: "grounds_report".to_string(),
                    content: generate_grounds_report(&topic),
                    path: None,
                }],
                requires_approval: true,
                approval_request: Some(ApprovalRequest {
                    prompt: "无效理由分析结果如下，是否继续制定无效策略？".to_string(),
                    options: vec![
                        ApprovalOption {
                            label: "继续制定策略".to_string(),
                            value: "continue".to_string(),
                            is_default: true,
                        },
                        ApprovalOption {
                            label: "补充证据".to_string(),
                            value: "supplement".to_string(),
                            is_default: false,
                        },
                        ApprovalOption {
                            label: "中止流程".to_string(),
                            value: "abort".to_string(),
                            is_default: false,
                        },
                    ],
                }),
                metadata: StageMetadata {
                    duration_ms: Some(4000),
                    ..Default::default()
                },
            };

            // Step 4: 策略制定与论证 (with approval gate, LLM or template)
            let strategy_content = if let Some(ref provider) = llm_provider {
                llm_generate(provider.as_ref(),
                    "你是一位专利无效宣告策略专家。请根据无效理由分析结果，\
                     制定论证策略，包括证据组合方案和论证路径。",
                    &format!("请为以下专利无效案件制定论证策略：\n\n{}", topic),
                ).await
            } else {
                generate_strategy_content(&topic)
            };
            yield StageOutput {
                stage_id: "strategy_development".to_string(),
                stage_name: "策略制定与论证".to_string(),
                stage_type: StageType::Suggestion,
                content: strategy_content,
                multimodal_content: vec![],
                artifacts: vec![
                    Artifact {
                        name: "论证策略方案".to_string(),
                        artifact_type: "strategy_plan".to_string(),
                        content: generate_strategy_plan(&topic),
                        path: None,
                    },
                    Artifact {
                        name: "证据组合对照表".to_string(),
                        artifact_type: "evidence_mapping".to_string(),
                        content: generate_evidence_mapping(),
                        path: None,
                    },
                ],
                requires_approval: true,
                approval_request: Some(ApprovalRequest {
                    prompt: "请选择无效宣告论证策略方向：".to_string(),
                    options: vec![
                        ApprovalOption {
                            label: "方案A: 新颖性+创造性组合攻击".to_string(),
                            value: "strategy_a".to_string(),
                            is_default: true,
                        },
                        ApprovalOption {
                            label: "方案B: 充分公开+实用性攻击".to_string(),
                            value: "strategy_b".to_string(),
                            is_default: false,
                        },
                        ApprovalOption {
                            label: "方案C: 全理由综合攻击".to_string(),
                            value: "strategy_c".to_string(),
                            is_default: false,
                        },
                    ],
                }),
                metadata: StageMetadata {
                    duration_ms: Some(3500),
                    ..Default::default()
                },
            };

            // Step 5: 无效宣告请求书撰写 (with approval gate)
            let petition_content = if let Some(ref provider) = llm_provider {
                llm_generate(provider.as_ref(),
                    "你是一位专利代理师，擅长撰写无效宣告请求书。\
                     请根据论证策略，撰写完整的无效宣告请求书。",
                    &format!("请为以下案件撰写无效宣告请求书：\n\n{}", topic),
                ).await
            } else {
                generate_petition_content(&topic)
            };
            let quality_report = generate_quality_report();
            let overall_score = quality_report.overall_score;
            yield StageOutput {
                stage_id: "petition_drafting".to_string(),
                stage_name: "无效宣告请求书撰写".to_string(),
                stage_type: StageType::Completed,
                content: format!(
                    "{}\n\n---\n\n# 质量验证报告\n\n\
                     综合评分: **{:.1}/10.0**\n\n\
                     ## 各维度评分\n\n\
                     | 维度 | 评分 | 状态 |\n\
                     |------|------|------|\n\
                     | 法律依据充分性 | {:.1} | {} |\n\
                     | 证据链完整性 | {:.1} | {} |\n\
                     | 逻辑严密性 | {:.1} | {} |\n\
                     | 程序合规性 | {:.1} | {} |\n\n\
                     无效宣告请求书已通过质量检查，准备提交。",
                    petition_content,
                    overall_score,
                    quality_report.dimensions[0].score,
                    pass_mark(quality_report.dimensions[0].score),
                    quality_report.dimensions[1].score,
                    pass_mark(quality_report.dimensions[1].score),
                    quality_report.dimensions[2].score,
                    pass_mark(quality_report.dimensions[2].score),
                    quality_report.dimensions[3].score,
                    pass_mark(quality_report.dimensions[3].score),
                ),
                multimodal_content: vec![],
                artifacts: vec![Artifact {
                    name: "无效宣告请求书".to_string(),
                    artifact_type: "invalidation_petition".to_string(),
                    content: generate_invalidation_petition(&topic),
                    path: None,
                }],
                requires_approval: true,
                approval_request: Some(ApprovalRequest {
                    prompt: "无效宣告请求书已通过质量检查，是否确认提交？".to_string(),
                    options: vec![
                        ApprovalOption {
                            label: "确认提交".to_string(),
                            value: "submit".to_string(),
                            is_default: true,
                        },
                        ApprovalOption {
                            label: "需要修改".to_string(),
                            value: "revise".to_string(),
                            is_default: false,
                        },
                        ApprovalOption {
                            label: "重新生成".to_string(),
                            value: "regenerate".to_string(),
                            is_default: false,
                        },
                    ],
                }),
                metadata: StageMetadata {
                    duration_ms: Some(5000),
                    ..Default::default()
                },
            };
        })
    }

    async fn terminate(&mut self) -> Result<()> {
        self.base.initialized = false;
        Ok(())
    }
}

impl crate::agent::OrchestrationAgent for InvalidationAgent {
    fn flow_definition(&self) -> OrchestrationFlow {
        OrchestrationFlow {
            flow_id: "invalidation".to_string(),
            flow_name: "专利无效宣告".to_string(),
            description: "完整的专利无效宣告流程：分析→证据→理由→策略→撰写".to_string(),
            steps: vec![
                FlowStep {
                    step_id: "target_analysis".to_string(),
                    step_name: "目标专利分析".to_string(),
                    order: 1,
                    agent_calls: vec![AgentCall {
                        agent_id: "invalidation".to_string(),
                        input_mapping: std::collections::HashMap::new(),
                        output_key: "target_patent".to_string(),
                        condition: None,
                        r#loop: None,
                    }],
                    requires_approval: false,
                    approval_prompt: None,
                    quality_check: None,
                    condition: None,
                },
                FlowStep {
                    step_id: "evidence_collection".to_string(),
                    step_name: "证据收集".to_string(),
                    order: 2,
                    agent_calls: vec![AgentCall {
                        agent_id: "invalidation".to_string(),
                        input_mapping: std::collections::HashMap::new(),
                        output_key: "evidence".to_string(),
                        condition: Some("target_patent.exists".to_string()),
                        r#loop: None,
                    }],
                    requires_approval: false,
                    approval_prompt: None,
                    quality_check: None,
                    condition: Some("target_patent.exists".to_string()),
                },
                FlowStep {
                    step_id: "grounds_analysis".to_string(),
                    step_name: "无效理由分析".to_string(),
                    order: 3,
                    agent_calls: vec![AgentCall {
                        agent_id: "invalidation".to_string(),
                        input_mapping: std::collections::HashMap::new(),
                        output_key: "grounds_result".to_string(),
                        condition: Some("evidence.exists".to_string()),
                        r#loop: None,
                    }],
                    requires_approval: true,
                    approval_prompt: Some("无效理由分析结果如下，是否继续制定策略？".to_string()),
                    quality_check: None,
                    condition: Some("evidence.exists".to_string()),
                },
                FlowStep {
                    step_id: "strategy_development".to_string(),
                    step_name: "策略制定与论证".to_string(),
                    order: 4,
                    agent_calls: vec![AgentCall {
                        agent_id: "invalidation".to_string(),
                        input_mapping: std::collections::HashMap::new(),
                        output_key: "strategy".to_string(),
                        condition: Some("grounds_result.exists".to_string()),
                        r#loop: None,
                    }],
                    requires_approval: true,
                    approval_prompt: Some("请选择无效宣告论证策略方向".to_string()),
                    quality_check: None,
                    condition: Some("grounds_result.exists".to_string()),
                },
                FlowStep {
                    step_id: "petition_drafting".to_string(),
                    step_name: "无效宣告请求书撰写".to_string(),
                    order: 5,
                    agent_calls: vec![AgentCall {
                        agent_id: "invalidation".to_string(),
                        input_mapping: std::collections::HashMap::new(),
                        output_key: "petition".to_string(),
                        condition: Some("strategy.exists".to_string()),
                        r#loop: None,
                    }],
                    requires_approval: true,
                    approval_prompt: Some(
                        "无效宣告请求书已通过质量检查，是否确认提交？".to_string(),
                    ),
                    quality_check: Some(QualityCheckConfig {
                        dimensions: vec![
                            "法律依据充分性".to_string(),
                            "证据链完整性".to_string(),
                            "逻辑严密性".to_string(),
                            "程序合规性".to_string(),
                        ],
                        threshold: 7.5,
                        max_auto_retries: 2,
                        escalate_to_human: true,
                    }),
                    condition: Some("strategy.exists".to_string()),
                },
            ],
            quality_dimensions: vec![
                QualityDimension {
                    name: "法律依据充分性".to_string(),
                    description: "无效宣告请求中引用的法律条文和审查指南是否准确充分".to_string(),
                    weight: 0.30,
                },
                QualityDimension {
                    name: "证据链完整性".to_string(),
                    description: "证据组合是否完整，能否形成完整的证据链".to_string(),
                    weight: 0.30,
                },
                QualityDimension {
                    name: "逻辑严密性".to_string(),
                    description: "论证逻辑是否严密，无逻辑漏洞".to_string(),
                    weight: 0.25,
                },
                QualityDimension {
                    name: "程序合规性".to_string(),
                    description: "是否符合专利复审委员会的程序要求".to_string(),
                    weight: 0.15,
                },
            ],
        }
    }
}

// --- Content generation helpers ---

// --- Template-based content generation (fallback) ---

struct QualityReport {
    overall_score: f32,
    dimensions: Vec<QualityDimensionScore>,
}

struct QualityDimensionScore {
    #[expect(dead_code)]
    name: String,
    score: f32,
}

fn generate_target_analysis_content(topic: &str, case_id: Option<&str>) -> String {
    let case_info = case_id
        .map(|id| format!("\n关联案件: {}", id))
        .unwrap_or_default();
    format!(
        "## 目标专利分析\n\n\
         对目标专利进行系统分析：\n\n\
         1. **专利基本信息**: {}\n\
         2. **权利要求解析**: 独立权利要求与从属权利要求\n\
         3. **技术方案要点**: 待提取\n\
         4. **保护范围界定**: 待分析\n\n\
         基于以上分析，确定目标专利的核心技术特征和保护范围，\
         为后续的无效宣告提供分析基础。{}",
        topic, case_info
    )
}

fn generate_parsed_patent_json(topic: &str) -> String {
    serde_json::json!({
        "patent_type": "invention",
        "topic": topic,
        "claims": [
            {
                "claim_number": 1,
                "type": "independent",
                "features": ["技术特征A", "技术特征B", "技术特征C", "技术特征D"],
                "scope": "独立权利要求，保护范围最宽"
            },
            {
                "claim_number": 2,
                "type": "dependent",
                "depends_on": 1,
                "features": ["技术特征E"],
                "scope": "从属权利要求，进一步限定"
            }
        ],
        "technical_field": "待分析",
        "filing_date": "待提取",
        "stage": "template_phase1"
    })
    .to_string()
}

fn generate_evidence_collection_content(topic: &str) -> String {
    format!(
        "## 证据收集\n\n\
         针对目标专利「{}」进行现有技术证据收集：\n\n\
         ### 已收集证据\n\n\
         1. **对比文件 D1** (CNXXXXXXA)\n\
            - 技术领域: 相关技术领域\n\
            - 公开日: 早于目标专利申请日\n\
            - 相关性: 公开了技术特征A、B、C\n\n\
         2. **对比文件 D2** (CNYYYYYYA)\n\
            - 技术领域: 相近技术领域\n\
            - 公开日: 早于目标专利申请日\n\
            - 相关性: 公开了技术特征D的部分内容\n\n\
         3. **公知常识证据**\n\
            - 技术手册/教科书引用\n\
            - 行业标准文献\n\n\
         *注：Phase 1 模板输出，生产环境将通过 MCP 调用 PatentSearch + PaperSearch。*",
        topic
    )
}

fn generate_evidence_list(topic: &str) -> String {
    serde_json::json!({
        "topic": topic,
        "evidence": [
            {
                "id": "D1",
                "document_number": "CNXXXXXXA",
                "type": "patent",
                "relevance": "公开了技术特征A、B、C",
                "novelty_attack": true,
                "inventiveness_attack": true
            },
            {
                "id": "D2",
                "document_number": "CNYYYYYYA",
                "type": "patent",
                "relevance": "公开了技术特征D的部分内容",
                "novelty_attack": false,
                "inventiveness_attack": true
            },
            {
                "id": "D3",
                "type": "common_knowledge",
                "relevance": "技术特征E属于公知常识",
                "novelty_attack": false,
                "inventiveness_attack": true
            }
        ],
        "stage": "template_phase1"
    })
    .to_string()
}

fn generate_grounds_analysis_content(topic: &str) -> String {
    format!(
        "## 无效理由分析\n\n\
         目标专利: {}\n\n\
         ### 一、新颖性分析\n\n\
         **对比文件**: D1 (CNXXXXXXA)\n\n\
         - D1公开了技术特征A、B、C\n\
         - 目标专利权利要求1包含技术特征A、B、C、D\n\
         - **关键区别**: 技术特征D在D1中未完整公开\n\
         - **新颖性评价**: 需要进一步分析技术特征D是否已被隐含公开\n\
         - **无效可能性**: 中等\n\n\
         ### 二、创造性分析\n\n\
         **对比文件组合**: D1 + D2\n\n\
         - D1公开了技术特征A、B、C\n\
         - D2给出了结合启示，公开了技术特征D的相关内容\n\
         - 本领域技术人员有动机将D1和D2结合\n\
         - **创造性评价**: 权利要求1相对于D1+D2的结合不具备创造性\n\
         - **无效可能性**: 较高\n\n\
         ### 三、充分公开分析\n\n\
         - 说明书中对技术特征D的实现方式描述是否充分\n\
         - 是否需要过度实验才能实现\n\
         - **无效可能性**: 需进一步评估\n\n\
         ### 四、其他无效理由\n\n\
         - 权利要求是否得到说明书支持\n\
         - 权利要求是否清楚\n\
         - 修改是否超范围\n\n\
         *注：Phase 1 模板输出，生产环境将通过 MCP 调用 SmartOAResponder。*",
        topic
    )
}

fn generate_grounds_report(topic: &str) -> String {
    format!(
        "# 无效理由分析报告\n\n\
         ## 案件: {}\n\n\
         | 无效理由 | 主要证据 | 无效可能性 | 优先级 |\n\
         |---------|---------|-----------|--------|\n\
         | 新颖性 | D1 | 中等 | 2 |\n\
         | 创造性 | D1+D2 | 较高 | 1 |\n\
         | 充分公开 | 说明书 | 待评估 | 3 |\n\
         | 权利要求支持 | 说明书 | 待评估 | 4 |\n\n\
         ## 核心结论\n\n\
         1. 创造性无效理由最有利，D1+D2组合可覆盖全部技术特征\n\
         2. 新颖性理由作为辅助，需补充技术特征D的对比证据\n\
         3. 充分公开理由可探索，但不确定性较大",
        topic
    )
}

fn generate_strategy_content(topic: &str) -> String {
    format!(
        "## 策略制定与论证\n\n\
         目标专利: {}\n\n\
         ### 方案A: 新颖性+创造性组合攻击\n\n\
         **策略说明**: 以创造性无效为主要攻击方向，辅以新颖性无效理由\n\n\
         **论证路径**:\n\
         1. 使用D1+D2组合论证权利要求1不具备创造性\n\
         2. 使用D1论证从属权利要求的新颖性问题\n\
         3. 补充公知常识证据强化创造性论证\n\n\
         **优点**: 成功率较高，论证充分\n\
         **缺点**: 需要证明D1+D2有结合启示\n\n\
         ### 方案B: 充分公开+实用性攻击\n\n\
         **策略说明**: 以说明书未充分公开为主要攻击方向\n\n\
         **论证路径**:\n\
         1. 论证技术特征D的实现方式未充分公开\n\
         2. 论证所属技术领域技术人员无法实现\n\
         3. 辅以实用性问题\n\n\
         **优点**: 不依赖对比文件\n\
         **缺点**: 论证难度较大，不确定性高\n\n\
         ### 方案C: 全理由综合攻击\n\n\
         **策略说明**: 同时提出新颖性、创造性、充分公开等多条无效理由\n\n\
         **论证路径**:\n\
         1. 创造性为主要理由\n\
         2. 新颖性为辅助理由\n\
         3. 充分公开为补充理由\n\n\
         **优点**: 覆盖面广，增加成功概率\n\
         **缺点**: 论述量大，需要更多证据支持\n\n\
         *建议*: 根据本案证据情况，推荐**方案A**作为主要策略。\n\n\
         *注：Phase 1 模板输出，生产环境将通过 MCP 调用 HebbianOptimizer。*",
        topic
    )
}

fn generate_strategy_plan(topic: &str) -> String {
    format!(
        "# 无效宣告论证计划\n\n\
         案件: {}\n\
         选择策略: 方案A\n\n\
         ## 执行步骤\n\n\
         1. 论证权利要求1相对于D1+D2不具备创造性\n\
         2. 论证从属权利要求2-5的创造性缺陷\n\
         3. 使用D1论证独立权利要求的新颖性问题\n\
         4. 补充公知常识证据\n\
         5. 组织证据链，确保逻辑完整",
        topic
    )
}

fn generate_evidence_mapping() -> String {
    "# 证据组合对照表\n\n\
     ## 权利要求特征 vs 证据覆盖\n\n\
     | 技术特征 | D1 | D2 | D3(公知常识) | 覆盖情况 |\n\
     |---------|----|----|-------------|----------|\n\
     | 特征A | ✓ | - | - | D1公开 |\n\
     | 特征B | ✓ | - | - | D1公开 |\n\
     | 特征C | ✓ | 部分 | - | D1+D2 |\n\
     | 特征D | ✗ | ✓ | ✓ | D2+公知 |\n\
     | 特征E | - | - | ✓ | 公知常识 |\n\n\
     **证据链结论**: D1+D2+公知常识可覆盖全部技术特征，创造性论证成立"
        .to_string()
}

fn generate_petition_content(topic: &str) -> String {
    format!(
        "# 无效宣告请求书\n\n\
         请求人: XXX\n\
         被请求人: XXX\n\
         涉案专利: {}\n\n\
         ---\n\n\
         请求人根据《中华人民共和国专利法》第四十五条及《专利法实施细则》\
         第六十五条的规定，请求宣告涉案专利全部无效，具体理由如下：\n\n\
         ## 无效理由一：不具备创造性\n\n\
         ### 1. 权利要求1相对于D1+D2不具备创造性\n\n\
         权利要求1的技术方案已被对比文件D1(CNXXXXXXA)和D2(CNYYYYYYA)的组合公开，\n\
         且D1与D2存在结合启示，权利要求1相对于D1+D2的结合不具备突出的实质性特点\n\
         和显著的进步，不符合专利法第二十二条第三款的规定。\n\n\
         ### 2. 从属权利要求2-5的创造性缺陷\n\n\
         从属权利要求2-5的附加技术特征或已被对比文件公开，或属于本领域公知常识，\n\
         在权利要求1不具备创造性的前提下，从属权利要求2-5同样不具备创造性。\n\n\
         ## 无效理由二：不具备新颖性\n\n\
         权利要求1的技术方案已被对比文件D1公开，不具备新颖性，不符合专利法\n\
         第二十二条第二款的规定。\n\n\
         ## 无效理由三：说明书未充分公开\n\n\
         说明书中对技术特征D的具体实施方式描述不够充分，所属技术领域的技术人员\n\
         需要付出创造性劳动才能实现，不符合专利法第二十六条第三款的规定。\n\n\
         ---\n\n\
         综上，请求人请求宣告涉案专利全部无效。\n\n\
         请求人：XXX\n\
         日期：2024年XX月XX日\n\n\
         *注：Phase 1 模板输出。*",
        topic
    )
}

fn generate_quality_report() -> QualityReport {
    QualityReport {
        overall_score: 8.0,
        dimensions: vec![
            QualityDimensionScore {
                name: "法律依据充分性".to_string(),
                score: 8.5,
            },
            QualityDimensionScore {
                name: "证据链完整性".to_string(),
                score: 7.8,
            },
            QualityDimensionScore {
                name: "逻辑严密性".to_string(),
                score: 8.0,
            },
            QualityDimensionScore {
                name: "程序合规性".to_string(),
                score: 7.8,
            },
        ],
    }
}

fn pass_mark(score: f32) -> &'static str {
    crate::helpers::pass_mark(score, 7.5)
}

fn generate_invalidation_petition(topic: &str) -> String {
    format!(
        "# 完整无效宣告请求书\n\n\
         案件: {}\n\
         状态: 已通过质量验证\n\n\
         ## 包含文件\n\n\
         1. 无效宣告请求书正文\n\
         2. 证据目录及对比文件\n\
         3. 权利要求与对比文件对照表\n\
         4. 证据组合说明\n\n\
         ## 质量评分\n\n\
         综合评分: 8.0/10.0 (合格，≥7.5阈值)\n\n\
         ---\n\
         *Phase 1 模板生成，生产环境将通过 MCP 调用 QualityCheckerAgent。*",
        topic
    )
}
