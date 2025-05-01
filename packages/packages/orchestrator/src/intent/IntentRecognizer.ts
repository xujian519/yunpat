/**
 * IntentRecognizer - 意图识别器（Call 1）
 *
 * 职责：
 * 1. 识别用户意图
 * 2. 评估置信度
 * 3. 提取关键信息
 * 4. 生成追问问题（如需要）
 *
 * 设计：通过 IntentDomainConfig 配置化，System Prompt 不包含任何领域知识。
 */

import {
  IntentRecognitionResult,
  OrchestratorInput,
  IntentType,
  IntentDomainConfig,
  FileSignal,
} from '../types/index.js'
import { LLMClient, LLMMessage } from '../llm/LLMClient.js'
import { PatentIntentConfig } from './PatentIntentConfig.js'
import type { ContextBuilder } from '../context/ContextBuilder.js'

export class IntentRecognizer {
  private llmClient: LLMClient
  private confidenceThreshold: number
  private domainConfig: IntentDomainConfig
  private contextBuilder?: ContextBuilder

  constructor(
    llmClient: LLMClient,
    confidenceThreshold: number = 0.7,
    domainConfig?: IntentDomainConfig,
    contextBuilder?: ContextBuilder
  ) {
    this.llmClient = llmClient
    this.confidenceThreshold = confidenceThreshold
    this.domainConfig = domainConfig ?? PatentIntentConfig
    this.contextBuilder = contextBuilder
  }

  /**
   * 识别意图
   */
  async recognize(input: OrchestratorInput): Promise<IntentRecognitionResult> {
    let messages: LLMMessage[]

    const fewShots = this.getFewShotExamples().map((ex) => ({
      input: ex.input,
      output: JSON.stringify(ex.output),
    }))

    // 使用 ContextBuilder 构建三层消息（System → Context → Few-shots → User）
    if (this.contextBuilder) {
      messages = await this.contextBuilder.buildThreeLayerMessages(
        this.getSystemPrompt(),
        {
          sessionId: input.sessionId,
          includeAgentRegistry: true,
        },
        this.buildUserPrompt(input),
        fewShots
      )
    } else {
      // 兜底：手动构建消息
      messages = [{ role: 'system', content: this.getSystemPrompt() }]
      for (const example of fewShots) {
        messages.push({ role: 'user', content: example.input })
        messages.push({ role: 'assistant', content: example.output })
      }
      messages.push({ role: 'user', content: this.buildUserPrompt(input) })
    }

    try {
      const response = await this.llmClient.chatWithSchema<IntentRecognitionResponse>(
        messages,
        this.getResponseSchema()
      )

      return this.parseResponse(response, input)
    } catch (error) {
      // LLM调用失败，返回CLARIFY
      return {
        intent: 'CLARIFY',
        confidence: 0.5,
        complexity: 'simple',
        extracted: {
          hasAttachment: input.attachments ? input.attachments.length > 0 : false,
          urgency: 'normal',
          keywords: [],
        },
        clarifyQuestion: '抱歉，我没有理解您的需求，能否详细说明一下？',
      }
    }
  }

  /**
   * 生成领域无关的 System Prompt
   * 所有意图定义来自 domainConfig，不硬编码任何业务关键词
   */
  private getSystemPrompt(): string {
    const { domainName, domainDescription, categories } = this.domainConfig

    const businessCategories = categories.filter((c) => !c.isSystemIntent)
    const systemCategories = categories.filter((c) => c.isSystemIntent)

    const intentList = [
      ...businessCategories.map(
        (c, i) =>
          `${i + 1}. **${c.intentId}** - ${c.label}\n   - ${c.description}\n   - 关键词：${c.keywords.length > 0 ? c.keywords.map((k) => `"${k}"`).join('、') : '（无特定关键词）'}\n   - 复杂度：${c.complexity}`
      ),
      ...systemCategories.map(
        (c) => `**${c.intentId}** - ${c.label}\n   - ${c.description}\n   - 复杂度：${c.complexity}`
      ),
    ].join('\n\n')

    return `你是 ${domainName} 平台的任务调度器的意图分类模块。
${domainDescription}

你的唯一职责是理解用户意图并将其分类为标准任务类型。

## 严格约束
- 你不具备任何业务领域知识，不对业务内容做任何判断
- 你不向用户提供专业建议，不解释业务概念
- 你只输出 JSON，不输出任何自然语言解释
- 如果意图不明确，分类为 CLARIFY，不要猜测

## 可用意图类型

${intentList}

## 置信度评估标准
- **≥0.9**：非常确定，直接执行
- **0.7-0.9**：较确定，正常执行
- **<0.7**：不确定，进入 CLARIFY 流程

## 关键信息提取
对于每个意图，提取以下信息：
- title: 主题名称（如能提取）
- field: 领域（如能提取）
- hasAttachment: 是否有附件
- urgency: 紧急程度（normal/urgent）
- keywords: 关键词列表（3-10个）

## 输出格式
严格按照 JSON Schema 输出，不要添加任何额外的文字说明。`
  }

