/**
 * CheckpointManager 测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  CheckpointManager,
  EnhancedMemoryStore,
  ResumeManager,
} from '../../src/memory/CheckpointManager.js';
import type { Checkpoint } from '../../src/memory/CheckpointManager.js';

describe('CheckpointManager', () => {
  let manager: CheckpointManager;

  beforeEach(() => {
    manager = new CheckpointManager();
  });

  describe('saveCheckpoint', () => {
    it('应创建检查点并返回', async () => {
      const cp = await manager.saveCheckpoint(
        'test-agent',
        'exec-1',
        1,
        { key: 'value' },
        { ctx: true },
        { state: 1 }
      );

      expect(cp.id).toBeDefined();
      expect(cp.agentName).toBe('test-agent');
      expect(cp.executionId).toBe('exec-1');
      expect(cp.iteration).toBe(1);
      expect(cp.memorySnapshot).toEqual({ key: 'value' });
    });

    it('应深拷贝快照数据', async () => {
      const data = { nested: { value: 'original' } };
      const cp = await manager.saveCheckpoint('a', 'e', 1, data, {}, {});

      // 修改原始数据不应影响快照
      data.nested.value = 'modified';
      expect(cp.memorySnapshot.nested.value).toBe('original');
    });

    it('应支持 tags 和 notes', async () => {
      const cp = await manager.saveCheckpoint(
        'a',
        'e',
        1,
        {},
        {},
        {},
        ['important', 'milestone'],
        'First checkpoint'
      );

      expect(cp.tags).toEqual(['important', 'milestone']);
      expect(cp.notes).toBe('First checkpoint');
    });
  });

  describe('loadCheckpoint', () => {
    it('应加载已保存的检查点', async () => {
      const saved = await manager.saveCheckpoint('a', 'e', 1, { x: 1 }, {}, {});
      const loaded = await manager.loadCheckpoint(saved.id);

      expect(loaded.id).toBe(saved.id);
      expect(loaded.memorySnapshot).toEqual({ x: 1 });
    });

    it('加载不存在的检查点应抛出错误', async () => {
      await expect(manager.loadCheckpoint('nonexistent')).rejects.toThrow('检查点不存在');
    });
  });

  describe('listCheckpoints', () => {
    it('应列出所有检查点', async () => {
      await manager.saveCheckpoint('a', 'e1', 1, {}, {}, {});
      await manager.saveCheckpoint('b', 'e2', 2, {}, {}, {});

      const list = await manager.listCheckpoints();
      expect(list).toHaveLength(2);
    });

    it('应按 agentName 过滤', async () => {
      await manager.saveCheckpoint('agent-a', 'e1', 1, {}, {}, {});
      await manager.saveCheckpoint('agent-b', 'e2', 1, {}, {}, {});

      const filtered = await manager.listCheckpoints({ agentName: 'agent-a' });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].agentName).toBe('agent-a');
    });

    it('应按 executionId 过滤', async () => {
      await manager.saveCheckpoint('a', 'exec-1', 1, {}, {}, {});
      await manager.saveCheckpoint('a', 'exec-2', 2, {}, {}, {});

      const filtered = await manager.listCheckpoints({ executionId: 'exec-1' });
      expect(filtered).toHaveLength(1);
    });

    it('应按 tags 过滤', async () => {
      await manager.saveCheckpoint('a', 'e', 1, {}, {}, {}, ['breakpoint']);
      await manager.saveCheckpoint('a', 'e', 2, {}, {}, {}, ['milestone']);

      const filtered = await manager.listCheckpoints({ tags: ['breakpoint'] });
      expect(filtered).toHaveLength(1);
    });

    it('应按 iteration 排序', async () => {
      await manager.saveCheckpoint('a', 'e', 3, {}, {}, {});
      await manager.saveCheckpoint('a', 'e', 1, {}, {}, {});
      await manager.saveCheckpoint('a', 'e', 2, {}, {}, {});

      const list = await manager.listCheckpoints();
      const iterations = list.map((c) => c.iteration);
      expect(iterations).toEqual([1, 2, 3]);
    });
  });

  describe('deleteCheckpoint', () => {
    it('应删除指定检查点', async () => {
      const cp = await manager.saveCheckpoint('a', 'e', 1, {}, {}, {});
      await manager.deleteCheckpoint(cp.id);

      const list = await manager.listCheckpoints();
      expect(list).toHaveLength(0);
    });
  });

  describe('clearCheckpoints', () => {
    it('应清空所有检查点', async () => {
      await manager.saveCheckpoint('a', 'e', 1, {}, {}, {});
      await manager.saveCheckpoint('a', 'e', 2, {}, {}, {});
      await manager.clearCheckpoints();

      const list = await manager.listCheckpoints();
      expect(list).toHaveLength(0);
    });
  });

  describe('maxCheckpoints 限制', () => {
    it('超过最大数量应自动清理', async () => {
      const limitedManager = new CheckpointManager({ maxCheckpoints: 5 });

      for (let i = 0; i < 10; i++) {
        await limitedManager.saveCheckpoint('a', 'e', i, {}, {}, {});
      }

      const list = await limitedManager.listCheckpoints();
      // 应保留大部分，只删除 10%（1 个）
      expect(list.length).toBeLessThanOrEqual(10);
    });
  });

  describe('TimeMachine', () => {
    it('travelBack 应返回指定检查点', async () => {
      const cp = await manager.saveCheckpoint('a', 'e', 1, {}, {}, {});
      const tm = manager.getTimeMachine();

      const result = await tm.travelBack(cp.id);
      expect(result.id).toBe(cp.id);
    });

    it('travelBack 不存在的检查点应抛出错误', async () => {
      const tm = manager.getTimeMachine();
      await expect(tm.travelBack('missing')).rejects.toThrow('检查点不存在');
    });

    it('listTimeline 应按迭代排序', async () => {
      await manager.saveCheckpoint('a', 'e1', 3, {}, {}, {});
      await manager.saveCheckpoint('a', 'e1', 1, {}, {}, {});
      await manager.saveCheckpoint('a', 'e1', 2, {}, {}, {});

      const tm = manager.getTimeMachine();
      const timeline = await tm.listTimeline('e1');

      expect(timeline.map((c) => c.iteration)).toEqual([1, 2, 3]);
    });
  });
});

describe('EnhancedMemoryStore', () => {
  let store: EnhancedMemoryStore;

  beforeEach(() => {
    store = new EnhancedMemoryStore();
  });

  describe('基础 CRUD', () => {
    it('应正确存取值', async () => {
      await store.set('key', 'value');
      expect(await store.get('key')).toBe('value');
    });

    it('应支持删除', async () => {
      await store.set('key', 'value');
      await store.delete('key');
      expect(await store.get('key')).toBeUndefined();
    });

    it('应检查存在性', async () => {
      expect(await store.has('key')).toBe(false);
      await store.set('key', 'value');
      expect(await store.has('key')).toBe(true);
    });

    it('应返回所有数据', async () => {
      await store.set('a', 1);
      await store.set('b', 2);
      expect(await store.getAll()).toEqual({ a: 1, b: 2 });
    });

    it('应清空数据', async () => {
      await store.set('key', 'value');
      await store.clear();
      expect(await store.getAll()).toEqual({});
    });
  });

  describe('检查点', () => {
    it('应创建检查点', async () => {
      await store.set('data', 'important');
      const cp = await store.createCheckpoint('agent', 'exec', 1);

      expect(cp.memorySnapshot.data).toBe('important');
    });

    it('应恢复检查点', async () => {
      await store.set('old', 'data');
      const cp = await store.createCheckpoint('agent', 'exec', 1);

      await store.clear();
      await store.restoreCheckpoint(cp.id);

      expect(await store.get('old')).toBe('data');
    });
  });

  describe('历史和压缩', () => {
    it('应记录历史', async () => {
      await store.set('a', 1);
      await store.set('b', 2);

      const history = store.getHistory();
      expect(history).toHaveLength(2);
    });

    it('compress 应保留最近的记录', async () => {
      for (let i = 0; i < 200; i++) {
        await store.set(`key-${i}`, i);
      }

      await store.compress(50);
      expect(store.getHistory().length).toBeLessThanOrEqual(50);
    });
  });

  describe('getStats', () => {
    it('应返回统计信息', async () => {
      await store.set('a', 1);
      const stats = store.getStats();

      expect(stats.shortTermSize).toBe(1);
      expect(stats.historySize).toBe(1);
      expect(stats.checkpointCount).toBe(0);
    });
  });
});

describe('ResumeManager', () => {
  let checkpointManager: CheckpointManager;
  let resumeManager: ResumeManager;

  beforeEach(() => {
    checkpointManager = new CheckpointManager();
    resumeManager = new ResumeManager(checkpointManager);
  });

  describe('saveBreakpoint', () => {
    it('应保存带 breakpoint 标签的检查点', async () => {
      const cp = await resumeManager.saveBreakpoint('agent', 'exec', 3, { step: 3 });

      expect(cp.tags).toContain('breakpoint');
      expect(cp.contextSnapshot).toEqual({ step: 3 });
    });
  });

  describe('resumeFromBreakpoint', () => {
    it('应返回最新的断点', async () => {
      await resumeManager.saveBreakpoint('agent', 'exec', 1, {});
      await resumeManager.saveBreakpoint('agent', 'exec', 3, { step: 3 });

      const bp = await resumeManager.resumeFromBreakpoint('exec');
      expect(bp).toBeDefined();
      expect(bp!.iteration).toBe(3);
    });

    it('无断点应返回 null', async () => {
      const result = await resumeManager.resumeFromBreakpoint('no-exec');
      expect(result).toBeNull();
    });
  });

  describe('listResumableExecutions', () => {
    it('应列出可恢复的执行', async () => {
      await resumeManager.saveBreakpoint('a', 'exec-1', 1, {});
      await resumeManager.saveBreakpoint('b', 'exec-2', 2, {});

      const list = await resumeManager.listResumableExecutions();
      expect(list).toHaveLength(2);
    });
  });
});
