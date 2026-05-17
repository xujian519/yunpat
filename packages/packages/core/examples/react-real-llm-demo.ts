#!/usr/bin/env tsx
/**
 * ReAct 循环 - 真实 LLM 和工具集成演示
 *
 * 运行方式：
 * 1. 设置环境变量：
 *    export DEEPSEEK_API_KEY=sk-xxx  # 或 DASHSCOPE_API_KEY
 * 2. 运行演示：
 *    pnpm --filter @yunpat/core exec tsx examples/react-real-llm-demo.ts
 */

import { createDeepSeekModel, NativeLLMAdapter } from '../src/llm/NativeLLMAdapter.js'
import { EnhancedToolRegistry } from '../src/tools/EnhancedToolRegistry.js'
import { EventBus } from '../src/eventbus/EventBus.js'
import { ToolCategory } from '../src/tools/types.js'
import type { ToolContext, EnhancedTool } from '../src/tools/types.js'
import type { MemoryStore, ToolRegistry, LLMAdapter } from '../src/lifecycle/Lifecycle.js'
import { z } from 'zod'

// ============== 工具定义 ==============

/**
 * 计算器工具
 */
const calculatorTool: EnhancedTool<
  { operation: string; a: number; b: number },
  { result: number; steps: string[] }
> = {
  metadata: {
    name: 'calculator',
    description: '执行基本数学运算（加减乘除）',
    inputSchema: z.object({
      operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
      a: z.number(),
      b: z.number(),
    }),
    outputSchema: z.object({
      result: z.number(),
      steps: z.array(z.string()),
    }),
    category: ToolCategory.UTILITY,
    isConcurrencySafe: true,
  },
  execute: async (input) => {
    const { operation, a, b } = input
    let result: number = 0
    const steps: string[] = []

    switch (operation) {
      case 'add':
        result = a + b
        steps.push(`${a} + ${b} = ${result}`)
        break
      case 'subtract':
        result = a - b
        steps.push(`${a} - ${b} = ${result}`)
        break
      case 'multiply':
        result = a * b
        steps.push(`${a} × ${b} = ${result}`)
        break
      case 'divide':
        if (b === 0) {
          throw new Error('除数不能为零')
        }
        result = a / b
        steps.push(`${a} ÷ ${b} = ${result}`)
        break
    }

    return { result, steps }
  },
}

/**
 * 文本处理工具
 */
const textProcessorTool: EnhancedTool<
  { text: string; operation: 'uppercase' | 'lowercase' | 'reverse' | 'wordcount' },
  { result: string; original: string; operation: string }
> = {
  metadata: {
    name: 'text_processor',
    description: '处理文本：大小写转换、反转、字数统计等',
    inputSchema: z.object({
      text: z.string(),
      operation: z.enum(['uppercase', 'lowercase', 'reverse', 'wordcount']),
    }),
    outputSchema: z.object({
      result: z.string(),
      original: z.string(),
      operation: z.string(),
    }),
    category: ToolCategory.UTILITY,
    isConcurrencySafe: true,
  },
  execute: async (input) => {
    const { text, operation } = input
    let result: string

    switch (operation) {
      case 'uppercase':
        result = text.toUpperCase()
        break
      case 'lowercase':
        result = text.toLowerCase()
        break
      case 'reverse':
        result = text.split('').reverse().join('')
        break
      case 'wordcount':
        const words = text
          .trim()
          .split(/\s+/)
          .filter((w) => w.length > 0)
        result = `${words.length} 个词`
        break
      default:
        result = text
    }

    return {
      result,
      original: text,
      operation,
    }
  },
}

/**
 * 搜索模拟工具
 */
const searchTool: EnhancedTool<
  { query: string; limit?: number },
  { results: Array<{ title: string; url: string; snippet: string }>; total: number }
> = {
  metadata: {
    name: 'search',
    description: '搜索信息并返回相关结果',
    inputSchema: z.object({
      query: z.string(),
      limit: z.number().optional().default(5),
    }),
    outputSchema: z.object({
      results: z.array(
        z.object({
          title: z.string(),
          url: z.string(),
          snippet: z.string(),
        })
      ),
      total: z.number(),
    }),
    category: ToolCategory.SEARCH,
    isConcurrencySafe: true,
  },
  execute: async (input) => {
    const { query, limit = 5 } = input

    // 模拟搜索结果
    const mockResults = [
      {
        title: `${query} - 官方文档`,
        url: `https://example.com/docs/${encodeURIComponent(query)}`,
        snippet: `关于 ${query} 的详细说明和示例...`,
      },
      {
        title: `${query} 教程`,
        url: `https://example.com/tutorials/${encodeURIComponent(query)}`,
        snippet: `学习如何使用 ${query}...`,
      },
      {
        title: `${query} 最佳实践`,
        url: `https://example.com/best-practices/${encodeURIComponent(query)}`,
        snippet: `${query} 的使用技巧和注意事项...`,
      },
    ]

    return {
      results: mockResults.slice(0, limit),
      total: mockResults.length,
    }
  },
}

// ============== 辅助函数 ==============

