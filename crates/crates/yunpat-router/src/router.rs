//! Intent router and keyword-based recognizer.
//!
//! v2: Enhanced with synonym expansion, negation detection, and conflict resolution.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Well-known agent identifiers for patent workflows.
pub const AGENT_RESEARCH: &str = "research";
pub const AGENT_DRAFTING: &str = "drafting";
pub const AGENT_OA_RESPONSE: &str = "oa-response";
pub const AGENT_REEXAMINATION: &str = "reexamination";
pub const AGENT_INVALIDATION: &str = "invalidation";
pub const AGENT_SEARCH: &str = "search";
pub const AGENT_ANALYSIS: &str = "analysis";
// 新增 Agent 常量
pub const AGENT_INVENTION: &str = "invention";
pub const AGENT_PRIOR_ART_SEARCH: &str = "prior-art-search";
pub const AGENT_SPEC_DRAFTER: &str = "spec-drafter";
pub const AGENT_ABSTRACT_DRAFTER: &str = "abstract-drafter";
pub const AGENT_COMPARISON_REPORT: &str = "comparison-report";
pub const AGENT_FORMAT_CONVERT: &str = "format-convert";
pub const AGENT_IMAGE_UNDERSTANDING: &str = "image-understanding";
pub const AGENT_TECHNICAL_DRAWING: &str = "technical-drawing";
pub const AGENT_SUBJECT_MATTER: &str = "subject-matter";
pub const AGENT_UNITY_CHECK: &str = "unity-check";
pub const AGENT_SPEC_FORMALITY: &str = "spec-formality";
pub const AGENT_TECH_UNIT: &str = "tech-unit";
pub const AGENT_RESEARCHER: &str = "researcher";
pub const AGENT_WRITER: &str = "writer";
pub const AGENT_PATENT_MANAGER: &str = "patent-manager";

/// Result of routing a user input to an agent.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoutingDecision {
    /// The target agent identifier.
    pub agent_id: String,
    /// How the routing was determined.
    pub source: RoutingSource,
    /// Extracted topic or subject (if any).
    pub topic: Option<String>,
}

/// How the routing decision was made.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum RoutingSource {
    /// Explicit slash command (e.g. `/research`).
    ExplicitCommand,
    /// Continuation of an active agent session.
    ContextAssociation,
    /// Keyword-based intent recognition.
    IntentRecognition,
    /// Fallback to default behavior.
    GenericFallback,
}

// ============================================================================
// v2: Enhanced Intent Recognizer
// ============================================================================

/// A single keyword rule with scoring and synonym support.
struct IntentRule {
    /// Human-readable intent name.
    intent_name: &'static str,
    /// Agent ID to route to when this intent matches.
    agent_id: &'static str,
    /// High-confidence keywords (max score 1.0).
    primary_keywords: Vec<&'static str>,
    /// Medium-confidence keywords (max score 0.75).
    secondary_keywords: Vec<&'static str>,
    /// Synonym mappings: canonical -> [synonyms].
    synonyms: Vec<(&'static str, Vec<&'static str>)>,
    /// If true, this rule is suppressed when negation is detected.
    sensitive_to_negation: bool,
    /// Exclusive phrases that strongly boost this intent while suppressing "draft_full".
    exclusive_phrases: Vec<&'static str>,
}

/// Phase-2 keyword-based intent recognizer with synonym expansion,
/// negation detection, and conflict resolution.
pub struct IntentRecognizer {
    rules: Vec<IntentRule>,
    /// Global negation keywords.
    negation_words: Vec<&'static str>,
}

