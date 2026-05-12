import { describe, it, expect } from 'vitest'
import { InventionUnderstandingAgent } from '@yunpat/agent-invention'
import { ClaimGeneratorAgent } from '@yunpat/agent-claim-generator'
import { SpecificationDrafterAgent } from '@yunpat/agent-specification-drafter'
import { EventBus, ShortTermMemory, ToolRegistry, NativeLLMAdapter } from '@yunpat/core'
// Note: Some imports might be slightly different depending on exports. We will mock the API or use real if available.

describe('PatentWriter Workflow E2E Test', () => {
  const isRealTest = process.env.RUN_REAL_LLM_TESTS === 'true'
  const runTest = isRealTest ? it : it.skip

  runTest('应该成功执行完整的专利撰写闭环流程 (发明理解 → 权利要求 → 说明书)', async () => {
    // 1. 初始化基础设施
    const eventBus = new EventBus()
    const memory = new ShortTermMemory()
    const tools = new ToolRegistry(eventBus)
    const llm = new NativeLLMAdapter({
      name: 'deepseek-chat',
      apiKey: process.env.DEEPSEEK_API_KEY || 'dummy',
      baseURL: 'https://api.deepseek.com/v1',
    })

    const config = { eventBus, memory, tools, llm }

    // 2. 初始化智能体
    const inventionAgent = new InventionUnderstandingAgent({
      name: 'invention-agent',
      description: '发明理解',
      ...config,
    })

    const claimAgent = new ClaimGeneratorAgent({
      name: 'claim-agent',
      description: '权利要求生成',
      ...config,
    })

    const specAgent = new SpecificationDrafterAgent({
      name: 'spec-agent',
      description: '说明书撰写',
      ...config,
    })

    // 3. 准备技术交底书
    const technicalDisclosure = `
本发明涉及一种基于深度学习的智能图像识别系统，包括：
1. 多尺度特征提取模块：采用改进的卷积神经网络架构
2. 注意力机制模块：增强关键区域的特征表示
3. 轻量化设计：使用模型压缩技术降低计算复杂度
本发明可以解决复杂场景下识别准确率低的问题，准确率提升25%。
    `

    console.log('--- 1. 执行发明理解 ---')
    const inventionResult = await inventionAgent.execute({
      title: '基于深度学习的智能图像识别系统',
      field: '人工智能',
      technicalDisclosure,
      drawings: [],
      enableMultiRound: false,
    })

    expect(inventionResult).toBeDefined()
    expect(inventionResult.technicalProblem).toBeDefined()
    expect(inventionResult.keyFeatures.length).toBeGreaterThan(0)
    console.log('发明理解完成:', inventionResult.technicalProblem)

    console.log('--- 2. 执行权利要求撰写 ---')
    const claimResult = await claimAgent.execute({
      inventionUnderstanding: inventionResult,
    })

    expect(claimResult).toBeDefined()
    expect(claimResult.claimsSet).toBeDefined()
    console.log('权利要求生成完成，独立权利要求共', claimResult.claimsSet.independent_claims.length, '项')

    console.log('--- 3. 执行说明书撰写 ---')
    const specResult = await specAgent.execute({
      inventionUnderstanding: inventionResult,
      claimsSet: claimResult.claimsSet,
      drawings: [],
      draftMode: 'standard',
      patentType: 'invention',
    })

    expect(specResult).toBeDefined()
    expect(specResult.specification).toBeDefined()
    expect(specResult.specification.embodiments).toBeDefined()
    console.log('说明书撰写完成，字数:', specResult.metrics.totalWordCount)
  }, 300000) // 5分钟超时
})
