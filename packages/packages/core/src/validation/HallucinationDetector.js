/**
 * 幻觉检测器 (HallucinationDetector)
 *
 * 整合事实验证、逻辑一致性检查、源归属验证，综合评估内容中的幻觉程度
 */
import {
  SuggestionAction,
  LogicalInconsistencyType,
  SourceAttributionIssueType,
} from './hallucination-types.js'
import { FactChecker } from './FactChecker.js'
import { LogicalConsistencyChecker } from './LogicalConsistencyChecker.js'
import { SourceAttributionValidator } from './SourceAttributionValidator.js'
/**
 * 幻觉检测器主类
 */
export class HallucinationDetector {
  llm
  knowledgeBase
  config
  // 子检测器
  factChecker
  logicalConsistencyChecker
  sourceAttributionValidator
  constructor(llm, knowledgeBase, config) {
    this.llm = llm
    this.knowledgeBase = knowledgeBase
    this.config = {
      enableFactCheck: true,
      enableLogicalConsistencyCheck: true,
      enableSourceAttribution: true,
      factCheckThreshold: 0.7,
      logicalConsistencyThreshold: 0.7,
      maxValidationTime: 30000, // 30秒
      ...config,
    }
    // 初始化子检测器
    this.factChecker = new FactChecker(llm, knowledgeBase)
    this.logicalConsistencyChecker = new LogicalConsistencyChecker(llm)
    this.sourceAttributionValidator = new SourceAttributionValidator(llm, knowledgeBase)
  }
  /**
   * 检测内容中的幻觉
   *
   * @param content 要检测的内容
   * @param context 执行上下文（可选）
   * @returns 幻觉检测报告
   */
  async detect(content, _context) {
    const startTime = Date.now()
    // 1. 事实验证
    const factCheckResults = []
    if (this.config.enableFactCheck) {
      const results = await this.factChecker.verifyContent(content)
      factCheckResults.push(...results)
    }
    // 2. 逻辑一致性检查
    const logicalInconsistencies = []
    if (this.config.enableLogicalConsistencyCheck) {
      const results = await this.logicalConsistencyChecker.checkConsistency(content)
      logicalInconsistencies.push(...results)
    }
    // 3. 源归属验证
    const sourceAttributionIssues = []
    if (this.config.enableSourceAttribution) {
      const results = await this.sourceAttributionValidator.validateAttribution(content)
      sourceAttributionIssues.push(...results)
    }
    // 4. 计算总体幻觉分数
    const overallScore = this.calculateOverallScore(
      factCheckResults,
      logicalInconsistencies,
      sourceAttributionIssues
    )
    // 5. 生成改进建议
    const suggestions = this.generateSuggestions(
      factCheckResults,
      logicalInconsistencies,
      sourceAttributionIssues
    )
    const duration = Date.now() - startTime
    return {
      overallScore,
      factCheckResults,
      logicalInconsistencies,
      sourceAttributionIssues,
      suggestions,
      duration,
      timestamp: new Date(),
    }
  }
  /**
   * 计算总体幻觉分数
   *
   * @param factCheckResults 事实验证结果
   * @param logicalInconsistencies 逻辑不一致问题
   * @param sourceAttributionIssues 源归属问题
   * @returns 幻觉分数（0-1，越低越好）
   */
  calculateOverallScore(factCheckResults, logicalInconsistencies, sourceAttributionIssues) {
    let score = 0
    let weight = 0
    // 事实验证权重（50%）
    if (this.config.enableFactCheck && factCheckResults.length > 0) {
      const factScore = this.calculateFactCheckScore(factCheckResults)
      score += factScore * 0.5
      weight += 0.5
    }
    // 逻辑一致性权重（30%）
    if (this.config.enableLogicalConsistencyCheck && logicalInconsistencies.length > 0) {
      const logicScore = this.calculateLogicScore(logicalInconsistencies)
      score += logicScore * 0.3
      weight += 0.3
    }
    // 源归属权重（20%）
    if (this.config.enableSourceAttribution && sourceAttributionIssues.length > 0) {
      const attributionScore = this.calculateAttributionScore(sourceAttributionIssues)
      score += attributionScore * 0.2
      weight += 0.2
    }
    // 归一化
    return weight > 0 ? score / weight : 0
  }
  /**
   * 计算事实验证分数
   *
   * @param results 事实验证结果
   * @returns 分数（0-1，越低越好）
   */
  calculateFactCheckScore(results) {
    if (results.length === 0) return 0
    let totalScore = 0
    let verifiableCount = 0
    for (const result of results) {
      if (result.isVerifiable) {
        verifiableCount++
        // 未验证通过 = 高幻觉分数
        if (!result.isVerified) {
          totalScore += 1 - result.confidence
        } else {
          totalScore += 0.1 // 已验证但有少量不确定性
        }
      }
    }
    return verifiableCount > 0 ? totalScore / verifiableCount : 0
  }
  /**
   * 计算逻辑一致性分数
   *
   * @param inconsistencies 逻辑不一致问题
   * @returns 分数（0-1，越低越好）
   */
  calculateLogicScore(inconsistencies) {
    if (inconsistencies.length === 0) return 0
    let totalScore = 0
    for (const inc of inconsistencies) {
      // 根据严重程度加权
      const severityWeight = {
        critical: 1.0,
        major: 0.7,
        minor: 0.3,
      }
      totalScore += severityWeight[inc.severity] || 0.5
    }
    // 归一化到0-1
    return Math.min(totalScore / inconsistencies.length, 1)
  }
  /**
   * 计算源归属分数
   *
   * @param issues 源归属问题
   * @returns 分数（0-1，越低越好）
   */
  calculateAttributionScore(issues) {
    if (issues.length === 0) return 0
    let totalScore = 0
    for (const issue of issues) {
      // 根据严重程度加权
      const severityWeight = {
        critical: 1.0,
        major: 0.7,
        minor: 0.3,
      }
      totalScore += severityWeight[issue.severity] || 0.5
    }
    // 归一化到0-1
    return Math.min(totalScore / issues.length, 1)
  }
  /**
   * 生成改进建议
   *
   * @param factCheckResults 事实验证结果
   * @param logicalInconsistencies 逻辑不一致问题
   * @param sourceAttributionIssues 源归属问题
   * @returns 改进建议列表
   */
  generateSuggestions(factCheckResults, logicalInconsistencies, sourceAttributionIssues) {
    const suggestions = []
    let suggestionId = 0
    //从事实验证结果生成建议
    for (const result of factCheckResults) {
      if (!result.isVerified && result.isVerifiable) {
        suggestions.push({
          id: `suggestion-${suggestionId++}`,
          priority: 'high',
          category: 'factual',
          description: `声明 "${result.claim.content}" 未通过事实验证`,
          action:
            result.sources.length > 0
              ? SuggestionAction.ADD_CITATION
              : SuggestionAction.CORRECT_CONTENT,
          expectedImpact: `提升内容准确性，增加可信度`,
        })
      }
    }
    // 从逻辑不一致问题生成建议
    for (const inc of logicalInconsistencies) {
      if (inc.type === LogicalInconsistencyType.DUPLICATION) {
        suggestions.push({
          id: `suggestion-${suggestionId++}`,
          priority: inc.severity === 'critical' ? 'high' : 'medium',
          category: 'logical',
          description: inc.description,
          action: SuggestionAction.REMOVE_CONTENT,
          expectedImpact: `消除重复内容，提升简洁性`,
        })
      } else if (inc.type === LogicalInconsistencyType.CONTRADICTION) {
        suggestions.push({
          id: `suggestion-${suggestionId++}`,
          priority: 'high',
          category: 'logical',
          description: inc.description,
          action: SuggestionAction.REPHRASE,
          expectedImpact: `解决逻辑矛盾，提升一致性`,
        })
      } else if (inc.type === LogicalInconsistencyType.LOGICAL_GAP) {
        suggestions.push({
          id: `suggestion-${suggestionId++}`,
          priority: 'medium',
          category: 'logical',
          description: inc.description,
          action: SuggestionAction.CORRECT_CONTENT,
          expectedImpact: `修复逻辑断层，提升连贯性`,
        })
      }
    }
    // 从源归属问题生成建议
    for (const issue of sourceAttributionIssues) {
      if (issue.type === SourceAttributionIssueType.MISSING_CITATION) {
        suggestions.push({
          id: `suggestion-${suggestionId++}`,
          priority: issue.severity === 'critical' ? 'high' : 'medium',
          category: 'attribution',
          description: issue.description,
          action: SuggestionAction.ADD_CITATION,
          expectedImpact: `增加来源引用，提升可信度`,
        })
      } else if (issue.type === SourceAttributionIssueType.UNRELIABLE_SOURCE) {
        suggestions.push({
          id: `suggestion-${suggestionId++}`,
          priority: 'medium',
          category: 'attribution',
          description: issue.description,
          action: SuggestionAction.MANUAL_REVIEW,
          expectedImpact: `审核并替换为更可信的来源`,
        })
      }
    }
    // 按优先级排序
    return suggestions.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 }
      return priorityOrder[b.priority] - priorityOrder[a.priority]
    })
  }
  /**
   * 生成人类可读的报告
   *
   * @param report 幻觉检测报告
   * @returns 格式化的报告文本
   */
  generateReport(report) {
    let output = '='.repeat(70) + '\n'
    output += '幻觉检测报告\n'
    output += '='.repeat(70) + '\n\n'
    // 总体评分和通过标记
    const scorePercent = report.overallScore * 100
    const scoreLevel =
      report.overallScore < 0.3
        ? '优秀'
        : report.overallScore < 0.5
          ? '良好'
          : report.overallScore < 0.7
            ? '一般'
            : '较差'
    // 添加通过/失败标记
    const statusIcon =
      report.overallScore < 0.3
        ? '✅'
        : report.overallScore < 0.5
          ? '✅'
          : report.overallScore < 0.7
            ? '⚠️'
            : '❌'
    output += `状态: ${statusIcon}\n`
    output += `📊 总体评分: ${scorePercent.toFixed(1)}% (${scoreLevel})\n`
    output += `⏱️  检测耗时: ${report.duration}ms\n`
    output += `🕐 检测时间: ${report.timestamp.toLocaleString('zh-CN')}\n\n`
    // 事实验证结果
    if (report.factCheckResults.length > 0) {
      output += '📝 事实验证结果\n'
      output += '-'.repeat(70) + '\n'
      const factStats = this.factChecker.getFactCheckStats(report.factCheckResults)
      output += `总计: ${factStats.total} 个声明\n`
      output += `可验证: ${factStats.verifiable} 个\n`
      output += `已验证: ${factStats.verified} 个\n`
      output += `未验证: ${factStats.unverified} 个\n`
      output += `验证率: ${(factStats.verificationRate * 100).toFixed(1)}%\n`
      output += `平均置信度: ${(factStats.avgConfidence * 100).toFixed(1)}%\n\n`
      // 显示未验证的声明
      if (factStats.unverified > 0) {
        output += '❌ 未验证的声明:\n'
        for (const result of report.factCheckResults.filter(
          (r) => r.isVerifiable && !r.isVerified
        )) {
          output += `  - ${result.claim.content}\n`
          if (result.sources.length > 0) {
            output += `    建议来源: ${result.sources.map((s) => s.title).join(', ')}\n`
          }
        }
        output += '\n'
      }
    }
    // 逻辑一致性结果
    if (report.logicalInconsistencies.length > 0) {
      output += '🔄 逻辑一致性检查\n'
      output += '-'.repeat(70) + '\n'
      output +=
        this.logicalConsistencyChecker.generateConsistencyReport(report.logicalInconsistencies) +
        '\n'
    }
    // 源归属结果
    if (report.sourceAttributionIssues.length > 0) {
      output += '📚 源归属验证\n'
      output += '-'.repeat(70) + '\n'
      output +=
        this.sourceAttributionValidator.generateAttributionReport(report.sourceAttributionIssues) +
        '\n'
    }
    // 改进建议
    if (report.suggestions.length > 0) {
      output += '💡 改进建议\n'
      output += '-'.repeat(70) + '\n'
      const byPriority = report.suggestions.reduce((acc, sugg) => {
        if (!acc[sugg.priority]) {
          acc[sugg.priority] = []
        }
        acc[sugg.priority].push(sugg)
        return acc
      }, {})
      if (byPriority.high) {
        output += '🔴 高优先级:\n'
        for (const sugg of byPriority.high.slice(0, 5)) {
          output += `  - ${sugg.description}\n`
          output += `    操作: ${this.getActionLabel(sugg.action)}\n`
          output += `    预期效果: ${sugg.expectedImpact}\n`
        }
        output += '\n'
      }
      if (byPriority.medium) {
        output += '🟠 中优先级:\n'
        for (const sugg of byPriority.medium.slice(0, 3)) {
          output += `  - ${sugg.description}\n`
        }
        output += '\n'
      }
      if (byPriority.low) {
        output += '🟡 低优先级:\n'
        for (const sugg of byPriority.low.slice(0, 3)) {
          output += `  - ${sugg.description}\n`
        }
      }
    }
    output += '='.repeat(70) + '\n'
    return output
  }
  /**
   * 获取操作标签
   *
   * @param action 操作类型
   * @returns 中文标签
   */
  getActionLabel(action) {
    const labels = {
      [SuggestionAction.ADD_CITATION]: '添加引用',
      [SuggestionAction.CORRECT_CONTENT]: '修正内容',
      [SuggestionAction.REMOVE_CONTENT]: '删除内容',
      [SuggestionAction.REPHRASE]: '重新表述',
      [SuggestionAction.MANUAL_REVIEW]: '人工审核',
    }
    return labels[action] || action
  }
  /**
   * 快速检测（仅事实验证）
   *
   * @param content 内容文本
   * @returns 是否通过检测
   */
  async quickCheck(content) {
    const report = await this.detect(content)
    // 幻觉分数低于阈值即为通过
    return report.overallScore < (this.config.factCheckThreshold || 0.7)
  }
  /**
   * 批量检测
   *
   * @param contents 内容列表
   * @param onProgress 进度回调
   * @returns 幻觉检测报告列表
   */
  async detectBatch(contents, onProgress) {
    const reports = []
    for (let i = 0; i < contents.length; i++) {
      const report = await this.detect(contents[i])
      reports.push(report)
      if (onProgress) {
        onProgress(i + 1, contents.length)
      }
    }
    return reports
  }
  /**
   * 获取检测器统计
   *
   * @param reports 检测报告列表
   * @returns 统计信息
   */
  getDetectorStats(reports) {
    if (reports.length === 0) {
      return {
        totalReports: 0,
        avgScore: 0,
        highRiskCount: 0,
        mediumRiskCount: 0,
        lowRiskCount: 0,
        avgDuration: 0,
      }
    }
    const totalScore = reports.reduce((sum, r) => sum + r.overallScore, 0)
    const avgScore = totalScore / reports.length
    const highRiskCount = reports.filter((r) => r.overallScore >= 0.7).length
    const mediumRiskCount = reports.filter(
      (r) => r.overallScore >= 0.5 && r.overallScore < 0.7
    ).length
    const lowRiskCount = reports.filter((r) => r.overallScore < 0.5).length
    const totalDuration = reports.reduce((sum, r) => sum + r.duration, 0)
    const avgDuration = totalDuration / reports.length
    return {
      totalReports: reports.length,
      avgScore,
      highRiskCount,
      mediumRiskCount,
      lowRiskCount,
      avgDuration,
    }
  }
}
//# sourceMappingURL=HallucinationDetector.js.map
