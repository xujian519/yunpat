/**
 * V4 统一流程 — 知识图谱获取提示词 + gemma-4 本地模型
 *
 * 三步流水线：
 *  1. 发明理解（技术交底书分析）
 *  2. 对比分析报告
 *  3. 权利要求1生成
 *
 * 模型：gemma-4-e2b-it-4bit（oMLX 本地，CON-01 合规）
 * 提示词：PostgreSQL 知识图谱（legal_world_model）
 *
 * 用法：node 测试/scripts/v4-unified-kg.mjs
 */

import { resolve, join, dirname } from 'path'
import { writeFileSync, readFileSync } from 'fs'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'

// pg 模块在 packages/node_modules 下，通过 createRequire 加载
const require = createRequire(join(dirname(fileURLToPath(import.meta.url)), '../../packages/node_modules'))
const pg = require('pg')

// ─── 环境配置 ──────────────────────────────────────

const OUTPUT_DIR = resolve(import.meta.dirname, '../yunpat/绞车带轴')
const DISCLOSURE = join(OUTPUT_DIR, '交底材料.txt')
const COMPARISON_FILE = join(OUTPUT_DIR, '对比文件-CN200620040894.txt')

// 如果有 V3 对比分析结果，直接复用
const V3_COMPARISON_ANALYSIS = join(OUTPUT_DIR, 'comparison-analysis-v3.json')

// LLM 配置
const OMLX_BASE_URL = 'http://localhost:8009/v1'
const OMLX_API_KEY = 'xj781102@'
const OMLX_MODEL = 'gemma-4-e2b-it-4bit'

// 知识图谱配置
const KG_CONFIG = {
  host: '127.0.0.1',
  port: 6432,
  database: 'legal_world_model',
  user: 'xujian',
  password: '',
  max: 5,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 3000,
}

// ─── LLM 调用 ──────────────────────────────────────

async function callLLM({ messages, temperature = 0.3, maxTokens = 4096 }) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 180000) // gemma-4 应该更快

  try {
    const res = await fetch(`${OMLX_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OMLX_API_KEY}`,
      },
      body: JSON.stringify({ model: OMLX_MODEL, messages, temperature, max_tokens: maxTokens, stream: false }),
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

// ─── 知识图谱查询 ──────────────────────────────────

let pool = null

async function initKG() {
  pool = new pg.Pool(KG_CONFIG)
  // 测试连接
  const client = await pool.connect()
  console.log('   ✅ 知识图谱连接成功 (legal_world_model)')
  client.release()
  return pool
}

async function queryKnowledge(queryText, options = {}) {
  const { topK = 5, maxChars = 3000 } = options
  const results = []

  try {
    // 1. patent_rules_unified 关键词搜索（审查指南）
    const rulesQuery = `
      SELECT title, content, article_type
      FROM patent_rules_unified
      WHERE title ILIKE ANY($1) OR content ILIKE ANY($1)
      ORDER BY
        CASE WHEN title ILIKE ANY($1) THEN 0 ELSE 1 END,
        length(content) DESC
      LIMIT $2
    `
    const keywords = queryText.split(/[\s,，、]+/).filter(k => k.length > 0)
    const likePatterns = keywords.map(k => `%${k}%`)

    const rulesRes = await pool.query(rulesQuery, [likePatterns, topK])
    for (const row of rulesRes.rows) {
      results.push({
        source: 'patent_rules',
        type: row.article_type,
        title: row.title,
        content: row.content,
      })
    }

    // 2. openclaw_kg_nodes 概念搜索（知识图谱节点）
    const kgQuery = `
      SELECT name, title, content, node_type
      FROM openclaw_kg_nodes
      WHERE node_type IN ('Concept', 'GuidelineRule', 'ImplementationRule', 'Clause')
        AND (name ILIKE ANY($1) OR title ILIKE ANY($1) OR content ILIKE ANY($1))
      ORDER BY
        CASE WHEN name ILIKE ANY($1) THEN 0 ELSE 1 END
      LIMIT $2
    `
    const kgRes = await pool.query(kgQuery, [likePatterns, Math.ceil(topK / 2)])
    for (const row of kgRes.rows) {
      results.push({
        source: 'openclaw_kg',
        type: row.node_type,
        title: row.title || row.name,
        content: row.content,
      })
    }
  } catch (err) {
    console.warn('   ⚠️ 知识图谱查询失败:', err.message)
  }

  // 按字符预算截断
  let totalChars = 0
  const trimmed = []
  for (const r of results) {
    const charBudget = Math.min(r.content.length, maxChars - totalChars)
    if (charBudget <= 0) break
    trimmed.push({
      ...r,
      content: r.content.substring(0, charBudget),
    })
    totalChars += charBudget
  }

  return trimmed
}

function formatKnowledgeContext(knowledgeResults) {
  if (!knowledgeResults.length) return ''

  let ctx = '\n## 参考知识（来自专利知识图谱）\n\n'

  // 按 source 分组
  const bySource = {}
  for (const r of knowledgeResults) {
    if (!bySource[r.source]) bySource[r.source] = []
    bySource[r.source].push(r)
  }

  for (const [source, items] of Object.entries(bySource)) {
    const sourceLabel = source === 'patent_rules' ? '审查指南' : '知识图谱'
    ctx += `### ${sourceLabel}\n\n`
    for (const item of items) {
      ctx += `**${item.title}** [${item.type}]\n`
      ctx += `${item.content}\n\n`
    }
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
  result = result.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, key, content) => {
    return vars[key] ? content : ''
  })
  result = result.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || '')
  return result
}

