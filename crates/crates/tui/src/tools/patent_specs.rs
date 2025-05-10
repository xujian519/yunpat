#![allow(dead_code)]
//! Patent Tool Specifications — MCP 工具的强类型 Rust Spec 定义
//!
//! 本模块为 7 个 MCP 专利工具定义强类型 Rust Spec（ToolSpec trait 的零大小类型实现）。
//! 这些 Spec 提供工具元数据（name、description、input_schema），实际执行通过 MCP 适配器。
//!
//! ## 工具列表
//! - `PatentSearchSpec` — 专利检索
//! - `PatentAnalyzeSpec` — 专利分析
//! - `PatentWriteSpec` — 专利撰写
//! - `PatentClaimGenSpec` — 权利要求生成
//! - `PatentCompareSpec` — 专利对比
//! - `PatentRespondSpec` — 审查意见答复
//! - `PatentQualitySpec` — 质量评估
//!
//! ## 架构说明
//! - 每个 Spec 是零大小类型（ZST），仅提供元数据
//! - `execute()` 返回 `Err(ToolError::NotAvailable)`，实际执行由 MCP 适配器处理
//! - `input_schema()` 返回与 MCP server 对应的 JSON Schema

use async_trait::async_trait;
use serde_json::json;

use crate::tools::spec::{
    ApprovalRequirement, ToolCapability, ToolContext, ToolError, ToolResult, ToolSpec,
};

// =============================================================================
// 1. PatentSearchSpec — 专利检索工具
// =============================================================================

/// 专利检索工具 Spec
///
/// 对应 MCP 工具: `patent_search`
/// Schema 来源: `@yunpat/agent-search/src/schema.ts`
pub struct PatentSearchSpec;

#[async_trait]
impl ToolSpec for PatentSearchSpec {
    fn name(&self) -> &str {
        "mcp_yunpat_patent_search"
    }

    fn description(&self) -> &str {
        "专利检索工具 v3.0 - 集成真实的 PatentSearchAgent 智能体。\
         根据发明名称、技术领域、技术问题、技术方案和关键特征进行专利检索，\
         返回相关专利列表、检索策略、新颖性评估和时间分布分析。"
    }

    fn input_schema(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {
                "inventionTitle": {
                    "type": "string",
                    "description": "发明名称"
                },
                "technicalField": {
                    "type": "string",
                    "description": "技术领域"
                },
                "technicalProblem": {
                    "type": "string",
                    "description": "技术问题"
                },
                "technicalSolution": {
                    "type": "string",
                    "description": "技术方案"
                },
                "keyFeatures": {
                    "type": "array",
                    "items": { "type": "string" },
                    "description": "关键特征列表"
                },
                "searchOptions": {
                    "type": "object",
                    "properties": {
                        "keywords": {
                            "type": "array",
                            "items": { "type": "string" },
                            "description": "额外关键词"
                        },
                        "limit": {
                            "type": "number",
                            "minimum": 1,
                            "maximum": 100,
                            "default": 20,
                            "description": "返回结果数量限制"
                        }
                    }
                }
            },
            "required": ["inventionTitle", "technicalField", "technicalProblem", "technicalSolution", "keyFeatures"]
        })
    }

    fn capabilities(&self) -> Vec<ToolCapability> {
        vec![ToolCapability::Network, ToolCapability::ReadOnly]
    }

    fn approval_requirement(&self) -> ApprovalRequirement {
        ApprovalRequirement::Auto
    }

    async fn execute(
        &self,
        _input: serde_json::Value,
        _context: &ToolContext,
    ) -> Result<ToolResult, ToolError> {
        // 实际执行由 MCP 适配器处理
        Err(ToolError::NotAvailable {
            message: "Patent search must be executed through MCP adapter".to_string(),
        })
    }
}

// =============================================================================
// 2. PatentAnalyzeSpec — 专利分析工具
// =============================================================================

