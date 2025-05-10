/**
 * V7: 本地模型撰写权利要求1 — 三步法 + 必要技术特征
 *
 * 模型：gemma-4-e2b-it-4bit（oMLX 本地）
 * 核心：正确定位技术问题 → 只保留十字形通孔为必要特征
 *
 * 用法：node 测试/scripts/v7-claim1-local.mjs
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
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OMLX_API_KEY}` },
      body: JSON.stringify({ model: MODEL, messages, temperature, max_tokens: maxTokens, stream: false }),
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`)
    const data = await res.json()
    return data.choices?.[0]?.message?.content || ''
  } finally { clearTimeout(timeout) }
}

function parseJSON(content) {
  try { const m = content.match(/\{[\s\S]*\}/); if (m) return JSON.parse(m[0]) } catch {}
  return null
}

async function main() {
  console.log('═'.repeat(55))
  console.log(`  V7: 本地模型撰写权利要求1`)
  console.log(`  模型: ${MODEL}`)
  console.log('═'.repeat(55))

  const disclosure = readFileSync(join(OUTPUT_DIR, '交底材料.txt'), 'utf-8')

  // 直接在 prompt 中明确结论，避免模型犯同样错误
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

输出严格的JSON格式。`

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

请直接输出 markdown 格式的权利要求书，格式如下（不要输出JSON）：

## 实际解决的技术问题

（简述通过三步法第2步确定的技术问题）

## 必要技术特征分析

| 特征 | 是否必要 | 归属 | 理由 |
|------|---------|------|------|
| （逐一列出每个特征） | 必要/非必要 | 前序/特征/从属 | 判断理由 |

## 权利要求书

1. 一种绞车带轴，包括（前序部分：与现有技术共有的必要技术特征），其特征在于，（特征部分：区别于现有技术的必要技术特征，不含定位柱）。

2. 根据权利要求1所述的绞车带轴，其特征在于，（从属权利要求2的附加技术特征）。

3. 根据权利要求1所述的绞车带轴，其特征在于，（从属权利要求3的附加技术特征）。

（以此类推）

## 保护范围说明

（简述独立权利要求的保护范围及从属权利要求的布局逻辑）`

  console.log(`\n调用 ${MODEL}...`)
  const startTime = Date.now()
  const content = await callLLM({ messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]})
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`✅ 完成 (${elapsed}s)`)

  // 保存 markdown 格式输出
  const mdContent = content.trim()
  const output = [
    `<!--`,
    `  生成信息：`,
    `  版本: v7-local-gemma4-markdown`,
    `  模型: ${MODEL} (oMLX 本地)`,
    `  耗时: ${elapsed}s`,
    `  时间: ${new Date().toISOString()}`,
    `-->`,
    '',
    mdContent,
  ].join('\n')

  writeFileSync(join(OUTPUT_DIR, 'claims-v7.md'), output)

  // 同时保存一份 JSON 备份（含原始 markdown）
  writeFileSync(join(OUTPUT_DIR, 'claims-v7.json'), JSON.stringify({
    markdown: mdContent,
    _meta: {
      version: 'v7-local-gemma4-markdown',
      generatedAt: new Date().toISOString(),
      model: { provider: 'oMLX-local', model: MODEL, elapsed: elapsed + 's' },
    },
  }, null, 2))

  console.log(`\n${'─'.repeat(55)}`)
  console.log(mdContent)
  console.log(`${'─'.repeat(55)}`)
  console.log(`\n💾 ${join(OUTPUT_DIR, 'claims-v7.md')}`)
}

main().catch(err => { console.error('❌', err); process.exit(1) })
