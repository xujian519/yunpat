//! Research Agent — patent law and regulation research workflow.
//!
//! Single-stage agent that:
//! 1. Parses the user's research topic
//! 2. Searches the local knowledge base
//! 3. Drafts a structured research report
//! 4. Presents for approval
//!
//! This is the first end-to-end PoC agent, validating:
//! - PatentAgent trait
//! - AgentRegistry
//! - yunpat-router intent routing
//! - TUI stage rendering

use crate::agent::PatentAgent;
use crate::context::LlmProvider;
use crate::knowledge::KnowledgeBase;
use crate::types::*;
use anyhow::Result;
use async_trait::async_trait;
use futures_core::Stream;
use std::pin::Pin;

/// The Research Agent handles patent law and regulation research requests.
pub struct ResearchAgent {
    id: AgentId,
    knowledge_base: KnowledgeBase,
    initialized: bool,
    llm_provider: Option<Box<dyn LlmProvider>>,
}

impl ResearchAgent {
    pub fn new(knowledge_base: KnowledgeBase) -> Self {
        Self {
            id: AgentId("research".to_string()),
            knowledge_base,
            initialized: false,
            llm_provider: None,
        }
    }

    /// Create with the default knowledge base path.
    pub fn with_default_kb() -> Result<Self> {
        let kb = KnowledgeBase::default_kb()?;
        Ok(Self::new(kb))
    }

    /// Set an LLM provider for report generation (builder pattern).
    pub fn with_llm(mut self, provider: Box<dyn LlmProvider>) -> Self {
        self.llm_provider = Some(provider);
        self
    }

    /// Set an LLM provider directly (non-builder).
    pub fn set_llm(&mut self, provider: Box<dyn LlmProvider>) {
        self.llm_provider = Some(provider);
    }

    /// Whether an LLM provider is configured.
    pub fn has_llm(&self) -> bool {
        self.llm_provider.is_some()
    }
}

// Keywords that indicate a research intent.
const RESEARCH_KEYWORDS: &[&str] = &[
    "研究",
    "法规",
    "规则",
    "案例",
    "判例",
    "审查指南",
    "法律",
    "分析",
    "调研",
    "调查",
    "检索",
    "专利法",
];

#[async_trait]
impl PatentAgent for ResearchAgent {
    fn id(&self) -> &AgentId {
        &self.id
    }

    fn name(&self) -> &str {
        "专利研究智能体"
    }

    fn description(&self) -> &str {
        "处理专利法律法规研究请求，检索本地知识库并起草结构化研究报告"
    }

    fn capabilities(&self) -> &[String] {
        static CAPS: std::sync::OnceLock<Vec<String>> = std::sync::OnceLock::new();
        CAPS.get_or_init(|| {
            vec![
                "patent_law_research".to_string(),
                "regulation_analysis".to_string(),
                "case_law_search".to_string(),
                "examination_guideline_lookup".to_string(),
            ]
        })
    }

    fn can_handle(&self, intent: &UserIntent) -> Confidence {
        let input = &intent.raw_input;
        let lower = input.to_lowercase();

        let matches = RESEARCH_KEYWORDS
            .iter()
            .filter(|kw| lower.contains(*kw))
            .count();

        if matches == 0 {
            return 0.0;
        }

        // At least one keyword → 0.5, more keywords → higher confidence.
        let base = 0.5;
        let boost = (matches as f32 * 0.1).min(0.5);
        (base + boost).min(1.0)
    }

