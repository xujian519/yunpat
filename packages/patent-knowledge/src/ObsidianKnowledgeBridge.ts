import { readFile, readdir } from 'fs/promises'
import { join } from 'path'

export interface WikiCard {
  question: string
  quality: number
  content: string
  relatedPages: string[]
  timestamp: string
}

export interface WikiPage {
  path: string
  title: string
  content: string
  links: string[]
}

export class ObsidianKnowledgeBridge {
  private knowledgeBasePath: string
  private cache: Map<string, WikiCard> = new Map()
  private pageCache: Map<string, WikiPage> = new Map()

  constructor(knowledgeBasePath?: string) {
    this.knowledgeBasePath = knowledgeBasePath || process.env.KNOWLEDGE_BASE_PATH || ''
    if (!this.knowledgeBasePath) {
      throw new Error('知识库路径未配置，请设置环境变量 KNOWLEDGE_BASE_PATH')
    }
  }

  async queryCard(question: string): Promise<WikiCard | null> {
    if (this.cache.has(question)) {
      return this.cache.get(question)!
    }

    const cardsPath = join(this.knowledgeBasePath, 'Wiki/cards')

    try {
      const files = await readdir(cardsPath)

      const matchedFile = files.find((file) => {
        const questionFromFilename = this.extractQuestionFromFilename(file)
        return this.isSimilarQuestion(question, questionFromFilename)
      })

      if (!matchedFile) {
        return null
      }

      const cardPath = join(cardsPath, matchedFile)
      const content = await readFile(cardPath, 'utf-8')
      const card = this.parseCard(content)

      this.cache.set(question, card)

      return card
    } catch (error) {
      console.error(`查询知识卡片失败: ${error}`)
      return null
    }
  }

  async queryByConcept(concept: string): Promise<string[]> {
    const indexPath = join(this.knowledgeBasePath, 'Wiki/Concept-Index.md')

    try {
      const indexContent = await readFile(indexPath, 'utf-8')
      return this.parseConceptIndex(indexContent, concept)
    } catch (error) {
      console.error(`查询概念失败: ${error}`)
      return []
    }
  }

  async readWikiPage(pagePath: string): Promise<string> {
    const fullPath = join(this.knowledgeBasePath, 'Wiki', `${pagePath}.md`)

    try {
      return await readFile(fullPath, 'utf-8')
    } catch (error) {
      console.error(`读取Wiki页面失败: ${error}`)
      return ''
    }
  }

  async getWikiPage(pagePath: string): Promise<WikiPage | null> {
    if (this.pageCache.has(pagePath)) {
      return this.pageCache.get(pagePath)!
    }

    const content = await this.readWikiPage(pagePath)
    if (!content) {
      return null
    }

    const titleMatch = content.match(/^#\s+(.+)$/m)
    const title = titleMatch ? titleMatch[1] : pagePath

    const links = (content.match(/\[\[([^\]]+)\]\]/g) || []).map((link) =>
      link.replace(/[\[\]]/g, '')
    )

    const page: WikiPage = {
      path: pagePath,
      title,
      content,
      links,
    }

    this.pageCache.set(pagePath, page)

    return page
  }

  private parseCard(content: string): WikiCard {
    const lines = content.split('\n')

    const question = lines[1].replace(/^- 来源问题:\s*/, '')
    const quality = parseFloat(lines[2].replace(/^- 质量分:\s*/, ''))
    const timestamp = lines[3].replace(/^- 生成时间:\s*/, '')

    const cardContentStart = lines.findIndex((l) => l === '## 卡片内容')
    const cardContent = lines
      .slice(cardContentStart + 1)
      .join('\n')
      .trim()

    const relatedPages = (content.match(/\[\[([^\]]+)\]\]/g) || []).map((link) =>
      link.replace(/[\[\]]/g, '')
    )

    return {
      question,
      quality,
      content: cardContent,
      relatedPages,
      timestamp,
    }
  }

  private extractQuestionFromFilename(filename: string): string {
    const match = filename.match(/^(\d{8}-)(.+?)(-[a-f0-9]{11}\.md)$/)
    return match ? match[2] : ''
  }

  private isSimilarQuestion(q1: string, q2: string): boolean {
    const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, '')
    return normalize(q1) === normalize(q2)
  }

  private parseConceptIndex(indexContent: string, concept: string): string[] {
    const lines = indexContent.split('\n')
    const relatedPages: string[] = []

    let foundConcept = false
    for (const line of lines) {
      if (line.startsWith(`### ${concept}`)) {
        foundConcept = true
        continue
      }

      if (foundConcept) {
        if (line.startsWith('### ')) {
          break
        }

        const match = line.match(/\[\[([^\]]+)\]\]/)
        if (match) {
          relatedPages.push(match[1])
        }
      }
    }

    return relatedPages
  }

  clearCache(): void {
    this.cache.clear()
    this.pageCache.clear()
  }

  getCacheStats() {
    return {
      cards: this.cache.size,
      pages: this.pageCache.size,
    }
  }
}
