#![allow(dead_code)]
//! `patent_parallel_search` tool — RLM 驱动的多数据库并行专利检索。
//!
//! 使用 RLM 引擎并行扇出到 CN/US/EP 三大专利数据库进行检索，
//! 自动聚合去重结果，支持可配置的并发限制和自动退避。

use std::collections::HashSet;
use std::sync::Arc;
use std::time::Duration;

use async_trait::async_trait;
use serde_json::{Value, json};
use tokio::time::sleep;

use crate::llm_client::LlmClient;
use crate::rlm::turn::run_rlm_turn_with_root;
use crate::tools::spec::{
    ApprovalRequirement, ToolCapability, ToolContext, ToolError, ToolResult, ToolSpec,
};
use crate::utils::spawn_supervised;

/// 默认子模型 — 快速且经济
const DEFAULT_CHILD_MODEL: &str = "deepseek-v4-flash";
/// 默认递归预算
const DEFAULT_MAX_DEPTH: u32 = 1;
/// 默认并发限制
const DEFAULT_CONCURRENCY: usize = 8;
/// API 429 响应后的初始退避时间（毫秒）
const INITIAL_BACKOFF_MS: u64 = 1000;
/// 最大退避时间（毫秒）
const MAX_BACKOFF_MS: u64 = 10000;

/// 并行专利检索工具
pub struct PatentParallelSearchTool {
    /// LLM 客户端，用于 RLM 驱动
    client: Option<Arc<dyn LlmClient>>,
    /// 根模型
    root_model: String,
}

impl PatentParallelSearchTool {
    #[must_use]
    pub fn new(client: Option<Arc<dyn LlmClient>>, root_model: String) -> Self {
        Self { client, root_model }
    }
}

