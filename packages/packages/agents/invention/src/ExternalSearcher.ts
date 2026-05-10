/**
 * 外部技术搜索模块
 *
 * 纯函数：网络搜索、学术搜索、网页抓取、关键词提取
 */

import type { InventionUnderstandingInput, ExternalSearchResult } from './types.js'

/**
 * 搜索外部技术资料
 */
export async function searchExternalKnowledge(
  input: InventionUnderstandingInput
): Promise<ExternalSearchResult[]> {
  const results: ExternalSearchResult[] = []
  const keywords = extractSearchKeywords(input)

  const [webResults, academicResults] = await Promise.all([
    searchWeb(keywords.webQueries).catch((err) => {
      console.warn(`   ⚠️ 网络搜索失败: ${err instanceof Error ? err.message : String(err)}`)
      return []
    }),
    searchAcademic(keywords.academicQuery).catch((err) => {
      console.warn(`   ⚠️ 学术搜索失败: ${err instanceof Error ? err.message : String(err)}`)
      return []
    }),
  ])

  results.push(...webResults, ...academicResults)

  const topWebResults = webResults.filter((r) => r.url).slice(0, 3)
  for (const result of topWebResults) {
    try {
      const fullContent = await fetchWebPage(result.url!)
      if (fullContent) {
        results.push({
          source: 'web',
          title: `${result.title}（全文）`,
          content: fullContent.substring(0, 2000),
          url: result.url,
        })
      }
    } catch {
      // 抓取失败不影响整体流程
    }
  }

  console.log(`   网络搜索: ${webResults.length} 条`)
  console.log(`   学术搜索: ${academicResults.length} 条`)
  console.log(`   网页抓取: ${topWebResults.length} 篇`)

  return results
}

/**
 * 从交底书中提取搜索关键词
 */
export function extractSearchKeywords(input: InventionUnderstandingInput): {
  webQueries: string[]
  academicQuery: string
} {
  const webQueries: string[] = []
  webQueries.push(input.title)

  const technicalTerms = extractTechnicalTerms(input.technicalDisclosure)
  if (technicalTerms.length > 0) {
    webQueries.push(`${input.field} ${technicalTerms.slice(0, 3).join(' ')}`)
  }

  webQueries.push(`${input.field} 技术原理 现有技术`)

  const academicQuery =
    technicalTerms.length > 0
      ? `${input.field} ${technicalTerms.slice(0, 2).join(' ')}`
      : input.title

  return { webQueries, academicQuery }
}

/**
 * 从交底书中提取技术术语
 */
export function extractTechnicalTerms(disclosure: string): string[] {
  const terms: string[] = []
  const patterns = [
    /(?:称为|叫做|简称|即|亦称)\s*[「"'"]?([^「"'"，。；]+)[「"'"]?/g,
    /(?:包括|包含|具有)\s*([^，。；\n]{2,15})/g,
  ]

  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(disclosure)) !== null) {
      const term = match[1].trim()
      if (term.length >= 2 && term.length <= 15 && !terms.includes(term)) {
        terms.push(term)
      }
    }
  }

  return terms.slice(0, 8)
}

/**
 * 网络搜索（DuckDuckGo API）
 */
export async function searchWeb(queries: string[]): Promise<ExternalSearchResult[]> {
  const results: ExternalSearchResult[] = []

  for (const query of queries.slice(0, 3)) {
    try {
      const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)

      const response = await fetch(url, { signal: controller.signal })
      clearTimeout(timeoutId)

      const data = (await response.json()) as {
        RelatedTopics?: Array<{ Text?: string; FirstURL?: string }>
        AbstractText?: string
        AbstractURL?: string
      }

      if (data.AbstractText) {
        results.push({
          source: 'web',
          title: query,
          content: data.AbstractText,
          url: data.AbstractURL,
        })
      }

      if (data.RelatedTopics) {
        for (const topic of data.RelatedTopics) {
          if (topic.Text && topic.FirstURL && results.length < 10) {
            results.push({
              source: 'web',
              title: topic.Text.substring(0, 100),
              content: topic.Text,
              url: topic.FirstURL,
            })
          }
        }
      }
    } catch {
      // 单个查询失败不影响其他查询
    }
  }

  return results
}

/**
 * 学术论文搜索（Semantic Scholar API）
 */
export async function searchAcademic(query: string): Promise<ExternalSearchResult[]> {
  try {
    const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=5&fields=title,abstract,url`
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)

    const data = (await response.json()) as {
      data?: Array<{ title?: string; abstract?: string; url?: string }>
    }

    if (!data.data) return []

    return data.data
      .filter((paper) => paper.abstract)
      .map((paper) => ({
        source: 'academic' as const,
        title: paper.title || '',
        content: paper.abstract!.substring(0, 500),
        url: paper.url,
      }))
  } catch {
    return []
  }
}

/**
 * 抓取网页内容
 */
export async function fetchWebPage(url: string): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; YunPat/1.0)' },
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!response.ok) return null

    const html = await response.text()
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  } catch {
    return null
  }
}
