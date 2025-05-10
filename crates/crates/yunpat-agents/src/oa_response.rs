//! OA Response Agent — office action response workflow.
//!
//! OrchestrationAgent that drives a 5-step OA response flow:
//! 1. 审查意见解读 (Office Action Parsing)
//! 2. 驳回理由深度分析 (Rejection Reason Analysis)
//! 3. 答复策略制定 (Response Strategy)
//! 4. 答复文本撰写 (Response Drafting)
//! 5. 验证与打包 (Quality Check & Packaging)
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

use crate::helpers::{AgentBase, extract_case_id, keyword_confidence, llm_generate};

/// The OA Response Agent handles office action response workflows.
pub struct OAResponseAgent {
    base: AgentBase,
}

impl Default for OAResponseAgent {
    fn default() -> Self {
        Self::new()
    }
}

impl OAResponseAgent {
    pub fn new() -> Self {
        Self {
            base: AgentBase::new("oa-response"),
        }
    }

    /// Set an LLM provider for content generation (builder pattern).
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

const OA_KEYWORDS: &[&str] = &[
    "审查意见",
    "OA",
    "office action",
    "驳回",
    "答复",
    "答辩",
    "审查员",
    "意见陈述",
    "权利要求修改",
    "通知书",
];

#[async_trait]
impl PatentAgent for OAResponseAgent {
    fn id(&self) -> &AgentId {
        self.base.id()
    }

    fn name(&self) -> &str {
        "审查意见答复智能体"
    }

    fn description(&self) -> &str {
        "处理审查意见答复工作流：审查意见解读、驳回理由分析、答复策略制定、答复文本撰写和质量检查"
    }

    fn capabilities(&self) -> &[String] {
        static CAPS: std::sync::OnceLock<Vec<String>> = std::sync::OnceLock::new();
        CAPS.get_or_init(|| {
            vec![
                "oa_parsing".to_string(),
                "rejection_analysis".to_string(),
                "response_strategy".to_string(),
                "claim_revision".to_string(),
                "response_drafting".to_string(),
                "quality_validation".to_string(),
            ]
        })
    }

    fn can_handle(&self, intent: &UserIntent) -> Confidence {
        keyword_confidence(&intent.raw_input, OA_KEYWORDS, 0.6, 0.1, 0.4)
    }