/// 专利分析工具 Spec
///
/// 对应 MCP 工具: `patent_analyzer`
/// 对专利申请文件进行综合分析（完整性、权利要求结构、保护范围、风险评估）
pub struct PatentAnalyzeSpec;

#[async_trait]
impl ToolSpec for PatentAnalyzeSpec {
    fn name(&self) -> &str {
        "mcp_yunpat_patent_analyzer"
    }

    fn description(&self) -> &str {
        "专利分析工具 — 对专利申请文件进行综合分析，包括完整性分析、权利要求结构分析、\
         保护范围分析和风险评估。"
    }

    fn input_schema(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {
                "inventionTitle": {
                    "type": "string",
                    "description": "发明名称"
                },
                "claims": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "type": { "type": "string", "enum": ["independent", "dependent"] },
                            "number": { "type": "number" },
                            "content": { "type": "string" },
                            "dependsOn": { "type": "number" }
                        },
                        "required": ["type", "number", "content"]
                    },
                    "description": "权利要求列表"
                },
                "specification": {
                    "type": "object",
                    "properties": {
                        "technicalField": { "type": "string" },
                        "backgroundArt": { "type": "string" },
                        "inventionContent": { "type": "string" },
                        "embodiment": { "type": "string" }
                    },
                    "description": "说明书内容"
                }
            },
            "required": ["inventionTitle", "claims", "specification"]
        })
    }

    fn capabilities(&self) -> Vec<ToolCapability> {
        vec![ToolCapability::ReadOnly]
    }

    fn approval_requirement(&self) -> ApprovalRequirement {
        ApprovalRequirement::Auto
    }

    async fn execute(
        &self,
        _input: serde_json::Value,
        _context: &ToolContext,
    ) -> Result<ToolResult, ToolError> {
        Err(ToolError::NotAvailable {
            message: "Patent analysis must be executed through MCP adapter".to_string(),
        })
    }
}

// =============================================================================
// 3. PatentWriteSpec — 专利撰写工具
// =============================================================================

/// 专利撰写工具 Spec
///
/// 对应 MCP 工具: `patent_writer`
/// 后端 Agent: `SpecificationDrafterAgent`（`@yunpat/agent-specification-drafter`）
pub struct PatentWriteSpec;

#[async_trait]
impl ToolSpec for PatentWriteSpec {
    fn name(&self) -> &str {
        "mcp_yunpat_patent_writer"
    }

    fn description(&self) -> &str {
        "专利撰写工具 — 根据技术交底书生成完整的专利说明书（技术领域、背景技术、\
          发明内容、具体实施方式、附图说明）。集成 SpecificationDrafterAgent 智能体。"
    }

    fn input_schema(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {
                "technicalDisclosure": {
                    "type": "string",
                    "description": "技术交底书内容"
                },
                "patentType": {
                    "type": "string",
                    "enum": ["invention", "utilityModel", "design"],
                    "default": "invention",
                    "description": "专利类型"
                }
            },
            "required": ["technicalDisclosure"]
        })
    }

    fn capabilities(&self) -> Vec<ToolCapability> {
        vec![ToolCapability::WritesFiles]
    }

    fn approval_requirement(&self) -> ApprovalRequirement {
        ApprovalRequirement::Suggest
    }

    async fn execute(
        &self,
        _input: serde_json::Value,
        _context: &ToolContext,
    ) -> Result<ToolResult, ToolError> {
        Err(ToolError::NotAvailable {
            message: "Patent writer must be executed through MCP adapter".to_string(),
        })
    }
}

// =============================================================================
// 4. PatentClaimGenSpec — 权利要求生成工具
// =============================================================================

/// 权利要求生成工具 Spec
///
/// 对应 MCP 工具: `claims_generator`
/// Schema 来源: `@yunpat/agent-claim-generator/src/schema.ts`
pub struct PatentClaimGenSpec;

#[async_trait]
impl ToolSpec for PatentClaimGenSpec {
    fn name(&self) -> &str {
        "mcp_yunpat_claims_generator"
    }

