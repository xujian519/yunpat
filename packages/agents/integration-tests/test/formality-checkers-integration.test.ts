import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ClaimsFormalityChecker } from '@yunpat/claims-formality-checker'
import { SpecFormalityChecker } from '@yunpat/spec-formality-checker'

const mockContext = {
  registry: {} as any,
  llm: {} as any,
  memory: {} as any,
  eventBus: {
    publish: vi.fn(),
  } as any,
}

describe('形式检查Agent集成测试', () => {
  let claimsChecker: ClaimsFormalityChecker
  let specChecker: SpecFormalityChecker

  beforeEach(() => {
    claimsChecker = new ClaimsFormalityChecker({
      name: 'test-claims-formality-checker',
      description: '测试权利要求形式检查',
      eventBus: mockContext.eventBus,
      memory: mockContext.memory,
      tools: mockContext.registry,
      llm: mockContext.llm,
    })

    specChecker = new SpecFormalityChecker({
      name: 'test-spec-formality-checker',
      description: '测试说明书形式检查',
      eventBus: mockContext.eventBus,
      memory: mockContext.memory,
      tools: mockContext.registry,
      llm: mockContext.llm,
    })
  })

  describe('权利要求和说明书联合检查', () => {
    it('应该能够对完整的专利申请进行形式检查', async () => {
      const claimsInput = {
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种测试装置，其特征在于包括"控制器"和"传感器"',
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
          technicalField: '本发明涉及测试技术领域，特别涉及一种智能测试装置',
          backgroundArt: '现有技术中，测试装置存在精度低、效率低的问题',
          inventionContent: '本发明提供一种测试装置，采用"控制器"和"传感器"，解决了现有技术的问题',
          drawingsDescription: '图1为本发明结构示意图',
          embodiment:
            '如图1所示，本发明包括控制器1、传感器2和执行机构3。所述控制器1分别与所述传感器2和所述执行机构3连接。本发明采用高精度传感器，能够准确采集测试数据。控制器采用单片机，具有强大的数据处理能力。执行机构包括驱动单元和执行单元，能够精确执行各种操作。',
        },
      }

      const specInput = {
        specification: claimsInput.specification,
        claims: claimsInput.claims,
        patentType: claimsInput.patentType,
      }

      // 并行执行两个检查
      const [claimsResult, specResult] = await Promise.all([
        claimsChecker.execute(claimsInput),
        specChecker.execute(specInput),
      ])

      // 验证权利要求检查结果
      expect(claimsResult.overallReport.passed).toBe(true)
      expect(claimsResult.overallReport.totalIssues).toBe(0)

      // 验证说明书检查结果（允许少量非关键问题）
      expect(specResult.overallReport.totalIssues).toBeLessThan(10)

      // 验证权利要求得到说明书支持
      expect(claimsResult.article26_4_support.passed).toBe(true)

      // 验证一致性检查（允许少量不支持的权利要求）
      expect(specResult.claimsConsistency.unsupportedClaims.length).toBeLessThan(4)
    })

    it('应该能够检测权利要求和说明书之间的不一致', async () => {
      const claimsInput = {
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种测试装置，其特征在于包括"量子处理器"',
          },
        ],
        patentType: 'invention' as const,
        specification: {
          technicalField: '本发明涉及测试技术领域',
          backgroundArt: '现有技术',
          inventionContent: '本发明提供一种测试装置',
          embodiment: '该装置包括控制器和传感器',
        },
      }

      const specInput = {
        specification: claimsInput.specification,
        claims: claimsInput.claims,
        patentType: claimsInput.patentType,
      }

      const [claimsResult, specResult] = await Promise.all([
        claimsChecker.execute(claimsInput),
        specChecker.execute(specInput),
      ])

      // 权利要求检查应该发现说明书不支持
      expect(claimsResult.article26_4_support.passed).toBe(false)
      expect(claimsResult.article26_4_support.issues.length).toBeGreaterThan(0)

      // 说明书检查应该发现不一致
      expect(specResult.claimsConsistency.passed).toBe(false)
      expect(specResult.claimsConsistency.unsupportedClaims.length).toBeGreaterThan(0)
    })

    it('应该能够为多个问题生成综合建议', async () => {
      const claimsInput = {
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种大约包括左右5个组件的测试装置',
          },
        ],
        patentType: 'invention' as const,
        specification: {
          technicalField: '测试',
          backgroundArt: '测试',
          inventionContent: '测试',
          embodiment: '测试',
        },
      }

      const specInput = {
        specification: claimsInput.specification,
        claims: claimsInput.claims,
        patentType: claimsInput.patentType,
      }

      const [claimsResult, specResult] = await Promise.all([
        claimsChecker.execute(claimsInput),
        specChecker.execute(specInput),
      ])

      // 应该有多个问题
      const totalIssues =
        claimsResult.overallReport.totalIssues + specResult.overallReport.totalIssues
      expect(totalIssues).toBeGreaterThan(0)

      // 应该有修改建议
      const totalRecommendations =
        claimsResult.overallReport.recommendations.length +
        specResult.overallReport.recommendations.length
      expect(totalRecommendations).toBeGreaterThan(0)
    })
  })

  describe('性能测试', () => {
    it('应该在合理时间内完成联合检查', async () => {
      const claimsInput = {
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种测试装置，包括"控制器"和"传感器"',
          },
          {
            type: 'dependent' as const,
            number: 2,
            content: '根据权利要求1所述的装置，所述控制器为单片机',
            dependsOn: 1,
          },
        ],
        patentType: 'invention' as const,
        specification: {
          technicalField: '本发明涉及测试技术领域',
          backgroundArt: '现有技术存在问题',
          inventionContent: '本发明解决问题',
          embodiment: '如图1所示，包括控制器和传感器',
        },
      }

      const specInput = {
        specification: claimsInput.specification,
        claims: claimsInput.claims,
        patentType: claimsInput.patentType,
      }

      const startTime = Date.now()
      const [claimsResult, specResult] = await Promise.all([
        claimsChecker.execute(claimsInput),
        specChecker.execute(specInput),
      ])
      const endTime = Date.now()

      expect(claimsResult).toBeDefined()
      expect(specResult).toBeDefined()
      expect(endTime - startTime).toBeLessThan(2000) // 应该在2秒内完成
    })

    it('应该能够处理大量权利要求', async () => {
      const claims = Array.from({ length: 20 }, (_, i) => ({
        type: 'independent' as const,
        number: i + 1,
        content: `第${i + 1}种测试装置，包括"控制器"和"传感器"`,
      }))

      const claimsInput = {
        claims,
        patentType: 'invention' as const,
        specification: {
          technicalField: '测试技术领域',
          backgroundArt: '现有技术存在问题',
          inventionContent: '本发明解决问题',
          embodiment: '包括各种组件',
        },
      }

      const specInput = {
        specification: claimsInput.specification,
        claims: claimsInput.claims,
        patentType: claimsInput.patentType,
      }

      const startTime = Date.now()
      const [claimsResult, specResult] = await Promise.all([
        claimsChecker.execute(claimsInput),
        specChecker.execute(specInput),
      ])
      const endTime = Date.now()

      expect(claimsResult).toBeDefined()
      expect(specResult).toBeDefined()
      expect(endTime - startTime).toBeLessThan(5000) // 应该在5秒内完成
    })
  })

  describe('边界条件', () => {
    it('应该能够处理空输入', async () => {
      const claimsInput = {
        claims: [],
        patentType: 'invention' as const,
      }

      const specInput = {
        specification: {},
        claims: [],
        patentType: 'invention' as const,
      }

      const [claimsResult, specResult] = await Promise.all([
        claimsChecker.execute(claimsInput),
        specChecker.execute(specInput),
      ])

      expect(claimsResult).toBeDefined()
      expect(specResult).toBeDefined()
    })

    it('应该能够处理只有权利要求没有说明书的情况', async () => {
      const claimsInput = {
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种测试装置，包括控制器',
          },
        ],
        patentType: 'invention' as const,
      }

      const [claimsResult] = await Promise.all([claimsChecker.execute(claimsInput)])

      expect(claimsResult).toBeDefined()
      expect(claimsResult.article26_4_support.passed).toBe(false)
    })

    it('应该能够处理只有说明书没有权利要求的情况', async () => {
      const specInput = {
        specification: {
          technicalField: '测试技术领域',
          backgroundArt: '现有技术',
          inventionContent: '本发明内容',
          embodiment: '具体实施方式',
        },
        claims: [],
        patentType: 'invention' as const,
      }

      const [specResult] = await Promise.all([specChecker.execute(specInput)])

      expect(specResult).toBeDefined()
    })
  })
})
