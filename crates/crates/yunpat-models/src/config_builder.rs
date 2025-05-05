use crate::types::*;
use anyhow::Result;

/// 从 TUI Config 构建 ModelProviderConfig。
///
/// 这个模块提供了从现有配置系统到 yunpat-models 配置的桥梁。
pub struct ModelProviderConfigBuilder;

impl ModelProviderConfigBuilder {
    /// 从环境变量和现有配置创建 ModelProviderConfig。
    pub fn from_env() -> Result<ModelProviderConfig> {
        let mut providers = Vec::new();

        // DeepSeek provider
        if let (Some(api_key), base_url) = (
            std::env::var("DEEPSEEK_API_KEY").ok(),
            std::env::var("DEEPSEEK_BASE_URL")
                .unwrap_or_else(|_| "https://api.deepseek.com/v1".to_string()),
        ) {
            providers.push(ProviderConfig {
                id: "deepseek".to_string(),
                name: "DeepSeek".to_string(),
                base_url,
                api_key: Some(api_key),
                enabled: true,
                models: vec![
                    ModelConfig {
                        model_id: "deepseek-v4-pro".to_string(),
                        model_type: ModelType::Chat,
                        max_tokens: Some(8192),
                        context_window: Some(1_000_000),
                        capabilities: vec!["chat".to_string(), "reasoning".to_string()],
                    },
                    ModelConfig {
                        model_id: "deepseek-v4-flash".to_string(),
                        model_type: ModelType::Chat,
                        max_tokens: Some(8192),
                        context_window: Some(1_000_000),
                        capabilities: vec!["chat".to_string()],
                    },
                ],
            });
        }

        // OpenAI provider (if OPENAI_API_KEY is set)
        if let (Some(api_key), base_url) = (
            std::env::var("OPENAI_API_KEY").ok(),
            std::env::var("OPENAI_BASE_URL")
                .unwrap_or_else(|_| "https://api.openai.com/v1".to_string()),
        ) {
            providers.push(ProviderConfig {
                id: "openai".to_string(),
                name: "OpenAI".to_string(),
                base_url,
                api_key: Some(api_key),
                enabled: true,
                models: vec![ModelConfig {
                    model_id: "gpt-4".to_string(),
                    model_type: ModelType::Chat,
                    max_tokens: Some(8192),
                    context_window: Some(128_000),
                    capabilities: vec!["chat".to_string()],
                }],
            });
        }

        // 智谱 AI (if ZHIPU_API_KEY is set)
        if let Ok(api_key) = std::env::var("ZHIPU_API_KEY") {
            providers.push(ProviderConfig {
                id: "zhipu".to_string(),
                name: "智谱 AI".to_string(),
                base_url: "https://open.bigmodel.cn/api/paas/v4".to_string(),
                api_key: Some(api_key),
                enabled: true,
                models: vec![ModelConfig {
                    model_id: "glm-4".to_string(),
                    model_type: ModelType::Chat,
                    max_tokens: Some(4096),
                    context_window: Some(128_000),
                    capabilities: vec!["chat".to_string()],
                }],
            });
        }

        // 豆包 (if DOUBAO_API_KEY is set)
        if let Ok(api_key) = std::env::var("DOUBAO_API_KEY") {
            providers.push(ProviderConfig {
                id: "doubao".to_string(),
                name: "豆包".to_string(),
                base_url: "https://ark.cn-beijing.volces.com/api/v3".to_string(),
                api_key: Some(api_key),
                enabled: true,
                models: vec![ModelConfig {
                    model_id: "doubao-pro-128k".to_string(),
                    model_type: ModelType::Chat,
                    max_tokens: Some(4096),
                    context_window: Some(128_000),
                    capabilities: vec!["chat".to_string()],
                }],
            });
        }

        if providers.is_empty() {
            anyhow::bail!(
                "No model providers configured. Set DEEPSEEK_API_KEY, OPENAI_API_KEY, ZHIPU_API_KEY, or DOUBAO_API_KEY."
            );
        }

        Ok(ModelProviderConfig {
            providers,
            defaults: ModelDefaults {
                chat: "deepseek-v4-pro".to_string(),
                reasoning: "deepseek-v4-pro".to_string(),
                multimodal: "gpt-4-vision-preview".to_string(),
                embedding: "text-embedding-3-small".to_string(),
                rerank: None,
            },
        })
    }

    /// 从 TOML 配置文件创建 ModelProviderConfig。
    pub fn from_toml(value: &toml::Value) -> Result<ModelProviderConfig> {
        let config: ModelProviderConfig = value.clone().try_into()?;
        Ok(config)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    /// 防止环境变量测试并行执行互相干扰
    static ENV_LOCK: Mutex<()> = Mutex::new(());

    fn provider_env_keys() -> [&'static str; 4] {
        [
            "DEEPSEEK_API_KEY",
            "OPENAI_API_KEY",
            "ZHIPU_API_KEY",
            "DOUBAO_API_KEY",
        ]
    }

    /// 保存当前 provider 环境变量，返回旧值供恢复。
    unsafe fn snapshot_provider_env() -> [Option<String>; 4] {
        let keys = provider_env_keys();
        [
            std::env::var(keys[0]).ok(),
            std::env::var(keys[1]).ok(),
            std::env::var(keys[2]).ok(),
            std::env::var(keys[3]).ok(),
        ]
    }

    unsafe fn restore_provider_env(snapshot: [Option<String>; 4]) {
        let keys = provider_env_keys();
        for (key, old) in keys.iter().zip(snapshot) {
            unsafe {
                match old {
                    Some(v) => std::env::set_var(key, v),
                    None => std::env::remove_var(key),
                }
            }
        }
    }

    /// 注意：Rust 默认并行执行测试，环境变量的 snapshot/restore 会互相干扰。
    /// 使用 serial_test 或改为不依赖全局环境状态是更优方案，此处用串行 workaround。
    fn isolate_provider_env() -> [Option<String>; 4] {
        let keys = provider_env_keys();
        let snapshot = unsafe { snapshot_provider_env() };
        for key in &keys {
            unsafe { std::env::remove_var(key) };
        }
        snapshot
    }

    #[test]
    fn test_from_env_no_providers() {
        let _lock = ENV_LOCK.lock().unwrap();
        let snapshot = isolate_provider_env();

        let result = ModelProviderConfigBuilder::from_env();
        assert!(
            result.is_err(),
            "should fail when no provider keys set, got: {result:?}"
        );

        unsafe { restore_provider_env(snapshot) };
    }

    #[test]
    fn test_from_env_with_deepseek() {
        let _lock = ENV_LOCK.lock().unwrap();
        let snapshot = isolate_provider_env();
        unsafe { std::env::set_var("DEEPSEEK_API_KEY", "test-key") };

        let config = ModelProviderConfigBuilder::from_env().unwrap();
        let ds = config
            .providers
            .iter()
            .find(|p| p.id == "deepseek")
            .expect("deepseek provider should exist");
        assert_eq!(ds.models.len(), 2);

        unsafe { restore_provider_env(snapshot) };
    }
}
