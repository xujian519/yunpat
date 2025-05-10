/**
 * 多 Agent 协调器类型定义
 *
 * Phase 3 核心类型：
 * - CaseUnderstanding: 专利案件理解
 * - WorkflowPlan: 工作流计划
 * - AgentTask: Agent 任务
 * - AgentHandoff: Agent 交接
 * - ReviewResult: 审查结果
 */

import type { Agent } from '../agent/Agent.js'
import type { ExecutionContext } from '../lifecycle/Lifecycle.js'

// ========== 案件理解 ==========

/**
 * 专利案件理解结果
 *
 * PatentCoordinator 在委托任何 Agent 之前必须先理解案件，
 * 这是 Coordinator 模式的核心约束。
 */
export interface CaseUnderstanding {
  /** 技术领域 */
  technicalField: string

  /** 技术问题 */
  technicalProblem: string

  /** 技术方案（核心） */
  technicalSolution: string

  /** 技术效果 */
  technicalEffects: string[]

  /** 关键技术特征 */
  keyFeatures: string[]

  /** 关键词（用于检索） */
  keywords: string[]

  /** IPC/CPC 分类号提示 */
  ipcHint?: string

  /** 专利类型 */
  patentType?: 'invention' | 'utilityModel' | 'design'

  /** 置信度 */
  confidence: number

  /** 需要澄清的问题（如理解不完整） */
  clarifications?: string[]

  /** 原始输入摘要 */
  originalInput: string
}

// ========== 工作流计划 ==========

/**
 * 工作流步骤
 */
export interface WorkflowPlanStep {
  /** 步骤 ID */
  id: string

  /** 步骤名称 */
  name: string

  /** 执行该步骤的 Agent 名称 */
  agentName: string

  /** 步骤描述 */
  description: string

  /** 输入映射（从 CaseUnderstanding 或其他步骤输出映射） */
  inputMapping?: Record<string, string>

  /** 依赖步骤 ID 列表 */
  dependencies?: string[]

  /** 所属并行组（同组步骤并行执行） */
  parallelGroup?: string

  /** 超时时间（毫秒） */
  timeout?: number

  /** 重试次数 */
  maxRetries?: number

  /** 审批要求 */
  requiresApproval?: boolean

  /** 审批提示 */
  approvalPrompt?: string
}

/**
 * 工作流计划
 */
export interface WorkflowPlan {
  /** 计划 ID */
  id: string

  /** 计划名称 */
  name: string

  /** 步骤列表 */
  steps: WorkflowPlanStep[]

  /** 案件理解 */
  caseUnderstanding: CaseUnderstanding

  /** 预估总耗时（毫秒） */
  estimatedDuration?: number

  /** 预估 Token 消耗 */
  estimatedTokens?: number
}

// ========== Agent 任务 ==========

/**
 * Agent 任务状态
 */
export enum CoordinatorTaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  BLOCKED = 'blocked',
  CANCELLED = 'cancelled',
}

/**
 * Agent 任务
 */
export interface AgentTask {
  /** 任务 ID */
  id: string

  /** 任务描述 */
  description: string

  /** 分配给的 Agent */
  assignee: string

  /** 任务状态 */
  status: CoordinatorTaskStatus

  /** 输入数据 */
  input: unknown

  /** 输出结果 */
  output?: unknown

  /** 错误信息 */
  error?: string

  /** 创建时间 */
  createdAt: Date

  /** 开始时间 */
  startedAt?: Date

  /** 完成时间 */
  completedAt?: Date

  /** 所属步骤 ID */
  stepId?: string

  /** 重试次数 */
  retryCount: number

  /** 父任务 ID（子任务） */
  parentTaskId?: string
}

// ========== Agent 交接 ==========

/**
 * 交接上下文
 */
export interface HandoffContext {
  /** 案件理解 */
  caseUnderstanding: CaseUnderstanding

  /** 已完成任务的输出摘要 */
  completedTasks: Array<{
    taskId: string
    agentName: string
    outputSummary: string
  }>

  /** 关键决策记录 */
  keyDecisions: string[]

  /** 待解决问题 */
  openIssues: string[]

  /** 共享记忆键 */
  sharedMemoryKeys: string[]
}

/**
 * 交接结果
 */
export interface HandoffResult {
  /** 是否成功 */
  success: boolean

  /** 接收 Agent */
  recipient: string

  /** 交接上下文 */
  context: HandoffContext

  /** 接收确认 */
  acknowledged: boolean

  /** 接收方问题/澄清 */
  clarifications?: string[]

  /** 错误信息 */
  error?: string
}

// ========== 审查结果 ==========

/**
 * 审查标准
 */
export interface ReviewCriteria {
  /** 质量维度 */
  dimensions: Array<{
    name: string
    weight: number
    description: string
  }>

  /** 最低可接受分数 */
  minAcceptableScore: number

  /** 必须满足的条件 */
  mustMeetConditions?: string[]
}

/**
 * 维度评分
 */
export interface DimensionScore {
  /** 维度名称 */
  name: string

  /** 分数（0-100） */
  score: number

  /** 评价 */
  assessment: string

  /** 改进建议 */
  suggestions?: string[]
}

/**
 * 审查结果
 */
export interface ReviewResult {
  /** 是否通过 */
  passed: boolean

  /** 总体分数 */
  overallScore: number

  /** 各维度评分 */
  dimensionScores: DimensionScore[]

  /** 关键问题 */
  criticalIssues: string[]

  /** 改进建议 */
  improvements: string[]

  /** 是否需要重做 */
  needsRework: boolean

  /** 重做建议 */
  reworkSuggestion?: string
}

// ========== 协调器配置 ==========

/**
 * Agent 团队角色定义
 */
export interface AgentRole {
  /** 角色 ID */
  id: string

  /** 角色名称 */
  name: string

  /** 能力描述 */
  capabilities: string[]

  /** Agent 实例 */
  agent: Agent

  /** 最大并发任务数 */
  maxConcurrency?: number
}

/**
 * PatentCoordinator 配置
 */
export interface PatentCoordinatorConfig {
  /** 理解案件的最大 LLM 调用轮数 */
  maxUnderstandingRounds?: number

  /** 审查阈值（默认 70） */
  reviewThreshold?: number

  /** 最大重试次数 */
  maxRetries?: number

  /** 是否启用并行执行 */
  enableParallelExecution?: boolean

  /** 是否启用审批流程 */
  enableApprovalFlow?: boolean
}

// ========== 协调器事件 ==========

/**
 * 协调器事件类型
 */
export type CoordinatorEventType =
  | 'coordinator:case_understood'
  | 'coordinator:plan_created'
  | 'coordinator:task_delegated'
  | 'coordinator:task_completed'
  | 'coordinator:task_failed'
  | 'coordinator:output_reviewed'
  | 'coordinator:handoff_initiated'
  | 'coordinator:handoff_completed'
  | 'coordinator:workflow_finalized'
  | 'coordinator:error'

/**
 * 协调器事件数据
 */
export interface CoordinatorEventData {
  type: CoordinatorEventType
  coordinatorId: string
  workflowId: string
  timestamp: Date
  payload: unknown
}
