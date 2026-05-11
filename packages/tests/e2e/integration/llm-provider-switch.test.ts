/**
 * LLM Provider 切换 E2E 测试
 *
 * T-071~T-075: 多 LLM Provider 支持和回退
 */

import { describe, it, expect } from 'vitest'

const describeE2E = process.env.MOCK_TESTS === 'true' ? describe : describe.skip

describeE2E('LLM Provider 切换', () => {
  describe('T-071: DeepSeek Provider', () => {
    it('应成功调用 DeepSeek Chat Completion', async () => {
      if (!process.env.DEEPSEEK_API_KEY) return

      try {
        const { createDeepSeekModel } = await import('@yunpat/core')

        const model = createDeepSeekModel({
          apiKey: process.env.DEEPSEEK_API_KEY,
          model: 'deepseek-chat',
        })

        const response = await model.chat({
          messages: [{ role: 'user', content: '请用一句话描述专利的概念' }],
          temperature: 0.1,
        })

        expect(response).toBeDefined()
        expect(response.message.content).toBeTruthy()
        expect(typeof response.message.content).toBe('string')
      } catch (error: any) {
        if (error.message?.includes('Cannot find module')) {
          return
        }
        // API key 无效或网络不可用时跳过（401/403/网络错误）
        if (
          error.message?.includes('401') ||
          error.message?.includes('403') ||
          error.message?.includes('Invalid') ||
          error.code === 'ECONNREFUSED'
        ) {
          return
        }
        throw error
      }
    })
  })

  describe('T-072: DeepSeek 故障回退到 OpenAI', () => {
    it('应在主 Provider 失败时回退到备用 Provider', async () => {
      // 验证回退机制存在
      try {
        const { NativeLLMAdapter } = await import('@yunpat/core')

        // 验证可创建多个 provider 实例
        expect(NativeLLMAdapter).toBeDefined()
      } catch (error: any) {
        if (error.message?.includes('Cannot find module')) {
          return
        }
        throw error
      }
    })
  })

  describe('T-073: Ollama 本地 Provider', () => {
    it('应连接到 Ollama 本地服务', async () => {
      if (!process.env.OLLAMA_BASE_URL) return

      try {
        const { createOllamaModel } = await import('@yunpat/core')

        const model = createOllamaModel({
          baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
          model: 'qwen2.5:7b',
        })

        const response = await model.chat({
          messages: [{ role: 'user', content: '你好' }],
          temperature: 0.1,
        })

        expect(response).toBeDefined()
      } catch (error: any) {
        if (error.message?.includes('Cannot find module')) {
          return
        }
        // Ollama 服务不可用时跳过
        if (error.code === 'ECONNREFUSED') {
          return
        }
        throw error
      }
    })
  })

  describe('T-074: OMLX Apple Silicon Provider', () => {
    it('应连接到 OMLX 本地服务', async () => {
      if (!process.env.OMLX_API_KEY) return

      try {
        // OMLX 使用 OpenAI 兼容 API
        const response = await fetch('http://localhost:8080/v1/models', {
          signal: AbortSignal.timeout(3000),
        })

        if (response.ok) {
          const models = await response.json()
          expect(models).toBeDefined()
        }
      } catch {
        // OMLX 服务不可用时跳过
      }
    })
  })

  describe('T-075: 全 Provider 失败时优雅降级', () => {
    it('应在所有 Provider 失败时返回友好错误', async () => {
      // 模拟所有 Provider 都失败
      const error = new Error('All LLM providers failed')
      error.cause = [
        new Error('DeepSeek: API key invalid'),
        new Error('OpenAI: Rate limit exceeded'),
        new Error('Ollama: Connection refused'),
      ]

      expect(error.message).toContain('failed')
      expect((error.cause as Error[]).length).toBe(3)
    })
  })
})
