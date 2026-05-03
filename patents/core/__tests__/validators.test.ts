/**
 * validators.test.ts - 验证器模块测试
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import {
  validateOfficeAction,
  validateResponseDocument,
  validateScore,
  validateConfig,
} from '../validators.js'

describe('validators', () => {
  describe('validateOfficeAction', () => {
    it('应该接受有效的 OfficeAction', () => {
      const validOA = {
        oa_type: 'Novelty',
        affected_claims: [1, 2, 3],
        citations: [],
        examiner_arguments: '测试论点',
      }

      expect(() => validateOfficeAction(validOA)).not.toThrow()
    })

    it('应该拒绝空的 OfficeAction', () => {
      expect(() => validateOfficeAction(null as any)).toThrow('OfficeAction 不能为空')
      expect(() => validateOfficeAction(undefined as any)).toThrow('OfficeAction 不能为空')
    })

    it('应该拒绝缺少必要字段的 OfficeAction', () => {
      const invalidOA = {
        oa_type: 'Novelty',
        // 缺少 affected_claims
        citations: [],
        examiner_arguments: '',
      }

      expect(() => validateOfficeAction(invalidOA as any)).toThrow()
    })

    it('应该拒绝类型错误的 OfficeAction', () => {
      const invalidOA = {
        oa_type: 'Novelty',
        affected_claims: 'not an array' as any,
        citations: [],
        examiner_arguments: '',
      }

      expect(() => validateOfficeAction(invalidOA as any)).toThrow('affected_claims 必须是数组')
    })

    it('应该接受空数组的 citations', () => {
      const validOA = {
        oa_type: 'Novelty',
        affected_claims: [1],
        citations: [],
        examiner_arguments: '测试论点',
      }

      expect(() => validateOfficeAction(validOA)).not.toThrow()
    })

    it('应该接受空的 examiner_arguments', () => {
      const validOA = {
        oa_type: 'Novelty',
        affected_claims: [1],
        citations: [],
        examiner_arguments: '',
      }

      expect(() => validateOfficeAction(validOA)).not.toThrow()
    })
  })

  describe('validateResponseDocument', () => {
    it('应该接受有效的 ResponseDocument', () => {
      const validDoc = {
        writtenArgument: '测试意见陈述',
        amendedClaims: ['权利要求1', '权利要求2'],
        amendmentComparison: '修改对照',
        responseStrategy: 'Hybrid',
      }

      expect(() => validateResponseDocument(validDoc)).not.toThrow()
    })

    it('应该拒绝空的 ResponseDocument', () => {
      expect(() => validateResponseDocument(null as any)).toThrow('ResponseDocument 不能为空')
    })

    it('应该拒绝缺少必要字段的 ResponseDocument', () => {
      const invalidDoc = {
        writtenArgument: '测试',
        // 缺少 amendedClaims
        amendmentComparison: '',
        responseStrategy: 'Hybrid',
      }

      expect(() => validateResponseDocument(invalidDoc as any)).toThrow()
    })

    it('应该拒绝空数组 amendedClaims', () => {
      const invalidDoc = {
        writtenArgument: '测试',
        amendedClaims: [],
        amendmentComparison: '',
        responseStrategy: 'Hybrid',
      }

      expect(() => validateResponseDocument(invalidDoc as any)).toThrow('至少包含一条修改后的权利要求')
    })

    it('应该拒绝无效的 responseStrategy', () => {
      const invalidDoc = {
        writtenArgument: '测试',
        amendedClaims: ['权利要求1'],
        amendmentComparison: '',
        responseStrategy: 'InvalidStrategy' as any,
      }

      expect(() => validateResponseDocument(invalidDoc as any)).toThrow()
    })
  })

  describe('validateScore', () => {
    it('应该接受范围内的分数', () => {
      expect(validateScore(50, 0, 100, '测试分数')).toBe(50)
      expect(validateScore(0, 0, 100, '测试分数')).toBe(0)
      expect(validateScore(100, 0, 100, '测试分数')).toBe(100)
    })

    it('应该拒绝超出范围的分数', () => {
      expect(() => validateScore(-1, 0, 100, '测试分数')).toThrow('测试分数 必须在 0-100 之间')
      expect(() => validateScore(101, 0, 100, '测试分数')).toThrow('测试分数 必须在 0-100 之间')
    })

    it('应该拒绝非数字分数', () => {
      expect(() => validateScore('not a number' as any, 0, 100, '测试分数')).toThrow()
    })

    it('应该接受 NaN 并返回默认值', () => {
      expect(validateScore(NaN, 0, 100, '测试分数', true)).toBe(50)
    })
  })

  describe('validateConfig', () => {
    it('应该接受有效的配置', () => {
      const config = {
        strictness: 0.7,
        enableCache: true,
      }

      const schema = {
        strictness: { required: false, type: 'number', range: [0, 1] },
        enableCache: { required: false, type: 'boolean' },
      }

      expect(() => validateConfig(config, schema)).not.toThrow()
    })

    it('应该拒绝不符合类型的配置', () => {
      const config = {
        strictness: 'not a number' as any,
        enableCache: true,
      }

      const schema = {
        strictness: { required: false, type: 'number' },
        enableCache: { required: false, type: 'boolean' },
      }

      expect(() => validateConfig(config, schema)).toThrow()
    })

    it('应该拒绝超出范围的数值', () => {
      const config = {
        strictness: 1.5, // 超出 [0, 1] 范围
        enableCache: true,
      }

      const schema = {
        strictness: { required: false, type: 'number', range: [0, 1] },
        enableCache: { required: false, type: 'boolean' },
      }

      expect(() => validateConfig(config, schema)).toThrow()
    })

    it('应该拒绝缺少必填字段', () => {
      const config = {
        strictness: 0.7,
        // 缺少 required 字段
      }

      const schema = {
        strictness: { required: false, type: 'number' },
        enableCache: { required: true, type: 'boolean' },
      }

      expect(() => validateConfig(config, schema)).toThrow()
    })
  })

  describe('边界情况测试', () => {
    it('应该处理非常大的 OfficeAction', () => {
      const largeOA = {
        oa_type: 'Novelty',
        affected_claims: Array.from({ length: 10000 }, (_, i) => i + 1),
        citations: Array.from({ length: 1000 }, (_, i) => ({
          document_number: `CN${i}`,
          relevancy: 'high',
          claims_affected: [1],
        })),
        examiner_arguments: 'A'.repeat(100000),
      }

      expect(() => validateOfficeAction(largeOA)).not.toThrow()
    })

    it('应该处理非常长的 writtenArgument', () => {
      const longDoc = {
        writtenArgument: 'A'.repeat(100000),
        amendedClaims: ['权利要求1'],
        amendmentComparison: 'B'.repeat(100000),
        responseStrategy: 'Hybrid',
      }

      expect(() => validateResponseDocument(longDoc)).not.toThrow()
    })

    it('应该处理极端分数值', () => {
      expect(validateScore(Number.MIN_SAFE_INTEGER, 0, 100, '测试', true)).toBeGreaterThanOrEqual(0)
      expect(validateScore(Number.MAX_SAFE_INTEGER, 0, 100, '测试', true)).toBeLessThanOrEqual(100)
    })
  })
})
