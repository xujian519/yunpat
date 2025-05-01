//! 智能体协调器

use crate::agent::{PatentAgent, Task, TaskResult};
use std::collections::HashMap;

/// 智能体协调器
pub struct AgentCoordinator {
    /// 智能体注册表
    agents: HashMap<String, PatentAgent>,
    /// 默认智能体
    default_agent: Option<String>,
}

impl AgentCoordinator {
    /// 创建新的协调器
    pub fn new() -> Self {
        Self {
            agents: HashMap::new(),
            default_agent: None,
        }
    }

    /// 注册智能体
    pub fn register_agent(&mut self, name: String, agent: PatentAgent) {
        self.agents.insert(name.clone(), agent);
        if self.default_agent.is_none() {
            self.default_agent = Some(name);
        }
    }

    /// 执行任务
    pub async fn execute(&self, task: Task) -> Result<TaskResult, String> {
        // 根据任务类型选择合适的智能体
        let agent_name = self.select_agent_for_task(&task);
        let agent = self
            .agents
            .get(agent_name)
            .ok_or_else(|| format!("智能体 {} 不存在", agent_name))?;

        agent.execute(task).await
    }

    /// 选择执行任务的智能体
    fn select_agent_for_task(&self, task: &Task) -> &str {
        match task {
            Task::WritePatent(_) => "writer",
            Task::RespondToOfficeAction(_) => "responder",
            Task::AnalyzePatent(_) => "analyzer",
            Task::ManagePatent(_) => "manager",
        }
    }

    /// 获取智能体列表
    pub fn list_agents(&self) -> Vec<String> {
        self.agents.keys().cloned().collect()
    }
}

impl Default for AgentCoordinator {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::PatentAgentConfig;

    #[tokio::test]
    async fn test_coordinator() {
        let mut coordinator = AgentCoordinator::new();

        let config = PatentAgentConfig {
            name: "test-agent".to_string(),
            agent_type: crate::agent::PatentAgentType::Writer,
            api_key: "test-key".to_string(),
            max_iterations: 10,
        };

        let agent = PatentAgent::new(config);
        coordinator.register_agent("writer".to_string(), agent);

        let agents = coordinator.list_agents();
        assert_eq!(agents.len(), 1);
    }
}
