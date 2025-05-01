/**
 * PostgresVectorStore 单元测试
 *
 * 注意：此测试在以下环境中跳过：
 * 1. CI 环境（需要 PostgreSQL 数据库）
 * 2. 没有数据库连接配置的环境
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PostgresVectorStore } from '../../src/memory/long-term/PostgresVectorStore.js'
import type { NewMemory } from '../../src/memory/long-term/schema.js'

// CI 环境检测
const isCI = process.env.CI === 'true'

// 检查是否有数据库连接配置
const hasDbConfig = !!(process.env.POSTGRES_URL || process.env.DATABASE_URL)

const shouldSkip = isCI || !hasDbConfig

if (shouldSkip) {
  console.warn('\n⚠️  PostgreSQL 不可用，跳过 PostgresVectorStore 测试')
  console.warn('   设置 POSTGRES_URL 或 DATABASE_URL 环境变量以启用测试\n')
}

describe.skipIf(shouldSkip)('PostgresVectorStore', () => {
  let store: PostgresVectorStore
  const databaseUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL || ''

  beforeEach(async () => {
    store = new PostgresVectorStore({
      databaseUrl,
      vectorDimension: 1024,
    })

    await store.initialize()
  })

  afterEach(async () => {
    await store.close()
  })

  describe('初始化', () => {
    it('应该成功初始化', async () => {
      expect(store).toBeDefined()
    })

    it('应该创建必要的表和索引', async () => {
      const stats = await store.getStats()
      expect(stats.totalMemories).toBeDefined()
    })
  })

  describe('upsert', () => {
    it('应该插入新的记忆', async () => {
      const memory: NewMemory = {
        type: 'test',
        content: '测试内容',
        embedding: Array(1024).fill(0.1),
        metadata: {
          test: true,
        },
      }

      const id = await store.upsert(memory)

      expect(id).toBeDefined()
      expect(typeof id).toBe('number')
    })

    it('应该更新已有的记忆', async () => {
      const memory: NewMemory = {
        type: 'test',
        content: '原始内容',
        embedding: Array(1024).fill(0.1),
        metadata: {
          version: 1,
        },
      }

      const id = await store.upsert(memory)

      // 更新
      const updated: NewMemory & { id: number } = {
        ...memory,
        id,
        content: '更新后的内容',
        metadata: {
          version: 2,
        },
      }

      const updatedId = await store.upsert(updated)

      expect(updatedId).toBe(id)
    })

    it('应该处理不正确的向量维度', async () => {
      const memory: NewMemory = {
        type: 'test',
        content: '测试内容',
        embedding: Array(100).fill(0.1), // 错误的维度
      }

      await expect(store.upsert(memory)).rejects.toThrow()
    })
  })

  describe('upsertBatch', () => {
    it('应该批量插入记忆', async () => {
      const memories: NewMemory[] = [
        {
          type: 'test',
          content: '内容1',
          embedding: Array(1024).fill(0.1),
        },
        {
          type: 'test',
          content: '内容2',
          embedding: Array(1024).fill(0.2),
        },
        {
          type: 'test',
          content: '内容3',
          embedding: Array(1024).fill(0.3),
        },
      ]

      const ids = await store.upsertBatch(memories)

      expect(ids).toHaveLength(3)
      expect(ids.every((id) => typeof id === 'number')).toBe(true)
    })

    it('应该处理大批量插入（分批处理）', async () => {
      const memories: NewMemory[] = Array(1500)
        .fill(null)
        .map((_, i) => ({
          type: 'test',
          content: `内容${i}`,
          embedding: Array(1024).fill(0.1),
        }))

      const ids = await store.upsertBatch(memories)

      expect(ids).toHaveLength(1500)
    })

    it('应该混合处理新增和更新', async () => {
      // 先插入一些数据
      const initialMemories: NewMemory[] = [
        {
          type: 'test',
          content: '原始内容1',
          embedding: Array(1024).fill(0.1),
        },
        {
          type: 'test',
          content: '原始内容2',
          embedding: Array(1024).fill(0.2),
        },
      ]

      const initialIds = await store.upsertBatch(initialMemories)

      // 混合新增和更新
      const mixedMemories: Array<NewMemory & { id?: number }> = [
        {
          id: initialIds[0],
          type: 'test',
          content: '更新内容1',
          embedding: Array(1024).fill(0.3),
        },
        {
          type: 'test',
          content: '新内容',
          embedding: Array(1024).fill(0.4),
        },
      ]

      const ids = await store.upsertBatch(mixedMemories)

      expect(ids).toHaveLength(2)
    })
  })

  describe('search', () => {
    beforeEach(async () => {
      // 插入测试数据
      const memories: NewMemory[] = [
        {
          type: 'type1',
          content: '相似内容1',
          embedding: Array(1024).fill(0.1),
          metadata: {
            tags: ['tag1', 'tag2'],
          },
        },
        {
          type: 'type2',
          content: '不相似内容',
          embedding: Array(1024).fill(0.9),
          metadata: {
            tags: ['tag3'],
          },
        },
        {
          type: 'type1',
          content: '相似内容2',
          embedding: Array(1024).fill(0.15),
          metadata: {
            tags: ['tag1'],
          },
        },
      ]

      await store.upsertBatch(memories)
    })

    it('应该按向量相似度搜索', async () => {
      const queryEmbedding = Array(1024).fill(0.1)
      const results = await store.search(queryEmbedding, 2)

      expect(results).toHaveLength(2)
      expect(results[0].similarity).toBeGreaterThan(results[1].similarity)
    })

    it('应该支持类型过滤', async () => {
      const queryEmbedding = Array(1024).fill(0.1)
      const results = await store.search(queryEmbedding, 10, {
        types: ['type1'],
      })

      expect(results.every((r) => r.type === 'type1')).toBe(true)
    })

    it('应该支持标签过滤', async () => {
      const queryEmbedding = Array(1024).fill(0.1)
      const results = await store.search(queryEmbedding, 10, {
        tags: ['tag1'],
      })

      expect(
        results.every((r) => {
          const tags = (r.metadata?.tags as string[]) || []
          return tags.includes('tag1')
        })
      ).toBe(true)
    })

    it('应该支持排除归档数据', async () => {
      // 插入归档数据
      await store.upsert({
        type: 'archived',
        content: '归档内容',
        embedding: Array(1024).fill(0.1),
        isArchived: true,
      })

      const queryEmbedding = Array(1024).fill(0.1)
      const results = await store.search(queryEmbedding, 10, {
        excludeArchived: true,
      })

      expect(results.every((r) => !r.metadata?.isArchived)).toBe(true)
    })

    it('应该处理向量维度不匹配', async () => {
      const wrongEmbedding = Array(100).fill(0.1)

      await expect(store.search(wrongEmbedding)).rejects.toThrow()
    })
  })

  describe('get', () => {
    it('应该获取记忆详情', async () => {
      const memory: NewMemory = {
        type: 'test',
        content: '测试内容',
        embedding: Array(1024).fill(0.1),
        metadata: {
          test: true,
        },
      }

      const id = await store.upsert(memory)
      const retrieved = await store.get(id)

      expect(retrieved).toBeDefined()
      expect(retrieved?.content).toBe('测试内容')
      expect(retrieved?.metadata?.test).toBe(true)
    })

    it('应该返回 null 对于不存在的 ID', async () => {
      const result = await store.get(999999)

      expect(result).toBeNull()
    })
  })

  describe('delete', () => {
    it('应该删除记忆', async () => {
      const memory: NewMemory = {
        type: 'test',
        content: '测试内容',
        embedding: Array(1024).fill(0.1),
      }

      const id = await store.upsert(memory)
      const deleted = await store.delete(id)

      expect(deleted).toBe(true)

      // 验证已删除
      const retrieved = await store.get(id)
      expect(retrieved).toBeNull()
    })

    it('应该返回 false 对于不存在的 ID', async () => {
      const deleted = await store.delete(999999)

      expect(deleted).toBe(false)
    })
  })

  describe('getStats', () => {
    it('应该返回统计信息', async () => {
      const stats = await store.getStats()

      expect(stats).toHaveProperty('totalMemories')
      expect(stats).toHaveProperty('archivedMemories')
      expect(stats).toHaveProperty('types')
    })

    it('应该正确统计记忆数量', async () => {
      // 清空
      const allBefore = await store.search(Array(1024).fill(0), 1000)
      for (const mem of allBefore) {
        await store.delete(mem.id)
      }

      // 插入测试数据
      const memories: NewMemory[] = [
        { type: 'type1', content: '内容1', embedding: Array(1024).fill(0.1) },
        { type: 'type2', content: '内容2', embedding: Array(1024).fill(0.2) },
        { type: 'type1', content: '内容3', embedding: Array(1024).fill(0.3) },
      ]

      await store.upsertBatch(memories)

      const stats = await store.getStats()
      expect(stats.totalMemories).toBeGreaterThanOrEqual(3)
    })
  })

  describe('性能监控', () => {
    it('应该记录查询性能', async () => {
      const storeWithMonitoring = new PostgresVectorStore({
        databaseUrl,
        vectorDimension: 1024,
        enablePerformanceMonitoring: true,
      })

      await storeWithMonitoring.initialize()

      // 执行一些查询
      await storeWithMonitoring.search(Array(1024).fill(0.1), 5)

      const stats = await storeWithMonitoring.getStats()

      // 性能监控不影响功能
      expect(stats).toBeDefined()

      await storeWithMonitoring.close()
    })
  })

  describe('close', () => {
    it('应该关闭数据库连接', async () => {
      expect(() => store.close()).not.toThrow()
    })
  })
})
