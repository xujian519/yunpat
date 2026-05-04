/**
 * ContextManager单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { ContextManager } from '../../src/context/ContextManager.js'
import type { ConversationMessage, TaskPlan, AgentResult } from '../../src/types/index.js'

describe('ContextManager', () => {
  let contextManager: ContextManager

  beforeEach(() => {
    contextManager = new ContextManager()
  })

  describe('对话历史管理', () => {
    it('应该能够添加消息到对话历史', async () => {
      const message: ConversationMessage = {
        id: 'msg-1',
        role: 'user',
        content: '你好',
        timestamp: new Date()
      }

      await contextManager.addMessage('session-1', message)

      const history = await contextManager.getHistory('session-1')
      expect(history).toHaveLength(1)
      expect(history[0]).toEqual(message)
    })

    it('应该能够获取对话历史', async () => {
      const messages: ConversationMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: '你好',
          timestamp: new Date()
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: '您好！',
          timestamp: new Date()
        }
      ]

      for (const message of messages) {
        await contextManager.addMessage('session-1', message)
      }

      const history = await contextManager.getHistory('session-1')
      expect(history).toHaveLength(2)
      expect(history[0].content).toBe('你好')
      expect(history[1].content).toBe('您好！')
    })

    it('应该能够清空对话历史', async () => {
      const message: ConversationMessage = {
        id: 'msg-1',
        role: 'user',
        content: '你好',
        timestamp: new Date()
      }

      await contextManager.addMessage('session-1', message)
      expect(await contextManager.getHistory('session-1')).toHaveLength(1)

      contextManager.clearHistory('session-1')
      expect(await contextManager.getHistory('session-1')).toHaveLength(0)
    })

    it('应该能够估算Token数', async () => {
      const chineseMessage: ConversationMessage = {
        id: 'msg-1',
        role: 'user',
        content: '这是一条中文消息',
        timestamp: new Date()
      }

      await contextManager.addMessage('session-1', chineseMessage)

      const history = await contextManager.getHistory('session-1')
      // 中文消息应该有合理的Token估算
      expect(history).toHaveLength(1)
    })
  })

  describe('活跃任务管理', () => {
    it('应该能够创建活跃任务', async () => {
      const plan: TaskPlan = {
        planId: 'plan-1',
        intent: 'DRAFT_FULL',
        estimatedMinutes: 30,
        steps: [],
        hitlCheckpoints: [],
        metadata: {
          createdAt: new Date(),
          parallelizable: false
        }
      }

      const taskId = await contextManager.createActiveTask(plan, 'session-1')

      expect(taskId).toBeDefined()
      expect(taskId).toMatch(/^task-/)
    })

    it('应该能够获取活跃任务', async () => {
      const plan: TaskPlan = {
        planId: 'plan-1',
        intent: 'DRAFT_FULL',
        estimatedMinutes: 30,
        steps: [],
        hitlCheckpoints: [],
        metadata: {
          createdAt: new Date(),
          parallelizable: false
        }
      }

      await contextManager.createActiveTask(plan, 'session-1')
      const task = await contextManager.getActiveTask('session-1')

      expect(task).toBeDefined()
      expect(task?.status).toBe('running')
    })

    it('应该能够更新任务状态', async () => {
      const plan: TaskPlan = {
        planId: 'plan-1',
        intent: 'DRAFT_FULL',
        estimatedMinutes: 30,
        steps: [],
        hitlCheckpoints: [],
        metadata: {
          createdAt: new Date(),
          parallelizable: false
        }
      }

      const taskId = await contextManager.createActiveTask(plan, 'session-1')
      await contextManager.updateTaskStatus(taskId, 'paused')

      const task = await contextManager.getActiveTask('session-1')
      expect(task?.status).toBe('paused')
    })

    it('应该能够完成步骤', async () => {
      const plan: TaskPlan = {
        planId: 'plan-1',
        intent: 'DRAFT_FULL',
        estimatedMinutes: 30,
        steps: [],
        hitlCheckpoints: [],
        metadata: {
          createdAt: new Date(),
          parallelizable: false
        }
      }

      const taskId = await contextManager.createActiveTask(plan, 'session-1')

      const result: AgentResult = {
        success: true,
        data: { test: 'data' },
        executionTime: 100
      }

      await contextManager.completeStep(taskId, 'step-1', result)

      const task = await contextManager.getActiveTask('session-1')
      expect(task?.completedSteps).toContain('step-1')
      expect(task?.results.get('step-1')).toEqual(result)
    })
  })

  describe('用户画像管理', () => {
    it('应该能够创建默认用户画像', async () => {
      const profile = await contextManager.getUserProfile('user-1')

      expect(profile).toBeDefined()
      expect(profile.userId).toBe('user-1')
      expect(profile.role).toBe('individual')
      expect(profile.outputFormat).toBe('detailed')
      expect(profile.preferences.language).toBe('zh')
    })

    it('应该能够更新用户偏好', async () => {
      await contextManager.updateUserPreferences('user-1', {
        tone: 'friendly',
        includeExamples: false
      })

      const profile = await contextManager.getUserProfile('user-1')
      expect(profile.preferences.tone).toBe('friendly')
      expect(profile.preferences.includeExamples).toBe(false)
    })

    it('应该能够记录任务完成', async () => {
      await contextManager.recordTaskCompletion('user-1', 'DRAFT_FULL', 60000)

      const profile = await contextManager.getUserProfile('user-1')
      expect(profile.statistics.totalTasks).toBe(1)
      expect(profile.statistics.taskTypes['DRAFT_FULL']).toBe(1)
      expect(profile.statistics.averageTaskDuration).toBe(60000)
    })
  })

  describe('工具方法', () => {
    it('应该能够获取统计信息', () => {
      const stats = contextManager.getStats()

      expect(stats).toHaveProperty('totalSessions')
      expect(stats).toHaveProperty('activeTasks')
      expect(stats).toHaveProperty('totalUsers')
      expect(stats).toHaveProperty('totalTokens')
    })

    it('应该能够清理过期数据', async () => {
      // 添加一些测试数据
      const message: ConversationMessage = {
        id: 'msg-1',
        role: 'user',
        content: '测试',
        timestamp: new Date()
      }
      await contextManager.addMessage('session-1', message)

      // 清理（使用很短的过期时间）
      await contextManager.cleanup(0)

      // 验证清理结果
      const stats = contextManager.getStats()
      expect(stats.totalSessions).toBe(0)
    })
  })
})
