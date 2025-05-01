/**
 * 记忆层集成测试
 *
 * 测试向量存储 + 图存储的协同工作
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { MemoryLayer } from '../long-term/MemoryLayer.js'

describe('记忆层集成测试', () => {
  let memory: MemoryLayer

  beforeAll(async () => {
    const databaseUrl = process.env.TEST_DATABASE_URL ?? 'postgres://localhost:5432/yunpat_test'

    memory = new MemoryLayer({
      databaseUrl,
      vectorDimension: 128,
    })

    await memory.initialize()
  })

  afterAll(async () => {
    await memory.close()
  })

  describe('完整工作流', () => {
    it('应该支持完整的记忆管理流程', async () => {
      // 1. 添加记忆
      const memoryId = await memory.addMemory({
        type: 'patent',
        content: '专利 CN123456 涉及人工智能技术',
        embedding: Array(128).fill(0.1),
        metadata: {
          agent: 'writer',
          tags: ['AI', '专利'],
        },
      })

      expect(memoryId).toBeGreaterThan(0)

      // 2. 搜索记忆
      const results = await memory.searchMemories(Array(128).fill(0.11), 5, { types: ['patent'] })

      expect(results.length).toBeGreaterThan(0)

      // 3. 获取详情
      const detail = await memory.getMemory(memoryId)
      expect(detail).not.toBeNull()
    })

    it('应该支持图推理增强记忆检索', async () => {
      // 1. 创建实体
      const patentId = await memory.createEntity({
        type: 'Patent',
        name: 'CN789012',
        properties: { field: 'NLP' },
      })

      const companyId = await memory.createEntity({
        type: 'Company',
        name: '宝宸科技',
      })

      // 2. 创建关系
      await memory.createRelation({
        fromEntityId: patentId,
        toEntityId: companyId,
        relationType: 'OWNS',
        weight: 0.95,
      })

      // 3. 查找相关公司
      const neighbors = await memory.getNeighbors(patentId, 'OWNS')

      expect(neighbors.length).toBeGreaterThan(0)
      expect(neighbors[0].name).toBe('宝宸科技')
    })

    it('应该支持路径查询', async () => {
      // 创建测试图
      const person1 = await memory.createEntity({
        type: 'Person',
        name: '发明人A',
      })

      const patent1 = await memory.createEntity({
        type: 'Patent',
        name: 'CN111111',
      })

      const company = await memory.createEntity({
        type: 'Company',
        name: '宝宸科技',
      })

      // 建立关系
      await memory.createRelation({
        fromEntityId: person1,
        toEntityId: patent1,
        relationType: 'INVENTED',
      })

      await memory.createRelation({
        fromEntityId: patent1,
        toEntityId: company,
        relationType: 'OWNS',
      })

      // 查找路径：发明人 -> 专利 -> 公司
      const path = await memory.findShortestPath(person1, company, 5)

      expect(path).not.toBeNull()
      expect(path?.nodes.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe('统计信息', () => {
    it('应该返回完整的统计信息', async () => {
      const stats = await memory.getStats()

      expect(stats.vector).toBeDefined()
      expect(stats.graph).toBeDefined()
      expect(stats.vector.totalMemories).toBeGreaterThan(0)
      expect(stats.graph.totalEntities).toBeGreaterThan(0)
    })
  })
})
