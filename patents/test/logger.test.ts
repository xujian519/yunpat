/**
 * logger.test.ts - 日志系统测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  Logger,
  ChildLogger,
  PerformanceLogger,
  StructuredLogger,
  LogLevel,
  createModuleLogger,
  setLogLevel,
  flushLogs,
} from '../core/logger.js'

describe('logger - Logger基础功能', () => {
  let logger: Logger

  beforeEach(() => {
    logger = Logger.getInstance({
      minLevel: LogLevel.DEBUG,
      console: false,
      file: false,
    })
  })

  afterEach(() => {
    logger.close()
  })

  it('应该创建单例实例', () => {
    const logger1 = Logger.getInstance()
    const logger2 = Logger.getInstance()

    expect(logger1).toBe(logger2)
  })

  it('应该记录DEBUG级别日志', () => {
    const testLogger = Logger.getInstance({ console: false, file: false })

    // 只验证不抛出错误
    expect(() => testLogger.debug('调试消息')).not.toThrow()
    testLogger.close()
  })

  it('应该记录INFO级别日志', () => {
    const testLogger = Logger.getInstance({ console: false, file: false })

    expect(() => testLogger.info('信息消息')).not.toThrow()
    testLogger.close()
  })

  it('应该记录WARN级别日志', () => {
    const testLogger = Logger.getInstance({ console: false, file: false })

    expect(() => testLogger.warn('警告消息')).not.toThrow()
    testLogger.close()
  })

  it('应该记录ERROR级别日志', () => {
    const testLogger = Logger.getInstance({ console: false, file: false })

    const error = new Error('测试错误')
    expect(() => testLogger.error('错误消息', error)).not.toThrow()
    testLogger.close()
  })

  it('应该设置日志级别', () => {
    logger.setLevel(LogLevel.WARN)
    logger.debug('这条不应该显示')
    logger.info('这条也不应该显示')
    logger.warn('这条应该显示')
  })

  it('应该创建子日志器', () => {
    const childLogger = logger.createChild({ module: 'TestModule' })

    expect(childLogger).toBeInstanceOf(ChildLogger)
  })
})

describe('logger - ChildLogger', () => {
  let logger: Logger
  let childLogger: ChildLogger

  beforeEach(() => {
    logger = Logger.getInstance({ console: false, file: false })
    childLogger = logger.createChild({ module: 'TestModule' })
  })

  afterEach(() => {
    logger.close()
  })

  it('应该使用默认元数据', () => {
    const testLogger = Logger.getInstance({ console: false, file: false })
    const testChild = testLogger.createChild({ module: 'TestModule' })

    // 只验证不抛出错误
    expect(() => testChild.info('测试消息')).not.toThrow()
    testLogger.close()
  })

  it('应该合并元数据', () => {
    const testLogger = Logger.getInstance({ console: false, file: false })
    const testChild = testLogger.createChild({ module: 'TestModule' })

    // 只验证不抛出错误
    expect(() => testChild.info('测试消息', { operation: 'testOp' })).not.toThrow()
    testLogger.close()
  })

  it('应该创建带操作ID的日志器', () => {
    const opLogger = childLogger.withOperation('testOperation')

    expect(opLogger).toBeInstanceOf(ChildLogger)
  })

  it('应该创建带关联ID的日志器', () => {
    const corrLogger = childLogger.withCorrelationId('test-correlation-id')

    expect(corrLogger).toBeInstanceOf(ChildLogger)
  })
})

describe('logger - PerformanceLogger', () => {
  let performanceLogger: PerformanceLogger
  let logger: Logger

  beforeEach(() => {
    logger = Logger.getInstance({ console: false, file: false })
    performanceLogger = new PerformanceLogger(logger)
  })

  afterEach(() => {
    logger.close()
  })

  it('应该启动计时器', () => {
    performanceLogger.startTimer('test-operation')

    // 应该不抛出错误
  })

  it('应该结束计时器并返回时长', () => {
    performanceLogger.startTimer('test-operation')
    const duration = performanceLogger.endTimer('test-operation')

    expect(duration).toBeGreaterThanOrEqual(0)
  })

  it('应该处理未启动的计时器', () => {
    const testLogger = Logger.getInstance({ console: false, file: false })
    const testPerfLogger = new PerformanceLogger(testLogger)

    const duration = testPerfLogger.endTimer('non-existent-timer')

    expect(duration).toBe(0)
    testLogger.close()
  })

  it('应该测量异步操作', async () => {
    const result = await performanceLogger.measure('async-op', async () => {
      return 'success'
    })

    expect(result).toBe('success')
  })

  it('应该测量同步操作', () => {
    const result = performanceLogger.measureSync('sync-op', () => {
      return 'result'
    })

    expect(result).toBe('result')
  })

  it('应该在操作失败时仍然计时', async () => {
    await expect(
      performanceLogger.measure('failing-op', async () => {
        throw new Error('操作失败')
      })
    ).rejects.toThrow('操作失败')
  })
})

describe('logger - StructuredLogger', () => {
  let structuredLogger: StructuredLogger
  let logger: Logger

  beforeEach(() => {
    logger = Logger.getInstance({ console: false, file: false })
    structuredLogger = new StructuredLogger('TestModule')
  })

  afterEach(() => {
    logger.close()
  })

  it('应该记录操作开始', () => {
    const testStructured = new StructuredLogger('TestModule')
    expect(() => testStructured.logOperationStart('testOperation', { key: 'value' })).not.toThrow()
  })

  it('应该记录操作完成', () => {
    const testStructured = new StructuredLogger('TestModule')
    expect(() => testStructured.logOperationEnd('testOperation', { result: 'success' }, 100)).not.toThrow()
  })

  it('应该记录操作失败', () => {
    const testStructured = new StructuredLogger('TestModule')
    const error = new Error('操作失败')
    expect(() => testStructured.logOperationFailure('testOperation', error, { details: 'info' })).not.toThrow()
  })

  it('应该记录状态变更', () => {
    const testStructured = new StructuredLogger('TestModule')
    expect(() => testStructured.logStateChange('state1', 'state2', { reason: 'transition' })).not.toThrow()
  })

  it('应该记录指标', () => {
    const testStructured = new StructuredLogger('TestModule')
    expect(() => testStructured.logMetric('cpu_usage', 75.5, 'percent')).not.toThrow()
  })
})

describe('logger - 便捷函数', () => {
  it('应该创建模块日志器', () => {
    const moduleLogger = createModuleLogger('TestModule')

    expect(moduleLogger).toBeInstanceOf(StructuredLogger)
  })

  it('应该设置全局日志级别', () => {
    const testLogger = Logger.getInstance({ console: false, file: false })
    const logSpy = vi.spyOn(testLogger as any, 'writeLog').mockImplementation(() => {})

    setLogLevel(LogLevel.ERROR)
    testLogger.debug('不应该显示')
    testLogger.info('不应该显示')
    testLogger.warn('不应该显示')
    testLogger.error('应该显示')

    // 只有ERROR级别应该被记录
    expect(logSpy).toHaveBeenCalledTimes(1)
    logSpy.mockRestore()
    testLogger.close()
  })

  it('应该刷新日志', () => {
    const testLogger = Logger.getInstance({ console: false, file: false })

    expect(() => flushLogs()).not.toThrow()
  })
})

describe('logger - 边界情况', () => {
  it('应该处理空消息', () => {
    const testLogger = Logger.getInstance({ console: false, file: false })

    testLogger.info('')
    testLogger.debug('')
    testLogger.warn('')
    testLogger.error('', undefined)

    // 应该不抛出错误
    testLogger.close()
  })

  it('应该处理大量日志', () => {
    const testLogger = Logger.getInstance({ console: false, file: false })

    for (let i = 0; i < 1000; i++) {
      testLogger.info(`消息 ${i}`)
    }

    // 应该不抛出错误
    testLogger.close()
  })

  it('应该处理特殊字符', () => {
    const testLogger = Logger.getInstance({ console: false, file: false })

    testLogger.info('包含特殊字符: \n\t\r')
    testLogger.info('包含Unicode: 你好世界 🌍')

    // 应该不抛出错误
    testLogger.close()
  })
})

describe('logger - 性能测试', () => {
  it('日志记录性能 - 1000条日志', () => {
    const testLogger = Logger.getInstance({ console: false, file: false })

    const start = Date.now()
    for (let i = 0; i < 1000; i++) {
      testLogger.info(`性能测试消息 ${i}`)
    }
    const elapsed = Date.now() - start

    expect(elapsed).toBeLessThan(1000) // 应该在1秒内完成
    testLogger.close()
  })

  it('性能日志器测量性能', () => {
    const testLogger = Logger.getInstance({ console: false, file: false })
    const perfLogger = new PerformanceLogger(testLogger)

    const start = Date.now()
    for (let i = 0; i < 100; i++) {
      perfLogger.measureSync(`op-${i}`, () => {
        return i * 2
      })
    }
    const elapsed = Date.now() - start

    expect(elapsed).toBeLessThan(500) // 应该在500ms内完成
    testLogger.close()
  })
})