impl IntentRecognizer {
    pub fn new() -> Self {
        let rules = vec![
            // Research
            IntentRule {
                intent_name: "research",
                agent_id: AGENT_RESEARCH,
                primary_keywords: vec!["研究法规", "研究案例", "研究判例", "研究审查指南"],
                secondary_keywords: vec![
                    "法规", "规则", "案例", "判例", "审查指南", "法律", "司法解释",
                    "legal research", "case study", "regulation",
                ],
                synonyms: vec![("研究", vec!["调研", "分析", "梳理", "盘点"])],
                sensitive_to_negation: false,
                exclusive_phrases: vec![],
            },
            // Drafting - Full Patent
            IntentRule {
                intent_name: "drafting",
                agent_id: AGENT_DRAFTING,
                primary_keywords: vec![
                    "撰写专利", "写专利", "专利撰写", "专利申请", "写一份专利", "新申请",
                    "draft patent", "write patent", "patent application", "new patent",
                    "prepare patent", "file patent", "全套申请文件",
                ],
                secondary_keywords: vec![
                    "撰写", "申请", "起草", "编制", "准备", "整理", "完成",
                    "技术交底书", "发明名称", "权利要求书", "说明书", "摘要", "附图",
                    "申请文件", "invention", "patent",
                ],
                synonyms: vec![
                    ("撰写", vec!["写", "起草", "编制", "准备", "整理", "完成"]),
                    ("专利", vec!["专利申请", "发明申请", "patent", "invention"]),
                ],
                sensitive_to_negation: true,
                exclusive_phrases: vec![],
            },
            // Drafting - Claims Only
            IntentRule {
                intent_name: "draft_claims",
                agent_id: AGENT_DRAFTING,
                primary_keywords: vec![
                    "权利要求", "权要", "claims", "claim", "保护范围",
                    "独立权利要求", "从属权利要求", "权项", "修改权利要求", "增加从属",
                    "only claims",
                ],
                secondary_keywords: vec!["修改", "调整", "改动", "变更", "重写", "优化"],
                synonyms: vec![("权利要求", vec!["权要", "权项", "claims", "claim"])],
                sensitive_to_negation: true,
                exclusive_phrases: vec!["仅", "只要", "只写", "only claims", "不要说明书", "只要权利要求"],
            },
            // Drafting - Specification Only
            IntentRule {
                intent_name: "draft_spec",
                agent_id: AGENT_SPEC_DRAFTER,
                primary_keywords: vec![
                    "写说明书", "撰写说明书", "说明书撰写", "生成说明书",
                    "具体实施方式", "背景技术", "技术领域", "发明内容",
                    "specification", "embodiment", "only specification",
                ],
                secondary_keywords: vec!["说明书", "实施例", "描述书", "详细说明"],
                synonyms: vec![("说明书", vec!["specification", "描述书", "详细说明"])],
                sensitive_to_negation: true,
                exclusive_phrases: vec!["仅", "只要", "只写", "only specification", "不要权利要求", "只要说明书"],
            },
            // OA Response
            IntentRule {
                intent_name: "oa_response",
                agent_id: AGENT_OA_RESPONSE,
                primary_keywords: vec![
                    "审查意见", "答复审查", "审查意见答复", "oa答复",
                    "第一次审查意见", "第二次审查意见", "一通", "二通",
                    "意见陈述书", "审查通知书", "驳回决定",
                    "respond to office action", "office action", "official action",
                    "examination opinion", "rejection", "claim rejection",
                ],
                secondary_keywords: vec![
                    "审查员", "驳回", "答复期限", "创造性", "新颖性", "实用性",
                    "修改权利要求", "答辩", "申述", "答复OA", "审查员意见",
                ],
                synonyms: vec![
                    ("审查意见", vec!["OA", "Office Action", "审查通知书", "审查员意见", "official action"]),
                    ("答复", vec!["回复", "答辩", "回应", "申述", "答复审查", "答复OA"]),
                    ("驳回", vec!["reject", "rejection", "不予授权"]),
                ],
                sensitive_to_negation: false,
                exclusive_phrases: vec![],
            },
            // Invalidation / Reexamination
            IntentRule {
                intent_name: "invalidation",
                agent_id: AGENT_INVALIDATION,
                primary_keywords: vec![
                    "无效宣告", "无效请求", "宣告无效", "请求宣告无效",
                    "专利无效", "无效理由", "无效证据",
                ],
                secondary_keywords: vec![
                    "无效", "提无效", "提出无效",
                ],
                synonyms: vec![],
                sensitive_to_negation: false,
                exclusive_phrases: vec![],
            },
            // Patent Search
            IntentRule {
                intent_name: "search",
                agent_id: AGENT_SEARCH,
                primary_keywords: vec![
                    "专利检索", "新颖性检索", "可专利性检索", "patent search",
                ],
                secondary_keywords: vec![
                    "检索", "搜索", "查专利", "现有技术", "对比文件", "先有技术",
                    "新颖性", "查新", "专利号", "申请号", "CN",
                    "prior art", "查一下", "有没有类似的", "lookup", "查找", "查询",
                    "查一下有没有", "查一下有没有类似",
                ],
                synonyms: vec![
                    ("检索", vec!["搜索", "查找", "查询", "查", "search", "look up"]),
                    ("现有技术", vec!["prior art", "对比文件", "先有技术", "参考文献"]),
                    ("查新", vec!["新颖性检索", "专利性检索", "可专利性检索"]),
                ],
                sensitive_to_negation: false,
                exclusive_phrases: vec![],
            },
            // Patent Analysis (portfolio, infringement, innovation, trademark)
            IntentRule {
                intent_name: "analysis",
                agent_id: AGENT_ANALYSIS,
                primary_keywords: vec![
                    "专利组合", "专利分析", "技术布局", "专利地图",
                    "FTO", "自由实施", "侵权分析", "侵权判定", "技术特征对比",
                    "侵权风险", "被控侵权", "创新评估", "可专利性评估",
                    "商标分析", "商标注册", "近似判断", "显著性分析",
                    "值得申请", "能不能申请",
                ],
                secondary_keywords: vec![
                    "侵权", "分析", "评估", "技术特征", "特征对比", "保护范围",
                    "无效分析", "组合分析", "专利价值", "技术分析", "竞争分析",
                    "技术高度", "够不够",
                ],
                synonyms: vec![
                    ("分析", vec!["评估", "研究", "梳理", "盘点"]),
                    ("组合", vec!["portfolio", "集合", "系列"]),
                ],
                sensitive_to_negation: false,
                exclusive_phrases: vec![],
            },
            // Invention Understanding
            IntentRule {
                intent_name: "invention",
                agent_id: AGENT_INVENTION,
                primary_keywords: vec![
                    "交底书分析", "发明理解", "技术方案分析", "发明构思",
                ],
                secondary_keywords: vec![
                    "交底书", "发明", "技术方案", "构思",
                ],
                synonyms: vec![],
                sensitive_to_negation: false,
                exclusive_phrases: vec![],
            },
            // Prior Art Search
            IntentRule {
                intent_name: "prior_art_search",
                agent_id: AGENT_PRIOR_ART_SEARCH,
                primary_keywords: vec![
                    "查新检索", "现有技术检索", "先导技术", "对比文件检索",
                ],
                secondary_keywords: vec!["查新", "现有技术", "对比文件"],
                synonyms: vec![],
                sensitive_to_negation: false,
                exclusive_phrases: vec![],
            },
            // Coding (no agent in router, but recognized to avoid misrouting)
            IntentRule {
                intent_name: "coding",
                agent_id: "",
                primary_keywords: vec![
                    "写代码", "编程", "写个函数", "function", "programming", "coding",
                    "write code", "debug", "爬虫程序", "解析函数",
                ],
                secondary_keywords: vec![
                    "代码", "开发", "实现", "bug", "调试", "接口",
                    "implement", "pdf", "抓取数据",
                ],
                synonyms: vec![],
                sensitive_to_negation: false,
                exclusive_phrases: vec![],
            },

            // Subject Matter Check
            IntentRule {
                intent_name: "subject_matter",
                agent_id: AGENT_SUBJECT_MATTER,
                primary_keywords: vec![
                    "保护客体", "客体检查", "可专利性",
                    "专利法第二条", "专利法第25条",
                ],
                secondary_keywords: vec![],
                synonyms: vec![],
                sensitive_to_negation: false,
                exclusive_phrases: vec![],
            },
            // Unity Check
            IntentRule {
                intent_name: "unity_check",
                agent_id: AGENT_UNITY_CHECK,
                primary_keywords: vec!["单一性检查", "缺乏单一性"],
                secondary_keywords: vec!["单一性"],
                synonyms: vec![],
                sensitive_to_negation: false,
                exclusive_phrases: vec![],
            },
            // Format Check
            IntentRule {
                intent_name: "formality",
                agent_id: AGENT_SPEC_FORMALITY,
                primary_keywords: vec![
                    "格式检查", "形式审查", "格式合规", "说明书格式",
                ],
                secondary_keywords: vec![],
                synonyms: vec![],
                sensitive_to_negation: false,
                exclusive_phrases: vec![],
            },
            // Tech Unit
            IntentRule {
                intent_name: "tech_unit",
                agent_id: AGENT_TECH_UNIT,
                primary_keywords: vec![
                    "技术单元", "最小技术单元", "技术特征划分",
                ],
                secondary_keywords: vec![],
                synonyms: vec![],
                sensitive_to_negation: false,
                exclusive_phrases: vec![],
            },
        ];

        let negation_words = vec![
            "不", "没有", "别", "不要", "不是", "无需", "不必", "不需要", "没", "未",
            "never", "not", "no", "don't", "without",
        ];

        Self { rules, negation_words }
    }

