/**
 * validators.test.ts - 验证器模块测试
 */

import { describe, it, expect, test } from '@jest/globals'
import {
  validateOfficeAction,
  validateResponseDocument,
  validateScore,
  validateConfig,
} from '../validators.js'

describe('validators - 基础验证', () => {
  test('validateOfficeAction - 应该接受有效的输入', () => {
    const validOA = {
      oa_type: 'Novelty',
      affected_claims: [1, 2, 3],
      citations: [],
      examiner_arguments: '测试论点',
    }

    expect(() => validateOfficeAction(validOA)).not.toThrow()
  })

  test('validateOfficeAction - 应该拒绝空输入', () => {
    expect(() => validateOfficeAction(null as any)).toThrow()
    expect(() => validateOfficeAction(undefined as any)).toThrow()
  })

  test('validateResponseDocument - 应该接受有效的输入', () => {
    const validDoc = {
      writtenArgument: '测试意见陈述',
      amendedClaims: ['权利要求1', '权利要求2'],
      amendmentComparison: '修改对照',
      responseStrategy: 'Hybrid',
    }

    expect(() => validateResponseDocument(validDoc)).not.toThrow()
  })

  test('validateResponseDocument - 应该拒绝空输入', () => {
    expect(() => validateResponseDocument(null as any)).toThrow()
  })

  test('validateScore - 应该接受范围内的分数', () => {
    expect(validateScore(50, 0, 100)).toBe(50)
    expect(validateScore(0, 0, 100)).toBe(0)
    expect(validateScore(100, 0, 100)).toBe(100)
  })

  test('validateScore - 应该拒绝超出范围的分数', () => {
    expect(() => validateScore(-1, 0, 100)).toThrow()
    expect(() => validateScore(101, 0, 100)).toThrow()
  })
})

describe('validators - 边界情况', () => {
  test('应该处理非常大的 OfficeAction', () => {
    const largeOA = {
      oa_type: 'Novelty',
      affected_claims: Array.from({ length: 10000 }, (_, i) => i + 1),
      citations: [],
      examiner_arguments: 'A'.repeat(100000),
    }

    expect(() => validateOfficeAction(largeOA)).not.toThrow()
  })

  test('应该处理非常长的 writtenArgument', () => {
    const longDoc = {
      writtenArgument: 'A'.repeat(100000),
      amendedClaims: ['权利要求1'],
      amendmentComparison: 'B'.repeat(100000),
      responseStrategy: 'Hybrid',
    }

    expect(() => validateResponseDocument(longDoc)).not.toThrow()
  })

  test('应该处理极端分数值', () => {
    expect(() => validateScore(Number.MIN_VALUE, 0, 100)).not.toThrow()
    expect(() => validateScore(Number.MAX_VALUE, 0, 100)).not.toThrow()
  })
})

describe('validators - 错误路径', () => {
  test('应该提供清晰的错误消息', () => {
    try {
      validateOfficeAction(null as any)
      fail('应该抛出错误')
    } catch (error: any) {
      expect(error.message).toContain('不能为空')
    }
  })

  test('应该处理类型错误', () => {
    const invalidOA = {
      oa_type: 'Novelty',
      affected_claims: 'not an array' as any,
      citations: [],
      examiner_arguments: '',
    }

    expect(() => validateOfficeAction(invalidOA as any)).toThrow('必须是数组')
  })

  test('应该处理空数组', () => {
    const invalidDoc = {
      writtenArgument: '测试',
      amendedClaims: [],
      amendmentComparison: '',
      responseStrategy: 'Hybrid',
    }

    expect(() => validateResponseDocument(invalidDoc as any)).toThrow()
  })
})

describe('validators - 性能测试', () => {
  test('验证性能 - 1000次验证应该在合理时间内完成', async () => {
    const start = Date.now()

    for (let i = 0; i < 1000; i++) {
      const oa = {
        oa_type: 'Novelty',
        affected_claims: [i],
        citations: [],
        examiner_arguments: '测试',
      }
      validateOfficeAction(oa)
    }

    const elapsed = Date.now() - start
    expect(elapsed).toBeLessThan(1000) // 应该在1秒内完成
  })

  test('批量验证性能 - 100个文档验证', async () => {
    const docs = Array.from({ length: 100 }, (_, i) => ({
      writtenArgument: `测试意见${i}`,
      amendedClaims: [`权利要求${i}`],
      amendmentComparison: '修改对照',
      responseStrategy: 'Hybrid',
    }))

    const start = Date.now()

    for (const doc of docs) {
      validateResponseDocument(doc)
    }

    const elapsed = Date.now() - start
    expect(elapsed).toBeLessThan(500) // 应该在500ms内完成
  })
})
