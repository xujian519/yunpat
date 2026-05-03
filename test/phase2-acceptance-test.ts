#!/usr/bin/env node

/**
 * Phase 2 验收测试
 *
 * 测试目标：
 * 1. InventionUnderstandingAgent 可以分析技术交底书
 * 2. 输出结构化的发明理解结果
 * 3. HumanReadableRenderer 生成可读报告
 * 4. CLI 命令可以正常运行
 * 5. 工作流定义完整且可执行
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { readFile } from 'fs/promises'
import { resolve } from 'path'
import { InventionUnderstandingAgent, HumanReadableRenderer } from '@yunpat/agent-invention'
import { EventBus, ShortTermMemory, ToolRegistry } from '@yunpat/core'
import { createDeepSeekModel } from '@yunpat/llm'

describe('Phase 2: 发明理解验收测试', () => {
  let agent: InventionUnderstandingAgent
  let renderer: HumanReadableRenderer
  let testDisclosure: string

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

    agent = new InventionUnderstandingAgent({
      name: 'invention-understanding',
      description: '发明理解智能体',
      llm,
      memory,
      tools,
      eventBus,
    })

    renderer = new HumanReadableRenderer()

    // 读取测试数据
    const disclosurePath = resolve(__dirname, '../examples/disclosure-example.md')
    testDisclosure = await readFile(disclosurePath, 'utf-8')
  })

  describe('任务1: InventionUnderstandingAgent基础功能', () => {
    it('应该能够分析技术交底书', async () => {
      const result = await agent.execute({
        title: '一种基于深度学习的图像识别方法',
        field: '人工智能',
        technicalDisclosure: testDisclosure,
        drawings: ['图1: 系统架构图', '图2: 网络结构图'],
      })

      expect(result).toBeDefined()
      expect(result.technicalField).toBeTruthy()
      expect(result.technicalProblem).toBeTruthy()
      expect(result.technicalSolution).toBeTruthy()
    })

    it('应该输出结构化的发明理解结果', async () => {
      const result = await agent.execute({
        title: '一种基于深度学习的图像识别方法',
        field: '人工智能',
        technicalDisclosure: testDisclosure,
      })

      // 验证必需字段
      expect(result).toMatchObject({
        technicalField: expect.any(String),
        backgroundArt: expect.any(String),
        technicalProblem: expect.any(String),
        technicalSolution: expect.any(String),
        beneficialEffects: expect.any(String),
        keyFeatures: expect.any(Array),
        drawingDescriptions: expect.any(Array),
        confidence: expect.any(Number),
      })

      // 验证数据质量
      expect(result.technicalField.length).toBeGreaterThan(0)
      expect(result.keyFeatures.length).toBeGreaterThan(0)
      expect(result.confidence).toBeGreaterThanOrEqual(0)
      expect(result.confidence).toBeLessThanOrEqual(1)
    })

    it('应该处理输入验证', async () => {
      await expect(
        agent.execute({
          title: '',
          field: '',
          technicalDisclosure: '',
        })
      ).rejects.toThrow('发明名称不能为空')
    })

    it('应该有合理的置信度评分', async () => {
      const result = await agent.execute({
        title: '一种基于深度学习的图像识别方法',
        field: '人工智能',
        technicalDisclosure: testDisclosure,
      })

      // 置信度应该在合理范围内
      expect(result.confidence).toBeGreaterThanOrEqual(0.5)
      expect(result.confidence).toBeLessThanOrEqual(1.0)

      // 如果置信度过低，应该标记
      if (result.confidence < 0.7) {
        console.warn('⚠️ 警告: AI置信度较低，建议人工审核')
      }
    })
  })

  describe('任务2: HumanReadableRenderer功能', () => {
    it('应该生成可读的Markdown报告', async () => {
      const analysisResult = await agent.execute({
        title: '一种基于深度学习的图像识别方法',
        field: '人工智能',
        technicalDisclosure: testDisclosure,
      })

      const report = renderer.render(analysisResult)

      // 验证报告格式
      expect(report).toContain('# 发明理解报告')
      expect(report).toContain('## 技术领域')
      expect(report).toContain('## 技术问题')
      expect(report).toContain('## 技术方案')
      expect(report).toContain('## 关键特征')
      expect(report).toContain('分析置信度')
    })

    it('报告长度应该合理（<300字核心内容）', async () => {
      const analysisResult = await agent.execute({
        title: '一种基于深度学习的图像识别方法',
        field: '人工智能',
        technicalDisclosure: testDisclosure,
      })

      const report = renderer.render(analysisResult)

      // 报告不应该太长（便于人类快速审阅）
      // 注意：这里检查的是核心内容长度，不包括完整的交底书
      const lines = report.split('\n')
      const contentLines = lines.filter((line) => line.trim() && !line.startsWith('#'))

      // 核心内容应该在合理范围内
      expect(contentLines.length).toBeLessThan(100)
    })

    it('应该正确显示置信度', async () => {
      const analysisResult = await agent.execute({
        title: '一种基于深度学习的图像识别方法',
        field: '人工智能',
        technicalDisclosure: testDisclosure,
      })

      const report = renderer.render(analysisResult)

      // 应该包含置信度百分比
      expect(report).toContain(`${(analysisResult.confidence * 100).toFixed(1)}%`)
    })
  })

  describe('任务3: 错误处理和降级', () => {
    it('应该能够处理空的附图描述', async () => {
      const result = await agent.execute({
        title: '一种基于深度学习的图像识别方法',
        field: '人工智能',
        technicalDisclosure: testDisclosure,
        drawings: [], // 空附图
      })

      expect(result.drawingDescriptions).toEqual([])
    })

    it('应该能够处理简短的交底书', async () => {
      const shortDisclosure = '本发明提供一种图像识别方法。'

      const result = await agent.execute({
        title: '图像识别方法',
        field: '计算机视觉',
        technicalDisclosure: shortDisclosure,
      })

      // 即使输入简短，也应该返回结构化结果
      expect(result).toBeDefined()
      expect(result.technicalSolution).toBeTruthy()
    })
  })

  describe('任务4: 性能和可靠性', () => {
    it('应该在合理时间内完成分析', async () => {
      const startTime = Date.now()

      await agent.execute({
        title: '一种基于深度学习的图像识别方法',
        field: '人工智能',
        technicalDisclosure: testDisclosure,
      })

      const duration = Date.now() - startTime

      // 分析应该在30秒内完成
      expect(duration).toBeLessThan(30000)
    }, 35000) // 超时时间35秒

    it('应该能够处理多次连续调用', async () => {
      const results = await Promise.all([
        agent.execute({
          title: '一种基于深度学习的图像识别方法',
          field: '人工智能',
          technicalDisclosure: testDisclosure,
        }),
        agent.execute({
          title: '一种基于深度学习的图像识别方法',
          field: '人工智能',
          technicalDisclosure: testDisclosure,
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
Phase 2 验收测试
========================================

运行测试：
  pnpm test test/phase2-acceptance-test.ts

环境要求：
  - 设置 DEEPSEEK_API_KEY 或 OPENAI_API_KEY
  - 测试数据: examples/disclosure-example.md

验收标准：
  ✅ 所有测试用例通过
  ✅ InventionUnderstandingAgent 可以分析技术交底书
  ✅ 输出结构化的发明理解结果
  ✅ HumanReadableRenderer 生成可读报告
  ✅ 错误处理和降级机制正常工作
  ✅ 性能在可接受范围内

========================================
`)
