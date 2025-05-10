/**
 * V5 统一流程 — 向量检索知识图谱 + DeepSeek 云端模型
 *
 * 三步流水线：
 *  1. 发明理解（flash）
 *  2. 对比分析报告（pro — 核心分析步骤）
 *  3. 权利要求1生成（flash）
 *
 * 提示词：PostgreSQL pgvector 向量检索（bge-m3 embedding）
 * 模型路由：pro（重要分析）+ flash（执行）
 *
 * 用法：node 测试/scripts/v5-unified-vector-deepseek.mjs
 */

import { resolve, join, dirname } from 'path'
import { writeFileSync, readFileSync } from 'fs'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'

const require = createRequire(join(dirname(fileURLToPath(import.meta.url)), '../../packages/node_modules'))
const pg = require('pg')

// ─── 配置 ──────────────────────────────────────────

const OUTPUT_DIR = resolve(import.meta.dirname, '../yunpat/绞车带轴')
const DISCLOSURE = join(OUTPUT_DIR, '交底材料.txt')
const V3_COMPARISON_ANALYSIS = join(OUTPUT_DIR, 'comparison-analysis-v3.json')

// DeepSeek 模型路由
const DS_BASE_URL = 'https://api.deepseek.com'
const DS_API_KEY = 'sk-1b9f6c6ba33f4130a3fb76ea29c2ef95'
const MODEL_FLASH = 'deepseek-v4-flash'
const MODEL_PRO = 'deepseek-v4-pro'

// 本地 Embedding（bge-m3）
const EMB_BASE_URL = 'http://localhost:8009/v1'
const EMB_API_KEY = 'xj781102@'
const EMB_MODEL = 'bge-m3-mlx-8bit'

// PostgreSQL（知识图谱）
const KG_CONFIG = {
  host: '127.0.0.1',
  port: 6432,
  database: 'legal_world_model',
  user: 'xujian',
  password: '',
  max: 3,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 3000,
}

// ─── Embedding ──────────────────────────────────────

async function getEmbedding(text) {
  const res = await fetch(`${EMB_BASE_URL}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${EMB_API_KEY}`,
    },
    body: JSON.stringify({ model: EMB_MODEL, input: text }),
  })
  if (!res.ok) throw new Error(`Embedding API ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data.data[0].embedding
}

// ─── LLM 调用 ──────────────────────────────────────

async function callLLM({ model, messages, temperature = 0.3, maxTokens = 4096 }) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 180000)

  try {
    const res = await fetch(`${DS_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DS_API_KEY}`,
      },
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

// ─── 知识图谱向量检索 ────────────────────────────────

let pool = null

async function initKG() {
  pool = new pg.Pool(KG_CONFIG)
  const client = await pool.connect()
  console.log('   ✅ 知识图谱连接成功 (legal_world_model, pgvector)')
  client.release()
}

async function vectorSearchKnowledge(queryText, options = {}) {
  const { topK = 5, maxChars = 3000, tables = ['patent_rules'] } = options
  const results = []

  try {
    const queryVector = await getEmbedding(queryText)
    const vectorStr = `[${queryVector.join(',')}]`

    // 1. patent_rules_unified_embeddings（审查指南，最相关）
    if (tables.includes('patent_rules')) {
      const sql = `
        SELECT e.chunk_text, e.chunk_type, r.title, r.article_type, e.vector <=> $1::vector AS distance
        FROM patent_rules_unified_embeddings e
        JOIN patent_rules_unified r ON e.rule_id = r.id
        ORDER BY e.vector <=> $1::vector
        LIMIT $2
      `
      const res = await pool.query(sql, [vectorStr, topK])
      for (const row of res.rows) {
        results.push({
          source: 'patent_rules',
          type: row.article_type,
          title: row.title,
          chunkType: row.chunk_type,
          content: row.chunk_text,
          distance: parseFloat(row.distance).toFixed(4),
        })
      }
    }

    // 2. openclaw_kg_nodes（概念图谱，如果需要）
    if (tables.includes('concepts')) {
      const sql = `
        SELECT name, title, content, node_type
        FROM openclaw_kg_nodes
        WHERE node_type IN ('Concept', 'GuidelineRule', 'ImplementationRule', 'Clause', 'Chapter')
          AND (name ILIKE ANY($1) OR title ILIKE ANY($1))
        LIMIT $2
      `
      const keywords = queryText.split(/[\s,，、]+/).filter(k => k.length > 1).map(k => `%${k}%`)
      const res = await pool.query(sql, [keywords, Math.ceil(topK / 2)])
      for (const row of res.rows) {
        results.push({
          source: 'openclaw_kg',
          type: row.node_type,
          title: row.title || row.name,
          content: row.content,
        })
      }
    }
  } catch (err) {
    console.warn('   ⚠️ 向量检索失败:', err.message)
  }

  // 按字符预算截断
  let totalChars = 0
  const trimmed = []
  for (const r of results) {
    const budget = Math.min(r.content.length, maxChars - totalChars)
    if (budget <= 0) break
    trimmed.push({ ...r, content: r.content.substring(0, budget) })
    totalChars += budget
  }

  return trimmed
}

function formatKnowledgeContext(knowledgeResults) {
  if (!knowledgeResults.length) return ''

  let ctx = '\n## 参考知识（来自专利知识图谱 — 向量检索）\n\n'
  for (const item of knowledgeResults) {
    const dist = item.distance ? ` [距离:${item.distance}]` : ''
    ctx += `### ${item.title} [${item.type}]${dist}\n${item.content}\n\n`
  }
  return ctx
}

