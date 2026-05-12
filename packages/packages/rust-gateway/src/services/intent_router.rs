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
use metrics::{counter, histogram};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::{Duration, Instant};
use tracing::{debug, info, warn};

// ============================================================================
// 意图类型
// ============================================================================

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq)]
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
            "INIT_WORKSPACE" => IntentType::InitWorkspace,
            _ => IntentType::Clarify,
        }
    }
}

impl std::str::FromStr for IntentType {
    type Err = ();
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        Ok(Self::from(s.to_string()))
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
    /// 直接回复（CODING 等系统意图的提示信息，不经过 Orchestrator）
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
    pub fn new(
        llm_base_url: String,
        llm_api_key: String,
        llm_model: String,
    ) -> Self {
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
        let start = Instant::now();
        let result = self.route_inner(content).await;
        let elapsed = start.elapsed().as_secs_f64();

        // 记录路由延迟指标
        let source = match &result {
            r if r.direct_response.is_some() => "direct_response",
            r if r.skip_intent_recognition && r.intent_override.is_some() => "fast_path",
            r if r.needs_llm => "llm",
            _ => "fallback",
        };
        histogram!("intent_router_latency_seconds", "source" => source).record(elapsed);
        counter!("intent_router_total", "source" => source).increment(1);

        result
    }

