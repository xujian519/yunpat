#!/usr/bin/env tsx
/**
 * 专利场景推理策略示例 - 使用云端模型
 *
 * 测试 DeepSeek 和 GLM 云端模型在专利代理场景中的应用
 *
 * 运行方式：
 * 1. 设置环境变量：
 *    export DEEPSEEK_API_KEY=sk-xxx
 *    export DASHSCOPE_API_KEY=sk-xxx
 * 2. 运行：pnpm --filter @yunpat/core exec tsx examples/patent-reasoning-cloud.ts
 */

import { createDeepSeekModel, createZhipuModel } from '../src/llm/NativeLLMAdapter.js'
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
    executionId: `patent-cloud-${Date.now()}`,
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

// ========== 测试 1: DeepSeek - CoT 创造性判断 ==========

async function testDeepSeek_CoT() {
  console.log('\n' + '='.repeat(80))
  console.log('测试 1: DeepSeek V4 - Chain-of-Thought 创造性判断')
  console.log('='.repeat(80))

  if (!process.env.DEEPSEEK_API_KEY) {
    console.log('⚠️  DEEPSEEK_API_KEY 未设置，跳过此测试')
    return null
  }

  const llm = createDeepSeekModel(process.env.DEEPSEEK_API_KEY)
  const cot = new ChainOfThoughtStrategy(llm, {
    maxSteps: 5,
    temperature: 0.5,
    verbose: true,
  })

  const problem = `
**发明名称**：一种基于量子纠缠的密钥分发方法

**最接近现有技术**：对比文件1公开了基于经典加密算法的密钥分发

**本申请权利要求1**：
一种量子密钥分发方法，其特征在于，包括：
  特征A：利用量子纠缠对进行密钥生成
  特征B：采用BB84协议进行量子态传输
  特征C：结合量子中继器实现长距离分发

**技术效果**：理论上实现无条件安全，密钥分发距离达到100km
  `

  console.log('\n📋 问题描述：判断权利要求1是否具有创造性？\n')

  try {
    const startTime = Date.now()
    const result = await cot.reason(problem, {
      domain: '专利审查',
      standard: '创造性评估',
    })
    const duration = ((Date.now() - startTime) / 1000).toFixed(2)

    console.log('\n📊 DeepSeek CoT 推理结果：')
    console.log(`  ⏱️  响应时间: ${duration}秒`)
    console.log(`  📝 步骤数: ${result.steps.length}`)
    console.log(`  📈 总体置信度: ${(result.confidence * 100).toFixed(1)}%`)
    console.log(`  ✅ 最终结论: ${result.conclusion.substring(0, 100)}...`)

    console.log('\n📝 推理步骤：')
    result.steps.forEach((step, i) => {
      console.log(`  ${i + 1}. ${step.description}`)
      console.log(`     置信度: ${(step.confidence * 100).toFixed(1)}%`)
    })

    return { model: 'DeepSeek', result, duration }
  } catch (error) {
    console.error('❌ DeepSeek CoT 执行失败:', error)
    return null
  }
}

// ========== 测试 2: GLM - ToT 权利要求布局 ==========

async function testZhipuGLM_ToT() {
  console.log('\n' + '='.repeat(80))
  console.log('测试 2: 智谱 GLM-4 - Tree-of-Thoughts 权利要求布局')
  console.log('='.repeat(80))

  if (!process.env.ZHIPU_API_KEY) {
    console.log('⚠️  ZHIPU_API_KEY 未设置，跳过此测试')
    return null
  }

  const llm = createZhipuModel(process.env.ZHIPU_API_KEY)
  const tot = new TreeOfThoughtsStrategy(llm, {
    maxDepth: 2,
    branchFactor: 3,
    temperature: 0.8,
    verbose: true,
  })

  const problem = `
**发明名称**：智能农业灌溉系统

**核心技术特征**：
- 特征X：基于土壤湿度传感器网络
- 特征Y：AI算法优化灌溉策略
- 特征Z：与气象数据联动调节

**保护需求**：
- 希望获得尽可能宽的保护范围
- 也要考虑稳定性，避免容易被无效
  `

  console.log('\n📋 问题描述：设计权利要求布局策略\n')

  try {
    const startTime = Date.now()
    const thoughts = await tot.generateThoughts(problem, 3)
    const evaluated = await tot.evaluateThoughts(problem, thoughts)
    const duration = ((Date.now() - startTime) / 1000).toFixed(2)

    console.log(`\n⏱️  响应时间: ${duration}秒`)
    console.log(`\n💡 生成的布局方案：`)
    thoughts.forEach((t, i) => {
      console.log(`\n  方案${i + 1}: ${t.thought.substring(0, 80)}...`)
      console.log(`  初始评分: ${t.score}/10`)
    })

    console.log('\n📊 多维度评估结果：')
    evaluated.forEach((t, i) => {
      const eval_ = t.evaluation as { feasibility?: number; innovation?: number; completeness?: number; clarity?: number }
      console.log(`\n  方案${i + 1}:`)
      console.log(`    可行性: ${eval_?.feasibility || 'N/A'}/10`)
      console.log(`    创新性: ${eval_?.innovation || 'N/A'}/10`)
      console.log(`    完整性: ${eval_?.completeness || 'N/A'}/10`)
      console.log(`    清晰度: ${eval_?.clarity || 'N/A'}/10`)
      console.log(`    总分: ${t.score}/10`)
    })

    const bestThought = evaluated.reduce((best, current) =>
      current.score > best.score ? current : best
    )

    console.log(`\n✅ 推荐方案: ${bestThought.thought.substring(0, 80)}...`)
    console.log(`   评分: ${bestThought.score}/10`)

    return { model: 'GLM', result: { thoughts, evaluated, bestThought }, duration }
  } catch (error) {
    console.error('❌ GLM ToT 执行失败:', error)
    return null
  }
}

