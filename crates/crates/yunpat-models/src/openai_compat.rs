//! OpenAI-compatible provider implementation.
//!
//! Covers DeepSeek, Zhipu, Moonshot, Doubao, and local models —
//! all expose OpenAI-compatible chat completion endpoints.

use crate::provider::ModelProvider;
use crate::sse::SseStream;
use crate::types::*;
use anyhow::{Result, bail};
use futures_core::Stream;
use reqwest::Client;
use std::collections::HashMap;
use std::pin::Pin;
use std::sync::Arc;
use tokio::sync::RwLock;

/// An OpenAI-compatible API provider.
pub struct OpenAICompatProvider {
    client: Client,
    providers: Arc<RwLock<HashMap<String, ProviderState>>>,
    config: ModelProviderConfig,
}

struct ProviderState {
    base_url: String,
    api_key: Option<String>,
}

impl OpenAICompatProvider {
    pub fn new(config: ModelProviderConfig) -> Self {
        let mut providers = HashMap::new();
        for pc in &config.providers {
            providers.insert(
                pc.id.clone(),
                ProviderState {
                    base_url: pc.base_url.clone(),
                    api_key: pc.api_key.clone(),
                },
            );
        }
        Self {
            client: Client::new(),
            providers: Arc::new(RwLock::new(providers)),
            config,
        }
    }

    /// Resolve which provider handles a given model.
    fn resolve_provider_for_model(&self, model: &str) -> Option<String> {
        for pc in &self.config.providers {
            for mc in &pc.models {
                if mc.model_id == model {
                    return Some(pc.id.clone());
                }
            }
        }
        // Fallback: use the default chat provider
        for pc in &self.config.providers {
            for mc in &pc.models {
                if mc.model_id == self.config.defaults.chat {
                    return Some(pc.id.clone());
                }
            }
        }
        None
    }
}

impl ModelProvider for OpenAICompatProvider {
    fn chat(&self, request: ChatRequest) -> Pin<Box<dyn Stream<Item = Result<ChatChunk>> + Send>> {
        let model = request.model.clone();
        let providers = self.providers.clone();
        let client = self.client.clone();
        let provider_id = self.resolve_provider_for_model(&model);
        let stream_request = request.stream;

        Box::pin(async_stream::stream! {
            let pid = match provider_id {
                Some(id) => id,
                None => {
                    yield Err(anyhow::anyhow!("no provider for model '{}'", model));
                    return;
                }
            };

            let state = providers.read().await;
            let provider_state = match state.get(&pid) {
                Some(ps) => ps,
                None => {
                    yield Err(anyhow::anyhow!("provider '{}' not found", pid));
                    return;
                }
            };

            let url = format!("{}/chat/completions", provider_state.base_url);
            let mut json_request = match serde_json::to_value(&request) {
                Ok(v) => v,
                Err(e) => {
                    yield Err(anyhow::anyhow!("failed to serialize request: {}", e));
                    return;
                }
            };
            if stream_request {
                json_request["stream"] = serde_json::json!(true);
            }

            let mut req = client.post(&url)
                .json(&json_request);

            if let Some(key) = &provider_state.api_key {
                req = req.bearer_auth(key);
            }
            req = req.header("Accept", "text/event-stream");
            req = req.header("Cache-Control", "no-cache");

            let resp = match req.send().await {
                Ok(r) => r,
                Err(e) => {
                    yield Err(anyhow::anyhow!("request failed: {}", e));
                    return;
                }
            };

            if !resp.status().is_success() {
                let status = resp.status();
                let error_text = match resp.text().await {
                    Ok(t) => t,
                    Err(_) => "(failed to read error body)".to_string(),
                };
                yield Err(anyhow::anyhow!("API request failed with status {}: {}", status, error_text));
                return;
            }

            if !stream_request {
                let text = match resp.text().await {
                    Ok(t) => t,
                    Err(e) => {
                        yield Err(anyhow::anyhow!("failed to read response: {}", e));
                        return;
                    }
                };
                let response_json: serde_json::Value = match serde_json::from_str(&text) {
                    Ok(v) => v,
                    Err(e) => {
                        yield Err(anyhow::anyhow!("failed to parse non-streaming response: {}", e));
                        return;
                    }
                };

                let content = response_json["choices"][0]["message"]["content"]
                    .as_str()
                    .unwrap_or("")
                    .to_string();

                let reasoning = response_json["choices"][0]["message"]["reasoning_content"]
                    .as_str()
                    .map(|s| s.to_string());

                let chunk = ChatChunk {
                    id: response_json["id"].as_str().map(|s| s.to_string()),
                    model: response_json["model"].as_str().map(|s| s.to_string()),
                    delta_content: Some(content),
                    delta_reasoning: reasoning,
                    finish_reason: Some("stop".to_string()),
                    usage: None,
                };
                yield Ok(chunk);
                return;
            }

            let byte_stream = resp.bytes_stream();
            let mut sse_stream = SseStream::new(byte_stream);

            while let Some(sse_result) = sse_stream.next_event_stream().await {
                let sse_event = match sse_result {
                    Ok(e) => e,
                    Err(e) => {
                        yield Err(e);
                        return;
                    }
                };

                if sse_event.data == "[DONE]" {
                    break;
                }
                let data: serde_json::Value = match serde_json::from_str(&sse_event.data) {
                    Ok(v) => v,
                    Err(e) => {
                        tracing::warn!("Failed to parse SSE data as JSON: {} (data: {})", e, sse_event.data);
                        continue;
                    }
                };

                let delta = &data["choices"][0]["delta"];
                let content = delta["content"].as_str().map(|s| s.to_string());
                let reasoning = delta["reasoning_content"].as_str().map(|s| s.to_string());
                let finish_reason = data["choices"][0]["finish_reason"].as_str().map(|s| s.to_string());
                let is_stop = finish_reason.as_ref().map(|r| r == "stop").unwrap_or(false);
                if content.is_none() && reasoning.is_none() && finish_reason.is_none() {
                    continue;
                }

                let chunk = ChatChunk {
                    id: data["id"].as_str().map(|s| s.to_string()),
                    model: data["model"].as_str().map(|s| s.to_string()),
                    delta_content: content,
                    delta_reasoning: reasoning,
                    finish_reason,
                    usage: None,
                };

                yield Ok(chunk);

                if is_stop {
                    break;
                }
            }
        })
    }

