/**
 * 知识卡片检索器
 *
 * 多维度检索：关键词、语义（向量）、概念导航、关联探索
 */
export class CardRetriever {
  cards = new Map()
  conceptIndex = new Map()
  domainIndex = new Map()
  tagIndex = new Map()
  embedder
  constructor(embedder) {
    this.embedder = embedder
  }
  loadCards(cards) {
    for (const card of cards) {
      this.cards.set(card.id, card)
      this.updateIndex(card)
    }
  }
  addCard(card) {
    this.cards.set(card.id, card)
    this.updateIndex(card)
  }
  removeCard(cardId) {
    const card = this.cards.get(cardId)
    if (!card) return
    this.cards.delete(cardId)
    this.removeFromIndex(card)
  }
  getCard(cardId) {
    return this.cards.get(cardId)
  }
  async search(query, options = {}) {
    const {
      mode = 'hybrid',
      limit = 5,
      minQuality = 0,
      domain,
      concept,
      tags,
      minSimilarity = 0.3,
    } = options
    let candidates = this.getCandidates(domain, concept, tags)
    // 质量过滤
    candidates = candidates.filter((c) => c.quality >= minQuality)
    // 预计算查询向量（避免每个候选重复调用）
    let queryEmbedding = null
    if ((mode === 'semantic' || mode === 'hybrid') && this.embedder) {
      try {
        const embeddingResult = await this.embedder.embed({ texts: [query], normalize: true })
        queryEmbedding = embeddingResult.embeddings[0]
      } catch {
        // 忽略错误，使用默认值
      }
    }
    // 计算分数
    const results = []
    for (const card of candidates) {
      const result = await this.scoreCard(card, query, mode, queryEmbedding)
      if (result.score >= minSimilarity) {
        results.push(result)
      }
    }
    results.sort((a, b) => b.score - a.score)
    return results.slice(0, limit)
  }
  getByConcept(concept) {
    const ids = this.conceptIndex.get(concept)
    if (!ids) return []
    return Array.from(ids)
      .map((id) => this.cards.get(id))
      .filter((c) => c !== undefined)
      .sort((a, b) => b.quality - a.quality)
  }
  getByDomain(domain) {
    const ids = this.domainIndex.get(domain)
    if (!ids) return []
    return Array.from(ids)
      .map((id) => this.cards.get(id))
      .filter((c) => c !== undefined)
      .sort((a, b) => b.quality - a.quality)
  }
  explore(cardId, depth = 1) {
    const visited = new Set()
    const result = []
    const queue = [{ id: cardId, d: 0 }]
    while (queue.length > 0) {
      const { id, d } = queue.shift()
      if (visited.has(id) || d > depth) continue
      visited.add(id)
      const card = this.cards.get(id)
      if (!card) continue
      if (d > 0) result.push(card)
      for (const relatedId of card.relatedCards) {
        if (!visited.has(relatedId)) {
          queue.push({ id: relatedId, d: d + 1 })
        }
      }
    }
    return result
  }
  async injectContext(prompt, maxCards = 5) {
    const results = await this.search(prompt, { mode: 'hybrid', limit: maxCards, minQuality: 0.6 })
    if (results.length === 0) {
      return { enhancedPrompt: prompt, injectedCards: [] }
    }
    const knowledgeSection = results
      .map((r) => `### ${r.card.question}\n\n${r.card.content}`)
      .join('\n\n---\n\n')
    const enhanced = `## 相关知识（置信度: ${results.map((r) => r.score.toFixed(2)).join(', ')}）

${knowledgeSection}

---

## 用户任务

${prompt}`
    return {
      enhancedPrompt: enhanced,
      injectedCards: results.map((r) => r.card),
    }
  }
  getStats() {
    const byDomain = {}
    const byConcept = {}
    let withEmbedding = 0
    let totalQuality = 0
    for (const card of this.cards.values()) {
      byDomain[card.domain] = (byDomain[card.domain] ?? 0) + 1
      byConcept[card.concept] = (byConcept[card.concept] ?? 0) + 1
      if (card.embedding) withEmbedding++
      totalQuality += card.quality
    }
    return {
      totalCards: this.cards.size,
      byDomain,
      byConcept,
      withEmbedding,
      avgQuality: this.cards.size > 0 ? totalQuality / this.cards.size : 0,
    }
  }
  async scoreCard(card, query, mode, queryEmbedding) {
    let keywordScore = 0
    let semanticScore = 0
    const tagMatches = []
    // 关键词匹配（支持中文 bigram）
    if (mode === 'keyword' || mode === 'hybrid') {
      const queryLower = query.toLowerCase()
      const keywords = this.extractKeywords(queryLower)
      const questionLower = card.question.toLowerCase()
      const contentLower = card.content.toLowerCase()
      for (const kw of keywords) {
        if (questionLower.includes(kw)) keywordScore += 0.3
        if (contentLower.includes(kw)) keywordScore += 0.1
      }
      for (const tag of card.tags) {
        if (queryLower.includes(tag.toLowerCase()) || tag.toLowerCase().includes(queryLower)) {
          keywordScore += 0.2
          tagMatches.push(tag)
        }
      }
      keywordScore = Math.min(keywordScore, 1)
    }
    // 语义匹配
    if ((mode === 'semantic' || mode === 'hybrid') && queryEmbedding && card.embedding) {
      semanticScore = this.cosineSimilarity(queryEmbedding, card.embedding)
    } else if (mode === 'semantic' || mode === 'hybrid') {
      semanticScore = this.textSimilarity(query, `${card.question} ${card.content}`)
    }
    // 混合分数
    let score
    if (mode === 'keyword') {
      score = keywordScore
    } else if (mode === 'semantic') {
      score = semanticScore
    } else {
      score = keywordScore * 0.4 + semanticScore * 0.6
    }
    // 质量加成
    score *= 0.7 + card.quality * 0.3
    return {
      card,
      score,
      matchReason: { keywordScore, semanticScore, tagMatches },
    }
  }
  getCandidates(domain, concept, tags) {
    let candidateIds
    if (domain) {
      const ids = this.domainIndex.get(domain)
      candidateIds = ids ? new Set(ids) : new Set()
    }
    if (concept) {
      const ids = this.conceptIndex.get(concept)
      if (candidateIds) {
        candidateIds = new Set([...candidateIds].filter((id) => ids?.has(id)))
      } else {
        candidateIds = ids ? new Set(ids) : new Set()
      }
    }
    if (tags && tags.length > 0) {
      const tagIds = tags.flatMap((t) => Array.from(this.tagIndex.get(t) ?? []))
      if (candidateIds) {
        candidateIds = new Set([...candidateIds].filter((id) => tagIds.includes(id)))
      } else {
        candidateIds = new Set(tagIds)
      }
    }
    if (candidateIds) {
      return Array.from(candidateIds)
        .map((id) => this.cards.get(id))
        .filter((c) => c !== undefined)
    }
    return Array.from(this.cards.values())
  }
  updateIndex(card) {
    if (!this.conceptIndex.has(card.concept)) this.conceptIndex.set(card.concept, new Set())
    this.conceptIndex.get(card.concept).add(card.id)
    if (!this.domainIndex.has(card.domain)) this.domainIndex.set(card.domain, new Set())
    this.domainIndex.get(card.domain).add(card.id)
    for (const tag of card.tags) {
      if (!this.tagIndex.has(tag)) this.tagIndex.set(tag, new Set())
      this.tagIndex.get(tag).add(card.id)
    }
  }
  removeFromIndex(card) {
    this.conceptIndex.get(card.concept)?.delete(card.id)
    this.domainIndex.get(card.domain)?.delete(card.id)
    for (const tag of card.tags) {
      this.tagIndex.get(tag)?.delete(card.id)
    }
  }
  extractKeywords(query) {
    const keywords = []
    // 按标点和空格分词
    const parts = query.split(/[\s,;.!?，；。！？、]+/).filter((w) => w.length > 1)
    keywords.push(...parts)
    // 对连续中文字符生成 bigram（2-gram）
    const chineseMatches = query.match(/[\u4e00-\u9fff]+/g) ?? []
    for (const segment of chineseMatches) {
      if (segment.length >= 2) {
        for (let i = 0; i <= segment.length - 2; i++) {
          keywords.push(segment.slice(i, i + 2))
        }
      }
      if (segment.length >= 3) {
        for (let i = 0; i <= segment.length - 3; i++) {
          keywords.push(segment.slice(i, i + 3))
        }
      }
    }
    return [...new Set(keywords)]
  }
  cosineSimilarity(a, b) {
    if (a.length !== b.length) return 0
    let dot = 0,
      normA = 0,
      normB = 0
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB)
    return denom === 0 ? 0 : dot / denom
  }
  textSimilarity(a, b) {
    // 字符级 bigram（对中文有效）
    const bigrams = (s) => {
      const chars = s.toLowerCase().replace(/[\s,;.!?，；。！？、]+/g, '')
      const result = new Set()
      for (let i = 0; i < chars.length - 1; i++) {
        result.add(chars.slice(i, i + 2))
      }
      return result
    }
    const s1 = bigrams(a)
    const s2 = bigrams(b)
    if (s1.size === 0 && s2.size === 0) return 0
    const intersection = new Set([...s1].filter((x) => s2.has(x)))
    const union = new Set([...s1, ...s2])
    return union.size === 0 ? 0 : intersection.size / union.size
  }
}
//# sourceMappingURL=CardRetriever.js.map
