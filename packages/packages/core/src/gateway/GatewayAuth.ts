/**
 * Gateway 认证逻辑
 *
 * 独立的 authenticate 函数，支持 apikey / jwt / oauth / basic 四种认证方式。
 */

import type {
  ApiKeyManager,
  JwtManager,
  OAuthManager,
  SessionManager,
  BasicAuthProvider,
} from './auth/index.js'
import type { SecurityGatewayConfig, Credentials, AuthResult } from './GatewayTypes.js'

/**
 * 身份认证
 *
 * 根据 SecurityGatewayConfig 中的管理器和凭证类型执行认证。
 */
export async function authenticateCredentials(
  config: SecurityGatewayConfig,
  credentials: Credentials
): Promise<AuthResult> {
  if (!config.enableAuth) {
    return {
      success: true,
      userId: 'anonymous',
      roles: ['guest'],
      permissions: ['read'],
    }
  }

  try {
    switch (credentials.type) {
      case 'apikey': {
        return await authenticateApiKey(config, credentials)
      }

      case 'jwt': {
        return await authenticateJwt(config, credentials)
      }

      case 'oauth': {
        return await authenticateOAuth(config, credentials)
      }

      case 'basic': {
        return await authenticateBasic(config, credentials)
      }

      default:
        return {
          success: false,
          error: '不支持的认证类型',
        }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * API Key 认证
 */
async function authenticateApiKey(
  config: SecurityGatewayConfig,
  credentials: Credentials
): Promise<AuthResult> {
  if (!config.apiKeyManager) {
    return {
      success: false,
      error: 'API Key 管理器未配置',
    }
  }

  const apiKey = credentials.data.apiKey

  if (!apiKey) {
    return {
      success: false,
      error: '缺少 API Key',
    }
  }

  const keyInfo = await config.apiKeyManager.verifyApiKey(apiKey)

  if (!keyInfo) {
    return {
      success: false,
      error: '无效的 API Key',
    }
  }

  // 创建会话
  if (config.sessionManager) {
    await config.sessionManager.createSession({
      userId: keyInfo.userId,
      roles: keyInfo.roles,
      permissions: keyInfo.permissions,
      ttl: 3600, // 1 小时
    })
  }

  // 生成 JWT Token（如果配置了）
  let token: string | undefined
  let expiresAt: Date | undefined

  if (config.jwtManager) {
    const tokenPair = await config.jwtManager.generateTokenPair(
      keyInfo.userId,
      keyInfo.roles,
      keyInfo.permissions
    )
    token = tokenPair.accessToken
    expiresAt = new Date(tokenPair.expiresAt * 1000)
  }

  return {
    success: true,
    userId: keyInfo.userId,
    roles: keyInfo.roles,
    permissions: keyInfo.permissions,
    token,
    expiresAt,
  }
}

/**
 * JWT Token 认证
 */
async function authenticateJwt(
  config: SecurityGatewayConfig,
  credentials: Credentials
): Promise<AuthResult> {
  if (!config.jwtManager) {
    return {
      success: false,
      error: 'JWT 管理器未配置',
    }
  }

  const token = credentials.data.token

  if (!token) {
    return {
      success: false,
      error: '缺少 Token',
    }
  }

  const result = await config.jwtManager.verifyAccessToken(token)

  if (!result.success || !result.payload) {
    return {
      success: false,
      error: `无效的 Token: ${result.error || 'unknown'}`,
    }
  }

  return {
    success: true,
    userId: result.payload.sub,
    roles: result.payload.roles,
    permissions: result.payload.permissions,
    token,
    expiresAt: new Date(result.payload.exp * 1000),
  }
}

/**
 * OAuth 认证
 */
async function authenticateOAuth(
  config: SecurityGatewayConfig,
  credentials: Credentials
): Promise<AuthResult> {
  if (!config.oauthManager) {
    return {
      success: false,
      error: 'OAuth 管理器未配置',
    }
  }

  const provider = credentials.data.provider
  const code = credentials.data.code
  const state = credentials.data.state
  const redirectUri = credentials.data.redirectUri

  if (!provider || !code || !state || !redirectUri) {
    return {
      success: false,
      error: '缺少 OAuth 参数',
    }
  }

  try {
    const result = await config.oauthManager.handleCallback(provider, code, state, redirectUri)

    // 创建会话
    if (config.sessionManager) {
      await config.sessionManager.createSession({
        userId: result.userInfo.id,
        roles: ['user'],
        permissions: ['read', 'write'],
        ttl: 3600, // 1 小时
      })
    }

    // 生成 JWT Token（如果配置了）
    let token: string | undefined
    let expiresAt: Date | undefined

    if (config.jwtManager) {
      const tokenPair = await config.jwtManager.generateTokenPair(
        result.userInfo.id,
        ['user'],
        ['read', 'write']
      )
      token = tokenPair.accessToken
      expiresAt = new Date(tokenPair.expiresAt * 1000)
    }

    return {
      success: true,
      userId: result.userInfo.id,
      roles: ['user'],
      permissions: ['read', 'write'],
      token,
      expiresAt,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Basic 认证
 */
async function authenticateBasic(
  config: SecurityGatewayConfig,
  credentials: Credentials
): Promise<AuthResult> {
  if (!credentials.data.username || !credentials.data.password) {
    return {
      success: false,
      error: '缺少用户名或密码',
    }
  }

  if (!config.basicAuthProvider) {
    return {
      success: false,
      error: 'Basic 认证提供者未配置',
    }
  }

  const userData = await config.basicAuthProvider.verifyCredentials(
    credentials.data.username,
    credentials.data.password
  )

  if (!userData) {
    return {
      success: false,
      error: '用户名或密码错误',
    }
  }

  if (config.sessionManager) {
    await config.sessionManager.createSession({
      userId: userData.userId,
      roles: userData.roles,
      permissions: userData.permissions,
      ttl: 3600,
    })
  }

  let token: string | undefined
  let expiresAt: Date | undefined

  if (config.jwtManager) {
    const tokenPair = await config.jwtManager.generateTokenPair(
      userData.userId,
      userData.roles,
      userData.permissions
    )
    token = tokenPair.accessToken
    expiresAt = new Date(tokenPair.expiresAt * 1000)
  }

  return {
    success: true,
    userId: userData.userId,
    roles: userData.roles,
    permissions: userData.permissions,
    token,
    expiresAt,
  }
}
