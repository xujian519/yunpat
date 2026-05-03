/**
 * ExaminerSimulator - 审查员模拟器
 *
 * 模拟审查员对答复文档的反应，预测接受概率和潜在问题
 *
 * 核心功能：
 * 1. 模拟审查员审查答复文档
 * 2. 预测授权成功率
 * 3. 识别可能的二次审查意见
 * 4. 提供改进建议
 */

import type { LLMAdapter } from '@yunpat/core'
import type { OfficeAction } from '../../core/PatentCoreBridge.js'
import { createModuleLogger } from '../../core/logger.js'

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
 * 审查员模拟器
 */
export class ExaminerSimulator {
  private llm: LLMAdapter
  private config: Required<ExaminerSimulatorConfig>
  private logger = createModuleLogger('ExaminerSimulator')

  constructor(llm: LLMAdapter, config: ExaminerSimulatorConfig = {}) {
    this.llm = llm
    this.config = {
      strictness: config.strictness ?? 0.7,
      conservativeMode: config.conservativeMode ?? false,
      domainExpertise: config.domainExpertise ?? [],
    }
  }

  /**
   * 模拟审查员审查答复文档
   */
  async simulateReview(
    officeAction: OfficeAction,
    responseDocument: ResponseDocument
  ): Promise<ExaminerSimulationResult> {
    console.log('\n👨‍⚖️ [审查员模拟器] 开始模拟审查员审查...')

    // 1. 分析答复策略的有效性
    const strategyAnalysis = await this.analyzeStrategyEffectiveness(officeAction, responseDocument)

    // 2. 评估权利要求修改质量
    const amendmentQuality = await this.assessAmendmentQuality(officeAction, responseDocument)

    // 3. 识别潜在的二次驳回理由
    const likelyRejections = await this.identifyLikelyRejections(officeAction, responseDocument)

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

    console.log(`   ✅ 接受概率: ${acceptProbability.toFixed(2)}%`)
    console.log(`   ⚠️  风险等级: ${riskAssessment.level}`)
    console.log(`   📝 改进建议: ${suggestions.length} 条`)

    return {
      acceptProbability,
      likelyRejections,
      suggestions,
      riskAssessment,
      analysisReport,
    }
  }

  /**
   * 从LLM响应中解析评分
   */
  private parseScoreFromResponse(content: string, defaultValue: number = 70): number {
    const patterns = [/评分[：:]\s*(\d+)/, /score[：:]\s*(\d+)/i, /(\d{2,3})\s*分/, /^(\d{2,3})$/m]

    for (const pattern of patterns) {
      const match = content.match(pattern)
      if (match) {
        const score = parseInt(match[1])
        if (score >= 0 && score <= 100) {
          return score
        }
      }
    }

    this.logger.warn('无法解析评分，使用默认值', {
      defaultValue,
      contentPreview: content.substring(0, 100),
    })
    return defaultValue
  }

  /**
   * 分析答复策略的有效性
   */
  private async analyzeStrategyEffectiveness(
    officeAction: OfficeAction,
    responseDocument: ResponseDocument
  ): Promise<{
    effectiveness: number
    reasoning: string
  }> {
    const prompt = `你是一位资深的专利审查员，请评估以下答复策略的有效性。

审查意见类型：${officeAction.oa_type}
审查员论点：${officeAction.examiner_arguments.substring(0, 500)}

答复策略：${responseDocument.responseStrategy}
意见陈述书摘要：${responseDocument.writtenArgument.substring(0, 800)}

请评估：
1. 答复策略是否有效回应了审查员的关切？
2. 论点是否有说服力？
3. 是否充分回应了驳回理由？

给出评分（0-100）和理由。`

    const response = await this.llm.chat({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    })

    const content = response.message.content as string
    const effectiveness = this.parseScoreFromResponse(content)

    return {
      effectiveness: Math.min(effectiveness, 100),
      reasoning: content.substring(0, 500),
    }
  }

  /**
   * 评估权利要求修改质量
   */
  private async assessAmendmentQuality(
    officeAction: OfficeAction,
    responseDocument: ResponseDocument
  ): Promise<{
    quality: number
    issues: string[]
  }> {
    if (responseDocument.responseStrategy === 'argument') {
      // 纯争辩策略，无修改
      return {
        quality: 85,
        issues: ['未修改权利要求，可能存在授权范围问题'],
      }
    }

    const prompt = `请评估以下权利要求修改的质量。

受影响权利要求：${officeAction.affected_claims.join(', ')}

修改后的权利要求：
${responseDocument.amendedClaims.slice(0, 3).join('\n')}

修改对照：
${responseDocument.amendmentComparison.substring(0, 500)}

评估标准：
1. 修改是否清楚、明确？
2. 是否得到说明书支持？
3. 是否缩小了保护范围？
4. 是否克服了驳回理由？

给出评分（0-100）和问题列表。`

    const response = await this.llm.chat({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    })

    const content = response.message.content as string
    const quality = this.parseScoreFromResponse(content, 75)

    // 提取问题
    const issues: string[] = []
    if (content.includes('不清楚')) issues.push('权利要求表述不清楚')
    if (content.includes('不支持')) issues.push('修改未得到说明书支持')
    if (content.includes('范围')) issues.push('保护范围可能过窄')

    return {
      quality: Math.min(quality, 100),
      issues: issues.length > 0 ? issues : ['无明显问题'],
    }
  }

