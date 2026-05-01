/**
 * SqliteAuditStore 单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { rm } from 'fs/promises';
import { SqliteAuditStore } from '../../../src/gateway/audit/index.js';
import type { AuditLog, AuditLogFilter } from '../../../src/gateway/Gateway.js';

describe('SqliteAuditStore', () => {
  let store: SqliteAuditStore;
  const dbPath = '/tmp/test-audit.db';

  beforeEach(async () => {
    // 清理旧的测试数据库
    try {
      await rm(dbPath);
    } catch {
      // 忽略不存在的错误
    }

    store = new SqliteAuditStore({
      dbPath,
      retentionDays: 0,
    });
  });

  afterEach(async () => {
    await store.close();
    try {
      await rm(dbPath);
    } catch {
      // 忽略错误
    }
  });

  describe('write', () => {
    it('应该写入审计日志', async () => {
      const log: AuditLog = {
        timestamp: new Date(),
        userId: 'user-123',
        agentName: 'TestAgent',
        action: 'test_action',
        result: 'success',
      };

      await store.write(log);

      const stats = await store.getStats();
      expect(stats.logCount).resolves.toBe(1);
    });

    it('应该支持批量写入', async () => {
      const logs: AuditLog[] = [
        {
          timestamp: new Date(),
          userId: 'user-1',
          agentName: 'Agent1',
          action: 'action1',
          result: 'success',
        },
        {
          timestamp: new Date(),
          userId: 'user-2',
          agentName: 'Agent2',
          action: 'action2',
          result: 'success',
        },
      ];

      await store.writeBatch(logs);

      const stats = await store.getStats();
      expect(stats.logCount).resolves.toBe(2);
    });
  });

  describe('query', () => {
    beforeEach(async () => {
      // 插入测试数据
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
      ];

      await store.writeBatch(logs);
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

    it('应该按结果查询', async () => {
      const filter: AuditLogFilter = {
        result: 'success',
      };

      const results = await store.query(filter);

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.result === 'success')).toBe(true);
    });

    it('应该按时间范围查询', async () => {
      const filter: AuditLogFilter = {
        timeRange: {
          start: new Date('2026-05-01T10:30:00Z'),
          end: new Date('2026-05-01T12:30:00Z'),
        },
      };

      const results = await store.query(filter);

      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('应该支持组合查询', async () => {
      const filter: AuditLogFilter = {
        userId: 'user-123',
        action: 'read',
      };

      const results = await store.query(filter);

      expect(results).toHaveLength(1);
      expect(results[0].userId).toBe('user-123');
      expect(results[0].action).toBe('read');
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
      ];

      await store.writeBatch(logs);
    });

    it('应该按动作统计', async () => {
      const stats = await store.stats({
        byAction: true,
      });

      expect(stats['action:read']).toBe(1);
      expect(stats['action:write']).toBe(1);
      expect(stats['action:delete']).toBe(1);
    });

    it('应该按用户统计', async () => {
      const stats = await store.stats({
        byUser: true,
      });

      expect(stats['user:user-123']).toBe(2);
      expect(stats['user:user-456']).toBe(1);
    });

    it('应该按智能体统计', async () => {
      const stats = await store.stats({
        byAgent: true,
      });

      expect(stats['agent:Agent1']).toBe(2);
      expect(stats['agent:Agent2']).toBe(1);
    });

    it('应该按结果统计', async () => {
      const stats = await store.stats({
        byResult: true,
      });

      expect(stats['result:success']).toBe(2);
      expect(stats['result:failure']).toBe(1);
    });
  });

  describe('cleanupOldLogs', () => {
    it('应该清理过期日志', async () => {
      const storeWithRetention = new SqliteAuditStore({
        dbPath: '/tmp/test-audit-retention.db',
        retentionDays: 1, // 1 天
      });

      // 插入过期日志
      const oldLog: AuditLog = {
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 天前
        userId: 'user-123',
        agentName: 'Agent1',
        action: 'test',
        result: 'success',
      };

      await storeWithRetention.write(oldLog);

      const cleaned = await storeWithRetention.cleanupOldLogs();

      expect(cleaned).toBe(1);

      await storeWithRetention.close();
    });
  });

  describe('getStats', () => {
    it('应该返回数据库统计信息', async () => {
      await store.write({
        timestamp: new Date(),
        userId: 'user-123',
        agentName: 'Agent1',
        action: 'test',
        result: 'success',
      });

      const stats = await store.getStats();

      expect(stats.logCount).toBeGreaterThan(0);
      expect(stats.dbSize).toBeGreaterThan(0);
      expect(stats.retentionDays).toBe(0);
    });
  });
});
