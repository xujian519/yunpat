import { describe, it, expect, vi } from 'vitest'
import { AutoCorrector } from '../../src/constitutional/AutoCorrector.js'
import { CorrectionStrategy, ViolationSeverity } from '../../src/constitutional/types.js'

function createConfig(strategy: CorrectionStrategy = CorrectionStrategy.RULE_BASED) {
  return {
    enabledPrinciples: ['clarity', 'definiteness', 'brevity'],
    correctionStrategy: strategy,
    severityThreshold: ViolationSeverity.MINOR,
    useLLMForCheck: false,
    useLLMForCorrection: false,
    maxLLMConcurrency: 1,
  }
}

function createViolation(principleId: string, text: string, start: number, suggested: string = '') {
  return {
    principleId,
    principleName: principleId,
    severity: ViolationSeverity.MAJOR,
    location: { start, end: start + text.length, text, context: text },
    description: `违反${principleId}`,
    suggestedCorrection: suggested,
    confidence: 0.9,
  }
}

describe('AutoCorrector', () => {
  describe('correct - RULE_BASED', () => {
    it('应该纠正清楚性违规（模糊词汇）', async () => {
      const corrector = new AutoCorrector(null, createConfig())
      const result = await corrector.correct('一些', [
        createViolation('clarity', '一些', 0, '多个'),
      ])
      expect(result.correctedContent).toBe('多个')
      expect(result.appliedCorrections).toHaveLength(1)
    })

    it('应该纠正确定性违规（移除不确定词汇）', async () => {
      const corrector = new AutoCorrector(null, createConfig())
      const result = await corrector.correct('大约', [
        createViolation('definiteness', '大约', 0, ''),
      ])
      expect(result.correctedContent).toBe('')
    })

    it('应该纠正简要性违规（移除冗余）', async () => {
      const corrector = new AutoCorrector(null, createConfig())
      const result = await corrector.correct('进行配置', [
        createViolation('brevity', '进行配置', 0, '配置'),
      ])
      expect(result.correctedContent).toBe('配置')
    })

    it('应该使用建议纠正（短建议）', async () => {
      const corrector = new AutoCorrector(null, createConfig())
      const result = await corrector.correct('bad', [createViolation('clarity', 'bad', 0, 'good')])
      expect(result.correctedContent).toBe('good')
    })

    it('应该跳过没有location的违规', async () => {
      const corrector = new AutoCorrector(null, createConfig())
      const result = await corrector.correct('content', [
        { ...createViolation('clarity', 'x', 0), location: undefined as any },
      ])
      expect(result.correctedContent).toBe('content')
      expect(result.appliedCorrections).toHaveLength(0)
    })

    it('应该跳过不可纠正的违规', async () => {
      const corrector = new AutoCorrector(null, createConfig())
      const result = await corrector.correct('content', [createViolation('unknown', 'content', 0)])
      expect(result.correctedContent).toBe('content')
    })

    it('应该过滤低严重度违规', async () => {
      const corrector = new AutoCorrector(null, {
        ...createConfig(),
        severityThreshold: ViolationSeverity.CRITICAL,
      })
      const result = await corrector.correct('一些', [
        createViolation('clarity', '一些', 0, '多个'),
      ])
      expect(result.correctedContent).toBe('一些')
    })

    it('应该处理空违规列表', async () => {
      const corrector = new AutoCorrector(null, createConfig())
      const result = await corrector.correct('content', [])
      expect(result.correctedContent).toBe('content')
    })

    it('应该按倒序位置纠正', async () => {
      const corrector = new AutoCorrector(null, createConfig())
      const result = await corrector.correct('一些 大约', [
        createViolation('clarity', '一些', 0, '多个'),
        createViolation('definiteness', '大约', 3, ''),
      ])
      expect(result.correctedContent).not.toContain('一些')
      expect(result.correctedContent).not.toContain('大约')
    })
  })

  describe('correct - LLM_BASED', () => {
    it('应该在无LLM时回退到规则', async () => {
      const corrector = new AutoCorrector(null, {
        ...createConfig(CorrectionStrategy.LLM_BASED),
        useLLMForCorrection: false,
      })
      const result = await corrector.correct('一些', [
        createViolation('clarity', '一些', 0, '多个'),
      ])
      expect(result.correctedContent).toBe('多个')
    })

    it('应该使用LLM纠正', async () => {
      const mockLLM = {
        chat: vi.fn().mockResolvedValue({
          message: { content: 'corrected' },
        }),
      }
      const corrector = new AutoCorrector(mockLLM as any, {
        ...createConfig(CorrectionStrategy.LLM_BASED),
        useLLMForCorrection: true,
      })
      const result = await corrector.correct('bad text', [createViolation('clarity', 'bad', 0)])
      expect(result.correctedContent).toBe('corrected text')
    })

    it('应该处理LLM失败', async () => {
      const mockLLM = {
        chat: vi.fn().mockRejectedValue(new Error('fail')),
      }
      const corrector = new AutoCorrector(mockLLM as any, {
        ...createConfig(CorrectionStrategy.LLM_BASED),
        useLLMForCorrection: true,
      })
      const result = await corrector.correct('content', [createViolation('clarity', 'bad', 0)])
      expect(result.correctedContent).toBe('content')
    })
  })

  describe('correct - HYBRID', () => {
    it('应该使用混合策略', async () => {
      const corrector = new AutoCorrector(null, {
        ...createConfig(CorrectionStrategy.HYBRID),
      })
      const result = await corrector.correct('一些', [
        createViolation('clarity', '一些', 0, '多个'),
      ])
      expect(result.strategy).toBe(CorrectionStrategy.HYBRID)
      expect(result.correctedContent).toBe('多个')
    })
  })

  describe('verifyCorrection', () => {
    it('应该验证通过', async () => {
      const corrector = new AutoCorrector(null, createConfig())
      const valid = await corrector.verifyCorrection('original', 'corrected', [])
      expect(valid).toBe(true)
    })

    it('应该拒绝空结果', async () => {
      const corrector = new AutoCorrector(null, createConfig())
      const valid = await corrector.verifyCorrection('original', '', [])
      expect(valid).toBe(false)
    })

    it('应该拒绝长度变化过大', async () => {
      const corrector = new AutoCorrector(null, createConfig())
      const valid = await corrector.verifyCorrection('short', 'a'.repeat(100), [])
      expect(valid).toBe(false)
    })

    it('应该检查技术特征', async () => {
      const corrector = new AutoCorrector(null, createConfig())
      const valid = await corrector.verifyCorrection('包括A包含B设有C', '包括A', [])
      expect(valid).toBe(false)
    })
  })
})
