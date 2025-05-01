/**
 * @file TUI 类型定义
 * @description 与 Rust 网关通信的类型定义
 */

// ============================================================================
// 网关事件类型
// ============================================================================

export type GatewayEventType =
  | 'intent'
  | 'plan'
  | 'hitl'
  | 'progress'
  | 'result'
  | 'error'
  | 'connected'
  | 'disconnected'
  // 新增：步骤级别
  | 'step_start'
  | 'step_complete'
  | 'step_error'
  // 新增：工作流级别
  | 'workflow_start'
  | 'workflow_done'

// 事件 payload 类型定义
export interface ProgressPayload {
  progress: number
  stage?: string
  currentAgent?: string
}

export interface IntentPayload {
  intent: string
  confidence: number
  source?: 'command' | 'keyword' | 'llm' | 'gateway' | 'chitchat'
  skip_call1?: boolean
}

export interface PlanPayload {
  tasks: Array<{
    id: string
    description: string
    agent: string
  }>
}

export interface ResultPayload {
  result: string
  metadata?: {
    agent?: string
    confidence?: number
    tokensUsed?: number
    intent?: string
  }
}

export interface ErrorPayload {
  error: string
  code?: string
  details?: Record<string, unknown>
}

export interface HITLPayload {
  requestId: string
  sessionId: string
  checkpointId: string
  content: HITLContent
  options: HITLOption[]
  timeout: number
}

export interface ConnectedPayload {
  sessionId: string
  gatewayVersion: string
}

/** 步骤开始事件 */
export interface StepStartPayload {
  stepId: string
  stepName: string
  stepIndex: number
  totalSteps: number
  status: 'running'
  hitl: boolean
}

/** 步骤完成事件 */
export interface StepCompletePayload {
  stepId: string
  stepName: string
  status: 'completed' | 'failed'
  duration: number
  details?: string
  data?: Record<string, unknown>
}

export type EventPayload =
  | ProgressPayload
  | IntentPayload
  | PlanPayload
  | ResultPayload
  | ErrorPayload
  | HITLPayload
  | ConnectedPayload
  | StepStartPayload
  | StepCompletePayload
  | null

export interface GatewayEvent {
  eventId: string
  sessionId: string
  eventType: GatewayEventType
  timestamp: number
  payload: EventPayload
}

// ============================================================================
// 类型守卫
// ============================================================================

export function isProgressPayload(payload: unknown): payload is ProgressPayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'progress' in payload &&
    typeof (payload as ProgressPayload).progress === 'number'
  )
}

export function isIntentPayload(payload: unknown): payload is IntentPayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'intent' in payload &&
    typeof (payload as IntentPayload).intent === 'string'
  )
}

export function isPlanPayload(payload: unknown): payload is PlanPayload {
  if (typeof payload !== 'object' || payload === null || !('tasks' in payload)) {
    return false
  }
  const p = payload as PlanPayload
  return (
    Array.isArray(p.tasks) &&
    p.tasks.every(
      (t) => typeof t === 'object' && t !== null && 'id' in t && 'description' in t && 'agent' in t
    )
  )
}

export function isResultPayload(payload: unknown): payload is ResultPayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'result' in payload &&
    typeof (payload as ResultPayload).result === 'string'
  )
}

export function isErrorPayload(payload: unknown): payload is ErrorPayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'error' in payload &&
    typeof (payload as ErrorPayload).error === 'string'
  )
}

export function isHITLPayload(payload: unknown): payload is HITLPayload {
  if (
    typeof payload !== 'object' ||
    payload === null ||
    !('requestId' in payload) ||
    !('options' in payload)
  ) {
    return false
  }
  const p = payload as HITLPayload
  return (
    typeof p.requestId === 'string' &&
    Array.isArray(p.options) &&
    p.options.every(
      (opt) => typeof opt === 'object' && opt !== null && 'id' in opt && 'action' in opt
    )
  )
}

export function isConnectedPayload(payload: unknown): payload is ConnectedPayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'sessionId' in payload &&
    typeof (payload as ConnectedPayload).sessionId === 'string'
  )
}

export function isStepStartPayload(payload: unknown): payload is StepStartPayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'stepId' in payload &&
    typeof (payload as Record<string, unknown>).stepId === 'string' &&
    'stepName' in payload &&
    typeof (payload as Record<string, unknown>).stepName === 'string' &&
    'stepIndex' in payload &&
    typeof (payload as Record<string, unknown>).stepIndex === 'number' &&
    'totalSteps' in payload &&
    typeof (payload as Record<string, unknown>).totalSteps === 'number'
  )
}

