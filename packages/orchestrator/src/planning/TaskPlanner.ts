/**
 * TaskPlanner - 任务规划器（Call 2）完整实现
 *
 * 职责：
 * 1. 生成多步骤执行计划
 * 2. 构建DAG（有向无环图）
 * 3. 识别并行步骤
 * 4. 设置HITL检查点
 */

import {
  TaskPlan,
  IntentRecognitionResult,
  TaskStep,
  IntentType
} from '../types/index.js'
import { LLMClient, LLMMessage } from '../llm/LLMClient.js'

export class TaskPlanner {
  private llmClient: LLMClient
  private maxSteps: number
  private defaultTimeout: number
  private enableParallel: boolean

  constructor(
    llmClient: LLMClient,
    maxSteps: number = 20,
    defaultTimeout: number = 30000,
    enableParallel: boolean = true
  ) {
    this.llmClient = llmClient
    this.maxSteps = maxSteps
    this.defaultTimeout = defaultTimeout
    this.enableParallel = enableParallel
  }

  /**
   * 生成任务计划
   */
  async generatePlan(intent: IntentRecognitionResult): Promise<TaskPlan> {
    // 对于简单意图，返回简单计划
    if (intent.complexity === 'simple') {
      return this.generateSimplePlan(intent)
    }

    // 对于复杂意图，使用LLM生成详细计划
    try {
      const plan = await this.generateComplexPlanWithLLM(intent)
      return plan
    } catch (error) {
      // LLM调用失败，返回默认计划
      return this.generateDefaultPlan(intent)
    }
  }

  /**
   * 生成简单计划
   */
  private generateSimplePlan(intent: IntentRecognitionResult): TaskPlan {
    const agentId = this.getDirectAgent(intent.intent)
    const step: TaskStep = {
      stepId: 'step-1',
      agentId,
      layer: this.getAgentLayer(agentId),
      parallel: false,
      dependsOn: [],
      timeout: this.defaultTimeout,
      input: this.buildStepInput(intent),
      hitl: false,
      retryOnFailure: true,
      maxRetries: 2
    }

    return {
      planId: `plan-${Date.now()}`,
      intent: intent.intent,
      estimatedMinutes: 10,
      steps: [step],
      hitlCheckpoints: [],
      metadata: {
        createdAt: new Date(),
        parallelizable: false
      }
    }
  }

