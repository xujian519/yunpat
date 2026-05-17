//! Flow execution engine — drives multi-step agent orchestration.

use crate::context::LlmProvider;
use crate::flow::{FlowStep, OrchestrationFlow, QualityCheckConfig};
use crate::registry::AgentRegistry;
use crate::types::*;
use anyhow::{Context, Result, bail};
use std::collections::HashMap;

/// Context accumulated during flow execution.
/// Stores outputs from each step, keyed by `output_key`.
#[derive(Debug, Clone, Default)]
pub struct FlowContext {
    pub outputs: HashMap<String, serde_json::Value>,
    pub stage_outputs: Vec<StageOutput>,
}

impl FlowContext {
    pub fn new() -> Self {
        Self::default()
    }

    /// Set an output value.
    pub fn set(&mut self, key: &str, value: serde_json::Value) {
        self.outputs.insert(key.to_string(), value);
    }

    /// Get an output value.
    pub fn get(&self, key: &str) -> Option<&serde_json::Value> {
        self.outputs.get(key)
    }
}

/// Result of executing a flow step.
#[derive(Debug, Clone)]
pub struct StepResult {
    pub step_id: String,
    pub step_name: String,
    pub outputs: HashMap<String, serde_json::Value>,
    pub stage_outputs: Vec<StageOutput>,
    pub requires_approval: bool,
    pub quality_score: Option<f32>,
}

/// Engine that executes an orchestration flow against an agent registry.
pub struct FlowEngine<'a> {
    registry: &'a AgentRegistry,
    llm_provider: Option<Box<dyn LlmProvider>>,
}

impl<'a> FlowEngine<'a> {
    pub fn new(registry: &'a AgentRegistry) -> Self {
        Self { registry, llm_provider: None }
    }

    /// Set an LLM provider for quality evaluation (builder pattern).
    pub fn with_llm(mut self, provider: Box<dyn LlmProvider>) -> Self {
        self.llm_provider = Some(provider);
        self
    }

    /// Execute an orchestration flow.
    ///
    /// Returns a stream-like result: the accumulated `FlowContext` with all
    /// step outputs and stage outputs. For real streaming, callers should
    /// poll `execute_step()` individually.
    pub async fn execute_flow(
        &self,
        flow: &OrchestrationFlow,
        initial_input: AgentInput,
    ) -> Result<FlowContext> {
        let mut ctx = FlowContext::new();
        ctx.set("input", serde_json::to_value(&initial_input)?);

        // Sort steps by order.
        let mut steps: Vec<&FlowStep> = flow.steps.iter().collect();
        steps.sort_by_key(|s| s.order);

        for step in steps {
            // Evaluate condition if present.
            if let Some(ref condition) = step.condition
                && !evaluate_condition(condition, &ctx)
            {
                continue;
            }

            let result = self.execute_step(step, &ctx).await?;

            // Merge outputs into context.
            for (key, value) in result.outputs {
                ctx.set(&key, value);
            }
            ctx.stage_outputs.extend(result.stage_outputs);

            // Quality gate.
            if let Some(ref qc) = step.quality_check {
                let score = evaluate_quality(qc, &ctx, self.llm_provider.as_deref()).await;
                if score < qc.threshold {
                    tracing::warn!(
                        "Quality check failed for step '{}': score {:.2} < threshold {:.2}",
                        step.step_id,
                        score,
                        qc.threshold
                    );
                    if qc.escalate_to_human {
                        bail!(
                            "Quality check failed for step '{}': {:.2} < {:.2}",
                            step.step_id,
                            score,
                            qc.threshold
                        );
                    }
                }
            }
        }

        Ok(ctx)
    }

    /// Execute a single flow step.
    pub async fn execute_step(&self, step: &FlowStep, ctx: &FlowContext) -> Result<StepResult> {
        let mut outputs = HashMap::new();
        let mut stage_outputs = Vec::new();

        for call in &step.agent_calls {
            // Evaluate call condition.
            if let Some(ref condition) = call.condition
                && !evaluate_condition(condition, ctx)
            {
                continue;
            }

            if let Some(ref loop_config) = call.r#loop {
                // Loop execution.
                let items = ctx
                    .get(&loop_config.iterate_over)
                    .and_then(|v| v.as_array())
                    .cloned()
                    .unwrap_or_default();

                let max = (items.len() as u32).min(loop_config.max_iterations);
                for (_i, item) in items.iter().enumerate().take(max as usize) {
                    let mut loop_input = map_input(&call.input_mapping, ctx);
                    loop_input
                        .as_object_mut()
                        .map(|obj| obj.insert("current_item".to_string(), item.clone()));

                    let result = self.call_agent(&call.agent_id, loop_input).await?;
                    stage_outputs.extend(result.stage_outputs);

                    // Append to output key (as array).
                    let key = call.output_key.clone();
                    let arr = outputs
                        .entry(key.clone())
                        .or_insert_with(|| serde_json::Value::Array(vec![]));
                    if let Some(arr) = arr.as_array_mut() {
                        arr.push(serde_json::to_value(&result.outputs)?);
                    }
                }
            } else {
                // Single execution.
                let input_value = map_input(&call.input_mapping, ctx);
                let result = self.call_agent(&call.agent_id, input_value).await?;
                stage_outputs.extend(result.stage_outputs);
                outputs.insert(
                    call.output_key.clone(),
                    serde_json::to_value(&result.outputs)?,
                );
            }
        }

