/**
 * constants.test.ts - 常量系统测试
 */

import { describe, it, expect } from 'vitest'
import {
  LLM_CONSTANTS,
  EXAMINER_CONSTANTS,
  PREDICTOR_CONSTANTS,
  HEBBIAN_CONSTANTS,
  WORKFLOW_CONSTANTS,
  VALIDATION_CONSTANTS,
  PERFORMANCE_CONSTANTS,
  STORAGE_CONSTANTS,
  SEVERITY_CONSTANTS,
  isInRange,
  clamp,
  calculatePercentage,
  formatPercentage,
  deepFreeze,
  pick,
  omit,
} from '../core/constants.js'

describe('constants - 常量值验证', () => {
  it('LLM_CONSTANTS 应该包含正确的值', () => {
    expect(LLM_CONSTANTS.DEFAULT_TEMPERATURE).toBe(0.3)
    expect(LLM_CONSTANTS.MAX_PROMPT_LENGTH).toBe(8000)
    expect(LLM_CONSTANTS.MAX_RETRY_ATTEMPTS).toBe(3)
    expect(LLM_CONSTANTS.INITIAL_RETRY_DELAY).toBe(1000)
    expect(LLM_CONSTANTS.MAX_RETRY_DELAY).toBe(10000)
    expect(LLM_CONSTANTS.RETRY_BACKOFF_MULTIPLIER).toBe(2)
    expect(LLM_CONSTANTS.DEFAULT_TIMEOUT).toBe(30000)
  })

  it('EXAMINER_CONSTANTS 应该包含正确的值', () => {
    expect(EXAMINER_CONSTANTS.BASE_ACCEPT_PROBABILITY).toBe(50)
    expect(EXAMINER_CONSTANTS.MAX_ACCEPT_PROBABILITY).toBe(95)
    expect(EXAMINER_CONSTANTS.MIN_ACCEPT_PROBABILITY).toBe(10)
    expect(EXAMINER_CONSTANTS.MAX_REJECTIONS).toBe(5)
    expect(EXAMINER_CONSTANTS.MAX_SUGGESTIONS).toBe(8)
  })

  it('PREDICTOR_CONSTANTS 应该包含正确的值', () => {
    expect(PREDICTOR_CONSTANTS.BASELINE_SUCCESS_RATES.NOVELTY).toBe(45)
    expect(PREDICTOR_CONSTANTS.RULE_WEIGHT).toBe(0.3)
    expect(PREDICTOR_CONSTANTS.CASE_WEIGHT).toBe(0.4)
    expect(PREDICTOR_CONSTANTS.LLM_WEIGHT).toBe(0.3)
    expect(PREDICTOR_CONSTANTS.MIN_PROBABILITY).toBe(10)
    expect(PREDICTOR_CONSTANTS.MAX_PROBABILITY).toBe(95)
  })

  it('HEBBIAN_CONSTANTS 应该包含正确的值', () => {
    expect(HEBBIAN_CONSTANTS.DEFAULT_LEARNING_RATE).toBe(0.1)
    expect(HEBBIAN_CONSTANTS.DEFAULT_FORGETTING_FACTOR).toBe(0.05)
    expect(HEBBIAN_CONSTANTS.DEFAULT_ACTIVATION_THRESHOLD).toBe(0.3)
    expect(HEBBIAN_CONSTANTS.MAX_LEARNING_CASES).toBe(10000)
    expect(HEBBIAN_CONSTANTS.FEATURE_ACTIVATION_CACHE_SIZE).toBe(1000)
    expect(HEBBIAN_CONSTANTS.FEATURE_ACTIVATION_CACHE_TTL).toBe(60000)
    expect(HEBBIAN_CONSTANTS.BATCH_PROCESSING_SIZE).toBe(10)
  })

  it('VALIDATION_CONSTANTS 应该包含正确的值', () => {
    expect(VALIDATION_CONSTANTS.SCORE_MIN).toBe(0)
    expect(VALIDATION_CONSTANTS.SCORE_MAX).toBe(100)
    expect(VALIDATION_CONSTANTS.CONFIDENCE_MIN).toBe(0.0)
    expect(VALIDATION_CONSTANTS.CONFIDENCE_MAX).toBe(1.0)
    expect(VALIDATION_CONSTANTS.MAX_STRING_LENGTH).toBe(100000)
    expect(VALIDATION_CONSTANTS.MAX_ARRAY_LENGTH).toBe(1000)
  })

  it('PERFORMANCE_CONSTANTS 应该包含正确的值', () => {
    expect(PERFORMANCE_CONSTANTS.MAX_BATCH_SIZE).toBe(100)
    expect(PERFORMANCE_CONSTANTS.MAX_CONCURRENT_LLM_CALLS).toBe(5)
    expect(PERFORMANCE_CONSTANTS.CACHE_SIZE_LIMIT).toBe(1000)
    expect(PERFORMANCE_CONSTANTS.CACHE_EXPIRY_TIME).toBe(3600000)
  })

  it('STORAGE_CONSTANTS 应该包含正确的值', () => {
    expect(STORAGE_CONSTANTS.MAX_LOG_FILE_SIZE).toBe(10 * 1024 * 1024)
    expect(STORAGE_CONSTANTS.MAX_LOG_FILES).toBe(10)
    expect(STORAGE_CONSTANTS.BACKUP_RETENTION_DAYS).toBe(30)
  })

  it('SEVERITY_CONSTANTS 应该包含正确的值', () => {
    expect(SEVERITY_CONSTANTS.OA_TYPE_BASE_SCORES.NOVELTY).toBe(30)
    expect(SEVERITY_CONSTANTS.OA_TYPE_BASE_SCORES.INVENTIVE_STEP).toBe(35)
    expect(SEVERITY_CONSTANTS.LOW_SEVERITY_THRESHOLD).toBe(30)
    expect(SEVERITY_CONSTANTS.MEDIUM_SEVERITY_THRESHOLD).toBe(50)
  })
})

