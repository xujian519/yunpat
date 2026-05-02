/**
 * FileSystemCheckpointStore 测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileSystemCheckpointStore } from '../../src/memory/FileSystemCheckpointStore.js';
import { Checkpoint } from '../../src/memory/CheckpointManager.js';
import { promises as fs } from 'fs';
import * as path from 'path';

describe('FileSystemCheckpointStore', () => {
  const TEST_DIR = 'data/test-checkpoints';
  let store: FileSystemCheckpointStore;

  beforeEach(async () => {
    // 清理测试目录
    try {
      await fs.rm(TEST_DIR, { recursive: true, force: true });
    } catch {
      // 忽略不存在的错误
    }

    // 创建新的store
    store = new FileSystemCheckpointStore({ rootDir: TEST_DIR });
  });

  afterEach(async () => {
    // 清理测试目录
    try {
      await fs.rm(TEST_DIR, { recursive: true, force: true });
    } catch {
      // 忽略错误
    }
  });

  describe('保存和加载检查点', () => {
    it('应该成功保存检查点到文件系统', async () => {
      const timestamp = new Date('2024-01-01T00:00:00Z');
      const checkpoint: Checkpoint = {
        id: 'test-exec-iter1-1234567890',
        agentName: 'TestAgent',
        executionId: 'test-exec',
        timestamp,
        iteration: 1,
        memorySnapshot: { key1: 'value1', key2: 'value2' },
        contextSnapshot: { contextKey: 'contextValue' },
        stateSnapshot: { stateKey: 'stateValue' },
        tags: ['test', 'checkpoint'],
        notes: '测试检查点',
      };

      await store.save(checkpoint);

      // 验证文件已创建（使用正确的时间戳）
      const filepath = path.join(TEST_DIR, 'test-exec', `1-${timestamp.getTime()}.json`);
      const exists = await fs.access(filepath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it('应该成功加载检查点', async () => {
      const timestamp = new Date('2024-01-01T00:00:00Z');
      const checkpoint: Checkpoint = {
        id: 'test-exec-iter1-1234567890',
        agentName: 'TestAgent',
        executionId: 'test-exec',
        timestamp,
        iteration: 1,
        memorySnapshot: { key1: 'value1' },
        contextSnapshot: {},
        stateSnapshot: {},
      };

      await store.save(checkpoint);

      const loaded = await store.load(checkpoint.id, checkpoint.executionId);

      expect(loaded.id).toBe(checkpoint.id);
      expect(loaded.agentName).toBe(checkpoint.agentName);
      expect(loaded.executionId).toBe(checkpoint.executionId);
      expect(loaded.iteration).toBe(checkpoint.iteration);
      expect(loaded.memorySnapshot).toEqual(checkpoint.memorySnapshot);
    });

    it('应该保存多个检查点到同一个执行', async () => {
      const checkpoint1: Checkpoint = {
        id: 'test-exec-iter1-1000',
        agentName: 'TestAgent',
        executionId: 'test-exec',
        timestamp: new Date(1000),
        iteration: 1,
        memorySnapshot: { iter: 1 },
        contextSnapshot: {},
        stateSnapshot: {},
      };

      const checkpoint2: Checkpoint = {
        id: 'test-exec-iter2-2000',
        agentName: 'TestAgent',
        executionId: 'test-exec',
        timestamp: new Date(2000),
        iteration: 2,
        memorySnapshot: { iter: 2 },
        contextSnapshot: {},
        stateSnapshot: {},
      };

      await store.save(checkpoint1);
      await store.save(checkpoint2);

      const checkpoints = await store.listCheckpoints('test-exec');

      expect(checkpoints).toHaveLength(2);
      expect(checkpoints[0].iteration).toBe(1);
      expect(checkpoints[1].iteration).toBe(2);
    });
  });

  describe('列出检查点', () => {
    it('应该列出执行的所有检查点', async () => {
      const executionId = 'test-exec';

      for (let i = 1; i <= 3; i++) {
        const checkpoint: Checkpoint = {
          id: `${executionId}-iter${i}-${Date.now()}`,
          agentName: 'TestAgent',
          executionId,
          timestamp: new Date(),
          iteration: i,
          memorySnapshot: { iter: i },
          contextSnapshot: {},
          stateSnapshot: {},
        };

        await store.save(checkpoint);
      }

      const checkpoints = await store.listCheckpoints(executionId);

      expect(checkpoints).toHaveLength(3);
      expect(checkpoints[0].iteration).toBe(1);
      expect(checkpoints[1].iteration).toBe(2);
      expect(checkpoints[2].iteration).toBe(3);
    });

    it('应该对不存在的执行返回空数组', async () => {
      const checkpoints = await store.listCheckpoints('non-existent');
      expect(checkpoints).toEqual([]);
    });
  });

  describe('列出可恢复的执行', () => {
    it('应该列出所有可恢复的执行', async () => {
      // 创建多个执行
      const exec1Checkpoint: Checkpoint = {
        id: 'exec1-iter1-1000',
        agentName: 'Agent1',
        executionId: 'exec1',
        timestamp: new Date(1000),
        iteration: 1,
        memorySnapshot: {},
        contextSnapshot: {},
        stateSnapshot: {},
      };

      const exec2Checkpoint: Checkpoint = {
        id: 'exec2-iter1-2000',
        agentName: 'Agent2',
        executionId: 'exec2',
        timestamp: new Date(2000),
        iteration: 1,
        memorySnapshot: {},
        contextSnapshot: {},
        stateSnapshot: {},
      };

      await store.save(exec1Checkpoint);
      await store.save(exec2Checkpoint);

      const executions = await store.listResumableExecutions();

      expect(executions).toHaveLength(2);
      expect(executions[0].executionId).toBe('exec2'); // 最新的在前
      expect(executions[1].executionId).toBe('exec1');
    });

    it('应该返回最新迭代的检查点信息', async () => {
      const executionId = 'test-exec';

      // 创建同一执行的多个检查点
      await store.save({
        id: `${executionId}-iter1-1000`,
        agentName: 'TestAgent',
        executionId,
        timestamp: new Date(1000),
        iteration: 1,
        memorySnapshot: {},
        contextSnapshot: {},
        stateSnapshot: {},
      });

      await store.save({
        id: `${executionId}-iter2-2000`,
        agentName: 'TestAgent',
        executionId,
        timestamp: new Date(2000),
        iteration: 2,
        memorySnapshot: {},
        contextSnapshot: {},
        stateSnapshot: {},
      });

      await store.save({
        id: `${executionId}-iter3-3000`,
        agentName: 'TestAgent',
        executionId,
        timestamp: new Date(3000),
        iteration: 3,
        memorySnapshot: {},
        contextSnapshot: {},
        stateSnapshot: {},
      });

      const executions = await store.listResumableExecutions();

      expect(executions).toHaveLength(1);
      expect(executions[0].iteration).toBe(3); // 最新迭代
    });
  });

  describe('删除检查点', () => {
    it('应该成功删除检查点', async () => {
      const timestamp = new Date('2024-01-01T00:00:00Z');
      const checkpoint: Checkpoint = {
        id: 'test-exec-iter1-1000',
        agentName: 'TestAgent',
        executionId: 'test-exec',
        timestamp,
        iteration: 1,
        memorySnapshot: {},
        contextSnapshot: {},
        stateSnapshot: {},
      };

      await store.save(checkpoint);
      await store.delete(checkpoint.id, checkpoint.executionId);

      // 验证检查点已删除
      await expect(store.load(checkpoint.id, checkpoint.executionId)).rejects.toThrow('检查点不存在');
    });

    it('应该成功删除整个执行', async () => {
      const executionId = 'test-exec';

      await store.save({
        id: `${executionId}-iter1-1000`,
        agentName: 'TestAgent',
        executionId,
        timestamp: new Date(),
        iteration: 1,
        memorySnapshot: {},
        contextSnapshot: {},
        stateSnapshot: {},
      });

      await store.save({
        id: `${executionId}-iter2-2000`,
        agentName: 'TestAgent',
        executionId,
        timestamp: new Date(),
        iteration: 2,
        memorySnapshot: {},
        contextSnapshot: {},
        stateSnapshot: {},
      });

      await store.deleteExecution(executionId);

      // 验证执行已删除
      const checkpoints = await store.listCheckpoints(executionId);
      expect(checkpoints).toEqual([]);
    });
  });

  describe('清空所有检查点', () => {
    it('应该清空所有检查点', async () => {
      await store.save({
        id: 'exec1-iter1-1000',
        agentName: 'Agent1',
        executionId: 'exec1',
        timestamp: new Date(),
        iteration: 1,
        memorySnapshot: {},
        contextSnapshot: {},
        stateSnapshot: {},
      });

      await store.save({
        id: 'exec2-iter1-2000',
        agentName: 'Agent2',
        executionId: 'exec2',
        timestamp: new Date(),
        iteration: 1,
        memorySnapshot: {},
        contextSnapshot: {},
        stateSnapshot: {},
      });

      await store.clear();

      const executions = await store.listResumableExecutions();
      expect(executions).toHaveLength(0);
    });
  });

  describe('获取统计信息', () => {
    it('应该返回正确的统计信息', async () => {
      await store.save({
        id: 'exec1-iter1-1000',
        agentName: 'Agent1',
        executionId: 'exec1',
        timestamp: new Date(),
        iteration: 1,
        memorySnapshot: {},
        contextSnapshot: {},
        stateSnapshot: {},
      });

      await store.save({
        id: 'exec1-iter2-2000',
        agentName: 'Agent1',
        executionId: 'exec1',
        timestamp: new Date(),
        iteration: 2,
        memorySnapshot: {},
        contextSnapshot: {},
        stateSnapshot: {},
      });

      await store.save({
        id: 'exec2-iter1-3000',
        agentName: 'Agent2',
        executionId: 'exec2',
        timestamp: new Date(),
        iteration: 1,
        memorySnapshot: {},
        contextSnapshot: {},
        stateSnapshot: {},
      });

      const stats = await store.getStats();

      expect(stats.totalExecutions).toBe(2);
      expect(stats.totalCheckpoints).toBe(3);
      expect(stats.totalSize).toBeGreaterThan(0);
    });
  });
});
