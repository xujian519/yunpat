/**
 * 专利搜索工具测试
 */

import { describe, it, expect } from 'vitest'
import { PatentSearchTool } from '../src/tools/index.js'

describe('PatentSearchTool', () => {
  const tool = new PatentSearchTool()

  it('should have correct metadata', () => {
    expect(tool.metadata.name).toBe('patent_search')
    expect(tool.metadata.description).toContain('专利检索')
  })

  it('should execute patent search successfully', async () => {
    const input = {
      inventionTitle: '一种基于深度学习的图像识别方法',
      technicalField: '人工智能',
      technicalProblem: '现有图像识别方法准确率低',
      technicalSolution: '使用卷积神经网络进行图像识别',
      keyFeatures: ['深度学习', '图像识别', 'CNN'],
      patentType: 'invention' as const,
    }

    const result = await tool.execute(input, {})

    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()
    expect(result.data?.strategy).toBeDefined()
    expect(result.data?.results).toBeInstanceOf(Array)
  })

  it('should validate input correctly', async () => {
    const invalidInput = {
      inventionTitle: '',
      technicalField: '',
      technicalProblem: '',
      technicalSolution: '',
      keyFeatures: [],
    }

    const result = await tool.execute(invalidInput, {})

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })
})
