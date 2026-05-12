/**
 * @file 会话管理路由
 * @description 处理会话创建、消息发送等
 *
 * axum 0.8 要求所有 handler 使用同一个 State 类型
 */
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};

use crate::models::{EventType, GatewayEvent, MessageRole, SessionMessage};
use crate::services::session_state::{analyze_multi_turn, push_intent_frame};
use crate::AppState;

#[derive(Deserialize)]
pub struct CreateSessionRequest {
    pub user_id: String,
}

#[derive(Serialize)]
pub struct CreateSessionResponse {
    pub session_id: String,
    pub user_id: String,
    pub status: String,
}

pub async fn create_session(
    State(state): State<AppState>,
    Json(req): Json<CreateSessionRequest>,
) -> impl IntoResponse {
    let session = state.session_manager.create_session(req.user_id);

    (
        StatusCode::CREATED,
        Json(CreateSessionResponse {
            session_id: session.id,
            user_id: session.user_id,
            status: serde_json::to_value(&session.status)
                .ok()
                .and_then(|v| v.as_str().map(String::from))
                .unwrap_or_default(),
        }),
    )
}

pub async fn get_session(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    match state.session_manager.get_session(&id) {
        Some(session) => (StatusCode::OK, Json(session)).into_response(),
        None => (StatusCode::NOT_FOUND, "Session not found").into_response(),
    }
}

pub async fn delete_session(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    match state.session_manager.delete_session(&id) {
        Some(_) => (StatusCode::NO_CONTENT, "").into_response(),
        None => (StatusCode::NOT_FOUND, "Session not found").into_response(),
    }
}

/// 扩展的消息请求，支持 intent_override
#[derive(Deserialize)]
pub struct SendMessageRequest {
    pub content: String,
    /// TUI/CLI 传入的预设意图（跳过意图识别）
    #[serde(rename = "intent")]
    pub intent_override: Option<String>,
}

