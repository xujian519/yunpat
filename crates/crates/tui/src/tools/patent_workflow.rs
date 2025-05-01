//! Patent Workflow Tool — bridges TUI tool system to the PatentAgent trait.
//!
//! When the TUI routes a user command to a patent agent (via `/research`,
//! `/oa`, etc.), this tool wraps the agent's `execute()` stream into a
//! single `ToolResult` consumable by the turn loop.

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
        Self {
            agent_id: agent_id.to_string(),
        }
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
        let topic = input
            .get("topic")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let case_id = input
            .get("case_id")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

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

/// Execute a patent agent locally.
///
/// Uses local agent implementations (ResearchAgent, OAResponseAgent).
/// When an MCP pool is available, also attempts to call MCP server tools
/// for enhanced processing.
async fn execute_agent_locally(
    agent_id: &str,
    topic: &str,
    case_id: Option<&str>,
    mcp_pool: Option<std::sync::Arc<tokio::sync::Mutex<crate::mcp::McpPool>>>,
) -> Result<Vec<StageOutput>, String> {
    // Try MCP tool call first if pool is available.
    // MCP tool names follow the pattern: mcp_{server}_{tool}
    if let Some(pool) = &mcp_pool {
        let mut pool_guard = pool.lock().await;

        // Map agent_id to MCP tool name.
        let mcp_tool_name = match agent_id {
            "research" => Some("mcp_yunpat_patent_search"),
            "oa-response" => Some("mcp_yunpat_patent_analyzer"),
            _ => None,
        };

        if let Some(tool_name) = mcp_tool_name {
            let args = serde_json::json!({
                "query": topic,
                "topic": topic,
            });

            if let Ok(result) = pool_guard.call_tool(tool_name, args).await {
                // MCP call succeeded — wrap the result as a StageOutput.
                let content: String = result.to_string();
                return Ok(vec![StageOutput {
                    stage_id: "mcp_tool_call".to_string(),
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
            // MCP call failed — fall through to local agent.
        }
    }

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
            Ok(agent) => Some(run_via_executor(agent, input).await),
            Err(e) => Some(Err(format!("Failed to create ResearchAgent: {}", e))),
        },
        "oa-response" => {
            let agent = yunpat_agents::oa_response::OAResponseAgent::new();
            Some(run_via_executor(agent, input).await)
        }
        "drafting" => {
            let agent = yunpat_agents::drafting::DraftingAgent::new();
            Some(run_via_executor(agent, input).await)
        }
        "trademark" => {
            let agent = yunpat_agents::trademark::TrademarkAgent::new();
            Some(run_via_executor(agent, input).await)
        }
        "creativity" => {
            let agent = yunpat_agents::creativity::CreativityAgent::new();
            Some(run_via_executor(agent, input).await)
        }
        "reexamination" => {
            let agent = yunpat_agents::reexamination::ReexaminationAgent::new();
            Some(run_via_executor(agent, input).await)
        }
        "invalidation" => {
            let agent = yunpat_agents::invalidation::InvalidationAgent::new();
            Some(run_via_executor(agent, input).await)
        }
        _ => None,
    };

    if let Some(result) = agent_result {
        return result;
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
) -> Result<Vec<StageOutput>, String> {
    use std::sync::Arc;
    use tokio::sync::RwLock;
    use yunpat_agents::registry::AgentRegistry;

    let agent_id = agent.id().clone();
    let mut registry = AgentRegistry::new();
    registry.register_native(agent);

    let executor = crate::core::agent_executor::AgentExecutor::new(Arc::new(RwLock::new(registry)));

    let rx = executor
        .execute(agent_id, input, None)
        .await
        .map_err(|e| format!("AgentExecutor failed: {}", e))?;

    let mut stages = Vec::new();
    let mut rx = rx;
    while let Some(stage) = rx.recv().await {
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
        assert!(
            schema["required"]
                .as_array()
                .unwrap()
                .iter()
                .any(|r| r == "topic")
        );
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
        let result = tool
            .execute(json!({ "topic": "test" }), &test_context())
            .await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_execute_research_agent() {
        let tool = PatentWorkflowTool::new("research");
        let result = tool
            .execute(json!({ "topic": "专利创造性判断" }), &test_context())
            .await;
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
        let result = tool
            .execute(json!({ "topic": "一种新型电池技术" }), &test_context())
            .await;
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
        let result = tool
            .execute(json!({ "topic": "云智商标" }), &test_context())
            .await;
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
        let result = tool
            .execute(json!({ "topic": "创造性判断分析" }), &test_context())
            .await;
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
        let result = tool
            .execute(json!({ "topic": "人工智能" }), &test_context())
            .await;
        assert!(result.is_ok(), "Expected success, got {:?}", result);

        let tool_result = result.unwrap();
        assert!(tool_result.success);
        assert!(tool_result.content.contains("本地专利数据库检索结果"));
        assert_eq!(
            tool_result.metadata.as_ref().unwrap()["agent_id"],
            "patent_db"
        );
    }
}
