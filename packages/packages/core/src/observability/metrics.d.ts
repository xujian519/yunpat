/**
 * Prometheus 指标收集
 *
 * 提供 HTTP 请求、Agent 任务、数据库操作等指标
 */
import { Registry, Counter, Histogram, Gauge } from 'prom-client'
export declare const register: Registry<'text/plain; version=0.0.4; charset=utf-8'>
export declare const httpRequestDuration: Histogram<'method' | 'route' | 'status_code'>
export declare const httpRequestsTotal: Counter<'method' | 'route' | 'status_code'>
export declare const agentTasksTotal: Counter<'status' | 'agent_name'>
export declare const agentTaskDuration: Histogram<'agent_name' | 'task_type'>
export declare const agentSuccessRate: Gauge<'agent_name'>
export declare const llmCallsTotal: Counter<'provider' | 'status' | 'model'>
export declare const llmTokensTotal: Counter<'type' | 'provider' | 'model'>
export declare const llmResponseTime: Histogram<'provider' | 'model'>
export declare const dbQueryDuration: Histogram<'table' | 'operation'>
export declare const dbConnectionsActive: Gauge<string>
export declare const cacheHitsTotal: Counter<'cache_type'>
export declare const cacheMissesTotal: Counter<'cache_type'>
export declare function recordHttpRequest(
  method: string,
  route: string,
  statusCode: number,
  duration: number
): void
export declare function recordAgentTask(
  agentName: string,
  taskType: string,
  duration: number,
  success: boolean
): void
export declare function recordLLMCall(
  provider: string,
  model: string,
  duration: number,
  tokens: {
    prompt: number
    completion: number
  },
  success: boolean
): void
export declare function getMetrics(): Promise<string>
//# sourceMappingURL=metrics.d.ts.map