// ========== 测试 3: DeepSeek - Reflection 质量检查 ==========

async function testDeepSeek_Reflection() {
  console.log('\n' + '='.repeat(80))
  console.log('测试 3: DeepSeek V4 - Reflection 质量检查')
  console.log('='.repeat(80))

  if (!process.env.DEEPSEEK_API_KEY) {
    console.log('⚠️  DEEPSEEK_API_KEY 未设置，跳过此测试')
    return null
  }

  const llm = createDeepSeekModel(process.env.DEEPSEEK_API_KEY)
  const reflection = new EnhancedReflection(llm, {
    maxIterations: 2,
    iterationThreshold: 0.7,
    enabledDimensions: [ReflectionDimension.QUALITY, ReflectionDimension.COMPLETENESS, ReflectionDimension.CONSISTENCY],
    useDeepAnalysis: true,
  })

  const claimDraft = {
    type: 'independent',
    content: `
1. 一种基于人工智能的自动驾驶方法，其特征在于，包括：
   获取车辆周围环境信息；
   使用深度学习模型分析所述环境信息；
   根据分析结果控制车辆行驶；
   其中，所述深度学习模型为卷积神经网络。
    `.trim(),
  }

  const context = createMockContext('PatentWriterAgent')

  console.log('\n📋 权利要求初稿：')
  console.log(claimDraft.content)

  console.log('\n🔍 开始多维度评估...\n')

  try {
    const startTime = Date.now()
    const report = await reflection.reflect(claimDraft, context, '检查权利要求书的质量')
    const duration = ((Date.now() - startTime) / 1000).toFixed(2)

    console.log(`⏱️  响应时间: ${duration}秒\n`)
    console.log('📊 反思报告：')
    console.log(`  报告ID: ${report.id}`)
    console.log(`  综合评分: ${(report.overallScore * 100).toFixed(1)}%`)
    console.log(`  质量等级: ${report.overallLevel}`)
    console.log(`  是否需要迭代: ${report.needsIteration ? '是' : '否'}`)
    console.log(`  置信度: ${(report.confidence * 100).toFixed(1)}%`)

    console.log('\n📋 各维度评估：')
    report.assessments.forEach((assessment) => {
      console.log(`\n  ${assessment.dimension}:`)
      console.log(`    评分: ${(assessment.score * 100).toFixed(1)}%`)
      console.log(`    等级: ${assessment.level}`)
      console.log(`    理由: ${assessment.reasoning.substring(0, 80)}...`)

      if (assessment.issues.length > 0) {
        console.log(`    发现问题: ${assessment.issues.length}个`)
      }
    })

    console.log(`\n💡 改进建议: ${report.improvements.length}条`)

    return { model: 'DeepSeek', result: report, duration }
  } catch (error) {
    console.error('❌ DeepSeek Reflection 执行失败:', error)
    return null
  }
}

// ========== 测试 4: 模型对比测试 ==========

