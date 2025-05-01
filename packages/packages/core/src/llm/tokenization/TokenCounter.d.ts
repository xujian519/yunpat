/**
 * Token 计数器
 *
 * 提供基于不同模型的精确 Token 估算
 *
 * @module llm/tokenization/TokenCounter
 */
/**
 * Token 计数器接口
 */
export interface ITokenCounter {
  /**
   * 估算文本的 Token 数量
   *
   * @param text 输入文本
   * @param model 模型名称
   * @returns Token 数量
   */
  estimateTokens(text: string, model: string): number
  /**
   * 批量估算 Token
   *
   * @param texts 输入文本数组
   * @param model 模型名称
   * @returns Token 数量数组
   */
  estimateTokensBatch(texts: string[], model: string): number[]
  /**
   * 计算总 Token 数
   *
   * @param texts 输入文本数组
   * @param model 模型名称
   * @returns 总 Token 数量
   */
  calculateTotalTokens(texts: string[], model: string): number
}
/**
 * 模型类型枚举
 */
export declare enum ModelType {
  /** GPT 模型（OpenAI） */
  GPT = 'gpt',
  /** Claude 模型（Anthropic） */
  CLAUDE = 'claude',
  /** DeepSeek 模型 */
  DEEPSEEK = 'deepseek',
  /** 通义千问模型 */
  QWEN = 'qwen',
  /** 未知模型 */
  UNKNOWN = 'unknown',
}
/**
 * Token 计数器实现
 */
export declare class TokenCounter implements ITokenCounter {
  /**
   * 估算文本的 Token 数量
   *
   * @param text 输入文本
   * @param model 模型名称
   * @returns Token 数量
   */
  estimateTokens(text: string, model: string): number
  /**
   * 批量估算 Token
   *
   * @param texts 输入文本数组
   * @param model 模型名称
   * @returns Token 数量数组
   */
  estimateTokensBatch(texts: string[], model: string): number[]
  /**
   * 计算总 Token 数
   *
   * @param texts 输入文本数组
   * @param model 模型名称
   * @returns 总 Token 数量
   */
  calculateTotalTokens(texts: string[], model: string): number
  /**
   * 检测模型类型
   *
   * @param model 模型名称
   * @returns 模型类型
   */
  private detectModelType
  /**
   * GPT 模型 Token 计数（使用 tiktoken）
   *
   * GPT-3.5/GPT-4 使用 cl100k_base 编码
   * 粗略估算：英文 ~4 字符/token，中文 ~2.5 字符/token
   *
   * @param text 输入文本
   * @returns Token 数量
   */
  private countGPTTokens
  /**
   * Claude Token 计数
   *
   * Claude 使用自己的 tokenizer
   * 粗略估算：与 GPT 类似
   *
   * @param text 输入文本
   * @returns Token 数量
   */
  private countClaudeTokens
  /**
   * DeepSeek Token 计数
   *
   * DeepSeek 使用类似 GPT 的编码
   * 但对中文优化更好（实际上是更高效，即更少的 tokens）
   *
   * @param text 输入文本
   * @returns Token 数量
   */
  private countDeepSeekTokens
  /**
   * 通义千问 Token 计数
   *
   * Qwen 对中文支持很好
   *
   * @param text 输入文本
   * @returns Token 数量
   */
  private countQwenTokens
  /**
   * 默认 Token 计数
   *
   * 用于未知模型的粗略估算
   *
   * @param text 输入文本
   * @returns Token 数量
   */
  private defaultTokenCount
  /**
   * 计算文本的 Token 使用率
   *
   * @param text 输入文本
   * @param model 模型名称
   * @param maxTokens 最大 Token 限制
   * @returns 使用率（0-1）
   */
  calculateTokenUsageRate(text: string, model: string, maxTokens: number): number
  /**
   * 检查文本是否超过 Token 限制
   *
   * @param text 输入文本
   * @param model 模型名称
   * @param maxTokens 最大 Token 限制
   * @returns 是否超过限制
   */
  exceedsTokenLimit(text: string, model: string, maxTokens: number): boolean
  /**
   * 截断文本以适应 Token 限制
   *
   * @param text 输入文本
   * @param model 模型名称
   * @param maxTokens 最大 Token 限制
   * @param safetyMargin 安全边际（默认 10%）
   * @returns 截断后的文本
   */
  truncateToTokenLimit(
    text: string,
    model: string,
    maxTokens: number,
    safetyMargin?: number
  ): string
}
/**
 * 创建 Token 计数器（便捷函数）
 *
 * @param config 可选配置
 * @returns Token 计数器实例
 */
export declare function createTokenCounter(): TokenCounter
/**
 * 默认 Token 计数器实例
 */
export declare const tokenCounter: TokenCounter
//# sourceMappingURL=TokenCounter.d.ts.map
