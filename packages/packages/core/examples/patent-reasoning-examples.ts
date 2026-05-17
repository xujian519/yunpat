#!/usr/bin/env tsx
/**
 * 专利场景推理策略示例
 *
 * 展示四个推理策略在专利代理场景中的应用：
 * 1. CoT (Chain-of-Thought) - 逐步推理，用于创造性判断
 * 2. ToT (Tree-of-Thoughts) - 多路径探索，用于权利要求布局
 * 3. ReAct - 循环迭代，用于专利检索
 * 4. Reflection - 自我审查，用于权利要求质检
 *
 * 运行方式：
 * DEEPSEEK_API_KEY=sk-xxx pnpm --filter @yunpat/core exec tsx examples/patent-reasoning-examples.ts
 */

import { createDeepSeekModel } from '../src/llm/NativeLLMAdapter.js'
import { ChainOfThoughtStrategy } from '../src/reasoning/ChainOfThoughtStrategy.js'
import { TreeOfThoughtsStrategy } from '../src/reasoning/TreeOfThoughtsStrategy.js'
import { ReActLoop } from '../src/reasoning/ReActLoop.js'
import { EnhancedReflection, ReflectionDimension } from '../src/reasoning/EnhancedReflection.js'
import {
  LifecycleStage,
  type ExecutionContext,
  type MemoryStore,
  type EventBus,
  type ToolRegistry,
  type LLMAdapter,
} from '../src/lifecycle/Lifecycle.js'

// ========== Mock 上下文 ==========

function createMockContext(agentName: string): ExecutionContext {
  return {
    executionId: `patent-demo-${Date.now()}`,
    agentName,
    startTime: new Date(),
    currentStage: LifecycleStage.ACT,
    memory: {
      get: async () => undefined,
      set: async () => {},
      delete: async () => {},
      has: async () => false,
      getAll: async () => ({}),
      setAll: async () => {},
      clear: async () => {},
      search: async () => [],
    } satisfies MemoryStore,
    eventBus: {
      publish: () => {},
      subscribe: () => ({ id: '', pattern: '', handler: () => {}, unsubscribe: () => {} }),
      unsubscribe: () => {},
      request: async () => undefined,
    } satisfies EventBus,
    tools: {
      register: () => {},
      unregister: () => {},
      get: () => undefined,
      call: async () => undefined,
      list: () => [],
    } satisfies ToolRegistry,
    llm: {
      chat: async () => ({
        message: { role: 'assistant' as const, content: '' },
      }),
      chatStream: async function* () {},
      embed: async () => [[]],
    } satisfies LLMAdapter,
    metadata: {},
    sharedState: new Map(),
  }
}

// ========== 示例1: CoT - 创造性判断 ==========

async function example1_CoT_CreativityJudgment() {
  console.log('\n' + '='.repeat(80))
  console.log('示例 1: Chain-of-Thought - 创造性判断')
  console.log('='.repeat(80))

  const llm = createDeepSeekModel(process.env.DEEPSEEK_API_KEY!)
  const cot = new ChainOfThoughtStrategy(llm, {
    maxSteps: 10,
    temperature: 0.5,
    verbose: true,
  })

  const problem = `
**发明名称**：一种自适应滤波器算法

**最接近现有技术**：对比文件1公开了一种数字滤波器，包括特征A和B

**本申请权利要求1**：
一种自适应滤波器，其特征在于，包括：
  特征A：信号输入模块
  特征B：滤波处理模块
  特征C：自适应参数调整模块，用于根据信号质量实时调整滤波系数

**对比文件2**：公开了一种参数调整方法，但用于音频信号处理
  `

  console.log('\n📋 问题描述：判断权利要求1是否具有创造性？\n')

  const result = await cot.reason(problem, {
    domain: '专利审查',
    standard: '创造性评估',
  })

  console.log('\n📊 CoT 推理结果：')
  console.log(`  步骤数: ${result.steps.length}`)
  console.log(`  总体置信度: ${(result.confidence * 100).toFixed(1)}%`)
  console.log(`  最终结论: ${result.conclusion}`)

  console.log('\n📝 推理步骤：')
  result.steps.forEach((step, i) => {
    console.log(`  ${i + 1}. ${step.description}`)
    console.log(`     置信度: ${(step.confidence * 100).toFixed(1)}%`)
    if (step.intermediateResult) {
      console.log(`     中间结果: ${step.intermediateResult}`)
    }
  })

  return result
}

