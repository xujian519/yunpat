import { z } from 'zod'

export const claimsGeneratorToolInputSchema = z.object({
  inventionTitle: z.string().min(1),
  technicalField: z.string().min(1),
  technicalProblem: z.string().min(1),
  technicalSolution: z.string().min(1),
  beneficialEffects: z.string().min(1),
  keyFeatures: z.array(z.string()).min(1),
  patentType: z.enum(['invention', 'utilityModel', 'design']).default('invention'),
  enableDependentClaims: z.boolean().default(true),
  dependentClaimCount: z.number().min(0).max(20).default(5),
})

export const claimsGeneratorToolMetadata = {
  name: 'claims_generator' as const,
  description: '权利要求生成工具 v3.0 - 集成真实的 ClaimGeneratorAgent 智能体',
  version: '3.0.0',
  inputSchema: claimsGeneratorToolInputSchema,
}

export const claimsGeneratorToolSchema = {
  name: 'claims_generator' as const,
  description: '权利要求生成工具 v3.0 - 集成真实的 ClaimGeneratorAgent 智能体',
  version: '3.0.0',
  inputSchema: claimsGeneratorToolInputSchema,
}

export type ClaimsGeneratorToolInput = z.infer<typeof claimsGeneratorToolInputSchema>
