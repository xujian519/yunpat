/**
 * Gateway.ts 额外测试 - 覆盖未测试的分支
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { BaseGateway, OutputTargetType, InputSourceType } from '../../src/gateway/Gateway.js';
import type { SecurityGatewayConfig } from '../../src/gateway/Gateway.js';
import {
  ApiKeyManager,
  InMemoryApiKeyStore,
  JwtManager,
  InMemoryTokenStore,
  SessionManager,
  InMemorySessionStore,
  OAuthManager,
  type OAuthUserInfo,
} from '../../src/gateway/auth/index.js';
import { InMemoryAuditStore } from '../../src/gateway/audit/index.js';

describe('Gateway - 额外分支覆盖测试', () => {
  let gateway: BaseGateway;
  let apiKeyManager: ApiKeyManager;
  let jwtManager: JwtManager;
  let sessionManager: SessionManager;
  let oauthManager: OAuthManager;
  let auditStore: InMemoryAuditStore;

  beforeEach(async () => {
    apiKeyManager = new ApiKeyManager(new InMemoryApiKeyStore());
    jwtManager = new JwtManager({ secret: 'test-secret-for-testing-only' });
    sessionManager = new SessionManager(new InMemorySessionStore());
    oauthManager = {
      generateAuthorizationUrl: vi.fn(),
      handleCallback: vi.fn(),
      refreshToken: vi.fn(),
      verifyToken: vi.fn(),
      getUserInfo: vi.fn(),
    } as unknown as OAuthManager;
    auditStore = new InMemoryAuditStore({ maxLogs: 1000 });

    const config: SecurityGatewayConfig = {
      enableAuth: true,
      enableAuthorization: true,
      enableContentFilter: true,
      enableAudit: true,
      apiKeyManager,
      jwtManager,
      sessionManager,
      oauthManager,
      auditLogStore: auditStore,
    };

    gateway = new BaseGateway(config);
  });

  afterEach(async () => {
    await auditStore.clear();
  });

  describe('sendOutput - 覆盖未测试分支', () => {
    it('应该处理非 TERMINAL 目标的输出', async () => {
      const output = {
        targetType: OutputTargetType.HTTP,
        text: 'Test HTTP response',
      };

      await expect(gateway.sendOutput(output, OutputTargetType.HTTP)).resolves.toBeUndefined();
    });

    it('应该处理没有文本的 TERMINAL 输出', async () => {
      const output = {
        targetType: OutputTargetType.TERMINAL,
      };

      await expect(gateway.sendOutput(output, OutputTargetType.TERMINAL)).resolves.toBeUndefined();
    });

    it('应该处理空文本的输出', async () => {
      const output = {
        targetType: OutputTargetType.TERMINAL,
        text: '',
      };

      await expect(gateway.sendOutput(output, OutputTargetType.TERMINAL)).resolves.toBeUndefined();
    });

    it('应该处理未启用审计日志的情况', async () => {
      const config: SecurityGatewayConfig = {
        enableAuth: false,
        enableAuthorization: false,
        enableContentFilter: false,
        enableAudit: false,
      };

      const noAuditGateway = new BaseGateway(config);

      const output = {
        targetType: OutputTargetType.TERMINAL,
        text: 'Test without audit',
      };

      await expect(noAuditGateway.sendOutput(output, OutputTargetType.TERMINAL)).resolves.toBeUndefined();
    });

    it('应该处理没有 auditStore 的情况', async () => {
      const config: SecurityGatewayConfig = {
        enableAuth: false,
        enableAuthorization: false,
        enableContentFilter: false,
        enableAudit: true,
      };

      const noStoreGateway = new BaseGateway(config);

      const output = {
        targetType: OutputTargetType.TERMINAL,
        text: 'Test without store',
      };

      await expect(noStoreGateway.sendOutput(output, OutputTargetType.TERMINAL)).resolves.toBeUndefined();
    });

    it('应该记录审计日志并包含正确的 contentLength', async () => {
      const output = {
        targetType: OutputTargetType.TERMINAL,
        text: 'Test audit log with length',
      };

      await gateway.sendOutput(output, OutputTargetType.TERMINAL);

      const logs = await auditStore.query({ action: 'send_output' });
      expect(logs).toHaveLength(1);
      expect(logs[0].details?.contentLength).toBe(26);
    });
  });

  describe('authenticate - OAuth 认证分支', () => {
    it('应该使用 OAuth 认证', async () => {
      const mockUserInfo: OAuthUserInfo = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      };

      (oauthManager.handleCallback as any).mockResolvedValue({
        accessToken: 'oauth-access-token',
        refreshToken: 'oauth-refresh-token',
        userInfo: mockUserInfo,
      });

      const result = await gateway.authenticate({
        type: 'oauth',
        data: {
          provider: 'github',
          code: 'auth-code',
          state: 'state-param',
          redirectUri: 'http://localhost:3000/callback',
        },
      });

      expect(result.success).toBe(true);
      expect(result.userId).toBe('user-123');
      expect(result.roles).toEqual(['user']);
      expect(result.permissions).toEqual(['read', 'write']);
      expect(result.token).toBeDefined();
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it('应该在 OAuth 管理器未配置时失败', async () => {
      const config: SecurityGatewayConfig = {
        enableAuth: true,
        enableAuthorization: false,
        enableContentFilter: false,
        enableAudit: false,
        oauthManager: undefined,
      };

      const noOAuthGateway = new BaseGateway(config);

      const result = await noOAuthGateway.authenticate({
        type: 'oauth',
        data: {
          provider: 'github',
          code: 'auth-code',
          state: 'state-param',
          redirectUri: 'http://localhost:3000/callback',
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('OAuth 管理器未配置');
    });

    it('应该在缺少 OAuth 参数时失败', async () => {
      const result1 = await gateway.authenticate({
        type: 'oauth',
        data: {
          provider: 'github',
          code: 'auth-code',
          redirectUri: 'http://localhost:3000/callback',
        },
      });

      expect(result1.success).toBe(false);
      expect(result1.error).toContain('缺少 OAuth 参数');

      const result2 = await gateway.authenticate({
        type: 'oauth',
        data: {
          provider: 'github',
          state: 'state-param',
          redirectUri: 'http://localhost:3000/callback',
        },
      });

      expect(result2.success).toBe(false);
      expect(result2.error).toContain('缺少 OAuth 参数');

      const result3 = await gateway.authenticate({
        type: 'oauth',
        data: {
          code: 'auth-code',
          state: 'state-param',
          redirectUri: 'http://localhost:3000/callback',
        },
      });

      expect(result3.success).toBe(false);
      expect(result3.error).toContain('缺少 OAuth 参数');
    });

    it('应该处理 OAuth 回调抛出异常', async () => {
      (oauthManager.handleCallback as any).mockRejectedValue(new Error('OAuth callback failed'));

      const result = await gateway.authenticate({
        type: 'oauth',
        data: {
          provider: 'github',
          code: 'auth-code',
          state: 'state-param',
          redirectUri: 'http://localhost:3000/callback',
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('OAuth callback failed');
    });

    it('应该在 OAuth 认证中创建会话（如果配置了）', async () => {
      const mockUserInfo: OAuthUserInfo = {
        id: 'user-456',
        email: 'oauth@example.com',
        name: 'OAuth User',
      };

      (oauthManager.handleCallback as any).mockResolvedValue({
        accessToken: 'oauth-access-token',
        refreshToken: 'oauth-refresh-token',
        userInfo: mockUserInfo,
      });

      const result = await gateway.authenticate({
        type: 'oauth',
        data: {
          provider: 'google',
          code: 'auth-code',
          state: 'state-param',
          redirectUri: 'http://localhost:3000/callback',
        },
      });

      expect(result.success).toBe(true);

      const sessions = await sessionManager.getUserSessions('user-456');
      expect(sessions.length).toBeGreaterThan(0);
      expect(sessions[0].userId).toBe('user-456');
    });

    it('应该在 OAuth 认证中生成 JWT Token（如果配置了）', async () => {
      const mockUserInfo: OAuthUserInfo = {
        id: 'user-789',
        email: 'token@example.com',
        name: 'Token User',
      };

      (oauthManager.handleCallback as any).mockResolvedValue({
        accessToken: 'oauth-access-token',
        refreshToken: 'oauth-refresh-token',
        userInfo: mockUserInfo,
      });

      const result = await gateway.authenticate({
        type: 'oauth',
        data: {
          provider: 'google',
          code: 'auth-code',
          state: 'state-param',
          redirectUri: 'http://localhost:3000/callback',
        },
      });

      expect(result.success).toBe(true);
      expect(result.token).toBeDefined();
      expect(result.expiresAt).toBeInstanceOf(Date);
    });
  });

  describe('authenticate - Basic 认证分支', () => {
    it('应该返回 Basic 认证未实现的错误', async () => {
      const result = await gateway.authenticate({
        type: 'basic',
        data: {
          username: 'testuser',
          password: 'testpass',
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Basic 认证暂未实现');
    });
  });

  describe('authenticate - 默认分支（不支持的类型）', () => {
    it('应该拒绝不支持的认证类型', async () => {
      const result = await gateway.authenticate({
        type: 'unsupported' as any,
        data: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('不支持的认证类型');
    });
  });

  describe('authenticate - API Key 认证错误分支', () => {
    it('应该在 API Key 管理器未配置时失败', async () => {
      const config: SecurityGatewayConfig = {
        enableAuth: true,
        enableAuthorization: false,
        enableContentFilter: false,
        enableAudit: false,
        apiKeyManager: undefined,
      };

      const noKeyGateway = new BaseGateway(config);

      const result = await noKeyGateway.authenticate({
        type: 'apikey',
        data: { apiKey: 'some-key' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('API Key 管理器未配置');
    });

    it('应该在缺少 API Key 时失败', async () => {
      const result = await gateway.authenticate({
        type: 'apikey',
        data: { apiKey: undefined },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('缺少 API Key');
    });

    it('应该拒绝无效的 API Key', async () => {
      const result = await gateway.authenticate({
        type: 'apikey',
        data: { apiKey: 'invalid-key-that-does-not-exist' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('无效的 API Key');
    });

    it('应该在 API Key 认证中创建会话（如果配置了）', async () => {
      const info = {
        userId: 'user-session',
        roles: ['user'],
        permissions: ['read', 'write'],
        enabled: true,
      };

      const apiKey = await apiKeyManager.generateApiKey(info);

      const result = await gateway.authenticate({
        type: 'apikey',
        data: { apiKey },
      });

      expect(result.success).toBe(true);

      const sessions = await sessionManager.getUserSessions('user-session');
      expect(sessions.length).toBeGreaterThan(0);
      expect(sessions[0].userId).toBe('user-session');
    });

    it('应该在 API Key 认证中生成 JWT Token（如果配置了）', async () => {
      const info = {
        userId: 'user-token',
        roles: ['admin'],
        permissions: ['read', 'write', 'delete'],
        enabled: true,
      };

      const apiKey = await apiKeyManager.generateApiKey(info);

      const result = await gateway.authenticate({
        type: 'apikey',
        data: { apiKey },
      });

      expect(result.success).toBe(true);
      expect(result.token).toBeDefined();
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it('应该在 API Key 认证中不创建会话（如果未配置 SessionManager）', async () => {
      const config: SecurityGatewayConfig = {
        enableAuth: true,
        enableAuthorization: false,
        enableContentFilter: false,
        enableAudit: false,
        apiKeyManager,
        jwtManager,
        sessionManager: undefined,
      };

      const noSessionGateway = new BaseGateway(config);

      const info = {
        userId: 'user-no-session',
        roles: ['user'],
        permissions: ['read'],
        enabled: true,
      };

      const apiKey = await apiKeyManager.generateApiKey(info);

      const result = await noSessionGateway.authenticate({
        type: 'apikey',
        data: { apiKey },
      });

      expect(result.success).toBe(true);
      expect(result.userId).toBe('user-no-session');
    });

    it('应该在 API Key 认证中不生成 JWT Token（如果未配置 JwtManager）', async () => {
      const config: SecurityGatewayConfig = {
        enableAuth: true,
        enableAuthorization: false,
        enableContentFilter: false,
        enableAudit: false,
        apiKeyManager,
        sessionManager,
        jwtManager: undefined,
      };

      const noJwtGateway = new BaseGateway(config);

      const info = {
        userId: 'user-no-jwt',
        roles: ['user'],
        permissions: ['read'],
        enabled: true,
      };

      const apiKey = await apiKeyManager.generateApiKey(info);

      const result = await noJwtGateway.authenticate({
        type: 'apikey',
        data: { apiKey },
      });

      expect(result.success).toBe(true);
      expect(result.userId).toBe('user-no-jwt');
      expect(result.token).toBeUndefined();
      expect(result.expiresAt).toBeUndefined();
    });
  });

  describe('authenticate - JWT Token 认证错误分支', () => {
    it('应该在 JWT 管理器未配置时失败', async () => {
      const config: SecurityGatewayConfig = {
        enableAuth: true,
        enableAuthorization: false,
        enableContentFilter: false,
        enableAudit: false,
        jwtManager: undefined,
      };

      const noJwtGateway = new BaseGateway(config);

      const result = await noJwtGateway.authenticate({
        type: 'jwt',
        data: { token: 'some-token' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('JWT 管理器未配置');
    });

    it('应该在缺少 Token 时失败', async () => {
      const result = await gateway.authenticate({
        type: 'jwt',
        data: { token: undefined },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('缺少 Token');
    });

    it('应该在 Token 验证失败时返回错误', async () => {
      const result = await gateway.authenticate({
        type: 'jwt',
        data: { token: 'invalid-token' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('无效的 Token');
    });
  });

  describe('authenticate - 异常处理分支', () => {
    it('应该捕获 authenticate 中的异常', async () => {
      const brokenApiKeyManager = {
        verifyApiKey: vi.fn().mockRejectedValue(new Error('Database connection failed')),
      } as unknown as ApiKeyManager;

      const config: SecurityGatewayConfig = {
        enableAuth: true,
        enableAuthorization: false,
        enableContentFilter: false,
        enableAudit: false,
        apiKeyManager: brokenApiKeyManager,
      };

      const brokenGateway = new BaseGateway(config);

      const result = await brokenGateway.authenticate({
        type: 'apikey',
        data: { apiKey: 'any-key' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database connection failed');
    });
  });

  describe('filterContent - ML 规则分支', () => {
    it('应该处理 ML 类型规则', async () => {
      const config: SecurityGatewayConfig = {
        enableAuth: false,
        enableAuthorization: false,
        enableContentFilter: true,
        enableAudit: false,
        contentFilterRules: [
          {
            name: 'ML 模型过滤',
            type: 'ml',
            content: 'some-ml-model',
            action: 'block',
            severity: 'high',
          },
        ],
      };

      const mlGateway = new BaseGateway(config);

      const result = await mlGateway.filterContent('任何内容');

      expect(result.filtered).toBe(false);
    });

    it('应该在规则类型为 pattern 且 content 为 RegExp 时使用 RegExp', async () => {
      const config: SecurityGatewayConfig = {
        enableAuth: false,
        enableAuthorization: false,
        enableContentFilter: true,
        enableAudit: false,
        contentFilterRules: [
          {
            name: 'RegExp 对象测试',
            type: 'pattern',
            content: /\d{4}/,
            action: 'block',
            severity: 'medium',
          },
        ],
      };

      const testGateway = new BaseGateway(config);

      const result = await testGateway.filterContent('年份是2024年');

      expect(result.filtered).toBe(true);
      expect(result.matchedRule).toBe('RegExp 对象测试');
    });

    it('应该在 pattern 类型中处理无效的正则表达式字符串', async () => {
      const config: SecurityGatewayConfig = {
        enableAuth: false,
        enableAuthorization: false,
        enableContentFilter: true,
        enableAudit: false,
        contentFilterRules: [
          {
            name: '无效正则',
            type: 'pattern',
            content: '[invalid(',
            action: 'block',
            severity: 'medium',
          },
        ],
      };

      const testGateway = new BaseGateway(config);

      const result = await testGateway.filterContent('测试内容');

      expect(result.filtered).toBe(false);
    });
  });

  describe('filterContent - 多规则匹配', () => {
    it('应该在第一个匹配的规则处停止', async () => {
      const config: SecurityGatewayConfig = {
        enableAuth: false,
        enableAuthorization: false,
        enableContentFilter: true,
        enableAudit: false,
        contentFilterRules: [
          {
            name: '规则1',
            type: 'keyword',
            content: '敏感',
            action: 'block',
            severity: 'high',
          },
          {
            name: '规则2',
            type: 'keyword',
            content: '机密',
            action: 'flag',
            severity: 'high',
          },
        ],
      };

      const testGateway = new BaseGateway(config);

      const result = await testGateway.filterContent('这是敏感且机密的信息');

      expect(result.filtered).toBe(true);
      expect(result.matchedRule).toBe('规则1');
      expect(result.reason).toContain('规则1');
    });

    it('应该支持 flag 动作（不阻止）', async () => {
      const config: SecurityGatewayConfig = {
        enableAuth: false,
        enableAuthorization: false,
        enableContentFilter: true,
        enableAudit: false,
        contentFilterRules: [
          {
            name: '需要审查',
            type: 'keyword',
            content: '审查',
            action: 'flag',
            severity: 'medium',
          },
        ],
      };

      const testGateway = new BaseGateway(config);

      const result = await testGateway.filterContent('这需要人工审查');

      expect(result.filtered).toBe(false);
      expect(result.matchedRule).toBe('需要审查');
      expect(result.reason).toBeDefined();
    });

    it('应该支持 sanitize 动作（不阻止）', async () => {
      const config: SecurityGatewayConfig = {
        enableAuth: false,
        enableAuthorization: false,
        enableContentFilter: true,
        enableAudit: false,
        contentFilterRules: [
          {
            name: '特殊字符',
            type: 'keyword',
            content: '特殊',
            action: 'sanitize',
            severity: 'low',
          },
        ],
      };

      const testGateway = new BaseGateway(config);

      const result = await testGateway.filterContent('包含特殊字符');

      expect(result.filtered).toBe(false);
      expect(result.matchedRule).toBe('特殊字符');
    });
  });

  describe('OAuth 辅助方法分支', () => {
    it('generateOAuthAuthorizationUrl 应该在管理器未配置时抛出错误', async () => {
      const config: SecurityGatewayConfig = {
        enableAuth: false,
        enableAuthorization: false,
        enableContentFilter: false,
        enableAudit: false,
        oauthManager: undefined,
      };

      const noOAuthGateway = new BaseGateway(config);

      await expect(
        noOAuthGateway.generateOAuthAuthorizationUrl('github', 'http://localhost:3000/callback')
      ).rejects.toThrow('OAuth 管理器未配置');
    });

    it('generateOAuthAuthorizationUrl 应该调用 OAuth 管理器', async () => {
      const mockResult = {
        authorizationUrl: 'https://github.com/login/oauth/authorize?code=xyz',
        state: 'state-123',
      };

      (oauthManager.generateAuthorizationUrl as any).mockResolvedValue(mockResult);

      const result = await gateway.generateOAuthAuthorizationUrl(
        'github',
        'http://localhost:3000/callback',
        ['read', 'write']
      );

      expect(oauthManager.generateAuthorizationUrl).toHaveBeenCalledWith(
        'github',
        'http://localhost:3000/callback',
        ['read', 'write']
      );
      expect(result).toEqual(mockResult);
    });

    it('handleOAuthCallback 应该在管理器未配置时抛出错误', async () => {
      const config: SecurityGatewayConfig = {
        enableAuth: false,
        enableAuthorization: false,
        enableContentFilter: false,
        enableAudit: false,
        oauthManager: undefined,
      };

      const noOAuthGateway = new BaseGateway(config);

      await expect(
        noOAuthGateway.handleOAuthCallback('github', 'code', 'state', 'http://localhost:3000/callback')
      ).rejects.toThrow('OAuth 管理器未配置');
    });

    it('handleOAuthCallback 应该调用 OAuth 管理器', async () => {
      const mockResult = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        userInfo: {
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
        },
      };

      (oauthManager.handleCallback as any).mockResolvedValue(mockResult);

      const result = await gateway.handleOAuthCallback('github', 'code', 'state', 'http://localhost:3000/callback');

      expect(oauthManager.handleCallback).toHaveBeenCalledWith(
        'github',
        'code',
        'state',
        'http://localhost:3000/callback'
      );
      expect(result).toEqual(mockResult);
    });

    it('refreshOAuthToken 应该在管理器未配置时抛出错误', async () => {
      const config: SecurityGatewayConfig = {
        enableAuth: false,
        enableAuthorization: false,
        enableContentFilter: false,
        enableAudit: false,
        oauthManager: undefined,
      };

      const noOAuthGateway = new BaseGateway(config);

      await expect(noOAuthGateway.refreshOAuthToken('github', 'refresh-token')).rejects.toThrow(
        'OAuth 管理器未配置'
      );
    });

    it('refreshOAuthToken 应该调用 OAuth 管理器', async () => {
      const mockResult = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      };

      (oauthManager.refreshToken as any).mockResolvedValue(mockResult);

      const result = await gateway.refreshOAuthToken('github', 'refresh-token');

      expect(oauthManager.refreshToken).toHaveBeenCalledWith('github', 'refresh-token');
      expect(result).toEqual(mockResult);
    });

    it('verifyOAuthToken 应该在管理器未配置时抛出错误', async () => {
      const config: SecurityGatewayConfig = {
        enableAuth: false,
        enableAuthorization: false,
        enableContentFilter: false,
        enableAudit: false,
        oauthManager: undefined,
      };

      const noOAuthGateway = new BaseGateway(config);

      await expect(noOAuthGateway.verifyOAuthToken('github', 'access-token')).rejects.toThrow(
        'OAuth 管理器未配置'
      );
    });

    it('verifyOAuthToken 应该调用 OAuth 管理器', async () => {
      (oauthManager.verifyToken as any).mockResolvedValue(true);

      const result = await gateway.verifyOAuthToken('github', 'access-token');

      expect(oauthManager.verifyToken).toHaveBeenCalledWith('github', 'access-token');
      expect(result).toBe(true);
    });

    it('getOAuthUserInfo 应该在管理器未配置时抛出错误', async () => {
      const config: SecurityGatewayConfig = {
        enableAuth: false,
        enableAuthorization: false,
        enableContentFilter: false,
        enableAudit: false,
        oauthManager: undefined,
      };

      const noOAuthGateway = new BaseGateway(config);

      await expect(noOAuthGateway.getOAuthUserInfo('github', 'access-token')).rejects.toThrow(
        'OAuth 管理器未配置'
      );
    });

    it('getOAuthUserInfo 应该调用 OAuth 管理器', async () => {
      const mockUserInfo = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      };

      (oauthManager.getUserInfo as any).mockResolvedValue(mockUserInfo);

      const result = await gateway.getOAuthUserInfo('github', 'access-token');

      expect(oauthManager.getUserInfo).toHaveBeenCalledWith('github', 'access-token');
      expect(result).toEqual(mockUserInfo);
    });
  });

  describe('writeAuditLog - 分支覆盖', () => {
    it('应该在没有 auditStore 时输出到控制台', async () => {
      const config: SecurityGatewayConfig = {
        enableAuth: false,
        enableAuthorization: false,
        enableContentFilter: false,
        enableAudit: false,
        auditStore: undefined,
      };

      const noStoreGateway = new BaseGateway(config);

      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await noStoreGateway.writeAuditLog({
        timestamp: new Date(),
        action: 'test',
        result: 'success',
      });

      expect(logSpy).toHaveBeenCalledWith(
        '[审计日志]',
        expect.stringContaining('test')
      );

      logSpy.mockRestore();
    });

    it('应该在有 auditStore 时写入日志', async () => {
      await auditStore.clear();

      await gateway.writeAuditLog({
        timestamp: new Date(),
        action: 'custom_action',
        result: 'success',
        userId: 'user-123',
      });

      const logs = await auditStore.query({ action: 'custom_action' });
      expect(logs).toHaveLength(1);
      expect(logs[0].userId).toBe('user-123');
    });
  });

  describe('receiveInput - 所有输入源类型', () => {
    it('应该处理所有输入源类型', async () => {
      const sources = [
        InputSourceType.TEXT,
        InputSourceType.VOICE,
        InputSourceType.IMAGE,
        InputSourceType.VIDEO,
        InputSourceType.FILE,
        InputSourceType.API,
        InputSourceType.CLI,
        InputSourceType.WEBSOCKET,
      ];

      for (const source of sources) {
        const input = await gateway.receiveInput(source);
        expect(input.sourceType).toBe(source);
        expect(input.metadata?.timestamp).toBeInstanceOf(Date);
      }
    });
  });

  describe('authorize - 边界情况', () => {
    it('应该处理空权限列表', async () => {
      const config: SecurityGatewayConfig = {
        enableAuth: false,
        enableAuthorization: true,
        enableContentFilter: false,
        enableAudit: false,
      };

      const testGateway = new BaseGateway(config);

      const result = await testGateway.authorize(
        { type: 'read', resource: 'file' },
        []
      );

      expect(result.authorized).toBe(false);
      expect(result.reason).toBeDefined();
    });

    it('应该处理通配符资源权限', async () => {
      const result = await gateway.authorize(
        { type: 'write', resource: 'any-resource' },
        [{ resource: '*', action: 'write' }]
      );

      expect(result.authorized).toBe(true);
    });

    it('应该处理通配符操作权限', async () => {
      const result = await gateway.authorize(
        { type: 'any-action',
          resource: 'file' },
        [{ resource: 'file', action: '*' }]
      );

      expect(result.authorized).toBe(true);
    });

    it('应该在未启用授权时通过所有请求', async () => {
      const config: SecurityGatewayConfig = {
        enableAuth: false,
        enableAuthorization: false,
        enableContentFilter: false,
        enableAudit: false,
      };

      const noAuthGateway = new BaseGateway(config);

      const result = await noAuthGateway.authorize(
        { type: 'delete', resource: 'critical-resource' },
        []
      );

      expect(result.authorized).toBe(true);
      expect(result.reason).toBeUndefined();
    });
  });
});
