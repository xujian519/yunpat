/**
 * 目标分解系统 - 类型定义
 *
 * 定义层次化规划、任务分解、依赖分析的核心类型
 */

import type { LLMAdapter } from '../lifecycle/Lifecycle.js'

// 重新导出 LLMAdapter
export type { LLMAdapter }

/**
 * 优先级枚举
 */
export enum Priority {
  CRITICAL = 'critical', // 关键任务，阻塞其他任务
  HIGH = 'high', // 高优先级
  MEDIUM = 'medium', // 中等优先级
  LOW = 'low', // 低优先级
}

/**
 * 任务状态枚举
 */
export enum TaskStatus {
  PENDING = 'pending', // 等待执行
  IN_PROGRESS = 'in_progress', // 执行中
  COMPLETED = 'completed', // 已完成
  FAILED = 'failed', // 执行失败
  SKIPPED = 'skipped', // 已跳过
  BLOCKED = 'blocked', // 被阻塞
}

/**
 * 任务类型
 */
export enum TaskType {
  RESEARCH = 'research', // 研究任务
  ANALYSIS = 'analysis', // 分析任务
  WRITING = 'writing', // 撰写任务
  VALIDATION = 'validation', // 验证任务
  GENERATION = 'generation', // 生成任务
  REVIEW = 'review', // 审查任务
}

/**
 * 任务定义
 */
export interface PlanningTask {
  /** 任务唯一标识 */
  id: string
  /** 任务标题 */
  title: string
  /** 任务描述 */
  description: string
  /** 任务类型 */
  type: TaskType
  /** 任务状态 */
  status: TaskStatus
  /** 需要的工具或能力 */
  requiredCapabilities: string[]
  /** 预估 Token 消耗 */
  estimatedTokens: number
  /** 预估执行时间（秒） */
  estimatedDuration: number
  /** 任务参数 */
  params?: Record<string, unknown>
  /** 任务执行结果 */
  result?: unknown
  /** 错误信息（如果失败） */
  error?: string
  /** 创建时间 */
  createdAt: Date
  /** 开始时间 */
  startedAt?: Date
  /** 完成时间 */
  completedAt?: Date
}

/**
 * 子目标定义
 */
export interface SubGoal {
  /** 子目标唯一标识 */
  id: string
  /** 子目标标题 */
  title: string
  /** 子目标描述 */
  description: string
  /** 包含的任务列表 */
  tasks: PlanningTask[]
  /** 依赖的其他子目标ID */
  dependencies: string[]
  /** 优先级 */
  priority: Priority
  /** 子目标状态（根据任务状态计算） */
  status: TaskStatus
  /** 预估执行时间（秒） */
  estimatedDuration: number
  /** 预估 Token 消耗 */
  estimatedTokens: number
  /** 实际执行时间（秒） */
  actualDuration?: number
  /** 实际 Token 消耗 */
  actualTokens?: number
}

/**
 * 依赖边定义
 */
export interface Dependency {
  /** 源节点ID（被依赖的） */
  from: string
  /** 目标节点ID（依赖他人的） */
  to: string
  /** 依赖类型 */
  type: DependencyType
  /** 依赖强度（0-1） */
  strength: number
  /** 依赖描述 */
  description?: string
}

/**
 * 依赖类型
 */
export enum DependencyType {
  STRONG = 'strong', // 强依赖：必须完成后才能开始
  WEAK = 'weak', // 弱依赖：建议完成后开始，但可以并行
  ORDERING = 'ordering', // 顺序依赖：为了优化效果建议按顺序
}

/**
 * 依赖图定义
 */
export interface DependencyGraph {
  /** 所有节点（子目标） */
  nodes: Map<string, SubGoal>
  /** 所有依赖边 */
  edges: Dependency[]
  /** 是否有循环依赖 */
  hasCycles: boolean
  /** 拓扑排序结果（如果无循环） */
  topologicalOrder?: string[]
}

/**
 * 层次化计划定义
 */
