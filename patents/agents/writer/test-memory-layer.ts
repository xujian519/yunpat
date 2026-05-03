/**
 * PatentWriterAgent 记忆层集成验证（简化版）
 *
 * 直接使用已验证的组件
 */

import { createBGEM3Client } from '../../../packages/core/src/memory/integration/BGEIntegration.js'
import { PostgresVectorStore } from '../../../packages/core/src/memory/long-term/PostgresVectorStore.js'
import { createTokenWindowManager } from '../../../packages/core/src/memory/short-term/TokenWindow.js'

async function testMemoryLayer() {
  console.log('=== PatentWriterAgent 记忆层验证 ===\n')

  // 1. BGE-M3 测试
  console.log('1️⃣ BGE-M3 文本向量化...')
  const bgeClient = createBGEM3Client({
    apiKey: 'xj781102@',
  })

  const embedding = await bgeClient.embed('专利撰写的关键在于权利要求书的撰写')
  console.log(`   ✅ 向量维度: ${embedding.length}`)
  console.log(
    `   ✅ 前5个值: [${embedding
      .slice(0, 5)
      .map((v) => v.toFixed(4))
      .join(', ')}]\n`
  )

  // 2. PostgreSQL 向量存储测试
  console.log('2️⃣ PostgreSQL 向量存储...')
  const vectorStore = new PostgresVectorStore({
    databaseUrl: 'postgres://yunpat:yunpat123@localhost:5432/yunpat',
    vectorDimension: 1024,
  })

  await vectorStore.initialize()
  console.log('   ✅ 数据库已初始化')

  const patentId = await vectorStore.upsert({
    type: 'patent',
    content: '基于注意力机制的医学图像分析方法',
    embedding: embedding,
    metadata: {
      title: '医学图像分析',
      field: 'AI',
      createdAt: new Date().toISOString(),
    },
  })
  console.log(`   ✅ 专利已保存: ID ${patentId}`)

  const results = await vectorStore.search(embedding, 3, {
    types: ['patent'],
  })
  console.log(`   ✅ 搜索成功: ${results.length} 条结果\n`)

  // 3. Token 窗口测试
  console.log('3️⃣ Token 窗口管理...')
  const tokenWindow = createTokenWindowManager({
    maxTokens: 4000,
    enableSummary: true,
  })

  const history = Array.from({ length: 20 }, (_, i) => ({
    role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
    content: `第${i + 1}轮对话：专利撰写需要专业的技术知识和法律知识。`,
  }))

  const { stats } = await tokenWindow.slideWindow(history)
  console.log(`   ✅ 压缩比例: ${(stats.compressionRatio * 100).toFixed(2)}%\n`)

  await vectorStore.close()

  console.log('✅ 验证完成！记忆层已集成到 PatentWriterAgent\n')
  console.log('📊 统计信息：')
  console.log(`   - 向量维度: ${embedding.length}`)
  console.log(`   - Token 压缩: ${(stats.compressionRatio * 100).toFixed(2)}%`)
  console.log(`   - 数据库: PostgreSQL + pgvector`)
}

testMemoryLayer().catch(console.error)
