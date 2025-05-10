/**
 * SecureContentProvider 单元测试
 *
 * 测试加密-解密往返、密钥错误、密钥缺失降级、缓存
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { SecureContentProvider, sealContent } from '../SecureContentProvider.js'
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomBytes } from 'node:crypto'

// 测试用临时目录
const TEST_DIR = join(tmpdir(), `yunpat-sealed-test-${Date.now()}`)
const SEALED_DIR = join(TEST_DIR, 'sealed')
const FALLBACK_DIR = join(TEST_DIR, 'fallback')

// 测试密钥
const TEST_KEY = randomBytes(32).toString('hex')
const WRONG_KEY = randomBytes(32).toString('hex')

beforeEach(() => {
  mkdirSync(SEALED_DIR, { recursive: true })
  mkdirSync(FALLBACK_DIR, { recursive: true })
})

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true })
})

describe('SecureContentProvider', () => {
  describe('加密-解密往返', () => {
    it('应正确解密已加密的内容', async () => {
      const content = '# 测试提示词\n\n这是一份核心提示词内容。'
      const skillPath = 'patent-drafting/claims-core'

      // 加密
      const sealed = sealContent({
        content,
        originalPath: skillPath,
        masterKey: TEST_KEY,
      })

      // 写入加密文件
      const sealedFileDir = join(SEALED_DIR, 'patent-drafting')
      mkdirSync(sealedFileDir, { recursive: true })
      writeFileSync(
        join(sealedFileDir, 'claims-core.sealed'),
        JSON.stringify(sealed)
      )

      // 解密
      const provider = new SecureContentProvider({
        sealedDir: SEALED_DIR,
        keyEnvVar: 'TEST_KEY_NONE',  // 不用环境变量
      })

      // 模拟密钥文件
      const keyFile = join(TEST_DIR, '.skills-key')
      writeFileSync(keyFile, TEST_KEY)

      const providerWithKey = new SecureContentProvider({
        sealedDir: SEALED_DIR,
        keyFile,
      })

      const result = await providerWithKey.loadContent(skillPath)
      expect(result).toBe(content)
    })

    it('应处理中文和多行内容', async () => {
      const content = `## 核心规则

1. 清楚性原则：用词清楚，类型明确
2. 简要性原则：简明扼要
3. 必要技术特征 = 解决技术问题不可缺少的特征

| 特征 | 是否必要 |
|------|---------|
| 杆状本体 | 必要 |`

      const sealed = sealContent({
        content,
        originalPath: 'test/multiline',
        masterKey: TEST_KEY,
      })

      const testDir = join(SEALED_DIR, 'test')
      mkdirSync(testDir, { recursive: true })
      writeFileSync(join(testDir, 'multiline.sealed'), JSON.stringify(sealed))

      const keyFile = join(TEST_DIR, '.skills-key')
      writeFileSync(keyFile, TEST_KEY)

      const provider = new SecureContentProvider({
        sealedDir: SEALED_DIR,
        keyFile,
      })

      const result = await provider.loadContent('test/multiline')
      expect(result).toBe(content)
    })
  })

  describe('密钥错误', () => {
    it('解密应返回 null（不抛异常）', async () => {
      const content = 'secret content'
      const sealed = sealContent({
        content,
        originalPath: 'test/secret',
        masterKey: TEST_KEY,
      })

      const testDir = join(SEALED_DIR, 'test')
      mkdirSync(testDir, { recursive: true })
      writeFileSync(join(testDir, 'secret.sealed'), JSON.stringify(sealed))

      const keyFile = join(TEST_DIR, '.wrong-key')
      writeFileSync(keyFile, WRONG_KEY)

      const provider = new SecureContentProvider({
        sealedDir: SEALED_DIR,
        keyFile,
      })

      const result = await provider.loadContent('test/secret')
      expect(result).toBeNull()
    })
  })

  describe('密钥缺失降级', () => {
    it('无密钥时应降级到本地明文', async () => {
      // 写入明文 fallback
      const fallbackDir = join(FALLBACK_DIR, 'patent-drafting')
      mkdirSync(fallbackDir, { recursive: true })
      writeFileSync(join(fallbackDir, 'claims-core.md'), 'fallback content')

      const provider = new SecureContentProvider({
        sealedDir: SEALED_DIR,
        fallbackDir: FALLBACK_DIR,
        keyFile: join(TEST_DIR, 'nonexistent-key'),
      })

      const result = await provider.loadContent('patent-drafting/claims-core')
      expect(result).toBe('fallback content')
    })

    it('无密钥且无明文时应返回 null', async () => {
      const provider = new SecureContentProvider({
        sealedDir: SEALED_DIR,
        fallbackDir: FALLBACK_DIR,
        keyFile: join(TEST_DIR, 'nonexistent-key'),
      })

      const result = await provider.loadContent('nonexistent/skill')
      expect(result).toBeNull()
    })
  })

  describe('缓存', () => {
    it('第二次加载应命中缓存', async () => {
      const content = 'cached content'
      const sealed = sealContent({
        content,
        originalPath: 'test/cached',
        masterKey: TEST_KEY,
      })

      const testDir = join(SEALED_DIR, 'test')
      mkdirSync(testDir, { recursive: true })
      writeFileSync(join(testDir, 'cached.sealed'), JSON.stringify(sealed))

      const keyFile = join(TEST_DIR, '.skills-key')
      writeFileSync(keyFile, TEST_KEY)

      const provider = new SecureContentProvider({
        sealedDir: SEALED_DIR,
        keyFile,
      })

      const result1 = await provider.loadContent('test/cached')
      expect(result1).toBe(content)

      // 删除加密文件，缓存应仍能返回
      rmSync(join(testDir, 'cached.sealed'))

      const result2 = await provider.loadContent('test/cached')
      expect(result2).toBe(content)

      // 清除缓存后应返回 null
      provider.clearCache()
      const result3 = await provider.loadContent('test/cached')
      expect(result3).toBeNull()
    })
  })

  describe('getKeyStatus', () => {
    it('无密钥时返回 none', () => {
      const provider = new SecureContentProvider({
        keyFile: join(TEST_DIR, 'nonexistent'),
        keyEnvVar: 'NONEXISTENT_ENV_VAR_12345',
      })
      expect(provider.getKeyStatus()).toEqual({ hasKey: false, source: 'none' })
    })

    it('有密钥文件时返回 file', () => {
      const keyFile = join(TEST_DIR, '.skills-key')
      writeFileSync(keyFile, TEST_KEY)

      const provider = new SecureContentProvider({
        keyFile,
        keyEnvVar: 'NONEXISTENT_ENV_VAR_12345',
      })
      expect(provider.getKeyStatus()).toEqual({ hasKey: true, source: 'file' })
    })
  })
})
