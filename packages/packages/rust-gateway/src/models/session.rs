use chrono::Utc;
/**
 * @file 会话模型
 */
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Session {
    pub id: String,
    pub user_id: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub status: SessionStatus,
    pub messages: Vec<SessionMessage>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub enum SessionStatus {
    Idle,
    Processing,
    WaitingHITL,
    Completed,
    Error,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SessionMessage {
    pub role: MessageRole,
    pub content: String,
    pub timestamp: i64,
    pub metadata: Option<MessageMetadata>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub enum MessageRole {
    User,
    Assistant,
    System,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct MessageMetadata {
    pub agent: Option<String>,
    pub stage: Option<String>,
    pub confidence: Option<f64>,
}

impl Session {
    pub fn new(user_id: String) -> Self {
        let now = Utc::now().timestamp();
        Self {
            id: Uuid::new_v4().to_string(),
            user_id,
            created_at: now,
            updated_at: now,
            status: SessionStatus::Idle,
            messages: Vec::new(),
        }
    }

    pub fn add_message(&mut self, message: SessionMessage) {
        self.messages.push(message);
        self.updated_at = Utc::now().timestamp();
    }

    pub fn set_status(&mut self, status: SessionStatus) {
        self.status = status;
        self.updated_at = Utc::now().timestamp();
    }
}
