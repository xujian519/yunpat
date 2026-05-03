/**
 * InteractiveWorkflow - 交互式工作流程管理器（重构版）
 *
 * 实现人机协作的审查答复工作流程
 *
 * v2.0 更新：
 * - 使用 v2 版本的 EnhancedPatentResponderAgent
 * - 添加输入验证
 * - 结构化错误处理
 * - 集成日志系统
 * - 集成性能监控
 * - 使用常量管理
 */

// 导入基础设施
import type { LLMAdapter } from '../../core/llm-types.js'
import {
  OAResponderError,
  ValidationError,
} from '../../core/errors.js'
import {
  WORKFLOW_CONSTANTS,
} from '../../core/constants.js'
import {
  validateConfig,
} from '../../core/validators.js'
import {
  createModuleLogger,
  StructuredLogger,
} from '../../core/logger.js'
import { PerformanceMonitor } from '../../core/performance-monitor.js'

// 导入原有类型
import type { OfficeActionInput } from './PatentResponderAgent.js'
import type { EnhancedResponseResult } from './EnhancedPatentResponderAgent.js'

// 导入 v2 版本的模块
import { EnhancedPatentResponderAgent } from './EnhancedPatentResponderAgent.v2.js'

/**
 * 工作流步骤
 */
export type WorkflowStep =
  | 'input'
  | 'analysis'
  | 'strategy'
  | 'drafting'
  | 'review'
  | 'finalization'
  | 'completed'

/**
 * 工作流状态
 */
export interface WorkflowState {
  currentStep: WorkflowStep
  completedSteps: WorkflowStep[]
  input?: OfficeActionInput
  analysisResult?: any
  strategyOptions?: any[]
  selectedStrategy?: any
  draftResponse?: any
  reviewResult?: any
  finalResponse?: EnhancedResponseResult
  userFeedback?: string[]
  timestamp: Date
}

/**
 * 交互选项
 */
export interface InteractionOption {
  id: string
  label: string
  description: string
  action: () => Promise<any>
  confirmRequired?: boolean
}

/**
 * 工作流配置
 */
export interface WorkflowConfig {
  /** 是否启用分步确认 */
  enableStepConfirmation?: boolean

  /** 是否启用实时预览 */
  enableLivePreview?: boolean

  /** 最大反馈轮数 */
  maxFeedbackRounds?: number

  /** 超时时间（毫秒） */
  timeout?: number

  /** 回调函数 */
  onStepChange?: (step: WorkflowStep, state: WorkflowState) => void
  onProgress?: (progress: number, message: string) => void
  onError?: (error: Error) => void
}

/**
 * 交互式工作流程管理器（重构版）
 */
export class InteractiveWorkflow {
  private agent: EnhancedPatentResponderAgent
  private config: Required<WorkflowConfig>
  private state: WorkflowState
  private feedbackRounds: number = 0
  private logger: StructuredLogger
  private perfMonitor: PerformanceMonitor

  constructor(llm: LLMAdapter, config: WorkflowConfig = {}) {
    // 验证配置（简化版本）
    if (config.maxFeedbackRounds !== undefined && (config.maxFeedbackRounds < 1 || config.maxFeedbackRounds > 10)) {
      throw new ValidationError('maxFeedbackRounds 必须在 1-10 之间', 'maxFeedbackRounds', config.maxFeedbackRounds)
    }

    if (config.timeout !== undefined && (config.timeout < 1000 || config.timeout > 3600000)) {
      throw new ValidationError('timeout 必须在 1000-3600000 之间', 'timeout', config.timeout)
    }

    this.config = {
      enableStepConfirmation: config.enableStepConfirmation ?? true,
      enableLivePreview: config.enableLivePreview ?? true,
      maxFeedbackRounds: config.maxFeedbackRounds ?? WORKFLOW_CONSTANTS.DEFAULT_MAX_FEEDBACK_ROUNDS,
      timeout: config.timeout ?? WORKFLOW_CONSTANTS.DEFAULT_TIMEOUT,
      onStepChange: config.onStepChange ?? (() => {}),
      onProgress: config.onProgress ?? (() => {}),
      onError: config.onError ?? (() => {}),
    }

    // 创建智能体
    this.agent = new EnhancedPatentResponderAgent(llm, {})

    // 创建日志器
    this.logger = new StructuredLogger('InteractiveWorkflow')

    // 创建性能监控器
    this.perfMonitor = new PerformanceMonitor()

    // 初始化状态
    this.state = {
      currentStep: 'input',
      completedSteps: [],
      timestamp: new Date(),
    }

    this.logger.info('InteractiveWorkflow 初始化完成', {
      enableStepConfirmation: this.config.enableStepConfirmation,
      enableLivePreview: this.config.enableLivePreview,
      maxFeedbackRounds: this.config.maxFeedbackRounds,
      timeout: this.config.timeout,
    })
  }

