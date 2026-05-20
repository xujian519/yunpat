//! Stdio MCP Transport — async, multiplexed JSON-RPC 2.0 over process stdin/stdout.
//!
//! Supports concurrent requests via ID-based response correlation.

use std::collections::HashMap;
use std::process::Stdio;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};

use anyhow::{Context, Result, bail};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::{Mutex, oneshot};

use crate::transport::McpTransport;

#[derive(Serialize)]
struct JsonRpcRequest {
    jsonrpc: &'static str,
    id: u64,
    method: String,
    params: Value,
}

#[derive(Serialize)]
struct JsonRpcNotification {
    jsonrpc: &'static str,
    method: String,
    params: Value,
}

#[derive(Deserialize)]
struct JsonRpcResponse {
    #[serde(default)]
    id: Option<u64>,
    #[serde(default)]
    result: Option<Value>,
    #[serde(default)]
    error: Option<JsonRpcErrorDetail>,
}

#[derive(Deserialize, Debug)]
struct JsonRpcErrorDetail {
    code: i64,
    message: String,
}

type PendingMap = Arc<Mutex<HashMap<u64, oneshot::Sender<Result<Value>>>>>;

/// Async stdio transport for MCP servers with request multiplexing.
///
/// Spawns the MCP server as a child process and communicates via
/// newline-delimited JSON-RPC 2.0 over stdin/stdout.
///
/// A background reader task routes responses to the correct caller
/// by matching on the JSON-RPC `id` field, enabling concurrent requests.
pub struct StdioTransport {
    _child: Arc<Mutex<Child>>,
    writer: Arc<Mutex<tokio::process::ChildStdin>>,
    pending: PendingMap,
    next_id: Arc<AtomicU64>,
    connected: Arc<AtomicBool>,
}

impl StdioTransport {
    /// Spawn an MCP server process and create a transport.
    ///
    /// The child process is spawned with piped stdin/stdout/stderr.
    /// A background tokio task reads stdout and dispatches responses.
    pub async fn spawn(
        command: &str,
        args: &[String],
        env: &HashMap<String, String>,
    ) -> Result<Self> {
        let mut cmd = Command::new(command);
        cmd.args(args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true);

        for (k, v) in env {
            cmd.env(k, v);
        }

        let mut child = cmd
            .spawn()
            .with_context(|| format!("failed to spawn MCP server: {command} {args:?}"))?;

        let stdin = child.stdin.take().context("failed to take stdin")?;
        let stdout = child.stdout.take().context("failed to take stdout")?;

        let pending: PendingMap = Arc::new(Mutex::new(HashMap::new()));
        let connected = Arc::new(AtomicBool::new(true));

        let reader = BufReader::new(stdout);
        let reader_pending = pending.clone();
        let reader_connected = connected.clone();

        tokio::spawn(async move {
            read_loop(reader, reader_pending, reader_connected).await;
        });

        Ok(Self {
            _child: Arc::new(Mutex::new(child)),
            writer: Arc::new(Mutex::new(stdin)),
            pending,
            next_id: Arc::new(AtomicU64::new(1)),
            connected,
        })
    }

    /// Perform the MCP `initialize` handshake.
    pub async fn initialize(&self, client_name: &str, client_version: &str) -> Result<Value> {
        self.send_request(
            "initialize",
            serde_json::json!({
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": { "name": client_name, "version": client_version }
            }),
        )
        .await
    }

    /// Send a `initialized` notification (completes the handshake).
    pub async fn send_initialized(&self) -> Result<()> {
        self.send_notification("notifications/initialized", serde_json::json!({})).await
    }
}

async fn read_loop(
    mut reader: BufReader<tokio::process::ChildStdout>,
    pending: PendingMap,
    connected: Arc<AtomicBool>,
) {
    let mut line = String::new();
    loop {
        line.clear();
        match reader.read_line(&mut line).await {
            Ok(0) => {
                tracing::info!("MCP server stdout closed");
                connected.store(false, Ordering::SeqCst);
                break;
            }
            Ok(_) => {}
            Err(e) => {
                tracing::error!("MCP stdout read error: {e}");
                connected.store(false, Ordering::SeqCst);
                break;
            }
        }

        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let response: JsonRpcResponse = match serde_json::from_str(trimmed) {
            Ok(r) => r,
            Err(e) => {
                tracing::warn!("MCP: failed to parse response: {e}");
                continue;
            }
        };

        if let Some(id) = response.id {
            let sender = {
                let mut map = pending.lock().await;
                map.remove(&id)
            };
            if let Some(sender) = sender {
                let result = if let Some(error) = response.error {
                    Err(anyhow::anyhow!(
                        "MCP error (code {}): {}",
                        error.code,
                        error.message
                    ))
                } else {
                    response.result.context("JSON-RPC response missing result")
                };
                let _ = sender.send(result);
            }
        } else {
            tracing::trace!("MCP notification: {}", trimmed);
        }
    }

    let mut map = pending.lock().await;
    for (_, sender) in map.drain() {
        let _ = sender.send(Err(anyhow::anyhow!("transport closed")));
    }
}

#[async_trait]
impl McpTransport for StdioTransport {
    async fn send_request(&self, method: &str, params: Value) -> Result<Value> {
        if !self.connected.load(Ordering::SeqCst) {
            bail!("transport is disconnected");
        }

        let id = self.next_id.fetch_add(1, Ordering::Relaxed);

        let (tx, rx) = oneshot::channel();
        {
            let mut map = self.pending.lock().await;
            map.insert(id, tx);
        }

        let request = JsonRpcRequest {
            jsonrpc: "2.0",
            id,
            method: method.to_string(),
            params,
        };
        let mut line = serde_json::to_string(&request)?;
        line.push('\n');

        {
            let mut writer = self.writer.lock().await;
            writer.write_all(line.as_bytes()).await?;
            writer.flush().await?;
        }

        rx.await.context("request cancelled — transport likely closed")?
    }

    async fn send_notification(&self, method: &str, params: Value) -> Result<()> {
        if !self.connected.load(Ordering::SeqCst) {
            bail!("transport is disconnected");
        }

        let notification = JsonRpcNotification {
            jsonrpc: "2.0",
            method: method.to_string(),
            params,
        };
        let mut line = serde_json::to_string(&notification)?;
        line.push('\n');

        let mut writer = self.writer.lock().await;
        writer.write_all(line.as_bytes()).await?;
        writer.flush().await?;
        Ok(())
    }

    fn is_connected(&self) -> bool {
        self.connected.load(Ordering::SeqCst)
    }

    async fn close(&mut self) -> Result<()> {
        self.connected.store(false, Ordering::SeqCst);
        let _ = self.send_notification("shutdown", serde_json::json!({})).await;
        let mut child = self._child.lock().await;
        let _ = child.kill().await;
        let _ = child.wait().await;
        Ok(())
    }
}
