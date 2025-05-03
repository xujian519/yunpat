/**
 * OrchestratorAgent - 中枢层类型定义
 *
 * 这是YunPat系统的中枢层，负责意图识别、任务规划、HITL交互、结果聚合和异常降级
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import type { AgentConfig } from '@yunpat/core'
import type { AgentResult as BaseAgentResult } from '@yunpat/agent-base'

/**
 * 执行上下文（简化版）
 */
export interface ExecutionContext {
  sessionId?: string
  userId?: string
  message?: string
  logger?: {
    info: (...args: any[]) => void
    error: (...args: any[]) => void
    warn: (...args: any[]) => void
  }
  memory?: {
    get: (key: string) => any
    set: (key: string, value: any) => void
  }
  eventBus?: {
    emit: (event: string, data: any) => void
    on: (event: string, handler: (...args: any[]) => void) => void
  }
}

// ============================================================================
// 意图类型定义
// ============================================================================

/**
 * 10种意图类型
 *
 * 核心业务意图（7个）：
 * - DRAFT_FULL: 完整专利撰写（检索+说明书+权利要求+摘要）
 * - DRAFT_CLAIMS: 仅撰写/修改权利要求
 * - DRAFT_SPEC: 仅撰写说明书
 * - RESPOND_OA: 审查意见答复
 * - SEARCH: 现有技术检索
 * - ANALYZE_PORTFOLIO: 专利组合分析
 * - CODING: 编程开发任务（直接回复，不走 Agent）
 *
 * 系统意图（3个）：
 * - MULTI_INTENT: 一条消息包含多个任务
 * - CLARIFY: 意图不明确，需要追问
 * - CHITCHAT: 闲聊、感谢、询问功能
 */
export type IntentType =
  | 'DRAFT_FULL'
  | 'DRAFT_CLAIMS'
  | 'DRAFT_SPEC'
  | 'RESPOND_OA'
  | 'SEARCH'
  | 'ANALYZE_PORTFOLIO'
  | 'CODING'
  | 'MULTI_INTENT'
  | 'CLARIFY'
  | 'CHITCHAT'
  | 'INIT_WORKSPACE'

/**
 * 意图复杂度
 */
export type IntentComplexity = 'simple' | 'complex'

/**
 * 意图分类配置（单条）
 * 用于配置化意图系统，替代硬编码的专利意图类型
 */
export interface IntentCategoryConfig {
  /** 意图标识符，如 'DRAFT_FULL'、'SEARCH' */
  intentId: string
  /** 显示标签 */
  label: string
  /** 简要描述（注入到 System Prompt） */
  description: string
  /** 触发关键词 */
  keywords: string[]
  /** 复杂度 */
  complexity: IntentComplexity
  /** 是否为系统意图（CLARIFY/CHITCHAT/MULTI_INTENT 等） */
  isSystemIntent?: boolean
}

/**
 * 意图领域配置
 * 中枢通过此配置理解可用的意图类型，而非硬编码业务知识
 */
export interface IntentDomainConfig {
  /** 领域名称，如 '专利管理' */
  domainName: string
  /** 领域简要描述 */
  domainDescription: string
  /** 意图分类列表 */
  categories: IntentCategoryConfig[]
  /** Few-shot 示例（意图识别用） */
  fewShotExamples: Array<{
    input: string
    output: IntentRecognitionResult
  }>
  /** 默认任务计划模板（LLM 失败时的降级方案） */
  defaultPlans?: Record<string, (intent: IntentRecognitionResult) => TaskPlan>
  /** 意图到 Agent 的直达路由映射（简单意图用） */
  directRoutes?: Record<string, string>
}

/**
 * 意图识别结果
 */
export interface IntentRecognitionResult {
  /** 意图类型 */
  intent: IntentType
  /** 置信度（0-1） */
  confidence: number
  /** 复杂度 */
  complexity: IntentComplexity
  /** 提取的信息 */
  extracted: {
    /** 发明名称（如有） */
    title?: string
    /** 技术领域（如有） */
    field?: string
    /** 是否有附件 */
    hasAttachment: boolean
    /** 紧急程度 */
    urgency: 'normal' | 'urgent'
    /** 关键词列表 */
    keywords: string[]
  }
  /** 追问问题（仅当intent=CLARIFY时） */
  clarifyQuestion?: string
}

// ============================================================================
// 任务规划定义
// ============================================================================

/**
 * 任务步骤
 */
