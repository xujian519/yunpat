//! MCP Agent Adapter — wraps an MCP server as a `PatentAgent` trait implementation.

use anyhow::Result;
use async_trait::async_trait;
use futures_core::Stream;
use serde::{Deserialize, Serialize};
use std::pin::Pin;
use std::sync::Arc;
use yunpat_agents::agent::PatentAgent;
use yunpat_agents::types::*;

use crate::bridge::{MCPBridge, ServerHandle};

/// Configuration for an MCP-backed agent.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct McpAgentConfig {
    /// The agent ID to register.
    pub agent_id: String,
    /// Display name.
    pub agent_name: String,
    /// Description.
    pub agent_description: String,
    /// The MCP tool name to call for execution.
    pub tool_name: String,
    /// Stage definitions (loaded from config, not from the MCP server).
    pub stages: Vec<StageDefinition>,
    /// Keywords for intent matching.
    #[serde(default)]
    pub keywords: Vec<String>,
    /// Tool call timeout in seconds. Defaults to 60s if unset.
    #[serde(default)]
    pub timeout_secs: Option<u64>,
}

/// Adapter that wraps an MCP server tool as a `PatentAgent`.
///
/// The adapter:
/// - Implements `can_handle()` using keyword matching
/// - Implements `execute()` by calling the MCP tool via `MCPBridge::invoke()`
/// - Converts the MCP tool result into `StageOutput` items
pub struct McpAgentAdapter {
    config: McpAgentConfig,
    server_handle: Option<Arc<ServerHandle>>,
    initialized: bool,
}

impl McpAgentAdapter {
    pub fn new(config: McpAgentConfig) -> Self {
        Self {
            config,
            server_handle: None,
            initialized: false,
        }
    }

    /// Inject a live MCP server handle for real tool calls.
    pub fn set_server_handle(&mut self, handle: Arc<ServerHandle>) {
        self.server_handle = Some(handle);
    }
}

#[async_trait]
impl PatentAgent for McpAgentAdapter {
    fn id(&self) -> &AgentId {
        // McpAgentAdapter is not meant to be used directly as PatentAgent.
        // Use McpAgentAdapterWithId which stores AgentId inline.
        panic!("McpAgentAdapter::id() called — use McpAgentAdapterWithId instead")
    }

    fn name(&self) -> &str {
        &self.config.agent_name
    }

    fn description(&self) -> &str {
        &self.config.agent_description
    }

    fn capabilities(&self) -> &[String] {
        static CAPS: std::sync::OnceLock<Vec<String>> = std::sync::OnceLock::new();
        CAPS.get_or_init(|| vec!["mcp_tool_call".to_string()])
    }

    fn can_handle(&self, intent: &UserIntent) -> Confidence {
        let input = &intent.raw_input;
        let lower = input.to_lowercase();

        let matches = self.config.keywords.iter().filter(|kw| lower.contains(kw.as_str())).count();

        if matches == 0 {
            return 0.0;
        }

        let base = 0.4;
        let boost = (matches as f32 * 0.15).min(0.6);
        (base + boost).min(1.0)
    }

    fn stages(&self) -> Vec<StageDefinition> {
        self.config.stages.clone()
    }

    async fn initialize(&mut self) -> Result<()> {
        self.initialized = true;
        Ok(())
    }

    fn execute(&mut self, input: AgentInput) -> Pin<Box<dyn Stream<Item = StageOutput> + Send>> {
        let tool_name = self.config.tool_name.clone();
        let stages = self.config.stages.clone();
        let server_handle = self.server_handle.clone();
        let timeout_secs = self.config.timeout_secs.unwrap_or(60);
        let raw_input = input.intent.raw_input.clone();
        let extra = input.extra.clone();

        Box::pin(async_stream::stream! {
            // Emit progress stage.
            yield StageOutput {
                stage_id: "mcp_call".to_string(),
                stage_name: "MCP 工具调用".to_string(),
                stage_type: StageType::Progress,
                content: format!("正在调用 MCP 工具: {}", tool_name),
                multimodal_content: vec![],
                artifacts: vec![],
                requires_approval: false,
                approval_request: None,
                metadata: Default::default(),
            };

            let result_content = if let Some(handle) = server_handle {
                // Real MCP call via bridge.
                let mcp_input = serde_json::json!({
                    "raw_input": raw_input,
                    "extra": extra,
                });
                let timeout = Some(std::time::Duration::from_secs(timeout_secs));
                match MCPBridge::invoke(&handle, &tool_name, mcp_input, timeout).await {
                    Ok(tool_result) => {
                        if tool_result.is_error {
                            format!("MCP 工具 '{}' 返回错误: {}", tool_name, serde_json::to_string_pretty(&tool_result.content).unwrap_or_else(|_| tool_result.content.to_string()))
                        } else {
                            serde_json::to_string_pretty(&tool_result.content)
                                .unwrap_or_else(|_| tool_result.content.to_string())
                        }
                    }
                    Err(e) => format!("MCP 工具 '{}' 调用失败: {}", tool_name, e),
                }
            } else {
                // Fallback: no server handle injected yet.
                format!(
                    "MCP 工具 '{}' 调用（输入: {}）— 等待 MCP Bridge 连接",
                    tool_name,
                    raw_input.chars().take(50).collect::<String>()
                )
            };

            yield StageOutput {
                stage_id: "result".to_string(),
                stage_name: "结果".to_string(),
                stage_type: StageType::Draft,
                content: result_content,
                multimodal_content: vec![],
                artifacts: vec![],
                requires_approval: false,
                approval_request: None,
                metadata: Default::default(),
            };

            // If stages have approval, emit the final approval gate.
            if let Some(last) = stages.last()
                && last.requires_approval
            {
                    yield StageOutput {
                        stage_id: last.stage_id.clone(),
                        stage_name: last.stage_name.clone(),
                        stage_type: StageType::Completed,
                        content: "MCP 智能体执行完成，请确认结果。".to_string(),
                        multimodal_content: vec![],
                        artifacts: vec![],
                        requires_approval: true,
                        approval_request: Some(ApprovalRequest {
                            prompt: "结果是否符合预期？".to_string(),
                            options: vec![
                                ApprovalOption {
                                    label: "确认".to_string(),
                                    value: "approve".to_string(),
                                    is_default: true,
                                },
                                ApprovalOption {
                                    label: "重试".to_string(),
                                    value: "retry".to_string(),
                                    is_default: false,
                                },
                            ],
                        }),
                        metadata: Default::default(),
                    };
            }
        })
    }

