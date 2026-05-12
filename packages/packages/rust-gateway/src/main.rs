/**
 * @file YunPat Gateway - 主入口
 * @description Rust 统一网关服务器
 */
mod models;
mod routes;
mod services;

use axum::{
    http::{
        header::{AUTHORIZATION, CONTENT_TYPE},
        Method,
    },
    routing::{delete, get, post},
    Router,
};
use metrics_exporter_prometheus::PrometheusBuilder;
use std::sync::Arc;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use services::{
    Broadcaster, FeedbackStore, HITLManager, IntentRouter, OrchestratorClient, SessionManager, SessionStore,
};

/// 应用状态
#[derive(Clone)]
pub struct AppState {
    pub session_manager: Arc<SessionManager>,
    pub hitl_manager: Arc<HITLManager>,
    pub broadcaster: Arc<Broadcaster>,
    pub orchestrator_client: Arc<OrchestratorClient>,
    pub intent_router: Arc<IntentRouter>,
    pub feedback_store: Arc<FeedbackStore>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // 初始化日志
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "yunpat_gateway=debug,tower_http=debug,axum=trace".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    tracing::info!("Starting YunPat Gateway v{}", env!("CARGO_PKG_VERSION"));

    // 初始化 Prometheus metrics exporter
    let recorder = PrometheusBuilder::new().build_recorder();
    let metrics_handle = recorder.handle();
    metrics::set_global_recorder(recorder).expect("Failed to install Prometheus recorder");
    tracing::info!("Prometheus metrics exporter initialized");

    // 初始化服务
    let broadcaster = Arc::new(Broadcaster::new());
    let session_store = SessionStore::new();
    let hitl_manager = Arc::new(HITLManager::new());

    // Node.js Orchestrator 地址
    let orchestrator_url =
        std::env::var("ORCHESTRATOR_URL").unwrap_or_else(|_| "http://localhost:3001".to_string());
    let orchestrator_client = Arc::new(OrchestratorClient::new(orchestrator_url.clone()));

    // 意图路由器（从环境变量加载 LLM 配置）
    let intent_router = Arc::new(IntentRouter::from_env());
    let feedback_capacity = std::env::var("FEEDBACK_BUFFER_CAPACITY")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(10000);
    let feedback_store = Arc::new(FeedbackStore::new(feedback_capacity));

    // 创建会话管理器（使用 Broadcaster 共享的 broadcast channel）
    let session_manager = Arc::new(SessionManager::new(
        session_store,
        broadcaster.sender().clone(),
    ));

    // 打印配置信息
    tracing::info!("Orchestrator URL: {}", orchestrator_url);
    tracing::info!(
        "Intent Router LLM: {}",
        std::env::var("ROUTER_LLM_MODEL").unwrap_or_else(|_| "deepseek-chat".to_string())
    );
    tracing::info!("Intent Router enabled: {}", !std::env::var("ROUTER_LLM_API_KEY")
        .unwrap_or_else(|_| std::env::var("DEEPSEEK_API_KEY")
            .unwrap_or_else(|_| "".to_string()))
        .is_empty());

    // CORS 配置：从环境变量读取允许的来源
    let allowed_origins: Vec<String> = std::env::var("CORS_ALLOWED_ORIGINS")
        .unwrap_or_else(|_| "http://localhost:3000,http://localhost:5173".to_string())
        .split(',')
        .map(|s| s.trim().to_string())
        .collect();

    // 创建应用状态
    let state = AppState {
        session_manager,
        hitl_manager,
        broadcaster,
        orchestrator_client,
        intent_router,
        feedback_store,
    };

    // 构建路由
    let app = Router::new()
        // 公开 API
        .route("/api/v1/sessions", post(routes::sessions::create_session))
        .route("/api/v1/sessions/{id}", get(routes::sessions::get_session))
        .route(
            "/api/v1/sessions/{id}",
            delete(routes::sessions::delete_session),
        )
        .route(
            "/api/v1/sessions/{id}/message",
            post(routes::sessions::send_message),
        )
        .route(
            "/api/v1/sessions/{id}/events",
            get(routes::events::events_stream),
        )
        .route(
            "/api/v1/sessions/{id}/feedback",
            post(routes::sessions::submit_feedback),
        )
        .route(
            "/api/v1/sessions/{id}/hitl",
            post(routes::hitl::submit_hitl_response),
        )
        .route(
            "/api/v1/sessions/{id}/hitl",
            get(routes::hitl::get_pending_hitl),
        )
        // 内部 API
        .route("/internal/events", post(routes::internal::emit_event))
        .route("/internal/health", get(routes::internal::health_check))
        .route("/internal/metrics", get(move || async move { metrics_handle.render() }))
        // 状态
        .with_state(state)
        // 中间件
        .layer(
            CorsLayer::new()
                .allow_origin(
                    allowed_origins
                        .iter()
                        .filter_map(|o| o.parse().ok())
                        .collect::<Vec<_>>(),
                )
                .allow_methods([Method::GET, Method::POST, Method::DELETE])
                .allow_headers([CONTENT_TYPE, AUTHORIZATION]),
        )
        .layer(TraceLayer::new_for_http());

    // 启动服务器
    let addr = std::env::var("BIND_ADDRESS").unwrap_or_else(|_| "0.0.0.0:9090".to_string());
    let listener = tokio::net::TcpListener::bind(&addr).await?;

    tracing::info!("Gateway listening on {}", addr);

    axum::serve(listener, app).await?;

    Ok(())
}