// ─── JSON 解析 ──────────────────────────────────────

function parseJSON(content) {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) return JSON.parse(jsonMatch[0])
  } catch (e) { /* ignore */ }
  return null
}

// ─── 步骤1：发明理解 ────────────────────────────────

async function step1_inventionUnderstanding(disclosure) {
  console.log('\n' + '═'.repeat(55))
  console.log('  步骤1: 发明理解（技术交底书分析）')
  console.log('═'.repeat(55))

  const startTime = Date.now()

  // 从知识图谱获取提示词知识
  console.log('  📚 从知识图谱获取发明理解相关知识...')
  const kgKnowledge = await queryKnowledge('技术交底书 发明理解 技术问题 技术方案 技术效果 三元组', { topK: 5, maxChars: 2000 })
  console.log(`     获取 ${kgKnowledge.length} 条知识`)

  // 加载动态模板
  const skillDir = resolve(import.meta.dirname, '../../.yunpat/skills/invention-understanding')
  const sysTemplate = loadTemplate(join(skillDir, 'system-prompt.md'))
  const usrTemplate = loadTemplate(join(skillDir, 'user-prompt.md'))

  // 构建 system prompt（模板 + 知识图谱）
  const knowledgeContext = formatKnowledgeContext(kgKnowledge)
  let systemPrompt
  if (sysTemplate) {
    systemPrompt = renderTemplate(sysTemplate, {
      hasKnowledge: kgKnowledge.length > 0 ? 'true' : '',
      knowledgeContext,
      hasMethodologyTriplet: '',
      methodologyTriplet: '',
      domainGuide: '',
    })
    console.log('     模板: 动态 (invention-understanding/system-prompt.md)')
  } else {
    systemPrompt = `你是一位资深的专利代理人，专精于发明理解和专利申请文件撰写。你的核心任务是：从技术交底书中提取多组问题-特征-效果三元组。输出必须是严格的JSON格式。`
    console.log('     模板: 硬编码降级')
  }

  // 构建 user prompt
  let userPrompt
  const templateVars = {
    title: '一种绞车带轴',
    field: '机械工程—绞车技术领域',
    technicalDisclosure: disclosure,
  }
  const renderedUsr = renderTemplate(usrTemplate, templateVars)
  if (renderedUsr) {
    userPrompt = renderedUsr
    console.log('     用户模板: 动态 (invention-understanding/user-prompt.md)')
  } else {
    userPrompt = `## 发明基本信息\n发明名称：一种绞车带轴\n技术领域：机械工程—绞车技术领域\n\n## 技术交底书\n${disclosure}\n\n请提取多组技术问题-技术特征-技术效果三元组，输出JSON格式。`
    console.log('     用户模板: 硬编码降级')
  }

  // 调用 LLM
  console.log(`  🚀 调用 ${OMLX_MODEL}...`)
  const content = await callLLM({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  })

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`  ✅ 完成 (${elapsed}s)`)

  const parsed = parseJSON(content)

  // 保存
  const result = {
    ...(parsed || { rawContent: content }),
    _meta: {
      version: 'v4-kg-gemma4',
      generatedAt: new Date().toISOString(),
      model: { provider: 'oMLX-local', model: OMLX_MODEL, elapsed: elapsed + 's' },
      promptSource: sysTemplate ? 'dynamic+kg' : 'hardcoded+kg',
      knowledgeSources: kgKnowledge.map(k => `${k.source}:${k.title}`),
    },
  }

  writeFileSync(join(OUTPUT_DIR, 'invention-analysis-v4.json'), JSON.stringify(result, null, 2))
  writeFileSync(join(OUTPUT_DIR, 'v4-raw-invention.txt'), content)

  // 摘要
  if (parsed) {
    const concepts = parsed.inventionConcepts || []
    console.log(`  📊 ${concepts.length} 组三元组`)
    concepts.forEach((c, i) => console.log(`     ${i + 1}. 问题: ${(c.technicalProblem || '').substring(0, 40)}... (${(c.keyFeatures || []).length}个特征)`))
  }

  return result
}

