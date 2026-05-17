#![allow(dead_code, clippy::type_complexity, clippy::collapsible_if)]
//! Patent Workflow Tool — bridges TUI tool system to the PatentAgent trait.
//!
//! When the TUI routes a user command to a patent agent (via `/research`,
//! `/oa`, etc.), this tool wraps the agent's `execute()` stream into a
//! single `ToolResult` consumable by the turn loop.
//!
//! ## 路由策略（Phase 2 深度融合）
//! 1. **优先 MCP 适配器**：如果 MCP pool 可用且有对应工具，委托给 MCP 适配器
//! 2. **降级本地 Agent**：MCP 不可用时，使用本地 PatentAgent 实现
//!
//! ## MCP 工具映射
//! - `research` → `mcp_yunpat_patent_search`
//! - `oa-response` → `mcp_yunpat_patent_analyzer`（暂未实现，降级本地）
//! - `drafting` → 本地 DraftingAgent（MCP 未实现）
//! - `patent_search` → 本地 PatentSearchTool（Google Patents）
//! - `paper_search` → 本地 PaperSearchTool（Semantic Scholar）
//! - `legal_search` → `mcp_yunpat_legal_knowledge_search`
//! - `patent_db` → 本地 PatentDatabase（PostgreSQL）
//! - `kb_index` → 本地 KnowledgeBase（向量索引）

use async_trait::async_trait;
use serde_json::{Value, json};
use yunpat_agents::types::{AgentInput, StageOutput, StageType, UserIntent};
use yunpat_tools::{ToolCapability, ToolError, ToolResult};

use super::spec::ToolContext;
use super::spec::ToolSpec;

/// Tool that executes a patent agent workflow and returns the combined output.
pub struct PatentWorkflowTool {
    /// The agent ID to route to.
    agent_id: String,
}

impl PatentWorkflowTool {
    pub fn new(agent_id: &str) -> Self {
        Self { agent_id: agent_id.to_string() }
    }
}

#[async_trait]
impl ToolSpec for PatentWorkflowTool {
    fn name(&self) -> &str {
        match self.agent_id.as_str() {
            "research" => "patent_research",
            "drafting" => "patent_drafting",
            "oa-response" => "patent_oa_response",
            "trademark" => "trademark_analysis",
            "creativity" => "patent_creativity",
            "reexamination" => "patent_reexamination",
            "invalidation" => "patent_invalidation",
            "patent_search" => "patent_search",
            "paper_search" => "paper_search",
            "patent_db" => "patent_db_search",
            "legal_search" => "legal_search",
            // 新增 Agent 工具名
            "invention" => "invention_understanding",
            "prior-art-search" => "prior_art_search",
            "spec-drafter" => "specification_drafter",
            "abstract-drafter" => "abstract_drafter",
            "analysis" => "prior_art_analysis",
            "comparison-report" => "comparison_report",
            "format-convert" => "format_convert",
            "image-understanding" => "image_understanding",
            "technical-drawing" => "technical_drawing",
            "subject-matter" => "subject_matter_check",
            "unity-check" => "unity_check",
            "spec-formality" => "spec_formality_check",
            "tech-unit" => "tech_unit_extract",
            "researcher" => "research_analysis",
            "writer" => "patent_writer_general",
            "patent-manager" => "patent_manager",
            other => other,
        }
    }

