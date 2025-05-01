/**
 * 简化的 Metrics 服务器示例
 * 用于快速测试 Prometheus 指标收集
 */

import express from 'express'
import { register, metricsMiddleware, metricsHandler } from '../packages/core/src/observability'

const app = express()
const PORT = 3000

// 添加 metrics 中间件（必须在所有路由之前）
app.use(metricsMiddleware)

// 添加 JSON 解析中间件
app.use(express.json())

// 健康检查端点
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })
})

// API 网关模拟端点
app.get('/api/gateway/status', (req, res) => {
  res.json({
    service: 'api-gateway',
    status: 'running',
    connections: Math.floor(Math.random() * 100),
    requests_per_second: Math.floor(Math.random() * 1000),
  })
})

// Orchestrator 模拟端点
app.get('/api/orchestrator/status', (req, res) => {
  res.json({
    service: 'orchestrator',
    status: 'running',
    active_agents: Math.floor(Math.random() * 10),
    queued_tasks: Math.floor(Math.random() * 50),
  })
})

// Agent 任务模拟端点
app.post('/api/agent/:agentName/task', (req, res) => {
  const { agentName } = req.params
  res.json({
    agent: agentName,
    task_id: `task_${Date.now()}`,
    status: 'queued',
    estimated_duration: '5s',
  })
})

// Metrics 端点（Prometheus 会访问这个端点）
app.get('/metrics', metricsHandler)

// 启动服务器
app.listen(PORT, () => {
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║          YunPat Metrics 服务器已启动                       ║')
  console.log('╚════════════════════════════════════════════════════════════╝')
  console.log('')
  console.log(`🚀 服务器运行在: http://localhost:${PORT}`)
  console.log(`📊 Metrics 端点: http://localhost:${PORT}/metrics`)
  console.log(`🏥 健康检查: http://localhost:${PORT}/api/health`)
  console.log('')
  console.log('按 Ctrl+C 停止服务器')
  console.log('')
})

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n\n👋 正在关闭服务器...')
  process.exit(0)
})
