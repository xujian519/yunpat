#!/usr/bin/env node

/**
 * 性能分析脚本
 *
 * 运行基础性能基准并输出结果，供 CI 性能回归检测使用
 */

const { performance } = require('perf_hooks')

const results = []

function benchmark(name, fn, iterations = 1000) {
  // 预热
  for (let i = 0; i < Math.min(iterations, 10); i++) {
    fn()
  }

  const start = performance.now()
  for (let i = 0; i < iterations; i++) {
    fn()
  }
  const duration = performance.now() - start

  const result = {
    name,
    iterations,
    totalMs: Math.round(duration * 100) / 100,
    avgMs: Math.round((duration / iterations) * 10000) / 10000,
  }
  results.push(result)
  return result
}

console.log('=== 性能分析报告 ===')
console.log(`时间: ${new Date().toISOString()}\n`)

// 基础数据结构操作
benchmark('数组 filter+map (1000元素)', () => {
  const arr = Array.from({ length: 1000 }, (_, i) => i)
  arr.filter((x) => x % 2 === 0).map((x) => x * 2)
})

benchmark('对象 keys+values (500属性)', () => {
  const obj = Object.fromEntries(Array.from({ length: 500 }, (_, i) => [`k${i}`, i]))
  Object.keys(obj)
  Object.values(obj)
})

benchmark('Map 操作 (500条目)', () => {
  const map = new Map(Array.from({ length: 500 }, (_, i) => [`k${i}`, i]))
  map.forEach((v, k) => {
    map.get(k)
  })
})

benchmark('JSON 序列化/反序列化 (100条目)', () => {
  const data = Array.from({ length: 100 }, (_, i) => ({ id: i, name: `item${i}` }))
  JSON.parse(JSON.stringify(data))
})

benchmark('字符串操作 (1000字符)', () => {
  const str = 'a'.repeat(1000)
  str.split('').reverse().join('')
})

// 输出结果
console.log('基准测试结果:')
console.log('-'.repeat(60))
console.log('测试名称                          迭代次数  总时间(ms)  平均(ms)')
console.log('-'.repeat(60))
for (const r of results) {
  console.log(
    `${r.name.padEnd(35)} ${String(r.iterations).padStart(6)} ${String(r.totalMs).padStart(10)} ${String(r.avgMs).padStart(10)}`
  )
}
console.log('-'.repeat(60))

const totalMs = results.reduce((sum, r) => sum + r.totalMs, 0)
console.log(`\n总耗时: ${Math.round(totalMs * 100) / 100}ms`)
console.log('\n✅ 性能分析完成')