    fn description(&self) -> &str {
        "权利要求生成工具 v3.0 - 集成真实的 ClaimGeneratorAgent 智能体。\
         根据发明信息生成独立权利要求和从属权利要求，包含保护范围分析和质量检查。"
    }

    fn input_schema(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {
                "inventionTitle": {
                    "type": "string",
                    "description": "发明名称"
                },
                "technicalField": {
                    "type": "string",
                    "description": "技术领域"
                },
                "technicalProblem": {
                    "type": "string",
                    "description": "技术问题"
                },
                "technicalSolution": {
                    "type": "string",
                    "description": "技术方案"
                },
                "beneficialEffects": {
                    "type": "string",
                    "description": "有益效果"
                },
                "keyFeatures": {
                    "type": "array",
                    "items": { "type": "string" },
                    "description": "关键特征列表"
                },
                "patentType": {
                    "type": "string",
                    "enum": ["invention", "utilityModel", "design"],
                    "default": "invention",
                    "description": "专利类型"
                },
                "enableDependentClaims": {
                    "type": "boolean",
                    "default": true,
                    "description": "是否生成从属权利要求"
                },
                "dependentClaimCount": {
                    "type": "number",
                    "minimum": 0,
                    "maximum": 20,
                    "default": 5,
                    "description": "从属权利要求数量"
                }
            },
            "required": ["inventionTitle", "technicalField", "technicalProblem", "technicalSolution", "beneficialEffects", "keyFeatures"]
        })
    }

    fn capabilities(&self) -> Vec<ToolCapability> {
        vec![ToolCapability::ReadOnly]
    }

    fn approval_requirement(&self) -> ApprovalRequirement {
        ApprovalRequirement::Auto
    }

    async fn execute(
        &self,
        _input: serde_json::Value,
        _context: &ToolContext,
    ) -> Result<ToolResult, ToolError> {
        Err(ToolError::NotAvailable {
            message: "Claims generation must be executed through MCP adapter".to_string(),
        })
    }
}

// =============================================================================
// 5. PatentCompareSpec — 专利对比工具
// =============================================================================

/// 专利对比工具 Spec
///
/// 对应 MCP 工具: `patent_compare`
/// 后端 Agent: `ComparisonReportGeneratorAgent`（`@yunpat/agent-comparison-report-generator`）
pub struct PatentCompareSpec;

#[async_trait]
impl ToolSpec for PatentCompareSpec {
    fn name(&self) -> &str {
        "mcp_yunpat_patent_compare"
    }

    fn description(&self) -> &str {
        "专利对比工具 — 对比两个专利的技术方案、权利要求范围，分析差异和相似性，\
          生成对比报告。集成 ComparisonReportGeneratorAgent 智能体。"
    }

