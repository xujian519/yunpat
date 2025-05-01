/**
 * @file 事件模型
 */
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct GatewayEvent {
    pub event_id: String,
    pub session_id: String,
    pub event_type: EventType,
    pub timestamp: i64,
    pub payload: serde_json::Value,
}

impl GatewayEvent {
    pub fn new(session_id: String, event_type: EventType, payload: serde_json::Value) -> Self {
        Self {
            event_id: Uuid::new_v4().to_string(),
            session_id,
            event_type,
            timestamp: chrono::Utc::now().timestamp(),
            payload,
        }
    }

    pub fn to_sse_format(&self) -> String {
        let json = serde_json::to_string(self).unwrap_or_else(|e| {
            tracing::error!("Failed to serialize event: {}", e);
            r#"{"error":"serialization_failed"}"#.to_string()
        });
        format!("data: {}\n\n", json)
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum EventType {
    // 原有事件
    Intent,
    Plan,
    HITL,
    Progress,
    Result,
    Error,
    Connected,
    Disconnected,
    // 新增：步骤级别
    StepStart,
    StepComplete,
    StepError,
    // 新增：工作流级别
    WorkflowStart,
    WorkflowDone,
}
