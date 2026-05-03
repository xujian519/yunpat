/**
 * API Key 管理器
 *
 * 负责 API Key 的生成、验证和存储
 */
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
/**
 * 内存存储实现（用于开发/测试）
 */
export class InMemoryApiKeyStore {
    store = new Map();
    async save(keyId, apiKeyHash, info) {
        this.store.set(keyId, { apiKeyHash, info });
    }
    async find(keyId) {
        return this.store.get(keyId) || null;
    }
    async delete(keyId) {
        this.store.delete(keyId);
    }
    async listByUser(userId) {
        const results = [];
        for (const [keyId, data] of this.store.entries()) {
            if (data.info.userId === userId) {
                results.push({ keyId, info: data.info });
            }
        }
        return results;
    }
    async cleanupExpired() {
        const now = new Date();
        let cleaned = 0;
        for (const [keyId, data] of this.store.entries()) {
            if (data.info.expiresAt && data.info.expiresAt < now) {
                this.store.delete(keyId);
                cleaned++;
            }
        }
        return cleaned;
    }
}
/**
 * API Key 管理器
 */
export class ApiKeyManager {
    store;
    config;
    rateLimitMap = new Map();
    constructor(store, config) {
        this.store = store || new InMemoryApiKeyStore();
        this.config = config || {
            rateLimit: {
                maxAttempts: 10,
                windowMs: 60000, // 1 分钟
            },
        };
    }
    /**
     * 检查速率限制
     */
    async checkRateLimit(keyId) {
        if (!this.config.rateLimit) {
            return true;
        }
        const now = Date.now();
        const record = this.rateLimitMap.get(keyId);
        if (!record || now > record.resetTime) {
            this.rateLimitMap.set(keyId, {
                count: 1,
                resetTime: now + this.config.rateLimit.windowMs,
            });
            return true;
        }
        if (record.count >= this.config.rateLimit.maxAttempts) {
            return false; // 超过限制
        }
        record.count++;
        return true;
    }
    /**
     * 生成新的 API Key
     *
     * @param info API Key 信息
     * @returns 生成的 API Key（格式: yunpat_<keyId>_<secret>）
     */
    async generateApiKey(info) {
        const keyId = this.generateKeyId();
        const secret = randomBytes(32).toString('base64url');
        // 组合完整的 API Key
        const apiKey = `yunpat_${keyId}_${secret}`;
        // 哈希存储（只存储哈希值，不存储原始 Key）
        const apiKeyHash = this.hashApiKey(secret);
        // 保存完整信息（包括 keyId、createdAt 和所有其他字段）
        const fullInfo = {
            keyId,
            createdAt: new Date(),
            userId: info.userId,
            roles: info.roles,
            permissions: info.permissions,
            enabled: info.enabled,
            username: info.username,
            expiresAt: info.expiresAt,
            rateLimit: info.rateLimit,
            note: info.note,
        };
        await this.store.save(keyId, apiKeyHash, fullInfo);
        return apiKey;
    }
    /**
     * 验证 API Key
     *
     * @param apiKey API Key 字符串
     * @returns API Key 信息（如果验证成功）
     */
    async verifyApiKey(apiKey) {
        try {
            // 解析 API Key 格式：yunpat_<keyId>_<secret>
            // 注意：secret 部分可能包含下划线，所以限制分割次数为 3
            if (!apiKey.startsWith('yunpat_')) {
                return null;
            }
            // 解析 keyId 和 secret
            // keyId 是 base64url(8 bytes) = 固定 11 字符
            // secret 是 base64url(32 bytes) = 固定 43 字符
            const remaining = apiKey.slice('yunpat_'.length);
            const keyIdLength = 11; // base64url(8 bytes) 固定长度
            if (remaining.length < keyIdLength + 2) {
                return null;
            }
            const keyId = remaining.slice(0, keyIdLength);
            const separator = remaining.charAt(keyIdLength);
            const secret = remaining.slice(keyIdLength + 1);
            if (separator !== '_') {
                return null;
            }
            if (!keyId || !secret) {
                return null;
            }
            // 检查速率限制
            const rateLimitOk = await this.checkRateLimit(keyId);
            if (!rateLimitOk) {
                return null;
            }
            // 从存储中查找
            const stored = await this.store.find(keyId);
            if (!stored) {
                return null;
            }
            const { apiKeyHash, info } = stored;
            // 检查是否启用
            if (!info.enabled) {
                return null;
            }
            // 检查是否过期
            if (info.expiresAt && info.expiresAt < new Date()) {
                return null;
            }
            // 验证哈希（使用 timing-safe 比较防止时序攻击）
            const secretHash = this.hashApiKey(secret);
            if (!timingSafeEqual(Buffer.from(apiKeyHash), Buffer.from(secretHash))) {
                return null;
            }
            // 返回完整的 info 对象
            return {
                keyId: info.keyId,
                userId: info.userId,
                username: info.username,
                roles: info.roles,
                permissions: info.permissions,
                createdAt: info.createdAt,
                expiresAt: info.expiresAt,
                enabled: info.enabled,
                rateLimit: info.rateLimit,
                note: info.note,
            };
        }
        catch {
            return null;
        }
    }
    /**
     * 删除 API Key
     */
    async deleteApiKey(keyId) {
        await this.store.delete(keyId);
    }
    /**
     * 列出用户的所有 API Key
     */
    async listUserApiKeys(userId) {
        return await this.store.listByUser(userId);
    }
    /**
     * 清理过期的 API Key
     */
    async cleanupExpired() {
        return await this.store.cleanupExpired();
    }
    /**
     * 生成 Key ID
     */
    generateKeyId() {
        return randomBytes(8).toString('base64url');
    }
    /**
     * 哈希 API Key
     */
    hashApiKey(apiKey) {
        return createHash('sha256').update(apiKey).digest('hex');
    }
}
