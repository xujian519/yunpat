import { describe, it, expect, beforeEach } from 'vitest';
import { KnowledgeBase, KnowledgeEntryType, createKnowledgeBase } from '../../src/knowledge/KnowledgeBase.js';

let entryCounter = 0;

function createTestEntry(overrides?: Partial<{
  title: string;
  content: string;
  tags: string[];
  category: string;
  type: KnowledgeEntryType;
  priority: number;
}>): {
  title: string;
  content: string;
  tags: string[];
  category: string;
  type: KnowledgeEntryType;
  priority: number;
} {
  entryCounter++;
  return {
    title: `测试条目-${entryCounter}`,
    content: '这是测试内容，包含关键词创造性、新颖性、专利法。',
    tags: ['专利', '测试'],
    category: `test-category-${entryCounter}`,
    type: KnowledgeEntryType.DOCUMENT,
    priority: 1,
    ...overrides,
  };
}

describe('KnowledgeBase', () => {
  let kb: KnowledgeBase;

  beforeEach(async () => {
    entryCounter = 0;
    kb = createKnowledgeBase({
      name: 'test-kb',
      persistent: false,
      loadBuiltin: false,
    });
    await kb.initialize();
  });

  describe('store', () => {
    it('应该存储知识条目并返回ID', async () => {
      const entry = createTestEntry();
      const id = await kb.store(entry);

      expect(id).toBeTruthy();
      expect(typeof id).toBe('string');
    });

    it('应该生成嵌入向量', async () => {
      const embedFn = async (text: string) => [0.1, 0.2, 0.3];
      const kbWithEmbed = createKnowledgeBase({
        name: 'test-embed',
        persistent: false,
        loadBuiltin: false,
        embedFn,
      });
      await kbWithEmbed.initialize();

      const id = await kbWithEmbed.store(createTestEntry());
      const stored = kbWithEmbed.get(id);
      expect(stored?.embedding).toEqual([0.1, 0.2, 0.3]);
    });

    it('应该自动设置创建时间和版本', async () => {
      const id = await kb.store(createTestEntry());
      const stored = kb.get(id);

      expect(stored?.createdAt).toBeInstanceOf(Date);
      expect(stored?.updatedAt).toBeInstanceOf(Date);
      expect(stored?.version).toBe(1);
      expect(stored?.referenceCount).toBe(0);
    });
  });

  describe('get', () => {
    it('应该获取已存储的条目', async () => {
      const entry = createTestEntry();
      const id = await kb.store(entry);
      const stored = kb.get(id);

      expect(stored).toBeDefined();
      expect(stored?.title).toBe(entry.title);
      expect(stored?.content).toBe(entry.content);
    });

    it('应该返回undefined对于不存在的ID', () => {
      expect(kb.get('non-existent')).toBeUndefined();
    });
  });

  describe('update', () => {
    it('应该更新现有条目', async () => {
      const id = await kb.store(createTestEntry());
      await kb.update(id, { title: '更新标题' });

      const updated = kb.get(id);
      expect(updated?.title).toBe('更新标题');
      expect(updated?.version).toBe(2);
    });

    it('应该抛出错误对于不存在的条目', async () => {
      await expect(kb.update('non-existent', { title: 'test' })).rejects.toThrow('知识条目不存在');
    });

    it('应该重新生成嵌入向量', async () => {
      const embedFn = async (text: string) => [0.9, 0.8, 0.7];
      const kbWithEmbed = createKnowledgeBase({
        name: 'test-update-embed',
        persistent: false,
        loadBuiltin: false,
        embedFn,
      });
      await kbWithEmbed.initialize();

      const id = await kbWithEmbed.store(createTestEntry());
      await kbWithEmbed.update(id, { title: '新标题', content: '新内容' });

      const updated = kbWithEmbed.get(id);
      expect(updated?.embedding).toEqual([0.9, 0.8, 0.7]);
    });
  });

  describe('delete', () => {
    it('应该删除条目并返回true', async () => {
      const id = await kb.store(createTestEntry());
      const result = await kb.delete(id);

      expect(result).toBe(true);
      expect(kb.get(id)).toBeUndefined();
    });

    it('应该返回false对于不存在的条目', async () => {
      const result = await kb.delete('non-existent');
      expect(result).toBe(false);
    });

    it('应该从索引中移除', async () => {
      const entry = createTestEntry({ tags: ['unique-tag'], category: 'unique-cat' });
      const id = await kb.store(entry);
      await kb.delete(id);

      expect(kb.getByTag('unique-tag')).toHaveLength(0);
      expect(kb.getByCategory('unique-cat')).toHaveLength(0);
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      await kb.store(createTestEntry({
        title: '创造性判断方法',
        content: '创造性是指与现有技术相比具有突出的实质性特点。',
        tags: ['创造性', '专利授权'],
        category: 'patent-law',
        priority: 2,
      }));
      await kb.store(createTestEntry({
        title: '新颖性要求',
        content: '新颖性要求发明不属于现有技术。',
        tags: ['新颖性', '专利授权'],
        category: 'patent-law',
        priority: 1,
      }));
      await kb.store(createTestEntry({
        title: 'TypeScript 类型系统',
        content: 'TypeScript 提供静态类型检查。',
        tags: ['TypeScript', '编程'],
        category: 'programming',
        priority: 1,
      }));
    });

    it('应该通过关键词搜索', async () => {
      const results = await kb.search('创造性', { mode: 'keyword', limit: 10, minSimilarity: 0.01 });
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].entry.title).toContain('创造性');
    });

    it('应该按优先级排序', async () => {
      const results = await kb.search('专利', { mode: 'keyword', limit: 10, minSimilarity: 0.01 });
      expect(results.length).toBeGreaterThanOrEqual(2);
      expect(results[0].entry.priority).toBeGreaterThanOrEqual(results[1]?.entry.priority ?? 0);
    });

    it('应该支持语义搜索回退', async () => {
      const results = await kb.search('创造性判断方法', { mode: 'semantic', limit: 10, minSimilarity: 0.01 });
      expect(results.length).toBeGreaterThan(0);
    });

    it('应该支持混合搜索', async () => {
      const results = await kb.search('创造性', { mode: 'hybrid', limit: 10, minSimilarity: 0.01 });
      expect(results.length).toBeGreaterThan(0);
    });

    it('应该按类别过滤', async () => {
      const results = await kb.search('技术', {
        mode: 'keyword',
        categories: ['programming'],
        limit: 10,
      });
      expect(results.every((r) => r.entry.category === 'programming')).toBe(true);
    });

    it('应该按标签过滤', async () => {
      const results = await kb.search('专利', {
        mode: 'keyword',
        tags: ['创造性'],
        limit: 10,
      });
      expect(results.every((r) => r.entry.tags.includes('创造性'))).toBe(true);
    });

    it('应该限制结果数量', async () => {
      const results = await kb.search('技术', { mode: 'keyword', limit: 1 });
      expect(results.length).toBeLessThanOrEqual(1);
    });

    it('应该应用最低相似度阈值', async () => {
      const results = await kb.search('完全不相关的内容xyz', {
        mode: 'keyword',
        minSimilarity: 0.9,
        limit: 10,
      });
      expect(results.length).toBe(0);
    });
  });

  describe('getByCategory', () => {
    it('应该按类别获取条目', async () => {
      await kb.store({ title: 'a1', content: 'c', tags: ['t'], category: 'cat-a', type: KnowledgeEntryType.DOCUMENT, priority: 1 });
      await kb.store({ title: 'a2', content: 'c', tags: ['t'], category: 'cat-a', type: KnowledgeEntryType.DOCUMENT, priority: 1 });
      await kb.store({ title: 'b1', content: 'c', tags: ['t'], category: 'cat-b', type: KnowledgeEntryType.DOCUMENT, priority: 1 });

      const results = kb.getByCategory('cat-a');
      expect(results).toHaveLength(2);
    });

    it('应该返回空数组对于不存在的类别', () => {
      expect(kb.getByCategory('non-existent')).toHaveLength(0);
    });
  });

  describe('getByTag', () => {
    it('应该按标签获取条目', async () => {
      await kb.store({ title: 't1', content: 'c', tags: ['tag-a'], category: 'c1', type: KnowledgeEntryType.DOCUMENT, priority: 1 });
      await kb.store({ title: 't2', content: 'c', tags: ['tag-a', 'tag-b'], category: 'c2', type: KnowledgeEntryType.DOCUMENT, priority: 1 });

      const results = kb.getByTag('tag-a');
      expect(results).toHaveLength(2);
    });

    it('应该返回空数组对于不存在的标签', () => {
      expect(kb.getByTag('non-existent')).toHaveLength(0);
    });
  });

  describe('getStats', () => {
    it('应该返回正确的统计信息', async () => {
      await kb.store(createTestEntry({ type: KnowledgeEntryType.DOCUMENT, category: 'shared-cat' }));
      await kb.store(createTestEntry({ type: KnowledgeEntryType.EXAMPLE, category: 'shared-cat' }));
      await kb.store(createTestEntry({
        type: KnowledgeEntryType.DOCUMENT,
        category: 'other-cat',
      }));

      const stats = kb.getStats();
      expect(stats.totalEntries).toBe(3);
      expect(stats.byType[KnowledgeEntryType.DOCUMENT]).toBe(2);
      expect(stats.byType[KnowledgeEntryType.EXAMPLE]).toBe(1);
      expect(Object.keys(stats.byCategory)).toContain('shared-cat');
      expect(Object.keys(stats.byCategory)).toContain('other-cat');
    });

    it('应该处理空知识库', () => {
      const stats = kb.getStats();
      expect(stats.totalEntries).toBe(0);
      expect(stats.averageReferences).toBe(0);
    });
  });

  describe('enhancePrompt', () => {
    let kbLowThreshold: KnowledgeBase;

    beforeEach(async () => {
      kbLowThreshold = createKnowledgeBase({
        name: 'test-enhance',
        persistent: false,
        loadBuiltin: false,
        defaultSearchOptions: {
          mode: 'hybrid',
          limit: 10,
          minSimilarity: 0.01,
        },
      });
      await kbLowThreshold.initialize();
    });

    it('应该增强提示词', async () => {
      await kbLowThreshold.store({
        title: '创造性判断',
        content: '创造性判断是专利审查的重要步骤。',
        tags: ['创造性'],
        category: 'patent',
        type: KnowledgeEntryType.DOCUMENT,
        priority: 1,
      });

      const result = await kbLowThreshold.enhancePrompt('如何判断创造性？');
      expect(result.enhancedPrompt).toContain('相关知识');
      expect(result.injectedEntries.length).toBeGreaterThan(0);
      expect(result.injectedCategories).toContain('patent');
    });

    it('应该增加引用计数', async () => {
      const id = await kbLowThreshold.store({
        title: '创造性判断',
        content: '创造性判断是专利审查的重要步骤。',
        tags: ['创造性'],
        category: 'patent',
        type: KnowledgeEntryType.DOCUMENT,
        priority: 1,
      });

      await kbLowThreshold.enhancePrompt('如何判断创造性？');
      const entry = kbLowThreshold.get(id);
      expect(entry?.referenceCount).toBeGreaterThan(0);
    });

    it('应该避免重复类别', async () => {
      await kbLowThreshold.store({
        title: '创造性',
        content: '内容1',
        category: 'patent',
        tags: ['创造性'],
        type: KnowledgeEntryType.DOCUMENT,
        priority: 1,
      });
      await kbLowThreshold.store({
        title: '新颖性',
        content: '内容2',
        category: 'patent',
        tags: ['新颖性'],
        type: KnowledgeEntryType.DOCUMENT,
        priority: 1,
      });

      const result = await kbLowThreshold.enhancePrompt('创造性 新颖性');
      expect(result.injectedCategories.filter((c) => c === 'patent')).toHaveLength(1);
    });
  });

  describe('listAll', () => {
    it('应该返回所有条目', async () => {
      await kb.store({ title: '条目1', content: '内容1', tags: ['t'], category: 'c1', type: KnowledgeEntryType.DOCUMENT, priority: 1 });
      await kb.store({ title: '条目2', content: '内容2', tags: ['t'], category: 'c2', type: KnowledgeEntryType.DOCUMENT, priority: 1 });

      const all = kb.listAll();
      expect(all).toHaveLength(2);
    });

    it('空知识库应返回空数组', () => {
      expect(kb.listAll()).toHaveLength(0);
    });
  });

  describe('clear', () => {
    it('应该清除所有数据和索引', async () => {
      await kb.store(createTestEntry());
      await kb.clear();

      expect(kb.listAll()).toHaveLength(0);
      expect(kb.getStats().totalEntries).toBe(0);
    });
  });

  describe('initialize with builtin', () => {
    it('应该加载内置知识库', async () => {
      const kbWithBuiltin = createKnowledgeBase({
        name: 'test-builtin',
        persistent: false,
        loadBuiltin: true,
      });
      await kbWithBuiltin.initialize();

      const stats = kbWithBuiltin.getStats();
      expect(stats.totalEntries).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('应该处理没有标签的条目', async () => {
      const id = await kb.store({
        title: '无标签',
        content: '内容',
        tags: [],
        category: 'test',
        type: KnowledgeEntryType.DOCUMENT,
        priority: 1,
      });

      const stored = kb.get(id);
      expect(stored?.tags).toEqual([]);
    });

    it('应该处理特殊字符的标题', async () => {
      const id = await kb.store({
        title: '标题:测试/特殊',
        content: '内容',
        tags: ['test'],
        category: 'test',
        type: KnowledgeEntryType.DOCUMENT,
        priority: 1,
      });

      expect(kb.get(id)).toBeDefined();
    });

    it('应该处理大优先级值', async () => {
      const id = await kb.store({
        title: '高优先级',
        content: '内容',
        tags: ['test'],
        category: 'test',
        type: KnowledgeEntryType.DOCUMENT,
        priority: 100,
      });

      const stored = kb.get(id);
      expect(stored?.priority).toBe(100);
    });
  });
});
