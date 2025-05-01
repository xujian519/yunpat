/**
 * 知识卡片批量生成脚本
 *
 * 使用 gemma-4-e2b-it-4bit (LLM) + bge-m3-mlx-8bit (Embedding)
 * 从 Obsidian 知识库批量生成知识卡片
 *
 * 用法: npx tsx scripts/generate-cards.ts [--concepts 创造性,新颖性] [--batch-size 8]
 */

import { CardPipeline } from '../packages/core/src/knowledge/CardPipeline.js'
import { EmbeddingAdapter } from '../packages/core/src/llm/EmbeddingAdapter.js'
import { OMLXAdapter } from '../packages/core/src/llm/OMXLAdapter.js'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(__dirname, '..')

// 解析命令行参数
const args = process.argv.slice(2)
let targetConcepts: string[] | undefined
let batchSize = 8
let maxCardsPerConcept = 3

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--concepts' && args[i + 1]) {
    targetConcepts = args[i + 1].split(',')
    i++
  } else if (args[i] === '--batch-size' && args[i + 1]) {
    batchSize = parseInt(args[i + 1], 10)
    i++
  } else if (args[i] === '--max-cards' && args[i + 1]) {
    maxCardsPerConcept = parseInt(args[i + 1], 10)
    i++
  }
}

async function main() {
  console.log('=== 知识卡片批量生成 ===')
  console.log(`LLM: gemma-4-e2b-it-4bit @ localhost:8009`)
  console.log(`Embedding: bge-m3-mlx-8bit @ localhost:8009`)
  console.log(`知识库: ${path.join(PROJECT_ROOT, 'knowledge-base')}`)
  console.log(`批次大小: ${batchSize}`)
  console.log(`每概念最大卡片: ${maxCardsPerConcept}`)
  if (targetConcepts) {
    console.log(`目标概念: ${targetConcepts.join(', ')}`)
  }
  console.log('')

  const BASE_URL = process.env.OMXL_BASE_URL ?? 'http://localhost:8009/v1'
  const API_KEY = process.env.OMXL_API_KEY
  if (!API_KEY) {
    console.error('错误: 请设置环境变量 OMXL_API_KEY')
    process.exit(1)
  }

  // 创建适配器
  const llm = new OMLXAdapter({
    baseURL: BASE_URL,
    apiKey: API_KEY,
    modelName: process.env.OMXL_MODEL ?? 'gemma-4-e2b-it-4bit',
    timeout: 120000,
  })

  const embedder = new EmbeddingAdapter({
    baseURL: BASE_URL,
    apiKey: API_KEY,
    model: process.env.OMXL_EMBED_MODEL ?? 'bge-m3-mlx-8bit',
    batchSize,
    timeout: 60000,
  })

  // 验证服务可用
  console.log('验证服务连接...')
  try {
    const testResp = await llm.chat({
      messages: [{ role: 'user', content: '回复OK' }],
      maxTokens: 5,
    })
    console.log(`LLM: ✅ ${testResp.message.content}`)
  } catch (e) {
    console.error(`LLM: ❌ ${e}`)
    process.exit(1)
  }

  try {
    const [emb] = await embedder.embed(['测试'])
    console.log(`Embedding: ✅ dim=${emb.length}`)
  } catch (e) {
    console.error(`Embedding: ❌ ${e}`)
    process.exit(1)
  }
  console.log('')

  // 创建管线
  const pipeline = new CardPipeline({
    llm,
    embedder,
    knowledgeBasePath: path.join(PROJECT_ROOT, 'knowledge-base'),
  })

  // 尝试加载已有卡片
  const loaded = await pipeline.loadPersistedCards()
  if (loaded > 0) {
    console.log(`已加载 ${loaded} 张历史卡片`)
  }

  // 执行批量生成
  const startTime = Date.now()
  const result = await pipeline.run({
    concepts: targetConcepts ?? [], // 空数组 = 所有概念
    maxCardsPerConcept,
    qualityThreshold: 0.6,
    concurrency: 1, // 本地模型串行调用
    batchSize,
    onProgress: (progress) => {
      const phase =
        progress.phase === 'generating'
          ? '生成'
          : progress.phase === 'embedding'
            ? '向量化'
            : '存储'
      const concept = progress.concept ? ` [${progress.concept}]` : ''
      const pct = ((progress.current / progress.total) * 100).toFixed(0)
      process.stdout.write(`\r${phase}${concept}: ${progress.current}/${progress.total} (${pct}%)`)
    },
  })

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log('\n')
  console.log('=== 生成结果 ===')
  console.log(`总生成: ${result.totalGenerated} 张`)
  console.log(`已存储: ${result.totalStored} 张`)
  console.log(`平均质量: ${result.avgQuality.toFixed(3)}`)
  console.log(`耗时: ${elapsed}s`)
  console.log(`按领域分布:`)
  for (const [domain, count] of Object.entries(result.byDomain)) {
    console.log(`  ${domain}: ${count} 张`)
  }
  if (result.errors.length > 0) {
    console.log(`错误 (${result.errors.length}):`)
    for (const err of result.errors.slice(0, 5)) {
      console.log(`  - ${err}`)
    }
  }

  // 测试检索
  console.log('\n=== 检索测试 ===')
  const retriever = pipeline.getRetriever()
  const testQueries = ['创造性判断', '新颖性', '权利要求', '专利侵权']
  for (const q of testQueries) {
    const results = await retriever.search(q, { limit: 2 })
    if (results.length > 0) {
      console.log(
        `"${q}" → ${results.map((r) => `${r.card.question}(score=${r.score.toFixed(2)})`).join(', ')}`
      )
    } else {
      console.log(`"${q}" → 无结果`)
    }
  }

  console.log('\n完成！')
}

main().catch((e) => {
  console.error('执行失败:', e)
  process.exit(1)
})
