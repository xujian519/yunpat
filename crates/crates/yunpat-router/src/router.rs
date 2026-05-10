//! Intent router and keyword-based recognizer.

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

/// Phase-1 keyword-based intent recognizer.
///
/// Uses simple keyword matching to classify user input into patent workflow
/// categories. This will be replaced by LLM-based classification in a later
/// phase.
pub struct IntentRecognizer {
    /// Maps keyword sets to agent IDs.
    rules: Vec<KeywordRule>,
}

struct KeywordRule {
    /// All keywords in this set must be present (AND logic).
    required: Vec<String>,
    /// At least one keyword must be present (OR logic).
    any_of: Vec<String>,
    /// The agent to route to.
    agent_id: String,
}

impl IntentRecognizer {
    pub fn new() -> Self {
        let rules = vec![
            // Research
            KeywordRule {
                required: vec!["研究".into()],
                any_of: vec![
                    "法规".into(),
                    "规则".into(),
                    "案例".into(),
                    "判例".into(),
                    "审查指南".into(),
                    "法律".into(),
                ],
                agent_id: AGENT_RESEARCH.into(),
            },
            // Drafting
            KeywordRule {
                required: vec![],
                any_of: vec![
                    "撰写".into(),
                    "申请".into(),
                    "专利申请".into(),
                    "说明书".into(),
                    "权利要求书".into(),
                    "技术交底书".into(),
                    "发明".into(),
                    "独立权利要求".into(),
                    "从属权利要求".into(),
                    "摘要".into(),
                ],
                agent_id: AGENT_DRAFTING.into(),
            },
            // OA Response
            KeywordRule {
                required: vec![],
                any_of: vec![
                    "审查意见".into(),
                    "Office Action".into(),
                    "OA".into(),
                    "答辩".into(),
                    "驳回".into(),
                    "意见陈述".into(),
                    "审查员".into(),
                    "通知书".into(),
                    "一通".into(),
                    "二通".into(),
                    "修改权利要求".into(),
                ],
                agent_id: AGENT_OA_RESPONSE.into(),
            },
            // Reexamination
            KeywordRule {
                required: vec![],
                any_of: vec![
                    "无效".into(),
                    "无效宣告".into(),
                    "无效请求".into(),
                    "宣告无效".into(),
                    "提出无效".into(),
                    "请求宣告无效".into(),
                    "专利无效".into(),
                ],
                agent_id: AGENT_INVALIDATION.into(),
            },
            // Invalidation
            KeywordRule {
                required: vec![],
                any_of: vec![
                    "无效".into(),
                    "无效宣告".into(),
                    "无效请求".into(),
                    "提无效".into(),
                    "宣告无效".into(),
                    "请求宣告无效".into(),
                    "专利无效".into(),
                    "无效理由".into(),
                    "无效证据".into(),
                ],
                agent_id: AGENT_INVALIDATION.into(),
            },
            // Patent Search
            KeywordRule {
                required: vec![],
                any_of: vec![
                    "检索".into(),
                    "查专利".into(),
                    "现有技术".into(),
                    "对比文件".into(),
                    "先有技术".into(),
                    "新颖性".into(),
                    "查新".into(),
                    "专利号".into(),
                    "CN".into(),
                    "申请号".into(),
                ],
                agent_id: AGENT_SEARCH.into(),
            },
            // Patent Analysis
            KeywordRule {
                required: vec![],
                any_of: vec![
                    "侵权".into(),
                    "侵权分析".into(),
                    "专利分析".into(),
                    "技术特征".into(),
                    "特征对比".into(),
                    "保护范围".into(),
                    "无效分析".into(),
                ],
                agent_id: AGENT_ANALYSIS.into(),
            },
        ];

        Self { rules }
    }

    /// Recognize intent from raw user input. Returns the agent ID with the
    /// highest keyword match score, or `None` if no rule matches.
    pub fn recognize(&self, input: &str) -> Option<(String, f32)> {
        let lower = input.to_lowercase();
        let mut best: Option<(String, f32)> = None;

        for rule in &self.rules {
            let score = self.score_rule(&lower, rule);
            if score > 0.0 && best.as_ref().is_none_or(|(_, s)| score > *s) {
                best = Some((rule.agent_id.clone(), score));
            }
        }

        best
    }

    fn score_rule(&self, input: &str, rule: &KeywordRule) -> f32 {
        // All required keywords must be present.
        for kw in &rule.required {
            if !input.contains(&kw.to_lowercase()) {
                return 0.0;
            }
        }

        // Count matching "any_of" keywords.
        let matched = rule
            .any_of
            .iter()
            .filter(|kw| input.contains(&kw.to_lowercase()))
            .count();

        if matched == 0 && !rule.required.is_empty() {
            // Only required keywords matched, no "any_of" — still valid but lower score.
            return 0.3;
        }

        if matched == 0 {
            return 0.0;
        }

        // Score: ratio of matched keywords, boosted by required keyword presence.
        let base = matched as f32 / rule.any_of.len().max(1) as f32;
        let boost = if rule.required.is_empty() { 1.0 } else { 1.3 };
        (base * boost).min(1.0)
    }
}

impl Default for IntentRecognizer {
    fn default() -> Self {
        Self::new()
    }
}

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
}