pub async fn send_message(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(req): Json<SendMessageRequest>,
) -> impl IntoResponse {
    let content = req.content;

    // 1. 记录用户消息
    state.session_manager.add_message(
        &id,
        SessionMessage {
            role: MessageRole::User,
            content: content.clone(),
            timestamp: chrono::Utc::now().timestamp(),
            metadata: None,
        },
    );

    // 2. 多轮状态分析（Phase 2）
    let multi_turn = if let Some(session) = state.session_manager.get_session(&id) {
        analyze_multi_turn(&content, &session.intent_history)
    } else {
        crate::services::session_state::MultiTurnAnalysis {
            is_correction: false,
            inherited_intent: None,
            is_ellipsis: false,
        }
    };

    if multi_turn.is_correction {
        tracing::info!("Multi-turn: correction detected");
    }
    if let Some(ref inherited) = multi_turn.inherited_intent {
        tracing::info!(inherited_intent = %inherited, "Multi-turn: ellipsis intent inheritance");
    }

    // 3. 意图路由
    let mut decision = if let Some(ref intent_str) = req.intent_override {
        // TUI/CLI 已知意图，直接使用
        tracing::info!(intent = %intent_str, source = "override", "意图：客户端预设");
        crate::services::intent_router::RoutingDecision {
            skip_intent_recognition: true,
            intent_override: Some(intent_str.clone().into()),
            needs_llm: false,
            direct_response: None,
        }
    } else if let Some(ref inherited) = multi_turn.inherited_intent {
        // 多轮省略继承：使用上一轮意图，跳过重新识别
        tracing::info!(inherited_intent = %inherited, source = "multi_turn", "意图：省略继承");
        crate::services::intent_router::RoutingDecision {
            skip_intent_recognition: true,
            intent_override: Some(inherited.clone().into()),
            needs_llm: false,
            direct_response: None,
        }
    } else {
        // Gateway 意图路由器判断
        state.intent_router.route(&content).await
    };

    // 修正信号：如果用户明确修正，且当前路由结果与上一轮相同，强制降级为 CLARIFY
    if multi_turn.is_correction {
        if let Some(ref intent) = decision.intent_override {
            if let Some(session) = state.session_manager.get_session(&id) {
                if let Some(last) = session.intent_history.last() {
                    if last.intent == intent.to_string() && !last.corrected {
                        tracing::warn!("Multi-turn: user corrected but same intent returned, forcing CLARIFY");
                        decision.intent_override = Some(crate::services::intent_router::IntentType::Clarify);
                    }
                }
            }
        }
    }

    // 3.5 更新意图历史栈（Phase 2: 多轮状态追踪）
    if let Some(ref intent) = decision.intent_override {
        let _ = state.session_manager.update_session(&id, |session| {
            push_intent_frame(
                &mut session.intent_history,
                intent.to_string(),
                0.85, // Gateway 层默认置信度
                content.clone(),
                multi_turn.is_correction,
            );
        });
    }

    // 4. 发送意图识别事件给前端
    if let Some(ref intent) = decision.intent_override {
        state.broadcaster.publish(GatewayEvent::new(
            id.clone(),
            EventType::Intent,
            serde_json::json!({
                "intent": intent.to_string(),
                "source": if decision.needs_llm { "llm" } else { "gateway" },
                "skip_call1": decision.skip_intent_recognition,
                "multi_turn": {
                    "is_correction": multi_turn.is_correction,
                    "is_ellipsis": multi_turn.is_ellipsis,
                }
            }),
        ));
    }

    // 5. 处理直接回复（CODING 等系统意图的提示信息）
    if let Some(ref response) = decision.direct_response {
        state.session_manager.add_message(
            &id,
            SessionMessage {
                role: MessageRole::Assistant,
                content: response.clone(),
                timestamp: chrono::Utc::now().timestamp(),
                metadata: None,
            },
        );

        state.broadcaster.publish(GatewayEvent::new(
            id.clone(),
            EventType::Result,
            serde_json::json!({ "result": response }),
        ));

        return (
            StatusCode::OK,
            Json(serde_json::json!({ "response": response })),
        )
            .into_response();
    }

    // 5. INIT_WORKSPACE 处理：扫描文件并推断意图
    if decision.intent_override.as_ref() == Some(&crate::services::intent_router::IntentType::InitWorkspace) {
        let raw_path = if content.trim().starts_with('/') {
            "." // /init 无参数时扫描当前目录
        } else {
            content.trim().split_whitespace().next().unwrap_or(".")
        };

        // 路径安全验证：canonicalize 防止路径遍历
        let scan_path = match std::path::Path::new(raw_path).canonicalize() {
            Ok(p) => p,
            Err(_) => {
                let response = format!("无效路径: {}", raw_path);
                return (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "error": response }))).into_response();
            }
        };

        // 限制在当前工作目录或其子目录内
        let cwd = match std::env::current_dir() {
            Ok(d) => d,
            Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, "Cannot resolve working directory").into_response(),
        };
        if !scan_path.starts_with(&cwd) {
            return (StatusCode::FORBIDDEN, Json(serde_json::json!({
                "error": "路径超出允许范围，仅允许扫描当前工作目录及其子目录"
            }))).into_response();
        }

        let file_signals = crate::services::intent_router::scan_workspace_files(scan_path.to_string_lossy().as_ref());

        if file_signals.is_empty() {
            let response = format!("扫描目录 `{}` 未检测到专利相关文件。\n\n支持的文件类型：\n\
                • 审查意见（文件名含「审查意见」或「office action」）\n\
                • 技术交底书（文件名含「交底书」或「技术方案」）\n\
                • 权利要求书（文件名含「权利要求」或「claims」）\n\
                • 检索报告（文件名含「检索报告」或「search report」）\n\
                • 其他 PDF/DOCX 文件会作为参考文档处理", scan_path.display());

            state.broadcaster.publish(GatewayEvent::new(
                id.clone(),
                EventType::Result,
                serde_json::json!({ "result": response }),
            ));

            return (StatusCode::OK, Json(serde_json::json!({ "response": response }))).into_response();
        }

        // 根据最强信号推断意图
        let best_signal = &file_signals[0];
        let resolved_intent = match best_signal.signal_type {
            crate::services::intent_router::FileSignalType::OfficeAction => "RESPOND_OA",
            crate::services::intent_router::FileSignalType::TechnicalDisclosure => "DRAFT_FULL",
            crate::services::intent_router::FileSignalType::PatentDraft => "DRAFT_FULL",
            crate::services::intent_router::FileSignalType::SearchReport => "SEARCH",
            crate::services::intent_router::FileSignalType::ReferenceDocument => "DRAFT_FULL",
        };

        let file_list: Vec<String> = file_signals.iter().map(|f| {
            let type_label = match f.signal_type {
                crate::services::intent_router::FileSignalType::OfficeAction => "审查意见",
                crate::services::intent_router::FileSignalType::TechnicalDisclosure => "技术交底书",
                crate::services::intent_router::FileSignalType::PatentDraft => "权利要求",
                crate::services::intent_router::FileSignalType::SearchReport => "检索报告",
                crate::services::intent_router::FileSignalType::ReferenceDocument => "参考文档",
            };
            format!("[{}] {} (置信度: {:.0}%)", type_label, f.filename, f.confidence * 100.0)
        }).collect();

        let msg = format!(
            "工作区扫描检测到 {} 个专利相关文件：\n{}\n\n推荐意图: {}",
            file_signals.len(),
            file_list.join("\n"),
            resolved_intent,
        );

        // 发送带文件信号的请求到 Orchestrator
        let orchestrate_payload = serde_json::json!({
            "session_id": id,
            "message": msg,
            "intent_override": resolved_intent,
            "file_signals": file_signals,
        });

        match state
            .orchestrator_client
            .orchestrate_with_payload(orchestrate_payload)
            .await
        {
            Ok(result) => {
                if let Some(response_str) = result.get("response").and_then(|r| r.as_str()) {
                    state.session_manager.add_message(
                        &id,
                        SessionMessage {
                            role: MessageRole::Assistant,
                            content: response_str.to_string(),
                            timestamp: chrono::Utc::now().timestamp(),
                            metadata: None,
                        },
                    );
                }
                (StatusCode::OK, Json(result)).into_response()
            }
            Err(e) => {
                tracing::error!("Orchestrate error for session {}: {}", id, e);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Internal processing error",
                ).into_response()
            }
        }
    } else {
    // 6. 调用 Orchestrator（带 intent_override）
    let orchestrate_payload = if decision.skip_intent_recognition {
        serde_json::json!({
            "session_id": id,
            "message": content,
            "intent_override": decision.intent_override.map(|i| i.to_string()),
        })
    } else {
        serde_json::json!({
            "session_id": id,
            "message": content,
        })
    };

    match state
        .orchestrator_client
        .orchestrate_with_payload(orchestrate_payload)
        .await
    {
        Ok(result) => {
            if let Some(response_str) = result.get("response").and_then(|r| r.as_str()) {
                state.session_manager.add_message(
                    &id,
                    SessionMessage {
                        role: MessageRole::Assistant,
                        content: response_str.to_string(),
                        timestamp: chrono::Utc::now().timestamp(),
                        metadata: None,
                    },
                );
            }
            (StatusCode::OK, Json(result)).into_response()
        }
        Err(e) => {
            tracing::error!("Orchestrate error for session {}: {}", id, e);
            state.broadcaster.publish(GatewayEvent::new(
                id.clone(),
                EventType::Error,
                serde_json::json!({ "error": "Internal processing error" }),
            ));
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Internal processing error",
            )
                .into_response()
        }
    }
    } // end else (non-INIT_WORKSPACE)
}

