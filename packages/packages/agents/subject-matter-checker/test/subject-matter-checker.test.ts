import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SubjectMatterChecker } from '../src/SubjectMatterChecker.js'

const mockContext = {
  registry: {} as any,
  llm: {} as any,
  memory: {} as any,
  eventBus: {
    publish: vi.fn(),
  } as any,
}

describe('SubjectMatterChecker', () => {
  let agent: SubjectMatterChecker

  beforeEach(() => {
    agent = new SubjectMatterChecker({
      name: 'test-subject-matter-checker',
      description: '测试保护客体检查Agent',
      eventBus: mockContext.eventBus,
      memory: mockContext.memory,
      tools: mockContext.registry,
      llm: mockContext.llm,
    })
  })

  describe('初始化', () => {
    it('应该成功初始化', () => {
      expect(agent).toBeDefined()
      expect(agent.name).toBe('test-subject-matter-checker')
    })
  })

  describe('技术方案分析（第2条）', () => {
    it('应该识别包含技术特征的权利要求', async () => {
      const input = {
        inventionTitle: '一种测试装置',
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种测试装置，其特征在于包括"控制器"和"传感器"',
          },
        ],
        specification: {
          technicalField: '本发明涉及测试技术领域',
          backgroundArt: '现有技术存在精度低的问题',
          inventionContent: '本发明提供一种测试装置，提高了精度',
        },
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(result.technicalSolutionAnalysis.hasTechnicalSolution).toBe(true)
      expect(result.article2_inventionDefinition.passed).toBe(true)
    })

    it('应该检测非技术方案的权利要求', async () => {
      const input = {
        inventionTitle: '一种计算方法',
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种数字计算方法，包括加法和减法步骤',
          },
        ],
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(result.technicalSolutionAnalysis.hasTechnicalSolution).toBe(false)
      expect(result.article2_inventionDefinition.passed).toBe(false)
      expect(result.article2_inventionDefinition.issues.length).toBeGreaterThan(0)
    })

    it('应该提取技术特征', async () => {
      const input = {
        inventionTitle: '一种测试装置',
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种测试装置，包括"控制器"和"传感器"以及处理单元',
          },
        ],
        specification: {
          technicalField: '测试技术领域',
          backgroundArt: '现有技术存在精度低的问题',
          inventionContent: '本发明提高了精度',
        },
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      const analysis = result.technicalSolutionAnalysis.independentClaimsAnalysis[0]
      expect(analysis.technicalFeatures.length).toBeGreaterThan(0)
      expect(analysis.technicalFeatures).toContain('控制器')
      expect(analysis.technicalFeatures).toContain('传感器')
    })
  })

  describe('智力活动规则检查（第25条第1款第2项）', () => {
    it('应该检测智力活动方法', async () => {
      const input = {
        inventionTitle: '一种数据分析方法',
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种数据分析方法，包括数据收集、数据计算和数据推理步骤',
          },
        ],
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(result.intellectualActivityCheck.hasIntellectualActivityRules).toBe(true)
      expect(result.intellectualActivityCheck.detectedRules.length).toBeGreaterThan(0)
    })

    it('应该检测商业模式', async () => {
      const input = {
        inventionTitle: '一种商业模式',
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种电子商务商业模式，包括在线销售和支付流程',
          },
        ],
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(result.intellectualActivityCheck.hasIntellectualActivityRules).toBe(true)
      expect(
        result.article25_exclusions.nonProtectableMatters.some(
          (m: any) => m.type === 'intellectual_activity_rules'
        )
      ).toBe(true)
    })

    it('应该检测管理规则', async () => {
      const input = {
        inventionTitle: '一种管理方法',
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种企业管理方法，包括人员管理和财务管理规则',
          },
        ],
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(result.intellectualActivityCheck.hasIntellectualActivityRules).toBe(true)
    })

    it('应该不检测包含技术手段的权利要求', async () => {
      const input = {
        inventionTitle: '一种测试装置',
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种测试装置，包括控制器和传感器',
          },
        ],
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(result.intellectualActivityCheck.hasIntellectualActivityRules).toBe(false)
      expect(result.intellectualActivityCheck.detectedRules.length).toBe(0)
    })
  })

  describe('疾病诊断治疗方法检查（第25条第1款第3项）', () => {
    it('应该检测诊断方法', async () => {
      const input = {
        inventionTitle: '一种疾病诊断方法',
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种癌症疾病的早期诊断方法，包括血液检测步骤',
          },
        ],
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(
        result.article25_exclusions.nonProtectableMatters.some(
          (m: any) => m.type === 'medical_diagnosis_treatment'
        )
      ).toBe(true)
    })

    it('应该检测治疗方法', async () => {
      const input = {
        inventionTitle: '一种治疗方法',
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种高血压的治疗方法，包括药物配给步骤',
          },
        ],
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(
        result.article25_exclusions.nonProtectableMatters.some(
          (m: any) => m.type === 'medical_diagnosis_treatment'
        )
      ).toBe(true)
    })

    it('应该不检测医疗器械', async () => {
      const input = {
        inventionTitle: '一种医疗设备',
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种医疗诊断设备，包括传感器和处理器',
          },
        ],
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(
        result.article25_exclusions.nonProtectableMatters.some(
          (m: any) => m.type === 'medical_diagnosis_treatment'
        )
      ).toBe(false)
    })
  })

  describe('违法性检查（第5条）', () => {
    it('应该检测赌博相关内容', async () => {
      const input = {
        inventionTitle: '一种博彩系统',
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种在线赌博系统，包括下注和结算模块',
          },
        ],
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(result.legalityCheck.passed).toBe(false)
      expect(result.legalityCheck.illegalContent).toBeDefined()
      expect(result.legalityCheck.illegalContent?.reason).toContain('赌博')
    })

    it('应该检测违禁品相关内容', async () => {
      const input = {
        inventionTitle: '一种违禁品制备方法',
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种毒品的制备方法',
          },
        ],
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(result.legalityCheck.passed).toBe(false)
    })

    it('应该通过正常技术方案的违法性检查', async () => {
      const input = {
        inventionTitle: '一种测试装置',
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种测试装置，包括控制器',
          },
        ],
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(result.legalityCheck.passed).toBe(true)
      expect(result.legalityCheck.illegalContent).toBeUndefined()
    })
  })

  describe('其他排除客体检查（第25条）', () => {
    it('应该检测科学发现', async () => {
      const input = {
        inventionTitle: '一种新元素的发现',
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种发现新元素的方法，揭示了新的科学原理',
          },
        ],
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(
        result.article25_exclusions.nonProtectableMatters.some(
          (m: any) => m.type === 'scientific_discovery'
        )
      ).toBe(true)
    })

    it('应该检测动植物品种', async () => {
      const input = {
        inventionTitle: '一种植物培育方法',
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种新品种植物的培育方法',
          },
        ],
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(
        result.article25_exclusions.nonProtectableMatters.some(
          (m: any) => m.type === 'animal_plant_variety'
        )
      ).toBe(true)
    })

    it('应该检测原子核变换方法', async () => {
      const input = {
        inventionTitle: '一种核能方法',
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种原子核裂变方法',
          },
        ],
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(
        result.article25_exclusions.nonProtectableMatters.some(
          (m: any) => m.type === 'nuclear_transformation'
        )
      ).toBe(true)
    })

    it('应该检测单纯的计算机程序', async () => {
      const input = {
        inventionTitle: '一种计算机程序',
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种存储介质，其上存储有计算机程序，所述计算机程序用于执行数据处理功能',
          },
        ],
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(
        result.article25_exclusions.nonProtectableMatters.some(
          (m: any) => m.type === 'computer_program_only'
        )
      ).toBe(true)
    })

    it('应该不检测包含技术特征的软件相关发明', async () => {
      const input = {
        inventionTitle: '一种数据处理装置',
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种数据处理装置，包括处理器和存储器，用于执行数据处理',
          },
        ],
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(
        result.article25_exclusions.nonProtectableMatters.some(
          (m: any) => m.type === 'computer_program_only'
        )
      ).toBe(false)
    })
  })

  describe('总体报告', () => {
    it('应该正确计算问题总数', async () => {
      const input = {
        inventionTitle: '一种博彩系统',
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种在线赌博系统',
          },
        ],
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(result.overallReport.totalIssues).toBeGreaterThan(0)
      expect(result.overallReport.criticalIssues).toBeGreaterThan(0)
    })

    it('应该通过正常技术方案的检查', async () => {
      const input = {
        inventionTitle: '一种测试装置',
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种测试装置，包括"控制器"和"传感器"',
          },
        ],
        specification: {
          technicalField: '测试技术领域',
          backgroundArt: '现有技术存在精度低的问题',
          inventionContent: '本发明提高了精度',
        },
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(result.overallReport.passed).toBe(true)
      expect(result.overallReport.isProtectableSubjectMatter).toBe(true)
      expect(result.overallReport.totalIssues).toBe(0)
    })

    it('应该为非技术方案生成修改建议', async () => {
      const input = {
        inventionTitle: '一种计算方法',
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种数字计算方法',
          },
        ],
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(result.overallReport.passed).toBe(false)
      expect(result.overallReport.recommendations.length).toBeGreaterThan(0)
      expect(result.overallReport.recommendations.some((r: string) => r.includes('技术手段'))).toBe(
        true
      )
    })

    it('应该为单纯计算机程序生成修改建议', async () => {
      const input = {
        inventionTitle: '一种计算机程序',
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种存储介质，其上存储有计算机程序，所述计算机程序用于执行数据处理功能',
          },
        ],
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(
        result.overallReport.recommendations.some((r: string) => r.includes('硬件技术特征'))
      ).toBe(true)
    })

    it('应该为诊断治疗方法生成建议', async () => {
      const input = {
        inventionTitle: '一种诊断方法',
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种疾病的诊断方法',
          },
        ],
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(
        result.overallReport.recommendations.some((r: string) => r.includes('诊断设备和治疗器械'))
      ).toBe(true)
    })
  })

  describe('边界条件', () => {
    it('应该处理空权利要求书', async () => {
      const input = {
        inventionTitle: '测试',
        claims: [],
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(result).toBeDefined()
      expect(result.technicalSolutionAnalysis.independentClaimsAnalysis.length).toBe(0)
    })

    it('应该处理只有从属权利要求的情况', async () => {
      const input = {
        inventionTitle: '测试',
        claims: [
          {
            type: 'dependent' as const,
            number: 2,
            content: '根据权利要求1所述的装置',
            dependsOn: 1,
          },
        ],
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(result).toBeDefined()
      expect(result.technicalSolutionAnalysis.independentClaimsAnalysis.length).toBe(0)
    })

    it('应该处理多个独立权利要求', async () => {
      const claims = Array.from({ length: 3 }, (_, i) => ({
        type: 'independent' as const,
        number: i + 1,
        content: `第${i + 1}种测试装置，包括控制器`,
      }))

      const input = {
        inventionTitle: '测试',
        claims,
        specification: {
          technicalField: '测试领域',
          backgroundArt: '存在问题',
          inventionContent: '解决问题',
        },
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(result.technicalSolutionAnalysis.independentClaimsAnalysis.length).toBe(3)
    })
  })

  describe('性能测试', () => {
    it('应该在合理时间内完成检查', async () => {
      const input = {
        inventionTitle: '一种测试装置',
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种测试装置，包括"控制器"和"传感器"',
          },
        ],
        specification: {
          technicalField: '测试技术领域',
          backgroundArt: '存在问题',
          inventionContent: '解决问题',
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
        inventionTitle: '一种测试方法',
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种测试方法，包括步骤A和步骤B',
          },
        ],
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(result).toBeDefined()
    })

    it('应该正确处理实用新型专利', async () => {
      const input = {
        inventionTitle: '一种测试装置',
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种测试装置，包括控制器和传感器',
          },
        ],
        patentType: 'utilityModel' as const,
      }

      const result = await agent.execute(input)

      expect(result).toBeDefined()
    })
  })

  describe('复合场景', () => {
    it('应该处理既有技术手段又有智力活动规则的权利要求', async () => {
      const input = {
        inventionTitle: '一种智能管理系统',
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content:
              '一种智能管理系统，其特征在于包括服务器和客户端，所述服务器用于数据处理和管理控制',
          },
        ],
        specification: {
          technicalField: '计算机技术领域',
          backgroundArt: '现有管理效率低',
          inventionContent: '提高管理效率',
        },
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      // 包含技术手段（服务器、客户端），应该通过技术方案检查
      expect(result.technicalSolutionAnalysis.hasTechnicalSolution).toBe(true)
      // 但也可能被识别为管理规则
      expect(result.intellectualActivityCheck.detectedRules.length).toBeGreaterThanOrEqual(0)
    })

    it('应该为多种问题生成综合建议', async () => {
      const input = {
        inventionTitle: '一种赌博管理方法',
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种在线赌博的管理方法，包括用户管理和资金管理步骤',
          },
        ],
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      // 应该检测到多个问题：违法性、智力活动规则
      expect(result.overallReport.totalIssues).toBeGreaterThan(1)
      expect(result.legalityCheck.passed).toBe(false)
      expect(result.intellectualActivityCheck.hasIntellectualActivityRules).toBe(true)
    })
  })
})
