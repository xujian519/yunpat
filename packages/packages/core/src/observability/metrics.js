/**
 * Prometheus 指标收集
 *
 * 提供 HTTP 请求、Agent 任务、数据库操作等指标
 */
import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client'
// 创建注册表
export const register = new Registry()
// 收集默认指标（CPU、内存等）
collectDefaultMetrics({ register })
// HTTP 请求指标
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP 请求耗时',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5, 10],
  registers: [register],
})
// HTTP 请求总数
export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'HTTP 请求总数',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
})
// Agent 任务指标
export const agentTasksTotal = new Counter({
  name: 'agent_tasks_total',
  help: 'Agent 任务执行总数',
  labelNames: ['agent_name', 'status'],
  registers: [register],
})
export const agentTaskDuration = new Histogram({
  name: 'agent_task_duration_seconds',
  help: 'Agent 任务执行时间',
  labelNames: ['agent_name', 'task_type'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
  registers: [register],
})
export const agentSuccessRate = new Gauge({
  name: 'agent_success_rate',
  help: 'Agent 成功率',
  labelNames: ['agent_name'],
  registers: [register],
})
// LLM 调用指标
export const llmCallsTotal = new Counter({
  name: 'llm_calls_total',
  help: 'LLM 调用总数',
  labelNames: ['provider', 'model', 'status'],
  registers: [register],
})
export const llmTokensTotal = new Counter({
  name: 'llm_tokens_total',
  help: 'LLM Token 消耗总数',
  labelNames: ['provider', 'model', 'type'],
  registers: [register],
})
export const llmResponseTime = new Histogram({
  name: 'llm_response_time_seconds',
  help: 'LLM 响应时间',
  labelNames: ['provider', 'model'],
  buckets: [0.5, 1, 2, 5, 10, 20, 30],
  registers: [register],
})
// 数据库指标
export const dbQueryDuration = new Histogram({
  name: 'db_query_duration_seconds',
  help: '数据库查询耗时',
  labelNames: ['operation', 'table'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [register],
})
export const dbConnectionsActive = new Gauge({
  name: 'db_connections_active',
  help: '活跃数据库连接数',
  registers: [register],
})
// 缓存指标
export const cacheHitsTotal = new Counter({
  name: 'cache_hits_total',
  help: '缓存命中总数',
  labelNames: ['cache_type'],
  registers: [register],
})
export const cacheMissesTotal = new Counter({
  name: 'cache_misses_total',
  help: '缓存未命中总数',
  labelNames: ['cache_type'],
  registers: [register],
})
// 工具函数：记录 HTTP 请求
export function recordHttpRequest(method, route, statusCode, duration) {
  httpRequestsTotal.inc({ method, route, status_code: statusCode.toString() })
  httpRequestDuration.observe({ method, route, status_code: statusCode.toString() }, duration)
}
// 工具函数：记录 Agent 任务
export function recordAgentTask(agentName, taskType, duration, success) {
  const status = success ? 'success' : 'failure'
  agentTasksTotal.inc({ agent_name: agentName, status })
  agentTaskDuration.observe({ agent_name: agentName, task_type: taskType }, duration)
}
// 工具函数：记录 LLM 调用
export function recordLLMCall(provider, model, duration, tokens, success) {
  llmCallsTotal.inc({ provider, model, status: success ? 'success' : 'failure' })
  llmTokensTotal.inc({ provider, model, type: 'prompt' }, tokens.prompt)
  llmTokensTotal.inc({ provider, model, type: 'completion' }, tokens.completion)
  llmResponseTime.observe({ provider, model }, duration)
}
// 获取 metrics 端点内容
export async function getMetrics() {
  return await register.metrics()
}
//# sourceMappingURL=metrics.js.map
