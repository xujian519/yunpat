#![allow(dead_code, clippy::redundant_closure)]
//! MCP → ToolRegistry 适配器
//!
//! 此模块将 MCP 工具包装为 ToolSpec 实现，使其能够注册到类型化的 ToolRegistry 中。
//! 这样 MCP 工具可以享受与其他工具相同的 schema 验证、并行调度和审批门控功能。
//!
//! 架构说明：
//! - McpToolAdapter 包装单个 MCP 工具定义
//! - execute() 方法委托给 McpPool.call_tool()
//! - 工具名称使用 mcp_{server}_{tool} 格式以避免命名冲突

use std::sync::Arc;

use async_trait::async_trait;
use serde_json::Value;

use crate::mcp::McpTool;
use crate::tools::spec::{
    ApprovalRequirement, ToolCapability, ToolContext, ToolError, ToolResult, ToolSpec,
};

/// MCP 工具适配器，将 MCP 工具包装为 ToolSpec
pub struct McpToolAdapter {
    /// 完整的工具名称（格式：mcp_{server}_{tool}）
    name: String,
    /// MCP 工具定义
    tool: McpTool,
}

impl McpToolAdapter {
    /// 创建新的 MCP 工具适配器
    ///
    /// # 参数
    /// - `server_name`: MCP 服务器名称
    /// - `tool`: MCP 工具定义
    pub fn new(server_name: &str, tool: McpTool) -> Self {
        // 生成完整的工具名称：mcp_{server}_{tool}
        // 使用与 McpPool::all_tools() 相同的命名约定
        let name = format!("mcp_{}_{}", server_name, tool.name);

        Self { name, tool }
    }

    /// 获取原始 MCP 工具名称（不含服务器前缀）
    pub fn tool_name(&self) -> &str {
        &self.tool.name
    }

    /// 解析完整工具名称，返回 (server_name, tool_name)
    ///
    /// # 参数
    /// - `prefixed_name`: 完整工具名称（格式：mcp_{server}_{tool}）
    ///
    /// # 返回
    /// - Ok((server_name, tool_name)): 解析成功
    /// - Err: 无效的工具名称格式
    pub fn parse_prefixed_name(prefixed_name: &str) -> Result<(&str, &str), String> {
        if !prefixed_name.starts_with("mcp_") {
            return Err(format!(
                "Invalid MCP tool name '{}': must start with 'mcp_'",
                prefixed_name
            ));
        }

        let rest = &prefixed_name[4..];
        let Some((server, tool)) = rest.split_once('_') else {
            return Err(format!(
                "Invalid MCP tool name format '{}': expected 'mcp_{{server}}_{{tool}}'",
                prefixed_name
            ));
        };

        Ok((server, tool))
    }
}

#[async_trait]
impl ToolSpec for McpToolAdapter {
    fn name(&self) -> &str {
        &self.name
    }

    fn description(&self) -> &str {
        self.tool
            .description
            .as_deref()
            .unwrap_or(self.tool.name.as_str())
    }

    fn input_schema(&self) -> Value {
        self.tool.input_schema.clone()
    }

    fn capabilities(&self) -> Vec<ToolCapability> {
        // 保守策略：MCP 工具默认需要审批和网络访问
        // 除非是已知的只读发现工具
        let name_lower = self.name.to_lowercase();
        if name_lower.contains("list_mcp")
            || name_lower.contains("read_mcp")
            || name_lower.contains("mcp_read")
            || name_lower.contains("mcp_get_prompt")
            || name_lower.contains("mcp_list")
        {
            vec![ToolCapability::ReadOnly]
        } else {
            vec![ToolCapability::Network, ToolCapability::RequiresApproval]
        }
    }

    fn approval_requirement(&self) -> ApprovalRequirement {
        // MCP 工具由远端控制审批，本地默认 Auto
        // 实际审批由 capabilities() 中的 RequiresApproval 控制
        ApprovalRequirement::Auto
    }

    fn defer_loading(&self) -> bool {
        // 发现工具保持加载，其他工具延迟加载
        // 检查工具名称是否包含已知的发现工具关键字
        let name_lower = self.name.to_lowercase();
        let is_discovery_tool = name_lower.ends_with("list_mcp_resources")
            || name_lower.ends_with("list_mcp_resource_templates")
            || name_lower.ends_with("mcp_read_resource")
            || name_lower.ends_with("read_mcp_resource")
            || name_lower.ends_with("mcp_get_prompt");
        !is_discovery_tool
    }

