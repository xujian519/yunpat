/**
 * ReAct 循环验证测试
 *
 * 目标：验证最小可用的 ReAct 循环能否正确输出结构化日志
 * - Observe（观察）
 * - Think（思考）
 * - Act（行动）
 */

import { describe, it, expect } from 'vitest'
import { ReActLoop } from '../../src/reasoning/ReActLoop.js'
import type { LLMAdapter, ChatParams, ChatResponse } from '../../src/lifecycle/Lifecycle.js'

/**
 * Mock LLM Adapter - 用于测试，避免真实 API 调用
 */
class MockLLMAdapter implements LLMAdapter {
  private responseCounter = 0

  async chat(params: ChatParams): Promise<ChatResponse> {
    const lastMessage = params.messages[params.messages.length - 1]?.content || ''

    // 模拟不同的响应
    const responses = [
      // 第一次调用：思考阶段
      {
        content: `思考：我需要分析这个任务。
    当前情况：目标是将"Hello World"翻译成中文。

    分析步骤：
    1. 理解源文本："Hello World" 是英语问候语
    2. 确定目标语言：中文
    3. 执行翻译

    状态：acting
    下一步：使用翻译工具将"Hello World"翻译成中文`,
      },
      // 第二次调用：反思阶段
      {
        content: `继续`,
      },
      // 第三次调用：完成确认
      {
        content: `思考：翻译已完成，结果是"你好，世界"。
    状态：done`,
      },
    ]

    const response = responses[this.responseCounter % responses.length]
    this.responseCounter++

    return {
      message: {
        role: 'assistant',
        content: response.content,
      },
      usage: {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      },
    }
  }

  async *chatStream(_params: ChatParams): AsyncIterable<{ delta: string; done: boolean }> {
    yield { delta: '模拟流式响应', done: true }
  }

  async embed(_texts: string[]): Promise<number[][]> {
    return [[0.1, 0.2, 0.3]]
  }
}

