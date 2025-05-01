use crate::models::GatewayEvent;
use axum::{
    extract::{Path, State},
    response::{
        sse::{Event, Sse},
        IntoResponse,
    },
};
use futures::stream::Stream;
/**
 * @file 事件流服务 (SSE)
 */
use std::sync::Arc;
use tokio::sync::broadcast;

#[derive(Clone)]
pub struct Broadcaster {
    tx: broadcast::Sender<GatewayEvent>,
}

impl Broadcaster {
    pub fn new() -> Self {
        let (tx, _) = broadcast::channel(1000);
        Self { tx }
    }

    pub fn subscribe(&self) -> broadcast::Receiver<GatewayEvent> {
        self.tx.subscribe()
    }

    pub fn sender(&self) -> &broadcast::Sender<GatewayEvent> {
        &self.tx
    }

    pub fn publish(&self, event: GatewayEvent) {
        let _ = self.tx.send(event);
    }
}

impl Default for Broadcaster {
    fn default() -> Self {
        Self::new()
    }
}

pub struct EventStreamer {
    broadcaster: Broadcaster,
}

impl EventStreamer {
    pub fn new(broadcaster: Broadcaster) -> Self {
        Self { broadcaster }
    }

    pub async fn subscribe_to_session(
        &self,
        session_id: String,
    ) -> impl Stream<Item = Result<Event, anyhow::Error>> {
        let mut rx = self.broadcaster.subscribe();

        async_stream::stream! {
            while let Ok(event) = rx.recv().await {
                // 只发送该会话的事件
                if event.session_id == session_id {
                    let data = match serde_json::to_string(&event) {
                        Ok(s) => s,
                        Err(e) => {
                            yield Err(anyhow::anyhow!("JSON error: {}", e));
                            continue;
                        }
                    };

                    yield Ok(Event::default().data(data));
                }
            }
        }
    }
}

// SSE 路由处理器
pub async fn sse_handler(
    State(broadcaster): State<Arc<Broadcaster>>,
    Path(session_id): Path<String>,
) -> impl IntoResponse {
    let streamer = EventStreamer::new((*broadcaster).clone());
    let stream = streamer.subscribe_to_session(session_id).await;

    Sse::new(stream).keep_alive(
        axum::response::sse::KeepAlive::new()
            .interval(std::time::Duration::from_secs(10))
            .text("keepalive"),
    )
}
