/*!
 * 意图识别离线基准测试
 *
 * 运行方式:
 *   cargo run --example benchmark --release
 *
 * 功能:
 *   加载 packages/tests/benchmark/intent/golden-seed-v1.json
 *   使用 yunpat-router 的 IntentRecognizer 进行意图识别
 *   输出准确率、召回率、F1、混淆矩阵、延迟统计
 */

use serde::Deserialize;
use std::collections::HashMap;
use std::fs;
use std::time::Instant;
use yunpat_router::IntentRecognizer;

#[derive(Debug, Deserialize)]
struct TestSuite {
    version: String,
    tests: Vec<TestCase>,
}

#[derive(Debug, Deserialize)]
struct TestCase {
    id: String,
    text: String,
    #[serde(rename = "expected_intent")]
    expected_intent: String,
    #[serde(default)]
    tags: Vec<String>,
    #[serde(default)]
    note: Option<String>,
}

/// Maps schema intent names to router agent IDs for comparison.
fn intent_to_agent_id(intent: &str) -> &str {
    match intent {
        "draft_full" => "drafting",
        "draft_claims" => "drafting",
        "draft_spec" => "spec-drafter",
        "respond_oa" => "oa-response",
        "search" => "search",
        "analyze_portfolio" => "analysis",
        "evaluate_innovation" => "analysis",
        "analyze_infringement" => "analysis",
        "analyze_trademark" => "analysis",
        "coding" => "", // coding has no agent in router
        "chitchat" => "",
        "clarify" => "",
        "multi_intent" => "",
        "init_workspace" => "",
        _ => "",
    }
}

/// Maps router agent IDs back to intent names for reporting.
fn agent_id_to_intent(agent_id: &str) -> &str {
    match agent_id {
        "drafting" => "draft_full",
        "spec-drafter" => "draft_spec",
        "oa-response" => "respond_oa",
        "search" => "search",
        "prior-art-search" => "search",
        "analysis" => "analyze_portfolio",
        "invalidation" => "analyze_infringement",
        "research" => "research",
        "invention" => "evaluate_innovation",
        "subject-matter" => "evaluate_innovation",
        "unity-check" => "analyze_portfolio",
        "spec-formality" => "analyze_portfolio",
        "tech-unit" => "analyze_portfolio",
        _ => "UNKNOWN",
    }
}

#[derive(Debug)]
struct Metrics {
    total: usize,
    correct: usize,
    accuracy: f64,
    latency_avg_ms: f64,
    latency_p95_ms: f64,
    by_intent: HashMap<String, IntentMetrics>,
    #[allow(dead_code)]
    confusion: HashMap<String, HashMap<String, usize>>,
    failures: Vec<Failure>,
}

#[derive(Debug, Default)]
struct IntentMetrics {
    tp: usize,
    fp: usize,
    fn_count: usize,
    precision: f64,
    recall: f64,
    f1: f64,
}

#[derive(Debug)]
struct Failure {
    id: String,
    text: String,
    expected: String,
    actual: String,
    latency_us: u64,
    note: Option<String>,
}

fn main() {
    let recognizer = IntentRecognizer::new();

    let manifest_dir = std::env!("CARGO_MANIFEST_DIR");
    let suite_path = std::path::Path::new(manifest_dir)
        .join("../../../packages/tests/benchmark/intent/golden-seed-v1.json")
        .canonicalize()
        .expect("Failed to resolve test suite path");
    let suite: TestSuite =
        serde_json::from_str(&fs::read_to_string(&suite_path).expect("Failed to read test suite"))
            .expect("Failed to parse test suite");

    println!("\n========================================");
    println!("  YunPat 意图识别离线基准测试");
    println!("  Router: yunpat-router v2");
    println!("========================================\n");
    println!("测试集版本: {}", suite.version);
    println!("总样本数: {}\n", suite.tests.len());

    let mut results: Vec<(TestCase, Option<String>, u64)> = Vec::new();

    for test in &suite.tests {
        let start = Instant::now();
        let result = recognizer.recognize(&test.text);
        let elapsed = start.elapsed().as_micros() as u64;

        let actual_agent = result.map(|(id, _)| id);
        let actual_intent = actual_agent
            .as_ref()
            .map(|id| agent_id_to_intent(id).to_string())
            .unwrap_or_else(|| "clarify".to_string());

        let expected_agent = intent_to_agent_id(&test.expected_intent).to_string();

        // For scoring: compare at the agent routing level
        let matched = actual_agent == Some(expected_agent);

        results.push((
            TestCase {
                id: test.id.clone(),
                text: test.text.clone(),
                expected_intent: test.expected_intent.clone(),
                tags: test.tags.clone(),
                note: test.note.clone(),
            },
            Some(actual_intent),
            elapsed,
        ));

        let status = if matched { "✓" } else { "✗" };
        let actual_str = actual_agent.unwrap_or_else(|| "NONE".to_string());
        let display_text: String = test.text.chars().take(48).collect();
        println!(
            "  [{}] {} {:<50} -> {} ({}μs)",
            test.id, status, display_text, actual_str, elapsed
        );
    }

    let metrics = calculate_metrics(results);
    print_report(&metrics);
}