export interface HierarchicalPlan {
  /** 计划唯一标识 */
  id: string
  /** 总目标描述 */
  goal: string
  /** 子目标列表 */
  subGoals: SubGoal[]
  /** 依赖图 */
  dependencies: DependencyGraph
  /** 预估总时长（秒） */
  estimatedDuration: number
  /** 预估总 Token 消耗 */
  estimatedTokens: number
  /** 实际总时长（秒） */
  actualDuration?: number
  /** 实际 Token 消耗 */
  actualTokens?: number
  /** 计划状态 */
  status: PlanStatus
  /** 创建时间 */
  createdAt: Date
  /** 开始时间 */
  startedAt?: Date
  /** 完成时间 */
  completedAt?: Date
  /** 元数据 */
  metadata?: Record<string, unknown>
}

/**
 * 计划状态
 */
export enum PlanStatus {
  DRAFT = 'draft', // 草稿
  READY = 'ready', // 就绪
  IN_PROGRESS = 'in_progress', // 执行中
  COMPLETED = 'completed', // 已完成
  FAILED = 'failed', // 失败
  CANCELLED = 'cancelled', // 已取消
}

/**
 * 执行上下文
 */
export interface PlanningExecutionContext {
  /** 执行ID */
  executionId: string
  /** 输入数据 */
  input: Record<string, unknown>
  /** 上下文变量 */
  variables: Map<string, unknown>
  /** 已完成的任务结果 */
  completedTasks: Map<string, PlanningTask>
  /** 当前执行的子目标ID */
  currentGoalId?: string
  /** 当前执行的任务ID */
  currentTaskId?: string
}

/**
 * 分解选项
 */
export interface DecompositionOptions {
  /** 最大分解深度 */
  maxDepth?: number
  /** 每个子目标的最大任务数 */
  maxTasksPerGoal?: number
  /** 是否启用智能分解（使用LLM） */
  enableIntelligentDecomposition?: boolean
  /** 分解领域（用于选择分解规则） */
  domain?: 'patent' | 'general' | 'research' | 'writing'
  /** 自定义分解规则 */
  customRules?: DecompositionRule[]
}

/**
 * 分解规则
 */
export interface DecompositionRule {
  /** 规则名称 */
  name: string
  /** 规则描述 */
  description: string
  /** 匹配条件（目标描述包含的关键词） */
  matchPattern: RegExp | string[]
  /** 分解策略 */
  strategy: 'sequential' | 'parallel' | 'hierarchical'
  /** 默认子目标模板 */
  subGoalTemplates: SubGoalTemplate[]
}

/**
 * 子目标模板
 */
export interface SubGoalTemplate {
  /** 模板标题 */
  title: string
  /** 模板描述 */
  description: string
  /** 默认任务模板 */
  taskTemplates: TaskTemplate[]
  /** 默认优先级 */
  priority: Priority
}

/**
 * 任务模板
 */
export interface TaskTemplate {
  /** 任务标题 */
  title: string
  /** 任务描述 */
  description: string
  /** 任务类型 */
  type: TaskType
  /** 需要的能力 */
  requiredCapabilities: string[]
  /** 预估 Token 数 */
  estimatedTokens: number
  /** 预估时长（秒） */
  estimatedDuration: number
}

/**
 * 调度结果
 */
export interface ScheduleResult {
  /** 调度后的任务执行顺序（子目标ID列表） */
  executionOrder: string[]
  /** 可并行的任务组 */
  parallelGroups: string[][]
  /** 关键路径（影响总时长的任务序列） */
  criticalPath: string[]
  /** 预估完成时间（秒） */
  estimatedCompletionTime: number
  /** 资源利用率（0-1） */
  resourceUtilization: number
}

/**
 * 偏离报告
 */
export interface DeviationReport {
  /** 是否有严重偏离 */
  isSevere: boolean
  /** 偏离程度（0-1，1表示完全偏离） */
  deviationDegree: number
  /** 偏离详情 */
  details: DeviationDetail[]
  /** 建议的修正措施 */
  suggestions: string[]
}

/**
 * 偏离详情
 */
