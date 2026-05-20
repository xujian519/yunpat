use std::path::PathBuf;
use std::sync::Arc;

use anyhow::{Context, Result};
use async_trait::async_trait;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use tokio::io::AsyncWriteExt;
use yunpat_protocol::EventFrame;

// 双向 Hook 协议
pub mod hook_pipeline;
pub mod stdio_hook;

// 重新导出主要类型
pub use hook_pipeline::{BidirectionalHook, HookInstruction, HookPipeline};
pub use stdio_hook::StdioBidirectionalHook;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum HookEvent {
    /// 用户提交消息，用于意图识别
    UserMessage {
        message: String,
        mode: String,
    },
    ResponseStart {
        response_id: String,
    },
    ResponseDelta {
        response_id: String,
        delta: String,
    },
    ResponseEnd {
        response_id: String,
    },
    ToolLifecycle {
        response_id: String,
        tool_name: String,
        phase: String,
        payload: Value,
    },
    JobLifecycle {
        job_id: String,
        phase: String,
        progress: Option<u8>,
        detail: Option<String>,
    },
    ApprovalLifecycle {
        approval_id: String,
        phase: String,
        reason: Option<String>,
    },
    GenericEventFrame {
        frame: EventFrame,
    },
}

impl HookEvent {
    pub fn to_json(&self) -> Value {
        serde_json::to_value(self).unwrap_or_else(|_| json!({"type":"serialization_error"}))
    }
}

#[async_trait]
pub trait HookSink: Send + Sync {
    async fn emit(&self, event: &HookEvent) -> Result<()>;
}

#[derive(Default)]
pub struct StdoutHookSink;

#[async_trait]
impl HookSink for StdoutHookSink {
    async fn emit(&self, event: &HookEvent) -> Result<()> {
        println!("{}", event.to_json());
        Ok(())
    }
}

pub struct JsonlHookSink {
    path: PathBuf,
}

impl JsonlHookSink {
    pub fn new(path: PathBuf) -> Self {
        Self { path }
    }
}

#[async_trait]
impl HookSink for JsonlHookSink {
    async fn emit(&self, event: &HookEvent) -> Result<()> {
        if let Some(parent) = self.path.parent() {
            tokio::fs::create_dir_all(parent).await.with_context(|| {
                format!("failed to create hook log directory {}", parent.display())
            })?;
        }
        let mut file = tokio::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.path)
            .await
            .with_context(|| format!("failed to open hook log {}", self.path.display()))?;
        let payload = json!({
            "at": Utc::now().to_rfc3339(),
            "event": event
        });
        let encoded = serde_json::to_string(&payload).context("failed to encode hook event")?;
        file.write_all(encoded.as_bytes()).await.context("failed to write hook event")?;
        file.write_all(b"\n").await.context("failed to write hook event newline")?;
        Ok(())
    }
}

pub struct WebhookHookSink {
    url: String,
    client: reqwest::Client,
}

impl WebhookHookSink {
    pub fn new(url: String) -> Self {
        Self {
            url,
            client: reqwest::Client::new(),
        }
    }
}

#[async_trait]
impl HookSink for WebhookHookSink {
    async fn emit(&self, event: &HookEvent) -> Result<()> {
        let mut retries = 0usize;
        loop {
            let resp = self
                .client
                .post(&self.url)
                .json(&json!({
                    "at": Utc::now().to_rfc3339(),
                    "event": event,
                }))
                .send()
                .await;
            match resp {
                Ok(response) if response.status().is_success() => return Ok(()),
                Ok(response) => {
                    if retries >= 2 {
                        anyhow::bail!("webhook returned non-success status {}", response.status());
                    }
                }
                Err(err) => {
                    if retries >= 2 {
                        return Err(err).context("webhook request failed");
                    }
                }
            }
            retries += 1;
            tokio::time::sleep(std::time::Duration::from_millis(200 * retries as u64)).await;
        }
    }
}

#[derive(Default, Clone)]
pub struct HookDispatcher {
    sinks: Vec<Arc<dyn HookSink>>,
}

impl HookDispatcher {
    pub fn add_sink(&mut self, sink: Arc<dyn HookSink>) {
        self.sinks.push(sink);
    }

