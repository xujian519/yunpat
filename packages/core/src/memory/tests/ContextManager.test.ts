/**
 * 上下文管理器测试
 *
 * 测试覆盖：
 * - 上下文构建
 * - 消息格式化
 * - Token 统计
 * - 预测功能
 */

import { describe, it, expect } from 'vitest'
import { ContextManager, createContextManager } from '../short-term/ContextManager.js'

describe('上下文管理器', () => {
  describe('上下文构建', () => {
    it('应该正确构建上下文（无系统提示）', async () => {
      const manager = new ContextManager()

      const messages = [
        { role: 'user' as const, content: '你好' },
        { role: 'assistant' as const, content: '你好！' },
      ]

      const { context, stats } = await manager.buildContext(messages)

      expect(context).toContain('你好')
      expect(context).toContain('你好！')
      expect(stats.totalMessages).toBe(2)
    })

    it('应该添加系统提示', async () => {
      const manager = new ContextManager({
        systemPrompt: '你是一个专业的专利撰写助手。',
      })

      const messages = [{ role: 'user' as const, content: '你好' }]

      const { context, stats } = await manager.buildContext(messages)

      expect(context).toContain('专利撰写助手')
      expect(stats.totalMessages).toBe(2) // system + user
    })

    it('应该压缩超长上下文', async () => {
      const manager = new ContextManager({
        maxTokens: 100,
        reservedTokens: 10,
        enableSummary: true,
      })

      const messages = Array.from({ length: 20 }, (_, i) => ({
        role: 'user' as const,
        content: `这是第 ${i + 1} 条消息`.repeat(5),
      }))

      const { context, stats } = await manager.buildContext(messages)

      expect(stats.compressionRatio).toBeLessThan(1.0)
      expect(stats.totalTokens).toBeLessThanOrEqual(90)
    })
  })

  describe('消息格式化', () => {
    it('应该使用默认格式化', async () => {
      const manager = new ContextManager()

      const messages = [{ role: 'user' as const, content: '你好' }]

      const { context } = await manager.buildContext(messages)

      expect(context).toBe('你好')
    })

    it('应该包含角色标签（如果启用）', async () => {
      const manager = new ContextManager()

      const messages = [{ role: 'user' as const, content: '你好' }]

      const { context } = await manager.buildContext(messages, {
        includeRole: true,
      })

      expect(context).toContain('用户')
    })

    it('应该格式化为 Markdown', async () => {
      const manager = new ContextManager()

      const messages = [{ role: 'user' as const, content: '你好' }]

      const { context } = await manager.buildContext(messages, {
        asMarkdown: true,
        includeRole: true,
      })

      expect(context).toContain('**用户**')
    })

    it('应该包含时间戳（如果启用）', async () => {
      const manager = new ContextManager({
        includeTimestamp: true,
      })

      const messages = [{ role: 'user' as const, content: '你好', timestamp: new Date() }]

      const { context } = await manager.buildContext(messages, {
        includeRole: true,
      })

      expect(context).toMatch(/\[.*\]/) // 匹配时间戳格式
    })

    it('应该使用自定义格式化函数', async () => {
      const customFormat = (msg: any) => `[${msg.role}]: ${msg.content}`

      const manager = new ContextManager({
        formatMessage: customFormat,
      })

      const messages = [{ role: 'user' as const, content: '你好' }]

      const { context } = await manager.buildContext(messages)

      expect(context).toBe('[user]: 你好')
    })
  })

  describe('Token 统计', () => {
    it('应该正确统计 Token 数', async () => {
      const manager = new ContextManager()

      const messages = [
        { role: 'user' as const, content: '你好' },
        { role: 'assistant' as const, content: '你好！' },
        { role: 'system' as const, content: '系统提示' },
      ]

      const stats = await manager.getTokenStats(messages)

      expect(stats.totalTokens).toBeGreaterThan(0)
      expect(stats.userTokens).toBeGreaterThan(0)
      expect(stats.assistantTokens).toBeGreaterThan(0)
      expect(stats.systemTokens).toBeGreaterThan(0)
    })

    it('应该正确计算各角色 Token 占比', async () => {
      const manager = new ContextManager()

      const messages = [
        { role: 'user' as const, content: '用户消息'.repeat(10) },
        { role: 'assistant' as const, content: '助手回复' },
      ]

      const stats = await manager.getTokenStats(messages)

      expect(stats.userTokens).toBeGreaterThan(stats.assistantTokens)
    })
  })

  describe('预测功能', () => {
    it('应该正确预测下一轮 Token 使用', async () => {
      const manager = new ContextManager({
        maxTokens: 1000,
      })

      const messages = [{ role: 'user' as const, content: '你好' }]

      const prediction = await manager.predictNextTokens(messages, 500)

      expect(prediction.currentTokens).toBeGreaterThan(0)
      expect(prediction.estimatedResponseTokens).toBeGreaterThan(0)
      expect(prediction.totalEstimatedTokens).toBeGreaterThan(0)
    })

    it('应该检测是否超限', async () => {
      const manager = new ContextManager({
        maxTokens: 100,
      })

      const messages = [{ role: 'user' as const, content: '很长的消息'.repeat(100) }]

      const prediction = await manager.predictNextTokens(messages, 500)

      expect(prediction.willExceedLimit).toBe(true)
      expect(prediction.recommendedActions.length).toBeGreaterThan(0)
    })

    it('应该提供优化建议', async () => {
      const manager = new ContextManager({
        maxTokens: 100,
      })

      const messages = [{ role: 'user' as const, content: '很长的消息'.repeat(100) }]

      const prediction = await manager.predictNextTokens(messages, 500)

      expect(prediction.recommendedActions).toContain('建议压缩历史对话')
      expect(prediction.recommendedActions).toContain('建议启用语义摘要')
    })
  })

  describe('消息管理', () => {
    it('应该正确添加消息', async () => {
      const manager = new ContextManager()

      const messages = [{ role: 'user' as const, content: '你好' }]

      const newMessage = { role: 'assistant' as const, content: '你好！' }

      const updated = await manager.addMessage(messages, newMessage)

      expect(updated.length).toBe(2)
      expect(updated[1]).toEqual(newMessage)
    })

    it('应该清理旧消息', async () => {
      const manager = new ContextManager()

      const now = Date.now()
      const messages = [
        { role: 'user' as const, content: '旧消息', timestamp: new Date(now - 2 * 60 * 60 * 1000) },
        { role: 'user' as const, content: '新消息', timestamp: new Date(now) },
      ]

      const cleaned = await manager.cleanupContext(messages, 60 * 60 * 1000) // 1 小时

      expect(cleaned.length).toBe(1)
      expect(cleaned[0].content).toBe('新消息')
    })
  })

  describe('配置管理', () => {
    it('应该正确设置系统提示', () => {
      const manager = new ContextManager()

      manager.setSystemPrompt('新的系统提示')

      const config = manager.getConfig()

      expect(config.systemPrompt).toBe('新的系统提示')
    })

    it('应该返回完整配置信息', () => {
      const manager = new ContextManager({
        maxTokens: 5000,
        reservedTokens: 500,
        systemPrompt: '系统提示',
        includeTimestamp: true,
      })

      const config = manager.getConfig()

      expect(config.maxTokens).toBe(5000)
      expect(config.reservedTokens).toBe(500)
      expect(config.systemPrompt).toBe('系统提示')
      expect(config.includeTimestamp).toBe(true)
    })
  })

  describe('便捷函数', () => {
    it('应该正确创建管理器', () => {
      const manager = createContextManager({
        maxTokens: 3000,
      })

      expect(manager).toBeInstanceOf(ContextManager)
      expect(manager.getConfig().maxTokens).toBe(3000)
    })
  })
})