/**
 * 创建模拟的记忆存储
 */
function createMockMemoryStore(): MemoryStore {
  return {
    async get() {
      return undefined
    },
    async set() {
      return
    },
    async delete() {
      return
    },
    async clear() {
      return
    },
    async has() {
      return false
    },
    async getAll() {
      return {}
    },
    async search() {
      return []
    },
  }
}

// ============== 增强 ReAct 循环实现 ==============

class EnhancedReActLoop {
  private toolRegistry: EnhancedToolRegistry
  private llm: ReturnType<typeof createDeepSeekModel | typeof NativeLLMAdapter>

  constructor(
    llm: ReturnType<typeof createDeepSeekModel | typeof NativeLLMAdapter>,
    toolRegistry: EnhancedToolRegistry
  ) {
    this.llm = llm
    this.toolRegistry = toolRegistry
  }

  /**
   * 执行增强的 ReAct 循环
   */
  async *execute(goal: string, _context?: Record<string, unknown>) {
    let iteration = 0
    let done = false
    let observation: any = {
      content: `目标: ${goal}`,
      timestamp: new Date(),
    }

    console.log('\n' + '='.repeat(60))
    console.log(`🎯 任务目标: ${goal}`)
    console.log('='.repeat(60))

    while (!done && iteration < 10) {
      iteration++

      // 1. 思考（使用工具增强的提示词）
      const thought = await this.enhancedThink(observation, goal)

      console.log(`\n[迭代 ${iteration}]`)
      console.log('─'.repeat(60))
      console.log('🤔 思考:')
      console.log(`  ${thought.reasoning.substring(0, 200)}...`)
      console.log(`\n📊 状态: ${thought.state}`)

      // 检查是否完成
      if (thought.state === 'done') {
        console.log('\n✅ 任务完成！')
        yield {
          iteration,
          observation,
          thought,
          done: true,
        }
        break
      }

      // 2. 决定行动
      const action = this.decideAction(thought)

      console.log(`\n⚡ 行动: ${action.type}`)
      if (action.params) {
        console.log(`   参数: ${JSON.stringify(action.params)}`)
      }

      // 3. 执行行动（使用真实的工具调用）
      const actionResult = await this.executeAction(action)

      if (actionResult.success) {
        console.log('\n✅ 结果:')
        console.log(`  工具: ${actionResult.toolUsed}`)
        console.log(`  数据: ${JSON.stringify(actionResult.data)}`)
      } else {
        console.log('\n❌ 错误:')
        console.log(`  ${actionResult.error}`)
      }

      // 4. 更新观察
      observation = this.updateObservation(observation, actionResult)

      // 5. 反思
      const shouldContinue = await this.reflect(observation, thought, actionResult)
      if (!shouldContinue) {
        done = true
        console.log('\n✅ 任务完成！')
      }

      // 6. 产生迭代结果
      yield {
        iteration,
        observation,
        thought,
        action,
        actionResult,
        done,
      }
    }

    console.log('\n' + '='.repeat(60))
    console.log(`📊 总迭代次数: ${iteration}`)
    console.log('='.repeat(60) + '\n')
  }

