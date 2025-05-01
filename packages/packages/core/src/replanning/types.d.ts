/**
 * 动态重规划系统 - 类型定义
 *
 * 定义偏离检测、恢复策略、增量规划的核心类型
 */
import type { LLMAdapter } from '../lifecycle/Lifecycle.js'
import type { HierarchicalPlan, SubGoal, DependencyGraph } from '../planning/types.js'
export type { LLMAdapter }
export type { HierarchicalPlan, SubGoal, DependencyGraph }
/**
 * 重规划触发类型
 */
export declare enum ReplanningTriggerType {
  DEVIATION = 'deviation', // 偏离检测
  FAILURE = 'failure', // 任务失败
  TIMEOUT = 'timeout', // 超时
  QUALITY_DROP = 'quality_drop', // 质量下降
  USER_REQUEST = 'user_request',
}
/**
 * 偏离类型
 */
export declare enum DeviationType {
  SCHEDULE_DEVIATION = 'schedule_deviation', // 进度偏离
  QUALITY_DEVIATION = 'quality_deviation', // 质量偏离
  RESOURCE_DEVIATION = 'resource_deviation', // 资源偏离
  DEPENDENCY_DEVIATION = 'dependency_deviation',
}
/**
 * 恢复策略类型
 */
export declare enum RecoveryStrategyType {
  RETRY = 'retry', // 重试
  SKIP = 'skip', // 跳过
  REORDER = 'reorder', // 重排序
  DECOMPOSE = 'decompose', // 分解
  ADAPT = 'adapt', // 适应
  ABORT = 'abort',
}
/**
 * 重规划触发条件
 */
export interface ReplanningTrigger {
  type: ReplanningTriggerType
  threshold: number
  description: string
  condition: (state: ExecutionState) => boolean
}
/**
 * 执行状态
 */
export interface ExecutionState {
  plan: HierarchicalPlan
  completedGoals: Set<string>
  failedGoals: Set<string>
  currentGoal?: string
  startTime: number
  elapsedTime: number
  qualityMetrics: QualityMetrics
  resourceUsage: ResourceUsage
}
/**
 * 质量指标
 */
export interface QualityMetrics {
  overallQuality: number
  taskSuccessRate: number
  averageQuality: number
  qualityTrend: 'improving' | 'stable' | 'declining'
}
/**
 * 资源使用情况
 */
export interface ResourceUsage {
  tokensUsed: number
  estimatedTokens: number
  timeElapsed: number
  estimatedTime: number
  resources: Map<string, number>
}
/**
 * 偏离报告
 */
export interface DeviationReport {
  hasDeviation: boolean
  deviations: Deviation[]
  overallDeviationScore: number
  timestamp: Date
}
/**
 * 偏离详情
 */
export interface Deviation {
  type: DeviationType
  severity: 'minor' | 'moderate' | 'severe'
  description: string
  plannedValue: number
  actualValue: number
  deviationDegree: number
  affectedGoals: string[]
  suggestions: string[]
}
/**
 * 恢复策略
 */
export interface RecoveryStrategy {
  name: RecoveryStrategyType
  description: string
  applicableScenarios: string[]
  estimatedCost: number
  estimatedSuccess: number
  action: (context: ReplanningContext) => Promise<PlanAdjustment>
}
/**
 * 计划调整
 */
export interface PlanAdjustment {
  type: RecoveryStrategyType
  modifications: TaskModification[]
  estimatedImprovement: number
  reasoning: string
}
/**
 * 任务修改
 */
export interface TaskModification {
  type: 'add' | 'remove' | 'modify' | 'reorder'
  goalId: string
  changes?: {
    newDependencies?: string[]
    newPriority?: number
    newEstimate?: {
      duration?: number
      tokens?: number
    }
    newStatus?: string
  }
}
/**
 * 重规划上下文
 */
export interface ReplanningContext {
  originalPlan: HierarchicalPlan
  currentState: ExecutionState
  deviationReport?: DeviationReport
  trigger: ReplanningTrigger
  history: ReplanningHistory[]
}
/**
 * 重规划历史
 */
export interface ReplanningHistory {
  timestamp: Date
  trigger: ReplanningTriggerType
  adjustment: PlanAdjustment
  result: 'success' | 'failure' | 'partial'
}
/**
 * 重规划结果
 */
export interface ReplanningResult {
  originalPlan: HierarchicalPlan
  adjustedPlan: HierarchicalPlan
  adjustment: PlanAdjustment
  reasoning: string
  confidence: number
  estimatedImprovement: number
}
/**
 * 动态重规划器配置
 */
export interface DynamicReplannerConfig {
  enableDeviationDetection: boolean
  enableFailureDetection: boolean
  enableTimeoutDetection: boolean
  enableQualityDropDetection: boolean
  deviationThreshold: number
  qualityDropThreshold: number
  timeoutTolerance: number
  preferredStrategies: RecoveryStrategyType[]
  maxReplanningAttempts: number
  minConfidenceThreshold: number
  useLLMForAnalysis: boolean
  useLLMForPlanning: boolean
  llmTemperature?: number
}
/**
 * 增量规划器配置
 */
export interface IncrementalPlannerConfig {
  maxModifications: number
  preserveCriticalPath: boolean
  allowDependencyChanges: boolean
  minImprovementThreshold: number
}
/**
 * 关键路径定义
 */
export interface CriticalPath {
  /** 关键路径上的任务ID列表 */
  tasks: string[]
  /** 关键路径总时长 */
  duration: number
  /** 每个任务的松弛时间（任务ID -> 松弛时间） */
  slackTime: Map<string, number>
  /** 瓶颈任务列表（有多个依赖任务的关键任务） */
  bottleneckTasks: string[]
}
/**
 * 影响评估报告
 */
export interface ImpactAssessment {
  /** 受影响的任务ID列表 */
  affectedTasks: string[]
  /** 影响级别 */
  impactLevel: 'LOW' | 'MEDIUM' | 'HIGH'
  /** 新的项目完成时间 */
  newProjectDuration: number
  /** 延迟时间（正数表示延迟，负数表示提前） */
  delay: number
  /** 资源冲突列表 */
  resourceConflicts: ResourceConflict[]
  /** 关键路径是否改变 */
  criticalPathChanged: boolean
  /** 建议措施 */
  recommendations: string[]
}
/**
 * 资源冲突
 */
export interface ResourceConflict {
  /** 冲突的资源类型 */
  resourceType: string
  /** 冲突的任务ID列表 */
  taskIds: string[]
  /** 冲突严重程度 */
  severity: 'minor' | 'moderate' | 'severe'
}
/**
 * 任务添加结果
 */
export interface TaskAdditionResult {
  /** 新添加的任务 */
  addedTask: {
    /** 任务ID */
    taskId: string
    /** 任务数据 */
    task: SubGoal
  }
  /** 受影响的任务列表 */
  affectedTasks: string[]
  /** 新的关键路径 */
  newCriticalPath: CriticalPath
  /** 影响评估 */
  impact: ImpactAssessment
}
/**
 * 计划冲突错误
 */
export declare class PlanConflictError extends Error {
  conflicts: string[]
  constructor(conflicts: string[])
}
/**
 * 循环依赖错误
 */
export declare class CircularDependencyError extends Error {
  taskId: string
  constructor(taskId: string)
}
//# sourceMappingURL=types.d.ts.map
