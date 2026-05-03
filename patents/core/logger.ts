/**
 * 日志系统
 *
 * 为审查答复智能体系统提供结构化的日志记录功能
 */

import { writeFileSync, appendFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { STORAGE_CONSTANTS } from './constants.js'

/**
 * 日志级别
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * 日志元数据
 */
export interface LogMetadata {
  /** 模块名称 */
  module?: string

  /** 操作名称 */
  operation?: string

  /** 关联 ID */
  correlationId?: string

  /** 用户 ID */
  userId?: string

  /** 额外的上下文数据 */
  [key: string]: any
}

/**
 * 敏感字段配置
 */
interface SanitizationConfig {
  /** 敏感字段列表 */
  sensitiveFields: string[]
  /** 脱敏替换文本 */
  replacementText: string
  /** 是否启用深度脱敏（哈希处理） */
  enableDeepSanitization: boolean
}

/**
 * 日志条目
 */
export interface LogEntry {
  /** 时间戳 */
  timestamp: string

  /** 日志级别 */
  level: LogLevel

  /** 消息 */
  message: string

  /** 元数据 */
  metadata?: LogMetadata

  /** 错误对象 */
  error?: {
    name: string
    message: string
    stack?: string
    code?: string
  }
}

/**
 * 日志配置
 */
export interface LoggerConfig {
  /** 最小日志级别 */
  minLevel?: LogLevel

  /** 是否输出到控制台 */
  console?: boolean

  /** 是否输出到文件 */
  file?: boolean

  /** 日志文件路径 */
  logFilePath?: string

  /** 是否启用颜色 */
  colors?: boolean

  /** 是否启用时间戳 */
  timestamp?: boolean

  /** 日志格式化函数 */
  formatter?: (entry: LogEntry) => string
}

/**
 * 日志器类
 */
export class Logger {
  private static instance: Logger
  private config: Required<LoggerConfig>
  private logBuffer: LogEntry[] = []
  private flushInterval: NodeJS.Timeout | null = null
  private sanitizationConfig: SanitizationConfig = {
    sensitiveFields: [
      'password',
      'passwd',
      'pwd',
      'token',
      'apiKey',
      'api_key',
      'apikey',
      'secret',
      'authorization',
      'auth',
      'sessionId',
      'session_id',
      'cookie',
      'creditCard',
      'ssn',
      'privateKey',
      'private_key',
    ],
    replacementText: '***REDACTED***',
    enableDeepSanitization: false,
  }

  private constructor(config: LoggerConfig = {}) {
    this.config = {
      minLevel: config.minLevel ?? LogLevel.INFO,
      console: config.console ?? true,
      file: config.file ?? false,
      logFilePath: config.logFilePath ?? './logs/app.log',
      colors: config.colors ?? true,
      timestamp: config.timestamp ?? true,
      formatter: config.formatter ?? this.defaultFormatter.bind(this),
    }

    // 创建日志目录
    if (this.config.file) {
      const logDir = join(process.cwd(), 'logs')
      if (!existsSync(logDir)) {
        mkdirSync(logDir, { recursive: true })
      }
    }

    // 定期刷新日志到文件
    if (this.config.file) {
      this.flushInterval = setInterval(() => {
        this.flushToFile()
      }, 5000) // 每5秒刷新一次
    }
  }

  /**
   * 获取单例实例
   */
  static getInstance(config?: LoggerConfig): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(config)
    }
    return Logger.instance
  }

  /**
   * 记录 DEBUG 级别日志
   */
  debug(message: string, metadata?: LogMetadata): void {
    this.log(LogLevel.DEBUG, message, metadata)
  }

  /**
   * 记录 INFO 级别日志
   */
  info(message: string, metadata?: LogMetadata): void {
    this.log(LogLevel.INFO, message, metadata)
  }

  /**
   * 记录 WARN 级别日志
   */
  warn(message: string, metadata?: LogMetadata): void {
    this.log(LogLevel.WARN, message, metadata)
  }

  /**
   * 记录 ERROR 级别日志
   */
  error(message: string, error?: Error, metadata?: LogMetadata): void {
    const entry = this.createLogEntry(LogLevel.ERROR, message, metadata)

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as any).code,
      }
    }

    this.writeLog(entry)
  }

  /**
   * 记录日志
   */
  private log(level: LogLevel, message: string, metadata?: LogMetadata): void {
    if (level < this.config.minLevel) {
      return
    }

    const entry = this.createLogEntry(level, message, metadata)
    this.writeLog(entry)
  }

  /**
   * 脱敏敏感信息
   */
  private sanitize(metadata: LogMetadata): LogMetadata {
    if (!metadata || typeof metadata !== 'object') {
      return metadata
    }

    const sanitized = { ...metadata }

    for (const key of Object.keys(sanitized)) {
      const lowerKey = key.toLowerCase()

      // 检查是否为敏感字段（字段名包含敏感词 或 敏感词包含字段名）
      const isSensitive = this.sanitizationConfig.sensitiveFields.some((field) => {
        const lowerField = field.toLowerCase()
        return lowerKey.includes(lowerField) || lowerField.includes(lowerKey)
      })

      if (isSensitive) {
        if (this.sanitizationConfig.enableDeepSanitization) {
          // 深度脱敏：使用哈希值（保留长度用于调试）
          const originalValue = String(sanitized[key])
          sanitized[key] = `HASH:${this.hashCode(originalValue).toString(36)}`
        } else {
          // 标准脱敏：替换为占位符
          sanitized[key] = this.sanitizationConfig.replacementText
        }
        continue
      }

      // 递归处理嵌套对象
      if (sanitized[key] && typeof sanitized[key] === 'object' && !Array.isArray(sanitized[key])) {
        sanitized[key] = this.sanitize(sanitized[key] as LogMetadata)
      }

      // 处理数组中的对象
      if (Array.isArray(sanitized[key])) {
        sanitized[key] = (sanitized[key] as any[]).map((item) =>
          typeof item === 'object' && item !== null ? this.sanitize(item) : item
        )
      }
    }

    return sanitized
  }

  /**
   * 计算字符串哈希值
   */
  private hashCode(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32bit integer
    }
    return Math.abs(hash)
  }

  /**
   * 配置脱敏设置
   */
  configureSanitization(config: Partial<SanitizationConfig>): void {
    if (config.sensitiveFields) {
      this.sanitizationConfig.sensitiveFields = config.sensitiveFields
    }
    if (config.replacementText !== undefined) {
      this.sanitizationConfig.replacementText = config.replacementText
    }
    if (config.enableDeepSanitization !== undefined) {
      this.sanitizationConfig.enableDeepSanitization = config.enableDeepSanitization
    }
  }

  /**
   * 创建日志条目
   */
  private createLogEntry(level: LogLevel, message: string, metadata?: LogMetadata): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      metadata: this.sanitize(metadata),
    }
  }

  /**
   * 写入日志
   */
  private writeLog(entry: LogEntry): void {
    // 格式化日志
    const formatted = this.config.formatter(entry)

    // 输出到控制台
    if (this.config.console) {
      const colorized = this.config.colors ? this.colorize(formatted, entry.level) : formatted
      console.log(colorized)
    }

    // 添加到缓冲区（稍后写入文件）
    if (this.config.file) {
      this.logBuffer.push(entry)

      // 如果缓冲区太大，立即刷新
      if (this.logBuffer.length >= 100) {
        this.flushToFile()
      }
    }
  }

  /**
   * 刷新缓冲区到文件
   */
  private flushToFile(): void {
    if (this.logBuffer.length === 0) {
      return
    }

    try {
      const logs = this.logBuffer.map((entry) => this.config.formatter(entry)).join('\n')

      appendFileSync(this.config.logFilePath, logs + '\n')
      this.logBuffer = []
    } catch (error) {
      console.error('[Logger] 写入日志文件失败:', error)
    }
  }

  /**
   * 默认格式化器
   */
  private defaultFormatter(entry: LogEntry): string {
    const parts: string[] = []

    if (this.config.timestamp) {
      parts.push(`[${entry.timestamp}]`)
    }

    const levelName = LogLevel[entry.level]
    parts.push(`[${levelName}]`)

    if (entry.metadata?.module) {
      parts.push(`[${entry.metadata.module}]`)
    }

    parts.push(entry.message)

    if (entry.metadata) {
      const metaStr = Object.entries(entry.metadata)
        .filter(([key]) => key !== 'module')
        .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
        .join(' ')
      if (metaStr) {
        parts.push(`| ${metaStr}`)
      }
    }

    if (entry.error) {
      parts.push(`| Error: ${entry.error.name}: ${entry.error.message}`)
    }

    return parts.join(' ')
  }

  /**
   * 颜色化日志
   */
  private colorize(text: string, level: LogLevel): string {
    const colors = {
      [LogLevel.DEBUG]: '\x1b[36m', // 青色
      [LogLevel.INFO]: '\x1b[32m', // 绿色
      [LogLevel.WARN]: '\x1b[33m', // 黄色
      [LogLevel.ERROR]: '\x1b[31m', // 红色
    }

    const reset = '\x1b[0m'
    const color = colors[level]

    return `${color}${text}${reset}`
  }

  /**
   * 设置日志级别
   */
  setLevel(level: LogLevel): void {
    this.config.minLevel = level
  }

  /**
   * 关闭日志器
   */
  close(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval)
      this.flushInterval = null
    }
    this.flushToFile()
  }

  /**
   * 创建子日志器（带默认元数据）
   */
  createChild(defaultMetadata: LogMetadata): ChildLogger {
    return new ChildLogger(this, defaultMetadata)
  }
}