    fn input_schema(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {
                "application": {
                    "type": "object",
                    "description": "本申请专利信息",
                    "properties": {
                        "inventionTitle": { "type": "string", "description": "发明名称" },
                        "claims": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "type": { "type": "string", "enum": ["independent", "dependent"] },
                                    "number": { "type": "number" },
                                    "content": { "type": "string" },
                                    "dependsOn": { "type": "number" }
                                },
                                "required": ["type", "number", "content"]
                            },
                            "description": "权利要求列表"
                        },
                        "specification": {
                            "type": "object",
                            "properties": {
                                "technicalField": { "type": "string" },
                                "backgroundArt": { "type": "string" },
                                "inventionContent": { "type": "string" },
                                "embodiment": { "type": "string" }
                            },
                            "description": "说明书内容"
                        }
                    },
                    "required": ["inventionTitle", "claims"]
                },
                "priorArt": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "patentId": { "type": "string", "description": "专利ID/公开号" },
                            "title": { "type": "string", "description": "标题" },
                            "abstract": { "type": "string", "description": "摘要" },
                            "claims": { "type": "array", "items": { "type": "string" }, "description": "权利要求" },
                            "description": { "type": "string", "description": "说明书" }
                        },
                        "required": ["patentId", "title", "abstract"]
                    },
                    "description": "现有技术专利列表"
                },
                "options": {
                    "type": "object",
                    "properties": {
                        "format": { "type": "string", "enum": ["markdown", "html"] },
                        "includeTables": { "type": "boolean" },
                        "language": { "type": "string", "enum": ["zh-CN", "en-US"] }
                    },
                    "description": "报告选项"
                }
            },
            "required": ["application", "priorArt"]
        })
    }

    fn capabilities(&self) -> Vec<ToolCapability> {
        vec![ToolCapability::ReadOnly]
    }

    fn approval_requirement(&self) -> ApprovalRequirement {
        ApprovalRequirement::Auto
    }

    async fn execute(
        &self,
        _input: serde_json::Value,
        _context: &ToolContext,
    ) -> Result<ToolResult, ToolError> {
        Err(ToolError::NotAvailable {
            message: "Patent comparison must be executed through MCP adapter".to_string(),
        })
    }
}

// =============================================================================
// 6. PatentRespondSpec — 审查意见答复工具
// =============================================================================

/// 审查意见答复工具 Spec
///
/// 对应 MCP 工具: `patent_responder`
/// 分析审查意见并生成答复文档
pub struct PatentRespondSpec;

#[async_trait]
impl ToolSpec for PatentRespondSpec {
    fn name(&self) -> &str {
        "mcp_yunpat_patent_responder"
    }

    fn description(&self) -> &str {
        "审查意见答复工具 — 分析审查意见通知书，识别关键问题，生成答复策略和意见陈述书。"
    }

    fn input_schema(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {
                "officeAction": {
                    "type": "object",
                    "properties": {
                        "applicationNumber": { "type": "string" },
                        "patentTitle": { "type": "string" },
                        "officeActionContent": { "type": "string" },
                        "citedReferences": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "publicationNumber": { "type": "string" },
                                    "title": { "type": "string" },
                                    "relevance": { "type": "string" }
                                }
                            }
                        }
                    },
                    "required": ["applicationNumber", "patentTitle", "officeActionContent"],
                    "description": "审查意见内容"
                },
                "originalClaims": {
                    "type": "string",
                    "description": "原始权利要求书"
                },
                "originalDescription": {
                    "type": "string",
                    "description": "原始说明书"
                },
                "strategyPreference": {
                    "type": "string",
                    "enum": ["aggressive", "moderate", "conservative"],
                    "default": "moderate",
                    "description": "答复策略偏好"
                }
            },
            "required": ["officeAction", "originalClaims", "originalDescription"]
        })
    }

    fn capabilities(&self) -> Vec<ToolCapability> {
        vec![ToolCapability::WritesFiles]
    }

    fn approval_requirement(&self) -> ApprovalRequirement {
        ApprovalRequirement::Suggest
    }

    async fn execute(
        &self,
        _input: serde_json::Value,
        _context: &ToolContext,
    ) -> Result<ToolResult, ToolError> {
        Err(ToolError::NotAvailable {
            message: "OA response must be executed through MCP adapter".to_string(),
        })
    }
}

// =============================================================================
// 7. PatentQualitySpec — 质量评估工具
// =============================================================================

/// 质量评估工具 Spec
///
/// 对应 MCP 工具: `quality_checker`
/// Schema 来源: `@yunpat/agent-quality/src/schema.ts`
pub struct PatentQualitySpec;

#[async_trait]
impl ToolSpec for PatentQualitySpec {
    fn name(&self) -> &str {
        "mcp_yunpat_quality_checker"
    }

    fn description(&self) -> &str {
        "质量检查工具 v3.0 - 集成真实的 QualityCheckerAgent 智能体。\
         对专利申请文件进行质量检查，包括权利要求检查、说明书检查和形式检查。"
    }