async function testModelComparison() {
  console.log('\n' + '='.repeat(80))
  console.log('测试 4: DeepSeek vs GLM - 同一任务对比')
  console.log('='.repeat(80))

  const problem = '判断"一种基于区块链的数字版权保护方法"是否具有专利性？'

  const results: Array<{ model: string; duration: string; success: boolean }> = []

  // 测试 DeepSeek
  if (process.env.DEEPSEEK_API_KEY) {
    console.log('\n🔍 测试 DeepSeek...')
    try {
      const llm = createDeepSeekModel(process.env.DEEPSEEK_API_KEY)
      const cot = new ChainOfThoughtStrategy(llm, {
        maxSteps: 3,
        temperature: 0.5,
        verbose: false,
      })

      const startTime = Date.now()
      const result = await cot.reason(problem)
      const duration = ((Date.now() - startTime) / 1000).toFixed(2)

      console.log(`✅ DeepSeek 成功`)
      console.log(`   置信度: ${(result.confidence * 100).toFixed(1)}%`)
      console.log(`   耗时: ${duration}秒`)

      results.push({ model: 'DeepSeek', duration, success: true })
    } catch (error) {
      console.log(`❌ DeepSeek 失败: ${error}`)
      results.push({ model: 'DeepSeek', duration: 'N/A', success: false })
    }
  }

  // 测试智谱 GLM
  if (process.env.ZHIPU_API_KEY) {
    console.log('\n🔍 测试智谱 GLM...')
    try {
      const llm = createZhipuModel(process.env.ZHIPU_API_KEY)
      const cot = new ChainOfThoughtStrategy(llm, {
        maxSteps: 3,
        temperature: 0.5,
        verbose: false,
      })

      const startTime = Date.now()
      const result = await cot.reason(problem)
      const duration = ((Date.now() - startTime) / 1000).toFixed(2)

      console.log(`✅ GLM 成功`)
      console.log(`   置信度: ${(result.confidence * 100).toFixed(1)}%`)
      console.log(`   耗时: ${duration}秒`)

      results.push({ model: '智谱GLM', duration, success: true })
    } catch (error) {
      console.log(`❌ 智谱GLM 失败: ${error}`)
      results.push({ model: '智谱GLM', duration: 'N/A', success: false })
    }
  }

  // 对比结果
  console.log('\n📊 模型对比结果：')
  console.log('┌──────────┬──────────┬─────────┐')
  console.log('│ 模型     │ 状态     │ 耗时    │')
  console.log('├──────────┼──────────┼─────────┤')

  results.forEach((r) => {
    const status = r.success ? '✅ 成功' : '❌ 失败'
    console.log(`│ ${r.model.padEnd(8)}│ ${status.padEnd(8)}│ ${r.duration.padEnd(7)}│`)
  })

  console.log('└──────────┴──────────┴─────────┘')

  return results
}

// ========== 主程序 ==========

async function main() {
  console.log('\n🚀 专利场景推理策略示例 - 云端模型测试')
  console.log('📅 时间:', new Date().toLocaleString('zh-CN'))

  // 检查 API key
  console.log('\n🔍 检查 API key 配置：')
  console.log(`  DEEPSEEK_API_KEY: ${process.env.DEEPSEEK_API_KEY ? '✅ 已配置' : '❌ 未配置'}`)
  console.log(`  ZHIPU_API_KEY: ${process.env.ZHIPU_API_KEY ? '✅ 已配置' : '❌ 未配置'}`)

  if (!process.env.DEEPSEEK_API_KEY && !process.env.ZHIPU_API_KEY) {
    console.log('\n❌ 错误: 至少需要配置一个 API key')
    console.log('   请设置环境变量：')
    console.log('   export DEEPSEEK_API_KEY=sk-xxx')
    console.log('   export ZHIPU_API_KEY=xxx')
    process.exit(1)
  }

  try {
    // 测试 1: DeepSeek CoT
    const deepseekCoT = await testDeepSeek_CoT()

    // 测试 2: 智谱 GLM ToT
    const glmToT = await testZhipuGLM_ToT()

    // 测试 3: DeepSeek Reflection
    const deepseekReflection = await testDeepSeek_Reflection()

    // 测试 4: 模型对比
    const comparison = await testModelComparison()

    // 总结
    console.log('\n' + '='.repeat(80))
    console.log('📊 云端模型测试总结')
    console.log('='.repeat(80))

    const testResults = [
      { name: 'DeepSeek CoT', result: deepseekCoT },
      { name: 'GLM ToT', result: glmToT },
      { name: 'DeepSeek Reflection', result: deepseekReflection },
    ]

    testResults.forEach((test) => {
      if (test.result) {
        console.log(`✅ ${test.name}: 成功 (${test.result.duration}秒)`)
      } else {
        console.log(`⚠️  ${test.name}: 跳过或失败`)
      }
    })

    const successCount = testResults.filter((t) => t.result !== null).length
    console.log(`\n✅ 成功完成 ${successCount}/${testResults.length} 个测试`)

    if (comparison.length > 0) {
      console.log('\n🏆 模型性能对比：')
      const successful = comparison.filter((r) => r.success)
      if (successful.length > 0) {
        const fastest = successful.reduce((a, b) =>
          parseFloat(a.duration) < parseFloat(b.duration) ? a : b
        )
        console.log(`   最快模型: ${fastest.model} (${fastest.duration}秒)`)
      }
    }

    console.log('='.repeat(80) + '\n')
  } catch (error) {
    console.error('\n❌ 测试失败:', error)
    process.exit(1)
  }
}

// 运行主程序
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export { testDeepSeek_CoT, testZhipuGLM_ToT, testDeepSeek_Reflection, testModelComparison }