    fn stages(&self) -> Vec<StageDefinition> {
        vec![
            StageDefinition {
                stage_id: "intent_parse".to_string(),
                stage_name: "意图解析".to_string(),
                description: "解析用户研究主题和范围".to_string(),
                requires_approval: false,
            },
            StageDefinition {
                stage_id: "knowledge_search".to_string(),
                stage_name: "知识检索".to_string(),
                description: "从本地知识库检索相关内容".to_string(),
                requires_approval: false,
            },
            StageDefinition {
                stage_id: "report_draft".to_string(),
                stage_name: "报告撰写".to_string(),
                description: "基于检索结果生成结构化研究报告".to_string(),
                requires_approval: false,
            },
            StageDefinition {
                stage_id: "completed".to_string(),
                stage_name: "完成".to_string(),
                description: "研究报告已完成，等待用户确认".to_string(),
                requires_approval: true,
            },
        ]
    }

    async fn initialize(&mut self) -> Result<()> {
        self.initialized = true;
        Ok(())
    }

    fn execute(&mut self, input: AgentInput) -> Pin<Box<dyn Stream<Item = StageOutput> + Send>> {
        let topic = input.intent.raw_input.clone();

        // Perform knowledge search outside the stream to avoid borrowing self.
        let search_results = if self.knowledge_base.exists() {
            self.knowledge_base.search(&topic, 5).unwrap_or_default()
        } else {
            vec![]
        };

        // Take the LLM provider out (move into the stream).
        let llm_provider = self.llm_provider.take();

        Box::pin(async_stream::stream! {
            // Stage 1: Intent parsing
            yield StageOutput {
                stage_id: "intent_parse".to_string(),
                stage_name: "意图解析".to_string(),
                stage_type: StageType::Progress,
                content: format!("正在解析研究主题: {}", topic),
                multimodal_content: vec![],
                artifacts: vec![],
                requires_approval: false,
                approval_request: None,
                metadata: Default::default(),
            };

            // Stage 2: Knowledge search
            let kb_summary = if search_results.is_empty() {
                "未找到本地知识库中的相关内容。".to_string()
            } else {
                let file_list: Vec<String> = search_results
                    .iter()
                    .map(|c| format!("- {} (相关度: {:.1})", c.title, c.relevance))
                    .collect();
                format!("检索到 {} 条相关内容:\n{}", search_results.len(), file_list.join("\n"))
            };

            yield StageOutput {
                stage_id: "knowledge_search".to_string(),
                stage_name: "知识检索".to_string(),
                stage_type: StageType::Analysis,
                content: kb_summary,
                multimodal_content: vec![],
                artifacts: search_results
                    .iter()
                    .map(|c| Artifact {
                        name: c.title.clone(),
                        artifact_type: "knowledge_chunk".to_string(),
                        content: c.content.clone(),
                        path: Some(c.file_path.clone()),
                    })
                    .collect(),
                requires_approval: false,
                approval_request: None,
                metadata: Default::default(),
            };

            let paper_tool = crate::tools::PaperSearchTool::new();
            let paper_results = paper_tool.search(&topic, 10, 0).await.ok();
            let paper_summary = if let Some(ref results) = paper_results {
                if results.papers.is_empty() {
                    "未检索到相关学术论文。".to_string()
                } else {
                    let paper_list: Vec<String> = results
                        .papers
                        .iter()
                        .map(|p| {
                            let authors = p.authors.join(", ");
                            format!(
                                "- **{}** ({}) - {}\n  作者: {} | 引用: {}",
                                p.title,
                                p.year.map(|y| y.to_string()).unwrap_or_default(),
                                p.venue.as_deref().unwrap_or(""),
                                authors,
                                p.citation_count.map(|c| c.to_string()).unwrap_or_default()
                            )
                        })
                        .collect();
                    format!(
                        "检索到 {} 篇相关学术论文:\n{}",
                        results.papers.len(),
                        paper_list.join("\n")
                    )
                }
            } else {
                "论文检索服务暂不可用。".to_string()
            };

            let mut research_artifacts: Vec<Artifact> = search_results
                .iter()
                .map(|c| Artifact {
                    name: c.title.clone(),
                    artifact_type: "knowledge_chunk".to_string(),
                    content: c.content.clone(),
                    path: Some(c.file_path.clone()),
                })
                .collect();

            if let Some(results) = paper_results {
                let papers_json = serde_json::to_string_pretty(&results).unwrap_or_default();
                research_artifacts.push(Artifact {
                    name: "学术论文检索结果".to_string(),
                    artifact_type: "paper_search_results".to_string(),
                    content: papers_json,
                    path: None,
                });
            }

            yield StageOutput {
                stage_id: "paper_search".to_string(),
                stage_name: "论文检索".to_string(),
                stage_type: StageType::Analysis,
                content: paper_summary,
                multimodal_content: vec![],
                artifacts: research_artifacts,
                requires_approval: false,
                approval_request: None,
                metadata: Default::default(),
            };

            // Stage 3: Report draft (LLM or template fallback)
            let report = if let Some(provider) = llm_provider {
                // LLM-driven report generation
                let system_prompt = build_research_system_prompt(&search_results);
                let user_msg = format!(
                    "请针对以下主题撰写一份结构化的专利研究报告：\n\n{}\n\n要求：\
                     \n1. 分析相关的法律法规和审查指南\
                     \n2. 引用典型案例和审查实践\
                     \n3. 给出实务建议和结论",
                    topic
                );

                let mut stream = provider.chat_stream(&system_prompt, &user_msg);
                let mut full_report = String::new();
                use futures_util::StreamExt;
                while let Some(chunk) = stream.next().await {
                    match chunk {
                        Ok(text) => full_report.push_str(&text),
                        Err(e) => {
                            full_report.push_str(&format!("\n\n[LLM 生成出错: {}]", e));
                            break;
                        }
                    }
                }

                if full_report.is_empty() {
                    draft_research_report(&topic, &search_results)
                } else {
                    full_report
                }
            } else {
                // Template fallback when no LLM is configured
                draft_research_report(&topic, &search_results)
            };

            yield StageOutput {
                stage_id: "report_draft".to_string(),
                stage_name: "报告撰写".to_string(),
                stage_type: StageType::Draft,
                content: report.clone(),
                multimodal_content: vec![],
                artifacts: vec![Artifact {
                    name: format!("研究报告: {}", topic),
                    artifact_type: "research_report".to_string(),
                    content: report,
                    path: None,
                }],
                requires_approval: false,
                approval_request: None,
                metadata: Default::default(),
            };

            // Stage 4: Completed with approval gate
            yield StageOutput {
                stage_id: "completed".to_string(),
                stage_name: "完成".to_string(),
                stage_type: StageType::Completed,
                content: "研究报告已生成，请审阅以上内容。".to_string(),
                multimodal_content: vec![],
                artifacts: vec![],
                requires_approval: true,
                approval_request: Some(ApprovalRequest {
                    prompt: "研究报告是否符合预期？".to_string(),
                    options: vec![
                        ApprovalOption {
                            label: "确认通过".to_string(),
                            value: "approve".to_string(),
                            is_default: true,
                        },
                        ApprovalOption {
                            label: "需要修改".to_string(),
                            value: "revise".to_string(),
                            is_default: false,
                        },
                        ApprovalOption {
                            label: "重新生成".to_string(),
                            value: "retry".to_string(),
                            is_default: false,
                        },
                    ],
                }),
                metadata: Default::default(),
            };
        })
    }

