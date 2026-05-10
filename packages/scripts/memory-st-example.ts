/**
 * Token 窗口与上下文管理示例
 *
 * 演示完整的对话管理流程
 */

import { TokenWindowManager } from './TokenWindow.js'
import { ContextManager } from './ContextManager.js'

/**
 * 示例 1: 基础 Token 窗口管理
 */
async function example1() {
  console.log('=== 示例 1: Token 窗口管理 ===\n')

  const manager = new TokenWindowManager({
    maxTokens: 500,
    reservedTokens: 50,
    enableSummary: true,
  })

  // 模拟长对话
  const messages = Array.from({ length: 20 }, (_, i) => ({
    role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
    content: `这是第 ${i + 1} 条消息。`.repeat(10),
    timestamp: new Date(),
  }))

  console.log(`原始消息数: ${messages.length}`)

  // 应用 Token 窗口
  const { messages: compressed, stats } = await manager.slideWindow(messages)

  console.log(`压缩后消息数: ${compressed.length}`)
  console.log(`原始 Token 数: ${stats.originalTokens}`)
  console.log(`压缩后 Token 数: ${stats.compressedTokens}`)
  console.log(`压缩比例: ${(stats.compressionRatio * 100).toFixed(2)}%`)
  console.log(`是否使用摘要: ${stats.summaryUsed ? '是' : '否'}`)

  // 显示压缩后的消息
  console.log('\n压缩后的消息（前 3 条）:')
  for (const msg of compressed.slice(0, 3)) {
    console.log(`  [${msg.role}]: ${msg.content.slice(0, 50)}...`)
  }
}

/**
 * 示例 2: 上下文管理
 */
async function example2() {
  console.log('\n=== 示例 2: 上下文管理 ===\n')

  const manager = new ContextManager({
    maxTokens: 1000,
    reservedTokens: 100,
    systemPrompt: '你是一个专业的专利撰写助手，精通专利法和撰写规范。',
  })

  const messages = [
    { role: 'user' as const, content: '你好，我想申请一个专利', timestamp: new Date() },
    {
      role: 'assistant' as const,
      content: '你好！我可以帮助你撰写专利申请文件。',
      timestamp: new Date(),
    },
    { role: 'user' as const, content: '专利的核心创新点是什么？', timestamp: new Date() },
    {
      role: 'assistant' as const,
      content: '专利的核心创新点应该是指技术方案中的创造性特征，是区别于现有技术的关键技术点。',
      timestamp: new Date(),
    },
  ]

  // 构建上下文
  const { context, stats } = await manager.buildContext(messages, {
    asMarkdown: true,
    includeRole: true,
  })

  console.log('构建的上下文:\n')
  console.log(context)
  console.log(`\n统计信息:`)
  console.log(`  总消息数: ${stats.totalMessages}`)
  console.log(`  总 Token 数: ${stats.totalTokens}`)
  console.log(`  压缩比例: ${(stats.compressionRatio * 100).toFixed(2)}%`)
}

/**
 * 示例 3: Token 预测与优化
 */
async function example3() {
  console.log('\n=== 示例 3: Token 预测与优化 ===\n')

  const manager = new ContextManager({
    maxTokens: 500,
    reservedTokens: 50,
  })

  const messages = Array.from({ length: 15 }, (_, i) => ({
    role: 'user' as const,
    content: `这是第 ${i + 1} 条关于专利撰写的问题。`.repeat(5),
    timestamp: new Date(),
  }))

  // 预测下一轮 Token 使用
  const prediction = await manager.predictNextTokens(messages, 800)

  console.log('Token 预测:')
  console.log(`  当前 Token 数: ${prediction.currentTokens}`)
  console.log(`  预估响应 Token 数: ${prediction.estimatedResponseTokens}`)
  console.log(`  预估总 Token 数: ${prediction.totalEstimatedTokens}`)
  console.log(`  是否超限: ${prediction.willExceedLimit ? '是' : '否'}`)

  if (prediction.willExceedLimit) {
    console.log('\n优化建议:')
    for (const action of prediction.recommendedActions) {
      console.log(`  - ${action}`)
    }

    // 自动优化
    console.log('\n自动优化中...')
    const { context, stats } = await manager.buildContext(messages)

    console.log(`优化后 Token 数: ${stats.totalTokens}`)
    console.log(`压缩比例: ${(stats.compressionRatio * 100).toFixed(2)}%`)
  }
}

/**
 * 示例 4: 重要性评分
 */
async function example4() {
  console.log('\n=== 示例 4: 重要性评分 ===\n')

  const manager = new TokenWindowManager()

  const messages = [
    { role: 'user' as const, content: '专利的核心创新点是什么？', timestamp: new Date() },
    {
      role: 'assistant' as const,
      content: '核心创新点是技术方案中的创造性特征。',
      timestamp: new Date(),
    },
    { role: 'user' as const, content: '谢谢', timestamp: new Date() },
    { role: 'assistant' as const, content: '不客气！', timestamp: new Date() },
  ]

  console.log('消息重要性评分:')

  for (const msg of messages) {
    const score = await manager.scoreImportance(msg, {
      recentMessages: messages,
      currentTask: '专利撰写',
    })

    console.log(`  [${msg.role}]: ${msg.content.slice(0, 30)}... - 评分: ${score.toFixed(2)}`)
  }

  // 优化窗口（只保留重要消息）
  const { messages: optimized, stats } = await manager.optimizeWindow(messages, {
    currentTask: '专利撰写',
  })

  console.log(`\n优化后消息数: ${optimized.length}/${messages.length}`)
  console.log(`平均重要性: ${stats.avgImportance.toFixed(2)}`)
}

/**
 * 主函数
 */
async function main() {
  try {
    await example1()
    await example2()
    await example3()
    await example4()

    console.log('\n✅ 所有示例执行完成！')
  } catch (error) {
    console.error('❌ 执行失败:', error)
    process.exit(1)
  }
}

// 运行示例
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
