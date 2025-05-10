/**
 * V6: 基于正确技术问题的权利要求1
 *
 * 核心修正：
 * - 三步法第2步重新确定"实际解决的技术问题"
 * - 十字形通孔 = 核心必要技术特征（独立权利要求）
 * - 定位柱 = 附加技术特征（从属权利要求）
 *
 * 用法：node 测试/scripts/v6-claim1.mjs
 */

import { resolve, join } from 'path'
import { writeFileSync, readFileSync } from 'fs'

const OUTPUT_DIR = resolve(import.meta.dirname, '../yunpat/绞车带轴')
const DS_BASE_URL = 'https://api.deepseek.com'
const DS_API_KEY = 'sk-1b9f6c6ba33f4130a3fb76ea29c2ef95'
const MODEL = 'deepseek-v4-flash'

async function callLLM({ messages, temperature = 0.3, maxTokens = 4096 }) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 120000)
  try {
    const res = await fetch(`${DS_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DS_API_KEY}` },
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
  console.log('  V6: 基于三步法确定技术问题的权利要求1')
  console.log(`  模型: ${MODEL}`)
  console.log('═'.repeat(55))

  const disclosure = readFileSync(join(OUTPUT_DIR, '交底材料.txt'), 'utf-8')
  const invention = JSON.parse(readFileSync(join(OUTPUT_DIR, 'invention-analysis-v5.json'), 'utf-8'))
  const report = JSON.parse(readFileSync(join(OUTPUT_DIR, 'comparison-report-v5.json'), 'utf-8'))

  const systemPrompt = `你是一位资深的专利代理师，拥有15年的专利撰写经验。

## 核心法律依据（来自审查指南知识图谱）

### 实施细则第23条第2款
独立权利要求应当从整体上反映发明或者实用新型的技术方案，记载解决技术问题的必要技术特征。

### 三步法第2步（审查指南 3.2.1.1）
首先应当分析要求保护的发明与最接近的现有技术相比有哪些区别特征，然后根据该区别特征在要求保护的发明中所能达到的技术效果确定发明实际解决的技术问题。发明实际解决的技术问题，是指为获得更好的技术效果而需对最接近的现有技术进行改进的技术任务。

### 实施细则第24条第1款（两部分撰写法）
（1）前序部分：写明主题名称和与最接近现有技术共有的必要技术特征；
（2）特征部分：使用"其特征在于"，写明区别于现有技术的技术特征。

### 实施细则第22条第1款
权利要求书应当记载发明或者实用新型的技术特征。

## 关键方法论

**必要技术特征的判断标准**：只有解决技术问题不可缺少的特征才是必要技术特征。缺少任何一个必要特征，技术方案就不完整，无法解决技术问题。非必要的特征应放入从属权利要求。

**技术问题的确定**：不能直接使用交底书中原始的技术问题。必须通过三步法第2步，基于与最接近现有技术的区别特征及其技术效果，重新确定"实际解决的技术问题"。

**保护范围最大化原则**：独立权利要求只记载最少量的必要技术特征，使保护范围最大化。能用从属权利要求限定的特征，不应写入独立权利要求。

## 撰写要求

1. 清楚性：用词清楚，不得有附图标记
2. 简要性：不描述原因理由
3. 支持性：以说明书为依据
4. 必要技术特征原则：只写入不可缺少的特征

输出必须是严格的 JSON 格式。`

  const userPrompt = `## 发明信息

**发明名称**：一种绞车带轴
**技术领域**：机械工程—绞车技术领域

## 技术交底书（原文）

${disclosure}

## 对比分析结果

**最接近现有技术**：CN200620040894 — 车用离合转动式轴绞车捆绑器（相似度30%）

**最接近现有技术的方案**：该对比文件公开了一种绞车捆绑器，其转带轴通过棘爪座和轴套的离合机构实现连续紧带操作。该对比文件的转带轴已能处理织带式捆绑带（通过缠绕在轴体上）。

**区别特征及其技术效果分析**（三步法第2步）：

| 区别特征 | 在本发明中的技术效果 | 解决什么子问题 |
|---------|-------------------|-------------|
| 本体上设有沿径向贯穿且沿轴向呈条形的通孔一 | 织带可穿过通孔一绕在本体上 | 织带式捆绑带的连接（与现有技术共有） |
| 本体上设有沿径向贯穿且沿径向呈条形的通孔二 | 与通孔一配合，锁链的相邻锁扣可分别嵌入两个通孔 | 锁链式捆绑带的稳定连接 |
| 通孔一与通孔二相交呈十字形 | 两个通孔的十字形交叉为锁链提供稳定的双点约束 | 锁链连接的稳定性 |
| 本体上设有凸出的定位柱 | 绳索/钢丝绳可系结在定位柱上 | 绳索式捆绑带的固定 |

**关键分析**：
- 现有技术（CN200620040894）已经能处理织带式捆绑带
- 十字形通孔结构是本发明的核心创新：它通过一个几何结构同时实现了织带穿绕和锁链双点固定
- 定位柱是用于绳索式捆绑带的**附加特征**，不是解决核心技术问题不可缺少的特征

## 撰写任务

请严格按照以下步骤：

**步骤1**：用三步法第2步确定"实际解决的技术问题"
- 分析区别特征
- 确定区别特征能达到的技术效果
- 定义实际解决的技术问题

**步骤2**：确定必要技术特征
- 只有解决"实际解决的技术问题"不可缺少的特征才是必要技术特征
- 定位柱是否为必要技术特征？仔细分析

**步骤3**：撰写独立权利要求1（两部分撰写法）
- 前序部分：主题名称 + 与现有技术共有的必要技术特征
- 特征部分：区别于现有技术的必要技术特征

**步骤4**：撰写从属权利要求

请输出 JSON：
{
  "three_step_analysis": {
    "step2_actual_problem": "通过三步法第2步确定的实际解决的技术问题",
    "problem_reasoning": "推导过程",
    "essential_features": [
      {"feature": "特征", "is_essential": true/false, "reason": "为什么是/不是必要技术特征", "claim_location": "independent/dependent"}
    ]
  },
  "independent_claims": [
    {
      "claim_number": 1,
      "claim_type": "device",
      "preamble": "前序部分",
      "transition": "其特征在于",
      "body": "特征部分",
      "full_text": "完整文本",
      "essential_features": ["必要特征列表"]
    }
  ],
  "dependent_claims": [
    {
      "claim_number": 2,
      "parent_claim": 1,
      "content": "从属权利要求文本",
      "additional_features": ["附加特征"],
      "limitation_type": "further_limitation"
    }
  ],
  "protection_scope_analysis": "保护范围分析"
}`

  console.log(`\n🚀 调用 ${MODEL}...`)
  const startTime = Date.now()
  const content = await callLLM({ messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]})
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`✅ 完成 (${elapsed}s)`)

  const parsed = parseJSON(content)
  const result = {
    ...(parsed || { rawContent: content }),
    _meta: {
      version: 'v6-three-step-method',
      generatedAt: new Date().toISOString(),
      model: { provider: 'DeepSeek', model: MODEL, elapsed: elapsed + 's' },
      method: '三步法第2步确定实际技术问题 → 必要技术特征判断 → 两部分撰写',
    },
  }

  writeFileSync(join(OUTPUT_DIR, 'claims-v6.json'), JSON.stringify(result, null, 2))

  if (parsed) {
    const tsa = parsed.three_step_analysis || {}
    console.log('\n📋 三步法分析:')
    console.log(`   实际解决的技术问题: ${tsa.step2_actual_problem}`)
    console.log(`   推导: ${tsa.problem_reasoning}`)
    const ef = tsa.essential_features || []
    console.log(`\n   必要技术特征判断:`)
    ef.forEach(f => console.log(`     ${f.is_essential ? '✓必要' : '✗非必要'} → ${f.claim_location === 'independent' ? '独立' : '从属'}: ${f.feature}（${f.reason}）`))

    const ic = parsed.independent_claims || []
    console.log(`\n📝 独立权利要求: ${ic.length} 项`)
    for (const c of ic) {
      console.log(`\n   === 权利要求 ${c.claim_number} ===`)
      console.log(`   前序: ${c.preamble}`)
      console.log(`   特征: ${c.body}`)
      console.log(`   全文: ${c.full_text}`)
      console.log(`   必要特征: ${(c.essential_features || []).join(', ')}`)
    }

    const dc = parsed.dependent_claims || []
    console.log(`\n   从属权利要求: ${dc.length} 项`)
    for (const c of dc) {
      console.log(`     权${c.claim_number}→权${c.parent_claim}: ${(c.content || '').substring(0, 80)}...`)
    }

    console.log(`\n   保护范围: ${parsed.protection_scope_analysis || '?'}`)
  } else {
    console.log('\n⚠️ JSON 解析失败')
    console.log(content.substring(0, 500))
  }

  console.log(`\n💾 ${join(OUTPUT_DIR, 'claims-v6.json')}`)
}

main().catch(err => { console.error('❌', err); process.exit(1) })
