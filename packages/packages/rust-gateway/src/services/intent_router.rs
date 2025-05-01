/**
 * @file 网关意图路由器
 * @description 在 Gateway 层做轻量意图识别，减少不必要的 LLM 调用
 *
 * 路由策略：
 * 1. 斜杠命令 → 直接映射意图（零延迟）
 * 2. 关键词匹配 → 高置信度直接路由（零延迟）
 * 3. 模糊意图 → 调用 LLM 做意图识别（~2s）
 * 4. 无法识别 → 转交 Orchestrator 完整流程
 */
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tracing::{debug, info, warn};

// ============================================================================
// 意图类型
// ============================================================================

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum IntentType {
    /// 完整专利撰写（检索+说明书+权利要求+摘要）
    DraftFull,
    /// 仅撰写/修改权利要求
    DraftClaims,
    /// 仅撰写说明书
    DraftSpec,
    /// 审查意见答复
    RespondOA,
    /// 现有技术检索
    Search,
    /// 专利组合分析
    AnalyzePortfolio,
    /// 编程/开发需求（YunPat 框架本身不覆盖）
    Coding,
    /// 闲聊/问候/询问功能
    ChitChat,
    /// 工作区初始化/扫描
    InitWorkspace,
    /// 意图不明确，需要追问
    Clarify,
}

impl From<String> for IntentType {
    fn from(s: String) -> Self {
        match s.to_uppercase().as_str() {
            "DRAFT_FULL" => IntentType::DraftFull,
            "DRAFT_CLAIMS" => IntentType::DraftClaims,
            "DRAFT_SPEC" => IntentType::DraftSpec,
            "RESPOND_OA" => IntentType::RespondOA,
            "SEARCH" => IntentType::Search,
            "ANALYZE_PORTFOLIO" => IntentType::AnalyzePortfolio,
            "CODING" => IntentType::Coding,
            "CHITCHAT" => IntentType::ChitChat,
            "INIT_WORKSPACE" => IntentType::InitWorkspace,
            _ => IntentType::Clarify,
        }
    }
}

