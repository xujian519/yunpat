//! 文本嵌入工具 - 基于 BGE-M3 模型
//!
//! 通过 HTTP API 调用本地 BGE-M3 服务（MLX 加速）
//! 支持 OpenAI 兼容的 /v1/embeddings 接口

use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};

/// 默认嵌入服务地址
const DEFAULT_EMBEDDING_URL: &str = "http://localhost:8009/v1/embeddings";
const DEFAULT_MODEL: &str = "bge-m3-mlx-8bit";
/// BGE-M3 输出维度
pub const EMBEDDING_DIM: usize = 1024;
/// 批量嵌入最大条数
const MAX_BATCH_SIZE: usize = 32;

/// Embedding API 请求
#[derive(Serialize)]
struct EmbeddingRequest {
    model: String,
    input: Input,
}

/// 支持单条和批量输入
#[derive(Serialize)]
#[serde(untagged)]
enum Input {
    Single(String),
    Batch(Vec<String>),
}

/// Embedding API 响应
#[derive(Deserialize)]
struct EmbeddingResponse {
    data: Vec<EmbeddingData>,
    #[allow(dead_code)]
    model: String,
    #[allow(dead_code)]
    usage: EmbeddingUsage,
}

#[derive(Deserialize)]
struct EmbeddingData {
    embedding: Vec<f32>,
    index: i32,
}

#[derive(Deserialize)]
struct EmbeddingUsage {
    #[allow(dead_code)]
    prompt_tokens: i64,
    #[allow(dead_code)]
    total_tokens: i64,
}

/// 嵌入客户端配置
#[derive(Debug)]
pub struct EmbeddingClient {
    base_url: String,
    api_key: String,
    model: String,
    http: reqwest::Client,
}

impl Default for EmbeddingClient {
    fn default() -> Self {
        Self {
            base_url: DEFAULT_EMBEDDING_URL.to_string(),
            api_key: String::new(),
            model: DEFAULT_MODEL.to_string(),
            http: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .pool_max_idle_per_host(4)
                .build()
                .unwrap_or_else(|_| reqwest::Client::new()),
        }
    }
}

impl EmbeddingClient {
    /// 创建客户端（仅限 localhost/内网地址）
    pub fn new(base_url: &str, api_key: &str, model: &str) -> Self {
        Self {
            base_url: base_url.to_string(),
            api_key: api_key.to_string(),
            model: model.to_string(),
            http: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .pool_max_idle_per_host(4)
                .build()
                .unwrap_or_else(|_| reqwest::Client::new()),
        }
    }

    /// 从环境变量构建客户端
    pub fn from_env() -> Self {
        Self {
            base_url: std::env::var("EMBEDDING_BASE_URL")
                .unwrap_or_else(|_| DEFAULT_EMBEDDING_URL.to_string()),
            api_key: std::env::var("EMBEDDING_API_KEY")
                .unwrap_or_else(|_| std::env::var("OMLX_API_KEY").unwrap_or_default()),
            model: std::env::var("EMBEDDING_MODEL").unwrap_or_else(|_| DEFAULT_MODEL.to_string()),
            http: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .pool_max_idle_per_host(4)
                .build()
                .unwrap_or_else(|_| reqwest::Client::new()),
        }
    }

    /// 嵌入单条文本
    pub async fn embed(&self, text: &str) -> Result<Vec<f32>> {
        let results = self.embed_batch(&[text.to_string()]).await?;
        results
            .into_iter()
            .next()
            .ok_or_else(|| anyhow!("No embedding returned"))
    }

    /// 批量嵌入
    pub async fn embed_batch(&self, texts: &[String]) -> Result<Vec<Vec<f32>>> {
        if texts.len() > MAX_BATCH_SIZE {
            return Err(anyhow!(
                "Batch size {} exceeds limit {}",
                texts.len(),
                MAX_BATCH_SIZE
            ));
        }

        let request = EmbeddingRequest {
            model: self.model.clone(),
            input: if texts.len() == 1 {
                Input::Single(texts[0].clone())
            } else {
                Input::Batch(texts.to_vec())
            },
        };

        let response = self
            .http
            .post(&self.base_url)
            .header("Content-Type", "application/json")
            .header("Authorization", format!("Bearer {}", self.api_key))
            .json(&request)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            // 避免在错误信息中泄露完整 URL
            return Err(anyhow!("Embedding API error (status={})", status));
        }

        let result: EmbeddingResponse = response.json().await?;

        // 按 index 排序保证顺序
        let mut data = result.data;
        data.sort_by_key(|d| d.index);

        Ok(data.into_iter().map(|d| d.embedding).collect())
    }
}

/// 计算两个向量的余弦相似度
pub fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    if a.len() != b.len() || a.is_empty() {
        return 0.0;
    }
    let dot: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
    let norm_a: f32 = a.iter().map(|v| v * v).sum::<f32>().sqrt();
    let norm_b: f32 = b.iter().map(|v| v * v).sum::<f32>().sqrt();
    if norm_a == 0.0 || norm_b == 0.0 {
        return 0.0;
    }
    dot / (norm_a * norm_b)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cosine_similarity_identical() {
        let vec = vec![1.0, 2.0, 3.0, 4.0];
        let sim = cosine_similarity(&vec, &vec);
        assert!((sim - 1.0).abs() < 0.001);
    }

    #[test]
    fn test_cosine_similarity_orthogonal() {
        let a = vec![1.0, 0.0];
        let b = vec![0.0, 1.0];
        let sim = cosine_similarity(&a, &b);
        assert!((sim - 0.0).abs() < 0.001);
    }

    #[test]
    fn test_batch_size_limit() {
        let rt = tokio::runtime::Runtime::new().unwrap();
        let texts: Vec<String> = (0..100).map(|i| format!("text {}", i)).collect();
        let result = rt.block_on(async {
            let client = EmbeddingClient::default();
            client.embed_batch(&texts).await
        });
        assert!(result.is_err());
    }

    #[tokio::test]
    #[ignore]
    async fn test_embed_single() {
        let client = EmbeddingClient::from_env();
        let embedding = client.embed("测试文本").await.unwrap();
        assert_eq!(embedding.len(), EMBEDDING_DIM);
    }
}
