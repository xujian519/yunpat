/**
 * 意图识别基准测试脚本
 *
 * 用法:
 *   cd packages/tests/benchmark/intent
 *   npx tsx run_benchmark.ts [--gateway-url http://localhost:9090]
 *
 * 功能:
 *   1. 加载黄金测试集 (golden-seed-v1.json)
 *   2. 对 Gateway 的 /api/v1/sessions/{id}/message 发送测试消息
 *   3. 收集路由结果，计算准确率、召回率、F1
 *   4. 输出混淆矩阵和延迟统计
 */

import * as fs from 'fs'
import * as path from 'path'

interface TestCase {
  id: string
  text: string
  expected_intent: string
  confidence: string
  tags: string[]
  source: string
  note?: string
  session_context?: {
    previous_intent: string
    previous_text: string
  } | null
}

interface BenchmarkResult {
  total: number
  correct: number
  accuracy: number
  byIntent: Record<
    string,
    { tp: number; fp: number; fn: number; precision: number; recall: number; f1: number }
  >
  latency: {
    p50: number
    p95: number
    p99: number
    avg: number
  }
  confusionMatrix: Record<string, Record<string, number>>
  failedCases: Array<{
    id: string
    text: string
    expected: string
    actual: string
    latencyMs: number
    note?: string
  }>
}

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:9090'

