/**
 * 工作流引擎
 *
 * 对TaskScheduler的轻量封装，专门用于Agent编排
 * 支持步骤间数据传递、审批、检查点
 */
import type { EventBus, MemoryStore } from '../lifecycle/Lifecycle.js'
import type { Agent } from '../agent/Agent.js'
import type { ApprovalFlow } from '../gateway/ApprovalFlow.js'
import type { CheckpointManager } from '../memory/CheckpointManager.js'
/**
 * 工作流步骤
 */
export interface WorkflowStep {
  /** 步骤ID */
  id: string
  /** 步骤名称 */
  name: string
  /** 执行该步骤的Agent名称 */
  agentName: string
  /** 从前序步骤输出映射输入 */
  inputMapping?: Record<string, string>
  /** 超时时间（毫秒） */
  timeout?: number
  /** 是否需要人工审批 */
  requiresApproval?: boolean
  /** 审批提示信息 */
  approvalPrompt?: string
  /** 步骤描述 */
  description?: string
}
/**
 * 工作流定义
 */
export interface WorkflowDefinition {
  /** 工作流ID */
  id: string
  /** 工作流名称 */
  name: string
  /** 工作流描述 */
  description?: string
  /** 步骤列表 */
  steps: WorkflowStep[]
  /** 步骤依赖关系 */
  dependencies?: Array<{
    from: string
    to: string
  }>
  /** 初始输入 */
  initialInput?: unknown
  /** 是否启用检查点 */
  enableCheckpoints?: boolean
  /** 全局超时时间（毫秒） */
  timeout?: number
}
/**
 * 工作流步骤结果
 */
export interface WorkflowStepResult {
  /** 步骤ID */
  stepId: string
  /** 步骤名称 */
  stepName: string
  /** 执行的Agent名称 */
  agentName: string
  /** 步骤输出 */
  output: unknown
  /** 是否成功 */
  success: boolean
  /** 错误信息 */
  error?: string
  /** 执行开始时间 */
  startTime: Date
  /** 执行结束时间 */
  endTime: Date
  /** 执行耗时（毫秒） */
  duration: number
  /** 是否经过审批 */
  approved?: boolean
  /** 审批反馈 */
  approvalFeedback?: string
}
/**
 * 工作流执行结果
 */
export interface WorkflowResult {
  /** 工作流ID */
  workflowId: string
  /** 执行ID */
  executionId: string
  /** 是否成功 */
  success: boolean
  /** 步骤结果列表 */
  stepResults: WorkflowStepResult[]
  /** 最终输出 */
  finalOutput: unknown
  /** 执行开始时间 */
  startTime: Date
  /** 执行结束时间 */
  endTime: Date
  /** 总耗时（毫秒） */
  totalDuration: number
  /** 错误信息 */
  error?: string
}
/**
 * 工作流配置
 */
export interface WorkflowEngineConfig {
  /** 事件总线 */
  eventBus: EventBus
  /** 记忆存储 */
  memory: MemoryStore
  /** Agent注册表 */
  agents: Map<string, Agent>
  /** 审批流程（可选） */
  approvalFlow?: ApprovalFlow
  /** 检查点管理器（可选） */
  checkpointManager?: CheckpointManager
}
/**
 * 工作流引擎
 */
export declare class WorkflowEngine {
  private config
  private activeWorkflows
  private readonly MAX_ACTIVE_WORKFLOWS
  constructor(config: WorkflowEngineConfig)
  /**
   * 清理旧的工作流执行记录
   */
  private cleanupOldWorkflows
  /**
   * 执行工作流
   *
   * @param workflow 工作流定义
   * @param initialInput 初始输入
   * @returns 工作流执行结果
   */
  execute(workflow: WorkflowDefinition, initialInput?: unknown): Promise<WorkflowResult>
  private runExecution
  /**
   * 执行单个步骤
   */
  private executeStep
  /**
   * 准备步骤输入（应用inputMapping）
   */
  private prepareStepInput
  /**
   * 提取最终输出
   */
  private extractFinalOutput
  private saveCheckpoint
  pause(executionId: string): Promise<void>
  resume(executionId: string): Promise<WorkflowResult>
  private parseStartTime
}
//# sourceMappingURL=WorkflowEngine.d.ts.map