    async fn execute(&self, input: Value, context: &ToolContext) -> Result<ToolResult, ToolError> {
        // 从 ToolContext 获取 MCP pool
        let pool = context
            .mcp_pool
            .as_ref()
            .ok_or_else(|| {
                ToolError::not_available(format!("MCP pool not available for tool '{}'", self.name))
            })?
            .clone();

        // 解析工具名称获取服务器和工具名
        let (_server_name, _tool_name) =
            Self::parse_prefixed_name(&self.name).map_err(|e| ToolError::execution_failed(e))?;

        // 通过 MCP pool 调用远程工具
        // 注意：这里需要使用可变引用，所以需要通过 runtime 获取
        let mut pool_guard = pool
            .try_lock()
            .map_err(|_| ToolError::execution_failed("MCP pool is locked by another operation"))?;

        let result = pool_guard
            .call_tool(&self.name, input)
            .await
            .map_err(|e| ToolError::execution_failed(format!("MCP tool call failed: {}", e)))?;

        // 格式化结果
        let content = format_mcp_result(&result);
        Ok(ToolResult::success(content))
    }
}

/// 格式化 MCP 工具结果为字符串
fn format_mcp_result(result: &Value) -> String {
    // MCP 工具返回的结果通常是 JSON 对象
    // 尝试提取 content 字段或直接序列化
    if let Some(content_array) = result.get("content").and_then(|v| v.as_array()) {
        // MCP 标准格式：content 是一个数组，每个元素有 type 和 text/image 等字段
        let texts: Vec<String> = content_array
            .iter()
            .filter_map(|item| {
                if let Some("text") = item.get("type").and_then(|v| v.as_str()) {
                    item.get("text").and_then(|v| v.as_str()).map(String::from)
                } else {
                    // 非文本内容，返回占位符
                    Some(format!(
                        "[{} content]",
                        item.get("type")
                            .and_then(|v| v.as_str())
                            .unwrap_or("unknown")
                    ))
                }
            })
            .collect();

        if !texts.is_empty() {
            texts.join("\n")
        } else {
            // 如果没有文本内容，返回完整的 JSON
            serde_json::to_string_pretty(result)
                .unwrap_or_else(|_| "Invalid MCP result".to_string())
        }
    } else {
        // 没有标准 content 字段，直接序列化
        serde_json::to_string_pretty(result).unwrap_or_else(|_| "Invalid MCP result".to_string())
    }
}

/// 从 MCP pool 创建所有工具的适配器
///
/// # 参数
/// - `pool`: MCP 连接池引用
///
/// # 返回
/// - Vec<Arc<McpToolAdapter>>: 所有 MCP 工具的适配器列表
///
/// # 注意
/// - 此函数需要可变的 McpPool 引用以访问工具列表
/// - 返回的适配器可以注册到 ToolRegistry
pub fn create_mcp_adapters_from_pool(pool: &crate::mcp::McpPool) -> Vec<Arc<McpToolAdapter>> {
    pool.all_tools()
        .into_iter()
        .map(|(prefixed_name, tool)| {
            // 从 prefixed_name 解析服务器名
            if let Ok((server_name, _tool_name)) =
                McpToolAdapter::parse_prefixed_name(&prefixed_name)
            {
                Arc::new(McpToolAdapter::new(server_name, tool.clone()))
            } else {
                // 如果解析失败，使用默认名称
                Arc::new(McpToolAdapter::new("unknown", tool.clone()))
            }
        })
        .collect()
}

/// 为 ToolRegistry 添加 MCP 工具注册的扩展 trait
///
/// 使用示例：
/// ```ignore
/// use crate::tools::mcp_tool_adapter::McpToolRegistryExt;
///
/// let builder = ToolRegistryBuilder::new()
///     .with_mcp_tools(&mcp_pool);
/// ```
pub trait McpToolRegistryExt {
    /// 注册 MCP pool 中的所有工具
    fn with_mcp_tools(self, pool: &crate::mcp::McpPool) -> Self;
}

