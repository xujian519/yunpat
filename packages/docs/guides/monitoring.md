# YunPat 监控系统快速入门

## 🎯 概述

YunPat 现在已经配置了完整的 Prometheus + Grafana 监控系统。

## 🚀 快速启动

### 1. 启动所有服务

```bash
# 启动监控服务
docker-compose up -d prometheus grafana

# 启动 metrics 服务器
npx tsx examples/simple-metrics-server.ts
```

### 2. 访问服务

- **Grafana**: http://localhost:3001 (admin/admin)
- **Prometheus**: http://localhost:9090
- **Metrics 服务器**: http://localhost:3000/metrics

### 3. 导入 Grafana 仪表盘

1. 打开 http://localhost:3001
2. 登录: admin / admin
3. 进入 **Dashboards** > **Import**
4. 上传以下文件:
   - `docker/grafana/dashboards/api-performance.json`
   - `docker/grafana/dashboards/agent-stats.json`
   - `docker/grafana/dashboards/system-health.json`
5. 选择 **Prometheus** 数据源
6. 点击 **Import**

## 📊 可用指标

### HTTP 指标

- `http_request_duration_seconds` - HTTP 请求耗时
- `http_requests_total` - HTTP 请求总数

### Agent 指标

- `agent_tasks_total` - Agent 任务执行总数
- `agent_task_duration_seconds` - Agent 任务执行时间
- `agent_success_rate` - Agent 成功率

### LLM 指标

- `llm_calls_total` - LLM 调用总数
- `llm_tokens_total` - LLM Token 消耗
- `llm_response_time_seconds` - LLM 响应时间

### 数据库指标

- `db_query_duration_seconds` - 数据库查询耗时
- `db_connections_active` - 活跃数据库连接

### 缓存指标

- `cache_hits_total` - 缓存命中总数
- `cache_misses_total` - 缓存未命中总数

## 🔍 Prometheus 查询示例

### 查看所有 HTTP 请求

```
rate(http_requests_total[5m])
```

### 查看 API 响应时间

```
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
```

### 查看 Agent 成功率

```
agent_success_rate
```

### 查看 LLM Token 消耗

```
rate(llm_tokens_total[5m])
```

## 🎨 Grafana 仪表盘

### API 性能监控

- HTTP 请求速率
- 响应时间分布
- 错误率

### Agent 任务统计

- 任务执行总数
- 成功率趋势
- 执行时间分布

### 系统健康监控

- 服务状态
- 资源使用
- 连接池状态

## 🔧 集成到现有应用

```typescript
import { metricsMiddleware, metricsHandler } from '@yunpat/core/observability'

app.use(metricsMiddleware)
app.get('/metrics', metricsHandler)
```

## 📝 自定义指标

```typescript
import { recordAgentTask, recordLLMCall } from '@yunpat/core/observability'

// 记录 Agent 任务
recordAgentTask('PatentWriterAgent', 'write', 5.2, true)

// 记录 LLM 调用
recordLLMCall('deepseek', 'deepseek-chat', 2.5, { prompt: 100, completion: 200 }, true)
```

## 🛑 停止服务

```bash
# 停止监控服务
docker-compose down

# 停止 metrics 服务器（Ctrl+C 或）
kill $(cat /tmp/metrics-server.pid)
```

## 🔗 相关链接

- Prometheus 文档: https://prometheus.io/docs/
- Grafana 文档: https://grafana.com/docs/
- Prometheus 查询语言: https://promql.io/

## 💡 提示

- Metrics 端点: http://localhost:3000/metrics
- Prometheus targets: http://localhost:9090/targets
- Grafana dashboards: http://localhost:3001/dashboards

---

**生成时间**: 2026-05-05
**版本**: v1.0