impl std::fmt::Display for IntentType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            IntentType::DraftFull => write!(f, "DRAFT_FULL"),
            IntentType::DraftClaims => write!(f, "DRAFT_CLAIMS"),
            IntentType::DraftSpec => write!(f, "DRAFT_SPEC"),
            IntentType::RespondOA => write!(f, "RESPOND_OA"),
            IntentType::Search => write!(f, "SEARCH"),
            IntentType::AnalyzePortfolio => write!(f, "ANALYZE_PORTFOLIO"),
            IntentType::Coding => write!(f, "CODING"),
            IntentType::ChitChat => write!(f, "CHITCHAT"),
            IntentType::InitWorkspace => write!(f, "INIT_WORKSPACE"),
            IntentType::Clarify => write!(f, "CLARIFY"),
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct IntentResult {
    pub intent: IntentType,
    pub confidence: f64,
    pub source: IntentSource,
    pub extracted: Option<serde_json::Value>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum IntentSource {
    /// 斜杠命令直接映射
    Command,
    /// 关键词规则匹配
    Keyword,
    /// LLM 意图识别
    LLM,
}

// ============================================================================
// 路由决策
// ============================================================================

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RoutingDecision {
    /// 是否跳过 Orchestrator 的意图识别（Call 1）
    pub skip_intent_recognition: bool,
    /// 预设意图（如果 skip_intent_recognition = true）
    pub intent_override: Option<IntentType>,
    /// 是否需要调用 LLM 做意图识别
    pub needs_llm: bool,
    /// 直接回复（闲聊/帮助信息，不经过 Orchestrator）
    pub direct_response: Option<String>,
}

// ============================================================================
// 意图路由器
// ============================================================================

#[derive(Clone)]
pub struct IntentRouter {
    /// HTTP 客户端（用于调用 LLM）
    http_client: Client,
    /// LLM API 基础 URL
    llm_base_url: String,
    /// LLM API Key
    llm_api_key: String,
    /// LLM 模型名称
    llm_model: String,
    /// 是否启用 LLM 兜底
    llm_enabled: bool,
}

impl IntentRouter {
    pub fn new(llm_base_url: String, llm_api_key: String, llm_model: String) -> Self {
        let http_client = Client::builder()
            .no_proxy()
            .timeout(Duration::from_secs(10))
            .build()
            .unwrap_or_else(|_| Client::new());

        let llm_enabled = !llm_base_url.is_empty() && !llm_api_key.is_empty();

        Self {
            http_client,
            llm_base_url,
            llm_api_key,
            llm_model,
            llm_enabled,
        }
    }

    /// 从环境变量创建
    pub fn from_env() -> Self {
        Self::new(
            std::env::var("ROUTER_LLM_BASE_URL").unwrap_or_else(|_| {
                std::env::var("OPENAI_BASE_URL")
                    .unwrap_or_else(|_| "https://api.deepseek.com/v1".to_string())
            }),
            std::env::var("ROUTER_LLM_API_KEY").unwrap_or_else(|_| {
                std::env::var("DEEPSEEK_API_KEY").unwrap_or_else(|_| "".to_string())
            }),
            std::env::var("ROUTER_LLM_MODEL").unwrap_or_else(|_| "deepseek-chat".to_string()),
        )
    }

    /// 主路由入口
    pub async fn route(&self, content: &str) -> RoutingDecision {
        // Step 1: 斜杠命令匹配（零延迟）
        if let Some(intent) = self.match_command(content) {
            info!(intent = ?intent, source = "command", "意图路由：斜杠命令匹配");

            // CODING 意图直接回复，不经过 Orchestrator
            if intent == IntentType::Coding {
                return RoutingDecision {
                    skip_intent_recognition: true,
                    intent_override: Some(IntentType::Coding),
                    needs_llm: false,
                    direct_response: Some(
                        "YunPat 是专利智能助手，专注于专利撰写、审查答复和检索分析，暂不支持直接执行编程任务。\n\n\
                         如果您需要的是：\n\
                         • 专利相关功能开发 → 请详细描述需求，我们可以讨论技术方案\n\
                         • 自动化流程集成 → 请使用 YunPat CLI 或 SDK\n\
                         • 其他编程帮助 → 建议使用通用编程 AI 工具\n\n\
                         您也可以尝试以下专利相关命令：\n\
                         /draft 撰写专利  /oa 答复审查意见  /search 专利检索  /analyze 专利分析"
                            .to_string(),
                    ),
                };
            }

            return RoutingDecision {
                skip_intent_recognition: true,
                intent_override: Some(intent),
                needs_llm: false,
                direct_response: None,
            };
        }

        // Step 2: 关键词规则匹配（零延迟）
        if let Some(result) = self.match_keywords(content) {
            if result.confidence >= 0.85 {
                info!(intent = ?result.intent, confidence = result.confidence, source = "keyword", "意图路由：关键词匹配");

                // CODING 意图直接回复
                if result.intent == IntentType::Coding {
                    return RoutingDecision {
                        skip_intent_recognition: true,
                        intent_override: Some(IntentType::Coding),
                        needs_llm: false,
                        direct_response: Some(
                            "YunPat 是专利智能助手，专注于专利撰写、审查答复和检索分析，暂不支持直接执行编程任务。\n\n\
                             如果您需要的是：\n\
                             • 专利相关功能开发 → 请详细描述需求，我们可以讨论技术方案\n\
                             • 自动化流程集成 → 请使用 YunPat CLI 或 SDK\n\
                             • 其他编程帮助 → 建议使用通用编程 AI 工具\n\n\
                             您也可以尝试以下专利相关命令：\n\
                             /draft 撰写专利  /oa 答复审查意见  /search 专利检索  /analyze 专利分析"
                                .to_string(),
                        ),
                    };
                }

                return RoutingDecision {
                    skip_intent_recognition: true,
                    intent_override: Some(result.intent),
                    needs_llm: false,
                    direct_response: None,
                };
            }
        }

        // Step 3: 闲聊/帮助直接回复（零延迟）
        if let Some(response) = self.match_chitchat(content) {
            info!(source = "chitchat", "意图路由：闲聊直接回复");
            return RoutingDecision {
                skip_intent_recognition: true,
                intent_override: Some(IntentType::ChitChat),
                needs_llm: false,
                direct_response: Some(response),
            };
        }

        // Step 4: LLM 兜底（~2s）
        if self.llm_enabled {
            info!("意图路由：调用 LLM 做意图识别");
            match self.llm_classify(content).await {
                Ok(result) => {
                    info!(intent = ?result.intent, confidence = result.confidence, source = "llm", "LLM 意图识别完成");
                    return RoutingDecision {
                        skip_intent_recognition: true,
                        intent_override: Some(result.intent),
                        needs_llm: true,
                        direct_response: None,
                    };
                }
                Err(e) => {
                    warn!(error = %e, "LLM 意图识别失败，交给 Orchestrator");
                }
            }
        }

        // Step 5: 兜底 —— 完整交由 Orchestrator 处理
        info!("意图路由：无法确定意图，交给 Orchestrator 完整流程");
        RoutingDecision {
            skip_intent_recognition: false,
            intent_override: None,
            needs_llm: false,
            direct_response: None,
        }
    }

    // ========================================================================
    // Step 1: 斜杠命令匹配
    // ========================================================================

    fn match_command(&self, content: &str) -> Option<IntentType> {
        let cmd = content.trim().split_whitespace().next()?;

        match cmd {
            "/draft" | "/write" | "/撰写" => Some(IntentType::DraftFull),
            "/claims" | "/权利要求" => Some(IntentType::DraftClaims),
            "/spec" | "/说明书" => Some(IntentType::DraftSpec),
            "/oa" | "/respond" | "/答复" => Some(IntentType::RespondOA),
            "/search" | "/检索" => Some(IntentType::Search),
            "/analyze" | "/分析" => Some(IntentType::AnalyzePortfolio),
            "/code" | "/编程" | "/develop" => Some(IntentType::Coding),
            "/init" | "/scan" => Some(IntentType::InitWorkspace),
            _ => None,
        }
    }

    // ========================================================================
    // Step 2: 关键词规则匹配
    // ========================================================================

    fn match_keywords(&self, content: &str) -> Option<IntentResult> {
        let text = content.to_lowercase();
        let text_lower = text.as_str();

        // 专利撰写关键词
        let draft_score = self.calc_keyword_score(
            text_lower,
            &[
                // 高权重
                ("撰写专利", 1.0),
                ("写专利", 1.0),
                ("专利撰写", 1.0),
                ("专利申请", 0.9),
                ("写一份专利", 1.0),
                ("新申请", 0.85),
                // 中权重
                ("技术交底书", 0.8),
                ("发明名称", 0.75),
                ("权利要求书", 0.7),
                ("说明书", 0.5),
                ("技术方案", 0.6),
                // 英文
                ("draft patent", 1.0),
                ("write patent", 1.0),
                ("patent application", 0.9),
                ("new patent", 0.85),
            ],
        );

        // OA 答复关键词
        let oa_score = self.calc_keyword_score(
            text_lower,
            &[
                ("审查意见", 1.0),
                ("答复审查", 1.0),
                ("审查意见答复", 1.0),
                ("oa答复", 1.0),
                ("审查员", 0.7),
                ("驳回", 0.6),
                ("第一次审查意见", 1.0),
                ("第二次审查意见", 1.0),
                ("答复期限", 0.8),
                ("创造性感", 0.7),
                ("新颖性", 0.7),
                ("respond to office action", 1.0),
                ("office action", 0.9),
            ],
        );

        // 检索关键词
        let search_score = self.calc_keyword_score(
            text_lower,
            &[
                ("检索", 0.85),
                ("现有技术", 0.9),
                ("查一下", 0.5),
                ("搜索专利", 0.9),
                ("有没有类似的", 0.75),
                ("对比文件", 0.9),
                ("查新", 0.85),
                ("专利检索", 1.0),
                ("prior art", 0.9),
                ("patent search", 0.9),
            ],
        );

        // 编程关键词
        let coding_score = self.calc_keyword_score(
            text_lower,
            &[
                ("写代码", 0.9),
                ("编程", 0.85),
                ("写个函数", 0.9),
                ("开发", 0.6),
                ("实现一个", 0.7),
                ("bug", 0.7),
                ("调试", 0.7),
                ("部署", 0.5),
                ("接口", 0.5),
                ("write code", 0.9),
                ("implement", 0.7),
                ("debug", 0.7),
            ],
        );

        let scores = vec![
            (IntentType::DraftFull, draft_score),
            (IntentType::RespondOA, oa_score),
            (IntentType::Search, search_score),
            (IntentType::Coding, coding_score),
        ];

        let best = scores
            .into_iter()
            .filter(|(_, s)| *s > 0.0)
            .max_by(|a, b| a.1.partial_cmp(&b.1).unwrap())?;

        if best.1 >= 0.5 {
            Some(IntentResult {
                intent: best.0,
                confidence: best.1,
                source: IntentSource::Keyword,
                extracted: None,
            })
        } else {
            None
        }
    }

    fn calc_keyword_score(&self, text: &str, keywords: &[(&str, f64)]) -> f64 {
        let mut max_score = 0.0;
        for (keyword, weight) in keywords {
            if text.contains(keyword) {
                if *weight > max_score {
                    max_score = *weight;
                }
            }
        }
        max_score
    }

    // ========================================================================
    // Step 3: 闲聊/帮助
    // ========================================================================

    fn match_chitchat(&self, content: &str) -> Option<String> {
        let text = content.trim().to_lowercase();
        let text_str = text.as_str();

        match text_str {
            "你好" | "hello" | "hi" | "嗨" | "hey" => Some(
                "您好！我是 YunPat 专利智能助手。\n\n\
                 我可以帮您：\n\
                 • 撰写专利申请（说明书、权利要求、摘要）\n\
                 • 答复审查意见\n\
                 • 现有技术检索\n\
                 • 专利组合分析\n\
                 • 编程开发任务\n\n\
                 您可以直接描述需求，或使用 /help 查看命令列表。"
                    .to_string(),
            ),
            "帮助" | "help" | "你能做什么" | "你能干什么" | "功能" => Some(
                "YunPat 支持以下功能：\n\n\
                 📝 专利撰写\n\
                 /draft   启动完整专利撰写流程\n\
                 /claims  仅撰写/修改权利要求\n\
                 /spec    仅撰写说明书\n\n\
                 📋 审查意见答复\n\
                 /oa      启动OA答复工作流\n\n\
                 🔍 专利检索\n\
                 /search  现有技术检索\n\n\
                 📊 专利分析\n\
                 /analyze 专利组合分析\n\n\
                 💻 编程开发\n\
                 /code    编程任务\n\n\
                 您也可以直接用自然语言描述需求。"
                    .to_string(),
            ),
            "谢谢" | "感谢" | "thanks" | "thank you" => {
                Some("不客气！有需要随时找我。".to_string())
            }
            _ => None,
        }
    }

    // ========================================================================
    // Step 4: LLM 兜底意图识别
    // ========================================================================

    async fn llm_classify(&self, content: &str) -> Result<IntentResult, String> {
        #[derive(Serialize)]
        struct ChatRequest {
            model: String,
            messages: Vec<ChatMessage>,
            temperature: f64,
            max_tokens: i32,
        }

        #[derive(Serialize, Deserialize)]
        struct ChatMessage {
            role: String,
            content: String,
        }

        #[derive(Deserialize)]
        struct ChatResponse {
            choices: Vec<Choice>,
        }

        #[derive(Deserialize)]
        struct Choice {
            message: ChoiceMessage,
        }

        #[derive(Deserialize)]
        struct ChoiceMessage {
            content: String,
        }

        let system_prompt = r#"你是 YunPat 专利智能助手系统的意图分类器。根据用户输入，判断其意图类型。

支持的意图类型：
- DRAFT_FULL: 完整专利撰写（需要写说明书、权利要求、摘要等）
- DRAFT_CLAIMS: 仅撰写或修改权利要求
- DRAFT_SPEC: 仅撰写说明书
- RESPOND_OA: 答复审查意见通知书
- SEARCH: 现有技术检索/专利检索
- ANALYZE_PORTFOLIO: 专利组合分析
- CODING: 编程开发需求（写代码、开发功能、调试等）
- CHITCHAT: 闲聊、问候、无关专利业务的话题

回复格式（JSON）：
{"intent": "意图类型", "confidence": 置信度0-1, "keywords": ["关键词列表"]}

注意：
- 如果用户提到"写代码"、"开发"、"实现"、"编程"等，应识别为 CODING
- 如果用户提到"审查意见"、"OA"、"驳回"、"创造性"，应识别为 RESPOND_OA
- 如果只说"帮我写个..."且涉及专利/技术方案，识别为 DRAFT_FULL
- 如果是问好、闲聊，识别为 CHITCHAT"#;

        let request = ChatRequest {
            model: self.llm_model.clone(),
            messages: vec![
                ChatMessage {
                    role: "system".to_string(),
                    content: system_prompt.to_string(),
                },
                ChatMessage {
                    role: "user".to_string(),
                    content: content.to_string(),
                },
            ],
            temperature: 0.1, // 低温度，意图分类不需要创造性
            max_tokens: 100,
        };

        let url = format!("{}/chat/completions", self.llm_base_url);
        let response = self
            .http_client
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.llm_api_key))
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await
            .map_err(|e| format!("LLM request failed: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(format!("LLM API error {}: {}", status, body));
        }

        let chat_response: ChatResponse = response
            .json()
            .await
            .map_err(|e| format!("LLM response parse error: {}", e))?;

        let content = chat_response
            .choices
            .first()
            .and_then(|c| Some(c.message.content.clone()))
            .ok_or("No response from LLM")?;

        debug!(llm_response = %content, "LLM 意图识别原始响应");

        // 解析 JSON 响应
        let parsed: serde_json::Value = serde_json::from_str(&content)
            .unwrap_or_else(|_| serde_json::json!({"intent": "CLARIFY", "confidence": 0.3}));

        let intent_str = parsed["intent"].as_str().unwrap_or("CLARIFY");
        let confidence = parsed["confidence"].as_f64().unwrap_or(0.5);

        let intent = match intent_str {
            "DRAFT_FULL" => IntentType::DraftFull,
            "DRAFT_CLAIMS" => IntentType::DraftClaims,
            "DRAFT_SPEC" => IntentType::DraftSpec,
            "RESPOND_OA" => IntentType::RespondOA,
            "SEARCH" => IntentType::Search,
            "ANALYZE_PORTFOLIO" => IntentType::AnalyzePortfolio,
            "CODING" => IntentType::Coding,
            "CHITCHAT" => IntentType::ChitChat,
            _ => IntentType::Clarify,
        };

        Ok(IntentResult {
            intent,
            confidence,
            source: IntentSource::LLM,
            extracted: Some(parsed),
        })
    }
}

