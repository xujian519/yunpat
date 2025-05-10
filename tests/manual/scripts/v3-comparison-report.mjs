/**
 * V3 对比分析报告 — 真实 LLM
 *
 * 输入：V3 发明理解结果 + V3 对比文件分析结果
 * 模型：oMLX 本地（发明内容涉及保密，CON-01 合规）
 * 模板：SkillLoader 动态模板
 *
 * 用法：node 测试/scripts/v3-comparison-report.mjs
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
const V3_COMPARISON = join(OUTPUT_DIR, 'comparison-analysis-v3.json')

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

// ─── 从 V3 结果构造输入 ────────────────────────────

function buildComparisonInput(inventionJSON, comparisonJSON) {
  // 从发明理解 JSON 提取
  const concepts = inventionJSON.inventionConcepts || []
  const firstConcept = concepts[0] || {}

  const inventionUnderstanding = {
    technicalProblem: firstConcept.technicalProblem || inventionJSON.technicalField || '',
    technicalSolution: firstConcept.keyFeatures?.join('；') || '',
    technicalEffects: firstConcept.technicalEffects?.join('；') || '',
    keyFeatures: concepts.flatMap(c => c.keyFeatures || []),
  }

  // 从对比文件分析 JSON 构造 priorArtAnalysis
  const ta = comparisonJSON.technical_analysis || {}
  const problems = ta.technical_problems || {}
  const solution = ta.technical_solution || {}
  const features = solution.key_features || []

  const priorArtAnalysis = [{
    patentInfo: {
      publicationNumber: comparisonJSON.document_info?.metadata?.publicationNumber || 'CN200620040894',
      title: comparisonJSON.document_info?.title || '车用离合转动式轴绞车捆绑器',
    },
    technicalAnalysis: {
      technicalProblems: {
        main: problems.main || '',
        sub: problems.sub || [],
      },
      technicalSolution: {
        core: solution.core || '',
        keyFeatures: features.map(f => ({
          feature: f.feature || '',
          necessity: f.necessity || 'optional',
        })),
      },
      technicalEffects: {
        main: (solution.technical_effects || [])[0]?.effect || '',
        sub: (solution.technical_effects || []).slice(1).map(e => e.effect || ''),
      },
    },
    comparison: {
      similarity: 0.3,  // 两专利解决不同问题，相似度不高
      overlappingFeatures: ['绞车捆绑器领域', '转带轴结构'],
      distinctFeatures: [
        '本发明：十字形通孔+定位柱（多类型捆绑带兼容）',
        '对比文件：棘爪座+轴套离合机构（连续紧带）',
        '本发明解决适用性问题，对比文件解决操作效率问题',
      ],
      novelty: true,
    },
  }]

  return { inventionUnderstanding, priorArtAnalysis }
}

// ─── 主函数 ────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════')
  console.log('  V3 对比分析报告 — 真实 LLM')
  console.log('  模型：oMLX 本地（CON-01 保密合规）')
  console.log('═══════════════════════════════════════════════════')

  // 读取 V3 结果
  const inventionJSON = JSON.parse(readFileSync(V3_INVENTION, 'utf-8'))
  const comparisonJSON = JSON.parse(readFileSync(V3_COMPARISON, 'utf-8'))

  console.log(`\n📄 发明理解: ${inventionJSON.inventionConcepts?.length || 0} 组三元组`)
  console.log(`📄 对比文件: ${comparisonJSON.technical_analysis?.technical_solution?.key_features?.length || 0} 个关键特征`)

  // 构造输入
  const input = buildComparisonInput(inventionJSON, comparisonJSON)

  console.log(`\n📋 构造的输入:`)
  console.log(`   发明问题: ${input.inventionUnderstanding.technicalProblem.substring(0, 60)}...`)
  console.log(`   发明特征: ${input.inventionUnderstanding.keyFeatures.length} 个`)
  console.log(`   对比文件: ${input.priorArtAnalysis[0].patentInfo.publicationNumber}`)
  console.log(`   相似度: ${(input.priorArtAnalysis[0].comparison.similarity * 100).toFixed(0)}%`)

  // 加载动态模板
  const skillDir = resolve(import.meta.dirname, '../../.yunpat/skills/comparison-report')
  const systemTemplate = loadTemplate(join(skillDir, 'system-prompt.md'))
  const userTemplate = loadTemplate(join(skillDir, 'user-prompt.md'))

  // 构造提示词
  const systemPrompt = renderTemplate(systemTemplate, {})
    || `你是一位资深的专利对比分析专家，擅长分析发明与现有技术的区别，评估创造性。输出必须是严格的JSON格式。`

  const priorArtSummary = input.priorArtAnalysis.map((art, i) =>
    `## 现有技术 ${i + 1}: ${art.patentInfo.publicationNumber}\n标题: ${art.patentInfo.title}\n技术问题: ${art.technicalAnalysis.technicalProblems.main}\n核心方案: ${art.technicalAnalysis.technicalSolution.core}\n关键特征: ${art.technicalAnalysis.technicalSolution.keyFeatures.map(f => f.feature).join(', ')}\n相似度: ${(art.comparison.similarity * 100).toFixed(1)}%\n区别特征: ${art.comparison.distinctFeatures.join(', ')}`
  ).join('\n\n')

  const templateVars = {
    inventionProblem: input.inventionUnderstanding.technicalProblem,
    inventionSolution: input.inventionUnderstanding.technicalSolution,
    inventionEffects: input.inventionUnderstanding.technicalEffects,
    inventionFeatures: input.inventionUnderstanding.keyFeatures.join(', '),
    priorArtSummary,
  }

  const userPrompt = renderTemplate(userTemplate, templateVars)
    || `## 发明信息\n技术问题: ${templateVars.inventionProblem}\n技术方案: ${templateVars.inventionSolution}\n\n${priorArtSummary}\n\n请生成对比分析报告JSON。`

  // 调用 LLM（发明内容涉及保密 → 本地模型）
  const omlxBaseURL = process.env.OMLX_BASE_URL || 'http://localhost:8009/v1'
  const omlxApiKey = process.env.OMLX_API_KEY || ''
  const omlxModel = 'Qwen3.5-27B-Claude-4.6-Opus-Distilled-MLX-4bit'

  console.log(`\n🚀 调用 oMLX 本地模型...`)
  console.log(`   模型: ${omlxModel}`)
  console.log(`   模板: ${systemTemplate ? 'SkillLoader 动态' : '硬编码降级'}`)

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
    promptSource: systemTemplate ? 'dynamic' : 'hardcoded',
    inputs: {
      invention: V3_INVENTION,
      comparison: V3_COMPARISON,
    },
  }

  const resultJSON = {
    ...(parsed || { rawContent: content }),
    _meta: meta,
  }

  writeFileSync(join(OUTPUT_DIR, 'comparison-report-v3.json'), JSON.stringify(resultJSON, null, 2))
  writeFileSync(join(OUTPUT_DIR, 'v3-raw-comparison-report.txt'), content)

  console.log(`\n💾 结果: ${join(OUTPUT_DIR, 'comparison-report-v3.json')}`)

  // 打印摘要
  if (parsed) {
    const cp = parsed.closest_prior_art || {}
    const df = parsed.distinct_features || []
    const inv = parsed.inventiveness || {}
    console.log(`\n📊 对比分析摘要:`)
    console.log(`   最接近现有技术: ${cp.publication_number || '?'} (相似度 ${(cp.similarity * 100 || 0).toFixed(0)}%)`)
    console.log(`   区别特征: ${df.length} 个`)
    df.forEach((f, i) => console.log(`     ${i + 1}. [${f.novelty}] ${f.feature}`))
    console.log(`   创造性评分: ${((inv.score || 0) * 100).toFixed(0)}%`)
    console.log(`   创造性因素: ${(inv.key_factors || []).join(', ')}`)
  }
}

main().catch(err => {
  console.error('❌ 失败:', err)
  process.exit(1)
})
