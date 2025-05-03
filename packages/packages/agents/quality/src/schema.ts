import { z } from 'zod'

export const qualityCheckerToolInputSchema = z.object({
  inventionTitle: z.string(),
  claims: z.object({
    independentClaims: z.array(
      z.object({
        claimNumber: z.number(),
        fullText: z.string(),
        claimType: z.string(),
        essentialFeatures: z.array(z.string()).optional(),
      })
    ),
    dependentClaims: z.array(
      z.object({
        claimNumber: z.number(),
        content: z.string(),
        parentClaim: z.number(),
        additionalFeatures: z.array(z.string()).optional(),
      })
    ),
  }),
  specification: z.object({
    technicalField: z.string().optional(),
    backgroundArt: z.string().optional(),
    inventionContent: z
      .object({
        technicalProblem: z.string().optional(),
        technicalSolution: z.string().optional(),
        beneficialEffects: z.string().optional(),
      })
      .optional(),
    drawingsDescription: z.string().optional(),
    detailedDescription: z.string().optional(),
    abstract: z.string().optional(),
  }),
  patentType: z.enum(['invention', 'utilityModel', 'design']).default('invention'),
  checkLevel: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(2),
})

export const qualityCheckerToolMetadata = {
  name: 'quality_checker' as const,
  description: '质量检查工具 v3.0 - 集成真实的 QualityCheckerAgent 智能体',
  version: '3.0.0',
  inputSchema: qualityCheckerToolInputSchema,
}

export const qualityCheckerToolSchema = {
  name: 'quality_checker' as const,
  description: '质量检查工具 v3.0 - 集成真实的 QualityCheckerAgent 智能体',
  version: '3.0.0',
  inputSchema: qualityCheckerToolInputSchema,
}

export type QualityCheckerToolInput = z.infer<typeof qualityCheckerToolInputSchema>
