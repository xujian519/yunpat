//! MCP connection state extracted from `App`.

/// Mutable state for MCP connection pool and UI indicators.
pub struct McpState {
    /// Last MCP manager/discovery snapshot shown in the UI.
    pub snapshot: Option<crate::mcp::McpManagerSnapshot>,
    /// Number of MCP servers declared in the user's config at app boot.
    pub configured_count: usize,
    /// Set after in-TUI MCP config edits because the engine caches its MCP pool.
    pub restart_required: bool,
    /// MCP connection pool for patent workflow tools.
    pub pool: Option<std::sync::Arc<tokio::sync::Mutex<crate::mcp::McpPool>>>,
}

impl std::fmt::Debug for McpState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("McpState")
            .field("snapshot", &self.snapshot)
            .field("configured_count", &self.configured_count)
            .field("restart_required", &self.restart_required)
            .field("pool", &self.pool.as_ref().map(|_| "..."))
            .finish()
    }
}
