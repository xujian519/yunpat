import { describe, it, expect, beforeEach, vi } from 'vitest'
import { UnityChecker } from '../src/UnityChecker.js'

const mockContext = {
  registry: {} as any,
  llm: {} as any,
  memory: {} as any,
  eventBus: {
    publish: vi.fn(),
  } as any,
}

describe('UnityChecker', () => {
  let agent: UnityChecker

  beforeEach(() => {
    agent = new UnityChecker({
      name: 'test-unity-checker',
      description: '测试单一性检查Agent',
      eventBus: mockContext.eventBus,
      memory: mockContext.memory,
      tools: mockContext.registry,
      llm: mockContext.llm,
    })
  })

  describe('初始化', () => {
    it('应该成功初始化', () => {
      expect(agent).toBeDefined()
      expect(agent.name).toBe('test-unity-checker')
    })
  })

  describe('技术特征分析', () => {
    it('应该提取引号中的技术特征', async () => {
      const input = {
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

      expect(result.featureAnalysis.independentClaimsAnalysis.length).toBe(1)
      expect(
        result.featureAnalysis.independentClaimsAnalysis[0].technicalFeatures.some(
          (f: any) => f.content === '控制器'
        )
      ).toBe(true)
      expect(
        result.featureAnalysis.independentClaimsAnalysis[0].technicalFeatures.some(
          (f: any) => f.content === '传感器'
        )
      ).toBe(true)
    })

    it('应该提取组件特征', async () => {
      const input = {
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种测试装置，包括"处理单元"和"存储模块"',
          },
        ],
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(
        result.featureAnalysis.independentClaimsAnalysis[0].technicalFeatures.length
      ).toBeGreaterThan(0)
    })

    it('应该推断技术领域', async () => {
      const input = {
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种电子装置，包括电路板和芯片',
          },
        ],
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(result.featureAnalysis.independentClaimsAnalysis[0].technicalField).toBe('电子技术')
    })
  })

  describe('共同特征识别', () => {
    it('应该识别多个独立权利要求的共同特征', async () => {
      const input = {
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种测试装置，其特征在于包括"控制器"和"传感器"',
          },
          {
            type: 'independent' as const,
            number: 2,
            content: '一种测试方法，其特征在于使用"控制器"控制"传感器"',
          },
        ],
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(result.featureAnalysis.commonFeatures.length).toBeGreaterThan(0)
      expect(result.featureAnalysis.commonFeatures).toContain('控制器')
      expect(result.featureAnalysis.commonFeatures).toContain('传感器')
    })

    it('应该识别不出共同特征当权利要求无关时', async () => {
      const input = {
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种电子装置，包括芯片和电路',
          },
          {
            type: 'independent' as const,
            number: 2,
            content: '一种机械装置，包括齿轮和杠杆',
          },
        ],
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(result.featureAnalysis.commonFeatures.length).toBe(0)
    })
  })

  describe('相应特征识别', () => {
    it('应该识别相应特征', async () => {
      const input = {
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种测试装置，包括"传感器"',
          },
          {
            type: 'independent' as const,
            number: 2,
            content: '一种测试方法，使用"传感器单元"',
          },
        ],
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      // "传感器"和"传感器单元"应该被识别为相应特征（一个包含另一个）
      expect(result.featureAnalysis.correspondingFeatures.length).toBeGreaterThan(0)
    })
  })

  describe('单一性检查（第43条）', () => {
    it('单个独立权利要求应该自动具备单一性', async () => {
      const input = {
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种测试装置，包括控制器',
          },
          {
            type: 'dependent' as const,
            number: 2,
            content: '根据权利要求1所述的测试装置，其特征在于所述控制器为单片机',
            dependsOn: 1,
          },
        ],
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(result.rule43_unity.passed).toBe(true)
      expect(result.unityAnalysis.hasUnity).toBe(true)
    })

    it('具有共同特征的多个独立权利要求应该具备单一性', async () => {
      const input = {
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种测试装置，包括"控制器"和"传感器"',
          },
          {
            type: 'independent' as const,
            number: 2,
            content: '一种测试方法，使用"控制器"控制"传感器"',
          },
        ],
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(result.rule43_unity.passed).toBe(true)
      expect(result.unityAnalysis.hasUnity).toBe(true)
    })

    it('缺乏共同特征的多个独立权利要求不应该具备单一性', async () => {
      const input = {
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种电子装置，包括芯片',
          },
          {
            type: 'independent' as const,
            number: 2,
            content: '一种机械装置，包括齿轮',
          },
        ],
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(result.rule43_unity.passed).toBe(false)
      expect(result.unityAnalysis.hasUnity).toBe(false)
      expect(result.rule43_unity.issues.length).toBe(2)
    })
  })

  describe('总的发明构思（第44条）', () => {
    it('单个独立权利要求应该自动有总的发明构思', async () => {
      const input = {
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

      expect(result.rule44_generalConcept.passed).toBe(true)
      expect(result.rule44_generalConcept.hasGeneralConcept).toBe(true)
      expect(result.rule44_generalConcept.generalConcept).toBeDefined()
    })

    it('具有共同特征的多个独立权利要求应该有总的发明构思', async () => {
      const input = {
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种测试装置，包括"控制器"',
          },
          {
            type: 'independent' as const,
            number: 2,
            content: '一种测试方法，使用"控制器"',
          },
        ],
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(result.rule44_generalConcept.hasGeneralConcept).toBe(true)
      expect(result.rule44_generalConcept.generalConcept).toContain('控制器')
    })

    it('缺乏共同特征的多个独立权利要求不应该有总的发明构思', async () => {
      const input = {
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种电子装置',
          },
          {
            type: 'independent' as const,
            number: 2,
            content: '一种机械装置',
          },
        ],
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(result.rule44_generalConcept.hasGeneralConcept).toBe(false)
      expect(result.rule44_generalConcept.passed).toBe(false)
    })
  })

  describe('技术关联性评估', () => {
    it('应该计算技术关联性评分', async () => {
      const input = {
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种测试装置，包括"控制器"和"传感器"',
          },
          {
            type: 'independent' as const,
            number: 2,
            content: '一种测试方法，使用"控制器"控制"传感器"',
          },
        ],
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(result.unityAnalysis.technicalCorrelationScore).toBeGreaterThan(0)
      expect(result.unityAnalysis.technicalCorrelationScore).toBeLessThanOrEqual(1)
    })

    it('共同特征越多关联性评分越高', async () => {
      const input1 = {
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种装置，包括"A"',
          },
          {
            type: 'independent' as const,
            number: 2,
            content: '一种方法，使用"A"',
          },
        ],
        patentType: 'invention' as const,
      }

      const input2 = {
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种装置，包括"A"和"B"和"C"',
          },
          {
            type: 'independent' as const,
            number: 2,
            content: '一种方法，使用"A"和"B"和"C"',
          },
        ],
        patentType: 'invention' as const,
      }

      const result1 = await agent.execute(input1)
      const result2 = await agent.execute(input2)

      expect(result2.unityAnalysis.technicalCorrelationScore).toBeGreaterThanOrEqual(
        result1.unityAnalysis.technicalCorrelationScore
      )
    })
  })

  describe('总体报告', () => {
    it('应该正确计算单一性评分', async () => {
      const input = {
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种测试装置，包括"控制器"',
          },
          {
            type: 'independent' as const,
            number: 2,
            content: '一种测试方法，使用"控制器"',
          },
        ],
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(result.overallReport.unityScore).toBeGreaterThan(0)
      expect(result.overallReport.unityScore).toBeLessThanOrEqual(100)
    })

    it('具备单一性时应该通过检查', async () => {
      const input = {
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种测试装置，包括"控制器"',
          },
          {
            type: 'independent' as const,
            number: 2,
            content: '一种测试方法，使用"控制器"',
          },
        ],
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(result.overallReport.passed).toBe(true)
      expect(result.overallReport.totalIssues).toBe(0)
    })

    it('不具备单一性时应该生成修改建议', async () => {
      const input = {
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种电子装置',
          },
          {
            type: 'independent' as const,
            number: 2,
            content: '一种机械装置',
          },
        ],
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(result.overallReport.passed).toBe(false)
      expect(result.overallReport.recommendations.length).toBeGreaterThan(0)
      expect(result.overallReport.recommendations.some((r: string) => r.includes('分案'))).toBe(
        true
      )
    })

    it('高单一性评分应该给予正面建议', async () => {
      const input = {
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种测试装置，包括"控制器"和"传感器"和"执行器"',
          },
          {
            type: 'independent' as const,
            number: 2,
            content: '一种测试方法，使用"控制器"、"传感器"和"执行器"',
          },
        ],
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(result.overallReport.unityScore).toBeGreaterThanOrEqual(80)
      expect(result.overallReport.recommendations.some((r: string) => r.includes('良好'))).toBe(
        true
      )
    })
  })

  describe('边界条件', () => {
    it('应该拒绝空权利要求书', async () => {
      const input = {
        claims: [],
        patentType: 'invention' as const,
      }

      await expect(agent.execute(input)).rejects.toThrow('权利要求不能为空')
    })

    it('应该处理只有从属权利要求的情况', async () => {
      const input = {
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
      expect(result.featureAnalysis.independentClaimsAnalysis.length).toBe(0)
    })

    it('应该处理多个独立权利要求', async () => {
      const claims = Array.from({ length: 5 }, (_, i) => ({
        type: 'independent' as const,
        number: i + 1,
        content: `第${i + 1}种测试装置，包括"控制器"`,
      }))

      const input = {
        claims,
        patentType: 'invention' as const,
      }

      const result = await agent.execute(input)

      expect(result.featureAnalysis.independentClaimsAnalysis.length).toBe(5)
    })
  })

  describe('性能测试', () => {
    it('应该在合理时间内完成检查', async () => {
      const input = {
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种测试装置，包括"控制器"和"传感器"',
          },
          {
            type: 'independent' as const,
            number: 2,
            content: '一种测试方法，使用"控制器"控制"传感器"',
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

  describe('从属权利要求处理', () => {
    it('应该正确处理包含从属权利要求的权利要求书', async () => {
      const input = {
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种测试装置，包括"控制器"',
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
      }

      const result = await agent.execute(input)

      expect(result).toBeDefined()
      expect(result.featureAnalysis.independentClaimsAnalysis.length).toBe(1)
      expect(result.rule43_unity.passed).toBe(true)
    })
  })

  describe('不同专利类型', () => {
    it('应该正确处理发明专利', async () => {
      const input = {
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
      expect(result.featureAnalysis.independentClaimsAnalysis.length).toBe(1)
    })

    it('应该正确处理实用新型专利', async () => {
      const input = {
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种测试装置，包括控制器和传感器，具有特定的结构',
          },
        ],
        patentType: 'utilityModel' as const,
      }

      const result = await agent.execute(input)

      expect(result).toBeDefined()
      expect(result.featureAnalysis.independentClaimsAnalysis.length).toBe(1)
    })
  })
})
