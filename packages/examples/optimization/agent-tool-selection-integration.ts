/**
 * 智能体集成工具选择优化器示例
 *
 * 展示如何在Agent中使用ToolSelectionOptimizer提升工具选择准确性
 */

import { Agent } from '@yunpat/core'
import { ToolSelectionOptimizer, toolSelectionOptimizer } from '@yunpat/core'
import { EnhancedTool } from '@yunpat/core'

/**
 * 示例1: 基础集成 - 在Agent中使用优化器
 */
export class DocumentProcessorAgent extends Agent {
  private toolOptimizer: ToolSelectionOptimizer

  constructor(config: any) {
    super(config)
    this.toolOptimizer = toolSelectionOptimizer
  }

  /**
   * 规划阶段：使用优化器生成工具选择提示
   */
  protected async plan(input: any, context: any): Promise<any> {
    const { userInput } = input

    // 1. 获取可用工具
    const availableTools = Array.from(context.tools.entries()).map(([name, tool]) => ({
      metadata: tool.metadata,
      execute: tool.execute.bind(tool),
    }))

    // 2. 使用优化器生成工具选择提示
    const optimizedPrompt = this.toolOptimizer.optimizeToolSelectionPrompt(
      userInput,
      availableTools,
      {
        conversationHistory: context.conversationHistory,
        currentTask: context.currentTask,
      }
    )

    // 3. 将优化后的提示发送给LLM进行决策
    const llmResponse = await context.llm.chat([
      {
        role: 'system',
        content: '你是一个专业的工具选择专家，请根据用户需求选择最合适的工具。',
      },
      {
        role: 'user',
        content: optimizedPrompt,
      },
    ])

    // 4. 解析LLM响应，获取工具选择结果
    const toolSelection = this.parseToolSelection(llmResponse.content)

    return {
      selectedTool: toolSelection.toolName,
      parameters: toolSelection.parameters,
      reasoning: toolSelection.reasoning,
    }
  }

  /**
   * 执行阶段：调用工具并记录使用情况
   */
  protected async act(plan: any, context: any): Promise<any> {
    const { selectedTool, parameters, reasoning } = plan

    // 1. 执行工具
    const tool = context.tools.get(selectedTool)
    const startTime = Date.now()

    try {
      const result = await tool.execute(parameters)

      // 2. 记录成功的工具使用
      this.toolOptimizer.recordToolUsage(
        selectedTool,
        context.userInput,
        parameters,
        {
          success: true,
          executionTime: Date.now() - startTime,
          output: result,
        },
        {
          sessionId: context.sessionId,
          userId: context.userId,
          conversationHistory: context.conversationHistory,
        }
      )

      return {
        success: true,
        result,
        tool: selectedTool,
        reasoning,
      }
    } catch (error) {
      // 3. 记录失败的工具使用
      this.toolOptimizer.recordToolUsage(
        selectedTool,
        context.userInput,
        parameters,
        {
          success: false,
          executionTime: Date.now() - startTime,
          error: error.message,
        },
        {
          sessionId: context.sessionId,
          userId: context.userId,
        }
      )

      throw error
    }
  }

  /**
   * 反思阶段：分析工具选择准确性
   */
  protected async reflect(result: any, context: any): Promise<any> {
    // 获取性能报告
    const performanceReport = this.toolOptimizer.getPerformanceReport()

    // 分析选择准确性
    const accuracyAnalysis = this.toolOptimizer.analyzeSelectionAccuracy()

    return {
      performanceReport,
      accuracyAnalysis,
      suggestions: accuracyAnalysis.improvements,
    }
  }

  private parseToolSelection(llmResponse: string): any {
    // 简单的解析逻辑（实际应用中需要更复杂的解析）
    const lines = llmResponse.split('\n')
    let toolName = ''
    let parameters = {}
    let reasoning = ''

    for (const line of lines) {
      if (line.includes('选择工具')) {
        toolName = line.split('：')[1]?.trim() || ''
      }
      if (line.includes('工具参数')) {
        const jsonStr = line.split('：')[1]?.trim() || '{}'
        try {
          parameters = JSON.parse(jsonStr)
        } catch (e) {
          parameters = {}
        }
      }
      if (line.includes('选择理由')) {
        reasoning = line.split('：')[1]?.trim() || ''
      }
    }

    return { toolName, parameters, reasoning }
  }
}

/**
 * 示例2: 高级集成 - 带工具推荐的智能体
 */
export class SmartDocumentAgent extends Agent {
  private toolOptimizer: ToolSelectionOptimizer

