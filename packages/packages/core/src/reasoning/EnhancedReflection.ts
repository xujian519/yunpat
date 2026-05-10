/**
 * 增强自我反思机制 (Enhanced Reflection)
 *
 * 多维度反思、改进建议、自动迭代优化
 *
 * @module reasoning/EnhancedReflection
 */

import { LLMAdapter, ExecutionContext } from '../lifecycle/Lifecycle.js'
import { TelemetryCollector } from '../observability/TelemetryCollector.js'
import { TelemetryEventType, EventStatus } from '../observability/types.js'
import {
  ReflectionDimension,
  QualityLevel,
  ImprovementPriority,
  DEFAULT_CONFIG,
} from './ReflectionTypes.js'
import type {
  DimensionAssessment,
  Improvement,
  ReflectionReport,
  ReflectionRecord,
  IterationResult,
  ReflectionConfig,
} from './ReflectionTypes.js'
import {
  performRuleBasedAssessment,
  buildAssessmentPrompt,
  getSystemPromptForDimension,
  parseAssessmentResponse,
  calculateOverallScore,
  determineIterationNeed,
  calculateConfidence,
  determinePriority,
  generateActionSteps,
  getExpectedOutcome,
} from './ReflectionAssessors.js'

// Re-export types
export {
  ReflectionDimension,
  QualityLevel,
  ImprovementPriority,
} from './ReflectionTypes.js'
export type {
  DimensionAssessment,
  Improvement,
  ReflectionReport,
  ReflectionRecord,
  IterationResult,
  ReflectionConfig,
} from './ReflectionTypes.js'

/**
 * 增强自我反思机制
 */
export class EnhancedReflection {
  private llm: LLMAdapter
  private config: ReflectionConfig
  private telemetryCollector?: TelemetryCollector
  private history: ReflectionRecord[] = []
  private counter = 0

  constructor(
    llm: LLMAdapter,
    config: Partial<ReflectionConfig> = {},
    telemetryCollector?: TelemetryCollector
  ) {
    this.llm = llm
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.telemetryCollector = telemetryCollector
  }

  async reflect(
    result: unknown,
    context: ExecutionContext,
    goal?: string
  ): Promise<ReflectionReport> {
    const startTime = Date.now()

    this.recordTelemetryEvent(TelemetryEventType.STAGE_STARTED, {
      stage: 'reflection',
      agentName: context.agentName,
    })

    const reportId = `ref_${++this.counter}`

    const assessments = await this.performDimensionalAssessments(result, context, goal)
    const { overallScore, overallLevel } = calculateOverallScore(assessments)
    const improvements = this.generateImprovements(assessments)
    const { needsIteration, iterationReason } = determineIterationNeed(
      overallScore,
      improvements,
      this.config.iterationThreshold
    )
    const confidence = calculateConfidence(assessments, improvements)

    const report: ReflectionReport = {
      id: reportId,
      executionId: context.executionId,
      timestamp: new Date(),
      assessments,
      overallScore,
      overallLevel,
      improvements,
      needsIteration,
      iterationReason,
      confidence,
    }

    if (this.config.recordHistory) {
      this.addToHistory({
        executionId: context.executionId,
        timestamp: new Date(),
        report,
        iterated: false,
        iterationCount: 0,
      })
    }

    this.recordTelemetryEvent(TelemetryEventType.STAGE_COMPLETED, {
      stage: 'reflection',
      agentName: context.agentName,
      duration: Date.now() - startTime,
      metadata: { reportId, overallScore, needsIteration },
    })

    return report
  }

  generateImprovements(reflection: ReflectionReport): Improvement[]
  generateImprovements(assessments: DimensionAssessment[]): Improvement[]
  generateImprovements(input: ReflectionReport | DimensionAssessment[]): Improvement[] {
    const assessments = Array.isArray(input) ? input : input.assessments

    const improvements: Improvement[] = []
    let improvementId = 0

    for (const assessment of assessments) {
      if (assessment.level === QualityLevel.EXCELLENT) {
        continue
      }

      for (const issue of assessment.issues) {
        const priority = determinePriority(assessment.level)
        const actionSteps = generateActionSteps(assessment.dimension)

        improvements.push({
          id: `imp_${++improvementId}`,
          description: `改进 ${assessment.dimension}: ${issue}`,
          priority,
          relatedDimensions: [assessment.dimension],
          actionSteps,
          expectedOutcome: getExpectedOutcome(assessment.dimension),
          applied: false,
        })
      }
    }

    improvements.sort((a, b) => {
      const priorityOrder = {
        [ImprovementPriority.HIGH]: 0,
        [ImprovementPriority.MEDIUM]: 1,
        [ImprovementPriority.LOW]: 2,
      }
      return priorityOrder[a.priority] - priorityOrder[b.priority]
    })

    return improvements
  }

