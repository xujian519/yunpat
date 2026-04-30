/**
 * 动态重规划系统 - 类型定义
 *
 * 定义偏离检测、恢复策略、增量规划的核心类型
 */

import type { LLMAdapter } from '../lifecycle/Lifecycle.js';
import type { HierarchicalPlan, SubGoal, DependencyGraph } from '../planning/types.js';

// 重新导出类型
export type { LLMAdapter };
export type { HierarchicalPlan, SubGoal, DependencyGraph };

/**
 * 重规划触发类型
 */
export enum ReplanningTriggerType {
  DEVIATION = 'deviation',       // 偏离检测
  FAILURE = 'failure',           // 任务失败
  TIMEOUT = 'timeout',           // 超时
  QUALITY_DROP = 'quality_drop', // 质量下降
  USER_REQUEST = 'user_request', // 用户请求
}

/**
 * 偏离类型
 */
export enum DeviationType {
  SCHEDULE_DEVIATION = 'schedule_deviation',   // 进度偏离
  QUALITY_DEVIATION = 'quality_deviation',     // 质量偏离
  RESOURCE_DEVIATION = 'resource_deviation',   // 资源偏离
  DEPENDENCY_DEVIATION = 'dependency_deviation', // 依赖偏离
}

/**
 * 恢复策略类型
 */
export enum RecoveryStrategyType {
  RETRY = 'retry',               // 重试
  SKIP = 'skip',                 // 跳过
  REORDER = 'reorder',           // 重排序
  DECOMPOSE = 'decompose',       // 分解
  ADAPT = 'adapt',               // 适应
  ABORT = 'abort',               // 中止
}

/**
 * 重规划触发条件
 */
export interface ReplanningTrigger {
  type: ReplanningTriggerType;
  threshold: number;
  description: string;
  condition: (state: ExecutionState) => boolean;
}

/**
 * 执行状态
 */
export interface ExecutionState {
  plan: HierarchicalPlan;
  completedGoals: Set<string>;
  failedGoals: Set<string>;
  currentGoal?: string;
  startTime: number;
  elapsedTime: number;
  qualityMetrics: QualityMetrics;
  resourceUsage: ResourceUsage;
}

/**
 * 质量指标
 */
export interface QualityMetrics {
  overallQuality: number;        // 总体质量 (0-1)
  taskSuccessRate: number;       // 任务成功率 (0-1)
  averageQuality: number;        // 平均质量 (0-1)
  qualityTrend: 'improving' | 'stable' | 'declining';
}

/**
 * 资源使用情况
 */
export interface ResourceUsage {
  tokensUsed: number;
  estimatedTokens: number;
  timeElapsed: number;
  estimatedTime: number;
  resources: Map<string, number>; // 资源类型 -> 使用量
}

/**
 * 偏离报告
 */
export interface DeviationReport {
  hasDeviation: boolean;
  deviations: Deviation[];
  overallDeviationScore: number; // 0-1，越高偏离越严重
  timestamp: Date;
}

/**
 * 偏离详情
 */
export interface Deviation {
  type: DeviationType;
  severity: 'minor' | 'moderate' | 'severe';
  description: string;
  plannedValue: number;
  actualValue: number;
  deviationDegree: number; // 偏离程度 (0-1)
  affectedGoals: string[];
  suggestions: string[];
}

/**
 * 恢复策略
 */
export interface RecoveryStrategy {
  name: RecoveryStrategyType;
  description: string;
  applicableScenarios: string[];
  estimatedCost: number; // 成本 (0-1)
  estimatedSuccess: number; // 成功概率 (0-1)
  action: (context: ReplanningContext) => Promise<PlanAdjustment>;
}

/**
 * 计划调整
 */
export interface PlanAdjustment {
  type: RecoveryStrategyType;
  modifications: TaskModification[];
  estimatedImprovement: number; // 预期改进 (0-1)
  reasoning: string;
}

/**
 * 任务修改
 */
export interface TaskModification {
  type: 'add' | 'remove' | 'modify' | 'reorder';
  goalId: string;
  changes?: {
    newDependencies?: string[];
    newPriority?: number;
    newEstimate?: {
      duration?: number;
      tokens?: number;
    };
    newStatus?: string;
  };
}

/**
 * 重规划上下文
 */
export interface ReplanningContext {
  originalPlan: HierarchicalPlan;
  currentState: ExecutionState;
  deviationReport?: DeviationReport;
  trigger: ReplanningTrigger;
  history: ReplanningHistory[];
}

/**
 * 重规划历史
 */
export interface ReplanningHistory {
  timestamp: Date;
  trigger: ReplanningTriggerType;
  adjustment: PlanAdjustment;
  result: 'success' | 'failure' | 'partial';
}

/**
 * 重规划结果
 */
export interface ReplanningResult {
  originalPlan: HierarchicalPlan;
  adjustedPlan: HierarchicalPlan;
  adjustment: PlanAdjustment;
  reasoning: string;
  confidence: number; // 置信度 (0-1)
  estimatedImprovement: number; // 预期改进 (0-1)
}

/**
 * 动态重规划器配置
 */
export interface DynamicReplannerConfig {
  // 触发配置
  enableDeviationDetection: boolean;
  enableFailureDetection: boolean;
  enableTimeoutDetection: boolean;
  enableQualityDropDetection: boolean;

  // 阈值配置
  deviationThreshold: number; // 偏离阈值 (0-1)
  qualityDropThreshold: number; // 质量下降阈值 (0-1)
  timeoutTolerance: number; // 超时容忍度 (0-1)

  // 恢复策略配置
  preferredStrategies: RecoveryStrategyType[];
  maxReplanningAttempts: number;
  minConfidenceThreshold: number; // 最低置信度阈值

  // LLM配置
  useLLMForAnalysis: boolean;
  useLLMForPlanning: boolean;
  llmTemperature?: number;
}

/**
 * 增量规划器配置
 */
export interface IncrementalPlannerConfig {
  maxModifications: number; // 最大修改数量
  preserveCriticalPath: boolean; // 保护关键路径
  allowDependencyChanges: boolean; // 允许修改依赖关系
  minImprovementThreshold: number; // 最低改进阈值
}
