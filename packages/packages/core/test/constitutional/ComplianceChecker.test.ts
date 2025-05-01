import { describe, it, expect } from 'vitest'
import { ComplianceChecker } from '../../src/constitutional/ComplianceChecker.js'
import { ViolationSeverity } from '../../src/constitutional/types.js'

describe('ComplianceChecker', () => {
  const mockPrinciples = [
    {
      id: 'p1',
      name: '原则1',
      description: '描述1',
      priority: 10,
      checkFunction: async (content: string) => {
        if (content.includes('禁止')) {
          return {
            violations: [{ severity: ViolationSeverity.HIGH, message: '违规' }],
            warnings: [],
          }
        }
        return { violations: [], warnings: [] }
      },
    },
    {
      id: 'p2',
      name: '原则2',
      description: '描述2',
      priority: 5,
      checkFunction: async (content: string) => {
        if (content.includes('警告')) {
          return {
            violations: [],
            warnings: [{ message: '警告' }],
          }
        }
        return { violations: [], warnings: [] }
      },
    },
  ]

  const mockConfig = {
    enabledPrinciples: [],
    maxConcurrentChecks: 2,
    defaultSeverity: ViolationSeverity.MEDIUM,
  }

  describe('constructor', () => {
    it('应启用所有原则', () => {
      const checker = new ComplianceChecker(mockPrinciples as any, mockConfig)
      expect(checker).toBeDefined()
    })

    it('应只启用指定原则', () => {
      const checker = new ComplianceChecker(mockPrinciples as any, {
        ...mockConfig,
        enabledPrinciples: ['p1'],
      })
      expect(checker).toBeDefined()
    })
  })

  describe('checkCompliance', () => {
    it('应检查合规性', async () => {
      const checker = new ComplianceChecker(mockPrinciples as any, mockConfig)
      const report = await checker.checkCompliance('测试内容')

      expect(report).toBeDefined()
      expect(report.overallCompliant).toBeDefined()
    })

    it('应检测违规', async () => {
      const checker = new ComplianceChecker(mockPrinciples as any, mockConfig)
      const report = await checker.checkCompliance('这是禁止的内容')

      expect(report).toBeDefined()
      expect(report.violations.length).toBeGreaterThan(0)
    })

    it('应检测警告', async () => {
      const checker = new ComplianceChecker(mockPrinciples as any, mockConfig)
      const report = await checker.checkCompliance('这是警告的内容')

      expect(report).toBeDefined()
      expect(report.warnings.length).toBeGreaterThan(0)
    })

    it('应生成统计信息', async () => {
      const checker = new ComplianceChecker(mockPrinciples as any, mockConfig)
      const report = await checker.checkCompliance('这是禁止和警告的内容')

      expect(report.statistics.length).toBeGreaterThan(0)
    })
  })
})
