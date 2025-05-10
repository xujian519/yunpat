/**
 * CompactBoundary — 压缩边界标记
 *
 * 借鉴 Claude Code 设计：
 * - 每次压缩后在消息流中插入边界标记
 * - 后续操作只处理最后一条 boundary 之后的消息
 * - 支持 MicroCompact Boundary 和全量 Compact Boundary
 */

import type { CompactBoundary, CompactType } from './types.js'

/**
 * 边界标记唯一标识前缀
 */
const BOUNDARY_PREFIX = '__COMPACT_BOUNDARY__'
const MICRO_BOUNDARY_PREFIX = '__MICROCOMPACT_BOUNDARY__'

/**
 * 创建压缩边界标记内容
 */
export function createCompactBoundaryContent(boundary: CompactBoundary): string {
  const data = JSON.stringify({
    type: boundary.compactType,
    preTokens: boundary.preCompactTokenCount,
    postTokens: boundary.postCompactTokenCount,
    timestamp: boundary.timestamp,
    compactedTypes: boundary.compactedContentTypes,
  })

  if (boundary.compactType === 'micro') {
    return `${MICRO_BOUNDARY_PREFIX}${data}`
  }

  return `${BOUNDARY_PREFIX}${data}`
}

/**
 * 从消息内容解析边界标记
 */
export function parseCompactBoundary(content: string): CompactBoundary | null {
  if (content.startsWith(BOUNDARY_PREFIX)) {
    try {
      const data = JSON.parse(content.slice(BOUNDARY_PREFIX.length))
      return {
        compactType: data.type as CompactType,
        preCompactTokenCount: data.preTokens,
        postCompactTokenCount: data.postTokens,
        timestamp: data.timestamp,
        compactedContentTypes: data.compactedTypes,
      }
    } catch {
      return null
    }
  }

  if (content.startsWith(MICRO_BOUNDARY_PREFIX)) {
    try {
      const data = JSON.parse(content.slice(MICRO_BOUNDARY_PREFIX.length))
      return {
        compactType: 'micro',
        preCompactTokenCount: data.preTokens,
        postCompactTokenCount: data.postTokens,
        timestamp: data.timestamp,
        compactedContentTypes: data.compactedTypes,
      }
    } catch {
      return null
    }
  }

  return null
}

/**
 * 检查内容是否为边界标记
 */
export function isCompactBoundary(content: string): boolean {
  return content.startsWith(BOUNDARY_PREFIX) || content.startsWith(MICRO_BOUNDARY_PREFIX)
}

/**
 * 检查内容是否为 MicroCompact 边界
 */
export function isMicroCompactBoundary(content: string): boolean {
  return content.startsWith(MICRO_BOUNDARY_PREFIX)
}

/**
 * 获取最后一条边界标记之后的消息
 *
 * 这是压缩后处理的核心函数：只保留最新边界之后的内容。
 */
export function getMessagesAfterLastBoundary<T extends { role: string; content: string }>(
  messages: T[]
): T[] {
  let lastBoundaryIndex = -1
  for (let i = messages.length - 1; i >= 0; i--) {
    if (isCompactBoundary(messages[i].content)) {
      lastBoundaryIndex = i
      break
    }
  }

  if (lastBoundaryIndex >= 0) {
    return messages.slice(lastBoundaryIndex + 1)
  }

  return messages
}

/**
 * 获取所有边界标记
 */
export function extractBoundaries(
  messages: Array<{ role: string; content: string }>
): CompactBoundary[] {
  const boundaries: CompactBoundary[] = []

  for (const msg of messages) {
    const boundary = parseCompactBoundary(msg.content)
    if (boundary) {
      boundaries.push(boundary)
    }
  }

  return boundaries
}

/**
 * 计算累计压缩节省的 token 数
 */
export function calculateTotalTokensSaved(boundaries: CompactBoundary[]): number {
  return boundaries.reduce((total, b) => {
    return total + (b.preCompactTokenCount - b.postCompactTokenCount)
  }, 0)
}
