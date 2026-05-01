/**
 * 认证模块导出
 */

export {
  ApiKeyManager,
  ApiKeyStore,
  InMemoryApiKeyStore,
  type ApiKeyInfo,
  type ApiKeyManagerConfig,
} from './ApiKeyManager.js';

export {
  JwtManager,
  TokenStore,
  InMemoryTokenStore,
  type TokenPayload,
  type TokenConfig,
  type TokenPair,
  type TokenVerifyResult,
  type UserData,
  type UserDataProvider,
} from './JwtManager.js';

export {
  InMemoryUserDataProvider,
  createExampleUserDataProvider,
} from './ExampleUserDataProvider.js';

export {
  SessionManager,
  SessionStore,
  InMemorySessionStore,
  type Session,
  type SessionOptions,
  type SessionManagerConfig,
} from './SessionManager.js';