export function isStepCompletePayload(payload: unknown): payload is StepCompletePayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'stepId' in payload &&
    typeof (payload as Record<string, unknown>).stepId === 'string' &&
    'stepName' in payload &&
    typeof (payload as Record<string, unknown>).stepName === 'string' &&
    'status' in payload &&
    typeof (payload as Record<string, unknown>).status === 'string'
  )
}

// ============================================================================
// 会话消息类型
// ============================================================================

export type MessageRole = 'user' | 'assistant' | 'system'

export interface SessionMessage {
  role: MessageRole
  content: string
  timestamp: number
  metadata?: {
    agent?: string
    stage?: string
    confidence?: number
  }
}

// ============================================================================
// 会话状态类型
// ============================================================================

export type SessionStatus = 'idle' | 'processing' | 'waiting_hitl' | 'completed' | 'error'

export interface Session {
  id: string
  userId: string
  createdAt: number
  updatedAt: number
  status: SessionStatus
  messages: SessionMessage[]
}

// ============================================================================
// HITL 类型
// ============================================================================

export interface HITLRequest {
  requestId: string
  sessionId: string
  checkpointId: string
  content: HITLContent
  options: HITLOption[]
  timeout: number
}

export type HITLContent =
  | { type: 'confirmation'; message: string }
  | { type: 'choice'; message: string; choices: string[] }
  | { type: 'correction'; message: string; data: Record<string, unknown> }
  | { type: 'input'; message: string; fieldType: 'text' | 'number' | 'select' }

export interface HITLOption {
  id: string
  label: string
  action: 'approve' | 'reject' | 'modify' | 'skip'
}

export interface HITLResponse {
  requestId: string
  action: HITLAction
  feedback?: string
  corrections?: Record<string, unknown>
}

export type HITLAction = 'approve' | 'reject' | 'modify' | 'skip'

// ============================================================================
// Orchestrator 状态类型
// ============================================================================

export type OrchestratorStage =
  | 'idle'
  | 'intent'
  | 'planning'
  | 'processing'
  | 'execution'
  | 'hitl'
  | 'done'
  | 'error'

export interface OrchestratorStatus {
  stage: OrchestratorStage
  intent?: string
  plan?: TaskPlan
  progress: number
  currentAgent?: string
  error?: string
}

export interface TaskPlan {
  tasks: Task[]
  estimatedDuration: number
}

export interface Task {
  id: string
  description: string
  agent: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
}

// ============================================================================
// 工作流状态（新增）
// ============================================================================

export interface WorkflowStep {
  stepId: string
  name: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'waiting_hitl'
  progress: number
  duration?: number
  details?: string
  result?: Record<string, unknown>
}

export interface WorkflowState {
  type:
    | 'DRAFT_FULL'
    | 'DRAFT_CLAIMS'
    | 'DRAFT_SPEC'
    | 'RESPOND_OA'
    | 'SEARCH'
    | 'ANALYZE_PORTFOLIO'
    | 'INIT_WORKSPACE'
    | null
  totalSteps: number
  steps: WorkflowStep[]
  startTime: number
  currentStepIndex: number
}

// ============================================================================
// TUI 内部状态
// ============================================================================

export interface TUIState {
  session: Session | null
  messages: SessionMessage[]
  connected: boolean
  gatewayUrl: string
  orchestratorStatus: OrchestratorStatus
  pendingHITL: HITLRequest | null
  workflow: WorkflowState | null
}

export interface TUIActions {
  createSession: (userId: string) => Promise<void>
  sendMessage: (content: string) => Promise<void>
  connect: (url: string) => void
  disconnect: () => void
  respondHITL: (response: HITLResponse) => Promise<void>
  setConnected: (connected: boolean) => void
  updateOrchestratorStatus: (status: Partial<OrchestratorStatus>) => void
  addMessage: (message: SessionMessage) => void
  setPendingHITL: (request: HITLRequest | null) => void
}

// ============================================================================
// 意图类型（与 Gateway 对齐）
// ============================================================================

export type IntentType =
  | 'DRAFT_FULL'
  | 'DRAFT_CLAIMS'
  | 'DRAFT_SPEC'
  | 'RESPOND_OA'
  | 'SEARCH'
  | 'ANALYZE_PORTFOLIO'
  | 'CODING'
  | 'CHITCHAT'
  | 'CLARIFY'
  | 'INIT_WORKSPACE'
