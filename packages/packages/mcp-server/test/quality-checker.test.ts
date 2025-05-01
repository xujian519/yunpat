/**
 * 质量检查工具测试
 */

import { describe, it, expect } from 'vitest'
import { QualityCheckerTool } from '../src/tools/index.js'

describe('QualityCheckerTool', () => {
  const tool = new QualityCheckerTool()

  it('should have correct metadata', () => {
    expect(tool.metadata.name).toBe('quality_checker')
    expect(tool.metadata.description).toContain('质量检查')
  })

  it('should check quality successfully', async () => {
    const input = {
      inventionTitle: '一种智能控制系统',
      claims: {
        independentClaims: [
          {
            claimNumber: 1,
            fullText:
              '一种智能控制系统，其特征在于，包括：传感器模块，用于采集环境数据；控制模块，根据环境数据进行控制决策；执行模块，执行控制指令。',
            claimType: 'device',
            essentialFeatures: ['传感器模块', '控制模块', '执行模块'],
          },
        ],
        dependentClaims: [
          {
            claimNumber: 2,
            content:
              '根据权利要求1所述的智能控制系统，其特征在于，所述传感器模块包括温度传感器和湿度传感器。',
            parentClaim: 1,
            additionalFeatures: ['温度传感器', '湿度传感器'],
          },
        ],
      },
      specification: {
        technicalField: '本发明涉及自动化控制技术领域，具体涉及一种智能控制系统。',
        backgroundArt: '现有控制系统存在响应速度慢、控制精度低的问题。',
        inventionContent: {
          technicalProblem: '响应速度慢、控制精度低',
          technicalSolution: '多传感器融合和智能算法实现精确控制',
          beneficialEffects: '提高控制精度和响应速度',
        },
        detailedDescription:
          '如图1所示，本实施例的智能控制系统包括传感器模块1、控制模块2和执行模块3。传感器模块1包括温度传感器11和湿度传感器12，控制模块2采用深度学习算法进行数据分析和决策...',
      },
      patentType: 'invention' as const,
      checkLevel: 2 as const,
    }

    const result = await tool.execute(input, {})

    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()
    expect(result.data?.overallScore).toBeGreaterThanOrEqual(0)
    expect(result.data?.overallScore).toBeLessThanOrEqual(100)
  })

  it('should detect missing independent claim', async () => {
    const input = {
      inventionTitle: '测试专利',
      claims: {
        independentClaims: [],
        dependentClaims: [
          {
            claimNumber: 1,
            content: '根据权利要求1所述的方法，其特征在于...',
            parentClaim: 0,
          },
        ],
      },
      specification: {
        technicalField: '测试领域',
      },
      patentType: 'invention' as const,
    }

    const result = await tool.execute(input, {})

    expect(result.success).toBe(true)
    expect(result.data?.formalCheck).toBeDefined()
    const hasClaimIssue = result.data?.formalCheck.errors.some(
      (e: any) => e.type === '权利要求' || e.severity === 'critical'
    )
    expect(hasClaimIssue).toBe(true)
  })
})
