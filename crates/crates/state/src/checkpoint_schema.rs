use serde::{Deserialize, Serialize};
use serde_json::Value;

pub const UNIFIED_CHECKPOINT_SCHEMA_VERSION: u32 = 2;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnifiedCheckpoint {
    pub schema_version: u32,
    pub checkpoint_id: String,
    pub thread_id: String,
    pub source: CheckpointSource,
    pub created_at: i64,
    pub engine_state: Option<Value>,
    pub orchestrator_state: Option<Value>,
    pub shared_metadata: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CheckpointSource {
    RustEngine,
    TsOrchestrator,
    Hybrid,
}

impl UnifiedCheckpoint {
    pub fn new(
        checkpoint_id: String,
        thread_id: String,
        source: CheckpointSource,
        created_at: i64,
    ) -> Self {
        Self {
            schema_version: UNIFIED_CHECKPOINT_SCHEMA_VERSION,
            checkpoint_id,
            thread_id,
            source,
            created_at,
            engine_state: None,
            orchestrator_state: None,
            shared_metadata: Value::Null,
        }
    }

    pub fn with_engine_state(mut self, state: Value) -> Self {
        self.engine_state = Some(state);
        self
    }

    pub fn with_orchestrator_state(mut self, state: Value) -> Self {
        self.orchestrator_state = Some(state);
        self
    }

    pub fn with_metadata(mut self, metadata: Value) -> Self {
        self.shared_metadata = metadata;
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_unified_checkpoint_serialization() {
        let checkpoint = UnifiedCheckpoint::new(
            "cp-001".to_string(),
            "thread-123".to_string(),
            CheckpointSource::RustEngine,
            1704067200,
        )
        .with_engine_state(serde_json::json!({"step": 1}))
        .with_metadata(serde_json::json!({"intent": "search"}));

        let json = serde_json::to_string(&checkpoint).unwrap();
        let parsed: UnifiedCheckpoint = serde_json::from_str(&json).unwrap();

        assert_eq!(parsed.schema_version, 2);
        assert_eq!(parsed.checkpoint_id, "cp-001");
        assert_eq!(parsed.thread_id, "thread-123");
        assert!(matches!(parsed.source, CheckpointSource::RustEngine));
        assert_eq!(parsed.created_at, 1704067200);
    }

    #[test]
    fn test_checkpoint_source_serialization() {
        let sources = vec![
            CheckpointSource::RustEngine,
            CheckpointSource::TsOrchestrator,
            CheckpointSource::Hybrid,
        ];

        for source in sources {
            let json = serde_json::to_string(&source).unwrap();
            let parsed: CheckpointSource = serde_json::from_str(&json).unwrap();
            assert_eq!(
                std::mem::discriminant(&source),
                std::mem::discriminant(&parsed)
            );
        }
    }
}
