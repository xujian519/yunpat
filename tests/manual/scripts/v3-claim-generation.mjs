/**
 * V3 权利要求生成 — 真实 LLM（仅撰写权利要求1）
 *
 * 输入：V3 发明理解 + V3 对比报告 + 技术交底书原文
 * 模型：oMLX 本地（发明内容涉及保密，CON-01 合规）
 * 模板：SkillLoader 动态模板
 *
 * 用法：node 测试/scripts/v3-claim-generation.mjs
 */

import { resolve, join } from 'path'
import { writeFileSync, readFileSync } from 'fs'

// 手动加载 .env
function loadEnv(filePath) {
  try {
    const content = readFileSync(filePath, 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq > 0) {
        const key = trimmed.slice(0, eq).trim()
        const val = trimmed.slice(eq + 1).trim()
        if (!process.env[key]) process.env[key] = val
      }
    }
  } catch (e) { /* ignore */ }
}
loadEnv(resolve(import.meta.dirname, '../../packages/.env'))

// ─── 常量 ──────────────────────────────────────────

const OUTPUT_DIR = resolve(import.meta.dirname, '../yunpat/绞车带轴')
const V3_INVENTION = join(OUTPUT_DIR, 'invention-analysis-v3.json')
const V3_REPORT = join(OUTPUT_DIR, 'comparison-report-v3.json')
const DISCLOSURE = join(OUTPUT_DIR, '交底材料.txt')

// ─── LLM 调用 ──────────────────────────────────────