async function sendMessage(
  sessionId: string,
  message: string
): Promise<{ intent?: string; latencyMs: number; error?: string }> {
  const start = Date.now()
  try {
    const res = await fetch(`${GATEWAY_URL}/api/v1/sessions/${sessionId}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    })
    const latencyMs = Date.now() - start

    if (!res.ok) {
      return { latencyMs, error: `HTTP ${res.status}` }
    }

    // Gateway 不直接返回 intent，但我们可以通过 session 状态或日志推断
    // 在完整实现中，Gateway 应返回 routing_decision
    const data = (await res.json()) as { routed_intent?: string; intent?: string; [key: string]: unknown }
    return { intent: data.routed_intent || data.intent, latencyMs }
  } catch (e: any) {
    return { latencyMs: Date.now() - start, error: e.message }
  }
}

function loadTestCases(): TestCase[] {
  const filePath = path.join(__dirname, 'golden-seed-v1.json')
  const raw = fs.readFileSync(filePath, 'utf-8')
  const data = JSON.parse(raw)
  return data.tests as TestCase[]
}

function calculateMetrics(
  results: Array<{ test: TestCase; actual?: string; latencyMs: number; error?: string }>
): BenchmarkResult {
  const intents = new Set<string>()
  results.forEach((r) => {
    intents.add(r.test.expected_intent)
    if (r.actual) intents.add(r.actual)
  })

  const intentList = Array.from(intents)
  const byIntent: Record<string, { tp: number; fp: number; fn: number }> = {}
  const confusionMatrix: Record<string, Record<string, number>> = {}
  const failedCases: BenchmarkResult['failedCases'] = []
  const latencies: number[] = []

  // 初始化
  intentList.forEach((intent) => {
    byIntent[intent] = { tp: 0, fp: 0, fn: 0 }
    confusionMatrix[intent] = {}
    intentList.forEach((j) => (confusionMatrix[intent][j] = 0))
  })

  let correct = 0

  for (const r of results) {
    const expected = r.test.expected_intent
    const actual = r.actual || 'ERROR'

    latencies.push(r.latencyMs)
    confusionMatrix[expected][actual] = (confusionMatrix[expected][actual] || 0) + 1

    if (actual === expected) {
      correct++
      byIntent[expected].tp++
    } else {
      byIntent[expected].fn++
      if (actual !== 'ERROR') {
        byIntent[actual].fp++
      }
      failedCases.push({
        id: r.test.id,
        text: r.test.text,
        expected: expected,
        actual: actual,
        latencyMs: r.latencyMs,
        note: r.test.note,
      })
    }
  }

  // 计算每个意图的精确率、召回率、F1
  const byIntentWithMetrics: BenchmarkResult['byIntent'] = {}
  for (const [intent, counts] of Object.entries(byIntent)) {
    const precision = counts.tp + counts.fp > 0 ? counts.tp / (counts.tp + counts.fp) : 0
    const recall = counts.tp + counts.fn > 0 ? counts.tp / (counts.tp + counts.fn) : 0
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0
    byIntentWithMetrics[intent] = { ...counts, precision, recall, f1 }
  }

  // 延迟统计
  latencies.sort((a, b) => a - b)
  const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0
  const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0
  const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length

  return {
    total: results.length,
    correct,
    accuracy: results.length > 0 ? correct / results.length : 0,
    byIntent: byIntentWithMetrics,
    latency: { p50, p95, p99, avg },
    confusionMatrix,
    failedCases,
  }
}

function printReport(result: BenchmarkResult) {
  console.log('\n========================================')
  console.log('  YunPat 意图识别基准测试报告')
  console.log('========================================\n')

  console.log(`总样本数: ${result.total}`)
  console.log(`正确数: ${result.correct}`)
  console.log(`整体准确率: ${(result.accuracy * 100).toFixed(2)}%\n`)

  console.log('--- 各意图指标 ---')
  console.table(
    Object.entries(result.byIntent).map(([intent, m]) => ({
      意图: intent,
      精确率: (m.precision * 100).toFixed(1) + '%',
      召回率: (m.recall * 100).toFixed(1) + '%',
      F1: m.f1.toFixed(3),
      TP: m.tp,
      FP: m.fp,
      FN: m.fn,
    }))
  )

  console.log('\n--- 延迟统计 (ms) ---')
  console.log(`  P50: ${result.latency.p50.toFixed(2)}`)
  console.log(`  P95: ${result.latency.p95.toFixed(2)}`)
  console.log(`  P99: ${result.latency.p99.toFixed(2)}`)
  console.log(`  AVG: ${result.latency.avg.toFixed(2)}`)

  if (result.failedCases.length > 0) {
    console.log(`\n--- 错误案例 (前10条) ---`)
    result.failedCases.slice(0, 10).forEach((c) => {
      console.log(`  [${c.id}] 期望: ${c.expected}, 实际: ${c.actual}, 延迟: ${c.latencyMs}ms`)
      console.log(`    文本: "${c.text}"`)
      if (c.note) console.log(`    备注: ${c.note}`)
    })
  }

  console.log('\n========================================\n')
}

async function main() {
  const testCases = loadTestCases()
  console.log(`加载测试集: ${testCases.length} 条`)

  // 创建临时 session
  const sessionRes = await fetch(`${GATEWAY_URL}/api/v1/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })

  if (!sessionRes.ok) {
    console.error(`无法创建测试 session: HTTP ${sessionRes.status}`)
    console.log('提示: 请确保 Gateway 服务已启动 (cargo run -p yunpat-gateway)')
    console.log('      或通过 GATEWAY_URL 环境变量指定地址')
    process.exit(1)
  }

  const session = (await sessionRes.json()) as { id?: string; [key: string]: unknown }
  const sessionId = session.id || 'test-session'
  console.log(`测试 session ID: ${sessionId}\n`)

  const results: Array<{ test: TestCase; actual?: string; latencyMs: number; error?: string }> = []

  for (const test of testCases) {
    process.stdout.write(`  [${test.id}] ${test.text.slice(0, 40)}... `)
    const { intent, latencyMs, error } = await sendMessage(sessionId, test.text)

    if (error) {
      console.log(`ERROR: ${error}`)
    } else {
      const status = intent === test.expected_intent ? '✓' : `✗ (${intent})`
      console.log(`${status} ${latencyMs}ms`)
    }

    results.push({ test, actual: intent, latencyMs, error })
  }

  const report = calculateMetrics(results)
  printReport(report)

  // 保存结果
  const resultPath = path.join(__dirname, `benchmark-result-${Date.now()}.json`)
  fs.writeFileSync(resultPath, JSON.stringify(report, null, 2))
  console.log(`详细结果已保存: ${resultPath}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
