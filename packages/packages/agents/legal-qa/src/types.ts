/**
 * 法律问答类型定义
 */

import type { BaseAgentInput, BaseAgentOutput } from '@yunpat/agent-base'

/** 查询来源 */
export type LegalSource =
  | 'law_article'
  | 'invalid_decision'
  | 'patent_judgment'
  | 'patent_rule'
  | 'legal_document'

/** 查询领域 */
export type LegalDomain =
  | 'patent'
  | 'trademark'
  | 'copyright'
  | 'trade_secret'
  | 'antitrust'
  | 'general'

/** 法律问答输入 */
export interface LegalQAInput extends BaseAgentInput {
  /** 用户问题 */
  question: string
  /** 查询领域 */
  domain?: LegalDomain
  /** 限定数据来源 */
  sources?: LegalSource[]
  /** 上下文信息（如专利号、申请号等） */
  context?: {
    patentNumber?: string
    applicationNumber?: string
    applicantName?: string
    [key: string]: string | undefined
  }
  /** 返回结果数量 */
  topK?: number
}

/** 法条引用 */
export interface LawCitation {
  /** 法条ID */
  articleId: string
  /** 法条标题 */
  title: string
  /** 法条内容（摘要） */
  content: string
  /** 来源法律 */
  lawTitle: string
  /** 相关性评分 0-1 */
  relevance: number
  /** 来源类型 */
  source: LegalSource
}

/** 案例引用 */
export interface CaseCitation {
  /** 文书号/决定号 */
  documentNumber: string
  /** 标题 */
  title: string
  /** 案例摘要 */
  summary: string
  /** 领域 */
  domain: string
  /** 相关性评分 0-1 */
  relevance: number
  /** 来源类型 */
  source: 'invalid_decision' | 'patent_judgment' | 'patent_judgment_case'
}

/** 法律问答输出 */
export interface LegalQAOutput extends BaseAgentOutput {
  /** 回答内容 */
  answer: string
  /** 引用的法条 */
  lawCitations: LawCitation[]
  /** 引用的案例 */
  caseCitations: CaseCitation[]
  /** 审查指南引用 */
  ruleCitations: Array<{
    articleId: string
    title: string
    content: string
    relevance: number
  }>
  /** 置信度 0-1 */
  confidence: number
  /** 数据来源统计 */
  sourceStats: {
    totalQueries: number
    sources: Record<LegalSource, number>
  }
}
