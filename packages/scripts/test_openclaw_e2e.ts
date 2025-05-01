/**
 * OpenClaw 知识图谱端到端测试
 *
 * 测试 PostgreSQL + BGE-M3 向量检索 + jina-reranker 精排
 * 用法: npx tsx scripts/test_openclaw_e2e.ts
 */

import { OpenClawAdapter } from '../packages/unified-knowledge-graph/src/adapters/OpenClawAdapter.js'

const adapter = new OpenClawAdapter({
  host: 'localhost',
  port: 5432,
  database: 'legal_world_model',
  user: 'postgres',
  embeddingApiUrl: 'http://localhost:8009/v1/embeddings',
  embeddingApiKey: 'xj781102@',
  embeddingModel: 'bge-m3-mlx-8bit',
  rerankApiUrl: 'http://localhost:8009/v1/rerank',
  rerankModel: 'jina-reranker-v3-mlx',
})

async function main() {
  console.log('=== OpenClaw KG 端到端测试 ===\n')

  // 1. 初始化
  console.log('[1/6] 初始化适配器...')
  const t0 = Date.now()
  await adapter.initialize()
  console.log(`  ✅ 初始化完成 (${Date.now() - t0}ms)\n`)

  // 2. 统计信息
  console.log('[2/6] 统计信息...')
  const stats = await adapter.getStats()
  console.log(`  节点: ${stats.nodeCount}`)
  console.log(`  边: ${stats.edgeCount}`)
  console.log(`  嵌入: ${stats.embeddingCount} (${stats.embeddingCoverage})`)
  console.log(`  节点类型: ${JSON.stringify(stats.nodeTypes)}`)
  console.log(`  关系类型: ${JSON.stringify(stats.relationTypes)}\n`)

  // 3. 语义检索（向量 + rerank）
  const queries = ['权利要求', '等同侵权', '新颖性判断标准', '专利无效宣告程序']
  for (const q of queries) {
    console.log(`[3/6] 语义检索: "${q}"`)
    const t1 = Date.now()
    const results = await adapter.semanticSearch(q, 5)
    const elapsed = Date.now() - t1
    console.log(`  耗时: ${elapsed}ms, 结果数: ${results.length}`)
    for (const { node, score } of results.slice(0, 3)) {
      console.log(
        `  - [${node.nodeType}] score=${score.toFixed(4)} | ${node.title?.substring(0, 60) || node.name}`
      )
    }
    console.log()
  }

  // 4. 节点详情
  console.log('[4/6] 节点详情...')
  const sampleResults = await adapter.semanticSearch('创造性判断', 1)
  if (sampleResults.length > 0) {
    const nodeId = sampleResults[0].node.id
    const node = await adapter.getNode(nodeId)
    if (node) {
      console.log(`  节点ID: ${node.id}`)
      console.log(`  类型: ${node.nodeType}`)
      console.log(`  标题: ${node.title}`)
      console.log(`  内容: ${node.content.substring(0, 100)}...`)
    }
  }
  console.log()

  // 5. 邻居查询
  console.log('[5/6] 邻居查询...')
  if (sampleResults.length > 0) {
    const nodeId = sampleResults[0].node.id
    const neighbors = await adapter.getNeighbors(nodeId, 1)
    console.log(`  节点 ${nodeId} 的邻居数: ${neighbors.length}`)
    for (const n of neighbors.slice(0, 3)) {
      console.log(`  - [${n.nodeType}] ${n.title || n.name}`)
    }
  }
  console.log()

  // 6. 按类型查询
  console.log('[6/6] 按类型查询 IPC 节点...')
  const ipcNodes = await adapter.getNodesByType('IPC', 5)
  for (const n of ipcNodes) {
    console.log(`  - ${n.name}: ${n.title}`)
  }
  console.log()

  console.log('=== 测试完成 ===')
  await adapter.close()
}

main().catch((err) => {
  console.error('测试失败:', err)
  process.exit(1)
})
