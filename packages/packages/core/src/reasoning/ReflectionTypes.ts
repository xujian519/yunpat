/**
 * EnhancedReflection 类型定义和默认配置
 *
 * @module reasoning/ReflectionTypes
 */

/**
 * 反思维度
 */
export enum ReflectionDimension {
  QUALITY = 'quality',
  COMPLETENESS = 'completeness',
  CONSISTENCY = 'consistency',
  SAFETY = 'safety',
  EFFICIENCY = 'efficiency',
}

/**
 * 质量评分等级
 */
export enum QualityLevel {
  EXCELLENT = 'excellent',
  GOOD = 'good',
  FAIR = 'fair',
  POOR = 'poor',
  FAILED = 'failed',
}

/**
 * 改进优先级
 */
export enum ImprovementPriority {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

/**
 * 单维度评估结果
 */
export interface DimensionAssessment {
  dimension: ReflectionDimension
  level: QualityLevel
  score: number
  reasoning: string
  issues: string[]
  evidence?: string[]
}

/**
 * 改进建议
 */
export interface Improvement {
  id: string
  description: string
  priority: ImprovementPriority
  relatedDimensions: ReflectionDimension[]
  actionSteps: string[]
  expectedOutcome?: string
  applied: boolean
  appliedAt?: Date
}

/**
 * 反思报告
 */
export interface ReflectionReport {
  id: string
  executionId: string
  timestamp: Date
  assessments: DimensionAssessment[]
  overallScore: number
  overallLevel: QualityLevel
  improvements: Improvement[]
  needsIteration: boolean
  iterationReason?: string
  confidence: number
}

/**
 * 反思历史记录
 */
export interface ReflectionRecord {
  executionId: string
  timestamp: Date
  report: ReflectionReport
  iterated: boolean
  iterationCount: number
  finalResult?: unknown
}

/**
 * 迭代结果
 */
export interface IterationResult {
  iterationCount: number
  success: boolean
  result: unknown
  reports: ReflectionReport[]
  appliedImprovements: Improvement[]
  duration: number
}

/**
 * 反思配置
 */
export interface ReflectionConfig {
  maxIterations: number
  iterationThreshold: number
  enabledDimensions: ReflectionDimension[]
  useDeepAnalysis: boolean
  recordHistory: boolean
  maxHistorySize: number
  enableTelemetry: boolean
}

export const DEFAULT_CONFIG: ReflectionConfig = {
  maxIterations: 3,
  iterationThreshold: 0.7,
  enabledDimensions: [
    ReflectionDimension.QUALITY,
    ReflectionDimension.COMPLETENESS,
    ReflectionDimension.CONSISTENCY,
  ],
  useDeepAnalysis: true,
  recordHistory: true,
  maxHistorySize: 100,
  enableTelemetry: true,
}
