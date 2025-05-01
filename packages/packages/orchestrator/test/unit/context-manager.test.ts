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
        timestamp: new Date(),
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
          timestamp: new Date(),
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: '您好！',
          timestamp: new Date(),
        },
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
        timestamp: new Date(),
      }

      await contextManager.addMessage('session-1', message)
      expect(await contextManager.getHistory('session-1')).toHaveLength(1)

      contextManager.clearHistory('session-1')
      expect(await contextManager.getHistory('session-1')).toHaveLength(0)
    })

    it('应该能够使用模型感知的 TokenCounter 估算', async () => {
      const cmGpt = new ContextManager(undefined, 'gpt-4')
      const cmDeepSeek = new ContextManager(undefined, 'deepseek-chat')

      const text = '这是一段中文测试文本，用于验证token计数'
      await cmGpt.addMessage('s1', { id: 'm1', role: 'user', content: text, timestamp: new Date() })
      await cmDeepSeek.addMessage('s2', {
        id: 'm1',
        role: 'user',
        content: text,
        timestamp: new Date(),
      })

      const gptStats = cmGpt.getStats()
      const deepseekStats = cmDeepSeek.getStats()

      // DeepSeek 对中文更高效（每个token覆盖更多中文字符），所以估算 token 数应该更少
      expect(deepseekStats.totalTokens).toBeLessThan(gptStats.totalTokens)
      expect(gptStats.totalTokens).toBeGreaterThan(0)
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
          parallelizable: false,
        },
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
          parallelizable: false,
        },
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
          parallelizable: false,
        },
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
          parallelizable: false,
        },
      }

      const taskId = await contextManager.createActiveTask(plan, 'session-1')

      const result: AgentResult = {
        success: true,
        data: { test: 'data' },
        executionTime: 100,
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
        includeExamples: false,
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
        timestamp: new Date(),
      }
      await contextManager.addMessage('session-1', message)

      // 清理（使用很短的过期时间）
      await contextManager.cleanup(0)

      // 验证清理结果
      const stats = contextManager.getStats()
      expect(stats.totalSessions).toBe(0)
    })
  })

  describe('MicroCompact', () => {
    it('不应在工具结果数量低于阈值时压缩', async () => {
      for (let i = 0; i < 10; i++) {
        await contextManager.addMessage('session-1', {
          id: `tool-${i}`,
          role: 'assistant',
          content: `工具结果内容 ${i}，包含大量文本信息 `.repeat(20),
          timestamp: new Date(),
          metadata: { isToolResult: true },
        })
      }

      const history = await contextManager.getHistory('session-1')
      const compacted = history.filter((m) => m.content.includes('工具结果已清理'))
      expect(compacted).toHaveLength(0)
    })

    it('应在工具结果超过阈值时清理最早的结果', async () => {
      for (let i = 0; i < 20; i++) {
        await contextManager.addMessage('session-1', {
          id: `tool-${i}`,
          role: 'assistant',
          content: `工具结果内容 ${i}，`.repeat(50),
          timestamp: new Date(),
          metadata: { isToolResult: true },
        })
      }

      const history = await contextManager.getHistory('session-1')
      const compacted = history.filter((m) => m.content.includes('工具结果已清理'))
      const intact = history.filter((m) => !m.content.includes('工具结果已清理'))

      expect(compacted.length).toBeGreaterThan(0)
      expect(intact.length).toBeGreaterThanOrEqual(5)
    })

    it('不应清理非工具结果消息', async () => {
      await contextManager.addMessage('session-1', {
        id: 'user-1',
        role: 'user',
        content: '这是一条重要的用户消息',
        timestamp: new Date(),
      })

      for (let i = 0; i < 20; i++) {
        await contextManager.addMessage('session-1', {
          id: `tool-${i}`,
          role: 'assistant',
          content: `工具结果 ${i}`,
          timestamp: new Date(),
          metadata: { isToolResult: true },
        })
      }

      const history = await contextManager.getHistory('session-1')
      const userMsg = history.find((m) => m.id === 'user-1')
      expect(userMsg?.content).toBe('这是一条重要的用户消息')
    })

    it('清理后应降低总 token 数', async () => {
      for (let i = 0; i < 20; i++) {
        await contextManager.addMessage('session-1', {
          id: `tool-${i}`,
          role: 'assistant',
          content: `工具结果内容 ${i}，这是一个很长的工具结果。`.repeat(30),
          timestamp: new Date(),
          metadata: { isToolResult: true },
        })
      }

      const stats = contextManager.getStats()
      expect(stats.totalTokens).toBeLessThan(20 * 30 * 20)
    })
  })
})
