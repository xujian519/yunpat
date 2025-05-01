//! YunPat 工具服务 - Rust 实现的 ML 工具 gRPC 服务
//!
//! 替代 Python tools_server.py，提供文本嵌入、文本分类、数据分析能力
//! 文本嵌入使用本地 BGE-M3 (MLX 加速)

use std::collections::HashMap;
use std::time::{Duration, Instant};
use tonic::transport::Server;
use tonic::{Request, Response, Status};
use tracing::{error, info, warn};

pub mod tools {
    tonic::include_proto!("yunpat.tools");
}

use tools::python_tools_service_server::{PythonToolsService, PythonToolsServiceServer};
use tools::*;

mod analysis;
mod classification;
mod embedding;

/// 服务版本
const VERSION: &str = "2.0.0";
/// 嵌入文本最大长度
const MAX_TEXT_LENGTH: usize = 32_000;
/// 分析数据最大条数
const MAX_DATA_POINTS: usize = 1_000_000;
/// 单工具执行超时
const TOOL_TIMEOUT: Duration = Duration::from_secs(60);

/// 工具服务实现
#[derive(Debug)]
pub struct ToolsServiceImpl {
    embedding_client: embedding::EmbeddingClient,
}

impl ToolsServiceImpl {
    pub fn new() -> Self {
        Self {
            embedding_client: embedding::EmbeddingClient::from_env(),
        }
    }

    /// 执行单个工具（带超时和输入验证）
    async fn execute_tool(
        &self,
        tool_name: &str,
        args: &HashMap<String, String>,
    ) -> Result<HashMap<String, String>, String> {
        match tool_name {
            "embed_text" => {
                let text = args.get("text").ok_or("Missing 'text' parameter")?;
                if text.len() > MAX_TEXT_LENGTH {
                    return Err(format!(
                        "Text too long: {} > {} chars",
                        text.len(),
                        MAX_TEXT_LENGTH
                    ));
                }
                let embedding = self
                    .embedding_client
                    .embed(text)
                    .await
                    .map_err(|e| format!("Embedding failed: {}", e))?;
                let embedding_json = serde_json::to_string(&embedding)
                    .map_err(|e| format!("Serialization failed: {}", e))?;
                let mut result = HashMap::new();
                result.insert("embedding".to_string(), embedding_json);
                result.insert("dimension".to_string(), embedding.len().to_string());
                Ok(result)
            }
            "classify_text" => {
                let text = args.get("text").ok_or("Missing 'text' parameter")?;
                let (label, confidence, scores) = classification::classify_text(text);
                let mut result = HashMap::new();
                result.insert("label".to_string(), label);
                result.insert("confidence".to_string(), confidence.to_string());
                let scores_json = serde_json::to_string(&scores)
                    .map_err(|e| format!("Serialization failed: {}", e))?;
                result.insert("scores".to_string(), scores_json);
                Ok(result)
            }
            "analyze_data" => {
                let data_str = args.get("data").ok_or("Missing 'data' parameter")?;
                if data_str.len() > 10 * 1024 * 1024 {
                    return Err("Input data too large (max 10MB)".to_string());
                }
                let data: Vec<f64> = serde_json::from_str(data_str)
                    .map_err(|e| format!("Invalid data format: {}", e))?;
                if data.len() > MAX_DATA_POINTS {
                    return Err(format!(
                        "Data points ({}) exceed limit ({})",
                        data.len(),
                        MAX_DATA_POINTS
                    ));
                }
                let stats = analysis::analyze_data(&data).map_err(|e| e)?;
                let mut result = HashMap::new();
                result.insert("mean".to_string(), stats.mean.to_string());
                result.insert("std".to_string(), stats.std.to_string());
                result.insert("median".to_string(), stats.median.to_string());
                result.insert("min".to_string(), stats.min.to_string());
                result.insert("max".to_string(), stats.max.to_string());
                result.insert("count".to_string(), stats.count.to_string());
                result.insert("q1".to_string(), stats.q1.to_string());
                result.insert("q3".to_string(), stats.q3.to_string());
                Ok(result)
            }
            _ => Err(format!("Unknown tool: {}", tool_name)),
        }
    }
}