export interface DeviationDetail {
  /** 偏离类型 */
  type: 'time' | 'quality' | 'resource' | 'outcome'
  /** 预期值 */
  expected: number | string
  /** 实际值 */
  actual: number | string
  /** 偏离程度 */
  degree: number
  /** 描述 */
  description: string
}

/**
 * 重规划上下文
 */
export interface ReplanningContext {
  /** 当前计划 */
  currentPlan: HierarchicalPlan
  /** 执行状态 */
  executionState: Map<string, unknown>
  /** 失败的任务 */
  failedTasks: PlanningTask[]
  /** 偏离报告 */
  deviationReport?: DeviationReport
  /** 可用资源 */
  availableResources: string[]
}

/**
 * 计划调整
 */
export interface PlanAdjustment {
  /** 调整类型 */
  type: 'retry' | 'skip' | 'reorder' | 'decompose' | 'abort'
  /** 任务修改列表 */
  modifications: TaskModification[]
  /** 调整原因 */
  reason: string
}

/**
 * 任务修改
 */
export interface TaskModification {
  /** 修改类型 */
  type: 'add' | 'remove' | 'modify' | 'reorder'
  /** 任务ID */
  taskId?: string
  /** 任务数据（新增或修改时使用） */
  task?: PlanningTask
  /** 新位置（重排序时使用） */
  newPosition?: number
}

/**
 * 任务分解器配置
 */
export interface TaskDecomposerConfig {
  /** LLM 实例（用于智能分解） */
  llm?: LLMAdapter
  /** 最大分解深度（默认3） */
  maxDepth?: number
  /** 每个子目标的最大任务数（默认10） */
  maxTasksPerGoal?: number
  /** 是否启用智能分解（默认false） */
  enableIntelligentDecomposition?: boolean
  /** 分解领域（默认general） */
  domain?: 'patent' | 'general' | 'research' | 'writing'
  /** 自定义分解规则 */
  customRules?: DecompositionRule[]
}

/**
 * 依赖分析器配置
 */
export interface DependencyAnalyzerConfig {
  /** 是否检测循环依赖（默认true） */
  detectCycles?: boolean
  /** 是否自动修复循环依赖（默认false） */
  autoFixCycles?: boolean
  /** 默认依赖类型（默认STRONG） */
  defaultDependencyType?: DependencyType
  /** 最小依赖强度（默认0.3） */
  minDependencyStrength?: number
}

/**
 * 任务调度器配置
 */
export interface TaskSchedulerConfig {
  /** 调度策略 */
  strategy?: 'topological' | 'priority' | 'critical_path' | 'parallel'
  /** 最大并行任务数（默认3） */
  maxParallelTasks?: number
  /** 是否考虑资源约束（默认true） */
  considerResourceConstraints?: boolean
  /** 可用资源列表 */
  availableResources?: string[]
}

/**
 * 统计信息
 */
export interface DecompositionStats {
  /** 总子目标数 */
  totalGoals: number
  /** 总任务数 */
  totalTasks: number
  /** 总依赖数 */
  totalDependencies: number
  /** 预估总时长（秒） */
  totalEstimatedDuration: number
  /** 预估总 Token 数 */
  totalEstimatedTokens: number
  /** 平均每子目标的任务数 */
  avgTasksPerGoal: number
  /** 最大深度 */
  maxDepth: number
  /** 关键路径长度（任务数） */
  criticalPathLength: number
}

/**
 * LLM 智能分解响应
 */
export interface LLMDecompositionResponse {
  /** 子目标列表 */
  subGoals: LLMSubGoal[]
}

/**
 * LLM 子目标响应
 */
export interface LLMSubGoal {
  /** 子目标标题 */
  title: string
  /** 子目标描述 */
  description: string
  /** 任务列表 */
  tasks: LLMTask[]
  /** 优先级 */
  priority: string
  /** 依赖项 */
  dependencies?: string[]
}

/**
 * LLM 任务响应
 */
export interface LLMTask {
  /** 任务标题 */
  title: string
  /** 任务描述 */
  description: string
  /** 任务类型 */
  type: string
  /** 预估时长（秒） */
  estimatedDuration: number
  /** 预估 Token 数 */
  estimatedTokens: number
}