// ─── 步骤2：对比分析报告 ──────────────────────────────

async function step2_comparisonReport(inventionJSON, comparisonAnalysis) {
  console.log('\n' + '═'.repeat(55))
  console.log('  步骤2: 对比分析报告')
  console.log('═'.repeat(55))

  const startTime = Date.now()

  // 从知识图谱获取提示词知识
  console.log('  📚 从知识图谱获取对比分析相关知识...')
  const kgKnowledge = await queryKnowledge('对比文件 创造性 新颖性 三步法 区别特征 技术启示', { topK: 6, maxChars: 3000 })
  console.log(`     获取 ${kgKnowledge.length} 条知识`)

  // 构造输入
  const concepts = inventionJSON.inventionConcepts || []
  const firstConcept = concepts[0] || {}
  const inventionUnderstanding = {
    technicalProblem: firstConcept.technicalProblem || '',
    technicalSolution: firstConcept.keyFeatures?.join('；') || '',
    technicalEffects: firstConcept.technicalEffects?.join('；') || '',
    keyFeatures: concepts.flatMap(c => c.keyFeatures || []),
  }

  // 对比文件分析
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

  // 加载动态模板
  const skillDir = resolve(import.meta.dirname, '../../.yunpat/skills/comparison-report')
  const sysTemplate = loadTemplate(join(skillDir, 'system-prompt.md'))
  const usrTemplate = loadTemplate(join(skillDir, 'user-prompt.md'))

  // 构建 system prompt
  const knowledgeContext = formatKnowledgeContext(kgKnowledge)
  let systemPrompt
  if (sysTemplate) {
    systemPrompt = renderTemplate(sysTemplate, {
      hasKnowledge: kgKnowledge.length > 0 ? 'true' : '',
      knowledgeContext,
    })
    console.log('     模板: 动态 (comparison-report/system-prompt.md)')
  } else {
    systemPrompt = `你是一位资深的专利对比分析专家，擅长分析发明与现有技术的区别，评估创造性。输出必须是严格的JSON格式。`
    console.log('     模板: 硬编码降级')
  }

  // 构建 user prompt
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

  let userPrompt
  const renderedUsr = renderTemplate(usrTemplate, templateVars)
  if (renderedUsr) {
    userPrompt = renderedUsr
    console.log('     用户模板: 动态 (comparison-report/user-prompt.md)')
  } else {
    userPrompt = `## 发明信息\n技术问题: ${templateVars.inventionProblem}\n技术方案: ${templateVars.inventionSolution}\n\n${priorArtSummary}\n\n请生成对比分析报告JSON。`
    console.log('     用户模板: 硬编码降级')
  }

  // 调用 LLM
  console.log(`  🚀 调用 ${OMLX_MODEL}...`)
  const content = await callLLM({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  })

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`  ✅ 完成 (${elapsed}s)`)

  const parsed = parseJSON(content)

  const result = {
    ...(parsed || { rawContent: content }),
    _meta: {
      version: 'v4-kg-gemma4',
      generatedAt: new Date().toISOString(),
      model: { provider: 'oMLX-local', model: OMLX_MODEL, elapsed: elapsed + 's' },
      promptSource: sysTemplate ? 'dynamic+kg' : 'hardcoded+kg',
      knowledgeSources: kgKnowledge.map(k => `${k.source}:${k.title}`),
    },
  }

  writeFileSync(join(OUTPUT_DIR, 'comparison-report-v4.json'), JSON.stringify(result, null, 2))
  writeFileSync(join(OUTPUT_DIR, 'v4-raw-comparison-report.txt'), content)

  if (parsed) {
    const cp = parsed.closest_prior_art || {}
    const df = parsed.distinct_features || []
    const inv = parsed.inventiveness || {}
    console.log(`  📊 最接近现有技术: ${cp.publication_number || '?'} (相似度 ${(cp.similarity * 100 || 0).toFixed(0)}%)`)
    console.log(`     区别特征: ${df.length} 个`)
    console.log(`     创造性评分: ${((inv.score || 0) * 100).toFixed(0)}%`)
  }

  return result
}