  /**
   * 启动工作流
   */
  async start(input: OfficeActionInput): Promise<EnhancedResponseResult> {
    // 输入验证
    this.validateInput(input)

    this.logger.logOperationStart('交互式工作流', {
      applicationNumber: input.applicationNumber,
      patentTitle: input.patentTitle,
    })

    this.state.input = input
    this.state.timestamp = new Date()

    try {
      const result = await this.perfMonitor.measure(
        '交互式工作流完整流程',
        async () => {
          // 步骤1: 分析审查意见
          await this.executeAnalysisStep()

          // 步骤2: 制定答复策略
          await this.executeStrategyStep()

          // 步骤3: 起草答复
          await this.executeDraftingStep()

          // 步骤4: 审查答复
          await this.executeReviewStep()

          // 步骤5: 最终确定
          await this.executeFinalizationStep()

          return this.state.finalResponse!
        }
      )

      this.logger.logOperationEnd('交互式工作流', {
        completedSteps: this.state.completedSteps.length,
        feedbackRounds: this.feedbackRounds,
      })

      return result
    } catch (error) {
      this.logger.logOperationFailure('交互式工作流', error as Error)
      this.config.onError(error as Error)
      throw error
    }
  }

  /**
   * 步骤1: 分析审查意见
   */
  private async executeAnalysisStep(): Promise<void> {
    this.transitionTo('analysis')
    this.config.onProgress(10, '分析审查意见...')

    this.logger.info('开始审查意见分析')

    try {
      // 执行分析
      const analysisResult = await this.analyzeOfficeAction()

      this.state.analysisResult = analysisResult

      // 显示分析结果
      this.displayAnalysisResult(analysisResult)

      // 确认（如果启用）
      if (this.config.enableStepConfirmation) {
        const confirmed = await this.waitForConfirmation('分析结果是否符合您的理解？')
        if (!confirmed) {
          this.logger.warn('用户对分析结果不满意，需要补充说明')
          // 这里可以实现多轮对话修正
        }
      }

      this.state.completedSteps.push('analysis')
      this.config.onProgress(25, '分析完成')

      this.logger.info('审查意见分析完成')
    } catch (error) {
      this.logger.error('审查意见分析失败', error as Error)
      throw new OAResponderError(
        '审查意见分析失败',
        'InteractiveWorkflow',
        'executeAnalysisStep',
        { cause: error }
      )
    }
  }

  /**
   * 步骤2: 制定答复策略
   */
  private async executeStrategyStep(): Promise<void> {
    this.transitionTo('strategy')
    this.config.onProgress(30, '制定答复策略...')

    this.logger.info('开始答复策略制定')

    try {
      // 生成策略选项
      const strategyOptions = await this.generateStrategyOptions()

      this.state.strategyOptions = strategyOptions

      // 显示策略选项
      this.displayStrategyOptions(strategyOptions)

      // 选择策略
      const selectedStrategy = await this.selectStrategy(strategyOptions)

      this.state.selectedStrategy = selectedStrategy

      this.logger.info('策略选择完成', {
        selectedStrategy: selectedStrategy.strategy_type,
      })

      this.state.completedSteps.push('strategy')
      this.config.onProgress(50, '策略制定完成')

      this.logger.info('答复策略制定完成')
    } catch (error) {
      this.logger.error('答复策略制定失败', error as Error)
      throw new OAResponderError(
        '答复策略制定失败',
        'InteractiveWorkflow',
        'executeStrategyStep',
        { cause: error }
      )
    }
  }

