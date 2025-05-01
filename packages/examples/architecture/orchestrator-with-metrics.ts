/**
 * Orchestrator 集成 Metrics 示例
 * 展示如何在 orchestrator 中使用 observability 模块
 */

import express from 'express'
import { recordAgentTask, recordLLMCall } from '../packages/core/src/observability'

const app = express()
app.use(express.json())

/**
 * 模拟 Agent 任务执行（带指标记录）
 */
app.post('/api/orchestrator/execute', async (req, res) => {
  const { agent_name, task_type, prompt } = req.body

  const startTime = Date.now()

  try {
    // 模拟 Agent 执行
    await executeAgentTask(agent_name, task_type, prompt)

    // 记录成功的任务
    const duration = (Date.now() - startTime) / 1000
    recordAgentTask(agent_name, task_type, duration, true)

    res.json({
      success: true,
      agent: agent_name,
      task_type,
      duration: `${duration.toFixed(2)}s`,
    })
  } catch (error) {
    // 记录失败的任务
    const duration = (Date.now() - startTime) / 1000
    recordAgentTask(agent_name, task_type, duration, false)

    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

/**
 * 模拟 LLM 调用（带指标记录）
 */
app.post('/api/llm/generate', async (req, res) => {
  const { provider, model, prompt } = req.body

  const startTime = Date.now()

  try {
    // 模拟 LLM 调用
    const result = await callLLM(provider, model, prompt)

    // 记录成功的 LLM 调用
    const duration = (Date.now() - startTime) / 1000
    recordLLMCall(
      provider,
      model,
      duration,
      {
        prompt: result.usage.prompt_tokens,
        completion: result.usage.completion_tokens,
      },
      true
    )

    res.json({
      success: true,
      provider,
      model,
      result: result.text,
      usage: result.usage,
    })
  } catch (error) {
    // 记录失败的 LLM 调用
    const duration = (Date.now() - startTime) / 1000
    recordLLMCall(provider, model, duration, { prompt: 0, completion: 0 }, false)

    res.status(500).json({
      success: false,
      error: error.message,
    })
  }
})

// 辅助函数（模拟实现）
async function executeAgentTask(agentName: string, taskType: string, prompt: string) {
  // 模拟异步操作
  await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 2000))
  return { success: true }
}

async function callLLM(provider: string, model: string, prompt: string) {
  // 模拟异步操作
  await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 1500))
  return {
    text: '模拟的 LLM 响应',
    usage: {
      prompt_tokens: Math.floor(Math.random() * 1000),
      completion_tokens: Math.floor(Math.random() * 500),
    },
  }
}

const PORT = 3001
app.listen(PORT, () => {
  console.log(`🚀 Orchestrator 示例服务器运行在 http://localhost:${PORT}`)
})
