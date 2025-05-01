/**
 * YunPat 知识库适配器
 *
 * 加载和使用 Obsidian Markdown 格式的专利知识库
 */

import { readFile, readdir } from 'fs/promises'
import { join } from 'path'
import { ObsidianKnowledgeBridge } from '@yunpat/patent-knowledge'

export interface YunPatConcept {
  name: string
  level: number // 1, 2, 3
  parent?: string // 父概念
  children: string[] // 子概念
  relatedPages: string[] // 相关 Wiki 页面
  definition?: string // 概念定义
}

export interface YunPatWikiCard {
  question: string
  quality: number
  content: string
  relatedConcepts: string[]
  timestamp: string
}

/**
 * YunPat 适配器
 *
 * 功能：
 * 1. 解析概念层次结构
 * 2. 查询 Wiki 卡片
 * 3. 概念关系推理
 */
export class YunPatAdapter {
  private knowledgeBasePath: string
  private bridge: ObsidianKnowledgeBridge
  private conceptHierarchy: Map<string, YunPatConcept> = new Map()
  private conceptIndex: Map<string, string[]> = new Map() // 概念 -> 相关页面

  constructor(knowledgeBasePath?: string) {
    this.knowledgeBasePath =
      knowledgeBasePath ||
      process.env.KNOWLEDGE_BASE_PATH ||
      '/Users/xujian/projects/YunPat/knowledge-base'

    this.bridge = new ObsidianKnowledgeBridge(this.knowledgeBasePath)
  }

  /**
   * 初始化：解析知识库
   */
  async initialize(): Promise<void> {
    // 1. 解析概念层次结构
    await this.parseConceptHierarchy()

    // 2. 解析概念索引
    await this.parseConceptIndex()

    console.log(`[YunPat] 加载完成: ${this.conceptHierarchy.size} 个概念`)
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
   * 查询问答卡片
   */
  async queryCard(question: string): Promise<YunPatWikiCard | null> {
    const card = await this.bridge.queryCard(question)
    if (!card) return null

    // 提取相关概念
    const concepts = this.extractConcepts(card.content)

    return {
      question: card.question,
      quality: card.quality,
      content: card.content,
      relatedConcepts: concepts,
      timestamp: card.timestamp,
    }
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
   * 获取概念定义
   */
  async getConceptDefinition(concept: string): Promise<string> {
    // 1. 查询问答卡片
    const card = await this.queryCard(concept)
    if (card) {
      return card.content
    }

    // 2. 查找相关页面
    const pages = this.conceptIndex.get(concept) || []
    if (pages.length > 0) {
      const page = await this.bridge.getWikiPage(pages[0])
      return page?.content || ''
    }

    return ''
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
   * 从内容中提取概念
   */
  private extractConcepts(content: string): string[] {
    const concepts: string[] = []

    // 匹配 Wiki 链接
    const links = content.match(/\[\[([^\]]+)\]\]/g) || []
    for (const link of links) {
      const concept = link.replace(/[\[\]]/g, '')
      if (this.conceptHierarchy.has(concept)) {
        concepts.push(concept)
      }
    }

    return concepts
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
    }
  }
}