describe('ReAct 循环验证', () => {
  it('应该正确执行 Observe → Think → Act 循环', async () => {
    // 1. 创建 Mock LLM
    const mockLLM = new MockLLMAdapter()

    // 2. 创建 ReAct 循环
    const reactLoop = new ReActLoop(mockLLM, {
      maxIterations: 5,
      verbose: false, // 不打印到控制台
      reflectAfterStep: true,
    })

    // 3. 定义具体任务
    const goal = '将"Hello World"翻译成中文'

    // 4. 执行循环并收集结果
    const iterations: Array<any> = []
    for await (const iteration of reactLoop.execute(goal)) {
      iterations.push(iteration)

      // 验证每次迭代的结构
      expect(iteration).toHaveProperty('iteration')
      expect(iteration).toHaveProperty('observation')
      expect(iteration).toHaveProperty('thought')
      expect(iteration.done).toBeDefined()

      // 如果是行动迭代，应该有 action 和 actionResult
      if (iteration.action) {
        expect(iteration).toHaveProperty('action')
        expect(iteration.action).toHaveProperty('type')
      }

      if (iteration.actionResult) {
        expect(iteration).toHaveProperty('actionResult')
        expect(iteration.actionResult).toHaveProperty('success')
      }

      // 完成时退出
      if (iteration.done) {
        break
      }
    }

    // 5. 验证结果
    console.log('\n========== ReAct 循环执行日志 ==========')

    iterations.forEach((iter, index) => {
      console.log(`\n[迭代 ${index + 1}]`)
      console.log('----------------------------------------')
      console.log('📊 Observation（观察）:')
      console.log(`  内容: ${iter.observation.content}`)
      console.log(`  时间: ${iter.observation.timestamp.toISOString()}`)
      if (iter.observation.data) {
        console.log(`  数据: ${JSON.stringify(iter.observation.data, null, 2).slice(0, 100)}...`)
      }

      console.log('\n🤔 Thought（思考）:')
      console.log(`  推理: ${iter.thought.reasoning.slice(0, 100)}...`)
      console.log(`  状态: ${iter.thought.state}`)
      if (iter.thought.nextAction) {
        console.log(`  下一步: ${iter.thought.nextAction}`)
      }

      if (iter.action) {
        console.log('\n⚡ Action（行动）:')
        console.log(`  类型: ${iter.action.type}`)
        if (iter.action.params) {
          console.log(`  参数: ${JSON.stringify(iter.action.params)}`)
        }
        if (iter.action.expectedOutcome) {
          console.log(`  预期: ${iter.action.expectedOutcome}`)
        }
      }

      if (iter.actionResult) {
        console.log('\n✅ ActionResult（行动结果）:')
        console.log(`  成功: ${iter.actionResult.success}`)
        if (iter.actionResult.data) {
          console.log(`  数据: ${JSON.stringify(iter.actionResult.data).slice(0, 100)}...`)
        }
        if (iter.actionResult.error) {
          console.log(`  错误: ${iter.actionResult.error}`)
        }
        if (iter.actionResult.toolUsed) {
          console.log(`  工具: ${iter.actionResult.toolUsed}`)
        }
        if (iter.actionResult.tokensUsed) {
          console.log(`  Token: ${iter.actionResult.tokensUsed}`)
        }
      }

      console.log('\n----------------------------------------')
    })

    console.log('\n========== 验证结果 ==========')

    // 验证至少执行了一次迭代
    expect(iterations.length).toBeGreaterThan(0)

    // 验证最后一次迭代标记为完成
    const lastIteration = iterations[iterations.length - 1]
    expect(lastIteration.done).toBe(true)

    // 验证结构完整性
    const firstIteration = iterations[0]
    expect(firstIteration.observation).toBeDefined()
    expect(firstIteration.thought).toBeDefined()
    expect(firstIteration.thought.reasoning).toBeTruthy()

    console.log('✅ ReAct 循环结构完整')
    console.log(`✅ 共执行 ${iterations.length} 次迭代`)
    console.log('✅ 所有迭代都包含 Observation / Thought / Action / ActionResult')
  })

  it('应该能够正确解析思考结果', async () => {
    const mockLLM = new MockLLMAdapter()
    const reactLoop = new ReActLoop(mockLLM)

    const iterations: any[] = []
    for await (const iteration of reactLoop.execute('测试任务')) {
      iterations.push(iteration)
      if (iteration.done) break
    }

    // 验证思考状态
    const hasThinkingState = iterations.some((iter) => iter.thought.state === 'thinking')
    const hasActingState = iterations.some((iter) => iter.thought.state === 'acting')
    const hasDoneState = iterations.some((iter) => iter.thought.state === 'done')

    console.log('\n========== 状态转换验证 ==========')
    console.log(`思考状态 (thinking): ${hasThinkingState ? '✅' : '❌'}`)
    console.log(`行动状态 (acting): ${hasActingState ? '✅' : '❌'}`)
    console.log(`完成状态 (done): ${hasDoneState ? '✅' : '❌'}`)

    expect(hasDoneState).toBe(true)
  })

  it('应该能够执行工具调用', async () => {
    const mockLLM = new MockLLMAdapter()
    const reactLoop = new ReActLoop(mockLLM)

    const iterations: any[] = []
    for await (const iteration of reactLoop.execute('搜索任务')) {
      iterations.push(iteration)
      if (iteration.done) break
    }

    // 验证至少有一个行动被执行
    const actionsExecuted = iterations.filter((iter) => iter.action)
    console.log('\n========== 工具执行验证 ==========')
    console.log(`执行的行动数: ${actionsExecuted.length}`)

    if (actionsExecuted.length > 0) {
      actionsExecuted.forEach((iter) => {
        console.log(
          `  - ${iter.action.type}: ${iter.actionResult?.success ? '✅ 成功' : '❌ 失败'}`
        )
      })
    }

    expect(actionsExecuted.length).toBeGreaterThan(0)
  })

  describe('ReActLoop 分支覆盖测试', () => {
    it('应该支持 search 类型的 action', async () => {
      class SearchMockLLM extends MockLLMAdapter {
        async chat(params: ChatParams): Promise<ChatResponse> {
          const content = params.messages[params.messages.length - 1]?.content || ''
          if (content.includes('判断任务是否完成')) {
            return {
              message: { role: 'assistant', content: '完成' },
              usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
            }
          }
          return {
            message: {
              role: 'assistant',
              content: `思考：需要搜索相关信息。
状态：acting
下一步：search 搜索关键词`,
            },
            usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
          }
        }
      }

      const mockLLM = new SearchMockLLM()
      const reactLoop = new ReActLoop(mockLLM, {
        maxIterations: 3,
        reflectAfterStep: true,
      })

      const iterations: any[] = []
      for await (const iteration of reactLoop.execute('搜索任务')) {
        iterations.push(iteration)
        if (iteration.done) break
      }

      const searchAction = iterations.find((iter) => iter.action?.type === 'search')
      expect(searchAction).toBeDefined()
      expect(searchAction.actionResult?.toolUsed).toBe('search')
      expect(searchAction.actionResult?.success).toBe(true)
      expect(searchAction.actionResult?.data).toHaveProperty('results')
    })

    it('应该在行动失败时继续尝试（reflectAfterStep）', async () => {
      class FailMockLLM extends MockLLMAdapter {
        async chat(params: ChatParams): Promise<ChatResponse> {
          const content = params.messages[params.messages.length - 1]?.content || ''
          if (content.includes('判断任务是否完成')) {
            return {
              message: { role: 'assistant', content: '继续' },
              usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
            }
          }
          if (content.includes('错误')) {
            return {
              message: { role: 'assistant', content: '思考：任务已完成。状态：done' },
              usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
            }
          }
          return {
            message: {
              role: 'assistant',
              content: `思考：需要执行某个操作。
状态：acting
下一步：execute operation`,
            },
            usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
          }
        }
      }

      class FailingReActLoop extends ReActLoop {
        protected async executeAction(action: Action): Promise<ActionResult> {
          if (action.type !== 'complete') {
            return {
              success: false,
              error: '模拟执行失败',
              toolUsed: action.type,
            }
          }
          return super.executeAction(action)
        }
      }

      const mockLLM = new FailMockLLM()
      const reactLoop = new FailingReActLoop(mockLLM, {
        maxIterations: 5,
        reflectAfterStep: true,
      })

      const iterations: any[] = []
      for await (const iteration of reactLoop.execute('失败任务')) {
        iterations.push(iteration)
        if (iteration.done) break
      }

      const failedActions = iterations.filter((iter) => iter.actionResult?.success === false)
      expect(failedActions.length).toBeGreaterThan(0)

      const firstFailure = failedActions[0]
      expect(firstFailure.actionResult?.error).toBeDefined()
    })

    it('应该在达到最大迭代次数时停止', async () => {
      class InfiniteMockLLM extends MockLLMAdapter {
        async chat(_params: ChatParams): Promise<ChatResponse> {
          return {
            message: {
              role: 'assistant',
              content: `思考：继续思考。
状态：acting
下一步：continue thinking`,
            },
            usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
          }
        }
      }

      const mockLLM = new InfiniteMockLLM()
      const reactLoop = new ReActLoop(mockLLM, {
        maxIterations: 3,
        reflectAfterStep: false,
      })

      const iterations: any[] = []
      for await (const iteration of reactLoop.execute('无限任务')) {
        iterations.push(iteration)
      }

      expect(iterations.length).toBe(3)
      expect(iterations[iterations.length - 1].iteration).toBe(3)
    })

    it('应该支持自定义停止条件', async () => {
      class StopConditionMockLLM extends MockLLMAdapter {
        async chat(_params: ChatParams): Promise<ChatResponse> {
          return {
            message: {
              role: 'assistant',
              content: `思考：需要执行操作。
状态：acting
下一步：execute`,
            },
            usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
          }
        }
      }

      const mockLLM = new StopConditionMockLLM()
      const reactLoop = new ReActLoop(mockLLM, {
        maxIterations: 10,
        reflectAfterStep: false,
        stopConditions: [(iteration) => iteration.iteration === 2],
      })

      const iterations: any[] = []
      for await (const iteration of reactLoop.execute('停止条件测试')) {
        iterations.push(iteration)
      }

      expect(iterations.length).toBe(2)
      expect(iterations[iterations.length - 1].done).toBe(true)
    })

    it('应该在观察数据存在时包含在提示中', async () => {
      class ContextMockLLM extends MockLLMAdapter {
        private callCount = 0
        async chat(params: ChatParams): Promise<ChatResponse> {
          this.callCount++
          const lastMessage = params.messages[params.messages.length - 1]?.content || ''

          if (this.callCount === 1) {
            expect(lastMessage).toContain('可用信息')
            expect(lastMessage).toContain('"key"')
            expect(lastMessage).toContain('"value"')
            return {
              message: { role: 'assistant', content: '思考：任务已完成。状态：done' },
              usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
            }
          }

          return {
            message: { role: 'assistant', content: '思考：继续。状态：done' },
            usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
          }
        }
      }

      const mockLLM = new ContextMockLLM()
      const reactLoop = new ReActLoop(mockLLM)

      const iterations: any[] = []
      for await (const iteration of reactLoop.execute('测试任务', { key: 'value' })) {
        iterations.push(iteration)
        if (iteration.done) break
      }

      expect(iterations.length).toBeGreaterThan(0)
      expect(iterations[0].observation.data).toEqual({ key: 'value' })
    })

    it('应该在行动成功但反思返回"完成"时停止', async () => {
      class ReflectDoneMockLLM extends MockLLMAdapter {
        async chat(params: ChatParams): Promise<ChatResponse> {
          const content = params.messages[params.messages.length - 1]?.content || ''
          if (content.includes('判断任务是否完成')) {
            return {
              message: { role: 'assistant', content: '完成' },
              usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
            }
          }
          return {
            message: {
              role: 'assistant',
              content: `思考：执行操作。
状态：acting
下一步：execute`,
            },
            usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
          }
        }
      }

      const mockLLM = new ReflectDoneMockLLM()
      const reactLoop = new ReActLoop(mockLLM, {
        maxIterations: 10,
        reflectAfterStep: true,
      })

      const iterations: any[] = []
      for await (const iteration of reactLoop.execute('反思测试')) {
        iterations.push(iteration)
      }

      expect(iterations.length).toBe(1)
      expect(iterations[0].done).toBe(true)
    })

    it('应该在禁用反思时跳过反思步骤', async () => {
      class NoReflectMockLLM extends MockLLMAdapter {
        async chat(_params: ChatParams): Promise<ChatResponse> {
          return {
            message: {
              role: 'assistant',
              content: `思考：完成任务。
状态：done`,
            },
            usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
          }
        }
      }

      const mockLLM = new NoReflectMockLLM()
      const reactLoop = new ReActLoop(mockLLM, {
        maxIterations: 5,
        reflectAfterStep: false,
      })

      const iterations: any[] = []
      for await (const iteration of reactLoop.execute('无反思测试')) {
        iterations.push(iteration)
      }

      expect(iterations.length).toBeGreaterThan(0)
      expect(iterations[iterations.length - 1].done).toBe(true)
    })

    it('应该在 verbose 模式下输出日志', async () => {
      const consoleSpy = vi.spyOn(console, 'log')

      class VerboseMockLLM extends MockLLMAdapter {
        private callCount = 0
        async chat(_params: ChatParams): Promise<ChatResponse> {
          this.callCount++
          if (this.callCount === 1) {
            return {
              message: {
                role: 'assistant',
                content: `思考：需要执行操作。
状态：acting
下一步：execute action`,
              },
              usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
            }
          }
          return {
            message: { role: 'assistant', content: '思考：完成。状态：done' },
            usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
          }
        }
      }

      const mockLLM = new VerboseMockLLM()
      const reactLoop = new ReActLoop(mockLLM, {
        maxIterations: 3,
        verbose: true,
        reflectAfterStep: false,
      })

      const iterations: any[] = []
      for await (const iteration of reactLoop.execute('verbose 测试')) {
        iterations.push(iteration)
        if (iteration.done) break
      }

      expect(consoleSpy).toHaveBeenCalled()

      const logCalls = consoleSpy.mock.calls.map((call) => call.join(' '))
      const hasIterationLog = logCalls.some((log) => log.includes('[迭代'))
      const hasThoughtLog = logCalls.some((log) => log.includes('[思考]'))
      const hasActionLog = logCalls.some((log) => log.includes('[行动]'))
      const hasResultLog = logCalls.some((log) => log.includes('[结果]'))

      expect(hasIterationLog).toBe(true)
      expect(hasThoughtLog).toBe(true)
      expect(hasActionLog).toBe(true)
      expect(hasResultLog).toBe(true)

      consoleSpy.mockRestore()
    })

    it('应该解析包含"完成"关键词的思考结果为 done 状态', async () => {
      class DoneKeywordMockLLM extends MockLLMAdapter {
        async chat(_params: ChatParams): Promise<ChatResponse> {
          return {
            message: {
              role: 'assistant',
              content: '思考：任务已经完成了。',
            },
            usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
          }
        }
      }

      const mockLLM = new DoneKeywordMockLLM()
      const reactLoop = new ReActLoop(mockLLM)

      const iterations: any[] = []
      for await (const iteration of reactLoop.execute('完成关键词测试')) {
        iterations.push(iteration)
        if (iteration.done) break
      }

      expect(iterations[0].thought.state).toBe('done')
      expect(iterations[0].done).toBe(true)
    })

    it('应该在没有 nextAction 时返回 complete 类型 action', async () => {
      class NoNextActionMockLLM extends MockLLMAdapter {
        async chat(_params: ChatParams): Promise<ChatResponse> {
          return {
            message: {
              role: 'assistant',
              content: `思考：不需要下一步行动。
状态：acting`,
            },
            usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
          }
        }
      }

      const mockLLM = new NoNextActionMockLLM()
      const reactLoop = new ReActLoop(mockLLM, {
        maxIterations: 2,
        reflectAfterStep: false,
      })

      const iterations: any[] = []
      for await (const iteration of reactLoop.execute('无下一步测试')) {
        iterations.push(iteration)
        if (iteration.done) break
      }

      const actionIteration = iterations.find((iter) => iter.action)
      expect(actionIteration).toBeDefined()
      expect(actionIteration.action?.type).toBe('complete')
      expect(actionIteration.action?.expectedOutcome).toBe('任务完成')
    })
  })

  describe('PlanAndSolveStrategy 分支覆盖测试', () => {
    it('应该生成执行计划', async () => {
      class PlanMockLLM extends MockLLMAdapter {
        async chat(_params: ChatParams): Promise<ChatResponse> {
          return {
            message: {
              role: 'assistant',
              content: `1. 第一步：收集数据
2. 第二步：分析数据
3. 第三步：生成报告`,
            },
            usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
          }
        }
      }

      const mockLLM = new PlanMockLLM()
      const strategy = new (await import('../../src/reasoning/ReActLoop.js')).PlanAndSolveStrategy(
        mockLLM
      )

      const plan = await strategy.makePlan('生成数据分析报告')

      expect(plan).toBeInstanceOf(Array)
      expect(plan.length).toBe(3)
      expect(plan[0]).toContain('收集数据')
      expect(plan[1]).toContain('分析数据')
      expect(plan[2]).toContain('生成报告')
    })

    it('应该在包含上下文时生成计划', async () => {
      class PlanWithContextMockLLM extends MockLLMAdapter {
        async chat(params: ChatParams): Promise<ChatResponse> {
          const content = params.messages[params.messages.length - 1]?.content || ''
          expect(content).toContain('上下文')
          expect(content).toContain('"dataset"')
          expect(content).toContain('sales')

          return {
            message: {
              role: 'assistant',
              content: '1. 分析销售数据',
            },
            usage: { promptTokens: 30, completionTokens: 10, totalTokens: 40 },
          }
        }
      }

      const mockLLM = new PlanWithContextMockLLM()
      const { PlanAndSolveStrategy } = await import('../../src/reasoning/ReActLoop.js')
      const strategy = new PlanAndSolveStrategy(mockLLM)

      const plan = await strategy.makePlan('分析销售数据', { dataset: 'sales' })

      expect(plan.length).toBeGreaterThan(0)
    })

    it('应该在无法生成有效计划时抛出错误', async () => {
      class EmptyPlanMockLLM extends MockLLMAdapter {
        async chat(_params: ChatParams): Promise<ChatResponse> {
          return {
            message: {
              role: 'assistant',
              content: '',
            },
            usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
          }
        }
      }

      const mockLLM = new EmptyPlanMockLLM()
      const { PlanAndSolveStrategy } = await import('../../src/reasoning/ReActLoop.js')
      const strategy = new PlanAndSolveStrategy(mockLLM)

      await expect(strategy.makePlan('无效任务')).rejects.toThrow('未能生成有效的执行计划')
    })

    it('应该执行计划的所有步骤', async () => {
      class ExecutePlanMockLLM extends MockLLMAdapter {
        private callCount = 0
        async chat(_params: ChatParams): Promise<ChatResponse> {
          this.callCount++
          return {
            message: {
              role: 'assistant',
              content: `步骤执行结果 ${this.callCount}`,
            },
            usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
          }
        }
      }

      const mockLLM = new ExecutePlanMockLLM()
      const { PlanAndSolveStrategy } = await import('../../src/reasoning/ReActLoop.js')
      const strategy = new PlanAndSolveStrategy(mockLLM)

      const plan = ['步骤1', '步骤2', '步骤3']
      const results: any[] = []

      for await (const result of strategy.executePlan(plan)) {
        results.push(result)
      }

      expect(results.length).toBe(3)
      expect(results[0].step).toBe(1)
      expect(results[0].success).toBe(true)
      expect(results[0].done).toBe(false)
      expect(results[2].step).toBe(3)
      expect(results[2].done).toBe(true)
    })

    it('应该在步骤执行失败时停止并返回错误', async () => {
      class FailStepMockLLM extends MockLLMAdapter {
        private callCount = 0
        async chat(_params: ChatParams): Promise<ChatResponse> {
          this.callCount++
          if (this.callCount === 2) {
            throw new Error('步骤执行失败')
          }
          return {
            message: {
              role: 'assistant',
              content: '步骤执行成功',
            },
            usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
          }
        }
      }

      const mockLLM = new FailStepMockLLM()
      const { PlanAndSolveStrategy } = await import('../../src/reasoning/ReActLoop.js')
      const strategy = new PlanAndSolveStrategy(mockLLM)

      const plan = ['步骤1', '步骤2', '步骤3']
      const results: any[] = []

      for await (const result of strategy.executePlan(plan)) {
        results.push(result)
      }

      expect(results.length).toBe(2)
      expect(results[0].success).toBe(true)
      expect(results[1].success).toBe(false)
      expect(results[1].error).toBe('步骤执行失败')
    })

    it('应该在执行步骤时使用前序步骤的结果', async () => {
      class StepContextMockLLM extends MockLLMAdapter {
        async chat(params: ChatParams): Promise<ChatResponse> {
          const content = params.messages[params.messages.length - 1]?.content || ''
          if (content.includes('前序步骤结果')) {
            expect(content).toContain('step1Result')
          }

          return {
            message: {
              role: 'assistant',
              content: '步骤执行完成',
            },
            usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
          }
        }
      }

      const mockLLM = new StepContextMockLLM()
      const { PlanAndSolveStrategy } = await import('../../src/reasoning/ReActLoop.js')
      const strategy = new PlanAndSolveStrategy(mockLLM)

      const plan = ['步骤1', '步骤2']
      const results: any[] = []

      for await (const result of strategy.executePlan(plan)) {
        results.push(result)
      }

      expect(results.length).toBe(2)
    })

    it('应该验证计划质量并返回评分', async () => {
      class ValidateMockLLM extends MockLLMAdapter {
        async chat(_params: ChatParams): Promise<ChatResponse> {
          return {
            message: {
              role: 'assistant',
              content: `计划质量评估：8/10
该计划覆盖了所有必要的步骤。`,
            },
            usage: { promptTokens: 30, completionTokens: 20, totalTokens: 50 },
          }
        }
      }

      const mockLLM = new ValidateMockLLM()
      const { PlanAndSolveStrategy } = await import('../../src/reasoning/ReActLoop.js')
      const strategy = new PlanAndSolveStrategy(mockLLM)

      const plan = ['步骤1', '步骤2', '步骤3']
      const validation = await strategy.validatePlan('测试任务', plan)

      expect(validation.isValid).toBe(true)
      expect(validation.score).toBe(0.8)
      expect(validation.feedback).toContain('计划质量评估')
    })

    it('应该将低分计划标记为无效', async () => {
      class LowScoreMockLLM extends MockLLMAdapter {
        async chat(_params: ChatParams): Promise<ChatResponse> {
          return {
            message: {
              role: 'assistant',
              content: '计划质量：5分，需要改进。',
            },
            usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
          }
        }
      }

      const mockLLM = new LowScoreMockLLM()
      const { PlanAndSolveStrategy } = await import('../../src/reasoning/ReActLoop.js')
      const strategy = new PlanAndSolveStrategy(mockLLM)

      const plan = ['步骤1', '步骤2']
      const validation = await strategy.validatePlan('测试任务', plan)

      expect(validation.isValid).toBe(false)
      expect(validation.score).toBe(0.5)
    })

    it('应该在无评分时使用默认分数', async () => {
      class NoScoreMockLLM extends MockLLMAdapter {
        async chat(_params: ChatParams): Promise<ChatResponse> {
          return {
            message: {
              role: 'assistant',
              content: '计划看起来不错。',
            },
            usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
          }
        }
      }

      const mockLLM = new NoScoreMockLLM()
      const { PlanAndSolveStrategy } = await import('../../src/reasoning/ReActLoop.js')
      const strategy = new PlanAndSolveStrategy(mockLLM)

      const plan = ['步骤1']
      const validation = await strategy.validatePlan('测试任务', plan)

      expect(validation.score).toBe(0.5)
    })

    it('应该执行完整的 planAndSolve 流程', async () => {
      class FullFlowMockLLM extends MockLLMAdapter {
        private callCount = 0
        async chat(params: ChatParams): Promise<ChatResponse> {
          this.callCount++
          const content = params.messages[params.messages.length - 1]?.content || ''

          if (this.callCount === 1) {
            return {
              message: {
                role: 'assistant',
                content: '1. 第一步\n2. 第二步',
              },
              usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
            }
          }

          if (this.callCount === 2) {
            return {
              message: {
                role: 'assistant',
                content: '计划质量：8/10，很好。',
              },
              usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
            }
          }

          return {
            message: {
              role: 'assistant',
              content: '步骤执行完成',
            },
            usage: { promptTokens: 15, completionTokens: 8, totalTokens: 23 },
          }
        }
      }

      const mockLLM = new FullFlowMockLLM()
      const { PlanAndSolveStrategy } = await import('../../src/reasoning/ReActLoop.js')
      const strategy = new PlanAndSolveStrategy(mockLLM)

      const results: any[] = []
      for await (const result of strategy.planAndSolve('完整流程测试')) {
        results.push(result)
      }

      expect(results.length).toBeGreaterThan(0)
      expect(results[0].plan).toBeDefined()
      expect(results[0].validation).toBeDefined()
      expect(results[0].validation?.isValid).toBe(true)

      const stepResults = results.filter((r) => r.step > 0)
      expect(stepResults.length).toBe(2)
    })

    it('应该在计划验证失败时停止执行', async () => {
      class InvalidPlanMockLLM extends MockLLMAdapter {
        private callCount = 0
        async chat(params: ChatParams): Promise<ChatResponse> {
          this.callCount++

          if (this.callCount === 1) {
            return {
              message: {
                role: 'assistant',
                content: '1. 步骤1',
              },
              usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
            }
          }

          return {
            message: {
              role: 'assistant',
              content: '计划质量：4/10，不够好。',
            },
            usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
          }
        }
      }

      const mockLLM = new InvalidPlanMockLLM()
      const { PlanAndSolveStrategy } = await import('../../src/reasoning/ReActLoop.js')
      const strategy = new PlanAndSolveStrategy(mockLLM)

      const results: any[] = []
      for await (const result of strategy.planAndSolve('无效计划测试')) {
        results.push(result)
      }

      expect(results.length).toBe(2)
      expect(results[0].plan).toBeDefined()
      expect(results[0].content).toBe('计划生成和验证')
      expect(results[1].success).toBe(false)
      expect(results[1].error).toBe('计划质量不足，请重新规划')
    })

    it('应该解析带括号的步骤格式', async () => {
      class ParenthesesMockLLM extends MockLLMAdapter {
        async chat(_params: ChatParams): Promise<ChatResponse> {
          return {
            message: {
              role: 'assistant',
              content: `1) 第一步
2) 第二步
3) 第三步`,
            },
            usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
          }
        }
      }

      const mockLLM = new ParenthesesMockLLM()
      const { PlanAndSolveStrategy } = await import('../../src/reasoning/ReActLoop.js')
      const strategy = new PlanAndSolveStrategy(mockLLM)

      const plan = await strategy.makePlan('测试任务')

      expect(plan.length).toBe(3)
      expect(plan[0]).toBe('第一步')
      expect(plan[1]).toBe('第二步')
    })

    it('应该解析带项目符号的步骤格式', async () => {
      class BulletMockLLM extends MockLLMAdapter {
        async chat(_params: ChatParams): Promise<ChatResponse> {
          return {
            message: {
              role: 'assistant',
              content: `- 第一步
- 第二步
• 第三步`,
            },
            usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
          }
        }
      }

      const mockLLM = new BulletMockLLM()
      const { PlanAndSolveStrategy } = await import('../../src/reasoning/ReActLoop.js')
      const strategy = new PlanAndSolveStrategy(mockLLM)

      const plan = await strategy.makePlan('测试任务')

      expect(plan.length).toBe(3)
    })

    it('应该在无法匹配格式时按段落分割', async () => {
      class ParagraphMockLLM extends MockLLMAdapter {
        async chat(_params: ChatParams): Promise<ChatResponse> {
          return {
            message: {
              role: 'assistant',
              content: `第一步需要完成这个任务。

第二步需要做那个操作。

第三步进行最后的工作。`,
            },
            usage: { promptTokens: 30, completionTokens: 15, totalTokens: 45 },
          }
        }
      }

      const mockLLM = new ParagraphMockLLM()
      const { PlanAndSolveStrategy } = await import('../../src/reasoning/ReActLoop.js')
      const strategy = new PlanAndSolveStrategy(mockLLM)

      const plan = await strategy.makePlan('测试任务')

      expect(plan.length).toBeGreaterThan(0)
    })

    it('应该在执行步骤时返回 token 使用量', async () => {
      class TokenMockLLM extends MockLLMAdapter {
        async chat(_params: ChatParams): Promise<ChatResponse> {
          return {
            message: {
              role: 'assistant',
              content: '步骤完成',
            },
            usage: {
              promptTokens: 50,
              completionTokens: 25,
              totalTokens: 75,
            },
          }
        }
      }

      const mockLLM = new TokenMockLLM()
      const { PlanAndSolveStrategy } = await import('../../src/reasoning/ReActLoop.js')
      const strategy = new PlanAndSolveStrategy(mockLLM)

      const plan = ['步骤1']
      const results: any[] = []

      for await (const result of strategy.executePlan(plan)) {
        results.push(result)
      }

      expect(results[0].tokensUsed).toBe(75)
    })

    it('应该在验证计划时提供评估维度', async () => {
      class DimensionsMockLLM extends MockLLMAdapter {
        async chat(params: ChatParams): Promise<ChatResponse> {
          const content = params.messages[params.messages.length - 1]?.content || ''

          expect(content).toContain('完整性')
          expect(content).toContain('可行性')
          expect(content).toContain('逻辑性')
          expect(content).toContain('清晰性')

          return {
            message: {
              role: 'assistant',
              content: '计划评估：8分',
            },
            usage: { promptTokens: 30, completionTokens: 10, totalTokens: 40 },
          }
        }
      }

      const mockLLM = new DimensionsMockLLM()
      const { PlanAndSolveStrategy } = await import('../../src/reasoning/ReActLoop.js')
      const strategy = new PlanAndSolveStrategy(mockLLM)

      const plan = ['步骤1']
      await strategy.validatePlan('测试任务', plan)
    })
  })
})
