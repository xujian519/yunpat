/**
 * ExaminerSimulator - 审查员模拟器（重构版）
 *
 * 模拟审查员对答复文档的反应，预测接受概率和潜在问题
 *
 * v2.0 更新：
 * - 使用严格的类型系统
 * - 添加输入验证
 * - 结构化错误处理
 * - 集成日志系统
 * - 集成性能监控
 */

// 导入基础设施
import type {
  LLMAdapter,
  LLMResponse,
  StructuredOutputSchema,
} from '../../core/llm-types.js'
import {
  ExaminerSimulatorError,
  LLMInvokeError,
} from '../../core/errors.js'
import {
  EXAMINER_CONSTANTS,
  VALIDATION_CONSTANTS,
} from '../../core/constants.js'
import {
  validateOfficeAction,
  validateResponseDocument,
  validateScore,
} from '../../core/validators.js'
import { LLMHelper } from '../../core/llm-helper.js'
import {
  createModuleLogger,
  StructuredLogger,
} from '../../core/logger.js'
import { PerformanceMonitor } from '../../core/performance-monitor.js'

// 导入原有类型
import type { OfficeAction } from '../../core/PatentCoreBridge.js'

/**
 * 答复文档
 */
export interface ResponseDocument {
  /** 意见陈述书 */
  writtenArgument: string

  /** 修改后的权利要求 */
  amendedClaims: string[]

  /** 修改对照页 */
  amendmentComparison: string

  /** 答复策略类型 */
  responseStrategy: 'amendment' | 'argument' | 'combination'
}

/**
 * 审查员模拟结果
 */
export interface ExaminerSimulationResult {
  /** 接受概率（0-100） */
  acceptProbability: number

  /** 可能的二次审查意见 */
  likelyRejections: Array<{
    type: string
    reason: string
    severity: 'high' | 'medium' | 'low'
  }>

  /** 改进建议 */
  suggestions: string[]

  /** 风险评估 */
  riskAssessment: {
    level: 'low' | 'medium' | 'high'
    factors: string[]
  }

  /** 详细分析报告 */
  analysisReport: string
}

/**
 * 策略分析结果（内部使用）
 */
interface StrategyAnalysisResult {
  effectiveness: number
  reasoning: string
}

/**
 * 修改质量评估结果（内部使用）
 */
interface AmendmentQualityResult {
  quality: number
  issues: string[]
}

/**
 * 审查员模拟器配置
 */
export interface ExaminerSimulatorConfig {
  /** 严格程度（0-1，默认0.7） */
  strictness?: number

  /** 是否启用保守模式 */
  conservativeMode?: boolean

  /** 领域专长（可选） */
  domainExpertise?: string[]
}

/**
 * 审查员模拟器（重构版）
 */
export class ExaminerSimulator {
  private llm: LLMAdapter
  private config: Required<ExaminerSimulatorConfig>
  private logger: StructuredLogger
  private perfMonitor: PerformanceMonitor

  constructor(llm: LLMAdapter, config: ExaminerSimulatorConfig = {}) {
    this.llm = llm
    this.config = {
      strictness: config.strictness ?? 0.7,
      conservativeMode: config.conservativeMode ?? false,
      domainExpertise: config.domainExpertise ?? [],
    }

    // 创建日志器
    this.logger = new StructuredLogger('ExaminerSimulator')

    // 创建性能监控器
    this.perfMonitor = new PerformanceMonitor()

    this.logger.info('ExaminerSimulator 初始化完成', {
      strictness: this.config.strictness,
      conservativeMode: this.config.conservativeMode,
    })
  }