// ========== 示例2: ToT - 权利要求布局 ==========

async function example2_ToT_ClaimLayout() {
  console.log('\n' + '='.repeat(80))
  console.log('示例 2: Tree-of-Thoughts - 权利要求布局')
  console.log('='.repeat(80))

  const llm = createDeepSeekModel(process.env.DEEPSEEK_API_KEY!)
  const tot = new TreeOfThoughtsStrategy(llm, {
    maxDepth: 2,
    branchFactor: 3,
    temperature: 0.8,
    verbose: true,
  })

  const problem = `
**发明名称**：智能数据处理系统

**核心技术特征**：
- 特征X：分布式计算架构
- 特征Y：机器学习优化算法
- 特征Z：实时数据流处理

**保护需求**：
- 希望获得尽可能宽的保护范围
- 但也要考虑稳定性，避免容易被无效
  `

  console.log('\n📋 问题描述：设计权利要求布局策略\n')

  // 生成多个布局方案
  const thoughts = await tot.generateThoughts(problem, 3)

  console.log('\n💡 生成的布局方案：')
  thoughts.forEach((t, i) => {
    console.log(`\n  方案${i + 1}: ${t.thought.substring(0, 100)}...`)
    console.log(`  初始评分: ${t.score}/10`)
  })

  // 评估各个方案
  const evaluated = await tot.evaluateThoughts(problem, thoughts)

  console.log('\n📊 多维度评估结果：')
  evaluated.forEach((t, i) => {
    const eval_ = t.evaluation as { feasibility?: number; innovation?: number; completeness?: number; clarity?: number }
    console.log(`\n  方案${i + 1}:`)
    console.log(`    可行性: ${eval_.feasibility}/10`)
    console.log(`    创新性: ${eval_.innovation}/10`)
    console.log(`    完整性: ${eval_.completeness}/10`)
    console.log(`    清晰度: ${eval_.clarity}/10`)
    console.log(`    总分: ${t.score}/10`)
  })

  // 选择最佳方案
  const bestThought = evaluated.reduce((best, current) =>
    current.score > best.score ? current : best
  )

  console.log(`\n✅ 推荐方案: ${bestThought.thought.substring(0, 100)}...`)
  console.log(`   评分: ${bestThought.score}/10`)

  return { thoughts, evaluated, bestThought }
}

// ========== 示例3: ReAct - 专利检索 ==========

async function example3_ReAct_PatentSearch() {
  console.log('\n' + '='.repeat(80))
  console.log('示例 3: ReAct - 专利检索循环')
  console.log('='.repeat(80))

  const llm = createDeepSeekModel(process.env.DEEPSEEK_API_KEY!)
  const reactLoop = new ReActLoop(llm, {
    maxIterations: 5,
    verbose: false,
    reflectAfterStep: true,
  })

  const goal = '检索"自适应滤波器"在通信领域的现有技术'

  console.log('\n📋 任务目标：检索"自适应滤波器"在通信领域的现有技术\n')

  const iterations: any[] = []

  console.log('🔄 开始 ReAct 循环...\n')
  for await (const iteration of reactLoop.execute(goal)) {
    iterations.push(iteration)

    console.log(`[迭代 ${iteration.iteration}]`)
    console.log(`🤔 思考: ${iteration.thought.reasoning.substring(0, 150)}...`)
    console.log(`📊 状态: ${iteration.thought.state}`)

    if (iteration.action) {
      console.log(`⚡ 行动: ${iteration.action.type}`)
      if (iteration.action.params) {
        console.log(`   参数: ${JSON.stringify(iteration.action.params).substring(0, 100)}...`)
      }
    }

    if (iteration.actionResult) {
      if (iteration.actionResult.success) {
        console.log(`✅ 结果: ${JSON.stringify(iteration.actionResult.data).substring(0, 100)}...`)
      } else {
        console.log(`❌ 错误: ${iteration.actionResult.error}`)
      }
    }

    console.log('')

    if (iteration.done) break
  }

  console.log(`\n✅ 检索完成！共执行 ${iterations.length} 次迭代`)

  return iterations
}

