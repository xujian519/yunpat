//! Workspace context state extracted from `App`.

/// Mutable state for workspace context caching.
#[derive(Debug)]
pub struct WorkspaceState {
    /// Cached git context snapshot for the footer.
    pub context: Option<String>,
    /// Shared cell for async git context updates (#399 S1).
    pub context_cell: std::sync::Arc<std::sync::Mutex<Option<String>>>,
    /// Timestamp for cached workspace context.
    pub refreshed_at: Option<std::time::Instant>,
}
