use futures_util::StreamExt;
use std::sync::Arc;
use tokio::sync::{RwLock, mpsc};
use yunpat_agents::context::LlmProvider;
use yunpat_agents::registry::AgentRegistry;
use yunpat_agents::types::{AgentId, AgentInput, StageOutput};

/// Agent 执行器，负责在后台运行 Agent 并将输出流发送到 TUI。
pub struct AgentExecutor {
    registry: Arc<RwLock<AgentRegistry>>,
}

impl AgentExecutor {
    pub fn new(registry: Arc<RwLock<AgentRegistry>>) -> Self {
        Self { registry }
    }

    /// 执行指定的 Agent，返回 Stage 输出流。
    pub async fn execute(
        &self,
        agent_id: AgentId,
        input: AgentInput,
        _llm_provider: Option<Box<dyn LlmProvider>>,
    ) -> anyhow::Result<mpsc::Receiver<StageOutput>> {
        let (tx, rx) = mpsc::channel::<StageOutput>(100);

        let registry = self.registry.clone();

        tokio::spawn(async move {
            let reg = registry.read().await;
            let handler = match reg.get_handler(&agent_id) {
                Some(h) => h,
                None => {
                    let _ = tx
                        .send(StageOutput {
                            stage_id: "error".to_string(),
                            stage_name: "错误".to_string(),
                            stage_type: yunpat_agents::types::StageType::Completed,
                            content: format!("Agent '{}' not found", agent_id),
                            multimodal_content: vec![],
                            artifacts: vec![],
                            requires_approval: false,
                            approval_request: None,
                            metadata: Default::default(),
                        })
                        .await;
                    return;
                }
            };
            drop(reg);

            let mut agent = handler.write().await;

            if let Err(e) = agent.initialize().await {
                let _ = tx
                    .send(StageOutput {
                        stage_id: "error".to_string(),
                        stage_name: "初始化错误".to_string(),
                        stage_type: yunpat_agents::types::StageType::Completed,
                        content: format!("Failed to initialize agent: {}", e),
                        multimodal_content: vec![],
                        artifacts: vec![],
                        requires_approval: false,
                        approval_request: None,
                        metadata: Default::default(),
                    })
                    .await;
                return;
            }

            let mut stream = agent.execute(input);

            while let Some(stage) = stream.next().await {
                if tx.send(stage).await.is_err() {
                    break;
                }
            }

            let _ = agent.terminate().await;
        });

        Ok(rx)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use yunpat_agents::types::UserIntent;

    #[tokio::test]
    async fn test_agent_executor_creation() {
        let registry = Arc::new(RwLock::new(AgentRegistry::new()));
        let executor = AgentExecutor::new(registry);

        let input = AgentInput {
            intent: UserIntent {
                raw_input: "test".to_string(),
                parsed_topic: None,
                parsed_scope: None,
                parsed_depth: None,
            },
            extra: serde_json::Value::Null,
        };

        let rx = executor
            .execute(AgentId("nonexistent".to_string()), input, None)
            .await;
        assert!(rx.is_ok());
    }
}