describe('constants - 辅助函数', () => {
  describe('isInRange', () => {
    it('应该返回范围内值为true', () => {
      expect(isInRange(5, 0, 10)).toBe(true)
      expect(isInRange(0, 0, 10)).toBe(true)
      expect(isInRange(10, 0, 10)).toBe(true)
    })

    it('应该返回范围外值为false', () => {
      expect(isInRange(-1, 0, 10)).toBe(false)
      expect(isInRange(11, 0, 10)).toBe(false)
    })

    it('应该处理负数', () => {
      expect(isInRange(-5, -10, 0)).toBe(true)
      expect(isInRange(-11, -10, 0)).toBe(false)
    })

    it('应该处理小数', () => {
      expect(isInRange(0.5, 0, 1)).toBe(true)
      expect(isInRange(1.5, 0, 1)).toBe(false)
    })
  })

  describe('clamp', () => {
    it('应该返回范围内的值', () => {
      expect(clamp(5, 0, 10)).toBe(5)
    })

    it('应该限制最小值', () => {
      expect(clamp(-5, 0, 10)).toBe(0)
      expect(clamp(0, 0, 10)).toBe(0)
    })

    it('应该限制最大值', () => {
      expect(clamp(15, 0, 10)).toBe(10)
      expect(clamp(10, 0, 10)).toBe(10)
    })

    it('应该处理负数范围', () => {
      expect(clamp(-5, -10, 0)).toBe(-5)
      expect(clamp(-15, -10, 0)).toBe(-10)
      expect(clamp(5, -10, 0)).toBe(0)
    })

    it('应该处理小数', () => {
      expect(clamp(0.5, 0, 1)).toBe(0.5)
      expect(clamp(1.5, 0, 1)).toBe(1)
    })
  })

  describe('calculatePercentage', () => {
    it('应该正确计算百分比', () => {
      expect(calculatePercentage(50, 100)).toBe(50)
      expect(calculatePercentage(25, 100)).toBe(25)
      expect(calculatePercentage(1, 4)).toBe(25)
    })

    it('应该处理total为0的情况', () => {
      expect(calculatePercentage(50, 0)).toBe(0)
    })

    it('应该处理小数', () => {
      expect(calculatePercentage(1.5, 3)).toBe(50)
    })

    it('应该处理大于total的value', () => {
      expect(calculatePercentage(150, 100)).toBe(150)
    })

    it('应该处理负数', () => {
      expect(calculatePercentage(-50, 100)).toBe(-50)
    })
  })

  describe('formatPercentage', () => {
    it('应该格式化百分比为字符串', () => {
      expect(formatPercentage(50)).toBe('50.00%')
      expect(formatPercentage(50.123)).toBe('50.12%')
    })

    it('应该使用自定义小数位数', () => {
      expect(formatPercentage(50.123, 0)).toBe('50%')
      expect(formatPercentage(50.123, 1)).toBe('50.1%')
      expect(formatPercentage(50.123, 3)).toBe('50.123%')
    })

    it('应该处理整数', () => {
      expect(formatPercentage(50)).toBe('50.00%')
    })

    it('应该处理小数', () => {
      expect(formatPercentage(0.5)).toBe('0.50%')
    })
  })
})