// ─── 模板加载 ──────────────────────────────────────

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
  result = result.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, key, content) => vars[key] ? content : '')
  result = result.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || '')
  return result
}

function parseJSON(content) {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) return JSON.parse(jsonMatch[0])
  } catch { /* ignore */ }
  return null
}

// ─── 步骤1：发明理解（flash）────────────────────────

async function step1_inventionUnderstanding(disclosure) {
  console.log('\n' + '═'.repeat(55))
  console.log(`  步骤1: 发明理解 → ${MODEL_FLASH}`)
  console.log('═'.repeat(55))

  const startTime = Date.now()

  // 向量检索知识
  console.log('  📚 向量检索: 发明理解相关知识...')
  const kg = await vectorSearchKnowledge(
    '技术交底书分析 发明理解 技术问题 技术方案 技术效果 三元组提取',
    { topK: 5, maxChars: 2000 }
  )
  console.log(`     检索到 ${kg.length} 条（距离: ${kg.map(k => k.distance).join(', ')})`)

  // 模板
  const skillDir = resolve(import.meta.dirname, '../../.yunpat/skills/invention-understanding')
  const sysTemplate = loadTemplate(join(skillDir, 'system-prompt.md'))
  const usrTemplate = loadTemplate(join(skillDir, 'user-prompt.md'))

  const knowledgeContext = formatKnowledgeContext(kg)
  const systemPrompt = renderTemplate(sysTemplate, {
    hasKnowledge: kg.length > 0 ? 'true' : '',
    knowledgeContext,
    hasMethodologyTriplet: '',
    methodologyTriplet: '',
    domainGuide: '',
  }) || '你是一位资深的专利代理人，专精于发明理解和专利申请文件撰写。你的核心任务是：从技术交底书中提取多组问题-特征-效果三元组。输出必须是严格的JSON格式。'

  const userPrompt = renderTemplate(usrTemplate, {
    title: '一种绞车带轴',
    field: '机械工程—绞车技术领域',
    technicalDisclosure: disclosure,
  }) || `## 发明基本信息\n发明名称：一种绞车带轴\n技术领域：机械工程—绞车技术领域\n\n## 技术交底书\n${disclosure}\n\n请提取多组技术问题-技术特征-技术效果三元组，输出JSON格式。`

  // 调用 DeepSeek flash
  console.log(`  🚀 调用 ${MODEL_FLASH}...`)
  const content = await callLLM({ model: MODEL_FLASH, messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]})

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`  ✅ 完成 (${elapsed}s)`)

  const parsed = parseJSON(content)
  const result = {
    ...(parsed || { rawContent: content }),
    _meta: {
      version: 'v5-vector-ds',
      generatedAt: new Date().toISOString(),
      model: { provider: 'DeepSeek', model: MODEL_FLASH, elapsed: elapsed + 's' },
      promptSource: 'dynamic+vector-kg',
      knowledgeSources: kg.map(k => `${k.source}:${k.title}[${k.distance}]`),
    },
  }

  writeFileSync(join(OUTPUT_DIR, 'invention-analysis-v5.json'), JSON.stringify(result, null, 2))

  if (parsed) {
    const concepts = parsed.inventionConcepts || []
    console.log(`  📊 ${concepts.length} 组三元组`)
    concepts.forEach((c, i) => console.log(`     ${i + 1}. ${(c.technicalProblem || '').substring(0, 50)}... (${(c.keyFeatures || []).length}特征, 置信度:${c.confidence || '?'})`))
  }

  return result
}

