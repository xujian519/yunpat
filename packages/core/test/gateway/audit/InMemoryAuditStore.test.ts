/**
 * InMemoryAuditStore 单元测试
 *
 * 覆盖所有主要分支，目标分支覆盖率 60%+
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { InMemoryAuditStore } from '../../../src/gateway/audit/InMemoryAuditStore.js';
import type { AuditLog, AuditLogFilter } from '../../../src/gateway/Gateway.js';

describe('InMemoryAuditStore', () => {
  let store: InMemoryAuditStore;

  beforeEach(() => {
    store = new InMemoryAuditStore({ maxLogs: 1000 });
  });

  afterEach(async () => {
    await store.clear();
  });

  describe('构造函数', () => {
    it('应该使用默认配置', () => {
      const defaultStore = new InMemoryAuditStore();
      expect(defaultStore).toBeDefined();
    });

    it('应该接受自定义 maxLogs 配置', () => {
      const customStore = new InMemoryAuditStore({ maxLogs: 100 });
      expect(customStore).toBeDefined();
    });
  });

  describe('write', () => {
    it('应该写入单条审计日志', async () => {
      const log: AuditLog = {
        timestamp: new Date(),
        userId: 'user-123',
        agentName: 'TestAgent',
        action: 'test_action',
        result: 'success',
      };

      await store.write(log);

      const logs = await store.query();
      expect(logs).toHaveLength(1);
      expect(logs[0].userId).toBe('user-123');
    });

    it('应该写入多条审计日志', async () => {
      const logs: AuditLog[] = [
        {
          timestamp: new Date('2026-05-01T10:00:00Z'),
          userId: 'user-1',
          agentName: 'Agent1',
          action: 'action1',
          result: 'success',
        },
        {
          timestamp: new Date('2026-05-01T11:00:00Z'),
          userId: 'user-2',
          agentName: 'Agent2',
          action: 'action2',
          result: 'failure',
        },
      ];

      for (const log of logs) {
        await store.write(log);
      }

      const result = await store.query();
      expect(result).toHaveLength(2);
    });

    it('应该在达到 maxLogs 时删除最旧的日志', async () => {
      const smallStore = new InMemoryAuditStore({ maxLogs: 3 });

      for (let i = 0; i < 5; i++) {
        await smallStore.write({
          timestamp: new Date(Date.now() + i * 1000),
          userId: `user-${i}`,
          agentName: 'Agent',
          action: `action${i}`,
          result: 'success',
        });
      }

      const logs = await smallStore.query();
      expect(logs).toHaveLength(3);
      expect(logs.every((log) => log.userId !== 'user-0' && log.userId !== 'user-1')).toBe(true);
    });

    it('应该在恰好达到 maxLogs 时不删除日志', async () => {
      const smallStore = new InMemoryAuditStore({ maxLogs: 3 });

      for (let i = 0; i < 3; i++) {
        await smallStore.write({
          timestamp: new Date(Date.now() + i * 1000),
          userId: `user-${i}`,
          agentName: 'Agent',
          action: `action${i}`,
          result: 'success',
        });
      }

      const logs = await smallStore.query();
      expect(logs).toHaveLength(3);
      const oldestLog = logs.find((l) => l.userId === 'user-0');
      expect(oldestLog).toBeDefined();
    });
  });

  describe('query', () => {
    beforeEach(async () => {
      const logs: AuditLog[] = [
        {
          timestamp: new Date('2026-05-01T10:00:00Z'),
          userId: 'user-123',
          agentName: 'Agent1',
          action: 'read',
          resource: 'file1',
          result: 'success',
        },
        {
          timestamp: new Date('2026-05-01T11:00:00Z'),
          userId: 'user-123',
          agentName: 'Agent1',
          action: 'write',
          resource: 'file2',
          result: 'failure',
        },
        {
          timestamp: new Date('2026-05-01T12:00:00Z'),
          userId: 'user-456',
          agentName: 'Agent2',
          action: 'read',
          resource: 'file1',
          result: 'success',
        },
        {
          timestamp: '2026-05-01T13:00:00Z',
          userId: 'user-456',
          agentName: 'Agent2',
          action: 'delete',
          resource: 'file3',
          result: 'error',
        },
      ];

      for (const log of logs) {
        await store.write(log);
      }
    });

    it('应该返回所有日志（无过滤条件）', async () => {
      const results = await store.query({});
      expect(results).toHaveLength(4);
    });

    it('应该返回所有日志（无参数）', async () => {
      const results = await store.query();
      expect(results).toHaveLength(4);
    });

    it('应该按用户 ID 查询', async () => {
      const filter: AuditLogFilter = {
        userId: 'user-123',
      };

      const results = await store.query(filter);

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.userId === 'user-123')).toBe(true);
    });

    it('应该按智能体名称查询', async () => {
      const filter: AuditLogFilter = {
        agentName: 'Agent1',
      };

      const results = await store.query(filter);

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.agentName === 'Agent1')).toBe(true);
    });

    it('应该按动作查询', async () => {
      const filter: AuditLogFilter = {
        action: 'read',
      };

      const results = await store.query(filter);

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.action === 'read')).toBe(true);
    });

    it('应该按结果查询（success）', async () => {
      const filter: AuditLogFilter = {
        result: 'success',
      };

      const results = await store.query(filter);

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.result === 'success')).toBe(true);
    });

    it('应该按结果查询（failure）', async () => {
      const filter: AuditLogFilter = {
        result: 'failure',
      };

      const results = await store.query(filter);

      expect(results).toHaveLength(1);
      expect(results[0].result).toBe('failure');
    });

    it('应该在 result 为 undefined 时不过滤结果', async () => {
      const filter: AuditLogFilter = {
        userId: 'user-123',
        result: undefined,
      };

      const results = await store.query(filter);

      expect(results).toHaveLength(2);
    });

    it('应该按时间范围查询（Date 对象）', async () => {
      const filter: AuditLogFilter = {
        timeRange: {
          start: new Date('2026-05-01T10:30:00Z'),
          end: new Date('2026-05-01T12:30:00Z'),
        },
      };

      const results = await store.query(filter);

      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.every((r) => {
        const timestamp = r.timestamp instanceof Date ? r.timestamp : new Date(r.timestamp);
        return timestamp >= new Date('2026-05-01T10:30:00Z') &&
               timestamp <= new Date('2026-05-01T12:30:00Z');
      })).toBe(true);
    });

    it('应该正确处理字符串时间戳的时间范围过滤', async () => {
      const filter: AuditLogFilter = {
        timeRange: {
          start: new Date('2026-05-01T12:30:00Z'),
          end: new Date('2026-05-01T14:00:00Z'),
        },
      };

      const results = await store.query(filter);

      expect(results).toHaveLength(1);
      expect(results[0].action).toBe('delete');
    });

    it('应该按时间范围边界查询', async () => {
      const filter: AuditLogFilter = {
        timeRange: {
          start: new Date('2026-05-01T11:00:00Z'),
          end: new Date('2026-05-01T12:00:00Z'),
        },
      };

      const results = await store.query(filter);

      expect(results.length).toBeGreaterThanOrEqual(2);
    });

    it('应该支持组合查询（用户 + 动作）', async () => {
      const filter: AuditLogFilter = {
        userId: 'user-123',
        action: 'read',
      };

      const results = await store.query(filter);

      expect(results).toHaveLength(1);
      expect(results[0].userId).toBe('user-123');
      expect(results[0].action).toBe('read');
    });

    it('应该支持组合查询（用户 + 动作 + 结果）', async () => {
      const filter: AuditLogFilter = {
        userId: 'user-456',
        action: 'read',
        result: 'success',
      };

      const results = await store.query(filter);

      expect(results).toHaveLength(1);
      expect(results[0].userId).toBe('user-456');
      expect(results[0].action).toBe('read');
      expect(results[0].result).toBe('success');
    });

    it('应该支持组合查询（时间范围 + 用户）', async () => {
      const filter: AuditLogFilter = {
        timeRange: {
          start: new Date('2026-05-01T10:30:00Z'),
          end: new Date('2026-05-01T11:30:00Z'),
        },
        userId: 'user-123',
      };

      const results = await store.query(filter);

      expect(results).toHaveLength(1);
      expect(results[0].action).toBe('write');
    });

    it('应该按时间倒序排序', async () => {
      const results = await store.query();

      expect(results).toHaveLength(4);

      const timestamps = results.map((r) => {
        return r.timestamp instanceof Date ? r.timestamp.getTime() : new Date(r.timestamp).getTime();
      });

      for (let i = 0; i < timestamps.length - 1; i++) {
        expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i + 1]);
      }
    });

    it('应该正确处理混合类型的时间戳排序', async () => {
      const results = await store.query();

      const timestamps = results.map((r) => {
        return r.timestamp instanceof Date ? r.timestamp.getTime() : new Date(r.timestamp).getTime();
      });

      expect(timestamps.every((t) => typeof t === 'number')).toBe(true);
    });

    it('应该正确排序混合类型的时间戳（覆盖所有分支）', async () => {
      const testStore = new InMemoryAuditStore();

      await testStore.write({
        timestamp: '2026-05-01T10:00:00Z',
        userId: 'user-1',
        agentName: 'Agent',
        action: 'test1',
        result: 'success',
      });

      await testStore.write({
        timestamp: new Date('2026-05-01T11:00:00Z'),
        userId: 'user-2',
        agentName: 'Agent',
        action: 'test2',
        result: 'success',
      });

      await testStore.write({
        timestamp: '2026-05-01T12:00:00Z',
        userId: 'user-3',
        agentName: 'Agent',
        action: 'test3',
        result: 'success',
      });

      const results = await testStore.query();
      expect(results).toHaveLength(3);
      expect(results[0].action).toBe('test3');
      expect(results[2].action).toBe('test1');
    });
  });

  describe('stats', () => {
    beforeEach(async () => {
      const logs: AuditLog[] = [
        {
          timestamp: new Date(),
          userId: 'user-123',
          agentName: 'Agent1',
          action: 'read',
          result: 'success',
        },
        {
          timestamp: new Date(),
          userId: 'user-123',
          agentName: 'Agent1',
          action: 'write',
          result: 'success',
        },
        {
          timestamp: new Date(),
          userId: 'user-456',
          agentName: 'Agent2',
          action: 'delete',
          result: 'failure',
        },
        {
          timestamp: new Date(),
          userId: 'user-456',
          agentName: 'Agent2',
          action: 'read',
          result: 'error',
        },
      ];

      for (const log of logs) {
        await store.write(log);
      }
    });

    it('应该返回空统计（无 metrics）', async () => {
      const stats = await store.stats({});

      expect(Object.keys(stats)).toHaveLength(0);
    });

    it('应该按动作统计', async () => {
      const stats = await store.stats({
        byAction: true,
      });

      expect(stats['action:read']).toBe(2);
      expect(stats['action:write']).toBe(1);
      expect(stats['action:delete']).toBe(1);
    });

    it('应该按用户统计', async () => {
      const stats = await store.stats({
        byUser: true,
      });

      expect(stats['user:user-123']).toBe(2);
      expect(stats['user:user-456']).toBe(2);
    });

    it('应该按智能体统计', async () => {
      const stats = await store.stats({
        byAgent: true,
      });

      expect(stats['agent:Agent1']).toBe(2);
      expect(stats['agent:Agent2']).toBe(2);
    });

    it('应该按结果统计', async () => {
      const stats = await store.stats({
        byResult: true,
      });

      expect(stats['result:success']).toBe(2);
      expect(stats['result:failure']).toBe(1);
      expect(stats['result:error']).toBe(1);
    });

    it('应该支持多个 metrics 组合（动作 + 用户）', async () => {
      const stats = await store.stats({
        byAction: true,
        byUser: true,
      });

      expect(stats['action:read']).toBe(2);
      expect(stats['action:write']).toBe(1);
      expect(stats['action:delete']).toBe(1);
      expect(stats['user:user-123']).toBe(2);
      expect(stats['user:user-456']).toBe(2);
    });

    it('应该支持多个 metrics 组合（全部）', async () => {
      const stats = await store.stats({
        byAction: true,
        byUser: true,
        byAgent: true,
        byResult: true,
      });

      expect(Object.keys(stats)).toHaveLength(10);
    });

    it('应该在空日志时返回空统计', async () => {
      const emptyStore = new InMemoryAuditStore();
      const stats = await emptyStore.stats({ byAction: true, byUser: true });

      expect(Object.keys(stats)).toHaveLength(0);
    });
  });

  describe('clear', () => {
    it('应该清空所有日志', async () => {
      await store.write({
        timestamp: new Date(),
        userId: 'user-123',
        agentName: 'Agent',
        action: 'test',
        result: 'success',
      });

      await store.write({
        timestamp: new Date(),
        userId: 'user-456',
        agentName: 'Agent',
        action: 'test',
        result: 'success',
      });

      const beforeClear = await store.query();
      expect(beforeClear).toHaveLength(2);

      await store.clear();

      const afterClear = await store.query();
      expect(afterClear).toHaveLength(0);
    });

    it('应该在空日志时清空不报错', async () => {
      await expect(store.clear()).resolves.not.toThrow();
    });
  });

  describe('close', () => {
    it('应该成功关闭（无操作）', async () => {
      await expect(store.close()).resolves.not.toThrow();
    });

    it('关闭后不应影响后续操作', async () => {
      await store.close();

      await store.write({
        timestamp: new Date(),
        userId: 'user-123',
        agentName: 'Agent',
        action: 'test',
        result: 'success',
      });

      const logs = await store.query();
      expect(logs).toHaveLength(1);
    });
  });

  describe('边界情况', () => {
    it('应该处理空的用户 ID 查询', async () => {
      await store.write({
        timestamp: new Date(),
        userId: '',
        agentName: 'Agent',
        action: 'test',
        result: 'success',
      });

      const results = await store.query({ userId: '' });
      expect(results).toHaveLength(1);
    });

    it('应该处理空的动作查询', async () => {
      await store.write({
        timestamp: new Date(),
        userId: 'user-123',
        agentName: 'Agent',
        action: '',
        result: 'success',
      });

      const results = await store.query({ action: '' });
      expect(results).toHaveLength(1);
    });

    it('应该处理 maxLogs 为 0 的情况', async () => {
      const zeroMaxStore = new InMemoryAuditStore({ maxLogs: 0 });

      await zeroMaxStore.write({
        timestamp: new Date(),
        userId: 'user-123',
        agentName: 'Agent',
        action: 'test',
        result: 'success',
      });

      const logs = await zeroMaxStore.query();
      expect(logs).toHaveLength(0);
    });

    it('应该处理无效的时间范围（空结果）', async () => {
      const filter: AuditLogFilter = {
        timeRange: {
          start: new Date('2099-01-01'),
          end: new Date('2099-12-31'),
        },
      };

      const results = await store.query(filter);
      expect(results).toHaveLength(0);
    });
  });
});