  async iterate(
    result: unknown,
    improvements: Improvement[],
    context: ExecutionContext,
    reActFunction: (improvements: Improvement[]) => Promise<unknown>
  ): Promise<IterationResult> {
    const startTime = Date.now()
    const reports: ReflectionReport[] = []
    const appliedImprovements: Improvement[] = []
    let currentResult = result
    let iterationCount = 0
    let success = false

    while (iterationCount < this.config.maxIterations) {
      iterationCount++

      for (const imp of improvements) {
        if (!imp.applied) {
          imp.applied = true
          imp.appliedAt = new Date()
          appliedImprovements.push(imp)
        }
      }

      try {
        currentResult = await reActFunction(improvements)
      } catch {
        break
      }

      const newReport = await this.reflect(currentResult, context)
      reports.push(newReport)

      if (!newReport.needsIteration || newReport.overallScore >= this.config.iterationThreshold) {
        success = true
        break
      }

      improvements = this.generateImprovements(newReport)
    }

    const duration = Date.now() - startTime

    if (this.config.recordHistory) {
      const historyEntry = this.history.find((h) => h.executionId === context.executionId)
      if (historyEntry) {
        historyEntry.iterated = true
        historyEntry.iterationCount = iterationCount
        historyEntry.finalResult = currentResult
      }
    }

    return { iterationCount, success, result: currentResult, reports, appliedImprovements, duration }
  }

  getReflectionHistory(limit?: number): ReflectionRecord[] {
    const sorted = [...this.history].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    return limit ? sorted.slice(0, limit) : sorted
  }

  getHistoryByExecution(executionId: string): ReflectionRecord | undefined {
    return this.history.find((h) => h.executionId === executionId)
  }

  getRepeatedErrorPatterns(): Array<{ pattern: string; count: number }> {
    const patternMap = new Map<string, number>()

    for (const record of this.history) {
      for (const assessment of record.report.assessments) {
        for (const issue of assessment.issues) {
          const key = `${assessment.dimension}:${issue}`
          patternMap.set(key, (patternMap.get(key) || 0) + 1)
        }
      }
    }

    return [...patternMap.entries()]
      .filter(([_, count]) => count > 1)
      .map(([pattern, count]) => ({ pattern, count }))
      .sort((a, b) => b.count - a.count)
  }

  clearHistory(): void {
    this.history = []
  }

  updateConfig(config: Partial<ReflectionConfig>): void {
    this.config = { ...this.config, ...config }
  }

  getConfig(): ReflectionConfig {
    return { ...this.config }
  }

  private async performDimensionalAssessments(
    result: unknown,
    context: ExecutionContext,
    goal?: string
  ): Promise<DimensionAssessment[]> {
    const assessments: DimensionAssessment[] = []

    for (const dimension of this.config.enabledDimensions) {
      let assessment: DimensionAssessment

      if (this.config.useDeepAnalysis) {
        assessment = await this.performLLMAssessment(dimension, result, context, goal)
      } else {
        assessment = performRuleBasedAssessment(dimension, result, context)
      }

      assessments.push(assessment)
    }

    return assessments
  }

  private async performLLMAssessment(
    dimension: ReflectionDimension,
    result: unknown,
    context: ExecutionContext,
    goal?: string
  ): Promise<DimensionAssessment> {
    const prompt = buildAssessmentPrompt(dimension, result, context, goal)

    const response = await this.llm.chat({
      messages: [
        { role: 'system', content: getSystemPromptForDimension(dimension) },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      maxTokens: 1000,
    })

    return parseAssessmentResponse(dimension, response.message.content)
  }

  private addToHistory(record: ReflectionRecord): void {
    this.history.push(record)
    if (this.history.length > this.config.maxHistorySize) {
      this.history.shift()
    }
  }

  private recordTelemetryEvent(type: TelemetryEventType, data: Record<string, unknown>): void {
    if (this.config.enableTelemetry && this.telemetryCollector) {
      this.telemetryCollector.record({
        id: '',
        type,
        timestamp: Date.now(),
        status: EventStatus.SUCCESS,
        ...data,
      })
    }
  }
}

export function createEnhancedReflection(
  llm: LLMAdapter,
  config?: Partial<ReflectionConfig>,
  telemetryCollector?: TelemetryCollector
): EnhancedReflection {
  return new EnhancedReflection(llm, config, telemetryCollector)
}