// ========== 示例4: Reflection - 权利要求质检 ==========

async function example4_Reflection_QualityCheck() {
  console.log('\n' + '='.repeat(80))
  console.log('示例 4: Reflection - 权利要求书质量检查')
  console.log('='.repeat(80))

  const llm = createDeepSeekModel(process.env.DEEPSEEK_API_KEY!)
  const reflection = new EnhancedReflection(llm, {
    maxIterations: 3,
    iterationThreshold: 0.7,
    enabledDimensions: [ReflectionDimension.QUALITY, ReflectionDimension.COMPLETENESS, ReflectionDimension.CONSISTENCY],
    useDeepAnalysis: true,
  })

  const claimDraft = {
    type: 'independent',
    content: `
1. 一种数据处理装置，其特征在于，包括：
   处理器，配置为执行数据处理操作；
   存储器，耦合到所述处理器；
   其中，所述处理器用于：
     接收输入数据；
     对所述输入数据进行滤波处理；
   输出处理后的数据。
    `.trim(),
  }

  const context = createMockContext('PatentWriterAgent')

  console.log('\n📋 权利要求初稿：')
  console.log(claimDraft.content)

  console.log('\n🔍 开始多维度评估...\n')

  const report = await reflection.reflect(claimDraft, context, '检查权利要求书的质量')

  console.log('📊 反思报告：')
  console.log(`  报告ID: ${report.id}`)
  console.log(`  综合评分: ${(report.overallScore * 100).toFixed(1)}%`)
  console.log(`  质量等级: ${report.overallLevel}`)
  console.log(`  是否需要迭代: ${report.needsIteration ? '是' : '否'}`)

  console.log('\n📋 各维度评估：')
  report.assessments.forEach((assessment) => {
    console.log(`\n  ${assessment.dimension}:`)
    console.log(`    评分: ${(assessment.score * 100).toFixed(1)}%`)
    console.log(`    等级: ${assessment.level}`)
    console.log(`    理由: ${assessment.reasoning.substring(0, 100)}...`)

    if (assessment.issues.length > 0) {
      console.log(`    发现问题:`)
      assessment.issues.forEach((issue) => {
        console.log(`      - ${issue}`)
      })
    }
  })

  console.log('\n💡 改进建议：')
  if (report.improvements.length === 0) {
    console.log('  无需改进')
  } else {
    report.improvements.forEach((imp, i) => {
      console.log(`\n  ${i + 1}. [${imp.priority}] ${imp.description}`)
      console.log(`     行动步骤:`)
      imp.actionSteps.forEach((step, j) => {
        console.log(`       ${j + 1}. ${step}`)
      })
      console.log(`     预期结果: ${imp.expectedOutcome}`)
    })
  }

  console.log(`\n📈 置信度: ${(report.confidence * 100).toFixed(1)}%`)

  return report
}

// ========== 示例5: 四策略组合使用 ==========

