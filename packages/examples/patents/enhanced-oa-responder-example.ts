/**
 * 增强版审查答复智能体 - 快速开始示例
 *
 * 演示如何使用增强版专利审查答复智能体
 */

import { EnhancedPatentResponderAgent } from '../patents/agents/responder/EnhancedPatentResponderAgent.js'
import { InteractiveWorkflow } from '../patents/agents/responder/InteractiveWorkflow.js'
import { DeepSeekAdapter } from '@yunpat/core/llm'

// ============================================
// 示例1: 基础使用
// ============================================
async function example1_basicUsage() {
  console.log('=== 示例1: 基础使用 ===\n')

  // 1. 创建 LLM 适配器
  const llm = new DeepSeekAdapter({
    apiKey: process.env.DEEPSEEK_API_KEY!,
  })

  // 2. 创建增强版答复智能体
  const agent = new EnhancedPatentResponderAgent({
    llm,
    enhancedConfig: {
      enableExaminerSimulation: true,
      enableSuccessPrediction: true,
      enableHebbianLearning: true,
      conservatism: 0.5,
      maxIterations: 3,
    },
  })

  // 3. 准备输入数据
  const input = {
    applicationNumber: 'CN202310123456.7',
    patentTitle: '一种基于深度学习的图像识别方法',
    officeAction: `
      审查意见通知书

      一、驳回理由

      1. 关于权利要求1的新颖性
      对比文件1（CN109876543A）公开了以下技术特征：
      - 特征A：深度学习模型
      - 特征B：卷积神经网络
      - 特征C：图像识别

      权利要求1与对比文件1的区别在于特征D，但该区别特征
      在对比文件2（US2023123456A1）中已经公开。

      因此，权利要求1不具备《专利法》第22条第2款规定的新颖性。
    `,
    priorArt: [
      'D1: CN109876543A - 基于深度学习的图像识别方法',
      'D2: US2023123456A1 - 图像特征提取技术',
    ],
    claims: [
      '1. 一种基于深度学习的图像识别方法，其特征在于，包括：\n   获取待识别图像；\n   使用深度学习模型提取图像特征；\n   根据所述图像特征进行图像识别。',
      '2. 根据权利要求1所述的方法，其特征在于，所述深度学习模型为卷积神经网络。',
    ],
    description: '本发明公开了一种基于深度学习的图像识别方法...',
  }

  // 4. 执行答复
  console.log('开始执行审查答复...\n')
  const result = await agent.execute(input)

  // 5. 查看结果
  console.log('\n=== 答复结果 ===')
  console.log(`授权成功率预测: ${result.metrics.allowanceProbability.toFixed(2)}%`)
  console.log(`答复质量评分: ${result.metrics.qualityScore.toFixed(2)}/100`)
  console.log(`审查员接受概率: ${result.metrics.examinerAcceptance.toFixed(2)}%`)
  console.log('\n最终建议:')
  result.finalRecommendations.forEach((rec, i) => {
    console.log(`  ${i + 1}. ${rec}`)
  })

  return result
}

// ============================================
// 示例2: 使用交互式工作流
// ============================================
async function example2_interactiveWorkflow() {
  console.log('\n\n=== 示例2: 使用交互式工作流 ===\n')

  // 1. 创建智能体
  const llm = new DeepSeekAdapter({
    apiKey: process.env.DEEPSEEK_API_KEY!,
  })

  const agent = new EnhancedPatentResponderAgent({
    llm,
    enhancedConfig: {
      enableHumanInLoop: false, // 演示模式关闭人工交互
      maxIterations: 2,
    },
  })

  // 2. 创建工作流
  const workflow = new InteractiveWorkflow(agent, {
    enableStepConfirmation: false, // 演示模式自动确认
    enableLivePreview: true,
    maxFeedbackRounds: 2,
    onProgress: (progress, message) => {
      console.log(`[进度 ${progress.toFixed(0)}%] ${message}`)
    },
  })

  // 3. 准备输入
  const input = {
    applicationNumber: 'CN202310234567.8',
    patentTitle: '一种智能推荐系统',
    officeAction: '审查意见内容...',
    priorArt: ['D1: CN987654321A'],
    claims: ['1. 一种推荐系统...'],
    description: '本发明涉及推荐系统...',
  }

  // 4. 执行工作流
  console.log('开始执行交互式工作流...\n')
  const result = await workflow.start(input as any)

  // 5. 查看工作流状态
  const state = workflow.getState()
  console.log('\n=== 工作流状态 ===')
  console.log(`当前步骤: ${state.currentStep}`)
  console.log(`已完成步骤: ${state.completedSteps.join(' → ')}`)
  console.log(`总进度: ${workflow.getProgress().toFixed(0)}%`)

  return result
}

