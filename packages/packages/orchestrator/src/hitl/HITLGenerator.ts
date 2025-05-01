/**
 * HITLGenerator - 人机交互生成器（Call 3）
 *
 * 职责：
 * 1. 生成HITL请求
 * 2. 处理HITL响应
 * 3. 超时处理
 */

import { HITLRequest, HITLResponse, HITLResult, TaskStep, AgentResult } from '../types/index.js'

export class HITLGenerator {
  /**
   * 生成HITL请求
   */
  async generateHITLRequest(step: TaskStep, result: AgentResult): Promise<HITLRequest | null> {
    if (!step.hitl) return null

    return {
      checkpointId: `hitl-${Date.now()}`,
      stepId: step.stepId,
      description: step.hitlDescription || '请确认以下结果',
      data: result.data,
      options: {
        confirmButtonText: '确认',
        rejectButtonText: '修改',
        modificationAllowed: true,
        timeout: 300000, // 5分钟
      },
    }
  }

  /**
   * 处理HITL响应
   */
  async processHITLResponse(request: HITLRequest, response: HITLResponse): Promise<HITLResult> {
    switch (response.action) {
      case 'confirm':
        return {
          status: 'confirmed',
          data: request.data,
        }
      case 'reject':
        return {
          status: 'rejected',
          feedback: response.feedback,
        }
      case 'modify':
        return {
          status: 'modified',
          data: response.modifications,
        }
    }
  }

  /**
   * 处理超时
   */
  async handleTimeout(request: HITLRequest): Promise<HITLResult> {
    return {
      status: 'timeout',
      data: request.data,
    }
  }
}
