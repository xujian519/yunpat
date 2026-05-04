import { describe, it, expect } from 'vitest'
import { ClaimsFormalityChecker } from '@yunpat/claims-formality-checker'
import { SpecFormalityChecker } from '@yunpat/spec-formality-checker'
import { UnityChecker } from '@yunpat/unity-checker'
import { SubjectMatterChecker } from '@yunpat/subject-matter-checker'

const mockContext = {
  registry: {} as any,
  llm: {} as any,
  memory: {} as any,
  eventBus: {
    publish: () => {},
  } as any,
}

describe('性能基准测试 - Agent执行效率', () => {
  describe('小规模专利申请', () => {
    it('ClaimsFormalityChecker应在100ms内完成', async () => {
      const checker = new ClaimsFormalityChecker({
        name: 'performance-test',
        description: '性能测试',
        eventBus: mockContext.eventBus,
        memory: mockContext.memory,
        tools: mockContext.registry,
        llm: mockContext.llm,
      })

      const input = {
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种测试装置，包括控制器和传感器',
          },
        ],
        patentType: 'invention' as const,
        specification: {
          technicalField: '测试技术领域',
          backgroundArt: '现有技术',
          inventionContent: '本发明内容',
          embodiment: '具体实施方式',
        },
      }

      const startTime = Date.now()
      await checker.execute(input)
      const endTime = Date.now()

      expect(endTime - startTime).toBeLessThan(100)
    })

    it('SpecFormalityChecker应在100ms内完成', async () => {
      const checker = new SpecFormalityChecker({
        name: 'performance-test',
        description: '性能测试',
        eventBus: mockContext.eventBus,
        memory: mockContext.memory,
        tools: mockContext.registry,
        llm: mockContext.llm,
      })

      const input = {
        specification: {
          technicalField: '测试技术领域',
          backgroundArt: '现有技术',
          inventionContent: '本发明内容',
          embodiment: '具体实施方式',
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
      await checker.execute(input)
      const endTime = Date.now()

      expect(endTime - startTime).toBeLessThan(100)
    })

    it('UnityChecker应在100ms内完成', async () => {
      const checker = new UnityChecker({
        name: 'performance-test',
        description: '性能测试',
        eventBus: mockContext.eventBus,
        memory: mockContext.memory,
        tools: mockContext.registry,
        llm: mockContext.llm,
      })

      const input = {
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种测试装置，包括"控制器"和"传感器"',
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

      const startTime = Date.now()
      await checker.execute(input)
      const endTime = Date.now()

      expect(endTime - startTime).toBeLessThan(100)
    })

    it('SubjectMatterChecker应在100ms内完成', async () => {
      const checker = new SubjectMatterChecker({
        name: 'performance-test',
        description: '性能测试',
        eventBus: mockContext.eventBus,
        memory: mockContext.memory,
        tools: mockContext.registry,
        llm: mockContext.llm,
      })

      const input = {
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种测试装置，包括控制器和传感器，用于检测产品参数',
          },
        ],
        patentType: 'invention' as const,
        inventionTitle: '测试装置',
      }

      const startTime = Date.now()
      await checker.execute(input)
      const endTime = Date.now()

      expect(endTime - startTime).toBeLessThan(100)
    })
  })

  describe('中等规模专利申请（10项权利要求）', () => {
    const mediumClaims = Array.from({ length: 10 }, (_, i) => ({
      type: i % 3 === 0 ? ('independent' as const) : ('dependent' as const),
      number: i + 1,
      content: `第${i + 1}项权利要求，包括"控制器"和"传感器"等技术特征`,
      dependsOn: i % 3 === 0 ? undefined : i - Math.floor(i / 3),
    }))

    it('ClaimsFormalityChecker应在200ms内完成', async () => {
      const checker = new ClaimsFormalityChecker({
        name: 'performance-test',
        description: '性能测试',
        eventBus: mockContext.eventBus,
        memory: mockContext.memory,
        tools: mockContext.registry,
        llm: mockContext.llm,
      })

      const input = {
        claims: mediumClaims,
        patentType: 'invention' as const,
        specification: {
          technicalField: '测试技术领域',
          backgroundArt: '现有技术',
          inventionContent: '本发明内容',
          embodiment: '具体实施方式',
        },
      }

      const startTime = Date.now()
      await checker.execute(input)
      const endTime = Date.now()

      expect(endTime - startTime).toBeLessThan(200)
    })

    it('UnityChecker应在200ms内完成', async () => {
      const checker = new UnityChecker({
        name: 'performance-test',
        description: '性能测试',
        eventBus: mockContext.eventBus,
        memory: mockContext.memory,
        tools: mockContext.registry,
        llm: mockContext.llm,
      })

      const input = {
        claims: mediumClaims,
        patentType: 'invention' as const,
      }

      const startTime = Date.now()
      await checker.execute(input)
      const endTime = Date.now()

      expect(endTime - startTime).toBeLessThan(200)
    })
  })

  describe('大规模专利申请（50项权利要求）', () => {
    const largeClaims = Array.from({ length: 50 }, (_, i) => ({
      type: i % 5 === 0 ? ('independent' as const) : ('dependent' as const),
      number: i + 1,
      content: `第${i + 1}项权利要求，包括"控制器"、"传感器"和"执行机构"等多个技术特征`,
      dependsOn: i % 5 === 0 ? undefined : i - Math.floor(i / 5),
    }))

    it('ClaimsFormalityChecker应在500ms内完成', async () => {
      const checker = new ClaimsFormalityChecker({
        name: 'performance-test',
        description: '性能测试',
        eventBus: mockContext.eventBus,
        memory: mockContext.memory,
        tools: mockContext.registry,
        llm: mockContext.llm,
      })

      const input = {
        claims: largeClaims,
        patentType: 'invention' as const,
        specification: {
          technicalField: '测试技术领域',
          backgroundArt: '现有技术',
          inventionContent: '本发明内容',
          embodiment: '具体实施方式',
        },
      }

      const startTime = Date.now()
      await checker.execute(input)
      const endTime = Date.now()

      expect(endTime - startTime).toBeLessThan(500)
    })

    it('UnityChecker应在500ms内完成', async () => {
      const checker = new UnityChecker({
        name: 'performance-test',
        description: '性能测试',
        eventBus: mockContext.eventBus,
        memory: mockContext.memory,
        tools: mockContext.registry,
        llm: mockContext.llm,
      })

      const input = {
        claims: largeClaims,
        patentType: 'invention' as const,
      }

      const startTime = Date.now()
      await checker.execute(input)
      const endTime = Date.now()

      expect(endTime - startTime).toBeLessThan(500)
    })
  })

  describe('Agent并行执行性能', () => {
    it('并行执行4个Agent应在300ms内完成', async () => {
      const claimsChecker = new ClaimsFormalityChecker({
        name: 'performance-test',
        description: '性能测试',
        eventBus: mockContext.eventBus,
        memory: mockContext.memory,
        tools: mockContext.registry,
        llm: mockContext.llm,
      })

      const specChecker = new SpecFormalityChecker({
        name: 'performance-test',
        description: '性能测试',
        eventBus: mockContext.eventBus,
        memory: mockContext.memory,
        tools: mockContext.registry,
        llm: mockContext.llm,
      })

      const unityChecker = new UnityChecker({
        name: 'performance-test',
        description: '性能测试',
        eventBus: mockContext.eventBus,
        memory: mockContext.memory,
        tools: mockContext.registry,
        llm: mockContext.llm,
      })

      const subjectChecker = new SubjectMatterChecker({
        name: 'performance-test',
        description: '性能测试',
        eventBus: mockContext.eventBus,
        memory: mockContext.memory,
        tools: mockContext.registry,
        llm: mockContext.llm,
      })

      const input = {
        claims: [
          {
            type: 'independent' as const,
            number: 1,
            content: '一种测试装置，包括"控制器"和"传感器"',
          },
        ],
        patentType: 'invention' as const,
        inventionTitle: '测试装置',
        specification: {
          technicalField: '测试技术领域',
          backgroundArt: '现有技术',
          inventionContent: '本发明内容',
          embodiment: '具体实施方式',
        },
      }

      const startTime = Date.now()
      await Promise.all([
        claimsChecker.execute(input),
        specChecker.execute({ ...input, claims: input.claims }),
        unityChecker.execute({ claims: input.claims, patentType: input.patentType }),
        subjectChecker.execute({
          claims: input.claims,
          patentType: input.patentType,
          inventionTitle: input.inventionTitle,
        }),
      ])
      const endTime = Date.now()

      expect(endTime - startTime).toBeLessThan(300)
    })
  })
})
