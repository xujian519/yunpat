/**
 * HITL Manager单元测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { HITLManager, HITLCheckpoint } from '../../src/hitl/HITLManager.js'
import { LLMClient } from '../../src/llm/LLMClient.js'
import type { TaskStep, AgentResult } from '../../src/types/index.js'

describe('HITLManager', () => {
  let hitlManager: HITLManager
  let mockLLMClient: any

  beforeEach(() => {
    // 创建Mock LLM客户端
    mockLLMClient = {
      chat: vi.fn().mockResolvedValue({
        content: '请审阅生成的权利要求，确认保护范围是否准确。'
      })
    }

    hitlManager = new HITLManager(mockLLMClient, 300000)
  })

  describe('HITL请求生成', () => {
    it('应该为HITL步骤生成请求', async () => {
      const step: TaskStep = {
        stepId: 'step-1',
        agentId: 'patent-writer',
        layer: 'domain',
        parallel: false,
        dependsOn: [],
        timeout: 60000,
        input: {},
        hitl: true,
        hitlDescription: '请确认',
        retryOnFailure: true,
        maxRetries: 2
      }

      const result: AgentResult = {
        success: true,
        data: { claims: ['1. 一种智能控制器...'] },
        executionTime: 5000
      }

      const request = await hitlManager.generateHITLRequest(step, result)

      expect(request).toBeDefined()
      expect(request.stepId).toBe('step-1')
      expect(request.description).toBeDefined()
      expect(request.data).toEqual(result.data)
    })

    it('应该为非HITL步骤返回null', async () => {
      const step: TaskStep = {
        stepId: 'step-1',
        agentId: 'search-agent',
        layer: 'execution',
        parallel: false,
        dependsOn: [],
        timeout: 30000,
        input: {},
        hitl: false,
        retryOnFailure: true,
        maxRetries: 2
      }

      const result: AgentResult = {
        success: true,
        data: {},
        executionTime: 2000
      }

      const request = await hitlManager.generateHITLRequest(step, result)

      expect(request).toBeNull()
    })
  })

  describe('HITL检查点管理', () => {
    it('应该创建检查点', async () => {
      const step: TaskStep = {
        stepId: 'step-1',
        agentId: 'patent-writer',
        layer: 'domain',
        parallel: false,
        dependsOn: [],
        timeout: 60000,
        input: {},
        hitl: true,
        hitlDescription: '请确认',
        retryOnFailure: true,
        maxRetries: 2
      }

      const result: AgentResult = {
        success: true,
        data: { claims: ['1. 一种智能控制器...'] },
        executionTime: 5000
      }

      const checkpointId = await hitlManager.createCheckpoint('task-1', 'step-1', step, result)

      expect(checkpointId).toBeDefined()
      expect(hitlManager.getCheckpoint(checkpointId)).toBeDefined()
      expect(hitlManager.getCheckpoint(checkpointId)?.status).toBe('waiting')
    })

    it('应该处理确认响应', async () => {
      const checkpointId = await createTestCheckpoint()

      const response = {
        action: 'confirm'
      }

      const result = await hitlManager.processResponse(checkpointId, response)

      expect(result.status).toBe('confirmed')
      expect(result.data).toBeDefined()
    })

    it('应该处理拒绝响应', async () => {
      const checkpointId = await createTestCheckpoint()

      const response = {
        action: 'reject',
        feedback: '内容需要修改'
      }

      const result = await hitlManager.processResponse(checkpointId, response)

      expect(result.status).toBe('rejected')
      expect(result.feedback).toBe('内容需要修改')
    })

    it('应该处理修改响应', async () => {
      const checkpointId = await createTestCheckpoint()

      const response = {
        action: 'modify',
        modifications: { modified: true }
      }

      const result = await hitlManager.processResponse(checkpointId, response)

      expect(result.status).toBe('modified')
      expect(result.data).toEqual({ modified: true })
    })

    it('应该处理超时', async () => {
      const checkpointId = await createTestCheckpoint()

      const result = await hitlManager.handleTimeout(checkpointId)

      expect(result.status).toBe('timeout')
      expect(result.data).toBeDefined()
    })
  })

  describe('检查点管理', () => {
    it('应该获取所有活跃检查点', async () => {
      const checkpointId1 = await createTestCheckpoint()
      const checkpointId2 = await createTestCheckpoint()

      const activeCheckpoints = hitlManager.getActiveCheckpoints()

      expect(activeCheckpoints.length).toBe(2)
    })

    it('应该完成检查点', async () => {
      const checkpointId = await createTestCheckpoint()

      const response = { action: 'confirm' as const }
      await hitlManager.processResponse(checkpointId, response)
      await hitlManager.completeCheckpoint(checkpointId)

      // 确认的检查点应该被删除
      expect(hitlManager.getCheckpoint(checkpointId)).toBeNull()
    })

    it('应该清理过期检查点', async () => {
      // 创建一个旧检查点
      const checkpointId = await createTestCheckpoint()
      const checkpoint = hitlManager.getCheckpoint(checkpointId)
      if (checkpoint) {
        checkpoint.updatedAt = new Date(Date.now() - 4000000) // 66分钟前
      }

      await hitlManager.cleanup(3600000) // 1小时前

      // 旧检查点应该被清理
      expect(hitlManager.getCheckpoint(checkpointId)).toBeNull()
    })
  })

  describe('统计信息', () => {
    it('应该获取正确的统计信息', async () => {
      // 创建一些检查点
      await createTestCheckpoint()
      await createTestCheckpoint()

      const stats = hitlManager.getStats()

      expect(stats.totalCheckpoints).toBe(2)
      expect(stats.activeCheckpoints).toBe(2)
      expect(stats.completedCheckpoints).toBe(0)
      expect(stats.timeoutCheckpoints).toBe(0)
    })
  })

  // 辅助方法
  const createTestCheckpoint = async (): Promise<string> => {
    const step: TaskStep = {
      stepId: 'step-test',
      agentId: 'patent-writer',
      layer: 'domain',
      parallel: false,
      dependsOn: [],
      timeout: 60000,
      input: {},
      hitl: true,
      hitlDescription: '请确认',
      retryOnFailure: true,
      maxRetries: 2
    }

    const result: AgentResult = {
      success: true,
      data: { test: 'data' },
      executionTime: 1000
    }

    return await hitlManager.createCheckpoint('task-test', 'step-test', step, result)
  }
})
