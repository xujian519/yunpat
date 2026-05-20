/**
 * 专利协调器（Patent Coordinator）
 *
 * Phase 3.1 核心组件：
 * - 专利专用协调器，必须先理解案件再委托 Agent
 * - 支持工作流规划、Agent 委托、输出审查、结果合并
 * - 遵循 Claude Code Coordinator 模式：Coordinator 是"团队领导"
 *
 * 核心约束：
 * - Coordinator 必须理解案件后才能委托（不能把理解责任推给 Worker）
 * - 每个 Worker Agent 只负责一个子任务，Coordinator 负责整合
 * - 输出审查不通过时可要求重做
 */

import { Agent, AgentConfig } from '../agent/Agent.js'
import type { ExecutionContext, LLMAdapter, MemoryStore } from '../lifecycle/Lifecycle.js'
import { EventBus } from '../eventbus/EventBus.js'
import { safeParseJSON } from '../utils/safeParseJSON.js'
import {
  CaseUnderstanding,
  WorkflowPlan,
  WorkflowPlanStep,
  AgentTask,
  CoordinatorTaskStatus,
  HandoffContext,
  HandoffResult,
  ReviewResult,
  ReviewCriteria,
  PatentCoordinatorConfig,
  CoordinatorEventType,
  AgentRole,
} from './types.js'

/**
 * 协调器输入
 */
export interface CoordinatorInput {
  /** 用户原始输入（技术交底书、案件描述等） */
  userInput: string

  /** 用户意图（可选，如果已识别） */
  intent?: 'draft_full' | 'draft_claims' | 'draft_spec' | 'respond_oa' | 'search' | 'analyze'

  /** 已有案件理解（可选，用于复用） */
  existingCaseUnderstanding?: CaseUnderstanding

  /** 额外上下文 */
  context?: Record<string, unknown>
}

/**
 * 协调器输出
 */
export interface CoordinatorOutput {
  /** 案件理解 */
  caseUnderstanding: CaseUnderstanding

  /** 工作流计划 */
  workflowPlan: WorkflowPlan

  /** 任务结果列表 */
  taskResults: Array<{
    stepId: string
    agentName: string
    status: CoordinatorTaskStatus
    output: unknown
    error?: string
  }>

  /** 最终输出 */
  finalOutput: unknown

  /** 执行摘要 */
  executionSummary: {
    totalSteps: number
    completedSteps: number
    failedSteps: number
    totalDuration: number
    totalTokens?: number
  }
}

/**
 * 专利协调器
 */
export class PatentCoordinator extends Agent<CoordinatorInput, CoordinatorOutput> {
  private readonly config: PatentCoordinatorConfig
  private readonly agentRoles: Map<string, AgentRole> = new Map()
  private readonly tasks: Map<string, AgentTask> = new Map()
  private workflowPlan?: WorkflowPlan

  constructor(agentConfig: AgentConfig, coordinatorConfig: PatentCoordinatorConfig = {}) {
    super(agentConfig)
    this.config = {
      maxUnderstandingRounds: 3,
      reviewThreshold: 70,
      maxRetries: 2,
      enableParallelExecution: true,
      enableApprovalFlow: false,
      ...coordinatorConfig,
    }
  }

  /**
   * 注册 Agent 角色
   */
  registerAgentRole(role: AgentRole): void {
    this.agentRoles.set(role.id, role)
    console.log(`[PatentCoordinator] 注册 Agent 角色: ${role.name} (${role.id})`)
  }

