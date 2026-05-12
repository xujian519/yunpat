/**
 * HITLResponseParser - HITL 自然语言响应解析器
 *
 * 解析用户对 HITL 请求的自然语言回复，
 * 将其分类为 confirm / modify / reject / partial
 */

import type { HITLRequest, HITLResponse } from '../types/index.js'
import type { LLMClient, LLMMessage } from '../llm/LLMClient.js'

export class HITLResponseParser {
  private llmClient: LLMClient

  constructor(llmClient: LLMClient) {
    this.llmClient = llmClient
  }

  /**
   * 解析用户对 HITL 请求的自然语言回复
   */
  async parseResponse(userMessage: string, originalRequest: HITLRequest): Promise<HITLResponse> {
    // 先尝试关键词匹配（快速路径）
    const quickResult = this.quickClassify(userMessage)
    if (quickResult) {
      return quickResult
    }

    // 关键词无法确定时，使用 LLM 分类
    try {
      return await this.llmClassify(userMessage, originalRequest)
    } catch {
      // LLM 失败时，默认为 modify（最安全的兜底）
      return {
        action: 'modify',
        modifications: { userFeedback: userMessage },
        feedback: userMessage,
      }
    }
  }

  /**
   * 快速关键词分类
   * @returns 分类结果，或 null（无法通过关键词确定时）
   */
  private quickClassify(userMessage: string): HITLResponse | null {
    const msg = userMessage.trim().toLowerCase()

    // 确认类
    const confirmPatterns = [
      '确认',
      '好的',
      '可以',
      '没问题',
      '同意',
      '通过',
      '继续',
      'ok',
      'yes',
      '好的没问题',
      '没问题继续',
      '就这么办',
    ]
    if (confirmPatterns.some((p) => msg === p || (p.length >= 2 && msg.startsWith(p)))) {
      return { action: 'confirm' }
    }

    // 拒绝类
    const rejectPatterns = ['不行', '拒绝', '取消', '不要', '重新来', '重新生成', '重来']
    if (rejectPatterns.some((p) => msg.includes(p)) && msg.length <= 20) {
      return { action: 'reject', feedback: userMessage }
    }

    // 短文本无法确定时返回 null，交给 LLM
    if (msg.length <= 5) {
      // 非常短的文本可能是确认
      if (msg === '好' || msg === '行' || msg === '嗯') {
        return { action: 'confirm' }
      }
      return null
    }

    // 包含明确的修改指令
    const modifyPatterns = ['改为', '改成', '修改', '把', '换成', '去掉', '删除', '增加', '添加']
    if (modifyPatterns.some((p) => msg.includes(p))) {
      return {
        action: 'modify',
        modifications: { userFeedback: userMessage },
        feedback: userMessage,
      }
    }

    // 无法快速判断
    return null
  }

  /**
   * 使用 LLM 分类用户回复
   */
  private async llmClassify(
    userMessage: string,
    originalRequest: HITLRequest,
    sessionId?: string
  ): Promise<HITLResponse> {
    const systemPrompt = `你是任务调度器的指令解析器。
用户回复了一个待确认的内容，解析用户的意图。

可能的回复类型：
- CONFIRM：用户表示满意，继续执行（如"好的"、"确认"、"可以"、"继续"）
- MODIFY：用户提出具体修改（包含修改指令）
- REJECT：用户希望重新生成或取消（如"重新来"、"不满意"）
- PARTIAL：用户部分确认，部分需修改

只输出 JSON。`

    const userInput = `原始请求：${originalRequest.description}

用户回复：${userMessage}

请分类并提取修改要求。`

    const messages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userInput },
    ]

    const result = await this.llmClient.chatWithSchema<{
      hitlResponse: 'CONFIRM' | 'MODIFY' | 'REJECT' | 'PARTIAL'
      modificationInstructions?: string
      confidence: number
    }>(messages, {
      type: 'object',
      properties: {
        hitlResponse: {
          type: 'string',
          enum: ['CONFIRM', 'MODIFY', 'REJECT', 'PARTIAL'],
        },
        modificationInstructions: { type: 'string' },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
      },
      required: ['hitlResponse', 'confidence'],
    })

    const actionMap: Record<string, 'confirm' | 'modify' | 'reject'> = {
      CONFIRM: 'confirm',
      MODIFY: 'modify',
      REJECT: 'reject',
      PARTIAL: 'modify',
    }

    return {
      action: actionMap[result.hitlResponse] ?? 'modify',
      modifications: result.modificationInstructions
        ? { userFeedback: result.modificationInstructions }
        : undefined,
      feedback: result.modificationInstructions,
    }
  }
}
