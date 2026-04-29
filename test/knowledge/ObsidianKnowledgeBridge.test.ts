/**
 * Obsidian知识库桥接测试
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { ObsidianKnowledgeBridge } from '../../ai/knowledge/ObsidianKnowledgeBridge';

describe('Obsidian知识库桥接测试', () => {
  let bridge: ObsidianKnowledgeBridge;

  beforeAll(() => {
    // 从环境变量读取知识库路径
    const knowledgeBasePath = process.env.KNOWLEDGE_BASE_PATH;

    if (!knowledgeBasePath) {
      console.warn('警告: 未设置环境变量 KNOWLEDGE_BASE_PATH，测试将被跳过');
    }

    bridge = new ObsidianKnowledgeBridge(knowledgeBasePath);
  });

  describe('知识卡片查询', () => {
    it('应该能够查询"什么是创造性"卡片', async () => {
      const card = await bridge.queryCard('什么是创造性');

      expect(card).not.toBeNull();
      expect(card?.quality).toBeGreaterThan(0.7);
      expect(card?.content).toContain('技术启示');
      expect(card?.relatedPages.length).toBeGreaterThan(0);
    }, 10000);

    it('应该能够查询"什么是充分公开"卡片', async () => {
      const card = await bridge.queryCard('什么是充分公开');

      expect(card).not.toBeNull();
      expect(card?.quality).toBeGreaterThan(0);
      expect(card?.content).toContain('A26.3');
    }, 10000);

    it('对于不存在的问题应该返回null', async () => {
      const card = await bridge.queryCard('这个问题肯定不存在于知识库中');

      expect(card).toBeNull();
    });

    it('应该使用缓存加速重复查询', async () => {
      const stats1 = bridge.getCacheStats();

      // 第一次查询
      await bridge.queryCard('什么是创造性');

      const stats2 = bridge.getCacheStats();

      // 缓存应该增加
      expect(stats2.cards).toBeGreaterThan(stats1.cards);

      // 第二次查询（应该从缓存读取）
      await bridge.queryCard('什么是创造性');

      const stats3 = bridge.getCacheStats();

      // 缓存数量不变（说明使用了缓存）
      expect(stats3.cards).toBe(stats2.cards);
    });
  });

  describe('Wiki页面查询', () => {
    it('应该能够根据概念查询相关页面', async () => {
      const pages = await bridge.queryByConcept('充分公开');

      expect(pages.length).toBeGreaterThan(5);
      expect(pages).toContain('专利实务/说明书/说明书-充分公开概述');
    }, 10000);

    it('应该能够读取Wiki页面内容', async () => {
      const content = await bridge.readWikiPage('专利实务/说明书/说明书-充分公开概述');

      expect(content).toContain('充分公开');
      expect(content).toContain('A26.3');
    }, 10000);

    it('应该能够获取Wiki页面的完整信息', async () => {
      const page = await bridge.getWikiPage('专利实务/说明书/说明书-充分公开概述');

      expect(page).not.toBeNull();
      expect(page?.title).toBeDefined();
      expect(page?.content).toContain('充分公开');
      expect(page?.links.length).toBeGreaterThan(0);
    }, 10000);
  });

  describe('缓存功能', () => {
    it('应该能够清除缓存', async () => {
      // 先查询一些数据
      await bridge.queryCard('什么是创造性');
      await bridge.getWikiPage('专利实务/说明书/说明书-充分公开概述');

      const stats1 = bridge.getCacheStats();
      expect(stats1.cards).toBeGreaterThan(0);
      expect(stats1.pages).toBeGreaterThan(0);

      // 清除缓存
      bridge.clearCache();

      const stats2 = bridge.getCacheStats();
      expect(stats2.cards).toBe(0);
      expect(stats2.pages).toBe(0);
    });

    it('应该能够获取缓存统计信息', () => {
      const stats = bridge.getCacheStats();

      expect(stats).toHaveProperty('cards');
      expect(stats).toHaveProperty('pages');
      expect(typeof stats.cards).toBe('number');
      expect(typeof stats.pages).toBe('number');
    });
  });

  describe('错误处理', () => {
    it('对于不存在的Wiki页面应该返回空字符串', async () => {
      const content = await bridge.readWikiPage('这个页面/肯定/不存在');

      expect(content).toBe('');
    });

    it('对于不存在的概念应该返回空数组', async () => {
      const pages = await bridge.queryByConcept('这个概念肯定不存在');

      expect(pages).toEqual([]);
    });
  });

  describe('知识库完整性', () => {
    it('应该能够查询多个创造性相关概念', async () => {
      const concepts = ['创造性', '充分公开', '技术启示', '三步法'];

      const results = await Promise.all(
        concepts.map(async (concept) => {
          const pages = await bridge.queryByConcept(concept);
          return { concept, count: pages.length };
        })
      );

      // 所有概念都应该找到相关页面
      results.forEach((result) => {
        expect(result.count).toBeGreaterThan(0);
      });
    }, 20000);
  });
});
