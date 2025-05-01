#!/usr/bin/env node

/**
 * 通过项目 Agent 系统执行专利考试真题（v3）
 *
 * 策略：使用 OrchestratorAgent 做初始化（注册 Agent、连接知识库），
 * 然后直接从 AgentRegistry 获取特定 Agent 执行任务。
 * 这样绕过任务计划/聚合中的 Agent 兼容性问题，
 * 同时确保使用项目的 Agent + 知识库。
 */

import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')

// 动态加载项目模块
const { OrchestratorAgent } = await import(
  resolve(projectRoot, 'packages/orchestrator/dist/index.js')
)
const { EventBus, ShortTermMemory, ToolRegistry } = await import(
  resolve(projectRoot, 'packages/core/dist/index.js')
)

// ============================================================================
// 1. 读取解析后的 PDF Markdown
// ============================================================================

const mdPath = process.argv[2] || 'exam-papers（不提交git）/真题/2007_卷三_真题.md'
const fullMdPath = resolve(projectRoot, mdPath)
const fullContent = readFileSync(fullMdPath, 'utf-8')
const outDir = dirname(fullMdPath)
console.log(`\n📄 已加载: ${mdPath} (${fullContent.length} 字)\n`)

// ============================================================================
// 2. 初始化 OrchestratorAgent（用它的 Agent 注册和知识库初始化能力）
// ============================================================================

console.log('🔧 初始化核心基础设施 + Agent 注册...')

const eventBus = new EventBus()
const memory = new ShortTermMemory()
const toolRegistry = new ToolRegistry(eventBus)

const llmConfig = {
  provider: 'openai',
  model: 'deepseek-chat',
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com',
  temperature: 0.3,
  maxTokens: 8000,
}

const orchestrator = new OrchestratorAgent({
  name: 'orchestrator',
  description: '专利考试 - Agent 初始化容器',
  llmConfig,
  intentConfig: { confidenceThreshold: 0.7, maxClarifyRounds: 3 },
  planningConfig: { maxSteps: 20, defaultTimeout: 120000, enableParallel: true },
  hitlConfig: { autoConfirmThreshold: 0.9, timeout: 300000 },
  llm: { llmConfig },
  eventBus,
  memory,
  tools: toolRegistry,
})

// 等待 Agent 注册完成（异步）
await new Promise((r) => setTimeout(r, 3000))

const registry = orchestrator.getAgentRegistry()
const agentIds = registry.listIds()
console.log(`📋 已注册 Agent (${agentIds.length}个): ${agentIds.join(', ')}\n`)

if (agentIds.length === 0) {
  console.error('❌ 未注册任何 Agent')
  process.exit(1)
}

// ============================================================================
// 3. 工具函数
// ============================================================================

function saveOutput(filename, content) {
  const fp = resolve(outDir, filename)
  writeFileSync(fp, typeof content === 'string' ? content : JSON.stringify(content, null, 2), 'utf-8')
  console.log(`  已保存: ${fp}`)
}

/**
 * 安全调用 Agent，捕获错误
 */
async function safeExecute(agentId, input) {
  const agent = registry.get(agentId)
  if (!agent) {
    console.log(`  ⚠️ Agent "${agentId}" 未注册，跳过`)
    return null
  }
  try {
    console.log(`  🤖 调用 Agent: ${agentId}`)
    const result = await agent.execute(input)
    return result
  } catch (error) {
    console.log(`  ❌ Agent "${agentId}" 执行失败: ${error.message}`)
    return { error: error.message, stack: error.stack }
  }
}

// ============================================================================
// 4. 执行第一题（无效实务题）
// ============================================================================

