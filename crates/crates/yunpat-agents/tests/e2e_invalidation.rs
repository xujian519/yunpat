//! End-to-end test for the invalidation workflow with REAL LLM.
//!
//! This test drives the full 5-step patent invalidation flow using real
//! test data from tests/manual/无效/ and a live DeepSeek LLM provider.

use futures_core::Stream;
use futures_util::StreamExt;
use std::path::PathBuf;
use std::pin::Pin;
use yunpat_agents::PatentAgent;

/// A simple live LLM provider that calls DeepSeek API directly.
struct DeepSeekLlmProvider {
    api_key: String,
    base_url: String,
    model: String,
    client: reqwest::Client,
}

impl DeepSeekLlmProvider {
    fn from_env() -> Option<Self> {
        let api_key = std::env::var("DEEPSEEK_API_KEY").ok()?;
        let base_url = std::env::var("DEEPSEEK_BASE_URL")
            .unwrap_or_else(|_| "https://api.deepseek.com/v1".to_string());
        let model = std::env::var("LLM_MODEL").unwrap_or_else(|_| "deepseek-chat".to_string());
        Some(Self {
            api_key,
            base_url,
            model,
            client: reqwest::Client::new(),
        })
    }
}

impl yunpat_agents::context::LlmProvider for DeepSeekLlmProvider {
    fn chat_stream(
        &self,
        system_prompt: &str,
        user_message: &str,
    ) -> Pin<Box<dyn Stream<Item = Result<String, anyhow::Error>> + Send>> {
        let url = format!("{}/chat/completions", self.base_url);
        let api_key = self.api_key.clone();
        let model = self.model.clone();
        let client = self.client.clone();
        let system = system_prompt.to_string();
        let user = user_message.to_string();

        Box::pin(async_stream::stream! {
            let body = serde_json::json!({
                "model": model,
                "messages": [
                    { "role": "system", "content": system },
                    { "role": "user", "content": user }
                ],
                "stream": true,
                "temperature": 0.7,
            });

            let resp = client.post(&url)
                .json(&body)
                .bearer_auth(&api_key)
                .header("Accept", "text/event-stream")
                .send()
                .await;

            let resp = match resp {
                Ok(r) => r,
                Err(e) => {
                    yield Err(anyhow::anyhow!("request failed: {}", e));
                    return;
                }
            };

            if !resp.status().is_success() {
                let status = resp.status();
                let text = resp.text().await.unwrap_or_default();
                yield Err(anyhow::anyhow!("API error {}: {}", status, text));
                return;
            }

            // Read the full streaming response as text and parse SSE lines.
            let body_text = match resp.text().await {
                Ok(t) => t,
                Err(e) => {
                    yield Err(anyhow::anyhow!("failed to read response: {}", e));
                    return;
                }
            };

            for line in body_text.lines() {
                let line = line.trim();
                if !line.starts_with("data: ") {
                    continue;
                }
                let data = &line[6..];
                if data == "[DONE]" {
                    return;
                }
                let json: serde_json::Value = match serde_json::from_str(data) {
                    Ok(v) => v,
                    Err(_) => continue,
                };
                if let Some(content) = json["choices"][0]["delta"]["content"].as_str() {
                    yield Ok(content.to_string());
                }
            }
        })
    }
}

