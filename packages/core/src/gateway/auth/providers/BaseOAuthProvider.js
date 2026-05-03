/**
 * OAuth 2.0 提供商基类
 *
 * 实现标准的 OAuth 2.0 Authorization Code Flow
 * 支持 PKCE (Proof Key for Code Exchange)
 */
import { randomBytes, createHash } from 'crypto';
import { URLSearchParams } from 'url';
/**
 * OAuth 提供商错误
 */
export class OAuthProviderError extends Error {
    code;
    statusCode;
    constructor(message, code, statusCode) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.name = 'OAuthProviderError';
    }
}
/**
 * OAuth 2.0 提供商基类
 *
 * 实现标准的 OAuth 2.0 Authorization Code Flow
 * 子类需要实现用户信息获取逻辑
 */
export class BaseOAuthProvider {
    config;
    constructor(config) {
        this.config = {
            usePkce: true,
            ...config,
        };
    }
    /**
     * 获取授权端点
     */
    getAuthorizationEndpoint() {
        return this.config.authorizationEndpoint;
    }
    /**
     * 获取 Token 端点
     */
    getTokenEndpoint() {
        return this.config.tokenEndpoint;
    }
    /**
     * 获取用户信息端点
     */
    getUserInfoEndpoint() {
        return this.config.userInfoEndpoint;
    }
    /**
     * 生成授权 URL
     *
     * @param options 授权 URL 选项
     * @returns 授权 URL 和 PKCE 验证器（如果启用）
     */
    async generateAuthorizationUrl(options) {
        const scope = options.scope || this.config.defaultScope;
        const state = options.state || this.generateSecureRandom(32);
        // 构建 URL 参数
        const params = new URLSearchParams({
            client_id: this.config.clientId,
            redirect_uri: options.redirectUri,
            response_type: 'code',
            scope: Array.isArray(scope) ? scope.join(' ') : scope,
            state,
        });
        // 添加额外参数
        if (options.extras) {
            Object.entries(options.extras).forEach(([key, value]) => {
                params.append(key, value);
            });
        }
        // PKCE 支持
        let pkce;
        // 显式启用 PKCE（选项或配置启用）
        const enablePkce = options.usePkce !== false && this.config.usePkce !== false;
        if (enablePkce) {
            pkce = this.generatePkcePair();
            params.append('code_challenge', pkce.codeChallenge);
            params.append('code_challenge_method', pkce.challengeMethod);
        }
        const url = `${this.config.authorizationEndpoint}?${params.toString()}`;
        return { url, pkce };
    }
    /**
     * 交换授权码获取 Token
     *
     * @param options Token 请求选项
     * @returns OAuth Token
     */
    async exchangeCodeForToken(options) {
        const params = new URLSearchParams({
            grant_type: 'authorization_code',
            code: options.code,
            redirect_uri: options.redirectUri,
            client_id: this.config.clientId,
            client_secret: this.config.clientSecret,
        });
        // 添加 PKCE Code Verifier
        if (options.codeVerifier) {
            params.append('code_verifier', options.codeVerifier);
        }
        const response = await fetch(this.config.tokenEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString(),
        });
        if (!response.ok) {
            const error = await response.text();
            throw new OAuthProviderError(`Token 请求失败: ${error}`, 'token_request_failed', response.status);
        }
        const data = (await response.json());
        return {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            tokenType: data.token_type || 'Bearer',
            expiresIn: data.expires_in,
            scope: data.scope,
            idToken: data.id_token,
        };
    }
    /**
     * 刷新访问 Token
     *
     * @param refreshToken 刷新令牌
     * @returns 新的 OAuth Token
     */
    async refreshAccessToken(refreshToken) {
        const params = new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: this.config.clientId,
            client_secret: this.config.clientSecret,
        });
        const response = await fetch(this.config.tokenEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString(),
        });
        if (!response.ok) {
            const error = await response.text();
            throw new OAuthProviderError(`Token 刷新失败: ${error}`, 'token_refresh_failed', response.status);
        }
        const data = (await response.json());
        return {
            accessToken: data.access_token,
            refreshToken: data.refresh_token || refreshToken,
            tokenType: data.token_type || 'Bearer',
            expiresIn: data.expires_in,
            scope: data.scope,
            idToken: data.id_token,
        };
    }
    /**
     * 获取用户信息
     *
     * @param accessToken 访问令牌
     * @returns 用户信息
     */
    async getUserInfo(accessToken) {
        return await this.fetchUserInfo(accessToken);
    }
    /**
     * 验证 Token
     *
     * 通过获取用户信息来验证 Token 是否有效
     *
     * @param accessToken 访问令牌
     * @returns Token 是否有效
     */
    async verifyToken(accessToken) {
        try {
            await this.getUserInfo(accessToken);
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * 生成 PKCE 验证器对
     *
     * 使用 SHA-256 方法（推荐）
     */
    generatePkcePair() {
        // 生成随机的 Code Verifier（43-128 个字符）
        const codeVerifier = this.generateSecureRandom(64);
        // 计算 Code Challenge（base64url 编码的 SHA-256 哈希）
        const hash = createHash('sha256').update(codeVerifier).digest();
        const codeChallenge = hash.toString('base64url');
        return {
            codeChallenge,
            codeVerifier,
            challengeMethod: 'S256',
        };
    }
    /**
     * 生成安全的随机字符串
     *
     * @param bytes 字节数
     * @returns base64url 编码的随机字符串
     */
    generateSecureRandom(bytes) {
        return randomBytes(bytes).toString('base64url');
    }
}