/**
 * 子日志器类（带默认元数据）
 */
export class ChildLogger {
  constructor(
    private parent: Logger,
    private defaultMetadata: LogMetadata
  ) {}

  debug(message: string, metadata?: LogMetadata): void {
    this.parent.debug(message, { ...this.defaultMetadata, ...metadata })
  }

  info(message: string, metadata?: LogMetadata): void {
    this.parent.info(message, { ...this.defaultMetadata, ...metadata })
  }

  warn(message: string, metadata?: LogMetadata): void {
    this.parent.warn(message, { ...this.defaultMetadata, ...metadata })
  }

  error(message: string, error?: Error, metadata?: LogMetadata): void {
    this.parent.error(message, error, { ...this.defaultMetadata, ...metadata })
  }

  /**
   * 创建带有操作 ID 的日志器
   */
  withOperation(operation: string): ChildLogger {
    return new ChildLogger(this.parent, {
      ...this.defaultMetadata,
      operation,
    })
  }

  /**
   * 创建带有关联 ID 的日志器
   */
  withCorrelationId(correlationId: string): ChildLogger {
    return new ChildLogger(this.parent, {
      ...this.defaultMetadata,
      correlationId,
    })
  }
}

/**
 * 性能日志器
 */
export class PerformanceLogger {
  private logger: Logger
  private timers = new Map<string, number>()

