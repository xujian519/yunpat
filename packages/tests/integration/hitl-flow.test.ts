/**
 * @file HITL 流程集成测试
 * @description 测试 TUI → Rust Gateway → Orchestrator Adapter → OrchestratorAgent 的完整流程
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { spawn, ChildProcess } from 'child_process'
import { WebSocket } from 'ws'
import fetch from 'node-fetch'

const GATEWAY_URL = 'http://localhost:8080'
const ADAPTER_URL = 'http://localhost:3001'

describe('HITL 流程集成测试', () => {
  let gatewayProcess: ChildProcess
  let adapterProcess: ChildProcess

  beforeAll(async () => {
    // 启动 Rust Gateway
    gatewayProcess = spawn('cargo', ['run', '--release'], {
      cwd: './packages/rust-gateway',
      env: {
        ...process.env,
        RUST_LOG: 'debug',
        ORCHESTRATOR_URL: ADAPTER_URL,
        BIND_ADDRESS: '0.0.0.0:8080',
      },
    })

    // 启动 Orchestrator Adapter
    adapterProcess = spawn('node', ['packages/orchestrator-adapter/dist/index.js'], {
      cwd: '.',
      env: {
        ...process.env,
        PORT: '3001',
        GATEWAY_URL: GATEWAY_URL,
      },
    })

    // 等待服务启动
    await new Promise((resolve) => setTimeout(resolve, 5000))
  }, 30000)

  afterAll(() => {
    gatewayProcess?.kill()
    adapterProcess?.kill()
  })

  it('应该能够创建会话', async () => {
    const response = await fetch(`${GATEWAY_URL}/api/v1/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: 'test-user' }),
    })

    expect(response.ok).toBe(true)

    const session = (await response.json()) as any
    expect(session).toHaveProperty('id')
    expect(session).toHaveProperty('status', 'idle')
  })

  it('应该能够发送消息并接收事件流', async () => {
    // 1. 创建会话
    const sessionResponse = await fetch(`${GATEWAY_URL}/api/v1/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: 'test-user' }),
    })

    const session = (await sessionResponse.json()) as any
    const sessionId = session.id

    // 2. 连接事件流
    const eventsPromise = new Promise<any[]>((resolve) => {
      const events: any[] = []

      const eventSource = new WebSocket(`ws://localhost:8080/api/v1/sessions/${sessionId}/events`)

      eventSource.on('message', (data) => {
        events.push(JSON.parse(data.toString()))
        if (events.length >= 2) {
          eventSource.close()
          resolve(events)
        }
      })

      eventSource.on('error', (err) => {
        console.error('WebSocket error:', err)
      })
    })

    // 3. 发送消息
    await fetch(`${GATEWAY_URL}/api/v1/sessions/${sessionId}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: '帮我分析一个专利' }),
    })

    // 4. 等待并验证事件
    const events = (await eventsPromise) as any[]

    expect(events.length).toBeGreaterThan(0)
    expect(events[0]).toHaveProperty('event_type')
    expect(events[0]).toHaveProperty('session_id', sessionId)
  })

  it('应该能够处理 HITL 请求和响应', async () => {
    // 1. 创建会话
    const sessionResponse = await fetch(`${GATEWAY_URL}/api/v1/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: 'test-user' }),
    })

    const session = (await sessionResponse.json()) as any
    const sessionId = session.id

    // 2. 模拟 HITL 请求（通过内部事件端点）
    await fetch(`${GATEWAY_URL}/internal/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        event_type: 'hitl',
        payload: {
          request_id: 'test-hitl-1',
          checkpoint_id: 'checkpoint-1',
          content: {
            type: 'confirmation',
            message: '是否继续执行此操作？',
          },
          options: [
            { id: 'opt-1', label: '继续', action: 'approve' },
            { id: 'opt-2', label: '取消', action: 'reject' },
          ],
          timeout: 60000,
        },
      }),
    })

    // 3. 获取待处理的 HITL 请求
    const hitlResponse = await fetch(`${GATEWAY_URL}/api/v1/sessions/${sessionId}/hitl`)
    const hitlData = (await hitlResponse.json()) as any

    expect(hitlData).toHaveProperty('request_id', 'test-hitl-1')
    expect(hitlData.options).toHaveLength(2)

    // 4. 提交 HITL 响应
    const submitResponse = await fetch(`${GATEWAY_URL}/api/v1/sessions/${sessionId}/hitl`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        request_id: 'test-hitl-1',
        action: 'approve',
      }),
    })

    expect(submitResponse.ok).toBe(true)
  })

  it('应该能够获取会话状态', async () => {
    // 1. 创建会话
    const sessionResponse = await fetch(`${GATEWAY_URL}/api/v1/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: 'test-user' }),
    })

    const session = (await sessionResponse.json()) as any
    const sessionId = session.id

    // 2. 获取会话状态
    const statusResponse = await fetch(`${GATEWAY_URL}/api/v1/sessions/${sessionId}`)
    const status = (await statusResponse.json()) as any

    expect(status).toHaveProperty('id', sessionId)
    expect(status).toHaveProperty('status')
    expect(status).toHaveProperty('created_at')
  })

  it('健康检查端点应该返回健康状态', async () => {
    const response = await fetch(`${GATEWAY_URL}/internal/health`)
    const health = (await response.json()) as any

    expect(health).toHaveProperty('status', 'healthy')
  })
})