  /**
   * 增强的思考（带工具列表）
   */
  private async enhancedThink(observation: any, goal: string): Promise<any> {
    const availableTools = this.toolRegistry.list().map((t: any) => ({
      name: t.name,
      description: t.description,
    }))

    const prompt = `你是一个智能助手，使用 ReAct 方法解决问题。

**目标**：${goal}

**当前情况**：
${observation.content}

**可用工具**：
${availableTools.map((t: any) => `- ${t.name}: ${t.description}`).join('\n')}

**思考过程**：
1. 分析当前情况
2. 确定下一步行动
3. 选择合适的工具（如果需要）

**返回格式**：
思考：[你的推理过程]
状态：[thinking/planning/acting/done]
下一步：[工具名称: 参数描述，如果状态为 done 则不返回]

示例：
思考：用户需要计算 15 + 27，应该使用计算器工具
状态：acting
下一步：calculator: {"operation": "add", "a": 15, "b": 27}`

    const response = await this.llm.chat({
      messages: [
        {
          role: 'system',
          content: '你是一个推理专家，擅长使用工具解决问题。',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
    })

    return this.parseThought(response.message.content)
  }

  /**
   * 决定行动
   */
  private decideAction(thought: any): any {
    if (!thought.nextAction) {
      return {
        type: 'complete',
        expectedOutcome: '任务完成',
      }
    }

    // 解析下一步行动
    const match = thought.nextAction.match(/^(\w+):\s*(.*)$/)
    if (match) {
      const toolName = match[1]
      const paramsStr = match[2]

      try {
        const params = JSON.parse(paramsStr)
        return {
          type: toolName,
          params,
        }
      } catch {
        return {
          type: toolName,
          params: { query: thought.nextAction },
        }
      }
    }

    return {
      type: thought.nextAction.includes('search') ? 'search' : 'tool',
      params: {
        query: thought.nextAction,
      },
    }
  }

  /**
   * 执行行动（使用真实的工具调用）
   */
  private async executeAction(action: any): Promise<any> {
    const { type, params } = action

    // 完成任务
    if (type === 'complete') {
      return {
        success: true,
        data: { message: '任务已完成' },
      }
    }

    // 从工具名称中提取工具类型
    let toolName = type.toLowerCase()

    // 映射常见的工具名称
    const toolNameMapping: Record<string, string> = {
      calculate: 'calculator',
      search: 'search',
      text: 'text_processor',
      process: 'text_processor',
    }

    toolName = toolNameMapping[toolName] || toolName

    // 构建工具上下文
    const context: ToolContext = {
      registry: this.toolRegistry as unknown as ToolRegistry,
      llm: this.llm as unknown as LLMAdapter,
      memory: createMockMemoryStore(),
      eventBus: new EventBus(),
    }

    try {
      // 调用工具
      const result = await this.toolRegistry.call(toolName, params || {}, context)

      return {
        success: true,
        data: result,
        toolUsed: toolName,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        toolUsed: toolName,
      }
    }
  }

  /**
   * 更新观察
   */
  private updateObservation(previous: any, actionResult: any): any {
    return {
      content: actionResult.error
        ? `错误: ${actionResult.error}`
        : `成功: ${JSON.stringify(actionResult.data)}`,
      data: {
        ...previous.data,
        lastActionResult: actionResult,
      },
      timestamp: new Date(),
      confidence: actionResult.success ? 1.0 : 0.0,
    }
  }

  /**
   * 反思
   */
  private async reflect(observation: any, thought: any, actionResult: any): Promise<boolean> {
    if (!actionResult.success) {
      return true
    }

    const prompt = `基于以下信息，判断任务是否完成：

观察：${observation.content}
思考：${thought.reasoning}
行动结果：${JSON.stringify(actionResult.data)}

返回 "继续" 或 "完成"。`

    const response = await this.llm.chat({
      messages: [
        {
          role: 'system',
          content: '你是一个任务评估专家。',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
    })

    const shouldContinue = response.message.content.includes('继续')
    return shouldContinue
  }

  /**
   * 解析思考结果
   */
  private parseThought(content: string): any {
    const thought: any = {
      reasoning: content,
      state: 'thinking',
    }

    if (content.includes('状态：done') || content.includes('完成')) {
      thought.state = 'done'
    } else if (content.includes('下一步：')) {
      const match = content.match(/下一步：(.+)/)
      if (match) {
        thought.nextAction = match[1].trim()
      }
      thought.state = 'acting'
    }

    return thought
  }
}

// ============== 主程序 ==============

async function main() {
  // 检查环境变量
  const apiKey = process.env.DEEPSEEK_API_KEY || process.env.DASHSCOPE_API_KEY

  if (!apiKey) {
    console.error('❌ 请设置环境变量：')
    console.error('   export DEEPSEEK_API_KEY=sk-xxx')
    console.error('   或')
    console.error('   export DASHSCOPE_API_KEY=sk-xxx')
    process.exit(1)
  }

  // 创建 LLM 适配器
  let llm: ReturnType<typeof createDeepSeekModel | typeof NativeLLMAdapter>
  let modelName: string

  if (process.env.DEEPSEEK_API_KEY) {
    console.log('✅ 使用 DeepSeek 模型\n')
    llm = createDeepSeekModel(apiKey)
    modelName = 'DeepSeek V4'
  } else {
    console.log('✅ 使用通义千问模型\n')
    llm = new NativeLLMAdapter({
      name: 'qwen-plus',
      apiKey,
      baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    })
    modelName = 'Qwen Plus'
  }

  // 创建工具注册表
  const eventBus = new EventBus()
  const toolRegistry = new EnhancedToolRegistry(eventBus)

  // 注册工具
  const tools = [calculatorTool, textProcessorTool, searchTool]
  toolRegistry.registerBatch(tools)

  console.log(`✅ 已注册 ${tools.length} 个工具:`)
  tools.forEach((t) => {
    console.log(`   - ${t.metadata.name}: ${t.metadata.description}`)
  })
  console.log('')

  // 创建增强的 ReAct 循环
  const reactLoop = new EnhancedReActLoop(llm, toolRegistry)

  // 示例任务
  const tasks = [
    '计算 123 + 456',
    '将文本 "hello world" 转换为大写',
    '计算 10 × 5，然后将结果字符串反转',
  ]

  for (const task of tasks) {
    console.log(`\n\n${'='.repeat(60)}`)
    console.log(`📋 执行任务: ${task}`)
    console.log(`🤖 模型: ${modelName}`)
    console.log(`${'='.repeat(60)}\n`)

    const iterations: any[] = []
    for await (const iteration of reactLoop.execute(task)) {
      iterations.push(iteration)
      if (iteration.done) break
    }

    console.log(`\n✅ 任务完成！共执行 ${iterations.length} 次迭代`)
  }

  console.log('\n\n🎉 所有任务完成！')
}

// 运行主程序
main().catch((error) => {
  console.error('❌ 错误:', error)
  process.exit(1)
})
