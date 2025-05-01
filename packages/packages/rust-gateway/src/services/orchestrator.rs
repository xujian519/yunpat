/**
 * @file Orchestrator 客户端
 * @description 调用 Node.js Orchestrator 服务
 */
use reqwest::Client;
use serde::Deserialize;
use std::time::Duration;

#[derive(Clone)]
pub struct OrchestratorClient {
    client: Client,
    base_url: String,
    timeout: Duration,
}

#[derive(Debug, Deserialize)]
struct OrchestrateResponse {
    pub success: bool,
    pub result: Option<serde_json::Value>,
    pub error: Option<String>,
}

impl OrchestratorClient {
    pub fn new(base_url: String) -> Self {
        let client = Client::builder()
            .no_proxy()
            .build()
            .expect("Failed to build HTTP client - this should never fail with default settings");

        Self {
            client,
            base_url,
            timeout: Duration::from_secs(300),
        }
    }

    /// 原有简单调用（向后兼容）
    pub async fn orchestrate(
        &self,
        session_id: String,
        message: String,
    ) -> Result<serde_json::Value, String> {
        self.orchestrate_with_payload(serde_json::json!({
            "session_id": session_id,
            "message": message,
        }))
        .await
    }

    /// 带完整 payload 的调用（支持 intent_override 等）
    pub async fn orchestrate_with_payload(
        &self,
        payload: serde_json::Value,
    ) -> Result<serde_json::Value, String> {
        let url = format!("{}/internal/orchestrate", self.base_url);

        let response = self
            .client
            .post(&url)
            .json(&payload)
            .timeout(self.timeout)
            .send()
            .await
            .map_err(|e| format!("HTTP error: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("HTTP status: {}", response.status()));
        }

        let orchestrate_response: OrchestrateResponse = response
            .json()
            .await
            .map_err(|e| format!("JSON error: {}", e))?;

        if !orchestrate_response.success {
            return Err(orchestrate_response
                .error
                .unwrap_or_else(|| "Unknown error".to_string()));
        }

        Ok(orchestrate_response.result.unwrap_or_default())
    }

    pub async fn health_check(&self) -> Result<bool, String> {
        let url = format!("{}/internal/health", self.base_url);

        let response = self
            .client
            .get(&url)
            .timeout(Duration::from_secs(5))
            .send()
            .await
            .map_err(|e| format!("HTTP error: {}", e))?;

        Ok(response.status().is_success())
    }

    /// 转发 HITL 响应给 Orchestrator 适配器
    pub async fn submit_hitl_response(
        &self,
        checkpoint_id: &str,
        response: &serde_json::Value,
    ) -> Result<serde_json::Value, String> {
        let url = format!("{}/internal/hitl/{}", self.base_url, checkpoint_id);

        let resp = self
            .client
            .post(&url)
            .json(response)
            .timeout(self.timeout)
            .send()
            .await
            .map_err(|e| format!("HTTP error: {}", e))?;

        if !resp.status().is_success() {
            return Err(format!("HTTP status: {}", resp.status()));
        }

        resp.json::<serde_json::Value>()
            .await
            .map_err(|e| format!("JSON error: {}", e))
    }
}
