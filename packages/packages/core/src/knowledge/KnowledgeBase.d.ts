/**
 * 知识库系统
 *
 * 核心功能：
 * 1. 知识存储 - 文档、示例、最佳实践
 * 2. 语义检索 - 关键词、向量、混合搜索
 * 3. 知识注入 - 动态上下文增强
 * 4. 知识更新 - 增量学习、版本管理
 *
 * 设计理念：
 * - 框架笨：知识库是通用存储和检索机制
 * - 智能体专：各智能体维护自己的领域知识
 * - 可扩展：支持用户自定义知识库
 */
import { ExecutionContext } from '../lifecycle/Lifecycle.js'
/**
 * 知识条目类型
 */
export declare enum KnowledgeEntryType {
  /** 文档 - 说明性内容 */
  DOCUMENT = 'document',
  /** 示例 - 代码或用法示例 */
  EXAMPLE = 'example',
  /** 最佳实践 - 推荐做法 */
  BEST_PRACTICE = 'best_practice',
  /** 错误解决方案 - 问题与修复 */
  ERROR_SOLUTION = 'error_solution',
  /** 领域知识 - 特定领域专业知识 */
  DOMAIN_KNOWLEDGE = 'domain_knowledge',
  /** 模式 - 可复用的解决方案模式 */
  PATTERN = 'pattern',
}
/**
 * 知识条目
 */
export interface KnowledgeEntry {
  /** 唯一标识符 */
  id: string
  /** 知识类型 */
  type: KnowledgeEntryType
  /** 标题 */
  title: string
  /** 内容 */
  content: string
  /** 标签（用于检索） */
  tags: string[]
  /** 类别/命名空间 */
  category: string
  /** 优先级/权重（用于排序） */
  priority: number
  /** 创建时间 */
  createdAt: Date
  /** 更新时间 */
  updatedAt: Date
  /** 版本号 */
  version: number
  /** 元数据 */
  metadata?: Record<string, unknown>
  /** 嵌入向量（用于语义搜索） */
  embedding?: number[]
  /** 引用计数（用于评估知识价值） */
  referenceCount: number
}
/**
 * 搜索选项
 */
export interface SearchOptions {
  /** 搜索模式 */
  mode: 'keyword' | 'semantic' | 'hybrid'
  /** 最大结果数 */
  limit?: number
  /** 最低相似度阈值（语义搜索） */
  minSimilarity?: number
  /** 类别过滤 */
  categories?: string[]
  /** 类型过滤 */
  types?: KnowledgeEntryType[]
  /** 标签过滤 */
  tags?: string[]
  /** 混合搜索中关键词的权重 */
  keywordWeight?: number
  /** 混合搜索中语义的权重 */
  semanticWeight?: number
}
/**
 * 搜索结果
 */
export interface SearchResult {
  /** 知识条目 */
  entry: KnowledgeEntry
  /** 相关性分数 */
  score: number
  /** 匹配原因（用于调试） */
  matchReason: {
    keywordScore: number
    semanticScore: number
    tagMatches: string[]
  }
}
/**
 * 知识注入结果
 */
export interface KnowledgeInjectionResult {
  /** 增强后的提示词 */
  enhancedPrompt: string
  /** 注入的知识条目 */
  injectedEntries: KnowledgeEntry[]
  /** 注入的类别 */
  injectedCategories: string[]
}
/**
 * 知识库统计
 */
export interface KnowledgeStats {
  /** 总条目数 */
  totalEntries: number
  /** 按类型分组的统计 */
  byType: Record<KnowledgeEntryType, number>
  /** 按类别分组的统计 */
  byCategory: Record<string, number>
  /** 总引用次数 */
  totalReferences: number
  /** 平均引用次数 */
  averageReferences: number
}
/**
 * 知识库配置
 */
