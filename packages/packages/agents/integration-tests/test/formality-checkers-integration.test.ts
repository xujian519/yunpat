import { describe, it, expect, beforeEach, vi } from 'vitest'
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
  let specChecker: SpecFormalityChecker

  beforeEach(() => {
    specChecker = new SpecFormalityChecker({
      name: 'test-spec-formality-checker',
      description: '测试说明书形式检查',
      eventBus: mockContext.eventBus,
      memory: mockContext.memory,
      tools: mockContext.registry,
      llm: mockContext.llm,
    })
  })

  describe('说明书形式检查', () => {
    it('应该能够对完整的专利申请进行说明书形式检查', async () => {
      const specInput = {
        specification: {
          technicalField: '本发明涉及测试技术领域，特别涉及一种智能测试装置',
          backgroundArt: '现有技术中，测试装置存在精度低、效率低的问题',
          inventionContent: '本发明提供一种测试装置，采用控制器和传感器，解决了现有技术的问题',
          drawingsDescription: '图1为本发明结构示意图',
          embodiment:
            '如图1所示，本发明包括控制器1、传感器2和执行机构3。所述控制器1分别与所述传感器2和所述执行机构3连接。',
        },
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种测试装置，其特征在于包括控制器和传感器',
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

      const specResult = await specChecker.execute(specInput)

      expect(specResult).toBeDefined()
      expect(specResult.overallReport.totalIssues).toBeLessThan(10)
      expect(specResult.claimsConsistency.unsupportedClaims.length).toBeLessThan(4)
    })

    it('应该能够检测说明书和权利要求之间的不一致', async () => {
      const specInput = {
        specification: {
          technicalField: '本发明涉及测试技术领域',
          backgroundArt: '现有技术',
          inventionContent: '本发明提供一种测试装置',
          embodiment: '该装置包括控制器和传感器',
        },
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种测试装置，其特征在于包括量子处理器',
          },
        ],
        patentType: 'invention' as const,
      }

      const specResult = await specChecker.execute(specInput)

      expect(specResult.claimsConsistency.passed).toBe(false)
      expect(specResult.claimsConsistency.unsupportedClaims.length).toBeGreaterThan(0)
    })

    it('应该在合理时间内完成检查', async () => {
      const specInput = {
        specification: {
          technicalField: '本发明涉及测试技术领域',
          backgroundArt: '现有技术存在问题',
          inventionContent: '本发明解决问题',
          embodiment: '如图1所示，包括控制器和传感器',
        },
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种测试装置，包括控制器和传感器',
          },
        ],
        patentType: 'invention' as const,
      }

      const startTime = Date.now()
      const specResult = await specChecker.execute(specInput)
      const endTime = Date.now()

      expect(specResult).toBeDefined()
      expect(endTime - startTime).toBeLessThan(2000)
    })

    it('应该能够处理空输入', async () => {
      const specInput = {
        specification: {},
        claims: [],
        patentType: 'invention' as const,
      }

      const specResult = await specChecker.execute(specInput)
      expect(specResult).toBeDefined()
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

      const specResult = await specChecker.execute(specInput)
      expect(specResult).toBeDefined()
    })
  })
})
