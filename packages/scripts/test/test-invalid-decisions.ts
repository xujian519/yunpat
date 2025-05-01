/**
 * 测试无效决定查询功能
 */

import { PostgreSQLClient } from '../packages/unified-knowledge-graph/src/PostgreSQLClient.js'

async function test() {
  console.log('========================================')
  console.log('测试无效决定查询功能')
  console.log('========================================\n')

  const postgres = new PostgreSQLClient()
  await postgres.initialize()

  // 1. 测试无效决定查询
  console.log('[1] 测试 queryInvalidDecisions()')
  const decisions = await postgres.queryInvalidDecisions('专利权', 3)
  console.log(`找到 ${decisions.length} 条无效决定`)
  decisions.forEach((d, i) => {
    console.log(`  ${i + 1}. ${d.title}`)
    console.log(`     内容预览: ${d.content.substring(0, 100)}...`)
  })

  // 2. 测试结构化查询（包含无效决定）
  console.log('\n[2] 测试 structuredSearch()')
  const results = await postgres.structuredSearch('无效', 5)
  console.log(`找到 ${results.length} 条结果`)
  results.forEach((r, i) => {
    console.log(`  ${i + 1}. [${r.category}] ${r.title}`)
  })

  // 3. 获取统计信息
  console.log('\n[3] 数据库统计')
  const stats = await postgres.getStats()
  console.log(`  总记录数: ${stats.totalRecords}`)
  console.log(`  向量记录数: ${stats.vectorRecords}`)
  console.log(`  实体记录数: ${stats.entityRecords}`)

  console.log('\n✅ 测试完成！')

  await postgres.close()
}

test()
