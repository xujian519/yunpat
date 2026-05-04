/**
 * HITLGenerator单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { HITLGenerator } from '../../src/hitl/HITLGenerator.js'
import type { TaskStep, AgentResult, HITLResponse } from '../../src/types/index.js'

describe('HITLGenerator', () => {
  let hitlGenerator: HITLGenerator

  beforeEach(() => {
    hitlGenerator = new HITLGenerator()
  })

  describe('HITL请求生成', () => {
    it('应该能够为HITL步骤生成请求', async () => {
      const step: TaskStep = {
        stepId: 'step-1',
        agentId: 'patent-writer',
        layer: 'domain',
        parallel: false,
        dependsOn: [],
        timeout: 60000,
        input: {},
        hitl: true,
        hitlDescription: '请确认权利要求内容',
        retryOnFailure: true,
        maxRetries: 2,
      }

      const result: AgentResult = {
        success: true,
        data: {
          claims: ['1. 一种智能控制器，其特征在于...'],
        },
        executionTime: 5000,
      }

      const request = await hitlGenerator.generateHITLRequest(step, result)

      expect(request).toBeDefined()
      expect(request.checkpointId).toBeDefined()
      expect(request.stepId).toBe('step-1')
      expect(request.description).toBe('请确认权利要求内容')
      expect(request.data).toEqual(result.data)
      expect(request.options).toBeDefined()
    })

    it('应该能够为非HITL步骤返回null', async () => {
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
        maxRetries: 2,
      }

      const result: AgentResult = {
        success: true,
        data: {},
        executionTime: 2000,
      }

      const request = await hitlGenerator.generateHITLRequest(step, result)

      expect(request).toBeNull()
    })
  })

  describe('HITL响应处理', () => {
    it('应该能够处理确认响应', async () => {
      const request = {
        checkpointId: 'hitl-1',
        stepId: 'step-1',
        description: '请确认',
        data: { test: 'data' },
        options: {
          confirmButtonText: '确认',
          rejectButtonText: '修改',
          modificationAllowed: true,
          timeout: 300000,
        },
      }

      const response: HITLResponse = {
        action: 'confirm',
      }

      const result = await hitlGenerator.processHITLResponse(request, response)

      expect(result.status).toBe('confirmed')
      expect(result.data).toEqual(request.data)
    })

    it('应该能够处理拒绝响应', async () => {
      const request = {
        checkpointId: 'hitl-1',
        stepId: 'step-1',
        description: '请确认',
        data: { test: 'data' },
        options: {
          confirmButtonText: '确认',
          rejectButtonText: '修改',
          modificationAllowed: true,
          timeout: 300000,
        },
      }

      const response: HITLResponse = {
        action: 'reject',
        feedback: '内容需要修改',
      }

      const result = await hitlGenerator.processHITLResponse(request, response)

      expect(result.status).toBe('rejected')
      expect(result.feedback).toBe('内容需要修改')
    })

    it('应该能够处理修改响应', async () => {
      const request = {
        checkpointId: 'hitl-1',
        stepId: 'step-1',
        description: '请确认',
        data: { test: 'data' },
        options: {
          confirmButtonText: '确认',
          rejectButtonText: '修改',
          modificationAllowed: true,
          timeout: 300000,
        },
      }

      const response: HITLResponse = {
        action: 'modify',
        modifications: { test: 'modified data' },
      }

      const result = await hitlGenerator.processHITLResponse(request, response)

      expect(result.status).toBe('modified')
      expect(result.data).toEqual({ test: 'modified data' })
    })
  })

  describe('超时处理', () => {
    it('应该能够处理超时', async () => {
      const request = {
        checkpointId: 'hitl-1',
        stepId: 'step-1',
        description: '请确认',
        data: { test: 'data' },
        options: {
          confirmButtonText: '确认',
          rejectButtonText: '修改',
          modificationAllowed: true,
          timeout: 300000,
        },
      }

      const result = await hitlGenerator.handleTimeout(request)

      expect(result.status).toBe('timeout')
      expect(result.data).toEqual(request.data)
    })
  })
})