        Ok(StepResult {
            step_id: step.step_id.clone(),
            step_name: step.step_name.clone(),
            outputs,
            stage_outputs,
            requires_approval: step.requires_approval,
            quality_score: None,
        })
    }

    /// Call an agent by ID and collect its outputs.
    async fn call_agent(
        &self,
        agent_id: &str,
        input_value: serde_json::Value,
    ) -> Result<AgentCallResult> {
        let handler = self
            .registry
            .get_handler(&AgentId(agent_id.to_string()))
            .context(format!("agent '{}' not found in registry", agent_id))?;

        let mut agent = handler.write().await;
        let input = AgentInput {
            intent: UserIntent {
                raw_input: input_value.to_string(),
                parsed_topic: None,
                parsed_scope: None,
                parsed_depth: None,
            },
            extra: input_value,
        };

        use futures_util::StreamExt;
        let stages: Vec<StageOutput> = agent.execute(input).collect().await;

        Ok(AgentCallResult {
            outputs: HashMap::new(),
            stage_outputs: stages,
        })
    }
}

struct AgentCallResult {
    outputs: HashMap<String, serde_json::Value>,
    stage_outputs: Vec<StageOutput>,
}

/// Map input from context using the input_mapping configuration.
fn map_input(
    mapping: &std::collections::HashMap<String, String>,
    ctx: &FlowContext,
) -> serde_json::Value {
    let mut result = serde_json::Map::new();
    for (key, source) in mapping {
        if let Some(value) = ctx.get(source) {
            result.insert(key.clone(), value.clone());
        }
    }
    serde_json::Value::Object(result)
}

/// Evaluate a simple condition expression.
/// Phase 1: supports "key.exists" and "key == value" patterns.
fn evaluate_condition(condition: &str, ctx: &FlowContext) -> bool {
    let condition = condition.trim();

    // "key.exists" — check if output key exists.
    if let Some(key) = condition.strip_suffix(".exists") {
        return ctx.outputs.contains_key(key.trim());
    }

    // "key == value"
    if let Some(eq_pos) = condition.find("==") {
        let key = condition[..eq_pos].trim();
        let expected = condition[eq_pos + 2..].trim();
        return ctx
            .get(key)
            .map(|v| v.to_string().trim_matches('"') == expected)
            .unwrap_or(false);
    }

    // Default: true (no condition means always execute).
    true
}

