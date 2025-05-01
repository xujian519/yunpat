/**
 * 可观测性类型定义
 */
export declare enum TelemetryEventType {
  AGENT_STARTED = 'agent.started',
  AGENT_COMPLETED = 'agent.completed',
  AGENT_FAILED = 'agent.failed',
  STAGE_STARTED = 'stage.started',
  STAGE_COMPLETED = 'stage.completed',
  STAGE_FAILED = 'stage.failed',
  TOOL_CALLED = 'tool.called',
  TOOL_FAILED = 'tool.failed',
  LLM_CALLED = 'llm.called',
  LLM_FAILED = 'llm.failed',
  LLM_TOKEN_USAGE = 'llm.token_usage',
  MEMORY_READ = 'memory.read',
  MEMORY_WRITE = 'memory.write',
  MEMORY_CHECKPOINT = 'memory.checkpoint',
}
export declare enum EventStatus {
  SUCCESS = 'success',
  FAILURE = 'failure',
  PENDING = 'pending',
}
export interface TelemetryEvent {
  id: string
  type: TelemetryEventType
  timestamp: number
  agentName?: string
  stage?: string
  duration?: number
  status: EventStatus
  metadata?: Record<string, unknown>
  error?: Error
}
export interface TelemetryReport {
  period: {
    start: number
    end: number
  }
  summary: {
    totalEvents: number
    successEvents: number
    failedEvents: number
    successRate: number
    avgDuration: number
  }
  byAgent: Map<string, AgentMetrics>
  byStage: Map<string, StageMetrics>
  topErrors: ErrorMetric[]
  alerts: Alert[]
}
export interface AgentMetrics {
  agentName: string
  totalExecutions: number
  successCount: number
  failureCount: number
  successRate: number
  avgDuration: number
  minDuration: number
  maxDuration: number
}
export interface StageMetrics {
  stage: string
  totalExecutions: number
  successCount: number
  failureCount: number
  successRate: number
  avgDuration: number
}
export interface ErrorMetric {
  error: string
  count: number
  lastOccurrence: number
  affectedAgents: string[]
}
export interface Alert {
  id: string
  type: AlertType
  severity: AlertSeverity
  message: string
  timestamp: number
  event: TelemetryEvent
  threshold?: number
  actualValue?: number
}
export declare enum AlertType {
  SLOW_EXECUTION = 'slow_execution',
  HIGH_FAILURE_RATE = 'high_failure_rate',
  ERROR_SPIKE = 'error_spike',
  MEMORY_LEAK = 'memory_leak',
}
export declare enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}
export interface AlertConfig {
  slowExecutionThreshold?: number
  highFailureRateThreshold?: number
  errorSpikeThreshold?: number
  enableAlerts?: boolean
}
export interface TelemetryConfig {
  maxEvents?: number
  maxErrors?: number
  retentionPeriod?: number
  alertConfig?: AlertConfig
}
//# sourceMappingURL=types.d.ts.map
