/**
 * InteractiveWorkflow - 交互式工作流程管理器
 *
 * 实现人机协作的审查答复工作流程，参考 Athena 平台的设计理念
 *
 * 核心特性：
 * 1. 分步骤确认机制
 * 2. 实时预览功能
 * 3. 多轮对话修改
 * 4. 智能提示和建议
 * 5. 进度追踪和状态管理
 */

import type { LLMAdapter } from '@yunpat/core'
import type { OfficeActionInput } from './PatentResponderAgent.js'
import type { EnhancedResponseResult } from './EnhancedPatentResponderAgent.js'
import { EnhancedPatentResponderAgent } from './EnhancedPatentResponderAgent.js'

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
 * 交互式工作流程管理器
 */
export class InteractiveWorkflow {
  private agent: EnhancedPatentResponderAgent
  private config: Required<WorkflowConfig>
  private state: WorkflowState
  private feedbackRounds: number = 0

  constructor(agent: EnhancedPatentResponderAgent, config: WorkflowConfig = {}) {
    this.agent = agent
    this.config = {
      enableStepConfirmation: config.enableStepConfirmation ?? true,
      enableLivePreview: config.enableLivePreview ?? true,
      maxFeedbackRounds: config.maxFeedbackRounds ?? 3,
      timeout: config.timeout ?? 300000, // 5分钟
      onStepChange: config.onStepChange ?? (() => {}),
      onProgress: config.onProgress ?? (() => {}),
      onError: config.onError ?? (() => {}),
    }

    this.state = {
      currentStep: 'input',
      completedSteps: [],
      timestamp: new Date(),
    }

    console.log('🔄 [交互式工作流] 初始化完成')
    console.log(`   - 分步确认: ${this.config.enableStepConfirmation ? '✅' : '❌'}`)
    console.log(`   - 实时预览: ${this.config.enableLivePreview ? '✅' : '❌'}`)
    console.log(`   - 最大反馈轮数: ${this.config.maxFeedbackRounds}\n`)
  }