async function runQuestion1() {
  console.log('\n' + '='.repeat(60))
  console.log('  第一题：无效实务题')
  console.log('='.repeat(60) + '\n')

  // 使用 patent-responder Agent
  const result = await safeExecute('patent-responder', {
    taskType: 'invalidation_response',
    message: `请代表专利权人张某，针对无效宣告请求撰写正式的意见陈述书。

要求：
1. 撰写一份完整的意见陈述书（格式规范、有理有据）
2. 提出修改后的权利要求书
3. 简述无效期间专利文件修改的有关规定

注意：
- 只能依据本试卷提供的事实进行答辩
- 依据专利法及其实施细则和审查指南的相关规定
- 结合修改后的权利要求书进行答辩
- 对比文件的申请日、优先权日等时间关系需要特别注意
- 对比文件3的提交时间是否超过举证期限需要分析`,
    attachments: [
      {
        id: 'exam-paper',
        filename: '2007_卷三_真题.md',
        mimeType: 'text/markdown',
        size: fullContent.length,
        data: fullContent,
      },
    ],
    // 同时传入完整内容供 Agent 使用
    documentContent: fullContent,
  })

  const output = result?.markdown || result?.content || result?.response ||
    (typeof result === 'string' ? result : JSON.stringify(result, null, 2))
  saveOutput('step3a_invalidation_response_v2.md', output)
  return output
}

// ============================================================================
// 5. 执行第二题（撰写实务题）
// ============================================================================

async function runQuestion2() {
  console.log('\n' + '='.repeat(60))
  console.log('  第二题：撰写实务题')
  console.log('='.repeat(60) + '\n')

  // 先用 invention Agent 理解发明
  const inventionResult = await safeExecute('invention', {
    taskType: 'understand_invention',
    message: `请理解以下技术交底书中的发明内容，提取关键技术特征和发明点。`,
    documentContent: fullContent,
  })

  console.log('  发明理解完成，开始撰写权利要求...')

  // 使用 patent-writer Agent 撰写权利要求
  const result = await safeExecute('patent-writer', {
    taskType: 'draft_claims',
    message: `请根据以下技术说明和对比文件，撰写发明专利申请的权利要求书。

要求：
1. 撰写完整的权利要求书（独立权利要求 + 从属权利要求）
2. 权利要求应当符合专利法、专利法实施细则及审查指南的规定
3. 保护范围应当尽可能宽，最大限度维护申请人利益
4. 如果包含两项以上独立权利要求，简述合案申请理由
5. 如果需要分案申请，说明理由并撰写分案独立权利要求`,
    attachments: [
      {
        id: 'exam-paper',
        filename: '2007_卷三_真题.md',
        mimeType: 'text/markdown',
        size: fullContent.length,
        data: fullContent,
      },
    ],
    documentContent: fullContent,
    // 传入发明理解结果
    inventionUnderstanding: inventionResult,
  })

  const output = result?.markdown || result?.content || result?.response ||
    (typeof result === 'string' ? result : JSON.stringify(result, null, 2))
  saveOutput('step3b_claims_draft_v2.md', output)
  return output
}

// ============================================================================
// 6. 质量检查
// ============================================================================

async function runQualityCheck(q1Output, q2Output) {
  console.log('\n' + '='.repeat(60))
  console.log('  质量检查')
  console.log('='.repeat(60) + '\n')

  const result = await safeExecute('quality', {
    taskType: 'quality_check',
    message: `请对以下两道专利代理实务考试题的答案进行质量检查和评分。

## 第一题答案（无效实务题）
${typeof q1Output === 'string' ? q1Output.substring(0, 4000) : '（无输出）'}

---

## 第二题答案（撰写实务题）
${typeof q2Output === 'string' ? q2Output.substring(0, 4000) : '(无输出)'}

---

## 检查维度
1. 格式合规性（1-10）
2. 法律依据正确性（1-10）
3. 逻辑严谨性（1-10）
4. 技术准确性（1-10）
5. 保护范围合理性（1-10）
6. 遗漏检查（1-10）

请逐题评析。`,
    documentContent: fullContent.substring(0, 3000),
  })

  const output = result?.markdown || result?.content || result?.response ||
    (typeof result === 'string' ? result : JSON.stringify(result, null, 2))
  saveOutput('step4_quality_check_v2.md', output)
}

// ============================================================================
// 7. 主流程
// ============================================================================

async function main() {
  try {
    const q1Output = await runQuestion1()
    const q2Output = await runQuestion2()
    await runQualityCheck(q1Output, q2Output)

    console.log('\n' + '='.repeat(60))
    console.log('  任务执行完毕')
    console.log('='.repeat(60))
  } catch (error) {
    console.error('\n❌ 执行失败:', error.message || error)
    console.error(error.stack)
    process.exit(1)
  }
}

main()
