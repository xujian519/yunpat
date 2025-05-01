import { describe, it, expect, beforeEach } from 'vitest'
import { QualityCheckerAgent } from '../src/QualityCheckerAgent'

describe('QualityCheckerAgent', () => {
  let agent: QualityCheckerAgent

  beforeEach(() => {
    agent = new QualityCheckerAgent({
      name: 'test-quality-checker',
      description: '测试用质量检查Agent',
      eventBus: {
        publish: () => {},
      },
      memory: {},
      tools: {},
      llm: {},
    })
  })

  describe('完整性检查', () => {
    it('应该计算完整的专利申请的完整性评分', async () => {
      const input = {
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种测试装置',
          },
          {
            type: 'dependent' as const,
            number: 2,
            content: '根据权利要求1所述的装置',
            dependsOn: 1,
          },
        ],
        specification: {
          technicalField: '本发明涉及测试技术领域，特别涉及智能测试装置',
          backgroundArt: '现有技术中的测试装置存在精度低、效率低等问题，需要改进',
          inventionContent:
            '本发明提供一种智能测试装置，通过引入先进的传感器技术和智能控制算法，解决现有技术中精度低、效率低的问题，实现高精度自动化测试',
          embodiment:
            '如图1所示，本发明包括控制器1、传感器2和执行机构3。控制器1分别与传感器2和执行机构3连接。本发明的控制器1采用高性能处理器，能够实时处理传感器2采集的数据，并控制执行机构3完成相应操作。具体实施时，传感器2可以是温度传感器、压力传感器或位移传感器中的一种或多种。',
        },
        patentType: 'invention' as const,
        inventionTitle: '测试装置',
      }

      const result = await agent.execute(input)

      expect(result.completenessScore).toBeGreaterThan(80)
    })

    it('应该检测不完整的专利申请', async () => {
      const input = {
        claims: [],
        specification: {
          technicalField: '',
          backgroundArt: '',
          inventionContent: '',
          embodiment: '',
        },
        patentType: 'invention' as const,
        inventionTitle: '',
      }

      const result = await agent.execute(input)

      expect(result.completenessScore).toBeLessThan(20)
    })
  })

  describe('质量评分', () => {
    it('应该评估权利要求质量', async () => {
      const input = {
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种测试装置，包括控制器和传感器',
          },
          {
            type: 'dependent' as const,
            number: 2,
            content: '根据权利要求1所述的装置',
            dependsOn: 1,
          },
        ],
        specification: {
          technicalField: '测试技术领域',
          backgroundArt: '现有技术',
          inventionContent: '本发明内容',
          embodiment: '具体实施方式',
        },
        patentType: 'invention' as const,
        inventionTitle: '测试装置',
      }

      const result = await agent.execute(input)

      expect(result.qualityScores.claims).toBeDefined()
      expect(result.qualityScores.claims.overall).toBeGreaterThan(0)
    })

    it('应该评估说明书质量', async () => {
      const input = {
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种测试装置',
          },
        ],
        specification: {
          technicalField: '测试技术领域',
          backgroundArt: '现有技术',
          inventionContent: '本发明内容',
          embodiment: '具体实施方式',
        },
        patentType: 'invention' as const,
        inventionTitle: '测试装置',
      }

      const result = await agent.execute(input)

      expect(result.qualityScores.specification).toBeDefined()
      expect(result.qualityScores.specification.overall).toBeGreaterThan(0)
    })
  })

  describe('问题检测', () => {
    it('应该检测权利要求清晰度问题', async () => {
      const input = {
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: 'A'.repeat(600), // 过长的权利要求（超过500字阈值）
          },
        ],
        specification: {
          technicalField: '测试技术领域',
          backgroundArt: '现有技术',
          inventionContent: '本发明内容',
          embodiment: '具体实施方式',
        },
        patentType: 'invention' as const,
        inventionTitle: '测试装置',
      }

      const result = await agent.execute(input)

      const clarityIssues = result.issues.filter((i) => i.category === '权利要求')
      expect(clarityIssues.length).toBeGreaterThan(0)
    })

    it('应该检测说明书充分性问题', async () => {
      const input = {
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种测试装置',
          },
        ],
        specification: {
          technicalField: '',
          backgroundArt: '',
          inventionContent: '',
          embodiment: '',
        },
        patentType: 'invention' as const,
        inventionTitle: '测试装置',
      }

      const result = await agent.execute(input)

      const specIssues = result.issues.filter((i) => i.category === '说明书')
      expect(specIssues.length).toBeGreaterThan(0)
    })
  })

  describe('总体质量', () => {
    it('应该计算总体质量评分', async () => {
      const input = {
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种测试装置',
          },
        ],
        specification: {
          technicalField: '测试技术领域',
          backgroundArt: '现有技术',
          inventionContent: '本发明内容',
          embodiment: '具体实施方式',
        },
        patentType: 'invention' as const,
        inventionTitle: '测试装置',
      }

      const result = await agent.execute(input)

      expect(result.overallQuality).toBeGreaterThan(0)
      expect(result.overallQuality).toBeLessThanOrEqual(100)
    })
  })

  describe('改进建议', () => {
    it('应该生成改进建议', async () => {
      const input = {
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种测试装置',
          },
        ],
        specification: {
          technicalField: '测试技术领域',
          backgroundArt: '现有技术',
          inventionContent: '本发明内容',
          embodiment: '具体实施方式',
        },
        patentType: 'invention' as const,
        inventionTitle: '测试装置',
      }

      const result = await agent.execute(input)

      expect(result.recommendations.length).toBeGreaterThan(0)
      expect(result.recommendations[0].area).toBeDefined()
      expect(result.recommendations[0].current).toBeDefined()
      expect(result.recommendations[0].suggested).toBeDefined()
    })
  })

  describe('对比数据', () => {
    it('应该生成对比数据', async () => {
      const input = {
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种测试装置',
          },
        ],
        specification: {
          technicalField: '测试技术领域',
          backgroundArt: '现有技术',
          inventionContent: '本发明内容',
          embodiment: '具体实施方式',
        },
        patentType: 'invention' as const,
        inventionTitle: '测试装置',
      }

      const result = await agent.execute(input)

      expect(result.comparison).toBeDefined()
      expect(result.comparison.averageQuality).toBeGreaterThan(0)
      expect(result.comparison.percentile).toBeGreaterThanOrEqual(0)
      expect(result.comparison.percentile).toBeLessThanOrEqual(100)
      expect(result.comparison.ranking).toBeDefined()
    })
  })
})