  /**
   * 启动工作流
   */
  async start(input: OfficeActionInput): Promise<EnhancedResponseResult> {
    console.log('\n🚀 [交互式工作流] 开始执行...')
    console.log(`   申请号: ${input.applicationNumber}`)
    console.log(`   专利名称: ${input.patentTitle}`)

    this.state.input = input
    this.state.timestamp = new Date()

    try {
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

      console.log('\n✅ [交互式工作流] 执行完成！')

      return this.state.finalResponse!
    } catch (error) {
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

    console.log('\n📋 步骤1: 审查意见分析')
    console.log('=' .repeat(50))

    // 执行分析
    const analysisResult = await this.analyzeOfficeAction()

    this.state.analysisResult = analysisResult

    // 显示分析结果
    this.displayAnalysisResult(analysisResult)

    // 确认（如果启用）
    if (this.config.enableStepConfirmation) {
      const confirmed = await this.waitForConfirmation('分析结果是否符合您的理解？')
      if (!confirmed) {
        console.log('⚠️ 请提供补充说明或修正...')
        // 这里可以实现多轮对话修正
      }
    }

    this.state.completedSteps.push('analysis')
    this.config.onProgress(25, '分析完成')
  }

  /**
   * 步骤2: 制定答复策略
   */
  private async executeStrategyStep(): Promise<void> {
    this.transitionTo('strategy')
    this.config.onProgress(30, '制定答复策略...')

    console.log('\n🎯 步骤2: 答复策略制定')
    console.log('=' .repeat(50))

    // 生成策略选项
    const strategyOptions = await this.generateStrategyOptions()

    this.state.strategyOptions = strategyOptions

    // 显示策略选项
    this.displayStrategyOptions(strategyOptions)

    // 选择策略
    const selectedStrategy = await this.selectStrategy(strategyOptions)

    this.state.selectedStrategy = selectedStrategy

    console.log(`\n✅ 已选择策略: ${selectedStrategy.strategy_type}`)

    this.state.completedSteps.push('strategy')
    this.config.onProgress(50, '策略制定完成')
  }

  /**
   * 步骤3: 起草答复
   */
  private async executeDraftingStep(): Promise<void> {
    this.transitionTo('drafting')
    this.config.onProgress(55, '起草答复文档...')

    console.log('\n✍️ 步骤3: 答复文档起草')
    console.log('=' .repeat(50))

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
  }

  /**
   * 步骤4: 审查答复
   */
  private async executeReviewStep(): Promise<void> {
    this.transitionTo('review')
    this.config.onProgress(80, '审查答复质量...')

    console.log('\n🔍 步骤4: 答复质量审查')
    console.log('=' .repeat(50))

    // 执行审查
    const reviewResult = await this.reviewResponse()

    this.state.reviewResult = reviewResult

    // 显示审查结果
    this.displayReviewResult(reviewResult)

    // 确认
    if (this.config.enableStepConfirmation) {
      const confirmed = await this.waitForConfirmation('审查通过，是否继续？')
      if (!confirmed) {
        console.log('⚠️ 根据审查意见进行改进...')
        await this.feedbackLoop('review')
      }
    }

    this.state.completedSteps.push('review')
    this.config.onProgress(90, '审查完成')
  }

  /**
   * 步骤5: 最终确定
   */
  private async executeFinalizationStep(): Promise<void> {
    this.transitionTo('finalization')
    this.config.onProgress(95, '最终确定答复...')

    console.log('\n🎉 步骤5: 最终确定')
    console.log('=' .repeat(50))

    // 生成最终答复
    const finalResponse = await this.generateFinalResponse()

    this.state.finalResponse = finalResponse

    // 显示最终结果
    this.displayFinalResult(finalResponse)

    // 保存案例到学习器
    await this.saveForLearning()

    this.state.completedSteps.push('finalization')
    this.transitionTo('completed')
    this.config.onProgress(100, '全部完成')
  }

  /**
   * 分析审查意见
   */
  private async analyzeOfficeAction(): Promise<any> {
    const input = this.state.input!

    // 调用智能体进行分析
    const analysis = {
      oaType: 'Novelty', // 简化示例
      severity: 'medium',
      keyIssues: [
        '对比文件D1公开了技术特征A和B',
        '权利要求1与D1的区别在于特征C',
      ],
      affectedClaims: [1, 2],
      citations: ['D1: CN123456789A'],
    }

    return analysis
  }

  /**
   * 显示分析结果
   */
  private displayAnalysisResult(result: any): void {
    console.log('\n📊 分析结果:')
    console.log(`   驳回类型: ${result.oaType}`)
    console.log(`   严重程度: ${result.severity}`)
    console.log(`   关键问题:`)
    result.keyIssues.forEach((issue: string, i: number) => {
      console.log(`     ${i + 1}. ${issue}`)
    })
    console.log(`   受影响权利要求: ${result.affectedClaims.join(', ')}`)
    console.log(`   引用文献: ${result.citations.join(', ')}`)
  }

  /**
   * 生成策略选项
   */
  private async generateStrategyOptions(): Promise<any[]> {
    return [
      {
        strategy_type: 'AmendClaims',
        reasoning: '通过修改权利要求来克服驳回',
        confidence: 0.85,
        successProbability: 75,
        riskLevel: 'low',
      },
      {
        strategy_type: 'Hybrid',
        reasoning: '修改权利要求同时进行争辩',
        confidence: 0.78,
        successProbability: 68,
        riskLevel: 'medium',
      },
      {
        strategy_type: 'Argue',
        reasoning: '通过争辩反驳审查员观点',
        confidence: 0.65,
        successProbability: 55,
        riskLevel: 'high',
      },
    ]
  }

  /**
   * 显示策略选项
   */
  private displayStrategyOptions(options: any[]): void {
    console.log('\n🎯 答复策略选项:')
    options.forEach((option, i) => {
      console.log(`\n   [选项 ${i + 1}] ${option.strategy_type}`)
      console.log(`   理由: ${option.reasoning}`)
      console.log(`   置信度: ${(option.confidence * 100).toFixed(0)}%`)
      console.log(`   成功率预测: ${option.successProbability}%`)
      console.log(`   风险等级: ${option.riskLevel}`)
    })
  }

  /**
   * 选择策略
   */
  private async selectStrategy(options: any[]): Promise<any> {
    // 在实际应用中，这里应该等待用户输入
    // 简化版本：自动选择成功率最高的策略
    const bestOption = options.reduce((best, current) =>
      current.successProbability > best.successProbability ? current : best
    )

    console.log(`\n💡 推荐: 选择成功率最高的策略`)
    return bestOption
  }

  /**
   * 生成答复草稿
   */
  private async generateDraftResponse(): Promise<any> {
    return {
      writtenArgument: '意见陈述书草稿内容...',
      amendedClaims: ['1. 一种...', '2. 根据权利要求1所述的...'],
      amendmentComparison: '修改对照内容...',
      responseStrategy: this.state.selectedStrategy?.strategy_type || 'Hybrid',
    }
  }

  /**
   * 显示草稿预览
   */
  private displayDraftPreview(draft: any): void {
    console.log('\n📝 答复草稿预览:')
    console.log(`   策略类型: ${draft.responseStrategy}`)
    console.log(`   意见陈述书长度: ${draft.writtenArgument.length} 字`)
    console.log(`   修改权利要求数: ${draft.amendedClaims.length}`)
    console.log(`\n   意见陈述书摘要:`)
    console.log(`   ${draft.writtenArgument.substring(0, 100)}...`)
  }

  /**
   * 审查答复
   */
  private async reviewResponse(): Promise<any> {
    return {
      overallScore: 78,
      strengths: ['论点清晰', '修改合理'],
      weaknesses: ['技术效果论述不够充分'],
      suggestions: ['补充技术效果的实验数据'],
      riskAssessment: {
        level: 'medium',
        factors: ['成功率中等', '存在二次审查风险'],
      },
    }
  }

  /**
   * 显示审查结果
   */
  private displayReviewResult(review: any): void {
    console.log('\n🔍 审查结果:')
    console.log(`   总体评分: ${review.overallScore}/100`)
    console.log(`   优势: ${review.strengths.join(', ')}`)
    console.log(`   劣势: ${review.weaknesses.join(', ')}`)
    console.log(`   建议: ${review.suggestions.join(', ')}`)
    console.log(`   风险评估: ${review.riskAssessment.level}`)
    console.log(`   风险因素: ${review.riskAssessment.factors.join(', ')}`)
  }

  /**
   * 反馈循环
   */
  private async feedbackLoop(step: string): Promise<void> {
    if (this.feedbackRounds >= this.config.maxFeedbackRounds) {
      console.log(`\n⚠️ 已达到最大反馈轮数 (${this.config.maxFeedbackRounds})`)
      return
    }

    console.log('\n💬 反馈环节')
    console.log(`   您可以提出修改建议（输入"继续"跳过）:`)

    // 在实际应用中，这里应该等待用户输入
    // 简化版本：模拟一次反馈
    this.feedbackRounds++

    console.log('   （演示模式：跳过用户反馈）')
  }

  /**
   * 生成最终答复
   */
  private async generateFinalResponse(): Promise<EnhancedResponseResult> {
    // 整合所有步骤的结果
    const finalResponse: EnhancedResponseResult = {
      responseStrategy: {
        type: this.state.selectedStrategy?.strategy_type || 'Hybrid',
        arguments: [],
        suggestedAmendments: [],
      },
      response: {
        writtenArgument: this.state.draftResponse?.writtenArgument || '',
        amendedClaims: this.state.draftResponse?.amendedClaims || [],
        amendmentComparison: this.state.draftResponse?.amendmentComparison || '',
      },
      metrics: {
        allowanceProbability: this.state.reviewResult?.overallScore || 75,
        qualityScore: this.state.reviewResult?.overallScore || 75,
        examinerAcceptance: (this.state.reviewResult?.overallScore || 75) * 0.95,
      },
      iterationHistory: [],
      finalRecommendations: [
        '答复质量良好，建议提交',
        '注意后续审查意见的跟进',
      ],
    }

    return finalResponse
  }

  /**
   * 显示最终结果
   */
  private displayFinalResult(result: EnhancedResponseResult): void {
    console.log('\n🎉 最终答复结果:')
    console.log('=' .repeat(50))
    console.log(`\n📊 核心指标:`)
    console.log(`   授权成功率预测: ${result.metrics.allowanceProbability.toFixed(2)}%`)
    console.log(`   答复质量评分: ${result.metrics.qualityScore.toFixed(2)}/100`)
    console.log(`   审查员接受概率: ${result.metrics.examinerAcceptance.toFixed(2)}%`)

    console.log(`\n📁 输出文件:`)
    console.log(`   1. 意见陈述书 (${result.response.writtenArgument.length} 字)`)
    console.log(`   2. 修改后的权利要求 (${result.response.amendedClaims.length} 项)`)
    console.log(`   3. 修改对照页`)

    console.log(`\n💡 最终建议:`)
    result.finalRecommendations.forEach((rec, i) => {
      console.log(`   ${i + 1}. ${rec}`)
    })
  }

  /**
   * 保存案例到学习器
   */
  private async saveForLearning(): Promise<void> {
    const caseId = `case-${Date.now()}`

    try {
      await this.agent.saveCaseForLearning(
        caseId,
        this.state.input!,
        this.state.selectedStrategy
      )

      console.log(`\n💾 案例已保存: ${caseId}`)
      console.log(`   提示: 收到审查结果后，可以使用 learnFromFeedback() 方法进行反馈学习`)
    } catch (error) {
      console.warn(`   ⚠️ 案例保存失败: ${(error as Error).message}`)
    }
  }

  /**
   * 等待用户确认
   */
  private async waitForConfirmation(prompt: string): Promise<boolean> {
    console.log(`\n❓ ${prompt}`)
    console.log(`   [演示模式: 自动确认]`)
    return true // 演示模式自动确认
  }

  /**
   * 转换到下一个步骤
   */
  private transitionTo(step: WorkflowStep): void {
    const previousStep = this.state.currentStep
    this.state.currentStep = step

    console.log(`\n➡️  步骤转换: ${previousStep} → ${step}`)

    this.config.onStepChange(step, this.state)
  }

  /**
   * 获取当前状态
   */
  getState(): WorkflowState {
    return { ...this.state }
  }

  /**
   * 获取进度百分比
   */
  getProgress(): number {
    const totalSteps = 5 // input, analysis, strategy, drafting, review, finalization
    const completedSteps = this.state.completedSteps.length
    return (completedSteps / totalSteps) * 100
  }

  /**
   * 重置工作流
   */
  reset(): void {
    this.state = {
      currentStep: 'input',
      completedSteps: [],
      timestamp: new Date(),
    }
    this.feedbackRounds = 0

    console.log('\n🔄 [交互式工作流] 已重置')
  }
}

/**
 * 创建交互式工作流（工厂函数）
 */
export async function createInteractiveWorkflow(
  agent: EnhancedPatentResponderAgent,
  config?: WorkflowConfig
): Promise<InteractiveWorkflow> {
  return new InteractiveWorkflow(agent, config)
}