    /// Recognize intent from raw user input. Returns the agent ID with the
    /// highest match score, or `None` if no rule matches.
    pub fn recognize(&self, input: &str) -> Option<(String, f32)> {
        let lower = input.to_lowercase();
        let has_negation = self.detect_negation(&lower);

        let mut candidates: Vec<(&IntentRule, f32)> = Vec::new();

        for rule in &self.rules {
            let score = self.score_rule(&lower, rule, has_negation);
            if score > 0.0 {
                candidates.push((rule, score));
            }
        }

        if candidates.is_empty() {
            return None;
        }

        // Apply conflict resolution: exclusive phrases boost specific sub-intents
        // and suppress the generic "drafting" intent.
        candidates = self.apply_conflict_resolution(&lower, candidates);

        // Pick the highest scoring candidate.
        // Tie-breaker: prefer rules with matching exclusive phrases.
        candidates.sort_by(|a, b| {
            let score_cmp = b.1.partial_cmp(&a.1).unwrap();
            if score_cmp == std::cmp::Ordering::Equal {
                let a_has_exclusive = a.0.exclusive_phrases.iter().any(|p| lower.contains(p));
                let b_has_exclusive = b.0.exclusive_phrases.iter().any(|p| lower.contains(p));
                b_has_exclusive.cmp(&a_has_exclusive)
            } else {
                score_cmp
            }
        });
        let best = candidates.first()?;

        if best.1 >= 0.35 {
            Some((best.0.agent_id.to_string(), best.1))
        } else {
            None
        }
    }

