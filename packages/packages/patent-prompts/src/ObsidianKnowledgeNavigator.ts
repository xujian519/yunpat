/**
 * ObsidianKnowledgeNavigator — 基于 Obsidian 双链关系的动态知识导航
 *
 * 包装 YunPatAdapter 的概念搜索和双链遍历能力，
 * 为 PromptTemplateManager 提供知识导航接口。
 */

export interface YunPatConceptLike {
  name: string
  definition?: string
  parent?: string
  children?: string[]
  relatedPages?: string[]
}

export interface KnowledgeNavigatorConfig {
  yunpatAdapter: {
    conceptSearch(
      query: string,
      topK: number
    ): Promise<Array<{ concept: YunPatConceptLike; score: number }>>
    getConnectedPages(
      startPage: string,
      options: { depth?: number; direction?: string }
    ): Promise<Map<string, number>>
  }
}

export interface ConceptNeighborhood {
  concept: string
  definition?: string
  parent?: string
  children: string[]
  siblings: string[]
  relatedPages: string[]
}

const MAX_RELATED_PAGES_PER_CONCEPT = 2
const MAX_NAVIGATION_RESULTS = 20
const DEFAULT_SEARCH_TOP_K = 3

export class ObsidianKnowledgeNavigator {
  private adapter: KnowledgeNavigatorConfig['yunpatAdapter']

  constructor(config: KnowledgeNavigatorConfig) {
    this.adapter = config.yunpatAdapter
  }

  async navigateFromConcept(concept: string, depth: number = 2): Promise<string[]> {
    try {
      const searchResults = await this.adapter.conceptSearch(concept, DEFAULT_SEARCH_TOP_K)
      if (searchResults.length === 0) return []

      const pages: string[] = []
      for (const result of searchResults) {
        const relatedPages = result.concept.relatedPages ?? []
        for (const page of relatedPages.slice(0, MAX_RELATED_PAGES_PER_CONCEPT)) {
          const connected = await this.adapter.getConnectedPages(page, { depth, direction: 'both' })
          if (!(connected instanceof Map)) continue

          for (const [path, dist] of connected) {
            if (typeof dist === 'number' && dist <= depth && !pages.includes(path)) {
              pages.push(path)
            }
          }
        }
      }

      return pages.slice(0, MAX_NAVIGATION_RESULTS)
    } catch {
      return []
    }
  }

  async findRelatedConcepts(concept1: string, concept2: string): Promise<string[]> {
    try {
      const [results1, results2] = await Promise.all([
        this.adapter.conceptSearch(concept1, DEFAULT_SEARCH_TOP_K),
        this.adapter.conceptSearch(concept2, DEFAULT_SEARCH_TOP_K),
      ])

      const concepts1 = new Set(
        results1.flatMap((r) => [r.concept.name, ...(r.concept.children ?? [])])
      )
      const concepts2 = new Set(
        results2.flatMap((r) => [r.concept.name, ...(r.concept.children ?? [])])
      )

      const intersection = [...concepts1].filter((c) => concepts2.has(c))
      return intersection
    } catch {
      return []
    }
  }

  async getConceptNeighborhood(concept: string): Promise<ConceptNeighborhood | null> {
    try {
      const results = await this.adapter.conceptSearch(concept, 1)
      if (results.length === 0) return null

      const found = results[0].concept
      const siblings: string[] = []

      if (found.parent) {
        const parentResults = await this.adapter.conceptSearch(found.parent, 1)
        if (parentResults.length > 0) {
          siblings.push(
            ...(parentResults[0].concept.children?.filter((c) => c !== found.name) ?? [])
          )
        }
      }

      return {
        concept: found.name,
        definition: found.definition,
        parent: found.parent,
        children: found.children ?? [],
        siblings,
        relatedPages: found.relatedPages ?? [],
      }
    } catch {
      return null
    }
  }
}
