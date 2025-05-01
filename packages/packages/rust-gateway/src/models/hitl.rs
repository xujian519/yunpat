/**
 * @file HITL 模型
 */
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct HITLRequest {
    pub request_id: String,
    pub session_id: String,
    pub checkpoint_id: String,
    pub content: HITLContent,
    pub options: Vec<HITLOption>,
    pub timeout: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum HITLContent {
    Confirmation {
        message: String,
    },
    Choice {
        message: String,
        choices: Vec<String>,
    },
    Correction {
        message: String,
        data: serde_json::Value,
    },
    Input {
        message: String,
        field_type: String,
    },
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct HITLOption {
    pub id: String,
    pub label: String,
    pub action: HITLAction,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum HITLAction {
    Approve,
    Reject,
    Modify,
    Skip,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct HITLResponse {
    pub request_id: String,
    pub action: HITLAction,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub feedback: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub corrections: Option<HashMap<String, serde_json::Value>>,
}
