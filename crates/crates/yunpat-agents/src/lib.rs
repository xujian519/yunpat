//! YunPat Agent System — traits, registry, and orchestration types.
//!
//! This crate defines the core abstractions for patent agents:
//! - `PatentAgent` trait (single-stage agents)
//! - `OrchestrationAgent` trait (multi-step flow agents)
//! - `AgentRegistry` (registration and resolution)
//! - `OrchestrationFlow` (declarative flow definitions)
//! - `Case` management types

pub mod agent;
pub mod case;
pub mod context;
pub mod creativity;
pub mod drafting;
pub mod flow;
pub mod flow_executor;
pub mod flow_loader;
pub mod helpers;
pub mod invalidation;
pub mod knowledge;
pub mod oa_response;
pub mod reexamination;
pub mod registry;
pub mod research;
pub mod tools;
pub mod trademark;
pub mod types;
pub mod vector_store;

pub use agent::{OrchestrationAgent, PatentAgent};
pub use case::{Case, CaseDocument, CaseStatus, CaseTask, DocType, PatentType, TaskStatus};
pub use context::{AgentContext, AgentRegistration, EmbeddingProvider};
pub use flow::{
    AgentCall, FlowStep, LoopConfig, OrchestrationFlow, QualityCheckConfig, QualityDimension,
};
pub use registry::AgentRegistry;
pub use types::*;
pub use vector_store::{VectorDocument, VectorSearchResult, VectorStore};
