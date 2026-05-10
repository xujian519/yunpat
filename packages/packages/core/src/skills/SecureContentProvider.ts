/**
 * 安全内容提供者 — 提示词加密存储与运行时解密
 *
 * 用途：保护核心提示词资产，不随代码开源。
 * 加密：AES-256-GCM（Node.js 内置 node:crypto，零外部依赖）
 * 密钥派生：PBKDF2-SHA256（310000 次迭代，OWASP 2023 推荐）
 * 降级链：加密源 → 本地明文 → null（Agent 用 fallback）
 */

import { createDecipheriv, createCipheriv, pbkdf2Sync, randomBytes } from 'node:crypto'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { homedir } from 'node:os'
import { readFile } from 'node:fs/promises'

/** 加密文件的 JSON 格式 */
interface SealedFile {
  version: number
  algorithm: string
  kdf: string
  kdfIterations: number
  salt: string // base64
  iv: string // base64
  tag: string // base64
  data: string // base64
  originalPath: string
  sealedAt: string
}

/** 配置接口 */
export interface SecureContentProviderConfig {
  /** 加密文件目录，默认 ~/.yunpat/sealed-skills/ */
  sealedDir?: string
  /** 本地明文降级目录（开发模式） */
  fallbackDir?: string
  /** 密钥环境变量名，默认 YUNPAT_SKILLS_KEY */
  keyEnvVar?: string
  /** 密钥文件路径，默认 ~/.yunpat/.skills-key */
  keyFile?: string
}

/** 密钥状态 */
export type KeySource = 'env' | 'file' | 'none'

/**
 * 安全内容提供者
 *
 * 加载优先级：
 * 1. 加密源（~/.yunpat/sealed-skills/） → 解密返回
 * 2. 本地明文（项目 .yunpat/skills/） → 直接返回（开发模式）
 * 3. null → Agent 使用内置 fallback
 */
export class SecureContentProvider {
  private sealedDir: string
  private fallbackDir: string | undefined
  private keyEnvVar: string
  private keyFile: string
  private cache: Map<string, string> = new Map()

  constructor(config?: SecureContentProviderConfig) {
    this.sealedDir = config?.sealedDir || join(homedir(), '.yunpat', 'sealed-skills')
    this.fallbackDir = config?.fallbackDir
    this.keyEnvVar = config?.keyEnvVar || 'YUNPAT_SKILLS_KEY'
    this.keyFile = config?.keyFile || join(homedir(), '.yunpat', '.skills-key')
  }

  /**
   * 加载提示词内容
   *
   * @param skillPath 技能路径，如 'patent-drafting/claims-core'
   * @returns 明文内容，或 null（未找到）
   */
  async loadContent(skillPath: string): Promise<string | null> {
    // 检查缓存
    if (this.cache.has(skillPath)) {
      return this.cache.get(skillPath)!
    }

    // 1. 尝试从加密源加载
    const key = this.getKey()
    if (key) {
      const sealed = await this.loadFromSealed(skillPath, key)
      if (sealed !== null) {
        this.cache.set(skillPath, sealed)
        return sealed
      }
    }

    // 2. 降级到本地明文
    if (this.fallbackDir) {
      const plaintext = await this.loadFromFallback(skillPath)
      if (plaintext !== null) {
        return plaintext
      }
    }

    return null
  }

  /** 获取密钥状态 */
  getKeyStatus(): { hasKey: boolean; source: KeySource } {
    const key = this.getKey()
    if (!key) return { hasKey: false, source: 'none' }
    if (process.env[this.keyEnvVar]) return { hasKey: true, source: 'env' }
    return { hasKey: true, source: 'file' }
  }

  /** 清除缓存 */
  clearCache(): void {
    this.cache.clear()
  }

  /**
   * 从加密文件加载并解密
   */
  private async loadFromSealed(skillPath: string, masterKey: string): Promise<string | null> {
    const sealedPath = resolve(this.sealedDir, `${skillPath}.sealed`)
    if (!existsSync(sealedPath)) return null

    try {
      const raw = await readFile(sealedPath, 'utf-8')
      const sealed: SealedFile = JSON.parse(raw)

      if (sealed.version !== 1 || sealed.algorithm !== 'aes-256-gcm') {
        console.warn(
          `[SecureContentProvider] 不支持的加密格式: version=${sealed.version}, algo=${sealed.algorithm}`
        )
        return null
      }

      return this.decrypt(sealed, masterKey)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.warn(`[SecureContentProvider] 解密失败 (${skillPath}): ${msg}`)
      return null
    }
  }

  /**
   * 从本地明文降级目录加载
   */
  private async loadFromFallback(skillPath: string): Promise<string | null> {
    if (!this.fallbackDir) return null

    // 尝试 .md 扩展名
    const mdPath = resolve(this.fallbackDir, `${skillPath}.md`)
    if (existsSync(mdPath)) {
      try {
        return await readFile(mdPath, 'utf-8')
      } catch {
        return null
      }
    }

    return null
  }

  /**
   * 获取主密钥（环境变量优先，其次文件）
   */
  private getKey(): string | null {
    // 优先从环境变量
    const envKey = process.env[this.keyEnvVar]
    if (envKey && /^[0-9a-f]{64}$/i.test(envKey)) return envKey

    // 其次从密钥文件
    if (existsSync(this.keyFile)) {
      try {
        const fileKey = readFileSync(this.keyFile, 'utf-8').trim()
        if (/^[0-9a-f]{64}$/i.test(fileKey)) return fileKey
      } catch {
        // 忽略读取错误
      }
    }

    return null
  }

  /**
   * 解密 .sealed 文件
   */
  private decrypt(sealed: SealedFile, masterKey: string): string {
    const salt = Buffer.from(sealed.salt, 'base64')
    const iv = Buffer.from(sealed.iv, 'base64')
    const tag = Buffer.from(sealed.tag, 'base64')
    const data = Buffer.from(sealed.data, 'base64')

    // PBKDF2 派生密钥
    const derivedKey = pbkdf2Sync(
      Buffer.from(masterKey, 'hex'),
      salt,
      sealed.kdfIterations,
      32,
      'sha256'
    )

    // AES-256-GCM 解密
    const decipher = createDecipheriv('aes-256-gcm', derivedKey, iv)
    decipher.setAuthTag(tag)

    const decrypted = Buffer.concat([decipher.update(data), decipher.final()])

    return decrypted.toString('utf-8')
  }
}

// ========== 加密工具函数（供 seal-skills CLI 使用） ==========

export interface SealOptions {
  content: string
  originalPath: string
  masterKey: string
  kdfIterations?: number
}

/**
 * 加密内容，返回 .sealed JSON 对象
 */
export function sealContent(options: SealOptions): SealedFile {
  const { content, originalPath, masterKey, kdfIterations = 310000 } = options

  const salt = randomBytes(16)
  const iv = randomBytes(12)

  const derivedKey = pbkdf2Sync(Buffer.from(masterKey, 'hex'), salt, kdfIterations, 32, 'sha256')

  const cipher = createCipheriv('aes-256-gcm', derivedKey, iv)
  const encrypted = Buffer.concat([cipher.update(content, 'utf-8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return {
    version: 1,
    algorithm: 'aes-256-gcm',
    kdf: 'pbkdf2-sha256',
    kdfIterations,
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: encrypted.toString('base64'),
    originalPath,
    sealedAt: new Date().toISOString(),
  }
}
