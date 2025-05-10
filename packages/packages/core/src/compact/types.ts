/**
 * 上下文压缩类型定义
 */

/**
 * 压缩类型
 */
export type CompactType = 'auto' | 'manual' | 'micro' | 'session_memory' | 'api_summary'

/**
 * 压缩边界标记
 */
export interface CompactBoundary {
  /** 压缩类型 */
  compactType: CompactType
  /** 压缩前 token 数 */
  preCompactTokenCount: number
  /** 压缩后 token 数 */
  postCompactTokenCount: number
  /** 最后一条用户消息 UUID */
  lastUserMessageUuid?: string
  /** 被压缩的内容类型列表 */
  compactedContentTypes?: string[]
  /** 被保留的消息 UUID 列表 */
  preservedMessageUuids?: string[]
  /** 时间戳 */
  timestamp: number
}

/**
 * 压缩结果
 */
export interface CompactResult {
  /** 压缩后的消息 */
  messages: Array<{ role: string; content: string; metadata?: Record<string, unknown> }>
  /** 是否执行了压缩 */
  executed: boolean
  /** 节省的 token 数 */
  tokensSaved: number
  /** 边界标记（如果执行了压缩） */
  boundary?: CompactBoundary
  /** 被压缩的内容摘要 */
  summaries?: ContentSummary[]
}

/**
 * 内容摘要
 */
export interface ContentSummary {
  /** 原始内容 ID */
  originalId: string
  /** 内容类型 */
  contentType: string
  /** 摘要文本 */
  summary: string
  /** 原始 token 数 */
  originalTokens: number
  /** 摘要 token 数 */
  summaryTokens: number
}

/**
 * 可压缩内容类型
 */
export type CompactableContentType =
  | 'patent_search_results' // 专利检索结果
  | 'prior_art_fulltext' // 对比文件全文
  | 'legal_provisions' // 法条原文
  | 'web_search_results' // 网络搜索结果
  | 'knowledge_base_query' // 知识库查询结果
  | 'drawing_description' // 附图说明（大量文本时）
  | 'embodiment_detail' // 实施例细节
  | 'tool_result' // 工具调用结果

/**
 * 压缩配置
 */
export interface CompactConfig {
  /** 最小保留 token 数 */
  minTokens?: number
  /** 最小保留消息数 */
  minMessages?: number
  /** 最大保留 token 数 */
  maxTokens?: number
  /** 时间衰减配置（越旧越容易被压缩） */
  timeDecay?: {
    enabled: boolean
    halfLifeMinutes: number
  }
}

/**
 * 文档分段
 */
export interface DocumentSegment {
  /** 段落 ID */
  id: string
  /** 段落类型 */
  type: string
  /** 段落标题/标识 */
  title: string
  /** 段落内容 */
  content: string
  /** token 数 */
  tokenCount: number
  /** 是否常驻（如权利要求书） */
  isResident: boolean
  /** 加载优先级 */
  priority: number
  /** 依赖的其他段落 ID */
  dependsOn?: string[]
}

/**
 * 分段加载策略
 */
export type SegmentLoadStrategy =
  | 'resident' // 始终加载
  | 'on_demand' // 按需加载（引用到时才加载）
  | 'lazy' // 延迟加载（首次访问后缓存）
  | 'summary_only' // 只加载摘要
