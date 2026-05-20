//! YunPat MCP Bridge — async MCP client, supervisor, and agent adapter.
//!
//! Provides:
//! - `MCPBridge`: Legacy async stdio MCP client (deprecated — use `SupervisedServer`).
//! - `SupervisedServer`: Managed MCP server with heartbeat and auto-restart.
//! - `McpAgentAdapter`: Wraps an MCP server as a `PatentAgent` trait implementation.

pub mod agent_adapter;
pub mod bridge;
pub mod supervisor;

pub use agent_adapter::McpAgentAdapter;
pub use bridge::{MCPBridge, ServerHandle};
pub use supervisor::{SupervisedServer, SupervisorConfig};
