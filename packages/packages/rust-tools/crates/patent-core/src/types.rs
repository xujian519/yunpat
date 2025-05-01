use serde::{Deserialize, Serialize};

/// 特征类型
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum FeatureType {
    /// 核心特征
    Essential,
    /// 可选特征
    Optional,
}

/// 特征分类
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum FeatureCategory {
    Structural,
    Functional,
    Method,
    Material,
    Other,
}

/// 技术特征
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TechnicalFeature {
    pub id: String,
    pub description: String,
    pub feature_type: FeatureType,
    pub category: FeatureCategory,
    pub component: Option<String>,
    pub function: Option<String>,
}

/// 技术交底书文档
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DisclosureDoc {
    pub raw_text: String,
    pub sections: std::collections::HashMap<String, String>,
    pub confidence: f32,
}

/// 问题-特征-效果三元组
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProblemFeatureEffect {
    pub id: String,
    pub technical_problem: String,
    pub technical_features: Vec<TechnicalFeature>,
    pub technical_effects: Vec<String>,
}

/// 权利要求类型
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum ClaimType {
    Independent,
    Dependent,
}

/// 权利要求草稿
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaimDraft {
    pub id: String,
    pub claim_type: ClaimType,
    pub preamble: String,
    pub transitional_phrase: String,
    pub elements: Vec<String>,
    pub dependent_on: Option<String>,
}

/// 审查意见类型
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum OaType {
    Novelty,
    InventiveStep,
    Clarity,
    Support,
    Scope,
    Formal,
    Other(String),
}

/// 审查意见
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OfficeAction {
    pub oa_type: OaType,
    pub citations: Vec<CitedReference>,
    pub examiner_arguments: String,
    pub affected_claims: Vec<usize>,
}

/// 引用文献
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CitedReference {
    pub document_number: String,
    pub relevancy: String,
    pub claims_affected: Vec<usize>,
}

/// 答复策略类型
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum ResponseStrategyType {
    /// 修改权利要求
    AmendClaims,
    /// 争辩新颖性/创造性
    Argue,
    /// 争辩 + 修改
    Hybrid,
    /// 撤回
    Withdraw,
}

/// 答复策略
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResponseStrategy {
    pub strategy_type: ResponseStrategyType,
    pub reasoning: String,
    pub confidence: f32,
}

/// 质量评估维度
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QualityAssessment {
    pub clarity_score: f32,
    pub support_score: f32,
    pub scope_score: f32,
    pub overall_score: f32,
    pub issues: Vec<QualityIssue>,
}

/// 质量问题
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QualityIssue {
    pub dimension: String,
    pub severity: String,
    pub description: String,
    pub suggestion: String,
}

/// IPC 分类条目
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IpcClassification {
    pub section: String,
    pub class: String,
    pub subclass: String,
    pub group: String,
    pub description: String,
}