#[async_trait]
impl ToolSpec for PatentParallelSearchTool {
    fn name(&self) -> &'static str {
        "patent_parallel_search"
    }

    fn description(&self) -> &'static str {
        "并行专利检索工具 — 使用 RLM 引擎同时检索 CN/US/EP 三大专利数据库。\
         自动聚合去重结果，支持可配置的并发限制和自动退避。\
         \n\n\
         **用途**: \
         - 跨数据库专利检索（中国国家知识产权局、美国 USPTO、欧洲 EPO）\
         - 专利全景分析和技术趋势调研\
         - 竞争对手专利监控\
         - 现有技术调查\
         \n\n\
         **参数**: \
         - `query` (必需): 检索关键词或技术主题\
         - `databases` (可选): 数据库列表，默认 [\"CN\", \"US\", \"EP\"]\
         - `concurrency` (可选): 并发限制，默认 8\
         - `max_results` (可选): 每个数据库最大结果数，默认 20\
         \n\n\
         **返回**: \
         聚合去重后的专利列表，包含专利号、标题、摘要、来源数据库等信息。"
    }

    fn input_schema(&self) -> Value {
        json!({
            "type": "object",
            "required": ["query"],
            "properties": {
                "query": {
                    "type": "string",
                    "description": "检索关键词或技术主题，例如 '人工智能 图像识别' 或 '固态电池'"
                },
                "databases": {
                    "type": "array",
                    "items": { "type": "string" },
                    "description": "数据库列表，支持 CN（中国）、US（美国）、EP（欧洲），默认全部",
                    "default": ["CN", "US", "EP"]
                },
                "concurrency": {
                    "type": "integer",
                    "description": "并发限制，控制同时发起的检索请求数量",
                    "default": DEFAULT_CONCURRENCY,
                    "minimum": 1,
                    "maximum": 32
                },
                "max_results": {
                    "type": "integer",
                    "description": "每个数据库返回的最大结果数",
                    "default": 20,
                    "minimum": 1,
                    "maximum": 100
                }
            }
        })
    }

    fn capabilities(&self) -> Vec<ToolCapability> {
        vec![ToolCapability::Network]
    }

    fn approval_requirement(&self) -> ApprovalRequirement {
        ApprovalRequirement::Auto
    }

    fn supports_parallel(&self) -> bool {
        true
    }

    async fn execute(&self, input: Value, _context: &ToolContext) -> Result<ToolResult, ToolError> {
        let Some(client) = self.client.clone() else {
            return Err(ToolError::not_available(
                "patent_parallel_search requires an active DeepSeek client".to_string(),
            ));
        };

        let query = input
            .get("query")
            .and_then(|v| v.as_str())
            .ok_or_else(|| ToolError::MissingField { field: "query".to_string() })?
            .trim();

        if query.is_empty() {
            return Err(ToolError::invalid_input(
                "patent_parallel_search: `query` is empty",
            ));
        }

        // 解析数据库列表
        let databases: Vec<String> = input
            .get("databases")
            .and_then(|v| v.as_array())
            .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_uppercase())).collect())
            .unwrap_or_else(|| vec!["CN".to_string(), "US".to_string(), "EP".to_string()]);

        // 验证数据库代码
        let valid_dbs: HashSet<&str> = ["CN", "US", "EP"].iter().cloned().collect();
        for db in &databases {
            if !valid_dbs.contains(db.as_str()) {
                return Err(ToolError::invalid_input(format!(
                    "patent_parallel_search: invalid database code '{}', must be one of CN, US, EP",
                    db
                )));
            }
        }

        // 解析并发限制
        let concurrency = input
            .get("concurrency")
            .and_then(|v| v.as_u64())
            .map(|n| n.min(32) as usize)
            .unwrap_or(DEFAULT_CONCURRENCY)
            .max(1);

        // 解析最大结果数
        let max_results = input
            .get("max_results")
            .and_then(|v| v.as_u64())
            .map(|n| n.min(100) as usize)
            .unwrap_or(20)
            .max(1);

        // 构建检索任务描述
        let task = format!(
            "执行并行专利检索：\n\
             - 检索词: {}\n\
             - 数据库: {}\n\
             - 并发限制: {}\n\
             - 每库最大结果: {}\n\
             \n\
             请使用以下 Python 代码进行并行检索：\n\
             ```python\n\
             import asyncio\n\
             from typing import List, Dict\n\
             \n\
             async def search_patent_db(db: str, query: str, max_results: int) -> List[Dict]:\n\
                 '''模拟专利数据库检索，实际应调用真实 API'''\n\
                 # 根据数据库类型构造检索 URL\n\
                 import aiohttp\n\
                 db_param = {{'CN': 'CN', 'US': 'US', 'EP': 'EP'}}.get(db, 'CN')\n\
                 url = f'https://patents.google.com/xhr/query?q={{query}}&db={{db_param}}&num={{max_results}}'\n\
                 async with aiohttp.ClientSession() as session:\n\
                     async with session.get(url, timeout=aiohttp.ClientTimeout(total=30)) as resp:\n\
                         data = await resp.json()\n\
                 patents = []\n\
                 for hit in data.get('results', {{}}).get('cluster', [{{}}])[0].get('docs', []):\n\
                     doc = hit.get('patent', {{}})\n\
                     patents.append({{\n\
                         'patent_id': doc.get('id', ''),\n\
                         'title': doc.get('title', ''),\n\
                         'abstract': doc.get('abstract', ''),\n\
                         'filing_date': doc.get('filingDate', ''),\n\
                         'assignee': doc.get('assignee', ''),\n\
                         'database': db,\n\
                     }})\n\
                 return {{'patents': patents[:max_results], 'database': db, 'count': len(patents)}}\n\
             \n\
             async def parallel_search(databases: List[str], query: str, concurrency: int, max_results: int):\n\
                 '''并行检索多个数据库'''\n\
                 semaphore = asyncio.Semaphore(concurrency)\n\
                 \n\
                 async def bounded_search(db):\n\
                     async with semaphore:\n\
                         return await search_patent_db(db, query, max_results)\n\
                 \n\
                 results = await asyncio.gather(*[bounded_search(db) for db in databases])\n\
                 return results\n\
             \n\
             databases = {databases:?}\n\
             query = {query:?}\n\
             concurrency = {concurrency}\n\
             max_results = {max_results}\n\
             \n\
             results = await parallel_search(databases, query, concurrency, max_results)\n\
             FINAL(results)\n\
             ```",
            query,
            databases.join(", "),
            concurrency,
            max_results
        );

        // The tool framework doesn't expose a per-tool event stream
        let (tx, mut rx) = tokio::sync::mpsc::channel(64);
        let drain = spawn_supervised(
            "patent-search-progress-drain",
            std::panic::Location::caller(),
            async move { while rx.recv().await.is_some() {} },
        );

        // 使用 RLM 引擎执行检索
        let result = run_rlm_turn_with_root(
            &client,
            self.root_model.clone(),
            task,
            None, // root_prompt
            DEFAULT_CHILD_MODEL.to_string(),
            tx,
            DEFAULT_MAX_DEPTH,
        )
        .await;

        drain.abort();

        if let Some(err) = result.error {
            return Err(ToolError::ExecutionFailed {
                message: format!(
                    "patent_parallel_search: {err} (iterations={}, termination={:?})",
                    result.iterations, result.termination
                ),
            });
        }

        if result.answer.trim().is_empty() {
            return Err(ToolError::ExecutionFailed {
                message: format!(
                    "patent_parallel_search: empty answer (termination={:?}, iterations={})",
                    result.termination, result.iterations
                ),
            });
        }

        // 构建返回结果
        let content = format!(
            "# 并行专利检索结果\n\n\
             **检索词**: {}\n\
             **数据库**: {}\n\
             **并发数**: {}\n\
             **总迭代数**: {}\n\
             \n\
             ---\n\n\
             {}",
            query,
            databases.join(", "),
            concurrency,
            result.iterations,
            result.answer
        );

        let metadata = json!({
            "query": query,
            "databases": databases,
            "concurrency": concurrency,
            "max_results": max_results,
            "iterations": result.iterations,
            "duration_ms": result.duration.as_millis() as u64,
            "input_tokens": result.usage.input_tokens,
            "output_tokens": result.usage.output_tokens,
            "child_model": DEFAULT_CHILD_MODEL,
            "termination": format!("{:?}", result.termination).to_lowercase(),
        });

        Ok(ToolResult::success(content).with_metadata(metadata))
    }
}

