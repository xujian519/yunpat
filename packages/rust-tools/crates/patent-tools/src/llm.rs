//! LLM 客户端模块

use crate::{Error, Result};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;

/// 辅助函数：用于 serde 跳过序列化 false 值
fn not_true(b: &bool) -> bool {
    !b
}

/// LLM 提供商
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum LlmProvider {
    /// DeepSeek
    DeepSeek,
    /// 通义千问
    Qwen,
    /// OpenAI 兼容
    OpenAI,
}

/// LLM 配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LlmConfig {
    /// 提供商
    pub provider: LlmProvider,
    /// API 端点
    pub api_endpoint: String,
    /// API Key
    pub api_key: String,
    /// 模型名称
    pub model: String,
    /// 温度
    pub temperature: f32,
    /// 最大 Tokens
    pub max_tokens: usize,
    /// 超时时间（秒）
    pub timeout_secs: u64,
}

impl Default for LlmConfig {
    fn default() -> Self {
        Self {
            provider: LlmProvider::DeepSeek,
            api_endpoint: "https://api.deepseek.com".to_string(),
            api_key: String::new(),
            model: "deepseek-chat".to_string(),
            temperature: 0.3,
            max_tokens: 2000,
            timeout_secs: 60,
        }
    }
}

/// LLM 客户端
pub struct LlmClient {
    config: LlmConfig,
    client: Client,
}

impl LlmClient {
    /// 创建新的 LLM 客户端
    pub fn new(config: LlmConfig) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(config.timeout_secs))
            .build()
            .unwrap();

        Self { config, client }
    }

    /// 创建 DeepSeek 客户端
    pub fn deepseek(api_key: String) -> Self {
        Self::new(LlmConfig {
            provider: LlmProvider::DeepSeek,
            api_endpoint: "https://api.deepseek.com".to_string(),
            api_key,
            model: "deepseek-chat".to_string(),
            ..Default::default()
        })
    }

    /// 创建通义千问客户端
    pub fn qwen(api_key: String) -> Self {
        Self::new(LlmConfig {
            provider: LlmProvider::Qwen,
            api_endpoint: "https://dashscope.aliyuncs.com".to_string(),
            api_key,
            model: "qwen-max".to_string(),
            ..Default::default()
        })
    }

    /// 聊天请求
    pub async fn chat(&self, messages: Vec<ChatMessage>) -> Result<ChatResponse> {
        let request = ChatRequest {
            model: self.config.model.clone(),
            messages,
            temperature: Some(self.config.temperature),
            max_tokens: Some(self.config.max_tokens),
            stream: false,
        };

        let endpoint = match self.config.provider {
            LlmProvider::DeepSeek => format!("{}/chat/completions", self.config.api_endpoint),
            LlmProvider::Qwen => format!("{}/compatible-mode/v1/chat/completions", self.config.api_endpoint),
            LlmProvider::OpenAI => format!("{}/v1/chat/completions", self.config.api_endpoint),
        };

        let response = self
            .client
            .post(&endpoint)
            .header("Authorization", format!("Bearer {}", self.config.api_key))
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await?

            .json::<ChatResponse>()
            .await?;

        Ok(response)
    }

    /// 简单聊天（单个提示）
    pub async fn chat_simple(&self, prompt: &str) -> Result<String> {
        let messages = vec![
            ChatMessage {
                role: "user".to_string(),
                content: prompt.to_string(),
            },
        ];

        let response = self.chat(messages).await?;

        if let Some(choice) = response.choices.first() {
            Ok(choice.message.content.clone())
        } else {
            Err(Error::Generation("No response from LLM".to_string()))
        }
    }
}

/// 聊天消息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    /// 角色
    pub role: String,
    /// 内容
    pub content: String,
}

/// 聊天请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatRequest {
    /// 模型名称
    pub model: String,
    /// 消息列表
    pub messages: Vec<ChatMessage>,
    /// 温度
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,
    /// 最大 Tokens
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_tokens: Option<usize>,
    /// 是否流式
    #[serde(skip_serializing_if = "not_true")]
    pub stream: bool,
}

/// 聊天响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatResponse {
    /// ID
    pub id: String,
    /// 对象类型
    pub object: String,
    /// 创建时间
    pub created: u64,
    /// 模型
    pub model: String,
    /// 选择列表
    pub choices: Vec<ChatChoice>,
    /// 使用情况
    pub usage: ChatUsage,
}

/// 聊天选择
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatChoice {
    /// 索引
    pub index: usize,
    /// 消息
    pub message: ChatMessage,
    /// 完成原因
    pub finish_reason: Option<String>,
}

/// 使用情况
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatUsage {
    /// 提示 Tokens
    pub prompt_tokens: usize,
    /// 完成 Tokens
    pub completion_tokens: usize,
    /// 总 Tokens
    pub total_tokens: usize,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_client() {
        let config = LlmConfig::default();
        let client = LlmClient::new(config);

        assert_eq!(client.config.model, "deepseek-chat");
    }

    #[test]
    fn test_deepseek_client() {
        let client = LlmClient::deepseek("test-key".to_string());
        assert_eq!(client.config.model, "deepseek-chat");
    }

    #[test]
    fn test_qwen_client() {
        let client = LlmClient::qwen("test-key".to_string());
        assert_eq!(client.config.model, "qwen-max");
    }
}
