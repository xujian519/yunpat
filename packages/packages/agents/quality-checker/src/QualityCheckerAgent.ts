import { ProfessionalAgent, type ProfessionalAgentConfig, type ExtendedExecutionContext } from '@yunpat/agent-base'
import { createLogger } from '@yunpat/core'
import type {
  QualityCheckInput,
  QualityCheckResult,
  QualityCheckPlan,
  QualityRule,
  Issue,
} from './QualityTypes.js'
import { createQualityRules, selectRulesByLevel } from './QualityRules.js'
import {
  checkCompleteness,
  calculateQualityScores,
  calculateOverallQuality,
  getQualityLevel,
  generateComparison,
  generateFixOperations,
  generateRecommendations,
} from './QualityScorer.js'

// Re-export types for backward compatibility
export type {
  QualityCheckInput,
  QualityCheckResult,
  ClaimsQuality,
  SpecificationQuality,
  LanguageQuality,
  QualityScores,
  Issue,
  Recommendation,
  Comparison,
} from './QualityTypes.js'

/**
 * 质量检查Agent
 */
export class QualityCheckerAgent extends ProfessionalAgent<QualityCheckInput, QualityCheckResult> {
  private logger = createLogger('QualityCheckerAgent')
  private rules: QualityRule[]

  constructor(config: ProfessionalAgentConfig) {
    super(config)
    this.rules = createQualityRules()
  }

  protected async plan(
    input: QualityCheckInput,
    _context: ExtendedExecutionContext
  ): Promise<QualityCheckPlan> {
    this.logger.info('开始规划质量检查', {
      inventionTitle: input.inventionTitle,
      claimsCount: input.claims.length,
      patentType: input.patentType,
      checkLevel: input.checkLevel ?? 2,
    })

    const checkLevel = input.checkLevel ?? 2
    const selectedRules = selectRulesByLevel(this.rules, checkLevel)

    return {
      input,
      rules: selectedRules,
    }
  }

  protected async act(
    plan: QualityCheckPlan,
    _context: ExtendedExecutionContext
  ): Promise<QualityCheckResult> {
    this.logger.info('开始执行质量检查')

    const { input, rules } = plan

    const completenessScore = checkCompleteness(input)
    const qualityScores = calculateQualityScores(input)
    const overallQuality = calculateOverallQuality(completenessScore, qualityScores)
    const issues = this.detectIssues(input, rules)
    const fixOperations = input.enableAutoFix ? generateFixOperations(issues) : undefined
    const recommendations = generateRecommendations(input, issues, qualityScores)
    const comparison = generateComparison(overallQuality, input.patentType)
    const qualityLevel = getQualityLevel(overallQuality)

    const rulesApplied = rules.map((r) => r.id)

    this.logger.info('质量检查完成', {
      completenessScore: completenessScore.toFixed(1),
      overallQuality: overallQuality.toFixed(1),
      qualityLevel,
      issuesCount: issues.length,
      rulesApplied,
    })

    return {
      completenessScore,
      qualityScores,
      overallQuality,
      qualityLevel,
      issues,
      recommendations,
      fixOperations,
      comparison,
      metadata: {
        checkLevel: input.checkLevel ?? 2,
        timestamp: Date.now(),
        rulesApplied,
        autoFixEnabled: input.enableAutoFix ?? false,
      },
    }
  }

  /**
   * 检测问题
   */
  private detectIssues(input: QualityCheckInput, rules: QualityRule[]): Issue[] {
    const issues: Issue[] = []

    for (const rule of rules) {
      try {
        const issue = rule.check(input)
        if (issue) {
          issues.push(issue)
        }
      } catch (error) {
        this.logger.warn(`规则 ${rule.id} 执行失败:`, error as Error)
      }
    }

    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
    issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

    return issues
  }
}
