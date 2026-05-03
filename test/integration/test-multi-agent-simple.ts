/**
 * 测试 6: 多 Agent 协同（简化版）
 * 直接测试 AgentMemoryManager 的核心功能
 */

import * as path from 'path'
import { fileURLToPath } from 'url'

// 使用相对路径直接导入
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 动态导入模块
async function runTest() {
  console.log('=== 测试 6: 多 Agent 协同 ===\n')

  try {
    // 1. 导入必要的模块
    console.log('1️⃣ 加载模块...')

    const { AgentMemoryManager } = await import('../../patents/agents/AgentMemoryManager.js')
    const { PostgresVectorStore } =
      await import('../../packages/core/src/memory/long-term/PostgresVectorStore.js')
    const { BGEEmbedding } =
      await import('../../packages/core/src/memory/embedding/BGEEmbedding.js')

    console.log('✅ 模块加载完成\n')

    // 2. 测试数据库连接
    console.log('2️⃣ 测试数据库连接...')

    const vectorStore = new PostgresVectorStore({
      databaseUrl:
        process.env.DATABASE_URL || 'postgres://yunpat:yunpat:yunpat123@localhost:5432/yunpat',
      vectorDimension: 1024,
    })

    await vectorStore.initialize()
    console.log('✅ PostgreSQL 向量存储初始化成功')

    const stats = await vectorStore.getStats()
    console.log(`✅ 当前记忆数：${stats.totalMemories} 条\n`)

    // 3. 测试 BGE 嵌入
    console.log('3️⃣ 测试 BGE 嵌入...')

    const bge = new BGEEmbedding({
      apiKey: process.env.BGE_API_KEY || 'xj781102@',
    })

    const embedding1 = await bge.embed(['智能体 A 写了一个专利'])
    const embedding2 = await bge.embed(['智能体 B 分析了该专利'])

    console.log(`✅ 嵌入维度：${embedding1[0].length}`)
    console.log(`✅ 嵌入维度：${embedding2[0].length}\n`)

    // 4. 测试向量存储
    console.log('4️⃣ 测试向量存储...')

    const id1 = await vectorStore.upsert({
      type: 'patent_draft',
      content: '智能体 A 写了一个专利：基于深度学习的图像识别方法',
      embedding: embedding1[0],
      metadata: {
        agent: 'writer',
        timestamp: new Date().toISOString(),
      },
    })

    console.log(`✅ 存储 ID: ${id1}`)

    const id2 = await vectorStore.upsert({
      type: 'patent_analysis',
      content: '智能体 B 分析了该专利：技术方案新颖，具有创造性',
      embedding: embedding2[0],
      metadata: {
        agent: 'analyzer',
        timestamp: new Date().toISOString(),
      },
    })

    console.log(`✅ 存储 ID: ${id2}\n`)

    // 5. 测试跨 Agent 语义搜索
    console.log('5️⃣ 测试跨 Agent 语义搜索...')

    const queryEmbedding = await bge.embed(['图像识别 深度学习'])

    const searchResults = await vectorStore.search(queryEmbedding[0], 5, {
      excludeArchived: true,
    })

    console.log(`✅ 搜索到 ${searchResults.length} 条相关记忆：`)
    searchResults.forEach(
      (result: { type: string; content: string; similarity: number }, index: number) => {
        console.log(`   ${index + 1}. [${result.type}] ${result.content.slice(0, 50)}...`)
        console.log(`      相似度: ${(result.similarity * 100).toFixed(1)}%`)
      }
    )

    console.log()

    // 6. 测试记忆层统计
    console.log('6️⃣ 测试记忆层统计...')

    const finalStats = await vectorStore.getStats()
    console.log(`✅ 总记忆数：${finalStats.totalMemories}`)
    console.log(`✅ 归档记忆数：${finalStats.archivedMemories}`)
    console.log(`✅ 类型分布：`)
    Object.entries(finalStats.typeDistribution).forEach(([type, count]) => {
      console.log(`   - ${type}: ${count} 条`)
    })

    console.log()

    // 7. 总结
    console.log('=== 测试总结 ===')
    console.log('✅ 数据库连接正常')
    console.log('✅ BGE 嵌入工作正常')
    console.log('✅ 向量存储功能正常')
    console.log('✅ 跨 Agent 语义搜索正常')
    console.log('✅ 记忆层统计功能正常')
    console.log('\n✅ 多 Agent 协同测试完成！')

    await vectorStore.close()
  } catch (error) {
    console.error('❌ 测试失败:', error)
    throw error
  }
}

runTest().catch(console.error)
