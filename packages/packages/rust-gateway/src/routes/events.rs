/**
 * @file 事件流路由 (SSE)
 */
use axum::{
    extract::{Path, State},
    response::IntoResponse,
};

use crate::services::event_stream::sse_handler;
use crate::AppState;

pub async fn events_stream(
    State(state): State<AppState>,
    Path(session_id): Path<String>,
) -> impl IntoResponse {
    sse_handler(State(state.broadcaster), Path(session_id)).await
}
