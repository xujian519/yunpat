# Observability 模块

## 概述

提供 Prometheus 指标收集功能，用于监控 YunPat 应用的性能和健康状态。

## 使用方法

### 1. 在 Express 应用中集成

```typescript
import express from 'express'
import { metricsMiddleware, metricsHandler } from '@yunpat/core/observability'

const app = express()

// 添加 metrics 中间件
app.use(metricsMiddleware)

// 添加 metrics 端点
app.get('/metrics', metricsHandler)
```

### 2. 手动记录指标

```typescript
import { recordAgentTask, recordLLMCall } from '@yunpat/core/observability'

// 记录 Agent 任务
recordAgentTask('PatentWriterAgent', 'write', 5.2, true)

// 记录 LLM 调用
recordLLMCall('deepseek', 'deepseek-chat', 2.5, { prompt: 100, completion: 200 }, true)
```

## 可用指标

### HTTP 指标

- `http_request_duration_seconds` - HTTP 请求耗时
- `http_requests_total` - HTTP 请求总数

### Agent 指标

- `agent_tasks_total` - Agent 任务执行总数
- `agent_task_duration_seconds` - Agent 任务执行时间
- `agent_success_rate` - Agent 成功率

### LLM 指标

- `llm_calls_total` - LLM 调用总数
- `llm_tokens_total` - LLM Token 消耗总数
- `llm_response_time_seconds` - LLM 响应时间

### 数据库指标

- `db_query_duration_seconds` - 数据库查询耗时
- `db_connections_active` - 活跃数据库连接数

### 缓存指标

- `cache_hits_total` - 缓存命中总数
- `cache_misses_total` - 缓存未命中总数

## Prometheus 配置

确保 `prometheus.yml` 包含以下配置：

```yaml
scrape_configs:
  - job_name: 'yunpat'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
```

## Grafana 仪表盘

使用以下仪表盘可视化指标：

- API 性能监控 (`api-performance.json`)
- Agent 任务统计 (`agent-stats.json`)
- 系统健康监控 (`system-health.json`)