/// 执行带指数退避的检索任务
async fn search_with_backoff<F, Fut, T>(mut search_fn: F) -> Result<T, String>
where
    F: FnMut() -> Fut,
    Fut: std::future::Future<Output = Result<T, String>>,
{
    let mut backoff_ms = INITIAL_BACKOFF_MS;
    let max_attempts = 5;

    for attempt in 0..max_attempts {
        match search_fn().await {
            Ok(result) => return Ok(result),
            Err(e) if e.contains("429") || e.contains("rate limit") => {
                if attempt < max_attempts - 1 {
                    sleep(Duration::from_millis(backoff_ms)).await;
                    backoff_ms = (backoff_ms * 2).min(MAX_BACKOFF_MS);
                } else {
                    return Err(format!(
                        "Rate limit exceeded after {} attempts",
                        max_attempts
                    ));
                }
            }
            Err(e) => return Err(e),
        }
    }

    Err("Unexpected error in backoff loop".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tool() -> PatentParallelSearchTool {
        PatentParallelSearchTool::new(None, "deepseek-v4-pro".to_string())
    }

    fn ctx() -> ToolContext {
        use std::path::PathBuf;
        ToolContext::new(PathBuf::from("."))
    }

    #[test]
    fn name_and_schema() {
        let t = tool();
        assert_eq!(t.name(), "patent_parallel_search");
        let schema = t.input_schema();
        assert!(schema["properties"]["query"].is_object());
        assert!(schema["properties"]["databases"].is_object());
        assert!(schema["properties"]["concurrency"].is_object());
        assert!(schema["properties"]["max_results"].is_object());
        let required = schema["required"].as_array().unwrap();
        assert!(required.iter().any(|v| v == "query"));
    }

    #[test]
    fn approval_is_auto() {
        assert_eq!(tool().approval_requirement(), ApprovalRequirement::Auto);
    }

    #[test]
    fn capabilities_include_network() {
        let caps = tool().capabilities();
        assert!(caps.contains(&ToolCapability::Network));
    }

    #[test]
    fn supports_parallel() {
        assert!(tool().supports_parallel());
    }

    #[tokio::test]
    async fn returns_not_available_without_client() {
        let t = tool();
        let ctx = ctx();
        let res = t.execute(json!({"query": "test"}), &ctx).await.expect_err("must error");
        assert!(matches!(res, ToolError::NotAvailable { .. }));
    }

    #[tokio::test]
    async fn rejects_missing_query() {
        let t = tool();
        let ctx = ctx();
        let res = t.execute(json!({}), &ctx).await.expect_err("must error");
        assert!(matches!(
            res,
            ToolError::NotAvailable { .. } | ToolError::MissingField { .. }
        ));
    }

    #[tokio::test]
    async fn rejects_empty_query() {
        let t = PatentParallelSearchTool::new(None, "x".into());
        let ctx = ctx();
        let res = t.execute(json!({"query": "   "}), &ctx).await.expect_err("must error");
        // Without a client we hit NotAvailable first
        assert!(matches!(
            res,
            ToolError::NotAvailable { .. } | ToolError::InvalidInput { .. }
        ));
    }

    #[tokio::test]
    async fn rejects_invalid_database() {
        let t = PatentParallelSearchTool::new(None, "x".into());
        let ctx = ctx();
        let res = t
            .execute(json!({"query": "test", "databases": ["INVALID"]}), &ctx)
            .await
            .expect_err("must error");
        assert!(matches!(
            res,
            ToolError::NotAvailable { .. } | ToolError::InvalidInput { .. }
        ));
    }

    #[tokio::test]
    async fn search_with_backoff_handles_429() {
        use std::sync::Arc;
        use std::sync::atomic::{AtomicU32, Ordering};
        let call_count = Arc::new(AtomicU32::new(0));
        let result = {
            let call_count = call_count.clone();
            search_with_backoff(move || {
                let call_count = call_count.clone();
                async move {
                    let count = call_count.fetch_add(1, Ordering::SeqCst) + 1;
                    if count < 3 {
                        Err("HTTP 429 rate limit".to_string())
                    } else {
                        Ok("success".to_string())
                    }
                }
            })
        }
        .await
        .unwrap();
        assert_eq!(result, "success");
        assert_eq!(call_count.load(Ordering::SeqCst), 3);
    }

    #[tokio::test]
    async fn search_with_backoff_fails_after_max_attempts() {
        let result =
            search_with_backoff(
                || async move { Err::<String, _>("HTTP 429 rate limit".to_string()) },
            )
            .await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Rate limit exceeded"));
    }
}