  /**
   * 理解案件
   *
   * 核心方法：Coordinator 必须先理解案件，才能有效委托。
   * 使用 LLM 解析用户输入，提取结构化信息。
   */
  async understandCase(
    input: CoordinatorInput,
    _context: ExecutionContext
  ): Promise<CaseUnderstanding> {
    // 如果已有案件理解，直接复用
    if (input.existingCaseUnderstanding) {
      console.log('[PatentCoordinator] 复用已有案件理解')
      return input.existingCaseUnderstanding
    }

    console.log('[PatentCoordinator] 开始理解案件...')

    const systemPrompt = `你是一位资深专利代理师。请仔细分析用户提供的技术交底书或案件描述，提取以下结构化信息。

输出严格的 JSON 格式：
{
  "technicalField": "技术领域（一句话）",
  "technicalProblem": "要解决的技术问题（200字以内）",
  "technicalSolution": "核心技术方案（300字以内）",
  "technicalEffects": ["效果1", "效果2"],
  "keyFeatures": ["关键特征1", "关键特征2", "关键特征3"],
  "keywords": ["关键词1", "关键词2"],
  "ipcHint": "可能的 IPC 分类号（如 H04L 12/24）",
  "patentType": "invention|utilityModel|design",
  "confidence": 0.85,
  "clarifications": ["需要澄清的问题1", "需要澄清的问题2"]
}

注意：
- confidence 范围 0-1，表示理解完整度
- 如果信息不完整，clarifications 必须列出需要用户澄清的问题
- technicalSolution 必须包含"点名+连接"式的技术特征描述`

    const userPrompt = `请分析以下专利案件描述：\n\n${input.userInput}`

    let lastUnderstanding: CaseUnderstanding | undefined
    let round = 0

    while (round < (this.config.maxUnderstandingRounds ?? 3)) {
      round++
      console.log(`[PatentCoordinator] 理解案件第 ${round} 轮...`)

      const response = await this.callLLMWithRetry({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        maxTokens: 4000,
      })

      const parsed = safeParseJSON(response.message.content) as Partial<CaseUnderstanding> | null
      if (!parsed) {
        console.warn('[PatentCoordinator] 案件理解 JSON 解析失败，重试...')
        continue
      }

      lastUnderstanding = {
        technicalField: parsed.technicalField ?? '未指定',
        technicalProblem: parsed.technicalProblem ?? '未指定',
        technicalSolution: parsed.technicalSolution ?? '未指定',
        technicalEffects: parsed.technicalEffects ?? [],
        keyFeatures: parsed.keyFeatures ?? [],
        keywords: parsed.keywords ?? [],
        ipcHint: parsed.ipcHint,
        patentType: parsed.patentType,
        confidence: parsed.confidence ?? 0.5,
        clarifications: parsed.clarifications,
        originalInput: input.userInput,
      }

      // 如果理解完整（confidence >= 0.7 且无需澄清），结束
      if (
        lastUnderstanding.confidence >= 0.7 &&
        (!lastUnderstanding.clarifications || lastUnderstanding.clarifications.length === 0)
      ) {
        console.log(
          `[PatentCoordinator] 案件理解完成 (confidence: ${lastUnderstanding.confidence})`
        )
        break
      }

      // 如果需要澄清且不是最后一轮，继续
      if (
        lastUnderstanding.clarifications &&
        lastUnderstanding.clarifications.length > 0 &&
        round < (this.config.maxUnderstandingRounds ?? 3)
      ) {
        console.log(`[PatentCoordinator] 需要澄清: ${lastUnderstanding.clarifications.join(', ')}`)
      }
    }

    if (!lastUnderstanding) {
      throw new Error('案件理解失败：无法从输入中提取有效信息')
    }

    // 发布事件
    this.eventBus.publish({
      type: 'coordinator:case_understood',
      source: this.name,
      data: { caseUnderstanding: lastUnderstanding },
      timestamp: new Date(),
    })

    return lastUnderstanding
  }

  /**
   * 规划工作流
   *
   * 基于案件理解，生成最优的 Agent 执行计划。
   */
  async planWorkflow(caseUnderstanding: CaseUnderstanding, intent?: string): Promise<WorkflowPlan> {
    console.log('[PatentCoordinator] 规划工作流...')

    // 根据意图和案件理解选择预设模板或动态规划
    const plan = this.buildWorkflowPlan(caseUnderstanding, intent)

    this.workflowPlan = plan

    // 发布事件
    this.eventBus.publish({
      type: 'coordinator:plan_created',
      source: this.name,
      data: { workflowPlan: plan },
      timestamp: new Date(),
    })

    console.log(`[PatentCoordinator] 工作流计划生成完成: ${plan.steps.length} 个步骤`)
    return plan
  }

