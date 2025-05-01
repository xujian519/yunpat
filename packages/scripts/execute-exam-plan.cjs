#!/usr/bin/env node

/**
 * 执行中枢智能体规划的任务计划
 * Step 2: 意图分析 → Step 3: 执行两道题 → Step 4: 质量检查
 */

const fs = require('fs')
const path = require('path')
const OpenAI = require(path.resolve(
  __dirname,
  '../node_modules/.pnpm/openai@4.104.0_ws@8.20.0_zod@3.25.76/node_modules/openai'
))

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com',
})
const MODEL = 'deepseek-chat'

const mdPath = process.argv[2] || 'exam-papers（不提交git）/真题/2007_卷三_真题.md'
const outDir = path.dirname(path.resolve(mdPath))
const fullContent = fs.readFileSync(path.resolve(mdPath), 'utf-8')

// 辅助: 调用 LLM
async function callLLM(system, user, label) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`  ${label}`)
  console.log(`${'='.repeat(60)}\n`)

  const res = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.3,
    max_tokens: 8000,
  })

  const content = res.choices[0].message.content
  const usage = res.usage
  console.log(`Token 用量: input=${usage.prompt_tokens}, output=${usage.completion_tokens}`)
  return content
}

// 保存输出
function saveOutput(filename, content) {
  const fp = path.join(outDir, filename)
  fs.writeFileSync(fp, content, 'utf-8')
  console.log(`已保存: ${fp}`)
}

async function main() {
  try {
    // ========================================================================
    // Step 2: 意图分析 - 拆解两道考题
    // ========================================================================
    console.log('\n🔍 Step 2: 意图分析 - 拆解考题要求\n')

    const step2Result = await callLLM(
      `你是一位资深专利代理实务考试分析专家。请仔细阅读以下专利代理实务考试真题，分析每道题的具体要求、涉及的法律条款、以及答题要点。

输出格式：
## 第一题分析（无效实务题）
- 案件背景：...
- 答题要求：（1）（2）（3）分别列出
- 涉及法律条款：...
- 关键事实：...
- 答题策略：...

## 第二题分析（撰写实务题）
- 案件背景：...
- 答题要求：...
- 涉及法律条款：...
- 现有技术分析：...
- 答题策略：...`,
      `以下是考试真题内容：\n\n${fullContent.substring(0, 6000)}`,
      'Step 2: 意图分析'
    )
    saveOutput('step2_intent_analysis.md', step2Result)

    // ========================================================================
    // Step 3a: 执行第一题 - 无效实务题
    // ========================================================================
    console.log('\n📝 Step 3a: 执行第一题 - 无效实务题\n')

    const step3aResult = await callLLM(
      `你是一位资深专利代理人，现在需要代表专利权人张某，针对无效宣告请求撰写正式的意见陈述书。

要求：
1. 撰写一份完整的意见陈述书（格式规范、有理有据）
2. 提出修改后的权利要求书
3. 简述无效期间专利文件修改的有关规定

注意：
- 你只能依据本试卷提供的事实进行答辩
- 应当依据专利法及其实施细则和审查指南的相关规定
- 结合修改后的权利要求书进行答辩
- 对比文件的申请日、优先权日等时间关系需要特别注意
- 对比文件3的提交时间是否超过举证期限需要分析`,
      `以下是完整的考试材料（包括专利文件、无效请求书、对比文件等）：\n\n${fullContent}`,
      'Step 3a: 第一题 - 无效实务题'
    )
    saveOutput('step3a_invalidation_response.md', step3aResult)

    // ========================================================================
    // Step 3b: 执行第二题 - 撰写实务题（与 3a 并行概念上可行，但串行执行）
    // ========================================================================
    console.log('\n📝 Step 3b: 执行第二题 - 撰写实务题\n')

    const step3bResult = await callLLM(
      `你是一位资深专利代理人，现在需要根据客户提供的技术说明和对比文件，为客户撰写发明专利申请的权利要求书。

要求：
1. 撰写完整的权利要求书（独立权利要求 + 从属权利要求）
2. 权利要求应当符合专利法、专利法实施细则及审查指南的规定
3. 保护范围应当尽可能宽，最大限度维护申请人利益
4. 如果包含两项以上独立权利要求，简述合案申请理由
5. 如果需要分案申请，说明理由并撰写分案独立权利要求

注意：
- 必须考虑对比文件1-3所反映的现有技术
- 权利要求要有合理的层次结构
- 注意区分已知特征和发明点`,
      `以下是技术说明和对比文件：\n\n${fullContent}`,
      'Step 3b: 第二题 - 撰写实务题'
    )
    saveOutput('step3b_claims_draft.md', step3bResult)

    // ========================================================================
    // Step 4: 质量检查
    // ========================================================================
    console.log('\n✅ Step 4: 质量检查\n')

    const step4Result = await callLLM(
      `你是一位专利代理实务考试的阅卷专家。请对以下两道题的答案进行质量检查和评分。

检查维度：
1. **格式合规性**：答案格式是否符合正式专利文件要求
2. **法律依据正确性**：引用的法律条款是否正确、完整
3. **逻辑严谨性**：论证是否逻辑清晰、有理有据
4. **技术准确性**：对技术方案的理解和描述是否准确
5. **保护范围合理性**：权利要求的保护范围是否合理
6. **遗漏检查**：是否有遗漏的答题要点

请逐题评析，给出：
- 各维度评分（1-10）
- 具体问题指出
- 改进建议
- 总体评价`,
      `## 参考答案（来自真题文件）

${fullContent.includes('范文') ? fullContent.substring(fullContent.indexOf('一、无效实务题')) : '（参考答案在原文中）'}

---

## 第一题答案（AI生成）
${step3aResult}

---

## 第二题答案（AI生成）
${step3bResult}`,
      'Step 4: 质量检查'
    )
    saveOutput('step4_quality_check.md', step4Result)

    // ========================================================================
    // 汇总
    // ========================================================================
    console.log('\n' + '='.repeat(60))
    console.log('  任务执行完毕')
    console.log('='.repeat(60))
    console.log(`\n输出文件:`)
    console.log(`  step2_intent_analysis.md  - 意图分析`)
    console.log(`  step3a_invalidation_response.md - 第一题答案`)
    console.log(`  step3b_claims_draft.md - 第二题答案`)
    console.log(`  step4_quality_check.md - 质量检查`)

  } catch (error) {
    console.error('执行失败:', error.message || error)
    process.exit(1)
  }
}

// 修正函数名 typo

main()