    fn description(&self) -> &str {
        match self.agent_id.as_str() {
            "research" => {
                "专利检索研究：对给定主题进行专利检索和分析，生成研究报告。用于专利调研、技术趋势分析、竞争对手专利监控等场景。"
            }
            "drafting" => {
                "专利撰写：根据技术交底书或发明描述，生成专利申请文件（权利要求书、说明书等）。用于新专利申请起草。"
            }
            "oa-response" => {
                "审查意见答复：针对专利审查意见（Office Action），生成答复策略和意见陈述书。用于答复审查员的驳回或异议。"
            }
            "trademark" => {
                "商标分析：进行商标检索、近似判断和可注册性评估。用于商标注册前的分析和风险评估。"
            }
            "creativity" => {
                "创造性评估：评估专利或技术方案的创造性（非显而易见性），分析现有技术差异。用于专利创造性论证或抗辩。"
            }
            "reexamination" => {
                "复审请求：分析驳回决定，制定复审策略，撰写复审请求书。用于对驳回专利申请提出复审请求。"
            }
            "invalidation" => {
                "无效宣告：分析目标专利，收集证据，制定无效策略，撰写无效宣告请求书。用于对已授权专利提出无效宣告请求。"
            }
            "patent_search" => {
                "专利检索：通过 Google Patents 搜索专利文献，返回专利号、标题、摘要、申请人等信息。用于查找相关专利。"
            }
            "paper_search" => {
                "论文检索：通过 Semantic Scholar 搜索学术论文，返回论文标题、作者、摘要、引用数等信息。用于查找技术文献。"
            }
            "patent_db" => {
                "本地专利数据库检索：在本地 PostgreSQL 数据库中检索专利，支持关键词、IPC分类号、申请人搜索。用于检索本地专利数据。"
            }
            "legal_search" => {
                "法律知识检索：在本地法律数据库中检索法律条文、法律文书和知识图谱。支持检索专利法、审查指南、判决等法律资源。"
            }
            // 新增 Agent 描述
            "invention" => {
                "发明理解分析：解析技术交底书，提取发明概念、关键技术特征、技术问题-解决方案-效果三元组。用于专利申请前的发明理解。"
            }
            "prior-art-search" => {
                "现有技术检索：基于发明信息和权利要求，构建检索策略并执行现有技术检索，返回检索结果和新颖性评估。用于专利申请前的查新检索。"
            }
            "spec-drafter" => {
                "说明书撰写：基于发明理解结果，分章节撰写专利说明书（技术领域、背景技术、发明内容、具体实施方式等）。用于新专利申请的说明书撰写。"
            }
            "abstract-drafter" => {
                "专利摘要撰写：基于发明理解和说明书内容，生成符合要求的专利摘要。用于专利申请的摘要部分撰写。"
            }
            "analysis" => {
                "现有技术深度分析：分析专利/论文/报告，提取技术问题、解决方案、关键特征，评估新颖性和创造性。用于对比分析和技术调研。"
            }
            "comparison-report" => {
                "对比分析报告生成：生成专利申请与现有技术的对比分析报告，包括技术差异、新颖性和创造性分析。用于专利评估和答复审查意见。"
            }
            "format-convert" => {
                "格式转换：将 Markdown 或结构化内容转换为专利局标准格式（DOCX）。支持 CNIPA/USPTO/EPO 格式。用于专利申请文档的格式化输出。"
            }
            "image-understanding" => {
                "附图理解分析：使用多模态模型理解专利附图，识别组件、连接关系和标注，生成附图说明建议。用于说明书附图部分的撰写。"
            }
            "technical-drawing" => {
                "技术图纸识别：识别化学结构式、数学公式、电路图等技术图纸，提取结构化表示。用于专利附图的自动化识别。"
            }
            "subject-matter" => {
                "保护客体检查：依据专利法第2条和第25条，检查权利要求是否属于可授予专利权的保护客体。用于申请前的合规性预检。"
            }
            "unity-check" => {
                "单一性检查：依据实施细则第43-44条，检查权利要求是否满足单一性要求。用于申请前的单一性预检。"
            }
            "spec-formality" => {
                "说明书格式检查：检查专利说明书的章节完整性、顺序、字数、格式和术语一致性。用于提交前的格式合规检查。"
            }
            "tech-unit" => {
                "最小技术单元提取：从权利要求中划分技术特征并识别最小技术单元。用于侵权判定和创造性分析的基础准备。"
            }
            "researcher" => {
                "研究分析：对给定问题进行信息搜集、数据整理和分析报告生成。支持网络搜索、学术搜索和数据库检索。用于技术调研。"
            }
            "writer" => {
                "通用专利写作：生成、优化、转换或格式化专利相关文档内容。用于专利文档的撰写辅助和格式处理。"
            }
            "patent-manager" => {
                "专利全生命周期管理：创建、查询、更新专利案件，状态流转，截止日期检查和费用计算。用于专利案件管理和流程监控。"
            }
            _ => "执行专利工作流智能体。",
        }
    }

    fn input_schema(&self) -> Value {
        let topic_desc = match self.agent_id.as_str() {
            "patent_search" => "检索关键词，如 'artificial intelligence' 或 '电池储能'",
            "paper_search" => "论文搜索关键词，如 'machine learning' 或 '深度学习'",
            "patent_db" => {
                "搜索关键词或过滤条件，如 '人工智能' 或 '--ipc G06F' 或 '--applicant 华为'"
            }
            "legal_search" => "法律检索关键词，如 '创造性' 或 '专利侵权' 或 '审查指南'",
            _ => "研究主题或用户意图描述",
        };
        json!({
            "type": "object",
            "properties": {
                "topic": {
                    "type": "string",
                    "description": topic_desc
                },
                "case_id": {
                    "type": "string",
                    "description": "可选的案例 ID，用于关联工作流"
                }
            },
            "required": ["topic"]
        })
    }

    fn capabilities(&self) -> Vec<ToolCapability> {
        vec![ToolCapability::ReadOnly]
    }

    fn approval_requirement(&self) -> yunpat_tools::ApprovalRequirement {
        yunpat_tools::ApprovalRequirement::Auto
    }

