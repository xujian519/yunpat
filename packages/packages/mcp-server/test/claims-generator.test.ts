/**
 * 权利要求生成工具测试
 */

import { describe, it, expect } from 'vitest'
import { ClaimsGeneratorTool } from '../src/tools/index.js'

describe('ClaimsGeneratorTool', () => {
  const tool = new ClaimsGeneratorTool()

  it('should have correct metadata', () => {
    expect(tool.metadata.name).toBe('claims_generator')
    expect(tool.metadata.description).toContain('权利要求')
  })

  it('should generate claims successfully', async () => {
    const input = {
      inventionTitle: '一种图像识别方法',
      technicalField: '图像处理技术领域',
      technicalProblem: '现有图像识别方法准确率不高的问题',
      technicalSolution: '采用深度卷积神经网络进行特征提取和分类',
      beneficialEffects: '提高图像识别准确率，减少计算量',
      keyFeatures: ['使用残差网络结构', '引入注意力机制', '采用多尺度特征融合'],
      patentType: 'invention' as const,
      enableDependentClaims: true,
      dependentClaimCount: 5,
    }

    const result = await tool.execute(input, {})

    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()
    expect(result.data?.claimsSet).toBeDefined()
    expect(result.data?.claimsSet.independent_claims).toBeInstanceOf(Array)
    expect(result.data?.claimsSet.independent_claims.length).toBeGreaterThan(0)
    expect(result.data?.fullClaimsText).toBeDefined()
  })

  it('should generate independent claim with correct structure', async () => {
    const input = {
      inventionTitle: '一种数据处理方法',
      technicalField: '数据处理技术领域',
      technicalProblem: '数据处理效率低的问题',
      technicalSolution: '采用并行处理架构',
      beneficialEffects: '提高处理效率',
      keyFeatures: ['并行计算模块', '任务调度器'],
      patentType: 'invention' as const,
    }

    const result = await tool.execute(input, {})

    expect(result.success).toBe(true)
    const independentClaim = result.data?.claimsSet.independent_claims[0]
    expect(independentClaim).toBeDefined()
    expect(independentClaim.claimNumber).toBe(1)
    expect(independentClaim.preamble).toContain('一种')
    expect(independentClaim.transition).toBe('其特征在于')
  })
})
