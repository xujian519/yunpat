//! Shared helpers used across all agent implementations.
//!
//! Eliminates the copy-paste pattern of `llm_generate`, `pass_mark`,
//! keyword confidence scoring, and agent struct boilerplate.

use crate::context::LlmProvider;
use crate::types::{AgentId, Confidence};

// ---------------------------------------------------------------------------
// LLM generation
// ---------------------------------------------------------------------------

/// Stream an LLM response into a String. Returns an error marker on failure.
pub async fn llm_generate(
    provider: &dyn LlmProvider,
    system_prompt: &str,
    user_msg: &str,
) -> String {
    use futures_util::StreamExt;
    let mut stream = provider.chat_stream(system_prompt, user_msg);
    let mut result = String::new();
    while let Some(chunk) = stream.next().await {
        match chunk {
            Ok(text) => result.push_str(&text),
            Err(e) => {
                result.push_str(&format!("\n\n[LLM 生成出错: {}]", e));
                break;
            }
        }
    }
    if result.is_empty() {
        "[LLM 未返回内容]".to_string()
    } else {
        result
    }
}

// ---------------------------------------------------------------------------
// Quality assessment
// ---------------------------------------------------------------------------

/// Return a pass/fail label for the given score and threshold.
pub fn pass_mark(score: f32, threshold: f32) -> &'static str {
    if score >= 8.0 {
        "✓ 优秀"
    } else if score >= threshold {
        "✓ 合格"
    } else {
        "✗ 不达标"
    }
}

// ---------------------------------------------------------------------------
// Keyword-based confidence scoring
// ---------------------------------------------------------------------------

/// Compute a confidence score based on keyword matching against user input.
/// Returns 0.0 when no keywords match.
pub fn keyword_confidence(
    input: &str,
    keywords: &[&str],
    base: f32,
    boost_per_keyword: f32,
    max_boost: f32,
) -> Confidence {
    let lower = input.to_lowercase();
    let matching = keywords
        .iter()
        .filter(|kw| lower.contains(&kw.to_lowercase()))
        .count();
    if matching == 0 {
        return 0.0;
    }
    let boost = (matching as f32 * boost_per_keyword).min(max_boost);
    (base + boost).min(1.0)
}

// ---------------------------------------------------------------------------
// Agent struct boilerplate helpers
// ---------------------------------------------------------------------------

/// Extract `case_id` from the `extra` field of an `AgentInput`.
pub fn extract_case_id(extra: &serde_json::Value) -> Option<String> {
    extra
        .get("case_id")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
}

/// Common struct fields for agent implementations.
pub struct AgentBase {
    pub id: AgentId,
    pub initialized: bool,
    pub llm_provider: Option<Box<dyn LlmProvider>>,
}

impl AgentBase {
    pub fn new(agent_id: &str) -> Self {
        Self {
            id: AgentId(agent_id.to_string()),
            initialized: false,
            llm_provider: None,
        }
    }

    pub fn with_llm(mut self, provider: Box<dyn LlmProvider>) -> Self {
        self.llm_provider = Some(provider);
        self
    }

    pub fn has_llm(&self) -> bool {
        self.llm_provider.is_some()
    }

    pub fn id(&self) -> &AgentId {
        &self.id
    }
}