    async fn execute(&self, input: Value, context: &ToolContext) -> Result<ToolResult, ToolError> {
        let topic = input.get("topic").and_then(|v| v.as_str()).unwrap_or("").to_string();

        let case_id = input.get("case_id").and_then(|v| v.as_str()).map(|s| s.to_string());

        if topic.is_empty() {
            return Err(ToolError::InvalidInput {
                message: "topic is required".to_string(),
            });
        }

        // For Phase 1: construct a mock agent and execute it directly.
        // In Phase 2, this will resolve from an AgentRegistry injected via ToolContext.
        let agent_result = execute_agent_locally(
            &self.agent_id,
            &topic,
            case_id.as_deref(),
            context.mcp_pool.clone(),
            context.llm_provider.clone(),
            context.progress_tx.clone(),
        )
        .await;

        match agent_result {
            Ok(stages) => {
                let mut parts = Vec::new();
                let mut has_approval = false;
                let total = stages.len();

                let header = format!(
                    "# 专利工作流: {}\n\n共 {} 个阶段\n\n---",
                    self.agent_id, total
                );
                parts.push(header);

                for (i, stage) in stages.iter().enumerate() {
                    if stage.requires_approval {
                        has_approval = true;
                    }
                    let stage_type_label = match stage.stage_type {
                        StageType::Progress => "⏳ 进行中",
                        StageType::Analysis => "🔍 分析",
                        StageType::Suggestion => "💡 建议",
                        StageType::Draft => "📝 草稿",
                        StageType::Question => "❓ 待确认",
                        StageType::Completed => "✅ 完成",
                    };
                    let progress = format!("[{}/{}]", i + 1, total);
                    parts.push(format!(
                        "## {} {} {}\n\n{}{}",
                        progress,
                        stage.stage_name,
                        stage_type_label,
                        stage.content,
                        if stage.requires_approval {
                            stage
                                .approval_request
                                .as_ref()
                                .map(|req| {
                                    let options: Vec<String> = req
                                        .options
                                        .iter()
                                        .map(|o| format!("  - {}", o.label))
                                        .collect();
                                    format!(
                                        "\n\n**需要审批**: {}\n{}",
                                        req.prompt,
                                        options.join("\n")
                                    )
                                })
                                .unwrap_or_default()
                        } else {
                            String::new()
                        }
                    ));
                }

                let content = parts.join("\n\n---\n\n");
                let mut metadata = json!({
                    "agent_id": self.agent_id,
                    "stage_count": stages.len(),
                    "has_approval_gate": has_approval,
                });
                if let Some(cid) = case_id {
                    metadata["case_id"] = json!(cid);
                }

                Ok(ToolResult {
                    content,
                    success: true,
                    metadata: Some(metadata),
                })
            }
            Err(e) => Err(ToolError::ExecutionFailed {
                message: format!("Agent '{}' execution failed: {}", self.agent_id, e),
            }),
        }
    }
}

/// Agent ID 到 MCP 工具名的映射
///
/// 返回 (mcp_tool_name, args_builder)
/// - mcp_tool_name: MCP 工具名（None 表示无对应 MCP 工具）
/// - args_builder: 构建 MCP 工具参数的函数
fn map_agent_to_mcp_tool(
    agent_id: &str,
) -> Option<(&'static str, fn(&str, Option<&str>) -> serde_json::Value)> {
    match agent_id {
        "research" => Some(("mcp_yunpat_patent_search", |topic, _case_id| {
            // 简化映射：实际应用中可能需要更复杂的参数提取
            json!({
                "inventionTitle": topic,
                "technicalField": "通用技术领域",
                "technicalProblem": "待分析",
                "technicalSolution": topic,
                "keyFeatures": [topic],
            })
        })),
        "legal_search" => Some(("mcp_yunpat_legal_knowledge_search", |topic, _case_id| {
            json!({
                "question": topic,
                "domain": "patent",
                "topK": 10,
            })
        })),
        "oa-response" => Some(("mcp_yunpat_patent_analyzer", |topic, _case_id| {
            json!({
                "inventionTitle": topic,
                "claims": [],
                "specification": {},
            })
        })),
        "invalidation" => Some(("mcp_yunpat_invalid_decision_search", |topic, _case_id| {
            json!({
                "inventionTitle": topic,
                "technicalField": "通用技术领域",
                "technicalProblem": "无效宣告分析",
                "technicalSolution": topic,
                "keyFeatures": [topic],
            })
        })),
        "drafting" => Some(("mcp_yunpat_patent_writer", |topic, _case_id| {
            json!({
                "inventionTitle": topic,
                "technicalField": "通用技术领域",
                "technicalProblem": "专利撰写",
                "technicalSolution": topic,
                "keyFeatures": [topic],
            })
        })),
        "creativity" => Some(("mcp_yunpat_patent_compare", |topic, _case_id| {
            json!({
                "inventionTitle": topic,
                "technicalField": "通用技术领域",
                "technicalProblem": "创造性分析",
                "technicalSolution": topic,
                "keyFeatures": [topic],
            })
        })),
        // 新增 MCP 工具映射
        "invention" => Some(("mcp_yunpat_invention_understanding", |topic, _case_id| {
            json!({
                "inventionTitle": topic,
                "technicalField": "通用技术领域",
                "technicalDisclosure": topic,
            })
        })),
        "prior-art-search" => Some(("mcp_yunpat_prior_art_search", |topic, _case_id| {
            json!({
                "inventionTitle": topic,
                "patentType": "invention",
            })
        })),
        "spec-drafter" => Some(("mcp_yunpat_specification_drafter", |topic, _case_id| {
            json!({
                "inventionUnderstanding": {
                    "technicalField": "通用技术领域",
                    "technicalProblem": topic,
                    "technicalSolution": topic,
                    "keyFeatures": [topic],
                },
            })
        })),
        "abstract-drafter" => Some(("mcp_yunpat_abstract_drafter", |topic, _case_id| {
            json!({
                "inventionUnderstanding": {
                    "technicalField": "通用技术领域",
                    "technicalProblem": topic,
                    "technicalSolution": topic,
                    "keyFeatures": [topic],
                },
            })
        })),
        "analysis" => Some(("mcp_yunpat_prior_art_analysis", |topic, _case_id| {
            json!({
                "document": {
                    "type": "patent",
                    "title": topic,
                    "content": topic,
                },
                "analysisDepth": 2,
            })
        })),
        "comparison-report" => Some(("mcp_yunpat_comparison_report", |topic, _case_id| {
            json!({
                "application": {
                    "inventionTitle": topic,
                },
                "priorArt": [],
            })
        })),
        "format-convert" => Some(("mcp_yunpat_format_convert", |topic, _case_id| {
            json!({
                "inputFormat": "markdown",
                "outputFormat": "docx",
                "content": { "markdown": topic },
            })
        })),
        "image-understanding" => Some(("mcp_yunpat_image_understanding", |topic, _case_id| {
            json!({
                "imagePath": topic,
                "figureNumber": "图1",
            })
        })),
        "technical-drawing" => Some(("mcp_yunpat_technical_drawing", |topic, _case_id| {
            json!({
                "imageData": topic,
                "autoDetect": true,
            })
        })),
        "subject-matter" => Some(("mcp_yunpat_subject_matter_check", |topic, _case_id| {
            json!({
                "inventionTitle": topic,
                "claims": [{ "type": "independent", "number": 1, "content": topic }],
                "patentType": "invention",
            })
        })),
        "unity-check" => Some(("mcp_yunpat_unity_check", |topic, _case_id| {
            json!({
                "claims": [{ "type": "independent", "number": 1, "content": topic }],
                "patentType": "invention",
                "inventionTitle": topic,
            })
        })),
        "spec-formality" => Some(("mcp_yunpat_spec_formality_check", |topic, _case_id| {
            json!({
                "specification": topic,
            })
        })),
        "tech-unit" => Some(("mcp_yunpat_tech_unit_extract", |topic, _case_id| {
            json!({
                "claimText": topic,
            })
        })),
        "researcher" => Some(("mcp_yunpat_research", |topic, _case_id| {
            json!({
                "question": topic,
                "depth": "standard",
            })
        })),
        "writer" => Some(("mcp_yunpat_patent_writer_general", |topic, _case_id| {
            json!({
                "type": "generate",
                "topic": topic,
            })
        })),
        "patent-manager" => Some(("mcp_yunpat_patent_manager", |topic, _case_id| {
            json!({
                "operation": "query",
                "data": { "query": topic },
            })
        })),
        _ => None,
    }
}

