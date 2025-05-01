//! Case management types (Article 14 of the Constitution).

use crate::types::AgentId;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Patent type classification.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PatentType {
    Invention,
    UtilityModel,
    Design,
}

/// Case status.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CaseStatus {
    Active,
    Archived,
    Deleted,
}

/// Document type within a case.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DocType {
    Disclosure,
    Application,
    OfficeAction,
    Response,
    ReexaminationRequest,
    InvalidationRequest,
    Other,
}

/// Task status for a case task.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TaskStatus {
    Running,
    Completed,
    Failed,
    Canceled,
}

/// A case representing a patent matter.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Case {
    pub case_id: String,
    pub application_no: Option<String>,
    pub title: String,
    pub patent_type: PatentType,
    pub inventor: Option<String>,
    pub agent: Option<String>,
    pub applicant: Option<String>,
    #[serde(default)]
    pub documents: Vec<CaseDocument>,
    #[serde(default)]
    pub tasks: Vec<CaseTask>,
    pub status: CaseStatus,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// A document associated with a case.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaseDocument {
    pub doc_id: String,
    pub doc_type: DocType,
    pub file_path: String,
    pub uploaded_at: DateTime<Utc>,
    #[serde(default)]
    pub metadata: serde_json::Value,
}

/// A task within a case, tracking agent execution.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaseTask {
    pub task_id: String,
    pub agent_id: AgentId,
    pub started_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
    pub status: TaskStatus,
    pub output_artifacts: Option<Vec<String>>,
}
