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
import { promises as fs } from 'fs'
import * as path from 'path'
/**
 * 知识条目类型
 */
export var KnowledgeEntryType
;(function (KnowledgeEntryType) {
  /** 文档 - 说明性内容 */
  KnowledgeEntryType['DOCUMENT'] = 'document'
  /** 示例 - 代码或用法示例 */
  KnowledgeEntryType['EXAMPLE'] = 'example'
  /** 最佳实践 - 推荐做法 */
  KnowledgeEntryType['BEST_PRACTICE'] = 'best_practice'
  /** 错误解决方案 - 问题与修复 */
  KnowledgeEntryType['ERROR_SOLUTION'] = 'error_solution'
  /** 领域知识 - 特定领域专业知识 */
  KnowledgeEntryType['DOMAIN_KNOWLEDGE'] = 'domain_knowledge'
  /** 模式 - 可复用的解决方案模式 */
  KnowledgeEntryType['PATTERN'] = 'pattern'
})(KnowledgeEntryType || (KnowledgeEntryType = {}))
/**
 * 知识库类
 *
 * 核心功能：
 * 1. 存储 - 添加、更新、删除知识条目
 * 2. 检索 - 关键词、语义、混合搜索
 * 3. 注入 - 将相关知识注入到提示词中
 * 4. 持久化 - 保存和加载知识库
 */
