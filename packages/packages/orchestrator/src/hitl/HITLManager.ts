/**
 * HITLManager - 人机交互管理器
 *
 * 职责：
 * 1. 生成HITL请求
 * 2. 处理HITL响应
 * 3. 超时处理
 * 4. HITL状态管理
 */

import { HITLRequest, HITLResponse, HITLResult, TaskStep, AgentResult } from '../types/index.js'
import { LLMClient, LLMMessage } from '../llm/LLMClient.js'

export interface HITLCheckpoint {
  checkpointId: string
  taskId: string
  stepId: string
  status: 'pending' | 'waiting' | 'confirmed' | 'rejected' | 'modified' | 'timeout' | 'completed'
  request: HITLRequest
  response?: HITLResponse
  result?: HITLResult
  createdAt: Date
  updatedAt: Date
}

export class HITLManager {
  private llmClient: LLMClient
  private activeCheckpoints: Map<string, HITLCheckpoint>
  private defaultTimeout: number

  constructor(llmClient: LLMClient, defaultTimeout: number = 300000) {
    this.llmClient = llmClient
    this.activeCheckpoints = new Map()
    this.defaultTimeout = defaultTimeout
  }

  /**
   * 生成HITL请求
   */
  async generateHITLRequest(step: TaskStep, result: AgentResult): Promise<HITLRequest | null> {
    if (!step.hitl) return null

    // 如果有自定义描述，使用自定义描述
    const description = step.hitlDescription || (await this.generateHITLDescription(step, result))

    // 生成唯一的checkpointId：时间戳 + 随机数
    const checkpointId = `hitl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    return {
      checkpointId,
      stepId: step.stepId,
      description,
      data: result.data,
      options: {
        confirmButtonText: '确认',
        rejectButtonText: '修改',
        modificationAllowed: true,
        timeout: this.defaultTimeout,
      },
    }
  }

  /**
   * 生成HITL描述
   */
  private async generateHITLDescription(step: TaskStep, result: AgentResult): Promise<string> {
    // 使用LLM生成友好的描述
    try {
      const messages: LLMMessage[] = [
        {
          role: 'system',
          content:
            '你是一个人机交互专家。请根据任务步骤和执行结果，生成一个清晰、友好的用户确认提示。',
        },
        {
          role: 'user',
          content: `任务步骤：${step.stepId}\n执行结果：${JSON.stringify(result.data)}\n\n请生成一个简短的确认提示，让用户理解这一步做了什么，并请求确认。`,
        },
      ]

      const response = await this.llmClient.chat(messages)
      return response.content
    } catch (error) {
      // LLM调用失败，使用默认描述
      return `请确认步骤"${step.stepId}"的执行结果。`
    }
  }

  /**
   * 创建HITL检查点
   */
  async createCheckpoint(
    taskId: string,
    stepId: string,
    step: TaskStep,
    result: AgentResult
  ): Promise<string> {
    const request = await this.generateHITLRequest(step, result)

    if (!request) {
      throw new Error('Failed to generate HITL request')
    }

    const checkpoint: HITLCheckpoint = {
      checkpointId: request.checkpointId,
      taskId,
      stepId,
      status: 'waiting',
      request,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    this.activeCheckpoints.set(checkpoint.checkpointId, checkpoint)
    return checkpoint.checkpointId
  }

  /**
   * 处理HITL响应
   */
  async processResponse(checkpointId: string, response: HITLResponse): Promise<HITLResult> {
    const checkpoint = this.activeCheckpoints.get(checkpointId)
    if (!checkpoint) {
      throw new Error(`Checkpoint not found: ${checkpointId}`)
    }

    checkpoint.response = response
    checkpoint.updatedAt = new Date()

    let result: HITLResult

    switch (response.action) {
      case 'confirm':
        result = {
          status: 'confirmed',
          data: checkpoint.request.data,
        }
        checkpoint.status = 'confirmed'
        break

      case 'reject':
        result = {
          status: 'rejected',
          feedback: response.feedback,
        }
        checkpoint.status = 'rejected'
        break

      case 'modify':
        result = {
          status: 'modified',
          data: response.modifications,
        }
        checkpoint.status = 'modified'
        break

      default:
        throw new Error(`Invalid HITL action: ${response.action}`)
    }

    checkpoint.result = result
    return result
  }

  /**
   * 处理超时
   */
  async handleTimeout(checkpointId: string): Promise<HITLResult> {
    const checkpoint = this.activeCheckpoints.get(checkpointId)
    if (!checkpoint) {
      throw new Error(`Checkpoint not found: ${checkpointId}`)
    }

    checkpoint.status = 'timeout'
    checkpoint.updatedAt = new Date()

    return {
      status: 'timeout',
      data: checkpoint.request.data,
    }
  }

  /**
   * 检查超时检查点
   */
  async checkTimeouts(): Promise<string[]> {
    const now = Date.now()
    const timeoutCheckpoints: string[] = []

    for (const [checkpointId, checkpoint] of this.activeCheckpoints.entries()) {
      if (checkpoint.status !== 'waiting') continue

      const elapsed = now - checkpoint.createdAt.getTime()
      if (elapsed > this.defaultTimeout) {
        await this.handleTimeout(checkpointId)
        timeoutCheckpoints.push(checkpointId)
      }
    }

    return timeoutCheckpoints
  }

  /**
   * 获取检查点状态
   */
  getCheckpoint(checkpointId: string): HITLCheckpoint | null {
    return this.activeCheckpoints.get(checkpointId) || null
  }

  /**
   * 获取所有活跃检查点
   */
  getActiveCheckpoints(): HITLCheckpoint[] {
    return Array.from(this.activeCheckpoints.values()).filter(
      (cp) => cp.status === 'waiting' || cp.status === 'pending'
    )
  }

  /**
   * 完成检查点
   */
  async completeCheckpoint(checkpointId: string): Promise<void> {
    const checkpoint = this.activeCheckpoints.get(checkpointId)
    if (checkpoint) {
      // 根据结果状态决定是否删除
      if (checkpoint.status === 'confirmed' || checkpoint.status === 'modified') {
        this.activeCheckpoints.delete(checkpointId)
      } else {
        // 保留失败的检查点用于审计
        checkpoint.status = 'completed'
      }
    }
  }

  /**
   * 删除检查点
   */
  async deleteCheckpoint(checkpointId: string): Promise<void> {
    this.activeCheckpoints.delete(checkpointId)
  }

  /**
   * 清理过期检查点
   */
  async cleanup(maxAge: number = 3600000): Promise<void> {
    const now = Date.now()

    for (const [checkpointId, checkpoint] of this.activeCheckpoints.entries()) {
      const age = now - checkpoint.updatedAt.getTime()
      if (age > maxAge) {
        this.activeCheckpoints.delete(checkpointId)
      }
    }
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    totalCheckpoints: number
    activeCheckpoints: number
    completedCheckpoints: number
    timeoutCheckpoints: number
  } {
    let completedCheckpoints = 0
    let timeoutCheckpoints = 0

    for (const checkpoint of this.activeCheckpoints.values()) {
      if (checkpoint.status === 'completed') completedCheckpoints++
      if (checkpoint.status === 'timeout') timeoutCheckpoints++
    }

    return {
      totalCheckpoints: this.activeCheckpoints.size,
      activeCheckpoints: this.getActiveCheckpoints().length,
      completedCheckpoints,
      timeoutCheckpoints,
    }
  }
}
