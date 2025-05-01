/**
 * YunPat 知识库适配器（增强版）
 *
 * 功能：
 * 1. 概念层次结构解析
 * 2. 双向链接遍历（forward links + back links）
 * 3. 概念索引（概念 → 页面映射）
 * 4. Wiki 页面内容获取
 */

import { readFile, readdir } from 'fs/promises'
import { join } from 'path'

export interface YunPatConcept {
  name: string
  level: number // 1, 2, 3
  parent?: string // 父概念
  children: string[] // 子概念
  relatedPages: string[] // 相关 Wiki 页面
  definition?: string // 概念定义
}

export interface WikiPage {
  path: string
  title: string
  content: string
  links: string[] // 正向链接
  backlinks: string[] // 反向链接
}

export interface YunPatWikiCard {
  question: string
  quality: number
  content: string
  relatedConcepts: string[]
  timestamp: string
}

/**
 * YunPat 适配器（增强版）
 */
export class YunPatAdapter {
  private knowledgeBasePath: string
  private conceptHierarchy: Map<string, YunPatConcept> = new Map()
  private conceptIndex: Map<string, string[]> = new Map() // 概念 -> 相关页面
  private forwardLinkIndex: Map<string, string[]> = new Map() // 页面 -> 正向链接
  private backlinkIndex: Map<string, string[]> = new Map() // 页面 -> 反向链接
  private pageContentCache: Map<string, string> = new Map()

  constructor(knowledgeBasePath?: string) {
    this.knowledgeBasePath =
      knowledgeBasePath ||
      process.env.KNOWLEDGE_BASE_PATH ||
      '/Users/xujian/projects/YunPat/knowledge-base'
  }

  /**
   * 初始化：解析知识库
   */
  async initialize(): Promise<void> {
    console.log('[YunPat] 开始加载知识库...')

    // 1. 解析概念层次结构
    await this.parseConceptHierarchy()

    // 2. 解析概念索引
    await this.parseConceptIndex()

    // 3. 构建双向链接索引
    await this.buildBacklinkIndex()

    console.log(
      `[YunPat] ✅ 加载完成: ${this.conceptHierarchy.size} 个概念, ${this.backlinkIndex.size} 个页面`
    )
  }

  /**
   * 概念检索
   */
  async conceptSearch(
    query: string,
    topK: number = 5
  ): Promise<Array<{ concept: YunPatConcept; score: number }>> {
    const results: Array<{ concept: YunPatConcept; score: number }> = []

    for (const [name, concept] of this.conceptHierarchy) {
      const score = this.computeRelevance(query, concept)
      if (score > 0) {
        results.push({ concept, score })
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, topK)
  }

  /**
   * 获取正向链接（页面链接到哪里）
   */
  getForwardLinks(pagePath: string): string[] {
    return this.forwardLinkIndex.get(pagePath) || []
  }

  /**
   * 获取反向链接（哪些页面链接到这里）
   */
  getBacklinks(pagePath: string): string[] {
    return this.backlinkIndex.get(pagePath) || []
  }

  /**
   * 获取连接的页面（双向遍历）
   *
   * @param startPage - 起始页面
   * @param options - 遍历选项
   * @returns Map<页面路径, 距离>
   */
  async getConnectedPages(
    startPage: string,
    options: {
      depth?: number // 遍历深度（默认 2）
      direction?: 'both' | 'forward' | 'back' // 遍历方向
    } = {}
  ): Promise<Map<string, number>> {
    const { depth = 2, direction = 'both' } = options
    const connected = new Map<string, number>()
    const visited = new Set<string>()
    const queue: Array<{ page: string; distance: number }> = [{ page: startPage, distance: 0 }]

    while (queue.length > 0) {
      const { page, distance } = queue.shift()!

      if (distance > depth) continue
      if (visited.has(page)) continue

      visited.add(page)
      connected.set(page, distance)

      // 获取正向链接
      if (direction !== 'back') {
        const forwards = this.getForwardLinks(page)
        for (const link of forwards) {
          if (!visited.has(link)) {
            queue.push({ page: link, distance: distance + 1 })
          }
        }
      }

      // 获取反向链接
      if (direction !== 'forward') {
        const backlinks = this.getBacklinks(page)
        for (const link of backlinks) {
          if (!visited.has(link)) {
            queue.push({ page: link, distance: distance + 1 })
          }
        }
      }
    }

    return connected
  }

  /**
   * 查找最短路径（BFS）
   *
   * @param from - 起始页面
   * @param to - 目标页面
   * @returns 路径数组，如果不存在路径则返回空数组
   */
  findShortestPath(from: string, to: string): string[] {
    const visited = new Set<string>()
    const queue: Array<{ page: string; path: string[] }> = [{ page: from, path: [from] }]

    while (queue.length > 0) {
      const { page, path } = queue.shift()!

      if (page === to) {
        return path
      }

      if (visited.has(page)) continue
      visited.add(page)

      // 获取双向链接
      const forwards = this.getForwardLinks(page)
      const backlinks = this.getBacklinks(page)
      const neighbors = [...new Set([...forwards, ...backlinks])]

      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          queue.push({
            page: neighbor,
            path: [...path, neighbor],
          })
        }
      }
    }