  /**
   * 步骤3: 起草答复
   */
  private async executeDraftingStep(): Promise<void> {
    this.transitionTo('drafting')
    this.config.onProgress(55, '起草答复文档...')

    this.logger.info('开始答复文档起草')

    try {
      // 生成答复草稿
      const draftResponse = await this.generateDraftResponse()

      this.state.draftResponse = draftResponse

      // 显示草稿预览
      this.displayDraftPreview(draftResponse)

      // 反馈循环
      if (this.config.enableStepConfirmation) {
        await this.feedbackLoop('drafting')
      }

      this.state.completedSteps.push('drafting')
      this.config.onProgress(75, '起草完成')

      this.logger.info('答复文档起草完成')
    } catch (error) {
      this.logger.error('答复文档起草失败', error as Error)
      throw new OAResponderError(
        '答复文档起草失败',
        'InteractiveWorkflow',
        'executeDraftingStep',
        { cause: error }
      )
    }
  }

  /**
   * 步骤4: 审查答复
   */
  private async executeReviewStep(): Promise<void> {
    this.transitionTo('review')
    this.config.onProgress(80, '审查答复质量...')

    this.logger.info('开始答复质量审查')

    try {
      // 执行审查
      const reviewResult = await this.reviewResponse()

      this.state.reviewResult = reviewResult

      // 显示审查结果
      this.displayReviewResult(reviewResult)

      // 确认（如果启用）
      if (this.config.enableStepConfirmation) {
        const confirmed = await this.waitForConfirmation('审查结果是否满意？')
        if (!confirmed) {
          this.logger.warn('用户对审查结果不满意，可能需要重新起草')
        }
      }

      this.state.completedSteps.push('review')
      this.config.onProgress(90, '审查完成')

      this.logger.info('答复质量审查完成')
    } catch (error) {
      this.logger.error('答复质量审查失败', error as Error)
      throw new OAResponderError(
        '答复质量审查失败',
        'InteractiveWorkflow',
        'executeReviewStep',
        { cause: error }
      )
    }
  }

  /**
   * 步骤5: 最终确定
   */
  private async executeFinalizationStep(): Promise<void> {
    this.transitionTo('finalization')
    this.config.onProgress(95, '最终确定答复...')

    this.logger.info('开始最终确定答复')

    try {
      // 生成最终答复
      const finalResponse = await this.generateFinalResponse()

      this.state.finalResponse = finalResponse

      // 显示最终答复
      this.displayFinalResponse(finalResponse)

      this.state.completedSteps.push('finalization')
      this.transitionTo('completed')

      this.config.onProgress(100, '工作流完成')

      this.logger.info('最终答复确定完成')
    } catch (error) {
      this.logger.error('最终答复确定失败', error as Error)
      throw new OAResponderError(
        '最终答复确定失败',
        'InteractiveWorkflow',
        'executeFinalizationStep',
        { cause: error }
      )
    }
  }

  /**
   * 分析审查意见
   */
  private async analyzeOfficeAction(): Promise<any> {
    this.logger.debug('执行审查意见分析')
    // 简化实现
    return {
      oaType: 'Novelty',
      severity: 'medium',
      keyIssues: ['新颖性问题'],
    }
  }

  /**
   * 生成策略选项
   */
  private async generateStrategyOptions(): Promise<any[]> {
    this.logger.debug('生成策略选项')
    // 简化实现
    return [
      { strategy_type: 'amendment', confidence: 0.8 },
      { strategy_type: 'argument', confidence: 0.6 },
      { strategy_type: 'combination', confidence: 0.9 },
    ]
  }

  /**
   * 选择策略
   */
  private async selectStrategy(options: any[]): Promise<any> {
    this.logger.debug('选择策略', { optionCount: options.length })
    // 简化实现：选择置信度最高的
    return options.reduce((best, current) =>
      current.confidence > best.confidence ? current : best
    )
  }

  /**
   * 生成答复草稿
   */
  private async generateDraftResponse(): Promise<any> {
    this.logger.debug('生成答复草稿')
    // 简化实现
    return {
      writtenArgument: '意见陈述书草稿...',
      amendedClaims: [],
      amendmentComparison: '修改对照...',
    }
  }

