/**
 * MCP 工具测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { PatentSearchTool, ClaimsGeneratorTool, QualityCheckerTool } from '../src/tools/index.js'

describe('MCP Tools', () => {
  describe('PatentSearchTool', () => {
    let tool: PatentSearchTool

    beforeEach(() => {
      tool = new PatentSearchTool()
    })

    it('should execute patent search successfully', async () => {
      const input = {
        inventionTitle: '一种图像识别方法',
        technicalField: '人工智能',
        technicalProblem: '图像识别准确率低',
        technicalSolution: '使用深度学习进行图像识别',
        keyFeatures: ['深度学习', '图像识别', 'CNN'],
        patentType: 'invention',
      }

      const result = await tool.execute(input, {})

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data?.strategy).toBeDefined()
      expect(result.data?.results).toBeInstanceOf(Array)
    })

    it('should reject invalid input', async () => {
      const input = {
        inventionTitle: '',
        technicalField: '',
        technicalProblem: '',
        technicalSolution: '',
        keyFeatures: [],
      }

      const result = await tool.execute(input, {})

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('ClaimsGeneratorTool', () => {
    let tool: ClaimsGeneratorTool

    beforeEach(() => {
      tool = new ClaimsGeneratorTool()
    })

    it('should generate claims with all required fields', async () => {
      const input = {
        inventionTitle: '智能控制系统',
        technicalField: '自动化控制',
        technicalProblem: '响应速度慢',
        technicalSolution: '采用多传感器融合',
        beneficialEffects: '提高准确率',
        keyFeatures: ['传感器模块', '控制模块', '执行模块'],
        patentType: 'invention',
      }

      const result = await tool.execute(input, {})

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data?.claimsSet).toBeDefined()
      expect(result.data?.claimsSet.independent_claims).toBeInstanceOf(Array)
      expect(result.data?.claimsSet.independent_claims.length).toBeGreaterThan(0)
    })
  })

  describe('QualityCheckerTool', () => {
    let tool: QualityCheckerTool

    beforeEach(() => {
      tool = new QualityCheckerTool()
    })

    it('should check quality and return scores', async () => {
      const input = {
        inventionTitle: '测试发明',
        claims: {
          independentClaims: [
            {
              claimNumber: 1,
              fullText: '一种测试装置，其特征在于，包括组件A和组件B。',
              claimType: 'device',
              essentialFeatures: ['组件A', '组件B'],
            },
          ],
          dependentClaims: [],
        },
        specification: {
          technicalField: '测试领域',
          inventionContent: {
            technicalProblem: '测试问题',
            technicalSolution: '测试方案',
          },
          detailedDescription:
            '本实施例的测试装置包括组件A和组件B，组件A用于数据处理，组件B用于结果输出...',
        },
        patentType: 'invention',
        checkLevel: 2,
      }

      const result = await tool.execute(input, {})

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data?.overallScore).toBeGreaterThanOrEqual(0)
      expect(result.data?.formalCheck).toBeDefined()
    })
  })
})
