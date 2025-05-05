import { z } from 'zod'

export const legalKnowledgeSearchToolInputSchema = z.object({
  question: z.string().min(1),
  domain: z.enum(['patent', 'trademark', 'copyright', 'trade_secret']).optional(),
  sources: z
    .array(
      z.enum([
        'law_article',
        'invalid_decision',
        'patent_judgment',
        'patent_rule',
        'legal_document',
      ])
    )
    .optional(),
  topK: z.number().min(1).max(100).default(10),
})

export const invalidDecisionSearchToolInputSchema = z.object({
  query: z.string().min(1),
  domain: z.string().optional(),
  topK: z.number().min(1).max(100).default(10),
})

export const patentRuleSearchToolInputSchema = z.object({
  query: z.string().min(1),
  articleType: z.string().optional(),
  topK: z.number().min(1).max(100).default(10),
})

export const legalKnowledgeSearchToolMetadata = {
  name: 'legal_knowledge_search' as const,
  description: '法律知识检索工具 - 搜索法律法规、审查指南、复审无效决定、判决文书',
  version: '1.0.0',
  inputSchema: legalKnowledgeSearchToolInputSchema,
}

export const invalidDecisionSearchToolMetadata = {
  name: 'invalid_decision_search' as const,
  description: '专利无效决定检索 - 搜索专利复审和无效宣告决定书',
  version: '1.0.0',
  inputSchema: invalidDecisionSearchToolInputSchema,
}

export const patentRuleSearchToolMetadata = {
  name: 'patent_rule_search' as const,
  description: '专利审查指南检索 - 搜索专利审查指南、审查规程等规范性文件',
  version: '1.0.0',
  inputSchema: patentRuleSearchToolInputSchema,
}

export const legalKnowledgeSearchToolSchema = {
  name: 'legal_knowledge_search' as const,
  description: '法律知识检索工具 - 搜索法律法规、审查指南、复审无效决定、判决文书',
  version: '1.0.0',
  inputSchema: legalKnowledgeSearchToolInputSchema,
}

export const invalidDecisionSearchToolSchema = {
  name: 'invalid_decision_search' as const,
  description: '专利无效决定检索 - 搜索专利复审和无效宣告决定书',
  version: '1.0.0',
  inputSchema: invalidDecisionSearchToolInputSchema,
}

export const patentRuleSearchToolSchema = {
  name: 'patent_rule_search' as const,
  description: '专利审查指南检索 - 搜索专利审查指南、审查规程等规范性文件',
  version: '1.0.0',
  inputSchema: patentRuleSearchToolInputSchema,
}

export type LegalKnowledgeSearchToolInput = z.infer<typeof legalKnowledgeSearchToolInputSchema>
export type InvalidDecisionSearchToolInput = z.infer<typeof invalidDecisionSearchToolInputSchema>
export type PatentRuleSearchToolInput = z.infer<typeof patentRuleSearchToolInputSchema>
