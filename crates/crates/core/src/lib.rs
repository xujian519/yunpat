mod helpers;
mod job_manager;
mod runtime;
mod thread_manager;

pub use job_manager::{JobHistoryEntry, JobManager, JobRecord, JobRetryMetadata, JobStatus};
pub use runtime::Runtime;
pub use thread_manager::ThreadManager;

use std::path::PathBuf;

use serde_json::Value;

#[derive(Debug, Clone)]
pub enum InitialHistory {
    New,
    Forked(Vec<Value>),
    Resumed {
        conversation_id: String,
        history: Vec<Value>,
        rollout_path: PathBuf,
    },
}

#[derive(Debug, Clone)]
pub struct NewThread {
    pub thread: yunpat_protocol::Thread,
    pub model: String,
    pub model_provider: String,
    pub cwd: PathBuf,
    pub approval_policy: Option<String>,
    pub sandbox: Option<String>,
}
