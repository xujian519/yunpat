//! Reexamination Agent — patent reexamination request workflow.
//!
//! OrchestrationAgent that drives a 5-step reexamination request flow:
//! 1. 驳回决定分析 (Rejection Decision Analysis)
//! 2. 补充检索 (Supplementary Search)
//! 3. 复审策略制定 (Reexamination Strategy Formulation)
//! 4. 复审请求书撰写 (Reexamination Request Drafting)
//! 5. 验证与程序跟踪 (Verification & Procedural Tracking)
//!
//! Phase 1: Template-based outputs without LLM or MCP calls.
//! The structure and approval gates are fully functional, enabling
//! end-to-end validation of the orchestration flow engine.

use crate::agent::{OrchestrationAgent, PatentAgent};
use crate::context::LlmProvider;
use crate::flow::{AgentCall, FlowStep, OrchestrationFlow, QualityCheckConfig, QualityDimension};
use crate::types::*;
use anyhow::Result;
use async_trait::async_trait;
use futures_core::Stream;
use std::pin::Pin;

use crate::helpers::{llm_generate, extract_case_id, keyword_confidence, AgentBase};

/// The Reexamination Agent handles patent reexamination request workflows.
pub struct ReexaminationAgent {
    base: AgentBase,
}

impl Default for ReexaminationAgent {
    fn default() -> Self {
        Self::new()
    }
}

impl ReexaminationAgent {
    pub fn new() -> Self {
        Self {
            base: AgentBase::new("reexamination"),
        }
    }

    pub fn with_llm(self, provider: Box<dyn LlmProvider>) -> Self {
        Self {
            base: self.base.with_llm(provider),
        }
    }

    /// Whether an LLM provider is configured.
    pub fn has_llm(&self) -> bool {
        self.base.has_llm()
    }
}

const REEXAM_KEYWORDS: &[&str] = &[
    "复审",
    "驳回决定",
    "复审请求",
    "专利复审",
    "复审委员会",
    "复审理由",
    "复审策略",
];

#[async_trait]
impl PatentAgent for ReexaminationAgent {
    fn id(&self) -> &AgentId {
        self.base.id()
    }

    fn name(&self) -> &str {
        "复审请求智能体"
    }

    fn description(&self) -> &str {
        "处理专利复审请求，分析驳回决定，制定复审策略，撰写复审请求书。"
    }

    fn capabilities(&self) -> &[String] {
        static CAPS: std::sync::OnceLock<Vec<String>> = std::sync::OnceLock::new();
        CAPS.get_or_init(|| {
            vec![
                "驳回分析".to_string(),
                "补充检索".to_string(),
                "策略制定".to_string(),
                "文书撰写".to_string(),
            ]
        })
    }

    fn can_handle(&self, intent: &UserIntent) -> Confidence {
        keyword_confidence(&intent.raw_input, REEXAM_KEYWORDS, 0.6, 0.1, 0.4)
    }

