/**
 * errors.test.ts - 错误处理模块测试
 */

import { describe, test, expect } from '@jest/globals'
import {
  OAResponderError,
  ExaminerSimulatorError,
  SuccessPredictorError,
  HebbianOptimizerError,
  ValidationError,
  ConfigurationError,
  LLMInvokeError,
  StorageError,
} from '../errors.js'

describe('errors - 错误类层次结构', () => {
  test('OAResponderError 应该创建基础错误', () => {
    const error = new OAResponderError('测试错误', {
      field1: 'value1',
      field2: 'value2',
    })

    expect(error).toBeInstanceOf(OAResponderError)
    expect(error.message).toBe('测试错误')
    expect(error.name).toBe('OAResponderError')
    expect(error.context).toEqual({
      field1: 'value1',
      field2: 'value2',
    })
  })

  test('OAResponderError 应该支持错误链', () => {
    const cause = new Error('原始错误')
    const error = new OAResponderError('包装错误', {}, { cause })

    expect(error.cause).toBe(cause)
  })

  test('OAResponderError 应该生成正确的堆栈跟踪', () => {
    const error = new OAResponderError('堆栈测试')

    expect(error.stack).toContain('OAResponderError')
    expect(error.stack).toContain('堆栈测试')
  })

  test('ExaminerSimulatorError 应该继承 OAResponderError', () => {
    const error = new ExaminerSimulatorError('测试错误', {
      operation: 'simulateReview',
    })

    expect(error).toBeInstanceOf(OAResponderError)
    expect(error).toBeInstanceOf(ExaminerSimulatorError)
    expect(error.name).toBe('ExaminerSimulatorError')
  })

  test('SuccessPredictorError 应该继承 OAResponderError', () => {
    const error = new SuccessPredictorError('测试错误', {
      operation: 'predict',
    })

    expect(error).toBeInstanceOf(OAResponderError)
    expect(error).toBeInstanceOf(SuccessPredictorError)
  })

  test('HebbianOptimizerError 应该继承 OAResponderError', () => {
    const error = new HebbianOptimizerError('测试错误', {
      operation: 'optimize',
    })

    expect(error).toBeInstanceOf(OAResponderError)
    expect(error).toBeInstanceOf(HebbianOptimizerError)
  })
})

describe('errors - 验证错误', () => {
  test('ValidationError 应该包含字段名和值', () => {
    const error = new ValidationError(
      '字段验证失败',
      'fieldName',
      'fieldValue'
    )

    expect(error.message).toBe('字段验证失败')
    expect(error.fieldName).toBe('fieldName')
    expect(error.fieldValue).toBe('fieldValue')
  })

  test('ValidationError 应该包含在错误上下文中', () => {
    const error = new ValidationError('错误', 'field', 'value')

    expect(error.context).toEqual({
      fieldName: 'field',
      fieldValue: 'value',
    })
  })
})

describe('errors - 配置错误', () => {
  test('ConfigurationError 应该包含配置路径', () => {
    const error = new ConfigurationError(
      '配置错误',
      'config.json',
      'missingField'
    )

    expect(error.message).toBe('配置错误')
    expect(error.configPath).toBe('config.json')
    expect(error.missingField).toBe('missingField')
  })
})

describe('errors - LLM调用错误', () => {
  test('LLMInvokeError 应该包含模块和方法信息', () => {
    const error = new LLMInvokeError(
      'LLM调用失败',
      'ModuleName',
      'methodName',
      { cause: new Error('网络错误') }
    )

    expect(error.message).toBe('LLM调用失败')
    expect(error.moduleName).toBe('ModuleName')
    expect(error.methodName).toBe('methodName')
    expect(error.cause).toBeInstanceOf(Error)
  })

  test('LLMInvokeError 应该区分不同的错误码', () => {
    const error1 = new LLMInvokeError(
      '超时错误',
      'ModuleName',
      'methodName',
      { code: 'TIMEOUT' }
    )

    const error2 = new LLMInvokeError(
      'API错误',
      'ModuleName',
      'methodName',
      { code: 'API_ERROR' }
    )

    expect(error1.code).toBe('TIMEOUT')
    expect(error2.code).toBe('API_ERROR')
  })
})

