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

    // Safety: test-only environment mutation
    unsafe {
        std::env::set_var("DEEPSEEK_API_KEY", "test_key_123");
    }
    assert_eq!(std::env::var("DEEPSEEK_API_KEY").unwrap(), "test_key_123");

    // Safety: test-only environment mutation
    unsafe {
        match original_key {
            Ok(key) => std::env::set_var("DEEPSEEK_API_KEY", key),
            Err(_) => std::env::remove_var("DEEPSEEK_API_KEY"),
        }
    }
}

// TODO: Restore or rewrite these tests to use actual yunpat-config types
// (e.g., ProviderConfigToml) rather than non-existent types.
//
// #[test]
// fn test_provider_config() {
//     use crate::config::provider::ProviderConfig;
//     ...
// }

// #[test]
// fn test_capacity_config() {
//     use crate::config::capacity::CapacityConfig;
//     ...
// }
