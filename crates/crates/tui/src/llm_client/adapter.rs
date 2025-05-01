use futures_core::Stream;
use futures_util::StreamExt;
use std::pin::Pin;
use yunpat_agents::context::LlmProvider;
use yunpat_models::provider::ModelProvider;
use yunpat_models::types::{ChatMessage, ChatRequest};

/// 将 `yunpat_models::ModelProvider` 适配为 `yunpat_agents::LlmProvider`。
///
/// 这个适配器允许 Agent 使用统一的接口调用底层模型提供者。
pub struct ModelProviderAdapter<'a> {
    provider: &'a dyn ModelProvider,
    model_id: String,
}

impl<'a> ModelProviderAdapter<'a> {
    pub fn new(provider: &'a dyn ModelProvider, model_id: &str) -> Self {
        Self {
            provider,
            model_id: model_id.to_string(),
        }
    }
}

impl LlmProvider for ModelProviderAdapter<'_> {
    fn chat_stream(
        &self,
        system_prompt: &str,
        user_message: &str,
    ) -> Pin<Box<dyn Stream<Item = Result<String, anyhow::Error>> + Send>> {
        let request = ChatRequest {
            model: self.model_id.clone(),
            messages: vec![
                ChatMessage {
                    role: "system".to_string(),
                    content: serde_json::json!(system_prompt),
                    tool_calls: None,
                    tool_call_id: None,
                },
                ChatMessage {
                    role: "user".to_string(),
                    content: serde_json::json!(user_message),
                    tool_calls: None,
                    tool_call_id: None,
                },
            ],
            temperature: Some(0.7),
            max_tokens: None,
            tools: vec![],
            stream: true,
        };

        let stream = self.provider.chat(request);

        let mapped = stream.map(|chunk| {
            chunk.map(|c| c.delta_content.unwrap_or_default())
        });

        Box::pin(mapped)
    }
}

/// 将 `yunpat_models::ModelProvider` 适配为 `yunpat_agents::EmbeddingProvider`。
pub struct EmbeddingProviderAdapter<'a> {
    provider: &'a dyn ModelProvider,
    model_id: String,
}

impl<'a> EmbeddingProviderAdapter<'a> {
    pub fn new(provider: &'a dyn ModelProvider, model_id: &str) -> Self {
        Self {
            provider,
            model_id: model_id.to_string(),
        }
    }
}

impl yunpat_agents::context::EmbeddingProvider for EmbeddingProviderAdapter<'_> {
    fn embed(&self, texts: Vec<String>) -> anyhow::Result<Vec<Vec<f32>>> {
        use yunpat_models::types::EmbedRequest;
        let request = EmbedRequest {
            model: self.model_id.clone(),
            texts,
        };
        let response = self.provider.embed(request)?;
        Ok(response.embeddings)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use yunpat_models::types::ChatChunk;

    struct MockModelProvider;

    impl ModelProvider for MockModelProvider {
        fn chat(
            &self,
            _request: ChatRequest,
        ) -> Pin<Box<dyn Stream<Item = anyhow::Result<ChatChunk>> + Send>> {
            let chunks = vec![
                Ok(ChatChunk {
                    id: Some("1".to_string()),
                    model: Some("test".to_string()),
                    delta_content: Some("Hello".to_string()),
                    delta_reasoning: None,
                    finish_reason: None,
                    usage: None,
                }),
                Ok(ChatChunk {
                    id: Some("2".to_string()),
                    model: Some("test".to_string()),
                    delta_content: Some(" world".to_string()),
                    delta_reasoning: None,
                    finish_reason: Some("stop".to_string()),
                    usage: None,
                }),
            ];

            Box::pin(futures_util::stream::iter(chunks))
        }

        fn multimodal(
            &self,
            _request: yunpat_models::types::MultimodalRequest,
        ) -> Pin<Box<dyn Stream<Item = anyhow::Result<ChatChunk>> + Send>> {
            unimplemented!()
        }

        fn embed(
            &self,
            _request: yunpat_models::types::EmbedRequest,
        ) -> anyhow::Result<yunpat_models::types::EmbedResponse> {
            unimplemented!()
        }

        fn rerank(
            &self,
            _request: yunpat_models::types::RerankRequest,
        ) -> anyhow::Result<yunpat_models::types::RerankResponse> {
            unimplemented!()
        }

        fn with_provider(
            &self,
            _provider_id: &str,
        ) -> yunpat_models::provider::ProviderView<'_> {
            unimplemented!()
        }

        fn with_model(
            &self,
            _model_id: &str,
        ) -> yunpat_models::provider::ProviderView<'_> {
            unimplemented!()
        }

        fn is_provider_available(&self, _provider_id: &str) -> bool {
            true
        }
    }

    #[tokio::test]
    async fn test_adapter_chat_stream() {
        let mock = MockModelProvider;
        let adapter = ModelProviderAdapter::new(&mock, "test-model");

        let mut stream = adapter.chat_stream("You are a test", "Hello");
        let mut results = Vec::new();

        while let Some(result) = stream.next().await {
            results.push(result.unwrap());
        }

        assert_eq!(results, vec!["Hello", " world"]);
    }
}