  /**
   * 识别可能的二次审查意见
   */
  private async identifyLikelyRejections(
    officeAction: OfficeAction,
    responseDocument: ResponseDocument
  ): Promise<Array<{ type: string; reason: string; severity: 'high' | 'medium' | 'low' }>> {
    const prompt = `你是一位资深的专利审查员，请预测以下答复可能引发的二次审查意见。

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

对每个预测，给出驳回类型、理由和严重程度（high/medium/low）。`

    const response = await this.llm.chat({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
    })

    const content = response.message.content as string
    const rejections: Array<{ type: string; reason: string; severity: 'high' | 'medium' | 'low' }> =
      []

    // 解析LLM输出
    const lines = content.split('\n')
    let currentType = ''
    let currentReason = ''
    let currentSeverity: 'high' | 'medium' | 'low' = 'medium'

    for (const line of lines) {
      if (line.match(/新颖性|创造性|清楚|支持|超范围/)) {
        if (currentType && currentReason) {
          rejections.push({ type: currentType, reason: currentReason, severity: currentSeverity })
        }
        currentType = line.trim()
        currentReason = ''
        currentSeverity = line.includes('high') ? 'high' : line.includes('low') ? 'low' : 'medium'
      } else if (line.trim().length > 0 && !line.match(/预测|二次/)) {
        currentReason += line.trim() + ' '
      }
    }

    if (currentType && currentReason) {
      rejections.push({
        type: currentType,
        reason: currentReason.trim(),
        severity: currentSeverity,
      })
    }

    // 如果解析失败，返回默认预测
    if (rejections.length === 0) {
      return [
        {
          type: '创造性问题',
          reason: '修改后的技术方案可能仍然被认为是显而易见的',
          severity: 'medium',
        },
      ]
    }

    return rejections.slice(0, 5) // 最多返回5个预测
  }

  /**
   * 计算接受概率
   */
  private calculateAcceptProbability(
    strategyAnalysis: { effectiveness: number },
    amendmentQuality: { quality: number },
    likelyRejections: Array<{ severity: string }>
  ): number {
    let probability = 50 // 基础概率

    // 策略有效性权重：40%
    probability += strategyAnalysis.effectiveness * 0.4 - 20

    // 修改质量权重：30%
    probability += amendmentQuality.quality * 0.3 - 15

    // 潜在问题扣分：30%
    const highSeverityCount = likelyRejections.filter((r) => r.severity === 'high').length
    const mediumSeverityCount = likelyRejections.filter((r) => r.severity === 'medium').length
    probability -= highSeverityCount * 15 + mediumSeverityCount * 8

    // 应用严格程度调整
    const strictnessAdjustment = (1 - this.config.strictness) * 10
    probability += strictnessAdjustment

    // 保守模式调整
    if (this.config.conservativeMode) {
      probability -= 5
    }

    return Math.max(10, Math.min(95, probability))
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
      suggestions.push('建议在修改的同时补充争辩理由，强调创造性')
    }

    // 一般性建议
    suggestions.push('建议引用对比文件的具体段落进行针对性反驳')
    suggestions.push('建议强调技术效果和区别技术特征的非显而易见性')

    return suggestions.slice(0, 8) // 最多返回8条建议
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
    const highSeverityCount = likelyRejections.filter((r) => r.severity === 'high').length
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
    const report = `
# 审查员模拟分析报告

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
${likelyRejections.filter((r) => r.severity === 'high').length > 0 ? '⚠️ 存在二次审查意见风险，建议进一步完善答复' : '✅ 风险可控，答复质量良好'}

---
*生成时间: ${new Date().toISOString()}*
*严格程度: ${(this.config.strictness * 100).toFixed(0)}%*
`.trim()

    return report
  }

  /**
   * 批量模拟多个答复方案
   */
  async simulateMultipleResponses(
    officeAction: OfficeAction,
    responseDocuments: ResponseDocument[]
  ): Promise<Array<{ responseIndex: number; result: ExaminerSimulationResult }>> {
    console.log(`\n👨‍⚖️ [审查员模拟器] 批量模拟 ${responseDocuments.length} 个答复方案...`)

    const results = await Promise.all(
      responseDocuments.map(async (responseDoc, index) => {
        const result = await this.simulateReview(officeAction, responseDoc)
        return { responseIndex: index, result }
      })
    )

    // 按接受概率排序
    results.sort((a, b) => b.result.acceptProbability - a.result.acceptProbability)

    console.log(
      `   ✅ 批量模拟完成，最佳方案接受概率: ${results[0].result.acceptProbability.toFixed(2)}%`
    )

    return results
  }
}