    fn input_schema(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {
                "inventionTitle": {
                    "type": "string",
                    "description": "发明名称"
                },
                "claims": {
                    "type": "object",
                    "properties": {
                        "independentClaims": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "claimNumber": { "type": "number" },
                                    "fullText": { "type": "string" },
                                    "claimType": { "type": "string" },
                                    "essentialFeatures": {
                                        "type": "array",
                                        "items": { "type": "string" }
                                    }
                                },
                                "required": ["claimNumber", "fullText", "claimType"]
                            }
                        },
                        "dependentClaims": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "claimNumber": { "type": "number" },
                                    "content": { "type": "string" },
                                    "parentClaim": { "type": "number" },
                                    "additionalFeatures": {
                                        "type": "array",
                                        "items": { "type": "string" }
                                    }
                                },
                                "required": ["claimNumber", "content", "parentClaim"]
                            }
                        }
                    },
                    "required": ["independentClaims", "dependentClaims"],
                    "description": "权利要求"
                },
                "specification": {
                    "type": "object",
                    "properties": {
                        "technicalField": { "type": "string" },
                        "backgroundArt": { "type": "string" },
                        "inventionContent": {
                            "type": "object",
                            "properties": {
                                "technicalProblem": { "type": "string" },
                                "technicalSolution": { "type": "string" },
                                "beneficialEffects": { "type": "string" }
                            }
                        },
                        "drawingsDescription": { "type": "string" },
                        "detailedDescription": { "type": "string" },
                        "abstract": { "type": "string" }
                    },
                    "description": "说明书"
                },
                "patentType": {
                    "type": "string",
                    "enum": ["invention", "utilityModel", "design"],
                    "default": "invention",
                    "description": "专利类型"
                },
                "checkLevel": {
                    "type": "number",
                    "enum": [1, 2, 3],
                    "default": 2,
                    "description": "检查级别（1=快速，2=标准，3=严格）"
                }
            },
            "required": ["inventionTitle", "claims", "specification"]
        })
    }

    fn capabilities(&self) -> Vec<ToolCapability> {
        vec![ToolCapability::ReadOnly]
    }

    fn approval_requirement(&self) -> ApprovalRequirement {
        ApprovalRequirement::Auto
    }

    async fn execute(
        &self,
        _input: serde_json::Value,
        _context: &ToolContext,
    ) -> Result<ToolResult, ToolError> {
        Err(ToolError::NotAvailable {
            message: "Quality check must be executed through MCP adapter".to_string(),
        })
    }
}

// =============================================================================
// 8. LegalKnowledgeSearchSpec — 法律知识检索工具
// =============================================================================

/// 法律知识检索工具 Spec
///
/// 对应 MCP 工具: `legal_knowledge_search`
/// Schema 来源: `@yunpat/agent-legal-qa/src/schema.ts`
pub struct LegalKnowledgeSearchSpec;

#[async_trait]
impl ToolSpec for LegalKnowledgeSearchSpec {
    fn name(&self) -> &str {
        "mcp_yunpat_legal_knowledge_search"
    }

    fn description(&self) -> &str {
        "法律知识检索工具 — 搜索法律法规、审查指南、复审无效决定、判决文书等法律资源。"
    }

    fn input_schema(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {
                "question": {
                    "type": "string",
                    "description": "法律问题或检索关键词"
                },
                "domain": {
                    "type": "string",
                    "enum": ["patent", "trademark", "copyright", "trade_secret"],
                    "description": "法律领域"
                },
                "sources": {
                    "type": "array",
                    "items": {
                        "type": "string",
                        "enum": ["law_article", "invalid_decision", "patent_judgment", "patent_rule", "legal_document"]
                    },
                    "description": "数据来源"
                },
                "topK": {
                    "type": "number",
                    "minimum": 1,
                    "maximum": 100,
                    "default": 10,
                    "description": "返回结果数量"
                }
            },
            "required": ["question"]
        })
    }

    fn capabilities(&self) -> Vec<ToolCapability> {
        vec![ToolCapability::Network, ToolCapability::ReadOnly]
    }

    fn approval_requirement(&self) -> ApprovalRequirement {
        ApprovalRequirement::Auto
    }

    async fn execute(
        &self,
        _input: serde_json::Value,
        _context: &ToolContext,
    ) -> Result<ToolResult, ToolError> {
        Err(ToolError::NotAvailable {
            message: "Legal knowledge search must be executed through MCP adapter".to_string(),
        })
    }
}

