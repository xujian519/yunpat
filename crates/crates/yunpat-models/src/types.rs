//! Core types for the multi-provider ModelProvider.

use serde::{Deserialize, Serialize};

/// A chat completion request.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatRequest {
    pub model: String,
    pub messages: Vec<ChatMessage>,
    #[serde(default)]
    pub temperature: Option<f32>,
    #[serde(default)]
    pub max_tokens: Option<u32>,
    #[serde(default)]
    pub tools: Vec<serde_json::Value>,
    #[serde(default)]
    pub stream: bool,
}

/// A single message in a chat conversation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: serde_json::Value,
    #[serde(default)]
    pub tool_calls: Option<Vec<serde_json::Value>>,
    #[serde(default)]
    pub tool_call_id: Option<String>,
}

/// A chunk of streamed chat response.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatChunk {
    pub id: Option<String>,
    pub model: Option<String>,
    pub delta_content: Option<String>,
    pub delta_reasoning: Option<String>,
    pub finish_reason: Option<String>,
    pub usage: Option<UsageInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageInfo {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
}

/// Multimodal request (image + text).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MultimodalRequest {
    pub model: String,
    pub text: String,
    #[serde(default)]
    pub images: Vec<ImageMessage>,
    #[serde(default)]
    pub temperature: Option<f32>,
    #[serde(default)]
    pub max_tokens: Option<u32>,
}

/// An image in a multimodal request.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageMessage {
    /// Base64-encoded image data or URL.
    pub source: ImageSource,
    pub media_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ImageSource {
    Base64(String),
    Url(String),
    FilePath(String),
}

/// Embedding request.
#[derive(Debug, Clone)]
pub struct EmbedRequest {
    pub model: String,
    pub texts: Vec<String>,
}

/// Embedding response.
#[derive(Debug, Clone)]
pub struct EmbedResponse {
    pub embeddings: Vec<Vec<f32>>,
    pub model: String,
    pub dimensions: u32,
    pub usage: UsageInfo,
}

/// Rerank request (optional capability).
#[derive(Debug, Clone)]
pub struct RerankRequest {
    pub model: String,
    pub query: String,
    pub documents: Vec<String>,
    pub top_n: Option<u32>,
}

/// Rerank response.
#[derive(Debug, Clone)]
pub struct RerankResponse {
    pub results: Vec<RerankResult>,
    pub model: String,
}

#[derive(Debug, Clone)]
pub struct RerankResult {
    pub index: usize,
    pub relevance_score: f32,
    pub document: String,
}

/// Model type classification.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ModelType {
    Chat,
    Reasoning,
    Multimodal,
    Embedding,
    Rerank,
}

/// Configuration for a single model.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelConfig {
    pub model_id: String,
    pub model_type: ModelType,
    #[serde(default)]
    pub max_tokens: Option<u32>,
    #[serde(default)]
    pub context_window: Option<u32>,
    #[serde(default)]
    pub capabilities: Vec<String>,
}

/// Configuration for a provider.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderConfig {
    pub id: String,
    pub name: String,
    pub base_url: String,
    #[serde(default)]
    pub api_key: Option<String>,
    #[serde(default = "default_true")]
    pub enabled: bool,
    pub models: Vec<ModelConfig>,
}

fn default_true() -> bool {
    true
}

/// Top-level model provider configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelProviderConfig {
    pub providers: Vec<ProviderConfig>,
    pub defaults: ModelDefaults,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelDefaults {
    pub chat: String,
    pub reasoning: String,
    pub multimodal: String,
    pub embedding: String,
    #[serde(default)]
    pub rerank: Option<String>,
}