describe('errors - 存储错误', () => {
  test('StorageError 应该包含操作类型和路径', () => {
    const error = new StorageError(
      '存储失败',
      'write',
      '/path/to/file.json'
    )

    expect(error.message).toBe('存储失败')
    expect(error.operation).toBe('write')
    expect(error.path).toBe('/path/to/file.json')
  })

  test('StorageError 应该支持读取操作', () => {
    const error = new StorageError(
      '读取失败',
      'read',
      '/path/to/file.json'
    )

    expect(error.operation).toBe('read')
  })

  test('StorageError 应该支持删除操作', () => {
    const error = new StorageError(
      '删除失败',
      'delete',
      '/path/to/file.json'
    )

    expect(error.operation).toBe('delete')
  })
})

describe('errors - 错误恢复', () => {
  test('ErrorRecovery 应该注册和执行恢复策略', () => {
    const { ErrorRecovery } = require('../errors.js')
    const recovery = new ErrorRecovery()

    let executed = false
    recovery.register('TEST_ERROR', async () => {
      executed = true
      return 'recovered'
    })

    const result = await recovery.recover(new Error('TEST_ERROR'))

    expect(executed).toBe(true)
    expect(result).toBe('recovered')
  })

  test('ErrorRecovery 应该处理未注册的错误', async () => {
    const { ErrorRecovery } = require('../errors.js')
    const recovery = new ErrorRecovery()

    const result = await recovery.recover(new Error('UNKNOWN_ERROR'))

    expect(result).toBeNull()
  })

  test('ErrorRecovery 应该支持链式恢复', async () => {
    const { ErrorRecovery } = require('../errors.js')
    const recovery = new ErrorRecovery()

    let order: string[] = []

    recovery.register('ERROR1', async () => {
      order.push('step1')
      return 'step1'
    })

    recovery.register('ERROR2', async () => {
      order.push('step2')
      throw new Error('ERROR1')
    })

    recovery.register('ERROR1', async () => {
      order.push('step3')
      return 'step3'
    })

    await recovery.recover(new Error('ERROR2'))

    expect(order).toEqual(['step2', 'step3'])
  })
})

describe('errors - 全局错误处理器', () => {
  test('GlobalErrorHandler 应该捕获未处理的错误', async () => {
    const { GlobalErrorHandler } = require('../errors.js')
    const handler = GlobalErrorHandler.getInstance()

    let caughtError: Error | undefined
    handler.onError((error) => {
      caughtError = error
    })

    // 模拟未捕获的错误
    process.emit('uncaughtException', new Error('测试错误'))

    // 给事件处理器时间执行
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(caughtError).toBeDefined()
  })

  test('GlobalErrorHandler 应该处理未处理的Promise拒绝', async () => {
    const { GlobalErrorHandler } = require('../errors.js')
    const handler = GlobalErrorHandler.getInstance()

    let caughtError: Error | undefined
    handler.onUnhandledRejection((error) => {
      caughtError = error
    })

    // 模拟未处理的Promise拒绝
    Promise.reject(new Error('测试拒绝'))

    // 给处理器时间执行
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(caughtError).toBeDefined()
  })
})

describe('errors - 边界情况', () => {
  test('应该处理超长的错误消息', () => {
    const longMessage = 'A'.repeat(10000)
    const error = new OAResponderError(longMessage)

    expect(error.message).toBe(longMessage)
    expect(error.message.length).toBe(10000)
  })

  test('应该处理超大的错误上下文', () => {
    const largeContext = {
      data: 'A'.repeat(1000000),
    }
    const error = new OAResponderError('测试', largeContext)

    expect(error.context).toBe(largeContext)
  })

  test('应该处理嵌套的错误链', () => {
    const level1 = new Error('Level 1')
    const level2 = new Error('Level 2', { cause: level1 })
    const level3 = new Error('Level 3', { cause: level2 })

    const error = new OAResponderError('测试', {}, { cause: level3 })

    expect(error.cause).toBe(level3)
    expect(error.cause?.cause).toBe(level2)
    expect(error.cause?.cause?.cause).toBe(level1)
  })
})

describe('errors - 性能测试', () => {
  test('创建1000个错误对象应该在合理时间内完成', () => {
    const start = Date.now()

    for (let i = 0; i < 1000; i++) {
      new OAResponderError(`错误 ${i}`, { index: i })
    }

    const elapsed = Date.now() - start
    expect(elapsed).toBeLessThan(100) // 应该在100ms内完成
  })

  test('错误恢复应该快速执行', async () => {
    const { ErrorRecovery } = require('../errors.js')
    const recovery = new ErrorRecovery()

    recovery.register('TEST', async () => 'result')

    const start = Date.now()

    for (let i = 0; i < 100; i++) {
      await recovery.recover(new Error('TEST'))
    }

    const elapsed = Date.now() - start
    expect(elapsed).toBeLessThan(100) // 应该在100ms内完成
  })
})