export class KnowledgeBase {
  /** 知识条目存储（按 ID 索引） */
  entries = new Map()
  /** 标签索引（标签 -> 条目 ID 集合） */
  tagIndex = new Map()
  /** 类别索引（类别 -> 条目 ID 集合） */
  categoryIndex = new Map()
  /** 类型索引（类型 -> 条目 ID 集合） */
  typeIndex = new Map()
  /** 配置 */
  config
  /**
   * 构造函数
   */
  constructor(config) {
    this.config = {
      name: config.name,
      description: config.description,
      storagePath:
        config.storagePath ??
        path.join(process.env.HOME ?? '', '.yunpat', 'knowledge', config.name),
      persistent: config.persistent ?? true,
      loadBuiltin: config.loadBuiltin ?? true,
      embedFn: config.embedFn,
      defaultSearchOptions: config.defaultSearchOptions ?? {
        mode: 'hybrid',
        limit: 5,
        minSimilarity: 0.7,
        keywordWeight: 0.5,
        semanticWeight: 0.5,
      },
    }
  }
  /**
   * 初始化知识库
   * - 加载持久化数据
   * - 加载内置知识库
   */
  async initialize() {
    // 创建存储目录
    if (this.config.persistent) {
      await fs.mkdir(path.dirname(this.config.storagePath), { recursive: true })
    }
    // 加载持久化数据
    if (this.config.persistent) {
      await this.load()
    }
    // 加载内置知识库
    if (this.config.loadBuiltin) {
      await this.loadBuiltinKnowledge()
    }
  }
  /**
   * 存储知识条目
   */
  async store(entry) {
    const now = new Date()
    const id = this.generateId(entry.title, entry.category)
    const newEntry = {
      ...entry,
      id,
      createdAt: now,
      updatedAt: now,
      version: 1,
      referenceCount: 0,
    }
    // 生成嵌入向量
    if (this.config.embedFn && !newEntry.embedding) {
      newEntry.embedding = await this.config.embedFn(`${newEntry.title}\n${newEntry.content}`)
    }
    // 存储条目
    this.entries.set(id, newEntry)
    // 更新索引
    this.updateIndexes(id, newEntry)
    // 持久化
    if (this.config.persistent) {
      await this.save()
    }
    return id
  }
  /**
   * 更新知识条目
   */
  async update(entryId, updates) {
    const existing = this.entries.get(entryId)
    if (!existing) {
      throw new Error(`知识条目不存在: ${entryId}`)
    }
    const updated = {
      ...existing,
      ...updates,
      id: entryId, // 确保 ID 不变
      createdAt: existing.createdAt, // 保持创建时间
      updatedAt: new Date(),
      version: existing.version + 1,
    }
    // 重新生成嵌入向量（如果内容变化）
    if (this.config.embedFn && (updates.title || updates.content)) {
      updated.embedding = await this.config.embedFn(`${updated.title}\n${updated.content}`)
    }
    this.entries.set(entryId, updated)
    // 更新索引（如果类别、标签或类型变化）
    if (updates.category || updates.tags || updates.type) {
      this.removeFromIndexes(entryId, existing)
      this.updateIndexes(entryId, updated)
    }
    if (this.config.persistent) {
      await this.save()
    }
  }
  /**
   * 获取知识条目
   */
  get(entryId) {
    return this.entries.get(entryId)
  }
  /**
   * 删除知识条目
   */
  async delete(entryId) {
    const entry = this.entries.get(entryId)
    if (!entry) {
      return false
    }
    this.entries.delete(entryId)
    this.removeFromIndexes(entryId, entry)
    if (this.config.persistent) {
      await this.save()
    }
    return true
  }
  /**
   * 搜索知识条目
   */
  async search(query, options = {}) {
    const opts = {
      mode: options.mode ?? this.config.defaultSearchOptions.mode ?? 'hybrid',
      limit: options.limit ?? this.config.defaultSearchOptions.limit ?? 5,
      minSimilarity: options.minSimilarity ?? this.config.defaultSearchOptions.minSimilarity ?? 0.7,
      categories: options.categories,
      types: options.types,
      tags: options.tags,
      keywordWeight: options.keywordWeight ?? this.config.defaultSearchOptions.keywordWeight ?? 0.5,
      semanticWeight:
        options.semanticWeight ?? this.config.defaultSearchOptions.semanticWeight ?? 0.5,
    }
    // 获取候选条目（通过索引过滤）
    const candidates = this.getCandidates(opts)
    // 计算相关性分数
    const results = []
    for (const entry of candidates) {
      const result = await this.scoreEntry(entry, query, opts)
      if (result.score >= opts.minSimilarity) {
        results.push(result)
      }
    }
    // 按分数排序
    results.sort((a, b) => b.score - a.score)
    // 限制结果数量
    return results.slice(0, opts.limit)
  }
  /**
   * 增强提示词（注入相关知识）
   */
  async enhancePrompt(prompt, context) {
    // 提取提示词中的关键词
    const keywords = this.extractKeywords(prompt)
    // 搜索相关知识
    const searchResults = await this.search(keywords.join(' '), {
      mode: 'hybrid',
      limit: 10,
      tags: context?.metadata?.knowledgeTags,
    })
    // 去重并分类
    const injectedEntries = []
    const injectedCategories = new Set()
    for (const result of searchResults) {
      // 避免重复类别
      if (injectedCategories.has(result.entry.category)) {
        continue
      }
      injectedEntries.push(result.entry)
      injectedCategories.add(result.entry.category)
      // 增加引用计数
      result.entry.referenceCount++
    }
    // 构建增强后的提示词
    let enhancedPrompt = prompt
    if (injectedEntries.length > 0) {
      const knowledgeSection = this.formatKnowledge(injectedEntries)
      enhancedPrompt = `${knowledgeSection}\n\n## 用户任务\n\n${prompt}`
    }
    // 保存引用计数更新
    if (this.config.persistent && injectedEntries.length > 0) {
      await this.save()
    }
    return {
      enhancedPrompt,
      injectedEntries,
      injectedCategories: Array.from(injectedCategories),
    }
  }
  /**
   * 获取知识库统计
   */
  getStats() {
    const byType = {
      [KnowledgeEntryType.DOCUMENT]: 0,
      [KnowledgeEntryType.EXAMPLE]: 0,
      [KnowledgeEntryType.BEST_PRACTICE]: 0,
      [KnowledgeEntryType.ERROR_SOLUTION]: 0,
      [KnowledgeEntryType.DOMAIN_KNOWLEDGE]: 0,
      [KnowledgeEntryType.PATTERN]: 0,
    }
    const byCategory = {}
    let totalReferences = 0
    for (const entry of this.entries.values()) {
      byType[entry.type]++
      byCategory[entry.category] = (byCategory[entry.category] ?? 0) + 1
      totalReferences += entry.referenceCount
    }
    return {
      totalEntries: this.entries.size,
      byType,
      byCategory,
      totalReferences,
      averageReferences: this.entries.size > 0 ? totalReferences / this.entries.size : 0,
    }
  }
  /**
   * 列出所有条目
   */
  listAll() {
    return Array.from(this.entries.values())
  }
  /**
   * 按类别获取条目
   */
  getByCategory(category) {
    const ids = this.categoryIndex.get(category)
    if (!ids) {
      return []
    }
    return Array.from(ids)
      .map((id) => this.entries.get(id))
      .filter((entry) => entry !== undefined)
  }
  /**
   * 按标签获取条目
   */
  getByTag(tag) {
    const ids = this.tagIndex.get(tag)
    if (!ids) {
      return []
    }
    return Array.from(ids)
      .map((id) => this.entries.get(id))
      .filter((entry) => entry !== undefined)
  }
  /**
   * 清空知识库
   */
  async clear() {
    this.entries.clear()
    this.tagIndex.clear()
    this.categoryIndex.clear()
    this.typeIndex.clear()
    if (this.config.persistent) {
      await this.save()
    }
  }
  /**
   * 保存到磁盘
   */
  async save() {
    if (!this.config.persistent) {
      return
    }
    const data = {
      version: 1,
      name: this.config.name,
      description: this.config.description,
      entries: Array.from(this.entries.values()),
      savedAt: new Date().toISOString(),
    }
    await fs.writeFile(this.config.storagePath, JSON.stringify(data, null, 2), 'utf-8')
  }
  /**
   * 从磁盘加载
   */
  async load() {
    try {
      const content = await fs.readFile(this.config.storagePath, 'utf-8')
      const data = JSON.parse(content)
      // 重建索引
      for (const entry of data.entries) {
        // 确保 Date 对象正确反序列化
        entry.createdAt = new Date(entry.createdAt)
        entry.updatedAt = new Date(entry.updatedAt)
        this.entries.set(entry.id, entry)
        this.updateIndexes(entry.id, entry)
      }
    } catch (error) {
      // 文件不存在或解析错误，忽略
      // console.debug('未找到持久化数据，使用空知识库');
    }
  }
  /**
   * 生成条目 ID
   */
  generateId(title, category) {
    const normalized = `${category}:${title}`.toLowerCase().replace(/\s+/g, '-')
    const hash = this.simpleHash(normalized)
    return `${normalized}-${hash.slice(0, 8)}`
  }
  /**
   * 简单哈希函数
   */
  simpleHash(str) {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash
    }
    return Math.abs(hash).toString(36)
  }
  /**
   * 更新索引
   */
  updateIndexes(id, entry) {
    // 标签索引（确保tags存在且可迭代）
    const tags = entry.tags || []
    for (const tag of tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set())
      }
      this.tagIndex.get(tag).add(id)
    }
    // 类别索引
    if (!this.categoryIndex.has(entry.category)) {
      this.categoryIndex.set(entry.category, new Set())
    }
    this.categoryIndex.get(entry.category).add(id)
    // 类型索引
    if (!this.typeIndex.has(entry.type)) {
      this.typeIndex.set(entry.type, new Set())
    }
    this.typeIndex.get(entry.type).add(id)
  }
  /**
   * 从索引中移除
   */
  removeFromIndexes(id, entry) {
    // 标签索引
    for (const tag of entry.tags) {
      this.tagIndex.get(tag)?.delete(id)
    }
    // 类别索引
    this.categoryIndex.get(entry.category)?.delete(id)
    // 类型索引
    this.typeIndex.get(entry.type)?.delete(id)
  }
  /**
   * 获取候选条目（通过索引过滤）
   */
  getCandidates(options) {
    let candidateIds
    // 按类别过滤
    if (options.categories && options.categories.length > 0) {
      const categoryIds = options.categories.flatMap((cat) =>
        Array.from(this.categoryIndex.get(cat) ?? [])
      )
      candidateIds = candidateIds
        ? new Set([...candidateIds, ...categoryIds])
        : new Set(categoryIds)
    }
    // 按类型过滤
    if (options.types && options.types.length > 0) {
      const typeIds = options.types.flatMap((type) => Array.from(this.typeIndex.get(type) ?? []))
      candidateIds = candidateIds
        ? new Set([...candidateIds].filter((id) => typeIds.includes(id)))
        : new Set(typeIds)
    }
    // 按标签过滤
    if (options.tags && options.tags.length > 0) {
      const tagIds = options.tags.flatMap((tag) => Array.from(this.tagIndex.get(tag) ?? []))
      candidateIds = candidateIds
        ? new Set([...candidateIds].filter((id) => tagIds.includes(id)))
        : new Set(tagIds)
    }
    // 获取条目
    if (candidateIds) {
      return Array.from(candidateIds)
        .map((id) => this.entries.get(id))
        .filter((entry) => entry !== undefined)
    }
    return Array.from(this.entries.values())
  }
  /**
   * 为条目打分
   */
  async scoreEntry(entry, query, options) {
    const queryLower = query.toLowerCase()
    const keywords = queryLower.split(/\s+/)
    // 关键词匹配分数
    let keywordScore = 0
    const titleLower = entry.title.toLowerCase()
    const contentLower = entry.content.toLowerCase()
    const tagMatches = []
    // 标题匹配（权重更高）
    for (const keyword of keywords) {
      if (titleLower.includes(keyword)) {
        keywordScore += 0.3
      }
      if (contentLower.includes(keyword)) {
        keywordScore += 0.1
      }
    }
    // 标签匹配
    for (const tag of entry.tags) {
      if (queryLower.includes(tag.toLowerCase()) || tag.toLowerCase().includes(queryLower)) {
        keywordScore += 0.2
        tagMatches.push(tag)
      }
    }
    // 优先级加成
    keywordScore *= 1 + entry.priority * 0.1
    // 语义相似度分数
    let semanticScore = 0
    if (options.mode === 'semantic' || options.mode === 'hybrid') {
      if (this.config.embedFn && entry.embedding) {
        const queryEmbedding = await this.config.embedFn(query)
        semanticScore = this.cosineSimilarity(queryEmbedding, entry.embedding)
      } else {
        // 回退到简单的文本相似度
        semanticScore = this.textSimilarity(query, entry.title + ' ' + entry.content)
      }
    }
    // 混合分数
    let finalScore
    if (options.mode === 'keyword') {
      finalScore = Math.min(keywordScore, 1)
    } else if (options.mode === 'semantic') {
      finalScore = semanticScore
    } else {
      // 混合模式
      const kw = options.keywordWeight ?? 0.5
      const sw = options.semanticWeight ?? 0.5
      finalScore = (keywordScore * kw + semanticScore * sw) / (kw + sw)
    }
    return {
      entry,
      score: finalScore,
      matchReason: {
        keywordScore,
        semanticScore,
        tagMatches,
      },
    }
  }
  /**
   * 余弦相似度
   */
  cosineSimilarity(vecA, vecB) {
    if (vecA.length !== vecB.length) {
      return 0
    }
    let dotProduct = 0
    let normA = 0
    let normB = 0
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i]
      normA += vecA[i] * vecA[i]
      normB += vecB[i] * vecB[i]
    }
    const denominator = Math.sqrt(normA) * Math.sqrt(normB)
    return denominator === 0 ? 0 : dotProduct / denominator
  }
  /**
   * 文本相似度（简单的 Jaccard 相似度）
   */
  textSimilarity(text1, text2) {
    const words1 = new Set(text1.toLowerCase().split(/\s+/))
    const words2 = new Set(text2.toLowerCase().split(/\s+/))
    const intersection = new Set([...words1].filter((x) => words2.has(x)))
    const union = new Set([...words1, ...words2])
    return union.size === 0 ? 0 : intersection.size / union.size
  }
  /**
   * 提取关键词
   */
  extractKeywords(text) {
    // 移除常见的停用词
    const stopWords = new Set([
      '的',
      '是',
      '在',
      '和',
      '与',
      '或',
      '但',
      '而',
      '对',
      '把',
      '被',
      '让',
      '使',
      '为了',
      '如果',
      '那么',
      '这',
      '那',
      '这个',
      '那个',
      'the',
      'a',
      'an',
      'is',
      'are',
      'was',
      'were',
      'and',
      'or',
      'but',
      'if',
      'then',
      'this',
      'that',
    ])
    const words = text
      .toLowerCase()
      .split(/[\s,;.!?，；。！？]+/)
      .filter((word) => word.length > 1 && !stopWords.has(word))
    // 统计词频
    const frequency = new Map()
    for (const word of words) {
      frequency.set(word, (frequency.get(word) ?? 0) + 1)
    }
    // 返回前 10 个高频词
    return Array.from(frequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word)
  }
  /**
   * 格式化知识内容
   */
  formatKnowledge(entries) {
    const sections = ['## 相关知识\n']
    for (const entry of entries) {
      sections.push(`### ${entry.title}`)
      sections.push('')
      sections.push(entry.content)
      sections.push('')
      sections.push(`*类别: ${entry.category} | 标签: ${entry.tags.join(', ')}*`)
      sections.push('')
    }
    return sections.join('\n')
  }
  /**
   * 加载内置知识库
   */
  async loadBuiltinKnowledge() {
    // 写作最佳实践
    await this.loadWritingBestPractices()
    // 代码模式库
    await this.loadCodePatterns()
    // 领域知识
    await this.loadDomainKnowledge()
    // 错误解决方案
    await this.loadErrorSolutions()
  }
  /**
   * 加载写作最佳实践
   */
  async loadWritingBestPractices() {
    const practices = [
      {
        title: '技术文档结构',
        content: `技术文档应遵循清晰的结构：

1. **概述** - 简要说明文档目的和适用范围
2. **前置条件** - 列出阅读本文档需要了解的知识
3. **核心内容** - 主体内容，分章节组织
4. **示例** - 提供具体的使用示例
5. **常见问题** - 预期并解答常见疑问
6. **参考资料** - 相关文档和资源的链接

每个章节应有明确的标题和逻辑顺序。`,
        type: KnowledgeEntryType.BEST_PRACTICE,
        category: 'writing-best-practices',
        tags: ['文档', '结构', '技术写作'],
        priority: 1,
      },
      {
        title: '代码注释规范',
        content: `良好的代码注释应遵循以下原则：

1. **解释"为什么"而非"是什么"** - 代码本身说明了做了什么，注释解释为什么这样做
2. **保持更新** - 过时的注释比没有注释更糟糕
3. **使用文档注释** - 对公共 API 使用 JSDoc/TSDoc 风格的注释
4. **避免显而易见的注释** - 如 \`i++ // i 加 1\` 这种注释毫无价值
5. **标注复杂逻辑** - 对于算法或复杂逻辑，添加简要说明

示例：
\`\`\`typescript
// 使用双指针法避免额外的空间复杂度 O(n)
function findPair(arr: number[], target: number): number[] | null {
  // ...
}
\`\`\``,
        type: KnowledgeEntryType.BEST_PRACTICE,
        category: 'writing-best-practices',
        tags: ['代码', '注释', '规范'],
        priority: 1,
      },
      {
        title: '错误消息编写',
        content: `编写有用的错误消息：

1. **说明问题** - 清楚地说明发生了什么
2. **提供上下文** - 包含相关的操作或状态信息
3. **给出建议** - 告诉用户如何解决问题
4. **使用合适的语气** - 友好但专业

好的错误消息示例：
- ❌ "错误 404"
- ✅ "找不到文件 '/path/to/file'。请检查文件路径是否正确。"

❌ "无效输入"
✅ "年龄必须是正整数，收到: -5"`,
        type: KnowledgeEntryType.BEST_PRACTICE,
        category: 'writing-best-practices',
        tags: ['错误', '用户体验', '消息'],
        priority: 1,
      },
    ]
    for (const practice of practices) {
      await this.store(practice)
    }
  }
  /**
   * 加载代码模式库
   */
  async loadCodePatterns() {
    const patterns = [
      {
        title: '单例模式',
        content: `单例模式确保一个类只有一个实例，并提供全局访问点。

\`\`\`typescript
class Singleton {
  private static instance: Singleton;
  private constructor() {}

  static getInstance(): Singleton {
    if (!Singleton.instance) {
      Singleton.instance = new Singleton();
    }
    return Singleton.instance;
  }
}
\`\`\`

**适用场景**：
- 配置管理器
- 数据库连接池
- 日志记录器`,
        type: KnowledgeEntryType.PATTERN,
        category: 'code-patterns',
        tags: ['设计模式', 'TypeScript', '单例'],
        priority: 1,
      },
      {
        title: '工厂模式',
        content: `工厂模式提供创建对象的接口，由子类决定实例化哪个类。

\`\`\`typescript
interface Product {
  operation(): string;
}

class ConcreteProductA implements Product {
  operation(): string {
    return 'Product A';
  }
}

class Factory {
  createProduct(type: 'A' | 'B'): Product {
    switch (type) {
      case 'A': return new ConcreteProductA();
      case 'B': return new ConcreteProductB();
    }
  }
}
\`\`\``,
        type: KnowledgeEntryType.PATTERN,
        category: 'code-patterns',
        tags: ['设计模式', '工厂', '创建'],
        priority: 1,
      },
      {
        title: '观察者模式',
        content: `观察者模式定义对象间的一对多依赖关系，当一个对象状态改变时，所有依赖者都会收到通知。

\`\`\`typescript
interface Observer {
  update(data: unknown): void;
}

class Subject {
  private observers: Observer[] = [];

  subscribe(observer: Observer): void {
    this.observers.push(observer);
  }

  notify(data: unknown): void {
    this.observers.forEach(obs => obs.update(data));
  }
}
\`\`\`

**适用场景**：
- 事件处理系统
- 发布-订阅系统
- 模型-视图架构`,
        type: KnowledgeEntryType.PATTERN,
        category: 'code-patterns',
        tags: ['设计模式', '观察者', '事件'],
        priority: 1,
      },
    ]
    for (const pattern of patterns) {
      await this.store(pattern)
    }
  }
  /**
   * 加载领域知识
   */
  async loadDomainKnowledge() {
    const knowledge = [
      {
        title: 'TypeScript 类型系统',
        content: `TypeScript 的类型系统核心概念：

1. **基本类型** - string, number, boolean, null, undefined, symbol, bigint
2. **对象类型** - interface, type, class
3. **联合类型** - \`string | number\`
4. **交叉类型** - \`A & B\`
5. **泛型** - \`function identity<T>(arg: T): T\`
6. **类型推断** - 自动推断变量类型
7. **类型守卫** - 运行时类型检查
8. **映射类型** - \`Partial<T>\`, \`Required<T>\`, \`Readonly<T>\`

**高级特性**：
- 条件类型: \`T extends U ? X : Y\`
- 模板字面量类型: \`\`prefix\${T}\`\`
- 递归类型: JSON Schema 示例`,
        type: KnowledgeEntryType.DOMAIN_KNOWLEDGE,
        category: 'domain-knowledge',
        tags: ['TypeScript', '类型', '语言'],
        priority: 1,
      },
      {
        title: '异步编程模式',
        content: `JavaScript/TypeScript 异步编程模式：

1. **Promise** - 表示异步操作的最终结果
2. **async/await** - 同步风格的异步代码
3. **Promise.all** - 并行执行多个异步操作
4. **Promise.race** - 返回最先完成的结果
5. **Promise.allSettled** - 等待所有操作完成
6. **Promise.any** - 返回第一个成功的结果

**最佳实践**：
- 总是处理错误 (try/catch)
- 避免回调地狱
- 使用 Promise 链而非嵌套
- 考虑使用 AbortController 取消长时间运行的请求`,
        type: KnowledgeEntryType.DOMAIN_KNOWLEDGE,
        category: 'domain-knowledge',
        tags: ['JavaScript', '异步', 'Promise'],
        priority: 1,
      },
      {
        title: 'RESTful API 设计原则',
        content: `RESTful API 设计最佳实践：

1. **使用名词而非动词** - \`/users\` 而非 \`/getUsers\`
2. **使用 HTTP 方法** - GET, POST, PUT, DELETE, PATCH
3. **使用复数形式** - \`/users\` 而非 \`/user\`
4. **版本控制** - \`/api/v1/users\`
5. **过滤和排序** - 查询参数 \`?sort=name&order=asc\`
6. **分页** - \`?page=1&limit=20\`
7. **状态码** - 正确使用 HTTP 状态码
8. **HATEOAS** - 在响应中包含相关资源的链接

**常见状态码**：
- 200 OK - 成功
- 201 Created - 创建成功
- 400 Bad Request - 客户端错误
- 401 Unauthorized - 未认证
- 403 Forbidden - 无权限
- 404 Not Found - 资源不存在
- 500 Internal Server Error - 服务器错误`,
        type: KnowledgeEntryType.DOMAIN_KNOWLEDGE,
        category: 'domain-knowledge',
        tags: ['API', 'REST', '设计'],
        priority: 1,
      },
    ]
    for (const item of knowledge) {
      await this.store(item)
    }
  }
  /**
   * 加载错误解决方案
   */
  async loadErrorSolutions() {
    const solutions = [
      {
        title: 'Cannot find module',
        content: `**错误**: Cannot find module 'xxx'

**原因**:
1. 依赖未安装
2. 路径错误
3. TypeScript 配置问题

**解决方案**:
\`\`\`bash
# 安装缺失的依赖
npm install <package-name>
# 或
pnpm install <package-name>

# 对于开发依赖
npm install -D <package-name>
\`\`\`

**TypeScript 特定**:
- 检查 \`tsconfig.json\` 中的 \`baseUrl\` 和 \`paths\`
- 确保类型声明已安装: \`@types/<package-name>\``,
        type: KnowledgeEntryType.ERROR_SOLUTION,
        category: 'error-solutions',
        tags: ['错误', '模块', '依赖'],
        priority: 1,
      },
      {
        title: 'CORS 错误',
        content: `**错误**: Access to fetch at 'xxx' has been blocked by CORS policy

**原因**: 浏览器同源策略阻止跨域请求

**解决方案**:

**服务端** (Node.js/Express):
\`\`\`typescript
app.use(cors({
  origin: ['http://localhost:3000'], // 允许的源
  credentials: true, // 允许携带 cookie
}));
\`\`\`

**客户端** (开发环境代理):
\`\`\`javascript
// vite.config.js
export default {
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
};
\`\`\``,
        type: KnowledgeEntryType.ERROR_SOLUTION,
        category: 'error-solutions',
        tags: ['错误', 'CORS', '网络'],
        priority: 1,
      },
      {
        title: 'React useEffect 依赖警告',
        content: `**警告**: React Hook useEffect has a missing dependency: 'xxx'

**原因**: useEffect 依赖数组中缺少使用的变量

**解决方案**:

**推荐做法** - 将依赖项加入数组:
\`\`\`typescript
useEffect(() => {
  const handler = () => {
    console.log(value);
  };
  window.addEventListener('click', handler);
  return () => window.removeEventListener('click', handler);
}, [value]); // 包含 value 依赖
\`\`\`

**特殊情况** - 故意忽略依赖:
\`\`\`typescript
// eslint-disable-next-line react-hooks/exhaustive-deps
useEffect(() => {
  // 代码逻辑
}, []); // 空依赖数组
\`\`\`

**更好的做法** - 使用 useCallback:
\`\`\`typescript
const callback = useCallback(() => {
  doSomething(value);
}, [value]);

useEffect(() => {
  callback();
}, [callback]);
\`\`\``,
        type: KnowledgeEntryType.ERROR_SOLUTION,
        category: 'error-solutions',
        tags: ['错误', 'React', 'Hook'],
        priority: 1,
      },
    ]
    for (const solution of solutions) {
      await this.store(solution)
    }
  }
}
/**
 * 创建知识库实例
 */
export function createKnowledgeBase(config) {
  return new KnowledgeBase(config)
}
/**
 * 预定义的知识库名称
 */
export const BUILTIN_KNOWLEDGE_BASES = {
  WRITING_BEST_PRACTICES: 'writing-best-practices',
  CODE_PATTERNS: 'code-patterns',
  DOMAIN_KNOWLEDGE: 'domain-knowledge',
  ERROR_SOLUTIONS: 'error-solutions',
}
//# sourceMappingURL=KnowledgeBase.js.map
