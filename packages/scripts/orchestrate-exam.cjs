#!/usr/bin/env node

/**
 * 使用项目 OrchestratorAgent 的意图识别和任务规划逻辑
 * 处理解析后的 PDF 文件
 *
 * 流程: PDF Markdown → 意图识别(Call 1) → 任务规划(Call 2) → 输出计划
 */

const fs = require('fs')
const path = require('path')
const OpenAI = require(path.resolve(
  __dirname,
  '../node_modules/.pnpm/openai@4.104.0_ws@8.20.0_zod@3.25.76/node_modules/openai'
))

// ============================================================================
// 1. 读取解析后的 PDF Markdown
// ============================================================================

const mdPath = process.argv[2]
if (!mdPath) {
  console.error('用法: node scripts/orchestrate-exam.cjs <pdf解析后的md文件路径>')
  process.exit(1)
}

if (!fs.existsSync(mdPath)) {
  console.error(`文件不存在: ${mdPath}`)
  process.exit(1)
}

const markdownContent = fs.readFileSync(path.resolve(mdPath), 'utf-8')
console.log(`\n📄 已加载: ${path.basename(mdPath)} (${markdownContent.length} 字)\n`)

// ============================================================================
// 2. 初始化 DeepSeek LLM 客户端（OpenAI 兼容）
// ============================================================================

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com',
})

const MODEL = 'deepseek-chat'

// ============================================================================
// 3. 意图识别 (Call 1) - 复用项目 IntentRecognizer 的 Prompt 逻辑
// ============================================================================

// 来自 PatentIntentConfig 的意图类型定义
const intentCategories = [
  { intentId: 'DRAFT_FULL', label: '完整专利撰写', description: '用户要求撰写完整的专利申请文件', keywords: ['撰写专利', '写专利', '申请专利', '完整', '全套'], complexity: 'complex' },
  { intentId: 'DRAFT_CLAIMS', label: '仅撰写/修改权利要求', description: '明确提到权利要求相关的撰写或修改', keywords: ['权利要求', '权要', 'Claims', '保护范围'], complexity: 'simple' },
  { intentId: 'DRAFT_SPEC', label: '仅撰写说明书', description: '明确提到说明书相关的撰写', keywords: ['说明书', '具体实施方式', '背景技术', '技术方案'], complexity: 'simple' },
  { intentId: 'RESPOND_OA', label: '审查意见答复', description: '提到审查意见或答复相关的需求', keywords: ['审查意见', 'OA', '答复', '审查员', '驳回'], complexity: 'complex' },
  { intentId: 'SEARCH', label: '现有技术检索', description: '明确要求检索或查找相关技术', keywords: ['检索', '搜索', '查新', '现有技术', '相关技术'], complexity: 'simple' },
  { intentId: 'ANALYZE_PORTFOLIO', label: '专利组合分析', description: '分析多个专利的组合情况', keywords: ['专利组合', '专利分析', '技术布局', '专利地图'], complexity: 'complex' },
  { intentId: 'CODING', label: '编程开发任务', description: '用户要求写代码、开发功能等', keywords: ['写代码', '编程', '开发', '写个函数', '调试'], complexity: 'simple' },
  { intentId: 'MULTI_INTENT', label: '多意图', description: '一条消息包含多个不同的任务需求', keywords: [], complexity: 'complex', isSystemIntent: true },
  { intentId: 'CLARIFY', label: '需要追问', description: '意图不明确', keywords: [], complexity: 'simple', isSystemIntent: true },
  { intentId: 'CHITCHAT', label: '闲聊', description: '非业务相关的对话', keywords: [], complexity: 'simple', isSystemIntent: true },
]

const businessCategories = intentCategories.filter((c) => !c.isSystemIntent)
const systemCategories = intentCategories.filter((c) => c.isSystemIntent)

const intentList = [
  ...businessCategories.map(
    (c, i) =>
      `${i + 1}. **${c.intentId}** - ${c.label}\n   - ${c.description}\n   - 关键词：${c.keywords.map((k) => `"${k}"`).join('、') || '（无特定关键词）'}\n   - 复杂度：${c.complexity}`
  ),
  ...systemCategories.map(
    (c) => `**${c.intentId}** - ${c.label}\n   - ${c.description}\n   - 复杂度：${c.complexity}`
  ),
].join('\n\n')

