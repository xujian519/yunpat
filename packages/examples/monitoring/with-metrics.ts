/**
 * 示例：带 Prometheus 指标的 Express 服务器
 */

import express from 'express'
import { metricsMiddleware, metricsHandler } from '../packages/core/src/observability'

const app = express()
const PORT = 3000

// 添加 metrics 中间件
app.use(metricsMiddleware)

// 示例路由
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.get('/api/agent/:agentName', (req, res) => {
  const { agentName } = req.params
  res.json({
    agent: agentName,
    status: 'running',
    tasks: Math.floor(Math.random() * 100),
  })
})

// Metrics 端点
app.get('/metrics', metricsHandler)

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`)
  console.log(`📊 Metrics available at http://localhost:${PORT}/metrics`)
})
