//! Core agent traits.

use crate::types::{AgentId, AgentInput, Confidence, StageDefinition, StageOutput, UserIntent};
use anyhow::Result;
use async_trait::async_trait;
use futures_core::Stream;
use std::pin::Pin;

/// Core trait for all patent agents.
///
/// Each agent declares its identity, capabilities, and stages.
/// The `execute()` method returns a stream of `StageOutput` items
/// that the TUI renders incrementally.
#[async_trait]
pub trait PatentAgent: Send + Sync {
    fn id(&self) -> &AgentId;
    fn name(&self) -> &str;
    fn description(&self) -> &str;
    fn capabilities(&self) -> &[String];
    fn can_handle(&self, intent: &UserIntent) -> Confidence;
    fn stages(&self) -> Vec<StageDefinition>;

    async fn initialize(&mut self) -> Result<()>;
    fn execute(&mut self, input: AgentInput) -> Pin<Box<dyn Stream<Item = StageOutput> + Send>>;
    async fn terminate(&mut self) -> Result<()>;
}

/// Extended trait for orchestration agents that drive multi-step flows.
#[async_trait]
pub trait OrchestrationAgent: PatentAgent {
    fn flow_definition(&self) -> crate::flow::OrchestrationFlow;
}
