use crate::flow::OrchestrationFlow;
use anyhow::{Context, Result};

pub fn load_from_file(path: &std::path::Path) -> Result<OrchestrationFlow> {
    let content = std::fs::read_to_string(path)
        .with_context(|| format!("failed to read flow file: {}", path.display()))?;
    load_from_yaml(&content)
}

pub fn load_from_yaml(yaml: &str) -> Result<OrchestrationFlow> {
    serde_yaml::from_str(yaml).context("failed to parse flow YAML")
}

pub fn load_from_json(json: &str) -> Result<OrchestrationFlow> {
    serde_json::from_str(json).context("failed to parse flow JSON")
}

pub fn validate_flow(flow: &OrchestrationFlow) -> Result<()> {
    let mut orders: Vec<u32> = flow.steps.iter().map(|s| s.order).collect();
    orders.sort();
    for (i, &order) in orders.iter().enumerate() {
        let expected = (i + 1) as u32;
        if order != expected {
            anyhow::bail!(
                "Step order mismatch: expected {} at position {}, got {}",
                expected,
                i,
                order
            );
        }
    }

    let mut ids = std::collections::HashSet::new();
    for step in &flow.steps {
        if !ids.insert(&step.step_id) {
            anyhow::bail!("Duplicate step_id: {}", step.step_id);
        }
    }

    let mut output_keys = std::collections::HashSet::new();
    for step in &flow.steps {
        for call in &step.agent_calls {
            if !output_keys.insert(&call.output_key) {
                anyhow::bail!("Duplicate output_key: {}", call.output_key);
            }
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    const TEST_FLOW_YAML: &str = r#"
flow_id: test-flow
flow_name: Test Flow
description: A test workflow
steps:
  - step_id: step1
    step_name: Step 1
    order: 1
    agent_calls:
      - agent_id: test-agent
        output_key: output1
    requires_approval: false
quality_dimensions: []
"#;

    #[test]
    fn test_load_from_yaml() {
        let flow = load_from_yaml(TEST_FLOW_YAML).unwrap();
        assert_eq!(flow.flow_id, "test-flow");
        assert_eq!(flow.steps.len(), 1);
    }

    #[test]
    fn test_validate_flow_ok() {
        let flow = load_from_yaml(TEST_FLOW_YAML).unwrap();
        assert!(validate_flow(&flow).is_ok());
    }

    #[test]
    fn test_validate_duplicate_step_id() {
        let yaml = r#"
flow_id: bad-flow
flow_name: Bad Flow
description: Duplicate step IDs
steps:
  - step_id: step1
    step_name: Step 1
    order: 1
    agent_calls:
      - agent_id: test-agent
        output_key: output1
    requires_approval: false
  - step_id: step1
    step_name: Step 2
    order: 2
    agent_calls:
      - agent_id: test-agent
        output_key: output2
    requires_approval: false
quality_dimensions: []
"#;
        let flow = load_from_yaml(yaml).unwrap();
        let result = validate_flow(&flow);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("Duplicate step_id"));
    }

    #[test]
    fn test_validate_order_mismatch() {
        let yaml = r#"
flow_id: bad-flow
flow_name: Bad Flow
description: Order mismatch
steps:
  - step_id: step1
    step_name: Step 1
    order: 1
    agent_calls:
      - agent_id: test-agent
        output_key: output1
    requires_approval: false
  - step_id: step2
    step_name: Step 2
    order: 3
    agent_calls:
      - agent_id: test-agent
        output_key: output2
    requires_approval: false
quality_dimensions: []
"#;
        let flow = load_from_yaml(yaml).unwrap();
        let result = validate_flow(&flow);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("order mismatch"));
    }

    #[test]
    fn test_load_from_json() {
        let json = serde_json::json!({
            "flow_id": "json-flow",
            "flow_name": "JSON Flow",
            "description": "Loaded from JSON",
            "steps": [
                {
                    "step_id": "s1",
                    "step_name": "Step 1",
                    "order": 1,
                    "agent_calls": [{"agent_id": "a1", "output_key": "o1"}],
                    "requires_approval": false
                }
            ],
            "quality_dimensions": []
        });
        let flow = load_from_json(&json.to_string()).unwrap();
        assert_eq!(flow.flow_id, "json-flow");
    }
}
