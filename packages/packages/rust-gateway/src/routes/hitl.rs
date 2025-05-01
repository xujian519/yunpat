/**
 * @file HITL 路由
 */
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};

use crate::models::HITLResponse;
use crate::AppState;

pub async fn submit_hitl_response(
    State(state): State<AppState>,
    Path(session_id): Path<String>,
    Json(response): Json<HITLResponse>,
) -> impl IntoResponse {
    // 1. 转发给 Orchestrator 适配器
    // 将 request_id 映射为 checkpoint_id
    let checkpoint_id = &response.request_id;
    let response_json = serde_json::to_value(&response).unwrap_or_else(|_| serde_json::json!({}));

    match state
        .orchestrator_client
        .submit_hitl_response(checkpoint_id, &response_json)
        .await
    {
        Ok(result) => {
            // 2. 同时清理 Gateway 本地的 HITL 状态
            let _ = state.hitl_manager.submit_response(response).await;

            // 3. 如果 Orchestrator 返回了最终结果（含 result 字段），广播 result 事件
            if let Some(result_data) = result.get("result") {
                let event = crate::models::GatewayEvent::new(
                    session_id.clone(),
                    crate::models::EventType::Result,
                    result_data.clone(),
                );
                state.broadcaster.publish(event);
            }

            (StatusCode::OK, Json(result)).into_response()
        }
        Err(e) => {
            // Orchestrator 不可用时，回退到 Gateway 本地处理
            match state.hitl_manager.submit_response(response).await {
                Ok(()) => (StatusCode::OK, "Response submitted (local fallback)").into_response(),
                Err(local_err) => (
                    StatusCode::BAD_REQUEST,
                    format!("Orchestrator: {}; Local: {}", e, local_err),
                )
                    .into_response(),
            }
        }
    }
}

pub async fn get_pending_hitl(
    State(state): State<AppState>,
    Path(session_id): Path<String>,
) -> impl IntoResponse {
    let pending = state.hitl_manager.get_pending(&session_id).await;
    (StatusCode::OK, Json(pending)).into_response()
}