    fn detect_negation(&self, input: &str) -> bool {
        self.negation_words.iter().any(|neg| input.contains(neg))
    }

    fn score_rule(&self, input: &str, rule: &IntentRule, has_negation: bool) -> f32 {
        // 1. Check primary keywords (max 1.0)
        let primary_score = rule
            .primary_keywords
            .iter()
            .filter(|kw| input.contains(kw.to_lowercase().as_str()))
            .map(|_| 1.0f32)
            .fold(0.0f32, f32::max);

        // 2. Check secondary keywords (max 0.75)
        let secondary_score = rule
            .secondary_keywords
            .iter()
            .filter(|kw| input.contains(kw.to_lowercase().as_str()))
            .map(|_| 0.75f32)
            .fold(0.0f32, f32::max);

        // 3. Check synonyms
        let synonym_score = rule
            .synonyms
            .iter()
            .flat_map(|(_, syns)| syns.iter())
            .filter(|syn| input.contains(syn.to_lowercase().as_str()))
            .map(|_| 0.6f32)
            .fold(0.0f32, f32::max);

        let mut score = primary_score.max(secondary_score).max(synonym_score);

        // 4. Negation penalty: if user says "不要写权利要求", suppress drafting/claims.
        if has_negation && rule.sensitive_to_negation {
            let negated = self.check_negated(input, rule.intent_name);
            if negated {
                score *= 0.2;
            }
        }

        score
    }

    /// Check if the input contains a negation pattern specifically targeting this intent.
    fn check_negated(&self, input: &str, intent_name: &str) -> bool {
        let negated_patterns: Vec<(&str, &str)> = vec![
            ("不要权利要求", "draft_claims"),
            ("不写权利要求", "draft_claims"),
            ("不用权利要求", "draft_claims"),
            ("不要说明书", "draft_spec"),
            ("不写说明书", "draft_spec"),
            ("不用说明书", "draft_spec"),
            ("不要撰写", "drafting"),
            ("不申请", "drafting"),
            ("不写专利", "drafting"),
            ("不要写专利", "drafting"),
        ];

        negated_patterns
            .iter()
            .any(|(pattern, target)| input.contains(pattern) && intent_name == *target)
    }

    /// Apply conflict resolution rules.
    fn apply_conflict_resolution<'a>(
        &self,
        input: &str,
        mut candidates: Vec<(&'a IntentRule, f32)>,
    ) -> Vec<(&'a IntentRule, f32)> {
        // Detect exclusive phrases that boost sub-intents (claims/spec) over full draft.
        let has_exclusive = self
            .rules
            .iter()
            .any(|r| r.exclusive_phrases.iter().any(|phrase| input.contains(phrase)));

        if has_exclusive {
            for (rule, score) in &mut candidates {
                // Boost sub-intents that have matching exclusive phrases.
                let has_matching_exclusive = rule
                    .exclusive_phrases
                    .iter()
                    .any(|phrase| input.contains(phrase));
                if has_matching_exclusive {
                    *score = (*score + 0.3).min(1.0);
                }

                // Suppress the generic "drafting" intent when exclusives are present.
                if rule.intent_name == "drafting" {
                    *score *= 0.3;
                }
            }
        }

        candidates
    }
}

