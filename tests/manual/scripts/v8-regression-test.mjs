/**
 * V8: 回归测试 — 验证绞车带轴案例修复效果
 *
 * 测试对象：ClaimGeneratorAgent 两步法改造后的输出
 * 输入：交底材料 + 对比分析结论（复用 V7 的 prompt）
 * 模型：gemma-4-e2b-it-4bit（oMLX 本地）
 *
 * 验证项：
 * 1. 技术问题定义不包含"兼容三种捆绑带"等过宽表述
 * 2. 独立权利要求不含定位柱
 * 3. 必要技术特征分析表格输出
 * 4. 两部分撰写法格式
 * 5. 无附图标记
 * 6. markdown 格式输出
 * 7. 从属权利要求引用正确
 *
 * 用法：node 测试/scripts/v8-regression-test.mjs
 */

import { resolve, join } from 'path'
import { writeFileSync, readFileSync } from 'fs'

const OUTPUT_DIR = resolve(import.meta.dirname, '../yunpat/绞车带轴')
const OMLX_BASE_URL = 'http://localhost:8009/v1'
const OMLX_API_KEY = 'xj781102@'
const MODEL = 'gemma-4-e2b-it-4bit'

async function callLLM({ messages, temperature = 0.3, maxTokens = 4096 }) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 180000)
  try {
    const res = await fetch(`${OMLX_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OMLX_API_KEY}` },
      body: JSON.stringify({ model: MODEL, messages, temperature, max_tokens: maxTokens, stream: false }),
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`)
    const data = await res.json()
    return data.choices?.[0]?.message?.content || ''
  } finally {
    clearTimeout(timeout)
  }
}

// ========== 验证器 ==========

const checks = [
  {
    name: '技术问题定义不过宽',
    test: (content) => {
      const problemMatch = content.match(/实际解决的技术问题[\s\S]*?\n([\s\S]*?)(?=\n##|\n\|)/)
      const problem = problemMatch ? problemMatch[1] : ''
      const tooBroad = ['兼容三种捆绑带', '兼容多种捆绑带', '各种捆绑带', '多种类型']
      const found = tooBroad.find((phrase) => problem.includes(phrase))
      return found
        ? { pass: false, detail: `技术问题过宽：包含"${found}"` }
        : { pass: true, detail: '技术问题定义合理' }
    },
  },
  {
    name: '独立权利要求不含定位柱',
    test: (content) => {
      // 提取权利要求1（独立权利要求）
      const claim1Match = content.match(/^1\.\s+一种.+?$/m)
      if (!claim1Match) return { pass: false, detail: '未找到独立权利要求1' }
      const claim1 = claim1Match[0]
      const hasDingweizhu =
        claim1.includes('定位柱') || claim1.includes('定位销') || claim1.includes('定位杆')
      return hasDingweizhu
        ? { pass: false, detail: `独立权利要求包含定位柱: "${claim1.substring(0, 80)}..."` }
        : { pass: true, detail: '独立权利要求不含定位柱' }
    },
  },
  {
    name: '必要技术特征分析表格',
    test: (content) => {
      const hasTable = /\|.*特征.*\|.*必要.*\|/.test(content)
      const hasEssentialLabel = content.includes('必要') && content.includes('非必要')
      return hasTable || hasEssentialLabel
        ? { pass: true, detail: '包含必要技术特征分析' }
        : { pass: false, detail: '缺少必要技术特征分析表格' }
    },
  },
  {
    name: '两部分撰写法格式',
    test: (content) => {
      const hasTransition = /其特征在于/.test(content)
      const hasClaim1 = /^1\.\s+一种/m.test(content)
      if (!hasClaim1) return { pass: false, detail: '未找到权利要求1' }
      return hasTransition
        ? { pass: true, detail: '使用两部分撰写法' }
        : { pass: false, detail: '缺少"其特征在于"过渡语' }
    },
  },
  {
    name: '无附图标记',
    test: (content) => {
      // 提取权利要求书部分
      const claimsMatch = content.match(/##\s*权利要求书?\s*\n([\s\S]*?)(?=\n##\s|$)/)
      const claimsText = claimsMatch ? claimsMatch[1] : content
      // 检查是否有括号附图标记如 (1)、（2）
      const hasDrawingRef = /[（(]\d+[）)]/.test(claimsText)
      return hasDrawingRef
        ? { pass: false, detail: '权利要求包含附图标记' }
        : { pass: true, detail: '无附图标记' }
    },
  },
  {
    name: 'markdown 格式输出',
    test: (content) => {
      const hasMarkdownHeaders = /^##\s+/m.test(content)
      const hasNumberedClaims = /^\d+\.\s+/m.test(content)
      return hasMarkdownHeaders && hasNumberedClaims
        ? { pass: true, detail: 'markdown 格式正确' }
        : { pass: false, detail: '非标准 markdown 格式' }
    },
  },
  {
    name: '从属权利要求引用正确',
    test: (content) => {
      // 提取从属权利要求
      const dependentMatches = [
        ...content.matchAll(/(\d+)\.\s*根据权利要求\s*(\d+)\s*所述/g),
      ]
      if (dependentMatches.length === 0) return { pass: false, detail: '未找到从属权利要求' }

      let issues = []
      for (const m of dependentMatches) {
        const claimNum = parseInt(m[1])
        const parentNum = parseInt(m[2])
        // 基本检查：引用的权利要求必须存在且编号小于当前
        if (parentNum >= claimNum) {
          issues.push(`权${claimNum}引用了权${parentNum}（引用编号不小于自身）`)
        }
      }

      return issues.length > 0
        ? { pass: false, detail: issues.join('；') }
        : { pass: true, detail: `检查了 ${dependentMatches.length} 条从属权利要求，引用正确` }
    },
  },
]

// ========== 主流程 ==========

async function main() {
  console.log('═'.repeat(55))
  console.log('  V8: 回归测试 — 验证绞车带轴案例修复效果')
  console.log(`  模型: ${MODEL}`)
  console.log('═'.repeat(55))

  const disclosure = readFileSync(join(OUTPUT_DIR, '交底材料.txt'), 'utf-8')

  // 复用 V7 的两步法 prompt（模拟 ClaimGeneratorAgent 的新流程）
  const systemPrompt = `你是一位资深专利代理师。

## 法律依据

1. 实施细则第23条第2款：独立权利要求应当记载解决技术问题的必要技术特征。
2. 三步法第2步：根据区别特征的技术效果确定实际解决的技术问题。
3. 实施细则第24条第1款：前序部分写共有特征，特征部分写区别特征。

## 关键判断规则

必要技术特征 = 解决技术问题不可缺少的特征。
缺少一个必要特征 → 技术方案不完整 → 无法解决技术问题。

非必要特征 → 放入从属权利要求，保护范围更大。

## 撰写格式要求

- 使用两部分撰写法：前序部分 + "其特征在于" + 特征部分
- 不得包含附图标记
- 每项权利要求结尾只有一个句号

输出 markdown 格式。`

  const userPrompt = `请为以下发明撰写权利要求。

## 技术交底书

${disclosure}

## 已完成的对比分析结论

最接近现有技术：CN200620040894（车用离合转动式轴绞车捆绑器）
该对比文件已有：绞车带轴 + 织带式捆绑带缠绕收紧功能

本发明与对比文件的区别特征及其作用：
1. 本体上设有沿径向贯穿且沿轴向呈条形的通孔一 → 织带穿绕
2. 本体上设有沿径向贯穿且沿径向呈条形的通孔二 → 与通孔一配合
3. 通孔一与通孔二相交呈十字形 → 锁链的相邻锁扣分别嵌入两个通孔实现双点固定
4. 本体上设有凸出的定位柱 → 绳索系结固定

## 核心分析要求

请严格按以下逻辑分析：

**步骤1：确定实际解决的技术问题**

注意：现有技术已经能处理织带式捆绑带。
十字形通孔的创新在于：一个几何结构同时实现了织带穿绕 + 锁链双点固定。
定位柱只是为绳索提供了一种固定方式，是可选的附加功能。

因此，实际解决的技术问题应该是：
"如何设计绞车带轴的连接结构，使其能够稳定连接锁链式捆绑带"
（织带穿绕是通孔的基本功能，十字形结构的关键突破是锁链固定）

**步骤2：判断必要技术特征**

| 特征 | 是否必要 | 理由 |
|------|---------|------|
| 杆状本体 | 必要（前序） | 与现有技术共有的基本结构 |
| 通孔一（轴向条形） | 必要（特征） | 织带穿绕+锁链嵌入通道 |
| 通孔二（径向条形） | 必要（特征） | 锁链嵌入第二通道 |
| 十字形相交 | 必要（特征） | 使两个通孔配合固定锁链 |
| 定位柱 | **非必要** | 仅用于绳索，缺少它仍能解决核心技术问题（锁链兼容），应放入从属权利要求 |

**步骤3：撰写独立权利要求1**

只包含：杆状本体 + 十字形通孔（通孔一+通孔二+十字形相交）
不含定位柱！定位柱放入从属权利要求。

**步骤4：撰写从属权利要求**
- 权2：通孔一沿轴向呈条形、通孔二沿径向呈条形
- 权3：通孔一与通孔二相互垂直
- 权4：本体上设有凸出的定位柱
- 权5：定位柱的连接方式（焊接或一体式）
- 权6：定位柱设于连接孔处

请直接输出 markdown 格式的权利要求书，格式如下：

## 实际解决的技术问题

（简述通过三步法第2步确定的技术问题）

## 必要技术特征分析

| 特征 | 是否必要 | 归属 | 理由 |
|------|---------|------|------|
| （逐一列出每个特征） | 必要/非必要 | 前序/特征/从属 | 判断理由 |

## 权利要求书

1. 一种绞车带轴，包括（前序部分），其特征在于，（特征部分，不含定位柱）。

2. 根据权利要求1所述的绞车带轴，其特征在于，（从属权利要求2）。

（以此类推）

## 保护范围说明

（简述独立权利要求的保护范围及从属权利要求的布局逻辑）`

  console.log(`\n调用 ${MODEL}...`)
  const startTime = Date.now()
  const content = await callLLM({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  })
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`✅ 生成完成 (${elapsed}s)`)

  // 保存输出
  const mdContent = content.trim()
  const output = [
    `<!--`,
    `  V8 回归测试`,
    `  模型: ${MODEL} (oMLX 本地)`,
    `  耗时: ${elapsed}s`,
    `  时间: ${new Date().toISOString()}`,
    `-->`,
    '',
    mdContent,
  ].join('\n')

  writeFileSync(join(OUTPUT_DIR, 'claims-v8.md'), output)
  console.log(`\n💾 ${join(OUTPUT_DIR, 'claims-v8.md')}`)

  // ========== 执行验证 ==========
  console.log('\n' + '═'.repeat(55))
  console.log('  回归测试结果')
  console.log('═'.repeat(55))

  let passed = 0
  let failed = 0

  for (const check of checks) {
    const result = check.test(mdContent)
    const icon = result.pass ? '✅' : '❌'
    console.log(`  ${icon} ${check.name}: ${result.detail}`)
    if (result.pass) passed++
    else failed++
  }

  console.log('\n' + '─'.repeat(55))
  console.log(`  通过: ${passed}/${checks.length}  失败: ${failed}/${checks.length}`)
  console.log('─'.repeat(55))

  if (failed > 0) {
    console.log('\n⚠️  有检查项未通过，请查看上方详情')
    process.exit(1)
  } else {
    console.log('\n🎉 全部检查项通过！')
  }

  // 显示完整输出
  console.log(`\n${'─'.repeat(55)}`)
  console.log(mdContent)
  console.log(`${'─'.repeat(55)}`)
}

main().catch((err) => {
  console.error('❌', err)
  process.exit(1)
})
