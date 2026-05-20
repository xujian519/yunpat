//! MCP Transport trait — abstract transport layer for MCP JSON-RPC communication.
//!
//! Inspired by ZeroClaw's `mcp_transport.rs` design pattern.

use anyhow::Result;
use async_trait::async_trait;
use serde_json::Value;

/// Transport abstraction for MCP JSON-RPC 2.0 communication.
///
/// Implementations handle the wire protocol (stdio, HTTP, SSE, etc.)
/// while callers use the uniform `send_request` / `send_notification` API.
#[async_trait]
pub trait McpTransport: Send + Sync {
    /// Send a JSON-RPC request and wait for the response.
    ///
    /// The transport is responsible for:
    /// - Assigning or using the provided `id` for request-response correlation
    /// - Framing (e.g., newline-delimited for stdio)
    /// - Error extraction from JSON-RPC error responses
    async fn send_request(&self, method: &str, params: Value) -> Result<Value>;

    /// Send a JSON-RPC notification (no response expected).
    async fn send_notification(&self, method: &str, params: Value) -> Result<()>;

    /// Check if the transport is currently connected.
    fn is_connected(&self) -> bool;

    /// Gracefully close the transport.
    async fn close(&mut self) -> Result<()>;
}
