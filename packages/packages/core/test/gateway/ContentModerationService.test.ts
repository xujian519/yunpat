/**
 * ContentModerationService 单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  RuleBasedModerationService,
  OpenAIModerationService,
  CombinedModerationService,
  type ModerationResult,
} from '../../src/gateway/ContentModerationService.js'

describe('RuleBasedModerationService', () => {
  let service: RuleBasedModerationService

  beforeEach(() => {
    service = new RuleBasedModerationService()
  })

  describe('基础审核', () => {
    it('应该通过安全内容', async () => {
      const result = await service.moderate('这是一段安全的文本内容')

      expect(result.isUnsafe).toBe(false)
      expect(result.score).toBe(0)
    })

    it('应该检测暴力内容', async () => {
      const result = await service.moderate('我要杀人')

      expect(result.isUnsafe).toBe(true)
      expect(result.score).toBeGreaterThan(0.5)
      expect(result.categories).toHaveProperty('暴力内容')
    })

    it('应该检测色情内容', async () => {
      const result = await service.moderate('这是色情内容')

      expect(result.isUnsafe).toBe(true)
      expect(result.categories).toHaveProperty('色情内容')
    })

    it('应该检测仇恨言论', async () => {
      const result = await service.moderate('这是歧视性的言论')

      expect(result.isUnsafe).toBe(true)
      expect(result.categories).toHaveProperty('仇恨言论')
    })

    it('应该检测自残内容', async () => {
      const result = await service.moderate('我想自杀')

      expect(result.isUnsafe).toBe(true)
      expect(result.categories).toHaveProperty('自残内容')
    })
  })

  describe('自定义规则', () => {
    it('应该添加自定义规则', async () => {
      const customService = new RuleBasedModerationService()
      customService.addRule('测试规则', [/forbidden/, /blocked/], 'medium')

      const result1 = await customService.moderate('这是 forbidden 内容')
      expect(result1.isUnsafe).toBe(true)
      expect(result1.categories).toHaveProperty('测试规则')

      const result2 = await customService.moderate('这是 blocked 内容')
      expect(result2.isUnsafe).toBe(true)
    })

    it('应该支持多个自定义规则', async () => {
      const customService = new RuleBasedModerationService()

      customService.addRule('规则1', [/pattern1/], 'low')
      customService.addRule('规则2', [/pattern2/], 'high')

      const result = await customService.moderate('pattern1 and pattern2')
      expect(result.isUnsafe).toBe(true)
      expect(result.categories).toHaveProperty('规则1')
      expect(result.categories).toHaveProperty('规则2')
    })
  })

  describe('评分系统', () => {
    it('应该根据严重程度计算分数', async () => {
      const customService = new RuleBasedModerationService()

      customService.addRule('高风险', [/danger/], 'high')
      customService.addRule('中风险', [/warning/], 'medium')
      customService.addRule('低风险', [/caution/], 'low')

      const highRisk = await customService.moderate('danger')
      expect(highRisk.score).toBe(0.9)

      const mediumRisk = await customService.moderate('warning')
      expect(mediumRisk.score).toBe(0.6)

      const lowRisk = await customService.moderate('caution')
      expect(lowRisk.score).toBe(0.3)
    })

    it('应该取最高分数', async () => {
      const customService = new RuleBasedModerationService()

      customService.addRule('高风险', [/danger/], 'high')
      customService.addRule('低风险', [/caution/], 'low')

      const result = await customService.moderate('danger and caution')
      expect(result.score).toBe(0.9) // 取最高分
    })
  })

  describe('原因说明', () => {
    it('应该提供触发原因', async () => {
      const result = await service.moderate('这是暴力和色情内容')

      expect(result.reason).toBeDefined()
      expect(result.reason).toContain('暴力内容')
      expect(result.reason).toContain('色情内容')
    })

    it('安全内容不应该有原因', async () => {
      const result = await service.moderate('安全内容')

      expect(result.reason).toBeUndefined()
    })
  })
})

describe('OpenAIModerationService', () => {
  describe('API 集成', () => {
    it('应该拒绝无效的 API Key', async () => {
      const service = new OpenAIModerationService('invalid-key')

      // 应该返回安全（失败时的默认行为）
      const result = await service.moderate('测试内容')

      expect(result.isUnsafe).toBe(false)
      expect(result.score).toBe(0)
    })

    it('应该处理网络错误', async () => {
      const service = new OpenAIModerationService('test-key', 'http://invalid-url')

      const result = await service.moderate('测试内容')

      expect(result.isUnsafe).toBe(false)
    })
  })

  describe('真实 API 调用（跳过，需要 API Key）', () => {
    it.skip('应该调用 OpenAI API', async () => {
      // 这个测试需要真实的 API Key
      // 在 CI 环境中跳过
      const apiKey = process.env.OPENAI_API_KEY

      if (!apiKey) {
        return
      }

      const service = new OpenAIModerationService(apiKey)

      const safeResult = await service.moderate('这是一段安全的文本')
      expect(safeResult.isUnsafe).toBe(false)
    })
  })
})

describe('CombinedModerationService', () => {
  let ruleBasedService: RuleBasedModerationService
  let combinedService: CombinedModerationService

  beforeEach(() => {
    ruleBasedService = new RuleBasedModerationService()

    // 添加自定义规则
    ruleBasedService.addRule('规则1', [/pattern1/], 'high')

    combinedService = new CombinedModerationService([ruleBasedService])
  })

  describe('组合审核', () => {
    it('应该组合多个审核服务的结果', async () => {
      const service1 = new RuleBasedModerationService()
      service1.addRule('服务1规则', [/pattern1/], 'high')

      const service2 = new RuleBasedModerationService()
      service2.addRule('服务2规则', [/pattern2/], 'medium')

      const combined = new CombinedModerationService([service1, service2])

      const result = await combined.moderate('pattern1 and pattern2')

      expect(result.isUnsafe).toBe(true)
      expect(result.categories).toHaveProperty('服务1规则')
      expect(result.categories).toHaveProperty('服务2规则')
    })

    it('应该取最高不安全分数', async () => {
      const service1 = new RuleBasedModerationService()
      service1.addRule('高风险', [/high/], 'high')

      const service2 = new RuleBasedModerationService()
      service2.addRule('低风险', [/low/], 'low')

      const combined = new CombinedModerationService([service1, service2])

      const result = await combined.moderate('high and low')

      expect(result.score).toBe(0.9) // 取最高分
    })

    it('应该合并所有原因', async () => {
      const service1 = new RuleBasedModerationService()
      service1.addRule('规则1', [/pattern1/], 'high')

      const service2 = new RuleBasedModerationService()
      service2.addRule('规则2', [/pattern2/], 'high')

      const combined = new CombinedModerationService([service1, service2])

      const result = await combined.moderate('pattern1 pattern2')

      expect(result.reason).toBeDefined()
      expect(result.reason).toContain('规则1')
      expect(result.reason).toContain('规则2')
    })
  })

  describe('边界情况', () => {
    it('应该处理空的服务列表', async () => {
      const emptyService = new CombinedModerationService([])

      const result = await emptyService.moderate('测试内容')

      expect(result.isUnsafe).toBe(false)
      expect(result.score).toBe(0)
    })

    it('应该处理所有服务都返回安全的情况', async () => {
      const safeService1 = new RuleBasedModerationService()
      const safeService2 = new RuleBasedModerationService()

      const combined = new CombinedModerationService([safeService1, safeService2])

      const result = await combined.moderate('安全内容')

      expect(result.isUnsafe).toBe(false)
      expect(result.score).toBe(0)
    })

    it('应该处理部分服务返回不安全的情况', async () => {
      const unsafeService = new RuleBasedModerationService()
      unsafeService.addRule('不安全', [/unsafe/], 'high')

      const safeService = new RuleBasedModerationService()

      const combined = new CombinedModerationService([unsafeService, safeService])

      const result = await combined.moderate('unsafe content')

      expect(result.isUnsafe).toBe(true)
    })
  })
})

describe('ModerationResult 接口', () => {
  it('应该包含所有必需字段', async () => {
    const service = new RuleBasedModerationService()
    const result: ModerationResult = await service.moderate('测试')

    expect(result).toHaveProperty('isUnsafe')
    expect(result).toHaveProperty('score')
    expect(result).toHaveProperty('categories')
    expect(result).toHaveProperty('reason')
  })

  it('categories 应该是对象类型', async () => {
    const service = new RuleBasedModerationService()
    const result = await service.moderate('测试')

    expect(typeof result.categories).toBe('object')
    expect(Array.isArray(result.categories)).toBe(false)
  })

  it('score 应该在 0-1 范围内', async () => {
    const service = new RuleBasedModerationService()
    const result = await service.moderate('测试')

    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(1)
  })
})