  /**
   * 模拟审查员审查答复文档
   */
  async simulateReview(
    officeAction: OfficeAction,
    responseDocument: ResponseDocument
  ): Promise<ExaminerSimulationResult> {
    // 1. 输入验证
    validateOfficeAction(officeAction)
    validateResponseDocument(responseDocument)

    this.logger.logOperationStart('模拟审查', {
      oaType: officeAction.oa_type,
      strategy: responseDocument.responseStrategy,
    })

    // 2. 性能监控的完整执行
    try {
      const result = await this.perfMonitor.measure(
        '审查员模拟',
        async () => await this.executeSimulation(officeAction, responseDocument)
      )

      this.logger.logOperationEnd('模拟审查', {
        acceptProbability: result.acceptProbability,
        riskLevel: result.riskAssessment.level,
      })

      return result
    } catch (error) {
      this.logger.logOperationFailure('模拟审查', error as Error)
      throw error
    }
  }

  /**
   * 执行模拟（内部方法）
   */
  private async executeSimulation(
    officeAction: OfficeAction,
    responseDocument: ResponseDocument
  ): Promise<ExaminerSimulationResult> {
    // 1. 分析答复策略的有效性
    const strategyAnalysis = await this.analyzeStrategyEffectiveness(
      officeAction,
      responseDocument
    )

    // 2. 评估权利要求修改质量
    const amendmentQuality = await this.assessAmendmentQuality(
      officeAction,
      responseDocument
    )

    // 3. 识别潜在的二次驳回理由
    const likelyRejections = await this.identifyLikelyRejections(
      officeAction,
      responseDocument
    )

    // 4. 计算接受概率
    const acceptProbability = this.calculateAcceptProbability(
      strategyAnalysis,
      amendmentQuality,
      likelyRejections
    )

    // 5. 生成改进建议
    const suggestions = await this.generateSuggestions(
      officeAction,
      responseDocument,
      likelyRejections
    )

    // 6. 风险评估
    const riskAssessment = this.assessRisk(acceptProbability, likelyRejections)

    // 7. 生成详细分析报告
    const analysisReport = await this.generateAnalysisReport(
      officeAction,
      responseDocument,
      acceptProbability,
      likelyRejections,
      suggestions
    )

    this.logger.debug('模拟完成', {
      acceptProbability,
      rejectionsCount: likelyRejections.length,
      suggestionsCount: suggestions.length,
    })

    return {
      acceptProbability,
      likelyRejections,
      suggestions,
      riskAssessment,
      analysisReport,
    }
  }

  /**
   * 分析答复策略的有效性
   */
  private async analyzeStrategyEffectiveness(
    officeAction: OfficeAction,
    responseDocument: ResponseDocument
  ): Promise<StrategyAnalysisResult> {
    this.logger.debug('开始分析策略有效性')

    try {
      // 使用结构化输出
      const result = await LLMHelper.structuredChat<{
        effectiveness: number
        reasoning: string
      }>(
        this.llm,
        `你是一位资深的专利审查员，请评估以下答复策略的有效性。

审查意见类型：${officeAction.oa_type}
审查员论点：${officeAction.examiner_arguments.substring(
          0,
          EXAMINER_CONSTANTS.DEFAULT_EFFECTIVENESS_SCORE
        )}

答复策略：${responseDocument.responseStrategy}
意见陈述书摘要：${responseDocument.writtenArgument.substring(0, 800)}

请评估：
1. 答复策略是否有效回应了审查员的关切？
2. 论点是否有说服力？
3. 是否充分回应了驳回理由？`,
        {
          effectiveness: {
            type: 'number',
            description: '评分 (0-100)',
          },
          reasoning: {
            type: 'string',
            description: '评估理由',
          },
        },
        {
          retryConfig: {
            maxAttempts: 3,
            onRetry: (attempt, error) => {
              this.logger.warn('LLM 重试', {
                attempt,
                error: (error as Error).message,
              })
            },
          },
        }
      )

      // 验证返回值
      const effectiveness = validateScore(
        result.effectiveness,
        0,
        100,
        '策略有效性评分'
      )

      this.logger.debug('策略分析完成', { effectiveness })

      return {
        effectiveness,
        reasoning: result.reasoning,
      }
    } catch (error) {
      // LLM 调用失败，使用默认值
      this.logger.error('策略分析失败，使用默认值', error as Error)

      throw new LLMInvokeError(
        '策略分析失败',
        'ExaminerSimulator',
        'analyzeStrategyEffectiveness',
        { cause: error }
      )
    }
  }