impl Default for IntentRecognizer {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// Router
// ============================================================================

/// The main router combining explicit commands, context, and intent recognition.
pub struct Router {
    recognizer: IntentRecognizer,
    /// Currently active agent ID (if any) for context association.
    active_agent: Option<String>,
    /// Maps explicit slash commands to agent IDs.
    command_map: HashMap<&'static str, &'static str>,
}

impl Router {
    pub fn new() -> Self {
        let mut command_map = HashMap::new();
        command_map.insert("research", AGENT_RESEARCH);
        command_map.insert("draft", AGENT_DRAFTING);
        command_map.insert("oa", AGENT_OA_RESPONSE);
        command_map.insert("reexam", AGENT_REEXAMINATION);
        command_map.insert("invalid", AGENT_INVALIDATION);
        command_map.insert("search", AGENT_SEARCH);
        command_map.insert("analysis", AGENT_ANALYSIS);
        // 新增 slash 命令映射
        command_map.insert("invention", AGENT_INVENTION);
        command_map.insert("prior-art", AGENT_PRIOR_ART_SEARCH);
        command_map.insert("spec", AGENT_SPEC_DRAFTER);
        command_map.insert("abstract", AGENT_ABSTRACT_DRAFTER);
        command_map.insert("compare", AGENT_COMPARISON_REPORT);
        command_map.insert("convert", AGENT_FORMAT_CONVERT);
        command_map.insert("image", AGENT_IMAGE_UNDERSTANDING);
        command_map.insert("drawing", AGENT_TECHNICAL_DRAWING);
        command_map.insert("subject", AGENT_SUBJECT_MATTER);
        command_map.insert("unity", AGENT_UNITY_CHECK);
        command_map.insert("formality", AGENT_SPEC_FORMALITY);
        command_map.insert("techunit", AGENT_TECH_UNIT);
        command_map.insert("researcher", AGENT_RESEARCHER);
        command_map.insert("write", AGENT_WRITER);
        command_map.insert("manage", AGENT_PATENT_MANAGER);

        Self {
            recognizer: IntentRecognizer::new(),
            active_agent: None,
            command_map,
        }
    }

    /// Route an explicit slash command to an agent.
    pub fn route_command(&self, command: &str) -> Option<RoutingDecision> {
        self.command_map
            .get(command)
            .map(|&agent_id| RoutingDecision {
                agent_id: agent_id.to_string(),
                source: RoutingSource::ExplicitCommand,
                topic: None,
            })
    }

    /// Route free-form user input using intent recognition.
    pub fn route_input(&self, input: &str) -> RoutingDecision {
        // Level 2: Context association
        if let Some(ref active) = self.active_agent {
            return RoutingDecision {
                agent_id: active.clone(),
                source: RoutingSource::ContextAssociation,
                topic: Some(input.to_string()),
            };
        }

        // Level 3: Intent recognition
        if let Some((agent_id, _score)) = self.recognizer.recognize(input) {
            return RoutingDecision {
                agent_id,
                source: RoutingSource::IntentRecognition,
                topic: Some(input.to_string()),
            };
        }

        // Level 4: Generic fallback
        RoutingDecision {
            agent_id: String::new(),
            source: RoutingSource::GenericFallback,
            topic: Some(input.to_string()),
        }
    }

    /// Set the currently active agent for context association routing.
    pub fn set_active_agent(&mut self, agent_id: Option<String>) {
        self.active_agent = agent_id;
    }

    /// Get the currently active agent ID.
    pub fn active_agent(&self) -> Option<&str> {
        self.active_agent.as_deref()
    }
}

impl Default for Router {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_explicit_command_routing() {
        let router = Router::new();
        let decision = router.route_command("research").unwrap();
        assert_eq!(decision.agent_id, AGENT_RESEARCH);
        assert_eq!(decision.source, RoutingSource::ExplicitCommand);
    }

    #[test]
    fn test_unknown_command() {
        let router = Router::new();
        assert!(router.route_command("unknown").is_none());
    }

    #[test]
    fn test_intent_recognition_research() {
        let recognizer = IntentRecognizer::new();
        let (agent_id, score) = recognizer.recognize("研究相关法规和审查指南").unwrap();
        assert_eq!(agent_id, AGENT_RESEARCH);
        assert!(score > 0.0);
    }

