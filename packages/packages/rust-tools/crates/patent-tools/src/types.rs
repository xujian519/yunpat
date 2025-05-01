//! 核心类型定义

use serde::{Deserialize, Serialize};

/// 专利记录
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatentRecord {
    /// 专利号
    pub patent_number: String,
    /// 标题
    pub title: String,
    /// 摘要
    pub abstract_text: String,
    /// 申请人
    pub applicant: String,
    /// 发明人
    pub inventors: Vec<String>,
    /// 申请日期
    pub filing_date: String,
    /// 公开日期
    pub publication_date: String,
    /// 专利类型
    pub patent_type: PatentType,
    /// 法律状态
    pub legal_status: LegalStatus,
}

/// 专利类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum PatentType {
    /// 发明专利
    Invention,
    /// 实用新型
    UtilityModel,
    /// 外观设计
    Design,
}

/// 法律状态
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum LegalStatus {
    /// 有效
    Valid,
    /// 无效
    Invalid,
    /// 审查中
    Pending,
    /// 已过期
    Expired,
}

/// 专利搜索查询
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatentSearchQuery {
    /// 关键词
    pub keywords: Vec<String>,
    /// 申请人
    pub applicant: Option<String>,
    /// 发明人
    pub inventor: Option<String>,
    /// 申请日期范围
    pub filing_date_range: Option<(String, String)>,
    /// 专利类型
    pub patent_types: Option<Vec<PatentType>>,
    /// 排序字段
    pub sort_field: Option<SortField>,
    /// 排序方向
    pub sort_order: Option<SortOrder>,
    /// 返回数量限制
    pub limit: Option<usize>,
}

/// 排序字段
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum SortField {
    /// 申请日期
    FilingDate,
    /// 公开日期
    PublicationDate,
    /// 相关性
    Relevance,
}

/// 排序方向
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum SortOrder {
    /// 升序
    Asc,
    /// 降序
    Desc,
}

/// 技术特征
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TechnicalFeature {
    /// 特征名称
    pub name: String,
    /// 特征描述
    pub description: String,
    /// 特征类型
    pub feature_type: FeatureType,
}

/// 特征类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum FeatureType {
    /// 结构特征
    Structural,
    /// 功能特征
    Functional,
    /// 参数特征
    Parametric,
}

/// 权利要求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claim {
    /// 权利要求类型
    pub claim_type: ClaimType,
    /// 编号
    pub number: usize,
    /// 内容
    pub content: String,
    /// 从属权利要求的引用
    pub dependencies: Option<Vec<usize>>,
}

/// 权利要求类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum ClaimType {
    /// 独立权利要求
    Independent,
    /// 从属权利要求
    Dependent,
}

/// 质量评估结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QualityAssessment {
    /// 总体评分（0-100）
    pub overall_score: f64,
    /// 清晰度评分
    pub clarity_score: f64,
    /// 支持度评分
    pub support_score: f64,
    /// 保护范围评分
    pub breadth_score: f64,
    /// 质量问题列表
    pub issues: Vec<QualityIssue>,
}

/// 质量问题
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QualityIssue {
    /// 严重程度
    pub severity: SeverityLevel,
    /// 问题描述
    pub description: String,
    /// 建议修改
    pub suggestion: String,
}

/// 严重程度
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum SeverityLevel {
    /// 高
    High,
    /// 中
    Medium,
    /// 低
    Low,
}

/// 审查意见
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OfficeAction {
    /// 申请号
    pub application_number: String,
    /// 审查意见类型
    pub action_type: OfficeActionType,
    /// 驳回理由列表
    pub rejections: Vec<Rejection>,
    /// 引用的对比文件
    pub cited_references: Vec<CitedReference>,
}

/// 审查意见类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum OfficeActionType {
    /// 第一次审查意见
    FirstAction,
    /// 最终驳回
    FinalRejection,
    /// 授权通知
    NoticeOfAllowance,
}

/// 驳回理由
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Rejection {
    /// 驳回类型
    pub rejection_type: RejectionType,
    /// 权利要求编号
    pub claim_numbers: Vec<usize>,
    /// 驳回理由
    pub reasons: String,
    /// 引用的对比文件
    pub cited_references: Vec<String>,
}

/// 驳回类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum RejectionType {
    /// 缺乏新颖性
    LackOfNovelty,
    /// 缺乏创造性
    LackOfInventiveStep,
    /// 不清楚
    Unclear,
    /// 不得到支持
    NotSupported,
    /// 超出范围
    BeyondScope,
}

/// 引用的对比文件
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CitedReference {
    /// 文献号
    pub publication_number: String,
    /// 文献类型
    pub document_type: String,
    /// 相关性说明
    pub relevance: String,
    /// 公开日期
    pub publication_date: String,
}

/// 答复策略
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResponseStrategy {
    /// 策略类型
    pub strategy_type: StrategyType,
    /// 核心论点
    pub arguments: Vec<Argument>,
    /// 建议的权利要求修改
    pub suggested_amendments: Vec<ClaimAmendment>,
}

/// 策略类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum StrategyType {
    /// 修改
    Amendment,
    /// 争辩
    Argument,
    /// 结合
    Combination,
}

/// 论点
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Argument {
    /// 论点类型
    pub argument_type: ArgumentType,
    /// 论点内容
    pub content: String,
    /// 支持证据
    pub evidence: Vec<String>,
}

/// 论点类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum ArgumentType {
    /// 区别技术特征
    DistinguishingFeatures,
    /// 技术效果
    TechnicalEffect,
    /// 不显而易见性
    NonObviousness,
    /// 支持问题
    SupportIssues,
}

/// 权利要求修改
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaimAmendment {
    /// 权利要求编号
    pub claim_number: usize,
    /// 修改类型
    pub amendment_type: AmendmentType,
    /// 修改内容
    pub new_content: String,
    /// 修改理由
    pub reason: String,
}

/// 修改类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum AmendmentType {
    /// 添加特征
    AddFeature,
    /// 删除特征
    RemoveFeature,
    /// 替换特征
    ReplaceFeature,
    /// 合并权利要求
    CombineClaims,
}
