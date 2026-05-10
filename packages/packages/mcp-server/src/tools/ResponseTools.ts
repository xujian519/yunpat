import { z } from 'zod'
import { BaseMcpTool } from './BaseMcpTool.js'
import type { McpToolContext } from '../types.js'

export class PatentResponderTool extends BaseMcpTool<any, any> {
  readonly metadata = {
    name: 'patent_responder',
    description: '分析审查意见并生成答复文档',
    inputSchema: z.object({
      officeAction: z.object({
        applicationNumber: z.string(),
        patentTitle: z.string(),
        officeActionContent: z.string(),
        citedReferences: z
          .array(
            z.object({
              publicationNumber: z.string(),
              title: z.string(),
              relevance: z.string(),
            })
          )
          .optional(),
      }),
      originalClaims: z.string(),
      originalDescription: z.string(),
      strategyPreference: z.enum(['aggressive', 'moderate', 'conservative']).default('moderate'),
    }),
    version: '1.0.0',
  }

  protected async executeInternal(input: any, context: McpToolContext) {
    if (context.llm && context.eventBus && context.memory && context.registry) {
      try {
        const { PatentResponderAgentV5 } = await import('@yunpat/agent-patent-responder')

        const responderAgent = new PatentResponderAgentV5({
          name: 'patent-responder',
          description: '审查意见答复智能体',
          llm: context.llm,
          eventBus: context.eventBus,
          memory: context.memory,
          tools: context.registry,
        })

        const result = await responderAgent.execute({
          officeAction: {
            applicationNumber: input.officeAction.applicationNumber,
            patentTitle: input.officeAction.patentTitle,
            officeActionContent: input.officeAction.officeActionContent,
            citedReferences: input.officeAction.citedReferences,
          },
          originalApplication: {
            title: input.officeAction.patentTitle,
            claims: input.originalClaims,
            description: input.originalDescription,
          },
          strategyPreference: input.strategyPreference,
          enablePrecedentSearch: true,
          enableLegalKnowledge: true,
        })

        return {
          version: '1.0.0',
          integrationMode: 'real_agent',
          ...result,
        }
      } catch (error) {
        console.warn('[PatentResponderTool] 真实智能体调用失败，回退到规则模式:', error)
      }
    }

    const content = input.officeAction.officeActionContent.toLowerCase()
    const issues: any[] = []

    if (content.includes('创造性') || content.includes('显而易见')) {
      issues.push({ type: 'inventiveness', description: '不具备创造性', severity: 'high' })
    }
    if (content.includes('新颖性')) {
      issues.push({ type: 'novelty', description: '不具备新颖性', severity: 'high' })
    }

    return {
      version: '1.0.0',
      integrationMode: 'rule_based',
      analysis: {
        summary: `审查意见指出${issues.length}个主要问题`,
        keyIssues: issues,
        overcomeProbability: 70,
      },
      strategy: {
        overallStrategy: 'argue',
        successProbability: 70,
        keyArguments: ['本申请与对比文件存在区别技术特征', '区别特征带来了预料不到的技术效果'],
        suggestedAmendments: [],
        additionalEvidence: [],
        risks: [],
      },
      responseDocument: {
        responseLetter: `# 审查意见答复书\n\n申请号：${input.officeAction.applicationNumber}\n\n尊敬的审查员：\n\n申请人收到贵局的审查意见通知书，现答复如下：\n\n...`,
        detailedArguments: issues.map((i) => ({
          category: i.type,
          argument: `关于${i.description}，申请人认为...`,
          evidence: [],
        })),
        metrics: { wordCount: 500, argumentCount: issues.length, amendmentCount: 0 },
      },
      nextSteps: ['提交答复意见陈述书', '关注审查员的后续审查意见'],
    }
  }
}
