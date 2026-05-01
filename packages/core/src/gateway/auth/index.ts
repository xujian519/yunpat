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

// OAuth 2.0
export {
  OAuthManager,
  type OAuthManagerConfig,
  type OAuthProviderConfigs,
  type OAuthProviderType,
  type AuthorizationUrlResult,
  type OAuthCallbackResult,
} from './OAuthManager.js';

export {
  BaseOAuthProvider,
  type OAuthProviderConfig,
  type OAuthToken,
  type OAuthUserInfo,
  type AuthUrlOptions,
  type PkcePair,
  type TokenRequestOptions,
  OAuthProviderError,
} from './providers/BaseOAuthProvider.js';

export {
  GoogleOAuth,
  type GoogleOAuthConfig,
} from './providers/GoogleOAuth.js';

export {
  GitHubOAuth,
  type GitHubOAuthConfig,
} from './providers/GitHubOAuth.js';
