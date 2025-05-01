/**
 * ResultAggregator - 结果聚合器（Call 4）
 *
 * 职责：
 * 1. 聚合多 Agent 结果
 * 2. 使用 LLM 生成结构化的用户回复
 * 3. 整理附件列表
 * 4. 生成建议操作
 */

import { AggregatedResult, AgentResult, Attachment } from '../types/index.js'
import type { LLMClient, LLMMessage } from '../llm/LLMClient.js'
import type { ContextBuilder } from '../context/ContextBuilder.js'

export class ResultAggregator {
  private llmClient?: LLMClient
  private contextBuilder?: ContextBuilder

  constructor(llmClient?: LLMClient, contextBuilder?: ContextBuilder) {
    this.llmClient = llmClient
    this.contextBuilder = contextBuilder
  }

  /**
   * 聚合结果
   */
  async aggregate(
    results: Map<string, AgentResult>,
    sessionId?: string
  ): Promise<AggregatedResult> {
    if (results.size === 0) {
      return {
        markdown: '任务已完成，但没有生成结果。',
        attachments: [],
        suggestedActions: [],
        metadata: { resultsCount: 0, successfulResults: 0 },
      }
    }

    const successfulResults = Array.from(results.values()).filter((r) => r.success)
    const failedResults = Array.from(results.values()).filter((r) => !r.success)

    // 尝试使用 LLM 生成聚合结果
    if (this.llmClient) {
      try {
        return await this.llmAggregate(results, successfulResults, failedResults, sessionId)
      } catch {
        // LLM 调用失败，走规则降级
      }
    }

    // 规则降级：简单拼接结果
    return this.ruleBasedAggregate(results, successfulResults, failedResults)
  }

  /**
   * 使用 LLM 聚合结果
   */
  private async llmAggregate(
    results: Map<string, AgentResult>,
    successful: AgentResult[],
    failed: AgentResult[],
    sessionId?: string
  ): Promise<AggregatedResult> {
    const systemPrompt = `你是结果整合器。
将多个执行结果合成为用户可理解的回复。

输出规则：
- 用中文回复，语气专业但不生硬
- 结构：摘要（1-2句）→ 主要结果 → 下一步建议
- 不要重复原始数据，只输出对用户有价值的摘要
- 如有可下载文件，在回复末尾列出
- 不要编造任何业务结论，只陈述执行结果

只输出 JSON。`

    const userInput = `请聚合以下执行结果：

成功的结果（${successful.length}个）：
${successful.map((r, i) => `${i + 1}. ${JSON.stringify(r.data).substring(0, 500)}`).join('\n')}

${failed.length > 0 ? `失败的结果（${failed.length}个）：\n${failed.map((r, i) => `${i + 1}. 错误: ${r.error?.message ?? '未知错误'}`).join('\n')}` : ''}

输出格式：
{
  "reply": "面向用户的 Markdown 回复",
  "artifacts": [],
  "suggestedNextActions": ["操作1", "操作2"]
}`

    let messages: LLMMessage[]
    if (this.contextBuilder && sessionId) {
      messages = await this.contextBuilder.buildThreeLayerMessages(
        systemPrompt,
        {
          sessionId,
          extraContext: { step_results: `成功: ${successful.length}, 失败: ${failed.length}` },
        },
        userInput
      )
    } else {
      messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userInput },
      ]
    }

    const response = await this.llmClient!.chatWithSchema<{
      reply: string
      artifacts: Array<{ type: string; filename: string }>
      suggestedNextActions: string[]
    }>(messages, {
      type: 'object',
      properties: {
        reply: { type: 'string' },
        artifacts: { type: 'array', items: { type: 'object' } },
        suggestedNextActions: { type: 'array', items: { type: 'string' } },
      },
      required: ['reply'],
    })

    return {
      markdown: response.reply,
      attachments: this.extractAttachments(results),
      suggestedActions: response.suggestedNextActions ?? [],
      metadata: {
        resultsCount: results.size,
        successfulResults: successful.length,
        failedResults: failed.length,
      },
    }
  }

  /**
   * 基于规则的降级聚合（不使用 LLM）
   */
  private ruleBasedAggregate(
    results: Map<string, AgentResult>,
    successful: AgentResult[],
    failed: AgentResult[]
  ): AggregatedResult {
    const parts: string[] = []

    if (successful.length > 0) {
      parts.push(`已完成 ${successful.length} 个步骤：`)
      successful.forEach((r, i) => {
        const summary = r.data?.summary ?? r.data?.title ?? `步骤 ${i + 1}`
        parts.push(`- ${summary}`)
      })
    }

    if (failed.length > 0) {
      parts.push(`\n${failed.length} 个步骤执行失败：`)
      failed.forEach((r, i) => {
        parts.push(`- 步骤 ${i + 1}: ${r.error?.message ?? '未知错误'}`)
      })
    }

    return {
      markdown: parts.join('\n'),
      attachments: this.extractAttachments(results),
      suggestedActions: this.generateSuggestedActions(results),
      metadata: {
        resultsCount: results.size,
        successfulResults: successful.length,
        failedResults: failed.length,
      },
    }
  }

  /**
   * 从结果中提取附件
   */
  private extractAttachments(results: Map<string, AgentResult>): Attachment[] {
    const attachments: Attachment[] = []
    for (const [, result] of results) {
      if (result.success && result.data?.attachments) {
        attachments.push(...result.data.attachments)
      }
    }
    return attachments
  }

  /**
   * 生成建议操作
   */
  private generateSuggestedActions(results: Map<string, AgentResult>): string[] {
    const actions: string[] = []

    // 检查是否有失败步骤，建议重试
    const hasFailed = Array.from(results.values()).some((r) => !r.success)
    if (hasFailed) {
      actions.push('重试失败的步骤')
    }

    // 检查是否有可下载的内容
    const hasAttachments = Array.from(results.values()).some(
      (r) => r.success && r.data?.attachments?.length > 0
    )
    if (hasAttachments) {
      actions.push('下载结果文件')
    }

    return actions
  }
}