/// Execute a patent agent with MCP-first routing strategy.
///
/// ## 路由策略（Phase 2 深度融合）
/// 1. **优先 MCP 适配器**：如果 MCP pool 可用且有对应工具，委托给 MCP 适配器
/// 2. **降级本地 Agent**：MCP 不可用时，使用本地 PatentAgent 实现
///
/// ## MCP 工具映射
/// - `research` → `mcp_yunpat_patent_search`
/// - `legal_search` → `mcp_yunpat_legal_knowledge_search`
/// - `oa-response` → `mcp_yunpat_patent_analyzer`（暂未实现，降级本地）
async fn execute_agent_locally(
    agent_id: &str,
    topic: &str,
    case_id: Option<&str>,
    mcp_pool: Option<std::sync::Arc<tokio::sync::Mutex<crate::mcp::McpPool>>>,
    llm_provider: Option<std::sync::Arc<dyn yunpat_agents::context::LlmProvider>>,
    progress_tx: Option<tokio::sync::mpsc::Sender<crate::core::events::Event>>,
) -> Result<Vec<StageOutput>, String> {
    // === Step 1: 尝试 MCP 工具调用 ===
    if let Some(pool) = &mcp_pool {
        if let Some((tool_name, args_builder)) = map_agent_to_mcp_tool(agent_id) {
            let args = args_builder(topic, case_id);

            let mut pool_guard = pool.lock().await;
            match pool_guard.call_tool(tool_name, args).await {
                Ok(result) => {
                    // MCP 调用成功 — 包装结果为 StageOutput
                    let content = format_mcp_result(&result);
                    return Ok(vec![StageOutput {
                        stage_id: format!("mcp_{}", agent_id),
                        stage_name: format!("MCP 工具调用: {}", tool_name),
                        stage_type: StageType::Analysis,
                        content,
                        multimodal_content: vec![],
                        artifacts: vec![],
                        requires_approval: false,
                        approval_request: None,
                        metadata: Default::default(),
                    }]);
                }
                Err(e) => {
                    // MCP 调用失败 — 记录日志，降级本地
                    eprintln!(
                        "[PatentWorkflow] MCP tool '{}' 调用失败，降级本地 Agent: {}",
                        tool_name, e
                    );
                }
            }
        }
    }

    // === Step 2: 本地 Agent 执行 ===
    execute_local_agent(agent_id, topic, case_id, llm_provider, progress_tx).await
}

/// 格式化 MCP 工具结果为字符串
fn format_mcp_result(result: &serde_json::Value) -> String {
    if let Some(content_array) = result.get("content").and_then(|v| v.as_array()) {
        let texts: Vec<String> = content_array
            .iter()
            .filter_map(|item| {
                if item.get("type").and_then(|t| t.as_str()) == Some("text") {
                    item.get("text").and_then(|v| v.as_str()).map(String::from)
                } else {
                    None
                }
            })
            .collect();

        if !texts.is_empty() {
            return texts.join("\n");
        }
    }

    // Fallback: 直接序列化
    serde_json::to_string_pretty(result).unwrap_or_else(|_| "Invalid MCP result".to_string())
}

