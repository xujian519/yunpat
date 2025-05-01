//! Orchestration flow types for multi-step agent coordination.

use serde::{Deserialize, Serialize};

/// A declarative orchestration flow definition.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrchestrationFlow {
    pub flow_id: String,
    pub flow_name: String,
    pub description: String,
    pub steps: Vec<FlowStep>,
    #[serde(default)]
    pub quality_dimensions: Vec<QualityDimension>,
}

/// A single step in an orchestration flow.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlowStep {
    pub step_id: String,
    pub step_name: String,
    pub order: u32,
    pub agent_calls: Vec<AgentCall>,
    pub requires_approval: bool,
    #[serde(default)]
    pub approval_prompt: Option<String>,
    #[serde(default)]
    pub quality_check: Option<QualityCheckConfig>,
    #[serde(default)]
    pub condition: Option<String>,
}

/// A call to an agent within a flow step.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentCall {
    pub agent_id: String,
    #[serde(default)]
    pub input_mapping: std::collections::HashMap<String, String>,
    pub output_key: String,
    #[serde(default)]
    pub condition: Option<String>,
    #[serde(default)]
    pub r#loop: Option<LoopConfig>,
}

/// Loop configuration for iterating over list data.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoopConfig {
    pub iterate_over: String,
    pub max_iterations: u32,
}

/// Quality check configuration between steps.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QualityCheckConfig {
    pub dimensions: Vec<String>,
    pub threshold: f32,
    #[serde(default = "default_max_retries")]
    pub max_auto_retries: u32,
    #[serde(default = "default_true")]
    pub escalate_to_human: bool,
}

fn default_max_retries() -> u32 {
    3
}

fn default_true() -> bool {
    true
}

/// A quality dimension definition.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QualityDimension {
    pub name: String,
    pub description: String,
    pub weight: f32,
}
