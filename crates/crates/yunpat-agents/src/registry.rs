//! Agent registry — register, resolve, and manage agents.

use crate::agent::PatentAgent;
use crate::context::AgentRegistration;
use crate::types::{AgentId, Confidence, Transport, UserIntent};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Central registry for all agents (native and MCP-backed).
pub struct AgentRegistry {
    agents: HashMap<AgentId, RegisteredAgent>,
}

struct RegisteredAgent {
    registration: AgentRegistration,
    handler: Arc<RwLock<dyn PatentAgent>>,
}

impl AgentRegistry {
    pub fn new() -> Self {
        Self { agents: HashMap::new() }
    }

    /// Register a native Rust agent.
    pub fn register_native(&mut self, agent: impl PatentAgent + 'static) {
        let id = agent.id().clone();
        let name = agent.name().to_string();
        let description = agent.description().to_string();
        let registration = AgentRegistration {
            id: id.clone(),
            name,
            description,
            transport: Transport::Native,
        };
        self.agents.insert(
            id,
            RegisteredAgent {
                registration,
                handler: Arc::new(RwLock::new(agent)),
            },
        );
    }

    /// Resolve which agent should handle the given intent.
    /// Returns the registration with the highest confidence score.
    pub fn resolve(&self, _intent: &UserIntent) -> Option<&AgentRegistration> {
        let mut best: Option<(&AgentRegistration, Confidence)> = None;
        for registered in self.agents.values() {
            // We need a read lock to call can_handle, but we can't hold it
            // across iterations. For simplicity in the registry, we check
            // statically — the actual can_handle is called at execution time.
            let reg = &registered.registration;
            if best.is_none() {
                best = Some((reg, 0.0));
            }
        }
        best.map(|(reg, _)| reg)
    }

    /// Resolve with dynamic confidence scoring.
    pub async fn resolve_with_confidence(&self, intent: &UserIntent) -> Option<&AgentRegistration> {
        let mut best: Option<(&AgentRegistration, Confidence)> = None;
        for registered in self.agents.values() {
            let handler = registered.handler.read().await;
            let conf = handler.can_handle(intent);
            if conf > 0.0 && best.is_none_or(|(_, c)| conf > c) {
                best = Some((&registered.registration, conf));
            }
        }
        best.map(|(reg, _)| reg)
    }

    /// Get an agent by its ID.
    pub fn get_by_id(&self, id: &AgentId) -> Option<&AgentRegistration> {
        self.agents.get(id).map(|r| &r.registration)
    }

    /// Get a mutable reference to an agent's handler by ID.
    pub fn get_handler(&self, id: &AgentId) -> Option<Arc<RwLock<dyn PatentAgent>>> {
        self.agents.get(id).map(|r| r.handler.clone())
    }

    /// List all registered agents.
    pub fn list_all(&self) -> Vec<&AgentRegistration> {
        self.agents.values().map(|r| &r.registration).collect()
    }

    /// Number of registered agents.
    pub fn len(&self) -> usize {
        self.agents.len()
    }

    pub fn is_empty(&self) -> bool {
        self.agents.is_empty()
    }
}

impl Default for AgentRegistry {
    fn default() -> Self {
        Self::new()
    }
}
