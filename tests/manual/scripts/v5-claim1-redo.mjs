/**
 * V5-重写: 权利要求1 — 注入必要技术特征规则
 *
 * 知识来源：向量检索获取的专利法实施细则第23条第2款 + 审查指南
 * 模型：deepseek-v4-flash
 *
 * 用法：node 测试/scripts/v5-claim1-redo.mjs
 */

import { resolve, join, dirname } from 'path'
import { writeFileSync, readFileSync } from 'fs'

// ─── 配置 ──────────────────────────────────────────

const OUTPUT_DIR = resolve(import.meta.dirname, '../yunpat/绞车带轴')
const DS_BASE_URL = 'https://api.deepseek.com'
const DS_API_KEY = 'sk-1b9f6c6ba33f4130a3fb76ea29c2ef95'
const MODEL = 'deepseek-v4-flash'

// ─── LLM ───────────────────────────────────────────

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
  try {
    const m = content.match(/\{[\s\S]*\}/)
    if (m) return JSON.parse(m[0])
  } catch {}
  return null
}

// ─── 主函数 ────────────────────────────────────────

async function main() {
  console.log('═'.repeat(55))
  console.log('  重写权利要求1 — 注入必要技术特征规则')
  console.log(`  模型: ${MODEL}`)
  console.log('═'.repeat(55))

  // 读取输入
  const disclosure = readFileSync(join(OUTPUT_DIR, '交底材料.txt'), 'utf-8')
  const invention = JSON.parse(readFileSync(join(OUTPUT_DIR, 'invention-analysis-v5.json'), 'utf-8'))
  const report = JSON.parse(readFileSync(join(OUTPUT_DIR, 'comparison-report-v5.json'), 'utf-8'))

  const concepts = invention.inventionConcepts || []
  const firstConcept = concepts[0] || {}

  // ─── 向量检索到的知识规则 ────────────────────────

  const knowledgeRules = `
## 参考知识（向量检索自专利知识图谱）

### 【规则1】实施细则第23条第2款 [距离:0.3635]
独立权利要求应当从整体上反映发明或者实用新型的技术方案，记载解决技术问题的必要技术特征。

### 【规则2】实施细则第22条第1款 [距离:0.3979]
权利要求书应当记载发明或者实用新型的技术特征。

### 【规则3】审查指南 — 独立权利要求的撰写规定 [距离:0.4076]
根据专利法实施细则第二十四条第一款的规定，独立权利要求应当包括前序部分和特征部分：
（1）前序部分：写明要求保护的发明或者实用新型技术方案的主题名称和发明或者实用新型主题与最接近的现有技术共有的必要技术特征；
（2）特征部分：使用"其特征是……"或者类似的用语，写明发明或者实用新型区别于最接近的现有技术的技术特征，这些特征和前序部分写明的特征合在一起，限定发明或者实用新型要求保护的范围。

独立权利要求的前序部分中，发明或者实用新型主题与最接近的现有技术共有的必要技术特征，是指要求保护的发明或者实用新型技术方案与最接近的一份现有技术文件中所共有的技术特征。在合适的情况下，选用一份与发明或者实用新型要求保护的主题最接近的现有技术文件进行"划界"。

独立权利要求的前序部分中，除写明要求保护的发明或者实用新型技术方案的主题名称外，仅需写明该发明或者实用新型与最接近的现有技术共有的必要技术特征。

### 【规则4】审查指南 — 权利要求的撰写规定 [距离:0.4351]
权利要求的保护范围是由权利要求中记载的全部内容作为一个整体限定的，因此每一项权利要求只允许在其结尾处使用句号。
权利要求中使用的科技术语应当与说明书中使用的科技术语一致。权利要求中可以有化学式或者数学式，但是不得有插图。
权利要求中的技术特征可以引用说明书附图中相应的标记，以帮助理解权利要求所记载的技术方案。但是，这些标记应当用括号括起来，放在相应的技术特征后面。附图标记不得解释为对权利要求保护范围的限制。
`.trim()

  // ─── System Prompt ──────────────────────────────

  const systemPrompt = `你是一位资深的专利代理师，拥有15年的专利撰写经验。

${knowledgeRules}

## 核心撰写原则（基于上述规则）

1. **必要技术特征原则（实施细则第23条第2款）**：独立权利要求必须记载解决技术问题的全部必要技术特征。缺少任何一个必要技术特征，技术方案就不完整，无法解决技术问题。

2. **两部分撰写法（实施细则第24条第1款）**：
   - 前序部分：主题名称 + 与最接近现有技术共有的必要技术特征
   - 特征部分："其特征在于" + 区别于现有技术的技术特征

3. **清楚性原则**：用词清楚，不得有附图标记（附图标记仅在括号中用于理解，但不得限定保护范围），不得描述原因理由

4. **简要性原则**：简明扼要，不写入非必要技术特征

## 关键分析步骤

在撰写独立权利要求1之前，你必须：
1. 确定发明要解决的技术问题：${firstConcept.technicalProblem || ''}
2. 列出解决该技术问题的全部必要技术特征
3. 区分哪些是与最接近现有技术共有的特征（→前序部分），哪些是区别特征（→特征部分）

输出必须是严格的 JSON 格式。`

  // ─── User Prompt ────────────────────────────────

  const distinctFeatures = (report.distinct_features || []).map(f => f.feature)
  const suggestedClaim = (report.protection_scope?.independent_claims || [])[0] || ''
  const allKeyFeatures = concepts.flatMap(c => c.keyFeatures || [])

  const userPrompt = `## 发明信息

**发明名称**：一种绞车带轴
**技术领域**：${invention.technicalField || '机械工程—绞车技术领域'}
**技术问题**：${firstConcept.technicalProblem || ''}
**技术方案**：${firstConcept.keyFeatures?.join('；') || ''}
**技术效果**：${firstConcept.technicalEffects?.join('；') || ''}

## 对比分析结果

**最接近现有技术**：${report.closest_prior_art?.publication_number} — ${report.closest_prior_art?.title}
**相似度**：${((report.closest_prior_art?.similarity || 0) * 100).toFixed(0)}%

**区别特征**：
${distinctFeatures.map((f, i) => `${i + 1}. ${f}`).join('\n')}

**对比报告建议的独立权利要求**：
${suggestedClaim}

## 全部关键特征
${allKeyFeatures.map((f, i) => `${i + 1}. ${f}`).join('\n')}

## 技术交底书

${disclosure}

---

请严格按照以下步骤撰写独立权利要求1：

**步骤1**：确定发明要解决的技术问题
**步骤2**：列出解决该技术问题的全部必要技术特征（逐一分析每个特征是否为解决技术问题不可缺少的）
**步骤3**：区分前序部分特征（与现有技术共有的）和特征部分特征（区别于现有技术的）
**步骤4**：撰写完整的独立权利要求1

请输出以下 JSON：
{
  "analysis": {
    "technical_problem": "发明要解决的技术问题",
    "essential_features": [
      {"feature": "特征描述", "reason": "为什么是必要技术特征", "location": "preamble|body"}
    ],
    "prior_art_common": ["与现有技术共有的特征"],
    "distinction": ["区别于现有技术的特征"]
  },
  "independent_claims": [
    {
      "claim_number": 1,
      "claim_type": "device",
      "preamble": "前序部分文本",
      "transition": "其特征在于",
      "body": "特征部分文本（不得包含附图标记）",
      "full_text": "完整的权利要求1文本",
      "essential_features": ["必要特征1", "必要特征2"]
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
  "quality_check": {
    "essential_completeness": "检查：是否所有必要技术特征都已记载",
    "support": "检查：是否得到说明书支持",
    "clarity": "检查：用词是否清楚",
    "no_drawing_marks": "检查：是否包含附图标记（应无）",
    "potential_issues": ["潜在问题"]
  }
}`

  // ─── 调用 LLM ────────────────────────────────────

  console.log(`\n🚀 调用 ${MODEL}...`)
  const startTime = Date.now()
  const content = await callLLM({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  })
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`✅ 完成 (${elapsed}s)`)

  const parsed = parseJSON(content)

  const result = {
    ...(parsed || { rawContent: content }),
    _meta: {
      version: 'v5-vector-ds-essential-features',
      generatedAt: new Date().toISOString(),
      model: { provider: 'DeepSeek', model: MODEL, elapsed: elapsed + 's' },
      knowledgeRules: [
        '实施细则第23条第2款（必要技术特征）[距离:0.3635]',
        '实施细则第22条第1款（记载技术特征）[距离:0.3979]',
        '审查指南-独立权利要求撰写规定 [距离:0.4076]',
        '审查指南-权利要求撰写规定 [距离:0.4351]',
      ],
    },
  }

  writeFileSync(join(OUTPUT_DIR, 'claims-v5-redo.json'), JSON.stringify(result, null, 2))

  // ─── 输出摘要 ──────────────────────────────────────

  if (parsed) {
    // 分析过程
    const analysis = parsed.analysis || {}
    console.log('\n📋 分析过程:')
    console.log(`   技术问题: ${analysis.technical_problem || '?'}`)
    const essentials = analysis.essential_features || []
    console.log(`   必要技术特征: ${essentials.length} 个`)
    essentials.forEach(f => console.log(`     → ${f.location === 'preamble' ? '前序' : '特征'}: ${f.feature}（${f.reason}）`))

    // 独立权利要求
    const ic = parsed.independent_claims || []
    console.log(`\n📝 独立权利要求: ${ic.length} 项`)
    for (const c of ic) {
      console.log(`\n   === 权利要求 ${c.claim_number} ===`)
      console.log(`   前序部分: ${c.preamble}`)
      console.log(`   特征部分: ${c.body}`)
      console.log(`   完整文本: ${c.full_text}`)
      console.log(`   必要特征: ${(c.essential_features || []).join(', ')}`)
    }

    // 从属权利要求
    const dc = parsed.dependent_claims || []
    console.log(`\n   从属权利要求: ${dc.length} 项`)
    for (const c of dc) {
      console.log(`     权${c.claim_number}→权${c.parent_claim}: ${(c.content || '').substring(0, 80)}...`)
    }

    // 质量检查
    const qc = parsed.quality_check || {}
    console.log(`\n🔍 质量检查:`)
    console.log(`   必要特征完整性: ${qc.essential_completeness || '?'}`)
    console.log(`   支持性: ${qc.support || '?'}`)
    console.log(`   清楚性: ${qc.clarity || '?'}`)
    console.log(`   无附图标记: ${qc.no_drawing_marks || '?'}`)
    if (qc.potential_issues?.length) {
      console.log(`   潜在问题:`)
      qc.potential_issues.forEach(i => console.log(`     - ${i}`))
    }
  } else {
    console.log('\n⚠️ JSON 解析失败，原始输出:')
    console.log(content.substring(0, 500))
  }

  console.log(`\n💾 结果: ${join(OUTPUT_DIR, 'claims-v5-redo.json')}`)
}

main().catch(err => { console.error('❌ 失败:', err); process.exit(1) })