  constructor(logger?: Logger) {
    this.logger = logger ?? Logger.getInstance()
  }

  /**
   * 开始计时
   */
  startTimer(key: string): void {
    this.timers.set(key, Date.now())
  }

  /**
   * 结束计时并记录
   */
  endTimer(key: string, metadata?: LogMetadata): number {
    const startTime = this.timers.get(key)
    if (!startTime) {
      this.logger.warn(`计时器 ${key} 未启动`, metadata)
      return 0
    }

    const duration = Date.now() - startTime
    this.timers.delete(key)

    this.logger.info(`操作 ${key} 完成`, {
      ...metadata,
      operation: key,
      durationMs: duration,
    })

    return duration
  }

  /**
   * 测量异步操作
   */
  async measure<T>(key: string, fn: () => Promise<T>, metadata?: LogMetadata): Promise<T> {
    this.startTimer(key)
    try {
      return await fn()
    } finally {
      this.endTimer(key, metadata)
    }
  }

  /**
   * 测量同步操作
   */
  measureSync<T>(key: string, fn: () => T, metadata?: LogMetadata): T {
    this.startTimer(key)
    try {
      return fn()
    } finally {
      this.endTimer(key, metadata)
    }
  }
}

/**
 * 结构化日志器（用于特定模块）
 */
export class StructuredLogger {
  private logger: ChildLogger

  constructor(moduleName: string) {
    const parentLogger = Logger.getInstance()
    this.logger = parentLogger.createChild({ module: moduleName })
  }

  /**
   * 记录操作开始
   */
  logOperationStart(operation: string, details?: Record<string, any>): void {
    this.logger.info(`开始操作: ${operation}`, {
      operation,
      phase: 'start',
      ...details,
    })
  }

  /**
   * 记录操作完成
   */
  logOperationEnd(operation: string, result?: Record<string, any>, duration?: number): void {
    this.logger.info(`完成操作: ${operation}`, {
      operation,
      phase: 'end',
      ...result,
      duration,
    })
  }

  /**
   * 记录操作失败
   */
  logOperationFailure(operation: string, error: Error, details?: Record<string, any>): void {
    this.logger.error(`操作失败: ${operation}`, error, {
      operation,
      phase: 'failed',
      ...details,
    })
  }

  /**
   * 记录状态变更
   */
  logStateChange(from: string, to: string, details?: Record<string, any>): void {
    this.logger.info(`状态变更: ${from} → ${to}`, {
      phase: 'state_change',
      from,
      to,
      ...details,
    })
  }

  /**
   * 记录指标
   */
  logMetric(name: string, value: number, unit?: string): void {
    this.logger.info(`指标: ${name}`, {
      phase: 'metric',
      metric: name,
      value,
      unit,
    })
  }

  /**
   * 记录 DEBUG 级别日志
   */
  debug(message: string, metadata?: LogMetadata): void {
    this.logger.debug(message, metadata)
  }

  /**
   * 记录 INFO 级别日志
   */
  info(message: string, metadata?: LogMetadata): void {
    this.logger.info(message, metadata)
  }

  /**
   * 记录 WARN 级别日志
   */
  warn(message: string, metadata?: LogMetadata): void {
    this.logger.warn(message, metadata)
  }

  /**
   * 记录 ERROR 级别日志
   */
  error(message: string, error?: Error, metadata?: LogMetadata): void {
    this.logger.error(message, error, metadata)
  }
}

// ============================================
// 全局日志器实例
// ============================================

export const logger = Logger.getInstance({
  minLevel: process.env.LOG_LEVEL
    ? LogLevel[process.env.LOG_LEVEL as keyof typeof LogLevel]
    : LogLevel.INFO,
  console: true,
  file: process.env.NODE_ENV === 'production',
})

export const performanceLogger = new PerformanceLogger(logger)

// ============================================
// 便捷函数
// ============================================

/**
 * 创建模块日志器
 */
export function createModuleLogger(moduleName: string): StructuredLogger {
  return new StructuredLogger(moduleName)
}

/**
 * 设置全局日志级别
 */
export function setLogLevel(level: LogLevel): void {
  logger.setLevel(level)
}

/**
 * 刷新日志
 */
export function flushLogs(): void {
  logger.close()
}