export interface KnowledgeBaseConfig {
  /** 知识库标识符 */
  name: string
  /** 描述 */
  description?: string
  /** 持久化路径 */
  storagePath?: string
  /** 是否启用持久化 */
  persistent?: boolean
  /** 自动加载内置知识库 */
  loadBuiltin?: boolean
  /** 嵌入函数（用于语义搜索） */
  embedFn?: (text: string) => Promise<number[]>
  /** 默认搜索选项 */
  defaultSearchOptions?: Partial<SearchOptions>
}
/**
 * 知识库类
 *
 * 核心功能：
 * 1. 存储 - 添加、更新、删除知识条目
 * 2. 检索 - 关键词、语义、混合搜索
 * 3. 注入 - 将相关知识注入到提示词中
 * 4. 持久化 - 保存和加载知识库
 */
export declare class KnowledgeBase {
  /** 知识条目存储（按 ID 索引） */
  private entries
  /** 标签索引（标签 -> 条目 ID 集合） */
  private tagIndex
  /** 类别索引（类别 -> 条目 ID 集合） */
  private categoryIndex
  /** 类型索引（类型 -> 条目 ID 集合） */
  private typeIndex
  /** 配置 */
  private config
  /**
   * 构造函数
   */
  constructor(config: KnowledgeBaseConfig)
  /**
   * 初始化知识库
   * - 加载持久化数据
   * - 加载内置知识库
   */
  initialize(): Promise<void>
  /**
   * 存储知识条目
   */
  store(
    entry: Omit<KnowledgeEntry, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'referenceCount'>
  ): Promise<string>
  /**
   * 更新知识条目
   */
  update(entryId: string, updates: Partial<Omit<KnowledgeEntry, 'id' | 'createdAt'>>): Promise<void>
  /**
   * 获取知识条目
   */
  get(entryId: string): KnowledgeEntry | undefined
  /**
   * 删除知识条目
   */
  delete(entryId: string): Promise<boolean>
  /**
   * 搜索知识条目
   */
  search(query: string, options?: Partial<SearchOptions>): Promise<SearchResult[]>
  /**
   * 增强提示词（注入相关知识）
   */
  enhancePrompt(prompt: string, context?: ExecutionContext): Promise<KnowledgeInjectionResult>
  /**
   * 获取知识库统计
   */
  getStats(): KnowledgeStats
  /**
   * 列出所有条目
   */
  listAll(): KnowledgeEntry[]
  /**
   * 按类别获取条目
   */
  getByCategory(category: string): KnowledgeEntry[]
  /**
   * 按标签获取条目
   */
  getByTag(tag: string): KnowledgeEntry[]
  /**
   * 清空知识库
   */
  clear(): Promise<void>
  /**
   * 保存到磁盘
   */
  private save
  /**
   * 从磁盘加载
   */
  private load
  /**
   * 生成条目 ID
   */
  private generateId
  /**
   * 简单哈希函数
   */
  private simpleHash
  /**
   * 更新索引
   */
  private updateIndexes
  /**
   * 从索引中移除
   */
  private removeFromIndexes
  /**
   * 获取候选条目（通过索引过滤）
   */
  private getCandidates
  /**
   * 为条目打分
   */
  private scoreEntry
  /**
   * 余弦相似度
   */
  private cosineSimilarity
  /**
   * 文本相似度（简单的 Jaccard 相似度）
   */
  private textSimilarity
  /**
   * 提取关键词
   */
  private extractKeywords
  /**
   * 格式化知识内容
   */
  private formatKnowledge
  /**
   * 加载内置知识库
   */
  private loadBuiltinKnowledge
  /**
   * 加载写作最佳实践
   */
  private loadWritingBestPractices
  /**
   * 加载代码模式库
   */
  private loadCodePatterns
  /**
   * 加载领域知识
   */
  private loadDomainKnowledge
  /**
   * 加载错误解决方案
   */
  private loadErrorSolutions
}
/**
 * 创建知识库实例
 */
export declare function createKnowledgeBase(config: KnowledgeBaseConfig): KnowledgeBase
/**
 * 预定义的知识库名称
 */
export declare const BUILTIN_KNOWLEDGE_BASES: {
  readonly WRITING_BEST_PRACTICES: 'writing-best-practices'
  readonly CODE_PATTERNS: 'code-patterns'
  readonly DOMAIN_KNOWLEDGE: 'domain-knowledge'
  readonly ERROR_SOLUTIONS: 'error-solutions'
}
//# sourceMappingURL=KnowledgeBase.d.ts.map