// =============================================================================
// 9. InvalidDecisionSearchSpec — 无效决定检索工具
// =============================================================================

/// 无效决定检索工具 Spec
///
/// 对应 MCP 工具: `invalid_decision_search`
/// Schema 来源: `@yunpat/agent-legal-qa/src/schema.ts`
pub struct InvalidDecisionSearchSpec;

#[async_trait]
impl ToolSpec for InvalidDecisionSearchSpec {
    fn name(&self) -> &str {
        "mcp_yunpat_invalid_decision_search"
    }

    fn description(&self) -> &str {
        "专利无效决定检索工具 — 搜索专利复审和无效宣告决定书。"
    }

    fn input_schema(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "检索关键词"
                },
                "domain": {
                    "type": "string",
                    "description": "法律领域"
                },
                "topK": {
                    "type": "number",
                    "minimum": 1,
                    "maximum": 100,
                    "default": 10,
                    "description": "返回结果数量"
                }
            },
            "required": ["query"]
        })
    }

    fn capabilities(&self) -> Vec<ToolCapability> {
        vec![ToolCapability::Network, ToolCapability::ReadOnly]
    }

    fn approval_requirement(&self) -> ApprovalRequirement {
        ApprovalRequirement::Auto
    }

    async fn execute(
        &self,
        _input: serde_json::Value,
        _context: &ToolContext,
    ) -> Result<ToolResult, ToolError> {
        Err(ToolError::NotAvailable {
            message: "Invalid decision search must be executed through MCP adapter".to_string(),
        })
    }
}

// =============================================================================
// 10. PatentRuleSearchSpec — 专利审查指南检索工具
// =============================================================================

/// 专利审查指南检索工具 Spec
///
/// 对应 MCP 工具: `patent_rule_search`
/// Schema 来源: `@yunpat/agent-legal-qa/src/schema.ts`
pub struct PatentRuleSearchSpec;

#[async_trait]
impl ToolSpec for PatentRuleSearchSpec {
    fn name(&self) -> &str {
        "mcp_yunpat_patent_rule_search"
    }

    fn description(&self) -> &str {
        "专利审查指南检索工具 — 搜索专利审查指南、审查规程等规范性文件。"
    }

    fn input_schema(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "检索关键词"
                },
                "articleType": {
                    "type": "string",
                    "description": "条文类型"
                },
                "topK": {
                    "type": "number",
                    "minimum": 1,
                    "maximum": 100,
                    "default": 10,
                    "description": "返回结果数量"
                }
            },
            "required": ["query"]
        })
    }

    fn capabilities(&self) -> Vec<ToolCapability> {
        vec![ToolCapability::Network, ToolCapability::ReadOnly]
    }

    fn approval_requirement(&self) -> ApprovalRequirement {
        ApprovalRequirement::Auto
    }

    async fn execute(
        &self,
        _input: serde_json::Value,
        _context: &ToolContext,
    ) -> Result<ToolResult, ToolError> {
        Err(ToolError::NotAvailable {
            message: "Patent rule search must be executed through MCP adapter".to_string(),
        })
    }
}

// =============================================================================
// 11. ProjectScanSpec — 项目扫描工具
// =============================================================================

/// 项目扫描工具 Spec
///
/// 对应 MCP 工具: `project_scan`
/// 扫描工作目录，识别文档类型，推断案件阶段
pub struct ProjectScanSpec;

