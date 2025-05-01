/**
 * 结构化日志工具
 *
 * 提供统一的日志接口，支持日志级别和结构化输出
 */
export declare enum LogLevel {
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
export declare class Logger {
  private config
  constructor(config?: Partial<LoggerConfig>)
  /**
   * 创建子Logger（继承配置但使用新的context）
   */
  child(context: string): Logger
  /**
   * 设置日志级别
   */
  setLevel(level: LogLevel): void
  /**
   * 记录日志
   */
  private log
  /**
   * 获取对应的console方法
   */
  private getConsoleMethod
  /**
   * DEBUG级别日志
   */
  debug(message: string, data?: Record<string, any>): void
  /**
   * INFO级别日志
   */
  info(message: string, data?: Record<string, any>): void
  /**
   * WARN级别日志
   */
  warn(message: string, data?: Record<string, any>): void
  /**
   * ERROR级别日志
   */
  error(message: string, error?: Error | Record<string, any>): void
  /**
   * 创建测试用的静默Logger
   */
  static silent(context?: string): Logger
}
/**
 * 创建默认Logger
 */
export declare function createLogger(context: string): Logger
//# sourceMappingURL=Logger.d.ts.map
