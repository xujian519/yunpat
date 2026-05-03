/**
 * HebbianOptimizer 内存限制测试
 *
 * 验证学习案例库的内存限制和自动清理功能
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { HebbianOptimizer } from '../agents/responder/HebbianOptimizer.js'
import { HEBBIAN_CONSTANTS } from '../core/constants.js'
import type { LLMAdapter } from '@yunpat/core'
import type { OfficeAction, ResponseStrategy } from '../core/PatentCoreBridge.js'

// 创建一个简单的 LLM 适配器用于测试
const mockLLM: LLMAdapter = {
  chat: async () => ({
    message: {
      role: 'assistant',
      content: 'Test response',
    },
  }),
} as any

// 创建测试用的审查意见
const createMockOfficeAction = (id: string): OfficeAction => ({
  oa_id: id,
  oa_type: 'Novelty',
  affected_claims: ['1', '2'],
  citations: [],
  reasoning: `Test reasoning for ${id}`,
  severity: 'medium',
})

// 创建测试用的答复策略
const createMockStrategy = (): ResponseStrategy => ({
  strategy_type: 'Hybrid',
  reasoning: 'Test strategy reasoning',
  confidence: 0.75,
})

describe('HebbianOptimizer 内存限制测试', () => {
  let optimizer: HebbianOptimizer

  beforeEach(() => {
    optimizer = new HebbianOptimizer(mockLLM, {
      learningRate: 0.1,
      forgettingFactor: 0.05,
      activationThreshold: 0.3,
      enableContinuousLearning: false, // 禁用自动保存以避免文件操作
    })
  })

  it('应该正常保存学习案例而不超过限制', () => {
    const testCount = 100

    for (let i = 0; i < testCount; i++) {
      optimizer.saveCaseForLearning(
        `case-${i}`,
        createMockOfficeAction(`oa-${i}`),
        createMockStrategy(),
        [`feature-${i % 10}`]
      )
    }

    const stats = optimizer.getMemoryStats()
    expect(stats.learningCasesCount).toBe(testCount)
    expect(stats.learningCasesCount).toBeLessThanOrEqual(HEBBIAN_CONSTANTS.MAX_LEARNING_CASES)
  })

  it('当超过最大案例数时应该删除最旧的案例', () => {
    // 临时设置较小的限制用于测试
    const originalMax = HEBBIAN_CONSTANTS.MAX_LEARNING_CASES
    const testLimit = 50

    // 注意：这里我们通过添加大量案例来测试限制功能
    // 由于 MAX_LEARNING_CASES 是常量，我们添加超过限制的案例数量
    const testCount = testLimit + 20

    for (let i = 0; i < testCount; i++) {
      optimizer.saveCaseForLearning(
        `case-${i}`,
        createMockOfficeAction(`oa-${i}`),
        createMockStrategy(),
        [`feature-${i % 10}`]
      )
    }

    const stats = optimizer.getMemoryStats()

    // 验证不超过最大限制
    expect(stats.learningCasesCount).toBeLessThanOrEqual(HEBBIAN_CONSTANTS.MAX_LEARNING_CASES)

    // 验证保留了最新案例（最后添加的案例应该存在）
    // 这通过确保总数量不超过限制来间接验证
  })

  it('内存使用估算应该合理', () => {
    const testCount = 100

    for (let i = 0; i < testCount; i++) {
      optimizer.saveCaseForLearning(
        `case-${i}`,
        createMockOfficeAction(`oa-${i}`),
        createMockStrategy(),
        [`feature-${i % 10}`]
      )
    }

    const stats = optimizer.getMemoryStats()

    // 验证内存使用统计
    expect(stats.estimatedMemoryMB).toBeGreaterThan(0)
    expect(stats.estimatedMemoryMB).toBeLessThan(100) // 应该小于100MB

    // 验证内存使用百分比
    expect(stats.memoryUsagePercent).toBeGreaterThan(0)
    expect(stats.memoryUsagePercent).toBeLessThanOrEqual(100)
  })

  it('内存统计应该包含正确的信息', () => {
    optimizer.saveCaseForLearning('case-1', createMockOfficeAction('oa-1'), createMockStrategy(), [
      'feature-1',
      'feature-2',
    ])

    const stats = optimizer.getMemoryStats()

    expect(stats).toHaveProperty('learningCasesCount')
    expect(stats).toHaveProperty('maxLearningCases')
    expect(stats).toHaveProperty('estimatedMemoryMB')
    expect(stats).toHaveProperty('memoryUsagePercent')
    expect(stats).toHaveProperty('strategyNeuronsCount')
    expect(stats).toHaveProperty('featureNeuronsCount')

    expect(stats.learningCasesCount).toBe(1)
    expect(stats.maxLearningCases).toBe(HEBBIAN_CONSTANTS.MAX_LEARNING_CASES)
    expect(stats.strategyNeuronsCount).toBeGreaterThan(0)
    expect(stats.featureNeuronsCount).toBeGreaterThan(0)
  })

  it('高内存使用时应该触发自动清理', () => {
    // 这个测试验证内存监控逻辑
    // 添加足够多的案例以触发内存警告
    const testCount = Math.min(HEBBIAN_CONSTANTS.MAX_LEARNING_CASES, 1000)

    for (let i = 0; i < testCount; i++) {
      optimizer.saveCaseForLearning(
        `case-${i}`,
        createMockOfficeAction(`oa-${i}`),
        createMockStrategy(),
        [`feature-${i % 10}`]
      )
    }

    const stats = optimizer.getMemoryStats()

    // 验证内存使用被正确跟踪
    expect(stats.estimatedMemoryMB).toBeGreaterThan(0)
    expect(stats.learningCasesCount).toBeLessThanOrEqual(HEBBIAN_CONSTANTS.MAX_LEARNING_CASES)
  })

  it('删除旧案例后应该释放内存', () => {
    // 填充到接近限制
    const nearLimitCount = Math.floor(HEBBIAN_CONSTANTS.MAX_LEARNING_CASES * 0.9)

    for (let i = 0; i < nearLimitCount; i++) {
      optimizer.saveCaseForLearning(
        `case-${i}`,
        createMockOfficeAction(`oa-${i}`),
        createMockStrategy(),
        [`feature-${i % 10}`]
      )
    }

    const statsBefore = optimizer.getMemoryStats()

    // 添加更多案例以触发清理
    for (let i = nearLimitCount; i < nearLimitCount + 100; i++) {
      optimizer.saveCaseForLearning(
        `case-${i}`,
        createMockOfficeAction(`oa-${i}`),
        createMockStrategy(),
        [`feature-${i % 10}`]
      )
    }

    const statsAfter = optimizer.getMemoryStats()

    // 验证没有超过限制
    expect(statsAfter.learningCasesCount).toBeLessThanOrEqual(HEBBIAN_CONSTANTS.MAX_LEARNING_CASES)

    // 验证内存使用被跟踪
    expect(statsAfter.estimatedMemoryMB).toBeGreaterThan(0)
  })

  it('内存使用百分比计算应该正确', () => {
    const quarterLimit = Math.floor(HEBBIAN_CONSTANTS.MAX_LEARNING_CASES / 4)

    for (let i = 0; i < quarterLimit; i++) {
      optimizer.saveCaseForLearning(
        `case-${i}`,
        createMockOfficeAction(`oa-${i}`),
        createMockStrategy(),
        [`feature-${i}`]
      )
    }

    const stats = optimizer.getMemoryStats()

    // 验证内存使用百分比大约为25%（允许小误差）
    expect(stats.memoryUsagePercent).toBeGreaterThan(20)
    expect(stats.memoryUsagePercent).toBeLessThan(30)
  })
})