  /**
   * 评估权利要求修改质量
   */
  private async assessAmendmentQuality(
    officeAction: OfficeAction,
    responseDocument: ResponseDocument
  ): Promise<AmendmentQualityResult> {
    this.logger.debug('开始评估修改质量')

    // 纯争辩策略，无修改
    if (responseDocument.responseStrategy === 'argument') {
      this.logger.debug('纯争辩策略，无需评估修改')

      return {
        quality: EXAMINER_CONSTANTS.DEFAULT_QUALITY_SCORE,
        issues: ['未修改权利要求，可能存在授权范围问题'],
      }
    }

    try {
      // 使用结构化输出
      const result = await LLMHelper.structuredChat<{
        quality: number
        issues: string[]
      }>(
        this.llm,
        `请评估以下权利要求修改的质量。

受影响权利要求：${officeAction.affected_claims.join(', ')}

修改后的权利要求：
${responseDocument.amendedClaims.slice(0, 3).join('\n')}

修改对照：
${responseDocument.amendmentComparison.substring(0, 500)}

评估标准：
1. 修改是否清楚、明确？
2. 是否得到说明书支持？
3. 是否缩小了保护范围？
4. 是否克服了驳回理由？`,
        {
          quality: {
            type: 'number',
            description: '质量评分 (0-100)',
          },
          issues: {
            type: 'array',
            description: '问题列表',
            items: {
              type: 'string',
            },
          },
        }
      )

      // 验证返回值
      const quality = validateScore(result.quality, 0, 100, '修改质量评分')

      // 验证问题列表
      if (!Array.isArray(result.issues)) {
        throw new Error('issues 必须是数组')
      }

      this.logger.debug('修改质量评估完成', { quality })

      return {
        quality,
        issues: result.issues,
      }
    } catch (error) {
      // LLM 调用失败
      this.logger.error('修改质量评估失败，使用默认值', error as Error)

      throw new LLMInvokeError(
        '修改质量评估失败',
        'ExaminerSimulator',
        'assessAmendmentQuality',
        { cause: error }
      )
    }
  }

  /**
   * 识别可能的二次审查意见
   */
  private async identifyLikelyRejections(
    officeAction: OfficeAction,
    responseDocument: ResponseDocument
  ): Promise<
    Array<{ type: string; reason: string; severity: 'high' | 'medium' | 'low' }>
  > {
    this.logger.debug('开始识别潜在驳回理由')

    try {
      // 使用结构化输出
      const result = await LLMHelper.structuredChat<{
        rejections: Array<{
          type: string
          reason: string
          severity: 'high' | 'medium' | 'low'
        }>
      }>(
        this.llm,
        `你是一位资深的专利审查员，请预测以下答复可能引发的二次审查意见。

原驳回理由：
${officeAction.examiner_arguments.substring(0, 800)}

答复策略：${responseDocument.responseStrategy}
修改后的权利要求：
${responseDocument.amendedClaims.slice(0, 2).join('\n')}

请预测可能的二次驳回理由，包括：
1. 新颖性问题（A22.2）
2. 创造性问题（A22.3）
3. 清楚性问题（A26.4）
4. 支持性问题（A26.4）
5. 修改超范围（A33）

对每个预测，给出驳回类型、理由和严重程度（high/medium/low）。`,
        {
          rejections: {
            type: 'array',
            description: '驳回理由列表',
            items: {
              type: 'object',
              properties: {
                type: {
                  type: 'string',
                  description: '驳回类型',
                },
                reason: {
                  type: 'string',
                  description: '驳回理由',
                },
                severity: {
                  type: 'string',
                  enum: ['high', 'medium', 'low'],
                  description: '严重程度',
                },
              },
              required: ['type', 'reason', 'severity'],
            },
          },
        }
      )

      this.logger.debug('潜在驳回理由识别完成', {
        count: result.rejections.length,
      })

      // 限制返回数量
      return result.rejections.slice(0, EXAMINER_CONSTANTS.MAX_REJECTIONS)
    } catch (error) {
      // LLM 调用失败，返回默认预测
      this.logger.error('驳回理由识别失败，使用默认值', error as Error)

      return [
        {
          type: '创造性问题',
          reason: '修改后的技术方案可能仍然被认为是显而易见的',
          severity: 'medium',
        },
      ]
    }
  }