    pub async fn emit(&self, event: HookEvent) {
        for sink in &self.sinks {
            let _ = sink.emit(&event).await;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_user_message_event() -> HookEvent {
        HookEvent::UserMessage {
            message: "test message".to_string(),
            mode: "general".to_string(),
        }
    }

    fn create_response_start_event() -> HookEvent {
        HookEvent::ResponseStart {
            response_id: "test-id-123".to_string(),
        }
    }

    #[test]
    fn test_hook_event_user_message_json() {
        let event = HookEvent::UserMessage {
            message: "Hello world".to_string(),
            mode: "agent".to_string(),
        };

        let json = event.to_json();
        assert_eq!(json["type"], "user_message");
        assert_eq!(json["message"], "Hello world");
        assert_eq!(json["mode"], "agent");
    }

    #[test]
    fn test_hook_event_response_start_json() {
        let event = HookEvent::ResponseStart {
            response_id: "resp-001".to_string(),
        };

        let json = event.to_json();
        assert_eq!(json["type"], "response_start");
        assert_eq!(json["response_id"], "resp-001");
    }

    #[test]
    fn test_hook_event_response_delta_json() {
        let event = HookEvent::ResponseDelta {
            response_id: "resp-001".to_string(),
            delta: "Hello".to_string(),
        };

        let json = event.to_json();
        assert_eq!(json["type"], "response_delta");
        assert_eq!(json["delta"], "Hello");
    }

    #[test]
    fn test_hook_event_response_end_json() {
        let event = HookEvent::ResponseEnd {
            response_id: "resp-001".to_string(),
        };

        let json = event.to_json();
        assert_eq!(json["type"], "response_end");
    }

    #[test]
    fn test_hook_event_tool_lifecycle_json() {
        let event = HookEvent::ToolLifecycle {
            response_id: "resp-001".to_string(),
            tool_name: "search".to_string(),
            phase: "start".to_string(),
            payload: json!({"query": "test"}),
        };

        let json = event.to_json();
        assert_eq!(json["type"], "tool_lifecycle");
        assert_eq!(json["tool_name"], "search");
        assert_eq!(json["phase"], "start");
        assert_eq!(json["payload"]["query"], "test");
    }

    #[test]
    fn test_hook_event_job_lifecycle_json() {
        let event = HookEvent::JobLifecycle {
            job_id: "job-123".to_string(),
            phase: "running".to_string(),
            progress: Some(50),
            detail: Some("Processing".to_string()),
        };

        let json = event.to_json();
        assert_eq!(json["type"], "job_lifecycle");
        assert_eq!(json["progress"], 50);
        assert_eq!(json["detail"], "Processing");
    }

    #[test]
    fn test_hook_event_approval_lifecycle_json() {
        let event = HookEvent::ApprovalLifecycle {
            approval_id: "apr-001".to_string(),
            phase: "approved".to_string(),
            reason: Some("User approved".to_string()),
        };

        let json = event.to_json();
        assert_eq!(json["type"], "approval_lifecycle");
        assert_eq!(json["phase"], "approved");
        assert_eq!(json["reason"], "User approved");
    }

    #[test]
    fn test_hook_event_serde_roundtrip() {
        let original = HookEvent::UserMessage {
            message: "test".to_string(),
            mode: "general".to_string(),
        };

        let json = serde_json::to_value(&original).unwrap();
        let deserialized: HookEvent = serde_json::from_value(json).unwrap();

        match deserialized {
            HookEvent::UserMessage { message, mode } => {
                assert_eq!(message, "test");
                assert_eq!(mode, "general");
            }
            _ => panic!("Roundtrip failed"),
        }
    }

    #[tokio::test]
    async fn test_stdout_hook_sink_emit() {
        let sink = StdoutHookSink;
        let event = create_user_message_event();

        let result = sink.emit(&event).await;
        assert!(result.is_ok());
    }

    #[test]
    fn test_jsonl_hook_sink_new() {
        let path = PathBuf::from("/tmp/test-hook.jsonl");
        let sink = JsonlHookSink::new(path.clone());

        let _ = sink;
    }

    #[tokio::test]
    async fn test_jsonl_hook_sink_emit_creates_dir() {
        let temp_dir = PathBuf::from("/tmp/test-hooks-nested");
        let file_path = temp_dir.join("nested/dir/hooks.jsonl");
        let sink = JsonlHookSink::new(file_path.clone());

        let event = create_response_start_event();
        let result = sink.emit(&event).await;

        assert!(result.is_ok());
        assert!(file_path.exists());

        tokio::fs::remove_dir_all(temp_dir).await.ok();
    }

    #[tokio::test]
    async fn test_jsonl_hook_sink_emit_appends() {
        let temp_dir = PathBuf::from("/tmp/test-hooks-append");
        let file_path = temp_dir.join("hooks.jsonl");
        let sink = JsonlHookSink::new(file_path.clone());

        let event1 = create_response_start_event();
        let event2 = HookEvent::ResponseEnd {
            response_id: "test-id".to_string(),
        };

        let result1 = sink.emit(&event1).await;
        let result2 = sink.emit(&event2).await;

        assert!(result1.is_ok());
        assert!(result2.is_ok());

        let content: String = tokio::fs::read_to_string(&file_path).await.unwrap();
        let lines: Vec<&str> = content.lines().collect();
        assert_eq!(lines.len(), 2);

        tokio::fs::remove_dir_all(temp_dir).await.ok();
    }

    #[test]
    fn test_webhook_hook_sink_new() {
        let sink = WebhookHookSink::new("http://example.com/webhook".to_string());

        let _ = sink;
    }

    #[test]
    fn test_hook_dispatcher_default() {
        let dispatcher = HookDispatcher::default();
        assert!(dispatcher.sinks.is_empty());
    }

    #[test]
    fn test_hook_dispatcher_add_sink() {
        let mut dispatcher = HookDispatcher::default();
        let sink = Arc::new(StdoutHookSink);

        dispatcher.add_sink(sink);
        assert!(!dispatcher.sinks.is_empty());
    }

    #[tokio::test]
    async fn test_hook_dispatcher_emit_single_sink() {
        let mut dispatcher = HookDispatcher::default();
        let sink = Arc::new(StdoutHookSink);

        dispatcher.add_sink(sink);

        let event = create_user_message_event();
        dispatcher.emit(event).await;
    }

    #[tokio::test]
    async fn test_hook_dispatcher_emit_multiple_sinks() {
        let mut dispatcher = HookDispatcher::default();

        let stdout_sink = Arc::new(StdoutHookSink);
        let temp_dir = PathBuf::from("/tmp/test-hooks-multi");
        let file_path = temp_dir.join("hooks.jsonl");
        let jsonl_sink = Arc::new(JsonlHookSink::new(file_path.clone()));

        dispatcher.add_sink(stdout_sink);
        dispatcher.add_sink(jsonl_sink);

        let event = create_response_start_event();
        dispatcher.emit(event).await;

        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        let content: String = tokio::fs::read_to_string(&file_path).await.unwrap();
        assert!(!content.is_empty());

        tokio::fs::remove_dir_all(temp_dir).await.ok();
    }

    #[tokio::test]
    async fn test_hook_dispatcher_sink_failure_does_not_stop_others() {
        struct FailingSink;
        #[async_trait]
        impl HookSink for FailingSink {
            async fn emit(&self, _event: &HookEvent) -> Result<()> {
                anyhow::bail!("Intentional failure");
            }
        }

        let mut dispatcher = HookDispatcher::default();

        let temp_dir = PathBuf::from("/tmp/test-hooks-fail");
        let file_path = temp_dir.join("hooks.jsonl");
        let success_sink = Arc::new(JsonlHookSink::new(file_path.clone()));
        let failing_sink = Arc::new(FailingSink);

        dispatcher.add_sink(failing_sink);
        dispatcher.add_sink(success_sink);

        let event = create_user_message_event();
        dispatcher.emit(event).await;

        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        let content: String = tokio::fs::read_to_string(&file_path).await.unwrap();
        assert!(!content.is_empty());

        tokio::fs::remove_dir_all(temp_dir).await.ok();
    }

    #[test]
    fn test_hook_event_all_variants_serde() {
        let events = vec![
            HookEvent::UserMessage {
                message: "msg".to_string(),
                mode: "m".to_string(),
            },
            HookEvent::ResponseStart { response_id: "id".to_string() },
            HookEvent::ResponseDelta {
                response_id: "id".to_string(),
                delta: "delta".to_string(),
            },
            HookEvent::ResponseEnd { response_id: "id".to_string() },
            HookEvent::ToolLifecycle {
                response_id: "id".to_string(),
                tool_name: "tool".to_string(),
                phase: "phase".to_string(),
                payload: json!({}),
            },
            HookEvent::JobLifecycle {
                job_id: "job".to_string(),
                phase: "phase".to_string(),
                progress: None,
                detail: None,
            },
            HookEvent::ApprovalLifecycle {
                approval_id: "apr".to_string(),
                phase: "phase".to_string(),
                reason: None,
            },
        ];

        for event in events {
            let json = serde_json::to_value(&event).unwrap();
            let deserialized: HookEvent = serde_json::from_value(json).unwrap();
            let _ = deserialized;
        }
    }
}
