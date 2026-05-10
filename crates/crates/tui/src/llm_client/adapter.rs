use futures_util::Stream;
use futures_util::StreamExt;
use std::pin::Pin;
use std::sync::Arc;
use yunpat_agents::context::LlmProvider;
use yunpat_models::provider::ModelProvider;
use yunpat_models::types::{ChatMessage, ChatRequest};

#[allow(dead_code)]
pub struct ModelProviderAdapter<'a> {
    provider: &'a dyn ModelProvider,
    model_id: String,
}

#[allow(dead_code)]
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

        let mapped = stream.map(|chunk| chunk.map(|c| c.delta_content.unwrap_or_default()));

        Box::pin(mapped)
    }
}

#[allow(dead_code)]
pub struct EmbeddingProviderAdapter<'a> {
    provider: &'a dyn ModelProvider,
    model_id: String,
}

#[allow(dead_code)]
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

pub struct LlmClientAdapter {
    client: Arc<dyn crate::llm_client::LlmClient>,
    model_id: String,
    max_tokens: u32,
}

impl LlmClientAdapter {
    pub fn new(client: Arc<dyn crate::llm_client::LlmClient>, model_id: &str) -> Self {
        Self {
            client,
            model_id: model_id.to_string(),
            max_tokens: 8192,
        }
    }

    #[allow(dead_code)]
    pub fn with_max_tokens(mut self, max_tokens: u32) -> Self {
        self.max_tokens = max_tokens;
        self
    }
}

impl Clone for LlmClientAdapter {
    fn clone(&self) -> Self {
        Self {
            client: self.client.clone(),
            model_id: self.model_id.clone(),
            max_tokens: self.max_tokens,
        }
    }
}

impl LlmProvider for LlmClientAdapter {
    fn chat_stream(
        &self,
        system_prompt: &str,
        user_message: &str,
    ) -> Pin<Box<dyn Stream<Item = Result<String, anyhow::Error>> + Send>> {
        use crate::models::{ContentBlock, Message, MessageRequest};

        let max_tokens = self.max_tokens;
        let request = MessageRequest {
            model: self.model_id.clone(),
            messages: vec![Message {
                role: "user".into(),
                content: vec![ContentBlock::Text {
                    text: user_message.to_string(),
                    cache_control: None,
                }],
            }],
            max_tokens,
            system: Some(crate::models::SystemPrompt::Text(system_prompt.to_string())),
            tools: None,
            tool_choice: None,
            metadata: None,
            thinking: None,
            reasoning_effort: None,
            stream: Some(true),
            temperature: Some(0.7),
            top_p: None,
        };

        let client = self.client.clone();
        let (tx, rx) = tokio::sync::mpsc::channel::<Result<String, anyhow::Error>>(64);

        tokio::spawn(async move {
            match client.create_message_stream(request).await {
                Ok(mut stream) => {
                    while let Some(event) = stream.next().await {
                        match event {
                            Ok(crate::models::StreamEvent::ContentBlockDelta { delta, .. }) => {
                                if let crate::models::Delta::TextDelta { text } = &delta {
                                    if !text.is_empty() && tx.send(Ok(text.clone())).await.is_err()
                                    {
                                        break;
                                    }
                                }
                            }
                            Ok(crate::models::StreamEvent::MessageStop) => break,
                            Err(e) => {
                                let _ = tx.send(Err(anyhow::anyhow!("{}", e))).await;
                                break;
                            }
                            _ => {}
                        }
                    }
                }
                Err(e) => {
                    let _ = tx.send(Err(anyhow::anyhow!("{}", e))).await;
                }
            }
        });

        let stream = futures_util::stream::unfold(rx, |mut rx| async move {
            rx.recv().await.map(|item| (item, rx))
        });
        Box::pin(stream)
    }
}

pub struct ArcLlmProviderWrapper(pub Arc<dyn LlmProvider>);

impl LlmProvider for ArcLlmProviderWrapper {
    fn chat_stream(
        &self,
        system_prompt: &str,
        user_message: &str,
    ) -> Pin<Box<dyn Stream<Item = Result<String, anyhow::Error>> + Send>> {
        self.0.chat_stream(system_prompt, user_message)
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

        fn with_provider(&self, _provider_id: &str) -> yunpat_models::provider::ProviderView<'_> {
            unimplemented!()
        }

        fn with_model(&self, _model_id: &str) -> yunpat_models::provider::ProviderView<'_> {
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