  constructor(config: any) {
    super(config)
    this.toolOptimizer = toolSelectionOptimizer
  }

  /**
   * 智能工具选择 - 基于历史推荐
   */
  protected async plan(input: any, context: any): Promise<any> {
    const { userInput } = input

    // 1. 获取可用工具列表
    const availableTools = this.getAvailableTools(context)

    // 2. 获取基于历史的推荐
    const recommendations = this.toolOptimizer.optimizeToolSelectionPrompt(
      userInput,
      availableTools,
      {
        conversationHistory: context.conversationHistory,
      }
    )

    // 3. 询问LLM是否接受推荐
    const decisionPrompt = `
基于以下推荐和用户需求，请决定使用哪个工具：

## 用户需求
${userInput}

## 推荐工具（基于历史表现）
${recommendations}

## 决策
请选择一个工具并说明理由。如果推荐不合适，请说明原因并选择其他工具。
`

    const llmResponse = await context.llm.chat([
      {
        role: 'user',
        content: decisionPrompt,
      },
    ])

    // 4. 解析决策
    return this.parseDecision(llmResponse.content)
  }

  /**
   * 执行并记录
   */
  protected async act(plan: any, context: any): Promise<any> {
    const { toolName, parameters } = plan
    const tool = context.tools.get(toolName)
    const startTime = Date.now()

    try {
      const result = await tool.execute(parameters)

      // 记录成功
      this.toolOptimizer.recordToolUsage(
        toolName,
        context.userInput,
        parameters,
        {
          success: true,
          executionTime: Date.now() - startTime,
          output: result,
        },
        {
          sessionId: context.sessionId,
          conversationHistory: context.conversationHistory,
        }
      )

      return {
        success: true,
        result,
        tool: toolName,
      }
    } catch (error) {
      // 记录失败
      this.toolOptimizer.recordToolUsage(
        toolName,
        context.userInput,
        parameters,
        {
          success: false,
          executionTime: Date.now() - startTime,
          error: error.message,
        },
        {
          sessionId: context.sessionId,
        }
      )

      // 尝试使用推荐的替代工具
      return this.tryAlternativeTool(plan, context, error)
    }
  }

  /**
   * 尝试替代工具
   */
  private async tryAlternativeTool(failedPlan: any, context: any, error: Error): Promise<any> {
    // 获取推荐
    const recommendations = this.toolOptimizer.optimizeToolSelectionPrompt(
      context.userInput,
      this.getAvailableTools(context)
    )

    // 分析错误原因
    const errorAnalysis = `
工具 ${failedPlan.toolName} 执行失败：
错误：${error.message}

请基于以下推荐选择替代工具：
${recommendations}
`

    const llmResponse = await context.llm.chat([
      {
        role: 'user',
        content: errorAnalysis,
      },
    ])

    // 解析新的工具选择
    const newPlan = this.parseDecision(llmResponse.content)

    // 执行新工具
    const tool = context.tools.get(newPlan.toolName)
    const result = await tool.execute(newPlan.parameters)

    // 记录重试成功
    this.toolOptimizer.recordToolUsage(
      newPlan.toolName,
      context.userInput,
      newPlan.parameters,
      {
        success: true,
        executionTime: 0,
        output: result,
      },
      {
        sessionId: context.sessionId,
      }
    )

    return {
      success: true,
      result,
      tool: newPlan.toolName,
      retry: true,
      originalError: error.message,
    }
  }

  private getAvailableTools(context: any): EnhancedTool[] {
    return Array.from(context.tools.entries()).map(([name, tool]) => ({
      metadata: tool.metadata,
      execute: tool.execute.bind(tool),
    }))
  }

  private parseDecision(llmResponse: string): any {
    // 解析LLM决策
    const lines = llmResponse.split('\n')
    let toolName = ''
    let parameters = {}

    for (const line of lines) {
      if (line.includes('选择工具') || line.includes('使用工具')) {
        toolName = line.split('：')[1]?.trim() || ''
      }
      if (line.includes('参数')) {
        const jsonStr = line.split('：')[1]?.trim() || '{}'
        try {
          parameters = JSON.parse(jsonStr)
        } catch (e) {
          parameters = {}
        }
      }
    }

    return { toolName, parameters }
  }
}

/**
 * 示例3: 完整工作流 - 端到端工具选择优化
 */