fn calculate_metrics(results: Vec<(TestCase, Option<String>, u64)>) -> Metrics {
    let mut by_intent: HashMap<String, IntentMetrics> = HashMap::new();
    let mut confusion: HashMap<String, HashMap<String, usize>> = HashMap::new();
    let mut failures = Vec::new();
    let mut latencies = Vec::new();

    let mut correct = 0;

    for (test, actual_opt, latency) in &results {
        let expected = test.expected_intent.clone();
        let actual = actual_opt.as_ref().map(|a| a.as_str()).unwrap_or("clarify");

        latencies.push(*latency);

        confusion
            .entry(expected.clone())
            .or_default()
            .entry(actual.to_string())
            .and_modify(|c| *c += 1)
            .or_insert(1);

        let expected_agent = intent_to_agent_id(&expected).to_string();
        let actual_agent_opt = actual_opt.as_ref().map(|a| intent_to_agent_id(a).to_string());

        // For system intents without a dedicated agent (coding, chitchat, etc.),
        // returning NONE/clarify is considered correct since the router is not
        // meant to handle them.
        let is_system_intent_without_agent = expected_agent.is_empty();
        let matched = if is_system_intent_without_agent {
            actual_agent_opt.is_none() || actual_agent_opt == Some("".to_string())
        } else {
            actual_agent_opt == Some(expected_agent)
        };

        if matched {
            correct += 1;
            by_intent.entry(expected.clone()).or_default().tp += 1;
        } else {
            by_intent.entry(expected.clone()).or_default().fn_count += 1;
            if actual != "clarify" && actual != "UNKNOWN" {
                by_intent.entry(actual.to_string()).or_default().fp += 1;
            }
            failures.push(Failure {
                id: test.id.clone(),
                text: test.text.clone(),
                expected,
                actual: actual.to_string(),
                latency_us: *latency,
                note: test.note.clone(),
            });
        }
    }

    // Calculate precision/recall/f1 per intent
    for metrics in by_intent.values_mut() {
        let tp = metrics.tp as f64;
        let fp = metrics.fp as f64;
        let fn_count = metrics.fn_count as f64;
        metrics.precision = if tp + fp > 0.0 { tp / (tp + fp) } else { 0.0 };
        metrics.recall = if tp + fn_count > 0.0 {
            tp / (tp + fn_count)
        } else {
            0.0
        };
        metrics.f1 = if metrics.precision + metrics.recall > 0.0 {
            2.0 * metrics.precision * metrics.recall / (metrics.precision + metrics.recall)
        } else {
            0.0
        };
    }

    latencies.sort_unstable();
    let avg = latencies.iter().sum::<u64>() as f64 / latencies.len().max(1) as f64;
    let p95_idx = ((latencies.len() as f64) * 0.95) as usize;
    let p95 = latencies.get(p95_idx).copied().unwrap_or(0) as f64;

    Metrics {
        total: results.len(),
        correct,
        accuracy: correct as f64 / results.len().max(1) as f64,
        latency_avg_ms: avg / 1000.0,
        latency_p95_ms: p95 / 1000.0,
        by_intent,
        confusion,
        failures,
    }
}

fn print_report(metrics: &Metrics) {
    println!("\n--- 汇总指标 ---");
    println!("  总样本: {}", metrics.total);
    println!(
        "  正确:   {} ({:.1}%)",
        metrics.correct,
        metrics.accuracy * 100.0
    );
    println!("  失败:   {}", metrics.failures.len());
    println!(
        "  平均延迟: {:.3}ms  P95: {:.3}ms",
        metrics.latency_avg_ms, metrics.latency_p95_ms
    );

    println!("\n--- 各意图指标 ---");
    let mut intents: Vec<_> = metrics.by_intent.iter().collect();
    intents.sort_by_key(|(k, _)| *k);
    for (intent, m) in intents {
        println!(
            "  {:<20} P={:.2}  R={:.2}  F1={:.3}  (TP={} FP={} FN={})",
            intent, m.precision, m.recall, m.f1, m.tp, m.fp, m.fn_count
        );
    }

    if !metrics.failures.is_empty() {
        println!("\n--- 失败案例 (前15条) ---");
        for f in metrics.failures.iter().take(15) {
            println!(
                "  [{}] 期望: {:<15} 实际: {:<15}  {:>6}μs",
                f.id, f.expected, f.actual, f.latency_us
            );
            println!("      文本: \"{}\"", f.text);
            if let Some(note) = &f.note {
                println!("      备注: {}", note);
            }
        }
    }

    println!("\n========================================\n");
}