// ============================================================================
// 文件信号（工作区扫描）
// ============================================================================

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FileSignalType {
    OfficeAction,
    TechnicalDisclosure,
    PatentDraft,
    SearchReport,
    ReferenceDocument,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct FileSignal {
    pub path: String,
    pub filename: String,
    pub extension: String,
    pub mime_type: String,
    pub signal_type: FileSignalType,
    pub confidence: f64,
}

/// 扫描工作区目录，根据文件名模式推断文件信号
pub fn scan_workspace_files(dir_path: &str) -> Vec<FileSignal> {
    let mut signals = Vec::new();
    let path = std::path::Path::new(dir_path);

    if !path.exists() || !path.is_dir() {
        return signals;
    }

    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            let file_path = entry.path();
            if !file_path.is_file() {
                continue;
            }

            let filename = file_path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();
            let filename_lower = filename.to_lowercase();
            let extension = file_path
                .extension()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string()
                .to_lowercase();

            let mime_type = match extension.as_str() {
                "pdf" => "application/pdf",
                "docx" | "doc" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "txt" => "text/plain",
                "md" => "text/markdown",
                _ => "application/octet-stream",
            };

            let (signal_type, confidence) = if filename_lower.contains("审查意见")
                || filename_lower.contains("office action")
                || filename_lower.contains("notification")
            {
                (FileSignalType::OfficeAction, 0.95)
            } else if filename_lower.contains("交底书")
                || filename_lower.contains("技术方案")
                || filename_lower.contains("disclosure")
                || filename_lower.contains("invention")
            {
                (FileSignalType::TechnicalDisclosure, 0.90)
            } else if filename_lower.contains("权利要求")
                || filename_lower.contains("claims")
            {
                (FileSignalType::PatentDraft, 0.85)
            } else if filename_lower.contains("检索报告")
                || filename_lower.contains("search report")
            {
                (FileSignalType::SearchReport, 0.70)
            } else if matches!(extension.as_str(), "pdf" | "docx" | "doc") {
                (FileSignalType::ReferenceDocument, 0.30)
            } else {
                continue;
            };

            signals.push(FileSignal {
                path: file_path.to_string_lossy().to_string(),
                filename,
                extension,
                mime_type: mime_type.to_string(),
                signal_type,
                confidence,
            });
        }
    }

    // 按置信度降序排列
    signals.sort_by(|a, b| b.confidence.partial_cmp(&a.confidence).unwrap());
    signals
}