  /**
   * 计算接受概率
   */
  private calculateAcceptProbability(
    strategyAnalysis: StrategyAnalysisResult,
    amendmentQuality: AmendmentQualityResult,
    likelyRejections: Array<{ severity: string }>
  ): number {
    let probability = EXAMINER_CONSTANTS.BASE_ACCEPT_PROBABILITY

    // 策略有效性权重
    probability +=
      strategyAnalysis.effectiveness *
        EXAMINER_CONSTANTS.STRATEGY_EFFECTIVENESS_WEIGHT -
      20

    // 修改质量权重
    probability +=
      amendmentQuality.quality *
      EXAMINER_CONSTANTS.AMENDMENT_QUALITY_WEIGHT -
      15

    // 潜在问题扣分
    const highSeverityCount = likelyRejections.filter(
      (r) => r.severity === 'high'
    ).length
    const mediumSeverityCount = likelyRejections.filter(
      (r) => r.severity === 'medium'
    ).length
    probability -=
      highSeverityCount * EXAMINER_CONSTANTS.HIGH_SEVERITY_PENALTY +
      mediumSeverityCount * EXAMINER_CONSTANTS.MEDIUM_SEVERITY_PENALTY

    // 应用严格程度调整
    const strictnessAdjustment =
      (1 - this.config.strictness) * EXAMINER_CONSTANTS.STRICTNESS_ADJUSTMENT
    probability += strictnessAdjustment

    // 保守模式调整
    if (this.config.conservativeMode) {
      probability -= EXAMINER_CONSTANTS.CONSERVATIVE_MODE_PENALTY
    }

    // 限制范围
    return Math.max(
      EXAMINER_CONSTANTS.MIN_ACCEPT_PROBABILITY,
      Math.min(EXAMINER_CONSTANTS.MAX_ACCEPT_PROBABILITY, probability)
    )
  }

  /**
   * 生成改进建议
   */
  private async generateSuggestions(
    officeAction: OfficeAction,
    responseDocument: ResponseDocument,
    likelyRejections: Array<{ type: string; reason: string; severity: string }>
  ): Promise<string[]> {
    const suggestions: string[] = []

    // 基于潜在问题生成建议
    for (const rejection of likelyRejections) {
      if (rejection.severity === 'high') {
        suggestions.push(
          `【高优先级】针对${rejection.type}：${rejection.reason.substring(0, 50)}...`
        )
      }
    }

    // 策略相关建议
    if (responseDocument.responseStrategy === 'argument') {
      suggestions.push('考虑增加权利要求修改以提高授权概率')
    } else if (responseDocument.responseStrategy === 'amendment') {
      suggestions.push(
        '建议在修改的同时补充争辩理由，强调创造性'
      )
    }

    // 一般性建议
    suggestions.push('建议引用对比文件的具体段落进行针对性反驳')
    suggestions.push(
      '建议强调技术效果和区别技术特征的非显而易见性'
    )

    return suggestions.slice(0, EXAMINER_CONSTANTS.MAX_SUGGESTIONS)
  }

  /**
   * 风险评估
   */
  private assessRisk(
    acceptProbability: number,
    likelyRejections: Array<{ severity: string }>
  ): { level: 'low' | 'medium' | 'high'; factors: string[] } {
    const factors: string[] = []

    // 基于接受概率
    if (acceptProbability < 40) {
      factors.push('接受概率较低（<40%）')
    } else if (acceptProbability < 60) {
      factors.push('接受概率中等（40-60%）')
    }

    // 基于潜在问题
    const highSeverityCount = likelyRejections.filter(
      (r) => r.severity === 'high'
    ).length
    if (highSeverityCount > 0) {
      factors.push(`存在 ${highSeverityCount} 个高风险的潜在驳回理由`)
    }

    // 确定风险等级
    let level: 'low' | 'medium' | 'high'
    if (acceptProbability >= 75 && highSeverityCount === 0) {
      level = 'low'
    } else if (acceptProbability >= 50 && highSeverityCount <= 1) {
      level = 'medium'
    } else {
      level = 'high'
    }

    return { level, factors }
  }

