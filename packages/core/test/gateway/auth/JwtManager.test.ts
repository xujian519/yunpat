/**
 * JwtManager 单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  JwtManager,
  InMemoryTokenStore,
  InMemoryUserDataProvider,
  type UserDataProvider,
} from '../../../src/gateway/auth/index.js';

describe('JwtManager', () => {
  let jwtManager: JwtManager;

  beforeEach(() => {
    jwtManager = new JwtManager(
      {
        secret: 'test-secret',
        accessTokenExpiresIn: 3600,
        refreshTokenExpiresIn: 86400,
      },
      new InMemoryTokenStore()
    );
  });

  describe('generateTokenPair', () => {
    it('应该生成有效的 Token 对', async () => {
      const tokenPair = await jwtManager.generateTokenPair(
        'user-123',
        ['user'],
        ['read', 'write']
      );

      expect(tokenPair.accessToken).toBeDefined();
      expect(tokenPair.refreshToken).toBeDefined();
      expect(tokenPair.expiresAt).toBeGreaterThan(Date.now() / 1000);
    });

    it('生成的访问 Token 应该包含正确的负载', async () => {
      const tokenPair = await jwtManager.generateTokenPair(
        'user-123',
        ['admin'],
        ['read', 'write', 'delete']
      );

      const result = await jwtManager.verifyAccessToken(tokenPair.accessToken);

      expect(result.success).toBe(true);
      expect(result.payload?.sub).toBe('user-123');
      expect(result.payload?.roles).toEqual(['admin']);
      expect(result.payload?.permissions).toEqual(['read', 'write', 'delete']);
    });
  });

  describe('verifyAccessToken', () => {
    it('应该验证有效的 Token', async () => {
      const tokenPair = await jwtManager.generateTokenPair(
        'user-123',
        ['user'],
        ['read']
      );

      const result = await jwtManager.verifyAccessToken(tokenPair.accessToken);

      expect(result.success).toBe(true);
      expect(result.payload?.sub).toBe('user-123');
    });

    it('应该拒绝无效的 Token', async () => {
      const result = await jwtManager.verifyAccessToken('invalid-token');

      expect(result.success).toBe(false);
      expect(result.error).toBe('invalid');
    });

    it('应该拒绝被撤销的 Token', async () => {
      const tokenPair = await jwtManager.generateTokenPair(
        'user-123',
        ['user'],
        ['read']
      );

      // 撤销 Token
      await jwtManager.revokeToken(tokenPair.accessToken);

      // 验证应该失败
      const result = await jwtManager.verifyAccessToken(tokenPair.accessToken);

      expect(result.success).toBe(false);
      expect(result.error).toBe('revoked');
    });
  });

  describe('revokeToken', () => {
    it('应该撤销 Token', async () => {
      const tokenPair = await jwtManager.generateTokenPair(
        'user-123',
        ['user'],
        ['read']
      );

      await jwtManager.revokeToken(tokenPair.accessToken);

      const result = await jwtManager.verifyAccessToken(tokenPair.accessToken);

      expect(result.success).toBe(false);
      expect(result.error).toBe('revoked');
    });

    it('撤销不存在的 Token 不应该抛出错误', async () => {
      await expect(
        jwtManager.revokeToken('non-existent-token')
      ).resolves.toBeUndefined();
    });
  });

  describe('cleanupExpired', () => {
    it('应该清理过期的 Token', async () => {
      const shortLivedManager = new JwtManager(
        {
          secret: 'test-secret',
          accessTokenExpiresIn: 1, // 1秒
          refreshTokenExpiresIn: 1,
        },
        new InMemoryTokenStore()
      );

      await shortLivedManager.generateTokenPair('user-123', ['user'], ['read']);

      // 等待 Token 过期
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const cleaned = await shortLivedManager.cleanupExpired();

      expect(cleaned).toBeGreaterThanOrEqual(0);
    });
  });

  describe('refreshTokens', () => {
    it('应该使用 UserDataProvider 刷新 Token', async () => {
      // 创建用户数据提供者
      const userProvider = new InMemoryUserDataProvider([
        {
          userId: 'user-123',
          roles: ['user', 'editor'],
          permissions: ['read', 'write', 'edit'],
        },
      ]);

      const managerWithProvider = new JwtManager(
        {
          secret: 'test-secret',
          userDataProvider: userProvider,
        },
        new InMemoryTokenStore()
      );

      // 生成初始 Token
      const initialTokens = await managerWithProvider.generateTokenPair(
        'user-123',
        ['user'],
        ['read']
      );

      // 刷新 Token
      const refreshedTokens = await managerWithProvider.refreshTokens(
        initialTokens.refreshToken
      );

      expect(refreshedTokens).not.toBeNull();
      expect(refreshedTokens?.accessToken).toBeDefined();
      expect(refreshedTokens?.refreshToken).toBeDefined();

      // 验证新 Token 包含来自 UserDataProvider 的最新数据
      const result = await managerWithProvider.verifyAccessToken(
        refreshedTokens!.accessToken
      );

      expect(result.success).toBe(true);
      expect(result.payload?.roles).toEqual(['user', 'editor']);
      expect(result.payload?.permissions).toEqual(['read', 'write', 'edit']);
    });

    it('如果用户不存在应该返回 null', async () => {
      const userProvider = new InMemoryUserDataProvider();

      const managerWithProvider = new JwtManager(
        {
          secret: 'test-secret',
          userDataProvider: userProvider,
        },
        new InMemoryTokenStore()
      );

      // 生成初始 Token
      const initialTokens = await managerWithProvider.generateTokenPair(
        'non-existent-user',
        ['user'],
        ['read']
      );

      // 尝试刷新（用户不存在）
      const refreshedTokens = await managerWithProvider.refreshTokens(
        initialTokens.refreshToken
      );

      expect(refreshedTokens).toBeNull();
    });

    it('如果没有 UserDataProvider 应该使用默认值', async () => {
      const managerWithoutProvider = new JwtManager(
        {
          secret: 'test-secret',
          // userDataProvider 未提供
        },
        new InMemoryTokenStore()
      );

      // 生成初始 Token
      const initialTokens = await managerWithoutProvider.generateTokenPair(
        'user-123',
        ['admin'],
        ['delete']
      );

      // 刷新 Token（应该使用默认值）
      const refreshedTokens = await managerWithoutProvider.refreshTokens(
        initialTokens.refreshToken
      );

      expect(refreshedTokens).not.toBeNull();

      // 验证新 Token 包含默认值
      const result = await managerWithoutProvider.verifyAccessToken(
        refreshedTokens!.accessToken
      );

      expect(result.success).toBe(true);
      expect(result.payload?.roles).toEqual(['user']);
      expect(result.payload?.permissions).toEqual(['read', 'write']);
    });

    it('如果刷新 Token 无效应该返回 null', async () => {
      const managerWithProvider = new JwtManager(
        {
          secret: 'test-secret',
          userDataProvider: new InMemoryUserDataProvider(),
        },
        new InMemoryTokenStore()
      );

      // 使用无效的刷新 Token
      const refreshedTokens = await managerWithProvider.refreshTokens(
        'invalid-refresh-token'
      );

      expect(refreshedTokens).toBeNull();
    });

    it('如果使用访问 Token 而不是刷新 Token 应该返回 null', async () => {
      const managerWithProvider = new JwtManager(
        {
          secret: 'test-secret',
          userDataProvider: new InMemoryUserDataProvider([
            {
              userId: 'user-123',
              roles: ['user'],
              permissions: ['read'],
            },
          ]),
        },
        new InMemoryTokenStore()
      );

      const tokenPair = await managerWithProvider.generateTokenPair(
        'user-123',
        ['user'],
        ['read']
      );

      // 使用访问 Token 而不是刷新 Token
      const refreshedTokens = await managerWithProvider.refreshTokens(
        tokenPair.accessToken
      );

      expect(refreshedTokens).toBeNull();
    });
  });
});