    fn multimodal(
        &self,
        request: MultimodalRequest,
    ) -> Pin<Box<dyn Stream<Item = Result<ChatChunk>> + Send>> {
        let messages = vec![ChatMessage {
            role: "user".to_string(),
            content: serde_json::json!({
                "role": "user",
                "content": request.text,
            }),
            tool_calls: None,
            tool_call_id: None,
        }];
        let chat_req = ChatRequest {
            model: request.model,
            messages,
            temperature: request.temperature,
            max_tokens: request.max_tokens,
            tools: vec![],
            stream: true,
        };
        self.chat(chat_req)
    }

    fn embed(&self, request: EmbedRequest) -> Result<EmbedResponse> {
        let providers = self.providers.clone();
        let client = self.client.clone();
        let _config = self.config.clone();

        // Resolve provider for the embedding model
        let provider_id = self.resolve_provider_for_model(&request.model);
        let model = request.model.clone();
        let texts = request.texts.clone();

        // We'll use tokio::runtime::Handle::try_current() or block_on for sync context
        // Since this is a sync method returning Result, we need to block on the async operation
        let runtime = tokio::runtime::Handle::try_current()
            .map_err(|e| anyhow::anyhow!("No tokio runtime available: {}", e))?;

        runtime.block_on(async move {
            let pid = match provider_id {
                Some(id) => id,
                None => bail!("no provider for model '{}'", model),
            };

            let state = providers.read().await;
            let provider_state = match state.get(&pid) {
                Some(ps) => ps,
                None => bail!("provider '{}' not found", pid),
            };

            let url = format!("{}/embeddings", provider_state.base_url);

            // Build the request body
            let body = serde_json::json!({
                "model": model,
                "input": texts,
                "encoding_format": "float"
            });

            let mut req = client.post(&url).json(&body);

            if let Some(key) = &provider_state.api_key {
                req = req.bearer_auth(key);
            }

            let resp = req.send().await?;

            if !resp.status().is_success() {
                let status = resp.status();
                let error_text = resp.text().await?;
                bail!("API request failed with status {}: {}", status, error_text);
            }

            let response_json: serde_json::Value = resp.json().await?;

            // Parse embeddings from response
            let data = response_json["data"]
                .as_array()
                .ok_or_else(|| anyhow::anyhow!("missing 'data' field in embedding response"))?;

            let mut embeddings: Vec<Vec<f32>> = Vec::with_capacity(data.len());
            for item in data {
                let embedding = item["embedding"]
                    .as_array()
                    .ok_or_else(|| anyhow::anyhow!("missing 'embedding' field in response item"))?;

                let vec: Vec<f32> = embedding
                    .iter()
                    .filter_map(|v| v.as_f64().map(|f| f as f32))
                    .collect();

                embeddings.push(vec);
            }

            // Extract dimensions from first embedding
            let dimensions = embeddings.first().map(|v| v.len() as u32).unwrap_or(0);

            // Extract usage info
            let usage = response_json["usage"].clone();
            let prompt_tokens = usage["prompt_tokens"].as_u64().unwrap_or(0) as u32;
            let total_tokens = usage["total_tokens"].as_u64().unwrap_or(0) as u32;

            Ok(EmbedResponse {
                embeddings,
                model: model.clone(),
                dimensions,
                usage: UsageInfo {
                    prompt_tokens,
                    completion_tokens: 0,
                    total_tokens,
                },
            })
        })
    }

    fn rerank(&self, _request: RerankRequest) -> Result<RerankResponse> {
        bail!("rerank not supported by this provider")
    }

    fn with_provider(&self, provider_id: &str) -> crate::provider::ProviderView<'_> {
        crate::provider::ProviderView::new(self).with_provider(provider_id)
    }

    fn with_model(&self, model_id: &str) -> crate::provider::ProviderView<'_> {
        crate::provider::ProviderView::new(self).with_model(model_id)
    }

    fn is_provider_available(&self, provider_id: &str) -> bool {
        self.config
            .providers
            .iter()
            .any(|p| p.id == provider_id && p.enabled)
    }
}
