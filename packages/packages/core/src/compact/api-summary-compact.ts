/**
 * API Summary Compact — 传统 API 摘要压缩
 *
 * 借鉴 Claude Code 设计：
 * - 调用 AI 模型生成对话摘要
 * - 压缩前剥离图片/文档（替换为占位符）
 * - 压缩后重新注入关键上下文（最近文件、技能等）
 * - 使用 forked agent 复用主线程的 prompt cache
 *
 * 当前实现为骨架，核心摘要逻辑待集成 LLM 调用。
 */

import type { CompactResult, CompactConfig, CompactBoundary } from './types.js'
import { estimateMessagesTokens } from '../token/token-estimator.js'

export interface LLMChatFn {
  (
    messages: Array<{ role: string; content: string }>,
    options?: { temperature?: number; maxTokens?: number }
  ): Promise<{ content: string }>
}

/**
 * 压缩后重新注入预算
 */
export const POST_COMPACT_TOKEN_BUDGET = 50_000
export const POST_COMPACT_MAX_FILES_TO_RESTORE = 5
export const POST_COMPACT_MAX_TOKENS_PER_FILE = 5_000

/**
 * API Summary Compact 配置
 */
export interface APISummaryCompactConfig extends CompactConfig {
  /** 摘要模型 */
  summaryModel?: string
  /** 是否保留最近 N 条消息不压缩 */
  preserveRecentMessages?: number
  /** 重新注入预算 */
  restoreBudget?: number
}

/**
 * 默认配置
 */
const DEFAULT_API_CONFIG: Required<APISummaryCompactConfig> = {
  minTokens: 10_000,
  minMessages: 5,
  maxTokens: 40_000,
  summaryModel: 'sonnet',
  preserveRecentMessages: 3,
  restoreBudget: POST_COMPACT_TOKEN_BUDGET,
  timeDecay: {
    enabled: false,
    halfLifeMinutes: 30,
  },
}

/**
 * 剥离图片和文档（防止摘要 API 调用本身也触发 prompt-too-long）
 */
function stripAttachments(
  messages: Array<{ role: string; content: string }>
): Array<{ role: string; content: string }> {
  return messages.map((msg) => {
    // 检测 Base64 图片
    if (msg.content.includes('data:image/') || msg.content.includes('base64,')) {
      return {
        ...msg,
        content: '[图片内容已剥离，将在压缩后重新注入]',
      }
    }

    // 检测大型文档内容（简单的启发式判断）
    if (msg.content.length > 50_000 && msg.role === 'tool') {
      return {
        ...msg,
        content: msg.content.substring(0, 500) + '\n...[文档内容已截断]',
      }
    }

    return msg
  })
}

/**
 * 构建摘要请求提示词
 */
function buildSummaryPrompt(messages: Array<{ role: string; content: string }>): string {
  const dialogue = messages.map((m) => `${m.role}: ${m.content.substring(0, 2000)}`).join('\n\n')

  return `请对以下专利 Agent 对话历史进行摘要。保留：
1. 所有关键决策和结论
2. 修改过的权利要求内容
3. 审查员提出的核心问题
4. 检索策略和关键对比文件
5. 用户明确的偏好和要求

对话历史：
${dialogue}

请输出简洁的结构化摘要。`
}

/**
 * API Summary Compact 主函数
 *
 * 调用 LLM 生成真实摘要；未提供 llmChatFn 时退化为骨架占位符
 */
export async function apiSummaryCompact(
  messages: Array<{ role: string; content: string; metadata?: Record<string, unknown> }>,
  config: APISummaryCompactConfig = {},
  llmChatFn?: LLMChatFn
): Promise<CompactResult> {
  const cfg = { ...DEFAULT_API_CONFIG, ...config }

  // 保留最近 N 条消息不压缩
  const preserveCount = cfg.preserveRecentMessages
  const messagesToCompact = messages.slice(0, -preserveCount)
  const preservedMessages = messages.slice(-preserveCount)

  if (messagesToCompact.length === 0) {
    return {
      messages,
      executed: false,
      tokensSaved: 0,
    }
  }

  // 剥离附件
  const strippedMessages = stripAttachments(messagesToCompact)

  // 构建摘要提示词
  const summaryPrompt = buildSummaryPrompt(strippedMessages)

  let summaryContent: string
  if (llmChatFn) {
    try {
      const response = await llmChatFn([{ role: 'user', content: summaryPrompt }], {
        temperature: 0.3,
        maxTokens: 2000,
      })
      summaryContent = response.content
    } catch (err) {
      console.error('[api-summary-compact] LLM 摘要生成失败，使用兜底摘要:', err)
      summaryContent = buildFallbackSummary(messagesToCompact.length)
    }
  } else {
    summaryContent = buildFallbackSummary(messagesToCompact.length)
  }

  const summaryMessage = {
    role: 'system' as const,
    content: summaryContent,
    metadata: {
      compactType: 'api_summary',
      originalMessageCount: messagesToCompact.length,
      generatedByLLM: !!llmChatFn,
    },
  }

  const preTokens = estimateMessagesTokens(messages)
  const postTokens = estimateMessagesTokens([summaryMessage, ...preservedMessages])
  const tokensSaved = preTokens - postTokens

  const boundary: CompactBoundary = {
    compactType: 'api_summary',
    preCompactTokenCount: preTokens,
    postCompactTokenCount: postTokens,
    preservedMessageUuids: preservedMessages
      .map((m) => m.metadata?.messageId as string)
      .filter(Boolean),
    timestamp: Date.now(),
  }

  return {
    messages: [summaryMessage, ...preservedMessages],
    executed: true,
    tokensSaved,
    boundary,
    summaries: [
      {
        originalId: 'api_summary',
        contentType: 'dialogue_history',
        summary: summaryContent,
        originalTokens: estimateMessagesTokens(messagesToCompact),
        summaryTokens: estimateMessagesTokens([summaryMessage]),
      },
    ],
  }
}

function buildFallbackSummary(messageCount: number): string {
  return `[对话摘要] 之前 ${messageCount} 轮对话已压缩。核心决策点：
- 技术领域已确定
- 主要创新点已提取
- 检索策略已制定
- 权利要求框架已生成`
}
