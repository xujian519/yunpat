/**
 * OAuth 2.0 集成测试
 *
 * 这些测试需要真实的 OAuth 凭证才能运行
 * 设置环境变量：
 * - GOOGLE_OAUTH_CLIENT_ID
 * - GOOGLE_OAUTH_CLIENT_SECRET
 * - GITHUB_OAUTH_CLIENT_ID
 * - GITHUB_OAUTH_CLIENT_SECRET
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { OAuthManager, GoogleOAuth, GitHubOAuth } from '../src/gateway/auth/index.js'

// 集成测试配置（从环境变量读取）
const getIntegrationConfig = () => ({
  google: {
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || '',
  },
  github: {
    clientId: process.env.GITHUB_OAUTH_CLIENT_ID || '',
    clientSecret: process.env.GITHUB_OAUTH_CLIENT_SECRET || '',
  },
  encryptionKey: process.env.OAUTH_ENCRYPTION_KEY || 'test-encryption-key-32-bytes-long!',
})

describe.runIf(process.env.RUN_INTEGRATION_TESTS === 'true')('OAuth 2.0 集成测试', () => {
  describe('Google OAuth', () => {
    let oauthManager: OAuthManager
    let config: ReturnType<typeof getIntegrationConfig>

    beforeAll(() => {
      config = getIntegrationConfig()

      if (!config.google.clientId || !config.google.clientSecret) {
        throw new Error('缺少 Google OAuth 凭证')
      }

      oauthManager = new OAuthManager({
        providers: {
          google: config.google,
        },
        tokenEncryptionKey: config.encryptionKey,
      })
    })

    it('应该生成有效的 Google 授权 URL', async () => {
      const result = await oauthManager.generateAuthorizationUrl(
        'google',
        'http://localhost:3000/auth/callback'
      )

      expect(result.url).toContain('accounts.google.com')
      expect(result.url).toContain(config.google.clientId)
      expect(result.state).toBeDefined()
      expect(result.pkce).toBeDefined()
      expect(result.pkce?.codeChallenge).toBeDefined()
      expect(result.pkce?.codeVerifier).toBeDefined()
      expect(result.pkce?.challengeMethod).toBe('S256')

      console.log('Google 授权 URL:', result.url)
    })

    it('应该支持自定义 scope', async () => {
      const result = await oauthManager.generateAuthorizationUrl(
        'google',
        'http://localhost:3000/auth/callback',
        ['openid', 'profile', 'email']
      )

      expect(result.url).toContain('scope=')
      console.log('Google 授权 URL (自定义 scope):', result.url)
    })
  })

  describe('GitHub OAuth', () => {
    let oauthManager: OAuthManager
    let config: ReturnType<typeof getIntegrationConfig>

    beforeAll(() => {
      config = getIntegrationConfig()

      if (!config.github.clientId || !config.github.clientSecret) {
        throw new Error('缺少 GitHub OAuth 凭证')
      }

      oauthManager = new OAuthManager({
        providers: {
          github: config.github,
        },
        tokenEncryptionKey: config.encryptionKey,
      })
    })

    it('应该生成有效的 GitHub 授权 URL', async () => {
      const result = await oauthManager.generateAuthorizationUrl(
        'github',
        'http://localhost:3000/auth/callback'
      )

      expect(result.url).toContain('github.com')
      expect(result.url).toContain(config.github.clientId)
      expect(result.state).toBeDefined()
      expect(result.pkce).toBeDefined()

      console.log('GitHub 授权 URL:', result.url)
    })

    it('应该支持自定义 scope', async () => {
      const result = await oauthManager.generateAuthorizationUrl(
        'github',
        'http://localhost:3000/auth/callback',
        ['read:user', 'user:email', 'repo']
      )

      expect(result.url).toContain('scope=')
      console.log('GitHub 授权 URL (自定义 scope):', result.url)
    })
  })

  describe('Token 加密/解密', () => {
    let oauthManager: OAuthManager

    beforeAll(() => {
      const config = getIntegrationConfig()

      oauthManager = new OAuthManager({
        providers: {
          google: config.google,
          github: config.github,
        },
        tokenEncryptionKey: config.encryptionKey,
      })
    })

    it('应该正确加密和解密完整的 Token 数据', () => {
      const tokenData = {
        accessToken: 'ya29.a0AfH6SMBx...',
        refreshToken: 'refresh-token-value',
        expiresAt: Date.now() + 3600000,
      }

      const encrypted = oauthManager.encryptToken(tokenData)

      expect(encrypted).toBeDefined()
      expect(typeof encrypted).toBe('string')
      expect(encrypted.length).toBeGreaterThan(0)

      // 加密后的数据应该与原始数据不同
      expect(encrypted).not.toContain(tokenData.accessToken)
      expect(encrypted).not.toContain(tokenData.refreshToken)

      const decrypted = oauthManager.decryptToken(encrypted)

      expect(decrypted.accessToken).toBe(tokenData.accessToken)
      expect(decrypted.refreshToken).toBe(tokenData.refreshToken)
      expect(decrypted.expiresAt).toBe(tokenData.expiresAt)
    })

    it('应该加密和解密没有 refresh token 的数据', () => {
      const tokenData = {
        accessToken: 'github-token-value',
        expiresAt: Date.now() + 3600000,
      }

      const encrypted = oauthManager.encryptToken(tokenData)
      const decrypted = oauthManager.decryptToken(encrypted)

      expect(decrypted.accessToken).toBe(tokenData.accessToken)
      expect(decrypted.refreshToken).toBeUndefined()
      expect(decrypted.expiresAt).toBe(tokenData.expiresAt)
    })

    it('应该拒绝解密被篡改的数据', () => {
      const tokenData = {
        accessToken: 'test-token',
        expiresAt: Date.now() + 3600000,
      }

      const encrypted = oauthManager.encryptToken(tokenData)

      // 篡改加密数据
      const tampered = encrypted.slice(0, -10) + 'tampered'

      expect(() => {
        oauthManager.decryptToken(tampered)
      }).toThrow()
    })
  })

  describe('PKCE 流程', () => {
    it('应该生成有效的 PKCE 对', async () => {
      const config = getIntegrationConfig()

      const oauthManager = new OAuthManager({
        providers: {
          google: config.google,
        },
        tokenEncryptionKey: config.encryptionKey,
      })

      const result = await oauthManager.generateAuthorizationUrl(
        'google',
        'http://localhost:3000/auth/callback'
      )

      expect(result.pkce).toBeDefined()
      expect(result.pkce?.codeChallenge).toBeDefined()
      expect(result.pkce?.codeVerifier).toBeDefined()
      expect(result.pkce?.challengeMethod).toBe('S256')

      // Code Challenge 应该是 base64url 编码
      expect(result.pkce?.codeChallenge).toMatch(/^[A-Za-z0-9_-]+$/)

      // Code Verifier 应该是 base64url 编码且足够长
      expect(result.pkce?.codeVerifier).toMatch(/^[A-Za-z0-9_-]+$/)
      expect(result.pkce?.codeVerifier.length).toBeGreaterThanOrEqual(43)
    })

    it('应该生成不同的 PKCE 对每次调用', async () => {
      const config = getIntegrationConfig()

      const oauthManager = new OAuthManager({
        providers: {
          google: config.google,
        },
        tokenEncryptionKey: config.encryptionKey,
      })

      const result1 = await oauthManager.generateAuthorizationUrl(
        'google',
        'http://localhost:3000/auth/callback'
      )

      const result2 = await oauthManager.generateAuthorizationUrl(
        'google',
        'http://localhost:3000/auth/callback'
      )

      expect(result1.pkce?.codeChallenge).not.toBe(result2.pkce?.codeChallenge)
      expect(result1.pkce?.codeVerifier).not.toBe(result2.pkce?.codeVerifier)
      expect(result1.state).not.toBe(result2.state)
    })
  })

  describe('State 验证', () => {
    let oauthManager: OAuthManager

    beforeAll(() => {
      const config = getIntegrationConfig()

      oauthManager = new OAuthManager({
        providers: {
          google: config.google,
        },
        tokenEncryptionKey: config.encryptionKey,
        stateExpiration: 1, // 1 秒过期
      })
    })

    it('应该拒绝无效的 state', async () => {
      await expect(
        oauthManager.handleCallback(
          'google',
          'auth-code',
          'invalid-state',
          'http://localhost:3000/auth/callback'
        )
      ).rejects.toThrow('无效的 State 参数')
    })

    it('应该拒绝过期的 state', async () => {
      const result = await oauthManager.generateAuthorizationUrl(
        'google',
        'http://localhost:3000/auth/callback'
      )

      // 等待 state 过期
      await new Promise((resolve) => setTimeout(resolve, 1100))

      await expect(
        oauthManager.handleCallback(
          'google',
          'auth-code',
          result.state,
          'http://localhost:3000/auth/callback'
        )
      ).rejects.toThrow('State 已过期')
    })

    it('应该清理过期的 state', async () => {
      const result1 = await oauthManager.generateAuthorizationUrl(
        'google',
        'http://localhost:3000/auth/callback'
      )

      const result2 = await oauthManager.generateAuthorizationUrl(
        'google',
        'http://localhost:3000/auth/callback'
      )

      // 等待 state 过期
      await new Promise((resolve) => setTimeout(resolve, 1100))

      const cleaned = oauthManager.cleanupExpiredStates()
      expect(cleaned).toBeGreaterThanOrEqual(2)
    })
  })

  describe('多提供商支持', () => {
    let oauthManager: OAuthManager

    beforeAll(() => {
      const config = getIntegrationConfig()

      oauthManager = new OAuthManager({
        providers: {
          google: config.google,
          github: config.github,
        },
        tokenEncryptionKey: config.encryptionKey,
      })
    })

    it('应该同时支持多个提供商', async () => {
      const googleResult = await oauthManager.generateAuthorizationUrl(
        'google',
        'http://localhost:3000/auth/callback'
      )

      const githubResult = await oauthManager.generateAuthorizationUrl(
        'github',
        'http://localhost:3000/auth/callback'
      )

      expect(googleResult.url).toContain('accounts.google.com')
      expect(githubResult.url).toContain('github.com')
      expect(googleResult.state).not.toBe(githubResult.state)
    })

    it('应该正确区分不同提供商的 state', async () => {
      const googleResult = await oauthManager.generateAuthorizationUrl(
        'google',
        'http://localhost:3000/auth/callback'
      )

      // 使用 GitHub 的提供商但 Google 的 state 应该失败
      await expect(
        oauthManager.handleCallback(
          'github',
          'auth-code',
          googleResult.state,
          'http://localhost:3000/auth/callback'
        )
      ).rejects.toThrow('提供商不匹配')
    })
  })
})

describe('OAuth 提供商配置', () => {
  it('应该拒绝缺少加密密钥的配置', () => {
    expect(() => {
      new OAuthManager({
        providers: {
          google: {
            clientId: 'test',
            clientSecret: 'test',
          },
        },
        tokenEncryptionKey: '',
      })
    }).toThrow('OAuth 加密密钥必须提供')
  })

  it('应该拒绝过短的加密密钥', () => {
    expect(() => {
      new OAuthManager({
        providers: {
          google: {
            clientId: 'test',
            clientSecret: 'test',
          },
        },
        tokenEncryptionKey: 'short',
      })
    }).toThrow('OAuth 加密密钥必须提供')
  })

  it('应该支持禁用 PKCE', async () => {
    const oauthManager = new OAuthManager({
      providers: {
        google: {
          clientId: 'test',
          clientSecret: 'test',
          usePkce: false,
        },
      },
      tokenEncryptionKey: 'test-encryption-key-32-bytes-long!',
    })

    const result = await oauthManager.generateAuthorizationUrl(
      'google',
      'http://localhost:3000/auth/callback'
    )

    // 禁用 PKCE 后，不应该生成 codeVerifier 和 codeChallenge
    expect(result.pkce).toBeUndefined()
  })
})