#[tokio::test]
async fn test_invalidation_workflow_end_to_end() {
    // Real test data from the manual test directory.
    let case_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .join("tests/manual/无效");
    let yunpat_md = std::fs::read_to_string(case_dir.join("yunpat.md")).unwrap();
    let petition_md =
        std::fs::read_to_string(case_dir.join("无效宣告请求书_CN204762379U.md")).unwrap();

    println!("========================================");
    println!("  YunPat Invalidation E2E Test (REAL LLM)");
    println!("  Case: CN 204762379 U");
    println!("========================================\n");

    // Initialise the invalidation agent.
    let mut agent = yunpat_agents::invalidation::InvalidationAgent::new();

    // Inject real LLM provider if available.
    let has_llm = if let Some(provider) = DeepSeekLlmProvider::from_env() {
        println!(
            "🤖 Using live DeepSeek LLM provider (model: {})\n",
            provider.model
        );
        agent.set_llm_provider(Box::new(provider));
        true
    } else {
        println!("⚠️  DEEPSEEK_API_KEY not set, falling back to template output\n");
        false
    };

    agent.initialize().await.unwrap();

    let input = yunpat_agents::AgentInput {
        intent: yunpat_agents::UserIntent {
            raw_input: format!(
                "对专利号 CN 204762379 U（人形瓜果蔬菜生长定型塑料模具）提出无效宣告请求\n\n{}",
                yunpat_md
            ),
            parsed_topic: Some("专利无效宣告".to_string()),
            parsed_scope: None,
            parsed_depth: None,
        },
        extra: serde_json::json!({
            "case_id": "CN204762379U",
            "case_dir": case_dir.to_str().unwrap(),
            "petition_file": "无效宣告请求书_CN204762379U.md",
            "target_patent_pdf": "目标专利：201520444447.8.PDF"
        }),
    };

    // Execute the agent and collect stage outputs.
    let mut stages = agent.execute(input);
    let mut step = 0;

    while let Some(output) = stages.next().await {
        step += 1;
        println!("\n--- Step {}: {} ---", step, output.stage_name);
        println!("{}", output.content);

        if !output.artifacts.is_empty() {
            println!("\n[Artifacts]");
            for artifact in &output.artifacts {
                println!("  - {} ({})", artifact.name, artifact.artifact_type);
                let suffix = if has_llm { "_real" } else { "" };
                let artifact_file = case_dir.join(format!(
                    "output_step{}_{}{}.md",
                    step, artifact.artifact_type, suffix
                ));
                std::fs::write(&artifact_file, &artifact.content).unwrap();
                println!("    → saved to {}", artifact_file.display());
            }
        }

        if output.requires_approval {
            if let Some(ref req) = output.approval_request {
                println!("\n[Approval Gate] {}", req.prompt);
                for opt in &req.options {
                    let default = if opt.is_default { " (default)" } else { "" };
                    println!("  [{}] {}{}", opt.value, opt.label, default);
                }
                let default = req
                    .options
                    .iter()
                    .find(|o| o.is_default)
                    .map(|o| o.value.clone())
                    .unwrap_or_else(|| "continue".to_string());
                println!("  → Auto-approved: {}", default);
            }
        }

        println!(
            "\n[Metadata] duration: {:?} ms",
            output.metadata.duration_ms
        );
    }

    agent.terminate().await.unwrap();

    // ── Validation ──
    println!("\n========================================");
    println!("  Validation");
    println!("========================================");

    let expected_steps = 5;
    assert_eq!(
        step, expected_steps,
        "Expected {} steps, got {}",
        expected_steps, step
    );
    println!("✅ All {} steps executed", expected_steps);

    for i in 1..=expected_steps {
        let entries = std::fs::read_dir(&case_dir)
            .unwrap()
            .filter_map(|e| e.ok())
            .filter(|e| {
                e.file_name()
                    .to_string_lossy()
                    .starts_with(&format!("output_step{}_", i))
            })
            .collect::<Vec<_>>();
        assert!(
            !entries.is_empty(),
            "Step {} should have produced at least one artifact file",
            i
        );
        println!("✅ Step {} artifact file(s) created", i);
    }

    assert!(
        petition_md.contains("专利法第22条第3款"),
        "Petition should cite A22.3"
    );
    assert!(
        petition_md.contains("创造性"),
        "Petition should mention inventiveness"
    );
    assert!(
        petition_md.contains("CN 201107937 Y"),
        "Petition should cite evidence 1"
    );
    println!("✅ Pre-existing petition contains expected legal grounds and evidence");

    if has_llm {
        println!("\n🎉 E2E Invalidation Test with REAL LLM PASSED");
    } else {
        println!("\n✅ E2E Invalidation Test PASSED (template mode)");
    }
    println!("========================================");
}