async function example5_CombinedWorkflow() {
  console.log('\n' + '='.repeat(80))
  console.log('示例 5: 四策略组合使用 - 完整的专利撰写流程')
  console.log('='.repeat(80))

  const llm = createDeepSeekModel(process.env.DEEPSEEK_API_KEY!)
  const context = createMockContext('PatentAgent')

  const invention = {
    title: '智能图像识别系统',
    features: ['深度学习算法', '边缘计算优化', '实时数据处理'],
  }

  console.log('\n🎯 发明信息：')
  console.log(`  标题: ${invention.title}`)
  console.log(`  核心特征: ${invention.features.join(', ')}`)

  // 步骤1: CoT - 技术理解和创造性分析
  console.log('\n📍 步骤1: 使用 CoT 分析创造性')
  const cot = new ChainOfThoughtStrategy(llm, { verbose: false })
  const cotResult = await cot.reason(`分析发明"${invention.title}"的创造性`, { domain: '专利分析' })
  console.log(`  ✅ CoT 分析完成，置信度: ${(cotResult.confidence * 100).toFixed(1)}%`)

  // 步骤2: ToT - 权利要求布局方案
  console.log('\n📍 步骤2: 使用 ToT 设计布局方案')
  const tot = new TreeOfThoughtsStrategy(llm, { verbose: false })
  const layoutNode = await tot.bestFirstSearch(`为"${invention.title}"设计权利要求布局`, 2, 3)
  const bestPath = tot.getBestPath(layoutNode)
  console.log(`  ✅ ToT 完成，最佳路径包含 ${bestPath.length} 个步骤`)
  console.log(`  最终方案: ${bestPath[bestPath.length - 1].substring(0, 80)}...`)

  // 步骤3: ReAct - 检索验证
  console.log('\n📍 步骤3: 使用 ReAct 进行检索验证')
  const reactLoop = new ReActLoop(llm, { verbose: false })
  const searchIterations: any[] = []
  for await (const iter of reactLoop.execute(`检索"${invention.title}"的现有技术`)) {
    searchIterations.push(iter)
    if (iter.done) break
  }
  console.log(`  ✅ ReAct 检索完成，${searchIterations.length} 次迭代`)

  // 步骤4: Reflection - 质量检查
  console.log('\n📍 步骤4: 使用 Reflection 进行质量检查')
  const reflection = new EnhancedReflection(llm, { verbose: false })
  const draft = {
    title: invention.title,
    claims: bestPath.join('\n'),
    searchResults: `${searchIterations.length} 次检索迭代`,
  }
  const qualityReport = await reflection.reflect(draft, context, '专利申请最终检查')
  console.log(`  ✅ Reflection 完成，质量评分: ${(qualityReport.overallScore * 100).toFixed(1)}%`)

  console.log('\n' + '='.repeat(80))
  console.log('📊 组合流程总结：')
  console.log('  CoT (创造性分析) → ToT (布局设计) → ReAct (检索验证) → Reflection (质量检查)')
  console.log(`  ✅ 全部完成！最终质量评分: ${(qualityReport.overallScore * 100).toFixed(1)}%`)
  console.log('='.repeat(80))

  return {
    cotResult,
    layoutNode,
    searchIterations,
    qualityReport,
  }
}

// ========== 主程序 ==========

async function main() {
  // 检查环境变量
  const apiKey = process.env.DEEPSEEK_API_KEY

  if (!apiKey) {
    console.error('❌ 请设置环境变量：')
    console.error('   export DEEPSEEK_API_KEY=sk-xxx')
    process.exit(1)
  }

  console.log('\n🚀 专利场景推理策略示例')
  console.log('🤖 LLM: DeepSeek V4')
  console.log(`📅 时间: ${new Date().toLocaleString('zh-CN')}\n`)

  try {
    // 示例1: CoT - 创造性判断
    await example1_CoT_CreativityJudgment()

    // 示例2: ToT - 权利要求布局
    await example2_ToT_ClaimLayout()

    // 示例3: ReAct - 专利检索
    await example3_ReAct_PatentSearch()

    // 示例4: Reflection - 质量检查
    await example4_Reflection_QualityCheck()

    // 示例5: 四策略组合
    await example5_CombinedWorkflow()

    console.log('\n' + '='.repeat(80))
    console.log('🎉 所有示例运行完成！')
    console.log('='.repeat(80) + '\n')
  } catch (error) {
    console.error('\n❌ 错误:', error)
    process.exit(1)
  }
}

// 运行主程序
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export {
  example1_CoT_CreativityJudgment,
  example2_ToT_ClaimLayout,
  example3_ReAct_PatentSearch,
  example4_Reflection_QualityCheck,
  example5_CombinedWorkflow,
}
