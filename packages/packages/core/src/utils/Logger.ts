/**
 * 结构化日志工具
 *
 * 提供统一的日志接口，支持日志级别和结构化输出
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogEntry {
  level: LogLevel
  timestamp: Date
  message: string
  context?: string
  data?: Record<string, any>
}

export interface LoggerConfig {
  minLevel: LogLevel
  context: string
  enableConsole: boolean
}

/**
 * Logger类
 */
export class Logger {
  private config: LoggerConfig

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      minLevel: config.minLevel ?? LogLevel.INFO,
      context: config.context ?? 'Default',
      enableConsole: config.enableConsole ?? true,
    }
  }

  /**
   * 创建子Logger（继承配置但使用新的context）
   */
  child(context: string): Logger {
    return new Logger({
      ...this.config,
      context,
    })
  }

  /**
   * 设置日志级别
   */
  setLevel(level: LogLevel): void {
    this.config.minLevel = level
  }

  /**
   * 记录日志
   */
  private log(entry: LogEntry): void {
    if (entry.level < this.config.minLevel) {
      return
    }

    const levelName = LogLevel[entry.level]
    const timestamp = entry.timestamp.toISOString()
    const context = entry.context || this.config.context

    const logMessage = `[${timestamp}] [${levelName}] [${context}] ${entry.message}`

    if (this.config.enableConsole) {
      const consoleMethod = this.getConsoleMethod(entry.level)
      if (entry.data) {
        consoleMethod(logMessage, entry.data)
      } else {
        consoleMethod(logMessage)
      }
    }
  }

  /**
   * 获取对应的console方法
   */
  private getConsoleMethod(level: LogLevel): (...args: any[]) => void {
    switch (level) {
      case LogLevel.DEBUG:
        return console.debug
      case LogLevel.INFO:
        return console.info
      case LogLevel.WARN:
        return console.warn
      case LogLevel.ERROR:
        return console.error
      default:
        return console.log
    }
  }

  /**
   * DEBUG级别日志
   */
  debug(message: string, data?: Record<string, any>): void {
    this.log({
      level: LogLevel.DEBUG,
      timestamp: new Date(),
      message,
      context: this.config.context,
      data,
    })
  }

  /**
   * INFO级别日志
   */
  info(message: string, data?: Record<string, any>): void {
    this.log({
      level: LogLevel.INFO,
      timestamp: new Date(),
      message,
      context: this.config.context,
      data,
    })
  }

  /**
   * WARN级别日志
   */
  warn(message: string, data?: Record<string, any>): void {
    this.log({
      level: LogLevel.WARN,
      timestamp: new Date(),
      message,
      context: this.config.context,
      data,
    })
  }

  /**
   * ERROR级别日志
   */
  error(message: string, error?: Error | Record<string, any>): void {
    let data: Record<string, any> | undefined

    if (error instanceof Error) {
      data = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      }
    } else if (error) {
      data = error
    }

    this.log({
      level: LogLevel.ERROR,
      timestamp: new Date(),
      message,
      context: this.config.context,
      data,
    })
  }

  /**
   * 创建测试用的静默Logger
   */
  static silent(context: string = 'Test'): Logger {
    return new Logger({
      minLevel: LogLevel.ERROR,
      context,
      enableConsole: false,
    })
  }
}

/**
 * 创建默认Logger
 */
export function createLogger(context: string): Logger {
  return new Logger({ context })
}
