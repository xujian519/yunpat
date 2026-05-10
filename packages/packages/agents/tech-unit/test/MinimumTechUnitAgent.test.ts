import { describe, it, expect } from 'vitest'
import { MinimumTechUnitAgent } from '../src/MinimumTechUnitAgent.js'
import { detectSchemeType, extractRawFeatures } from '../src/featureExtractor.js'
import type { TechUnitExtractInput } from '../src/types.js'

function createMockLLM() {
  return {
    chat: async () => ({
      message: { role: 'assistant' as const, content: '' },
    }),
    chatStream: async function* () {
      yield { delta: '', done: true }
    },
    embed: async () => [],
  }
}

function createAgent(): MinimumTechUnitAgent {
  const mockLLM = createMockLLM() as any
  return new MinimumTechUnitAgent({
    name: 'test-tech-unit-agent',
    description: '测试用最小技术单元提取智能体',
    llm: mockLLM,
    eventBus: null as any,
    memory: null as any,
    tools: null as any,
  })
}

describe('MinimumTechUnitAgent', () => {
  describe('detectSchemeType', () => {
    it('应检测方法权利要求', () => {
      const plan = detectSchemeType(
        '一种数据处理方法，其特征在于，包括以下步骤：步骤一：获取原始数据；步骤二：对原始数据进行预处理。'
      )
      expect(plan).toBe('method')
    })

    it('应检测产品权利要求', () => {
      const plan = detectSchemeType(
        '一种电缆管道分隔装置，包括框形保持架，所述框形保持架设置有左L形框板和右L形框板。'
      )
      expect(plan).toBe('product')
    })
  })

  describe('extractRawFeatures - 产品权利要求', () => {
    it('应从产品权利要求中提取特征', () => {
      const claim =
        '一种电缆管道分隔装置，包括框形保持架，左L形框板与右L形框板卡接，左套管套接在圆柱管外圆周表面'
      const features = extractRawFeatures(claim, 'product')

      expect(features.length).toBeGreaterThanOrEqual(2)
      features.forEach((f) => {
        expect(f.sourceText).toBeTruthy()
        expect(f.id).toMatch(/^TU-\d{3}$/)
      })
    })
  })

  describe('extractRawFeatures - 方法权利要求', () => {
    it('应从带步骤标记的方法权利要求中提取特征', () => {
      const claim =
        '一种二元酸精制方法，步骤一：将粗品二元酸溶解于溶剂中；步骤二：加入活性炭进行脱色处理；步骤三：过滤并收集滤液。'
      const features = extractRawFeatures(claim, 'method')

      expect(features.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('trySplitFeature - 不可再分测试', () => {
    it('不可拆分的特征应返回1个部分', () => {
      const agent = createAgent()
      const parts = agent['trySplitFeature']('左套管套接在圆柱管外圆周表面')

      expect(parts).toHaveLength(1)
      expect(parts[0].text).toBeTruthy()
    })

    it('可拆分的特征应返回多个部分', () => {
      const agent = createAgent()
      const parts = agent['trySplitFeature'](
        '盒侧壁板底部四周边缘设置凸沿，以及凸沿的拐角处设置有连接固定插件'
      )

      expect(parts.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('runSelfCheck - 自检', () => {
    it('对空单元列表应报告未通过', () => {
      const agent = createAgent()
      const checks = agent['runSelfCheck'](
        [],
        { claimText: '一种装置' } as TechUnitExtractInput,
        'product'
      )

      const unitCountCheck = checks.find((c) => c.rule === '至少提取到1个技术单元')
      expect(unitCountCheck?.passed).toBe(false)
    })

    it('对有效单元应全部通过', () => {
      const agent = createAgent()
      const checks = agent['runSelfCheck'](
        [
          {
            id: 'TU-001',
            name: '特征1',
            description: '框形保持架',
            sourceText: '框形保持架',
            technicalFunction: '支撑固定',
            technicalEffect: '结构稳定',
            criteria: {
              hasIndependentFunction: true,
              hasIndependentEffect: true,
              isIndivisible: true,
              reasoning: '独立功能',
            },
            confidence: 0.8,
          },
        ],
        { claimText: '一种装置，包括框形保持架' } as TechUnitExtractInput,
        'product'
      )

      expect(checks.every((c) => c.passed)).toBe(true)
    })
  })

  describe('buildSummary', () => {
    it('应正确计算汇总统计', () => {
      const agent = createAgent()
      const summary = agent['buildSummary']([
        {
          id: 'TU-001',
          name: 'A',
          description: 'a',
          sourceText: 'a',
          technicalFunction: 'f',
          technicalEffect: 'e',
          criteria: {
            hasIndependentFunction: true,
            hasIndependentEffect: true,
            isIndivisible: true,
            reasoning: '',
          },
          confidence: 0.8,
        },
        {
          id: 'TU-002',
          name: 'B+C',
          description: 'b; c',
          sourceText: 'b, c',
          technicalFunction: 'f1; f2',
          technicalEffect: 'e1; e2',
          criteria: {
            hasIndependentFunction: true,
            hasIndependentEffect: true,
            isIndivisible: true,
            reasoning: '协同合并',
          },
          subFeatures: ['TU-002-a', 'TU-002-b'],
          confidence: 0.7,
        },
      ])

      expect(summary.totalUnits).toBe(2)
      expect(summary.independentUnits).toBe(1)
      expect(summary.mergedUnits).toBe(1)
      expect(summary.averageConfidence).toBe(0.75)
      expect(summary.qualityAssessment).toBe('high')
    })
  })
})
