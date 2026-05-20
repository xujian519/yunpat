//! Server Supervisor — manages an MCP server process with health monitoring and auto-restart.

use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use anyhow::{Context, Result};
use serde_json::Value;
use tokio::sync::Mutex;
use tokio::time::{Duration, sleep};
use tracing::{error, info, warn};
use yunpat_mcp::{McpTransport, StdioTransport};

use crate::bridge::{MCPToolResult, McpToolDescriptor};

#[derive(Debug, Clone)]
pub struct SupervisorConfig {
    pub server_id: String,
    pub command: String,
    pub args: Vec<String>,
    pub env: HashMap<String, String>,
    pub health_interval: Duration,
    pub max_restart_attempts: u32,
    pub restart_delay_base: Duration,
    pub max_restart_delay: Duration,
}

impl Default for SupervisorConfig {
    fn default() -> Self {
        Self {
            server_id: String::new(),
            command: String::new(),
            args: Vec::new(),
            env: HashMap::new(),
            health_interval: Duration::from_secs(30),
            max_restart_attempts: 3,
            restart_delay_base: Duration::from_secs(1),
            max_restart_delay: Duration::from_secs(30),
        }
    }
}

pub struct SupervisedServer {
    config: SupervisorConfig,
    transport: Arc<Mutex<Option<StdioTransport>>>,
    running: Arc<AtomicBool>,
    cancel: Arc<AtomicBool>,
}

impl SupervisedServer {
    pub fn new(config: SupervisorConfig) -> Self {
        Self {
            config,
            transport: Arc::new(Mutex::new(None)),
            running: Arc::new(AtomicBool::new(false)),
            cancel: Arc::new(AtomicBool::new(false)),
        }
    }

    /// Start the server process and health monitoring loop.
    pub async fn start(&self) -> Result<()> {
        self.cancel.store(false, Ordering::SeqCst);
        self.spawn_process().await?;

        let config = self.config.clone();
        let transport = self.transport.clone();
        let running = self.running.clone();
        let cancel = self.cancel.clone();

        tokio::spawn(async move {
            health_loop(config, transport, running, cancel).await;
        });

        Ok(())
    }

    /// Stop the server and health monitoring.
    pub async fn stop(&self) -> Result<()> {
        self.cancel.store(true, Ordering::SeqCst);
        self.running.store(false, Ordering::SeqCst);
        let mut guard = self.transport.lock().await;
        if let Some(transport) = guard.take() {
            let mut t: StdioTransport = transport;
            let _ = McpTransport::close(&mut t).await;
        }
        Ok(())
    }

    /// List tools via the current transport.
    pub async fn list_tools(&self) -> Result<Vec<McpToolDescriptor>> {
        let guard = self.transport.lock().await;
        let transport = guard.as_ref().context("server not running")?;

        let result = transport.send_request("tools/list", serde_json::json!({})).await?;

        let tools: Vec<McpToolDescriptor> = result
            .get("tools")
            .cloned()
            .map(serde_json::from_value)
            .transpose()
            .context("failed to parse MCP tool list")?
            .unwrap_or_default();

        Ok(tools)
    }

    /// Invoke a tool via the current transport.
    pub async fn invoke(
        &self,
        tool: &str,
        input: Value,
        timeout: Option<Duration>,
    ) -> Result<MCPToolResult> {
        let guard = self.transport.lock().await;
        let transport = guard.as_ref().context("server not running")?;

        let params = serde_json::json!({
            "name": tool,
            "arguments": input,
        });

        let call = transport.send_request("tools/call", params);
        let result = if let Some(dur) = timeout {
            tokio::time::timeout(dur, call).await.context("MCP tool call timed out")??
        } else {
            call.await?
        };

        let is_error = result.get("isError").and_then(|v| v.as_bool()).unwrap_or(false);
        let content = result.get("content").cloned().unwrap_or(result);

        Ok(MCPToolResult { content, is_error })
    }

    /// Check if the server is currently running.
    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::SeqCst)
    }

    async fn spawn_process(&self) -> Result<()> {
        let transport = StdioTransport::spawn(
            &self.config.command,
            &self.config.args,
            &self.config.env,
        )
        .await
        .with_context(|| {
            format!(
                "failed to spawn MCP server '{}': {} {:?}",
                self.config.server_id, self.config.command, self.config.args
            )
        })?;

        transport
            .initialize("yunpat-mcp-bridge", "0.2.0")
            .await
            .context("MCP initialize handshake failed")?;

        transport.send_initialized().await.ok();

        let mut guard = self.transport.lock().await;
        *guard = Some(transport);
        self.running.store(true, Ordering::SeqCst);

        info!(
            server_id = %self.config.server_id,
            "MCP server started and initialized"
        );

        Ok(())
    }

    /// Restart the server process.
    pub async fn restart(&self) -> Result<()> {
        info!(server_id = %self.config.server_id, "restarting MCP server");
        {
            let mut guard = self.transport.lock().await;
            if let Some(transport) = guard.take() {
                let mut t = transport;
                let _ = t.close().await;
            }
        }
        self.running.store(false, Ordering::SeqCst);
        self.spawn_process().await
    }
}

async fn health_loop(
    config: SupervisorConfig,
    transport: Arc<Mutex<Option<StdioTransport>>>,
    running: Arc<AtomicBool>,
    cancel: Arc<AtomicBool>,
) {
    let mut consecutive_failures: u32 = 0;
    let mut restart_attempts: u32 = 0;
    let mut current_delay = config.restart_delay_base;

    loop {
        if cancel.load(Ordering::SeqCst) {
            break;
        }

        sleep(config.health_interval).await;

        if cancel.load(Ordering::SeqCst) {
            break;
        }

        let healthy = {
            let guard = transport.lock().await;
            if let Some(t) = guard.as_ref() {
                t.send_request("healthz", serde_json::json!({})).await.is_ok()
            } else {
                false
            }
        };

        if healthy {
            consecutive_failures = 0;
            restart_attempts = 0;
            current_delay = config.restart_delay_base;
        } else {
            consecutive_failures += 1;
            warn!(
                server_id = %config.server_id,
                consecutive_failures,
                "health check failed"
            );

            if consecutive_failures >= 2 {
                if restart_attempts >= config.max_restart_attempts {
                    error!(
                        server_id = %config.server_id,
                        attempts = restart_attempts,
                        "max restart attempts reached — giving up"
                    );
                    running.store(false, Ordering::SeqCst);
                    break;
                }

                info!(
                    server_id = %config.server_id,
                    attempt = restart_attempts + 1,
                    delay_ms = current_delay.as_millis(),
                    "attempting restart"
                );

                sleep(current_delay).await;
                current_delay = (current_delay * 2).min(config.max_restart_delay);

                let supervisor = SupervisedServer {
                    config: config.clone(),
                    transport: transport.clone(),
                    running: running.clone(),
                    cancel: cancel.clone(),
                };

                match supervisor.restart().await {
                    Ok(()) => {
                        restart_attempts += 1;
                        consecutive_failures = 0;
                        info!(server_id = %config.server_id, "restart successful");
                    }
                    Err(e) => {
                        restart_attempts += 1;
                        error!(server_id = %config.server_id, error = %e, "restart failed");
                    }
                }
            }
        }
    }
}
