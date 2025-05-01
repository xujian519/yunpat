/**
 * 智谱 GLM 模型测试
 */

import { describe, it, expect } from 'vitest'
import { createZhipuModel, NativeModel } from '../NativeLLMAdapter.js'

describe('智谱 GLM 模型测试', () => {
  describe('1. GLM-4.7（最新旗舰）', () => {
    it('应该能够生成高质量代码', async () => {
      const glm = createZhipuModel(process.env.ZHIPU_API_KEY || '', NativeModel.GLM_4_7)

      const response = await glm.chat({
        messages: [
          {
            role: 'user',
            content: '用 TypeScript 写一个二叉树的中序遍历函数，包含详细注释',
          },
        ],
        maxTokens: 2000,
        temperature: 0.2,
      })

      expect(response.message.content).toBeTruthy()
      expect(response.message.content.length).toBeGreaterThan(100)
      console.log('\n✅ GLM-4.7 响应长度:', response.message.content.length)
      console.log('代码预览:', response.message.content.substring(0, 200) + '...')

      // 验证包含 TypeScript 相关内容
      const hasTypescript =
        response.message.content.includes('function') ||
        response.message.content.includes('const') ||
        response.message.content.includes('interface')
      expect(hasTypescript).toBe(true)
    })

    it('应该支持流式输出', async () => {
      const glm = createZhipuModel(process.env.ZHIPU_API_KEY || '', NativeModel.GLM_4_7)

      const chunks: string[] = []
      for await (const chunk of glm.chatStream({
        messages: [{ role: 'user', content: '介绍一下快速排序算法' }],
        maxTokens: 500,
      })) {
        if (chunk.done) break
        chunks.push(chunk.delta)
      }

      const fullText = chunks.join('')
      expect(fullText.length).toBeGreaterThan(0)
      console.log('\n✅ GLM-4.7 流式输出成功，总长度:', fullText.length)
    })
  })

  describe('2. GLM-4-Flash（快速响应）', () => {
    it('应该能够快速响应简单对话', async () => {
      const glm = createZhipuModel(process.env.ZHIPU_API_KEY || '', NativeModel.GLM_4_FLASH)

      const response = await glm.chat({
        messages: [{ role: 'user', content: '你好，请简短自我介绍' }],
        maxTokens: 100,
      })

      expect(response.message.content).toBeTruthy()
      console.log('\n✅ GLM-4-Flash 响应:', response.message.content)
    })
  })

  describe('3. GLM-4-Plus（平衡性能）', () => {
    it('应该能够处理代码优化任务', async () => {
      const glm = createZhipuModel(process.env.ZHIPU_API_KEY || '', NativeModel.GLM_4_PLUS)

      const response = await glm.chat({
        messages: [
          {
            role: 'user',
            content:
              '优化以下代码性能：\nfunction sum(arr) {\n  let result = 0;\n  for (let i = 0; i < arr.length; i++) {\n    result += arr[i];\n  }\n  return result;\n}',
          },
        ],
        maxTokens: 1000,
        temperature: 0.3,
      })

      expect(response.message.content).toBeTruthy()
      expect(response.message.content.length).toBeGreaterThan(50)
      console.log('\n✅ GLM-4-Plus 代码优化响应长度:', response.message.content.length)
    })
  })

  describe('4. 编程任务对比', () => {
    it('应该能够处理多种编程语言', async () => {
      const glm = createZhipuModel(process.env.ZHIPU_API_KEY || '', NativeModel.GLM_4_7)

      const tasks = ['用 Python 写一个装饰器', '用 Rust 实现一个结构体', '用 Go 写一个并发示例']

      for (const task of tasks) {
        const response = await glm.chat({
          messages: [{ role: 'user', content: task }],
          maxTokens: 800,
          temperature: 0.2,
        })

        expect(response.message.content).toBeTruthy()
        console.log(`\n✅ 任务: "${task}"`)
        console.log(`   响应长度: ${response.message.content.length} 字符`)
      }
    })
  })
})