  /**
   * 审查答复
   */
  private async reviewResponse(): Promise<any> {
    this.logger.debug('审查答复质量')
    // 简化实现
    return {
      quality: 85,
      issues: [],
      suggestions: ['建议补充技术效果说明'],
    }
  }

  /**
   * 生成最终答复
   */
  private async generateFinalResponse(): Promise<EnhancedResponseResult> {
    this.logger.debug('生成最终答复')

    if (!this.state.input) {
      throw new ValidationError('缺少输入数据', 'input', undefined)
    }

    return await this.agent.execute(this.state.input)
  }

  /**
   * 反馈循环
   */
  private async feedbackLoop(step: string): Promise<void> {
    this.logger.debug('进入反馈循环', { step })

    this.feedbackRounds = 0

    while (this.feedbackRounds < this.config.maxFeedbackRounds) {
      const satisfied = await this.waitForConfirmation('是否满意当前结果？')
      if (satisfied) {
        break
      }

      this.feedbackRounds++
      this.logger.info('反馈循环', {
        round: this.feedbackRounds,
        maxRounds: this.config.maxFeedbackRounds,
      })

      // 这里可以实现基于用户反馈的改进
    }

    this.logger.debug('反馈循环结束', {
      totalRounds: this.feedbackRounds,
    })
  }

  /**
   * 等待用户确认
   */
  private async waitForConfirmation(message: string): Promise<boolean> {
    this.logger.debug('等待用户确认', { message })
    // 简化实现：实际应该通过 UI 或命令行交互
    return true
  }

  /**
   * 转换到指定步骤
   */
  private transitionTo(step: WorkflowStep): void {
    this.state.currentStep = step
    this.logger.debug('工作流状态转换', {
      from: this.state.currentStep,
      to: step,
    })
    this.config.onStepChange(step, this.state)
  }

  /**
   * 显示分析结果
   */
  private displayAnalysisResult(result: any): void {
    this.logger.info('审查意见分析结果', {
      oaType: result.oaType,
      severity: result.severity,
      keyIssues: result.keyIssues,
    })
  }

  /**
   * 显示策略选项
   */
  private displayStrategyOptions(options: any[]): void {
    this.logger.info('答复策略选项', {
      count: options.length,
      options: options.map((o) => ({
        type: o.strategy_type,
        confidence: o.confidence,
      })),
    })
  }

  /**
   * 显示草稿预览
   */
  private displayDraftPreview(draft: any): void {
    this.logger.info('答复草稿预览', {
      hasWrittenArgument: !!draft.writtenArgument,
      hasAmendedClaims: !!draft.amendedClaims,
      hasAmendmentComparison: !!draft.amendmentComparison,
    })
  }

  /**
   * 显示审查结果
   */
  private displayReviewResult(review: any): void {
    this.logger.info('答复质量审查结果', {
      quality: review.quality,
      issuesCount: review.issues?.length ?? 0,
      suggestionsCount: review.suggestions?.length ?? 0,
    })
  }

  /**
   * 显示最终答复
   */
  private displayFinalResponse(response: EnhancedResponseResult): void {
    this.logger.info('最终答复生成完成', {
      hasWrittenArgument: !!response.writtenArgument,
      hasAmendedClaims: !!response.amendedClaims,
      iterationHistoryLength: response.iterationHistory?.length ?? 0,
    })
  }

  /**
   * 验证输入
   */
  private validateInput(input: OfficeActionInput): void {
    if (!input) {
      throw new ValidationError('输入不能为空', 'input', input)
    }

    if (!input.applicationNumber) {
      throw new ValidationError('申请号不能为空', 'applicationNumber', input.applicationNumber)
    }

    if (!input.patentTitle) {
      throw new ValidationError('专利名称不能为空', 'patentTitle', input.patentTitle)
    }

    if (!input.officeAction && !input.claims) {
      throw new ValidationError('必须提供审查意见或权利要求', 'input', input)
    }
  }

  /**
   * 获取当前状态
   */
  getState(): WorkflowState {
    return { ...this.state }
  }

  /**
   * 获取性能统计
   */
  getPerformanceStats() {
    return this.perfMonitor.getAllStats()
  }

  /**
   * 打印性能报告
   */
  printPerformanceReport() {
    this.perfMonitor.printReport()
  }
}