    async fn terminate(&mut self) -> Result<()> {
        self.initialized = false;
        Ok(())
    }
}

// The id() method can't return a reference with OnceLock for dynamic data.
// Use a wrapper that stores the AgentId inline.
/// A version of McpAgentAdapter that stores the AgentId inline for the trait.
pub struct McpAgentAdapterWithId {
    inner: McpAgentAdapter,
    agent_id: AgentId,
}

impl McpAgentAdapterWithId {
    pub fn new(config: McpAgentConfig) -> Self {
        let agent_id = AgentId(config.agent_id.clone());
        Self {
            inner: McpAgentAdapter::new(config),
            agent_id,
        }
    }

    /// Forward server handle injection to inner adapter.
    pub fn set_server_handle(&mut self, handle: Arc<ServerHandle>) {
        self.inner.set_server_handle(handle);
    }
}

#[async_trait]
impl PatentAgent for McpAgentAdapterWithId {
    fn id(&self) -> &AgentId {
        &self.agent_id
    }

    fn name(&self) -> &str {
        self.inner.name()
    }

    fn description(&self) -> &str {
        self.inner.description()
    }

    fn capabilities(&self) -> &[String] {
        self.inner.capabilities()
    }

    fn can_handle(&self, intent: &UserIntent) -> Confidence {
        self.inner.can_handle(intent)
    }

    fn stages(&self) -> Vec<StageDefinition> {
        self.inner.stages()
    }

    async fn initialize(&mut self) -> Result<()> {
        self.inner.initialize().await
    }

    fn execute(&mut self, input: AgentInput) -> Pin<Box<dyn Stream<Item = StageOutput> + Send>> {
        self.inner.execute(input)
    }

    async fn terminate(&mut self) -> Result<()> {
        self.inner.terminate().await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_config() -> McpAgentConfig {
        McpAgentConfig {
            agent_id: "test-mcp-agent".to_string(),
            agent_name: "Test MCP Agent".to_string(),
            agent_description: "A test MCP-backed agent".to_string(),
            tool_name: "test_tool".to_string(),
            stages: vec![
                StageDefinition {
                    stage_id: "step1".to_string(),
                    stage_name: "Step 1".to_string(),
                    description: "First step".to_string(),
                    requires_approval: false,
                },
                StageDefinition {
                    stage_id: "step2".to_string(),
                    stage_name: "Step 2".to_string(),
                    description: "Final step".to_string(),
                    requires_approval: true,
                },
            ],
            keywords: vec!["审查意见".to_string(), "答辩".to_string()],
            timeout_secs: None,
        }
    }

    #[test]
    fn test_adapter_metadata() {
        let adapter = McpAgentAdapterWithId::new(test_config());
        assert_eq!(adapter.id().0, "test-mcp-agent");
        assert_eq!(adapter.name(), "Test MCP Agent");
        assert_eq!(adapter.stages().len(), 2);
    }

    #[test]
    fn test_can_handle() {
        let adapter = McpAgentAdapterWithId::new(test_config());
        let intent = UserIntent {
            raw_input: "收到审查意见需要答辩".to_string(),
            parsed_topic: None,
            parsed_scope: None,
            parsed_depth: None,
        };
        let conf = adapter.can_handle(&intent);
        assert!(conf > 0.5);
    }

    #[test]
    fn test_cannot_handle() {
        let adapter = McpAgentAdapterWithId::new(test_config());
        let intent = UserIntent {
            raw_input: "今天天气怎么样".to_string(),
            parsed_topic: None,
            parsed_scope: None,
            parsed_depth: None,
        };
        let conf = adapter.can_handle(&intent);
        assert_eq!(conf, 0.0);
    }

    #[tokio::test]
    async fn test_execute_returns_stages() {
        let mut adapter = McpAgentAdapterWithId::new(test_config());
        adapter.initialize().await.unwrap();

        let input = AgentInput {
            intent: UserIntent {
                raw_input: "审查意见答辩".to_string(),
                parsed_topic: None,
                parsed_scope: None,
                parsed_depth: None,
            },
            extra: serde_json::Value::Null,
        };

        use futures_util::StreamExt;
        let stages: Vec<StageOutput> = adapter.execute(input).collect().await;
        assert_eq!(stages.len(), 3); // progress + result + approval
        assert!(stages[2].requires_approval);
    }
}
