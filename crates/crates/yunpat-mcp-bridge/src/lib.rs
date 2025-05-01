//! YunPat MCP Bridge — async MCP client and agent adapter.
//!
//! Provides:
//! - `MCPBridge`: Async stdio MCP client for launching and communicating
//!   with MCP server child processes via JSON-RPC 2.0.
//! - `McpAgentAdapter`: Wraps an MCP server as a `PatentAgent` trait
//!   implementation, transparent to the caller.

pub mod agent_adapter;
pub mod bridge;

pub use agent_adapter::McpAgentAdapter;
pub use bridge::{MCPBridge, ServerHandle};
