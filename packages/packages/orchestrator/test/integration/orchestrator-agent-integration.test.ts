/**
 * OrchestratorAgent集成测试
 * 测试完整的功能流程，包括HITL、ContextManager、IntentRecognition等
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { OrchestratorAgent } from '../../src/OrchestratorAgent.js'
import type { OrchestratorAgentConfig, OrchestratorInput } from '../../src/types/index.js'

describe('OrchestratorAgent集成测试', () => {
  let orchestrator: OrchestratorAgent
  let mockConfig: OrchestratorAgentConfig

  beforeEach(() => {
    // 创建Mock配置
    mockConfig = {
      agentId: 'orchestrator-agent',
      llmConfig: {
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        apiKey: 'test-key',
        maxTokens: 4096,
        temperature: 0.7,
      },
      intentConfig: {
        confidenceThreshold: 0.7,
        maxClarifyRounds: 3,
      },
      planningConfig: {
        maxSteps: 10,
        defaultTimeout: 60000,
        enableParallel: true,
      },
      hitlConfig: {
        autoConfirmThreshold: 0.9,
        timeout: 300000,
      },
    }

    orchestrator = new OrchestratorAgent(mockConfig)
  })

  describe('HITL集成测试', () => {
    it('应该对不存在的检查点返回失败', async () => {
      const result = await orchestrator.submitHITLResponse('non-existent-checkpoint', {
        action: 'confirm',
      })

      expect(result.success).toBe(false)
      expect(result.status).toBe('timeout')
    })

    it('应该处理HITL确认响应', async () => {
      // 创建一个测试检查点
      const checkpointId = 'test-checkpoint-1'

      // 提交确认响应
      const result = await orchestrator.submitHITLResponse(checkpointId, {
        action: 'confirm',
      })

      // 由于checkpoint不存在，应该返回错误
      expect(result.success).toBe(false)
    })

    it('应该处理HITL拒绝响应', async () => {
      const checkpointId = 'test-checkpoint-2'

      const result = await orchestrator.submitHITLResponse(checkpointId, {
        action: 'reject',
        feedback: '内容需要修改',
      })

      expect(result.success).toBe(false)
    })

    it('应该处理HITL修改响应', async () => {
      const checkpointId = 'test-checkpoint-3'

      const result = await orchestrator.submitHITLResponse(checkpointId, {
        action: 'modify',
        modifications: { modified: true },
      })

      expect(result.success).toBe(false)
    })

    it('应该获取活跃的HITL检查点', () => {
      const activeCheckpoints = orchestrator.getActiveHITLCheckpoints()
      expect(Array.isArray(activeCheckpoints)).toBe(true)
    })

    it('应该获取指定的HITL检查点', () => {
      const checkpoint = orchestrator.getHITLCheckpoint('non-existent')
      expect(checkpoint).toBeNull()
    })
  })

  describe('ContextManager集成测试', () => {
    it('应该保存对话历史', async () => {
      const input: OrchestratorInput = {
        sessionId: 'session-test-1',
        message: '帮我撰写一个专利',
        userId: 'user-1',
      }

      // 执行（会保存对话历史）
      await orchestrator.execute(input)

      // 获取对话历史
      const contextManager = orchestrator.getContextManager()
      const history = await contextManager.getHistory('session-test-1')

      // 应该有用户消息
      expect(history.length).toBeGreaterThan(0)
      expect(history[0].role).toBe('user')
      expect(history[0].content).toBe('帮我撰写一个专利')
    })

    it('应该自动压缩过长的对话历史', async () => {
      const contextManager = orchestrator.getContextManager()
      const sessionId = 'session-test-2'

      // 添加大量消息
      for (let i = 0; i < 150; i++) {
        await contextManager.addMessage(sessionId, {
          id: `msg-${i}`,
          role: 'user',
          content: `测试消息 ${i}`,
          timestamp: new Date(),
        })
      }

      // 获取历史
      const history = await contextManager.getHistory(sessionId)

      // 应该有摘要消息
      const summaryMsg = history.find(
        (m) => m.role === 'system' && m.content.includes('历史对话摘要')
      )
      expect(summaryMsg).toBeDefined()
    })
  })

  describe('完整执行流程测试', () => {
    it('应该处理简单意图并返回响应', async () => {
      const input: OrchestratorInput = {
        sessionId: 'session-test-3',
        message: '你好',
        userId: 'user-1',
      }

      const output = await orchestrator.execute(input)

      expect(output).toBeDefined()
      expect(output.response).toBeDefined()
      expect(output.metadata).toBeDefined()
      expect(output.metadata.intent).toBeDefined()
    })

    it('应该处理复杂意图并返回响应', async () => {
      const input: OrchestratorInput = {
        sessionId: 'session-test-4',
        message: '帮我撰写一个关于智能控制器的完整专利申请',
        userId: 'user-1',
      }

      const output = await orchestrator.execute(input)

      expect(output).toBeDefined()
      expect(output.response).toBeDefined()
      expect(output.metadata).toBeDefined()
    })

    it('应该记录任务执行时间', async () => {
      const input: OrchestratorInput = {
        sessionId: 'session-test-5',
        message: '检索相关技术',
        userId: 'user-1',
      }

      const output = await orchestrator.execute(input)

      expect(output.metadata.executionTime).toBeGreaterThan(0)
    })
  })

  describe('用户画像学习测试', () => {
    it('应该学习用户偏好', async () => {
      const contextManager = orchestrator.getContextManager()

      // 更新用户偏好
      await contextManager.updateUserPreferences('user-test-1', {
        tone: 'friendly',
        includeExamples: false,
        language: 'zh',
      })

      // 获取用户画像
      const profile = await contextManager.getUserProfile('user-test-1')

      expect(profile.preferences.tone).toBe('friendly')
      expect(profile.preferences.includeExamples).toBe(false)
      expect(profile.preferences.language).toBe('zh')
    })

    it('应该记录任务完成并更新统计', async () => {
      const contextManager = orchestrator.getContextManager()

      // 记录任务完成
      await contextManager.recordTaskCompletion('user-test-2', 'DRAFT_FULL', 60000)
      await contextManager.recordTaskCompletion('user-test-2', 'SEARCH', 30000)

      // 获取用户画像
      const profile = await contextManager.getUserProfile('user-test-2')

      expect(profile.statistics.totalTasks).toBe(2)
      expect(profile.statistics.taskTypes['DRAFT_FULL']).toBe(1)
      expect(profile.statistics.taskTypes['SEARCH']).toBe(1)
      expect(profile.statistics.averageTaskDuration).toBe(45000)
    })
  })

  describe('活跃任务管理测试', () => {
    it('应该获取所有活跃任务', async () => {
      const contextManager = orchestrator.getContextManager()

      // 创建一些活跃任务
      const plan1 = {
        planId: 'plan-1',
        intent: 'DRAFT_FULL' as const,
        estimatedMinutes: 30,
        steps: [],
        hitlCheckpoints: [],
        metadata: {
          createdAt: new Date(),
          parallelizable: false,
        },
      }

      await contextManager.createActiveTask(plan1, 'session-1')

      const allTasks = contextManager.getAllActiveTasks()
      expect(allTasks.length).toBeGreaterThan(0)
    })

    it('应该检查任务超时', async () => {
      const contextManager = orchestrator.getContextManager()

      const plan = {
        planId: 'plan-2',
        intent: 'SEARCH' as const,
        estimatedMinutes: 10,
        steps: [],
        hitlCheckpoints: [],
        metadata: {
          createdAt: new Date(),
          parallelizable: false,
        },
      }

      const taskId = await contextManager.createActiveTask(plan, 'session-2')

      // 检查超时（应该不会超时，因为是刚创建的）
      const isTimeout = await contextManager.checkTaskTimeout(taskId, 600000)
      expect(isTimeout).toBe(false)
    })

    it('应该获取任务进度', async () => {
      const contextManager = orchestrator.getContextManager()

      const plan = {
        planId: 'plan-3',
        intent: 'DRAFT_CLAIMS' as const,
        estimatedMinutes: 20,
        steps: [
          {
            stepId: 'step-1',
            agentId: 'agent-1',
            layer: 'execution' as const,
            parallel: false,
            dependsOn: [],
            timeout: 30000,
            input: {},
            hitl: false,
            retryOnFailure: true,
            maxRetries: 2,
          },
          {
            stepId: 'step-2',
            agentId: 'agent-2',
            layer: 'execution' as const,
            parallel: false,
            dependsOn: ['step-1'],
            timeout: 30000,
            input: {},
            hitl: false,
            retryOnFailure: true,
            maxRetries: 2,
          },
        ],
        hitlCheckpoints: [],
        metadata: {
          createdAt: new Date(),
          parallelizable: false,
        },
      }

      const taskId = await contextManager.createActiveTask(plan, 'session-3')

      // 完成第一个步骤
      await contextManager.completeStep(taskId, 'step-1', {
        success: true,
        data: {},
        executionTime: 1000,
      })

      // 获取进度
      const progress = contextManager.getTaskProgress(taskId)

      expect(progress).toBeDefined()
      expect(progress?.totalSteps).toBe(2)
      expect(progress?.completedSteps).toBe(1)
      expect(progress?.percentage).toBe(50)
    })
  })
})