    async fn route_inner(&self, content: &str) -> RoutingDecision {
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
            if result.confidence >= Self::KEYWORD_CONFIDENCE_THRESHOLD {
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

        // Step 3: LLM 兜底（~1-2s）
        if self.llm_enabled {
            info!("意图路由：调用 LLM 做意图识别");
            match self.llm_classify(content).await {
                Ok(result) => {
                    info!(intent = ?result.intent, confidence = result.confidence, source = "llm", "LLM 意图识别完成");

                    // CODING 意图直接回复，不经过 Orchestrator
                    if result.intent == IntentType::Coding {
                        return RoutingDecision {
                            skip_intent_recognition: true,
                            intent_override: Some(IntentType::Coding),
                            needs_llm: true,
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
    // Step 2: 关键词规则匹配（增强版：同义词扩展 + 否定检测 + 冲突仲裁）
    // ========================================================================

    /// 否定词列表
    /// 关键词匹配置信度阈值：高于此值直接路由，不调用 LLM
    const KEYWORD_CONFIDENCE_THRESHOLD: f64 = 0.85;
    /// 关键词最低置信度：低于此值的关键词匹配结果被丢弃
    const KEYWORD_MIN_SCORE: f64 = 0.5;

    const NEGATION_KEYWORDS: &'static [&'static str] = &[
        "不", "没有", "别", "不要", "不是", "无需", "不必", "不需要", "没", "未",
        "never", "not", "no", "don't", "without",
    ];

    /// 限定词：当出现时，降低其他意图权重，提升特定意图
    /// 注意：每个关键词只映射一个意图，避免冲突
    const EXCLUSIVE_KEYWORDS: &'static [(&'static str, IntentType, f64)] = &[
        // 权利要求限定
        ("仅权利要求", IntentType::DraftClaims, 0.3),
        ("只要权利要求", IntentType::DraftClaims, 0.3),
        ("只写权利要求", IntentType::DraftClaims, 0.3),
        ("only claims", IntentType::DraftClaims, 0.3),
        ("不要说明书", IntentType::DraftClaims, 0.3),
        // 说明书限定
        ("仅说明书", IntentType::DraftSpec, 0.3),
        ("只要说明书", IntentType::DraftSpec, 0.3),
        ("只写说明书", IntentType::DraftSpec, 0.3),
        ("only specification", IntentType::DraftSpec, 0.3),
        ("不要权利要求", IntentType::DraftSpec, 0.3),
    ];

    fn contains_negation_lower(text_lower: &str) -> bool {
        Self::NEGATION_KEYWORDS.iter().any(|neg| text_lower.contains(neg))
    }

    fn match_keywords(&self, content: &str) -> Option<IntentResult> {
        let text = content.to_lowercase();
        let text_lower = text.as_str();
        let has_negation = Self::contains_negation_lower(text_lower);

        // 专利撰写关键词（扩展同义词和英文变体）
        let draft_score = self.calc_keyword_score(
            text_lower,
            &[
                // 高权重 - 中文
                ("撰写专利", 1.0),
                ("写专利", 1.0),
                ("专利撰写", 1.0),
                ("专利申请", 0.9),
                ("写一份专利", 1.0),
                ("新申请", 0.85),
                ("申请专利", 0.9),
                ("起草专利", 0.95),
                ("编制专利", 0.9),
                ("准备专利申请", 0.9),
                ("全套申请文件", 0.95),
                // 中权重
                ("技术交底书", 0.8),
                ("发明名称", 0.75),
                ("权利要求书", 0.7),
                ("说明书", 0.5),
                ("技术方案", 0.6),
                ("摘要", 0.4),
                ("附图", 0.4),
                ("申请文件", 0.7),
                // 英文
                ("draft patent", 1.0),
                ("write patent", 1.0),
                ("patent application", 0.9),
                ("new patent", 0.85),
                ("prepare patent", 0.9),
                ("file patent", 0.85),
            ],
        );

        // 权利要求专项关键词
        let claims_score = self.calc_keyword_score(
            text_lower,
            &[
                ("权利要求", 1.0),
                ("权要", 0.95),
                ("claims", 0.95),
                ("claim", 0.9),
                ("保护范围", 0.85),
                ("独立权利要求", 1.0),
                ("从属权利要求", 1.0),
                ("权项", 0.9),
                ("修改权利要求", 1.0),
                ("增加从属", 0.9),
                ("only claims", 0.95),
            ],
        );

        // 说明书专项关键词
        let spec_score = self.calc_keyword_score(
            text_lower,
            &[
                ("说明书", 0.9),
                ("具体实施方式", 1.0),
                ("背景技术", 0.9),
                ("技术领域", 0.85),
                ("发明内容", 0.85),
                ("写说明书", 1.0),
                ("撰写说明书", 1.0),
                ("生成说明书", 0.9),
                ("specification", 0.9),
                ("embodiment", 0.85),
                ("only specification", 0.95),
            ],
        );

        // OA 答复关键词（大幅扩展）
        let oa_score = self.calc_keyword_score(
            text_lower,
            &[
                ("审查意见", 1.0),
                ("答复审查", 1.0),
                ("审查意见答复", 1.0),
                ("oa答复", 1.0),
                ("审查员", 0.75),
                ("驳回", 0.7),
                ("第一次审查意见", 1.0),
                ("第二次审查意见", 1.0),
                ("一通", 1.0),
                ("二通", 1.0),
                ("答复期限", 0.85),
                ("创造性", 0.75),
                ("新颖性", 0.75),
                ("实用性", 0.75),
                ("修改权利要求", 0.85),
                ("意见陈述书", 0.9),
                ("审查通知书", 0.95),
                ("驳回决定", 0.9),
                ("答辩", 0.85),
                ("申述", 0.8),
                ("respond to office action", 1.0),
                ("office action", 0.95),
                ("official action", 0.9),
                ("examination opinion", 0.9),
            ],
        );

        // 检索关键词（扩展）
        let search_score = self.calc_keyword_score(
            text_lower,
            &[
                ("检索", 0.9),
                ("现有技术", 0.95),
                ("查一下", 0.6),
                ("搜索专利", 0.95),
                ("有没有类似的", 0.8),
                ("对比文件", 0.95),
                ("查新", 0.9),
                ("专利检索", 1.0),
                ("prior art", 0.95),
                ("patent search", 0.95),
                ("lookup", 0.7),
                ("查找", 0.85),
                ("查询", 0.85),
                ("专利号", 0.7),
                ("申请号", 0.7),
                ("新颖性检索", 0.95),
                ("可专利性检索", 0.95),
            ],
        );

        // 分析类关键词（新增）
        let analysis_score = self.calc_keyword_score(
            text_lower,
            &[
                ("专利组合", 1.0),
                ("专利分析", 1.0),
                ("技术布局", 0.95),
                ("专利地图", 0.95),
                ("fTO", 0.9),
                ("自由实施", 0.9),
                ("侵权分析", 1.0),
                ("侵权判定", 1.0),
                ("技术特征对比", 0.95),
                ("侵权风险", 0.95),
                ("被控侵权", 0.9),
                ("创新评估", 1.0),
                ("可专利性评估", 1.0),
                ("创新性", 0.9),
                ("商标分析", 1.0),
                ("商标注册", 0.9),
            ],
        );

        // 编程关键词
        let coding_score = self.calc_keyword_score(
            text_lower,
            &[
                ("写代码", 0.95),
                ("编程", 0.9),
                ("写个函数", 0.95),
                ("开发", 0.65),
                ("实现一个", 0.75),
                ("bug", 0.75),
                ("调试", 0.75),
                ("部署", 0.55),
                ("接口", 0.55),
                ("write code", 0.95),
                ("implement", 0.75),
                ("debug", 0.75),
                ("function", 0.8),
                ("programming", 0.9),
                ("coding", 0.9),
            ],
        );

        // 收集所有候选意图及其分数
        let mut scores: Vec<(IntentType, f64)> = vec![
            (IntentType::DraftFull, draft_score),
            (IntentType::DraftClaims, claims_score),
            (IntentType::DraftSpec, spec_score),
            (IntentType::RespondOA, oa_score),
            (IntentType::Search, search_score),
            (IntentType::AnalyzePortfolio, analysis_score),
            (IntentType::Coding, coding_score),
        ];

        // 否定检测：如果存在否定词，降低涉及被否定意图的分数
        if has_negation {
            scores = scores
                .into_iter()
                .map(|(intent, score)| {
                    let adjusted = self.apply_negation_penalty(text_lower, intent, score);
                    (intent, adjusted)
                })
                .collect();
        }

        // 限定词检测：含"仅"/"只要"/"只写"等词时，调整分数
        for (keyword, preferred_intent, boost) in Self::EXCLUSIVE_KEYWORDS {
            if text_lower.contains(keyword) {
                scores = scores
                    .into_iter()
                    .map(|(intent, score)| {
                        if intent == *preferred_intent {
                            (intent, (score + boost).min(1.0))
                        } else if intent == IntentType::DraftFull {
                            // 降低完整撰写的分数，让用户意图偏向子类型
                            (intent, score * 0.3)
                        } else {
                            (intent, score)
                        }
                    })
                    .collect();
            }
        }

        // 找到最高分
        let best = scores
            .into_iter()
            .filter(|(_, s)| *s > 0.0)
            .max_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal))?;

        if best.1 >= Self::KEYWORD_MIN_SCORE {
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

    /// 否定惩罚：检测 "不要写权利要求" 这类表达
    fn apply_negation_penalty(&self, text: &str, intent: IntentType, score: f64) -> f64 {
        let negated_patterns: Vec<(&str, IntentType)> = vec![
            ("不要权利要求", IntentType::DraftClaims),
            ("不写权利要求", IntentType::DraftClaims),
            ("不用权利要求", IntentType::DraftClaims),
            ("不要说明书", IntentType::DraftSpec),
            ("不写说明书", IntentType::DraftSpec),
            ("不用说明书", IntentType::DraftSpec),
            ("不要撰写", IntentType::DraftFull),
            ("不申请", IntentType::DraftFull),
        ];

        for (pattern, affected_intent) in negated_patterns {
            if text.contains(pattern) && intent == affected_intent {
                return score * 0.2;
            }
        }

        score
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
    // Step 4: LLM 兜底意图识别
    // =======================================================================

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

回复格式（JSON）：
{"intent": "意图类型", "confidence": 置信度0-1, "keywords": ["关键词列表"]}

注意：
- 如果用户提到"写代码"、"开发"、"实现"、"编程"等，应识别为 CODING
- 如果用户提到"审查意见"、"OA"、"驳回"、"创造性"，应识别为 RESPOND_OA
- 如果只说"帮我写个..."且涉及专利/技术方案，识别为 DRAFT_FULL"#;

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