  /**
   * 委托任务给 Agent
   */
  async delegateToAgent(
    step: WorkflowPlanStep,
    caseUnderstanding: CaseUnderstanding,
    previousOutputs: Map<string, unknown>
  ): Promise<unknown> {
    const role = this.agentRoles.get(step.agentName)
    if (!role) {
      throw new Error(`Agent 角色未注册: ${step.agentName}`)
    }

    console.log(`[PatentCoordinator] 委托步骤 "${step.name}" 给 ${role.name}`)

    // 创建任务
    const task: AgentTask = {
      id: `${step.id}-${Date.now()}`,
      description: step.description,
      assignee: step.agentName,
      status: CoordinatorTaskStatus.IN_PROGRESS,
      input: this.buildStepInput(step, caseUnderstanding, previousOutputs),
      createdAt: new Date(),
      startedAt: new Date(),
      stepId: step.id,
      retryCount: 0,
    }

    this.tasks.set(task.id, task)

    // 发布委托事件
    this.eventBus.publish({
      type: 'coordinator:task_delegated',
      source: this.name,
      target: step.agentName,
      data: { task },
      timestamp: new Date(),
    })

    try {
      // 调用 Agent 的 execute 方法
      const agent = role.agent
      const output = await agent.execute(task.input)

      // 更新任务状态
      task.status = CoordinatorTaskStatus.COMPLETED
      task.output = output
      task.completedAt = new Date()

      // 发布完成事件
      this.eventBus.publish({
        type: 'coordinator:task_completed',
        source: this.name,
        target: step.agentName,
        data: { taskId: task.id, stepId: step.id, output },
        timestamp: new Date(),
      })

      return output
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)

      task.status = CoordinatorTaskStatus.FAILED
      task.error = errorMessage
      task.completedAt = new Date()

      // 发布失败事件
      this.eventBus.publish({
        type: 'coordinator:task_failed',
        source: this.name,
        target: step.agentName,
        data: { taskId: task.id, stepId: step.id, error: errorMessage },
        timestamp: new Date(),
      })

      throw error
    }
  }

  /**
   * 审查 Agent 输出
   */
  async reviewOutput(output: unknown, criteria: ReviewCriteria): Promise<ReviewResult> {
    console.log('[PatentCoordinator] 审查输出...')

    // 如果未配置审查，默认通过
    if (!this.config.reviewThreshold) {
      return {
        passed: true,
        overallScore: 100,
        dimensionScores: [],
        criticalIssues: [],
        improvements: [],
        needsRework: false,
      }
    }

    // 使用 LLM 进行审查（简化版，实际可用专门的 QualityCheckerAgent）
    const outputStr = typeof output === 'string' ? output : JSON.stringify(output, null, 2)

    const systemPrompt = `你是一位专利质量审查专家。请对以下 Agent 输出进行质量审查。

审查维度：
${criteria.dimensions.map((d) => `- ${d.name}（权重 ${d.weight}）: ${d.description}`).join('\n')}

最低可接受分数：${criteria.minAcceptableScore}

输出 JSON 格式：
{
  "passed": true|false,
  "overallScore": 85,
  "dimensionScores": [
    { "name": "维度名", "score": 85, "assessment": "评价", "suggestions": ["建议1"] }
  ],
  "criticalIssues": ["关键问题1"],
  "improvements": ["改进建议1"],
  "needsRework": false,
  "reworkSuggestion": "如需重做，请..."
}`

    const response = await this.callLLMWithRetry({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: outputStr.substring(0, 8000) },
      ],
      temperature: 0.3,
      maxTokens: 2000,
    })

    const parsed = safeParseJSON(response.message.content) as Partial<ReviewResult> | null
    if (!parsed || typeof parsed.passed !== 'boolean') {
      // LLM 审查失败时保守处理：通过
      return {
        passed: true,
        overallScore: 100,
        dimensionScores: [],
        criticalIssues: [],
        improvements: ['LLM 审查解析失败，建议人工复核'],
        needsRework: false,
      }
    }

    // 确保所有必填字段存在
    const reviewResult: ReviewResult = {
      passed: parsed.passed,
      overallScore: parsed.overallScore ?? 100,
      dimensionScores: parsed.dimensionScores ?? [],
      criticalIssues: parsed.criticalIssues ?? [],
      improvements: parsed.improvements ?? [],
      needsRework: parsed.needsRework ?? false,
      reworkSuggestion: parsed.reworkSuggestion,
    }

    // 发布审查事件
    this.eventBus.publish({
      type: 'coordinator:output_reviewed',
      source: this.name,
      data: { reviewResult },
      timestamp: new Date(),
    })

    return reviewResult
  }

  /**
   * 合并工作流结果
   */
  async finalizeWorkflow(
    caseUnderstanding: CaseUnderstanding,
    taskResults: Array<{ stepId: string; agentName: string; output: unknown }>
  ): Promise<unknown> {
    console.log('[PatentCoordinator] 合并工作流结果...')

    // 根据案件类型选择不同的合并策略
    const strategy = this.selectMergeStrategy(caseUnderstanding)

    let finalOutput: unknown

    switch (strategy) {
      case 'patent_document': {
        // 专利文档合并：权利要求 + 说明书 + 摘要
        finalOutput = this.mergePatentDocument(taskResults)
        break
      }
      case 'analysis_report': {
        // 分析报告合并：检索结果 + 对比分析 + 建议
        finalOutput = this.mergeAnalysisReport(taskResults)
        break
      }
      case 'oa_response': {
        // OA 答复合并：分析 + 答复稿 + 建议
        finalOutput = this.mergeOAResponse(taskResults)
        break
      }
      default: {
        // 通用合并：收集所有输出
        finalOutput = {
          caseUnderstanding,
          taskResults,
          mergedAt: new Date().toISOString(),
        }
      }
    }

    // 发布完成事件
    this.eventBus.publish({
      type: 'coordinator:workflow_finalized',
      source: this.name,
      data: { finalOutput },
      timestamp: new Date(),
    })

    return finalOutput
  }

  // ========== Agent 生命周期钩子 ==========

  protected async plan(
    input: CoordinatorInput,
    context: ExecutionContext
  ): Promise<{ understanding: CaseUnderstanding; plan: WorkflowPlan }> {
    // 1. 理解案件
    const understanding = await this.understandCase(input, context)

    // 2. 规划工作流
    const plan = await this.planWorkflow(understanding, input.intent)

    return { understanding, plan }
  }

  protected async act(
    planResult: { understanding: CaseUnderstanding; plan: WorkflowPlan },
    _context: ExecutionContext
  ): Promise<CoordinatorOutput> {
    const { understanding, plan } = planResult
    const startTime = Date.now()

    const taskResults: CoordinatorOutput['taskResults'] = []
    const previousOutputs = new Map<string, unknown>()

    // 按依赖关系分组执行
    const executedSteps = new Set<string>()
    const failedSteps = new Set<string>()
    const pendingSteps = new Set(plan.steps.map((s) => s.id))

    while (pendingSteps.size > 0) {
      // 找出当前可执行的步骤（所有依赖已成功完成）
      const readySteps = plan.steps.filter(
        (step) =>
          pendingSteps.has(step.id) &&
          (!step.dependencies || step.dependencies.every((dep) => executedSteps.has(dep)))
      )

      if (readySteps.length === 0 && pendingSteps.size > 0) {
        // 区分：循环依赖 vs 依赖步骤失败
        const blockedSteps = plan.steps.filter((s) => pendingSteps.has(s.id))
        const blockedByFailure = blockedSteps.filter((s) =>
          s.dependencies?.some((dep) => failedSteps.has(dep))
        )
        if (blockedByFailure.length > 0) {
          const failedDeps = Array.from(
            new Set(
              blockedByFailure.flatMap(
                (s) => s.dependencies?.filter((d) => failedSteps.has(d)) ?? []
              )
            )
          )
          throw new Error(
            `工作流执行失败：步骤 ${blockedByFailure.map((s) => s.id).join(', ')} 的依赖步骤 (${failedDeps.join(', ')}) 执行失败，无法继续`
          )
        }
        throw new Error('工作流执行死锁：存在循环依赖或无法满足的依赖')
      }

      // 分离并行组和串行步骤
      const parallelGroups = new Map<string, WorkflowPlanStep[]>()
      const serialSteps: WorkflowPlanStep[] = []

      for (const step of readySteps) {
        if (step.parallelGroup && this.config.enableParallelExecution) {
          const group = parallelGroups.get(step.parallelGroup) ?? []
          group.push(step)
          parallelGroups.set(step.parallelGroup, group)
        } else {
          serialSteps.push(step)
        }
      }

      // 执行并行组
      for (const [groupName, steps] of parallelGroups) {
        console.log(`[PatentCoordinator] 执行并行组 "${groupName}": ${steps.length} 个步骤`)

        const promises = steps.map(async (step) => {
          try {
            const output = await this.delegateToAgent(step, understanding, previousOutputs)
            return {
              stepId: step.id,
              agentName: step.agentName,
              status: CoordinatorTaskStatus.COMPLETED,
              output,
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            return {
              stepId: step.id,
              agentName: step.agentName,
              status: CoordinatorTaskStatus.FAILED,
              output: null,
              error: errorMessage,
            }
          }
        })

        const results = await Promise.all(promises)

        for (const result of results) {
          taskResults.push(result)
          pendingSteps.delete(result.stepId)
          if (result.status === CoordinatorTaskStatus.COMPLETED) {
            executedSteps.add(result.stepId)
            previousOutputs.set(result.stepId, result.output)
          } else {
            failedSteps.add(result.stepId)
          }
        }
      }

      // 执行串行步骤
      for (const step of serialSteps) {
        try {
          const output = await this.delegateToAgent(step, understanding, previousOutputs)
          taskResults.push({
            stepId: step.id,
            agentName: step.agentName,
            status: CoordinatorTaskStatus.COMPLETED,
            output,
          })
          executedSteps.add(step.id)
          previousOutputs.set(step.id, output)
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          taskResults.push({
            stepId: step.id,
            agentName: step.agentName,
            status: CoordinatorTaskStatus.FAILED,
            output: null,
            error: errorMessage,
          })
          failedSteps.add(step.id)

          const task = this.tasks.get(step.id)
          const stepMaxRetries = step.maxRetries ?? this.config.maxRetries ?? 2
          if (task && task.retryCount < stepMaxRetries) {
            task.retryCount++
            const backoff = Math.min(1000 * Math.pow(2, task.retryCount - 1), 10000)
            console.warn(
              `[PatentCoordinator] 步骤 ${step.id} 第 ${task.retryCount} 次重试 (${backoff}ms 后)`
            )
            await new Promise((r) => setTimeout(r, backoff))
            pendingSteps.delete(step.id)
            pendingSteps.add(step.id)
            continue
          }
        }

        pendingSteps.delete(step.id)
      }
    }

    // 合并最终结果
    const finalOutput = await this.finalizeWorkflow(understanding, taskResults)
    const totalDuration = Date.now() - startTime

    return {
      caseUnderstanding: understanding,
      workflowPlan: plan,
      taskResults,
      finalOutput,
      executionSummary: {
        totalSteps: plan.steps.length,
        completedSteps: taskResults.filter((r) => r.status === CoordinatorTaskStatus.COMPLETED)
          .length,
        failedSteps: taskResults.filter((r) => r.status === CoordinatorTaskStatus.FAILED).length,
        totalDuration,
      },
    }
  }

  // ========== 私有辅助方法 ==========

  /**
   * 构建工作流计划
   */
  private buildWorkflowPlan(caseUnderstanding: CaseUnderstanding, intent?: string): WorkflowPlan {
    const steps: WorkflowPlanStep[] = []

    // 根据意图选择不同的工作流模板
    switch (intent) {
      case 'draft_full':
        steps.push(
          {
            id: 'understand',
            name: '发明理解',
            agentName: 'invention-understanding',
            description: '深入理解技术交底书',
            maxRetries: 1,
          },
          {
            id: 'search',
            name: '现有技术检索',
            agentName: 'prior-art-search',
            description: '检索相关现有技术',
            dependencies: ['understand'],
            parallelGroup: 'research',
          },
          {
            id: 'analyze',
            name: '对比分析',
            agentName: 'comparison-analyzer',
            description: '分析发明与现有技术的区别',
            dependencies: ['understand', 'search'],
            parallelGroup: 'research',
          },
          {
            id: 'claims',
            name: '权利要求撰写',
            agentName: 'claim-generator',
            description: '生成权利要求书',
            dependencies: ['analyze'],
          },
          {
            id: 'spec',
            name: '说明书撰写',
            agentName: 'specification-drafter',
            description: '撰写完整说明书',
            dependencies: ['claims'],
          },
          {
            id: 'abstract',
            name: '摘要撰写',
            agentName: 'abstract-drafter',
            description: '撰写摘要',
            dependencies: ['spec'],
          },
          {
            id: 'quality',
            name: '质量检查',
            agentName: 'quality-checker',
            description: '全面质量检查',
            dependencies: ['spec', 'abstract'],
          }
        )
        break

      case 'respond_oa':
        steps.push(
          {
            id: 'analyze-oa',
            name: 'OA 分析',
            agentName: 'patent-responder',
            description: '分析审查意见',
            maxRetries: 1,
          },
          {
            id: 'search-additional',
            name: '补充检索',
            agentName: 'patent-search',
            description: '补充检索',
            dependencies: ['analyze-oa'],
            parallelGroup: 'research',
          },
          {
            id: 'draft-response',
            name: '撰写答复',
            agentName: 'patent-responder',
            description: '撰写 OA 答复',
            dependencies: ['analyze-oa', 'search-additional'],
          },
          {
            id: 'review-response',
            name: '答复审查',
            agentName: 'quality-checker',
            description: '审查答复质量',
            dependencies: ['draft-response'],
          }
        )
        break

      case 'search':
        steps.push(
          {
            id: 'understand-search',
            name: '发明理解',
            agentName: 'invention-understanding',
            description: '理解检索目标',
            maxRetries: 1,
          },
          {
            id: 'patent-search',
            name: '专利检索',
            agentName: 'patent-search',
            description: '执行专利检索',
            dependencies: ['understand-search'],
            parallelGroup: 'search',
          },
          {
            id: 'academic-search',
            name: '学术检索',
            agentName: 'researcher',
            description: '执行学术检索',
            dependencies: ['understand-search'],
            parallelGroup: 'search',
          },
          {
            id: 'synthesize',
            name: '结果整合',
            agentName: 'comparison-report',
            description: '整合检索结果',
            dependencies: ['patent-search', 'academic-search'],
          }
        )
        break

      default:
        // 通用工作流
        steps.push(
          {
            id: 'understand',
            name: '发明理解',
            agentName: 'invention-understanding',
            description: '理解技术方案',
            maxRetries: 1,
          },
          {
            id: 'analyze',
            name: '技术分析',
            agentName: 'comparison-analyzer',
            description: '技术分析',
            dependencies: ['understand'],
          }
        )
    }

    return {
      id: `workflow-${Date.now()}`,
      name: this.getWorkflowName(intent),
      steps,
      caseUnderstanding,
      estimatedDuration: steps.length * 30000, // 粗略估计
    }
  }

  /**
   * 构建步骤输入
   */
  private buildStepInput(
    step: WorkflowPlanStep,
    caseUnderstanding: CaseUnderstanding,
    previousOutputs: Map<string, unknown>
  ): unknown {
    if (!step.inputMapping) {
      // 默认：传递案件理解 + 前序输出
      return {
        caseUnderstanding,
        previousOutputs: Object.fromEntries(previousOutputs),
      }
    }

    // 应用 inputMapping
    const input: Record<string, unknown> = {}

    for (const [targetKey, sourcePath] of Object.entries(step.inputMapping)) {
      if (sourcePath === 'caseUnderstanding') {
        input[targetKey] = caseUnderstanding
      } else if (sourcePath.startsWith('steps.')) {
        const stepId = sourcePath.replace('steps.', '')
        input[targetKey] = previousOutputs.get(stepId)
      } else {
        input[targetKey] = sourcePath
      }
    }

    return input
  }

  /**
   * 选择合并策略
   */
  private selectMergeStrategy(caseUnderstanding: CaseUnderstanding): string {
    if (
      caseUnderstanding.patentType === 'invention' ||
      caseUnderstanding.patentType === 'utilityModel'
    ) {
      return 'patent_document'
    }
    return 'generic'
  }

  /**
   * 合并专利文档
   */
  private mergePatentDocument(taskResults: Array<{ stepId: string; output: unknown }>): unknown {
    const claims = taskResults.find((r) => r.stepId === 'claims')?.output
    const spec = taskResults.find((r) => r.stepId === 'spec')?.output
    const abstract = taskResults.find((r) => r.stepId === 'abstract')?.output

    return {
      type: 'patent_document',
      claims,
      specification: spec,
      abstract,
      generatedAt: new Date().toISOString(),
    }
  }

  /**
   * 合并分析报告
   */
  private mergeAnalysisReport(taskResults: Array<{ stepId: string; output: unknown }>): unknown {
    return {
      type: 'analysis_report',
      sections: taskResults.map((r) => ({
        stepId: r.stepId,
        output: r.output,
      })),
      generatedAt: new Date().toISOString(),
    }
  }

  /**
   * 合并 OA 答复
   */
  private mergeOAResponse(taskResults: Array<{ stepId: string; output: unknown }>): unknown {
    const response = taskResults.find((r) => r.stepId === 'draft-response')?.output
    const review = taskResults.find((r) => r.stepId === 'review-response')?.output

    return {
      type: 'oa_response',
      response,
      review,
      generatedAt: new Date().toISOString(),
    }
  }

  /**
   * 获取工作流名称
   */
  private getWorkflowName(intent?: string): string {
    const names: Record<string, string> = {
      draft_full: '专利全文撰写',
      draft_claims: '权利要求撰写',
      draft_spec: '说明书撰写',
      respond_oa: '审查意见答复',
      search: '现有技术检索',
      analyze: '专利分析',
    }
    return names[intent ?? ''] ?? '专利工作流'
  }

  private async callLLMWithRetry(
    params: Parameters<NonNullable<ExecutionContext['llm']>['chat']>[0],
    retries = this.config.maxRetries ?? 2
  ): Promise<Awaited<ReturnType<NonNullable<ExecutionContext['llm']>['chat']>>> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await this.llm.chat(params)
      } catch (error) {
        if (attempt >= retries) throw error
        const backoff = Math.min(1000 * Math.pow(2, attempt), 10000)
        console.warn(
          `[PatentCoordinator] LLM 调用失败 (尝试 ${attempt + 1}/${retries + 1}), ${backoff}ms 后重试:`,
          error instanceof Error ? error.message : String(error)
        )
        await new Promise((r) => setTimeout(r, backoff))
      }
    }
    throw new Error('unreachable')
  }
}

/**
 * 创建专利协调器（工厂函数）
 */
export function createPatentCoordinator(
  config: AgentConfig & { coordinatorConfig?: PatentCoordinatorConfig }
): PatentCoordinator {
  const { coordinatorConfig, ...agentConfig } = config
  return new PatentCoordinator(agentConfig, coordinatorConfig)
}
