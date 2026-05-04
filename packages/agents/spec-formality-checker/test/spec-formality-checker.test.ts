import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SpecFormalityChecker } from '../src/SpecFormalityChecker.js'

const mockContext = {
  registry: {} as any,
  llm: {} as any,
  memory: {} as any,
  eventBus: {
    publish: vi.fn(),
  } as any,
}

describe('SpecFormalityChecker', () => {
  let agent: SpecFormalityChecker

  beforeEach(() => {
    agent = new SpecFormalityChecker({
      name: 'test-spec-formality-checker',
      description: '测试说明书形式检查Agent',
      eventBus: mockContext.eventBus,
      memory: mockContext.memory,
      tools: mockContext.registry,
      llm: mockContext.llm,
    })
  })

  describe('初始化', () => {
    it('应该成功初始化', () => {
      expect(agent).toBeDefined()
      expect(agent.name).toBe('test-spec-formality-checker')
    })
  })

  describe('充分公开检查（第26条第3款）', () => {
    it('应该检测到技术领域过于简单', async () => {
      const input = {
        specification: {
          technicalField: '测试领域', // 太短
          backgroundArt: '现有技术',
          inventionContent: '本发明提供一种测试装置',
          embodiment: '如图1所示',
        },
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(result.article26_3_disclosure.passed).toBe(false)
      expect(result.article26_3_disclosure.issues.some((i: any) => i.section === '技术领域')).toBe(
        true
      )
    })

    it('应该检测到背景技术未指出现有技术不足', async () => {
      const input = {
        specification: {
          technicalField: '本发明涉及测试技术领域',
          backgroundArt: '现有技术包括各种测试装置', // 未指出不足
          inventionContent: '本发明提供一种测试装置',
          embodiment: '如图1所示',
        },
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(result.article26_3_disclosure.passed).toBe(false)
      expect(result.article26_3_disclosure.issues.some((i: any) => i.section === '背景技术')).toBe(
        true
      )
    })

    it('应该检测到发明内容缺少技术方案', async () => {
      const input = {
        specification: {
          technicalField: '本发明涉及测试技术领域',
          backgroundArt: '现有技术存在不足',
          inventionContent: '本发明很好', // 缺少技术方案
          embodiment: '如图1所示',
        },
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(result.article26_3_disclosure.passed).toBe(false)
      expect(result.article26_3_disclosure.issues.some((i: any) => i.section === '发明内容')).toBe(
        true
      )
    })

    it('应该检测到具体实施方式过于简单', async () => {
      const input = {
        specification: {
          technicalField: '本发明涉及测试技术领域',
          backgroundArt: '现有技术存在不足',
          inventionContent: '本发明提供一种测试装置',
          embodiment: '测试装置', // 太短
        },
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(result.article26_3_disclosure.passed).toBe(false)
      expect(
        result.article26_3_disclosure.issues.some((i: any) => i.section === '具体实施方式')
      ).toBe(true)
    })

    it('应该通过充分公开检查', async () => {
      const input = {
        specification: {
          technicalField: '本发明涉及测试技术领域，特别涉及一种智能测试装置',
          backgroundArt: '现有技术中，测试装置存在精度低的问题，需要提供一种高精度的测试装置',
          inventionContent: '本发明提供一种测试装置，采用控制器和传感器，解决了精度低的问题',
          embodiment:
            '如图1所示，本发明包括控制器1、传感器2和执行机构3。所述控制器1分别与所述传感器2和所述执行机构3连接。所述控制器1用于接收所述传感器2采集的测试数据，并根据所述测试数据控制所述执行机构3执行相应操作。所述传感器2为高精度传感器，能够准确采集测试数据。所述执行机构3包括驱动单元和执行单元，所述驱动单元用于驱动所述执行单元。',
        },
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(result.article26_3_disclosure.passed).toBe(true)
      expect(result.article26_3_disclosure.issues.length).toBe(0)
    })
  })

  describe('清楚、简要检查（第26条第4款）', () => {
    it('应该检测到不清楚的表述', async () => {
      const input = {
        specification: {
          technicalField: '本发明涉及大约测试领域',
          backgroundArt: '现有技术',
          inventionContent: '本发明提供一种测试装置',
          embodiment: '如图1所示',
        },
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(result.article26_4_clarity.passed).toBe(false)
      expect(result.article26_4_clarity.issues.length).toBeGreaterThan(0)
    })

    it('应该检测到描述过于冗长', async () => {
      const longContent = '本发明涉及测试技术领域'.repeat(50) // 超过500字

      const input = {
        specification: {
          technicalField: longContent,
          backgroundArt: '现有技术',
          inventionContent: '本发明提供一种测试装置',
          embodiment: '如图1所示',
        },
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(result.article26_4_clarity.passed).toBe(false)
      expect(result.article26_4_clarity.issues.some((i: any) => i.issue === '描述过于冗长')).toBe(
        true
      )
    })

    it('应该通过清楚、简要检查', async () => {
      const input = {
        specification: {
          technicalField: '本发明涉及测试技术领域',
          backgroundArt: '现有技术存在不足',
          inventionContent: '本发明提供一种测试装置，包括控制器',
          embodiment: '如图1所示',
        },
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(result.article26_4_clarity.passed).toBe(true)
      expect(result.article26_4_clarity.issues.length).toBe(0)
    })
  })

  describe('必要组成部分检查（实施细则第17条）', () => {
    it('应该检测到缺少技术领域', async () => {
      const input = {
        specification: {
          backgroundArt: '现有技术',
          inventionContent: '本发明提供一种测试装置',
          embodiment: '如图1所示',
        },
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(result.rule17_components.passed).toBe(false)
      expect(result.rule17_components.missingComponents).toContain('技术领域')
    })

    it('应该检测到缺少多个必要组成部分', async () => {
      const input = {
        specification: {
          technicalField: '本发明涉及测试技术领域',
          // 缺少backgroundArt, inventionContent, embodiment
        },
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(result.rule17_components.passed).toBe(false)
      expect(result.rule17_components.missingComponents.length).toBe(3)
      expect(result.rule17_components.missingComponents).toContain('背景技术')
      expect(result.rule17_components.missingComponents).toContain('发明内容')
      expect(result.rule17_components.missingComponents).toContain('具体实施方式')
    })

    it('应该通过必要组成部分检查', async () => {
      const input = {
        specification: {
          technicalField: '本发明涉及测试技术领域',
          backgroundArt: '现有技术',
          inventionContent: '本发明提供一种测试装置',
          embodiment: '如图1所示',
        },
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(result.rule17_components.passed).toBe(true)
      expect(result.rule17_components.missingComponents.length).toBe(0)
    })
  })

  describe('附图说明检查（实施细则第18条）', () => {
    it('应该检测到缺少附图说明', async () => {
      const input = {
        specification: {
          technicalField: '本发明涉及测试技术领域',
          backgroundArt: '现有技术',
          inventionContent: '本发明提供一种测试装置',
          embodiment: '如图1所示，该装置包括控制器', // 引用了图1但没有附图说明
        },
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(result.rule18_drawings.passed).toBe(false)
      expect(result.rule18_drawings.issues.some((i: any) => i.issue.includes('附图说明'))).toBe(
        true
      )
    })

    it('应该检测到附图说明格式不规范', async () => {
      const input = {
        specification: {
          technicalField: '本发明涉及测试技术领域',
          backgroundArt: '现有技术',
          inventionContent: '本发明提供一种测试装置',
          drawingsDescription: '附图是结构图', // 格式不规范
          embodiment: '如图1所示',
        },
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(result.rule18_drawings.passed).toBe(false)
      expect(result.rule18_drawings.issues.some((i: any) => i.issue.includes('格式'))).toBe(true)
    })

    it('应该通过附图说明检查', async () => {
      const input = {
        specification: {
          technicalField: '本发明涉及测试技术领域',
          backgroundArt: '现有技术',
          inventionContent: '本发明提供一种测试装置',
          drawingsDescription: '图1为本发明结构示意图',
          embodiment: '如图1所示',
        },
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(result.rule18_drawings.passed).toBe(true)
      expect(result.rule18_drawings.hasDrawings).toBe(true)
      expect(result.rule18_drawings.issues.length).toBe(0)
    })
  })

  describe('具体实施方式检查（实施细则第19条）', () => {
    it('应该检测到缺少具体实施方式', async () => {
      const input = {
        specification: {
          technicalField: '本发明涉及测试技术领域',
          backgroundArt: '现有技术',
          inventionContent: '本发明提供一种测试装置',
        },
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(result.rule19_embodiment.passed).toBe(false)
      expect(
        result.rule19_embodiment.issues.some((i: any) => i.issue.includes('具体实施方式'))
      ).toBe(true)
    })

    it('应该检测到实用新型缺少形状、构造特征', async () => {
      const input = {
        specification: {
          technicalField: '本发明涉及测试技术领域',
          backgroundArt: '现有技术',
          inventionContent: '本发明提供一种测试组合物',
          embodiment: '该组合物包括成分A和成分B', // 缺少形状、构造特征
        },
        patentType: 'utilityModel' as const,
      }

      const result = await agent.execute(input)

      expect(result.rule19_embodiment.passed).toBe(false)
      expect(result.rule19_embodiment.issues.some((i: any) => i.issue.includes('形状、构造'))).toBe(
        true
      )
    })

    it('应该通过具体实施方式检查', async () => {
      const input = {
        specification: {
          technicalField: '本发明涉及测试技术领域',
          backgroundArt: '现有技术',
          inventionContent: '本发明提供一种测试装置',
          embodiment:
            '本发明包括控制器1和传感器2，所述控制器设置有处理器，所述传感器与所述处理器连接',
        },
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(result.rule19_embodiment.passed).toBe(true)
      expect(result.rule19_embodiment.issues.length).toBe(0)
    })
  })

  describe('权利要求书一致性检查', () => {
    it('应该检测到权利要求中的特征在说明书中未支持', async () => {
      const input = {
        specification: {
          technicalField: '本发明涉及测试技术领域',
          backgroundArt: '现有技术',
          inventionContent: '本发明提供一种测试装置',
          embodiment: '该装置包括控制器',
        },
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种测试装置，其特征在于包括"量子传感器"', // 量子传感器在说明书中未提及
          },
        ],
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(result.claimsConsistency.passed).toBe(false)
      expect(
        result.claimsConsistency.unsupportedClaims.some(
          (c: any) => c.missingInSpec === '量子传感器'
        )
      ).toBe(true)
    })

    it('应该通过权利要求书一致性检查', async () => {
      const input = {
        specification: {
          technicalField: '本发明涉及测试技术领域',
          backgroundArt: '现有技术',
          inventionContent: '本发明提供一种测试装置，包括"控制器"和"传感器"',
          embodiment: '如图1所示，该装置包括控制器和传感器',
        },
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种测试装置，其特征在于包括"控制器"和"传感器"',
          },
        ],
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(result.claimsConsistency.passed).toBe(true)
      expect(result.claimsConsistency.unsupportedClaims.length).toBe(0)
    })

    it('应该在没有权利要求书时跳过一致性检查', async () => {
      const input = {
        specification: {
          technicalField: '本发明涉及测试技术领域',
          backgroundArt: '现有技术',
          inventionContent: '本发明提供一种测试装置',
          embodiment: '如图1所示',
        },
        patentType: 'invention' as const,
        // 未提供claims
      }

      const result = await agent.execute(input)

      expect(result.claimsConsistency.passed).toBe(true)
      expect(result.claimsConsistency.unsupportedClaims.length).toBe(0)
    })
  })

  describe('总体报告', () => {
    it('应该正确计算问题总数', async () => {
      const input = {
        specification: {
          technicalField: '测试', // 太短
          backgroundArt: '现有技术',
          inventionContent: '本发明',
          embodiment: '测试', // 太短
        },
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(result.overallReport.totalIssues).toBeGreaterThan(0)
      expect(result.overallReport.criticalIssues).toBeGreaterThan(0)
      expect(result.overallReport.passed).toBe(false)
    })

    it('应该生成修改建议', async () => {
      const input = {
        specification: {
          technicalField: '测试',
          backgroundArt: '现有技术',
          inventionContent: '本发明',
          embodiment: '测试',
        },
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(result.overallReport.recommendations.length).toBeGreaterThan(0)
    })

    it('应该在无问题时通过检查', async () => {
      const input = {
        specification: {
          technicalField: '本发明涉及测试技术领域，特别涉及一种智能测试装置',
          backgroundArt: '现有技术中，测试装置存在精度低、效率低的问题',
          inventionContent: '本发明提供一种测试装置，采用"控制器"和"传感器"，解决了现有技术的问题',
          drawingsDescription: '图1为本发明结构示意图',
          embodiment:
            '如图1所示，本发明包括控制器1、传感器2和执行机构3。所述控制器1分别与所述传感器2和所述执行机构3连接。本发明采用高精度传感器，能够准确采集测试数据。控制器采用单片机，具有强大的数据处理能力。执行机构包括驱动单元和执行单元，能够精确执行各种操作。',
        },
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种测试装置，其特征在于包括"控制器"和"传感器"',
          },
        ],
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      // 调试输出
      if (result.overallReport.totalIssues > 0) {
        console.log('totalIssues:', result.overallReport.totalIssues)
        console.log('article26_3_disclosure:', result.article26_3_disclosure)
        console.log('article26_4_clarity:', result.article26_4_clarity)
        console.log('rule17_components:', result.rule17_components)
        console.log('rule18_drawings:', result.rule18_drawings)
        console.log('rule19_embodiment:', result.rule19_embodiment)
        console.log('claimsConsistency:', result.claimsConsistency)
      }

      expect(result.overallReport.passed).toBe(true)
      expect(result.overallReport.totalIssues).toBe(0)
    })
  })

  describe('边界条件', () => {
    it('应该处理空说明书', async () => {
      const input = {
        specification: {},
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(result).toBeDefined()
      expect(result.overallReport.totalIssues).toBeGreaterThan(0)
    })

    it('应该处理只有部分字段的说明书', async () => {
      const input = {
        specification: {
          technicalField: '本发明涉及测试技术领域',
          // 其他字段为空
        },
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(result).toBeDefined()
      expect(result.rule17_components.missingComponents.length).toBeGreaterThan(0)
    })
  })

  describe('性能测试', () => {
    it('应该在合理时间内完成检查', async () => {
      const input = {
        specification: {
          technicalField: '本发明涉及测试技术领域',
          backgroundArt: '现有技术',
          inventionContent: '本发明提供一种测试装置',
          embodiment: '如图1所示',
        },
        patentType: 'invention' as const,
      }

      const startTime = Date.now()
      const result = await agent.execute(input)
      const endTime = Date.now()

      expect(result).toBeDefined()
      expect(endTime - startTime).toBeLessThan(1000) // 应该在1秒内完成
    })
  })

  describe('不同专利类型', () => {
    it('应该正确处理发明专利', async () => {
      const input = {
        specification: {
          technicalField: '本发明涉及测试技术领域',
          backgroundArt: '现有技术',
          inventionContent: '本发明提供一种测试方法',
          embodiment: '本方法包括步骤1、步骤2',
        },
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(result).toBeDefined()
      expect(result.article26_3_disclosure).toBeDefined()
    })

    it('应该正确处理实用新型专利', async () => {
      const input = {
        specification: {
          technicalField: '本发明涉及测试技术领域',
          backgroundArt: '现有技术',
          inventionContent: '本发明提供一种测试装置',
          embodiment: '该装置包括控制器，设置有传感器，具有特定的结构',
        },
        patentType: 'utilityModel' as const,
      }

      const result = await agent.execute(input)

      expect(result).toBeDefined()
      expect(result.rule19_embodiment.passed).toBe(true)
    })
  })
})