    fn set_llm_provider(&mut self, provider: Box<dyn LlmProvider>) {
        self.llm_provider = Some(provider);
    }

    async fn terminate(&mut self) -> Result<()> {
        self.initialized = false;
        Ok(())
    }
}

/// Build the system prompt for LLM-driven research report generation.
fn build_research_system_prompt(chunks: &[crate::knowledge::KnowledgeChunk]) -> String {
    let mut prompt = String::from(
        "你是一位专利法律研究专家。请根据提供的参考资料，撰写一份结构化的研究报告。\n\n\
         报告应包含以下部分：\n\
         1. **研究主题概述** — 简要说明研究范围和目标\n\
         2. **法律依据** — 列出相关法律法规和审查指南条款\n\
         3. **实务分析** — 结合典型案例和审查实践进行分析\n\
         4. **建议与结论** — 给出针对具体应用场景的建议\n\n",
    );

    if !chunks.is_empty() {
        prompt.push_str("参考资料：\n\n");
        for chunk in chunks {
            prompt.push_str(&format!(
                "### {} (来源: {})\n\n{}\n\n---\n\n",
                chunk.title, chunk.file_path, chunk.content
            ));
        }
    }

    prompt
}

/// Draft a structured research report from the topic and knowledge chunks (template fallback).
fn draft_research_report(topic: &str, chunks: &[crate::knowledge::KnowledgeChunk]) -> String {
    let mut report = format!("# 研究报告: {}\n\n", topic);
    report.push_str("---\n\n");

    // Topic overview
    report.push_str("## 研究主题\n\n");
    report.push_str(&format!("{}\n\n", topic));

    // Knowledge base references
    if !chunks.is_empty() {
        report.push_str("## 参考资料来源\n\n");
        for chunk in chunks {
            report.push_str(&format!(
                "### {} (相关度: {:.1})\n\n",
                chunk.title, chunk.relevance
            ));
            report.push_str(&format!("> 来源: {}\n\n", chunk.file_path));
            // Include a brief excerpt.
            let excerpt: String = chunk.content.chars().take(300).collect();
            report.push_str(&format!("{}\n\n---\n\n", excerpt));
        }
    }

    // Analysis section (placeholder — will be LLM-generated in production).
    report.push_str("## 分析要点\n\n");
    report.push_str(&format!("本报告针对主题「{}」进行了以下分析：\n\n", topic));
    report.push_str("1. **法律依据**: 基于检索到的相关法规和审查指南\n");
    report.push_str("2. **实务要点**: 结合典型案例和审查实践\n");
    report.push_str("3. **建议方向**: 针对具体应用场景的建议\n\n");

    // Disclaimer
    report.push_str("---\n\n");
    report.push_str(
        "*注：此为基于本地知识库的初步研究报告。生产环境中将由 LLM 生成更详细的分析内容。*\n",
    );

    report
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_research_agent_metadata() {
        let agent = ResearchAgent::new(KnowledgeBase::new(PathBuf::from("/nonexistent")));
        assert_eq!(agent.id().0, "research");
        assert_eq!(agent.name(), "专利研究智能体");
        assert!(!agent.capabilities().is_empty());
        assert_eq!(agent.stages().len(), 4);
    }

    #[test]
    fn test_can_handle_research_intent() {
        let agent = ResearchAgent::new(KnowledgeBase::new(PathBuf::from("/nonexistent")));
        let intent = UserIntent {
            raw_input: "研究新用途专利的创造性判断规则".to_string(),
            parsed_topic: None,
            parsed_scope: None,
            parsed_depth: None,
        };
        let conf = agent.can_handle(&intent);
        assert!(
            conf > 0.5,
            "Expected high confidence for research intent, got {}",
            conf
        );
    }

    #[test]
    fn test_can_handle_non_research() {
        let agent = ResearchAgent::new(KnowledgeBase::new(PathBuf::from("/nonexistent")));
        let intent = UserIntent {
            raw_input: "今天天气怎么样".to_string(),
            parsed_topic: None,
            parsed_scope: None,
            parsed_depth: None,
        };
        let conf = agent.can_handle(&intent);
        assert_eq!(
            conf, 0.0,
            "Expected zero confidence for non-research intent"
        );
    }

    #[tokio::test]
    async fn test_execute_returns_stages() {
        let mut agent = ResearchAgent::new(KnowledgeBase::new(PathBuf::from("/nonexistent")));
        agent.initialize().await.unwrap();

        let input = AgentInput {
            intent: UserIntent {
                raw_input: "专利创造性判断".to_string(),
                parsed_topic: Some("创造性判断".to_string()),
                parsed_scope: None,
                parsed_depth: None,
            },
            extra: serde_json::Value::Null,
        };

        use futures_util::StreamExt;
        let stages: Vec<StageOutput> = agent.execute(input).collect().await;

        assert_eq!(stages.len(), 5);
        assert_eq!(stages[0].stage_id, "intent_parse");
        assert_eq!(stages[1].stage_id, "knowledge_search");
        assert_eq!(stages[2].stage_id, "paper_search");
        assert_eq!(stages[3].stage_id, "report_draft");
        assert_eq!(stages[4].stage_id, "completed");
        assert!(stages[4].requires_approval);
        assert!(stages[4].approval_request.is_some());
    }

    #[test]
    fn test_draft_research_report() {
        let report = draft_research_report("创造性判断", &[]);
        assert!(report.contains("创造性判断"));
        assert!(report.contains("研究报告"));
    }

    /// Mock LLM provider that returns a fixed research report.
    struct MockLlmProvider {
        response: String,
    }

    impl LlmProvider for MockLlmProvider {
        fn chat_stream(
            &self,
            _system_prompt: &str,
            _user_message: &str,
        ) -> Pin<Box<dyn Stream<Item = Result<String>> + Send>> {
            let response = self.response.clone();
            Box::pin(async_stream::stream! {
                yield Ok(response);
            })
        }
    }

    #[tokio::test]
    async fn test_execute_with_llm_provider() {
        let mock_response =
            "# LLM 生成的研究报告\n\n这是一份由 LLM 生成的专利研究报告。".to_string();
        let llm = MockLlmProvider {
            response: mock_response.clone(),
        };

        let mut agent = ResearchAgent::new(KnowledgeBase::new(PathBuf::from("/nonexistent")))
            .with_llm(Box::new(llm));
        agent.initialize().await.unwrap();

        let input = AgentInput {
            intent: UserIntent {
                raw_input: "专利创造性判断".to_string(),
                parsed_topic: Some("创造性判断".to_string()),
                parsed_scope: None,
                parsed_depth: None,
            },
            extra: serde_json::Value::Null,
        };

        use futures_util::StreamExt;
        let stages: Vec<StageOutput> = agent.execute(input).collect().await;

        assert_eq!(stages.len(), 5);
        // report_draft stage should contain the LLM-generated content
        assert_eq!(stages[3].stage_id, "report_draft");
        assert!(stages[3].content.contains("LLM 生成的研究报告"));
    }

    #[tokio::test]
    async fn test_execute_without_llm_falls_back_to_template() {
        let mut agent = ResearchAgent::new(KnowledgeBase::new(PathBuf::from("/nonexistent")));
        agent.initialize().await.unwrap();

        let input = AgentInput {
            intent: UserIntent {
                raw_input: "专利创造性判断".to_string(),
                parsed_topic: Some("创造性判断".to_string()),
                parsed_scope: None,
                parsed_depth: None,
            },
            extra: serde_json::Value::Null,
        };

        use futures_util::StreamExt;
        let stages: Vec<StageOutput> = agent.execute(input).collect().await;

        assert_eq!(stages.len(), 5);
        // report_draft should use template (contains disclaimer about template)
        assert!(stages[3].content.contains("初步研究报告"));
    }

    #[test]
    fn test_with_llm_builder() {
        let llm = MockLlmProvider {
            response: "test".to_string(),
        };
        let agent = ResearchAgent::new(KnowledgeBase::new(PathBuf::from("/nonexistent")))
            .with_llm(Box::new(llm));
        assert!(agent.has_llm());
    }

    #[test]
    fn test_without_llm() {
        let agent = ResearchAgent::new(KnowledgeBase::new(PathBuf::from("/nonexistent")));
        assert!(!agent.has_llm());
    }
}