export async function completeToolSelectionWorkflow() {
  console.log('=== 完整工具选择优化工作流 ===\n')

  // 1. 创建优化器实例
  const optimizer = toolSelectionOptimizer

  // 2. 模拟可用工具
  const availableTools: EnhancedTool[] = [
    {
      metadata: {
        name: 'PdfToMarkdownTool',
        description: '将PDF文件转换为Markdown格式',
        category: 'document',
      },
      execute: async (params: any) => {
        return { markdown: '# 转换后的内容' }
      },
    },
    {
      metadata: {
        name: 'ImageOcrTool',
        description: '从图片中识别文字内容',
        category: 'image',
      },
      execute: async (params: any) => {
        return { text: '识别的文字' }
      },
    },
  ]

  // 3. 用户输入
  const userInput = '帮我把这个PDF文件转换成Markdown格式'

  // 4. 生成优化提示
  console.log('1️⃣ 生成优化的工具选择提示')
  const optimizedPrompt = optimizer.optimizeToolSelectionPrompt(userInput, availableTools, {
    conversationHistory: [
      { role: 'user', content: '我需要处理一些文档' },
      { role: 'assistant', content: '我可以帮您处理文档' },
    ],
  })

  console.log(optimizedPrompt)
  console.log('\n' + '='.repeat(60) + '\n')

  // 5. 模拟工具执行
  console.log('2️⃣ 执行工具并记录')
  const toolName = 'PdfToMarkdownTool'
  const parameters = { filePath: '/path/to/document.pdf' }

  const recordId = optimizer.recordToolUsage(
    toolName,
    userInput,
    parameters,
    {
      success: true,
      executionTime: 1234,
      output: { markdown: '# 转换后的内容' },
    },
    {
      sessionId: 'session-001',
      userId: 'user-001',
    }
  )

  console.log(`✅ 工具使用已记录，ID: ${recordId}`)
  console.log('\n' + '='.repeat(60) + '\n')

  // 6. 生成性能报告
  console.log('3️⃣ 生成性能报告')
  const performanceReport = optimizer.getPerformanceReport()
  console.log(performanceReport)
  console.log('\n' + '='.repeat(60) + '\n')

  // 7. 分析选择准确性
  console.log('4️⃣ 分析工具选择准确性')
  const accuracyAnalysis = optimizer.analyzeSelectionAccuracy()
  console.log(JSON.stringify(accuracyAnalysis, null, 2))
  console.log('\n' + '='.repeat(60) + '\n')

  // 8. 获取推荐
  console.log('5️⃣ 获取工具推荐')
  const recommendations = optimizer.optimizeToolSelectionPrompt(
    '分析这个Excel表格中的数据',
    availableTools
  )
  console.log(recommendations)

  console.log('\n✅ 工作流完成！')
}

/**
 * 示例4: 使用示例 - 在实际智能体中集成
 */
export async function usageExample() {
  console.log('=== 智能体集成使用示例 ===\n')

  // 1. 初始化智能体
  const agent = new DocumentProcessorAgent({
    name: 'document-processor',
    description: '文档处理智能体',
  })

  // 2. 模拟执行上下文
  const context = {
    llm: {
      chat: async (messages: any[]) => {
        return {
          content: `
**需求分析**：用户想要将PDF转换为Markdown
**候选工具**：PdfToMarkdownTool, PdfParseTool
**推荐工具**：PdfToMarkdownTool
**选择理由**：这是专门的PDF到Markdown转换工具
**工具参数**：{"filePath": "/path/to/document.pdf"}
**执行计划**：使用PdfToMarkdownTool直接转换
          `,
        }
      },
    },
    tools: new Map([
      [
        'PdfToMarkdownTool',
        {
          metadata: {
            name: 'PdfToMarkdownTool',
            description: '将PDF文件转换为Markdown格式',
          },
          execute: async (params: any) => {
            return { markdown: '# 转换后的内容' }
          },
        },
      ],
    ]),
    conversationHistory: [],
    sessionId: 'session-001',
    userId: 'user-001',
    userInput: '帮我把这个PDF文件转换成Markdown格式',
  }

  // 3. 执行智能体
  try {
    const plan = await agent.plan({ userInput: context.userInput }, context)
    console.log('📋 执行计划：', plan)

    const result = await agent.act(plan, context)
    console.log('✅ 执行结果：', result)

    const reflection = await agent.reflect(result, context)
    console.log('🔍 反思分析：', reflection)
  } catch (error) {
    console.error('❌ 执行失败：', error.message)
  }

  console.log('\n✅ 示例完成！')
}

// 导出示例运行函数
export async function runAllExamples() {
  await completeToolSelectionWorkflow()
  console.log('\n' + '='.repeat(60) + '\n')
  await usageExample()
}
