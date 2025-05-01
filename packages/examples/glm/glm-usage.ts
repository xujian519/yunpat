/**
 * GLM (智谱 AI) 模型使用示例
 *
 * 展示如何在 YunPat 框架中使用 GLM 模型
 */

import { NativeLLMAdapter, NativeModel } from '../packages/core/src/llm/NativeLLMAdapter.js'
import { BaseGateway } from '../packages/core/src/gateway/BaseGateway.js'

/**
 * 方式 1: 直接使用 NativeLLMAdapter
 */
export async function example1_DirectUse() {
  console.log('\n📝 示例 1: 直接使用 GLM 模型')
  console.log('─'.repeat(60))

  // 创建 GLM 模型
  const glmModel = new NativeLLMAdapter({
    name: NativeModel.GLM_4_FLASH,
    apiKey: process.env.GLM_API_KEY!,
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
  })

  // 简单对话
  const response = await glmModel.chat({
    messages: [
      {
        role: 'user',
        content: '什么是人工智能？请用一句话解释。',
      },
    ],
    maxTokens: 100,
  })

  console.log('✅ 响应:', response.content)
  console.log('Token 使用:', response.usage)
}

/**
 * 方式 2: 与 Gateway 集成
 */
export async function example2_GatewayIntegration() {
  console.log('\n📝 示例 2: 与 Gateway 集成')
  console.log('─'.repeat(60))

  // 创建 Gateway（使用 GLM 作为 LLM）
  const gateway = new BaseGateway({
    llm: new NativeLLMAdapter({
      name: NativeModel.GLM_4_FLASH,
      apiKey: process.env.GLM_API_KEY!,
      baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    }),
  })

  // 处理用户输入
  const result = await gateway.processInput({
    content: '分析一下 TypeScript 的优缺点。',
    userId: 'user-123',
    agentName: 'TestAgent',
  })

  console.log('✅ Gateway 处理结果:', result.content)
  console.log('Token 使用:', result.usage)
}

/**
 * 方式 3: 使用不同的 GLM 模型
 */
export async function example3_DifferentModels() {
  console.log('\n📝 示例 3: 使用不同的 GLM 模型')
  console.log('─'.repeat(60))

  const models = [
    { name: 'GLM-4-Flash', model: NativeModel.GLM_4_FLASH, description: '快速响应' },
    { name: 'GLM-4-Plus', model: NativeModel.GLM_4_PLUS, description: '平衡性能' },
    { name: 'GLM-4-Air', model: NativeModel.GLM_4_AIR, description: '轻量级' },
  ]

  for (const { name, model, description } of models) {
    console.log(`\n🔍 测试 ${name} (${description})`)

    const glmModel = new NativeLLMAdapter({
      name: model,
      apiKey: process.env.GLM_API_KEY!,
      baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    })

    const response = await glmModel.chat({
      messages: [
        {
          role: 'user',
          content: '用 10 个字以内介绍 TypeScript',
        },
      ],
      maxTokens: 50,
    })

    console.log(`✅ 响应: ${response.content}`)
    console.log(`   Token: ${JSON.stringify(response.usage)}`)
  }
}

/**
 * 方式 4: 流式输出
 */
export async function example4_Streaming() {
  console.log('\n📝 示例 4: 流式输出')
  console.log('─'.repeat(60))

  const glmModel = new NativeLLMAdapter({
    name: NativeModel.GLM_4_FLASH,
    apiKey: process.env.GLM_API_KEY!,
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
  })

  console.log('✅ 流式响应:')

  const stream = glmModel.streamChat({
    messages: [
      {
        role: 'user',
        content: '写一首关于人工智能的短诗（4 行）',
      },
    ],
    maxTokens: 200,
  })

  let fullContent = ''
  for await (const chunk of stream) {
    if (chunk.content) {
      process.stdout.write(chunk.content)
      fullContent += chunk.content
    }
  }

  console.log('\n\n✅ 流式输出完成')
  console.log('总长度:', fullContent.length, '字符')
}

/**
 * 方式 5: 多轮对话
 */
export async function example5_MultiTurnConversation() {
  console.log('\n📝 示例 5: 多轮对话')
  console.log('─'.repeat(60))

  const glmModel = new NativeLLMAdapter({
    name: NativeModel.GLM_4_FLASH,
    apiKey: process.env.GLM_API_KEY!,
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
  })

  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    {
      role: 'user',
      content: '什么是 React？',
    },
  ]

  // 第一轮
  console.log('👤 用户: 什么是 React？')
  const response1 = await glmModel.chat({ messages, maxTokens: 200 })
  console.log(`🤖 GLM: ${response1.content}`)

  // 第二轮
  messages.push({ role: 'assistant', content: response1.content })
  messages.push({ role: 'user', content: '它和 Vue 有什么区别？' })
  console.log('\n👤 用户: 它和 Vue 有什么区别？')

  const response2 = await glmModel.chat({ messages, maxTokens: 200 })
  console.log(`🤖 GLM: ${response2.content}`)

  // 第三轮
  messages.push({ role: 'assistant', content: response2.content })
  messages.push({ role: 'user', content: '我应该选择哪个？' })
  console.log('\n👤 用户: 我应该选择哪个？')

  const response3 = await glmModel.chat({ messages, maxTokens: 200 })
  console.log(`🤖 GLM: ${response3.content}`)
}

/**
 * 方式 6: 代码生成（编程套餐）
 */
export async function example6_CodeGeneration() {
  console.log('\n📝 示例 6: 代码生成（编程套餐）')
  console.log('─'.repeat(60))

  const glmModel = new NativeLLMAdapter({
    name: NativeModel.GLM_4_FLASH, // 或使用 GLM-4-Plus 获得更好的代码生成能力
    apiKey: process.env.GLM_API_KEY!,
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    temperature: 0.2, // 降低温度以获得更确定的代码
  })

  const codeTasks = [
    {
      name: 'TypeScript 类型定义',
      prompt: '用 TypeScript 定义一个 User 接口，包含 id, name, email, age 字段，并提供类型注释。',
    },
    {
      name: '异步函数',
      prompt: '写一个 TypeScript 异步函数，用于获取用户数据，包含错误处理和类型注释。',
    },
    {
      name: 'React 组件',
      prompt: '写一个 React 函数组件，展示用户列表，使用 TypeScript 和 Hooks。',
    },
  ]

  for (const { name, prompt } of codeTasks) {
    console.log(`\n🔍 任务: ${name}`)
    console.log('─'.repeat(40))

    const response = await glmModel.chat({
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      maxTokens: 500,
    })

    console.log(response.content)
  }
}

/**
 * 主函数
 */
export async function main() {
  // 检查 API Key
  if (!process.env.GLM_API_KEY) {
    console.error('❌ 错误: 请设置 GLM_API_KEY 环境变量')
    console.error('\n使用方式:')
    console.error('  export GLM_API_KEY=your_api_key_here')
    console.error('  pnpm --filter @yunpat/core exec tsx examples/glm-usage.ts\n')
    process.exit(1)
  }

  console.log('🚀 GLM 模型使用示例')
  console.log('='.repeat(60))

  try {
    // 运行所有示例
    await example1_DirectUse()
    await example2_GatewayIntegration()
    await example3_DifferentModels()
    await example4_Streaming()
    await example5_MultiTurnConversation()
    await example6_CodeGeneration()

    console.log('\n✅ 所有示例运行完成')
  } catch (error) {
    console.error('\n❌ 错误:', error)
    process.exit(1)
  }
}

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