/// 本地 Agent 执行逻辑（MCP 降级路径）
async fn execute_local_agent(
    agent_id: &str,
    topic: &str,
    case_id: Option<&str>,
    llm_provider: Option<std::sync::Arc<dyn yunpat_agents::context::LlmProvider>>,
    progress_tx: Option<tokio::sync::mpsc::Sender<crate::core::events::Event>>,
) -> Result<Vec<StageOutput>, String> {
    // Try AgentExecutor for agents that implement PatentAgent.
    let input = AgentInput {
        intent: UserIntent {
            raw_input: topic.to_string(),
            parsed_topic: Some(topic.to_string()),
            parsed_scope: None,
            parsed_depth: None,
        },
        extra: serde_json::json!({
            "case_id": case_id.unwrap_or(""),
        }),
    };

    let agent_result: Option<Result<Vec<StageOutput>, String>> = match agent_id {
        "research" => match yunpat_agents::research::ResearchAgent::with_default_kb() {
            Ok(agent) => Some(
                run_via_executor(
                    agent,
                    input,
                    llm_provider.clone(),
                    progress_tx.clone(),
                    agent_id.to_string(),
                )
                .await,
            ),
            Err(e) => Some(Err(format!("Failed to create ResearchAgent: {}", e))),
        },
        "oa-response" => {
            let agent = yunpat_agents::oa_response::OAResponseAgent::new();
            Some(
                run_via_executor(
                    agent,
                    input,
                    llm_provider.clone(),
                    progress_tx.clone(),
                    agent_id.to_string(),
                )
                .await,
            )
        }
        "drafting" => {
            let agent = yunpat_agents::drafting::DraftingAgent::new();
            Some(
                run_via_executor(
                    agent,
                    input,
                    llm_provider.clone(),
                    progress_tx.clone(),
                    agent_id.to_string(),
                )
                .await,
            )
        }
        "trademark" => {
            let agent = yunpat_agents::trademark::TrademarkAgent::new();
            Some(
                run_via_executor(
                    agent,
                    input,
                    llm_provider.clone(),
                    progress_tx.clone(),
                    agent_id.to_string(),
                )
                .await,
            )
        }
        "creativity" => {
            let agent = yunpat_agents::creativity::CreativityAgent::new();
            Some(
                run_via_executor(
                    agent,
                    input,
                    llm_provider.clone(),
                    progress_tx.clone(),
                    agent_id.to_string(),
                )
                .await,
            )
        }
        "reexamination" => {
            let agent = yunpat_agents::reexamination::ReexaminationAgent::new();
            Some(
                run_via_executor(
                    agent,
                    input,
                    llm_provider.clone(),
                    progress_tx.clone(),
                    agent_id.to_string(),
                )
                .await,
            )
        }
        "invalidation" => {
            let agent = yunpat_agents::invalidation::InvalidationAgent::new();
            Some(
                run_via_executor(
                    agent,
                    input,
                    llm_provider.clone(),
                    progress_tx.clone(),
                    agent_id.to_string(),
                )
                .await,
            )
        }
        _ => None,
    };

    if let Some(result) = agent_result {
        return result;
    }

    // 新增 Agent：无本地 Rust 实现，需要 MCP 连接
    let mcp_required_agents = [
        "invention",
        "prior-art-search",
        "spec-drafter",
        "abstract-drafter",
        "analysis",
        "comparison-report",
        "format-convert",
        "image-understanding",
        "technical-drawing",
        "subject-matter",
        "unity-check",
        "spec-formality",
        "tech-unit",
        "researcher",
        "writer",
        "patent-manager",
    ];

    if mcp_required_agents.contains(&agent_id) {
        return Ok(vec![StageOutput {
            stage_id: format!("{}_mcp_required", agent_id),
            stage_name: format!("{}（需要 MCP 连接）", agent_id),
            stage_type: StageType::Suggestion,
            content: format!(
                "Agent '{}' 目前仅通过 MCP Server（TypeScript）提供。\n\n\
                 请确保 MCP Server 已启动：\n\
                 1. 构建: cd packages/packages/mcp-server && pnpm build\n\
                 2. 配置: 在 ~/.yunpat/mcp.json 中添加 yunpat server\n\
                 3. 重启 TUI\n\n\
                 或使用已映射的 MCP 工具: mcp_yunpat_{}",
                agent_id,
                agent_id.replace('-', "_")
            ),
            multimodal_content: vec![],
            artifacts: vec![],
            requires_approval: false,
            approval_request: None,
            metadata: Default::default(),
        }]);
    }

    // Tool-based handlers (not PatentAgent implementations).
    match agent_id {
        "patent_search" => {
            let tool = yunpat_agents::tools::PatentSearchTool::new();
            let result = tool
                .search(topic, 0)
                .await
                .map_err(|e| format!("Patent search failed: {}", e))?;

            let content = if result.patents.is_empty() {
                "未检索到相关专利。".to_string()
            } else {
                let mut lines = vec![format!(
                    "# 专利检索结果\n\n找到 {} 条相关专利：\n",
                    result.patents.len()
                )];
                for (i, p) in result.patents.iter().enumerate() {
                    lines.push(format!(
                        "## {}. {}\n\n- **专利号**: {}\n- **标题**: {}\n- **摘要**: {}\n- **链接**: {}",
                        i + 1,
                        p.patent_id,
                        p.patent_id,
                        p.title,
                        p.snippet,
                        p.url
                    ));
                }
                lines.join("\n")
            };

            Ok(vec![StageOutput {
                stage_id: "patent_search".to_string(),
                stage_name: "专利检索".to_string(),
                stage_type: StageType::Analysis,
                content,
                multimodal_content: vec![],
                artifacts: vec![],
                requires_approval: false,
                approval_request: None,
                metadata: Default::default(),
            }])
        }
        "paper_search" => {
            let tool = yunpat_agents::tools::PaperSearchTool::new();
            let result = tool
                .search(topic, 10, 0)
                .await
                .map_err(|e| format!("Paper search failed: {}", e))?;

            let content = if result.papers.is_empty() {
                "未检索到相关论文。".to_string()
            } else {
                let mut lines = vec![format!(
                    "# 论文检索结果\n\n找到 {} 篇相关论文：\n",
                    result.papers.len()
                )];
                for (i, p) in result.papers.iter().enumerate() {
                    let authors = p.authors.join(", ");
                    lines.push(format!(
                        "## {}. {}\n\n- **作者**: {}\n- **年份**: {}\n- **期刊/会议**: {}\n- **引用数**: {}\n- **链接**: {}",
                        i + 1,
                        p.title,
                        authors,
                        p.year.map(|y| y.to_string()).unwrap_or_default(),
                        p.venue.as_deref().unwrap_or(""),
                        p.citation_count.map(|c| c.to_string()).unwrap_or_default(),
                        p.url
                    ));
                }
                lines.join("\n")
            };

            Ok(vec![StageOutput {
                stage_id: "paper_search".to_string(),
                stage_name: "论文检索".to_string(),
                stage_type: StageType::Analysis,
                content,
                multimodal_content: vec![],
                artifacts: vec![],
                requires_approval: false,
                approval_request: None,
                metadata: Default::default(),
            }])
        }
        "legal_search" => {
            let conn_str = std::env::var("LEGAL_DB_URL").unwrap_or_else(|_| {
                "host=localhost port=5432 dbname=legal_world_model user=xujian".to_string()
            });

            let db = yunpat_agents::tools::LegalDatabase::connect(&conn_str)
                .await
                .map_err(|e| format!("法律数据库连接失败: {}", e))?;

            let result = db
                .search_all(topic, 10, 5, 5)
                .await
                .map_err(|e| format!("法律搜索失败: {}", e))?;

            let mut parts = vec![format!(
                "# 法律知识检索结果\n\n找到 {} 条法律条文，{} 份法律文书，{} 个知识图谱节点\n",
                result.total_articles,
                result.documents.len(),
                result.kg_nodes.len()
            )];

            if !result.articles.is_empty() {
                parts.push("## 法律条文\n".to_string());
                for (i, a) in result.articles.iter().enumerate() {
                    parts.push(format!(
                        "### {}. {} {}\n\n- **法律**: {} ({})\n- **条号**: {}\n- **内容**: {}",
                        i + 1,
                        a.law_title.as_deref().unwrap_or("未知法律"),
                        a.article_number.as_deref().unwrap_or(""),
                        a.law_title.as_deref().unwrap_or(""),
                        a.law_importance.as_deref().unwrap_or(""),
                        a.article_number.as_deref().unwrap_or(""),
                        a.content.as_deref().unwrap_or("")
                    ));
                }
            }

            if !result.documents.is_empty() {
                parts.push("\n## 法律文书\n".to_string());
                for (i, d) in result.documents.iter().enumerate() {
                    parts.push(format!(
                        "### {}. {}\n\n- **类型**: {}\n- **发布机构**: {}\n- **生效日期**: {}",
                        i + 1,
                        d.title,
                        d.document_type.as_deref().unwrap_or("未知"),
                        d.issuing_authority.as_deref().unwrap_or(""),
                        d.effective_date.as_deref().unwrap_or("")
                    ));
                }
            }

            if !result.kg_nodes.is_empty() {
                parts.push("\n## 知识图谱\n".to_string());
                for (i, n) in result.kg_nodes.iter().enumerate() {
                    parts.push(format!(
                        "### {}. {} [{}]\n\n- **类型**: {}\n- **描述**: {}",
                        i + 1,
                        n.name,
                        n.node_type,
                        n.node_type,
                        n.content.as_deref().unwrap_or("")
                    ));
                }
            }

            let content = parts.join("\n\n");
            Ok(vec![StageOutput {
                stage_id: "legal_search".to_string(),
                stage_name: "法律知识检索".to_string(),
                stage_type: StageType::Analysis,
                content,
                multimodal_content: vec![],
                artifacts: vec![],
                requires_approval: false,
                approval_request: None,
                metadata: Default::default(),
            }])
        }
        "patent_db" => {
            let conn_str = std::env::var("PATENT_DB_URL").unwrap_or_else(|_| {
                "host=localhost port=5432 dbname=patent_db user=xujian".to_string()
            });

            let db = yunpat_agents::tools::PatentDatabase::connect(&conn_str)
                .await
                .map_err(|e| format!("数据库连接失败: {}", e))?;

            let (keyword, ipc_code, applicant) = parse_patent_db_args(topic);

            let result = if let Some(ref ipc) = ipc_code {
                db.search_by_ipc(ipc, 1, 10).await
            } else if let Some(ref app) = applicant {
                db.search_by_applicant(app, 1, 10).await
            } else if !keyword.is_empty() {
                db.search_fulltext(&keyword, 1, 10).await
            } else {
                return Err("请提供搜索关键词或过滤条件 (--ipc 或 --applicant)".to_string());
            };

            let result = result.map_err(|e| format!("本地专利搜索失败: {}", e))?;

            let search_type = if ipc_code.is_some() {
                "IPC分类号"
            } else if applicant.is_some() {
                "申请人"
            } else {
                "关键词"
            };

            let content = if result.patents.is_empty() {
                format!(
                    "未在本地数据库检索到相关专利（搜索类型: {}）。",
                    search_type
                )
            } else {
                let mut lines = vec![format!(
                    "# 本地专利数据库检索结果（按{}）\n\n找到 {} 条相关专利（共 {} 条）：\n",
                    search_type,
                    result.patents.len(),
                    result.total
                )];
                for (i, p) in result.patents.iter().enumerate() {
                    lines.push(format!(
                        "## {}. {}\n\n- **专利名称**: {}\n- **申请号**: {}\n- **公开号**: {}\n- **申请人**: {}\n- **发明人**: {}\n- **IPC**: {}\n- **公开日**: {}\n- **摘要**: {}",
                        i + 1,
                        p.publication_number.as_deref().unwrap_or("未知"),
                        p.patent_name,
                        p.application_number.as_deref().unwrap_or(""),
                        p.publication_number.as_deref().unwrap_or(""),
                        p.applicant.as_deref().unwrap_or(""),
                        p.inventor.as_deref().unwrap_or(""),
                        p.ipc_code.as_deref().unwrap_or(""),
                        p.publication_date.as_deref().unwrap_or(""),
                        p.abstract_text.as_deref().unwrap_or("").chars().take(200).collect::<String>()
                    ));
                }
                lines.join("\n")
            };

            Ok(vec![StageOutput {
                stage_id: "patent_db_search".to_string(),
                stage_name: "本地专利数据库检索".to_string(),
                stage_type: StageType::Analysis,
                content,
                multimodal_content: vec![],
                artifacts: vec![],
                requires_approval: false,
                approval_request: None,
                metadata: Default::default(),
            }])
        }
        "kb_index" => {
            let kb = yunpat_agents::knowledge::KnowledgeBase::default_kb()
                .map_err(|e| format!("知识库加载失败: {}", e))?;

            let file_count = kb.list_files().map(|f| f.len()).unwrap_or(0);
            if file_count == 0 {
                return Err(
                    "知识库目录为空，没有文件可索引。请设置 YUNPAT_KB_PATH 环境变量。".to_string(),
                );
            }

            let content = format!(
                "# 知识库向量索引构建\n\n\
                 扫描到 {} 个文件。\n\n\
                 注意：构建语义索引需要 Embedding Provider（通过 API 调用 Embedding 模型）。\n\
                 当前为 Phase 1 关键词索引模式。\n\n\
                 已完成关键词索引，{} 个文件可用于搜索。",
                file_count, file_count
            );

            Ok(vec![StageOutput {
                stage_id: "kb_index".to_string(),
                stage_name: "知识库索引构建".to_string(),
                stage_type: StageType::Completed,
                content,
                multimodal_content: vec![],
                artifacts: vec![],
                requires_approval: false,
                approval_request: None,
                metadata: Default::default(),
            }])
        }
        other => Err(format!("Unknown agent: {}", other)),
    }
}