#[tonic::async_trait]
impl PythonToolsService for ToolsServiceImpl {
    async fn execute_tool(
        &self,
        request: Request<ExecuteToolRequest>,
    ) -> Result<Response<ExecuteToolResponse>, Status> {
        let req = request.into_inner();
        let tool_name = req.tool_name;
        let args: HashMap<String, String> = req.args;
        let timeout = if req.timeout_ms > 0 {
            Duration::from_millis(req.timeout_ms as u64)
        } else {
            TOOL_TIMEOUT
        };

        info!(tool = %tool_name, "Executing tool");
        let start = Instant::now();

        let result = tokio::time::timeout(timeout, self.execute_tool(&tool_name, &args)).await;

        match result {
            Ok(Ok(output)) => {
                let elapsed = start.elapsed().as_millis() as i64;
                info!(tool = %tool_name, elapsed_ms = elapsed, "Tool completed");
                Ok(Response::new(ExecuteToolResponse {
                    success: true,
                    result: output,
                    error_message: String::new(),
                    metrics: Some(ToolMetrics {
                        execution_time_ms: elapsed,
                        memory_usage_mb: 0,
                        cpu_usage_percent: 0,
                        details: HashMap::new(),
                    }),
                }))
            }
            Ok(Err(err)) => {
                let elapsed = start.elapsed().as_millis() as i64;
                warn!(tool = %tool_name, elapsed_ms = elapsed, error = %err, "Tool failed");
                Err(Status::internal(format!("Tool failed: {}", err)))
            }
            Err(_) => {
                let elapsed = start.elapsed().as_millis() as i64;
                warn!(tool = %tool_name, elapsed_ms = elapsed, "Tool timed out");
                Err(Status::deadline_exceeded(format!(
                    "Tool timed out after {}ms",
                    timeout.as_millis()
                )))
            }
        }
    }

    async fn execute_tools(
        &self,
        request: Request<ExecuteToolsRequest>,
    ) -> Result<Response<ExecuteToolsResponse>, Status> {
        let req = request.into_inner();
        let parallel = req.parallel;
        let start = Instant::now();

        if parallel {
            // 并行执行
            let futures: Vec<_> = req
                .requests
                .into_iter()
                .map(|tool_req| {
                    let args: HashMap<String, String> = tool_req.args;
                    let tool_name = tool_req.tool_name.clone();
                    let tool_start = Instant::now();
                    async move {
                        match tokio::time::timeout(
                            TOOL_TIMEOUT,
                            self.execute_tool(&tool_name, &args),
                        )
                        .await
                        {
                            Ok(Ok(result)) => ExecuteToolResponse {
                                success: true,
                                result,
                                error_message: String::new(),
                                metrics: Some(ToolMetrics {
                                    execution_time_ms: tool_start.elapsed().as_millis() as i64,
                                    memory_usage_mb: 0,
                                    cpu_usage_percent: 0,
                                    details: HashMap::new(),
                                }),
                            },
                            Ok(Err(err)) => ExecuteToolResponse {
                                success: false,
                                result: HashMap::new(),
                                error_message: err,
                                metrics: None,
                            },
                            Err(_) => ExecuteToolResponse {
                                success: false,
                                result: HashMap::new(),
                                error_message: "Timed out".to_string(),
                                metrics: None,
                            },
                        }
                    }
                })
                .collect();

            let responses = futures::future::join_all(futures).await;
            let total_ms = start.elapsed().as_millis() as i32;
            Ok(Response::new(ExecuteToolsResponse {
                responses,
                total_time_ms: total_ms,
            }))
        } else {
            // 顺序执行
            let mut responses = Vec::new();
            for tool_req in req.requests {
                let args: HashMap<String, String> = tool_req.args;
                let tool_start = Instant::now();

                let response = match tokio::time::timeout(
                    TOOL_TIMEOUT,
                    self.execute_tool(&tool_req.tool_name, &args),
                )
                .await
                {
                    Ok(Ok(result)) => ExecuteToolResponse {
                        success: true,
                        result,
                        error_message: String::new(),
                        metrics: Some(ToolMetrics {
                            execution_time_ms: tool_start.elapsed().as_millis() as i64,
                            memory_usage_mb: 0,
                            cpu_usage_percent: 0,
                            details: HashMap::new(),
                        }),
                    },
                    Ok(Err(err)) => ExecuteToolResponse {
                        success: false,
                        result: HashMap::new(),
                        error_message: err,
                        metrics: None,
                    },
                    Err(_) => ExecuteToolResponse {
                        success: false,
                        result: HashMap::new(),
                        error_message: "Timed out".to_string(),
                        metrics: None,
                    },
                };
                responses.push(response);
            }

            let total_ms = start.elapsed().as_millis() as i32;
            Ok(Response::new(ExecuteToolsResponse {
                responses,
                total_time_ms: total_ms,
            }))
        }
    }