    return []
  }

  /**
   * 获取页面内容
   *
   * @param pagePath - 页面路径
   * @returns 页面内容，如果不存在则返回 null
   */
  async getPageContent(pagePath: string): Promise<string | null> {
    // 检查缓存
    if (this.pageContentCache.has(pagePath)) {
      return this.pageContentCache.get(pagePath)!
    }

    try {
      const fullPath = join(this.knowledgeBasePath, `${pagePath}.md`)
      const content = await readFile(fullPath, 'utf-8')

      // 缓存内容
      this.pageContentCache.set(pagePath, content)

      return content
    } catch (err) {
      console.warn(`[YunPat] 页面不存在: ${pagePath}`)
      return null
    }
  }

  /**
   * 获取概念定义
   */
  async getConceptDefinition(concept: string): Promise<string> {
    // 1. 查找相关页面
    const pages = this.conceptIndex.get(concept) || []
    if (pages.length > 0) {
      const content = await this.getPageContent(pages[0])
      if (content) {
        // 提取第一段作为定义
        const firstParagraph = content.split('\n\n')[0]
        return firstParagraph.replace(/^#\s+.+\n/, '') // 移除标题
      }
    }

    return ''
  }

  /**
   * 层次关系推理
   */
  async inferHierarchy(concept1: string, concept2: string): Promise<string> {
    const info1 = this.conceptHierarchy.get(concept1)
    const info2 = this.conceptHierarchy.get(concept2)

    if (!info1 || !info2) {
      return '未知关系（概念不在知识库中）'
    }

    // 父子关系
    if (info1.parent === concept2) return `${concept1} 是 ${concept2} 的子概念`
    if (info2.parent === concept1) return `${concept2} 是 ${concept1} 的子概念`

    // 兄弟关系
    if (info1.parent === info2.parent) return `兄弟概念（同属 ${info1.parent}）`

    // 祖先关系
    if (this.isAncestor(concept1, concept2)) return `${concept1} 是 ${concept2} 的祖先概念`
    if (this.isAncestor(concept2, concept1)) return `${concept2} 是 ${concept1} 的祖先概念`

    // 同页面共现
    const pages1 = this.conceptIndex.get(concept1) || []
    const pages2 = this.conceptIndex.get(concept2) || []
    const commonPages = pages1.filter((p) => pages2.includes(p))

    if (commonPages.length > 0) {
      return `相关概念（共同出现在 ${commonPages.length} 个页面中）`
    }

    return '无直接关系'
  }

  /**
   * 解析概念层次结构
   */
  private async parseConceptHierarchy(): Promise<void> {
    const hierarchyPath = join(this.knowledgeBasePath, 'Concept-Hierarchy.md')
    const content = await readFile(hierarchyPath, 'utf-8')

    const lines = content.split('\n')
    let currentLevel1 = ''
    let currentLevel2 = ''

    for (const line of lines) {
      // 一级概念
      const l1Match = line.match(/^### (\d+)\. (.+)/)
      if (l1Match) {
        currentLevel1 = l1Match[2]
        this.conceptHierarchy.set(currentLevel1, {
          name: currentLevel1,
          level: 1,
          children: [],
          relatedPages: [],
        })
        continue
      }

      // 二级概念
      const l2Match = line.match(/#### (.+)/)
      if (l2Match) {
        currentLevel2 = l2Match[1]
        this.conceptHierarchy.set(currentLevel2, {
          name: currentLevel2,
          level: 2,
          parent: currentLevel1,
          children: [],
          relatedPages: [],
        })

        // 更新父概念的子节点列表
        const parent = this.conceptHierarchy.get(currentLevel1)
        if (parent) {
          parent.children.push(currentLevel2)
        }
        continue
      }

      // 三级概念（列表项）
      const l3Match = line.match(/^- (.+)/)
      if (l3Match && currentLevel2) {
        const l3Concept = l3Match[1]
        this.conceptHierarchy.set(l3Concept, {
          name: l3Concept,
          level: 3,
          parent: currentLevel2,
          children: [],
          relatedPages: [],
        })

        // 更新父概念的子节点列表
        const parent = this.conceptHierarchy.get(currentLevel2)
        if (parent) {
          parent.children.push(l3Concept)
        }
      }
    }
  }

  /**
   * 解析概念索引
   */
  private async parseConceptIndex(): Promise<void> {
    const indexPath = join(this.knowledgeBasePath, 'Concept-Index.md')
    const content = await readFile(indexPath, 'utf-8')

    const lines = content.split('\n')
    let currentConcept = ''

    for (const line of lines) {
      const conceptMatch = line.match(/^### (.+)/)
      if (conceptMatch) {
        currentConcept = conceptMatch[1]
        this.conceptIndex.set(currentConcept, [])
        continue
      }

      const pageMatch = line.match(/- \[\[([^\]]+)\]\]/)
      if (pageMatch && currentConcept) {
        const pages = this.conceptIndex.get(currentConcept) || []
        pages.push(pageMatch[1])
        this.conceptIndex.set(currentConcept, pages)
      }
    }
  }

  /**
   * 构建反向链接索引
   */
  private async buildBacklinkIndex(): Promise<void> {
    // 扫描所有 Markdown 文件
    const files = await this.scanMarkdownFiles(this.knowledgeBasePath)

    for (const file of files) {
      try {
        const fullPath = join(this.knowledgeBasePath, file)
        const content = await readFile(fullPath, 'utf-8')

        // 提取所有 Wiki 链接
        const links = content.match(/\[\[([^\]]+)\]\]/g) || []
        const pagePath = file.replace('.md', '')

        // 构建正向链接索引
        this.forwardLinkIndex.set(
          pagePath,
          links.map((l) => l.replace(/[\[\]]/g, ''))
        )

        // 构建反向链接索引
        for (const link of links) {
          const linkedPage = link.replace(/[\[\]]/g, '')
          if (!this.backlinkIndex.has(linkedPage)) {
            this.backlinkIndex.set(linkedPage, [])
          }
          this.backlinkIndex.get(linkedPage)!.push(pagePath)
        }
      } catch (err) {
        // 忽略读取错误的文件
      }
    }
  }

  /**
   * 扫描所有 Markdown 文件
   */
  private async scanMarkdownFiles(dir: string, baseDir: string = dir): Promise<string[]> {
    const files: string[] = []

    try {
      const entries = await readdir(dir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = join(dir, entry.name)

        if (entry.isDirectory()) {
          // 递归扫描子目录
          const subFiles = await this.scanMarkdownFiles(fullPath, baseDir)
          files.push(...subFiles)
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          // 计算相对路径
          const relativePath = fullPath.substring(baseDir.length + 1)
          files.push(relativePath)
        }
      }
    } catch (err) {
      // 忽略无法读取的目录
    }

    return files
  }

  /**
   * 计算相关性
   */
  private computeRelevance(query: string, concept: YunPatConcept): number {
    const queryLower = query.toLowerCase()
    const conceptLower = concept.name.toLowerCase()

    // 完全匹配
    if (conceptLower.includes(queryLower) || queryLower.includes(conceptLower)) {
      return 1.0
    }

    // 部分匹配
    const queryWords = queryLower.split(/\s+/)
    const conceptWords = conceptLower.split(/\s+/)
    const intersection = queryWords.filter((w) => conceptWords.includes(w))

    if (intersection.length > 0) {
      return intersection.length / queryWords.length
    }

    return 0
  }

  /**
   * 判断是否为祖先概念
   */
  private isAncestor(ancestor: string, descendant: string): boolean {
    let current = this.conceptHierarchy.get(descendant)
    while (current?.parent) {
      if (current.parent === ancestor) return true
      current = this.conceptHierarchy.get(current.parent)
    }
    return false
  }

  /**
   * 获取统计信息
   */
  getStats() {
    const levelCounts: Record<number, number> = {}

    for (const concept of this.conceptHierarchy.values()) {
      levelCounts[concept.level] = (levelCounts[concept.level] || 0) + 1
    }

    return {
      totalConcepts: this.conceptHierarchy.size,
      levelDistribution: levelCounts,
      totalWikiCards: this.conceptIndex.size,
      totalPages: this.backlinkIndex.size,
      totalLinks: this.forwardLinkIndex.size,
    }
  }
}
