/**
 * 内容审核服务
 *
 * 提供多种内容审核实现：
 * - OpenAI Moderation API
 * - 本地规则引擎
 * - 自定义 ML 服务
 */

/**
 * 内容审核结果
 */
export interface ModerationResult {
  /** 是否不安全 */
  isUnsafe: boolean
  /** 分数（0-1） */
  score: number
  /** 类别 */
  categories: {
    harassment?: boolean
    harassmentThreatening?: boolean
    hate?: boolean
    hateThreatening?: boolean
    selfHarm?: boolean
    sexual?: boolean
    sexualMinors?: boolean
    violence?: boolean
    violenceGraphic?: boolean
  }
  /** 原因 */
  reason?: string
}

/**
 * 内容审核服务接口
 */
export interface ContentModerationService {
  /**
   * 审核内容
   */
  moderate(content: string): Promise<ModerationResult>
}

/**
 * OpenAI Moderation API 实现
 */
export class OpenAIModerationService implements ContentModerationService {
  private apiKey: string
  private apiUrl: string

  constructor(apiKey: string, apiUrl = 'https://api.openai.com/v1/moderations') {
    this.apiKey = apiKey
    this.apiUrl = apiUrl
  }

  async moderate(content: string): Promise<ModerationResult> {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          input: content,
        }),
      })

      if (!response.ok) {
        throw new Error(`OpenAI Moderation API 请求失败: ${response.statusText}`)
      }

      const data = await response.json()
      const result = data.results[0]

      return {
        isUnsafe: result.flagged,
        score: Math.max(...(Object.values(result.category_scores) as number[])),
        categories: result.categories,
        reason: result.flagged ? '内容被 OpenAI Moderation 标记为不安全' : undefined,
      }
    } catch (error) {
      console.error('[OpenAIModerationService] 审核失败:', error)
      // 失败时返回安全（不阻止）
      return {
        isUnsafe: false,
        score: 0,
        categories: {},
      }
    }
  }
}

/**
 * 基于规则的内容审核实现
 *
 * 使用预定义的规则进行内容审核
 */
export class RuleBasedModerationService implements ContentModerationService {
  private rules: Array<{
    name: string
    patterns: RegExp[]
    severity: 'low' | 'medium' | 'high'
  }> = []

  constructor() {
    // 默认规则：常见敏感词
    this.rules = [
      {
        name: '暴力内容',
        patterns: [/杀.{0,5}(?:死|害|人)/, /暴.{0,3}力/, /恐.{0,3}怖/],
        severity: 'high',
      },
      {
        name: '色情内容',
        patterns: [/色.{0,3}情/, /淫.{0,3}秽/],
        severity: 'high',
      },
      {
        name: '仇恨言论',
        patterns: [/歧视/, /种族.{0,5}歧.{0,3}视/],
        severity: 'high',
      },
      {
        name: '自残内容',
        patterns: [/自.{0,3}杀/, /自.{0,3}残/],
        severity: 'high',
      },
    ]
  }

  /**
   * 添加自定义规则
   */
  addRule(name: string, patterns: RegExp[], severity: 'low' | 'medium' | 'high'): void {
    this.rules.push({ name, patterns, severity })
  }

  async moderate(content: string): Promise<ModerationResult> {
    let maxScore = 0
    const matchedCategories: Record<string, boolean> = {}
    const reasons: string[] = []

    for (const rule of this.rules) {
      for (const pattern of rule.patterns) {
        if (pattern.test(content)) {
          const score = rule.severity === 'high' ? 0.9 : rule.severity === 'medium' ? 0.6 : 0.3
          maxScore = Math.max(maxScore, score)
          matchedCategories[rule.name] = true
          reasons.push(rule.name)
        }
      }
    }

    return {
      isUnsafe: maxScore > 0.5,
      score: maxScore,
      categories: matchedCategories,
      reason: reasons.length > 0 ? `触发规则: ${reasons.join(', ')}` : undefined,
    }
  }
}

/**
 * 组合审核服务
 *
 * 组合多个审核服务，任一服务标记为不安全即认为不安全
 */
export class CombinedModerationService implements ContentModerationService {
  private services: ContentModerationService[] = []

  constructor(services: ContentModerationService[]) {
    this.services = services
  }

  async moderate(content: string): Promise<ModerationResult> {
    // 处理空服务列表
    if (this.services.length === 0) {
      return {
        isUnsafe: false,
        score: 0,
        categories: {},
      }
    }

    const results = await Promise.all(this.services.map((s) => s.moderate(content)))

    // 找出最高的不安全分数
    const maxScore = Math.max(...results.map((r) => r.score), 0)

    // 合并类别
    const categories: Record<string, boolean> = {}
    for (const result of results) {
      Object.assign(categories, result.categories)
    }

    // 收集原因
    const reasons = results
      .filter((r) => r.isUnsafe)
      .map((r) => r.reason)
      .filter(Boolean) as string[]

    return {
      isUnsafe: maxScore > 0.5,
      score: maxScore,
      categories,
      reason: reasons.length > 0 ? reasons.join('; ') : undefined,
    }
  }
}
