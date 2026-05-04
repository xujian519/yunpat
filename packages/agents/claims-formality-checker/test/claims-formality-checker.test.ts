import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ClaimsFormalityChecker } from '../src/ClaimsFormalityChecker.js'

const mockContext = {
  registry: {} as any,
  llm: {} as any,
  memory: {} as any,
  eventBus: {
    publish: vi.fn(),
  } as any,
}

describe('ClaimsFormalityChecker', () => {
  let agent: ClaimsFormalityChecker

  beforeEach(() => {
    agent = new ClaimsFormalityChecker({
      name: 'test-claims-formality-checker',
      description: '测试权利要求形式检查Agent',
      eventBus: mockContext.eventBus,
      memory: mockContext.memory,
      tools: mockContext.registry,
      llm: mockContext.llm,
    })
  })

  describe('初始化', () => {
    it('应该成功初始化', () => {
      expect(agent).toBeDefined()
      expect(agent.name).toBe('test-claims-formality-checker')
    })
  })

  describe('清楚、简要检查（第26条第4款）', () => {
    it('应该检测到不清楚的权利要求', async () => {
      const input = {
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种测试装置，其特征在于包括大约5个组件',
          },
        ],
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(result.article26_4_clarity.passed).toBe(false)
      expect(result.article26_4_clarity.issues.length).toBeGreaterThan(0)
      expect(result.article26_4_clarity.issues[0].issue).toBe('权利要求不清楚')
    })

    it('应该检测到不简要的权利要求', async () => {
      const longContent = `一种测试装置，其特征在于包括控制器，其中所述控制器为单片机，具体来说包括处理器，优选地ARM架构，更优选地Cortex-M系列，其中所述处理器具有存储器，具体来说包括Flash存储器和RAM存储器，其中所述Flash存储器用于存储程序代码，其中所述RAM存储器用于存储运行时数据，其中所述处理器还具有时钟电路，其中所述时钟电路采用晶振，其中所述晶振频率为8MHz，其中所述处理器还具有复位电路，其中所述复位电路采用看门狗电路，其中所述看门狗电路用于监控系统运行状态`

      const input = {
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: longContent,
          },
        ],
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(result.article26_4_clarity.passed).toBe(false)
      expect(result.article26_4_clarity.issues.some((i: any) => i.issue === '权利要求不简要')).toBe(
        true
      )
    })

    it('应该通过清楚、简要检查', async () => {
      const input = {
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种测试装置，其特征在于包括控制器和传感器',
          },
        ],
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(result.article26_4_clarity.passed).toBe(true)
      expect(result.article26_4_clarity.issues.length).toBe(0)
    })
  })

  describe('权利要求书支持检查（第26条第4款）', () => {
    it('应该检测到未提供说明书的情况', async () => {
      const input = {
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种测试装置，其特征在于包括控制器',
          },
        ],
        patentType: 'invention' as const,
        // 未提供specification
      }

      const result = await agent.execute(input)

      expect(result.article26_4_support.passed).toBe(false)
      expect(result.article26_4_support.issues.length).toBeGreaterThan(0)
      expect(result.article26_4_support.issues[0].unsupportedFeature).toBe('未提供说明书')
    })

    it('应该检测到引用的权利要求不存在', async () => {
      const input = {
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种测试装置，其特征在于包括控制器',
          },
          {
            type: 'dependent' as const,
            number: 2,
            content: '根据权利要求3所述的测试装置，其特征在于所述控制器为单片机',
            dependsOn: 3, // 引用了不存在的权利要求3
          },
        ],
        patentType: 'invention' as const,
        specification: {
          technicalField: '测试技术领域',
          backgroundArt: '现有技术',
          inventionContent: '本发明提供一种测试装置',
          embodiment: '如图1所示',
        },
      }

      const result = await agent.execute(input)

      expect(result.article26_4_support.passed).toBe(false)
      expect(
        result.article26_4_support.issues.some((i: any) =>
          i.unsupportedFeature.includes('权利要求3')
        )
      ).toBe(true)
    })

    it('应该检测到权利要求中的特征在说明书中未支持', async () => {
      const input = {
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种测试装置，其特征在于包括"量子处理器"',
          },
        ],
        patentType: 'invention' as const,
        specification: {
          technicalField: '测试技术领域',
          backgroundArt: '现有技术',
          inventionContent: '本发明提供一种测试装置',
          embodiment: '该装置包括控制器和传感器',
        },
      }

      const result = await agent.execute(input)

      // "量子处理器"在说明书中未提及
      expect(
        result.article26_4_support.issues.some((i: any) => i.unsupportedFeature === '量子处理器')
      ).toBe(true)
    })

    it('应该通过权利要求书支持检查', async () => {
      const input = {
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种测试装置，其特征在于包括"传感器"',
          },
          {
            type: 'dependent' as const,
            number: 2,
            content: '根据权利要求1所述的测试装置，其特征在于所述传感器为温度传感器',
            dependsOn: 1,
          },
        ],
        patentType: 'invention' as const,
        specification: {
          technicalField: '测试技术领域',
          backgroundArt: '现有技术',
          inventionContent: '本发明提供一种测试装置，包括传感器',
          embodiment: '如图1所示，该装置包括传感器，所述传感器为温度传感器',
        },
      }

      const result = await agent.execute(input)

      expect(result.article26_4_support.passed).toBe(true)
      expect(result.article26_4_support.issues.length).toBe(0)
    })
  })

  describe('发明/实用新型定义检查（第4条第1款）', () => {
    it('应该检测到发明专利包含方法特征', async () => {
      const input = {
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种测试方法，其特征在于包括以下步骤：采集数据、处理数据',
          },
        ],
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(result.article4_1_definition.passed).toBe(false)
      expect(
        result.article4_1_definition.issues.some((i: any) => i.issue === '发明专利包含方法特征')
      ).toBe(true)
    })

    it('应该检测到实用新型缺少形状、构造特征', async () => {
      const input = {
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种测试组合物，其特征在于包括成分A和成分B',
          },
        ],
        patentType: 'utilityModel' as const,
      }

      const result = await agent.execute(input)

      expect(result.article4_1_definition.passed).toBe(false)
      expect(
        result.article4_1_definition.issues.some(
          (i: any) => i.issue === '实用新型缺少形状、构造特征'
        )
      ).toBe(true)
    })

    it('应该通过发明/实用新型定义检查', async () => {
      const input = {
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种测试装置，其特征在于包括控制器和传感器',
          },
        ],
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(result.article4_1_definition.passed).toBe(true)
      expect(result.article4_1_definition.issues.length).toBe(0)
    })
  })

  describe('非必要技术特征检查（实施细则第20条第1款）', () => {
    it('应该检测到公知常识内容', async () => {
      const input = {
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种测试装置，采用常规技术，其特征在于包括控制器',
          },
        ],
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(result.rule20_1_necessaryFeatures.unnecessaryFeatures.length).toBeGreaterThan(0)
      expect(result.rule20_1_necessaryFeatures.unnecessaryFeatures[0].reason).toContain('常规技术')
    })

    it('应该通过非必要技术特征检查', async () => {
      const input = {
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种测试装置，其特征在于包括控制器和传感器',
          },
        ],
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(result.rule20_1_necessaryFeatures.passed).toBe(true)
      expect(result.rule20_1_necessaryFeatures.unnecessaryFeatures.length).toBe(0)
    })
  })

  describe('总体报告', () => {
    it('应该正确计算问题总数', async () => {
      const input = {
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种测试装置，其特征在于包括大约5个组件，采用常规技术',
          },
        ],
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(result.overallReport.totalIssues).toBeGreaterThan(0)
      expect(result.overallReport.criticalIssues).toBeGreaterThan(0)
      expect(result.overallReport.passed).toBe(false)
    })

    it('应该生成修改建议', async () => {
      const input = {
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种测试装置，其特征在于包括大约5个组件',
          },
        ],
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(result.overallReport.recommendations.length).toBeGreaterThan(0)
      expect(result.overallReport.recommendations[0]).toContain('清楚')
    })

    it('应该在无问题时通过检查', async () => {
      const input = {
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种测试装置，其特征在于包括"传感器"和"控制器"',
          },
        ],
        patentType: 'invention' as const,
        specification: {
          technicalField: '测试技术领域',
          backgroundArt: '现有技术',
          inventionContent: '本发明提供一种测试装置，包括传感器和控制器',
          embodiment: '如图1所示，该装置包括传感器和控制器',
        },
      }

      const result = await agent.execute(input)

      expect(result.overallReport.passed).toBe(true)
      expect(result.overallReport.totalIssues).toBe(0)
      expect(result.overallReport.recommendations.length).toBe(0)
    })
  })

  describe('边界条件', () => {
    it('应该处理空权利要求书', async () => {
      const input = {
        claims: [],
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(result).toBeDefined()
      expect(result.overallReport.totalIssues).toBe(0)
    })

    it('应该处理多个权利要求', async () => {
      const claims = Array.from({ length: 10 }, (_, i) => ({
        type: 'independent' as const,
        number: i + 1,
        content: `第${i + 1}项权利要求`,
      }))

      const input = {
        claims,
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(result).toBeDefined()
      expect(result.overallReport.totalIssues).toBeGreaterThanOrEqual(0)
    })
  })

  describe('性能测试', () => {
    it('应该在合理时间内完成检查', async () => {
      const input = {
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种测试装置，其特征在于包括控制器和传感器',
          },
        ],
        patentType: 'invention' as const,
      }

      const startTime = Date.now()
      const result = await agent.execute(input)
      const endTime = Date.now()

      expect(result).toBeDefined()
      expect(endTime - startTime).toBeLessThan(1000) // 应该在1秒内完成
    })
  })

  describe('从属权利要求', () => {
    it('应该正确处理从属权利要求', async () => {
      const input = {
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种测试装置，其特征在于包括"控制器"',
          },
          {
            type: 'dependent' as const,
            number: 2,
            content: '根据权利要求1所述的测试装置，其特征在于所述控制器为单片机',
            dependsOn: 1,
          },
          {
            type: 'dependent' as const,
            number: 3,
            content: '根据权利要求2所述的测试装置，其特征在于所述单片机为ARM架构',
            dependsOn: 2,
          },
        ],
        patentType: 'invention' as const,
        specification: {
          technicalField: '测试技术领域',
          backgroundArt: '现有技术',
          inventionContent: '本发明提供一种测试装置',
          embodiment: '该装置包括控制器',
        },
      }

      const result = await agent.execute(input)

      expect(result).toBeDefined()
      expect(result.article26_4_support.passed).toBe(true)
    })
  })
})
