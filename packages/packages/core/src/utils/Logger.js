/**
 * 结构化日志工具
 *
 * 提供统一的日志接口，支持日志级别和结构化输出
 */
export var LogLevel
;(function (LogLevel) {
  LogLevel[(LogLevel['DEBUG'] = 0)] = 'DEBUG'
  LogLevel[(LogLevel['INFO'] = 1)] = 'INFO'
  LogLevel[(LogLevel['WARN'] = 2)] = 'WARN'
  LogLevel[(LogLevel['ERROR'] = 3)] = 'ERROR'
})(LogLevel || (LogLevel = {}))
/**
 * Logger类
 */
export class Logger {
  config
  constructor(config = {}) {
    this.config = {
      minLevel: config.minLevel ?? LogLevel.INFO,
      context: config.context ?? 'Default',
      enableConsole: config.enableConsole ?? true,
    }
  }
  /**
   * 创建子Logger（继承配置但使用新的context）
   */
  child(context) {
    return new Logger({
      ...this.config,
      context,
    })
  }
  /**
   * 设置日志级别
   */
  setLevel(level) {
    this.config.minLevel = level
  }
  /**
   * 记录日志
   */
  log(entry) {
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
  getConsoleMethod(level) {
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
  debug(message, data) {
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
  info(message, data) {
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
  warn(message, data) {
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
  error(message, error) {
    let data
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
  static silent(context = 'Test') {
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
export function createLogger(context) {
  return new Logger({ context })
}
//# sourceMappingURL=Logger.js.map