// 来自 IntentRecognizer.getSystemPrompt()
const intentSystemPrompt = `你是 专利管理 平台的任务调度器的意图分类模块。
专利代理AI助手，支持专利撰写、审查答复、检索分析等任务

你的唯一职责是理解用户意图并将其分类为标准任务类型。

## 严格约束
- 你不具备任何业务领域知识，不对业务内容做任何判断
- 你不向用户提供专业建议，不解释业务概念
- 你只输出 JSON，不输出任何额外的文字说明
- 如果意图不明确，分类为 CLARIFY，不要猜测

## 可用意图类型

${intentList}

## 置信度评估标准
- **≥0.9**：非常确定，直接执行
- **0.7-0.9**：较确定，正常执行
- **<0.7**：不确定，进入 CLARIFY 流程

## 关键信息提取
对于每个意图，提取以下信息：
- title: 主题名称（如能提取）
- field: 领域（如能提取）
- hasAttachment: 是否有附件
- urgency: 紧急程度（normal/urgent）
- keywords: 关键词列表（3-10个）

## 输出格式
严格按照 JSON Schema 输出，不要添加任何额外的文字说明。`

// 截取 PDF 内容（避免超长）
const contentPreview = markdownContent.substring(0, 4000)
const intentUserPrompt = `用户消息：我有一份专利代理实务考试真题PDF文件，请帮我分析并处理该文件内容。

以下是PDF文件的解析内容：

${contentPreview}

---

请识别我这份文件对应的任务意图。`

async function recognizeIntent() {
  console.log('🔍 Call 1: 意图识别中...\n')

  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: intentSystemPrompt },
      { role: 'user', content: intentUserPrompt },
    ],
    temperature: 0.3,
    response_format: { type: 'json_object' },
  })

  const result = JSON.parse(response.choices[0].message.content)
  return result
}

// ============================================================================
// 4. 任务规划 (Call 2) - 复用项目 TaskPlanner 的 Prompt 逻辑
// ============================================================================

const planningSystemPrompt = `你是一个AI任务规划专家。

## 你的角色
基于识别出的用户意图，生成可执行的多步骤任务计划。

## 任务规划原则

1. **依赖关系明确**
   - 必须明确标注步骤之间的依赖关系
   - 并行步骤之间不能有依赖

2. **超时合理设置**
   - 简单操作：10-30s
   - 复杂操作：30-60s
   - 重度操作：60-120s

3. **HITL检查点**
   - 关键决策点必须设置HITL
   - 重要修改确认

4. **错误处理**
   - 关键步骤设置重试

5. **并行优化**
   - 无依赖的步骤必须并行

## 输出格式
严格按照JSON Schema输出，包含以下字段：
{
  "planId": "plan-xxx",
  "intent": "INTENT_TYPE",
  "estimatedMinutes": 数字,
  "steps": [
    {
      "stepId": "step-1",
      "agentId": "agent名称",
      "layer": "domain|execution",
      "parallel": boolean,
      "dependsOn": ["step-id"],
      "timeout": 毫秒,
      "input": {},
      "hitl": boolean,
      "hitlDescription": "描述",
      "retryOnFailure": boolean,
      "maxRetries": 数字
    }
  ],
  "hitlCheckpoints": ["step-id"],
  "metadata": {
    "createdAt": "ISO日期",
    "parallelizable": boolean,
    "estimatedCost": 数字
  }
}`

async function generatePlan(intentResult) {
  console.log('📋 Call 2: 任务规划中...\n')

  const planningUserPrompt = `用户意图：${intentResult.intent}\n置信度：${intentResult.confidence}\n提取信息：${JSON.stringify(intentResult.extracted)}\n\n用户上传了一份专利代理实务考试真题PDF文件，文件包含：
1. 第一题：无效实务题（针对实用新型专利的无效宣告请求，需要撰写意见陈述书、修改权利要求书）
2. 第二题：撰写实务题（根据技术说明和对比文件，撰写发明专利申请的权利要求书）

请为该意图生成详细的任务执行计划。`

  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: planningSystemPrompt },
      { role: 'user', content: planningUserPrompt },
    ],
    temperature: 0.3,
    response_format: { type: 'json_object' },
  })

  const result = JSON.parse(response.choices[0].message.content)
  return result
}

