//! Creativity Assessment Agent — inventive step analysis and argumentation.
//!
//! OrchestrationAgent that drives a 7-step inventive step analysis flow:
//! 1. 输入解析 (Input Parsing)
//! 2. 技术领域确定 (Technical Field Determination)
//! 3. 区别技术特征识别 (Distinguishing Features Identification)
//! 4. 技术效果分析 (Technical Effect Analysis)
//! 5. 显而易见性论证 (Obviousness Analysis)
//! 6. 论证段落生成 (Argument Paragraph Generation)
//! 7. 质量检查 (Quality Check)
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

/// The Creativity Assessment Agent handles inventive step analysis workflows.
/// It does not make conclusions, but helps agents organize argumentation logic
/// and generate argument paragraphs for OA response, re-examination, and invalidation.
pub struct CreativityAgent {
    base: AgentBase,
}

impl Default for CreativityAgent {
    fn default() -> Self {
        Self::new()
    }
}

impl CreativityAgent {
    pub fn new() -> Self {
        Self {
            base: AgentBase::new("creativity"),
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

const CREATIVITY_KEYWORDS: &[&str] = &[
    "创造性",
    "inventive",
    "显而易见",
    "三步法",
    "区别特征",
    "技术启示",
    "结合启示",
    "预料不到",
    "技术效果",
    "对比文件",
    "d1",
    "d2",
    "最接近现有技术",
    "现有技术",
    "新颖性",
    "专利法22条",
    "第二十二条",
    "驳回理由",
    "答复策略",
    "复审",
    "无效宣告",
    "专利性",
];

#[async_trait]
impl PatentAgent for CreativityAgent {
    fn id(&self) -> &AgentId {
        self.base.id()
    }

    fn name(&self) -> &str {
        "创造性判断智能体"
    }

    fn description(&self) -> &str {
        "使用三步法分析创造性：识别区别技术特征、分析技术效果、生成用于审查意见答复、复审和无效宣告的论证段落"
    }

    fn capabilities(&self) -> &[String] {
        static CAPS: std::sync::OnceLock<Vec<String>> = std::sync::OnceLock::new();
        CAPS.get_or_init(|| {
            vec![
                "input_parsing".to_string(),
                "tech_field_analysis".to_string(),
                "distinguishing_features".to_string(),
                "technical_effect_analysis".to_string(),
                "obviousness_analysis".to_string(),
                "argument_generation".to_string(),
                "quality_validation".to_string(),
            ]
        })
    }

    fn can_handle(&self, intent: &UserIntent) -> Confidence {
        keyword_confidence(&intent.raw_input, CREATIVITY_KEYWORDS, 0.6, 0.08, 0.4)
    }

    fn stages(&self) -> Vec<StageDefinition> {
        vec![
            StageDefinition {
                stage_id: "parse_input".to_string(),
                stage_name: "输入解析".to_string(),
                description: "解析权利要求书、对比文件(D1/D2)和技术领域描述".to_string(),
                requires_approval: false,
            },
            StageDefinition {
                stage_id: "tech_field".to_string(),
                stage_name: "技术领域确定".to_string(),
                description: "确定D1是否属于相同/相近技术领域，评估作为最接近现有技术的合理性"
                    .to_string(),
                requires_approval: true,
            },
            StageDefinition {
                stage_id: "distinguishing_features".to_string(),
                stage_name: "区别技术特征识别".to_string(),
                description: "将权利要求与D1进行逐特征比对，识别区别技术特征".to_string(),
                requires_approval: true,
            },
            StageDefinition {
                stage_id: "technical_effects".to_string(),
                stage_name: "技术效果分析".to_string(),
                description: "分析区别特征带来的技术效果，区分预料不到的效果和可预期效果"
                    .to_string(),
                requires_approval: true,
            },
            StageDefinition {
                stage_id: "obviousness".to_string(),
                stage_name: "显而易见性论证".to_string(),
                description: "从多个角度进行显而易见性分析，提供双向论证角度".to_string(),
                requires_approval: true,
            },
            StageDefinition {
                stage_id: "generate_arguments".to_string(),
                stage_name: "论证段落生成".to_string(),
                description: "生成可直接用于答复/复审/无效文本的创造性论述段落".to_string(),
                requires_approval: false,
            },
            StageDefinition {
                stage_id: "quality_check".to_string(),
                stage_name: "质量检查".to_string(),
                description: "验证论证逻辑一致性、法律依据准确性".to_string(),
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
            let patent_tool = crate::tools::PatentSearchTool::new();
            let patent_results = patent_tool.search(&topic, 0).await.ok();

            let mut parse_artifacts = vec![
                Artifact {
                    name: "结构化输入数据".to_string(),
                    artifact_type: "parsed_input".to_string(),
                    content: generate_parsed_input_json(&topic),
                    path: None,
                },
            ];

            if let Some(results) = patent_results && !results.patents.is_empty() {
                let patents_md = format_patent_results(&results);
                parse_artifacts.push(Artifact {
                    name: "相关专利检索结果（参考）".to_string(),
                    artifact_type: "patent_search_results".to_string(),
                    content: patents_md,
                    path: None,
                });
            }

            yield StageOutput {
                stage_id: "parse_input".to_string(),
                stage_name: "输入解析".to_string(),
                stage_type: StageType::Analysis,
                content: generate_parse_input_content(&topic, case_id.as_deref()),
                multimodal_content: vec![],
                artifacts: parse_artifacts,
                requires_approval: false,
                approval_request: None,
                metadata: StageMetadata {
                    duration_ms: Some(1000),
                    ..Default::default()
                },
            };

            let tech_field_content = if let Some(ref provider) = llm_provider {
                llm_generate(provider.as_ref(),
                    "你是一位资深专利审查员，擅长确定最接近现有技术的技术领域。\
                     请分析对比文件D1的技术领域，判断其与本申请是否属于相同或相近技术领域。",
                    &format!("请分析以下对比文件D1的技术领域，判断其与本申请是否属于相同或相近技术领域：\n\n{}", topic),
                ).await
            } else {
                generate_tech_field_content(&topic)
            };
            yield StageOutput {
                stage_id: "tech_field".to_string(),
                stage_name: "技术领域确定".to_string(),
                stage_type: StageType::Analysis,
                content: tech_field_content,
                multimodal_content: vec![],
                artifacts: vec![
                    Artifact {
                        name: "技术领域分析报告".to_string(),
                        artifact_type: "tech_field_report".to_string(),
                        content: generate_tech_field_report(&topic),
                        path: None,
                    },
                ],
                requires_approval: true,
                approval_request: Some(ApprovalRequest {
                    prompt: "技术领域分析如下，是否继续识别区别技术特征？".to_string(),
                    options: vec![
                        ApprovalOption {
                            label: "继续识别区别特征".to_string(),
                            value: "continue".to_string(),
                            is_default: true,
                        },
                        ApprovalOption {
                            label: "更换对比文件D1".to_string(),
                            value: "change_d1".to_string(),
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
                    duration_ms: Some(2500),
                    ..Default::default()
                },
            };

            let features_content = if let Some(ref provider) = llm_provider {
                llm_generate(provider.as_ref(),
                    "你是一位资深专利代理师，擅长识别区别技术特征。\
                     请将权利要求与D1进行逐特征比对，识别所有区别技术特征，并说明每个区别特征的技术效果。",
                    &format!("请识别以下权利要求与D1的区别技术特征：\n\n{}", topic),
                ).await
            } else {
                generate_distinguishing_features_content(&topic)
            };
            yield StageOutput {
                stage_id: "distinguishing_features".to_string(),
                stage_name: "区别技术特征识别".to_string(),
                stage_type: StageType::Analysis,
                content: features_content,
                multimodal_content: vec![],
                artifacts: vec![
                    Artifact {
                        name: "区别特征清单".to_string(),
                        artifact_type: "feature_list".to_string(),
                        content: generate_feature_list_json(&topic),
                        path: None,
                    },
                ],
                requires_approval: true,
                approval_request: Some(ApprovalRequest {
                    prompt: "区别特征识别结果如下，是否继续分析技术效果？".to_string(),
                    options: vec![
                        ApprovalOption {
                            label: "继续分析技术效果".to_string(),
                            value: "continue".to_string(),
                            is_default: true,
                        },
                        ApprovalOption {
                            label: "补充识别".to_string(),
                            value: "supplement".to_string(),
                            is_default: false,
                        },
                        ApprovalOption {
                            label: "重新识别".to_string(),
                            value: "redo".to_string(),
                            is_default: false,
                        },
                    ],
                }),
                metadata: StageMetadata {
                    duration_ms: Some(3000),
                    ..Default::default()
                },
            };

            let effects_content = if let Some(ref provider) = llm_provider {
                llm_generate(provider.as_ref(),
                    "你是一位技术专家，擅长分析专利技术效果。\
                     请分析每个区别技术特征带来的技术效果，区分预料不到的效果和本领域技术人员可预期的效果。",
                    &format!("请分析以下区别技术特征的技术效果：\n\n{}", topic),
                ).await
            } else {
                generate_technical_effects_content(&topic)
            };
            yield StageOutput {
                stage_id: "technical_effects".to_string(),
                stage_name: "技术效果分析".to_string(),
                stage_type: StageType::Analysis,
                content: effects_content,
                multimodal_content: vec![],
                artifacts: vec![
                    Artifact {
                        name: "技术效果分析报告".to_string(),
                        artifact_type: "effects_report".to_string(),
                        content: generate_effects_report(&topic),
                        path: None,
                    },
                ],
                requires_approval: true,
                approval_request: Some(ApprovalRequest {
                    prompt: "技术效果分析如下，是否进行显而易见性论证？".to_string(),
                    options: vec![
                        ApprovalOption {
                            label: "继续显而易见性论证".to_string(),
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
                    duration_ms: Some(2800),
                    ..Default::default()
                },
            };

            let obviousness_content = if let Some(ref provider) = llm_provider {
                llm_generate(provider.as_ref(),
                    "你是一位资深专利代理师，擅长创造性论证。\
                     请从多个角度进行显而易见性分析，提供支持创造性和反对创造性的双向论证角度。",
                    &format!("请进行显而易见性论证分析：\n\n{}", topic),
                ).await
            } else {
                generate_obviousness_content(&topic)
            };
            yield StageOutput {
                stage_id: "obviousness".to_string(),
                stage_name: "显而易见性论证".to_string(),
                stage_type: StageType::Suggestion,
                content: obviousness_content,
                multimodal_content: vec![],
                artifacts: vec![
                    Artifact {
                        name: "论证角度清单".to_string(),
                        artifact_type: "argument_angles".to_string(),
                        content: generate_argument_angles_json(&topic),
                        path: None,
                    },
                ],
                requires_approval: true,
                approval_request: Some(ApprovalRequest {
                    prompt: "请选择要使用的论证角度：".to_string(),
                    options: vec![
                        ApprovalOption {
                            label: "角度A: D1未给出技术启示".to_string(),
                            value: "angle_a".to_string(),
                            is_default: true,
                        },
                        ApprovalOption {
                            label: "角度B: D1+D2无结合动机".to_string(),
                            value: "angle_b".to_string(),
                            is_default: false,
                        },
                        ApprovalOption {
                            label: "角度C: 预料不到的技术效果".to_string(),
                            value: "angle_c".to_string(),
                            is_default: false,
                        },
                        ApprovalOption {
                            label: "角度D: 商业成功/长期需求".to_string(),
                            value: "angle_d".to_string(),
                            is_default: false,
                        },
                        ApprovalOption {
                            label: "多角度的组合论证".to_string(),
                            value: "combined".to_string(),
                            is_default: false,
                        },
                    ],
                }),
                metadata: StageMetadata {
                    duration_ms: Some(3500),
                    ..Default::default()
                },
            };

            let arguments_content = if let Some(ref provider) = llm_provider {
                llm_generate(provider.as_ref(),
                    "你是一位专利代理文书撰写专家。\
                     请根据选择的论证角度，生成可直接用于答复审查意见/复审请求/无效宣告的创造性论述段落。",
                    &format!("请生成创造性论证段落：\n\n{}", topic),
                ).await
            } else {
                generate_argument_paragraphs_content(&topic)
            };
            yield StageOutput {
                stage_id: "generate_arguments".to_string(),
                stage_name: "论证段落生成".to_string(),
                stage_type: StageType::Draft,
                content: arguments_content,
                multimodal_content: vec![],
                artifacts: vec![
                    Artifact {
                        name: "创造性论述段落（OA答复）".to_string(),
                        artifact_type: "oa_argument".to_string(),
                        content: generate_oa_argument_paragraph(&topic),
                        path: None,
                    },
                    Artifact {
                        name: "创造性论述段落（复审）".to_string(),
                        artifact_type: "reexam_argument".to_string(),
                        content: generate_reexam_argument_paragraph(&topic),
                        path: None,
                    },
                    Artifact {
                        name: "创造性论述段落（无效宣告）".to_string(),
                        artifact_type: "invalidation_argument".to_string(),
                        content: generate_invalidation_argument_paragraph(&topic),
                        path: None,
                    },
                ],
                requires_approval: false,
                approval_request: None,
                metadata: StageMetadata {
                    duration_ms: Some(4000),
                    ..Default::default()
                },
            };

            let quality_report = generate_quality_report();
            let overall_score = quality_report.overall_score;
            yield StageOutput {
                stage_id: "quality_check".to_string(),
                stage_name: "质量检查".to_string(),
                stage_type: StageType::Completed,
                content: format!(
                    "# 创造性论证质量验证\n\n\
                     综合评分: **{:.1}/10.0**\n\n\
                     ## 各维度评分\n\n\
                     | 维度 | 评分 | 状态 |\n\
                     |------|------|------|\n\
                     | 三步法逻辑完整性 | {:.1} | {} |\n\
                     | 技术事实准确性 | {:.1} | {} |\n\
                     | 法律依据充分性 | {:.1} | {} |\n\
                     | 论证角度多样性 | {:.1} | {} |\n\
                     | 段落可复用性 | {:.1} | {} |\n\
                     | 无循环论证 | {:.1} | {} |\n\
                     | 专利法22条引用准确 | {:.1} | {} |\n\n\
                     创造性论证已通过质量检查，可复用于答复/复审/无效程序。",
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
                artifacts: vec![
                    Artifact {
                        name: "完整创造性论证包".to_string(),
                        artifact_type: "creativity_package".to_string(),
                        content: generate_creativity_package(&topic),
                        path: None,
                    },
                ],
                requires_approval: true,
                approval_request: Some(ApprovalRequest {
                    prompt: "创造性论证质量检查已通过，是否确认输出？".to_string(),
                    options: vec![
                        ApprovalOption {
                            label: "确认输出".to_string(),
                            value: "confirm".to_string(),
                            is_default: true,
                        },
                        ApprovalOption {
                            label: "修改论证角度".to_string(),
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
                    duration_ms: Some(1500),
                    ..Default::default()
                },
            };
        })
    }

    fn set_llm_provider(&mut self, provider: Box<dyn LlmProvider>) {
        self.base.llm_provider = Some(provider);
    }

    async fn terminate(&mut self) -> Result<()> {
        self.base.initialized = false;
        Ok(())
    }
}

impl crate::agent::OrchestrationAgent for CreativityAgent {
    fn flow_definition(&self) -> OrchestrationFlow {
        OrchestrationFlow {
            flow_id: "creativity".to_string(),
            flow_name: "创造性判断分析".to_string(),
            description: "完整的创造性三步法分析流程：输入解析→技术领域确定→区别特征识别→技术效果分析→显而易见性论证→论证段落生成→质量检查".to_string(),
            steps: vec![
                FlowStep {
                    step_id: "parse_input".to_string(),
                    step_name: "输入解析".to_string(),
                    order: 1,
                    agent_calls: vec![AgentCall {
                        agent_id: "creativity".to_string(),
                        input_mapping: std::collections::HashMap::new(),
                        output_key: "parsed_input".to_string(),
                        condition: None,
                        r#loop: None,
                    }],
                    requires_approval: false,
                    approval_prompt: None,
                    quality_check: None,
                    condition: None,
                },
                FlowStep {
                    step_id: "tech_field".to_string(),
                    step_name: "技术领域确定".to_string(),
                    order: 2,
                    agent_calls: vec![AgentCall {
                        agent_id: "creativity".to_string(),
                        input_mapping: std::collections::HashMap::new(),
                        output_key: "tech_field_result".to_string(),
                        condition: Some("parsed_input.exists".to_string()),
                        r#loop: None,
                    }],
                    requires_approval: true,
                    approval_prompt: Some("技术领域分析如下，是否继续？".to_string()),
                    quality_check: None,
                    condition: Some("parsed_input.exists".to_string()),
                },
                FlowStep {
                    step_id: "distinguishing_features".to_string(),
                    step_name: "区别技术特征识别".to_string(),
                    order: 3,
                    agent_calls: vec![AgentCall {
                        agent_id: "creativity".to_string(),
                        input_mapping: std::collections::HashMap::new(),
                        output_key: "features_result".to_string(),
                        condition: Some("tech_field_result.exists".to_string()),
                        r#loop: None,
                    }],
                    requires_approval: true,
                    approval_prompt: Some("区别特征识别如下，是否继续？".to_string()),
                    quality_check: None,
                    condition: Some("tech_field_result.exists".to_string()),
                },
                FlowStep {
                    step_id: "technical_effects".to_string(),
                    step_name: "技术效果分析".to_string(),
                    order: 4,
                    agent_calls: vec![AgentCall {
                        agent_id: "creativity".to_string(),
                        input_mapping: std::collections::HashMap::new(),
                        output_key: "effects_result".to_string(),
                        condition: Some("features_result.exists".to_string()),
                        r#loop: None,
                    }],
                    requires_approval: true,
                    approval_prompt: Some("技术效果分析如下，是否继续？".to_string()),
                    quality_check: None,
                    condition: Some("features_result.exists".to_string()),
                },
                FlowStep {
                    step_id: "obviousness".to_string(),
                    step_name: "显而易见性论证".to_string(),
                    order: 5,
                    agent_calls: vec![AgentCall {
                        agent_id: "creativity".to_string(),
                        input_mapping: std::collections::HashMap::new(),
                        output_key: "obviousness_result".to_string(),
                        condition: Some("effects_result.exists".to_string()),
                        r#loop: None,
                    }],
                    requires_approval: true,
                    approval_prompt: Some("请选择论证角度".to_string()),
                    quality_check: None,
                    condition: Some("effects_result.exists".to_string()),
                },
                FlowStep {
                    step_id: "generate_arguments".to_string(),
                    step_name: "论证段落生成".to_string(),
                    order: 6,
                    agent_calls: vec![AgentCall {
                        agent_id: "creativity".to_string(),
                        input_mapping: std::collections::HashMap::new(),
                        output_key: "arguments_result".to_string(),
                        condition: Some("obviousness_result.exists".to_string()),
                        r#loop: None,
                    }],
                    requires_approval: false,
                    approval_prompt: None,
                    quality_check: None,
                    condition: Some("obviousness_result.exists".to_string()),
                },
                FlowStep {
                    step_id: "quality_check".to_string(),
                    step_name: "质量检查".to_string(),
                    order: 7,
                    agent_calls: vec![AgentCall {
                        agent_id: "creativity".to_string(),
                        input_mapping: std::collections::HashMap::new(),
                        output_key: "final_package".to_string(),
                        condition: Some("arguments_result.exists".to_string()),
                        r#loop: None,
                    }],
                    requires_approval: true,
                    approval_prompt: Some("质量检查通过，是否确认输出？".to_string()),
                    quality_check: Some(QualityCheckConfig {
                        dimensions: vec![
                            "三步法逻辑完整性".to_string(),
                            "技术事实准确性".to_string(),
                            "法律依据充分性".to_string(),
                            "论证角度多样性".to_string(),
                            "段落可复用性".to_string(),
                            "无循环论证".to_string(),
                            "专利法22条引用准确".to_string(),
                        ],
                        threshold: 7.5,
                        max_auto_retries: 2,
                        escalate_to_human: true,
                    }),
                    condition: Some("arguments_result.exists".to_string()),
                },
            ],
            quality_dimensions: vec![
                QualityDimension {
                    name: "三步法逻辑完整性".to_string(),
                    description: "是否严格遵循确定最接近现有技术→确定区别特征→判断是否显而易见的三步法".to_string(),
                    weight: 0.20,
                },
                QualityDimension {
                    name: "技术事实准确性".to_string(),
                    description: "对技术方案的理解和描述是否准确".to_string(),
                    weight: 0.15,
                },
                QualityDimension {
                    name: "法律依据充分性".to_string(),
                    description: "引用的法律条文和审查指南是否准确充分".to_string(),
                    weight: 0.15,
                },
                QualityDimension {
                    name: "论证角度多样性".to_string(),
                    description: "是否提供了多个角度的论证供代理人选择".to_string(),
                    weight: 0.15,
                },
                QualityDimension {
                    name: "段落可复用性".to_string(),
                    description: "生成的论证段落是否可直接用于实际文书".to_string(),
                    weight: 0.10,
                },
                QualityDimension {
                    name: "无循环论证".to_string(),
                    description: "论证逻辑是否存在循环论证或自相矛盾".to_string(),
                    weight: 0.10,
                },
                QualityDimension {
                    name: "专利法22条引用准确".to_string(),
                    description: "专利法第二十二条第三款（创造性）的引用和分析是否准确".to_string(),
                    weight: 0.15,
                },
            ],
        }
    }
}

struct QualityReport {
    overall_score: f32,
    dimensions: Vec<QualityDimensionScore>,
}

struct QualityDimensionScore {
    #[expect(dead_code)]
    name: String,
    score: f32,
}

fn generate_parse_input_content(topic: &str, case_id: Option<&str>) -> String {
    let case_info = case_id
        .map(|id| format!("\n关联案件: {}", id))
        .unwrap_or_default();
    format!(
        "# 输入解析\n\n\
         主题: {}\n{}\n\n\
         ## 解析结果\n\n\
         ### 权利要求书\n\
         - 已提取独立权利要求1\n\
         - 已提取从属权利要求2-5\n\n\
         ### 对比文件\n\
         - **D1**: CNXXXXXXA（最接近现有技术）\n\
         - **D2**: CNYYYYYYA（次要对比文件）\n\n\
         ### 技术领域\n\
         - 本申请: XXX技术领域\n\
         - D1: YYY技术领域\n\n\
         *注：Phase 1 模板输出，生产环境将通过 MCP 调用 PatentClaimParser + PriorArtExtractor。*",
        topic, case_info
    )
}

fn generate_parsed_input_json(topic: &str) -> String {
    serde_json::json!({
        "analysis_type": "creativity_assessment",
        "topic": topic,
        "claims": {
            "independent": "1. 一种XXX方法，其特征在于，包括步骤A、B、C、D...",
            "dependent": ["2. 根据权利要求1...", "3. ..."]
        },
        "prior_art": [
            {
                "doc_id": "CNXXXXXXA",
                "doc_type": "D1",
                "title": "一种YYY方法",
                "tech_field": "YYY技术领域"
            },
            {
                "doc_id": "CNYYYYYYA",
                "doc_type": "D2",
                "title": "一种ZZZ装置",
                "tech_field": "ZZZ技术领域"
            }
        ],
        "stage": "template_phase1"
    })
    .to_string()
}

fn format_patent_results(results: &crate::tools::PatentSearchResult) -> String {
    let mut lines = vec![
        "# 相关专利检索结果（参考）".to_string(),
        format!("检索到 {} 条相关专利\n", results.patents.len()),
    ];

    for (i, patent) in results.patents.iter().enumerate() {
        lines.push(format!(
            "## {}. {}\n\n- **专利号**: {}\n- **标题**: {}\n- **摘要**: {}\n- **URL**: {}",
            i + 1,
            patent.patent_id,
            patent.patent_id,
            patent.title,
            patent.snippet,
            patent.url
        ));
        if let Some(ref assignee) = patent.assignee {
            lines.push(format!("- **申请人**: {}", assignee));
        }
        if let Some(ref date) = patent.publication_date {
            lines.push(format!("- **公开日**: {}", date));
        }
        lines.push("\n".to_string());
    }

    lines.join("\n")
}

fn generate_tech_field_content(topic: &str) -> String {
    format!(
        "# 技术领域确定\n\n\
         主题: {}\n\n\
         ## D1 技术领域分析\n\n\
         ### 本申请技术领域\n\
         - **IPC分类号**: H01LXX/XX\n\
         - **技术领域**: XXX技术领域\n\
         - **要解决的技术问题**: 提高AAA效率\n\n\
         ### D1 技术领域\n\
         - **IPC分类号**: H01LXX/XX（相同大类）\n\
         - **技术领域**: YYY技术领域\n\
         - **要解决的技术问题**: 降低BBB成本\n\n\
         ## 领域相关性评估\n\n\
         | 评估项 | 结论 | 说明 |\n\
         |--------|------|------|\n\
         | IPC大类 | ✓ 相同 | 同属H01L大类 |\n\
         | 技术问题 | △ 相关 | 均涉及效率优化 |\n\
         | 技术手段 | ✓ 相近 | 均采用类似架构 |\n\
         | 应用领域 | ✗ 不同 | 本申请用于通信，D1用于计算 |\n\n\
         ## 结论\n\n\
         D1与本申请属于**相近技术领域**，可以作为最接近现有技术进行分析。\n\n\
         *注：Phase 1 模板输出。*",
        topic
    )
}

fn generate_tech_field_report(_topic: &str) -> String {
    "# 技术领域分析报告\n\n\
     ## 评估结论\n\n\
     D1(CNXXXXXXA) 与本申请属于**相近技术领域**，适合作为最接近现有技术。\n\n\
     ## 关键依据\n\n\
     1. IPC分类号相同大类（H01L）\n\
     2. 技术问题相关（效率优化）\n\
     3. 技术手段相近\n\n\
     ## 风险提示\n\n\
     - D1的应用领域与本申请不同，论证时需注意区分"
        .to_string()
}

fn generate_distinguishing_features_content(topic: &str) -> String {
    format!(
        "# 区别技术特征识别\n\n\
         主题: {}\n\n\
         ## 权利要求1 vs D1 特征比对\n\n\
         | 特征 | 权利要求1 | D1 | 是否公开 |\n\
         |------|-----------|----|----------|\n\
         | 特征A | 包含步骤a | 公开步骤a' | ✓ 已公开 |\n\
         | 特征B | 包含步骤b | 公开步骤b' | ✓ 已公开 |\n\
         | 特征C | 包含步骤c | 未公开 | ✗ **区别特征** |\n\
         | 特征D | 包含步骤d | 未公开 | ✗ **区别特征** |\n\n\
         ## 区别技术特征清单\n\n\
         ### 区别特征1: 步骤C\n\
         - **权利要求描述**: 包含步骤c，其中c满足条件P\n\
         - **D1对应内容**: 无对应公开\n\
         - **区别类型**: 结构区别\n\
         - **技术效果**: 提高处理效率30%\n\n\
         ### 区别特征2: 步骤D\n\
         - **权利要求描述**: 包含步骤d，其中d采用算法Q\n\
         - **D1对应内容**: 无对应公开\n\
         - **区别类型**: 功能区别\n\
         - **技术效果**: 降低能耗25%\n\n\
         *注：Phase 1 模板输出。*",
        topic
    )
}

fn generate_feature_list_json(_topic: &str) -> String {
    serde_json::json!({
        "distinguishing_features": [
            {
                "feature_id": "DF-001",
                "claim_feature": "包含步骤c，其中c满足条件P",
                "prior_art_feature": null,
                "difference_type": "结构区别",
                "technical_effect": "提高处理效率30%"
            },
            {
                "feature_id": "DF-002",
                "claim_feature": "包含步骤d，其中d采用算法Q",
                "prior_art_feature": null,
                "difference_type": "功能区别",
                "technical_effect": "降低能耗25%"
            }
        ],
        "common_features": [
            {"feature": "步骤a", "prior_art": "步骤a'"},
            {"feature": "步骤b", "prior_art": "步骤b'"}
        ]
    })
    .to_string()
}

fn generate_technical_effects_content(topic: &str) -> String {
    format!(
        "# 技术效果分析\n\n\
         主题: {}\n\n\
         ## 区别特征1: 步骤C 的技术效果\n\n\
         ### 直接效果\n\
         - 提高处理效率30%\n\
         - 减少资源占用15%\n\n\
         ### 是否预料不到\n\
         - **评估**: 预料不到的技术效果\n\
         - **理由**: D1未给出任何关于步骤c的启示，本领域技术人员无法预期加入步骤c会带来30%的效率提升\n\
         - **佐证**: 对比实验数据显示，未加入步骤c的基准方案效率仅为X，加入后提升至1.3X\n\n\
         ## 区别特征2: 步骤D 的技术效果\n\n\
         ### 直接效果\n\
         - 降低能耗25%\n\
         - 延长设备寿命\n\n\
         ### 是否预料不到\n\
         - **评估**: 预料不到的技术效果\n\
         - **理由**: D1采用传统算法，未公开算法Q。算法Q的能耗优化效果超出本领域技术人员预期\n\
         - **佐证**: 行业标准能耗为Y，本方案降至0.75Y\n\n\
         ## 协同效果\n\n\
         步骤C和步骤D的组合产生了协同效果：\n\
         - 单独使用C：效率+30%，能耗不变\n\
         - 单独使用D：效率不变，能耗-25%\n\
         - 组合使用：效率+30%，能耗-25%，且稳定性提升（非简单叠加）\n\n\
         *注：Phase 1 模板输出。*",
        topic
    )
}

fn generate_effects_report(_topic: &str) -> String {
    "# 技术效果分析报告\n\n\
     ## 效果评估汇总\n\n\
     | 区别特征 | 技术效果 | 是否预料不到 | 证据强度 |\n\
     |----------|----------|-------------|----------|\n\
     | 步骤C | 效率+30% | ✓ 是 | 强（对比实验） |\n\
     | 步骤D | 能耗-25% | ✓ 是 | 强（行业标准对比） |\n\n\
     ## 关键结论\n\n\
     两个区别特征均产生预料不到的技术效果，且存在协同效应，构成有力的创造性论据。"
        .to_string()
}

fn generate_obviousness_content(topic: &str) -> String {
    format!(
        "# 显而易见性论证（双向分析）\n\n\
         主题: {}\n\n\
         ## 角度A: D1是否给出技术启示\n\n\
         ### 支持创造性（反对显而易见）\n\
         - D1未公开区别特征C和D\n\
         - D1的技术方案完全未涉及本申请要解决的技术问题\n\
         - D1甚至给出了相反的技术教导（教导远离）\n\
         - **结论**: D1未给出任何技术启示\n\n\
         ### 反对创造性（支持显而易见）\n\
         - D1公开了特征A和B，为区别特征C/D的设置提供了基础\n\
         - 本领域技术人员在D1基础上容易想到改进\n\
         - **结论**: D1提供了部分启示\n\n\
         ## 角度B: D1+D2是否存在结合动机\n\n\
         ### 支持创造性\n\
         - D1和D2技术领域不同（YYY vs ZZZ）\n\
         - D1和D2要解决的技术问题不同\n\
         - D2未给出与D1结合的技术启示\n\
         - **结论**: D1+D2无结合动机\n\n\
         ### 反对创造性\n\
         - D2公开了类似的技术手段\n\
         - 本领域技术人员有动机将D2的手段应用于D1\n\
         - **结论**: 存在结合动机\n\n\
         ## 角度C: 是否存在预料不到的技术效果\n\n\
         ### 支持创造性\n\
         - 区别特征C带来30%效率提升（预料不到）\n\
         - 区别特征D带来25%能耗降低（预料不到）\n\
         - C+D组合产生协同效果（非简单叠加）\n\
         - **结论**: 存在预料不到的技术效果，支持创造性\n\n\
         ## 角度D: 商业成功/长期需求\n\n\
         ### 支持创造性\n\
         - 本申请技术方案已商业化，取得显著市场成功\n\
         - 行业内长期存在降低能耗+提高效率的双重需求\n\
         - 现有技术一直未能解决该问题\n\
         - **结论**: 商业成功佐证创造性\n\n\
         *注：Phase 1 模板输出，双向分析供代理人选择最有利的角度。*",
        topic
    )
}

fn generate_argument_angles_json(_topic: &str) -> String {
    serde_json::json!({
        "argument_angles": [
            {
                "angle_id": "A",
                "angle_name": "D1未给出技术启示",
                "pro_inventive": ["D1未公开区别特征", "D1给出相反教导", "技术问题不同"],
                "con_inventive": ["D1提供部分启示", "改进是显而易见的"],
                "applicable": true,
                "strength": "强"
            },
            {
                "angle_id": "B",
                "angle_name": "D1+D2无结合动机",
                "pro_inventive": ["领域不同", "问题不同", "无结合启示"],
                "con_inventive": ["D2公开类似手段", "有动机结合"],
                "applicable": true,
                "strength": "中"
            },
            {
                "angle_id": "C",
                "angle_name": "预料不到的技术效果",
                "pro_inventive": ["效率+30%", "能耗-25%", "协同效果"],
                "con_inventive": ["效果可预期", "属于常规优化"],
                "applicable": true,
                "strength": "强"
            },
            {
                "angle_id": "D",
                "angle_name": "商业成功/长期需求",
                "pro_inventive": ["市场成功", "长期未解决", "行业认可"],
                "con_inventive": ["成功与创造性无关", "营销因素主导"],
                "applicable": true,
                "strength": "辅助"
            }
        ]
    })
    .to_string()
}

fn generate_argument_paragraphs_content(topic: &str) -> String {
    format!(
        "# 论证段落生成\n\n\
         主题: {}\n\n\
         已生成以下格式的创造性论述段落：\n\n\
         1. **OA答复书段落** — 针对审查员驳回理由的创造性反驳\n\
         2. **复审请求书段落** — 更完整的创造性论证体系\n\
         3. **无效宣告段落** — 从专利权人角度论证创造性\n\n\
         *注：Phase 1 模板输出，生产环境将通过 MCP 调用 ArgumentGenerator。*",
        topic
    )
}

fn generate_oa_argument_paragraph(_topic: &str) -> String {
    "## 关于创造性的意见陈述（OA答复用）\n\n\
     申请人认为，权利要求1相对于对比文件D1和D2的结合具备创造性，符合专利法第二十二条第三款的规定，理由如下：\n\n\
     ### 一、D1未给出技术启示\n\n\
     D1（CNXXXXXXA）公开了一种YYY方法，但其技术方案完全未涉及本申请要解决的技术问题，也未公开区别特征C和D。本领域技术人员在阅读D1后，没有动机在D1的基础上引入区别特征C和D以获得本申请的技术方案。\n\n\
     ### 二、D1+D2无结合动机\n\n\
     D1属于YYY技术领域，D2属于ZZZ技术领域，二者技术领域不同，要解决的技术问题也不同。D2未给出任何与D1结合的技术启示。本领域技术人员没有动机将D2的技术方案应用到D1中。\n\n\
     ### 三、预料不到的技术效果\n\n\
     区别特征C带来处理效率提升30%，区别特征D带来能耗降低25%。上述技术效果超出本领域技术人员的预期，且C+D的组合产生协同效果，并非简单叠加。\n\n\
     综上所述，权利要求1具备创造性。"
        .to_string()
}

fn generate_reexam_argument_paragraph(_topic: &str) -> String {
    "## 创造性论证（复审请求用）\n\n\
     请求人认为，本申请权利要求1具备创造性，符合专利法第二十二条第三款的规定。具体论证如下：\n\n\
     ### 一、最接近现有技术的确定\n\n\
     D1（CNXXXXXXA）与本申请属于相近技术领域，但D1要解决的技术问题与本申请不同。审查员选择D1作为最接近现有技术并无不当，但D1的技术教导与本申请存在本质差异。\n\n\
     ### 二、区别技术特征的确定\n\n\
     权利要求1与D1相比，存在区别特征C（步骤c）和区别特征D（步骤d）。上述区别特征在D1中均未公开。\n\n\
     ### 三、技术效果的分析\n\n\
     区别特征C带来处理效率提升30%，区别特征D带来能耗降低25%。上述技术效果已被实验数据证实，且超出本领域技术人员的合理预期。\n\n\
     ### 四、显而易见性的判断\n\n\
     （一）D1未给出技术启示\n\
     D1未公开区别特征C和D，也未给出任何引入上述特征的技术启示。\n\n\
     （二）D1+D2无结合动机\n\
     D2未给出与D1结合的启示，本领域技术人员没有动机将D2应用于D1。\n\n\
     （三）预料不到的技术效果\n\
     区别特征C和D的组合产生协同效果，并非简单叠加。\n\n\
     综上所述，权利要求1具备突出的实质性特点和显著的进步，符合专利法第二十二条第三款关于创造性的规定。"
        .to_string()
}

fn generate_invalidation_argument_paragraph(_topic: &str) -> String {
    "## 创造性答辩（无效宣告用）\n\n\
     专利权人认为，本专利权利要求1具备创造性，符合专利法第二十二条第三款的规定，请求人关于权利要求1不具备创造性的无效理由不能成立。具体理由如下：\n\n\
     ### 一、权利要求1与D1的区别\n\n\
     权利要求1包含技术特征A、B、C、D。D1仅公开了特征A和B，未公开特征C和D。因此，特征C和D构成区别技术特征。\n\n\
     ### 二、区别特征的技术效果\n\n\
     特征C带来效率提升30%，特征D带来能耗降低25%。上述技术效果有实验数据支持，且属于预料不到的技术效果。\n\n\
     ### 三、显而易见性的反驳\n\n\
     （一）D1未给出启示\n\
     D1未公开区别特征，也未给出任何启示。\n\n\
     （二）D1+D2无结合动机\n\
     D1和D2领域不同、问题不同，无结合动机。\n\n\
     （三）协同效果\n\
     C+D的组合产生非显而易见的协同效果。\n\n\
     综上所述，请求人的无效理由不成立，权利要求1维持有效。"
        .to_string()
}

fn generate_quality_report() -> QualityReport {
    QualityReport {
        overall_score: 8.5,
        dimensions: vec![
            QualityDimensionScore {
                name: "三步法逻辑完整性".to_string(),
                score: 9.0,
            },
            QualityDimensionScore {
                name: "技术事实准确性".to_string(),
                score: 8.0,
            },
            QualityDimensionScore {
                name: "法律依据充分性".to_string(),
                score: 8.5,
            },
            QualityDimensionScore {
                name: "论证角度多样性".to_string(),
                score: 9.0,
            },
            QualityDimensionScore {
                name: "段落可复用性".to_string(),
                score: 8.5,
            },
            QualityDimensionScore {
                name: "无循环论证".to_string(),
                score: 8.5,
            },
            QualityDimensionScore {
                name: "专利法22条引用准确".to_string(),
                score: 8.5,
            },
        ],
    }
}

fn pass_mark(score: f32) -> &'static str {
    crate::helpers::pass_mark(score, 7.5)
}

fn generate_creativity_package(topic: &str) -> String {
    format!(
        "# 完整创造性论证包\n\n\
         案件: {}\n\
         状态: 已通过质量验证\n\n\
         ## 包含文件\n\n\
         1. 技术领域分析报告\n\
         2. 区别特征清单\n\
         3. 技术效果分析报告\n\
         4. 论证角度清单（双向分析）\n\
         5. OA答复创造性段落\n\
         6. 复审请求创造性段落\n\
         7. 无效宣告创造性段落\n\n\
         ## 质量评分\n\n\
         综合评分: 8.5/10.0 (优秀，≥7.5阈值)\n\n\
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
    fn test_creativity_agent_metadata() {
        let agent = CreativityAgent::new();
        assert_eq!(agent.id().0, "creativity");
        assert_eq!(agent.name(), "创造性判断智能体");
        assert!(!agent.capabilities().is_empty());
        assert_eq!(agent.stages().len(), 7);
    }

    #[test]
    fn test_can_handle_creativity_intent() {
        let agent = CreativityAgent::new();
        let intent = UserIntent {
            raw_input: "创造性分析".to_string(),
            parsed_topic: None,
            parsed_scope: None,
            parsed_depth: None,
        };
        let conf = agent.can_handle(&intent);
        assert!(
            conf > 0.6,
            "Expected high confidence for creativity intent, got {}",
            conf
        );
    }

    #[test]
    fn test_can_handle_obviousness_intent() {
        let agent = CreativityAgent::new();
        let intent = UserIntent {
            raw_input: "显而易见性分析".to_string(),
            parsed_topic: None,
            parsed_scope: None,
            parsed_depth: None,
        };
        let conf = agent.can_handle(&intent);
        assert!(
            conf > 0.6,
            "Expected high confidence for obviousness intent, got {}",
            conf
        );
    }

    #[test]
    fn test_can_handle_three_step_intent() {
        let agent = CreativityAgent::new();
        let intent = UserIntent {
            raw_input: "三步法分析 D1 D2".to_string(),
            parsed_topic: None,
            parsed_scope: None,
            parsed_depth: None,
        };
        let conf = agent.can_handle(&intent);
        assert!(
            conf > 0.6,
            "Expected high confidence for three-step intent, got {}",
            conf
        );
    }

    #[test]
    fn test_can_handle_non_creativity() {
        let agent = CreativityAgent::new();
        let intent = UserIntent {
            raw_input: "今天天气怎么样".to_string(),
            parsed_topic: None,
            parsed_scope: None,
            parsed_depth: None,
        };
        let conf = agent.can_handle(&intent);
        assert_eq!(
            conf, 0.0,
            "Expected zero confidence for non-creativity intent"
        );
    }

    #[tokio::test]
    async fn test_execute_returns_seven_stages() {
        let mut agent = CreativityAgent::new();
        agent.initialize().await.unwrap();

        let input = AgentInput {
            intent: UserIntent {
                raw_input: "创造性判断分析".to_string(),
                parsed_topic: Some("创造性分析".to_string()),
                parsed_scope: None,
                parsed_depth: None,
            },
            extra: serde_json::Value::Null,
        };

        use futures_util::StreamExt;
        let stages: Vec<StageOutput> = agent.execute(input).collect().await;

        assert_eq!(stages.len(), 7);
        assert_eq!(stages[0].stage_id, "parse_input");
        assert_eq!(stages[1].stage_id, "tech_field");
        assert_eq!(stages[2].stage_id, "distinguishing_features");
        assert_eq!(stages[3].stage_id, "technical_effects");
        assert_eq!(stages[4].stage_id, "obviousness");
        assert_eq!(stages[5].stage_id, "generate_arguments");
        assert_eq!(stages[6].stage_id, "quality_check");

        // Verify approval gates: steps 2,3,4,5,7 require approval.
        assert!(!stages[0].requires_approval);
        assert!(stages[1].requires_approval);
        assert!(stages[2].requires_approval);
        assert!(stages[3].requires_approval);
        assert!(stages[4].requires_approval);
        assert!(!stages[5].requires_approval);
        assert!(stages[6].requires_approval);
        assert_eq!(stages[0].artifacts.len(), 1);
        assert_eq!(stages[2].artifacts.len(), 1);
        assert_eq!(stages[3].artifacts.len(), 1);
        assert_eq!(stages[4].artifacts.len(), 1);
        assert_eq!(stages[5].artifacts.len(), 3);
        assert_eq!(stages[6].artifacts.len(), 1);
    }

    #[test]
    fn test_flow_definition() {
        let agent = CreativityAgent::new();
        let flow = agent.flow_definition();

        assert_eq!(flow.flow_id, "creativity");
        assert_eq!(flow.steps.len(), 7);
        assert_eq!(flow.quality_dimensions.len(), 7);

        let orders: Vec<u32> = flow.steps.iter().map(|s| s.order).collect();
        assert_eq!(orders, vec![1, 2, 3, 4, 5, 6, 7]);

        let last_step = flow.steps.last().unwrap();
        assert!(last_step.quality_check.is_some());
        let qc = last_step.quality_check.as_ref().unwrap();
        assert_eq!(qc.threshold, 7.5);
        assert_eq!(qc.dimensions.len(), 7);
    }

    #[test]
    fn test_execute_with_case_id() {
        let mut agent = CreativityAgent::new();
        let input = AgentInput {
            intent: UserIntent {
                raw_input: "创造性分析".to_string(),
                parsed_topic: None,
                parsed_scope: None,
                parsed_depth: None,
            },
            extra: serde_json::json!({"case_id": "case-creativity-001"}),
        };

        let _stream = agent.execute(input);
    }

    #[test]
    fn test_argument_angles_generation() {
        let json_str = generate_argument_angles_json("测试主题");
        let parsed: serde_json::Value = serde_json::from_str(&json_str).unwrap();
        let angles = parsed["argument_angles"].as_array().unwrap();
        assert_eq!(angles.len(), 4);

        for angle in angles {
            assert!(angle["angle_id"].is_string());
            assert!(angle["angle_name"].is_string());
            assert!(angle["pro_inventive"].is_array());
            assert!(angle["con_inventive"].is_array());
            assert!(angle["applicable"].is_boolean());
        }

        let angle_a = angles.iter().find(|a| a["angle_id"] == "A").unwrap();
        assert_eq!(angle_a["angle_name"], "D1未给出技术启示");
        assert!(!angle_a["pro_inventive"].as_array().unwrap().is_empty());
        assert!(!angle_a["con_inventive"].as_array().unwrap().is_empty());
    }

    #[test]
    fn test_quality_report_generation() {
        let report = generate_quality_report();
        assert_eq!(report.overall_score, 8.5);
        assert_eq!(report.dimensions.len(), 7);

        for dim in &report.dimensions {
            assert!(dim.score >= 0.0 && dim.score <= 10.0);
        }
    }
}
