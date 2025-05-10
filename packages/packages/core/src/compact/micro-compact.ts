/**
 * Patent MicroCompact — 局部压缩
 *
 * 借鉴 Claude Code MicroCompact 设计：
 * - 不压缩整个对话，只清除旧工具输出的内容
 * - 维护可压缩内容类型白名单
 * - 时间衰减：越旧的内容越容易被压缩
 * - 原始内容保留在 transcript 中，只是不再发送给 API
 */

import {
  type CompactResult,
  type CompactBoundary,
  type CompactConfig,
  type CompactableContentType,
} from './types.js'
import { estimateTextTokens } from '../token/token-estimator.js'

/**
 * 可压缩内容类型白名单
 */
const COMPACTABLE_TYPES: Set<CompactableContentType> = new Set([
  'patent_search_results',
  'prior_art_fulltext',
  'legal_provisions',
  'web_search_results',
  'knowledge_base_query',
  'drawing_description',
  'embodiment_detail',
  'tool_result',
])

/**
 * 默认配置
 */
const DEFAULT_CONFIG: Required<CompactConfig> = {
  minTokens: 5000,
  minMessages: 3,
  maxTokens: 30000,
  timeDecay: {
    enabled: true,
    halfLifeMinutes: 30,
  },
}

/**
 * 压缩占位符模板
 */
function createPlaceholder(contentType: string, summary: string): string {
  return `[${contentType} 已压缩] ${summary}`
}

/**
 * 计算时间衰减权重
 *
 * 越旧的消息权重越低，越容易压缩
 */
function calculateTimeWeight(timestamp: number, halfLifeMinutes: number): number {
  const ageMinutes = (Date.now() - timestamp) / 60000
  return Math.exp(-ageMinutes / halfLifeMinutes)
}

/**
 * MicroCompact：局部压缩实现
 *
 * 策略：
 * 1. 遍历消息，识别可压缩内容
 * 2. 超过阈值且时间衰减权重的内容替换为占位符
 * 3. 保留消息结构（只替换内容），不删除消息
 */
export async function microCompact(
  messages: Array<{
    role: string
    content: string
    metadata?: Record<string, unknown>
    timestamp?: number
  }>,
  config: CompactConfig = {}
): Promise<CompactResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  const timeDecay = cfg.timeDecay ?? DEFAULT_CONFIG.timeDecay

  let totalTokensBefore = 0
  let totalTokensAfter = 0
  let compactedCount = 0
  const compactedTypes: string[] = []
  const summaries: Array<{
    originalId: string
    contentType: string
    summary: string
    tokensSaved: number
  }> = []

  const compactedMessages = messages.map((msg) => {
    const msgTokens = estimateTextTokens(msg.content)
    totalTokensBefore += msgTokens

    // 检查是否可压缩
    const contentType = msg.metadata?.contentType as CompactableContentType | undefined
    if (!contentType || !COMPACTABLE_TYPES.has(contentType)) {
      totalTokensAfter += msgTokens
      return msg
    }

    // 检查 token 阈值
    if (msgTokens < cfg.minTokens) {
      totalTokensAfter += msgTokens
      return msg
    }

    // 计算时间衰减权重
    const timestamp = msg.timestamp ?? Date.now()
    const weight = timeDecay.enabled ? calculateTimeWeight(timestamp, timeDecay.halfLifeMinutes) : 1

    // 权重高（内容新）且 token 数不大，保留
    if (weight > 0.5 && msgTokens < cfg.maxTokens) {
      totalTokensAfter += msgTokens
      return msg
    }

    // 执行压缩：替换为占位符
    const summary = (msg.metadata?.summary as string) || `${msg.content.substring(0, 100)}...`
    const placeholder = createPlaceholder(contentType, summary)
    const placeholderTokens = estimateTextTokens(placeholder)
    const tokensSaved = msgTokens - placeholderTokens

    compactedCount++
    if (!compactedTypes.includes(contentType)) {
      compactedTypes.push(contentType)
    }
    summaries.push({
      originalId: (msg.metadata?.messageId as string) || 'unknown',
      contentType,
      summary,
      tokensSaved,
    })

    totalTokensAfter += placeholderTokens

    return {
      ...msg,
      content: placeholder,
      metadata: {
        ...msg.metadata,
        compacted: true,
        originalLength: msg.content.length,
        originalTokens: msgTokens,
      },
    }
  })

  const tokensSaved = totalTokensBefore - totalTokensAfter

  // 如果没有节省 token，不生成边界标记
  if (tokensSaved <= 0) {
    return {
      messages: compactedMessages,
      executed: false,
      tokensSaved: 0,
    }
  }

  const boundary: CompactBoundary = {
    compactType: 'micro',
    preCompactTokenCount: totalTokensBefore,
    postCompactTokenCount: totalTokensAfter,
    compactedContentTypes: compactedTypes,
    timestamp: Date.now(),
  }

  return {
    messages: compactedMessages,
    executed: true,
    tokensSaved,
    boundary,
    summaries: summaries.map((s) => ({
      originalId: s.originalId,
      contentType: s.contentType,
      summary: s.summary,
      originalTokens:
        s.tokensSaved + estimateTextTokens(createPlaceholder(s.contentType, s.summary)),
      summaryTokens: estimateTextTokens(createPlaceholder(s.contentType, s.summary)),
    })),
  }
}

/**
 * 检查内容类型是否可压缩
 */
export function isCompactable(contentType: string): contentType is CompactableContentType {
  return COMPACTABLE_TYPES.has(contentType as CompactableContentType)
}

/**
 * 获取可压缩内容类型列表
 */
export function getCompactableTypes(): CompactableContentType[] {
  return Array.from(COMPACTABLE_TYPES)
}
