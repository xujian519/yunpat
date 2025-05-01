/**
 * 知识图谱导出器
 *
 * 将 Obsidian 知识库转换为图数据库（Neo4j）
 * 支持增量更新和关系推理
 */

import { readFile, readdir } from 'fs/promises'
import { join } from 'path'

export interface GraphNode {
  id: string
  labels: string[]
  properties: Record<string, any>
}

export interface GraphRelationship {
  id: string
  type: string
  from: string
  to: string
  properties: Record<string, any>
}

export interface KnowledgeGraph {
  nodes: GraphNode[]
  relationships: GraphRelationship[]
}

/**
 * 知识图谱导出器
 *
 * 核心功能：
 * 1. 解析 Obsidian Wiki 链接
 * 2. 构建节点和关系
 * 3. 导出为 Neo4j Cypher 脚本
 */
export class KnowledgeGraphExporter {
  private knowledgeBasePath: string
  private graph: KnowledgeGraph = {
    nodes: [],
    relationships: [],
  }

  constructor(knowledgeBasePath: string) {
    this.knowledgeBasePath = knowledgeBasePath
  }

  /**
   * 导出完整知识图谱
   */
  async export(): Promise<KnowledgeGraph> {
    // 1. 解析概念层次结构
    await this.parseConceptHierarchy()

    // 2. 解析 Wiki 页面和链接
    await this.parseWikiPages()

    // 3. 解析问答卡片
    await this.parseQACards()

    // 4. 构建概念关系
    this.buildConceptRelationships()

    return this.graph
  }