impl McpToolRegistryExt for crate::tools::registry::ToolRegistryBuilder {
    fn with_mcp_tools(mut self, pool: &crate::mcp::McpPool) -> Self {
        let adapters = create_mcp_adapters_from_pool(pool);
        for adapter in adapters {
            self = self.with_tool(adapter as Arc<dyn ToolSpec>);
        }
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_parse_prefixed_name_valid() {
        let result = McpToolAdapter::parse_prefixed_name("mcp_servername_toolname");
        assert_eq!(result, Ok(("servername", "toolname")));
    }

    #[test]
    fn test_parse_prefixed_name_invalid_no_prefix() {
        let result = McpToolAdapter::parse_prefixed_name("servername_toolname");
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_prefixed_name_invalid_no_separator() {
        let result = McpToolAdapter::parse_prefixed_name("mcp_servername");
        assert!(result.is_err());
    }

    #[test]
    fn test_mcp_tool_adapter_creation() {
        let tool = McpTool {
            name: "test_tool".to_string(),
            description: Some("A test tool".to_string()),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "param1": { "type": "string" }
                }
            }),
        };

        let adapter = McpToolAdapter::new("test_server", tool);
        assert_eq!(adapter.name(), "mcp_test_server_test_tool");
        assert_eq!(adapter.description(), "A test tool");
        assert_eq!(adapter.tool_name(), "test_tool");
    }

    #[test]
    fn test_mcp_tool_adapter_description_fallback() {
        let tool = McpTool {
            name: "test_tool".to_string(),
            description: None,
            input_schema: json!({}),
        };

        let adapter = McpToolAdapter::new("test_server", tool);
        assert_eq!(adapter.description(), "test_tool");
    }

    #[test]
    fn test_format_mcp_result_text_content() {
        let result = json!({
            "content": [
                {"type": "text", "text": "Line 1"},
                {"type": "text", "text": "Line 2"}
            ]
        });

        let formatted = format_mcp_result(&result);
        assert!(formatted.contains("Line 1"));
        assert!(formatted.contains("Line 2"));
    }

    #[test]
    fn test_format_mcp_result_mixed_content() {
        let result = json!({
            "content": [
                {"type": "text", "text": "Text content"},
                {"type": "image", "data": "base64..."}
            ]
        });

        let formatted = format_mcp_result(&result);
        assert!(formatted.contains("Text content"));
        assert!(formatted.contains("[image content]"));
    }

    #[test]
    fn test_format_mcp_result_no_content() {
        let result = json!({
            "result": "direct result"
        });

        let formatted = format_mcp_result(&result);
        assert!(formatted.contains("direct result"));
    }

    #[test]
    fn test_capabilities_readonly_tools() {
        let tool = McpTool {
            name: "list_mcp_resources".to_string(),
            description: None,
            input_schema: json!({}),
        };

        let adapter = McpToolAdapter::new("test", tool);
        assert!(adapter.capabilities().contains(&ToolCapability::ReadOnly));
        assert!(!adapter.capabilities().contains(&ToolCapability::Network));
    }

    #[test]
    fn test_capabilities_generic_tool() {
        let tool = McpTool {
            name: "some_tool".to_string(),
            description: None,
            input_schema: json!({}),
        };

        let adapter = McpToolAdapter::new("test", tool);
        assert!(adapter.capabilities().contains(&ToolCapability::Network));
        assert!(
            adapter
                .capabilities()
                .contains(&ToolCapability::RequiresApproval)
        );
    }

    #[test]
    fn test_defer_loading_discovery_tools() {
        let tool = McpTool {
            name: "list_mcp_resources".to_string(),
            description: None,
            input_schema: json!({}),
        };

        let adapter = McpToolAdapter::new("test", tool);
        assert!(
            !adapter.defer_loading(),
            "Discovery tools should not defer loading"
        );
    }

    #[test]
    fn test_defer_loading_generic_tool() {
        let tool = McpTool {
            name: "generic_tool".to_string(),
            description: None,
            input_schema: json!({}),
        };

        let adapter = McpToolAdapter::new("test", tool);
        assert!(
            adapter.defer_loading(),
            "Generic tools should defer loading"
        );
    }
}
