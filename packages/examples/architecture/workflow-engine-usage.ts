/**
 * WorkflowEngine 使用示例
 *
 * 展示如何使用WorkflowEngine编排多个Agent
 */

import { WorkflowEngine, WorkflowDefinition } from '@yunpat/core'
import { EventBus } from '@yunpat/core'
import { MemoryStore } from '@yunpat/core'
import { Agent } from '@yunpat/core'
import { ToolRegistry } from '@yunpat/core'
import { createDeepSeekModel } from '@yunpat/core'

/**
 * 简单的输入验证Agent
 */
class InputValidatorAgent extends Agent<
  { technicalDisclosure: string },
  { valid: boolean; errors: string[] }
> {
  protected async plan(input: { technicalDisclosure: string }, context: any): Promise<any> {
    return { action: 'validate' }
  }

  protected async act(plan: any, context: any): Promise<{ valid: boolean; errors: string[] }> {
    const input = this['lastInput'] as { technicalDisclosure: string }
    const errors: string[] = []

    if (!input.technicalDisclosure || input.technicalDisclosure.length < 100) {
      errors.push('技术交底书内容过短')
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }

  async execute(input: {
    technicalDisclosure: string
  }): Promise<{ valid: boolean; errors: string[] }> {
    this['lastInput'] = input
    return super.execute(input)
  }
}

/**
 * 发明理解Agent
 */
class InventionUnderstandingAgent extends Agent<any, any> {
  protected async plan(input: any, context: any): Promise<any> {
    return { action: 'understand' }
  }

  protected async act(plan: any, context: any): Promise<any> {
    return {
      invention_title: '基于深度学习的图像识别方法',
      technical_field: '人工智能',
      core_innovation: '动态特征选择机制',
      technical_problem: '传统CNN模型计算量大',
      technical_solution: '使用动态特征选择减少计算量',
      technical_effects: ['计算量减少65%', '准确率提升2.3%'],
    }
  }
}

/**
 * 检索策略构建Agent
 */
class SearchStrategyBuilderAgent extends Agent<any, any> {
  protected async plan(input: any, context: any): Promise<any> {
    return { action: 'build-strategy' }
  }

  protected async act(plan: any, context: any): Promise<any> {
    return {
      keywords: ['深度学习', '图像识别', 'CNN', '特征选择'],
      ipc: ['G06K9/00', 'G06N3/00'],
      searchQueries: ['(深度学习 OR CNN) AND (图像识别)'],
    }
  }
}

async function main() {
  // 1. 创建基础组件
  const eventBus = new EventBus()
  const memory = new MemoryStore()
  const tools = new ToolRegistry()
  const llm = createDeepSeekModel(process.env.DEEPSEEK_API_KEY || '')

  // 2. 创建Agents
  const agents = new Map<string, Agent>([
    [
      'input-validator',
      new InputValidatorAgent({
        name: 'input-validator',
        description: '输入验证Agent',
        eventBus,
        memory,
        tools,
        llm,
      }),
    ],
    [
      'invention-understanding',
      new InventionUnderstandingAgent({
        name: 'invention-understanding',
        description: '发明理解Agent',
        eventBus,
        memory,
        tools,
        llm,
      }),
    ],
    [
      'search-strategy-builder',
      new SearchStrategyBuilderAgent({
        name: 'search-strategy-builder',
        description: '检索策略构建Agent',
        eventBus,
        memory,
        tools,
        llm,
      }),
    ],
  ])

  // 3. 创建工作流定义
  const workflow: WorkflowDefinition = {
    id: 'patent-drafting-slice-1',
    name: '专利撰写切片1',
    description: '发明理解工作流',
    steps: [
      {
        id: 'validate-input',
        name: '验证输入',
        agentName: 'input-validator',
        requiresApproval: false,
      },
      {
        id: 'understand-invention',
        name: '发明理解',
        agentName: 'invention-understanding',
        inputMapping: {
          technicalDisclosure: 'input.technicalDisclosure',
        },
        requiresApproval: true, // 需要人类确认
        approvalPrompt: '请确认发明理解结果是否准确',
      },
      {
        id: 'build-search-strategy',
        name: '构建检索策略',
        agentName: 'search-strategy-builder',
        inputMapping: {
          inventionUnderstanding: 'steps.understand-invention',
        },
        requiresApproval: true, // 需要人类确认
        approvalPrompt: '请确认检索策略是否合理',
      },
    ],
    dependencies: [
      { from: 'validate-input', to: 'understand-invention' },
      { from: 'understand-invention', to: 'build-search-strategy' },
    ],
  }

  // 4. 创建WorkflowEngine
  const workflowEngine = new WorkflowEngine({
    eventBus,
    memory,
    agents,
  })

  // 5. 执行工作流
  const result = await workflowEngine.execute(workflow, {
    technicalDisclosure: '本发明涉及一种基于深度学习的图像识别方法...',
  })

  console.log('工作流执行结果:')
  console.log('- 成功:', result.success)
  console.log('- 总耗时:', result.totalDuration, 'ms')
  console.log('- 步骤结果数:', result.stepResults.length)

  for (const stepResult of result.stepResults) {
    console.log(`\n步骤: ${stepResult.stepName}`)
    console.log('- Agent:', stepResult.agentName)
    console.log('- 成功:', stepResult.success)
    console.log('- 耗时:', stepResult.duration, 'ms')
    console.log('- 需要审批:', stepResult.approved !== undefined)
    if (stepResult.approved !== undefined) {
      console.log('- 审批结果:', stepResult.approved)
      console.log('- 审批反馈:', stepResult.approvalFeedback)
    }
  }

  console.log('\n最终输出:', result.finalOutput)
}

// 运行示例
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}