// ─── 步骤3：权利要求1 ────────────────────────────────

async function step3_claimsGeneration(inventionJSON, reportJSON, disclosure) {
  console.log('\n' + '═'.repeat(55))
  console.log('  步骤3: 权利要求1生成')
  console.log('═'.repeat(55))

  const startTime = Date.now()

  // 从知识图谱获取提示词知识
  console.log('  📚 从知识图谱获取权利要求撰写相关知识...')
  const kgKnowledge = await queryKnowledge('权利要求 独立权利要求 撰写 其特征在于 必要技术特征 两部分撰写法', { topK: 6, maxChars: 3000 })
  console.log(`     获取 ${kgKnowledge.length} 条知识`)

  // 构造撰写计划
  const concepts = inventionJSON.inventionConcepts || []
  const firstConcept = concepts[0] || {}
  const distinctFeatures = (reportJSON.distinct_features || []).map(f => f.feature)
  const essentialFeatures = concepts.flatMap(c => c.keyFeatures || [])
  const suggestedClaims = reportJSON.protection_scope?.independent_claims || []

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

## 必要技术特征
${essentialFeatures.map((f, i) => `${i + 1}. ${f}`).join('\n')}

## 独立权利要求建议
${suggestedClaims.join('\n')}
`.trim()

  // System prompt（ClaimGeneratorAgent 硬编码 + 知识图谱增强）
  const knowledgeContext = formatKnowledgeContext(kgKnowledge)
  const systemPrompt = `你是一位资深的专利代理师，拥有15年的专利撰写经验。

请严格按照以下原则撰写权利要求：
1. 清楚性原则：用词清楚，类型明确
2. 简要性原则：简明扼要，不描述原因理由
3. 支持性原则：以说明书为依据，不超出公开范围
4. 必要技术特征原则：只写入解决技术问题不可缺少的特征

使用两部分撰写法：
- 前序部分：发明名称 + 与现有技术共有的必要技术特征
- 特征部分："其特征在于" + 区别于现有技术的技术特征

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

  let userPrompt
  const rendered = renderTemplate(claimsTemplate, templateVars)
  if (rendered) {
    userPrompt = rendered + '\n\n请重点撰写独立权利要求1，确保包含所有必要技术特征。输出 JSON 格式。'
    console.log('     模板: 动态 (claims-generation.md)')
  } else {
    userPrompt = `基于以下发明理解，撰写权利要求：

## 撰写计划
${plan}

## 技术交底书
${disclosure}

请撰写权利要求（重点撰写独立权利要求1），输出 JSON。`
    console.log('     模板: 硬编码降级')
  }

  // 调用 LLM
  console.log(`  🚀 调用 ${OMLX_MODEL}...`)
  const content = await callLLM({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  })

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`  ✅ 完成 (${elapsed}s)`)

  const parsed = parseJSON(content)

  const result = {
    ...(parsed || { rawContent: content }),
    _meta: {
      version: 'v4-kg-gemma4',
      generatedAt: new Date().toISOString(),
      model: { provider: 'oMLX-local', model: OMLX_MODEL, elapsed: elapsed + 's' },
      promptSource: claimsTemplate ? 'dynamic+kg' : 'hardcoded+kg',
      knowledgeSources: kgKnowledge.map(k => `${k.source}:${k.title}`),
    },
  }

  writeFileSync(join(OUTPUT_DIR, 'claims-v4.json'), JSON.stringify(result, null, 2))
  writeFileSync(join(OUTPUT_DIR, 'v4-raw-claims.txt'), content)

  if (parsed) {
    const independentClaims = parsed.independent_claims || []
    console.log(`  📊 独立权利要求: ${independentClaims.length} 项`)
    for (const c of independentClaims) {
      console.log(`     === 权利要求 ${c.claim_number} ===`)
      console.log(`     ${c.full_text || ''}`)
      console.log(`     必要特征: ${(c.essential_features || []).join(', ')}`)
    }
    console.log(`     从属权利要求: ${(parsed.dependent_claims || []).length} 项`)
    console.log(`     质量检查: ${parsed.quality_check?.clarity || '?'}`)
  }

  return result
}