    fn stages(&self) -> Vec<StageDefinition> {
        vec![
            StageDefinition {
                stage_id: "parse_oa".to_string(),
                stage_name: "审查意见解读".to_string(),
                description: "解析审查意见通知书，提取驳回理由和审查员论点".to_string(),
                requires_approval: false,
            },
            StageDefinition {
                stage_id: "deep_analysis".to_string(),
                stage_name: "驳回理由深度分析".to_string(),
                description: "深度分析每个驳回理由的法律基础和技术要点".to_string(),
                requires_approval: true,
            },
            StageDefinition {
                stage_id: "strategy".to_string(),
                stage_name: "答复策略制定".to_string(),
                description: "制定答复策略，包括权利要求修改方案和论点组织".to_string(),
                requires_approval: true,
            },
            StageDefinition {
                stage_id: "draft_response".to_string(),
                stage_name: "答复文本撰写".to_string(),
                description: "撰写修改后的权利要求和意见陈述书".to_string(),
                requires_approval: false,
            },
            StageDefinition {
                stage_id: "validate_package".to_string(),
                stage_name: "验证与打包".to_string(),
                description: "质量检查和最终答辩文件打包".to_string(),
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
            // Step 1: 审查意见解读
            yield StageOutput {
                stage_id: "parse_oa".to_string(),
                stage_name: "审查意见解读".to_string(),
                stage_type: StageType::Analysis,
                content: generate_parse_oa_content(&topic, case_id.as_deref()),
                multimodal_content: vec![],
                artifacts: vec![Artifact {
                    name: "审查意见结构化数据".to_string(),
                    artifact_type: "parsed_oa".to_string(),
                    content: generate_parsed_oa_json(&topic),
                    path: None,
                }],
                requires_approval: false,
                approval_request: None,
                metadata: StageMetadata {
                    duration_ms: Some(1200),
                    ..Default::default()
                },
            };

            // Step 2: 驳回理由深度分析 (with approval gate, LLM or template)
            let analysis_content = if let Some(ref provider) = llm_provider {
                llm_generate(provider.as_ref(),
                    "你是一位资深专利代理师。请深度分析以下审查意见中的驳回理由，\
                     评估审查员论点的合理性，找出可能的反驳点。",
                    &format!("请分析以下审查意见的驳回理由：\n\n{}", topic),
                ).await
            } else {
                generate_deep_analysis_content(&topic)
            };
            yield StageOutput {
                stage_id: "deep_analysis".to_string(),
                stage_name: "驳回理由深度分析".to_string(),
                stage_type: StageType::Analysis,
                content: analysis_content,
                multimodal_content: vec![],
                artifacts: vec![Artifact {
                    name: "对比分析报告".to_string(),
                    artifact_type: "analysis_report".to_string(),
                    content: generate_analysis_report(&topic),
                    path: None,
                }],
                requires_approval: true,
                approval_request: Some(ApprovalRequest {
                    prompt: "分析结果如下，是否继续制定答复策略？".to_string(),
                    options: vec![
                        ApprovalOption {
                            label: "继续制定策略".to_string(),
                            value: "continue".to_string(),
                            is_default: true,
                        },
                        ApprovalOption {
                            label: "补充分析".to_string(),
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
                    duration_ms: Some(3500),
                    ..Default::default()
                },
            };

            // Step 3: 答复策略制定 (with approval gate, LLM or template)
            let strategy_content = if let Some(ref provider) = llm_provider {
                llm_generate(provider.as_ref(),
                    "你是一位专利代理策略专家。请根据驳回理由分析，制定答复策略，\
                     包括权利要求修改方案和论点组织。提供至少2个方案供选择。",
                    &format!("请为以下审查意见制定答复策略：\n\n{}", topic),
                ).await
            } else {
                generate_strategy_content(&topic)
            };
            yield StageOutput {
                stage_id: "strategy".to_string(),
                stage_name: "答复策略制定".to_string(),
                stage_type: StageType::Suggestion,
                content: strategy_content,
                multimodal_content: vec![],
                artifacts: vec![
                    Artifact {
                        name: "答复策略方案".to_string(),
                        artifact_type: "response_plan".to_string(),
                        content: generate_response_plan(&topic),
                        path: None,
                    },
                    Artifact {
                        name: "权利要求修改对照表".to_string(),
                        artifact_type: "claim_comparison".to_string(),
                        content: generate_claim_comparison(),
                        path: None,
                    },
                ],
                requires_approval: true,
                approval_request: Some(ApprovalRequest {
                    prompt: "请选择答复策略方向：".to_string(),
                    options: vec![
                        ApprovalOption {
                            label: "方案A: 修改权利要求+意见陈述".to_string(),
                            value: "strategy_a".to_string(),
                            is_default: true,
                        },
                        ApprovalOption {
                            label: "方案B: 仅意见陈述（不修改权利要求）".to_string(),
                            value: "strategy_b".to_string(),
                            is_default: false,
                        },
                        ApprovalOption {
                            label: "方案C: 部分修改+部分争辩".to_string(),
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

            // Step 4: 答复文本撰写 (LLM or template)
            let draft_content = if let Some(ref provider) = llm_provider {
                llm_generate(provider.as_ref(),
                    "你是一位专利代理师，擅长撰写审查意见答复文件。\
                     请撰写修改后的权利要求和意见陈述书。",
                    &format!("请为以下审查意见撰写答复文本：\n\n{}", topic),
                ).await
            } else {
                generate_draft_content(&topic)
            };
            yield StageOutput {
                stage_id: "draft_response".to_string(),
                stage_name: "答复文本撰写".to_string(),
                stage_type: StageType::Draft,
                content: draft_content,
                multimodal_content: vec![],
                artifacts: vec![
                    Artifact {
                        name: "修改后权利要求书".to_string(),
                        artifact_type: "revised_claims".to_string(),
                        content: generate_revised_claims(&topic),
                        path: None,
                    },
                    Artifact {
                        name: "意见陈述书草稿".to_string(),
                        artifact_type: "opinion_statement".to_string(),
                        content: generate_opinion_statement(&topic),
                        path: None,
                    },
                ],
                requires_approval: false,
                approval_request: None,
                metadata: StageMetadata {
                    duration_ms: Some(5200),
                    ..Default::default()
                },
            };

            // Step 5: 验证与打包 (with approval gate)
            let quality_report = generate_quality_report();
            let overall_score = quality_report.overall_score;
            yield StageOutput {
                stage_id: "validate_package".to_string(),
                stage_name: "验证与打包".to_string(),
                stage_type: StageType::Completed,
                content: format!(
                    "# 答辩文件质量验证\n\n\
                     综合评分: **{:.1}/10.0**\n\n\
                     ## 各维度评分\n\n\
                     | 维度 | 评分 | 状态 |\n\
                     |------|------|------|\n\
                     | 法律依据充分性 | {:.1} | {} |\n\
                     | 技术事实准确性 | {:.1} | {} |\n\
                     | 逻辑完整性 | {:.1} | {} |\n\
                     | 权利要求支持 | {:.1} | {} |\n\
                     | 答复策略一致性 | {:.1} | {} |\n\
                     | 格式规范性 | {:.1} | {} |\n\
                     | 审查员说服力 | {:.1} | {} |\n\n\
                     答辩文件已通过质量检查，准备提交。",
                    overall_score,
                    quality_report.dimensions[0].score,
                    pass_mark(quality_report.dimensions[0].score),
                    quality_report.dimensions[1].score,
                    pass_mark(quality_report.dimensions[1].score),
                    quality_report.dimensions[2].score,
                    pass_mark(quality_report.dimensions[2].score),
                    quality_report.dimensions[3].score,
                    pass_mark(quality_report.dimensions[3].score),
                    quality_report.dimensions[4].score,
                    pass_mark(quality_report.dimensions[4].score),
                    quality_report.dimensions[5].score,
                    pass_mark(quality_report.dimensions[5].score),
                    quality_report.dimensions[6].score,
                    pass_mark(quality_report.dimensions[6].score),
                ),
                multimodal_content: vec![],
                artifacts: vec![Artifact {
                    name: "完整答辩包".to_string(),
                    artifact_type: "response_package".to_string(),
                    content: generate_response_package(&topic),
                    path: None,
                }],
                requires_approval: true,
                approval_request: Some(ApprovalRequest {
                    prompt: "答辩文件已通过质量检查，是否确认提交？".to_string(),
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
                    duration_ms: Some(1800),
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

impl crate::agent::OrchestrationAgent for OAResponseAgent {
    fn flow_definition(&self) -> OrchestrationFlow {
        OrchestrationFlow {
            flow_id: "oa_response".to_string(),
            flow_name: "审查意见答辩".to_string(),
            description: "完整的审查意见答复流程：解读→分析→策略→撰写→验证".to_string(),
            steps: vec![
                FlowStep {
                    step_id: "parse_oa".to_string(),
                    step_name: "审查意见解读".to_string(),
                    order: 1,
                    agent_calls: vec![AgentCall {
                        agent_id: "oa-response".to_string(),
                        input_mapping: std::collections::HashMap::new(),
                        output_key: "parsed_oa".to_string(),
                        condition: None,
                        r#loop: None,
                    }],
                    requires_approval: false,
                    approval_prompt: None,
                    quality_check: None,
                    condition: None,
                },
                FlowStep {
                    step_id: "deep_analysis".to_string(),
                    step_name: "驳回理由深度分析".to_string(),
                    order: 2,
                    agent_calls: vec![AgentCall {
                        agent_id: "oa-response".to_string(),
                        input_mapping: std::collections::HashMap::new(),
                        output_key: "analysis_result".to_string(),
                        condition: Some("parsed_oa.exists".to_string()),
                        r#loop: None,
                    }],
                    requires_approval: true,
                    approval_prompt: Some("分析结果如下，是否继续制定策略？".to_string()),
                    quality_check: None,
                    condition: Some("parsed_oa.exists".to_string()),
                },
                FlowStep {
                    step_id: "strategy".to_string(),
                    step_name: "答复策略制定".to_string(),
                    order: 3,
                    agent_calls: vec![AgentCall {
                        agent_id: "oa-response".to_string(),
                        input_mapping: std::collections::HashMap::new(),
                        output_key: "response_plan".to_string(),
                        condition: Some("analysis_result.exists".to_string()),
                        r#loop: None,
                    }],
                    requires_approval: true,
                    approval_prompt: Some("请选择答复策略方向".to_string()),
                    quality_check: None,
                    condition: Some("analysis_result.exists".to_string()),
                },
                FlowStep {
                    step_id: "draft_response".to_string(),
                    step_name: "答复文本撰写".to_string(),
                    order: 4,
                    agent_calls: vec![AgentCall {
                        agent_id: "oa-response".to_string(),
                        input_mapping: std::collections::HashMap::new(),
                        output_key: "draft".to_string(),
                        condition: Some("response_plan.exists".to_string()),
                        r#loop: None,
                    }],
                    requires_approval: false,
                    approval_prompt: None,
                    quality_check: None,
                    condition: Some("response_plan.exists".to_string()),
                },
                FlowStep {
                    step_id: "validate_package".to_string(),
                    step_name: "验证与打包".to_string(),
                    order: 5,
                    agent_calls: vec![AgentCall {
                        agent_id: "oa-response".to_string(),
                        input_mapping: std::collections::HashMap::new(),
                        output_key: "final_package".to_string(),
                        condition: Some("draft.exists".to_string()),
                        r#loop: None,
                    }],
                    requires_approval: true,
                    approval_prompt: Some("答辩文件已通过质量检查，是否确认提交？".to_string()),
                    quality_check: Some(QualityCheckConfig {
                        dimensions: vec![
                            "法律依据充分性".to_string(),
                            "技术事实准确性".to_string(),
                            "逻辑完整性".to_string(),
                            "权利要求支持".to_string(),
                            "答复策略一致性".to_string(),
                            "格式规范性".to_string(),
                            "审查员说服力".to_string(),
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
                    description: "答复中引用的法律条文和审查指南是否准确充分".to_string(),
                    weight: 0.20,
                },
                QualityDimension {
                    name: "技术事实准确性".to_string(),
                    description: "对技术方案的理解和描述是否准确".to_string(),
                    weight: 0.15,
                },
                QualityDimension {
                    name: "逻辑完整性".to_string(),
                    description: "答复逻辑链条是否完整，无遗漏".to_string(),
                    weight: 0.15,
                },
                QualityDimension {
                    name: "权利要求支持".to_string(),
                    description: "修改后的权利要求是否得到说明书的支持".to_string(),
                    weight: 0.15,
                },
                QualityDimension {
                    name: "答复策略一致性".to_string(),
                    description: "答复策略与权利要求修改方向是否一致".to_string(),
                    weight: 0.10,
                },
                QualityDimension {
                    name: "格式规范性".to_string(),
                    description: "文件格式是否符合国知局要求".to_string(),
                    weight: 0.10,
                },
                QualityDimension {
                    name: "审查员说服力".to_string(),
                    description: "答复对审查员的说服力和可接受性".to_string(),
                    weight: 0.15,
                },
            ],
        }
    }
}

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

fn generate_parse_oa_content(topic: &str, case_id: Option<&str>) -> String {
    let case_info = case_id
        .map(|id| format!("\n关联案件: {}", id))
        .unwrap_or_default();
    format!(
        "# 审查意见解读\n\n\
         主题: {}\n{}\n\n\
         ## 解读结果\n\n\
         ### 审查意见类型\n\
         第一次审查意见通知书\n\n\
         ### 驳回理由概要\n\n\
         1. **新颖性缺陷** (权利要求 1-5)\n\
            - 引用对比文件: CNXXXXXXA\n\
            - 审查员认为权利要求1-5相对于D1不具备新颖性\n\n\
         2. **创造性缺陷** (权利要求 1-10)\n\
            - 引用对比文件: CNXXXXXXA + CNYYYYYYA\n\
            - 审查员认为权利要求1-10相对于D1+D2的结合不具备创造性\n\n\
         3. **说明书不清楚** (说明书第[0025]段)\n\
            - 审查员认为技术特征描述不够清楚\n\n\
         ### 关键时间节点\n\
         - 通知书发文日: 2024-XX-XX\n\
         - 答复期限: 2024-XX-XX (自发文日起4个月)\n\n\
         *注：Phase 1 模板输出，生产环境将通过 MCP 调用 OfficeActionParser。*",
        topic, case_info
    )
}

fn generate_parsed_oa_json(topic: &str) -> String {
    serde_json::json!({
        "oa_type": "first_office_action",
        "application_no": "CN2024XXXXXXXX",
        "topic": topic,
        "rejections": [
            {
                "type": "novelty",
                "claims": [1, 2, 3, 4, 5],
                "citations": ["CNXXXXXXA"],
                "examiner_argument": "权利要求1-5相对于D1不具备新颖性"
            },
            {
                "type": "inventiveness",
                "claims": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
                "citations": ["CNXXXXXXA", "CNYYYYYYA"],
                "examiner_argument": "权利要求1-10相对于D1+D2的结合不具备创造性"
            },
            {
                "type": "clarity",
                "claims": [],
                "paragraphs": ["[0025]"],
                "examiner_argument": "技术特征描述不够清楚"
            }
        ],
        "deadline": "2024-XX-XX",
        "stage": "template_phase1"
    })
    .to_string()
}

fn generate_deep_analysis_content(topic: &str) -> String {
    format!(
        "# 驳回理由深度分析\n\n\
         主题: {}\n\n\
         ## 新颖性分析\n\n\
         ### 对比文件 D1: CNXXXXXXA\n\n\
         **审查员观点**: 权利要求1的技术方案已被D1公开。\n\n\
         **分析**:\n\
         - D1公开了技术特征 A, B, C\n\
         - 本申请权利要求1包含技术特征 A, B, C, D\n\
         - **关键区别**: 技术特征D在D1中未公开\n\
         - **结论**: 审查员的新颖性认定可能有误，特征D构成实质性区别\n\n\
         ## 创造性分析\n\n\
         ### 对比文件组合 D1+D2\n\n\
         **审查员观点**: D1+D2的结合公开了全部技术特征。\n\n\
         **分析**:\n\
         - D2是否给出了结合启示？\n\
         - D2的技术领域与本申请的差异\n\
         - D2要解决的技术问题与本申请不同\n\
         - **结论**: D1+D2缺乏结合启示，创造性论点有力\n\n\
         ## 说明书清楚性\n\n\
         **分析**: 第[0025]段的技术描述可通过补充实施例改进\n\n\
         *注：Phase 1 模板输出，生产环境将通过 MCP 调用 SmartOAResponder + ExaminerSimulator。*",
        topic
    )
}

fn generate_analysis_report(topic: &str) -> String {
    format!(
        "# 对比分析报告\n\n\
         ## 案件: {}\n\n\
         | 项目 | 本申请 | D1 | D2 |\n\
         |------|--------|----|----|\n\
         | 技术特征A | ✓ | ✓ | - |\n\
         | 技术特征B | ✓ | ✓ | - |\n\
         | 技术特征C | ✓ | ✓ | 部分 |\n\
         | 技术特征D | ✓ | ✗ | ✗ |\n\
         | 技术特征E | ✓ | ✗ | ✓ |\n\n\
         ## 核心论点\n\n\
         1. 特征D未被任何对比文件公开 → 新颖性成立\n\
         2. D1+D2无结合启示 → 创造性成立\n\
         3. 技术效果超出D1+D2的简单叠加 → 进一步佐证创造性",
        topic
    )
}

fn generate_strategy_content(topic: &str) -> String {
    format!(
        "# 答复策略方案\n\n\
         主题: {}\n\n\
         ## 方案A: 修改权利要求 + 意见陈述\n\n\
         **策略说明**: 将特征D加入独立权利要求，同时提交意见陈述论述创造性\n\n\
         **优点**: 最稳妥，兼顾修改和争辩\n\
         **缺点**: 权利保护范围缩小\n\n\
         **适用场景**: 审查员态度较强硬，需要实质性让步\n\n\
         ## 方案B: 仅意见陈述（不修改权利要求）\n\n\
         **策略说明**: 不修改权利要求，仅通过意见陈述争辩新颖性和创造性\n\n\
         **优点**: 保留最大保护范围\n\
         **缺点**: 风险较高，审查员可能不接受\n\n\
         **适用场景**: 对自身论点很有信心，审查员的论点明显有误\n\n\
         ## 方案C: 部分修改 + 部分争辩\n\n\
         **策略说明**: 修改部分权利要求（从属权利要求），对独立权利要求坚持争辩\n\n\
         **优点**: 平衡风险和保护范围\n\
         **缺点**: 策略复杂，需要精细设计\n\n\
         **适用场景**: 有多个层次的论点可用\n\n\
         *建议*: 根据本案情况，推荐**方案A**作为主要策略。\n\n\
         *注：Phase 1 模板输出，生产环境将通过 MCP 调用 HebbianOptimizer。*",
        topic
    )
}

fn generate_response_plan(topic: &str) -> String {
    format!(
        "# 答复计划\n\n\
         案件: {}\n\
         选择策略: 方案A\n\n\
         ## 执行步骤\n\n\
         1. 修改独立权利要求1，加入技术特征D\n\
         2. 适应性修改从属权利要求2-5\n\
         3. 撰写意见陈述书\n\
         4. 论述新颖性（特征D未被公开）\n\
         5. 论述创造性（D1+D2无结合启示）\n\
         6. 修正说明书第[0025]段的表述",
        topic
    )
}

fn generate_claim_comparison() -> String {
    "# 权利要求修改对照表\n\n\
     ## 独立权利要求1\n\n\
     | 项目 | 原权利要求 | 修改后 |\n\
     |------|-----------|--------|\n\
     | 前序部分 | 一种XXX方法 | 一种XXX方法 (不变) |\n\
     | 特征A | 包含步骤a | 包含步骤a (不变) |\n\
     | 特征B | 包含步骤b | 包含步骤b (不变) |\n\
     | 特征C | 包含步骤c | 包含步骤c (不变) |\n\
     | **特征D** | - | **包含步骤d，其中d满足条件XXX** (新增) |\n\n\
     **修改依据**: 说明书第[0018]-[0020]段"
        .to_string()
}

fn generate_draft_content(topic: &str) -> String {
    format!(
        "# 答复文本撰写\n\n\
         主题: {}\n\n\
         已完成以下文档的撰写：\n\n\
         1. **修改后权利要求书** — 独立权利要求已加入技术特征D\n\
         2. **意见陈述书草稿** — 包含新颖性和创造性论述\n\n\
         *注：Phase 1 模板输出，生产环境将通过 MCP 调用 ClaimReviser + OAResponseValidator。*",
        topic
    )
}

fn generate_revised_claims(topic: &str) -> String {
    format!(
        "# 修改后权利要求书\n\n\
         案件: {}\n\n\
         **1.** 一种XXX方法，其特征在于，包括以下步骤：\n\
         a) 步骤A；\n\
         b) 步骤B；\n\
         c) 步骤C；\n\
         **d) 步骤D，其中D满足条件XXX。**（新增，依据说明书[0018]-[0020]）\n\n\
         **2.** 根据权利要求1所述的方法，其特征在于，步骤a还包括：...\n\n\
         *（共10项权利要求，已全部适配修改）*",
        topic
    )
}

fn generate_opinion_statement(topic: &str) -> String {
    format!(
        "# 意见陈述书\n\n\
         申请人: XXX\n\
         申请号: CN2024XXXXXXXX\n\
         案件: {}\n\n\
         ---\n\n\
         尊敬的审查员：\n\n\
         申请人收到贵局于2024年XX月XX日发出的第一次审查意见通知书，现针对审查意见提出如下答复：\n\n\
         ## 一、关于新颖性\n\n\
         申请人认为，修改后的权利要求1相对于D1(CNXXXXXXA)具备新颖性，理由如下：\n\n\
         修改后的权利要求1包含技术特征D，即\"步骤D满足条件XXX\"。该特征在D1中未被公开。\n\
         D1仅公开了步骤a、b、c，未给出任何关于步骤d的技术教导。\n\
         因此，修改后的权利要求1与D1存在实质性区别，具备新颖性。\n\n\
         ## 二、关于创造性\n\n\
         申请人认为，修改后的权利要求1相对于D1+D2的结合具备创造性，理由如下：\n\n\
         ### 2.1 D1+D2无结合启示\n\n\
         D1属于XXX技术领域，D2属于YYY技术领域，二者技术领域不同。\n\
         D1要解决的技术问题是AAA，D2要解决的技术问题是BBB，二者不同。\n\
         本领域技术人员没有动机将D2的技术方案应用到D1中。\n\n\
         ### 2.2 技术效果超出简单叠加\n\n\
         特征D的引入产生了协同效果CCC，该效果超出D1+D2技术特征的简单叠加。\n\n\
         ## 三、关于说明书清楚性\n\n\
         申请人已对说明书第[0025]段进行了修正，使技术特征描述更加清楚。\n\n\
         ---\n\n\
         以上意见，请审查员予以考虑。\n\n\
         申请人：XXX\n\
         日期：2024年XX月XX日\n\n\
         *注：Phase 1 模板输出。*",
        topic
    )
}

fn generate_quality_report() -> QualityReport {
    QualityReport {
        overall_score: 8.2,
        dimensions: vec![
            QualityDimensionScore {
                name: "法律依据充分性".to_string(),
                score: 8.5,
            },
            QualityDimensionScore {
                name: "技术事实准确性".to_string(),
                score: 8.0,
            },
            QualityDimensionScore {
                name: "逻辑完整性".to_string(),
                score: 8.3,
            },
            QualityDimensionScore {
                name: "权利要求支持".to_string(),
                score: 8.0,
            },
            QualityDimensionScore {
                name: "答复策略一致性".to_string(),
                score: 8.5,
            },
            QualityDimensionScore {
                name: "格式规范性".to_string(),
                score: 7.8,
            },
            QualityDimensionScore {
                name: "审查员说服力".to_string(),
                score: 8.0,
            },
        ],
    }
}

fn pass_mark(score: f32) -> &'static str {
    crate::helpers::pass_mark(score, 7.5)
}

fn generate_response_package(topic: &str) -> String {
    format!(
        "# 完整答辩包\n\n\
         案件: {}\n\
         状态: 已通过质量验证\n\n\
         ## 包含文件\n\n\
         1. 修改后权利要求书 (10项)\n\
         2. 意见陈述书\n\
         3. 修改说明页\n\
         4. 权利要求修改对照表\n\n\
         ## 质量评分\n\n\
         综合评分: 8.2/10.0 (合格，≥7.5阈值)\n\n\
         ---\n\
         *Phase 1 模板生成，生产环境将通过 MCP 调用 QualityCheckerAgent。*",
        topic
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::agent::OrchestrationAgent;

    #[test]
    fn test_oa_agent_metadata() {
        let agent = OAResponseAgent::new();
        assert_eq!(agent.id().0, "oa-response");
        assert_eq!(agent.name(), "审查意见答复智能体");
        assert!(!agent.capabilities().is_empty());
        assert_eq!(agent.stages().len(), 5);
    }

    #[test]
    fn test_can_handle_oa_intent() {
        let agent = OAResponseAgent::new();
        let intent = UserIntent {
            raw_input: "审查意见答复策略".to_string(),
            parsed_topic: None,
            parsed_scope: None,
            parsed_depth: None,
        };
        let conf = agent.can_handle(&intent);
        assert!(
            conf > 0.6,
            "Expected high confidence for OA intent, got {}",
            conf
        );
    }

    #[test]
    fn test_can_handle_oa_english() {
        let agent = OAResponseAgent::new();
        let intent = UserIntent {
            raw_input: "office action response".to_string(),
            parsed_topic: None,
            parsed_scope: None,
            parsed_depth: None,
        };
        let conf = agent.can_handle(&intent);
        assert!(
            conf > 0.0,
            "Expected non-zero confidence for OA English intent"
        );
    }

    #[test]
    fn test_can_handle_non_oa() {
        let agent = OAResponseAgent::new();
        let intent = UserIntent {
            raw_input: "今天天气怎么样".to_string(),
            parsed_topic: None,
            parsed_scope: None,
            parsed_depth: None,
        };
        let conf = agent.can_handle(&intent);
        assert_eq!(conf, 0.0, "Expected zero confidence for non-OA intent");
    }

    #[tokio::test]
    async fn test_execute_returns_five_stages() {
        let mut agent = OAResponseAgent::new();
        agent.initialize().await.unwrap();

        let input = AgentInput {
            intent: UserIntent {
                raw_input: "审查意见答复".to_string(),
                parsed_topic: Some("OA答复".to_string()),
                parsed_scope: None,
                parsed_depth: None,
            },
            extra: serde_json::Value::Null,
        };

        use futures_util::StreamExt;
        let stages: Vec<StageOutput> = agent.execute(input).collect().await;

        assert_eq!(stages.len(), 5);
        assert_eq!(stages[0].stage_id, "parse_oa");
        assert_eq!(stages[1].stage_id, "deep_analysis");
        assert_eq!(stages[2].stage_id, "strategy");
        assert_eq!(stages[3].stage_id, "draft_response");
        assert_eq!(stages[4].stage_id, "validate_package");

        // Verify approval gates at steps 2, 3, 5.
        assert!(!stages[0].requires_approval);
        assert!(stages[1].requires_approval);
        assert!(stages[2].requires_approval);
        assert!(!stages[3].requires_approval);
        assert!(stages[4].requires_approval);

        // Verify artifacts.
        assert_eq!(stages[0].artifacts.len(), 1);
        assert_eq!(stages[3].artifacts.len(), 2);
        assert_eq!(stages[4].artifacts.len(), 1);
    }

    #[test]
    fn test_flow_definition() {
        let agent = OAResponseAgent::new();
        let flow = agent.flow_definition();

        assert_eq!(flow.flow_id, "oa_response");
        assert_eq!(flow.steps.len(), 5);
        assert_eq!(flow.quality_dimensions.len(), 7);

        // Verify step ordering.
        let orders: Vec<u32> = flow.steps.iter().map(|s| s.order).collect();
        assert_eq!(orders, vec![1, 2, 3, 4, 5]);

        // Verify quality check on final step.
        let last_step = flow.steps.last().unwrap();
        assert!(last_step.quality_check.is_some());
        let qc = last_step.quality_check.as_ref().unwrap();
        assert_eq!(qc.threshold, 7.5);
        assert_eq!(qc.dimensions.len(), 7);
    }

    #[test]
    fn test_execute_with_case_id() {
        let mut agent = OAResponseAgent::new();
        let input = AgentInput {
            intent: UserIntent {
                raw_input: "OA答复".to_string(),
                parsed_topic: None,
                parsed_scope: None,
                parsed_depth: None,
            },
            extra: serde_json::json!({"case_id": "case-1234"}),
        };

        // Verify input construction doesn't panic.
        let _stream = agent.execute(input);
    }
}
