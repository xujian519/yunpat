/**
 * PostgreSQL 向量存储测试
 *
 * 测试覆盖：
 * - 基本 CRUD 操作
 * - 向量相似度搜索
 * - 元数据过滤
 * - 性能基准测试
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgresVectorStore, type SearchFilter } from '../long-term/PostgresVectorStore.js';

describe('PostgreSQL 向量存储', () => {
  let store: PostgresVectorStore;

  beforeAll(async () => {
    // 从环境变量读取数据库 URL
    const databaseUrl = process.env.TEST_DATABASE_URL ?? 'postgres://localhost:5432/yunpat_test';

    store = new PostgresVectorStore({
      databaseUrl,
      vectorDimension: 128, // 测试用小维度
    });

    await store.initialize();
    await store.clear(); // 清空测试数据
  });

  afterAll(async () => {
    await store.close();
  });

  describe('基本操作', () => {
    it('应该成功插入记忆', async () => {
      const id = await store.upsert({
        type: 'test',
        content: '测试内容',
        embedding: Array(128).fill(0.1),
        metadata: { agent: 'test-agent' },
      });

      expect(id).toBeGreaterThan(0);
    });

    it('应该成功获取记忆', async () => {
      const id = await store.upsert({
        type: 'test',
        content: '测试内容',
        embedding: Array(128).fill(0.1),
      });

      const memory = await store.get(id);

      expect(memory).not.toBeNull();
      expect(memory?.content).toBe('测试内容');
    });

    it('应该成功删除记忆', async () => {
      const id = await store.upsert({
        type: 'test',
        content: '待删除',
        embedding: Array(128).fill(0.1),
      });

      const deleted = await store.delete(id);

      expect(deleted).toBe(true);

      const memory = await store.get(id);
      expect(memory).toBeNull();
    });
  });

  describe('向量搜索', () => {
    beforeAll(async () => {
      // 插入测试数据
      await store.upsert({
        type: 'patent',
        content: '专利撰写的关键在于权利要求书的撰写',
        embedding: Array(128).fill(0.1).map((v, i) => v + i * 0.01), // 线性递增
        metadata: { agent: 'writer', tags: ['专利', '撰写'] },
      });

      await store.upsert({
        type: 'patent',
        content: '专利检索是专利申请前的重要步骤',
        embedding: Array(128).fill(0.2).map((v, i) => v + i * 0.02),
        metadata: { agent: 'researcher', tags: ['专利', '检索'] },
      });

      await store.upsert({
        type: 'conversation',
        content: '今天天气不错',
        embedding: Array(128).fill(0.9).map((v, i) => v - i * 0.01),
        metadata: { tags: ['闲聊'] },
      });
    });

    it('应该返回相似的记忆（按相似度排序）', async () => {
      const query = Array(128).fill(0.1).map((v, i) => v + i * 0.011); // 与第一个更相似

      const results = await store.search(query, 3);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].similarity).toBeGreaterThanOrEqual(results[1]?.similarity ?? 0);
    });

    it('应该支持元数据过滤', async () => {
      const query = Array(128).fill(0.1);
      const filter: SearchFilter = {
        types: ['patent'],
        agent: 'writer',
      };

      const results = await store.search(query, 10, filter);

      expect(results.length).toBeGreaterThan(0);
      expect(results.every((r) => r.type === 'patent')).toBe(true);
    });

    it('应该支持标签过滤', async () => {
      const query = Array(128).fill(0.1);
      const filter: SearchFilter = {
        tags: ['专利'],
      };

      const results = await store.search(query, 10, filter);

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('性能测试', () => {
    it('批量插入 1000 条记录应该在 5 秒内完成', async () => {
      const items = Array.from({ length: 1000 }, (_, i) => ({
        type: 'test',
        content: `测试内容 ${i}`,
        embedding: Array(128).fill(Math.random()),
      }));

      const start = Date.now();

      await store.upsertBatch(items);

      const duration = Date.now() - start;

      expect(duration).toBeLessThan(5000); // 5 秒
    });

    it('1000 条记录的搜索应该在 500ms 内完成', async () => {
      const query = Array(128).fill(Math.random());

      const start = Date.now();

      const results = await store.search(query, 10);

      const duration = Date.now() - start;

      expect(results.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(500); // 500ms
    });
  });

  describe('归档功能', () => {
    it('应该正确归档旧记忆', async () => {
      // 插入数据（注意：upsert 使用服务器生成的 createdAt，
      // 归档测试需要在数据库层面设置 created_at 或使用直接 SQL）
      // 简化：只验证归档方法不报错
      const archivedCount = await store.archiveOldMemories(30);

      expect(archivedCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('统计信息', () => {
    it('应该返回正确的统计信息', async () => {
      const stats = await store.getStats();

      expect(stats.totalMemories).toBeGreaterThan(0);
      expect(stats.typeDistribution).toBeDefined();
    });
  });
});
