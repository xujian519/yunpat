import { z } from 'zod'

export const patentSearchToolInputSchema = z.object({
  inventionTitle: z.string().min(1),
  technicalField: z.string().min(1),
  technicalProblem: z.string().min(1),
  technicalSolution: z.string().min(1),
  keyFeatures: z.array(z.string()).min(1),
  searchOptions: z
    .object({
      keywords: z.array(z.string()).optional(),
      limit: z.number().min(1).max(100).default(20),
    })
    .optional(),
})

export const patentSearchToolMetadata = {
  name: 'patent_search' as const,
  description: '专利检索工具 v3.0 - 集成真实的 PatentSearchAgent 智能体',
  version: '3.0.0',
  inputSchema: patentSearchToolInputSchema,
} as const

export const patentSearchToolSchema = {
  name: 'patent_search' as const,
  description: '专利检索工具 v3.0 - 集成真实的 PatentSearchAgent 智能体',
  version: '3.0.0',
  inputSchema: patentSearchToolInputSchema,
} as const

export type PatentSearchToolInput = z.infer<typeof patentSearchToolInputSchema>
