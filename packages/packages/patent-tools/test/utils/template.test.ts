import { describe, it, expect } from 'vitest'
import {
  CLAIMS_TEMPLATES,
  DEFAULT_PREAMBLES,
  DEFAULT_TRANSITION_WORDS,
  buildIndependentClaimPrompt,
  buildDependentClaimPrompt,
  buildQualityAssessmentPrompt,
  buildOfficeActionParsePrompt,
  buildResponseStrategyPrompt,
} from '../../src/utils/template.js'
import { InventionType } from '../../src/types/patent.js'

describe('Template Constants', () => {
  it('CLAIMS_TEMPLATES contains all invention types', () => {
    expect(CLAIMS_TEMPLATES[InventionType.DEVICE]).toContain('装置')
    expect(CLAIMS_TEMPLATES[InventionType.METHOD]).toContain('方法')
    expect(CLAIMS_TEMPLATES[InventionType.SYSTEM]).toContain('系统')
    expect(CLAIMS_TEMPLATES[InventionType.COMPOSITION]).toContain('组合物')
  })

  it('DEFAULT_PREAMBLES contains all invention types', () => {
    expect(DEFAULT_PREAMBLES[InventionType.DEVICE]).toBe('一种装置')
    expect(DEFAULT_PREAMBLES[InventionType.METHOD]).toBe('一种方法')
    expect(DEFAULT_PREAMBLES[InventionType.SYSTEM]).toBe('一种系统')
    expect(DEFAULT_PREAMBLES[InventionType.COMPOSITION]).toBe('一种组合物')
  })

  it('DEFAULT_TRANSITION_WORDS contains all invention types', () => {
    expect(DEFAULT_TRANSITION_WORDS[InventionType.DEVICE]).toContain('其特征在于')
    expect(DEFAULT_TRANSITION_WORDS[InventionType.METHOD]).toContain('包括以下步骤')
    expect(DEFAULT_TRANSITION_WORDS[InventionType.SYSTEM]).toContain('其特征在于')
    expect(DEFAULT_TRANSITION_WORDS[InventionType.COMPOSITION]).toContain('其特征在于')
  })
})

describe('buildIndependentClaimPrompt', () => {
  it('includes preamble, transition word, and features', () => {
    const prompt = buildIndependentClaimPrompt({
      inventionType: InventionType.DEVICE,
      preamble: '一种图像识别装置',
      transitionWord: '其特征在于，包括：',
      features: '1. 图像采集模块\n2. 特征提取模块',
    })

    expect(prompt).toContain('一种图像识别装置')
    expect(prompt).toContain('其特征在于，包括：')
    expect(prompt).toContain('图像采集模块')
    expect(prompt).toContain('特征提取模块')
    expect(prompt).toContain('独立权利要求')
  })
})

describe('buildDependentClaimPrompt', () => {
  it('includes independent claim and claim number', () => {
    const prompt = buildDependentClaimPrompt({
      independentClaim: '一种装置，其特征在于，包括：A模块；',
      claimNumber: 3,
      additionalFeature: '所述A模块采用B技术',
    })

    expect(prompt).toContain('第 3 项从属权利要求')
    expect(prompt).toContain('一种装置，其特征在于，包括：A模块；')
    expect(prompt).toContain('所述A模块采用B技术')
    expect(prompt).toContain('根据权利要求2所述的')
  })
})

describe('buildQualityAssessmentPrompt', () => {
  it('includes claims text and evaluation dimensions', () => {
    const claimsText = '权利要求1：一种装置...'
    const prompt = buildQualityAssessmentPrompt(claimsText)

    expect(prompt).toContain(claimsText)
    expect(prompt).toContain('完整性')
    expect(prompt).toContain('清晰性')
    expect(prompt).toContain('准确性')
    expect(prompt).toContain('JSON')
  })
})

describe('buildOfficeActionParsePrompt', () => {
  it('includes office action text and extraction fields', () => {
    const text = '审查意见通知书内容...'
    const prompt = buildOfficeActionParsePrompt(text)

    expect(prompt).toContain(text)
    expect(prompt).toContain('申请号')
    expect(prompt).toContain('审查意见列表')
    expect(prompt).toContain('引用文献列表')
    expect(prompt).toContain('JSON')
  })
})

describe('buildResponseStrategyPrompt', () => {
  it('includes office action and current claims', () => {
    const prompt = buildResponseStrategyPrompt({
      officeAction: '审查意见：缺乏创造性',
      currentClaims: '权利要求1...',
    })

    expect(prompt).toContain('审查意见：缺乏创造性')
    expect(prompt).toContain('权利要求1...')
    expect(prompt).toContain('答复策略')
    expect(prompt).toContain('estimatedSuccessRate')
  })
})
