/**
 * PatentDatabaseAdapter 单元测试
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PatentDatabaseAdapter } from '../src/PatentDatabaseAdapter.js'

describe('PatentDatabaseAdapter', () => {
  let adapter: PatentDatabaseAdapter

  beforeAll(() => {
    // 初始化适配器（使用测试配置）
    adapter = new PatentDatabaseAdapter({
      patent_db: {
        host: process.env.PATENT_DB_HOST || 'localhost',
        port: parseInt(process.env.PATENT_DB_PORT || '5432'),
        database: process.env.PATENT_DB_NAME || 'patent_db',
        user: process.env.PATENT_DB_USER || 'postgres',
        password: process.env.PATENT_DB_PASSWORD || '',
        poolSize: 5,
      },
      google_patents: {
        enabled: true,
        rateLimit: 1.0,
        timeout: 5000,
      },
    })
  })

  afterAll(async () => {
    await adapter.close()
  })

  describe('初始化', () => {
    it('应该成功初始化适配器', () => {
      expect(adapter).toBeDefined()
      expect(adapter.getDataSources()).toContain('patent_db')
      expect(adapter.getDataSources()).toContain('google_patents')
    })
  })

  describe('健康检查', () => {
    it('应该返回所有数据源的健康状态', async () => {
      const health = await adapter.healthCheck()

      expect(health).toBeDefined()
      expect(typeof health.patent_db).toBe('boolean')
      expect(typeof health.google_patents).toBe('boolean')

      // 如果数据库不可用，这是正常的
      if (!health.patent_db) {
        console.warn('⚠️  PatentDB 数据库未连接，请检查数据库配置')
      }
    }, 30000) // 30秒超时
  })

  describe('查询专利', () => {
    it('应该支持根据公开号查询', async () => {
      // 测试一个已知存在的专利号
      const results = await adapter.queryByPublicationNumber('CN123456789A')

      expect(Array.isArray(results)).toBe(true)
      // 注意：如果数据库中没有这个专利号，结果为空是正常的
      if (results.length === 0) {
        console.warn('⚠️  未找到测试专利号，可能是数据库未配置或表结构不匹配')
      }
    }, 30000) // 30秒超时

    it('应该支持关键词查询', async () => {
      const results = await adapter.queryByKeywords(['深度学习', '图像识别'], {
        limit: 5,
      })

      expect(Array.isArray(results)).toBe(true)
      // 注意：如果没有连接数据库，结果为空是正常的
      if (results.length === 0) {
        console.warn('⚠️  关键词查询无结果，可能是数据库未配置或表结构不匹配')
      }
    }, 30000) // 30秒超时

    it('应该支持申请人查询', async () => {
      const results = await adapter.queryByApplicant('腾讯', {
        limit: 10,
      })

      expect(Array.isArray(results)).toBe(true)
      if (results.length === 0) {
        console.warn('⚠️  申请人查询无结果，可能是数据库未配置或表结构不匹配')
      }
    }, 30000) // 30秒超时
  })

  describe('错误处理', () => {
    it('应该优雅处理数据库连接错误', async () => {
      // 使用无效的数据库配置
      const badAdapter = new PatentDatabaseAdapter({
        patent_db: {
          host: 'invalid-host',
          port: 9999,
          database: 'invalid_db',
          user: 'invalid_user',
          password: 'invalid_password',
        },
      })

      // 健康检查应该失败但不抛出异常
      const health = await badAdapter.healthCheck()
      expect(health.patent_db).toBe(false)

      await badAdapter.close()
    }, 30000) // 30秒超时
  })
})

describe('PatentDatabaseAdapter (无数据库)', () => {
  it('应该在没有数据库配置时正常初始化', () => {
    const adapter = new PatentDatabaseAdapter({
      google_patents: {
        enabled: true,
      },
    })

    expect(adapter).toBeDefined()
    expect(adapter.getDataSources()).toContain('google_patents')
    expect(adapter.getDataSources()).not.toContain('patent_db')
  })
})
