/**
 * 四策略集成测试
 *
 * 测试 CoT、ToT、ReAct、Reflection 四个推理策略的组合使用
 * 验证它们在专利场景中的协同工作能力
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ChainOfThoughtStrategy } from '../../src/reasoning/ChainOfThoughtStrategy.js'
import { TreeOfThoughtsStrategy } from '../../src/reasoning/TreeOfThoughtsStrategy.js'
import { ReActLoop } from '../../src/reasoning/ReActLoop.js'
import { EnhancedReflection } from '../../src/reasoning/EnhancedReflection.js'
import type { ExecutionContext } from '../../src/lifecycle/Lifecycle.js'

// Mock LLM Adapter
const createMockLLM = () => ({
  chat: vi.fn(),
})

// Mock ExecutionContext
const createMockContext = (): ExecutionContext => ({
  executionId: 'test-integration',
  agentName: 'IntegrationTestAgent',
  startTime: new Date(),
  currentStage: 'act' as any,
  memory: {} as any,
  eventBus: {} as any,
  tools: {} as any,
  llm: {} as any,
  metadata: {},
  sharedState: new Map(),
})

describe('四策略集成测试', () => {
  let mockLLM: ReturnType<typeof createMockLLM>
  let context: ExecutionContext

  beforeEach(() => {
    mockLLM = createMockLLM()
    context = createMockContext()
  })

  describe('策略组合 - CoT + ToT', () => {
    it('应该先用 CoT 分析问题，再用 ToT 生成多个方案', async () => {
      const problem = '设计一种新型的数据压缩算法'

      // 步骤1: CoT 分析
      const cot = new ChainOfThoughtStrategy(mockLLM as any)
      mockLLM.chat.mockResolvedValueOnce({
        message: {
          role: 'assistant' as const,
          content: `
步骤1：分析现有技术的局限性
现有压缩算法在处理图像数据时效率较低
步骤2：确定创新方向
结合深度学习技术可以提高压缩比
步骤3：结论：该发明具有创造性
          `,
        },
        usage: { totalTokens: 100 },
      })

      const cotResult = await cot.reason(problem)
      expect(cotResult.steps.length).toBeGreaterThan(0)
      expect(cotResult.conclusion).toContain('创造性')

      // 步骤2: ToT 生成多个布局方案
      const tot = new TreeOfThoughtsStrategy(mockLLM as any)
      mockLLM.chat.mockResolvedValueOnce({
        message: {
          role: 'assistant' as const,
          content: `
1. 独权包含所有特征
2. 独权只保留核心特征，从权添加优化特征
3. 双独权：方法+装置
          `,
        },
        usage: { totalTokens: 50 },
      })

      const thoughts = await tot.generateThoughts(problem, 3)
      expect(thoughts.length).toBe(3)

      // 验证：CoT 提供了分析基础，ToT 在此基础上生成了多个方案
      expect(cotResult.steps.length).toBeGreaterThan(0)
      expect(thoughts.length).toBe(3)
    })
  })

  describe('策略组合 - ReAct + Reflection', () => {
    it('应该使用 ReAct 执行任务，再用 Reflection 检查结果质量', async () => {
      const goal = '检索专利文献并分析结果'

      // 步骤1: ReAct 执行
      const reactLoop = new ReActLoop(mockLLM as any, { verbose: false })

      // Mock ReAct 循环的两次迭代
      let iterationCount = 0
      mockLLM.chat
        .mockResolvedValueOnce({
          message: {
            role: 'assistant' as const,
            content: '思考：需要检索专利文献\n状态：acting\n下一步：search: {"query": "专利"}',
          },
          usage: { totalTokens: 50 },
        })
        .mockResolvedValueOnce({
          message: {
            role: 'assistant' as const,
            content: '思考：检索完成\n状态：done',
          },
          usage: { totalTokens: 30 },
        })

      const iterations: any[] = []
      for await (const iter of reactLoop.execute(goal)) {
        iterations.push(iter)
        iterationCount++
        if (iter.done || iterationCount >= 2) break
      }

      expect(iterations.length).toBeGreaterThan(0)

      // 步骤2: Reflection 检查结果
      const reflection = new EnhancedReflection(mockLLM as any)
      // 确保 mock 有足够的响应
      mockLLM.chat.mockResolvedValue({
        message: {
          role: 'assistant' as const,
          content: '质量评估：良好\n完整性：优秀',
        },
        usage: { totalTokens: 50 },
      })

      const result = { iterations: iterations.length, goal: goal }
      const report = await reflection.reflect(result, context)

      // 验证：ReAct 完成了任务，Reflection 评估了质量
      expect(iterations.length).toBeGreaterThan(0)
      expect(report.assessments.length).toBeGreaterThan(0)
    })
  })

  describe('完整工作流 - CoT → ToT → ReAct → Reflection', () => {
    it('应该完整执行专利撰写流程', async () => {
      const invention = {
        title: '智能数据压缩系统',
        features: ['深度学习', '边缘计算'],
      }

      // 阶段1: CoT - 创造性分析
      console.log('\n阶段1: CoT 创造性分析')
      const cot = new ChainOfThoughtStrategy(mockLLM as any)
      mockLLM.chat.mockResolvedValue({
        message: {
          role: 'assistant' as const,
          content: '步骤1：分析技术特征\n步骤2：对比现有技术\n结论：具有创造性',
        },
        usage: { totalTokens: 100 },
      })

      const cotResult = await cot.reason(`分析${invention.title}的创造性`)
      expect(cotResult.conclusion).toContain('创造性')

      // 阶段2: ToT - 布局设计
      console.log('阶段2: ToT 布局设计')
      const tot = new TreeOfThoughtsStrategy(mockLLM as any)
      mockLLM.chat.mockResolvedValueOnce({
        message: {
          role: 'assistant' as const,
          content: '1. 宽保护方案\n2. 稳定方案\n3. 双独权方案',
        },
        usage: { totalTokens: 50 },
      })

      const thoughts = await tot.generateThoughts(`为${invention.title}设计权利要求`, 3)
      expect(thoughts.length).toBe(3)

      // 阶段3: ReAct - 检索验证
      console.log('阶段3: ReAct 检索验证')
      const reactLoop = new ReActLoop(mockLLM as any, { verbose: false })
      mockLLM.chat.mockResolvedValueOnce({
        message: {
          role: 'assistant' as const,
          content: '思考：检索完成\n状态：done',
        },
        usage: { totalTokens: 30 },
      })

      const searchIterations: any[] = []
      for await (const iter of reactLoop.execute(`检索${invention.title}`)) {
        searchIterations.push(iter)
        if (iter.done) break
      }

      // 阶段4: Reflection - 质量检查
      console.log('阶段4: Reflection 质量检查')
      const reflection = new EnhancedReflection(mockLLM as any)
      mockLLM.chat.mockResolvedValue({
        message: {
          role: 'assistant' as const,
          content: '质量评估：优秀\n完整性：良好',
        },
        usage: { totalTokens: 50 },
      })

      const finalDraft = {
        title: invention.title,
        creativity: cotResult,
        layout: thoughts,
        search: searchIterations,
      }

      const report = await reflection.reflect(finalDraft, context, '专利申请最终检查')

      // 验证完整工作流
      expect(cotResult.conclusion).toBeTruthy()
      expect(thoughts.length).toBe(3)
      expect(searchIterations.length).toBeGreaterThan(0)
      expect(report.assessments.length).toBeGreaterThan(0)
    })
  })

  describe('专利场景 - 创造性判断工作流', () => {
    it('应该使用 CoT 逐步分析创造性，使用 Reflection 验证结论', async () => {
      const patentCase = {
        title: '一种新型滤波器',
        priorArt: '对比文件1公开了特征A和B',
        features: '特征C：自适应参数调整',
      }

      // CoT 分析
      const cot = new ChainOfThoughtStrategy(mockLLM as any)
      mockLLM.chat.mockResolvedValue({
        message: {
          role: 'assistant' as const,
          content: `
步骤1：确定区别技术特征为C
步骤2：对比文件2未公开C
步骤3：C解决的技术问题不同于现有技术
结论：具有创造性
          `,
        },
        usage: { totalTokens: 150 },
      })

      const analysis = await cot.reason(`判断专利案件是否具有创造性：${patentCase.title}`, {
        priorArt: patentCase.priorArt,
        features: patentCase.features,
      })

      // Reflection 验证
      const reflection = new EnhancedReflection(mockLLM as any)
      mockLLM.chat.mockResolvedValue({
        message: {
          role: 'assistant' as const,
          content: `
质量评估：良好
理由：推理逻辑清晰
问题：无
          `,
        },
        usage: { totalTokens: 80 },
      })

      const validation = await reflection.reflect(analysis, context, '验证创造性判断的正确性')

      // 验证：CoT 给出了结论，Reflection 确认了质量
      expect(analysis.conclusion).toContain('创造性')
      expect(validation.overallScore).toBeGreaterThanOrEqual(0)
    })
  })

  describe('专利场景 - 权利要求布局优化', () => {
    it('应该使用 ToT 生成布局方案，使用 CoT 评估每个方案', async () => {
      const requirements = {
        invention: '智能监控系统',
        features: ['图像识别', '实时告警', '数据存储'],
        goals: ['保护范围广', '稳定性高'],
      }

      // ToT 生成方案
      const tot = new TreeOfThoughtsStrategy(mockLLM as any)
      mockLLM.chat.mockResolvedValueOnce({
        message: {
          role: 'assistant' as const,
          content: `
1. 独权包含所有特征
2. 独权只保留核心特征
3. 双独权：方法+装置
          `,
        },
        usage: { totalTokens: 50 },
      })

      const thoughts = await tot.generateThoughts(`设计${requirements.invention}的权利要求布局`, 3)

      // CoT 评估每个方案
      const cot = new ChainOfThoughtStrategy(mockLLM as any)
      mockLLM.chat.mockResolvedValueOnce({
        message: {
          role: 'assistant' as const,
          content: '方案1：保护范围广但稳定性低\n方案2：保护范围适中\n方案3：布局全面',
        },
        usage: { totalTokens: 100 },
      })

      const evaluation = await cot.reason(
        `评估以下布局方案的优劣：\n${thoughts.map((t, i) => `${i + 1}. ${t.thought}`).join('\n')}`,
        {
          invention: requirements.invention,
          features: requirements.features,
        }
      )

      // 验证：ToT 生成了多个方案，CoT 提供了评估
      expect(thoughts.length).toBe(3)
      expect(evaluation.steps.length).toBeGreaterThan(0)
    })
  })

  describe('专利场景 - 检索策略优化', () => {
    it('应该使用 ReAct 迭代检索，使用 ToT 选择最佳检索策略', async () => {
      const searchQuery = '自适应滤波器 + 通信系统'

      // ToT 生成检索策略
      const tot = new TreeOfThoughtsStrategy(mockLLM as any)
      mockLLM.chat.mockResolvedValueOnce({
        message: {
          role: 'assistant' as const,
          content: `
1. 关键词检索 "adaptive filter"
2. 分类号检索 H04H
3. 语义检索 "信号处理 + 滤波器"
          `,
        },
        usage: { totalTokens: 50 },
      })

      const strategies = await tot.generateThoughts(`为${searchQuery}设计检索策略`, 3)

      // 选择最佳策略
      mockLLM.chat.mockResolvedValueOnce({
        message: {
          role: 'assistant' as const,
          content: '策略2评分最高：9/10',
        },
        usage: { totalTokens: 30 },
      })

      const evaluated = await tot.evaluateThoughts(searchQuery, strategies)
      const bestStrategy = evaluated.reduce((best, current) =>
        current.score > best.score ? current : best
      )

      // 使用 ReAct 执行检索
      const reactLoop = new ReActLoop(mockLLM as any, { verbose: false })
      mockLLM.chat.mockResolvedValue({
        message: {
          role: 'assistant' as const,
          content: `思考：使用${bestStrategy.thought}进行检索\n状态：done`,
        },
        usage: { totalTokens: 50 },
      })

      const iterations: any[] = []
      for await (const iter of reactLoop.execute(bestStrategy.thought)) {
        iterations.push(iter)
        if (iter.done) break
      }

      // 验证：ToT 提供了策略，ReAct 执行了检索
      expect(strategies.length).toBe(3)
      expect(bestStrategy.score).toBeGreaterThanOrEqual(5)
      expect(iterations.length).toBeGreaterThan(0)
    })
  })

  describe('错误处理和容错', () => {
    it('应该处理单个策略失败的情况', async () => {
      // CoT 失败，使用 ToT 替代
      const cot = new ChainOfThoughtStrategy(mockLLM as any)
      mockLLM.chat.mockRejectedValueOnce(new Error('LLM API 错误'))

      const tot = new TreeOfThoughtsStrategy(mockLLM as any)
      mockLLM.chat.mockResolvedValue({
        message: {
          role: 'assistant' as const,
          content: '替代方案',
        },
        usage: { totalTokens: 50 },
      })

      // 尝试 CoT，失败后使用 ToT
      let result
      try {
        result = await cot.reason('分析问题')
      } catch (error) {
        console.log('CoT 失败，使用 ToT 替代')
        const thoughts = await tot.generateThoughts('分析问题', 2)
        result = { method: 'ToT', thoughts }
      }

      expect(result).toBeDefined()
    })

    it('应该在策略失败时提供降级方案', async () => {
      // Reflection 建议改进，但改进失败
      const reflection = new EnhancedReflection(mockLLM as any)
      mockLLM.chat.mockResolvedValue({
        message: {
          role: 'assistant' as const,
          content: '需要改进：缺少必要技术特征',
        },
        usage: { totalTokens: 50 },
      })

      const report = await reflection.reflect({ content: '权利要求书' }, context, '检查质量')

      // 即使有改进建议，也应该能生成报告
      expect(report).toBeDefined()
      expect(report.needsIteration).toBeDefined()
    })
  })

  describe('性能和效率', () => {
    it('应该合理使用 LLM 调用次数', async () => {
      let callCount = 0
      mockLLM.chat.mockImplementation(() => {
        callCount++
        return Promise.resolve({
          message: {
            role: 'assistant' as const,
            content: '步骤1：分析问题\n步骤2：解决问题\n结论：完成',
          },
          usage: { totalTokens: 50 },
        })
      })

      // 组合使用四个策略
      const cot = new ChainOfThoughtStrategy(mockLLM as any)
      await cot.reason('测试')

      const tot = new TreeOfThoughtsStrategy(mockLLM as any)
      await tot.generateThoughts('测试', 2)

      const reactLoop = new ReActLoop(mockLLM as any)
      for await (const iter of reactLoop.execute('测试')) {
        if (iter.done) break
      }

      const reflection = new EnhancedReflection(mockLLM as any)
      await reflection.reflect({ content: '测试' }, context)

      // 验证 LLM 调用次数合理
      expect(callCount).toBeGreaterThan(0)
      expect(callCount).toBeLessThan(20) // 不应该超过20次
    })
  })

  describe('专利场景 - 完整专利撰写流程', () => {
    it('应该模拟完整的专利撰写流程：技术理解→布局设计→检索验证→质量检查', async () => {
      const patentApplication = {
        invention: '一种量子加密通信方法',
        description: '基于量子纠缠的安全通信技术',
      }

      // 阶段1: 技术理解 (CoT)
      const cot = new ChainOfThoughtStrategy(mockLLM as any)
      mockLLM.chat.mockResolvedValue({
        message: {
          role: 'assistant' as const,
          content: `
步骤1：分析量子纠缠原理
步骤2：评估加密强度
步骤3：对比现有技术
结论：技术方案可行
          `,
        },
        usage: { totalTokens: 150 },
      })

      const techAnalysis = await cot.reason(`分析${patentApplication.invention}的技术可行性`)

      // 阶段2: 布局设计 (ToT)
      const tot = new TreeOfThoughtsStrategy(mockLLM as any)
      mockLLM.chat.mockResolvedValueOnce({
        message: {
          role: 'assistant' as const,
          content: `
1. 系统独权 + 方法从权
2. 装置独权 + 电路从权
3. 计算机可读介质独权
          `,
        },
        usage: { totalTokens: 50 },
      })

      const layouts = await tot.generateThoughts(
        `为${patentApplication.invention}设计权利要求布局`,
        3
      )

      // 阶段3: 检索验证 (ReAct)
      const reactLoop = new ReActLoop(mockLLM as any, { verbose: false })
      mockLLM.chat.mockResolvedValueOnce({
        message: {
          role: 'assistant' as const,
          content: '思考：检索完成\n状态：done',
        },
        usage: { totalTokens: 30 },
      })

      const searchResults: any[] = []
      for await (const iter of reactLoop.execute(`检索${patentApplication.invention}`)) {
        searchResults.push(iter)
        if (iter.done) break
      }

      // 阶段4: 质量检查 (Reflection)
      const reflection = new EnhancedReflection(mockLLM as any)
      mockLLM.chat.mockResolvedValue({
        message: {
          role: 'assistant' as const,
          content: '质量评估：优秀\n所有维度检查通过',
        },
        usage: { totalTokens: 80 },
      })

      const finalCheck = await reflection.reflect(
        {
          analysis: techAnalysis,
          layouts: layouts,
          search: searchResults,
        },
        context,
        '专利申请最终质量检查'
      )

      // 验证完整流程
      expect(techAnalysis.steps.length).toBeGreaterThan(0)
      expect(layouts.length).toBe(3)
      expect(searchResults.length).toBeGreaterThan(0)
      expect(finalCheck.overallScore).toBeGreaterThanOrEqual(0)
    })
  })
})
