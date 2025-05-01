#!/usr/bin/env node

/**
 * oMLX 集成测试脚本
 *
 * 测试本地 oMLX 模型的各项功能：
 * 1. 聊天对话
 * 2. 流式输出
 * 3. 嵌入向量
 * 4. 专利场景测试
 */

import { createPatentWritingModel, createReasoningModel } from '../packages/core/dist/llm/index.js'

console.log(
  `\n🔑 环境变量 OMLX_API_KEY: ${process.env.OMLX_API_KEY ? process.env.OMLX_API_KEY.slice(0, 6) + '...' : '未设置'}`
)
console.log(`🔗 OMLX_BASE_URL: ${process.env.OMLX_BASE_URL || 'http://localhost:8009/v1'}`)

/**
 * 测试基础聊天
 */
async function testChat() {
  console.log('\n📝 测试 1: 基础聊天')
  console.log('='.repeat(50))

  const omxl = createReasoningModel()

  try {
    const response = await omxl.chat({
      messages: [
        {
          role: 'user',
          content: '请用一句话解释什么是专利？',
        },
      ],
      temperature: 0.7,
      maxTokens: 200,
    })

    console.log('✅ 聊天成功')
    console.log('📄 响应:', response.message.content)
    console.log('📊 Token 使用:', response.usage)
  } catch (error) {
    console.error('❌ 聊天失败:', error)
  }
}

/**
 * 测试流式聊天
 */
async function testChatStream() {
  console.log('\n🌊 测试 2: 流式聊天')
  console.log('='.repeat(50))

  const omxl = createReasoningModel()

  try {
    console.log('🤖 响应:')

    let fullContent = ''
    for await (const chunk of omxl.chatStream({
      messages: [
        {
          role: 'user',
          content: '请列举专利的三个主要特征',
        },
      ],
      temperature: 0.7,
      maxTokens: 300,
    })) {
      if (chunk.done) {
        console.log('\n\n✅ 流式输出完成')
        break
      }

      process.stdout.write(chunk.delta)
      fullContent += chunk.delta
    }

    console.log(`\n📊 总字符数: ${fullContent.length}`)
  } catch (error) {
    console.error('\n❌ 流式聊天失败:', error)
  }
}

/**
 * 测试嵌入向量
 */
async function testEmbedding() {
  console.log('\n🔢 测试 3: 嵌入向量')
  console.log('='.repeat(50))

  const omxl = createReasoningModel()

  try {
    const texts = ['专利是一种知识产权', '专利保护技术创新']

    console.log('📝 输入文本:', texts)

    const embeddings = await omxl.embed(texts)

    console.log('✅ 嵌入生成成功')
    console.log(`📊 向量维度: ${embeddings[0].length}`)
    console.log(
      '📈 向量范数:',
      embeddings.map((v) => Math.sqrt(v.reduce((s, x) => s + x * x, 0)))
    )

    // 计算相似度
    const similarity = cosineSimilarity(embeddings[0], embeddings[1])
    console.log(`🔗 相似度: ${similarity.toFixed(4)}`)
  } catch (error) {
    console.error('❌ 嵌入失败:', error)
  }
}

/**
 * 计算余弦相似度
 */
function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum: number, x: number, i: number) => sum + x * b[i], 0)
  const normA = Math.sqrt(a.reduce((sum: number, x: number) => sum + x * x, 0))
  const normB = Math.sqrt(b.reduce((sum: number, x: number) => sum + x * x, 0))
  return dotProduct / (normA * normB)
}

/**
 * 测试专利撰写场景
 */
async function testPatentWriting() {
  console.log('\n📜 测试 4: 专利撰写场景')
  console.log('='.repeat(50))

  const omxl = createPatentWritingModel()

  try {
    const response = await omxl.chat({
      messages: [
        {
          role: 'system',
          content: '你是一位专业的专利代理师。请根据提供的技术方案撰写独立权利要求。',
        },
        {
          role: 'user',
          content: `技术方案：
一种智能图像识别系统，包括：
1. 图像采集模块，使用高分辨率摄像头采集图像
2. 深度学习处理模块，使用卷积神经网络提取图像特征
3. 分类识别模块，根据特征进行图像分类
4. 结果输出模块，显示识别结果

请撰写独立权利要求。`,
        },
      ],
      temperature: 0.5,
      maxTokens: 500,
    })

    console.log('✅ 专利撰写成功')
    console.log('📄 权利要求:\n')
    console.log(response.message.content)
  } catch (error) {
    console.error('❌ 专利撰写失败:', error)
  }
}

/**
 * 测试专利分析场景
 */
async function testPatentAnalysis() {
  console.log('\n🔍 测试 5: 专利分析场景')
  console.log('='.repeat(50))

  const omxl = createReasoningModel()

  try {
    const response = await omxl.chat({
      messages: [
        {
          role: 'system',
          content: '你是一位专业的专利分析师。请分析权利要求的新颖性和创造性。',
        },
        {
          role: 'user',
          content: `权利要求：
1. 一种图像识别方法，其特征在于，包括：
   - 获取待识别图像；
   - 使用残差网络提取图像特征；
   - 根据所述特征进行图像分类。

现有技术：
- 已有使用卷积神经网络进行图像识别的方法
- 已有使用残差网络进行图像分类的方法

请分析该权利要求的新颖性。`,
        },
      ],
      temperature: 0.3,
      maxTokens: 400,
    })

    console.log('✅ 专利分析成功')
    console.log('📄 分析结果:\n')
    console.log(response.message.content)
  } catch (error) {
    console.error('❌ 专利分析失败:', error)
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 oMLX 集成测试')
  console.log('='.repeat(50))
  console.log(`🔗 API 地址: ${process.env.OMLX_BASE_URL || 'http://localhost:8009/v1'}`)
  console.log(
    `🤖 模型: ${process.env.OMLX_MODEL_NAME || 'Qwen3.5-27B-Claude-4.6-Opus-Distilled-MLX-4bit'}`
  )

  // 运行所有测试
  await testChat()
  await testChatStream()
  await testEmbedding()
  await testPatentWriting()
  await testPatentAnalysis()

  console.log('\n✅ 所有测试完成！')
  console.log('\n💡 提示：')
  console.log('  - oMLX 本地模型适合离线使用')
  console.log('  - Qwen3.5-27B 适合复杂推理任务')
  console.log('  - gemma-4-e2b-it-4bit 适合快速对话')
  console.log('  - 可通过 CLI 选项切换 LLM 提供商')
}

// 运行测试
main().catch((error) => {
  console.error('❌ 测试失败:', error)
  process.exit(1)
})