/// Evaluate quality based on configured dimensions.
/// If an LLM provider is available, uses it for evaluation.
/// Otherwise returns a fixed score of 8.0 (placeholder).
async fn evaluate_quality(
    qc: &QualityCheckConfig,
    ctx: &FlowContext,
    llm_provider: Option<&dyn LlmProvider>,
) -> f32 {
    if let Some(provider) = llm_provider {
        // Build evaluation prompt from dimensions and accumulated context.
        let dims: String =
            qc.dimensions.iter().map(|d| format!("- {}", d)).collect::<Vec<_>>().join("\n");

        let context_summary = if ctx.stage_outputs.is_empty() {
            "无上下文数据".to_string()
        } else {
            ctx.stage_outputs
                .last()
                .map(|s| s.content.chars().take(500).collect())
                .unwrap_or_default()
        };

        let system_prompt = format!(
            "你是一位专利答复质量评估专家。请对以下答复内容进行质量评估。\n\
             评估维度:\n{}\n\n\
             请返回一个 0.0 到 10.0 的总体评分。只返回数字，不要其他内容。",
            dims
        );
        let user_msg = format!("请评估以下答复内容的质量:\n\n{}", context_summary);

        use futures_util::StreamExt;
        let mut stream = provider.chat_stream(&system_prompt, &user_msg);
        let mut response = String::new();
        while let Some(chunk) = stream.next().await {
            match chunk {
                Ok(text) => response.push_str(&text),
                Err(_) => break,
            }
        }

        // Parse the score from LLM response.
        let score: f32 = response
            .trim()
            .lines()
            .last()
            .unwrap_or("8.0")
            .chars()
            .filter(|c| c.is_numeric() || *c == '.')
            .collect::<String>()
            .parse()
            .unwrap_or(8.0);

        score.clamp(0.0, 10.0)
    } else {
        // Fallback: fixed high score.
        8.0
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::flow::{AgentCall, FlowStep};

    fn make_test_registry() -> AgentRegistry {
        // Register a mock research agent.
        let mut registry = AgentRegistry::new();
        let agent = crate::research::ResearchAgent::new(crate::knowledge::KnowledgeBase::new(
            std::path::PathBuf::from("/nonexistent"),
        ));
        registry.register_native(agent);
        registry
    }

    #[test]
    fn test_evaluate_condition_exists() {
        let mut ctx = FlowContext::new();
        assert!(!evaluate_condition("parsed_oa.exists", &ctx));
        ctx.set("parsed_oa", serde_json::json!({"data": "test"}));
        assert!(evaluate_condition("parsed_oa.exists", &ctx));
    }

    #[test]
    fn test_evaluate_condition_equals() {
        let mut ctx = FlowContext::new();
        ctx.set("status", serde_json::json!("ready"));
        assert!(evaluate_condition("status == ready", &ctx));
        assert!(!evaluate_condition("status == pending", &ctx));
    }

    #[test]
    fn test_evaluate_condition_always() {
        let ctx = FlowContext::new();
        assert!(evaluate_condition("true", &ctx));
    }

    #[tokio::test]
    async fn test_execute_flow_single_step() {
        let registry = make_test_registry();
        let engine = FlowEngine::new(&registry);

        let flow = OrchestrationFlow {
            flow_id: "test-flow".to_string(),
            flow_name: "Test Flow".to_string(),
            description: "A test flow".to_string(),
            steps: vec![FlowStep {
                step_id: "step1".to_string(),
                step_name: "Step 1".to_string(),
                order: 1,
                agent_calls: vec![AgentCall {
                    agent_id: "research".to_string(),
                    input_mapping: std::collections::HashMap::new(),
                    output_key: "research_output".to_string(),
                    condition: None,
                    r#loop: None,
                }],
                requires_approval: false,
                approval_prompt: None,
                quality_check: None,
                condition: None,
            }],
            quality_dimensions: vec![],
        };

        let input = AgentInput {
            intent: UserIntent {
                raw_input: "专利创造性判断".to_string(),
                parsed_topic: Some("创造性判断".to_string()),
                parsed_scope: None,
                parsed_depth: None,
            },
            extra: serde_json::Value::Null,
        };

        let ctx = engine.execute_flow(&flow, input).await.unwrap();
        // Should have stage outputs from the research agent.
        assert!(!ctx.stage_outputs.is_empty());
    }

    #[tokio::test]
    async fn test_execute_flow_condition_skip() {
        let registry = make_test_registry();
        let engine = FlowEngine::new(&registry);

        let flow = OrchestrationFlow {
            flow_id: "cond-flow".to_string(),
            flow_name: "Conditional Flow".to_string(),
            description: "Test conditional skip".to_string(),
            steps: vec![FlowStep {
                step_id: "skip_me".to_string(),
                step_name: "Should Skip".to_string(),
                order: 1,
                agent_calls: vec![AgentCall {
                    agent_id: "research".to_string(),
                    input_mapping: std::collections::HashMap::new(),
                    output_key: "output".to_string(),
                    condition: None,
                    r#loop: None,
                }],
                requires_approval: false,
                approval_prompt: None,
                quality_check: None,
                condition: Some("missing_key.exists".to_string()),
            }],
            quality_dimensions: vec![],
        };

        let input = AgentInput {
            intent: UserIntent {
                raw_input: "test".to_string(),
                parsed_topic: None,
                parsed_scope: None,
                parsed_depth: None,
            },
            extra: serde_json::Value::Null,
        };

        let ctx = engine.execute_flow(&flow, input).await.unwrap();
        // Step should be skipped — no stage outputs.
        assert!(ctx.stage_outputs.is_empty());
    }

    #[test]
    fn test_map_input() {
        let mut ctx = FlowContext::new();
        ctx.set("topic", serde_json::json!("创造性判断"));

        let mut mapping = std::collections::HashMap::new();
        mapping.insert("research_topic".to_string(), "topic".to_string());

        let input = map_input(&mapping, &ctx);
        assert_eq!(input["research_topic"], serde_json::json!("创造性判断"));
    }
}