  /**
   * 生成详细分析报告
   */
  private async generateAnalysisReport(
    officeAction: OfficeAction,
    responseDocument: ResponseDocument,
    acceptProbability: number,
    likelyRejections: Array<{ type: string; reason: string; severity: string }>,
    suggestions: string[]
  ): Promise<string> {
    const report = `# 审查员模拟分析报告

## 一、接受概率预测
**总体接受概率**: ${acceptProbability.toFixed(2)}%

## 二、答复策略评估
- **策略类型**: ${responseDocument.responseStrategy}
- **修改权利要求数量**: ${responseDocument.amendedClaims.length}
- **意见陈述书长度**: ${responseDocument.writtenArgument.length} 字

## 三、潜在二次审查意见
${likelyRejections
  .map(
    (r, i) => `
${i + 1}. **${r.type}** (${r.severity.toUpperCase()})
   - 理由: ${r.reason.substring(0, 100)}...
`
  )
  .join('\n')}

## 四、改进建议
${suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')}

## 五、风险提示
${
  likelyRejections.filter((r) => r.severity === 'high').length > 0
    ? '⚠️ 存在二次审查意见风险，建议进一步完善答复'
    : '✅ 风险可控，答复质量良好'
}

---
*生成时间: ${new Date().toISOString()}*
*严格程度: ${(this.config.strictness * 100).toFixed(0)}%*
*保守模式: ${this.config.conservativeMode ? '是' : '否'}*
感谢使用审查员模拟器！`.trim()

    return report
  }

  /**
   * 批量模拟多个答复方案
   */
  async simulateMultipleResponses(
    officeAction: OfficeAction,
    responseDocuments: ResponseDocument[]
  ): Promise<
    Array<{ responseIndex: number; result: ExaminerSimulationResult }>
  > {
    this.logger.logOperationStart('批量模拟', {
      count: responseDocuments.length,
      oaType: officeAction.oa_type,
    })

    // 验证输入
    validateOfficeAction(officeAction)
    responseDocuments.forEach((doc, index) => {
      validateResponseDocument(doc)
      this.logger.debug(`验证文档 ${index + 1}/${responseDocuments.length}`)
    })

    try {
      // 使用批量调用提高性能
      const results = await this.perfMonitor.measure(
        '批量审查员模拟',
        async () => {
          // 并发执行所有模拟
          const simulations = responseDocuments.map(
            async (responseDoc, index) => {
              try {
                const result = await this.executeSimulation(
                  officeAction,
                  responseDoc
                )
                return { responseIndex: index, result }
              } catch (error) {
                this.logger.error(`文档 ${index} 模拟失败`, error as Error, {
                  responseIndex: index,
                })
                // 返回错误结果
                return {
                  responseIndex: index,
                  result: {
                    acceptProbability: 0,
                    likelyRejections: [
                      {
                        type: '模拟失败',
                        reason: (error as Error).message,
                        severity: 'high' as const,
                      },
                    ],
                    suggestions: [],
                    riskAssessment: {
                      level: 'high' as const,
                      factors: ['模拟失败'],
                    },
                    analysisReport: `模拟失败: ${(error as Error).message}`,
                  },
                }
              }
            }
          )

          return Promise.all(simulations)
        }
      )

      // 按接受概率排序
      results.sort((a, b) => b.result.acceptProbability - a.result.acceptProbability)

      this.logger.logOperationEnd('批量模拟', {
        bestScore: results[0].result.acceptProbability,
        worstScore: results[results.length - 1].result.acceptProbability,
      })

      return results
    } catch (error) {
      this.logger.logOperationFailure('批量模拟', error as Error)
      throw error
    }
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
