/**
 * MemoryStore 测试
 *
 * 覆盖 ShortTermMemory CRUD 和 MemoryManager 高级操作
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ShortTermMemory, MemoryManager } from '../../src/memory/MemoryStore.js';
import { SAMPLE_MEMORY_ENTRIES } from '../helpers/fixtures.js';

describe('ShortTermMemory', () => {
  let memory: ShortTermMemory;

  beforeEach(() => {
    memory = new ShortTermMemory();
  });

  describe('基础 CRUD', () => {
    it('set/get 应正确存取值', async () => {
      await memory.set('key1', 'value1');
      const result = await memory.get('key1');
      expect(result).toBe('value1');
    });

    it('get 不存在的 key 应返回 undefined', async () => {
      const result = await memory.get('nonexistent');
      expect(result).toBeUndefined();
    });

    it('delete 应删除指定 key', async () => {
      await memory.set('key1', 'value1');
      await memory.delete('key1');
      const result = await memory.get('key1');
      expect(result).toBeUndefined();
    });

    it('has 应正确判断 key 是否存在', async () => {
      await memory.set('key1', 'value1');
      expect(await memory.has('key1')).toBe(true);
      expect(await memory.has('nonexistent')).toBe(false);
    });

    it('set 应覆盖已存在的值', async () => {
      await memory.set('key1', 'old');
      await memory.set('key1', 'new');
      expect(await memory.get('key1')).toBe('new');
    });

    it('应支持存储各种类型的值', async () => {
      await memory.set('string', 'hello');
      await memory.set('number', 42);
      await memory.set('object', { a: 1, b: [2, 3] });
      await memory.set('boolean', true);
      await memory.set('null', null);

      expect(await memory.get('string')).toBe('hello');
      expect(await memory.get('number')).toBe(42);
      expect(await memory.get('object')).toEqual({ a: 1, b: [2, 3] });
      expect(await memory.get('boolean')).toBe(true);
      expect(await memory.get('null')).toBeNull();
    });
  });

  describe('getAll', () => {
    it('应返回所有键值对', async () => {
      await memory.set('a', 1);
      await memory.set('b', 2);

      const all = await memory.getAll();
      expect(all).toEqual({ a: 1, b: 2 });
    });

    it('空存储应返回空对象', async () => {
      const all = await memory.getAll();
      expect(all).toEqual({});
    });

    it('应返回快照（不影响原始数据）', async () => {
      await memory.set('key', 'value');
      const all = await memory.getAll();
      all.key = 'modified';

      expect(await memory.get('key')).toBe('value');
    });
  });

  describe('clear', () => {
    it('应清空所有数据', async () => {
      await memory.set('a', 1);
      await memory.set('b', 2);
      await memory.clear();

      expect(await memory.getAll()).toEqual({});
      expect(memory.size()).toBe(0);
    });
  });

  describe('search', () => {
    it('应返回空数组（短期记忆不支持搜索）', async () => {
      await memory.set('key', 'value');
      const results = await memory.search('query');
      expect(results).toEqual([]);
    });

    it('应接受 topK 参数', async () => {
      const results = await memory.search('query', 5);
      expect(results).toEqual([]);
    });
  });

  describe('size', () => {
    it('应正确返回条目数', async () => {
      expect(memory.size()).toBe(0);
      await memory.set('a', 1);
      expect(memory.size()).toBe(1);
      await memory.set('b', 2);
      expect(memory.size()).toBe(2);
      await memory.delete('a');
      expect(memory.size()).toBe(1);
    });
  });

  describe('批量操作', () => {
    it('应支持批量写入和读取', async () => {
      for (const [key, value] of Object.entries(SAMPLE_MEMORY_ENTRIES)) {
        await memory.set(key, value);
      }

      expect(memory.size()).toBe(3);
      const all = await memory.getAll();
      expect(all['session-context']).toEqual({ topic: 'patent-drafting', step: 3 });
    });
  });
});

describe('MemoryManager', () => {
  let manager: MemoryManager;

  beforeEach(() => {
    manager = new MemoryManager();
  });

  describe('getShortTerm', () => {
    it('应返回 ShortTermMemory 实例', () => {
      const stm = manager.getShortTerm();
      expect(stm).toBeInstanceOf(ShortTermMemory);
    });
  });

  describe('add/get', () => {
    it('应正确添加和获取记忆', async () => {
      await manager.add('key1', 'value1');
      const result = await manager.get('key1');
      expect(result).toBe('value1');
    });

    it('应委托给 ShortTermMemory', async () => {
      await manager.add('a', 1);
      await manager.add('b', 2);

      const stm = manager.getShortTerm();
      expect(stm.size()).toBe(2);
    });
  });

  describe('getHistory', () => {
    it('应返回有序历史', async () => {
      await manager.add('first', 1);
      await manager.add('second', 2);

      const history = manager.getHistory();
      expect(history).toHaveLength(2);
      expect(history[0].key).toBe('first');
      expect(history[1].key).toBe('second');
    });

    it('历史条目应包含时间戳', async () => {
      await manager.add('key', 'value');
      const history = manager.getHistory();
      expect(history[0].timestamp).toBeInstanceOf(Date);
    });

    it('空管理器应返回空数组', () => {
      expect(manager.getHistory()).toEqual([]);
    });
  });

  describe('clear', () => {
    it('应清空短期记忆和历史', async () => {
      await manager.add('a', 1);
      await manager.add('b', 2);
      await manager.clear();

      expect(manager.getShortTerm().size()).toBe(0);
      expect(manager.getHistory()).toEqual([]);
    });
  });

  describe('compress', () => {
    it('应返回删除的记忆数量', async () => {
      await manager.add('a', 1);
      const deleted = await manager.compress();
      expect(typeof deleted).toBe('number');
      expect(deleted).toBeGreaterThanOrEqual(0);
    });

    it('应在记忆过多时删除最旧的', async () => {
      // 添加少量记忆，不应删除
      for (let i = 0; i < 5; i++) {
        await manager.add(`key${i}`, i);
      }
      let deleted = await manager.compress(10);
      expect(deleted).toBe(0); // 无需压缩

      // 添加更多记忆，应删除
      for (let i = 5; i < 15; i++) {
        await manager.add(`key${i}`, i);
      }
      deleted = await manager.compress(10);
      expect(deleted).toBe(5); // 删除 5 条
      expect(manager.getHistory().length).toBe(10);
    });
  });
});