  /**
   * 使用LLM生成复杂计划
   */
  private async generateComplexPlanWithLLM(
    intent: IntentRecognitionResult
  ): Promise<TaskPlan> {
    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: this.getSystemPrompt()
      },
      {
        role: 'user',
        content: this.buildUserPrompt(intent)
      }
    ]

    // 添加Few-shot示例
    const fewShotExamples = this.getFewShotExamples()
    for (const example of fewShotExamples) {
      messages.push({
        role: 'user',
        content: example.input
      })
      messages.push({
        role: 'assistant',
        content: JSON.stringify(example.output)
      })
    }

    const response = await this.llmClient.chatWithSchema<TaskPlanResponse>(
      messages,
      this.getResponseSchema()
    )

    return this.parseTaskPlanResponse(response, intent)
  }

  /**
   * 生成默认计划（LLM失败时）
   */
  private generateDefaultPlan(intent: IntentRecognitionResult): TaskPlan {
    switch (intent.intent) {
      case 'DRAFT_FULL':
        return this.getDefaultDraftFullPlan(intent)
      case 'RESPOND_OA':
        return this.getDefaultRespondOAPlan(intent)
      case 'ANALYZE_PORTFOLIO':
        return this.getDefaultAnalyzePortfolioPlan(intent)
      case 'MULTI_INTENT':
        return this.getDefaultMultiIntentPlan(intent)
      default:
        return this.generateSimplePlan(intent)
    }
  }

  /**
   * 获取System Prompt
   */
  private getSystemPrompt(): string {
    return `你是一个专利代理AI助手的中枢任务规划专家。

## 你的角色
基于识别出的用户意图，生成可执行的多步骤任务计划。

## 可用Agent资源

### 专业层（Layer 1）- 编排层
- **patent-writer**: 专利撰写编排
  - 能力：检索编排、知识库查询、权利要求生成、说明书撰写
  - 超时：60s
  - 并行：支持部分步骤并行

- **patent-responder**: 审查答复编排
  - 能力：OA解析、反证检索、答复策略、答复生成
  - 超时：90s
  - 并行：支持部分步骤并行

- **patent-analyzer**: 专利分析编排
  - 能力：组合分析、技术分布、价值评估
  - 超时：45s
  - 并行：支持大部分步骤并行

### 执行层（Layer 2）- 原子能力
- **search-agent**: 检索（简单+迭代）
- **analysis-agent**: 技术特征分析
- **quality-agent**: 质量评估
- **knowledge-agent**: 知识库查询
- **document-agent**: 文档解析
- **research-agent**: 技术研究
- **prior-art-search-agent**: 现有技术检索
- **ipc-categorization-agent**: IPC分类
- **search-query-builder-agent**: 检索式构建

## 任务规划原则

1. **依赖关系明确**
   - 必须明确标注步骤之间的依赖关系
   - 并行步骤之间不能有依赖

2. **超时合理设置**
   - 检索类：30-60s
   - 分析类：20-40s
   - 撰写类：40-80s
   - 格式转换：10-20s

3. **HITL检查点**
   - 关键决策点必须设置HITL
   - 权利要求确认
   - 答复策略确认
   - 重要修改确认

4. **错误处理**
   - 关键步骤设置重试
   - 非关键步骤可降级
   - 明确失败影响

5. **并行优化**
   - 无依赖的步骤必须并行
   - 估算时间节省

## 输出格式
严格按照JSON Schema输出。`
  }

  /**
   * 构建用户提示
   */
  private buildUserPrompt(intent: IntentRecognitionResult): string {
    let prompt = `用户意图：${intent.intent}\n`
    prompt += `置信度：${intent.confidence}\n`
    prompt += `提取信息：${JSON.stringify(intent.extracted)}\n`
    prompt += `\n请为该意图生成详细的任务执行计划。`

    return prompt
  }

  /**
   * 获取Few-shot示例
   */
  private getFewShotExamples(): Array<{
    input: string
    output: TaskPlanResponse
  }> {
    return [
      {
        input: '帮我撰写一个关于智能控制器的完整专利申请',
        output: {
          planId: 'plan-draft-full-001',
          intent: 'DRAFT_FULL',
          estimatedMinutes: 45,
          steps: [
            {
              stepId: 'search-prior-art',
              agentId: 'search-agent',
              layer: 'execution',
              parallel: true,
              dependsOn: [],
              timeout: 60000,
              input: { mode: 'iterative', query: '智能控制器' },
              hitl: false,
              retryOnFailure: true,
              maxRetries: 3
            },
            {
              stepId: 'query-knowledge-base',
              agentId: 'knowledge-agent',
              layer: 'execution',
              parallel: true,
              dependsOn: [],
              timeout: 30000,
              input: { query: '智能控制器' },
              hitl: false,
              retryOnFailure: true,
              maxRetries: 2
            },
            {
              stepId: 'draft-claims',
              agentId: 'patent-writer',
              layer: 'domain',
              parallel: false,
              dependsOn: ['search-prior-art', 'query-knowledge-base'],
              timeout: 90000,
              input: { task: 'draft-claims' },
              hitl: true,
              hitlDescription: '请审阅生成的权利要求',
              retryOnFailure: true,
              maxRetries: 2
            }
          ],
          hitlCheckpoints: ['draft-claims'],
          metadata: {
            createdAt: new Date().toISOString(),
            parallelizable: true,
            estimatedCost: 0.15
          }
        }
      }
    ]
  }

  /**
   * 获取响应Schema
   */
  private getResponseSchema(): object {
    return {
      type: 'object',
      properties: {
        planId: { type: 'string' },
        intent: { type: 'string' },
        estimatedMinutes: { type: 'number' },
        steps: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              stepId: { type: 'string' },
              agentId: { type: 'string' },
              layer: { type: 'string', enum: ['domain', 'execution'] },
              parallel: { type: 'boolean' },
              dependsOn: { type: 'array', items: { type: 'string' } },
              timeout: { type: 'number' },
              input: { type: 'object' },
              hitl: { type: 'boolean' },
              hitlDescription: { type: 'string' },
              retryOnFailure: { type: 'boolean' },
              maxRetries: { type: 'number' }
            },
            required: ['stepId', 'agentId', 'layer', 'parallel', 'dependsOn', 'timeout', 'input', 'hitl', 'retryOnFailure', 'maxRetries']
          }
        },
        hitlCheckpoints: { type: 'array', items: { type: 'string' } },
        metadata: {
          type: 'object',
          properties: {
            createdAt: { type: 'string' },
            parallelizable: { type: 'boolean' },
            estimatedCost: { type: 'number' }
          },
          required: ['createdAt', 'parallelizable']
        }
      },
      required: ['planId', 'intent', 'estimatedMinutes', 'steps', 'hitlCheckpoints', 'metadata']
    }
  }

  /**
   * 解析TaskPlan响应
   */
  private parseTaskPlanResponse(
    response: TaskPlanResponse,
    intent: IntentRecognitionResult
  ): TaskPlan {
    // 转换metadata.createdAt为Date对象，并确保intent是IntentType
    return {
      ...response,
      intent: response.intent as IntentType,
      metadata: {
        ...response.metadata,
        createdAt: new Date(response.metadata.createdAt)
      }
    }
  }

  /**
   * 获取默认的DRAFT_FULL计划
   */
  private getDefaultDraftFullPlan(intent: IntentRecognitionResult): TaskPlan {
    return {
      planId: `plan-${Date.now()}`,
      intent: 'DRAFT_FULL',
      estimatedMinutes: 45,
      steps: [
        // Step 1: 并行检索（可并行）
        {
          stepId: 'search-prior-art',
          agentId: 'search-agent',
          layer: 'execution',
          parallel: true,
          dependsOn: [],
          timeout: 60000,
          input: {
            mode: 'iterative',
            query: intent.extracted.title || intent.extracted.keywords.join(' '),
            databases: ['cn_patent', 'us_patent']
          },
          hitl: false,
          retryOnFailure: true,
          maxRetries: 3
        },
        {
          stepId: 'query-knowledge-base',
          agentId: 'knowledge-agent',
          layer: 'execution',
          parallel: true,
          dependsOn: [],
          timeout: 30000,
          input: {
            query: intent.extracted.title || intent.extracted.keywords.join(' '),
            domain: intent.extracted.field
          },
          hitl: false,
          retryOnFailure: true,
          maxRetries: 2
        },
        // Step 2: 发明理解（依赖Step 1）
        {
          stepId: 'understand-invention',
          agentId: 'patent-writer',
          layer: 'domain',
          parallel: false,
          dependsOn: ['search-prior-art', 'query-knowledge-base'],
          timeout: 60000,
          input: {
            task: 'understand-invention',
            inventionTitle: intent.extracted.title
          },
          hitl: false,
          retryOnFailure: true,
          maxRetries: 2
        },
        // Step 3: 权利要求撰写（HITL检查点）
        {
          stepId: 'draft-claims',
          agentId: 'patent-writer',
          layer: 'domain',
          parallel: false,
          dependsOn: ['understand-invention'],
          timeout: 90000,
          input: {
            task: 'draft-claims'
          },
          hitl: true,
          hitlDescription: '请审阅生成的权利要求，确认保护范围和技术特征是否准确',
          retryOnFailure: true,
          maxRetries: 2
        },
        // Step 4: 说明书撰写
        {
          stepId: 'draft-specification',
          agentId: 'patent-writer',
          layer: 'domain',
          parallel: false,
          dependsOn: ['draft-claims'],
          timeout: 120000,
          input: {
            task: 'draft-specification'
          },
          hitl: false,
          retryOnFailure: true,
          maxRetries: 2
        },
        // Step 5: 形式检查（并行）
        {
          stepId: 'claims-formality-check',
          agentId: 'claims-formality-checker',
          layer: 'execution',
          parallel: true,
          dependsOn: ['draft-claims'],
          timeout: 30000,
          input: {},
          hitl: false,
          retryOnFailure: false,
          maxRetries: 0
        },
        {
          stepId: 'spec-formality-check',
          agentId: 'spec-formality-checker',
          layer: 'execution',
          parallel: true,
          dependsOn: ['draft-specification'],
          timeout: 30000,
          input: {},
          hitl: false,
          retryOnFailure: false,
          maxRetries: 0
        },
        // Step 6: 格式转换
        {
          stepId: 'generate-docx',
          agentId: 'writing-agent',
          layer: 'execution',
          parallel: false,
          dependsOn: ['draft-specification', 'claims-formality-check', 'spec-formality-check'],
          timeout: 30000,
          input: {
            format: 'docx',
            patentOfficeFormat: 'CNIPA'
          },
          hitl: false,
          retryOnFailure: true,
          maxRetries: 2
        }
      ],
      hitlCheckpoints: ['draft-claims'],
      metadata: {
        createdAt: new Date(),
        parallelizable: true,
        estimatedCost: 0.15
      }
    }
  }

  /**
   * 获取默认的RESPOND_OA计划
   */
  private getDefaultRespondOAPlan(intent: IntentRecognitionResult): TaskPlan {
    return {
      planId: `plan-${Date.now()}`,
      intent: 'RESPOND_OA',
      estimatedMinutes: 60,
      steps: [
        {
          stepId: 'parse-oa',
          agentId: 'patent-responder',
          layer: 'domain',
          parallel: false,
          dependsOn: [],
          timeout: 30000,
          input: {
            task: 'parse-oa'
          },
          hitl: false,
          retryOnFailure: true,
          maxRetries: 2
        },
        {
          stepId: 'search-counter-evidence',
          agentId: 'search-agent',
          layer: 'execution',
          parallel: false,
          dependsOn: ['parse-oa'],
          timeout: 60000,
          input: {
            mode: 'iterative',
            query: '反证检索'
          },
          hitl: false,
          retryOnFailure: true,
          maxRetries: 3
        },
        {
          stepId: 'determine-response-strategy',
          agentId: 'patent-responder',
          layer: 'domain',
          parallel: false,
          dependsOn: ['search-counter-evidence'],
          timeout: 60000,
          input: {
            task: 'determine-strategy'
          },
          hitl: true,
          hitlDescription: '请确认答复策略：修改权利要求、争辩、还是组合策略',
          retryOnFailure: true,
          maxRetries: 2
        },
        {
          stepId: 'draft-response',
          agentId: 'patent-responder',
          layer: 'domain',
          parallel: false,
          dependsOn: ['determine-response-strategy'],
          timeout: 120000,
          input: {
            task: 'draft-response'
          },
          hitl: false,
          retryOnFailure: true,
          maxRetries: 2
        }
      ],
      hitlCheckpoints: ['determine-response-strategy'],
      metadata: {
        createdAt: new Date(),
        parallelizable: false,
        estimatedCost: 0.20
      }
    }
  }

  /**
   * 获取默认的ANALYZE_PORTFOLIO计划
   */
  private getDefaultAnalyzePortfolioPlan(intent: IntentRecognitionResult): TaskPlan {
    return {
      planId: `plan-${Date.now()}`,
      intent: 'ANALYZE_PORTFOLIO',
      estimatedMinutes: 30,
      steps: [
        {
          stepId: 'collect-patents',
          agentId: 'patent-analyzer',
          layer: 'domain',
          parallel: false,
          dependsOn: [],
          timeout: 30000,
          input: {
            task: 'collect-patents'
          },
          hitl: false,
          retryOnFailure: true,
          maxRetries: 2
        },
        {
          stepId: 'analyze-technical-distribution',
          agentId: 'patent-analyzer',
          layer: 'domain',
          parallel: false,
          dependsOn: ['collect-patents'],
          timeout: 60000,
          input: {
            task: 'analyze-distribution'
          },
          hitl: false,
          retryOnFailure: true,
          maxRetries: 2
        },
        {
          stepId: 'evaluate-value',
          agentId: 'patent-analyzer',
          layer: 'domain',
          parallel: false,
          dependsOn: ['analyze-technical-distribution'],
          timeout: 60000,
          input: {
            task: 'evaluate-value'
          },
          hitl: false,
          retryOnFailure: true,
          maxRetries: 2
        },
        {
          stepId: 'generate-report',
          agentId: 'patent-analyzer',
          layer: 'domain',
          parallel: false,
          dependsOn: ['evaluate-value'],
          timeout: 60000,
          input: {
            task: 'generate-report'
          },
          hitl: false,
          retryOnFailure: true,
          maxRetries: 2
        }
      ],
      hitlCheckpoints: [],
      metadata: {
        createdAt: new Date(),
        parallelizable: false,
        estimatedCost: 0.12
      }
    }
  }

  /**
   * 获取默认的MULTI_INTENT计划
   */
  private getDefaultMultiIntentPlan(intent: IntentRecognitionResult): TaskPlan {
    return {
      planId: `plan-${Date.now()}`,
      intent: 'MULTI_INTENT',
      estimatedMinutes: 60,
      steps: [
        {
          stepId: 'task-1-search',
          agentId: 'search-agent',
          layer: 'execution',
          parallel: true,
          dependsOn: [],
          timeout: 60000,
          input: {
            query: intent.extracted.keywords.join(' ')
          },
          hitl: false,
          retryOnFailure: true,
          maxRetries: 3
        },
        {
          stepId: 'task-2-draft',
          agentId: 'patent-writer',
          layer: 'domain',
          parallel: false,
          dependsOn: ['task-1-search'],
          timeout: 120000,
          input: {
            task: 'draft-full'
          },
          hitl: true,
          hitlDescription: '请确认完整的专利申请内容',
          retryOnFailure: true,
          maxRetries: 2
        }
      ],
      hitlCheckpoints: ['task-2-draft'],
      metadata: {
        createdAt: new Date(),
        parallelizable: true,
        estimatedCost: 0.18
      }
    }
  }

  /**
   * 获取直接路由的Agent
   */
  private getDirectAgent(intent: IntentType): string {
    const directRoutes: Record<string, string> = {
      'DRAFT_CLAIMS': 'patent-writer',
      'DRAFT_SPEC': 'patent-writer',
      'SEARCH': 'search-agent'
    }
    return directRoutes[intent] || 'patent-writer'
  }

  /**
   * 获取Agent层级
   */
  private getAgentLayer(agentId: string): 'domain' | 'execution' {
    const domainAgents = ['patent-writer', 'patent-responder', 'patent-analyzer']
    return domainAgents.includes(agentId) ? 'domain' : 'execution'
  }

  /**
   * 构建步骤输入
   */
  private buildStepInput(intent: IntentRecognitionResult): Record<string, any> {
    return {
      intent: intent.intent,
      extracted: intent.extracted
    }
  }
}

/**
 * TaskPlan响应（内部使用）
 */
interface TaskPlanResponse {
  planId: string
  intent: string
  estimatedMinutes: number
  steps: Array<{
    stepId: string
    agentId: string
    layer: 'domain' | 'execution'
    parallel: boolean
    dependsOn: string[]
    timeout: number
    input: Record<string, any>
    hitl: boolean
    hitlDescription?: string
    retryOnFailure: boolean
    maxRetries: number
  }>
  hitlCheckpoints: string[]
  metadata: {
    createdAt: string
    parallelizable: boolean
    estimatedCost?: number
  }
}