// ─── 步骤2：对比分析报告（pro）─────────────────────────

async function step2_comparisonReport(inventionJSON, comparisonAnalysis) {
  console.log('\n' + '═'.repeat(55))
  console.log(`  步骤2: 对比分析报告 → ${MODEL_PRO} ★重要分析`)
  console.log('═'.repeat(55))

  const startTime = Date.now()

  // 向量检索知识（对比分析核心：创造性判断三步法）
  console.log('  📚 向量检索: 创造性判断/对比分析相关知识...')
  const kg = await vectorSearchKnowledge(
    '创造性判断 三步法 区别特征 技术启示 对比文件 现有技术 显而易见',
    { topK: 6, maxChars: 4000 }
  )
  console.log(`     检索到 ${kg.length} 条（距离: ${kg.map(k => k.distance).join(', ')})`)

  // 构造输入
  const concepts = inventionJSON.inventionConcepts || []
  const firstConcept = concepts[0] || {}
  const inventionUnderstanding = {
    technicalProblem: firstConcept.technicalProblem || '',
    technicalSolution: firstConcept.keyFeatures?.join('；') || '',
    technicalEffects: firstConcept.technicalEffects?.join('；') || '',
    keyFeatures: concepts.flatMap(c => c.keyFeatures || []),
  }

  const ta = comparisonAnalysis.technical_analysis || {}
  const problems = ta.technical_problems || {}
  const solution = ta.technical_solution || {}
  const features = solution.key_features || []

  const priorArtAnalysis = [{
    patentInfo: {
      publicationNumber: comparisonAnalysis.document_info?.metadata?.publicationNumber || 'CN200620040894',
      title: comparisonAnalysis.document_info?.title || '车用离合转动式轴绞车捆绑器',
    },
    technicalAnalysis: {
      technicalProblems: { main: problems.main || '', sub: problems.sub || [] },
      technicalSolution: {
        core: solution.core || '',
        keyFeatures: features.map(f => ({ feature: f.feature || '', necessity: f.necessity || 'optional' })),
      },
      technicalEffects: {
        main: (solution.technical_effects || [])[0]?.effect || '',
        sub: (solution.technical_effects || []).slice(1).map(e => e.effect || ''),
      },
    },
    comparison: {
      similarity: 0.3,
      overlappingFeatures: ['绞车捆绑器领域', '转带轴结构'],
      distinctFeatures: [
        '本发明：十字形通孔+定位柱（多类型捆绑带兼容）',
        '对比文件：棘爪座+轴套离合机构（连续紧带）',
      ],
      novelty: true,
    },
  }]

  // 模板 + 向量知识
  const skillDir = resolve(import.meta.dirname, '../../.yunpat/skills/comparison-report')
  const sysTemplate = loadTemplate(join(skillDir, 'system-prompt.md'))
  const usrTemplate = loadTemplate(join(skillDir, 'user-prompt.md'))

  const knowledgeContext = formatKnowledgeContext(kg)
  const systemPrompt = renderTemplate(sysTemplate, {
    hasKnowledge: kg.length > 0 ? 'true' : '',
    knowledgeContext,
  }) || '你是一位资深的专利对比分析专家。输出必须是严格的JSON格式。'

  const priorArtSummary = priorArtAnalysis.map((art, i) =>
    `## 现有技术 ${i + 1}: ${art.patentInfo.publicationNumber}\n标题: ${art.patentInfo.title}\n技术问题: ${art.technicalAnalysis.technicalProblems.main}\n核心方案: ${art.technicalAnalysis.technicalSolution.core}\n关键特征: ${art.technicalAnalysis.technicalSolution.keyFeatures.map(f => f.feature).join(', ')}\n相似度: ${(art.comparison.similarity * 100).toFixed(0)}%\n区别特征: ${art.comparison.distinctFeatures.join(', ')}`
  ).join('\n\n')

  const templateVars = {
    inventionProblem: inventionUnderstanding.technicalProblem,
    inventionSolution: inventionUnderstanding.technicalSolution,
    inventionEffects: inventionUnderstanding.technicalEffects,
    inventionFeatures: inventionUnderstanding.keyFeatures.join(', '),
    priorArtSummary,
  }

  const userPrompt = renderTemplate(usrTemplate, templateVars)
    || `## 发明信息\n技术问题: ${templateVars.inventionProblem}\n技术方案: ${templateVars.inventionSolution}\n\n${priorArtSummary}\n\n请生成对比分析报告JSON。`

  // 调用 DeepSeek pro
  console.log(`  🚀 调用 ${MODEL_PRO}...`)
  const content = await callLLM({ model: MODEL_PRO, messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]})

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`  ✅ 完成 (${elapsed}s)`)

  const parsed = parseJSON(content)
  const result = {
    ...(parsed || { rawContent: content }),
    _meta: {
      version: 'v5-vector-ds',
      generatedAt: new Date().toISOString(),
      model: { provider: 'DeepSeek', model: MODEL_PRO, elapsed: elapsed + 's' },
      promptSource: 'dynamic+vector-kg',
      knowledgeSources: kg.map(k => `${k.source}:${k.title}[${k.distance}]`),
    },
  }

  writeFileSync(join(OUTPUT_DIR, 'comparison-report-v5.json'), JSON.stringify(result, null, 2))

  if (parsed) {
    const cp = parsed.closest_prior_art || {}
    const df = parsed.distinct_features || []
    const inv = parsed.inventiveness || {}
    console.log(`  📊 最接近现有技术: ${cp.publication_number || '?'} (相似度 ${(cp.similarity * 100 || 0).toFixed(0)}%)`)
    console.log(`     区别特征: ${df.length} 个`)
    df.forEach((f, i) => console.log(`       ${i + 1}. [${f.novelty}] ${f.feature.substring(0, 50)}...`))
    console.log(`     创造性评分: ${((inv.score || 0) * 100).toFixed(0)}%`)
  }

  return result
}