// ============================================================================
// 5. 主流程
// ============================================================================

async function main() {
  try {
    // Call 1: 意图识别
    const intentResult = await recognizeIntent()

    console.log('═══════════════════════════════════════')
    console.log('  意图识别结果 (Call 1)')
    console.log('═══════════════════════════════════════')
    console.log(`  意图类型: ${intentResult.intent}`)
    console.log(`  置信度:   ${(intentResult.confidence * 100).toFixed(1)}%`)
    console.log(`  复杂度:   ${intentResult.complexity}`)
    if (intentResult.extracted) {
      console.log(`  标题:     ${intentResult.extracted.title || '(未提取)'}`)
      console.log(`  领域:     ${intentResult.extracted.field || '(未提取)'}`)
      console.log(`  关键词:   ${(intentResult.extracted.keywords || []).join('、')}`)
    }
    if (intentResult.clarifyQuestion) {
      console.log(`  追问:     ${intentResult.clarifyQuestion}`)
    }
    console.log('═══════════════════════════════════════\n')

    // Call 2: 任务规划（仅复杂意图）
    if (intentResult.complexity === 'complex') {
      const plan = await generatePlan(intentResult)

      console.log('═══════════════════════════════════════')
      console.log('  任务规划 (Call 2)')
      console.log('═══════════════════════════════════════')
      console.log(`  计划ID:     ${plan.planId}`)
      console.log(`  意图:       ${plan.intent}`)
      console.log(`  预计耗时:   ${plan.estimatedMinutes} 分钟`)
      console.log(`  可并行:     ${plan.metadata?.parallelizable ? '是' : '否'}`)
      console.log(`  预估成本:   $${plan.metadata?.estimatedCost || '?'}`)
      console.log('───────────────────────────────────────')
      console.log('  执行步骤:\n')

      const steps = plan.steps || []
      // 构建步骤依赖图（拓扑排序显示）
      const maxDeps = Math.max(...steps.map((s) => (s.dependsOn || []).length), 0)

      // 按层级显示
      const displayed = new Set()
      let round = 0
      while (displayed.size < steps.length && round < steps.length) {
        const ready = steps.filter(
          (s) =>
            !displayed.has(s.stepId) &&
            (s.dependsOn || []).every((d) => displayed.has(d))
        )

        if (ready.length === 0) break

        const parallelLabel = ready.length > 1 ? ` (可并行 x${ready.length})` : ''
        console.log(`  ── 第 ${round + 1} 阶段${parallelLabel} ──`)

        for (const step of ready) {
          const hitlIcon = step.hitl ? '🔒' : '  '
          const layerLabel = step.layer === 'domain' ? '[领域]' : '[执行]'
          console.log(`  ${hitlIcon} ${step.stepId}`)
          console.log(`     Agent: ${step.agentId} ${layerLabel}`)
          console.log(`     超时: ${step.timeout / 1000}s | 重试: ${step.retryOnFailure ? step.maxRetries + '次' : '无'}`)
          if (step.hitlDescription) {
            console.log(`     HITL: ${step.hitlDescription}`)
          }
          if (step.input && Object.keys(step.input).length > 0) {
            console.log(`     输入: ${JSON.stringify(step.input)}`)
          }
          displayed.add(step.stepId)
        }
        console.log('')
        round++
      }

      if (plan.hitlCheckpoints && plan.hitlCheckpoints.length > 0) {
        console.log('  🔒 HITL 检查点:')
        plan.hitlCheckpoints.forEach((cp) => console.log(`     - ${cp}`))
      }

      console.log('═══════════════════════════════════════')

      // 保存结果
      const outputPath = path.join(path.dirname(path.resolve(mdPath)), 'orchestrator_result.json')
      fs.writeFileSync(outputPath, JSON.stringify({ intentResult, plan }, null, 2), 'utf-8')
      console.log(`\n💾 完整结果已保存: ${outputPath}`)
    } else {
      console.log('  (简单意图，无需生成复杂计划，将直接路由到对应 Agent)\n')
    }
  } catch (error) {
    console.error('执行失败:', error.message || error)
    process.exit(1)
  }
}

main()
