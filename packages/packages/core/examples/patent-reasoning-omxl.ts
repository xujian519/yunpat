#!/usr/bin/env tsx
/**
 * 专利场景推理策略示例 - 使用本地 OMLX 模型
 *
 * 使用本地 OMLX 模型测试四个推理策略在专利代理场景中的应用
 * 优点：无需 API key、完全本地运行、响应快速、成本为零
 *
 * 运行方式：
 * 1. 确保 OMLX 服务已启动（端口 8009）
 * 2. 运行：pnpm --filter @yunpat/core exec tsx examples/patent-reasoning-omxl.ts
 */

import { OMXLModelFactory } from '../src/llm/OMXLModelFactory.js'
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
    executionId: `patent-omxl-${Date.now()}`,
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
  console.log('示例 1: Chain-of-Thought - 创造性判断（使用 OMLX 本地模型）')
  console.log('='.repeat(80))

  const llm = OMXLModelFactory.createForTask('patent_writing')
  const cot = new ChainOfThoughtStrategy(llm, {
    maxSteps: 5, // 减少步骤数量以加快速度
    temperature: 0.5,
    verbose: true,
    timeout: 180000, // 增加超时时间到3分钟
  })

  const problem = `
**发明名称**：一种基于深度学习的图像压缩方法

**最接近现有技术**：对比文件1公开了基于传统神经网络（CNN）的图像压缩技术

**本申请权利要求1**：
一种图像压缩方法，其特征在于，包括：
  特征A：使用卷积神经网络提取图像特征
  特征B：使用注意力机制优化特征表示
  特征C：采用变分自编码器进行压缩，其中引入了对抗训练策略

**技术效果**：相比现有技术，压缩比提升30%，且图像质量保持更好
  `

  console.log('\n📋 问题描述：判断权利要求1是否具有创造性？\n')

  try {
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
  } catch (error) {
    console.error('❌ CoT 执行失败:', error)
    throw error
  }
}

// ========== 示例2: ToT - 权利要求布局 ==========

async function example2_ToT_ClaimLayout() {
  console.log('\n' + '='.repeat(80))
  console.log('示例 2: Tree-of-Thoughts - 权利要求布局（使用 OMLX 本地模型）')
  console.log('='.repeat(80))

  const llm = OMXLModelFactory.createForTask('patent_writing')
  const tot = new TreeOfThoughtsStrategy(llm, {
    maxDepth: 2,
    branchFactor: 3,
    temperature: 0.8,
    verbose: true,
  })

  const problem = `
**发明名称**：智能交通信号控制系统

**核心技术特征**：
- 特征X：基于深度学习的车流量预测
- 特征Y：实时自适应信号灯时序调整
- 特征Z：多路口协同优化算法

**保护需求**：
- 希望获得尽可能宽的保护范围
- 但也要考虑稳定性，避免容易被无效
  `

  console.log('\n📋 问题描述：设计权利要求布局策略\n')

  try {
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
      const eval_ = t.evaluation as {
        feasibility?: number
        innovation?: number
        completeness?: number
        clarity?: number
      }
      console.log(`\n  方案${i + 1}:`)
      console.log(`    可行性: ${eval_?.feasibility || 'N/A'}/10`)
      console.log(`    创新性: ${eval_?.innovation || 'N/A'}/10`)
      console.log(`    完整性: ${eval_?.completeness || 'N/A'}/10`)
      console.log(`    清晰度: ${eval_?.clarity || 'N/A'}/10`)
      console.log(`    总分: ${t.score}/10`)
    })

    // 选择最佳方案
    const bestThought = evaluated.reduce((best, current) =>
      current.score > best.score ? current : best
    )

    console.log(`\n✅ 推荐方案: ${bestThought.thought.substring(0, 100)}...`)
    console.log(`   评分: ${bestThought.score}/10`)

    return { thoughts, evaluated, bestThought }
  } catch (error) {
    console.error('❌ ToT 执行失败:', error)
    throw error
  }
}

