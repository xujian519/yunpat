//! Drafting Agent — patent application drafting workflow.
//!
//! OrchestrationAgent that drives a 5-step patent drafting flow:
//! 1. 技术交底书解析 (Disclosure Parsing)
//! 2. 现有技术检索 (Prior Art Search)
//! 3. 权利要求布局 (Claim Layout)
//! 4. 说明书撰写 (Specification Drafting)
//! 5. 审核优化 (Review & Optimization)
//!
//! Phase 1: Template-based outputs without LLM or MCP calls.

use crate::agent::PatentAgent;
use crate::context::LlmProvider;
use crate::flow::{AgentCall, FlowStep, OrchestrationFlow, QualityCheckConfig, QualityDimension};
use crate::types::*;
use anyhow::Result;
use async_trait::async_trait;
use futures_core::Stream;
use std::pin::Pin;

use crate::helpers::{AgentBase, extract_case_id, keyword_confidence, llm_generate};

/// The Drafting Agent handles patent application drafting workflows.
pub struct DraftingAgent {
    base: AgentBase,
}

impl Default for DraftingAgent {
    fn default() -> Self {
        Self::new()
    }
}

impl DraftingAgent {
    pub fn new() -> Self {
        Self {
            base: AgentBase::new("drafting"),
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

const DRAFTING_KEYWORDS: &[&str] = &[
    "撰写",
    "draft",
    "专利申请",
    "权利要求",
    "说明书",
    "技术交底",
    "交底书",
    "专利布局",
    "claim",
    "specification",
    "发明",
    "invention",
    "技术方案",
    "实施例",
    "embodiment",
];

#[async_trait]
impl PatentAgent for DraftingAgent {
    fn id(&self) -> &AgentId {
        self.base.id()
    }

    fn name(&self) -> &str {
        "专利撰写智能体"
    }

    fn description(&self) -> &str {
        "处理专利申请撰写工作流：技术交底书解析、现有技术检索、权利要求布局、说明书撰写和审核优化"
    }

    fn capabilities(&self) -> &[String] {
        static CAPS: std::sync::OnceLock<Vec<String>> = std::sync::OnceLock::new();
        CAPS.get_or_init(|| {
            vec![
                "disclosure_parsing".to_string(),
                "prior_art_search".to_string(),
                "claim_layout".to_string(),
                "specification_drafting".to_string(),
                "patent_review".to_string(),
            ]
        })
    }

    fn can_handle(&self, intent: &UserIntent) -> Confidence {
        keyword_confidence(&intent.raw_input, DRAFTING_KEYWORDS, 0.6, 0.1, 0.4)
    }

    fn stages(&self) -> Vec<StageDefinition> {
        vec![
            StageDefinition {
                stage_id: "parse_disclosure".to_string(),
                stage_name: "技术交底书解析".to_string(),
                description: "解析技术交底书，提取结构化发明内容".to_string(),
                requires_approval: false,
            },
            StageDefinition {
                stage_id: "prior_art_search".to_string(),
                stage_name: "现有技术检索".to_string(),
                description: "检索相关专利和现有技术".to_string(),
                requires_approval: true,
            },
            StageDefinition {
                stage_id: "claim_layout".to_string(),
                stage_name: "权利要求布局".to_string(),
                description: "设计独立权利要求和从属权利要求的层次结构".to_string(),
                requires_approval: true,
            },
            StageDefinition {
                stage_id: "draft_specification".to_string(),
                stage_name: "说明书撰写".to_string(),
                description: "撰写完整的专利说明书".to_string(),
                requires_approval: false,
            },
            StageDefinition {
                stage_id: "review_optimize".to_string(),
                stage_name: "审核优化".to_string(),
                description: "审核保护范围、支持性和清楚性".to_string(),
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
            // Step 1: 技术交底书解析
            yield StageOutput {
                stage_id: "parse_disclosure".to_string(),
                stage_name: "技术交底书解析".to_string(),
                stage_type: StageType::Analysis,
                content: generate_parse_disclosure_content(&topic, case_id.as_deref()),
                multimodal_content: vec![],
                artifacts: vec![Artifact {
                    name: "结构化发明内容".to_string(),
                    artifact_type: "parsed_disclosure".to_string(),
                    content: generate_parsed_disclosure_json(&topic),
                    path: None,
                }],
                requires_approval: false,
                approval_request: None,
                metadata: StageMetadata {
                    duration_ms: Some(1000),
                    ..Default::default()
                },
            };

            // Step 2: 现有技术检索 (with approval gate, LLM or template)
            let search_content = if let Some(ref provider) = llm_provider {
                llm_generate(provider.as_ref(),
                    "你是一位资深专利检索专家。请根据以下发明内容，制定检索策略，
                     包括IPC/CPC分类号、关键词组合和检索数据库。",
                    &format!("请为以下发明内容制定检索策略：\n\n{}", topic),
                ).await
            } else {
                generate_prior_art_search_content(&topic)
            };

            let patent_tool = crate::tools::PatentSearchTool::new();
            let patent_results = patent_tool.search(&topic, 0).await.ok();

            let mut search_artifacts = vec![
                Artifact {
                    name: "检索策略报告".to_string(),
                    artifact_type: "search_strategy".to_string(),
                    content: generate_search_strategy(&topic),
                    path: None,
                },
                Artifact {
                    name: "现有技术清单".to_string(),
                    artifact_type: "prior_art_list".to_string(),
                    content: generate_prior_art_list(),
                    path: None,
                },
            ];

            if let Some(results) = patent_results && !results.patents.is_empty() {
                let patents_md = format_patent_results(&results);
                search_artifacts.push(Artifact {
                    name: "在线专利检索结果".to_string(),
                    artifact_type: "patent_search_results".to_string(),
                    content: patents_md,
                    path: None,
                });
            }

            yield StageOutput {
                stage_id: "prior_art_search".to_string(),
                stage_name: "现有技术检索".to_string(),
                stage_type: StageType::Analysis,
                content: search_content,
                multimodal_content: vec![],
                artifacts: search_artifacts,
                requires_approval: true,
                approval_request: Some(ApprovalRequest {
                    prompt: "检索策略已完成，是否继续权利要求布局？".to_string(),
                    options: vec![
                        ApprovalOption {
                            label: "继续布局".to_string(),
                            value: "continue".to_string(),
                            is_default: true,
                        },
                        ApprovalOption {
                            label: "补充检索".to_string(),
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
                    duration_ms: Some(3000),
                    ..Default::default()
                },
            };

            // Step 3: 权利要求布局 (with approval gate, LLM or template)
            let claim_content = if let Some(ref provider) = llm_provider {
                llm_generate(provider.as_ref(),
                    "你是一位资深专利代理师，擅长权利要求布局。请根据发明内容和现有技术检索结果，
                     设计独立权利要求和从属权利要求的层次结构。",
                    &format!("请为以下发明设计权利要求书：\n\n{}", topic),
                ).await
            } else {
                generate_claim_layout_content(&topic)
            };
            yield StageOutput {
                stage_id: "claim_layout".to_string(),
                stage_name: "权利要求布局".to_string(),
                stage_type: StageType::Draft,
                content: claim_content,
                multimodal_content: vec![],
                artifacts: vec![
                    Artifact {
                        name: "权利要求书草案".to_string(),
                        artifact_type: "claim_draft".to_string(),
                        content: generate_claim_draft(&topic),
                        path: None,
                    },
                    Artifact {
                        name: "权利要求层次图".to_string(),
                        artifact_type: "claim_hierarchy".to_string(),
                        content: generate_claim_hierarchy(),
                        path: None,
                    },
                ],
                requires_approval: true,
                approval_request: Some(ApprovalRequest {
                    prompt: "权利要求布局已完成，请选择下一步：".to_string(),
                    options: vec![
                        ApprovalOption {
                            label: "生成说明书".to_string(),
                            value: "draft_spec".to_string(),
                            is_default: true,
                        },
                        ApprovalOption {
                            label: "调整权利要求".to_string(),
                            value: "adjust_claims".to_string(),
                            is_default: false,
                        },
                        ApprovalOption {
                            label: "保存草稿".to_string(),
                            value: "save_draft".to_string(),
                            is_default: false,
                        },
                    ],
                }),
                metadata: StageMetadata {
                    duration_ms: Some(4000),
                    ..Default::default()
                },
            };

            // Step 4: 说明书撰写 (LLM or template)
            let spec_content = if let Some(ref provider) = llm_provider {
                llm_generate(provider.as_ref(),
                    "你是一位资深专利代理师，擅长撰写专利说明书。请根据发明内容和权利要求书，
                     撰写完整、清晰的专利说明书。",
                    &format!("请为以下发明撰写专利说明书：\n\n{}", topic),
                ).await
            } else {
                generate_specification_content(&topic)
            };
            yield StageOutput {
                stage_id: "draft_specification".to_string(),
                stage_name: "说明书撰写".to_string(),
                stage_type: StageType::Draft,
                content: spec_content,
                multimodal_content: vec![],
                artifacts: vec![
                    Artifact {
                        name: "专利说明书".to_string(),
                        artifact_type: "specification".to_string(),
                        content: generate_full_specification(&topic),
                        path: None,
                    },
                    Artifact {
                        name: "摘要".to_string(),
                        artifact_type: "abstract".to_string(),
                        content: generate_abstract(&topic),
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

            // Step 5: 审核优化 (with approval gate)
            let review_report = generate_review_report();
            let overall_score = review_report.overall_score;
            yield StageOutput {
                stage_id: "review_optimize".to_string(),
                stage_name: "审核优化".to_string(),
                stage_type: StageType::Completed,
                content: format!(
                    "# 专利文件审核报告\n\n\
                     综合评分: **{:.1}/10.0**\n\n\
                     ## 审核维度\n\n\
                     | 维度 | 评分 | 状态 |\n\
                     |------|------|------|\n\
                     | 保护范围合理性 | {:.1} | {} |\n\
                     | 说明书支持性 | {:.1} | {} |\n\
                     | 清楚性 | {:.1} | {} |\n\
                     | 单一性 | {:.1} | {} |\n\
                     | 新颖性预判 | {:.1} | {} |\n\
                     | 创造性预判 | {:.1} | {} |\n\
                     | 格式规范性 | {:.1} | {} |\n\n\
                     专利文件已通过审核，准备提交。",
                    overall_score,
                    review_report.dimensions[0].score,
                    pass_mark(review_report.dimensions[0].score),
                    review_report.dimensions[1].score,
                    pass_mark(review_report.dimensions[1].score),
                    review_report.dimensions[2].score,
                    pass_mark(review_report.dimensions[2].score),
                    review_report.dimensions[3].score,
                    pass_mark(review_report.dimensions[3].score),
                    review_report.dimensions[4].score,
                    pass_mark(review_report.dimensions[4].score),
                    review_report.dimensions[5].score,
                    pass_mark(review_report.dimensions[5].score),
                    review_report.dimensions[6].score,
                    pass_mark(review_report.dimensions[6].score),
                ),
                multimodal_content: vec![],
                artifacts: vec![Artifact {
                    name: "完整专利申请包".to_string(),
                    artifact_type: "patent_package".to_string(),
                    content: generate_patent_package(&topic),
                    path: None,
                }],
                requires_approval: true,
                approval_request: Some(ApprovalRequest {
                    prompt: "专利申请文件已通过审核，是否确认提交？".to_string(),
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

    fn set_llm_provider(&mut self, provider: Box<dyn LlmProvider>) {
        self.base.llm_provider = Some(provider);
    }

    async fn terminate(&mut self) -> Result<()> {
        self.base.initialized = false;
        Ok(())
    }
}

impl crate::agent::OrchestrationAgent for DraftingAgent {
    fn flow_definition(&self) -> OrchestrationFlow {
        OrchestrationFlow {
            flow_id: "patent_drafting".to_string(),
            flow_name: "专利申请撰写".to_string(),
            description: "完整的专利申请撰写流程：解析→检索→布局→撰写→审核".to_string(),
            steps: vec![
                FlowStep {
                    step_id: "parse_disclosure".to_string(),
                    step_name: "技术交底书解析".to_string(),
                    order: 1,
                    agent_calls: vec![AgentCall {
                        agent_id: "drafting".to_string(),
                        input_mapping: std::collections::HashMap::new(),
                        output_key: "parsed_disclosure".to_string(),
                        condition: None,
                        r#loop: None,
                    }],
                    requires_approval: false,
                    approval_prompt: None,
                    quality_check: None,
                    condition: None,
                },
                FlowStep {
                    step_id: "prior_art_search".to_string(),
                    step_name: "现有技术检索".to_string(),
                    order: 2,
                    agent_calls: vec![AgentCall {
                        agent_id: "drafting".to_string(),
                        input_mapping: std::collections::HashMap::new(),
                        output_key: "search_results".to_string(),
                        condition: Some("parsed_disclosure.exists".to_string()),
                        r#loop: None,
                    }],
                    requires_approval: true,
                    approval_prompt: Some("检索策略已完成，是否继续？".to_string()),
                    quality_check: None,
                    condition: Some("parsed_disclosure.exists".to_string()),
                },
                FlowStep {
                    step_id: "claim_layout".to_string(),
                    step_name: "权利要求布局".to_string(),
                    order: 3,
                    agent_calls: vec![AgentCall {
                        agent_id: "drafting".to_string(),
                        input_mapping: std::collections::HashMap::new(),
                        output_key: "claim_draft".to_string(),
                        condition: Some("search_results.exists".to_string()),
                        r#loop: None,
                    }],
                    requires_approval: true,
                    approval_prompt: Some("权利要求布局已完成，请选择下一步".to_string()),
                    quality_check: None,
                    condition: Some("search_results.exists".to_string()),
                },
                FlowStep {
                    step_id: "draft_specification".to_string(),
                    step_name: "说明书撰写".to_string(),
                    order: 4,
                    agent_calls: vec![AgentCall {
                        agent_id: "drafting".to_string(),
                        input_mapping: std::collections::HashMap::new(),
                        output_key: "specification".to_string(),
                        condition: Some("claim_draft.exists".to_string()),
                        r#loop: None,
                    }],
                    requires_approval: false,
                    approval_prompt: None,
                    quality_check: None,
                    condition: Some("claim_draft.exists".to_string()),
                },
                FlowStep {
                    step_id: "review_optimize".to_string(),
                    step_name: "审核优化".to_string(),
                    order: 5,
                    agent_calls: vec![AgentCall {
                        agent_id: "drafting".to_string(),
                        input_mapping: std::collections::HashMap::new(),
                        output_key: "final_package".to_string(),
                        condition: Some("specification.exists".to_string()),
                        r#loop: None,
                    }],
                    requires_approval: true,
                    approval_prompt: Some("专利申请文件已通过审核，是否确认提交？".to_string()),
                    quality_check: Some(QualityCheckConfig {
                        dimensions: vec![
                            "保护范围合理性".to_string(),
                            "说明书支持性".to_string(),
                            "清楚性".to_string(),
                            "单一性".to_string(),
                            "新颖性预判".to_string(),
                            "创造性预判".to_string(),
                            "格式规范性".to_string(),
                        ],
                        threshold: 7.5,
                        max_auto_retries: 2,
                        escalate_to_human: true,
                    }),
                    condition: Some("specification.exists".to_string()),
                },
            ],
            quality_dimensions: vec![
                QualityDimension {
                    name: "保护范围合理性".to_string(),
                    description: "权利要求的保护范围是否合理，不过宽也不过窄".to_string(),
                    weight: 0.20,
                },
                QualityDimension {
                    name: "说明书支持性".to_string(),
                    description: "权利要求是否得到说明书的充分支持".to_string(),
                    weight: 0.15,
                },
                QualityDimension {
                    name: "清楚性".to_string(),
                    description: "权利要求和说明书是否清楚、完整".to_string(),
                    weight: 0.15,
                },
                QualityDimension {
                    name: "单一性".to_string(),
                    description: "专利申请是否符合单一性要求".to_string(),
                    weight: 0.10,
                },
                QualityDimension {
                    name: "新颖性预判".to_string(),
                    description: "基于现有技术检索的新颖性评估".to_string(),
                    weight: 0.15,
                },
                QualityDimension {
                    name: "创造性预判".to_string(),
                    description: "基于现有技术检索的创造性评估".to_string(),
                    weight: 0.15,
                },
                QualityDimension {
                    name: "格式规范性".to_string(),
                    description: "文件格式是否符合国知局要求".to_string(),
                    weight: 0.10,
                },
            ],
        }
    }
}

// --- Template-based content generation (fallback) ---

struct ReviewReport {
    overall_score: f32,
    dimensions: Vec<ReviewDimensionScore>,
}

struct ReviewDimensionScore {
    #[expect(dead_code)]
    name: String,
    score: f32,
}

fn generate_parse_disclosure_content(topic: &str, case_id: Option<&str>) -> String {
    let case_info = case_id.map(|id| format!("\n关联案件: {}", id)).unwrap_or_default();
    format!(
        "# 技术交底书解析\n\n\
         主题: {}\n{}\n\n\
         ## 解析结果\n\n\
         ### 发明基本信息\n\
         - 技术领域: 人工智能 / 自然语言处理\n\
         - 发明类型: 方法 + 系统\n\n\
         ### 结构化发明内容\n\n\
         1. **技术问题**\n\
            - 现有技术中存在的问题\n\
            - 本发明要解决的核心问题\n\n\
         2. **技术方案**\n\
            - 核心技术特征A\n\
            - 核心技术特征B\n\
            - 核心技术特征C\n\n\
         3. **有益效果**\n\
            - 效果1: 提高效率\n\
            - 效果2: 降低成本\n\
            - 效果3: 提升准确性\n\n\
         4. **实施方式**\n\
            - 具体实施例1\n\
            - 具体实施例2\n\n\
         *注：Phase 1 模板输出，生产环境将通过 MCP 调用 DisclosureParser。*",
        topic, case_info
    )
}

fn generate_parsed_disclosure_json(topic: &str) -> String {
    serde_json::json!({
        "disclosure_type": "technical_disclosure",
        "topic": topic,
        "invention": {
            "technical_field": "人工智能 / 自然语言处理",
            "invention_type": "method_and_system",
            "technical_problem": "现有技术存在的问题",
            "technical_solution": {
                "core_features": ["特征A", "特征B", "特征C"],
                "advantages": ["提高效率", "降低成本", "提升准确性"]
            },
            "embodiments": [
                {"id": 1, "description": "具体实施例1"},
                {"id": 2, "description": "具体实施例2"}
            ]
        },
        "stage": "template_phase1"
    })
    .to_string()
}

fn generate_prior_art_search_content(topic: &str) -> String {
    format!(
        "# 现有技术检索报告\n\n\
         主题: {}\n\n\
         ## 检索策略\n\n\
         ### IPC/CPC 分类号\n\
         - G06F 16/35 — 信息检索；数据库结构\n\
         - G06N 3/08 — 神经网络学习\n\
         - G06F 40/30 — 自然语言处理\n\n\
         ### 关键词组合\n\
         1. (AI OR artificial intelligence) AND (patent OR intellectual property)\n\
         2. (natural language processing) AND (semantic search)\n\
         3. (deep learning) AND (document analysis)\n\n\
         ### 检索数据库\n\
         - 中国专利全文数据库\n\
         - PCT国际专利申请\n\
         - 非专利文献（IEEE, ACM）\n\n\
         ## 检索结果\n\n\
         | 序号 | 公开号 | 标题 | 相关性 | 技术特征覆盖 |\n\
         |------|--------|------|--------|-------------|\n\
         | 1 | CNXXXXXXA | XXX方法 | 高 | A, B |\n\
         | 2 | CNYYYYYYA | YYY系统 | 中 | A, C |\n\
         | 3 | WOZZZZZZA | ZZZ装置 | 中 | B |\n\n\
         ## 结论\n\n\
         - 特征A: 已被CNXXXXXXA和CNYYYYYYA公开\n\
         - 特征B: 已被CNXXXXXXA公开\n\
         - 特征C: 未被现有技术公开（**区别特征**）\n\n\
         *注：Phase 1 模板输出，生产环境将通过 MCP 调用 PatentSearcher。*",
        topic
    )
}

fn generate_search_strategy(topic: &str) -> String {
    format!(
        "# 检索策略报告\n\n\
         案件: {}\n\n\
         ## 分类号\n\n\
         - G06F 16/35\n\
         - G06N 3/08\n\
         - G06F 40/30\n\n\
         ## 关键词\n\n\
         1. (AI OR artificial intelligence) AND (patent)\n\
         2. (natural language processing) AND (semantic)\n\
         3. (deep learning) AND (document)\n\n\
         ## 数据库\n\n\
         - 中国专利\n\
         - PCT\n\
         - IEEE/ACM",
        topic
    )
}

fn generate_prior_art_list() -> String {
    serde_json::json!({
        "prior_art": [
            {"no": 1, "publication_no": "CNXXXXXXA", "title": "XXX方法", "relevance": "高", "features": ["A", "B"]},
            {"no": 2, "publication_no": "CNYYYYYYA", "title": "YYY系统", "relevance": "中", "features": ["A", "C"]},
            {"no": 3, "publication_no": "WOZZZZZZA", "title": "ZZZ装置", "relevance": "中", "features": ["B"]}
        ],
        "key_distinction": "特征C未被现有技术公开",
        "strategy": "围绕特征C构建独立权利要求"
    })
    .to_string()
}

fn format_patent_results(results: &crate::tools::PatentSearchResult) -> String {
    let mut lines = vec![
        "# 在线专利检索结果".to_string(),
        format!(
            "检索到 {} 条相关专利（共 {} 条）\n",
            results.patents.len(),
            results.total
        ),
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
        if let Some(ref ipc) = patent.ipc_codes {
            lines.push(format!("- **IPC**: {}", ipc.join(", ")));
        }
        lines.push("\n".to_string());
    }

    lines.join("\n")
}

fn generate_claim_layout_content(topic: &str) -> String {
    format!(
        "# 权利要求布局方案\n\n\
         主题: {}\n\n\
         ## 独立权利要求设计\n\n\
         ### 权利要求1（方法）\n\n\
         **必要技术特征**: A + B + C\n\n\
         - 特征A: 基础步骤（现有技术）\n\
         - 特征B: 改进步骤（现有技术）\n\
         - 特征C: **区别特征**（本发明核心）\n\n\
         **上位概念**: 一种基于特征C的数据处理方法\n\n\
         ## 从属权利要求层次\n\n\
         ```\n\
         权利要求1 (独立 - 方法)\n\
         ├── 权利要求2 (从属1 - 具体化特征C)\n\
         │   ├── 权利要求3 (从属2 - 特征C的优选实施方式)\n\
         │   └── 权利要求4 (从属2 - 特征C的替代实施方式)\n\
         ├── 权利要求5 (从属1 - 特征A的具体实现)\n\
         └── 权利要求6 (从属1 - 特征B的具体实现)\n\n\
         权利要求7 (独立 - 系统)\n\
         ├── 权利要求8 (从属1 - 系统特征C)\n\
         └── 权利要求9 (从属1 - 系统硬件配置)\n\n\
         权利要求10 (独立 - 存储介质)\n\
         ```\n\n\
         ## 布局说明\n\n\
         1. 独立权利要求1覆盖方法主题，以特征C为核心\n\
         2. 从属权利要求2-6逐层细化\n\
         3. 独立权利要求7覆盖系统主题，形成产品保护\n\
         4. 独立权利要求10覆盖存储介质，形成多层次保护\n\n\
         *注：Phase 1 模板输出，生产环境将通过 MCP 调用 ClaimDesigner。*",
        topic
    )
}

fn generate_claim_draft(topic: &str) -> String {
    format!(
        "# 权利要求书草案\n\n\
         案件: {}\n\n\
         **1.** 一种数据处理方法，其特征在于，包括以下步骤：\n\
         a) 步骤A；\n\
         b) 步骤B；\n\
         c) **步骤C，其中C满足条件XXX。**\n\n\
         **2.** 根据权利要求1所述的方法，其特征在于，步骤c还包括：...\n\n\
         **3.** 根据权利要求2所述的方法，其特征在于，...\n\n\
         **7.** 一种数据处理系统，其特征在于，包括：...\n\n\
         **10.** 一种计算机可读存储介质，...\n\n\
         *（共10项权利要求）*",
        topic
    )
}

fn generate_claim_hierarchy() -> String {
    "# 权利要求层次图\n\n\
     ```\n\
     权利要求1 (方法)\n\
     ├── 权利要求2 (特征C细化)\n\
     │   ├── 权利要求3 (优选实施)\n\
     │   └── 权利要求4 (替代实施)\n\
     ├── 权利要求5 (特征A细化)\n\
     └── 权利要求6 (特征B细化)\n\n\
     权利要求7 (系统)\n\
     ├── 权利要求8 (系统特征C)\n\
     └── 权利要求9 (硬件配置)\n\n\
     权利要求10 (存储介质)\n\
     ```"
    .to_string()
}

fn generate_specification_content(topic: &str) -> String {
    format!(
        "# 说明书撰写\n\n\
         主题: {}\n\n\
         已完成以下文档的撰写：\n\n\
         1. **技术领域** — 明确了发明所属技术领域\n\
         2. **背景技术** — 描述了现有技术及其不足\n\
         3. **发明内容** — 阐述了技术问题、技术方案和有益效果\n\
         4. **附图说明** — 描述了各附图的内容\n\
         5. **具体实施方式** — 详细描述了2个实施例\n\n\
         *注：Phase 1 模板输出，生产环境将通过 MCP 调用 SpecDrafter。*",
        topic
    )
}

fn generate_full_specification(topic: &str) -> String {
    format!(
        "# 专利说明书\n\n\
         案件: {}\n\n\
         ## 技术领域\n\n\
         本发明涉及人工智能领域，特别涉及一种基于深度学习的数据处理方法。\n\n\
         ## 背景技术\n\n\
         现有技术中，...（背景技术描述）\n\n\
         ## 发明内容\n\n\
         ### 技术问题\n\n\
         本发明要解决的技术问题是...\n\n\
         ### 技术方案\n\n\
         为解决上述技术问题，本发明提供一种数据处理方法，包括以下步骤：...\n\n\
         ### 有益效果\n\n\
         与现有技术相比，本发明具有以下有益效果：...\n\n\
         ## 附图说明\n\n\
         图1是本发明的系统架构图；\n\
         图2是本发明的方法流程图；\n\
         图3是本发明的实施例示意图。\n\n\
         ## 具体实施方式\n\n\
         ### 实施例1\n\n\
         [详细描述实施例1]\n\n\
         ### 实施例2\n\n\
         [详细描述实施例2]\n\n\
         ---\n\n\
         *注：Phase 1 模板输出。*",
        topic
    )
}

fn generate_abstract(topic: &str) -> String {
    format!(
        "# 摘要\n\n\
         案件: {}\n\n\
         本发明公开了一种基于深度学习的数据处理方法，属于人工智能领域。该方法包括步骤A、步骤B和步骤C，其中步骤C是本发明的核心创新点。与现有技术相比，本发明能够显著提高数据处理效率和准确性。",
        topic
    )
}

fn generate_review_report() -> ReviewReport {
    ReviewReport {
        overall_score: 8.3,
        dimensions: vec![
            ReviewDimensionScore {
                name: "保护范围合理性".to_string(),
                score: 8.5,
            },
            ReviewDimensionScore {
                name: "说明书支持性".to_string(),
                score: 8.2,
            },
            ReviewDimensionScore {
                name: "清楚性".to_string(),
                score: 8.4,
            },
            ReviewDimensionScore {
                name: "单一性".to_string(),
                score: 8.0,
            },
            ReviewDimensionScore {
                name: "新颖性预判".to_string(),
                score: 8.1,
            },
            ReviewDimensionScore {
                name: "创造性预判".to_string(),
                score: 8.3,
            },
            ReviewDimensionScore {
                name: "格式规范性".to_string(),
                score: 7.9,
            },
        ],
    }
}

fn pass_mark(score: f32) -> &'static str {
    crate::helpers::pass_mark(score, 7.5)
}

fn generate_patent_package(topic: &str) -> String {
    format!(
        "# 完整专利申请包\n\n\
         案件: {}\n\
         状态: 已通过审核\n\n\
         ## 包含文件\n\n\
         1. 权利要求书 (10项)\n\
         2. 说明书\n\
         3. 摘要\n\
         4. 附图说明\n\
         5. 检索策略报告\n\
         6. 审核报告\n\n\
         ## 质量评分\n\n\
         综合评分: 8.3/10.0 (合格，≥7.5阈值)\n\n\
         ---\n\
         *Phase 1 模板生成，生产环境将通过 MCP 调用 PatentPackageBuilder。*",
        topic
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::agent::OrchestrationAgent;

    #[test]
    fn test_drafting_agent_metadata() {
        let agent = DraftingAgent::new();
        assert_eq!(agent.id().0, "drafting");
        assert_eq!(agent.name(), "专利撰写智能体");
        assert!(!agent.capabilities().is_empty());
        assert_eq!(agent.stages().len(), 5);
    }

    #[test]
    fn test_can_handle_drafting_intent() {
        let agent = DraftingAgent::new();
        let intent = UserIntent {
            raw_input: "撰写专利申请".to_string(),
            parsed_topic: None,
            parsed_scope: None,
            parsed_depth: None,
        };
        let conf = agent.can_handle(&intent);
        assert!(
            conf > 0.6,
            "Expected high confidence for drafting intent, got {}",
            conf
        );
    }

    #[test]
    fn test_can_handle_drafting_english() {
        let agent = DraftingAgent::new();
        let intent = UserIntent {
            raw_input: "draft patent claims".to_string(),
            parsed_topic: None,
            parsed_scope: None,
            parsed_depth: None,
        };
        let conf = agent.can_handle(&intent);
        assert!(
            conf > 0.0,
            "Expected non-zero confidence for drafting English intent"
        );
    }

    #[test]
    fn test_can_handle_non_drafting() {
        let agent = DraftingAgent::new();
        let intent = UserIntent {
            raw_input: "今天天气怎么样".to_string(),
            parsed_topic: None,
            parsed_scope: None,
            parsed_depth: None,
        };
        let conf = agent.can_handle(&intent);
        assert_eq!(
            conf, 0.0,
            "Expected zero confidence for non-drafting intent"
        );
    }

    #[tokio::test]
    async fn test_execute_returns_five_stages() {
        let mut agent = DraftingAgent::new();
        agent.initialize().await.unwrap();

        let input = AgentInput {
            intent: UserIntent {
                raw_input: "撰写专利申请".to_string(),
                parsed_topic: Some("专利撰写".to_string()),
                parsed_scope: None,
                parsed_depth: None,
            },
            extra: serde_json::Value::Null,
        };

        use futures_util::StreamExt;
        let stages: Vec<StageOutput> = agent.execute(input).collect().await;

        assert_eq!(stages.len(), 5);
        assert_eq!(stages[0].stage_id, "parse_disclosure");
        assert_eq!(stages[1].stage_id, "prior_art_search");
        assert_eq!(stages[2].stage_id, "claim_layout");
        assert_eq!(stages[3].stage_id, "draft_specification");
        assert_eq!(stages[4].stage_id, "review_optimize");

        // Verify approval gates at steps 2, 3, 5.
        assert!(!stages[0].requires_approval);
        assert!(stages[1].requires_approval);
        assert!(stages[2].requires_approval);
        assert!(!stages[3].requires_approval);
        assert!(stages[4].requires_approval);

        // Verify artifacts.
        assert_eq!(stages[0].artifacts.len(), 1);
        assert_eq!(stages[1].artifacts.len(), 2);
        assert_eq!(stages[2].artifacts.len(), 2);
        assert_eq!(stages[3].artifacts.len(), 2);
        assert_eq!(stages[4].artifacts.len(), 1);
    }

    #[test]
    fn test_flow_definition() {
        let agent = DraftingAgent::new();
        let flow = agent.flow_definition();

        assert_eq!(flow.flow_id, "patent_drafting");
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
        let mut agent = DraftingAgent::new();
        let input = AgentInput {
            intent: UserIntent {
                raw_input: "专利撰写".to_string(),
                parsed_topic: None,
                parsed_scope: None,
                parsed_depth: None,
            },
            extra: serde_json::json!({"case_id": "case-5678"}),
        };

        // Verify input construction doesn't panic.
        let _stream = agent.execute(input);
    }
}
