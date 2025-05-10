/**
 * Session Memory Compact — 无 API 调用的压缩
 *
 * 借鉴 Claude Code 的 Session Memory Compact 设计：
 * - 不调用摘要模型，直接使用已提取的 Session Memory 作为对话摘要
 * - 保留最近 N 轮完整对话 + 案件核心事实记忆
 * - 工具对完整性保护（tool_use/tool_result 配对）
 *
 * 当前实现为骨架，后续可集成 memory 模块的 Session Memory 功能。
 */

import type { CompactResult, CompactConfig, CompactBoundary } from './types.js'
import { estimateMessagesTokens } from '../token/token-estimator.js'

/**
 * 默认配置
 */
const DEFAULT_SM_CONFIG: Required<CompactConfig> = {
  minTokens: 8000,
  minMessages: 3,
  maxTokens: 30000,
  timeDecay: {
    enabled: false,
    halfLifeMinutes: 30,
  },
}

/**
 * 计算要保留的消息索引
 *
 * 从最新消息向前扩展，直到满足：
 * - 至少 minTokens
 * - 至少 minTextBlockMessages 条文本消息
 * - 不超过 maxTokens
 */
export function calculateMessagesToKeepIndex(
  messages: Array<{ role: string; content: string }>,
  config: CompactConfig = {}
): number {
  const cfg = { ...DEFAULT_SM_CONFIG, ...config }

  let totalTokens = 0
  let textBlockMessageCount = 0
  let startIndex = messages.length - 1

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    const msgTokens = estimateMessagesTokens([msg])

    totalTokens += msgTokens
    if (msg.content && msg.content.trim().length > 0) {
      textBlockMessageCount++
    }

    startIndex = i

    // 满足上限条件
    if (totalTokens >= cfg.maxTokens) {
      break
    }

    // 满足下限条件
    if (totalTokens >= cfg.minTokens && textBlockMessageCount >= cfg.minMessages) {
      break
    }
  }

  // 工具对完整性保护
  return adjustIndexToPreserveToolPairs(messages, startIndex)
}

/**
 * 调整索引以保护 tool_use/tool_result 配对
 *
 * API 要求每个 tool_result 都有对应的 tool_use，反之亦然。
 * 如果压缩恰好切在一条 tool_result 消息处，会导致 API 报错。
 */
function adjustIndexToPreserveToolPairs(
  messages: Array<{ role: string; content: string; toolCalls?: unknown[]; toolCallId?: string }>,
  startIndex: number
): number {
  // 向前扫描，确保被保留的消息中引用的 tool_use 也在保留范围内
  const preservedMessages = messages.slice(startIndex)
  const toolUseIds = new Set<string>()

  // 收集保留消息中引用的 tool_use ID
  for (const msg of preservedMessages) {
    if (msg.toolCallId) {
      toolUseIds.add(msg.toolCallId)
    }
  }

  // 向前查找对应的 tool_use
  let adjustedIndex = startIndex
  for (let i = startIndex - 1; i >= 0; i--) {
    const msg = messages[i]
    if (msg.toolCalls && Array.isArray(msg.toolCalls)) {
      for (const toolCall of msg.toolCalls) {
        const id = (toolCall as { id?: string }).id
        if (id && toolUseIds.has(id)) {
          adjustedIndex = i
        }
      }
    }
  }

  return adjustedIndex
}

/**
 * Session Memory Compact 主函数（骨架实现）
 *
 * TODO: 集成 memory 模块的 Session Memory 提取功能
 */
export async function sessionMemoryCompact(
  messages: Array<{ role: string; content: string; metadata?: Record<string, unknown> }>,
  config: CompactConfig = {}
): Promise<CompactResult> {
  const cfg = { ...DEFAULT_SM_CONFIG, ...config }

  const startIndex = calculateMessagesToKeepIndex(messages, cfg)
  const preservedMessages = messages.slice(startIndex)
  const removedMessages = messages.slice(0, startIndex)

  const preTokens = estimateMessagesTokens(messages)
  const postTokens = estimateMessagesTokens(preservedMessages)
  const tokensSaved = preTokens - postTokens

  if (tokensSaved <= 0) {
    return {
      messages,
      executed: false,
      tokensSaved: 0,
    }
  }

  // TODO: 使用 Session Memory 作为摘要替代被移除的消息
  // 当前骨架实现：简单地保留最近消息，不生成摘要
  const summaryMessage = {
    role: 'system' as const,
    content: `[会话记忆] 之前 ${removedMessages.length} 轮对话已压缩。核心事实保留在上下文中。`,
    metadata: {
      compactType: 'session_memory',
      compactedMessageCount: removedMessages.length,
    },
  }

  const boundary: CompactBoundary = {
    compactType: 'session_memory',
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
        originalId: 'session_memory',
        contentType: 'dialogue_history',
        summary: `已压缩 ${removedMessages.length} 轮对话`,
        originalTokens: estimateMessagesTokens(removedMessages),
        summaryTokens: estimateMessagesTokens([summaryMessage]),
      },
    ],
  }
}