export interface TaskStep {
  /** 步骤ID */
  stepId: string
  /** 目标Agent ID */
  agentId: string
  /** Agent层级 */
  layer: 'domain' | 'execution'
  /** 是否可并行 */
  parallel: boolean
  /** 依赖的步骤ID列表 */
  dependsOn: string[]
  /** 超时时间（毫秒） */
  timeout: number
  /** 输入参数 */
  input: Record<string, any>
  /** 是否需要HITL确认 */
  hitl: boolean
  /** HITL描述（hitl=true时） */
  hitlDescription?: string
  /** 失败是否重试 */
  retryOnFailure: boolean
  /** 最大重试次数 */
  maxRetries: number
}

/**
 * 任务计划
 */
export interface TaskPlan {
  /** 计划ID */
  planId: string
  /** 意图类型 */
  intent: IntentType
  /** 预计耗时（分钟） */
  estimatedMinutes: number
  /** 任务步骤列表 */
  steps: TaskStep[]
  /** 需要HITL确认的步骤ID列表 */
  hitlCheckpoints: string[]
  /** 元数据 */
  metadata: {
    /** 创建时间 */
    createdAt: Date
    /** 是否可并行 */
    parallelizable: boolean
    /** 预计成本（美元） */
    estimatedCost?: number
  }
}

// ============================================================================
// HITL定义
// ============================================================================

/**
 * HITL请求
 */
export interface HITLRequest {
  /** 检查点ID */
  checkpointId: string
  /** 步骤ID */
  stepId: string
  /** 描述信息 */
  description: string
  /** 数据 */
  data: Record<string, any>
  /** 选项 */
  options: {
    /** 确认按钮文本 */
    confirmButtonText: string
    /** 拒绝按钮文本 */
    rejectButtonText: string
    /** 是否允许修改 */
    modificationAllowed: boolean
    /** 超时时间（毫秒） */
    timeout: number
  }
}

/**
 * HITL响应
 */
export interface HITLResponse {
  /** 操作类型 */
  action: 'confirm' | 'reject' | 'modify'
  /** 修改内容（action=modify时） */
  modifications?: Record<string, any>
  /** 反馈信息（action=reject时） */
  feedback?: string
}

/**
 * HITL结果
 */
export interface HITLResult {
  /** 状态 */
  status: 'confirmed' | 'rejected' | 'modified' | 'timeout'
  /** 数据 */
  data?: Record<string, any>
  /** 反馈 */
  feedback?: string
}

// ============================================================================
// 上下文管理定义
// ============================================================================

/**
 * 对话消息
 */
export interface ConversationMessage {
  /** 消息ID */
  id: string
  /** 角色 */
  role: 'user' | 'assistant' | 'system'
  /** 内容 */
  content: string
  /** 时间戳 */
  timestamp: Date
  /** 元数据 */
  metadata?: Record<string, any>
}

/**
 * 对话历史
 */
export interface ConversationHistory {
  /** 会话ID */
  sessionId: string
  /** 消息列表 */
  messages: ConversationMessage[]
  /** 总Token数 */
  totalTokens: number
  /** 最后更新时间 */
  lastUpdated: Date
}

/**
 * 活跃任务
 */
export interface ActiveTask {
  /** 任务ID */
  taskId: string
  /** 会话ID */
  sessionId: string
  /** 任务计划 */
  plan: TaskPlan
  /** 状态 */
  status: 'running' | 'waiting_hitl' | 'paused' | 'completed' | 'failed'
  /** 当前步骤ID */
  currentStepId?: string
  /** 已完成步骤ID列表 */
  completedSteps: string[]
  /** 执行结果 */
  results: Map<string, AgentResult>
  /** 开始时间 */
  startTime: Date
  /** 最后更新时间 */
  lastUpdate: Date
}

/**
 * 用户画像
 */
export interface UserProfile {
  /** 用户ID */
  userId: string
  /** 角色 */
  role: 'patent_agent' | 'lawyer' | 'enterprise_ip' | 'individual'
  /** 输出格式偏好 */
  outputFormat: 'detailed' | 'concise' | 'technical'
  /** 常用技术领域 */
  domains: string[]
  /** 偏好设置 */
  preferences: {
    /** 语言 */
    language: 'zh' | 'en'
    /** 是否包含法律依据 */
    includeLegalBasis: boolean
    /** 是否包含示例 */
    includeExamples: boolean
    /** 语气 */
    tone: 'formal' | 'friendly' | 'professional'
  }
  /** 统计信息 */
  statistics: {
    /** 总任务数 */
    totalTasks: number
    /** 各类型任务数 */
    taskTypes: Record<string, number>
    /** 平均任务时长（毫秒） */
    averageTaskDuration: number
    /** 最后活跃时间 */
    lastActive: Date
  }
}

// ============================================================================
// Agent结果定义
// ============================================================================

