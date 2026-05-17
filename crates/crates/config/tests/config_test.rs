//! Config module tests

use std::path::PathBuf;

#[test]
fn test_config_parsing() {
    let config_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("crates").join("config");
    let config_path = config_dir.join("config.example.toml");

    assert!(config_path.exists(), "config.example.toml should exist");
    let content =
        std::fs::read_to_string(&config_path).expect("Failed to read config.example.toml");
    assert!(
        !content.is_empty(),
        "config.example.toml should not be empty"
    );
}

#[test]
fn test_env_override() {
    let original_key = std::env::var("DEEPSEEK_API_KEY");

    std::env::set_var("DEEPSEEK_API_KEY", "test_key_123");
    assert_eq!(std::env::var("DEEPSEEK_API_KEY").unwrap(), "test_key_123");

    match original_key {
        Some(key) => std::env::set_var("DEEPSEEK_API_KEY", key),
        None => std::env::remove_var("DEEPSEEK_API_KEY"),
    }
}

#[test]
fn test_provider_config() {
    use crate::config::provider::ProviderConfig;

    let config = ProviderConfig {
        name: "deepseek".to_string(),
        display_name: Some("DeepSeek".to_string()),
        api_key_env: Some("DEEPSEEK_API_KEY".to_string()),
        api_key_file: None,
        base_url: Some("https://api.deepseek.com".to_string()),
        enabled: true,
    };

    assert_eq!(config.name, "deepseek");
    assert_eq!(config.display_name, Some("DeepSeek".to_string()));
    assert_eq!(config.api_key_env, Some("DEEPSEEK_API_KEY".to_string()));
    assert_eq!(
        config.base_url,
        Some("https://d-api.deepseek.com".to_string())
    );
    assert!(config.enabled, true);
}

#[test]
fn test_capacity_config() {
    use crate::config::capacity::CapacityConfig;
    use crate::config::capacity::RetryPolicy;

    let retry_policy = RetryPolicy {
        max_attempts: 3,
        base_delay_ms: 500,
        max_delay_ms: 5000,
        backoff_base: 2.0,
    };

    let config = CapacityConfig {
        max_turns_per_minute: 60,
        max_subagents: 10,
        retry_policy,
    };

    assert_eq!(config.max_turns_per_minute, 60);
    assert_eq!(config.max_subagents, 10);
    assert_eq!(config.retry_policy.max_attempts, 3);
    assert_eq!(config.retry_policy.base_delay_ms, 500);
    assert_eq!(config.retry_policy.max_delay_ms, 5000);
    assert_eq!(config.retry_policy.backoff_base, 2.0);
}