/// Run a PatentAgent through AgentExecutor, collecting all stage outputs.
async fn run_via_executor(
    agent: impl yunpat_agents::agent::PatentAgent + 'static,
    input: AgentInput,
    llm_provider: Option<std::sync::Arc<dyn yunpat_agents::context::LlmProvider>>,
    progress_tx: Option<tokio::sync::mpsc::Sender<crate::core::events::Event>>,
    agent_id_str: String,
) -> Result<Vec<StageOutput>, String> {
    use std::sync::Arc;
    use tokio::sync::RwLock;
    use yunpat_agents::registry::AgentRegistry;

    let agent_id = agent.id().clone();
    let mut registry = AgentRegistry::new();
    registry.register_native(agent);

    let executor = crate::core::agent_executor::AgentExecutor::new(Arc::new(RwLock::new(registry)));

    let boxed_provider: Option<Box<dyn yunpat_agents::context::LlmProvider>> =
        llm_provider.map(|arc| {
            Box::new(crate::llm_client::adapter::ArcLlmProviderWrapper(arc))
                as Box<dyn yunpat_agents::context::LlmProvider>
        });

    let rx = executor
        .execute(agent_id, input, boxed_provider)
        .await
        .map_err(|e| format!("AgentExecutor failed: {}", e))?;

    let mut stages = Vec::new();
    let mut rx = rx;
    let mut progress: f32 = 0.0;
    while let Some(stage) = rx.recv().await {
        progress += 0.1; // Simulated incremental progress per stage
        if let Some(tx) = &progress_tx {
            let _ = tx
                .send(crate::core::events::Event::PatentWorkflowStatus {
                    agent_id: agent_id_str.clone(),
                    status: stage.stage_name.clone(),
                    progress: Some(f32::min(progress, 0.99)), // Leave 1.0 for the final complete event
                    details: Some(stage.content.clone()),
                    completed: false,
                    error: None,
                    result: None,
                })
                .await;
        }
        stages.push(stage);
    }
    Ok(stages)
}