/**
 * Agent执行结果（从 @yunpat/agent-base 重新导出）
 * 保持向后兼容：data 类型为 Record<string, any>
 */
export type AgentResult = BaseAgentResult<Record<string, any>>

/**
 * 任务执行结果
 */
export interface TaskExecutionResult {
  /** 任务计划 */
  plan: TaskPlan
  /** 所有步骤结果 */
  results: Map<string, AgentResult>
  /** HITL结果列表 */
  hitlResults?: HITLResult[]
  /** 是否成功 */
  success: boolean
  /** 错误信息（失败时） */
  error?: Error
  /** 执行时长（毫秒） */
  executionTime: number
}

// ============================================================================
// 路由定义
// ============================================================================

/**
 * 路由决策
 */
export interface RoutingDecision {
  /** 路由类型 */
  type: 'direct' | 'orchestrated' | 'clarify' | 'chitchat'
  /** 目标Agent（type=direct时） */
  targetAgent?: string
  /** 任务计划（type=orchestrated时） */
  taskPlan?: TaskPlan
  /** 追问问题（type=clarify时） */
  clarifyQuestion?: string
  /** 闲聊回复（type=chitchat时） */
  chitchatResponse?: string
}

// ============================================================================
// 附件定义
// ============================================================================

/**
 * 附件
 */
export interface Attachment {
  /** 附件ID */
  id: string
  /** 文件名 */
  filename: string
  /** MIME类型 */
  mimeType: string
  /** 文件大小（字节） */
  size: number
  /** 文件URL或Buffer */
  data: string | Buffer
  /** 元数据 */
  metadata?: Record<string, any>
}

// ============================================================================
// OrchestratorAgent配置
// ============================================================================

/**
 * LLM配置
 */
export interface OrchestratorLLMConfig {
  /** 提供商 */
  provider: 'anthropic' | 'openai' | 'local'
  /** 模型名称 */
  model: string
  /** 温度（0-1） */
  temperature?: number
  /** 最大Token数 */
  maxTokens?: number
  /** API密钥 */
  apiKey?: string
  /** API基础URL（本地模型时） */
  baseURL?: string
  /** LLM适配器实例 */
  adapter?: any
}

/**
 * 意图识别配置
 */
export interface OrchestratorIntentConfig {
  /** 置信度阈值（默认0.7） */
  confidenceThreshold: number
  /** 最大追问轮数（默认3） */
  maxClarifyRounds: number
}

/**
 * 任务规划配置
 */
export interface OrchestratorPlanningConfig {
  /** 最大步骤数（默认20） */
  maxSteps: number
  /** 默认超时时间（毫秒，默认30000） */
  defaultTimeout: number
  /** 是否启用并行（默认true） */
  enableParallel: boolean
}

/**
 * HITL配置
 */
export interface OrchestratorHITLConfig {
  /** 自动确认阈值（默认0.9） */
  autoConfirmThreshold: number
  /** 超时时间（毫秒，默认300000） */
  timeout: number
}

/**
 * 专业层Agent配置
 */
export interface ProfessionalAgentsConfig {
  /** 是否启用PatentWriterAgent */
  patentWriter?: boolean
  /** 是否启用PatentResponderAgent */
  patentResponder?: boolean
  /** 是否启用PatentAnalyzerAgent */
  patentAnalyzer?: boolean
  /** 是否启用PatentSearchAgent */
  patentSearch?: boolean
}

/**
 * OrchestratorAgent配置
 */
export interface OrchestratorAgentConfig extends AgentConfig {
  /** LLM配置 */
  llmConfig: OrchestratorLLMConfig
  /** 意图识别配置 */
  intentConfig: OrchestratorIntentConfig
  /** 任务规划配置 */
  planningConfig: OrchestratorPlanningConfig
  /** HITL配置 */
  hitlConfig: OrchestratorHITLConfig
  /** 专业层Agent配置 */
  professionalAgents?: ProfessionalAgentsConfig
  /** 自定义LLMClient实例（用于测试和依赖注入） */
  llmClient?: any
  /** 意图领域配置（不传则使用默认的专利意图配置） */
  domainConfig?: IntentDomainConfig
  /** 问候语（CHITCHAT 时使用） */
  greetingMessage?: string
}

// ============================================================================
// OrchestratorAgent输入输出
// ============================================================================

/**
 * OrchestratorAgent输入
 */