// ============================================================================
// 用户反馈闭环（Phase 2）
// ============================================================================

use crate::services::feedback::{FeedbackRecord, FeedbackType};

#[derive(Deserialize)]
pub struct FeedbackRequest {
    pub message_index: usize,
    pub feedback_type: String,
    pub corrected_intent: Option<String>,
}

#[derive(Serialize)]
pub struct FeedbackResponse {
    pub success: bool,
    pub message: String,
}

pub async fn submit_feedback(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(req): Json<FeedbackRequest>,
) -> impl IntoResponse {
    let session = match state.session_manager.get_session(&id) {
        Some(s) => s,
        None => {
            return (
                StatusCode::NOT_FOUND,
                Json(FeedbackResponse {
                    success: false,
                    message: "Session not found".to_string(),
                }),
            )
                .into_response();
        }
    };

    let user_input = session
        .messages
        .get(req.message_index)
        .map(|m| m.content.clone())
        .unwrap_or_default();

    let routed_intent = session
        .intent_history
        .get(req.message_index)
        .map(|f| f.intent.clone())
        .unwrap_or_default();

    let feedback_type = match req.feedback_type.as_str() {
        "correct" => FeedbackType::Correct,
        "wrong" => FeedbackType::Wrong,
        "corrected" => FeedbackType::Corrected,
        _ => {
            return (
                StatusCode::BAD_REQUEST,
                Json(FeedbackResponse {
                    success: false,
                    message: "Invalid feedback_type. Use: correct, wrong, corrected".to_string(),
                }),
            )
                .into_response();
        }
    };

    let record = FeedbackRecord {
        session_id: id.clone(),
        message_index: req.message_index,
        user_input,
        routed_intent,
        feedback_type,
        corrected_intent: req.corrected_intent,
        timestamp: chrono::Utc::now().timestamp(),
        metadata: None,
    };

    state.feedback_store.submit(record);

    (
        StatusCode::OK,
        Json(FeedbackResponse {
            success: true,
            message: "Feedback recorded".to_string(),
        }),
    )
        .into_response()
}
