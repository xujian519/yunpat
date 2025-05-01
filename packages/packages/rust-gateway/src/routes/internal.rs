/**
 * @file 内部 API 路由
 * @description 用于 Node.js 适配器调用
 */
use axum::{extract::State, http::StatusCode, response::IntoResponse, Json};
use serde::{Deserialize, Serialize};

use crate::models::{EventType, GatewayEvent};
use crate::AppState;

#[derive(Deserialize)]
pub struct EmitEventRequest {
    pub session_id: String,
    pub event_type: String,
    pub payload: serde_json::Value,
}

#[derive(Serialize)]
pub struct EmitEventResponse {
    pub success: bool,
}

pub async fn emit_event(
    State(state): State<AppState>,
    Json(req): Json<EmitEventRequest>,
) -> impl IntoResponse {
    let event_type = match req.event_type.as_str() {
        "intent" => EventType::Intent,
        "plan" => EventType::Plan,
        "hitl" => EventType::HITL,
        "progress" => EventType::Progress,
        "result" => EventType::Result,
        "error" => EventType::Error,
        "step_start" => EventType::StepStart,
        "step_complete" => EventType::StepComplete,
        "step_error" => EventType::StepError,
        "workflow_start" => EventType::WorkflowStart,
        "workflow_done" => EventType::WorkflowDone,
        _ => EventType::Connected,
    };

    let event = GatewayEvent::new(req.session_id, event_type, req.payload);
    state.broadcaster.publish(event);

    (StatusCode::OK, Json(EmitEventResponse { success: true }))
}

#[derive(Serialize)]
pub struct HealthResponse {
    pub status: &'static str,
    pub version: &'static str,
    pub router_llm: Option<String>,
}

pub async fn health_check() -> impl IntoResponse {
    let router_llm = std::env::var("ROUTER_LLM_MODEL").ok().or_else(|| {
        std::env::var("DEEPSEEK_API_KEY")
            .ok()
            .map(|_| "deepseek-chat".to_string())
    });

    (
        StatusCode::OK,
        Json(HealthResponse {
            status: "healthy",
            version: env!("CARGO_PKG_VERSION"),
            router_llm,
        }),
    )
}