    fn stages(&self) -> Vec<StageDefinition> {
        vec![
            StageDefinition {
                stage_id: "rejection_analysis".to_string(),
                stage_name: "驳回决定分析".to_string(),
                description: "分析驳回决定，提取驳回理由和审查员论点".to_string(),
                requires_approval: false,
            },
            StageDefinition {
                stage_id: "supplementary_search".to_string(),
                stage_name: "补充检索".to_string(),
                description: "进行补充检索，寻找支持复审的额外证据和对比文件".to_string(),
                requires_approval: false,
            },
            StageDefinition {
                stage_id: "strategy_formulation".to_string(),
                stage_name: "复审策略制定".to_string(),
                description: "制定复审策略，确定复审理由和论点组织方案".to_string(),
                requires_approval: true,
            },
            StageDefinition {
                stage_id: "request_drafting".to_string(),
                stage_name: "复审请求书撰写".to_string(),
                description: "撰写复审请求书，包括复审理由和事实依据".to_string(),
                requires_approval: false,
            },
            StageDefinition {
                stage_id: "verification".to_string(),
                stage_name: "验证与程序跟踪".to_string(),
                description: "质量检查、程序合规性验证和复审请求提交跟踪".to_string(),
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
            // Step 1: 驳回决定分析
            yield StageOutput {
                stage_id: "rejection_analysis".to_string(),
                stage_name: "驳回决定分析".to_string(),
                stage_type: StageType::Analysis,
                content: generate_rejection_analysis_content(&topic, case_id.as_deref()),
                multimodal_content: vec![],
                artifacts: vec![Artifact {
                    name: "驳回决定结构化数据".to_string(),
                    artifact_type: "parsed_rejection".to_string(),
                    content: generate_parsed_rejection_json(&topic),
                    path: None,
                }],
                requires_approval: false,
                approval_request: None,
                metadata: StageMetadata {
                    duration_ms: Some(1500),
                    ..Default::default()
                },
            };

            // Step 2: 补充检索 (LLM or template)
            let search_content = if let Some(ref provider) = llm_provider {
                llm_generate(provider.as_ref(),
                    "你是一位资深专利检索专家。请根据驳回决定，进行补充检索分析，\
                     寻找支持复审请求的额外证据和相关对比文件。",
                    &format!("请针对以下驳回决定进行补充检索分析：\n\n{}", topic),
                ).await
            } else {
                generate_supplementary_search_content(&topic)
            };
            yield StageOutput {
                stage_id: "supplementary_search".to_string(),
                stage_name: "补充检索".to_string(),
                stage_type: StageType::Analysis,
                content: search_content,
                multimodal_content: vec![],
                artifacts: vec![Artifact {
                    name: "补充检索报告".to_string(),
                    artifact_type: "search_report".to_string(),
                    content: generate_search_report(&topic),
                    path: None,
                }],
                requires_approval: false,
                approval_request: None,
                metadata: StageMetadata {
                    duration_ms: Some(3000),
                    ..Default::default()
                },
            };

            // Step 3: 复审策略制定 (with approval gate, LLM or template)
            let strategy_content = if let Some(ref provider) = llm_provider {
                llm_generate(provider.as_ref(),
                    "你是一位专利复审策略专家。请根据驳回分析和补充检索结果，\
                     制定复审策略，确定复审理由和论点组织方案。提供至少2个策略方案供选择。",
                    &format!("请为以下驳回决定制定复审策略：\n\n{}", topic),
                ).await
            } else {
                generate_strategy_content(&topic)
            };
            yield StageOutput {
                stage_id: "strategy_formulation".to_string(),
                stage_name: "复审策略制定".to_string(),
                stage_type: StageType::Suggestion,
                content: strategy_content,
                multimodal_content: vec![],
                artifacts: vec![
                    Artifact {
                        name: "复审策略方案".to_string(),
                        artifact_type: "reexamination_plan".to_string(),
                        content: generate_reexamination_plan(&topic),
                        path: None,
                    },
                ],
                requires_approval: true,
                approval_request: Some(ApprovalRequest {
                    prompt: "复审策略已制定，请选择策略方向：".to_string(),
                    options: vec![
                        ApprovalOption {
                            label: "方案A: 事实认定错误抗辩 + 权利要求修改".to_string(),
                            value: "strategy_a".to_string(),
                            is_default: true,
                        },
                        ApprovalOption {
                            label: "方案B: 法律适用错误抗辩（不修改权利要求）".to_string(),
                            value: "strategy_b".to_string(),
                            is_default: false,
                        },
                        ApprovalOption {
                            label: "方案C: 新证据提交 + 部分权利要求修改".to_string(),
                            value: "strategy_c".to_string(),
                            is_default: false,
                        },
                    ],
                }),
                metadata: StageMetadata {
                    duration_ms: Some(2800),
                    ..Default::default()
                },
            };

            // Step 4: 复审请求书撰写 (LLM or template)
            let draft_content = if let Some(ref provider) = llm_provider {
                llm_generate(provider.as_ref(),
                    "你是一位专利代理师，擅长撰写专利复审请求书。\
                     请根据复审策略撰写完整的复审请求书，包括复审理由、事实依据和法律论证。",
                    &format!("请为以下复审请求撰写复审请求书：\n\n{}", topic),
                ).await
            } else {
                generate_request_draft_content(&topic)
            };
            yield StageOutput {
                stage_id: "request_drafting".to_string(),
                stage_name: "复审请求书撰写".to_string(),
                stage_type: StageType::Draft,
                content: draft_content,
                multimodal_content: vec![],
                artifacts: vec![
                    Artifact {
                        name: "复审请求书草稿".to_string(),
                        artifact_type: "reexamination_request".to_string(),
                        content: generate_reexamination_request(&topic),
                        path: None,
                    },
                    Artifact {
                        name: "复审理由摘要".to_string(),
                        artifact_type: "reexamination_summary".to_string(),
                        content: generate_reexamination_summary(&topic),
                        path: None,
                    },
                ],
                requires_approval: false,
                approval_request: None,
                metadata: StageMetadata {
                    duration_ms: Some(5000),
                    ..Default::default()
                },
            };

            // Step 5: 验证与程序跟踪 (with approval gate)
            let quality_report = generate_quality_report();
            let overall_score = quality_report.overall_score;
            yield StageOutput {
                stage_id: "verification".to_string(),
                stage_name: "验证与程序跟踪".to_string(),
                stage_type: StageType::Completed,
                content: format!(
                    "# 复审请求质量验证\n\n\
                     综合评分: **{:.1}/10.0**\n\n\
                     ## 各维度评分\n\n\
                     | 维度 | 评分 | 状态 |\n\
                     |------|------|------|\n\
                     | 法律依据充分性 | {:.1} | {} |\n\
                     | 事实准确性 | {:.1} | {} |\n\
                     | 逻辑完整性 | {:.1} | {} |\n\
                     | 程序合规性 | {:.1} | {} |\n\n\
                     ## 程序跟踪\n\n\
                     - 复审请求期限: 驳回决定之日起3个月内\n\
                     - 复审受理机关: 国家知识产权局专利复审委员会\n\
                     - 当前状态: 待提交\n\n\
                     复审请求文件已通过质量检查，准备提交。",
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
                    name: "完整复审请求包".to_string(),
                    artifact_type: "reexamination_package".to_string(),
                    content: generate_reexamination_package(&topic),
                    path: None,
                }],
                requires_approval: true,
                approval_request: Some(ApprovalRequest {
                    prompt: "复审请求文件已通过质量检查，是否确认提交？".to_string(),
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
                    duration_ms: Some(2000),
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

impl OrchestrationAgent for ReexaminationAgent {
    fn flow_definition(&self) -> OrchestrationFlow {
        OrchestrationFlow {
            flow_id: "reexamination".to_string(),
            flow_name: "专利复审请求".to_string(),
            description: "完整的专利复审请求流程：驳回分析→补充检索→策略制定→文书撰写→验证跟踪"
                .to_string(),
            steps: vec![
                FlowStep {
                    step_id: "rejection_analysis".to_string(),
                    step_name: "驳回决定分析".to_string(),
                    order: 1,
                    agent_calls: vec![AgentCall {
                        agent_id: "reexamination".to_string(),
                        input_mapping: std::collections::HashMap::new(),
                        output_key: "parsed_rejection".to_string(),
                        condition: None,
                        r#loop: None,
                    }],
                    requires_approval: false,
                    approval_prompt: None,
                    quality_check: None,
                    condition: None,
                },
                FlowStep {
                    step_id: "supplementary_search".to_string(),
                    step_name: "补充检索".to_string(),
                    order: 2,
                    agent_calls: vec![AgentCall {
                        agent_id: "reexamination".to_string(),
                        input_mapping: std::collections::HashMap::new(),
                        output_key: "search_results".to_string(),
                        condition: Some("parsed_rejection.exists".to_string()),
                        r#loop: None,
                    }],
                    requires_approval: false,
                    approval_prompt: None,
                    quality_check: None,
                    condition: Some("parsed_rejection.exists".to_string()),
                },
                FlowStep {
                    step_id: "strategy_formulation".to_string(),
                    step_name: "复审策略制定".to_string(),
                    order: 3,
                    agent_calls: vec![AgentCall {
                        agent_id: "reexamination".to_string(),
                        input_mapping: std::collections::HashMap::new(),
                        output_key: "reexamination_strategy".to_string(),
                        condition: Some("search_results.exists".to_string()),
                        r#loop: None,
                    }],
                    requires_approval: true,
                    approval_prompt: Some("请选择复审策略方向".to_string()),
                    quality_check: None,
                    condition: Some("search_results.exists".to_string()),
                },
                FlowStep {
                    step_id: "request_drafting".to_string(),
                    step_name: "复审请求书撰写".to_string(),
                    order: 4,
                    agent_calls: vec![AgentCall {
                        agent_id: "reexamination".to_string(),
                        input_mapping: std::collections::HashMap::new(),
                        output_key: "draft".to_string(),
                        condition: Some("reexamination_strategy.exists".to_string()),
                        r#loop: None,
                    }],
                    requires_approval: false,
                    approval_prompt: None,
                    quality_check: None,
                    condition: Some("reexamination_strategy.exists".to_string()),
                },
                FlowStep {
                    step_id: "verification".to_string(),
                    step_name: "验证与程序跟踪".to_string(),
                    order: 5,
                    agent_calls: vec![AgentCall {
                        agent_id: "reexamination".to_string(),
                        input_mapping: std::collections::HashMap::new(),
                        output_key: "final_package".to_string(),
                        condition: Some("draft.exists".to_string()),
                        r#loop: None,
                    }],
                    requires_approval: true,
                    approval_prompt: Some("复审请求文件已通过质量检查，是否确认提交？".to_string()),
                    quality_check: Some(QualityCheckConfig {
                        dimensions: vec![
                            "法律依据充分性".to_string(),
                            "事实准确性".to_string(),
                            "逻辑完整性".to_string(),
                            "程序合规性".to_string(),
                        ],
                        threshold: 7.5,
                        max_auto_retries: 2,
                        escalate_to_human: true,
                    }),
                    condition: Some("draft.exists".to_string()),
                },
            ],
            quality_dimensions: vec![
                QualityDimension {
                    name: "法律依据充分性".to_string(),
                    description: "复审请求中引用的法律条文和审查指南是否准确充分".to_string(),
                    weight: 0.30,
                },
                QualityDimension {
                    name: "事实准确性".to_string(),
                    description: "对技术方案和驳回决定的理解和描述是否准确".to_string(),
                    weight: 0.25,
                },
                QualityDimension {
                    name: "逻辑完整性".to_string(),
                    description: "复审论证逻辑链条是否完整，无遗漏".to_string(),
                    weight: 0.25,
                },
                QualityDimension {
                    name: "程序合规性".to_string(),
                    description: "复审请求文件格式和程序是否符合复审委员会要求".to_string(),
                    weight: 0.20,
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

fn generate_rejection_analysis_content(topic: &str, case_id: Option<&str>) -> String {
    let case_info = case_id
        .map(|id| format!("\n关联案件: {}", id))
        .unwrap_or_default();
    format!(
        "## 驳回决定分析\n\n\
         针对输入的驳回决定，进行以下分析：\n\n\
         1. **驳回类型**: [发明/实用新型]专利申请\n\
         2. **驳回理由**: {topic}\n\
         3. **引用对比文件**: 待提取\n\
         4. **关键争议点**: 待分析\n\n\
         基于分析结果：\n\n\
         ### 驳回决定结构\n\n\
         - **驳回依据**: 《专利法》第22条（新颖性/创造性）或第26条（说明书公开不充分）\n\
         - **审查员论点**: 审查员认为申请不符合授权条件\n\
         - **对比文件**: 提取并标注引用的每一篇对比文件\n\
         - **权利要求范围**: 识别受到影响的权利要求项\n\n\
         ### 关键时间节点\n\
         - 驳回决定发文日: 待确认\n\
         - 复审请求期限: 驳回决定之日起3个月内{case_info}\n\n\
         *注：Phase 1 模板输出，生产环境将通过 MCP 调用 RejectionAnalyzer。*",
        topic = topic,
        case_info = case_info,
    )
}

fn generate_parsed_rejection_json(topic: &str) -> String {
    serde_json::json!({
        "rejection_type": "full_rejection",
        "application_no": "CN2024XXXXXXXX",
        "topic": topic,
        "rejection_grounds": [
            {
                "legal_basis": "专利法第22条第2款",
                "type": "novelty",
                "claims": [1, 2, 3],
                "citations": ["CNXXXXXXA"],
                "examiner_argument": "权利要求1-3相对于D1不具备新颖性"
            },
            {
                "legal_basis": "专利法第22条第3款",
                "type": "inventiveness",
                "claims": [1, 2, 3, 4, 5, 6, 7],
                "citations": ["CNXXXXXXA", "CNYYYYYYA"],
                "examiner_argument": "权利要求1-7相对于D1+D2的结合不具备创造性"
            }
        ],
        "deadline_months": 3,
        "stage": "template_phase1"
    })
    .to_string()
}

fn generate_supplementary_search_content(topic: &str) -> String {
    format!(
        "# 补充检索\n\n\
         主题: {}\n\n\
         ## 检索策略\n\n\
         基于驳回决定中的对比文件和技术方案，制定以下补充检索策略：\n\n\
         ### 检索范围\n\n\
         1. **扩展检索领域**: 检索审查员未引用的相关技术领域\n\
         2. **时间范围**: 优先权日之前的相关文献\n\
         3. **关键词组合**: 基于技术特征D的扩展关键词\n\n\
         ## 检索结果\n\n\
         | 序号 | 文献编号 | 相关度 | 技术领域 | 关联特征 |\n\
         |------|----------|--------|----------|----------|\n\
         | 1 | CNZZZZZZA | 高 | 本领域 | 特征D |\n\
         | 2 | USXXXXXXX | 中 | 相邻领域 | 特征E |\n\
         | 3 | EPYYYYYYY | 低 | 其他领域 | 背景技术 |\n\n\
         ## 检索结论\n\n\
         - 未发现公开技术特征D的文献 → 支持新颖性论点\n\
         - 发现的相邻领域文献未给出结合启示 → 支持创造性论点\n\
         - 检索结果总体有利于复审请求\n\n\
         *注：Phase 1 模板输出，生产环境将通过 MCP 调用 PatentSearcher。*",
        topic
    )
}

fn generate_search_report(topic: &str) -> String {
    format!(
        "# 补充检索报告\n\n\
         ## 案件: {}\n\n\
         ### 检索式\n\n\
         ```
         ((特征A AND 特征B) OR (特征C AND 特征D)) AND NOT (CNXXXXXXA OR CNYYYYYYA)\n\
         数据库: CNKI, Web of Science, Espacenet\n\
         时间范围: 2020-01-01 至优先权日\n\
         ```\n\n\
         ### 检索结果摘要\n\n\
         - 检索命中文献数: 47篇\n\
         - 相关度评估（高）: 3篇\n\
         - 相关度评估（中）: 8篇\n\
         - 相关度评估（低）: 36篇\n\n\
         ### 关键发现\n\n\
         1. 未发现公开特征D + 特征E组合的文献\n\
         2. 领域C中的文献W虽涉及类似问题，但技术路线完全不同\n\
         3. 审查员引用的D2与本案技术领域差异显著，结合启示薄弱",
        topic
    )
}

fn generate_strategy_content(topic: &str) -> String {
    format!(
        "# 复审策略方案\n\n\
         主题: {}\n\n\
         ## 方案A: 事实认定错误抗辩 + 权利要求修改\n\n\
         **策略说明**: 指出审查员对技术事实认定有误，同时修改权利要求引入新特征\n\n\
         **优点**: 双重保障，成功率最高\n\
         **缺点**: 权利保护范围缩小\n\
         **适用场景**: 审查员确实存在事实认定错误的情况\n\n\
         ## 方案B: 法律适用错误抗辩（不修改权利要求）\n\n\
         **策略说明**: 主张审查员在法律适用上有误，坚持原权利要求\n\n\
         **优点**: 保留最大保护范围\n\
         **缺点**: 风险较高，需要充分的法律论证\n\
         **适用场景**: 审查员法律适用确有偏差，论据充分\n\n\
         ## 方案C: 新证据提交 + 部分权利要求修改\n\n\
         **策略说明**: 提交补充检索中发现的有利于申请人的新证据，部分修改权利要求\n\n\
         **优点**: 有新证据支撑，说服力强\n\
         **缺点**: 需要确保新证据与论点高度相关\n\
         **适用场景**: 补充检索发现了有利于申请人的重要文献\n\n\
         *建议*: 根据本案情况，推荐**方案A**作为主要策略。\n\n\
         *注：Phase 1 模板输出，生产环境将通过 MCP 调用 StrategyOptimizer。*",
        topic
    )
}

fn generate_reexamination_plan(topic: &str) -> String {
    format!(
        "# 复审计划\n\n\
         案件: {}\n\
         选择策略: 方案A\n\n\
         ## 执行步骤\n\n\
         1. 分析驳回决定中的事实认定错误\n\
         2. 提取审查员法律适用中的不当之处\n\
         3. 修改独立权利要求，引入技术特征D\n\
         4. 撰写复审请求书\n\
         5. 准备复审陈述意见\n\
         6. 整理证据清单和附件材料",
        topic
    )
}

fn generate_request_draft_content(topic: &str) -> String {
    format!(
        "# 复审请求书撰写\n\n\
         主题: {}\n\n\
         已完成以下文档的撰写：\n\n\
         1. **复审请求书** — 包含复审理由、事实依据和法律论证\n\
         2. **复审理由摘要** — 核心论点归纳\n\n\
         *注：Phase 1 模板输出，生产环境将通过 MCP 调用 ReexaminationDrafter。*",
        topic
    )
}

fn generate_reexamination_request(topic: &str) -> String {
    format!(
        "# 复审请求书\n\n\
         申请人: XXX\n\
         申请号: CN2024XXXXXXXX\n\
         案件: {}\n\n\
         ---\n\n\
         致：国家知识产权局专利复审委员会\n\n\
         申请人不服贵局于2024年XX月XX日作出的驳回决定（申请号：CN2024XXXXXXXX），\
         现根据《专利法》第41条的规定，向专利复审委员会提出复审请求。\n\n\
         ## 一、复审请求的范围\n\n\
         请求撤销驳回决定，并授予本申请专利权。\n\n\
         ## 二、复审理由\n\n\
         ### 2.1 关于新颖性\n\n\
         申请人认为，修改后的权利要求1相对于D1(CNXXXXXXA)具备新颖性：\n\n\
         修改后的权利要求1包含技术特征D，该特征在D1中未被公开。\
         D1仅公开了技术特征A、B、C，未给出任何关于特征D的技术教导。\
         因此，修改后的权利要求1与D1存在实质性区别，具备《专利法》第22条第2款规定的新颖性。\n\n\
         ### 2.2 关于创造性\n\n\
         申请人认为，修改后的权利要求1相对于D1+D2的结合具备创造性：\n\n\
         **(1) D1+D2无结合启示**\n\n\
         D1属于XXX技术领域，D2属于YYY技术领域，二者技术领域不同。\
         D1要解决的技术问题是AAA，D2要解决的技术问题是BBB，二者不同。\
         本领域技术人员没有动机将D2应用到D1中。\n\n\
         **(2) 技术效果超出简单叠加**\n\n\
         特征D的引入产生了协同效果CCC，该效果超出D1+D2技术特征的简单叠加。\n\n\
         ## 三、权利要求修改说明\n\n\
         申请人已在独立权利要求1中引入技术特征D，修改依据来自说明书第[0018]-[0020]段。\
         修改后的权利要求未超出原说明书和权利要求书记载的范围。\n\n\
         ---\n\n\
         请专利复审委员会予以审查。\n\n\
         申请人：XXX\n\
         日期：2024年XX月XX日\n\n\
         *注：Phase 1 模板输出。*",
        topic
    )
}

fn generate_reexamination_summary(topic: &str) -> String {
    format!(
        "# 复审理由摘要\n\n\
         案件: {}\n\n\
         ## 核心论点\n\n\
         1. **新颖性成立**: 技术特征D未被D1公开，构成实质性区别\n\
         2. **创造性成立**: D1+D2无结合启示，且技术效果超出简单叠加\n\
         3. **修改合规**: 权利要求修改未超出原申请文件记载范围\n\n\
         ## 关键证据\n\n\
         | 证据编号 | 类型 | 证明目的 |\n\
         |----------|------|----------|\n\
         | E1 | 说明书原文 | 特征D的原始公开 |\n\
         | E2 | D1全文 | 证明D1未公开特征D |\n\
         | E3 | D2全文 | 证明D2未给出结合启示 |\n\
         | E4 | 补充检索报告 | 支持创造性论点 |",
        topic
    )
}

fn generate_quality_report() -> QualityReport {
    QualityReport {
        overall_score: 8.0,
        dimensions: vec![
            QualityDimensionScore {
                name: "法律依据充分性".to_string(),
                score: 8.2,
            },
            QualityDimensionScore {
                name: "事实准确性".to_string(),
                score: 8.0,
            },
            QualityDimensionScore {
                name: "逻辑完整性".to_string(),
                score: 7.8,
            },
            QualityDimensionScore {
                name: "程序合规性".to_string(),
                score: 8.0,
            },
        ],
    }
}

fn pass_mark(score: f32) -> &'static str {
    crate::helpers::pass_mark(score, 7.5)
}

fn generate_reexamination_package(topic: &str) -> String {
    format!(
        "# 完整复审请求包\n\n\
         案件: {}\n\
         状态: 已通过质量验证\n\n\
         ## 包含文件\n\n\
         1. 复审请求书\n\
         2. 修改后权利要求书\n\
         3. 修改说明页\n\
         4. 证据清单及附件\n\
         5. 补充检索报告\n\n\
         ## 质量评分\n\n\
         综合评分: 8.0/10.0 (合格，≥7.5阈值)\n\n\
         ## 程序提醒\n\n\
         - 复审请求期限: 驳回决定之日起3个月\n\
         - 提交方式: 电子提交或书面提交\n\
         - 复审费: 需缴纳复审费\n\n\
         ---\n\
         *Phase 1 模板生成，生产环境将通过 MCP 调用 QualityCheckerAgent。*",
        topic
    )
}