// ─── 主函数 ────────────────────────────────────────

async function main() {
  console.log('╔' + '═'.repeat(55) + '╗')
  console.log('║  V4 统一流程 — 知识图谱提示词 + gemma-4 本地模型        ║')
  console.log('╚' + '═'.repeat(55) + '╝')
  console.log(`\n  模型: ${OMLX_MODEL}`)
  console.log(`  知识图谱: PostgreSQL legal_world_model`)
  console.log(`  合规: CON-01 (全程本地模型)`)

  // 初始化知识图谱
  console.log('\n📚 初始化知识图谱...')
  await initKG()

  // 读取输入
  const disclosure = readFileSync(DISCLOSURE, 'utf-8')
  console.log(`\n📄 技术交底书: ${disclosure.length} 字`)

  // 复用 V3 的对比文件分析（对比文件是公开专利，无需重新分析）
  let comparisonAnalysis
  try {
    comparisonAnalysis = JSON.parse(readFileSync(V3_COMPARISON_ANALYSIS, 'utf-8'))
    console.log(`📄 对比文件分析: 复用 V3 结果 (${comparisonAnalysis.technical_analysis?.technical_solution?.key_features?.length || 0} 个关键特征)`)
  } catch {
    console.warn('⚠️ 未找到 V3 对比分析结果，请先运行 v3-real-llm-test.mjs')
    process.exit(1)
  }

  // 步骤1: 发明理解
  const inventionResult = await step1_inventionUnderstanding(disclosure)

  // 步骤2: 对比分析报告
  const reportResult = await step2_comparisonReport(inventionResult, comparisonAnalysis)

  // 步骤3: 权利要求1
  const claimsResult = await step3_claimsGeneration(inventionResult, reportResult, disclosure)

  // 总结
  console.log('\n' + '═'.repeat(55))
  console.log('  V4 全流程完成')
  console.log('═'.repeat(55))

  const invMeta = inventionResult._meta?.model
  const repMeta = reportResult._meta?.model
  const claMeta = claimsResult._meta?.model

  console.log(`\n  ⏱️ 耗时:`)
  console.log(`     发明理解: ${invMeta?.elapsed || '?'}`)
  console.log(`     对比报告: ${repMeta?.elapsed || '?'}`)
  console.log(`     权利要求: ${claMeta?.elapsed || '?'}`)

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

  console.log(`\n  📁 输出文件:`)
  console.log(`     ${join(OUTPUT_DIR, 'invention-analysis-v4.json')}`)
  console.log(`     ${join(OUTPUT_DIR, 'comparison-report-v4.json')}`)
  console.log(`     ${join(OUTPUT_DIR, 'claims-v4.json')}`)

  // 关闭数据库连接
  await pool.end()
}

main().catch(err => {
  console.error('❌ 失败:', err)
  if (pool) pool.end().catch(() => {})
  process.exit(1)
})