async function callLLM({ baseURL, apiKey, model, messages, temperature = 0.3, maxTokens = 4096 }) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 300000)

  try {
    const headers = { 'Content-Type': 'application/json' }
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`

    const res = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens, stream: false }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`API ${res.status}: ${text}`)
    }

    const data = await res.json()
    return data.choices?.[0]?.message?.content || ''
  } finally {
    clearTimeout(timeout)
  }
}

// ─── 模板加载与渲染 ────────────────────────────────

function loadTemplate(templatePath) {
  try {
    let content = readFileSync(templatePath, 'utf-8')
    content = content.replace(/^---[\s\S]*?---\n/, '')
    return content
  } catch {
    return null
  }
}

function renderTemplate(template, vars) {
  if (!template) return null
  let result = template
  result = result.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, key, content) => {
    return vars[key] ? content : ''
  })
  result = result.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || '')
  return result
}

// ─── 构造撰写计划 ──────────────────────────────────

function buildPlan(inventionJSON, reportJSON) {
  const concepts = inventionJSON.inventionConcepts || []
  const firstConcept = concepts[0] || {}
  const report = reportJSON || {}

  // 从对比报告提取区别特征
  const distinctFeatures = (report.distinct_features || []).map(f => f.feature)

  // 从对比报告提取独立权利要求建议
  const suggestedClaims = report.protection_scope?.independent_claims || []

  // 从发明理解提取必要技术特征
  const essentialFeatures = concepts.flatMap(c => c.keyFeatures || [])

  const plan = `
# 权利要求撰写计划

## 发明名称
一种绞车带轴

## 技术领域
${inventionJSON.technicalField || '机械工程—绞车技术领域'}

## 技术问题
${firstConcept.technicalProblem || ''}

## 核心技术方案
${firstConcept.keyFeatures?.join('；') || ''}

## 技术效果
${firstConcept.technicalEffects?.join('；') || ''}

## 区别特征（对比分析报告）
${distinctFeatures.map((f, i) => `${i + 1}. ${f}`).join('\n')}

## 必要技术特征（全部）
${essentialFeatures.map((f, i) => `${i + 1}. ${f}`).join('\n')}

## 独立权利要求建议（对比报告）
${suggestedClaims.join('\n')}

## 撰写策略
1. 独立权利要求1：产品权利要求（绞车带轴），使用两部分撰写法
   - 前序部分：一种绞车带轴，包括杆状本体
   - 特征部分：十字形通孔结构 + 定位柱
2. 从属权利要求：通孔垂直关系、定位柱位置、定位柱连接方式、通孔尺寸关系
3. 保护范围：适中，确保核心创新点（十字形通孔+定位柱的三类型兼容）被完整保护
`.trim()

  return plan
}

// ─── 主函数 ────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════')
  console.log('  V3 权利要求生成 — 真实 LLM')
  console.log('  模型：oMLX 本地（CON-01 保密合规）')
  console.log('═══════════════════════════════════════════════════')

  // 读取输入
  const inventionJSON = JSON.parse(readFileSync(V3_INVENTION, 'utf-8'))
  const reportJSON = JSON.parse(readFileSync(V3_REPORT, 'utf-8'))
  const disclosure = readFileSync(DISCLOSURE, 'utf-8')

  console.log(`\n📄 发明理解: ${inventionJSON.inventionConcepts?.length || 0} 组三元组`)
  console.log(`📄 对比报告: ${(reportJSON.distinct_features || []).length} 个区别特征`)
  console.log(`📄 交底书: ${disclosure.length} 字`)

  // 构造撰写计划
  const plan = buildPlan(inventionJSON, reportJSON)

  // 加载动态模板
  const skillDir = resolve(import.meta.dirname, '../../.yunpat/skills/patent-drafting')
  const claimsTemplate = loadTemplate(join(skillDir, 'claims-generation.md'))

  // 构造 system prompt（ClaimGeneratorAgent 硬编码）
  const systemPrompt = `你是一位资深的专利代理师，拥有15年的专利撰写经验。

请严格按照以下原则撰写权利要求：
1. 清楚性原则：用词清楚，类型明确
2. 简要性原则：简明扼要，不描述原因理由
3. 支持性原则：以说明书为依据，不超出公开范围
4. 必要技术特征原则：只写入解决技术问题不可缺少的特征

使用两部分撰写法：
- 前序部分：发明名称 + 与现有技术共有的必要技术特征
- 特征部分："其特征在于" + 区别于现有技术的技术特征

输出必须是严格的 JSON 格式。`

  // 构造 user prompt
  const templateVars = {
    plan,
    technicalDisclosure: disclosure,
    inventionTitle: '一种绞车带轴',
    technicalField: inventionJSON.technicalField || '机械工程—绞车技术领域',
  }

  let userPrompt
  const renderedTemplate = renderTemplate(claimsTemplate, templateVars)

  if (renderedTemplate) {
    userPrompt = renderedTemplate + '\n\n## 额外说明\n\n请重点撰写独立权利要求1，确保包含所有必要技术特征。输出 JSON 格式。'
    console.log(`\n📋 模板: SkillLoader 动态 (claims-generation.md)`)
  } else {
    userPrompt = `基于以下发明理解和检索分析，撰写权利要求：

## 发明理解

### 技术领域
${templateVars.technicalField}

### 技术问题
${inventionJSON.inventionConcepts[0].technicalProblem}

### 技术方案
${inventionJSON.inventionConcepts[0].keyFeatures.join('；')}

### 技术效果
${inventionJSON.inventionConcepts[0].technicalEffects.join('；')}

### 关键特征
${inventionJSON.inventionConcepts.flatMap(c => c.keyFeatures).map((f, i) => `${i + 1}. ${f}`).join('\n')}

## 对比分析

### 最接近现有技术
${reportJSON.closest_prior_art.publication_number} - ${reportJSON.closest_prior_art.title}
相似度: ${(reportJSON.closest_prior_art.similarity * 100).toFixed(0)}%

### 区别特征
${(reportJSON.distinct_features || []).map((f, i) => `${i + 1}. [${f.novelty}] ${f.feature}`).join('\n')}

## 技术交底书

${disclosure}

---

请撰写权利要求（重点撰写独立权利要求1），输出 JSON 格式：
{
  "independent_claims": [
    {
      "claim_number": 1,
      "claim_type": "device",
      "preamble": "前序部分",
      "transition": "其特征在于",
      "body": "特征部分",
      "full_text": "完整权利要求文本",
      "essential_features": ["必要特征1", "必要特征2"]
    }
  ],
  "dependent_claims": [
    {
      "claim_number": 2,
      "parent_claim": 1,
      "content": "从属权利要求内容",
      "additional_features": ["附加特征"],
      "limitation_type": "further_limitation"
    }
  ],
  "layout_strategy": "权利要求布局说明",
  "protection_scope_analysis": "保护范围分析",
  "quality_check": {
    "clarity": "清楚性检查结果",
    "support": "支持性检查结果",
    "essential_features": "必要技术特征检查结果",
    "potential_issues": ["潜在问题1"]
  }
}`
    console.log(`\n📋 模板: 硬编码降级`)
  }

  // 调用 LLM（技术交底书涉及保密 → 本地模型）
  const omlxBaseURL = process.env.OMLX_BASE_URL || 'http://localhost:8009/v1'
  const omlxApiKey = process.env.OMLX_API_KEY || ''
  const omlxModel = 'Qwen3.5-27B-Claude-4.6-Opus-Distilled-MLX-4bit'

  console.log(`\n🚀 调用 oMLX 本地模型...`)
  console.log(`   模型: ${omlxModel}`)

  const startTime = Date.now()

  const content = await callLLM({
    baseURL: omlxBaseURL,
    apiKey: omlxApiKey,
    model: omlxModel,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3,
    maxTokens: 4096,
  })

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`   ✅ 完成 (${elapsed}s)`)

  // 解析 JSON
  let parsed = null
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0])
  } catch (e) {
    console.warn('   ⚠️ JSON 解析失败')
  }

  // 保存结果
  const meta = {
    version: 'v3-real-llm',
    generatedAt: new Date().toISOString(),
    model: { provider: 'oMLX-local', model: omlxModel, elapsed: elapsed + 's' },
    promptSource: renderedTemplate ? 'dynamic' : 'hardcoded',
    inputs: {
      invention: V3_INVENTION,
      report: V3_REPORT,
      disclosure: DISCLOSURE,
    },
  }

  const resultJSON = {
    ...(parsed || { rawContent: content }),
    _meta: meta,
  }

  writeFileSync(join(OUTPUT_DIR, 'claims-v3.json'), JSON.stringify(resultJSON, null, 2))
  writeFileSync(join(OUTPUT_DIR, 'v3-raw-claims.txt'), content)

  console.log(`\n💾 结果: ${join(OUTPUT_DIR, 'claims-v3.json')}`)

  // 打印摘要
  if (parsed) {
    const independentClaims = parsed.independent_claims || []
    const dependentClaims = parsed.dependent_claims || []
    const qualityCheck = parsed.quality_check || {}

    console.log(`\n📊 权利要求生成摘要:`)
    console.log(`   独立权利要求: ${independentClaims.length} 项`)
    independentClaims.forEach((c, i) => {
      console.log(`\n   === 独立权利要求 ${c.claim_number || i + 1} ===`)
      console.log(`   类型: ${c.claim_type || '?'}`)
      console.log(`   前序部分: ${c.preamble || ''}`)
      console.log(`   特征部分: ${c.body || ''}`)
      console.log(`   完整文本: ${c.full_text || ''}`)
      console.log(`   必要特征: ${(c.essential_features || []).join(', ')}`)
    })

    console.log(`\n   从属权利要求: ${dependentClaims.length} 项`)
    dependentClaims.forEach(c => {
      console.log(`     权利要求${c.claim_number}: 引用权利要求${c.parent_claim} — ${c.content?.substring(0, 60)}...`)
    })

    if (qualityCheck.clarity) {
      console.log(`\n   质量检查:`)
      console.log(`     清楚性: ${qualityCheck.clarity}`)
      console.log(`     支持性: ${qualityCheck.support}`)
      console.log(`     必要特征: ${qualityCheck.essential_features}`)
      console.log(`     潜在问题: ${(qualityCheck.potential_issues || []).join(', ')}`)
    }

    console.log(`\n   布局策略: ${parsed.layout_strategy || '?'}`)
    console.log(`   保护范围: ${parsed.protection_scope_analysis || '?'}`)
  }
}

main().catch(err => {
  console.error('❌ 失败:', err)
  process.exit(1)
})