export interface OrchestratorInput {
  /** 会话ID */
  sessionId: string
  /** 用户ID */
  userId: string
  /** 用户消息 */
  message: string
  /** 附件列表 */
  attachments?: Attachment[]
  /** 额外上下文 */
  context?: Record<string, any>
  /** Gateway 预设意图，跳过 Call 1 */
  intentOverride?: IntentType
  /** 工作区文件信号 */
  fileSignals?: FileSignal[]
  /** 编排进度回调 */
  onProgress?: (stage: string, detail?: string) => void
}

/**
 * 性能指标
 */
export interface PerformanceMetrics {
  /** 总执行时间（毫秒） */
  totalDuration: number
  /** 意图识别时间（毫秒） */
  intentRecognitionDuration: number
  /** 任务规划时间（毫秒） */
  taskPlanningDuration: number
  /** 任务执行时间（毫秒） */
  taskExecutionDuration: number
  /** HITL生成时间（毫秒） */
  hitlGenerationDuration: number
  /** 结果聚合时间（毫秒） */
  resultAggregationDuration: number
  /** LLM调用次数 */
  llmCallsCount: number
}

/**
 * 执行统计
 */
export interface ExecutionStats {
  /** 执行的步骤数 */
  stepsExecuted: number
  /** 成功的步骤数 */
  successfulSteps: number
  /** 失败的步骤数 */
  failedSteps: number
  /** HITL检查点数 */
  hitlCheckpoints: number
}

/**
 * OrchestratorAgent输出
 */
export interface OrchestratorOutput {
  /** 响应内容 */
  response: string
  /** 附件列表 */
  attachments?: Attachment[]
  /** 建议操作 */
  suggestedActions?: string[]
  /** 是否需要HITL */
  requiresHITL: boolean
  /** HITL请求列表（requiresHITL=true时） */
  hitlRequests?: HITLRequest[]
  /** 元数据 */
  metadata: {
    /** 意图类型 */
    intent: IntentType
    /** 置信度 */
    confidence: number
    /** 执行时长（毫秒） */
    executionTime: number
    /** 执行的步骤数 */
    stepsExecuted: number
    /** 性能指标（可选） */
    metrics?: PerformanceMetrics
    /** 执行统计（可选） */
    stats?: ExecutionStats
  }
}

/**
 * OrchestratorAgent计划（内部使用）
 */
export interface OrchestratorPlan {
  /** 意图识别结果 */
  intentResult: IntentRecognitionResult
  /** 路由决策 */
  routingDecision: RoutingDecision
  /** 任务计划（复杂编排时） */
  taskPlan?: TaskPlan
}

// ============================================================================
// OrchestratorAgent类定义
// ============================================================================

/**
 * OrchestratorAgent - 中枢层智能调度Agent
 *
 * 职责：
 * 1. 意图识别（Call 1）：理解用户需求，分类为9种意图类型
 * 2. 任务规划（Call 2）：生成多步骤执行计划
 * 3. HITL生成（Call 3）：关键节点人机交互确认
 * 4. 结果聚合（Call 4）：整合多Agent输出结果
 * 5. 异常降级（Call 5）：优雅处理错误和边缘情况
 *
 * 特点：
 * - 有状态：管理对话历史、活跃任务、用户画像
 * - 智能路由：简单任务直达，复杂任务编排
 * - 并行优化：自动识别并行步骤，提升效率
 * - 性能监控：记录每个阶段的执行时间和LLM调用次数
 *
 * 注意：完整实现位于OrchestratorAgent.ts，此处仅为类型参考
 */

/**
 * 聚合结果（Call 4输出）
 */
export interface AggregatedResult {
  /** Markdown格式响应 */
  markdown: string
  /** 附件列表 */
  attachments: Attachment[]
  /** 建议操作 */
  suggestedActions: string[]
  /** 元数据 */
  metadata: Record<string, any>
}

/**
 * 恢复结果（Call 5输出）
 */
export interface RecoveryResult {
  /** 是否成功恢复 */
  success: boolean
  /** 恢复策略 */
  strategy: 'retry' | 'fallback' | 'graceful_degradation' | 'error_message'
  /** 结果数据（成功恢复时） */
  result?: OrchestratorOutput
  /** 错误消息（无法恢复时） */
  errorMessage?: string
  /** 恢复消息（用于向用户展示） */
  recoveryMessage?: string
}

// ============================================================================
// 文件信号定义
// ============================================================================

/**
 * 文件信号类型
 */
export type FileSignalType =
  | 'office_action'
  | 'technical_disclosure'
  | 'patent_draft'
  | 'search_report'
  | 'reference_document'

/**
 * 工作区文件信号（由 Gateway 扫描生成）
 */
export interface FileSignal {
  path: string
  filename: string
  extension: string
  mimeType: string
  signalType: FileSignalType
  confidence: number
}
