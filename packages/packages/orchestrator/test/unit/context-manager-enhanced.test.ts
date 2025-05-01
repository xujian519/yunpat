/**
 * Context Manager增强测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ContextManager } from '../../src/context/ContextManager.js'
import type { TaskPlan } from '../../src/types/index.js'

describe('ContextManager增强', () => {
  let contextManager: ContextManager
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockLLMClient: any

  beforeEach(() => {
    // 创建Mock LLM客户端
    mockLLMClient = {
      chat: vi.fn().mockResolvedValue({
        content: '对话摘要：用户询问了专利撰写和检索',
      }),
    }

    contextManager = new ContextManager(mockLLMClient)
  })

  describe('智能历史压缩', () => {
    it('应该使用LLM生成摘要', async () => {
      // 添加超过maxHistoryLength的消息
      for (let i = 0; i < 150; i++) {
        await contextManager.addMessage('session-1', {
          id: `msg-${i}`,
          role: 'user',
          content: '测试消息',
          timestamp: new Date(),
        })
      }

      const history = await contextManager.getHistory('session-1')

      // 应该有摘要消息
      const summaryMsg = history.find(
        (m) => m.role === 'system' && m.content.includes('历史对话摘要')
      )
      expect(summaryMsg).toBeDefined()

      // 应该调用了LLM
      expect(mockLLMClient.chat).toHaveBeenCalled()
    })

    it('应该在没有LLM时使用简化摘要', async () => {
      const contextManagerNoLLM = new ContextManager()

      // 添加大量消息触发压缩
      for (let i = 0; i < 150; i++) {
        await contextManagerNoLLM.addMessage('session-2', {
          id: `msg-${i}`,
          role: 'user',
          content: '测试消息',
          timestamp: new Date(),
        })
      }

      const history = await contextManagerNoLLM.getHistory('session-2')

      // 应该有简化摘要
      const summaryMsg = history.find(
        (m) => m.role === 'system' && m.content.includes('历史对话摘要')
      )
      expect(summaryMsg).toBeDefined()
      expect(summaryMsg?.content).toContain('对话包含')
    })
  })

  describe('活跃任务管理增强', () => {
    it('应该获取所有活跃任务', async () => {
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
      await contextManager.createActiveTask(plan, 'session-2')

      const allTasks = await contextManager.getAllActiveTasks()
      expect(allTasks.length).toBe(2)
    })

    it('应该检查任务超时', async () => {
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

      // 修改lastUpdate为很久以前
      const task = await contextManager.getActiveTask('session-1')
      if (task) {
        task.lastUpdate = new Date(Date.now() - 700000) // 11分钟前
      }

      const isTimeout = await contextManager.checkTaskTimeout(taskId, 600000) // 10分钟超时
      expect(isTimeout).toBe(true)

      // 任务状态应该变为paused
      const updatedTask = await contextManager.getActiveTask('session-1')
      expect(updatedTask?.status).toBe('paused')
    })

    it('应该获取任务进度', async () => {
      const plan: TaskPlan = {
        planId: 'plan-1',
        intent: 'DRAFT_FULL',
        estimatedMinutes: 30,
        steps: [
          {
            stepId: 'step-1',
            agentId: 'agent-1',
            layer: 'execution',
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
            layer: 'execution',
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

      const taskId = await contextManager.createActiveTask(plan, 'session-1')

      // 完成第一个步骤
      await contextManager.completeStep(taskId, 'step-1', {
        success: true,
        data: {},
        executionTime: 1000,
      })

      const progress = contextManager.getTaskProgress(taskId)
      expect(progress).toBeDefined()
      expect(progress?.totalSteps).toBe(2)
      expect(progress?.completedSteps).toBe(1)
      expect(progress?.percentage).toBe(50)
    })
  })

  describe('用户画像学习增强', () => {
    it('应该学习用户偏好', async () => {
      await contextManager.updateUserPreferences('user-1', {
        tone: 'friendly',
        includeExamples: false,
        language: 'zh',
      })

      const profile = await contextManager.getUserProfile('user-1')
      expect(profile.preferences.tone).toBe('friendly')
      expect(profile.preferences.includeExamples).toBe(false)
      expect(profile.preferences.language).toBe('zh')
    })

    it('应该记录任务完成并更新统计', async () => {
      await contextManager.recordTaskCompletion('user-1', 'DRAFT_FULL', 60000)
      await contextManager.recordTaskCompletion('user-1', 'SEARCH', 30000)

      const profile = await contextManager.getUserProfile('user-1')
      expect(profile.statistics.totalTasks).toBe(2)
      expect(profile.statistics.taskTypes['DRAFT_FULL']).toBe(1)
      expect(profile.statistics.taskTypes['SEARCH']).toBe(1)
      expect(profile.statistics.averageTaskDuration).toBe(45000) // (60000 + 30000) / 2
    })

    it('应该根据历史调整服务', async () => {
      // 用户经常做检索任务
      await contextManager.recordTaskCompletion('user-1', 'SEARCH', 20000)
      await contextManager.recordTaskCompletion('user-1', 'SEARCH', 25000)
      await contextManager.recordTaskCompletion('user-1', 'SEARCH', 18000)

      const profile = await contextManager.getUserProfile('user-1')
      expect(profile.statistics.totalTasks).toBe(3)
      expect(profile.statistics.taskTypes['SEARCH']).toBe(3)
      expect(profile.statistics.averageTaskDuration).toBe(21000) // (20000 + 25000 + 18000) / 3

      // 可以根据历史建议优化服务
      const avgDuration = profile.statistics.averageTaskDuration
      expect(avgDuration).toBe(21000)
    })
  })

  describe('压缩后文件恢复', () => {
    it('应在压缩后注入操作过的文件信息', async () => {
      for (let i = 0; i < 50; i++) {
        await contextManager.addMessage('session-restore', {
          id: `msg-${i}`,
          role: i % 2 === 0 ? 'user' : 'assistant',
          content:
            i % 3 === 0
              ? `请读取文件 patent-application.pdf 进行分析`
              : i % 3 === 1
                ? `已打开 src/claims/main.ts 进行编辑`
                : '普通消息',
          timestamp: new Date(),
        })
      }

      // 触发压缩（超过 maxHistoryLength=100 不会触发，但超过 100 条会）
      for (let i = 50; i < 120; i++) {
        await contextManager.addMessage('session-restore', {
          id: `msg-${i}`,
          role: 'user',
          content: '继续操作',
          timestamp: new Date(),
        })
      }

      const history = await contextManager.getHistory('session-restore')
      const filesMsg = history.find(
        (m) => m.role === 'system' && m.content.includes('压缩前操作过的文件')
      )
      expect(filesMsg).toBeDefined()
    })
  })
})
