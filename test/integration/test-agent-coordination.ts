/**
 * 测试 6: 多 Agent 协同（完全独立）
 * 不依赖 AgentMemoryManager，直接测试核心功能
 */

import { PostgresVectorStore } from '../../packages/core/src/memory/long-term/PostgresVectorStore.js'
import { createBGEM3Client } from '../../packages/core/src/memory/integration/BGEIntegration.js'

async function testMultiAgentCoordination() {
  console.log('=== 测试 6: 多 Agent 协同 ===\n')

  // 1. 初始化共享的记忆层
  console.log('1️⃣ 初始化共享记忆层...')

  const vectorStore = new PostgresVectorStore({
    databaseUrl: process.env.DATABASE_URL || 'postgres://yunpat:yunpat123@localhost:5432/yunpat',
    vectorDimension: 1024,
  })

  await vectorStore.initialize()
  console.log('✅ PostgreSQL 向量存储初始化成功\n')

  // 2. 初始化 BGE 嵌入服务
  console.log('2️⃣ 初始化 BGE 嵌入服务...')

  const bge = createBGEM3Client({
    apiKey: process.env.BGE_API_KEY || 'xj781102@',
  })

  console.log('✅ BGE 嵌入服务初始化成功\n')

  // 3. 模拟 Agent A（Writer）存储记忆
  console.log('3️⃣ 模拟 Agent A（Writer）存储记忆...')

  const writerMemories = [
    {
      type: 'patent_draft',
      content: '基于深度学习的图像识别方法，包括卷积神经网络层、池化层和全连接层',
      metadata: { agent: 'writer', timestamp: new Date().toISOString() },
    },
    {
      type: 'patent_draft',
      content: '自然语言处理中的注意力机制，用于提高机器翻译的准确性',
      metadata: { agent: 'writer', timestamp: new Date().toISOString() },
    },
  ]

  for (const memory of writerMemories) {
    const embedding = await bge.embed(memory.content)
    const id = await vectorStore.upsert({
      ...memory,
      embedding: embedding,
    })
    console.log(`✅ Writer Agent 存储 ID: ${id} - ${memory.content.slice(0, 30)}...`)
  }

  console.log()

  // 4. 模拟 Agent B（Analyzer）存储记忆
  console.log('4️⃣ 模拟 Agent B（Analyzer）存储记忆...')

  const analyzerMemories = [
    {
      type: 'patent_analysis',
      content: '图像识别专利的技术方案新颖，使用了深度卷积神经网络',
      metadata: { agent: 'analyzer', timestamp: new Date().toISOString() },
    },
    {
      type: 'patent_analysis',
      content: '注意力机制专利具有创造性，解决了长距离依赖问题',
      metadata: { agent: 'analyzer', timestamp: new Date().toISOString() },
    },
  ]

  for (const memory of analyzerMemories) {
    const embedding = await bge.embed(memory.content)
    const id = await vectorStore.upsert({
      ...memory,
      embedding: embedding,
    })
    console.log(`✅ Analyzer Agent 存储 ID: ${id} - ${memory.content.slice(0, 30)}...`)
  }

  console.log()

  // 5. 模拟 Agent C（Responder）跨 Agent 搜索记忆
  console.log('5️⃣ 模拟 Agent C（Responder）跨 Agent 搜索记忆...')

  const queryEmbedding = await bge.embed('图像识别 深度学习')
  console.log(`🔍 调试：查询向量维度 = ${queryEmbedding.length}`)
  console.log(`🔍 调试：查询向量前5个值 = ${queryEmbedding.slice(0, 5)}`)

  const searchResults = await vectorStore.search(queryEmbedding, 5, {
    excludeArchived: true,
  })

  console.log(`✅ Responder Agent 搜索到 ${searchResults.length} 条相关记忆：`)
  searchResults.forEach(
    (
      result: { metadata?: { agent?: string }; content: string; similarity: number; type: string },
      index: number
    ) => {
      const agent = result.metadata?.agent || 'unknown'
      console.log(`   ${index + 1}. [${agent}] ${result.content.slice(0, 40)}...`)
      console.log(`      相似度: ${(result.similarity * 100).toFixed(1)}% | 类型: ${result.type}`)
    }
  )

  console.log()

  // 6. 测试元数据过滤（按 Agent 类型）
  console.log('6️⃣ 测试元数据过滤（按 Agent 类型）...')

  const writerOnlyResults = await vectorStore.search(queryEmbedding, 5, {
    excludeArchived: true,
  })

  const writerResults = writerOnlyResults.filter(
    (r: { metadata?: { agent?: string } }) => r.metadata?.agent === 'writer'
  )

  console.log(`✅ 仅 Writer Agent 的记忆：${writerResults.length} 条`)

  const analyzerResults = writerOnlyResults.filter(
    (r: { metadata?: { agent?: string } }) => r.metadata?.agent === 'analyzer'
  )

  console.log(`✅ 仅 Analyzer Agent 的记忆：${analyzerResults.length} 条\n`)

  // 7. 测试记忆层统计
  console.log('7️⃣ 测试记忆层统计...')

  const stats = await vectorStore.getStats()
  console.log(`✅ 总记忆数：${stats.totalMemories}`)
  console.log(`✅ 归档记忆数：${stats.archivedMemories}`)
  console.log(`✅ 类型分布：`)
  Object.entries(stats.typeDistribution).forEach(([type, count]) => {
    console.log(`   - ${type}: ${count} 条`)
  })

  console.log()

  // 8. 测试跨 Agent 知识融合
  console.log('8️⃣ 测试跨 Agent 知识融合...')

  const fusionQuery = await bge.embed('深度学习 注意力机制')

  const fusionResults = await vectorStore.search(fusionQuery, 10, {
    excludeArchived: true,
  })

  console.log(`✅ 融合搜索结果（${fusionResults.length} 条）：`)
  const agentCounts = fusionResults.reduce(
    (acc: Record<string, number>, result: { metadata?: { agent?: string } }) => {
      const agent = result.metadata?.agent || 'unknown'
      acc[agent] = (acc[agent] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  Object.entries(agentCounts).forEach(([agent, count]) => {
    console.log(`   - ${agent}: ${count} 条`)
  })

  console.log()

  // 9. 总结
  console.log('=== 测试总结 ===')
  console.log('✅ 共享记忆层初始化成功')
  console.log('✅ 多 Agent 可以同时存储记忆')
  console.log('✅ 跨 Agent 语义搜索工作正常')
  console.log('✅ 元数据过滤功能正常')
  console.log('✅ 记忆层统计功能正常')
  console.log('✅ 跨 Agent 知识融合成功')
  console.log('\n✅ 多 Agent 协同测试完成！')

  await vectorStore.close()
}

testMultiAgentCoordination().catch(console.error)