// ─── 步骤3：权利要求1（flash）─────────────────────────

async function step3_claimsGeneration(inventionJSON, reportJSON, disclosure) {
  console.log('\n' + '═'.repeat(55))
  console.log(`  步骤3: 权利要求1生成 → ${MODEL_FLASH}`)
  console.log('═'.repeat(55))

  const startTime = Date.now()

  // 向量检索知识
  console.log('  📚 向量检索: 权利要求撰写相关知识...')
  const kg = await vectorSearchKnowledge(
    '权利要求书撰写 独立权利要求 其特征在于 必要技术特征 两部分撰写法 前序部分 特征部分',
    { topK: 5, maxChars: 3000 }
  )
  console.log(`     检索到 ${kg.length} 条（距离: ${kg.map(k => k.distance).join(', ')})`)

  // 构造撰写计划
  const concepts = inventionJSON.inventionConcepts || []
  const firstConcept = concepts[0] || {}
  const distinctFeatures = (reportJSON.distinct_features || []).map(f => f.feature)
  const essentialFeatures = concepts.flatMap(c => c.keyFeatures || [])
  const suggestedClaims = reportJSON.protection_scope?.independent_claims || []

  const plan = `# 权利要求撰写计划\n\n## 发明名称\n一种绞车带轴\n\n## 技术领域\n${inventionJSON.technicalField || '机械工程—绞车技术领域'}\n\n## 技术问题\n${firstConcept.technicalProblem || ''}\n\n## 核心技术方案\n${firstConcept.keyFeatures?.join('；') || ''}\n\n## 区别特征（对比分析报告）\n${distinctFeatures.map((f, i) => `${i + 1}. ${f}`).join('\n')}\n\n## 必要技术特征\n${essentialFeatures.map((f, i) => `${i + 1}. ${f}`).join('\n')}\n\n## 独立权利要求建议\n${suggestedClaims.join('\n')}`

  // System prompt + 知识图谱
  const knowledgeContext = formatKnowledgeContext(kg)
  const systemPrompt = `你是一位资深的专利代理师，拥有15年的专利撰写经验。

请严格按照以下原则撰写权利要求：
1. 清楚性原则：用词清楚，类型明确
2. 简要性原则：简明扼要，不描述原因理由
3. 支持性原则：以说明书为依据，不超出公开范围
4. 必要技术特征原则：只写入解决技术问题不可缺少的特征

使用两部分撰写法：
- 前序部分：发明名称 + 与现有技术共有的必要技术特征
- 特征部分："其特征在于" + 区别于现有技术的技术特征

**重要**：权利要求中不得包含附图标记（如4a、4b、5等），不得包含原因、理由或功能描述。
${knowledgeContext}
输出必须是严格的 JSON 格式。`

  // User prompt
  const skillDir = resolve(import.meta.dirname, '../../.yunpat/skills/patent-drafting')
  const claimsTemplate = loadTemplate(join(skillDir, 'claims-generation.md'))

  const templateVars = {
    plan,
    technicalDisclosure: disclosure,
    inventionTitle: '一种绞车带轴',
    technicalField: inventionJSON.technicalField || '机械工程—绞车技术领域',
  }

  const userPrompt = renderTemplate(claimsTemplate, templateVars)
    ? renderTemplate(claimsTemplate, templateVars) + '\n\n请重点撰写独立权利要求1，确保包含所有必要技术特征。**权利要求中不得包含附图标记。** 输出 JSON 格式。'
    : `## 撰写计划\n${plan}\n\n## 技术交底书\n${disclosure}\n\n请撰写权利要求。**不得包含附图标记。** 输出 JSON。`

  // 调用 DeepSeek flash
  console.log(`  🚀 调用 ${MODEL_FLASH}...`)
  const content = await callLLM({ model: MODEL_FLASH, messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]})

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`  ✅ 完成 (${elapsed}s)`)

  const parsed = parseJSON(content)
  const result = {
    ...(parsed || { rawContent: content }),
    _meta: {
      version: 'v5-vector-ds',
      generatedAt: new Date().toISOString(),
      model: { provider: 'DeepSeek', model: MODEL_FLASH, elapsed: elapsed + 's' },
      promptSource: 'dynamic+vector-kg',
      knowledgeSources: kg.map(k => `${k.source}:${k.title}[${k.distance}]`),
    },
  }

  writeFileSync(join(OUTPUT_DIR, 'claims-v5.json'), JSON.stringify(result, null, 2))

  if (parsed) {
    const ic = parsed.independent_claims || []
    const dc = parsed.dependent_claims || []
    console.log(`  📊 独立权利要求: ${ic.length} 项`)
    for (const c of ic) {
      console.log(`\n     === 权利要求 ${c.claim_number} ===`)
      console.log(`     ${c.full_text || ''}`)
      console.log(`     必要特征: ${(c.essential_features || []).join(', ')}`)
    }
    console.log(`\n     从属权利要求: ${dc.length} 项`)
    for (const c of dc) {
      console.log(`       权${c.claim_number}→权${c.parent_claim}: ${(c.content || '').substring(0, 60)}...`)
    }
    if (parsed.quality_check) {
      console.log(`     质量检查 — 清楚性: ${parsed.quality_check.clarity?.substring(0, 40)}...`)
    }
  }

  return result
}

