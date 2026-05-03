/**
 * PostgreSQL 图存储测试
 *
 * 测试覆盖：
 * - 实体与关系管理
 * - 路径查询
 * - 邻居发现
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PostgresGraphStore } from '../long-term/PostgresGraphStore.js'

describe('PostgreSQL 图存储', () => {
  let store: PostgresGraphStore

  beforeAll(async () => {
    const databaseUrl = process.env.TEST_DATABASE_URL ?? 'postgres://localhost:5432/yunpat_test'

    store = new PostgresGraphStore({
      databaseUrl,
    })
  })

  afterAll(async () => {
    await store.close()
  })

  describe('实体管理', () => {
    it('应该成功创建实体', async () => {
      const id = await store.createEntity({
        type: 'Person',
        name: '张三',
        properties: { role: '发明人' },
      })

      expect(id).toBeGreaterThan(0)
    })

    it('应该成功查找实体', async () => {
      const id = await store.createEntity({
        type: 'Patent',
        name: 'CN123456',
      })

      const entity = await store.getEntity(id)

      expect(entity).not.toBeNull()
      expect(entity?.name).toBe('CN123456')
    })

    it('应该支持按名称查找实体', async () => {
      await store.createEntity({
        type: 'Company',
        name: '宝宸科技',
      })

      const entity = await store.findEntityByName('宝宸科技', 'Company')

      expect(entity).not.toBeNull()
      expect(entity?.type).toBe('Company')
    })
  })

  describe('关系管理', () => {
    let patentId: number
    let companyId: number

    beforeAll(async () => {
      patentId = await store.createEntity({
        type: 'Patent',
        name: 'CN789012',
      })

      companyId = await store.createEntity({
        type: 'Company',
        name: '测试公司',
      })
    })

    it('应该成功创建关系', async () => {
      const relationId = await store.createRelation({
        fromEntityId: patentId,
        toEntityId: companyId,
        relationType: 'OWNS',
        weight: 0.9,
      })

      expect(relationId).toBeGreaterThan(0)
    })

    it('应该成功获取邻居', async () => {
      const neighbors = await store.getNeighbors(patentId)

      expect(neighbors.length).toBeGreaterThan(0)
      expect(neighbors.some((n) => n.name === '测试公司')).toBe(true)
    })

    it('应该支持按关系类型过滤', async () => {
      const neighbors = await store.getNeighbors(patentId, 'OWNS')

      expect(neighbors.length).toBeGreaterThan(0)
    })
  })

  describe('路径查询', () => {
    let person1: number
    let person2: number
    let person3: number
    let company: number

    beforeAll(async () => {
      // 创建测试图：张三 -> 宝宸 -> 李四
      person1 = await store.createEntity({
        type: 'Person',
        name: '张三',
      })

      company = await store.createEntity({
        type: 'Company',
        name: '宝宸科技',
      })

      person2 = await store.createEntity({
        type: 'Person',
        name: '李四',
      })

      person3 = await store.createEntity({
        type: 'Person',
        name: '王五',
      })

      // 建立关系
      await store.createRelation({
        fromEntityId: person1,
        toEntityId: company,
        relationType: 'WORKS_AT',
      })

      await store.createRelation({
        fromEntityId: person2,
        toEntityId: company,
        relationType: 'WORKS_AT',
      })

      await store.createRelation({
        fromEntityId: company,
        toEntityId: person3,
        relationType: 'EMPLOYS',
      })
    })

    it('应该找到最短路径', async () => {
      const path = await store.findShortestPath(person1, person2, 5)

      expect(path).not.toBeNull()
      expect(path?.nodes.length).toBeGreaterThan(0)
    })

    it('应该找到多跳路径', async () => {
      const path = await store.findShortestPath(person1, person3, 5)

      expect(path).not.toBeNull()
      expect(path?.nodes.length).toBeGreaterThanOrEqual(3) // 张三 -> 宝宸 -> 王五
    })

    it('应该支持查找相关实体', async () => {
      const related = await store.findRelatedEntities(person1, 2, 0.5)

      expect(related.size).toBeGreaterThan(0)
    })
  })

  describe('统计信息', () => {
    it('应该返回正确的统计信息', async () => {
      const stats = await store.getStats()

      expect(stats.totalEntities).toBeGreaterThan(0)
      expect(stats.totalRelations).toBeGreaterThan(0)
      expect(stats.entityTypes).toBeDefined()
      expect(stats.relationTypes).toBeDefined()
    })
  })
})
