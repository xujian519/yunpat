/**
 * 上下文压缩模块
 *
 * 导出 Phase 1 核心组件：
 * - MicroCompact：局部压缩旧工具输出
 * - SessionMemoryCompact：无 API 调用的压缩
 * - APISummaryCompact：传统 API 摘要压缩
 * - CompactBoundary：压缩边界标记
 * - DocumentSegmentLoader：专利文档分段加载
 */

// 类型定义
export {
  type CompactType,
  type CompactBoundary,
  type CompactResult,
  type CompactConfig,
  type ContentSummary,
  type CompactableContentType,
  type DocumentSegment,
  type SegmentLoadStrategy,
} from './types.js'

// MicroCompact
export { microCompact, isCompactable, getCompactableTypes } from './micro-compact.js'

// CompactBoundary
export {
  createCompactBoundaryContent,
  parseCompactBoundary,
  isCompactBoundary,
  isMicroCompactBoundary,
  getMessagesAfterLastBoundary,
  extractBoundaries,
  calculateTotalTokensSaved,
} from './compact-boundary.js'

// Session Memory Compact
export { sessionMemoryCompact, calculateMessagesToKeepIndex } from './session-memory-compact.js'

// API Summary Compact
export {
  apiSummaryCompact,
  type LLMChatFn,
  type APISummaryCompactConfig,
  POST_COMPACT_TOKEN_BUDGET,
  POST_COMPACT_MAX_FILES_TO_RESTORE,
  POST_COMPACT_MAX_TOKENS_PER_FILE,
} from './api-summary-compact.js'

// Document Segment Loader
export {
  DocumentSegmentLoader,
  PATENT_SECTION_TYPES,
  parseSpecificationIntoSegments,
  parseClaimsIntoSegments,
} from './document-segment-loader.js'
