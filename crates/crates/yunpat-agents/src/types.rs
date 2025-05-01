//! Core types for the YunPat agent system.

use serde::{Deserialize, Serialize};

/// Unique identifier for an agent.
#[derive(Debug, Clone, Hash, Eq, PartialEq, Serialize, Deserialize)]
pub struct AgentId(pub String);

impl std::fmt::Display for AgentId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl From<&str> for AgentId {
    fn from(s: &str) -> Self {
        AgentId(s.to_string())
    }
}

/// Confidence score returned by `can_handle()`. Range 0.0–1.0.
pub type Confidence = f32;

/// Stage type classification.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum StageType {
    Analysis,
    Suggestion,
    Draft,
    Question,
    Progress,
    Completed,
}

/// Metadata attached to a stage output.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct StageMetadata {
    pub token_usage: Option<TokenUsage>,
    pub duration_ms: Option<u64>,
    pub extra: serde_json::Value,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct TokenUsage {
    pub input_tokens: u32,
    pub output_tokens: u32,
}

/// Multimodal content attached to a stage output.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case", tag = "type")]
pub enum MultimodalContent {
    ImageAnalysis {
        source: String,
        description: String,
        annotations: Vec<Annotation>,
    },
    DocumentScan {
        source: String,
        description: String,
    },
    DiagramAnnotation {
        source: String,
        description: String,
        annotations: Vec<Annotation>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Annotation {
    pub label: String,
    pub detail: String,
}

/// Artifact produced by a stage.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Artifact {
    pub name: String,
    pub artifact_type: String,
    pub content: String,
    pub path: Option<String>,
}

/// Approval request presented to the user.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApprovalRequest {
    pub prompt: String,
    pub options: Vec<ApprovalOption>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApprovalOption {
    pub label: String,
    pub value: String,
    pub is_default: bool,
}

/// Output produced by an agent at each stage.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StageOutput {
    pub stage_id: String,
    pub stage_name: String,
    pub stage_type: StageType,
    pub content: String,
    #[serde(default)]
    pub multimodal_content: Vec<MultimodalContent>,
    #[serde(default)]
    pub artifacts: Vec<Artifact>,
    pub requires_approval: bool,
    #[serde(default)]
    pub approval_request: Option<ApprovalRequest>,
    #[serde(default)]
    pub metadata: StageMetadata,
}

/// Definition of a stage (not the output).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StageDefinition {
    pub stage_id: String,
    pub stage_name: String,
    pub description: String,
    pub requires_approval: bool,
}

/// User intent parsed from raw input.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct UserIntent {
    pub raw_input: String,
    pub parsed_topic: Option<String>,
    pub parsed_scope: Option<String>,
    pub parsed_depth: Option<String>,
}

/// Input passed to an agent's `execute()`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentInput {
    pub intent: UserIntent,
    pub extra: serde_json::Value,
}

/// Transport mechanism for an agent.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Transport {
    Native,
    Mcp,
}
