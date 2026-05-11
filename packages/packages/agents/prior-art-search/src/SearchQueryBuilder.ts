/**
 * SearchQueryBuilder — 专利检索式构建器
 *
 * 根据发明描述自动生成 IPC 分类号组合和布尔检索式，
 * 支持渐进式检索策略。
 */

const MAX_INITIAL_KEYWORDS = 3
const MAX_REFINED_KEYWORDS = 5
const MAX_PROBLEM_WORDS = 2
const MAX_SUPPLEMENTARY_KEYWORDS = 2
const MIN_PROBLEM_WORD_LENGTH = 2
const IPC_SUBCLASS_LENGTH = 4

export interface SearchQueryConfig {
  keywords: string[]
  ipcCodes: string[]
  technicalField: string
  technicalProblem: string
  domainStrategy?: 'chemical' | 'software' | 'mechanical' | 'biological' | 'electrical' | 'general'
}

export interface BuiltQuery {
  query: string
  ipcFilter: string
  strategy: string
  phase: 'initial' | 'refined' | 'supplementary'
}

export class SearchQueryBuilder {
  /**
   * 根据发明描述构建检索式
   */
  buildQueries(config: SearchQueryConfig): BuiltQuery[] {
    const queries: BuiltQuery[] = []

    queries.push(this.buildInitialQuery(config))
    queries.push(this.buildRefinedQuery(config))
    queries.push(this.buildSupplementaryQuery(config))

    return queries
  }

  /**
   * 初步检索式（宽范围）
   */
  private buildInitialQuery(config: SearchQueryConfig): BuiltQuery {
    const { keywords, ipcCodes } = config

    const keywordParts = keywords.slice(0, MAX_INITIAL_KEYWORDS).map((k) => `"${k}"`)
    const query = keywordParts.join(' AND ')

    const ipcFilter =
      ipcCodes.length > 0
        ? ipcCodes
            .map((c) => c.substring(0, IPC_SUBCLASS_LENGTH))
            .filter((v, i, a) => a.indexOf(v) === i)
            .join(' OR ')
        : ''

    return {
      query,
      ipcFilter,
      strategy: '初步检索（宽范围）',
      phase: 'initial',
    }
  }

  /**
   * 精准检索式（基于初步结果调整）
   */
  private buildRefinedQuery(config: SearchQueryConfig): BuiltQuery {
    const { keywords, ipcCodes, technicalProblem } = config

    const allKeywords = [...keywords]
    if (technicalProblem) {
      const problemWords = technicalProblem
        .split(/[，,；;、\s]+/)
        .filter((w) => w.length >= MIN_PROBLEM_WORD_LENGTH)
      allKeywords.push(...problemWords.slice(0, MAX_PROBLEM_WORDS))
    }

    const keywordParts = allKeywords.slice(0, MAX_REFINED_KEYWORDS).map((k) => `"${k}"`)
    const query = `(${keywordParts.join(' AND ')}) OR (${keywordParts.slice(0, 2).join(' OR ')})`

    const ipcFilter = ipcCodes.length > 0 ? ipcCodes.join(' OR ') : ''

    return {
      query,
      ipcFilter,
      strategy: '精准检索（关键词扩展 + IPC 细化）',
      phase: 'refined',
    }
  }

  /**
   * 补充检索式（非专利文献 + 语义检索）
   */
  private buildSupplementaryQuery(config: SearchQueryConfig): BuiltQuery {
    const { keywords, domainStrategy } = config

    const domainKeywords = this.getDomainSpecificTerms(domainStrategy || 'general')
    const combinedKeywords = [
      ...keywords.slice(0, MAX_SUPPLEMENTARY_KEYWORDS),
      ...domainKeywords.slice(0, MAX_SUPPLEMENTARY_KEYWORDS),
    ]

    const query = combinedKeywords.map((k) => `"${k}"`).join(' OR ')

    return {
      query,
      ipcFilter: '',
      strategy: `补充检索（${domainStrategy || '通用'}领域 + 非专利文献）`,
      phase: 'supplementary',
    }
  }

  /**
   * 领域特定补充术语
   */
  private getDomainSpecificTerms(domain: string): string[] {
    const domainTerms: Record<string, string[]> = {
      chemical: ['化合物', '组合物', '制备方法', '反应条件', '收率'],
      software: ['算法', '数据处理', '模型训练', '系统架构', '接口'],
      mechanical: ['结构', '装置', '机构', '传动', '连接'],
      biological: ['序列', '表达', '活性', '细胞', '蛋白'],
      electrical: ['电路', '信号', '电压', '频率', '调制'],
      general: ['方法', '系统', '装置', '设备', '工艺'],
    }

    return domainTerms[domain] || domainTerms['general']
  }
}
