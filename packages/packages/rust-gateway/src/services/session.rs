use crate::models::{Session, SessionMessage, SessionStatus};
/**
 * @file 会话管理服务
 */
use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use tokio::sync::broadcast;

pub struct SessionStore {
    sessions: Arc<RwLock<HashMap<String, Session>>>,
}

impl SessionStore {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub fn create(&self, user_id: String) -> Session {
        let session = Session::new(user_id);
        self.sessions
            .write()
            .unwrap_or_else(|e| e.into_inner())
            .insert(session.id.clone(), session.clone());
        session
    }

    pub fn get(&self, id: &str) -> Option<Session> {
        self.sessions
            .read()
            .unwrap_or_else(|e| e.into_inner())
            .get(id)
            .cloned()
    }

    pub fn update<F>(&self, id: &str, f: F) -> Option<Session>
    where
        F: FnOnce(&mut Session),
    {
        let mut sessions = self.sessions.write().unwrap_or_else(|e| e.into_inner());
        let session = sessions.get_mut(id)?;
        f(session);
        Some(session.clone())
    }

    pub fn delete(&self, id: &str) -> Option<Session> {
        self.sessions
            .write()
            .unwrap_or_else(|e| e.into_inner())
            .remove(id)
    }

    pub fn list(&self) -> Vec<Session> {
        self.sessions
            .read()
            .unwrap_or_else(|e| e.into_inner())
            .values()
            .cloned()
            .collect()
    }
}

impl Default for SessionStore {
    fn default() -> Self {
        Self::new()
    }
}

pub struct SessionManager {
    store: SessionStore,
    event_tx: broadcast::Sender<crate::models::GatewayEvent>,
}

impl SessionManager {
    pub fn new(
        store: SessionStore,
        event_tx: broadcast::Sender<crate::models::GatewayEvent>,
    ) -> Self {
        Self { store, event_tx }
    }

    pub fn create_session(&self, user_id: String) -> Session {
        let session = self.store.create(user_id);
        self.emit_event("connected", serde_json::json!({ "session_id": session.id }));
        session
    }

    pub fn get_session(&self, id: &str) -> Option<Session> {
        self.store.get(id)
    }

    pub fn delete_session(&self, id: &str) -> Option<Session> {
        let session = self.store.delete(id)?;
        self.emit_event("disconnected", serde_json::json!({ "session_id": id }));
        Some(session)
    }

    pub fn add_message(&self, session_id: &str, message: SessionMessage) {
        if let Some(session) = self
            .store
            .update(session_id, |s| s.add_message(message.clone()))
        {
            let _ = session; // 仅确认更新成功
            let payload = serde_json::to_value(&message).unwrap_or_else(|e| {
                tracing::error!("Failed to serialize message: {}", e);
                serde_json::json!({"error": "serialization_failed"})
            });
            self.emit_event("message", payload);
        }
    }

    pub fn set_status(&self, session_id: &str, status: SessionStatus) {
        if self
            .store
            .update(session_id, |s| s.set_status(status.clone()))
            .is_some()
        {
            self.emit_event("status", serde_json::json!({ "status": status }));
        }
    }

    /// 通用 session 更新（Phase 2: 支持 intent_history 等扩展字段更新）
    pub fn update_session<F>(&self, session_id: &str, f: F) -> Option<crate::models::Session>
    where
        F: FnOnce(&mut crate::models::Session),
    {
        self.store.update(session_id, f)
    }

    fn emit_event(&self, _event_type: &str, payload: serde_json::Value) {
        let event = crate::models::GatewayEvent::new(
            "system".to_string(),
            crate::models::EventType::Connected, // 简化处理
            payload,
        );
        let _ = self.event_tx.send(event);
    }
}
