/**
 * V3 真实 LLM 测试脚本
 *
 * 发明理解 → oMLX 本地模型（CON-01 保密合规）
 * 对比文件分析 → DeepSeek 云端模型（无保密限制）
 *
 * 用法：node --experimental-strip-types 测试/scripts/v3-real-llm-test.mjs
 *   或者 npx tsx 测试/scripts/v3-real-llm-test.ts
 */

import { resolve, join } from 'path'
import { writeFileSync, readFileSync as _readFileSync } from 'fs'

// 手动加载 .env
function loadEnv(filePath) {
  try {
    const content = _readFileSync(filePath, 'utf-8')
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
const DISCLOSURE_PATH = resolve(import.meta.dirname, '../yunpat/绞车带轴/交底材料.txt')
const COMPARISON_PATH = '/tmp/comparison_cleaned.txt'

// ─── 简易 LLM 客户端（OpenAI 兼容格式） ─────────────

async function callLLM({ baseURL, apiKey, model, messages, temperature = 0.3, maxTokens = 4096 }) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 300000) // 5分钟超时

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

// ─── 提示词构建 ────────────────────────────────────

// 读取动态模板（如果存在）
async function loadTemplate(templatePath) {
  try {
    const { readFileSync } = await import('fs')
    let content = readFileSync(templatePath, 'utf-8')
    // 去掉 YAML frontmatter
    content = content.replace(/^---[\s\S]*?---\n/, '')
    return content
  } catch {
    return null
  }
}

function renderTemplate(template, vars) {
  if (!template) return null
  let result = template
  // 处理 {{#if var}} ... {{/if}}
  result = result.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, key, content) => {
    return vars[key] ? content : ''
  })
  // 处理 {{var}}
  result = result.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || '')
  return result
}

// ─── 发明理解分析 ──────────────────────────────────

async function runInventionAnalysis(disclosure) {
  console.log('\n🔬 [V3] 发明理解分析 → oMLX 本地模型 (Qwen3.5-27B)')

  const omlxBaseURL = process.env.OMLX_BASE_URL || 'http://localhost:8009/v1'
  const omlxApiKey = process.env.OMLX_API_KEY || ''
  const omlxModel = 'Qwen3.5-27B-Claude-4.6-Opus-Distilled-MLX-4bit'

  // 尝试加载动态模板
  const skillDir = resolve(import.meta.dirname, '../../.yunpat/skills/invention-understanding')
  const systemTemplate = await loadTemplate(join(skillDir, 'system-prompt.md'))
  const userTemplate = await loadTemplate(join(skillDir, 'user-prompt.md'))

  const templateVars = {
    title: '一种绞车带轴',
    field: '机械工程—绞车技术领域',
    technicalDisclosure: disclosure.substring(0, 3000),
    hasPriorArt: 'true',
    priorArt: '现有的绞车通常由支架、带轴和捆绑带组成...现有绞车中的带轴就不能适用于上述的各种捆绑带',
    hasDrawings: 'true',
    drawings: '图1：绞车主视结构示意图\n图2：绞车侧视结构示意图\n1、支架；2、棘轮；3、棘爪；4、本体；4a、通孔一；4b、通孔二；4c、连接孔；5、定位柱',
    hasSimilarCases: '',
    similarCases: '',
    hasCommonErrors: '',
    commonErrors: '',
    domainGuide: '机械工程领域：技术特征应精确描述形状、位置、连接关系、配合方式；技术效果尽可能量化；注意区分"功能"与"效果"',
  }

  const systemPrompt = renderTemplate(systemTemplate, templateVars)
    || `你是一位资深的专利代理人，专精于发明理解和专利申请文件撰写。
你的核心任务是：从技术交底书中提取多组问题-特征-效果三元组。
核心原则：
1. 多组三元组: 提取多组问题-特征-效果，覆盖发明的多个创新点
2. 逻辑一致性: 问题-特征-效果必须一一对应
3. 具体性: 技术特征必须具体，技术效果必须可量化或可验证
4. 对比性: 技术效果必须与现有技术有明确对比
5. 问题纯度: 技术问题不应包含解决手段
输出必须是严格的JSON格式。`

  const userPrompt = renderTemplate(userTemplate, templateVars)
    || `## 发明基本信息\n发明名称：一种绞车带轴\n技术领域：机械工程\n\n## 技术交底书\n${disclosure.substring(0, 3000)}\n\n请提取多组问题-特征-效果三元组，输出JSON格式。`

  console.log(`   模板来源: ${systemTemplate ? 'SkillLoader 动态模板' : '硬编码降级'}`)
  console.log(`   模型: ${omlxModel}`)
  console.log(`   端点: ${omlxBaseURL}`)

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
    console.warn('   ⚠️ JSON 解析失败，保存原始文本')
  }

  return { content, parsed, model: omlxModel, elapsed, promptSource: systemTemplate ? 'dynamic' : 'hardcoded' }
}

// ─── 对比文件分析 ──────────────────────────────────

