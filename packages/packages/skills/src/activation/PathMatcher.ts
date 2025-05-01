/**
 * 路径匹配引擎
 *
 * 支持 Glob 模式、文件扩展名和正则表达式的路径匹配
 *
 * @package @yunpat/skills
 */

import { minimatch } from 'minimatch'

/**
 * 路径匹配器配置
 */
export interface PathMatcherConfig {
  /** 是否区分大小写 */
  caseSensitive?: boolean

  /** 是否启用缓存 */
  cacheEnabled?: boolean

  /** 缓存最大大小 */
  cacheMaxSize?: number
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: PathMatcherConfig = {
  caseSensitive: false, // 文件路径通常不区分大小写
  cacheEnabled: true,
  cacheMaxSize: 100, // 减小默认缓存大小
}

/**
 * 路径匹配器
 *
 * 高性能的路径匹配引擎，支持 Glob 模式和文件扩展名匹配
 */
export class PathMatcher {
  private config: PathMatcherConfig
  private patternCache: Map<string, RegExp>
  private matchCache: Map<string, boolean>

  constructor(config: PathMatcherConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.patternCache = new Map()
    this.matchCache = new Map()

    // 限制缓存大小
    if (this.config.cacheEnabled) {
      this.limitCacheSize()
    }
  }

  /**
   * 测试路径是否匹配模式
   *
   * @param filePath - 文件路径
   * @param pattern - Glob 模式或文件扩展名
   * @returns 是否匹配
   */
  match(filePath: string, pattern: string): boolean {
    // 检查缓存
    if (this.config.cacheEnabled) {
      const cacheKey = this.getCacheKey(filePath, pattern)
      if (this.matchCache.has(cacheKey)) {
        return this.matchCache.get(cacheKey)!
      }
    }

    // 标准化路径
    const normalizedPath = this.normalizePath(filePath)

    // 执行匹配
    let result: boolean

    if (this.isExtensionPattern(pattern)) {
      // 文件扩展名匹配
      result = this.matchExtension(normalizedPath, pattern)
    } else {
      // Glob 模式匹配
      result = this.matchGlob(normalizedPath, pattern)
    }

    // 缓存结果
    if (this.config.cacheEnabled) {
      const cacheKey = this.getCacheKey(filePath, pattern)
      this.matchCache.set(cacheKey, result)
    }

    return result
  }

  /**
   * 测试路径是否匹配任一模式
   *
   * @param filePath - 文件路径
   * @param patterns - Glob 模式数组
   * @returns 是否匹配任一模式
   */
  matchAny(filePath: string, patterns: string[]): boolean {
    return patterns.some((pattern) => this.match(filePath, pattern))
  }

  /**
   * 批量匹配多个路径
   *
   * @param filePaths - 文件路径数组
   * @param pattern - Glob 模式
   * @returns 匹配结果数组
   */
  matchBatch(filePaths: string[], pattern: string): boolean[] {
    return filePaths.map((path) => this.match(path, pattern))
  }

