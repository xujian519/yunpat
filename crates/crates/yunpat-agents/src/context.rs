//! Agent execution context.

use crate::types::AgentId;
use futures_core::Stream;
use std::pin::Pin;

/// Minimal LLM provider interface for agent use.
///
/// This is a subset of `yunpat_models::ModelProvider` — just the chat stream.
/// Defined here to avoid a circular dependency between `yunpat-agents` and `yunpat-models`.
/// The TUI layer provides a concrete implementation that wraps the real ModelProvider.
pub trait LlmProvider: Send + Sync {
    /// Stream a chat completion. Returns chunks of text content.
    fn chat_stream(
        &self,
        system_prompt: &str,
        user_message: &str,
    ) -> Pin<Box<dyn Stream<Item = Result<String, anyhow::Error>> + Send>>;
}

/// Execution context passed to agents.
pub struct AgentContext {
    /// Session ID for the current conversation.
    pub session_id: String,
    /// Optional case ID if this agent run is associated with a case.
    pub case_id: Option<String>,
    /// The agent that is currently executing (for self-reference).
    pub agent_id: AgentId,
    /// Optional LLM provider for agents that need to call language models.
    pub llm_provider: Option<Box<dyn LlmProvider>>,
}

/// Registration record in the agent registry.
#[derive(Clone)]
pub struct AgentRegistration {
    pub id: AgentId,
    pub name: String,
    pub description: String,
    pub transport: crate::types::Transport,
}

/// Minimal embedding provider interface for semantic search.
///
/// Separated from `LlmProvider` to avoid coupling chat and embedding.
/// The TUI layer provides a concrete adapter wrapping `ModelProvider::embed()`.
pub trait EmbeddingProvider: Send + Sync {
    /// Generate embeddings for a batch of texts.
    /// Returns one embedding vector per input text.
    fn embed(&self, texts: Vec<String>) -> anyhow::Result<Vec<Vec<f32>>>;
}