// ─── 主函数 ────────────────────────────────────────

async function main() {
  console.log('╔' + '═'.repeat(55) + '╗')
  console.log('║  V5 统一流程 — 向量检索 + DeepSeek 模型路由              ║')
  console.log('╚' + '═'.repeat(55) + '╝')
  console.log(`\n  模型路由:`)
  console.log(`    ${MODEL_FLASH} → 步骤1(发明理解) + 步骤3(权利要求)`)
  console.log(`    ${MODEL_PRO}   → 步骤2(对比分析报告) ★`)
  console.log(`  向量检索: bge-m3 → pgvector (patent_rules_unified_embeddings)`)

  // 初始化
  console.log('\n📚 初始化知识图谱...')
  await initKG()

  const disclosure = readFileSync(DISCLOSURE, 'utf-8')
  console.log(`📄 技术交底书: ${disclosure.length} 字`)

  let comparisonAnalysis
  try {
    comparisonAnalysis = JSON.parse(readFileSync(V3_COMPARISON_ANALYSIS, 'utf-8'))
    console.log(`📄 对比文件分析: 复用 V3 结果`)
  } catch {
    console.error('❌ 未找到 V3 对比分析结果')
    process.exit(1)
  }

  // 流水线
  const inventionResult = await step1_inventionUnderstanding(disclosure)
  const reportResult = await step2_comparisonReport(inventionResult, comparisonAnalysis)
  const claimsResult = await step3_claimsGeneration(inventionResult, reportResult, disclosure)

  // 总结
  console.log('\n' + '═'.repeat(55))
  console.log('  V5 全流程完成')
  console.log('═'.repeat(55))

  const t1 = inventionResult._meta?.model?.elapsed
  const t2 = reportResult._meta?.model?.elapsed
  const t3 = claimsResult._meta?.model?.elapsed

  console.log(`\n  ⏱️ 耗时:`)
  console.log(`     发明理解 (${MODEL_FLASH}): ${t1}`)
  console.log(`     对比报告 (${MODEL_PRO}): ${t2}`)
  console.log(`     权利要求 (${MODEL_FLASH}): ${t3}`)

  const invConcepts = inventionResult.inventionConcepts || []
  const reportDistinct = reportResult.distinct_features || []
  const claimsIndependent = claimsResult.independent_claims || []

  console.log(`\n  📊 结果:`)
  console.log(`     三元组: ${invConcepts.length} 组`)
  console.log(`     区别特征: ${reportDistinct.length} 个`)
  console.log(`     创造性: ${((reportResult.inventiveness?.score || 0) * 100).toFixed(0)}%`)
  console.log(`     独立权利要求: ${claimsIndependent.length} 项`)
  if (claimsIndependent[0]?.full_text) {
    console.log(`\n  📝 权利要求1:`)
    console.log(`     ${claimsIndependent[0].full_text}`)
  }

  console.log(`\n  📁 输出:`)
  console.log(`     ${join(OUTPUT_DIR, 'invention-analysis-v5.json')}`)
  console.log(`     ${join(OUTPUT_DIR, 'comparison-report-v5.json')}`)
  console.log(`     ${join(OUTPUT_DIR, 'claims-v5.json')}`)

  await pool.end()
}

main().catch(err => {
  console.error('❌ 失败:', err)
  if (pool) pool.end().catch(() => {})
  process.exit(1)
})