  /**
   * 构建用户提示
   */
  private buildUserPrompt(input: OrchestratorInput): string {
    let prompt = `用户消息：${input.message}`

    if (input.attachments && input.attachments.length > 0) {
      prompt += `\n\n附件：${input.attachments.length}个文件`
      input.attachments.forEach((att, index) => {
        prompt += `\n${index + 1}. ${att.filename} (${att.mimeType})`
      })
    }

    if (input.fileSignals && input.fileSignals.length > 0) {
      prompt += `\n\n工作区文件信号：${input.fileSignals.length}个相关文件`
      const typeLabels: Record<string, string> = {
        office_action: '审查意见',
        technical_disclosure: '技术交底书',
        patent_draft: '权利要求',
        search_report: '检索报告',
        reference_document: '参考文档',
      }
      input.fileSignals.forEach((f: FileSignal, index: number) => {
        const label = typeLabels[f.signalType] || f.signalType
        prompt += `\n${index + 1}. [${label}] ${f.filename} (.${f.extension}, 置信度: ${Math.round(f.confidence * 100)}%)`
      })
      prompt += '\n提示：文件信号应优先于消息文本用于意图判断。'
    }

    if (input.context) {
      prompt += `\n\n额外上下文：${JSON.stringify(input.context)}`
    }

    return prompt
  }

  /**
   * 从 domainConfig 获取 Few-shot 示例
   */
  private getFewShotExamples(): Array<{
    input: string
    output: IntentRecognitionResult
  }> {
    return this.domainConfig.fewShotExamples
  }

  /**
   * 从 domainConfig 动态生成响应 Schema
   */
  private getResponseSchema(): object {
    const intentIds = this.domainConfig.categories.map((c) => c.intentId)

    return {
      type: 'object',
      properties: {
        intent: {
          type: 'string',
          enum: intentIds,
        },
        confidence: {
          type: 'number',
          minimum: 0,
          maximum: 1,
        },
        complexity: {
          type: 'string',
          enum: ['simple', 'complex'],
        },
        extracted: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            field: { type: 'string' },
            hasAttachment: { type: 'boolean' },
            urgency: { type: 'string', enum: ['normal', 'urgent'] },
            keywords: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          required: ['hasAttachment', 'urgency', 'keywords'],
        },
        clarifyQuestion: {
          type: 'string',
        },
      },
      required: ['intent', 'confidence', 'complexity', 'extracted'],
    }
  }

  /**
   * 解析响应
   */
  private parseResponse(
    response: IntentRecognitionResponse,
    input: OrchestratorInput
  ): IntentRecognitionResult {
    // 如果置信度低于阈值，转换为CLARIFY
    if (response.confidence < this.confidenceThreshold && response.intent !== 'CLARIFY') {
      return {
        intent: 'CLARIFY',
        confidence: response.confidence,
        complexity: 'simple',
        extracted: response.extracted,
        clarifyQuestion: this.generateClarifyQuestion(response),
      }
    }

    // 确保有附件时正确标记
    if (input.attachments && input.attachments.length > 0) {
      response.extracted.hasAttachment = true
    }

    return response as IntentRecognitionResult
  }

  /**
   * 生成追问问题
   * 通用实现：基于意图配置生成追问，不硬编码业务逻辑
   */
  private generateClarifyQuestion(response: IntentRecognitionResponse): string {
    const category = this.domainConfig.categories.find((c) => c.intentId === response.intent)
    const keywords = response.extracted.keywords

    if (category && !category.isSystemIntent) {
      return `我注意到您想要${category.label}（关键词：${keywords.join('、')}）。请提供更多信息，以便我为您安排合适的任务。`
    }

    return '抱歉，我没有完全理解您的需求，能否详细说明一下您想要做什么？'
  }
}

/**
 * 意图识别响应（内部使用）
 */
interface IntentRecognitionResponse {
  intent: IntentType
  confidence: number
  complexity: 'simple' | 'complex'
  extracted: {
    title?: string
    field?: string
    hasAttachment: boolean
    urgency: 'normal' | 'urgent'
    keywords: string[]
  }
  clarifyQuestion?: string
}
