//! # Patent Agent - 专利智能体
//!
//! 提供专利撰写、分析、答复等智能体功能

pub mod agent;
pub mod coordinator;
pub mod learning;

pub use agent::{PatentAgent, PatentAgentConfig};
pub use coordinator::AgentCoordinator;
pub use learning::HebbianLearner;

/// 专利智能体版本
pub const VERSION: &str = "0.1.0";
