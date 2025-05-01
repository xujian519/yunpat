/**
 * BaseGateway 单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { BaseGateway } from '../../src/gateway/Gateway.js'
import type { SecurityGatewayConfig } from '../../src/gateway/Gateway.js'
import {
  ApiKeyManager,
  InMemoryApiKeyStore,
  JwtManager,
  InMemoryTokenStore,
  SessionManager,
  InMemorySessionStore,
} from '../../src/gateway/auth/index.js'
import { InMemoryAuditStore } from '../../src/gateway/audit/index.js'
import { EventBus } from '../../src/eventbus/EventBus.js'

describe('BaseGateway', () => {
  let gateway: BaseGateway
  let apiKeyManager: ApiKeyManager
  let jwtManager: JwtManager
  let sessionManager: SessionManager
  let auditStore: InMemoryAuditStore
  let eventBus: EventBus

  beforeEach(async () => {
    eventBus = new EventBus()
    apiKeyManager = new ApiKeyManager(new InMemoryApiKeyStore())
    jwtManager = new JwtManager({ secret: 'test-secret-for-testing-only' })
    sessionManager = new SessionManager(new InMemorySessionStore())
    auditStore = new InMemoryAuditStore({ maxLogs: 1000 })

    const config: SecurityGatewayConfig = {
      enableAuth: true,
      enableAuthorization: true,
      enableContentFilter: true,
      enableAudit: true,
      apiKeyManager,
      jwtManager,
      sessionManager,
      auditStore,
      contentFilterRules: [
        {
          name: '敏感词测试',
          type: 'keyword',
          content: '敏感',
          action: 'block',
          severity: 'high',
        },
      ],
    }

    gateway = new BaseGateway(config)
  })

  afterEach(async () => {
    await auditStore.clear()
  })

  describe('authenticate', () => {
    it('应该使用 API Key 进行认证', async () => {
      const info = {
        userId: 'user-123',
        roles: ['user'],
        permissions: ['read', 'write'],
        enabled: true,
      }

      const apiKey = await apiKeyManager.generateApiKey(info)

      const result = await gateway.authenticate({
        type: 'apikey',
        data: { apiKey },
      })

      expect(result.success).toBe(true)
      expect(result.userId).toBe('user-123')
      expect(result.roles).toEqual(['user'])
      expect(result.permissions).toEqual(['read', 'write'])
    })

    it('应该拒绝无效的 API Key', async () => {
      const result = await gateway.authenticate({
        type: 'apikey',
        data: { apiKey: 'invalid-key' },
      })

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('应该使用 JWT Token 进行认证', async () => {
      const tokenPair = await jwtManager.generateTokenPair(
        'user-123',
        ['admin'],
        ['read', 'write', 'delete']
      )

      const result = await gateway.authenticate({
        type: 'jwt',
        data: { token: tokenPair.accessToken },
      })

      expect(result.success).toBe(true)
      expect(result.userId).toBe('user-123')
      expect(result.roles).toEqual(['admin'])
    })

    it('应该拒绝无效的 JWT Token', async () => {
      const result = await gateway.authenticate({
        type: 'jwt',
        data: { token: 'invalid-token' },
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('无效的 Token')
    })

    it('未启用认证时应该返回匿名用户', async () => {
      const config: SecurityGatewayConfig = {
        enableAuth: false,
        enableAuthorization: false,
        enableContentFilter: false,
        enableAudit: false,
      }

      const anonymousGateway = new BaseGateway(config)

      const result = await anonymousGateway.authenticate({
        type: 'apikey',
        data: { apiKey: 'any-key' },
      })

      expect(result.success).toBe(true)
      expect(result.userId).toBe('anonymous')
      expect(result.roles).toEqual(['guest'])
    })
  })

  describe('authorize', () => {
    it('应该授权有权限的操作', async () => {
      const result = await gateway.authorize({ type: 'write', resource: 'file' }, [
        { resource: 'file', action: 'write' },
        { resource: 'file', action: 'read' },
      ])

      expect(result.authorized).toBe(true)
    })

    it('应该拒绝无权限的操作', async () => {
      const result = await gateway.authorize({ type: 'delete', resource: 'file' }, [
        { resource: 'file', action: 'read' },
        { resource: 'file', action: 'write' },
      ])

      expect(result.authorized).toBe(false)
      expect(result.reason).toBeDefined()
    })

    it('应该支持通配符权限', async () => {
      const result = await gateway.authorize({ type: 'read', resource: 'any-resource' }, [
        { resource: '*', action: '*' },
      ])

      expect(result.authorized).toBe(true)
    })

    it('未启用授权时应该通过所有请求', async () => {
      const config: SecurityGatewayConfig = {
        enableAuth: false,
        enableAuthorization: false,
        enableContentFilter: false,
        enableAudit: false,
      }

      const anonymousGateway = new BaseGateway(config)

      const result = await anonymousGateway.authorize({ type: 'delete', resource: 'file' }, [])

      expect(result.authorized).toBe(true)
    })
  })

  describe('filterContent', () => {
    it('应该过滤敏感内容', async () => {
      const result = await gateway.filterContent('这是包含敏感信息的文本')

      expect(result.filtered).toBe(true)
      expect(result.reason).toContain('敏感词测试')
      expect(result.matchedRule).toBe('敏感词测试')
    })

    it('应该通过正常内容', async () => {
      const result = await gateway.filterContent('这是正常文本内容')

      expect(result.filtered).toBe(false)
    })

    it('应该支持正则表达式过滤', async () => {
      const config: SecurityGatewayConfig = {
        enableAuth: false,
        enableAuthorization: false,
        enableContentFilter: true,
        enableAudit: false,
        contentFilterRules: [
          {
            name: '手机号过滤',
            type: 'pattern',
            content: /1[3-9]\d{9}/,
            action: 'block',
            severity: 'medium',
          },
        ],
      }

      const testGateway = new BaseGateway(config)

      const result = await testGateway.filterContent('我的手机号是13812345678')

      expect(result.filtered).toBe(true)
      expect(result.matchedRule).toBe('手机号过滤')
    })

    it('应该支持字符串形式的正则表达式', async () => {
      const config: SecurityGatewayConfig = {
        enableAuth: false,
        enableAuthorization: false,
        enableContentFilter: true,
        enableAudit: false,
        contentFilterRules: [
          {
            name: '邮箱过滤',
            type: 'pattern',
            content: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}',
            action: 'block',
            severity: 'medium',
          },
        ],
      }

      const testGateway = new BaseGateway(config)

      const result = await testGateway.filterContent('联系我：test@example.com')

      expect(result.filtered).toBe(true)
      expect(result.matchedRule).toBe('邮箱过滤')
    })

    it('应该支持正则表达式标志（不区分大小写）', async () => {
      const config: SecurityGatewayConfig = {
        enableAuth: false,
        enableAuthorization: false,
        enableContentFilter: true,
        enableAudit: false,
        contentFilterRules: [
          {
            name: 'VIP关键词过滤',
            type: 'pattern',
            content: '\\bvip\\b',
            flags: 'i', // 不区分大小写
            action: 'block',
            severity: 'medium',
          },
        ],
      }

      const testGateway = new BaseGateway(config)

      // 测试不同大小写
      const result1 = await testGateway.filterContent('这是一个VIP用户')
      const result2 = await testGateway.filterContent('这是一个vip用户')
      const result3 = await testGateway.filterContent('这是一个Vip用户')

      expect(result1.filtered).toBe(true)
      expect(result2.filtered).toBe(true)
      expect(result3.filtered).toBe(true)
    })

    it('应该支持多个过滤规则', async () => {
      const config: SecurityGatewayConfig = {
        enableAuth: false,
        enableAuthorization: false,
        enableContentFilter: true,
        enableAudit: false,
        contentFilterRules: [
          {
            name: '敏感词',
            type: 'keyword',
            content: '机密',
            action: 'block',
            severity: 'high',
          },
          {
            name: '手机号',
            type: 'pattern',
            content: '1[3-9]\\d{9}',
            action: 'flag',
            severity: 'medium',
          },
          {
            name: '特殊符号',
            type: 'keyword',
            content: '@#$',
            action: 'sanitize',
            severity: 'low',
          },
        ],
      }

      const testGateway = new BaseGateway(config)

      // 触发敏感词规则
      const result1 = await testGateway.filterContent('这是机密信息')
      expect(result1.filtered).toBe(true)
      expect(result1.matchedRule).toBe('敏感词')

      // 触发手机号规则（flag 动作不会阻止）
      const result2 = await testGateway.filterContent('手机号13812345678')
      expect(result2.filtered).toBe(false) // flag 不会阻止
      expect(result2.matchedRule).toBe('手机号')

      // 正常内容
      const result3 = await testGateway.filterContent('正常内容')
      expect(result3.filtered).toBe(false)
    })

    it('应该处理无效的正则表达式', async () => {
      const config: SecurityGatewayConfig = {
        enableAuth: false,
        enableAuthorization: false,
        enableContentFilter: true,
        enableAudit: false,
        contentFilterRules: [
          {
            name: '无效的正则',
            type: 'pattern',
            content: '[invalid(', // 无效的正则表达式
            action: 'block',
            severity: 'medium',
          },
        ],
      }

      const testGateway = new BaseGateway(config)

      // 不应该抛出错误，而是忽略无效规则
      const result = await testGateway.filterContent('任何内容')

      expect(result.filtered).toBe(false)
    })

    it('未启用内容过滤时应该通过所有内容', async () => {
      const config: SecurityGatewayConfig = {
        enableAuth: false,
        enableAuthorization: false,
        enableContentFilter: false,
        enableAudit: false,
      }

      const testGateway = new BaseGateway(config)

      const result = await testGateway.filterContent('任何内容')

      expect(result.filtered).toBe(false)
    })
  })

  describe('receiveInput & sendOutput', () => {
    it('应该接收多模态输入', async () => {
      const input = await gateway.receiveInput(1) // TEXT

      expect(input.sourceType).toBe(1)
      expect(input.text).toBeDefined()
      expect(input.metadata?.timestamp).toBeInstanceOf(Date)
    })

    it('应该发送输出到终端', async () => {
      const output = {
        targetType: 0, // TERMINAL
        text: 'Test output',
      }

      // 不应该抛出错误
      await expect(gateway.sendOutput(output, 0)).resolves.toBeUndefined()
    })
  })
})