async function runComparisonAnalysis(comparisonText) {
  console.log('\n🔬 [V3] 对比文件分析 → DeepSeek 云端模型 (deepseek-v4-flash)')

  const deepseekBaseURL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'
  const deepseekApiKey = process.env.DEEPSEEK_API_KEY || ''
  const deepseekModel = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash'

  // 尝试加载动态模板
  const skillDir = resolve(import.meta.dirname, '../../.yunpat/skills/prior-art-analysis')
  const systemTemplate = await loadTemplate(join(skillDir, 'system-prompt.md'))
  const userTemplate = await loadTemplate(join(skillDir, 'user-prompt.md'))

  const templateVars = {
    documentType: '专利文献',
    analysisDepth: '2',
    hasKnowledge: '',
    knowledgeContext: '',
    docType: '专利文献',
    docTitle: '车用离合转动式轴绞车捆绑器',
    docContent: comparisonText.substring(0, 3000),
    publicationNumber: 'CN200620040894',
    applicant: '上海刚立机械工具有限公司',
    inventors: '刘滢',
    publicationDate: '2006-04-07',
    maxLength: '3000',
  }

  const systemPrompt = renderTemplate(systemTemplate, templateVars)
    || `你是一位资深的技术分析专家，擅长从专利文献中提取和深度分析技术信息。
你的任务：
1. 分析文档中涉及的技术问题（主要问题 + 子问题 + 严重性）
2. 提取技术方案的核心、关键特征（按必要性分类）和实施方式
3. 识别并量化技术效果（包括具体指标和改进幅度）
分析深度级别：2（深入分析）
输出必须是严格的JSON格式。`

  const userPrompt = renderTemplate(userTemplate, templateVars)
    || `## 专利文献信息\n标题: 车用离合转动式轴绞车捆绑器\n公开号: CN200620040894\n\n## 内容\n${comparisonText.substring(0, 3000)}\n\n请按JSON格式输出分析结果。`

  console.log(`   模板来源: ${systemTemplate ? 'SkillLoader 动态模板' : '硬编码降级'}`)
  console.log(`   模型: ${deepseekModel}`)
  console.log(`   端点: ${deepseekBaseURL}`)

  const startTime = Date.now()

  const content = await callLLM({
    baseURL: deepseekBaseURL,
    apiKey: deepseekApiKey,
    model: deepseekModel,
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
    console.warn('   ⚠️ JSON 解析失败，保存原始文本')
  }

  return { content, parsed, model: deepseekModel, elapsed, promptSource: systemTemplate ? 'dynamic' : 'hardcoded' }
}

// ─── 主函数 ────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════')
  console.log('  V3 真实 LLM 测试')
  console.log('  发明理解 → oMLX 本地 (CON-01 保密合规)')
  console.log('  对比分析 → DeepSeek 云端 (无保密限制)')
  console.log('═══════════════════════════════════════════════════')

  // 读取输入
  const { readFileSync } = await import('fs')
  let disclosure = ''
  try {
    disclosure = readFileSync(DISCLOSURE_PATH, 'utf-8')
  } catch {
    console.log('⚠️ 交底材料.txt 不存在，尝试从 .doc 转换...')
    const { execSync } = await import('child_process')
    execSync(`textutil -convert txt -output "${DISCLOSURE_PATH}" "${resolve(import.meta.dirname, '../yunpat/绞车带轴/交底材料.doc')}"`)
    disclosure = readFileSync(DISCLOSURE_PATH, 'utf-8')
  }

  let comparisonText = ''
  try {
    comparisonText = readFileSync(COMPARISON_PATH, 'utf-8')
  } catch {
    console.error('❌ 对比文件清洗文本不存在:', COMPARISON_PATH)
    process.exit(1)
  }

  console.log(`\n📄 技术交底书: ${disclosure.length} 字符`)
  console.log(`📄 对比文件: ${comparisonText.length} 字符`)

  // 并行执行两个分析
  console.log('\n🚀 开始并行分析...\n')

  const [inventionResult, comparisonResult] = await Promise.all([
    runInventionAnalysis(disclosure),
    runComparisonAnalysis(comparisonText),
  ])

  // ─── 保存结果 ─────────────────────────────────────

  const meta = {
    version: 'v3-real-llm',
    generatedAt: new Date().toISOString(),
    testType: 'real-llm-call',
    models: {
      invention: { provider: 'oMLX-local', model: inventionResult.model, elapsed: inventionResult.elapsed + 's' },
      comparison: { provider: 'DeepSeek-cloud', model: comparisonResult.model, elapsed: comparisonResult.elapsed + 's' },
    },
  }

  // 发明理解 JSON
  const inventionJSON = {
    ...(inventionResult.parsed || { rawContent: inventionResult.content }),
    _meta: { ...meta, promptSource: inventionResult.promptSource, agent: 'InventionUnderstandingAgent' },
  }
  writeFileSync(join(OUTPUT_DIR, 'invention-analysis-v3.json'), JSON.stringify(inventionJSON, null, 2))
  console.log(`\n💾 发明理解: ${join(OUTPUT_DIR, 'invention-analysis-v3.json')}`)

  // 对比文件 JSON
  const comparisonJSON = {
    ...(comparisonResult.parsed || { rawContent: comparisonResult.content }),
    _meta: { ...meta, promptSource: comparisonResult.promptSource, agent: 'PriorArtAnalyzerAgent' },
  }
  writeFileSync(join(OUTPUT_DIR, 'comparison-analysis-v3.json'), JSON.stringify(comparisonJSON, null, 2))
  console.log(`💾 对比分析: ${join(OUTPUT_DIR, 'comparison-analysis-v3.json')}`)

  // 保存原始 LLM 输出（用于调试）
  writeFileSync(join(OUTPUT_DIR, 'v3-raw-invention.txt'), inventionResult.content)
  writeFileSync(join(OUTPUT_DIR, 'v3-raw-comparison.txt'), comparisonResult.content)

  console.log(`\n✅ V3 真实 LLM 测试完成!`)
  console.log(`   发明理解: ${inventionResult.model} (${inventionResult.elapsed}s, ${inventionResult.promptSource})`)
  console.log(`   对比分析: ${comparisonResult.model} (${comparisonResult.elapsed}s, ${comparisonResult.promptSource})`)
}

main().catch((err) => {
  console.error('❌ 测试失败:', err)
  process.exit(1)
})
