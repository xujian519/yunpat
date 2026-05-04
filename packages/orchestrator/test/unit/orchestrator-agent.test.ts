/**
 * OrchestratorAgent单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { OrchestratorAgent } from '../../src/OrchestratorAgent.js'
import type { OrchestratorAgentConfig, OrchestratorInput } from '../../src/types/index.js'

describe('OrchestratorAgent', () => {
  let orchestratorAgent: OrchestratorAgent
  let config: OrchestratorAgentConfig

  beforeEach(() => {
    config = {
      name: 'test-orchestrator',
      llmConfig: {
        provider: 'local',
        model: 'test-model',
        temperature: 0.7,
        maxTokens: 4096
      },
      intentConfig: {
        confidenceThreshold: 0.7,
        maxClarifyRounds: 3
      },
      planningConfig: {
        maxSteps: 20,
        defaultTimeout: 30000,
        enableParallel: true
      },
      hitlConfig: {
        autoConfirmThreshold: 0.9,
        timeout: 300000
      }
    } as any

    orchestratorAgent = new OrchestratorAgent(config)
  })

  describe('基础功能', () => {
    it('应该能够创建OrchestratorAgent实例', () => {
      expect(orchestratorAgent).toBeDefined()
      expect(orchestratorAgent.getConfig()).toEqual(config)
    })

    it('应该能够获取ContextManager', () => {
      const contextManager = orchestratorAgent.getContextManager()
      expect(contextManager).toBeDefined()
    })

    it('应该能够获取配置', () => {
      const retrievedConfig = orchestratorAgent.getConfig()
      expect(retrievedConfig).toEqual(config)
    })
  })

  describe('执行流程', () => {
    it('应该能够执行简单的用户输入', async () => {
      const input: OrchestratorInput = {
        sessionId: 'session-1',
        userId: 'user-1',
        message: '你好'
      }

      const output = await orchestratorAgent.execute(input)

      expect(output).toBeDefined()
      expect(output.response).toBeDefined()
      expect(output.metadata).toBeDefined()
      expect(output.metadata.intent).toBeDefined()
      expect(output.metadata.executionTime).toBeGreaterThanOrEqual(0)
    })

    it('应该能够保存对话历史', async () => {
      const input: OrchestratorInput = {
        sessionId: 'session-1',
        userId: 'user-1',
        message: '你好'
      }

      await orchestratorAgent.execute(input)

      const contextManager = orchestratorAgent.getContextManager()
      const history = await contextManager.getHistory('session-1')

      expect(history.length).toBeGreaterThan(0)
    })

    it('应该能够处理错误', async () => {
      // 模拟一个会导致错误的输入
      const input: OrchestratorInput = {
        sessionId: 'session-error',
        userId: 'user-error',
        message: ''
      }

      const output = await orchestratorAgent.execute(input)

      expect(output).toBeDefined()
      expect(output.response).toBeDefined()
    })
  })

  describe('Call 1: 意图识别', () => {
    it('应该能够调用意图识别', async () => {
      const input: OrchestratorInput = {
        sessionId: 'session-1',
        userId: 'user-1',
        message: '帮我撰写专利申请'
      }

      const output = await orchestratorAgent.execute(input)

      expect(output.metadata.intent).toBeDefined()
    })
  })

  describe('Call 2: 任务规划', () => {
    it('应该能够为复杂意图生成任务计划', async () => {
      const input: OrchestratorInput = {
        sessionId: 'session-1',
        userId: 'user-1',
        message: '帮我撰写一个完整的专利申请，包括检索、说明书和权利要求'
      }

      const output = await orchestratorAgent.execute(input)

      expect(output.metadata).toBeDefined()
    })
  })

  describe('闲聊处理', () => {
    it('应该能够生成闲聊回复', async () => {
      const input: OrchestratorInput = {
        sessionId: 'session-1',
        userId: 'user-1',
        message: '你能做什么？'
      }

      const output = await orchestratorAgent.execute(input)

      // 当前实现返回默认消息，但应该有响应
      expect(output.response).toBeDefined()
      expect(output.requiresHITL).toBe(false)
    })
  })

  describe('边界情况', () => {
    it('应该能够处理空消息', async () => {
      const input: OrchestratorInput = {
        sessionId: 'session-1',
        userId: 'user-1',
        message: ''
      }

      const output = await orchestratorAgent.execute(input)

      expect(output).toBeDefined()
    })

    it('应该能够处理超长消息', async () => {
      const longMessage = '测试'.repeat(10000)

      const input: OrchestratorInput = {
        sessionId: 'session-1',
        userId: 'user-1',
        message: longMessage
      }

      const output = await orchestratorAgent.execute(input)

      expect(output).toBeDefined()
    })

    it('应该能够处理带附件的消息', async () => {
      const input: OrchestratorInput = {
        sessionId: 'session-1',
        userId: 'user-1',
        message: '请分析这个附件',
        attachments: [
          {
            id: 'att-1',
            filename: 'test.pdf',
            mimeType: 'application/pdf',
            size: 1024,
            data: 'base64data'
          }
        ]
      }

      const output = await orchestratorAgent.execute(input)

      expect(output).toBeDefined()
    })
  })

  describe('性能', () => {
    it('应该在合理时间内完成执行', async () => {
      const input: OrchestratorInput = {
        sessionId: 'session-1',
        userId: 'user-1',
        message: '你好'
      }

      const startTime = Date.now()
      const output = await orchestratorAgent.execute(input)
      const executionTime = Date.now() - startTime

      expect(output).toBeDefined()
      expect(executionTime).toBeLessThan(5000) // 5秒内完成
    })
  })
})
