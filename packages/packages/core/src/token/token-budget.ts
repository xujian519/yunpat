/**
 * Token 预算管理器
 *
 * 借鉴 Claude Code 的 Token 预算设计：
 * - 200K 上下文窗口的动态计算
 * - 预留空间：系统提示词、工具定义、输出、安全缓冲
 * - 自动压缩触发阈值
 * - 输出 Token 的 Slot 优化
 */

/**
 * Token 预算配置
 */
export interface TokenBudgetConfig {
  /** 模型上下文窗口大小（默认 200K） */
  contextWindow?: number
  /** 系统提示词预留（默认 20K） */
  systemPromptReserve?: number
  /** 工具定义预留（默认 15K） */
  toolDefinitionsReserve?: number
  /** 输出预留（默认 16K） */
  outputReserve?: number
  /** 安全缓冲（默认 10K） */
  safetyBuffer?: number
  /** 自动压缩触发阈值比例（默认 0.9） */
  autoCompactThresholdRatio?: number
  /** 警告阈值比例（默认 0.85） */
  warningThresholdRatio?: number
}

/**
 * Token 预算结果
 */
export interface TokenBudget {
  /** 总上下文窗口 */
  contextWindow: number
  /** 系统提示词预留 */
  systemPromptReserve: number
  /** 工具定义预留 */
  toolDefinitionsReserve: number
  /** 输出预留 */
  outputReserve: number
  /** 安全缓冲 */
  safetyBuffer: number
  /** 可用历史空间 */
  availableForHistory: number
  /** 警告阈值 */
  warningThreshold: number
  /** 自动压缩触发阈值 */
  autoCompactThreshold: number
  /** 阻塞上限 */
  blockingLimit: number
}

/**
 * 专利上下文特有的 Token 预算扩展
 */
export interface PatentTokenBudget extends TokenBudget {
  /** 说明书分段加载预算 */
  specificationSegmentBudget: number
  /** 权利要求书常驻预算（始终保留在上下文中） */
  claimsResidentBudget: number
  /** 检索结果缓存预算 */
  searchResultsBudget: number
  /** 附图说明预算（按需加载） */
  drawingDescriptionBudget: number
}

/**
 * Token 预算管理器
 */
export class TokenBudgetManager {
  private config: Required<TokenBudgetConfig>

  constructor(config: TokenBudgetConfig = {}) {
    this.config = {
      contextWindow: config.contextWindow ?? 200_000,
      systemPromptReserve: config.systemPromptReserve ?? 20_000,
      toolDefinitionsReserve: config.toolDefinitionsReserve ?? 15_000,
      outputReserve: config.outputReserve ?? 16_000,
      safetyBuffer: config.safetyBuffer ?? 10_000,
      autoCompactThresholdRatio: config.autoCompactThresholdRatio ?? 0.9,
      warningThresholdRatio: config.warningThresholdRatio ?? 0.85,
    }
  }

  /**
   * 计算基础 Token 预算
   */
  calculateBudget(): TokenBudget {
    const totalReserve =
      this.config.systemPromptReserve +
      this.config.toolDefinitionsReserve +
      this.config.outputReserve +
      this.config.safetyBuffer

    const availableForHistory = Math.max(0, this.config.contextWindow - totalReserve)

    return {
      contextWindow: this.config.contextWindow,
      systemPromptReserve: this.config.systemPromptReserve,
      toolDefinitionsReserve: this.config.toolDefinitionsReserve,
      outputReserve: this.config.outputReserve,
      safetyBuffer: this.config.safetyBuffer,
      availableForHistory,
      warningThreshold: Math.floor(availableForHistory * this.config.warningThresholdRatio),
      autoCompactThreshold: Math.floor(availableForHistory * this.config.autoCompactThresholdRatio),
      blockingLimit: availableForHistory - 1000, // 保留 1K 应急空间
    }
  }

  /**
   * 计算专利场景特有的 Token 预算
   *
   * 专利文档的特殊性：
   * - 说明书全文可能 2-3 万字，不能每次全量送入
   * - 权利要求书需要常驻上下文
   * - 检索结果可能非常大
   */
  calculatePatentBudget(options?: {
    claimsTokenCount?: number
    specificationTotalTokens?: number
    searchResultsTokenCount?: number
  }): PatentTokenBudget {
    const base = this.calculateBudget()

    // 权利要求书常驻预算（实际权利要求书 token 数 + 缓冲）
    const claimsResidentBudget = Math.min(
      (options?.claimsTokenCount ?? 3000) + 1000,
      base.availableForHistory * 0.15 // 最多占历史空间的 15%
    )

    // 检索结果缓存预算
    const searchResultsBudget = Math.min(
      (options?.searchResultsTokenCount ?? 5000) + 2000,
      base.availableForHistory * 0.2 // 最多占 20%
    )

    // 说明书分段加载预算（每次只加载一段）
    const specificationSegmentBudget = Math.min(
      8000, // 每次最多加载 8K tokens 的说明书段落
      base.availableForHistory * 0.25
    )

    // 附图说明预算（按需加载）
    const drawingDescriptionBudget = 2000

    return {
      ...base,
      claimsResidentBudget,
      specificationSegmentBudget,
      searchResultsBudget,
      drawingDescriptionBudget,
    }
  }

  /**
   * 检查当前 token 使用量是否触发警告
   */
  shouldWarn(currentHistoryTokens: number): boolean {
    const budget = this.calculateBudget()
    return currentHistoryTokens >= budget.warningThreshold
  }

  /**
   * 检查当前 token 使用量是否触发自动压缩
   */
  shouldAutoCompact(currentHistoryTokens: number): boolean {
    const budget = this.calculateBudget()
    return currentHistoryTokens >= budget.autoCompactThreshold
  }

  /**
   * 检查是否达到阻塞上限
   */
  shouldBlock(currentHistoryTokens: number): boolean {
    const budget = this.calculateBudget()
    return currentHistoryTokens >= budget.blockingLimit
  }

  /**
   * 获取剩余可用空间
   */
  getRemainingSpace(currentHistoryTokens: number): number {
    const budget = this.calculateBudget()
    return Math.max(0, budget.availableForHistory - currentHistoryTokens)
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<TokenBudgetConfig>): void {
    this.config = { ...this.config, ...config }
  }
}

/**
 * 默认 Token 预算管理器实例
 */
export const defaultTokenBudgetManager = new TokenBudgetManager()