// ========== 示例3: ReAct - 专利检索 ==========

async function example3_ReAct_PatentSearch() {
  console.log('\n' + '='.repeat(80))
  console.log('示例 3: ReAct - 专利检索循环（使用 OMLX 本地模型）')
  console.log('='.repeat(80))

  const llm = OMXLModelFactory.createForTask('patent_retrieval')
  const reactLoop = new ReActLoop(llm, {
    maxIterations: 5,
    verbose: false,
    reflectAfterStep: true,
  })

  const goal = '检索"自适应滤波器"在通信领域的现有技术'

  console.log('\n📋 任务目标：检索"自适应滤波器"在通信领域的现有技术\n')

  try {
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
          console.log(
            `✅ 结果: ${JSON.stringify(iteration.actionResult.data).substring(0, 100)}...`
          )
        } else {
          console.log(`❌ 错误: ${iteration.actionResult.error}`)
        }
      }

      console.log('')

      if (iteration.done) break
    }

    console.log(`\n✅ 检索完成！共执行 ${iterations.length} 次迭代`)

    return iterations
  } catch (error) {
    console.error('❌ ReAct 执行失败:', error)
    throw error
  }
}

// ========== 示例4: Reflection - 权利要求质检 ==========

async function example4_Reflection_QualityCheck() {
  console.log('\n' + '='.repeat(80))
  console.log('示例 4: Reflection - 权利要求书质量检查（使用 OMLX 本地模型）')
  console.log('='.repeat(80))

  const llm = OMXLModelFactory.createForTask('patent_writing')
  const reflection = new EnhancedReflection(llm, {
    maxIterations: 3,
    iterationThreshold: 0.7,
    enabledDimensions: [
      ReflectionDimension.QUALITY,
      ReflectionDimension.COMPLETENESS,
      ReflectionDimension.CONSISTENCY,
    ],
    useDeepAnalysis: true,
  })

  const claimDraft = {
    type: 'independent',
    content: `
1. 一种基于深度学习的图像识别装置，其特征在于，包括：
   深度学习模块，用于对输入图像进行特征提取；
   分类模块，用于基于所述特征对图像进行分类；
   其中，所述深度学习模块采用卷积神经网络架构。
    `.trim(),
  }

  const context = createMockContext('PatentWriterAgent')

  console.log('\n📋 权利要求初稿：')
  console.log(claimDraft.content)

  console.log('\n🔍 开始多维度评估...\n')

  try {
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
  } catch (error) {
    console.error('❌ Reflection 执行失败:', error)
    throw error
  }
}

// ========== 示例5: 四策略组合使用（简化版）==========

