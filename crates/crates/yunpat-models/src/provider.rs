//! ModelProvider trait — unified interface for all LLM providers.

use crate::types::*;
use anyhow::Result;
use futures_core::Stream;
use std::pin::Pin;

/// Unified interface for model providers.
///
/// Supports text chat, multimodal, embedding, and optional rerank.
/// Implementations handle provider-specific API details internally.
pub trait ModelProvider: Send + Sync {
    /// Stream a chat completion response.
    fn chat(&self, request: ChatRequest) -> Pin<Box<dyn Stream<Item = Result<ChatChunk>> + Send>>;

    /// Stream a multimodal (image + text) response.
    fn multimodal(
        &self,
        request: MultimodalRequest,
    ) -> Pin<Box<dyn Stream<Item = Result<ChatChunk>> + Send>>;

    /// Generate embeddings for a batch of texts.
    fn embed(&self, request: EmbedRequest) -> Result<EmbedResponse>;

    /// Rerank documents by relevance to a query.
    /// Returns an error if the provider does not support reranking.
    fn rerank(&self, request: RerankRequest) -> Result<RerankResponse>;

    /// Create a scoped provider view targeting a specific provider.
    fn with_provider(&self, provider_id: &str) -> ProviderView<'_>;

    /// Create a scoped provider view targeting a specific model.
    fn with_model(&self, model_id: &str) -> ProviderView<'_>;

    /// Check if a provider is available.
    fn is_provider_available(&self, provider_id: &str) -> bool;
}

/// A scoped view into the ModelProvider for a specific provider or model.
pub struct ProviderView<'a> {
    provider: &'a dyn ModelProvider,
    provider_id: Option<String>,
    model_id: Option<String>,
}

impl<'a> ProviderView<'a> {
    pub fn new(provider: &'a dyn ModelProvider) -> Self {
        Self {
            provider,
            provider_id: None,
            model_id: None,
        }
    }

    pub fn with_provider(mut self, id: &str) -> Self {
        self.provider_id = Some(id.to_string());
        self
    }

    pub fn with_model(mut self, id: &str) -> Self {
        self.model_id = Some(id.to_string());
        self
    }

    pub fn chat(
        &self,
        mut request: ChatRequest,
    ) -> Pin<Box<dyn Stream<Item = Result<ChatChunk>> + Send>> {
        if let Some(model) = &self.model_id {
            request.model = model.clone();
        }
        self.provider.chat(request)
    }
}
