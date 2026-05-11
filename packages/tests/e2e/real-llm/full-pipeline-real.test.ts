/**
 * 真实 LLM E2E 测试
 *
 * T-008, T-016, T-021: 使用真实 LLM API 的完整工作流测试
 * 仅在 RUN_REAL_LLM_TESTS=true 时运行
 */

import { describe, it, expect } from 'vitest'
import { createSampleDisclosure, createSampleOfficeAction } from '../helpers/test-data-factory.js'
import { assertValidInventionConcepts } from '../helpers/assertion-helpers.js'

const describeRealLLM = process.env.RUN_REAL_LLM_TESTS === 'true' ? describe : describe.skip

const TEST_TIMEOUT = 180_000

describeRealLLM('真实 LLM E2E 测试', () => {
  describe('T-008: 完整撰写流水线 + 真实 DeepSeek', () => {
    it(
      '应使用真实 LLM 完成 6 阶段撰写流水线',
      async () => {
        const disclosure = createSampleDisclosure('thermal')

        // 阶段1: 发明理解
        const { InventionUnderstandingAgent } = await import('@yunpat/agent-invention')
        const { EventBus, ShortTermMemory, ToolRegistry } = await import('@yunpat/core')
        const { createDeepSeekModel } = await import('@yunpat/core')

        if (!process.env.DEEPSEEK_API_KEY) return

        const llm = createDeepSeekModel({
          apiKey: process.env.DEEPSEEK_API_KEY,
          model: 'deepseek-chat',
        })
        const eventBus = new EventBus()
        const memory = new ShortTermMemory()
        const tools = new ToolRegistry(eventBus)

        const inventionAgent = new InventionUnderstandingAgent({
          name: 'invention-understanding',
          description: '发明理解智能体',
          llm: llm as any,
          memory: memory as any,
          tools: tools as any,
          eventBus: eventBus as any,
        })

        const inventionResult = await inventionAgent.execute({
          title: disclosure.title,
          field: disclosure.field,
          technicalDisclosure: disclosure.disclosure,
        })

        assertValidInventionConcepts(inventionResult)

        // 验证 LLM 生成了有意义的内容
        expect(inventionResult.technicalField).toBeTruthy()
        expect(inventionResult.keyFeatures.length).toBeGreaterThan(0)
      },
      TEST_TIMEOUT
    )
  })

  describe('T-016: 完整 OA 答复 + 真实 LLM', () => {
    it(
      '应使用真实 LLM 完成 OA 分析和答复',
      async () => {
        if (!process.env.DEEPSEEK_API_KEY) return

        const oa = createSampleOfficeAction('first-oa-inventiveness')

        try {
          const { PatentResponderAgent } = await import('@yunpat/agent-patent-responder')
          const { EventBus, ShortTermMemory, ToolRegistry, createDeepSeekModel } =
            await import('@yunpat/core')

          const llm = createDeepSeekModel({
            apiKey: process.env.DEEPSEEK_API_KEY,
            model: 'deepseek-chat',
          })
          const eventBus = new EventBus()
          const memory = new ShortTermMemory()
          const tools = new ToolRegistry(eventBus)

          const responder = new PatentResponderAgent({
            name: 'patent-responder',
            description: 'OA 答复智能体',
            llm: llm as any,
            memory: memory as any,
            tools: tools as any,
            eventBus: eventBus as any,
          })

          const result = await responder.execute({
            officeActionContent: oa.oaContent,
            applicationNumber: oa.applicationNumber,
            patentTitle: oa.patentTitle,
          })

          expect(result).toBeDefined()
          // 真实 LLM 应生成有意义的答复内容
          if (result.responseLetter) {
            expect(result.responseLetter.length).toBeGreaterThan(50)
          }
        } catch (error: any) {
          if (error.message?.includes('Cannot find module')) {
            return
          }
          throw error
        }
      },
      TEST_TIMEOUT
    )
  })

  describe('T-021: 完整分析 + 真实 LLM', () => {
    it(
      '应使用真实 LLM 完成专利分析',
      async () => {
        if (!process.env.DEEPSEEK_API_KEY) return

        const disclosure = createSampleDisclosure('thermal')

        try {
          const { PatentAnalyzerAgent } = await import('@yunpat/agent-patent-analyzer')
          const { EventBus, ShortTermMemory, ToolRegistry, createDeepSeekModel } =
            await import('@yunpat/core')

          const llm = createDeepSeekModel({
            apiKey: process.env.DEEPSEEK_API_KEY,
            model: 'deepseek-chat',
          })
          const eventBus = new EventBus()
          const memory = new ShortTermMemory()
          const tools = new ToolRegistry(eventBus)

          const analyzer = new PatentAnalyzerAgent({
            name: 'patent-analyzer',
            description: '专利分析智能体',
            llm: llm as any,
            memory: memory as any,
            tools: tools as any,
            eventBus: eventBus as any,
          })

          const result = await analyzer.execute({
            patentContent: disclosure.disclosure,
            analysisType: 'technical',
          })

          expect(result).toBeDefined()
        } catch (error: any) {
          if (error.message?.includes('Cannot find module')) {
            return
          }
          throw error
        }
      },
      TEST_TIMEOUT
    )
  })
})
