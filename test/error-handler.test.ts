/**
 * 错误处理器测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Logger, LogLevel } from '../patents/core/logger.js'
import {
  withErrorHandling,
  withErrorHandlingOrDefault,
  withErrorHandlingResult,
  withRetry,
  withBatchErrorHandling,
  withTimeout,
} from '../patents/core/error-handler.js'

describe('错误处理器', () => {
  let logger: Logger

  beforeEach(() => {
    logger = Logger.getInstance({
      minLevel: LogLevel.DEBUG,
      console: false,
      file: false,
    })
  })

  describe('withErrorHandling', () => {
    it('应该成功执行操作', async () => {
      const operation = async () => 'success'

      const result = await withErrorHandling(operation, '测试操作', logger, { throwOnError: true })

      expect(result).toBe('success')
    })

    it('应该在操作失败时抛出错误', async () => {
      const operation = async () => {
        throw new Error('操作失败')
      }

      await expect(
        withErrorHandling(operation, '测试操作', logger, { throwOnError: true })
      ).rejects.toThrow('测试操作 失败')
    })

    it('应该记录错误日志', async () => {
      const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {})

      const operation = async () => {
        throw new Error('操作失败')
      }

      try {
        await withErrorHandling(operation, '测试操作', logger)
      } catch (error) {
        // 预期会抛出错误
      }

      expect(errorSpy).toHaveBeenCalled()

      errorSpy.mockRestore()
    })

    it('应该使用自定义错误消息', async () => {
      const operation = async () => {
        throw new Error('操作失败')
      }

      await expect(
        withErrorHandling(operation, '测试操作', logger, {
          defaultErrorMessage: '自定义错误消息',
        })
      ).rejects.toThrow('自定义错误消息')
    })

    it('应该使用自定义错误转换器', async () => {
      const operation = async () => {
        throw new Error('原始错误')
      }

      const customError = new Error('转换后的错误')

      await expect(
        withErrorHandling(operation, '测试操作', logger, {
          errorTransformer: () => customError,
        })
      ).rejects.toThrow('转换后的错误')
    })
  })

  describe('withErrorHandlingOrDefault', () => {
    it('应该在成功时返回操作结果', async () => {
      const operation = async () => 'success'
      const defaultValue = 'default'

      const result = await withErrorHandlingOrDefault(operation, defaultValue, '测试操作', logger)

      expect(result).toBe('success')
    })

    it('应该在失败时返回默认值', async () => {
      const operation = async () => {
        throw new Error('操作失败')
      }
      const defaultValue = 'default'

      const result = await withErrorHandlingOrDefault(operation, defaultValue, '测试操作', logger)

      expect(result).toBe('default')
    })

    it('应该记录警告日志', async () => {
      const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {})

      const operation = async () => {
        throw new Error('操作失败')
      }

      await withErrorHandlingOrDefault(operation, 'default', '测试操作', logger)

      expect(warnSpy).toHaveBeenCalled()

      warnSpy.mockRestore()
    })
  })

  describe('withErrorHandlingResult', () => {
    it('应该在成功时返回success=true', async () => {
      const operation = async () => 'success'

      const result = await withErrorHandlingResult(operation, '测试操作', logger)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe('success')
      }
    })

    it('应该在失败时返回success=false', async () => {
      const operation = async () => {
        throw new Error('操作失败')
      }

      const result = await withErrorHandlingResult(operation, '测试操作', logger)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBeInstanceOf(Error)
        expect(result.error.message).toBe('操作失败')
      }
    })

    it('不应该抛出错误', async () => {
      const operation = async () => {
        throw new Error('操作失败')
      }

      // 应该不抛出错误
      const result = await withErrorHandlingResult(operation, '测试操作', logger)

      expect(result.success).toBe(false)
    })
  })

  describe('withRetry', () => {
    it('应该在第一次尝试成功时返回结果', async () => {
      const operation = async () => 'success'

      const result = await withRetry(operation, '测试操作', logger, { maxRetries: 3 })

      expect(result).toBe('success')
    })

    it('应该在失败后重试并成功', async () => {
      let attempts = 0
      const operation = async () => {
        attempts++
        if (attempts < 3) {
          throw new Error('暂时失败')
        }
        return 'success'
      }

      const result = await withRetry(operation, '测试操作', logger, { maxRetries: 3, delayMs: 10 })

      expect(result).toBe('success')
      expect(attempts).toBe(3)
    })

    it('应该在达到最大重试次数后失败', async () => {
      const operation = async () => {
        throw new Error('持续失败')
      }

      await expect(
        withRetry(operation, '测试操作', logger, {
          maxRetries: 2,
          delayMs: 10,
        })
      ).rejects.toThrow()
    })

    it('应该使用shouldRetry函数决定是否重试', async () => {
      let attempts = 0
      const operation = async () => {
        attempts++
        if (attempts === 1) {
          throw new Error('不应重试的错误')
        }
        throw new Error('其他错误')
      }

      const shouldRetry = (error: Error) => {
        return error.message !== '不应重试的错误'
      }

      // 第一次失败后不应重试
      await expect(
        withRetry(operation, '测试操作', logger, {
          maxRetries: 5,
          delayMs: 10,
          shouldRetry,
        })
      ).rejects.toThrow()

      // 应该只尝试一次（因为shouldRetry返回false）
      expect(attempts).toBe(1)
    })
  })

  describe('withBatchErrorHandling', () => {
    it('应该处理所有成功的操作', async () => {
      const operations = [async () => 'result1', async () => 'result2', async () => 'result3']

      const result = await withBatchErrorHandling(operations, '批量操作', logger)

      expect(result.successful).toHaveLength(3)
      expect(result.failed).toHaveLength(0)
      expect(result.successful[0].data).toBe('result1')
      expect(result.successful[1].data).toBe('result2')
      expect(result.successful[2].data).toBe('result3')
    })

    it('应该分离成功和失败的操作', async () => {
      const operations = [
        async () => 'result1',
        async () => {
          throw new Error('失败2')
        },
        async () => 'result3',
        async () => {
          throw new Error('失败4')
        },
      ]

      const result = await withBatchErrorHandling(operations, '批量操作', logger)

      expect(result.successful).toHaveLength(2)
      expect(result.failed).toHaveLength(2)
      expect(result.successful[0].data).toBe('result1')
      expect(result.successful[1].data).toBe('result3')
      expect(result.failed[0].error.message).toBe('失败2')
      expect(result.failed[1].error.message).toBe('失败4')
    })

    it('应该保持正确的索引', async () => {
      const operations = [
        async () => 'result1',
        async () => {
          throw new Error('失败')
        },
        async () => 'result3',
      ]

      const result = await withBatchErrorHandling(operations, '批量操作', logger)

      expect(result.successful[0].index).toBe(0)
      expect(result.failed[0].index).toBe(1)
      expect(result.successful[1].index).toBe(2)
    })
  })

  describe('withTimeout', () => {
    it('应该在超时时间内成功', async () => {
      const operation = async () => {
        await new Promise((resolve) => setTimeout(resolve, 100))
        return 'success'
      }

      const result = await withTimeout(operation, 500, '测试操作', logger)

      expect(result).toBe('success')
    })

    it('应该在超时后失败', async () => {
      const operation = async () => {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        return 'success'
      }

      await expect(withTimeout(operation, 100, '测试操作', logger)).rejects.toThrow('超时')
    })

    it('应该记录超时错误', async () => {
      const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {})

      const operation = async () => {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        return 'success'
      }

      try {
        await withTimeout(operation, 100, '测试操作', logger)
      } catch (error) {
        // 预期会超时
      }

      expect(errorSpy).toHaveBeenCalled()
      const calls = errorSpy.mock.calls
      expect(calls.some((call) => call[0].includes('超时'))).toBe(true)

      errorSpy.mockRestore()
    })
  })

  describe('组合使用', () => {
    it('应该支持withRetry和withTimeout组合', async () => {
      let attempts = 0
      const operation = async () => {
        attempts++
        if (attempts < 2) {
          throw new Error('暂时失败')
        }
        await new Promise((resolve) => setTimeout(resolve, 50))
        return 'success'
      }

      const result = await withTimeout(
        () =>
          withRetry(operation, '测试操作', logger, {
            maxRetries: 3,
            delayMs: 10,
          }),
        500,
        '测试操作',
        logger
      )

      expect(result).toBe('success')
    })
  })
})