    #[test]
    fn test_intent_recognition_oa() {
        let recognizer = IntentRecognizer::new();
        let (agent_id, _) = recognizer.recognize("收到审查意见需要答辩").unwrap();
        assert_eq!(agent_id, AGENT_OA_RESPONSE);
    }

    #[test]
    fn test_intent_recognition_invalidation() {
        let recognizer = IntentRecognizer::new();
        let (agent_id, _) = recognizer.recognize("对方专利提无效宣告").unwrap();
        assert_eq!(agent_id, AGENT_INVALIDATION);
    }

    #[test]
    fn test_intent_no_match() {
        let recognizer = IntentRecognizer::new();
        assert!(recognizer.recognize("今天天气怎么样").is_none());
    }

    #[test]
    fn test_context_association() {
        let router = Router::new();
        // No active agent — falls through to intent recognition or fallback.
        let decision = router.route_input("随便说点什么");
        assert_eq!(decision.source, RoutingSource::GenericFallback);

        let mut router = Router::new();
        router.set_active_agent(Some(AGENT_RESEARCH.into()));
        let decision = router.route_input("继续分析");
        assert_eq!(decision.agent_id, AGENT_RESEARCH);
        assert_eq!(decision.source, RoutingSource::ContextAssociation);
    }

    #[test]
    fn test_all_commands_registered() {
        let router = Router::new();
        assert!(router.route_command("research").is_some());
        assert!(router.route_command("draft").is_some());
        assert!(router.route_command("oa").is_some());
        assert!(router.route_command("reexam").is_some());
        assert!(router.route_command("invalid").is_some());
        assert!(router.route_command("search").is_some());
        assert!(router.route_command("analysis").is_some());
    }

    #[test]
    fn test_intent_recognition_search() {
        let recognizer = IntentRecognizer::new();
        let (agent_id, score) = recognizer
            .recognize("帮我检索关于Transformer的专利")
            .unwrap();
        assert_eq!(agent_id, AGENT_SEARCH);
        assert!(score > 0.0);
    }

    #[test]
    fn test_intent_recognition_analysis() {
        let recognizer = IntentRecognizer::new();
        let (agent_id, score) = recognizer.recognize("分析这件专利的侵权风险").unwrap();
        assert_eq!(agent_id, AGENT_ANALYSIS);
        assert!(score > 0.0);
    }

    // v2: Enhanced recognizer tests
    #[test]
    fn test_synonym_expansion() {
        let recognizer = IntentRecognizer::new();
        let (agent_id, _) = recognizer.recognize("起草一份专利申请").unwrap();
        assert_eq!(agent_id, AGENT_DRAFTING);
    }

    #[test]
    fn test_english_input() {
        let recognizer = IntentRecognizer::new();
        let (agent_id, _) = recognizer.recognize("draft a patent for my invention").unwrap();
        assert_eq!(agent_id, AGENT_DRAFTING);
    }

    #[test]
    fn test_exclusive_claims() {
        let recognizer = IntentRecognizer::new();
        let (agent_id, score) = recognizer.recognize("只要权利要求，不要说明书").unwrap();
        // With exclusive phrase, claims/spec should beat drafting.
        // Note: at the agent level, both claims and full draft route to AGENT_DRAFTING,
        // so we verify the intent was recognized with high confidence (not fallback).
        assert!(
            score > 0.5,
            "Exclusive phrase should boost sub-intent score above 0.5, got {} for agent {}",
            score,
            agent_id
        );
    }

    #[test]
    fn test_negation_penalty() {
        let recognizer = IntentRecognizer::new();
        // "不要写专利" should suppress drafting
        let result = recognizer.recognize("不要写专利");
        assert!(
            result.is_none() || result.unwrap().0 != AGENT_DRAFTING,
            "Negation should suppress drafting intent"
        );
    }

    #[test]
    fn test_office_action_english() {
        let recognizer = IntentRecognizer::new();
        let (agent_id, _) = recognizer
            .recognize("respond to office action")
            .unwrap();
        assert_eq!(agent_id, AGENT_OA_RESPONSE);
    }

    #[test]
    fn test_prior_art_search() {
        let recognizer = IntentRecognizer::new();
        let (agent_id, _) = recognizer.recognize("查新检索这个技术方案").unwrap();
        assert_eq!(agent_id, AGENT_PRIOR_ART_SEARCH);
    }
}