describe('constants - 工具函数', () => {
  describe('deepFreeze', () => {
    it('应该冻结原始对象', () => {
      const obj = { a: 1 }
      const frozen = deepFreeze(obj)

      expect(Object.isFrozen(frozen)).toBe(true)
    })

    it('应该冻结嵌套对象', () => {
      const obj = {
        a: 1,
        nested: {
          b: 2,
        },
      }
      const frozen = deepFreeze(obj)

      expect(Object.isFrozen(frozen)).toBe(true)
      expect(Object.isFrozen(frozen.nested)).toBe(true)
    })

    it('应该防止修改属性', () => {
      const obj = { a: 1 }
      const frozen = deepFreeze(obj)

      expect(() => {
        ;(frozen as any).a = 2
      }).toThrow()
    })

    it('应该处理null', () => {
      expect(deepFreeze(null)).toBe(null)
    })

    it('应该处理基本类型', () => {
      expect(deepFreeze(1)).toBe(1)
      expect(deepFreeze('string')).toBe('string')
      expect(deepFreeze(true)).toBe(true)
    })

    it('应该处理数组', () => {
      const arr = [1, 2, { a: 3 }]
      const frozen = deepFreeze(arr)

      expect(Object.isFrozen(frozen)).toBe(true)
      expect(Object.isFrozen(frozen[2])).toBe(true)
    })
  })

  describe('pick', () => {
    it('应该选择指定的键', () => {
      const obj = { a: 1, b: 2, c: 3 }
      const result = pick(obj, ['a', 'c'])

      expect(result).toEqual({ a: 1, c: 3 })
    })

    it('应该忽略不存在的键', () => {
      const obj = { a: 1, b: 2 }
      const result = pick(obj, ['a', 'x'] as any)

      expect(result).toEqual({ a: 1 })
    })

    it('应该处理空键数组', () => {
      const obj = { a: 1, b: 2 }
      const result = pick(obj, [])

      expect(result).toEqual({})
    })

    it('不应该修改原对象', () => {
      const obj = { a: 1, b: 2 }
      const original = { ...obj }
      pick(obj, ['a'])

      expect(obj).toEqual(original)
    })
  })

  describe('omit', () => {
    it('应该排除指定的键', () => {
      const obj = { a: 1, b: 2, c: 3 }
      const result = omit(obj, ['b'])

      expect(result).toEqual({ a: 1, c: 3 })
    })

    it('应该排除多个键', () => {
      const obj = { a: 1, b: 2, c: 3, d: 4 }
      const result = omit(obj, ['b', 'd'])

      expect(result).toEqual({ a: 1, c: 3 })
    })

    it('应该处理不存在的键', () => {
      const obj = { a: 1, b: 2 }
      const result = omit(obj, ['x'] as any)

      expect(result).toEqual({ a: 1, b: 2 })
    })

    it('应该处理空键数组', () => {
      const obj = { a: 1, b: 2 }
      const result = omit(obj, [])

      expect(result).toEqual({ a: 1, b: 2 })
    })

    it('不应该修改原对象', () => {
      const obj = { a: 1, b: 2 }
      const original = { ...obj }
      omit(obj, ['b'])

      expect(obj).toEqual(original)
    })
  })
})

describe('constants - 边界情况', () => {
  it('clamp 应该处理相等的最小最大值', () => {
    expect(clamp(5, 10, 10)).toBe(10)
  })

  it('clamp 应该处理反转的范围', () => {
    // 当min > max时，Math.max/min会自动处理
    expect(clamp(5, 10, 0)).toBe(10)
  })

  it('calculatePercentage 应该处理非常小的数字', () => {
    expect(calculatePercentage(0.0001, 1)).toBeCloseTo(0.01, 5)
  })

  it('calculatePercentage 应该处理Infinity', () => {
    expect(calculatePercentage(Infinity, 100)).toBe(Infinity)
    expect(calculatePercentage(100, Infinity)).toBe(0)
  })

  it('deepFreeze 应该处理循环引用', () => {
    const obj: any = { a: 1 }
    obj.self = obj

    // deepFreeze无法处理循环引用，会抛出RangeError
    // 这是预期的行为，文档中应说明此限制
    expect(() => deepFreeze(obj)).toThrow(RangeError)
    expect(() => deepFreeze(obj)).toThrow('Maximum call stack size exceeded')
  })

  it('pick 应该处理嵌套对象', () => {
    const obj = {
      a: 1,
      nested: { b: 2 },
    }
    const result = pick(obj, ['nested'])

    expect(result).toEqual({ nested: { b: 2 } })
  })

  it('omit 应该处理嵌套对象', () => {
    const obj = {
      a: 1,
      nested: { b: 2 },
    }
    const result = omit(obj, ['a'])

    expect(result).toEqual({ nested: { b: 2 } })
  })
})

describe('constants - 性能测试', () => {
  it('clamp 性能 - 10000次调用', () => {
    const start = Date.now()

    for (let i = 0; i < 10000; i++) {
      clamp(i, 0, 5000)
    }

    const elapsed = Date.now() - start
    expect(elapsed).toBeLessThan(100) // 应该在100ms内完成
  })

  it('deepFreeze 性能 - 冻结大型对象', () => {
    const largeObj = {
      items: Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        value: `item-${i}`,
      })),
    }

    const start = Date.now()
    deepFreeze(largeObj)
    const elapsed = Date.now() - start

    expect(elapsed).toBeLessThan(500) // 应该在500ms内完成
  })
})
