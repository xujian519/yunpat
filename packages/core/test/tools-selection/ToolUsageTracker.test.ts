/**
 * ToolUsageTracker 测试
 *
 * TDD方式：
 * 1. 先写测试（红色 - 失败）
 * 2. 修复代码
 * 3. 运行测试（绿色 - 通过）
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ToolUsageTracker } from '../../src/tools/ToolUsageTracker.js'
import type { ToolUsageRecord } from '../../src/tools/ToolUsageTracker.js'
import { promises as fs } from 'fs'

describe('ToolUsageTracker', () => {
  let tracker: ToolUsageTracker
  const testDataDir = './test-data-tool-usage'

  beforeEach(() => {
    tracker = new ToolUsageTracker({
      dataDirectory: testDataDir,
      maxRecords: 100,
      retentionDays: 30,
    })
  })

  afterEach(async () => {
    // 清理测试数据
    try {
      await fs.rm(testDataDir, { recursive: true, force: true })
    } catch (e) {
      // 忽略错误
    }
  })

  describe('recordUsage', () => {
    it('应该能够记录工具使用', () => {
      const record: ToolUsageRecord = {
        id: '',
        timestamp: new Date(),
        toolName: 'PdfToMarkdownTool',
        sessionId: 'session-001',
        userInput: '转换PDF到Markdown',
        toolParameters: { filePath: 'doc.pdf' },
        result: {
          success: true,
          executionTime: 1500,
          output: { markdown: '#' },
        },
      }

      const recordId = tracker.recordUsage(record)

      expect(recordId).toBeDefined()
      expect(typeof recordId).toBe('string')
    })

    it('应该生成唯一的记录ID', () => {
      const record1: ToolUsageRecord = {
        id: '',
        timestamp: new Date(),
        toolName: 'Tool1',
        sessionId: 'session-001',
        userInput: '输入1',
        toolParameters: {},
        result: { success: true, executionTime: 100 },
      }

      const record2: ToolUsageRecord = {
        id: '',
        timestamp: new Date(),
        toolName: 'Tool1',
        sessionId: 'session-001',
        userInput: '输入1',
        toolParameters: {},
        result: { success: true, executionTime: 100 },
      }

      const id1 = tracker.recordUsage(record1)
      const id2 = tracker.recordUsage(record2)

      expect(id1).not.toBe(id2)
    })

    it('应该支持记录成功的工具调用', () => {
      const record: ToolUsageRecord = {
        id: '',
        timestamp: new Date(),
        toolName: 'TestTool',
        sessionId: 'session-001',
        userInput: '测试',
        toolParameters: {},
        result: {
          success: true,
          executionTime: 1234,
          output: { result: 'success' },
        },
      }

      const recordId = tracker.recordUsage(record)
      const stats = tracker.getPerformanceStats('TestTool')

      expect(stats.totalCalls).toBe(1)
      expect(stats.successfulCalls).toBe(1)
      expect(stats.failedCalls).toBe(0)
      expect(stats.successRate).toBe(1)
    })

    it('应该支持记录失败的工具调用', () => {
      const record: ToolUsageRecord = {
        id: '',
        timestamp: new Date(),
        toolName: 'TestTool',
        sessionId: 'session-001',
        userInput: '测试',
        toolParameters: {},
        result: {
          success: false,
          executionTime: 500,
          error: 'File not found',
        },
      }

      tracker.recordUsage(record)
      const stats = tracker.getPerformanceStats('TestTool')

      expect(stats.totalCalls).toBe(1)
      expect(stats.successfulCalls).toBe(0)
      expect(stats.failedCalls).toBe(1)
      expect(stats.successRate).toBe(0)
    })

    it('应该记录执行时间', () => {
      const record: ToolUsageRecord = {
        id: '',
        timestamp: new Date(),
        toolName: 'TestTool',
        sessionId: 'session-001',
        userInput: '测试',
        toolParameters: {},
        result: {
          success: true,
          executionTime: 2345,
          output: {},
        },
      }

      tracker.recordUsage(record)
      const stats = tracker.getPerformanceStats('TestTool')

      expect(stats.avgExecutionTime).toBe(2345)
      expect(stats.minExecutionTime).toBe(2345)
      expect(stats.maxExecutionTime).toBe(2345)
    })

    it('应该记录错误信息', () => {
      const errorMessage = 'Connection timeout'

      const record: ToolUsageRecord = {
        id: '',
        timestamp: new Date(),
        toolName: 'TestTool',
        sessionId: 'session-001',
        userInput: '测试',
        toolParameters: {},
        result: {
          success: false,
          executionTime: 5000,
          error: errorMessage,
        },
      }

      tracker.recordUsage(record)
      const stats = tracker.getPerformanceStats('TestTool')

      expect(stats.mostCommonErrors).toBeDefined()
      expect(stats.mostCommonErrors.length).toBeGreaterThan(0)
      expect(stats.mostCommonErrors[0].error).toBe(errorMessage)
    })
  })

  describe('getPerformanceStats', () => {
    beforeEach(() => {
      // 添加一些测试数据
      tracker.recordUsage({
        id: '',
        timestamp: new Date(),
        toolName: 'PdfToMarkdownTool',
        sessionId: 'session-001',
        userInput: '转换PDF',
        toolParameters: { filePath: 'doc1.pdf' },
        result: { success: true, executionTime: 1000, output: {} },
      })

      tracker.recordUsage({
        id: '',
        timestamp: new Date(),
        toolName: 'PdfToMarkdownTool',
        sessionId: 'session-001',
        userInput: '转换PDF',
        toolParameters: { filePath: 'doc2.pdf' },
        result: { success: true, executionTime: 2000, output: {} },
      })

      tracker.recordUsage({
        id: '',
        timestamp: new Date(),
        toolName: 'PdfToMarkdownTool',
        sessionId: 'session-001',
        userInput: '转换PDF',
        toolParameters: { filePath: 'doc3.pdf' },
        result: { success: false, executionTime: 500, error: 'File not found' },
      })
    })

    it('应该返回工具的性能统计', () => {
      const stats = tracker.getPerformanceStats('PdfToMarkdownTool')

      expect(stats).toBeDefined()
      expect(stats.toolName).toBe('PdfToMarkdownTool')
      expect(stats.totalCalls).toBe(3)
      expect(stats.successfulCalls).toBe(2)
      expect(stats.failedCalls).toBe(1)
      expect(stats.successRate).toBeCloseTo(0.667, 1)
    })

    it('应该计算平均执行时间', () => {
      const stats = tracker.getPerformanceStats('PdfToMarkdownTool')

      expect(stats.avgExecutionTime).toBeCloseTo(1166.67, 0)
    })

    it('应该记录最小和最大执行时间', () => {
      const stats = tracker.getPerformanceStats('PdfToMarkdownTool')

      expect(stats.minExecutionTime).toBe(500)
      expect(stats.maxExecutionTime).toBe(2000)
    })

    it('应该记录最后使用时间', () => {
      const stats = tracker.getPerformanceStats('PdfToMarkdownTool')

      expect(stats.lastUsed).toBeDefined()
      expect(stats.lastUsed).toBeInstanceOf(Date)
    })

    it('应该统计常见错误', () => {
      const stats = tracker.getPerformanceStats('PdfToMarkdownTool')

      expect(stats.mostCommonErrors).toBeDefined()
      expect(stats.mostCommonErrors.length).toBeGreaterThan(0)
      expect(stats.mostCommonErrors[0].error).toBe('File not found')
      expect(stats.mostCommonErrors[0].count).toBe(1)
    })

    it('应该返回空统计对于不存在的工具', () => {
      const stats = tracker.getPerformanceStats('NonExistentTool')

      expect(stats).toBeDefined()
      expect(stats.toolName).toBe('NonExistentTool')
      expect(stats.totalCalls).toBe(0)
      expect(stats.successfulCalls).toBe(0)
      expect(stats.failedCalls).toBe(0)
    })
  })

  describe('getRecommendations', () => {
    beforeEach(() => {
      // 添加成功数据
      for (let i = 0; i < 10; i++) {
        tracker.recordUsage({
          id: '',
          timestamp: new Date(),
          toolName: 'PdfToMarkdownTool',
          sessionId: 'session-001',
          userInput: '转换PDF到Markdown',
          toolParameters: {},
          result: { success: true, executionTime: 1000, output: {} },
        })
      }

      // 添加一些失败数据
      for (let i = 0; i < 3; i++) {
        tracker.recordUsage({
          id: '',
          timestamp: new Date(),
          toolName: 'PdfToMarkdownTool',
          sessionId: 'session-001',
          userInput: '转换PDF到Markdown',
          toolParameters: {},
          result: { success: false, executionTime: 500, error: 'Error' },
        })
      }
    })

    it('应该基于历史表现推荐工具', () => {
      const userInput = '转换PDF到Markdown'
      const availableTools = ['PdfToMarkdownTool', 'PdfParseTool']

      const recommendations = tracker.getRecommendations(userInput, availableTools)

      expect(recommendations).toBeInstanceOf(Array)
      expect(recommendations.length).toBeGreaterThan(0)
    })

    it('应该推荐高成功率的工具', () => {
      const userInput = '转换PDF到Markdown'
      const availableTools = ['PdfToMarkdownTool']

      const recommendations = tracker.getRecommendations(userInput, availableTools)

      expect(recommendations[0].toolName).toBe('PdfToMarkdownTool')
      expect(recommendations[0].confidence).toBeGreaterThan(0.5)
    })

    it('应该包含推荐理由', () => {
      const userInput = '转换PDF到Markdown'
      const availableTools = ['PdfToMarkdownTool']

      const recommendations = tracker.getRecommendations(userInput, availableTools)

      expect(recommendations[0].reason).toBeDefined()
      expect(typeof recommendations[0].reason).toBe('string')
    })

    it('应该包含预期性能', () => {
      const userInput = '转换PDF到Markdown'
      const availableTools = ['PdfToMarkdownTool']

      const recommendations = tracker.getRecommendations(userInput, availableTools)

      expect(recommendations[0].expectedPerformance).toBeDefined()
      expect(recommendations[0].expectedPerformance.successRate).toBeDefined()
    })

    it('应该按置信度排序推荐', () => {
      const userInput = '测试'
      const availableTools = ['Tool1', 'Tool2', 'Tool3']

      const recommendations = tracker.getRecommendations(userInput, availableTools)

      // 检查是否按置信度降序排列
      for (let i = 1; i < recommendations.length; i++) {
        expect(recommendations[i - 1].confidence).toBeGreaterThanOrEqual(
          recommendations[i].confidence
        )
      }
    })
  })

  describe('generatePerformanceReport', () => {
    beforeEach(() => {
      tracker.recordUsage({
        id: '',
        timestamp: new Date(),
        toolName: 'Tool1',
        sessionId: 'session-001',
        userInput: '测试1',
        toolParameters: {},
        result: { success: true, executionTime: 1000, output: {} },
      })

      tracker.recordUsage({
        id: '',
        timestamp: new Date(),
        toolName: 'Tool2',
        sessionId: 'session-001',
        userInput: '测试2',
        toolParameters: {},
        result: { success: false, executionTime: 500, error: 'Error' },
      })
    })

    it('应该生成性能报告', () => {
      const report = tracker.generatePerformanceReport()

      expect(report).toBeDefined()
      expect(typeof report).toBe('string')
      expect(report.length).toBeGreaterThan(0)
    })

    it('应该包含工具性能统计', () => {
      const report = tracker.generatePerformanceReport()

      expect(report).toContain('Tool1')
      expect(report).toContain('Tool2')
    })

    it('应该包含总体统计', () => {
      const report = tracker.generatePerformanceReport()

      expect(report).toContain('总记录数')
    })
  })

  describe('analyzeSelectionAccuracy', () => {
    beforeEach(() => {
      // 添加成功的工具使用
      for (let i = 0; i < 8; i++) {
        tracker.recordUsage({
          id: '',
          timestamp: new Date(),
          toolName: 'CorrectTool',
          sessionId: 'session-001',
          userInput: '处理PDF',
          toolParameters: {},
          result: { success: true, executionTime: 1000, output: {} },
        })
      }

      // 添加一些失败的使用
      for (let i = 0; i < 2; i++) {
        tracker.recordUsage({
          id: '',
          timestamp: new Date(),
          toolName: 'WrongTool',
          sessionId: 'session-001',
          userInput: '处理PDF',
          toolParameters: {},
          result: { success: false, executionTime: 500, error: 'Error' },
        })
      }
    })

    it('应该分析选择准确率', () => {
      const analysis = tracker.analyzeSelectionAccuracy()

      expect(analysis).toBeDefined()
      expect(analysis.accuracy).toBeDefined()
      expect(typeof analysis.accuracy).toBe('number')
    })

    it('应该计算准确的准确率', () => {
      const analysis = tracker.analyzeSelectionAccuracy()

      // 8次成功 / 10次总调用 = 0.8
      expect(analysis.accuracy).toBeCloseTo(0.8, 1)
    })

    it('应该提供改进建议', () => {
      const analysis = tracker.analyzeSelectionAccuracy()

      expect(analysis.improvements).toBeDefined()
      expect(analysis.improvements).toBeInstanceOf(Array)
    })

    it('应该识别性能问题', () => {
      const analysis = tracker.analyzeSelectionAccuracy()

      // 如果准确率低于90%，应该有改进建议
      if (analysis.accuracy < 0.9) {
        expect(analysis.improvements.length).toBeGreaterThan(0)
      }
    })
  })

  describe('数据持久化', () => {
    it('应该能够保存数据到文件', async () => {
      tracker.recordUsage({
        id: '',
        timestamp: new Date(),
        toolName: 'TestTool',
        sessionId: 'session-001',
        userInput: '测试',
        toolParameters: {},
        result: { success: true, executionTime: 1000, output: {} },
      })

      await tracker.saveData()

      // 检查文件是否存在
      const files = await fs.readdir(testDataDir)
      expect(files.length).toBeGreaterThan(0)
    })

    it('应该能够从文件加载数据', async () => {
      // 保存数据
      tracker.recordUsage({
        id: '',
        timestamp: new Date(),
        toolName: 'TestTool',
        sessionId: 'session-001',
        userInput: '测试',
        toolParameters: {},
        result: { success: true, executionTime: 1000, output: {} },
      })

      await tracker.saveData()

      // 创建新的tracker并加载数据
      const newTracker = new ToolUsageTracker({ dataDirectory: testDataDir })
      await newTracker.loadData()

      const stats = newTracker.getPerformanceStats('TestTool')
      expect(stats.totalCalls).toBe(1)
    })
  })

  describe('数据清理', () => {
    it('应该清理旧数据', () => {
      const oldDate = new Date()
      oldDate.setDate(oldDate.getDate() - 40) // 40天前

      tracker.recordUsage({
        id: '',
        timestamp: oldDate,
        toolName: 'OldTool',
        sessionId: 'session-001',
        userInput: '旧数据',
        toolParameters: {},
        result: { success: true, executionTime: 1000, output: {} },
      })

      const newDate = new Date()
      tracker.recordUsage({
        id: '',
        timestamp: newDate,
        toolName: 'NewTool',
        sessionId: 'session-001',
        userInput: '新数据',
        toolParameters: {},
        result: { success: true, executionTime: 1000, output: {} },
      })

      tracker.cleanupOldData()

      const oldStats = tracker.getPerformanceStats('OldTool')
      const newStats = tracker.getPerformanceStats('NewTool')

      expect(oldStats.totalCalls).toBe(0)
      expect(newStats.totalCalls).toBe(1)
    })
  })
})
