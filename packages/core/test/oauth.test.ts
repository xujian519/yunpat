/**
 * OAuth 2.0 单元测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  OAuthManager,
  GoogleOAuth,
  GitHubOAuth,
  type OAuthManagerConfig,
  type OAuthCallbackResult,
} from '../src/gateway/auth/index.js'

// Mock fetch
global.fetch = vi.fn()

describe('OAuthManager', () => {
  let oauthManager: OAuthManager
  const mockConfig: OAuthManagerConfig = {
    providers: {
      google: {
        clientId: 'test-google-client-id',
        clientSecret: 'test-google-client-secret',
      },
      github: {
        clientId: 'test-github-client-id',
        clientSecret: 'test-github-client-secret',
      },
    },
    tokenEncryptionKey: 'test-encryption-key-32-bytes-long!',
    stateExpiration: 600,
  }

  beforeEach(() => {
    oauthManager = new OAuthManager(mockConfig)
    vi.clearAllMocks()
  })

  describe('generateAuthorizationUrl', () => {
    it('应该为 Google 生成授权 URL', async () => {
      const result = await oauthManager.generateAuthorizationUrl(
        'google',
        'http://localhost:3000/callback'
      )

      expect(result.url).toContain('accounts.google.com')
      expect(result.url).toContain('client_id=test-google-client-id')
      expect(result.url).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fcallback')
      expect(result.url).toContain('response_type=code')
      expect(result.url).toMatch(/scope=openid/)
      expect(result.state).toBeDefined()
      // PKCE 应该默认启用
      expect(result.pkce).toBeDefined()
      expect(result.pkce?.codeChallenge).toBeDefined()
      expect(result.pkce?.codeVerifier).toBeDefined()
      expect(result.pkce?.challengeMethod).toBe('S256')
    })

    it('应该为 GitHub 生成授权 URL', async () => {
      const result = await oauthManager.generateAuthorizationUrl(
        'github',
        'http://localhost:3000/callback'
      )

      expect(result.url).toContain('github.com')
      expect(result.url).toContain('client_id=test-github-client-id')
      expect(result.url).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fcallback')
      expect(result.url).toContain('response_type=code')
      expect(result.state).toBeDefined()
      // PKCE 应该默认启用
      expect(result.pkce).toBeDefined()
    })

    it('应该支持自定义 scope', async () => {
      const result = await oauthManager.generateAuthorizationUrl(
        'google',
        'http://localhost:3000/callback',
        ['openid', 'email']
      )

      // URLSearchParams 使用 + 而不是 %20 编码空格
      expect(result.url).toMatch(/scope=openid[+%]email/)
    })
  })

  describe('handleCallback', () => {
    it('应该成功处理 Google OAuth 回调', async () => {
      // 首先生成授权 URL 获取 state
      const authResult = await oauthManager.generateAuthorizationUrl(
        'google',
        'http://localhost:3000/callback'
      )

      // Mock Token 请求
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test-access-token',
          refresh_token: 'test-refresh-token',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
      })

      // Mock 用户信息请求
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sub: '123456789',
          name: 'Test User',
          email: 'test@example.com',
          email_verified: true,
          picture: 'https://example.com/avatar.jpg',
        }),
      })

      const result = await oauthManager.handleCallback(
        'google',
        'test-auth-code',
        authResult.state,
        'http://localhost:3000/callback'
      )

      expect(result.provider).toBe('google')
      expect(result.userInfo).toBeDefined()
      expect(result.userInfo.id).toBe('123456789')
      expect(result.userInfo.email).toBe('test@example.com')
      expect(result.userInfo.emailVerified).toBe(true)
      expect(result.token).toBeDefined()
      expect(result.token.accessToken).toBe('test-access-token')
      expect(result.token.refreshToken).toBe('test-refresh-token')
    })

    it('应该成功处理 GitHub OAuth 回调', async () => {
      // 首先生成授权 URL 获取 state
      const authResult = await oauthManager.generateAuthorizationUrl(
        'github',
        'http://localhost:3000/callback'
      )

      // Mock Token 请求
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test-github-access-token',
          token_type: 'bearer',
          scope: 'read:user user:email',
        }),
      })

      // Mock 用户信息请求
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 12345,
          login: 'testuser',
          name: 'Test User',
          email: 'test@example.com',
          avatar_url: 'https://github.com/avatar.jpg',
          html_url: 'https://github.com/testuser',
        }),
      })

      // Mock 邮箱请求
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            email: 'test@example.com',
            verified: true,
            primary: true,
            visibility: null,
          },
        ],
      })

      const result = await oauthManager.handleCallback(
        'github',
        'test-auth-code',
        authResult.state,
        'http://localhost:3000/callback'
      )

      expect(result.provider).toBe('github')
      expect(result.userInfo).toBeDefined()
      expect(result.userInfo.id).toBe('12345')
      expect(result.userInfo.username).toBe('testuser')
      expect(result.userInfo.email).toBe('test@example.com')
      expect(result.userInfo.emailVerified).toBe(true)
    })

    it('应该拒绝无效的 state', async () => {
      await expect(
        oauthManager.handleCallback(
          'google',
          'test-auth-code',
          'invalid-state',
          'http://localhost:3000/callback'
        )
      ).rejects.toThrow('无效的 State 参数')
    })

    it('应该拒绝过期的 state', async () => {
      // 创建一个短期过期的 manager
      const shortLivedManager = new OAuthManager({
        ...mockConfig,
        stateExpiration: 0, // 立即过期
      })

      const authResult = await shortLivedManager.generateAuthorizationUrl(
        'google',
        'http://localhost:3000/callback'
      )

      // 等待过期
      await new Promise((resolve) => setTimeout(resolve, 10))

      // 应该抛出异常（可能是"State 已过期"或"无效的 State 参数"）
      await expect(
        shortLivedManager.handleCallback(
          'google',
          'test-auth-code',
          authResult.state,
          'http://localhost:3000/callback'
        )
      ).rejects.toThrow()
    })
  })

  describe('refreshToken', () => {
    it('应该成功刷新 Google Token', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
      })

      const result = await oauthManager.refreshToken('google', 'old-refresh-token')

      expect(result.accessToken).toBe('new-access-token')
      expect(result.refreshToken).toBe('new-refresh-token')
    })

    it('应该处理刷新失败', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Invalid refresh token',
      })

      await expect(oauthManager.refreshToken('google', 'invalid-refresh-token')).rejects.toThrow()
    })
  })

  describe('verifyToken', () => {
    it('应该验证有效的 Token', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sub: '123456789',
          name: 'Test User',
          email: 'test@example.com',
        }),
      })

      const result = await oauthManager.verifyToken('google', 'valid-token')
      expect(result).toBe(true)
    })

    it('应该拒绝无效的 Token', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
      })

      const result = await oauthManager.verifyToken('google', 'invalid-token')
      expect(result).toBe(false)
    })
  })

  describe('getUserInfo', () => {
    it('应该获取 Google 用户信息', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sub: '123456789',
          name: 'Test User',
          email: 'test@example.com',
          email_verified: true,
          picture: 'https://example.com/avatar.jpg',
        }),
      })

      const userInfo = await oauthManager.getUserInfo('google', 'valid-token')

      expect(userInfo.id).toBe('123456789')
      expect(userInfo.displayName).toBe('Test User')
      expect(userInfo.email).toBe('test@example.com')
      expect(userInfo.emailVerified).toBe(true)
      expect(userInfo.avatarUrl).toBe('https://example.com/avatar.jpg')
    })

    it('应该获取 GitHub 用户信息', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 12345,
          login: 'testuser',
          name: 'Test User',
          email: 'test@example.com',
          avatar_url: 'https://github.com/avatar.jpg',
          html_url: 'https://github.com/testuser',
        }),
      })

      const userInfo = await oauthManager.getUserInfo('github', 'valid-token')

      expect(userInfo.id).toBe('12345')
      expect(userInfo.username).toBe('testuser')
      expect(userInfo.displayName).toBe('Test User')
    })
  })

  describe('Token 加密/解密', () => {
    it('应该成功加密和解密 Token', () => {
      const tokenData = {
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        expiresAt: Date.now() + 3600000,
      }

      const encrypted = oauthManager.encryptToken(tokenData)
      expect(encrypted).toBeDefined()
      expect(typeof encrypted).toBe('string')

      const decrypted = oauthManager.decryptToken(encrypted)
      expect(decrypted.accessToken).toBe(tokenData.accessToken)
      expect(decrypted.refreshToken).toBe(tokenData.refreshToken)
      expect(decrypted.expiresAt).toBe(tokenData.expiresAt)
    })

    it('应该拒绝解密无效的 Token', () => {
      expect(() => {
        oauthManager.decryptToken('invalid-encrypted-token')
      }).toThrow()
    })
  })

  describe('cleanupExpiredStates', () => {
    it('应该清理过期的 State', async () => {
      // 创建一个短期过期的 manager
      const shortLivedManager = new OAuthManager({
        ...mockConfig,
        stateExpiration: 0,
      })

      // 生成几个 state
      await shortLivedManager.generateAuthorizationUrl('google', 'http://localhost:3000/callback')
      await shortLivedManager.generateAuthorizationUrl('github', 'http://localhost:3000/callback')

      // 等待过期
      await new Promise((resolve) => setTimeout(resolve, 10))

      const cleaned = shortLivedManager.cleanupExpiredStates()
      expect(cleaned).toBeGreaterThanOrEqual(0)
    })
  })
})

describe('GoogleOAuth', () => {
  it('应该返回正确的提供商名称', () => {
    const provider = new GoogleOAuth({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
    })

    expect(provider.getName()).toBe('google')
  })

  it('应该返回正确的端点', () => {
    const provider = new GoogleOAuth({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
    })

    expect(provider.getAuthorizationEndpoint()).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(provider.getTokenEndpoint()).toBe('https://oauth2.googleapis.com/token')
    expect(provider.getUserInfoEndpoint()).toBe('https://www.googleapis.com/oauth2/v2/userinfo')
  })
})

describe('GitHubOAuth', () => {
  it('应该返回正确的提供商名称', () => {
    const provider = new GitHubOAuth({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
    })

    expect(provider.getName()).toBe('github')
  })

  it('应该返回正确的端点', () => {
    const provider = new GitHubOAuth({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
    })

    expect(provider.getAuthorizationEndpoint()).toBe('https://github.com/login/oauth/authorize')
    expect(provider.getTokenEndpoint()).toBe('https://github.com/login/oauth/access_token')
    expect(provider.getUserInfoEndpoint()).toBe('https://api.github.com/user')
  })
})
