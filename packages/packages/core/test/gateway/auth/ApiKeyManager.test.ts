/**
 * ApiKeyManager 单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { ApiKeyManager, InMemoryApiKeyStore } from '../../../src/gateway/auth/index.js'

describe('ApiKeyManager', () => {
  let apiKeyManager: ApiKeyManager

  beforeEach(() => {
    apiKeyManager = new ApiKeyManager(new InMemoryApiKeyStore())
  })

  describe('generateApiKey', () => {
    it('应该生成有效的 API Key', async () => {
      const info = {
        userId: 'user-123',
        roles: ['user'],
        permissions: ['read', 'write'],
        enabled: true,
      }

      const apiKey = await apiKeyManager.generateApiKey(info)

      expect(apiKey).toMatch(/^yunpat_[a-zA-Z0-9_-]+_[a-zA-Z0-9_-]+$/)
    })

    it('应该生成不同的 API Key', async () => {
      const info = {
        userId: 'user-123',
        roles: ['user'],
        permissions: ['read'],
        enabled: true,
      }

      const key1 = await apiKeyManager.generateApiKey(info)
      const key2 = await apiKeyManager.generateApiKey(info)

      expect(key1).not.toBe(key2)
    })

    it('应该支持自定义过期时间', async () => {
      const info = {
        userId: 'user-123',
        roles: ['user'],
        permissions: ['read'],
        enabled: true,
        expiresAt: new Date(Date.now() + 86400000), // 1天后
      }

      const apiKey = await apiKeyManager.generateApiKey(info)
      const verified = await apiKeyManager.verifyApiKey(apiKey)

      expect(verified).toBeDefined()
      expect(verified?.userId).toBe('user-123')
      // 验证未过期的 Key 能被正确验证
    })
  })

  describe('verifyApiKey', () => {
    it('应该验证有效的 API Key', async () => {
      const info = {
        userId: 'user-123',
        roles: ['user'],
        permissions: ['read', 'write'],
        enabled: true,
      }

      const apiKey = await apiKeyManager.generateApiKey(info)
      const verified = await apiKeyManager.verifyApiKey(apiKey)

      expect(verified).toBeDefined()
      expect(verified?.userId).toBe('user-123')
      expect(verified?.roles).toEqual(['user'])
      expect(verified?.permissions).toEqual(['read', 'write'])
      expect(verified?.enabled).toBe(true)
    })

    it('应该拒绝无效的 API Key', async () => {
      const verified = await apiKeyManager.verifyApiKey('invalid-key')

      expect(verified).toBeNull()
    })

    it('应该拒绝格式错误的 API Key', async () => {
      const verified = await apiKeyManager.verifyApiKey('not-a-valid-key')

      expect(verified).toBeNull()
    })

    it('应该拒绝已禁用的 API Key', async () => {
      const info = {
        userId: 'user-123',
        roles: ['user'],
        permissions: ['read'],
        enabled: false,
      }

      const apiKey = await apiKeyManager.generateApiKey(info)
      const verified = await apiKeyManager.verifyApiKey(apiKey)

      expect(verified).toBeNull()
    })

    it('应该拒绝过期的 API Key', async () => {
      const info = {
        userId: 'user-123',
        roles: ['user'],
        permissions: ['read'],
        enabled: true,
        expiresAt: new Date(Date.now() - 1000), // 1秒前过期
      }

      const apiKey = await apiKeyManager.generateApiKey(info)
      const verified = await apiKeyManager.verifyApiKey(apiKey)

      expect(verified).toBeNull()
    })
  })

  describe('deleteApiKey', () => {
    it('应该删除 API Key', async () => {
      const info = {
        userId: 'user-123',
        roles: ['user'],
        permissions: ['read'],
        enabled: true,
      }

      const apiKey = await apiKeyManager.generateApiKey(info)
      // keyId 是 base64url(8 bytes) = 固定 11 字符，位于 "yunpat_" 之后
      const keyId = apiKey.slice('yunpat_'.length, 'yunpat_'.length + 11)

      await apiKeyManager.deleteApiKey(keyId)

      const verified = await apiKeyManager.verifyApiKey(apiKey)
      expect(verified).toBeNull()
    })
  })

  describe('listUserApiKeys', () => {
    it('应该列出用户的所有 API Key', async () => {
      const info1 = {
        userId: 'user-123',
        roles: ['user'],
        permissions: ['read'],
        enabled: true,
      }

      const info2 = {
        userId: 'user-123',
        roles: ['admin'],
        permissions: ['read', 'write', 'delete'],
        enabled: true,
      }

      await apiKeyManager.generateApiKey(info1)
      await apiKeyManager.generateApiKey(info2)

      const keys = await apiKeyManager.listUserApiKeys('user-123')

      expect(keys).toHaveLength(2)
    })

    it('不应该列出其他用户的 API Key', async () => {
      const info1 = {
        userId: 'user-123',
        roles: ['user'],
        permissions: ['read'],
        enabled: true,
      }

      const info2 = {
        userId: 'user-456',
        roles: ['user'],
        permissions: ['read'],
        enabled: true,
      }

      await apiKeyManager.generateApiKey(info1)
      await apiKeyManager.generateApiKey(info2)

      const keys = await apiKeyManager.listUserApiKeys('user-123')

      expect(keys).toHaveLength(1)
      expect(keys[0].info.userId).toBe('user-123')
    })
  })

  describe('cleanupExpired', () => {
    it('应该清理过期的 API Key', async () => {
      const expiredInfo = {
        userId: 'user-123',
        roles: ['user'],
        permissions: ['read'],
        enabled: true,
        expiresAt: new Date(Date.now() - 1000),
      }

      const validInfo = {
        userId: 'user-123',
        roles: ['user'],
        permissions: ['read'],
        enabled: true,
        expiresAt: new Date(Date.now() + 86400000),
      }

      await apiKeyManager.generateApiKey(expiredInfo)
      await apiKeyManager.generateApiKey(validInfo)

      const cleaned = await apiKeyManager.cleanupExpired()

      expect(cleaned).toBe(1)
    })
  })
})
