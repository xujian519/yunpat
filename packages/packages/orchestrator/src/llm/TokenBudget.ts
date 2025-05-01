/**
 * TokenBudget - Token 预算控制
 *
 * 限制 System / Context / User 各层的 Token 数，
 * 防止输入膨胀导致 LLM 调用失败或成本失控。
 */

import type { LLMMessage } from './LLMClient.js'

/**
 * Token 预算配置
 */
export interface TokenBudgetConfig {
  /** System 层最大 Token 数（默认 800） */
  systemMaxTokens: number
  /** Context 层最大 Token 数（默认 1200） */
  contextMaxTokens: number
  /** User 层最大 Token 数（默认 2000） */
  userMaxTokens: number
}

/**
 * 默认预算配置
 */
export const DEFAULT_TOKEN_BUDGET: TokenBudgetConfig = {
  systemMaxTokens: 800,
  contextMaxTokens: 1200,
  userMaxTokens: 2000,
}

/**
 * Token 预算管理器
 */
export class TokenBudget {
  private config: TokenBudgetConfig

  constructor(config?: Partial<TokenBudgetConfig>) {
    this.config = { ...DEFAULT_TOKEN_BUDGET, ...config }
  }

  /**
   * 对消息列表执行预算控制
   * 超出预算时截断对应层的内容，优先保留 System 层和最近的消息
   */
  enforce(messages: LLMMessage[]): LLMMessage[] {
    const result: LLMMessage[] = []

    for (const msg of messages) {
      const maxTokens = this.getMaxTokensForRole(msg.role)
      const currentTokens = this.estimateTokens(msg.content)

      if (currentTokens <= maxTokens) {
        result.push(msg)
      } else {
        // 截断内容
        const truncated = this.truncateToTokenLimit(msg.content, maxTokens)
        result.push({ ...msg, content: truncated })
      }
    }

    return result
  }

  /**
   * 根据角色获取对应的最大 Token 数
   */
  private getMaxTokensForRole(role: string): number {
    // system 消息可能是 System Prompt 或 Context 层
    // 使用 systemMaxTokens 作为上限（Context 层的 system 消息也用此值）
    switch (role) {
      case 'system':
        return this.config.systemMaxTokens
      case 'user':
        return this.config.userMaxTokens
      case 'assistant':
        return this.config.userMaxTokens
      default:
        return this.config.userMaxTokens
    }
  }

  /**
   * 估算文本的 Token 数
   * 中文字符约 1.5 token/字，英文约 0.25 token/字符（4字符≈1token）
   * 混合文本按字符类型分别计算
   */
  estimateTokens(text: string): number {
    if (!text) return 0

    let tokens = 0
    for (const ch of text) {
      const code = ch.codePointAt(0)!
      // CJK 统一汉字范围
      if (
        (code >= 0x4e00 && code <= 0x9fff) ||
        (code >= 0x3400 && code <= 0x4dbf) ||
        (code >= 0xf900 && code <= 0xfaff)
      ) {
        tokens += 1.5
      } else if (code <= 0x7f) {
        // ASCII（英文、数字、标点）
        tokens += 0.25
      } else {
        // 其他 Unicode（日韩文、emoji 等）
        tokens += 1.5
      }
    }
    return Math.ceil(tokens)
  }

  /**
   * 将文本截断到指定 Token 数以内
   */
  private truncateToTokenLimit(text: string, maxTokens: number): string {
    let tokens = 0
    let cutIndex = text.length

    for (let i = 0; i < text.length; i++) {
      const ch = text[i]
      const code = ch.codePointAt(0)!
      if (
        (code >= 0x4e00 && code <= 0x9fff) ||
        (code >= 0x3400 && code <= 0x4dbf) ||
        (code >= 0xf900 && code <= 0xfaff)
      ) {
        tokens += 1.5
      } else if (code <= 0x7f) {
        tokens += 0.25
      } else {
        tokens += 1.5
      }

      if (tokens > maxTokens - 3) {
        cutIndex = i
        break
      }
    }

    if (cutIndex >= text.length) return text
    return text.substring(0, cutIndex) + '...'
  }

  /**
   * 获取当前配置
   */
  getConfig(): TokenBudgetConfig {
    return { ...this.config }
  }
}