    async fn list_tools(
        &self,
        _request: Request<ListToolsRequest>,
    ) -> Result<Response<ListToolsResponse>, Status> {
        let tools = vec![
            ToolInfo {
                name: "embed_text".to_string(),
                category: "ml".to_string(),
                description: "使用 BGE-M3 模型生成文本嵌入向量".to_string(),
                parameters: HashMap::new(),
                version: VERSION.to_string(),
                available: true,
            },
            ToolInfo {
                name: "classify_text".to_string(),
                category: "ml".to_string(),
                description: "基于关键词规则的文本分类".to_string(),
                parameters: HashMap::new(),
                version: VERSION.to_string(),
                available: true,
            },
            ToolInfo {
                name: "analyze_data".to_string(),
                category: "ml".to_string(),
                description: "数值数据的统计分析".to_string(),
                parameters: HashMap::new(),
                version: VERSION.to_string(),
                available: true,
            },
        ];
        Ok(Response::new(ListToolsResponse { tools }))
    }

    async fn get_tool_info(
        &self,
        request: Request<GetToolInfoRequest>,
    ) -> Result<Response<GetToolInfoResponse>, Status> {
        let tool_name = request.into_inner().tool_name;
        match tool_name.as_str() {
            "embed_text" | "classify_text" | "analyze_data" => {
                Ok(Response::new(GetToolInfoResponse {
                    tool_info: Some(ToolInfo {
                        name: tool_name,
                        category: "ml".to_string(),
                        description: String::new(),
                        parameters: HashMap::new(),
                        version: VERSION.to_string(),
                        available: true,
                    }),
                }))
            }
            _ => Err(Status::not_found(format!("Tool '{}' not found", tool_name))),
        }
    }

    async fn health_check(
        &self,
        _request: Request<HealthCheckRequest>,
    ) -> Result<Response<HealthCheckResponse>, Status> {
        Ok(Response::new(HealthCheckResponse {
            healthy: true,
            version: VERSION.to_string(),
            details: HashMap::from([
                ("status".to_string(), "ready".to_string()),
                ("backend".to_string(), "rust".to_string()),
                ("embedding_model".to_string(), "bge-m3-mlx-8bit".to_string()),
            ]),
        }))
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 初始化 tracing 日志
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    let port: u16 = std::env::var("PORT")
        .unwrap_or_else(|_| "50052".to_string())
        .parse()
        .map_err(|e: std::num::ParseIntError| format!("Invalid PORT: {}", e))?;

    let addr = format!("[::1]:{}", port);

    info!("╔════════════════════════════════════════╗");
    info!("║  YunPat Tools Service (Rust)           ║");
    info!("╚════════════════════════════════════════╝");
    info!("Rust backend, BGE-M3 embedding, starting on {}", addr);

    let service = ToolsServiceImpl::new();

    Server::builder()
        .add_service(PythonToolsServiceServer::new(service))
        .serve(addr.parse()?)
        .await?;

    Ok(())
}
