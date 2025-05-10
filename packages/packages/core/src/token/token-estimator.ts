/**
 * Token 估算器
 *
 * 借鉴 Claude Code 的两级计数策略：
 * - 近似估算（毫秒级）：用于热路径的快速检查
 * - 精确计数（API 调用）：用于关键决策点
 *
 * 针对中文专利文本优化：
 * - 中文字符：约 1.5 tokens/字
 * - 英文单词：约 1.3 tokens/词
 * - JSON/结构化文本：约 2 tokens/字符（符号密集）
 */

/**
 * 内容类型
 */
export type ContentType =
  | 'chinese_text' // 中文专利文本
  | 'english_text' // 英文文本
  | 'mixed_text' // 中英混合
  | 'json' // JSON/结构化数据
  | 'markdown' // Markdown 文档
  | 'code' // 代码
  | 'base64_image' // Base64 编码图片
  | 'table' // 表格数据

/**
 * Token 估算选项
 */
export interface EstimateOptions {
  /** 内容类型 */
  contentType?: ContentType
  /** 是否保守估算（向上取整） */
  conservative?: boolean
}

/**
 * 各内容类型的 tokens/字符比率
 */
const TOKEN_RATIOS: Record<ContentType, number> = {
  chinese_text: 1.5, // 中文专利文本
  english_text: 0.3, // 英文字符（按字符计，非按单词）
  mixed_text: 1.0, // 中英混合（保守估计）
  json: 0.5, // JSON 符号密集
  markdown: 0.4, // Markdown 文档
  code: 0.4, // 代码
  base64_image: 1.33, // Base64 每字符约 4/3 tokens（但通常整体按图片尺寸估算）
  table: 0.5, // 表格（CSV/TSV 格式）
}

/**
 * 图片估算参数
 */
export interface ImageEstimateParams {
  width: number
  height: number
  detail?: 'low' | 'high' | 'auto'
}

/**
 * 估算文本内容的 token 数
 */
export function estimateTextTokens(text: string, options: EstimateOptions = {}): number {
  const contentType = options.contentType ?? detectContentType(text)
  const ratio = TOKEN_RATIOS[contentType]

  let tokens = 0

  if (contentType === 'chinese_text' || contentType === 'mixed_text') {
    // 对中文内容逐字符估算
    for (const char of text) {
      if (/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/.test(char)) {
        tokens += 1.5
      } else if (/[a-zA-Z]/.test(char)) {
        tokens += 0.3
      } else if (/\d/.test(char)) {
        tokens += 0.5
      } else {
        tokens += 0.3
      }
    }
  } else {
    tokens = text.length * ratio
  }

  // 保守模式：向上取整 10%
  if (options.conservative) {
    tokens *= 1.1
  }

  return Math.ceil(tokens)
}

/**
 * 估算多条消息的 token 总数
 */
export function estimateMessagesTokens(
  messages: Array<{ role: string; content: string }>,
  options: EstimateOptions = {}
): number {
  let total = 0
  for (const msg of messages) {
    // 每条消息有固定开销（角色标记等）
    total += 4 // 消息格式开销
    total += estimateTextTokens(msg.content, options)
  }
  // 整体对话格式开销
  total += 2
  return Math.ceil(total)
}

/**
 * 估算图片的 token 数
 *
 * 参考 Claude API 图片 token 计算方式：
 * - low detail: ~85 tokens
 * - high detail: 根据尺寸计算
 */
export function estimateImageTokens(params: ImageEstimateParams): number {
  if (params.detail === 'low') {
    return 85
  }

  // high detail: 图像被缩放为最长边 1568px 的方形
  // 然后分割为 784x784 的图块，每个图块约 170 tokens
  const maxSide = Math.max(params.width, params.height)
  const scaleFactor = maxSide > 1568 ? 1568 / maxSide : 1
  const scaledWidth = params.width * scaleFactor
  const scaledHeight = params.height * scaleFactor

  const tilesX = Math.ceil(scaledWidth / 784)
  const tilesY = Math.ceil(scaledHeight / 784)
  const totalTiles = tilesX * tilesY

  return 85 + totalTiles * 170
}

/**
 * 估算 Base64 图片字符串的 token 数
 */
export function estimateBase64ImageTokens(base64String: string, detail?: 'low' | 'high'): number {
  // 从 Base64 推断大致尺寸（非常粗略）
  // 去掉 data URI 前缀
  const clean = base64String.replace(/^data:image\/\w+;base64,/, '')
  // 每像素约 4 bytes (RGBA)，Base64 每 3 bytes → 4 chars
  // 所以总像素 ≈ clean.length * 3 / 4 / 4 = clean.length / 5.33
  const estimatedPixels = clean.length / 5.33
  const estimatedSide = Math.sqrt(estimatedPixels)

  return estimateImageTokens({
    width: estimatedSide,
    height: estimatedSide,
    detail: detail ?? 'auto',
  })
}

/**
 * 自动检测内容类型
 */
function detectContentType(text: string): ContentType {
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length
  const totalChars = text.length
  const chineseRatio = chineseChars / totalChars

  if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
    return 'json'
  }

  if (text.includes('```') || text.includes('    ')) {
    return 'code'
  }

  if (chineseRatio > 0.5) {
    return 'chinese_text'
  }

  if (chineseRatio > 0.1) {
    return 'mixed_text'
  }

  return 'english_text'
}

/**
 * Token 估算器类（支持批量和缓存）
 */
export class TokenEstimator {
  private cache = new Map<string, number>()
  private cacheHits = 0
  private cacheMisses = 0

  /**
   * 估算文本 token 数（带缓存）
   */
  estimate(text: string, options?: EstimateOptions): number {
    const cacheKey = `${text.length}_${options?.contentType}_${options?.conservative}`

    if (this.cache.has(cacheKey)) {
      this.cacheHits++
      return this.cache.get(cacheKey)!
    }

    this.cacheMisses++
    const tokens = estimateTextTokens(text, options)
    this.cache.set(cacheKey, tokens)
    return tokens
  }

  /**
   * 批量估算
   */
  estimateBatch(texts: string[], options?: EstimateOptions): number[] {
    return texts.map((t) => this.estimate(t, options))
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear()
    this.cacheHits = 0
    this.cacheMisses = 0
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): { hits: number; misses: number; hitRate: number } {
    const total = this.cacheHits + this.cacheMisses
    return {
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRate: total > 0 ? this.cacheHits / total : 0,
    }
  }
}

/**
 * 全局 Token 估算器实例
 */
export const tokenEstimator = new TokenEstimator()