#[async_trait]
impl ToolSpec for ProjectScanSpec {
    fn name(&self) -> &str {
        "mcp_yunpat_project_scan"
    }

    fn description(&self) -> &str {
        "工作目录扫描工具 — 扫描用户指定的外部工作目录，识别文档类型（特别是 CNIPA 官文），\
         推断案件类型和项目阶段，生成可注入 system prompt 的项目上下文。"
    }

    fn input_schema(&self) -> serde_json::Value {
        json!({
            "type": "object",
            "properties": {
                "workingDirectory": {
                    "type": "string",
                    "description": "工作目录绝对路径"
                },
                "maxFiles": {
                    "type": "number",
                    "minimum": 1,
                    "maximum": 200,
                    "default": 50,
                    "description": "最大扫描文件数"
                },
                "maxContentPreview": {
                    "type": "number",
                    "minimum": 100,
                    "maximum": 5000,
                    "default": 500,
                    "description": "最大内容预览长度"
                },
                "writeFile": {
                    "type": "boolean",
                    "default": true,
                    "description": "是否在工作目录生成 yunpat.md"
                }
            },
            "required": ["workingDirectory"]
        })
    }

    fn capabilities(&self) -> Vec<ToolCapability> {
        vec![ToolCapability::ReadOnly, ToolCapability::WritesFiles]
    }

    fn approval_requirement(&self) -> ApprovalRequirement {
        ApprovalRequirement::Suggest
    }

    async fn execute(
        &self,
        _input: serde_json::Value,
        _context: &ToolContext,
    ) -> Result<ToolResult, ToolError> {
        Err(ToolError::NotAvailable {
            message: "Project scan must be executed through MCP adapter".to_string(),
        })
    }
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_patent_search_spec_metadata() {
        let spec = PatentSearchSpec;
        assert_eq!(spec.name(), "mcp_yunpat_patent_search");
        assert!(!spec.description().is_empty());
        assert!(spec.capabilities().contains(&ToolCapability::Network));
    }

    #[test]
    fn test_patent_search_spec_schema() {
        let spec = PatentSearchSpec;
        let schema = spec.input_schema();
        assert_eq!(schema["type"], "object");
        assert!(schema["properties"]["inventionTitle"].is_object());
        assert!(
            schema["required"]
                .as_array()
                .unwrap()
                .contains(&serde_json::json!("inventionTitle"))
        );
    }

    #[test]
    fn test_patent_claim_gen_spec_metadata() {
        let spec = PatentClaimGenSpec;
        assert_eq!(spec.name(), "mcp_yunpat_claims_generator");
        assert!(!spec.description().is_empty());
    }

    #[test]
    fn test_patent_quality_spec_metadata() {
        let spec = PatentQualitySpec;
        assert_eq!(spec.name(), "mcp_yunpat_quality_checker");
        assert!(!spec.description().is_empty());
    }

    #[test]
    fn test_legal_knowledge_search_spec_metadata() {
        let spec = LegalKnowledgeSearchSpec;
        assert_eq!(spec.name(), "mcp_yunpat_legal_knowledge_search");
        assert!(!spec.description().is_empty());
    }

    #[test]
    fn test_project_scan_spec_metadata() {
        let spec = ProjectScanSpec;
        assert_eq!(spec.name(), "mcp_yunpat_project_scan");
        assert!(!spec.description().is_empty());
        assert!(spec.capabilities().contains(&ToolCapability::WritesFiles));
    }

    #[tokio::test]
    async fn test_spec_execute_returns_not_available() {
        let spec = PatentSearchSpec;
        let context = ToolContext::new("/tmp/test");
        let result = spec
            .execute(json!({"inventionTitle": "test"}), &context)
            .await;
        assert!(result.is_err());
        match result.unwrap_err() {
            ToolError::NotAvailable { .. } => {}
            _ => panic!("Expected NotAvailable error"),
        }
    }
}
