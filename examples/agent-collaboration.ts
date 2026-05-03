/**
 * 智能体协作示例
 *
 * 演示多个智能体如何通过事件总线协作完成任务
 */

import { EventBus, ShortTermMemory, ToolRegistry, LangChainAdapter } from '@yunpat/core'
import { WriterAgent } from '@yunpat/agent-writer'
import { ResearcherAgent } from '@yunpat/agent-researcher'

async function collaborativeResearch() {
  // 1. 初始化框架
  const eventBus = new EventBus()
  const memory = new ShortTermMemory()
  const tools = new ToolRegistry(eventBus)
  const llm = new LangChainAdapter({
    apiKey: process.env.OPENAI_API_KEY!,
    modelName: 'gpt-4',
  })

  // 2. 创建智能体
  const researcher = new ResearcherAgent({ eventBus, memory, tools, llm })
  const writer = new WriterAgent({ eventBus, memory, tools, llm })

  // 3. 设置协作流程
  // 研究员完成研究后，触发写作任务
  eventBus.subscribe('agent:completed', async (event) => {
    if (event.source === 'researcher') {
      console.log('\n[协作] 研究完成，开始生成报告...\n')

      // 使用研究结果生成报告
      await writer.execute({
        type: 'generate',
        topic: 'AI Agent 框架调研报告',
        format: 'markdown',
        requirements: ['基于最新研究', '包含对比分析'],
      })
    }
  })

  // 4. 启动研究任务
  console.log('=== 启动协作研究流程 ===\n')
  console.log('阶段 1: 研究分析师搜集信息...\n')

  await researcher.execute({
    question: '对比 LangChain、CrewAI、AutoGen 三大框架',
    depth: 'comprehensive',
    sources: ['web', 'academic'],
  })

  console.log('\n=== 协作完成 ===')
}

async function parallelAnalysis() {
  // 1. 初始化框架
  const eventBus = new EventBus()
  const memory = new ShortTermMemory()
  const tools = new ToolRegistry(eventBus)
  const llm = new LangChainAdapter({
    apiKey: process.env.OPENAI_API_KEY!,
    modelName: 'gpt-4',
  })

  // 2. 创建多个研究智能体实例
  const researcher1 = new ResearcherAgent({
    eventBus,
    memory,
    tools,
    llm,
  })

  const researcher2 = new ResearcherAgent({
    eventBus,
    memory,
    tools,
    llm,
  })

  const researcher3 = new ResearcherAgent({
    eventBus,
    memory,
    tools,
    llm,
  })

  // 3. 并行执行
  console.log('=== 并行分析三个框架 ===\n')

  const results = await Promise.all([
    researcher1.execute({
      question: 'LangChain 框架的特点和优势',
      depth: 'standard',
    }),
    researcher2.execute({
      question: 'CrewAI 框架的特点和优势',
      depth: 'standard',
    }),
    researcher3.execute({
      question: 'AutoGen 框架的特点和优势',
      depth: 'standard',
    }),
  ])

  // 4. 聚合结果
  console.log('\n=== 分析结果汇总 ===\n')

  results.forEach((result, index) => {
    console.log(`框架 ${index + 1}:`)
    result.keyFindings.forEach((finding) => {
      console.log(`  - ${finding}`)
    })
    console.log()
  })
}

// 运行示例
console.log('示例 1: 顺序协作\n')
collaborativeResearch()
  .then(() => {
    console.log('\n\n示例 2: 并行分析\n')
    return parallelAnalysis()
  })
  .catch(console.error)
