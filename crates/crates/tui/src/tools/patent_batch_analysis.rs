#![allow(dead_code)]
//! `patent_batch_analysis` tool — RLM 驱动的批量专利分析工具。
//!
//! 使用 RLM 引擎并行扇出多篇专利的分析任务，支持多种分析类型：
//! - comparison（对比分析）
//! - trend（趋势分析）
//! - quality（质量评估）
//! - infringement（侵权风险分析）

use std::sync::Arc;

use async_trait::async_trait;
use serde_json::{Value, json};

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
const DEFAULT_CONCURRENCY: usize = 4;

/// 批量专利分析工具
pub struct PatentBatchAnalysisTool {
    /// LLM 客户端，用于 RLM 驱动
    client: Option<Arc<dyn LlmClient>>,
    /// 根模型
    root_model: String,
}

impl PatentBatchAnalysisTool {
    #[must_use]
    pub fn new(client: Option<Arc<dyn LlmClient>>, root_model: String) -> Self {
        Self { client, root_model }
    }
}

#[async_trait]
impl ToolSpec for PatentBatchAnalysisTool {
    fn name(&self) -> &'static str {
        "patent_batch_analysis"
    }

    fn description(&self) -> &'static str {
        "批量专利分析工具 — 使用 RLM 引擎并行分析多篇专利。\
         支持对比分析、趋势分析、质量评估、侵权风险分析等多种分析类型。\
         \n\n\
         **用途**: \
         - 多篇专利技术对比分析\
         - 专利组合质量评估\
         - 技术趋势和演进路径分析\
         - 侵权风险批量筛查\
         - 竞争对手专利布局分析\
         \n\n\
         **参数**: \
         - `patents` (必需): 专利列表，每个包含 patent_id、title、abstract（JSON 数组）\
         - `analysis_type` (可选): 分析类型 — \"comparison\"（对比）、\"trend\"（趋势）、\"quality\"（质量）、\"infringement\"（侵权风险），默认 \"comparison\"\
         - `concurrency` (可选): 并发限制，默认 4\
         - `focus` (可选): 分析重点领域，例如 \"权利要求保护范围\"、\"技术方案创新点\"\
         \n\n\
         **返回**: \
         批量分析结果，包含每个专利的独立分析 + 综合对比结论。"
    }

    fn input_schema(&self) -> Value {
        json!({
            "type": "object",
            "required": ["patents"],
            "properties": {
                "patents": {
                    "type": "array",
                    "description": "待分析的专利列表，每个专利至少包含 patent_id、title、abstract",
                    "items": {
                        "type": "object",
                        "required": ["patent_id", "title", "abstract"],
                        "properties": {
                            "patent_id": {
                                "type": "string",
                                "description": "专利号或专利ID"
                            },
                            "title": {
                                "type": "string",
                                "description": "专利标题"
                            },
                            "abstract": {
                                "type": "string",
                                "description": "专利摘要"
                            },
                            "claims": {
                                "type": "string",
                                "description": "权利要求（可选）"
                            }
                        }
                    },
                    "minItems": 1,
                    "maxItems": 50
                },
                "analysis_type": {
                    "type": "string",
                    "description": "分析类型",
                    "enum": ["comparison", "trend", "quality", "infringement"],
                    "default": "comparison"
                },
                "concurrency": {
                    "type": "integer",
                    "description": "并发限制，控制同时分析的任务数量",
                    "default": DEFAULT_CONCURRENCY,
                    "minimum": 1,
                    "maximum": 16
                },
                "focus": {
                    "type": "string",
                    "description": "分析重点领域，例如 '权利要求保护范围'、'技术方案创新点'、'实施方式可行性'"
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
                "patent_batch_analysis requires an active DeepSeek client".to_string(),
            ));
        };

        // 解析专利列表
        let patents = input
            .get("patents")
            .and_then(|v| v.as_array())
            .ok_or_else(|| ToolError::MissingField {
                field: "patents".to_string(),
            })?;

        if patents.is_empty() {
            return Err(ToolError::invalid_input(
                "patent_batch_analysis: `patents` array is empty",
            ));
        }

        if patents.len() > 50 {
            return Err(ToolError::invalid_input(
                "patent_batch_analysis: too many patents, maximum 50",
            ));
        }

        // 验证每个专利的必需字段
        for (idx, patent) in patents.iter().enumerate() {
            if patent
                .get("patent_id")
                .and_then(|v| v.as_str())
                .map(|s| s.trim())
                .unwrap_or("")
                .is_empty()
            {
                return Err(ToolError::invalid_input(format!(
                    "patent_batch_analysis: patent at index {} missing `patent_id`",
                    idx
                )));
            }
            if patent
                .get("title")
                .and_then(|v| v.as_str())
                .map(|s| s.trim())
                .unwrap_or("")
                .is_empty()
            {
                return Err(ToolError::invalid_input(format!(
                    "patent_batch_analysis: patent at index {} missing `title`",
                    idx
                )));
            }
            if patent
                .get("abstract")
                .and_then(|v| v.as_str())
                .map(|s| s.trim())
                .unwrap_or("")
                .is_empty()
            {
                return Err(ToolError::invalid_input(format!(
                    "patent_batch_analysis: patent at index {} missing `abstract`",
                    idx
                )));
            }
        }

        // 解析分析类型
        let analysis_type = input
            .get("analysis_type")
            .and_then(|v| v.as_str())
            .unwrap_or("comparison");

        // 验证分析类型
        let valid_types = ["comparison", "trend", "quality", "infringement"];
        if !valid_types.contains(&analysis_type) {
            return Err(ToolError::invalid_input(format!(
                "patent_batch_analysis: invalid analysis_type '{}', must be one of {}",
                analysis_type,
                valid_types.join(", ")
            )));
        }

        // 解析并发限制
        let concurrency = input
            .get("concurrency")
            .and_then(|v| v.as_u64())
            .map(|n| n.min(16) as usize)
            .unwrap_or(DEFAULT_CONCURRENCY)
            .max(1);

        // 解析分析重点
        let focus = input.get("focus").and_then(|v| v.as_str()).unwrap_or("");

        // 构建分析任务描述
        let analysis_desc = match analysis_type {
            "comparison" => "对比分析：比较技术方案、权利要求保护范围、创新点差异",
            "trend" => "趋势分析：识别技术演进路径、发展方向、潜在改进空间",
            "quality" => "质量评估：评估权利要求质量、说明书完整性、保护范围合理性",
            "infringement" => "侵权风险分析：评估侵权风险、规避设计可能性、FTO 建议",
            _ => "综合分析",
        };

        let patents_json = serde_json::to_string_pretty(patents)
            .unwrap_or_else(|_| "[专利数据序列化失败]".to_string());

        let task = format!(
            "执行批量专利分析：\n\
             - 专利数量: {}\n\
             - 分析类型: {}\n\
             - 分析说明: {}\n\
             - 并发限制: {}\n\
             - 分析重点: {}\n\
             \n\
             **专利数据**:\n\
             ```json\n\
             {}\n\
             ```\n\
             \n\
             请使用以下 Python 代码进行批量分析：\n\
             ```python\n\
             import asyncio\n\
             from typing import List, Dict\n\
             \n\
             async def analyze_patent(patent: Dict, analysis_type: str, focus: str) -> Dict:\n\
                 '''单个专利分析'''\n\
                 # TODO: 实现真实的专利分析逻辑\n\
                 result = {{\n\
                     'patent_id': patent.get('patent_id'),\n\
                     'analysis_type': analysis_type,\n\
                     'key_findings': [],\n\
                     'risk_level': 'unknown'\n\
                 }}\n\
                 return result\n\
             \n\
             async def batch_analyze(patents: List[Dict], analysis_type: str, concurrency: int, focus: str):\n\
                 '''批量并行分析'''\n\
                 semaphore = asyncio.Semaphore(concurrency)\n\
                 \n\
                 async def bounded_analyze(patent):\n\
                     async with semaphore:\n\
                         return await analyze_patent(patent, analysis_type, focus)\n\
                 \n\
                 results = await asyncio.gather(*[bounded_analyze(p) for p in patents])\n\
                 \n\
                 # 生成综合分析结论\n\
                 summary = {{\n\
                     'individual_results': results,\n\
                     'overall_conclusion': f'分析了 {{len(results)}} 篇专利，综合风险等级需人工确认',\n\
                     'recommendations': []\n\
                 }}\n\
                 \n\
                 return summary\n\
             \n\
             patents = {patents_json}\n\
             analysis_type = {analysis_type:?}\n\
             concurrency = {concurrency}\n\
             focus = {focus:?}\n\
             \n\
             results = await batch_analyze(patents, analysis_type, concurrency, focus)\n\
             FINAL(results)\n\
             ```",
            patents.len(),
            analysis_type,
            analysis_desc,
            concurrency,
            if focus.is_empty() {
                "无特定重点"
            } else {
                focus
            },
            patents_json
        );

        // 创建事件通道用于 RLM 引擎
        let (tx, mut rx) = tokio::sync::mpsc::channel(64);
        let drain = spawn_supervised(
            "patent-analysis-progress-drain",
            std::panic::Location::caller(),
            async move { while rx.recv().await.is_some() {} },
        );

        // 使用 RLM 引擎执行分析
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
                    "patent_batch_analysis: {err} (iterations={}, termination={:?})",
                    result.iterations, result.termination
                ),
            });
        }

        if result.answer.trim().is_empty() {
            return Err(ToolError::ExecutionFailed {
                message: format!(
                    "patent_batch_analysis: empty answer (termination={:?}, iterations={})",
                    result.termination, result.iterations
                ),
            });
        }

        // 构建返回结果
        let content = format!(
            "# 批量专利分析结果\n\n\
             **分析类型**: {}\n\
             **专利数量**: {}\n\
             **并发数**: {}\n\
             **总迭代数**: {}\n\
             {}\n\
             \n\
             ---\n\n\
             {}",
            analysis_type,
            patents.len(),
            concurrency,
            result.iterations,
            if focus.is_empty() {
                String::new()
            } else {
                format!("\n**分析重点**: {}", focus)
            },
            result.answer
        );

        let metadata = json!({
            "analysis_type": analysis_type,
            "patent_count": patents.len(),
            "concurrency": concurrency,
            "focus": focus,
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

#[cfg(test)]
mod tests {
    use super::*;

    fn tool() -> PatentBatchAnalysisTool {
        PatentBatchAnalysisTool::new(None, "deepseek-v4-pro".to_string())
    }

    fn ctx() -> ToolContext {
        use std::path::PathBuf;
        ToolContext::new(PathBuf::from("."))
    }

    #[test]
    fn name_and_schema() {
        let t = tool();
        assert_eq!(t.name(), "patent_batch_analysis");
        let schema = t.input_schema();
        assert!(schema["properties"]["patents"].is_object());
        assert!(schema["properties"]["analysis_type"].is_object());
        assert!(schema["properties"]["concurrency"].is_object());
        assert!(schema["properties"]["focus"].is_object());
        let required = schema["required"].as_array().unwrap();
        assert!(required.iter().any(|v| v == "patents"));
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
        let res = t
            .execute(
                json!({"patents": [{"patent_id": "CN123", "title": "Test", "abstract": "Test abstract"}]}),
                &ctx
            )
            .await
            .expect_err("must error");
        assert!(matches!(res, ToolError::NotAvailable { .. }));
    }

    #[tokio::test]
    async fn rejects_missing_patents() {
        let t = tool();
        let ctx = ctx();
        let res = t.execute(json!({}), &ctx).await.expect_err("must error");
        assert!(matches!(
            res,
            ToolError::NotAvailable { .. } | ToolError::MissingField { .. }
        ));
    }

    #[tokio::test]
    async fn rejects_empty_patents_array() {
        let t = PatentBatchAnalysisTool::new(None, "x".into());
        let ctx = ctx();
        let res = t
            .execute(json!({"patents": []}), &ctx)
            .await
            .expect_err("must error");
        assert!(matches!(
            res,
            ToolError::NotAvailable { .. } | ToolError::InvalidInput { .. }
        ));
    }

    #[tokio::test]
    async fn rejects_too_many_patents() {
        let t = PatentBatchAnalysisTool::new(None, "x".into());
        let ctx = ctx();
        let many_patents: Vec<Value> = (0..51)
            .map(|i| json!({"patent_id": format!("P{}", i), "title": "Test", "abstract": "Test"}))
            .collect();
        let res = t
            .execute(json!({"patents": many_patents}), &ctx)
            .await
            .expect_err("must error");
        assert!(matches!(
            res,
            ToolError::NotAvailable { .. } | ToolError::InvalidInput { .. }
        ));
    }

    #[tokio::test]
    async fn rejects_invalid_analysis_type() {
        let t = PatentBatchAnalysisTool::new(None, "x".into());
        let ctx = ctx();
        let res = t
            .execute(
                json!({
                    "patents": [{"patent_id": "CN123", "title": "Test", "abstract": "Test"}],
                    "analysis_type": "invalid_type"
                }),
                &ctx,
            )
            .await
            .expect_err("must error");
        assert!(matches!(
            res,
            ToolError::NotAvailable { .. } | ToolError::InvalidInput { .. }
        ));
    }

    #[tokio::test]
    async fn rejects_missing_patent_fields() {
        let t = PatentBatchAnalysisTool::new(None, "x".into());
        let ctx = ctx();

        // Missing patent_id
        let res = t
            .execute(
                json!({"patents": [{"title": "Test", "abstract": "Test"}]}),
                &ctx,
            )
            .await
            .expect_err("must error");
        assert!(matches!(
            res,
            ToolError::NotAvailable { .. } | ToolError::InvalidInput { .. }
        ));

        // Missing title
        let res = t
            .execute(
                json!({"patents": [{"patent_id": "CN123", "abstract": "Test"}]}),
                &ctx,
            )
            .await
            .expect_err("must error");
        assert!(matches!(
            res,
            ToolError::NotAvailable { .. } | ToolError::InvalidInput { .. }
        ));

        // Missing abstract
        let res = t
            .execute(
                json!({"patents": [{"patent_id": "CN123", "title": "Test"}]}),
                &ctx,
            )
            .await
            .expect_err("must error");
        assert!(matches!(
            res,
            ToolError::NotAvailable { .. } | ToolError::InvalidInput { .. }
        ));
    }
}