// ============================================
// 示例3: 从反馈中学习
// ============================================
async function example3_learnFromFeedback() {
  console.log('\n\n=== 示例3: 从反馈中学习 ===\n')

  const llm = new DeepSeekAdapter({
    apiKey: process.env.DEEPSEEK_API_KEY!,
  })

  const agent = new EnhancedPatentResponderAgent({
    llm,
    enhancedConfig: {
      enableHebbianLearning: true,
    },
  })

  // 1. 保存案例
  const caseId = `case-${Date.now()}`
  const input = {
    applicationNumber: 'CN202310345678.9',
    patentTitle: '一种数据加密方法',
    officeAction: '审查意见内容...',
    priorArt: ['D1: CN112233445A'],
    claims: ['1. 一种加密方法...'],
    description: '本发明涉及加密技术...',
  }

  const selectedStrategy = {
    strategy_type: 'Hybrid' as const,
    reasoning: '修改权利要求并争辩',
    confidence: 0.75,
  }

  await agent.saveCaseForLearning(caseId, input as any, selectedStrategy)
  console.log(`✅ 案例 ${caseId} 已保存到学习器`)

  // 2. 模拟收到审查结果，提供反馈
  console.log('\n模拟收到审查结果...')
  await agent.learnFromFeedback(caseId, 'success', 85)
  console.log('✅ 反馈学习完成')

  // 3. 查看学习统计
  const stats = agent.getStats()
  console.log('\n=== 学习统计 ===')
  console.log(`总案例数: ${stats.hebbianLearning.totalCases}`)
  console.log(`学习事件数: ${stats.hebbianLearning.totalLearningEvents}`)
  console.log(`预测准确率: ${(stats.hebbianLearning.predictionAccuracy * 100).toFixed(2)}%`)

  console.log('\n=== 神经网络状态 ===')
  console.log(`策略神经元: ${stats.networkState.strategyNeurons}`)
  console.log(`特征神经元: ${stats.networkState.featureNeurons}`)
  console.log(`总突触数: ${stats.networkState.totalSynapses}`)
  console.log(`平均激活水平: ${stats.networkState.averageActivation.toFixed(3)}`)
}

// ============================================
// 示例4: 批量处理多个答复方案
// ============================================
async function example4_batchProcessing() {
  console.log('\n\n=== 示例4: 批量处理多个答复方案 ===\n')

  // 注意：这个示例直接使用 ExaminerSimulator
  const { ExaminerSimulator } = await import('../patents/agents/responder/ExaminerSimulator.js')

  const llm = new DeepSeekAdapter({
    apiKey: process.env.DEEPSEEK_API_KEY!,
  })

  const simulator = new ExaminerSimulator(llm, {
    strictness: 0.7,
    conservativeMode: false,
  })

  const mockOfficeAction = {
    oa_type: 'Novelty',
    citations: [{ document_number: 'D1', relevancy: 'high', claims_affected: [1, 2] }],
    affected_claims: [1, 2],
    examiner_arguments: '对比文件D1公开了所有技术特征',
  }

  // 生成3个不同的答复方案
  const responseOptions = [
    {
      writtenArgument: '完全反驳：D1未公开特征X',
      amendedClaims: ['1. 原权利要求'],
      amendmentComparison: '未修改',
      responseStrategy: 'argument' as const,
    },
    {
      writtenArgument: '部分修改：增加特征X',
      amendedClaims: ['1. 修改后的权利要求（增加特征X）'],
      amendmentComparison: '新增特征X',
      responseStrategy: 'amendment' as const,
    },
    {
      writtenArgument: '混合策略：修改+争辩',
      amendedClaims: ['1. 修改后的权利要求'],
      amendmentComparison: '新增特征X并强调区别',
      responseStrategy: 'combination' as const,
    },
  ]

  // 批量模拟
  const results = await simulator.simulateMultipleResponses(
    mockOfficeAction as any,
    responseOptions
  )

  console.log('批量模拟结果:')
  results.forEach((result, index) => {
    console.log(`\n方案 ${index + 1}:`)
    console.log(`  接受概率: ${result.result.acceptProbability.toFixed(2)}%`)
    console.log(`  风险等级: ${result.result.riskAssessment.level}`)
    console.log(`  改进建议数: ${result.result.suggestions.length}`)
  })

  console.log(`\n推荐: 方案1接受概率最高`)
}

// ============================================
// 主函数
// ============================================
async function main() {
  try {
    // 检查 API Key
    if (!process.env.DEEPSEEK_API_KEY) {
      throw new Error('请设置 DEEPSEEK_API_KEY 环境变量')
    }

    // 运行示例
    await example1_basicUsage()
    await example2_interactiveWorkflow()
    await example3_learnFromFeedback()
    await example4_batchProcessing()

    console.log('\n\n✅ 所有示例执行完成！')
  } catch (error) {
    console.error('❌ 执行失败:', error)
    process.exit(1)
  }
}

// 运行主函数
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export {
  example1_basicUsage,
  example2_interactiveWorkflow,
  example3_learnFromFeedback,
  example4_batchProcessing,
}