async function example5_CombinedWorkflow() {
  console.log('\n' + '='.repeat(80))
  console.log('示例 5: 四策略组合使用 - 简化的专利撰写流程（使用 OMLX 本地模型）')
  console.log('='.repeat(80))

  const llm = OMXLModelFactory.createForTask('patent_writing')
  const context = createMockContext('PatentAgent')

  const invention = {
    title: '基于区块链的数字版权保护系统',
    features: ['分布式存储', '智能合约', '数字水印'],
  }

  console.log('\n🎯 发明信息：')
  console.log(`  标题: ${invention.title}`)
  console.log(`  核心特征: ${invention.features.join(', ')}`)

  try {
    // 步骤1: CoT - 技术理解和创造性分析
    console.log('\n📍 步骤1: 使用 CoT 分析创造性')
    const cot = new ChainOfThoughtStrategy(llm, { verbose: false })
    const cotResult = await cot.reason(`分析发明"${invention.title}"的创造性`, {
      domain: '专利分析',
    })
    console.log(`  ✅ CoT 分析完成，置信度: ${(cotResult.confidence * 100).toFixed(1)}%`)
    console.log(`  结论: ${cotResult.conclusion.substring(0, 80)}...`)

    // 步骤2: ToT - 权利要求布局方案（简化）
    console.log('\n📍 步骤2: 使用 ToT 设计布局方案')
    const tot = new TreeOfThoughtsStrategy(llm, { verbose: false })
    const thoughts = await tot.generateThoughts(
      `为"${invention.title}"设计权利要求布局`,
      2 // 减少分支数量以加快速度
    )
    console.log(`  ✅ ToT 完成，生成了 ${thoughts.length} 个布局方案`)
    thoughts.forEach((t, i) => {
      console.log(`     方案${i + 1}: ${t.thought.substring(0, 60)}... (评分: ${t.score}/10)`)
    })

    // 步骤3: Reflection - 质量检查
    console.log('\n📍 步骤3: 使用 Reflection 进行质量检查')
    const reflection = new EnhancedReflection(llm, { verbose: false })
    const draft = {
      title: invention.title,
      claims: thoughts.map((t) => t.thought).join('\n'),
      features: invention.features,
    }
    const qualityReport = await reflection.reflect(draft, context, '专利申请质量检查')
    console.log(`  ✅ Reflection 完成，质量评分: ${(qualityReport.overallScore * 100).toFixed(1)}%`)

    console.log('\n' + '='.repeat(80))
    console.log('📊 组合流程总结：')
    console.log('  CoT (创造性分析) → ToT (布局设计) → Reflection (质量检查)')
    console.log(`  ✅ 全部完成！最终质量评分: ${(qualityReport.overallScore * 100).toFixed(1)}%`)
    console.log('='.repeat(80))

    return {
      cotResult,
      thoughts,
      qualityReport,
    }
  } catch (error) {
    console.error('❌ 组合流程执行失败:', error)
    throw error
  }
}

// ========== 主程序 ==========

async function main() {
  // 检查 OMLX 服务
  const baseURL = process.env.OMXL_BASE_URL || 'http://localhost:8009/v1'
  console.log(`\n🚀 专利场景推理策略示例 - 使用本地 OMLX 模型`)
  console.log(`🤖 LLM: OMLX 本地模型 (${baseURL})`)
  console.log(`📅 时间: ${new Date().toLocaleString('zh-CN')}`)

  // 测试 OMLX 服务连接
  console.log('\n🔍 检查 OMLX 服务连接...')
  try {
    const apiKey = process.env.OMXL_API_KEY
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`
    }

    const response = await fetch(`${baseURL}/models`, { headers })
    if (!response.ok) {
      throw new Error(`OMXL 服务返回错误: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    console.log('✅ OMLX 服务连接正常')

    // 显示可用模型
    if (data && data.data && Array.isArray(data.data)) {
      console.log(`📦 可用模型数量: ${data.data.length}`)
      data.data.forEach((model: any) => {
        console.log(`   - ${model.id}`)
      })
    }
  } catch (error) {
    console.error('❌ 无法连接到 OMLX 服务，请确保：')
    console.error('   1. OMLX 服务已启动（端口 8009）')
    console.error('   2. 环境变量 OMXL_BASE_URL 正确设置')
    console.error('   3. 环境变量 OMXL_API_KEY 正确设置')
    console.error(`   当前配置: ${baseURL}`)
    console.error(`   API Key: ${process.env.OMXL_API_KEY ? '已设置' : '未设置'}`)
    process.exit(1)
  }

  try {
    // 示例1: CoT - 创造性判断
    await example1_CoT_CreativityJudgment()

    // 示例2: ToT - 权利要求布局
    await example2_ToT_ClaimLayout()

    // 示例3: ReAct - 专利检索
    await example3_ReAct_PatentSearch()

    // 示例4: Reflection - 质量检查
    await example4_Reflection_QualityCheck()

    // 示例5: 四策略组合（简化版）
    await example5_CombinedWorkflow()

    console.log('\n' + '='.repeat(80))
    console.log('🎉 所有示例运行完成！本地 OMLX 模型测试成功！')
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
