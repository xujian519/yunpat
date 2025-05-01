/**
 * MCP 工具类型定义
 */

import { z } from 'zod'

/**
 * 专利权利要求
 */
export interface PatentClaim {
  /** 权利要求类型 */
  type: 'independent' | 'dependent'
  /** 权利要求编号 */
  number: number
  /** 权利要求内容 */
  content: string
  /** 引用的权利要求（从属权利要求） */
  dependsOn?: number
}

/**
 * 专利说明书
 */
export interface PatentSpecification {
  /** 技术领域 */
  technicalField?: string
  /** 背景技术 */
  backgroundArt?: string
  /** 发明内容 */
  inventionContent?: string
  /** 具体实施方式 */
  embodiment?: string
}

/**
 * 检索选项
 */
export interface SearchOptions {
  /** 关键词列表 */
  keywords?: string[]
  /** 分类号列表 */
  classification?: string[]
  /** 日期范围 */
  dateRange?: { start: string; end: string }
  /** 申请人 */
  applicant?: string
  /** 结果数量限制 */
  limit?: number
}

/**
 * MCP 工具执行上下文
 */
export interface McpToolContext {
  /** LLM 客户端 */
  llm?: any
  /** 事件总线 */
  eventBus?: any
  /** 内存存储 */
  memory?: any
  /** 工具注册表 */
  registry?: any
}

/**
 * 专利引用信息
 */
export interface PatentReference {
  /** 专利ID */
  patentId: string
  /** 标题 */
  title: string
  /** 摘要 */
  abstract: string
  /** 相关性评分 (0-1) */
  relevanceScore: number
  /** 公开日期 */
  publicationDate: Date
  /** 申请人 */
  applicants: string[]
  /** 分类号 */
  classifications: string[]
  /** 引用次数 */
  citationCount: number
  /** 法律状态 */
  legalStatus: string
  /** 同族专利成员 */
  familyMembers: string[]
  /** URL */
  url: string
}

/**
 * 质量检查结果
 */
export interface QualityCheckResult {
  /** 完整性评分 */
  completenessScore: number
  /** 总体质量 */
  overallQuality: number
  /** 质量等级 */
  qualityLevel: 'excellent' | 'good' | 'fair' | 'poor'
  /** 问题列表 */
  issues: Array<{
    category: string
    severity: 'critical' | 'high' | 'medium' | 'low'
    description: string
    suggestion: string
  }>
  /** 改进建议 */
  recommendations: Array<{
    area: string
    priority: 'high' | 'medium' | 'low'
    suggested: string
    rationale: string
  }>
}

/**
 * 审查意见
 */
export interface OfficeAction {
  /** 申请号 */
  applicationNumber: string
  /** 专利名称 */
  patentTitle: string
  /** 审查员 */
  examiner?: string
  /** 审查意见内容 */
  officeActionContent: string
  /** 引用的对比文件 */
  citedReferences?: Array<{
    publicationNumber: string
    title: string
    relevance: string
  }>
}

/**
 * 答复策略
 */
export interface ResponseStrategy {
  /** 总体策略 */
  overallStrategy: 'argue' | 'amend' | 'abandon' | 'appeal'
  /** 成功概率评估 */
  successProbability: number
  /** 关键论点 */
  keyArguments: string[]
  /** 建议修改内容 */
  suggestedAmendments: Array<{
    claimNumber: number
    currentText: string
    proposedText: string
    reason: string
  }>
}
