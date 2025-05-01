/**
 * 知识图谱查询工具
 *
 * 提供实用的知识图谱查询功能，无需图数据库
 * 基于现有的 Obsidian 知识库实现语义检索
 */

import { ObsidianKnowledgeBridge, type WikiPage } from './ObsidianKnowledgeBridge.js'
import { readFile } from 'fs/promises'
import { join } from 'path'

export interface ConceptRelation {
  concept: string
  relatedConcepts: string[]
  relatedPages: string[]
}

export class KnowledgeGraphTools {
  private bridge: ObsidianKnowledgeBridge
  private conceptIndex: Map<string, string[]> = new Map()
  private conceptHierarchy: Map<string, { level: number; parent?: string }> = new Map()

  constructor(knowledgeBasePath?: string) {
    this.bridge = new ObsidianKnowledgeBridge(knowledgeBasePath)
  }

  /**
   * 初始化：解析概念索引和层次结构
   */
  async initialize(knowledgeBasePath: string) {
    await this.parseConceptIndex(knowledgeBasePath)
    await this.parseConceptHierarchy(knowledgeBasePath)
  }

  /**
   * 查询概念的相关知识
   */
  async queryConcept(concept: string): Promise<ConceptRelation> {
    // 1. 查找相关概念（基于层次结构）
    const relatedConcepts = this.findRelatedConcepts(concept)

    // 2. 查找相关页面（基于概念索引）
    const relatedPages = this.conceptIndex.get(concept) || []

    return {
      concept,
      relatedConcepts,
      relatedPages,
    }
  }

  /**
   * 语义检索：找到与输入文本最相关的概念
   */
  async semanticSearch(
    query: string,
    topK: number = 5
  ): Promise<Array<{ concept: string; score: number }>> {
    const allConcepts = Array.from(this.conceptIndex.keys())

    // 简单的 TF-IDF 相似度计算
    const scores = allConcepts.map((concept) => {
      const score = this.calculateSimilarity(query, concept)
      return { concept, score }
    })

    return scores.sort((a, b) => b.score - a.score).slice(0, topK)
  }

  /**
   * 获取概念的完整定义
   */
  async getConceptDefinition(concept: string): Promise<string> {
    // 1. 查找问答卡片
    const card = await this.bridge.queryCard(concept)
    if (card) {
      return card.content
    }

    // 2. 查找相关 Wiki 页面
    const relatedPages = this.conceptIndex.get(concept) || []
    if (relatedPages.length > 0) {
      const page = await this.bridge.getWikiPage(relatedPages[0])
      return page?.content || ''
    }

    return ''
  }

  /**
   * 推理：检查概念间的关系
   */
  async inferRelation(concept1: string, concept2: string): Promise<string> {
    // 检查是否在同一层次分支下
    const info1 = this.conceptHierarchy.get(concept1)
    const info2 = this.conceptHierarchy.get(concept2)

    if (info1?.parent === info2?.parent) {
      return '兄弟概念（同一父概念下）'
    }

    if (info1?.parent === concept2) {
      return '父子关系（后者是前者的父概念）'
    }

    if (info2?.parent === concept1) {
      return '父子关系（前者是后者的父概念）'
    }

    // 检查是否在同一页面中被提及
    const pages1 = this.conceptIndex.get(concept1) || []
    const pages2 = this.conceptIndex.get(concept2) || []
    const commonPages = pages1.filter((p) => pages2.includes(p))

    if (commonPages.length > 0) {
      return `相关概念（共同出现在 ${commonPages.length} 个页面中）`
    }

    return '无直接关系'
  }

  /**
   * 解析概念索引（Concept-Index.md）
   */
  private async parseConceptIndex(knowledgeBasePath: string) {
    const indexPath = join(knowledgeBasePath, 'Concept-Index.md')
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
   * 解析概念层次结构（Concept-Hierarchy.md）
   */
  private async parseConceptHierarchy(knowledgeBasePath: string) {
    const hierarchyPath = join(knowledgeBasePath, 'Concept-Hierarchy.md')
    const content = await readFile(hierarchyPath, 'utf-8')

    const lines = content.split('\n')
    let currentLevel1 = ''

    for (const line of lines) {
      const level1Match = line.match(/^### (\d+)\. (.+)/)
      if (level1Match) {
        currentLevel1 = level1Match[2]
        this.conceptHierarchy.set(currentLevel1, { level: 1 })
        continue
      }

      const level2Match = line.match(/^#### (.+)/)
      if (level2Match) {
        const level2 = level2Match[1]
        this.conceptHierarchy.set(level2, { level: 2, parent: currentLevel1 })
      }
    }
  }

  /**
   * 查找相关概念
   */
  private findRelatedConcepts(concept: string): string[] {
    const related: string[] = []
    const info = this.conceptHierarchy.get(concept)

    if (!info) return related

    // 添加父概念
    if (info.parent) {
      related.push(info.parent)
    }

    // 添加子概念
    for (const [other, otherInfo] of this.conceptHierarchy) {
      if (otherInfo.parent === concept) {
        related.push(other)
      }
    }

    // 添加兄弟概念
    if (info.parent) {
      for (const [other, otherInfo] of this.conceptHierarchy) {
        if (otherInfo.parent === info.parent && other !== concept) {
          related.push(other)
        }
      }
    }

    return related
  }

  /**
   * 计算文本相似度（简单的词频重叠）
   */
  private calculateSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/))
    const words2 = new Set(text2.toLowerCase().split(/\s+/))

    const intersection = new Set([...words1].filter((x) => words2.has(x)))
    const union = new Set([...words1, ...words2])

    return union.size > 0 ? intersection.size / union.size : 0
  }
}

/**
 * 知识图谱增强的 RAG（检索增强生成）
 */
export class KnowledgeRAG {
  private tools: KnowledgeGraphTools

  constructor(knowledgeBasePath?: string) {
    this.tools = new KnowledgeGraphTools(knowledgeBasePath)
  }

  async initialize(knowledgeBasePath: string) {
    await this.tools.initialize(knowledgeBasePath)
  }

  /**
   * 增强 prompt：添加相关知识
   */
  async enhancePrompt(query: string, basePrompt: string): Promise<string> {
    // 1. 语义检索相关概念
    const relatedConcepts = await this.tools.semanticSearch(query, 3)

    // 2. 为每个概念获取定义
    const definitions: string[] = []
    for (const { concept } of relatedConcepts) {
      const definition = await this.tools.getConceptDefinition(concept)
      if (definition) {
        definitions.push(`### ${concept}\n${definition.substring(0, 300)}...`)
      }
    }

    // 3. 构建增强 prompt
    return `${basePrompt}

## 相关法律概念

${definitions.join('\n\n')}

请基于以上法律概念分析用户问题。
`
  }
}
