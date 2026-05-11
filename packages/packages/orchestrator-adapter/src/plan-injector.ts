/**
 * @file 任务规划注入器
 * @description 调用 TaskPlanner 生成任务规划并写入 .yunpat/current-plan.md
 *
 * 用途：intent-hook 识别专利任务后，生成详细的执行计划
 */

import { TaskPlanner, LLMClient, PatentIntentConfig } from '@yunpat/orchestrator'
import type { TaskPlan } from '@yunpat/orchestrator'
import fs from 'fs'
import path from 'path'
import { homedir } from 'os'
import { log, hasLLMApiKey } from './hook-utils.js'

/**
 * 将 TaskPlan 转换为 Markdown 格式
 */
function taskPlanToMarkdown(plan: TaskPlan): string {
  const lines: string[] = []

  lines.push(`# 任务执行计划`)
  lines.push(``)
  lines.push(`**计划 ID**: ${plan.planId}`)
  lines.push(`**意图类型**: ${plan.intent}`)
  lines.push(`**预计耗时**: ${plan.estimatedMinutes} 分钟`)
  lines.push(`**创建时间**: ${plan.metadata.createdAt.toISOString()}`)
  lines.push(`**是否可并行**: ${plan.metadata.parallelizable ? '是' : '否'}`)
  if (plan.metadata.estimatedCost) {
    lines.push(`**预计成本**: $${plan.metadata.estimatedCost.toFixed(2)}`)
  }
  lines.push(``)

  lines.push(`## 任务步骤`)
  lines.push(``)

  plan.steps.forEach((step: TaskPlan['steps'][number], index: number) => {
    lines.push(`### 步骤 ${index + 1}: ${step.stepId}`)
    lines.push(``)
    lines.push(`- **目标 Agent**: ${step.agentId} (${step.layer} 层)`)
    lines.push(`- **超时时间**: ${step.timeout}ms`)
    lines.push(`- **并行执行**: ${step.parallel ? '是' : '否'}`)
    lines.push(`- **依赖步骤**: ${step.dependsOn.length > 0 ? step.dependsOn.join(', ') : '无'}`)
    lines.push(
      `- **需要 HITL**: ${step.hitl ? '是' : step.hitlDescription ? `是 (${step.hitlDescription})` : '否'}`
    )
    lines.push(`- **失败重试**: ${step.retryOnFailure ? `是 (最多${step.maxRetries}次)` : '否'}`)
    lines.push(``)
    lines.push(`**输入参数**:`)
    lines.push(`\`\`\`json`)
    lines.push(JSON.stringify(step.input, null, 2))
    lines.push(`\`\`\``)
    lines.push(``)
  })

  if (plan.hitlCheckpoints.length > 0) {
    lines.push(`## HITL 检查点`)
    lines.push(``)
    plan.hitlCheckpoints.forEach((checkpoint: string) => {
      lines.push(`- ${checkpoint}`)
    })
    lines.push(``)
  }

  return lines.join('\n')
}

/**
 * 生成任务规划并写入文件
 *
 * @param taskDescription 任务描述（如"撰写电池专利"）
 * @param sessionId 会话 ID（可选）
 * @returns 生成的计划文件路径
 */
export async function generatePlan(taskDescription: string, sessionId?: string): Promise<string> {
  if (!hasLLMApiKey()) {
    log('plan-injector', '无 LLM API Key，跳过任务规划生成')
    return ''
  }

  try {
    log('plan-injector', `开始生成任务规划: ${taskDescription}`)

    // 初始化 LLM Client
    const llmClient = new LLMClient({
      provider: process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'openai',
      model: process.env.ANTHROPIC_API_KEY ? 'claude-3-5-sonnet-20241022' : 'deepseek-chat',
      apiKey: process.env.ANTHROPIC_API_KEY || process.env.DEEPSEEK_API_KEY,
    })

    // 初始化 TaskPlanner
    const planner = new TaskPlanner(
      llmClient,
      20, // maxSteps
      30000, // defaultTimeout
      true, // enableParallel
      undefined, // agentRegistry
      PatentIntentConfig // domainConfig
    )

    // 构造虚拟的意图识别结果
    const mockIntentResult = {
      intent: 'DRAFT_FULL' as const,
      confidence: 0.8,
      complexity: 'complex' as const,
      extracted: {
        title: taskDescription,
        hasAttachment: false,
        urgency: 'normal' as const,
        keywords: [taskDescription],
      },
    }

    // 生成计划
    const plan = await planner.generatePlan(mockIntentResult, sessionId)

    log('plan-injector', `任务规划生成成功: ${plan.planId}, ${plan.steps.length} 个步骤`)

    // 确保 .yunpat 目录存在
    const yunpatDir = path.join(homedir(), '.yunpat')
    if (!fs.existsSync(yunpatDir)) {
      fs.mkdirSync(yunpatDir, { recursive: true })
    }

    // 写入 current-plan.md
    const planFilePath = path.join(yunpatDir, 'current-plan.md')
    const markdown = taskPlanToMarkdown(plan)
    fs.writeFileSync(planFilePath, markdown, 'utf-8')

    log('plan-injector', `任务规划已写入: ${planFilePath}`)

    return planFilePath
  } catch (err) {
    log('plan-injector', `任务规划生成失败: ${err instanceof Error ? err.message : String(err)}`)
    throw err
  }
}

/**
 * CLI 入口点（用于手动测试）
 */
async function main(): Promise<void> {
  const taskDescription = process.argv[2]

  if (!taskDescription) {
    process.stderr.write('用法: npx tsx plan-injector.ts "任务描述"\n')
    process.exit(1)
  }

  try {
    const planPath = await generatePlan(taskDescription, 'cli-test-session')
    if (planPath) {
      process.stdout.write(`规划文件已生成: ${planPath}\n`)
    } else {
      process.stdout.write('未生成规划文件（无 API Key）\n')
    }
  } catch (err) {
    process.stderr.write(`错误: ${err instanceof Error ? err.message : String(err)}\n`)
    process.exit(1)
  }
}

// 仅在直接运行时执行
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
