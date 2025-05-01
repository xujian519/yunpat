/**
 * @file 简单测试服务器
 * @description 用于测试 Rust 网关功能
 */

import express from 'express'

const app = express()
app.use(express.json())

app.get('/internal/health', (_req, res) => {
  res.json({ status: 'healthy', timestamp: Date.now() })
})

app.post('/internal/orchestrate', async (req, res) => {
  const { session_id, message } = req.body

  // 模拟处理
  await new Promise((resolve) => setTimeout(resolve, 500))

  // 发送进度事件到 Rust 网关
  await fetch('http://localhost:8081/internal/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id,
      event_type: 'progress',
      payload: { stage: 'processing', progress: 0.5 },
    }),
  }).catch(() => {})

  // 发送结果事件
  await fetch('http://localhost:8081/internal/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id,
      event_type: 'result',
      payload: { result: `已处理消息: ${message}` },
    }),
  }).catch(() => {})

  res.json({ success: true, result: { response: '测试响应' } })
})

app.listen(3001, () => {
  console.log('测试服务器运行在 http://localhost:3001')
})
