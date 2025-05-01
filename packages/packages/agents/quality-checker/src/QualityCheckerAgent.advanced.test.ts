import { describe, it, expect, beforeEach } from 'vitest'
import { QualityCheckerAgent } from '../src/QualityCheckerAgent.js'

describe('QualityCheckerAgent - Advanced Tests', () => {
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

  describe('规则库测试', () => {
    it('应该检测第一项权利要求不是独立权利要求', async () => {
      const input = {
        claims: [
          {
            type: 'dependent' as const,
            number: 1,
            content: '根据权利要求1所述的装置',
            dependsOn: 1,
          },
          {
            type: 'independent' as const,
            number: 2,
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

      const criticalIssues = result.issues.filter((i) => i.severity === 'critical')
      expect(criticalIssues.length).toBeGreaterThan(0)
      expect(criticalIssues.some((i) => i.ruleReference === 'A26.4')).toBe(true)
    })

    it('应该检测从属权利要求引用关系错误', async () => {
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
            content: '根据权利要求3所述的装置',
            dependsOn: 3, // 引用不存在的权利要求
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

      const highIssues = result.issues.filter(
        (i) => i.severity === 'high' && i.category === '权利要求'
      )
      expect(highIssues.length).toBeGreaterThan(0)
    })

    it('应该检测说明书各部分不完整', async () => {
      const input = {
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种测试装置',
          },
        ],
        specification: {
          technicalField: '', // 空的技术领域
          backgroundArt: '', // 空的背景技术
          inventionContent: '', // 空的发明内容
          embodiment: '', // 空的具体实施方式
        },
        patentType: 'invention' as const,
        inventionTitle: '测试装置',
      }

      const result = await agent.execute(input)

      const specIssues = result.issues.filter((i) => i.category === '说明书')
      expect(specIssues.length).toBeGreaterThan(0)
      expect(result.completenessScore).toBeLessThan(50)
    })

    it('应该检测标点符号错误', async () => {
      const input = {
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种测试装置，，包括控制器。。',
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
        checkLevel: 3 as const, // 标点符号规则为 low 严重性，需要级别3
      }

      const result = await agent.execute(input)

      const languageIssues = result.issues.filter((i) => i.category === '语言表达')
      expect(languageIssues.length).toBeGreaterThan(0)
    })

    it('应该检测模糊表达', async () => {
      const input = {
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种测试装置，大约包括控制器和可能存在的传感器',
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

      const vagueIssues = result.issues.filter(
        (i) => i.category === '语言表达' && i.subCategory === '精确性'
      )
      expect(vagueIssues.length).toBeGreaterThan(0)
    })
  })

  describe('多维度评分', () => {
    it('应该评估法律质量', async () => {
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

      expect(result.qualityScores.legal).toBeDefined()
      expect(result.qualityScores.legal.formality).toBeGreaterThan(0)
      expect(result.qualityScores.legal.patentability).toBeGreaterThan(0)
      expect(result.qualityScores.legal.riskLevel).toMatch(/^(low|medium|high)$/)
    })

    it('应该评估说明书支持性', async () => {
      const input = {
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种测试装置，包括控制器和传感器',
          },
        ],
        specification: {
          technicalField: '测试技术领域，特别涉及测试装置',
          backgroundArt: '现有技术中的测试装置存在不足',
          inventionContent: '本发明提供一种测试装置，包括控制器和传感器',
          embodiment:
            '本发明涉及一种测试装置，包括控制器和传感器。控制器负责控制整个测试装置的运行，传感器用于检测信号。控制器和传感器的协同工作使得测试装置能够高效完成测试任务。',
        },
        patentType: 'invention' as const,
        inventionTitle: '测试装置',
      }

      const result = await agent.execute(input)

      expect(result.qualityScores.specification.supportiveness).toBeGreaterThan(50)
    })

    it('应该评估保护范围合理性', async () => {
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
          technicalField: '测试技术领域',
          backgroundArt: '现有技术',
          inventionContent: '本发明内容',
          embodiment: '具体实施方式',
        },
        patentType: 'invention' as const,
        inventionTitle: '测试装置',
      }

      const result = await agent.execute(input)

      expect(result.qualityScores.claims.protectionScope).toBeGreaterThan(0)
    })
  })

  describe('检查级别', () => {
    it('级别1应该只检查关键规则', async () => {
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
        checkLevel: 1 as const,
      }

      const result = await agent.execute(input)

      expect(result.metadata.checkLevel).toBe(1)
      // 级别1只检查critical和high严重性的规则
      const lowSeverityIssues = result.issues.filter((i) => i.severity === 'low')
      expect(lowSeverityIssues.length).toBe(0)
    })

    it('级别3应该检查所有规则', async () => {
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
        checkLevel: 3 as const,
      }

      const result = await agent.execute(input)

      expect(result.metadata.checkLevel).toBe(3)
      expect(result.metadata.rulesApplied.length).toBeGreaterThan(10)
    })
  })

  describe('质量等级', () => {
    it('应该正确评估优秀质量', async () => {
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
            content: '根据权利要求1所述的装置，所述控制器为单片机',
            dependsOn: 1,
          },
          {
            type: 'dependent' as const,
            number: 3,
            content: '根据权利要求1所述的装置，所述传感器为温度传感器',
            dependsOn: 1,
          },
        ],
        specification: {
          technicalField: '本发明涉及测试技术领域，特别涉及一种智能测试装置',
          backgroundArt:
            '现有技术中的测试装置存在精度低、效率低等问题。具体而言，传统测试装置采用简单的控制逻辑，无法满足高精度测试需求。',
          inventionContent:
            '本发明要解决的技术问题是提供一种高精度测试装置。技术方案是采用智能控制算法。有益效果是测试精度提高50%，测试效率提高30%。',
          embodiment:
            '如图1所示，本发明包括控制器1和传感器2。控制器1采用型号为STM32的单片机，传感器2采用高精度温度传感器。控制器1通过SPI接口与传感器2连接，实时采集温度数据并进行处理。具体工作过程为：系统上电后，控制器1初始化各模块，然后以100Hz的频率采集传感器2的数据，经过滤波处理后输出测试结果。',
        },
        patentType: 'invention' as const,
        inventionTitle: '智能测试装置',
      }

      const result = await agent.execute(input)

      expect(result.qualityLevel).toBe('good')
      expect(result.overallQuality).toBeGreaterThan(75)
    })

    it('应该正确评估较差质量', async () => {
      const input = {
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '测试',
          },
        ],
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

      expect(result.qualityLevel).toBe('poor')
      expect(result.overallQuality).toBeLessThan(60)
    })
  })

  describe('对比数据', () => {
    it('应该为不同专利类型生成不同的对比数据', async () => {
      const baseInput = {
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
        inventionTitle: '测试装置',
      }

      const inventionResult = await agent.execute({
        ...baseInput,
        patentType: 'invention' as const,
      })
      expect(inventionResult.comparison.comparisonGroup).toBe('发明专利申请')

      const utilityModelResult = await agent.execute({
        ...baseInput,
        patentType: 'utilityModel' as const,
      })
      expect(utilityModelResult.comparison.comparisonGroup).toBe('实用新型申请')
    })
  })

  describe('改进建议', () => {
    it('应该生成优先级标记的建议', async () => {
      const input = {
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种测试装置',
          },
        ],
        specification: {
          technicalField: '测试',
          backgroundArt: '现有技术',
          inventionContent: '内容',
          embodiment: '实施方式',
        },
        patentType: 'invention' as const,
        inventionTitle: '测试装置',
      }

      const result = await agent.execute(input)

      result.recommendations.forEach((rec) => {
        expect(rec.priority).toMatch(/^(high|medium|low)$/)
        expect(rec.area).toBeDefined()
        expect(rec.current).toBeDefined()
        expect(rec.suggested).toBeDefined()
        expect(rec.rationale).toBeDefined()
      })
    })

    it('应该包含预期效果', async () => {
      const input = {
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种测试装置',
          },
        ],
        specification: {
          technicalField: '测试',
          backgroundArt: '现有技术',
          inventionContent: '内容',
          embodiment: '实施方式',
        },
        patentType: 'invention' as const,
        inventionTitle: '测试装置',
      }

      const result = await agent.execute(input)

      const withExpectedImpact = result.recommendations.filter((r) => r.expectedImpact)
      expect(withExpectedImpact.length).toBeGreaterThan(0)
    })
  })
})
