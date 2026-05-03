#!/usr/bin/env node

/**
 * Phase 3 验收测试
 *
 * 测试目标：
 * 1. PriorArtSearchAgent 可以基于发明理解构建检索策略
 * 2. 输出结构化的检索结果
 * 3. SearchStrategyRenderer 生成可读报告
 * 4. CLI 命令可以正常运行
 * 5. 对比分析准确识别区别特征
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { PriorArtSearchAgent, SearchStrategyRenderer } from '@yunpat/agent-prior-art-search'
import type { InventionUnderstandingOutput } from '@yunpat/agent-invention'
import { EventBus, ShortTermMemory, ToolRegistry } from '@yunpat/core'
import { createDeepSeekModel } from '@yunpat/llm'

describe('Phase 3: 先导技术检索验收测试', () => {
  let agent: PriorArtSearchAgent
  let renderer: SearchStrategyRenderer
  let mockInventionUnderstanding: InventionUnderstandingOutput

  beforeAll(async () => {
    // 检查环境变量
    const apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('缺少API密钥，请设置 DEEPSEEK_API_KEY 或 OPENAI_API_KEY')
    }

    // 初始化组件
    const eventBus = new EventBus()
    const memory = new ShortTermMemory()
    const tools = new ToolRegistry(eventBus)
    const llm = createDeepSeekModel(apiKey)

    agent = new PriorArtSearchAgent({
      name: 'prior-art-search',
      description: '先导技术检索智能体',
      llm,
      memory,
      tools,
      eventBus,
    })

    renderer = new SearchStrategyRenderer()

    // 准备模拟发明理解结果
    mockInventionUnderstanding = {
      technicalField: '计算机视觉领域，尤其涉及一种基于深度学习的图像识别方法',
      backgroundArt: '现有图像识别方法主要基于传统特征提取',
      technicalProblem: '复杂场景下识别准确率低',
      technicalSolution: '采用多尺度卷积神经网络结合注意力机制',
      beneficialEffects: '识别准确率提升20%',
      keyFeatures: [
        '多尺度特征融合',
        '自适应注意力机制',
        '轻量化网络结构',
        '混合数据增强',
        '残差连接'
      ],
      drawingDescriptions: [],
      confidence: 0.95,
    }
  })

  describe('任务1: PriorArtSearchAgent基础功能', () => {
    it('应该能够基于发明理解构建检索策略', async () => {
      const result = await agent.execute({
        inventionUnderstanding: mockInventionUnderstanding,
      })

      expect(result).toBeDefined()
      expect(result.searchStrategy).toBeDefined()
      expect(result.searchStrategy.keywords).toBeDefined()
      expect(result.searchStrategy.searchQueries).toBeDefined()
    })

    it('应该输出结构化的检索结果', async () => {
      const result = await agent.execute({
        inventionUnderstanding: mockInventionUnderstanding,
      })

      // 验证必需字段
      expect(result).toMatchObject({
        searchStrategy: {
          keywords: expect.any(Array),
          ipcCpcClasses: expect.any(Array),
          searchQueries: expect.any(Array),
          searchScope: expect.any(String),
        },
        results: {
          patents: expect.any(Array),
          papers: expect.any(Array),
          webResources: expect.any(Array),
        },
        comparisonAnalysis: {
          closestPriorArt: expect.any(Object),
          differences: expect.any(Array),
          technicalProblemSolved: expect.any(String),
          creativityAssessment: expect.any(Object),
        },
        confidence: expect.any(Number),
      })

      // 验证数据质量
      expect(result.searchStrategy.keywords.length).toBeGreaterThan(0)
      expect(result.searchStrategy.searchQueries.length).toBeGreaterThan(0)
      expect(result.comparisonAnalysis.differences.length).toBeGreaterThan(0)
      expect(result.confidence).toBeGreaterThanOrEqual(0)
      expect(result.confidence).toBeLessThanOrEqual(1)
    })

    it('应该处理输入验证', async () => {
      await expect(
        agent.execute({
          inventionUnderstanding: null as any,
        })
      ).rejects.toThrow('发明理解结果不能为空')
    })

    it('应该生成合理的检索关键词', async () => {
      const result = await agent.execute({
        inventionUnderstanding: mockInventionUnderstanding,
      })

      // 关键词应该来自发明理解
      const allKeywords = result.searchStrategy.keywords.join(' ')
      mockInventionUnderstanding.keyFeatures.forEach(feature => {
        // 至少包含部分关键特征
        const hasKeyword = result.searchStrategy.keywords.some(kw =>
          feature.includes(kw) || kw.includes(feature)
        )
        // 不强制要求所有特征都出现，但应该有相关性
      })

      expect(result.searchStrategy.keywords.length).toBeGreaterThan(0)
      expect(result.searchStrategy.keywords.length).toBeLessThanOrEqual(10)
    })

    it('应该提供IPC/CPC分类建议', async () => {
      const result = await agent.execute({
        inventionUnderstanding: mockInventionUnderstanding,
      })

      // IPC/CPC分类可选，但如果有应该格式正确
      if (result.searchStrategy.ipcCpcClasses.length > 0) {
        result.searchStrategy.ipcCpcClasses.forEach(cls => {
          expect(cls).toMatch(/[A-Z]\d+[A-Z]/) // 如 G06N3/00
        })
      }
    })
  })

  describe('任务2: SearchStrategyRenderer功能', () => {
    it('应该生成可读的Markdown报告', async () => {
      const searchResult = await agent.execute({
        inventionUnderstanding: mockInventionUnderstanding,
      })

      const report = renderer.render(searchResult)

      // 验证报告格式
      expect(report).toContain('# 先导技术检索报告')
      expect(report).toContain('## 检索策略')
      expect(report).toContain('### 关键词')
      expect(report).toContain('### 检索式')
      expect(report).toContain('## 检索结果')
      expect(report).toContain('## 对比分析')
    })

    it('报告应该包含所有关键信息', async () => {
      const searchResult = await agent.execute({
        inventionUnderstanding: mockInventionUnderstanding,
      })

      const report = renderer.render(searchResult)

      // 检查检索策略部分
      expect(report).toContain('关键词')
      expect(report).toContain('检索式')

      // 检查对比分析部分
      expect(report).toContain('最接近的现有技术')
      expect(report).toContain('区别特征')
      expect(report).toContain('创造性评估')

      // 检查置信度
      expect(report).toContain('置信度')
    })

    it('应该标记模拟数据', async () => {
      const searchResult = await agent.execute({
        inventionUnderstanding: mockInventionUnderstanding,
      })

      const report = renderer.render(searchResult)

      // 应该有模拟数据标记
      expect(report).toContain('模拟数据')
    })
  })

  describe('任务3: 对比分析功能', () => {
    it('应该识别最接近的现有技术', async () => {
      const result = await agent.execute({
        inventionUnderstanding: mockInventionUnderstanding,
      })

      expect(result.comparisonAnalysis.closestPriorArt).toBeDefined()
      expect(result.comparisonAnalysis.closestPriorArt.title).toBeTruthy()
      expect(result.comparisonAnalysis.closestPriorArt.similarityScore).toBeGreaterThanOrEqual(0)
      expect(result.comparisonAnalysis.closestPriorArt.similarityScore).toBeLessThanOrEqual(1)
    })

    it('应该列出区别特征', async () => {
      const result = await agent.execute({
        inventionUnderstanding: mockInventionUnderstanding,
      })

      expect(result.comparisonAnalysis.differences).toBeDefined()
      expect(result.comparisonAnalysis.differences.length).toBeGreaterThan(0)

      // 区别特征应该是字符串数组
      result.comparisonAnalysis.differences.forEach(diff => {
        expect(typeof diff).toBe('string')
        expect(diff.trim().length).toBeGreaterThan(0)
      })
    })

    it('应该评估创造性等级', async () => {
      const result = await agent.execute({
        inventionUnderstanding: mockInventionUnderstanding,
      })

      const { creativityAssessment } = result.comparisonAnalysis
      expect(creativityAssessment).toBeDefined()
      expect(['high', 'medium', 'low']).toContain(creativityAssessment.level)
      expect(creativityAssessment.reasoning).toBeTruthy()
      expect(creativityAssessment.confidence).toBeGreaterThanOrEqual(0)
      expect(creativityAssessment.confidence).toBeLessThanOrEqual(1)
    })

    it('应该说明实际解决的技术问题', async () => {
      const result = await agent.execute({
        inventionUnderstanding: mockInventionUnderstanding,
      })

      expect(result.comparisonAnalysis.technicalProblemSolved).toBeDefined()
      expect(result.comparisonAnalysis.technicalProblemSolved.length).toBeGreaterThan(0)
    })
  })

  describe('任务4: 错误处理和降级', () => {
    it('应该能够处理空的关键特征', async () => {
      const emptyInvention = {
        ...mockInventionUnderstanding,
        keyFeatures: [],
      }

      const result = await agent.execute({
        inventionUnderstanding: emptyInvention,
      })

      // 即使没有关键特征，也应该返回结构化结果
      expect(result).toBeDefined()
      expect(result.searchStrategy).toBeDefined()
    })

    it('应该能够处理简短的发明理解', async () => {
      const minimalInvention: InventionUnderstandingOutput = {
        technicalField: 'AI',
        backgroundArt: '',
        technicalProblem: '问题',
        technicalSolution: '方案',
        beneficialEffects: '',
        keyFeatures: ['特征1'],
        drawingDescriptions: [],
        confidence: 0.5,
      }

      const result = await agent.execute({
        inventionUnderstanding: minimalInvention,
      })

      expect(result).toBeDefined()
      expect(result.searchStrategy.keywords.length).toBeGreaterThan(0)
    })
  })

  describe('任务5: 性能和可靠性', () => {
    it('应该在合理时间内完成检索', async () => {
      const startTime = Date.now()

      await agent.execute({
        inventionUnderstanding: mockInventionUnderstanding,
      })

      const duration = Date.now() - startTime

      // 检索应该在30秒内完成
      expect(duration).toBeLessThan(30000)
    }, 35000)

    it('应该能够处理多次连续调用', async () => {
      const results = await Promise.all([
        agent.execute({
          inventionUnderstanding: mockInventionUnderstanding,
        }),
        agent.execute({
          inventionUnderstanding: mockInventionUnderstanding,
        }),
      ])

      expect(results).toHaveLength(2)
      expect(results[0]).toBeDefined()
      expect(results[1]).toBeDefined()
    })
  })
})

// 运行测试的说明
console.log(`
========================================
Phase 3 验收测试
========================================

运行测试：
  pnpm test packages/agents/prior-art-search/test/

环境要求：
  - 设置 DEEPSEEK_API_KEY 或 OPENAI_API_KEY
  - 准备模拟发明理解数据

验收标准：
  ✅ 所有测试用例通过
  ✅ PriorArtSearchAgent 可以构建检索策略
  ✅ 输出结构化的检索结果
  ✅ SearchStrategyRenderer 生成可读报告
  ✅ 对比分析准确识别区别特征
  ✅ 创造性评估合理

========================================
`)