  /**
   * 从路径列表中筛选匹配的路径
   *
   * @param filePaths - 文件路径数组
   * @param pattern - Glob 模式
   * @returns 匹配的路径数组
   */
  filter(filePaths: string[], pattern: string): string[] {
    return filePaths.filter((path) => this.match(path, pattern))
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.patternCache.clear()
    this.matchCache.clear()
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats(): { patternCacheSize: number; matchCacheSize: number } {
    return {
      patternCacheSize: this.patternCache.size,
      matchCacheSize: this.matchCache.size,
    }
  }

  /**
   * 标准化路径
   *
   * @param path - 原始路径
   * @returns 标准化后的路径
   */
  private normalizePath(path: string): string {
    let normalized = path

    // 统一使用正斜杠
    normalized = normalized.replace(/\\/g, '/')

    // 如果不区分大小写，转换为小写
    if (!this.config.caseSensitive) {
      normalized = normalized.toLowerCase()
    }

    return normalized
  }

  /**
   * 标准化模式
   *
   * @param pattern - 原始模式
   * @returns 标准化后的模式
   */
  private normalizePattern(pattern: string): string {
    let normalized = pattern

    // 统一使用正斜杠
    normalized = normalized.replace(/\\/g, '/')

    // 如果不区分大小写，转换为小写
    if (!this.config.caseSensitive) {
      normalized = normalized.toLowerCase()
    }

    return normalized
  }

  /**
   * 检查是否为扩展名模式
   *
   * @param pattern - 模式字符串
   * @returns 是否为扩展名模式
   */
  private isExtensionPattern(pattern: string): boolean {
    return pattern.startsWith('.') && pattern.indexOf('*') === -1 && pattern.indexOf('?') === -1
  }

  /**
   * 匹配文件扩展名
   *
   * @param filePath - 文件路径
   * @param extension - 文件扩展名（如 `.pdf`）
   * @returns 是否匹配
   */
  private matchExtension(filePath: string, extension: string): boolean {
    const normalizedExt = this.normalizePattern(extension)
    return filePath.endsWith(normalizedExt)
  }

  /**
   * 使用 minimatch 匹配 Glob 模式
   *
   * @param filePath - 文件路径
   * @param pattern - Glob 模式
   * @returns 是否匹配
   */
  private matchGlob(filePath: string, pattern: string): boolean {
    let normalizedPattern = this.normalizePattern(pattern)

    // 如果模式以 ** 开头，可以直接匹配绝对路径
    if (
      !normalizedPattern.startsWith('**') &&
      (filePath.startsWith('/') || filePath.match(/^[a-zA-Z]:/))
    ) {
      // 为绝对路径添加 ** 前缀以匹配任意根路径
      normalizedPattern = '**/' + normalizedPattern
    }

    return minimatch(filePath, normalizedPattern, {
      nocase: !this.config.caseSensitive,
    })
  }

  /**
   * 生成缓存键
   *
   * @param filePath - 文件路径
   * @param pattern - 模式
   * @returns 缓存键
   */
  private getCacheKey(filePath: string, pattern: string): string {
    return `${filePath}::${pattern}`
  }

  /**
   * 限制缓存大小
   */
  private limitCacheSize(): void {
    const maxSize = this.config.cacheMaxSize || DEFAULT_CONFIG.cacheMaxSize!

    // 如果 matchCache 超过限制，清除最早的条目
    while (this.matchCache.size > maxSize) {
      const firstKey = this.matchCache.keys().next().value
      if (firstKey) {
        this.matchCache.delete(firstKey)
      } else {
        break
      }
    }

    // 如果 patternCache 超过限制，清除最早的条目
    while (this.patternCache.size > maxSize) {
      const firstKey = this.patternCache.keys().next().value
      if (firstKey) {
        this.patternCache.delete(firstKey)
      } else {
        break
      }
    }
  }
}

/**
 * 创建路径匹配器（工厂函数）
 *
 * @param config - 匹配器配置
 * @returns 路径匹配器实例
 */
export function createPathMatcher(config?: PathMatcherConfig): PathMatcher {
  return new PathMatcher(config)
}

/**
 * 默认路径匹配器实例
 */
export const defaultPathMatcher = new PathMatcher()

/**
 * 便捷函数：测试路径是否匹配模式
 *
 * @param filePath - 文件路径
 * @param pattern - Glob 模式
 * @returns 是否匹配
 */
export function matchPath(filePath: string, pattern: string): boolean {
  return defaultPathMatcher.match(filePath, pattern)
}

/**
 * 便捷函数：测试路径是否匹配任一模式
 *
 * @param filePath - 文件路径
 * @param patterns - Glob 模式数组
 * @returns 是否匹配任一模式
 */
export function matchAnyPath(filePath: string, patterns: string[]): boolean {
  return defaultPathMatcher.matchAny(filePath, patterns)
}
