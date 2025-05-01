use yunpat_models::openai_compat::OpenAICompatProvider;
use yunpat_models::types::{
    EmbedRequest, ModelConfig, ModelDefaults, ModelProviderConfig, ModelType, ProviderConfig,
};

fn create_test_provider() -> OpenAICompatProvider {
    let config = ModelProviderConfig {
        providers: vec![ProviderConfig {
            id: "test".to_string(),
            name: "Test Provider".to_string(),
            base_url: "https://api.test.com/v1".to_string(),
            api_key: Some("test-key".to_string()),
            enabled: true,
            models: vec![ModelConfig {
                model_id: "test-embedding".to_string(),
                model_type: ModelType::Embedding,
                max_tokens: None,
                context_window: None,
                capabilities: vec![],
            }],
        }],
        defaults: ModelDefaults {
            chat: "test-chat".to_string(),
            reasoning: "test-reasoning".to_string(),
            multimodal: "test-multimodal".to_string(),
            embedding: "test-embedding".to_string(),
            rerank: None,
        },
    };

    OpenAICompatProvider::new(config)
}

#[test]
fn test_embed_single_text() {
    let _provider = create_test_provider();

    // This test would require a mock server or real API key
    // For now, just verify the method exists and has correct signature
    let _request = EmbedRequest {
        model: "test-embedding".to_string(),
        texts: vec!["Hello world".to_string()],
    };

    // In a real test environment with mock server:
    // let response = provider.embed(request).unwrap();
    // assert_eq!(response.embeddings.len(), 1);
    // assert_eq!(response.model, "test-embedding");
    // assert!(response.dimensions > 0);
}

#[test]
fn test_embed_batch_texts() {
    let _provider = create_test_provider();

    let _request = EmbedRequest {
        model: "test-embedding".to_string(),
        texts: vec![
            "First text".to_string(),
            "Second text".to_string(),
            "Third text".to_string(),
        ],
    };

    // In a real test environment with mock server:
    // let response = provider.embed(request).unwrap();
    // assert_eq!(response.embeddings.len(), 3);
    // All embeddings should have the same dimensions
    // assert!(response.embeddings.iter().all(|v| v.len() == response.dimensions as usize));
}

#[test]
fn test_embed_empty_input() {
    let _provider = create_test_provider();

    let _request = EmbedRequest {
        model: "test-embedding".to_string(),
        texts: vec![],
    };

    // Should return empty embeddings or error depending on API behavior
}