  /**
   * 解析概念层次结构
   */
  private async parseConceptHierarchy() {
    const hierarchyPath = join(this.knowledgeBasePath, 'Concept-Hierarchy.md')
    const content = await readFile(hierarchyPath, 'utf-8')

    // 解析一级概念（15个核心领域）
    const level1Matches = content.matchAll(/### (\d+)\. (.+)/g)
    for (const match of level1Matches) {
      const [, num, name] = match
      this.addNode({
        id: `concept_${name}`,
        labels: ['Concept', 'Level1'],
        properties: {
          name,
          level: 1,
          order: parseInt(num),
        },
      })
    }

    // 解析二级概念
    const level2Matches = content.matchAll(/#### (.+)/g)
    for (const match of level2Matches) {
      const [, name] = match
      this.addNode({
        id: `concept_${name}`,
        labels: ['Concept', 'Level2'],
        properties: { name, level: 2 },
      })
    }
  }

  /**
   * 解析 Wiki 页面和链接
   */
  private async parseWikiPages() {
    const wikiPath = join(this.knowledgeBasePath)

    // 递归遍历所有 .md 文件
    const files = await this.walkDirectory(wikiPath, '.md')

    for (const file of files) {
      const content = await readFile(join(wikiPath, file), 'utf-8')

      // 提取标题
      const titleMatch = content.match(/^#\s+(.+)$/m)
      const title = titleMatch ? titleMatch[1] : file

      // 创建页面节点
      const pageId = `page_${this.slugify(title)}`
      this.addNode({
        id: pageId,
        labels: ['WikiPage'],
        properties: {
          title,
          path: file,
          contentLength: content.length,
        },
      })

      // 提取 Wiki 链接并创建关系
      const links = content.matchAll(/\[\[([^\]]+)\]\]/g)
      for (const link of links) {
        const [, targetTitle] = link
        const targetId = `page_${this.slugify(targetTitle)}`

        this.addRelationship({
          id: `link_${pageId}_${targetId}`,
          type: 'LINKS_TO',
          from: pageId,
          to: targetId,
          properties: { type: 'wiki_link' },
        })
      }
    }
  }

  /**
   * 解析问答卡片
   */
  private async parseQACards() {
    const cardsPath = join(this.knowledgeBasePath, 'cards')
    const files = await readdir(cardsPath)

    for (const file of files) {
      if (!file.endsWith('.md')) continue

      const content = await readFile(join(cardsPath, file), 'utf-8')
      const card = this.parseCard(file, content)

      // 创建卡片节点
      const cardId = `card_${this.slugify(card.question)}`
      this.addNode({
        id: cardId,
        labels: ['QACard'],
        properties: {
          question: card.question,
          quality: card.quality,
          timestamp: card.timestamp,
        },
      })

      // 创建卡片与概念的关系
      for (const concept of card.concepts) {
        const conceptId = `concept_${concept}`
        this.addRelationship({
          id: `rel_${cardId}_${conceptId}`,
          type: 'ABOUT_CONCEPT',
          from: cardId,
          to: conceptId,
          properties: { confidence: card.quality },
        })
      }
    }
  }

  /**
   * 构建概念关系（基于层次结构）
   */
  private buildConceptRelationships() {
    const level1Nodes = this.graph.nodes.filter((n) => n.labels.includes('Level1'))
    const level2Nodes = this.graph.nodes.filter((n) => n.labels.includes('Level2'))

    // 构建 Level1 -> Level2 的父子关系
    // TODO: 基于 Concept-Hierarchy.md 的结构建立关系
  }

  /**
   * 导出为 Neo4j Cypher 脚本
   */
  toCypher(): string {
    const statements: string[] = []

    // 创建节点
    for (const node of this.graph.nodes) {
      const props = JSON.stringify(node.properties)
      statements.push(`CREATE (${node.id}:${node.labels.join(':')} ${props})`)
    }

    // 创建关系
    for (const rel of this.graph.relationships) {
      const props = JSON.stringify(rel.properties)
      statements.push(`CREATE (${rel.from})-[:${rel.type} ${props}]->(${rel.to})`)
    }

    return statements.join('\n')
  }

  /**
   * 导出为 GraphSON（GraphML 格式）
   */
  toGraphSON(): string {
    return JSON.stringify(this.graph, null, 2)
  }

  private addNode(node: GraphNode) {
    // 避免重复
    if (!this.graph.nodes.find((n) => n.id === node.id)) {
      this.graph.nodes.push(node)
    }
  }

  private addRelationship(rel: GraphRelationship) {
    // 避免重复
    if (!this.graph.relationships.find((r) => r.id === rel.id)) {
      this.graph.relationships.push(rel)
    }
  }

  private parseCard(filename: string, content: string) {
    const lines = content.split('\n')
    const question = lines[1]?.replace(/^- 来源问题:\s*/, '') || ''
    const quality = parseFloat(lines[2]?.replace(/^- 质量分:\s*/, '0') || '0')
    const timestamp = lines[3]?.replace(/^- 生成时间:\s*/, '') || ''

    // 提取概念（从文件名或内容）
    const concepts = this.extractConcepts(filename, content)

    return { question, quality, timestamp, concepts }
  }

  private extractConcepts(filename: string, content: string): string[] {
    const concepts: string[] = []

    // 从文件名提取（格式：20260429-概念名-...）
    const filenameMatch = filename.match(/^\d{8}-([^-]+)-/)
    if (filenameMatch) {
      concepts.push(filenameMatch[1])
    }

    // 从内容提取 Wiki 链接
    const links = content.match(/\[\[([^\]]+)\]\]/g) || []
    for (const link of links) {
      const concept = link.replace(/[\[\]]/g, '')
      concepts.push(concept)
    }

    return [...new Set(concepts)]
  }

  private async walkDirectory(dir: string, ext: string): Promise<string[]> {
    const files: string[] = []
    const items = await readdir(dir, { withFileTypes: true })

    for (const item of items) {
      const path = join(dir, item.name)
      if (item.isDirectory()) {
        files.push(...(await this.walkDirectory(path, ext)))
      } else if (item.name.endsWith(ext)) {
        files.push(path)
      }
    }

    return files
  }

  private slugify(text: string): string {
    return text.toLowerCase().replace(/\s+/g, '_').replace(/[^\w]/g, '')
  }
}