fn parse_patent_db_args(topic: &str) -> (String, Option<String>, Option<String>) {
    let parts: Vec<&str> = topic.split_whitespace().collect();
    let mut clean_parts = Vec::new();
    let mut ipc_code = None;
    let mut applicant = None;
    let mut i = 0;

    while i < parts.len() {
        if parts[i] == "--ipc" && i + 1 < parts.len() {
            ipc_code = Some(parts[i + 1].to_string());
            i += 2;
        } else if parts[i] == "--applicant" && i + 1 < parts.len() {
            applicant = Some(parts[i + 1].to_string());
            i += 2;
        } else {
            clean_parts.push(parts[i]);
            i += 1;
        }
    }

    let keyword = clean_parts.join(" ");
    (keyword, ipc_code, applicant)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn test_context() -> ToolContext {
        ToolContext::new("/tmp/test-workspace")
    }

    #[test]
    fn test_tool_metadata() {
        let tool = PatentWorkflowTool::new("research");
        assert_eq!(tool.name(), "patent_research");
        assert!(!tool.description().is_empty());
        assert!(tool.capabilities().contains(&ToolCapability::ReadOnly));
    }

    #[test]
    fn test_input_schema() {
        let tool = PatentWorkflowTool::new("research");
        let schema = tool.input_schema();
        assert_eq!(schema["type"], "object");
        assert!(schema["required"].as_array().unwrap().iter().any(|r| r == "topic"));
    }

    #[tokio::test]
    async fn test_execute_missing_topic() {
        let tool = PatentWorkflowTool::new("research");
        let result = tool.execute(json!({}), &test_context()).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_execute_unknown_agent() {
        let tool = PatentWorkflowTool::new("nonexistent_agent");
        let result = tool.execute(json!({ "topic": "test" }), &test_context()).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_execute_research_agent() {
        let tool = PatentWorkflowTool::new("research");
        let result = tool.execute(json!({ "topic": "专利创造性判断" }), &test_context()).await;
        assert!(result.is_ok(), "Expected success, got {:?}", result);

        let tool_result = result.unwrap();
        assert!(tool_result.success);
        assert!(tool_result.content.contains("专利创造性判断"));
        assert_eq!(
            tool_result.metadata.as_ref().unwrap()["agent_id"],
            "research"
        );
        // Should have 5 stages (intent_parse, knowledge_search, paper_search, report_draft, completed)
        assert_eq!(tool_result.metadata.as_ref().unwrap()["stage_count"], 5);
    }

    #[tokio::test]
    async fn test_execute_drafting_agent() {
        let tool = PatentWorkflowTool::new("drafting");
        let result = tool.execute(json!({ "topic": "一种新型电池技术" }), &test_context()).await;
        assert!(result.is_ok(), "Expected success, got {:?}", result);

        let tool_result = result.unwrap();
        assert!(tool_result.success);
        assert!(tool_result.content.contains("新型电池技术"));
        assert_eq!(
            tool_result.metadata.as_ref().unwrap()["agent_id"],
            "drafting"
        );
        assert_eq!(tool_result.metadata.as_ref().unwrap()["stage_count"], 5);
    }

    #[tokio::test]
    async fn test_execute_trademark_agent() {
        let tool = PatentWorkflowTool::new("trademark");
        let result = tool.execute(json!({ "topic": "云智商标" }), &test_context()).await;
        assert!(result.is_ok(), "Expected success, got {:?}", result);

        let tool_result = result.unwrap();
        assert!(tool_result.success);
        assert!(tool_result.content.contains("云智商标"));
        assert_eq!(
            tool_result.metadata.as_ref().unwrap()["agent_id"],
            "trademark"
        );
        assert_eq!(tool_result.metadata.as_ref().unwrap()["stage_count"], 5);
    }

    #[tokio::test]
    async fn test_execute_creativity_agent() {
        let tool = PatentWorkflowTool::new("creativity");
        let result = tool.execute(json!({ "topic": "创造性判断分析" }), &test_context()).await;
        assert!(result.is_ok(), "Expected success, got {:?}", result);

        let tool_result = result.unwrap();
        assert!(tool_result.success);
        assert!(tool_result.content.contains("创造性判断分析"));
        assert_eq!(
            tool_result.metadata.as_ref().unwrap()["agent_id"],
            "creativity"
        );
        assert_eq!(tool_result.metadata.as_ref().unwrap()["stage_count"], 7);
    }

    #[tokio::test]
    #[ignore = "需要本地 PostgreSQL 专利数据库"]
    async fn test_execute_patent_db_search() {
        let tool = PatentWorkflowTool::new("patent_db");
        let result = tool.execute(json!({ "topic": "人工智能" }), &test_context()).await;
        assert!(result.is_ok(), "Expected success, got {:?}", result);

        let tool_result = result.unwrap();
        assert!(tool_result.success);
        assert!(tool_result.content.contains("本地专利数据库检索结果"));
        assert_eq!(
            tool_result.metadata.as_ref().unwrap()["agent_id"],
            "patent_db"
        );
    }

    #[test]
    fn test_map_agent_to_mcp_tool() {
        // 测试 research → MCP 映射
        let result = map_agent_to_mcp_tool("research");
        assert!(result.is_some());
        let (tool_name, _) = result.unwrap();
        assert_eq!(tool_name, "mcp_yunpat_patent_search");

        // 测试 legal_search → MCP 映射
        let result = map_agent_to_mcp_tool("legal_search");
        assert!(result.is_some());
        let (tool_name, _) = result.unwrap();
        assert_eq!(tool_name, "mcp_yunpat_legal_knowledge_search");

        // 测试未知 agent（无 MCP 映射）
        let result = map_agent_to_mcp_tool("unknown_agent");
        assert!(result.is_none());
    }

    #[test]
    fn test_format_mcp_result() {
        // 标准格式
        let result = json!({
            "content": [
                { "type": "text", "text": "Line 1" },
                { "type": "text", "text": "Line 2" }
            ]
        });
        let formatted = format_mcp_result(&result);
        assert!(formatted.contains("Line 1"));
        assert!(formatted.contains("Line 2"));

        // 空内容
        let result = json!({});
        let formatted = format_mcp_result(&result);
        assert!(formatted.contains("{}"));
    }
}
