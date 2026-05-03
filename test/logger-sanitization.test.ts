/**
 * Logger 日志脱敏功能测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Logger, LogLevel } from '../patents/core/logger.js'

describe('Logger - 日志脱敏功能', () => {
  let logger: Logger

  beforeEach(() => {
    // 由于Logger是单例，我们需要重新配置它
    logger = Logger.getInstance({
      minLevel: LogLevel.DEBUG,
      console: false, // 禁用控制台输出
      file: false, // 禁用文件输出
    })

    // 重置脱敏配置为默认值
    logger.configureSanitization({
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
    })
  })

  describe('基本敏感字段脱敏', () => {
    it('应该脱敏password字段', () => {
      const metadata = {
        username: 'testuser',
        password: 'secret123',
      }

      const entry = (logger as any).createLogEntry(LogLevel.INFO, '测试日志', metadata)

      expect(entry.metadata.password).toBe('***REDACTED***')
      expect(entry.metadata.username).toBe('testuser')
    })

    it('应该脱敏token字段', () => {
      const metadata = {
        userId: '123',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      }

      const entry = (logger as any).createLogEntry(LogLevel.INFO, '测试日志', metadata)

      expect(entry.metadata.token).toBe('***REDACTED***')
      expect(entry.metadata.userId).toBe('123')
    })

    it('应该脱敏apiKey字段（变体）', () => {
      const metadata1 = { apiKey: 'key123' }
      const metadata2 = { api_key: 'key456' }
      const metadata3 = { apikey: 'key789' }

      const entry1 = (logger as any).createLogEntry(LogLevel.INFO, '测试', metadata1)
      const entry2 = (logger as any).createLogEntry(LogLevel.INFO, '测试', metadata2)
      const entry3 = (logger as any).createLogEntry(LogLevel.INFO, '测试', metadata3)

      expect(entry1.metadata.apiKey).toBe('***REDACTED***')
      expect(entry2.metadata.api_key).toBe('***REDACTED***')
      expect(entry3.metadata.apikey).toBe('***REDACTED***')
    })

    it('应该脱敏secret字段', () => {
      const metadata = {
        config: { value: 'normal' },
        secret: 'mySecret',
      }

      const entry = (logger as any).createLogEntry(LogLevel.INFO, '测试', metadata)

      expect(entry.metadata.secret).toBe('***REDACTED***')
      expect(entry.metadata.config.value).toBe('normal')
    })
  })

  describe('多种敏感字段', () => {
    it('应该脱敏authorization字段', () => {
      const metadata = {
        authorization: 'Bearer token123',
      }

      const entry = (logger as any).createLogEntry(LogLevel.INFO, '测试', metadata)

      expect(entry.metadata.authorization).toBe('***REDACTED***')
    })

    it('应该脱敏sessionId字段', () => {
      const metadata = {
        sessionId: 'sess-abc-123',
      }

      const entry = (logger as any).createLogEntry(LogLevel.INFO, '测试', metadata)

      expect(entry.metadata.sessionId).toBe('***REDACTED***')
    })

    it('应该脱敏cookie字段', () => {
      const metadata = {
        cookie: 'session=xyz; user=123',
      }

      const entry = (logger as any).createLogEntry(LogLevel.INFO, '测试', metadata)

      expect(entry.metadata.cookie).toBe('***REDACTED***')
    })

    it('应该脱敏creditCard字段', () => {
      const metadata = {
        creditCard: '4111-1111-1111-1111',
      }

      const entry = (logger as any).createLogEntry(LogLevel.INFO, '测试', metadata)

      expect(entry.metadata.creditCard).toBe('***REDACTED***')
    })

    it('应该脱敏privateKey字段', () => {
      const metadata = {
        privateKey: '-----BEGIN PRIVATE KEY-----',
      }

      const entry = (logger as any).createLogEntry(LogLevel.INFO, '测试', metadata)

      expect(entry.metadata.privateKey).toBe('***REDACTED***')
    })
  })

  describe('嵌套对象脱敏', () => {
    it('应该递归脱敏嵌套对象中的敏感字段', () => {
      const metadata = {
        user: {
          username: 'testuser',
          password: 'secret123',
        },
        config: {
          apiKey: 'key123',
        },
      }

      const entry = (logger as any).createLogEntry(LogLevel.INFO, '测试', metadata)

      expect(entry.metadata.user.username).toBe('testuser')
      expect(entry.metadata.user.password).toBe('***REDACTED***')
      expect(entry.metadata.config.apiKey).toBe('***REDACTED***')
    })

    it('应该处理深层嵌套', () => {
      const metadata = {
        level1: {
          level2: {
            level3: {
              secret: 'deep-secret',
              normal: 'deep-normal',
            },
          },
        },
      }

      const entry = (logger as any).createLogEntry(LogLevel.INFO, '测试', metadata)

      expect(entry.metadata.level1.level2.level3.secret).toBe('***REDACTED***')
      expect(entry.metadata.level1.level2.level3.normal).toBe('deep-normal')
    })
  })

  describe('数组脱敏', () => {
    it('应该脱敏数组中的对象', () => {
      const metadata = {
        users: [
          { username: 'user1', password: 'pass1' },
          { username: 'user2', password: 'pass2' },
        ],
      }

      const entry = (logger as any).createLogEntry(LogLevel.INFO, '测试', metadata)

      expect(entry.metadata.users[0].username).toBe('user1')
      expect(entry.metadata.users[0].password).toBe('***REDACTED***')
      expect(entry.metadata.users[1].username).toBe('user2')
      expect(entry.metadata.users[1].password).toBe('***REDACTED***')
    })

    it('应该保持非对象数组不变', () => {
      const metadata = {
        tags: ['tag1', 'tag2', 'tag3'],
        ids: [1, 2, 3],
      }

      const entry = (logger as any).createLogEntry(LogLevel.INFO, '测试', metadata)

      expect(entry.metadata.tags).toEqual(['tag1', 'tag2', 'tag3'])
      expect(entry.metadata.ids).toEqual([1, 2, 3])
    })
  })

  describe('配置功能', () => {
    it('应该允许自定义敏感字段列表', () => {
      logger.configureSanitization({
        sensitiveFields: ['customField', 'anotherField'],
      })

      const metadata = {
        customField: 'sensitive',
        anotherField: 'also-sensitive',
        password: 'should-not-be-redacted', // 不在自定义列表中
      }

      const entry = (logger as any).createLogEntry(LogLevel.INFO, '测试', metadata)

      expect(entry.metadata.customField).toBe('***REDACTED***')
      expect(entry.metadata.anotherField).toBe('***REDACTED***')
      expect(entry.metadata.password).toBe('should-not-be-redacted')
    })

    it('应该允许自定义替换文本', () => {
      logger.configureSanitization({
        replacementText: '[已屏蔽]',
      })

      const metadata = {
        password: 'secret',
      }

      const entry = (logger as any).createLogEntry(LogLevel.INFO, '测试', metadata)

      expect(entry.metadata.password).toBe('[已屏蔽]')
    })

    it('应该启用深度脱敏模式', () => {
      logger.configureSanitization({
        enableDeepSanitization: true,
      })

      const metadata = {
        password: 'secret123',
      }

      const entry = (logger as any).createLogEntry(LogLevel.INFO, '测试', metadata)

      expect(entry.metadata.password).toMatch(/^HASH:/)
      expect(entry.metadata.password).not.toBe('secret123')
      expect(entry.metadata.password).not.toBe('***REDACTED***')
    })
  })

  describe('边界情况', () => {
    it('应该处理空对象', () => {
      const entry = (logger as any).createLogEntry(LogLevel.INFO, '测试', {})

      expect(entry.metadata).toEqual({})
    })

    it('应该处理undefined和null', () => {
      const entry1 = (logger as any).createLogEntry(LogLevel.INFO, '测试', undefined)
      const entry2 = (logger as any).createLogEntry(LogLevel.INFO, '测试', null)

      expect(entry1.metadata).toBeUndefined()
      expect(entry2.metadata).toBeNull()
    })

    it('应该处理原始值类型', () => {
      const entry = (logger as any).createLogEntry(LogLevel.INFO, '测试', 'just a string' as any)

      expect(entry.metadata).toBe('just a string')
    })

    it('应该处理部分匹配的字段名', () => {
      const metadata = {
        user_password: 'pass1', // 包含password
        api_key_v2: 'key1', // 包含api_key
        mySecret: 'secret1', // 包含secret
      }

      const entry = (logger as any).createLogEntry(LogLevel.INFO, '测试', metadata)

      expect(entry.metadata.user_password).toBe('***REDACTED***')
      expect(entry.metadata.api_key_v2).toBe('***REDACTED***')
      expect(entry.metadata.mySecret).toBe('***REDACTED***')
    })
  })

  describe('实际使用场景', () => {
    it('应该在info日志中自动脱敏', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      logger.info('用户登录', {
        username: 'testuser',
        password: 'secret123',
        sessionId: 'sess-123',
      })

      expect(consoleSpy).toHaveBeenCalled()
      const loggedArgs = consoleSpy.mock.calls[0]
      const logString = JSON.stringify(loggedArgs)

      expect(logString).toContain('testuser')
      expect(logString).not.toContain('secret123')
      expect(logString).not.toContain('sess-123')

      consoleSpy.mockRestore()
    })

    it('应该在error日志中自动脱敏', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const error = new Error('Test error')
      logger.error('API调用失败', error, {
        apiKey: 'secret-key',
        endpoint: '/api/test',
      })

      expect(consoleSpy).toHaveBeenCalled()
      const loggedArgs = consoleSpy.mock.calls[0]
      const logString = JSON.stringify(loggedArgs)

      expect(logString).toContain('/api/test')
      expect(logString).not.toContain('secret-key')

      consoleSpy.mockRestore()
    })
  })
})
