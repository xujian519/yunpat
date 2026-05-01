/**
 * SessionManager 单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SessionManager, InMemorySessionStore } from '../../../src/gateway/auth/index.js';

describe('SessionManager', () => {
  let sessionManager: SessionManager;

  beforeEach(() => {
    sessionManager = new SessionManager(new InMemorySessionStore());
  });

  describe('createSession', () => {
    it('应该创建有效的会话', async () => {
      const session = await sessionManager.createSession({
        userId: 'user-123',
        roles: ['user'],
        permissions: ['read', 'write'],
      });

      expect(session.sessionId).toBeDefined();
      expect(session.userId).toBe('user-123');
      expect(session.roles).toEqual(['user']);
      expect(session.permissions).toEqual(['read', 'write']);
      expect(session.createdAt).toBeInstanceOf(Date);
      expect(session.expiresAt).toBeInstanceOf(Date);
    });

    it('应该支持自定义会话时长', async () => {
      const session = await sessionManager.createSession({
        userId: 'user-123',
        roles: ['user'],
        permissions: ['read'],
        ttl: 7200, // 2小时
      });

      const ttl = session.expiresAt.getTime() - session.createdAt.getTime();

      expect(ttl).toBeCloseTo(7200000, -3); // 允许 1 秒误差
    });

    it('应该支持初始会话数据', async () => {
      const session = await sessionManager.createSession({
        userId: 'user-123',
        roles: ['user'],
        permissions: ['read'],
        data: { key: 'value' },
      });

      expect(session.data.get('key')).toBe('value');
    });
  });

  describe('getSession', () => {
    it('应该获取有效的会话', async () => {
      const created = await sessionManager.createSession({
        userId: 'user-123',
        roles: ['user'],
        permissions: ['read'],
      });

      const retrieved = await sessionManager.getSession(created.sessionId);

      expect(retrieved).toBeDefined();
      expect(retrieved?.sessionId).toBe(created.sessionId);
      expect(retrieved?.userId).toBe('user-123');
    });

    it('应该返回 null 对于无效的会话 ID', async () => {
      const retrieved = await sessionManager.getSession('invalid-session-id');

      expect(retrieved).toBeNull();
    });

    it('应该更新最后活跃时间', async () => {
      const session = await sessionManager.createSession({
        userId: 'user-123',
        roles: ['user'],
        permissions: ['read'],
      });

      const originalLastActive = session.lastActiveAt;

      // 等待 10ms
      await new Promise((resolve) => setTimeout(resolve, 10));

      await sessionManager.getSession(session.sessionId);

      const retrieved = await sessionManager.getSession(session.sessionId);

      expect(retrieved?.lastActiveAt.getTime()).toBeGreaterThan(
        originalLastActive.getTime()
      );
    });
  });

  describe('deleteSession', () => {
    it('应该删除会话', async () => {
      const session = await sessionManager.createSession({
        userId: 'user-123',
        roles: ['user'],
        permissions: ['read'],
      });

      await sessionManager.deleteSession(session.sessionId);

      const retrieved = await sessionManager.getSession(session.sessionId);

      expect(retrieved).toBeNull();
    });
  });

  describe('getUserSessions', () => {
    it('应该获取用户的所有会话', async () => {
      await sessionManager.createSession({
        userId: 'user-123',
        roles: ['user'],
        permissions: ['read'],
      });

      await sessionManager.createSession({
        userId: 'user-123',
        roles: ['admin'],
        permissions: ['read', 'write'],
      });

      await sessionManager.createSession({
        userId: 'user-456',
        roles: ['user'],
        permissions: ['read'],
      });

      const userSessions = await sessionManager.getUserSessions('user-123');

      expect(userSessions).toHaveLength(2);
      expect(userSessions.every((s) => s.userId === 'user-123')).toBe(true);
    });
  });

  describe('deleteUserSessions', () => {
    it('应该删除用户的所有会话', async () => {
      await sessionManager.createSession({
        userId: 'user-123',
        roles: ['user'],
        permissions: ['read'],
      });

      await sessionManager.createSession({
        userId: 'user-123',
        roles: ['admin'],
        permissions: ['read', 'write'],
      });

      await sessionManager.createSession({
        userId: 'user-456',
        roles: ['user'],
        permissions: ['read'],
      });

      await sessionManager.deleteUserSessions('user-123');

      const userSessions = await sessionManager.getUserSessions('user-123');

      expect(userSessions).toHaveLength(0);

      const otherUserSessions = await sessionManager.getUserSessions('user-456');

      expect(otherUserSessions).toHaveLength(1);
    });
  });

  describe('checkPermission', () => {
    it('应该检查权限', async () => {
      const session = await sessionManager.createSession({
        userId: 'user-123',
        roles: ['user'],
        permissions: ['read', 'write'],
      });

      const hasRead = await sessionManager.checkPermission(
        session.sessionId,
        'read'
      );

      const hasDelete = await sessionManager.checkPermission(
        session.sessionId,
        'delete'
      );

      expect(hasRead).toBe(true);
      expect(hasDelete).toBe(false);
    });

    it('应该支持通配符权限', async () => {
      const session = await sessionManager.createSession({
        userId: 'user-123',
        roles: ['admin'],
        permissions: ['*'],
      });

      const hasAny = await sessionManager.checkPermission(
        session.sessionId,
        'any-permission'
      );

      expect(hasAny).toBe(true);
    });
  });

  describe('hasRole', () => {
    it('应该检查角色', async () => {
      const session = await sessionManager.createSession({
        userId: 'user-123',
        roles: ['user', 'moderator'],
        permissions: ['read'],
      });

      const hasUser = await sessionManager.hasRole(session.sessionId, 'user');

      const hasAdmin = await sessionManager.hasRole(session.sessionId, 'admin');

      expect(hasUser).toBe(true);
      expect(hasAdmin).toBe(false);
    });
  });

  describe('setSessionData & getSessionData', () => {
    it('应该设置和获取会话数据', async () => {
      const session = await sessionManager.createSession({
        userId: 'user-123',
        roles: ['user'],
        permissions: ['read'],
      });

      await sessionManager.setSessionData(session.sessionId, 'key', 'value');

      const value = await sessionManager.getSessionData(session.sessionId, 'key');

      expect(value).toBe('value');
    });

    it('应该支持复杂类型的会话数据', async () => {
      const session = await sessionManager.createSession({
        userId: 'user-123',
        roles: ['user'],
        permissions: ['read'],
      });

      const data = { nested: { value: 123 } };

      await sessionManager.setSessionData(session.sessionId, 'complex', data);

      const value = await sessionManager.getSessionData(
        session.sessionId,
        'complex'
      );

      expect(value).toEqual(data);
    });
  });
});
