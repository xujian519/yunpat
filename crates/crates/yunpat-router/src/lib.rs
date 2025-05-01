//! YunPat Router — Intent routing and command dispatch.
//!
//! Provides a 4-level routing priority:
//! 1. Explicit command (/research, /draft, /oa, etc.) → direct agent
//! 2. Context association → continue active agent
//! 3. Intent recognition → keyword matching
//! 4. Generic mode → fallback to default behavior

mod router;

pub use router::{IntentRecognizer, Router, RoutingDecision, RoutingSource};
