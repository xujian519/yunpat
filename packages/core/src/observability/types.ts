/**
 * 可观测性类型定义
 */

// 遥测事件类型
export enum TelemetryEventType {
  // 智能体事件
  AGENT_STARTED = 'agent.started',
  AGENT_COMPLETED = 'agent.completed',
  AGENT_FAILED = 'agent.failed',

  // 阶段事件
  STAGE_STARTED = 'stage.started',
  STAGE_COMPLETED = 'stage.completed',
  STAGE_FAILED = 'stage.failed',

  // 工具事件
  TOOL_CALLED = 'tool.called',
  TOOL_FAILED = 'tool.failed',

  // LLM 事件
  LLM_CALLED = 'llm.called',
  LLM_FAILED = 'llm.failed',
  LLM_TOKEN_USAGE = 'llm.token_usage',

  // 记忆事件
  MEMORY_READ = 'memory.read',
  MEMORY_WRITE = 'memory.write',
  MEMORY_CHECKPOINT = 'memory.checkpoint',
}

// 事件状态
export enum EventStatus {
  SUCCESS = 'success',
  FAILURE = 'failure',
  PENDING = 'pending',
}

// 遥测事件
export interface TelemetryEvent {
  id: string;
  type: TelemetryEventType;
  timestamp: number;
  agentName?: string;
  stage?: string;
  duration?: number;
  status: EventStatus;
  metadata?: Record<string, any>;
  error?: Error;
}

// 遥测报告
export interface TelemetryReport {
  period: {
    start: number;
    end: number;
  };
  summary: {
    totalEvents: number;
    successEvents: number;
    failedEvents: number;
    successRate: number;
    avgDuration: number;
  };
  byAgent: Map<string, AgentMetrics>;
  byStage: Map<string, StageMetrics>;
  topErrors: ErrorMetric[];
  alerts: Alert[];
}

// 智能体指标
export interface AgentMetrics {
  agentName: string;
  totalExecutions: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
}

// 阶段指标
export interface StageMetrics {
  stage: string;
  totalExecutions: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  avgDuration: number;
}

// 错误指标
export interface ErrorMetric {
  error: string;
  count: number;
  lastOccurrence: number;
  affectedAgents: string[];
}

// 告警
export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  timestamp: number;
  event: TelemetryEvent;
  threshold?: number;
  actualValue?: number;
}

// 告警类型
export enum AlertType {
  SLOW_EXECUTION = 'slow_execution',
  HIGH_FAILURE_RATE = 'high_failure_rate',
  ERROR_SPIKE = 'error_spike',
  MEMORY_LEAK = 'memory_leak',
}

// 告警严重级别
export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

// 告警配置
export interface AlertConfig {
  slowExecutionThreshold?: number; // 毫秒
  highFailureRateThreshold?: number; // 百分比
  errorSpikeThreshold?: number; // 错误数量
  enableAlerts?: boolean;
}

// 指标聚合器配置
export interface TelemetryConfig {
  maxEvents?: number;
  maxErrors?: number;
  retentionPeriod?: number; // 毫秒
  alertConfig?: AlertConfig;
}
