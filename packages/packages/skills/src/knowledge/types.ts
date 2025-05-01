/**
 * 知识库类型定义
 *
 * @package @yunpat/skills
 */

/**
 * 知识库配置
 */
export interface KnowledgeConfig {
  /** Obsidian vault 路径 */
  vaultPath: string

  /** 是否启用索引 */
  indexEnabled?: boolean

  /** 是否启用搜索 */
  searchEnabled?: boolean

  /** 索引更新间隔（毫秒） */
  indexUpdateInterval?: number

  /** 最大索引文件数 */
  maxIndexedFiles?: number
}

/**
 * 知识条目类型
 */
export enum KnowledgeEntryType {
  CONCEPT = 'concept',
  WIKI = 'wiki',
  CARD = 'card',
}

/**
 * 知识条目
 */
export interface KnowledgeEntry {
  /** 条目类型 */
  type: KnowledgeEntryType

  /** 标题 */
  title: string

  /** 内容 */
  content: string

  /** 文件路径（相对于 vault） */
  path: string

  /** 元数据 */
  metadata?: {
    /** 标签 */
    tags?: string[]

    /** WikiLinks */
    links?: string[]

    /** 创建时间 */
    created?: Date

    /** 修改时间 */
    modified?: Date

    /** 其他元数据 */
    [key: string]: unknown
  }
}

/**
 * 知识查询
 */
export interface KnowledgeQuery {
  /** 概念列表 */
  concepts?: string[]

  /** Wiki 页面路径列表 */
  wikiPages?: string[]

  /** 最大返回数量 */
  maxItems?: number

  /** 搜索关键词 */
  keywords?: string[]

  /** 标签过滤 */
  tags?: string[]
}

/**
 * 知识检索结果
 */
export interface KnowledgeResult {
  /** 匹配的条目 */
  entries: KnowledgeEntry[]

  /** 总数量 */
  totalCount: number

  /** 查询耗时（毫秒） */
  queryTime: number

  /** 匹配的查询 */
  matchedQuery?: Partial<KnowledgeQuery>
}

/**
 * 索引统计
 */
export interface IndexStats {
  /** 总文件数 */
  totalFiles: number

  /** 索引的条目数 */
  totalEntries: number

  /** 索引大小（字节） */
  indexSize: number

  /** 最后更新时间 */
  lastUpdated: Date

  /** 索引耗时（毫秒） */
  indexTime: number
}

/**
 * WikiLink 解析结果
 */
export interface WikiLink {
  /** 链接文本 */
  text: string

  /** 目标路径 */
  target: string

  /** 是否为外部链接 */
  external: boolean

  /** 在文件中的位置 */
  position: {
    line: number
    column: number
  }
}

/**
 * Tag 解析结果
 */
export interface Tag {
  /** 标签文本 */
  text: string

  /** 嵌套层级 */
  nesting: number

  /** 在文件中的位置 */
  position: {
    line: number
    column: number
  }
}
