/**
 * ConfigManager 测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as os from 'os'
import * as path from 'path'
import * as fs from 'fs'
import {
  ConfigManager,
  getConfigManager,
  resetConfigManager,
} from '../../src/config/ConfigManager.js'

const tmpDir = os.tmpdir()

describe('ConfigManager', () => {
  beforeEach(() => {
    resetConfigManager()
  })

  afterEach(() => {
    resetConfigManager()
  })

  describe('单例管理', () => {
    it('getConfigManager 应返回单例实例', () => {
      const a = getConfigManager()
      const b = getConfigManager()
      expect(a).toBe(b)
    })

    it('resetConfigManager 应重置单例', () => {
      const first = getConfigManager()
      resetConfigManager()
      const second = getConfigManager()
      expect(first).not.toBe(second)
    })
  })

  describe('构造函数', () => {
    it('应使用默认配置路径', () => {
      const mgr = new ConfigManager()
      expect(mgr.getConfigPath()).toContain('.yunpat')
    })

    it('应使用自定义配置路径', () => {
      const mgr = new ConfigManager({ configPath: path.join(tmpDir, 'test-config.yaml') })
      expect(mgr.getConfigPath()).toBe(path.join(tmpDir, 'test-config.yaml'))
    })

    it('应检测默认环境为 development', () => {
      const originalEnv = process.env.NODE_ENV
      delete process.env.NODE_ENV
      delete process.env.ENV

      const mgr = new ConfigManager()
      expect(mgr.getEnvironment()).toBe('development')

      if (originalEnv) process.env.NODE_ENV = originalEnv
    })

    it('应检测 test 环境', () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'test'

      const mgr = new ConfigManager()
      expect(mgr.getEnvironment()).toBe('test')

      process.env.NODE_ENV = originalEnv
    })

    it('应检测 production 环境', () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'

      const mgr = new ConfigManager()
      expect(mgr.getEnvironment()).toBe('production')

      process.env.NODE_ENV = originalEnv
    })
  })

  describe('load（无配置文件）', () => {
    it('应返回默认配置', () => {
      const mgr = new ConfigManager({
        configPath: path.join(tmpDir, 'nonexistent-config.yaml'),
        environment: 'development',
      })
      const config = mgr.load()

      expect(config.environment).toBe('development')
      expect(config.llm).toBeDefined()
      expect(config.llm.primary.provider).toBe('deepseek')
      expect(config.memory?.type).toBe('memory')
      expect(config.reasoning?.strategy).toBe('react')
    })

    it('应缓存已加载的配置', () => {
      const mgr = new ConfigManager({ configPath: path.join(tmpDir, 'nonexistent-config.yaml') })
      const first = mgr.load()
      const second = mgr.load()
      expect(first).toBe(second)
    })
  })

  describe('reload', () => {
    it('应重新加载配置', () => {
      const mgr = new ConfigManager({ configPath: path.join(tmpDir, 'nonexistent-config.yaml') })
      const first = mgr.load()
      const reloaded = mgr.reload()
      expect(first).not.toBe(reloaded)
    })
  })

  describe('get', () => {
    it('应通过点号路径获取配置值', () => {
      const mgr = new ConfigManager({ configPath: path.join(tmpDir, 'nonexistent-config.yaml') })
      expect(mgr.get('llm.primary.provider')).toBe('deepseek')
    })

    it('不存在的路径应返回 undefined', () => {
      const mgr = new ConfigManager({ configPath: path.join(tmpDir, 'nonexistent-config.yaml') })
      expect(mgr.get('nonexistent.path')).toBeUndefined()
    })
  })

  describe('set', () => {
    it('应设置配置值', () => {
      const mgr = new ConfigManager({ configPath: path.join(tmpDir, 'nonexistent-config.yaml') })
      mgr.load()
      mgr.set('logLevel', 'debug')

      expect(mgr.get('logLevel')).toBe('debug')
    })

    it('应支持嵌套路径设置', () => {
      const mgr = new ConfigManager({ configPath: path.join(tmpDir, 'nonexistent-config.yaml') })
      mgr.load()
      mgr.set('memory.checkpointInterval', 20)

      expect(mgr.get('memory.checkpointInterval')).toBe(20)
    })
  })

  describe('getLLMConfig', () => {
    it('应返回 LLM 配置', () => {
      const mgr = new ConfigManager({ configPath: path.join(tmpDir, 'nonexistent-config.yaml') })
      const llmConfig = mgr.getLLMConfig()

      expect(llmConfig.primary).toBeDefined()
      expect(llmConfig.primary.model).toBe('deepseek-chat')
    })
  })

  describe('getPrimaryLLMConfig', () => {
    it('应返回主 LLM 配置', () => {
      const mgr = new ConfigManager({ configPath: path.join(tmpDir, 'nonexistent-config.yaml') })
      const primary = mgr.getPrimaryLLMConfig()

      expect(primary.provider).toBe('deepseek')
      expect(primary.temperature).toBe(0.7)
    })
  })

  describe('getFallbackLLMConfig', () => {
    it('应返回备用 LLM 配置（或 undefined）', () => {
      const mgr = new ConfigManager({ configPath: path.join(tmpDir, 'nonexistent-config.yaml') })
      const fallback = mgr.getFallbackLLMConfig()
      expect(fallback).toBeUndefined()
    })
  })

  describe('load（有配置文件）', () => {
    it('应加载带环境变量的配置', () => {
      process.env.TEST_API_KEY = 'test-key-123'
      const mgr = new ConfigManager({
        configPath: path.join(tmpDir, 'test-config-with-env.yaml'),
        environment: 'test',
      })
      const config = mgr.load()
      expect(config.environment).toBe('test')
      delete process.env.TEST_API_KEY
    })

    it('应在配置无效时抛出错误', () => {
      const testPath = path.join(tmpDir, 'test-invalid-config.yaml')
      fs.writeFileSync(testPath, 'invalid: yaml: : :')

      const mgr = new ConfigManager({ configPath: testPath })
      expect(() => mgr.load()).toThrow()

      fs.unlinkSync(testPath)
    })

    it('应加载旧格式配置', () => {
      const testPath = path.join(tmpDir, 'test-old-format.yaml')
      fs.writeFileSync(
        testPath,
        `
llm:
  primary:
    provider: deepseek
    apiKey: test-key
    model: deepseek-chat
      `
      )

      const mgr = new ConfigManager({ configPath: testPath })
      const config = mgr.load()
      expect(config.llm.primary.provider).toBe('deepseek')
      fs.unlinkSync(testPath)
    })

    it('应加载新格式配置', () => {
      const testPath = path.join(tmpDir, 'test-new-format.yaml')
      fs.writeFileSync(
        testPath,
        `
default:
  llm:
    primary:
      provider: deepseek
      apiKey: test-key
      model: deepseek-chat
test:
  logLevel: debug
      `
      )

      const mgr = new ConfigManager({ configPath: testPath, environment: 'test' })
      const config = mgr.load()
      expect(config.logLevel).toBe('debug')
      fs.unlinkSync(testPath)
    })

    it('应处理缺少 default 的配置', () => {
      const testPath = path.join(tmpDir, 'test-no-default.yaml')
      fs.writeFileSync(testPath, 'invalid: true')

      const mgr = new ConfigManager({ configPath: testPath })
      expect(() => mgr.load()).toThrow()
      fs.unlinkSync(testPath)
    })

    it('应处理缺少 llm 的配置', () => {
      const testPath = path.join(tmpDir, 'test-no-llm.yaml')
      fs.writeFileSync(testPath, 'default: {}')

      const mgr = new ConfigManager({ configPath: testPath })
      expect(() => mgr.load()).toThrow('配置文件必须包含 llm 配置')
      fs.unlinkSync(testPath)
    })

    it('应处理缺少 primary 的 llm 配置', () => {
      const testPath = path.join(tmpDir, 'test-no-primary.yaml')
      fs.writeFileSync(
        testPath,
        `
default:
  llm:
    fallback:
      provider: openai
      `
      )

      const mgr = new ConfigManager({ configPath: testPath })
      expect(() => mgr.load()).toThrow('LLM 配置必须包含 primary 字段')
      fs.unlinkSync(testPath)
    })

    it('应替换环境变量', () => {
      process.env.TEST_VAR = 'test-value'
      const testPath = path.join(tmpDir, 'test-env-var.yaml')
      fs.writeFileSync(
        testPath,
        `
default:
  llm:
    primary:
      provider: deepseek
      apiKey: \${TEST_VAR}
      model: deepseek-chat
      `
      )

      const mgr = new ConfigManager({ configPath: testPath })
      const config = mgr.load()
      expect(config.llm.primary.apiKey).toBe('test-value')
      delete process.env.TEST_VAR
      fs.unlinkSync(testPath)
    })

    it('应替换带默认值的环境变量', () => {
      const testPath = path.join(tmpDir, 'test-env-default.yaml')
      fs.writeFileSync(
        testPath,
        `
default:
  llm:
    primary:
      provider: deepseek
      apiKey: \${NONEXISTENT_VAR:default-key}
      model: deepseek-chat
      `
      )

      const mgr = new ConfigManager({ configPath: testPath })
      const config = mgr.load()
      expect(config.llm.primary.apiKey).toBe('default-key')
      fs.unlinkSync(testPath)
    })

    it('应处理 disableEnvVar', () => {
      process.env.TEST_VAR2 = 'test-value'
      const testPath = path.join(tmpDir, 'test-no-env.yaml')
      fs.writeFileSync(
        testPath,
        `
default:
  llm:
    primary:
      provider: deepseek
      apiKey: \${TEST_VAR2}
      model: deepseek-chat
      `
      )

      const mgr = new ConfigManager({ configPath: testPath, enableEnvVar: false })
      const config = mgr.load()
      expect(config.llm.primary.apiKey).toBe('${TEST_VAR2}')
      delete process.env.TEST_VAR2
      fs.unlinkSync(testPath)
    })
  })

  describe('createExampleConfig', () => {
    it('应创建示例配置文件', () => {
      const testPath = path.join(tmpDir, 'test-example-config.yaml')
      ConfigManager.createExampleConfig(testPath)
      expect(fs.existsSync(testPath)).toBe(true)
      fs.unlinkSync(testPath)
    })

    it('应使用默认路径创建示例配置', () => {
      const testDir = path.join(tmpDir, '.yunpat')
      const testPath = path.join(testDir, 'config.yaml')
      try {
        fs.unlinkSync(testPath)
      } catch {}
      try {
        fs.rmdirSync(testDir)
      } catch {}

      ConfigManager.createExampleConfig(testPath)
      expect(fs.existsSync(testPath)).toBe(true)
      fs.unlinkSync(testPath)
      fs.rmdirSync(testDir)
    })
  })

  describe('set', () => {
    it('应设置嵌套配置值', () => {
      const mgr = new ConfigManager({ configPath: path.join(tmpDir, 'nonexistent-config.yaml') })
      mgr.load()
      mgr.set('custom.nested.value', 'test')
      expect(mgr.get('custom.nested.value')).toBe('test')
    })

    it('应创建中间对象', () => {
      const mgr = new ConfigManager({ configPath: path.join(tmpDir, 'nonexistent-config.yaml') })
      mgr.load()
      mgr.set('a.b.c.d', 'deep')
      expect(mgr.get('a.b.c.d')).toBe('deep')
    })
  })

  describe('get', () => {
    it('应返回 undefined（不存在路径）', () => {
      const mgr = new ConfigManager({ configPath: path.join(tmpDir, 'nonexistent-config.yaml') })
      expect(mgr.get('nonexistent.path.deep')).toBeUndefined()
    })

    it('应在非对象值上返回 undefined', () => {
      const mgr = new ConfigManager({ configPath: path.join(tmpDir, 'nonexistent-config.yaml') })
      mgr.load()
      mgr.set('stringValue', 'test')
      expect(mgr.get('stringValue.subpath')).toBeUndefined()
    })
  })

  describe('reload', () => {
    it('应重新加载配置', () => {
      const mgr = new ConfigManager({ configPath: path.join(tmpDir, 'nonexistent-config.yaml') })
      const first = mgr.load()
      mgr.set('custom', 'value')
      const reloaded = mgr.reload()
      expect(reloaded).not.toBe(first)
      expect(mgr.get('custom')).toBeUndefined()
    })
  })
})
