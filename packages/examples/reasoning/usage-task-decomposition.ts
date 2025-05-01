/**
 * 目标分解系统使用示例
 *
 * 展示如何使用 TaskDecomposer、DependencyAnalyzer 和 TaskScheduler
 */

import { TaskDecomposer } from '../packages/core/src/planning/TaskDecomposer.js'
import { DependencyAnalyzer } from '../packages/core/src/planning/DependencyAnalyzer.js'
import { TaskScheduler } from '../packages/core/src/planning/TaskScheduler.js'
import { createDeepSeekModel } from '../packages/core/src/llm/NativeLLMAdapter.js'

/**
 * 示例1：基础目标分解
 */
async function example1_BasicDecomposition() {
  console.log('🎯 示例1: 基础目标分解\n')

  const decomposer = new TaskDecomposer({
    maxDepth: 3,
    domain: 'general',
  })

  const plan = await decomposer.decompose('撰写一篇技术博客文章')

  console.log(`✅ 分解完成:`)
  console.log(`   子目标数: ${plan.subGoals.length}`)
  console.log(`   总任务数: ${plan.subGoals.reduce((sum, g) => sum + g.tasks.length, 0)}`)
  console.log(`   预估时长: ${(plan.estimatedDuration / 60).toFixed(1)} 分钟`)
  console.log(`   预估 Tokens: ${plan.estimatedTokens}`)

  console.log(`\n📋 子目标列表:`)
  plan.subGoals.forEach((goal, i) => {
    console.log(`   ${i + 1}. ${goal.title}`)
    console.log(`      任务数: ${goal.tasks.length}`)
    console.log(`      优先级: ${goal.priority}`)
    console.log(`      预估时间: ${(goal.estimatedDuration / 60).toFixed(1)} 分钟`)
  })
}

/**
 * 示例2：专利撰写任务分解
 */
async function example2_PatentWriting() {
  console.log('\n🎯 示例2: 专利撰写任务分解\n')

  const patentDecomposer = new TaskDecomposer({
    domain: 'patent',
    maxDepth: 3,
  })

  const plan = await patentDecomposer.decompose('撰写图像识别专利')

  console.log(`✅ 专利撰写分解完成:`)
  console.log(`   子目标数: ${plan.subGoals.length}`)

  console.log(`\n📋 专利撰写子目标:`)
  plan.subGoals.forEach((goal, i) => {
    console.log(`   ${i + 1}. ${goal.title}`)
    console.log(`      描述: ${goal.description}`)
    console.log(`      任务: ${goal.tasks.map((t) => t.title).join(', ')}`)
  })
}

/**
 * 示例3：依赖分析和调度
 */
async function example3_DependencyAnalysisAndScheduling() {
  console.log('\n🎯 示例3: 依赖分析和调度\n')

  const decomposer = new TaskDecomposer({
    maxDepth: 2,
  })

  const plan = await decomposer.decompose('开发新功能')

  // 依赖分析
  const analyzer = new DependencyAnalyzer({
    detectCycles: true,
    autoFixCycles: false,
  })

  const depStats = analyzer.getStats(plan.dependencies)

  console.log(`📊 依赖分析结果:`)
  console.log(`   节点数: ${depStats.totalNodes}`)
  console.log(`   依赖边数: ${depStats.totalEdges}`)
  console.log(`   平均度: ${depStats.avgDegree.toFixed(2)}`)
  console.log(`   最大度: ${depStats.maxDegree}`)
  console.log(`   循环依赖: ${depStats.hasCycles ? '是' : '否'}`)
  console.log(`   关键路径长度: ${depStats.criticalPathLength}`)

  // 任务调度
  const scheduler = new TaskScheduler({
    strategy: 'topological',
    maxParallelTasks: 3,
  })

  const scheduleResult = scheduler.schedule(plan)

  console.log(`\n⚙️ 调度结果:`)
  console.log(`   执行顺序: ${scheduleResult.executionOrder.join(' → ')}`)
  console.log(`   并行组数: ${scheduleResult.parallelGroups.length}`)
  console.log(`   关键路径: ${scheduleResult.criticalPath.join(' → ')}`)
  console.log(`   资源利用率: ${(scheduleResult.resourceUtilization * 100).toFixed(1)}%`)

  // 进度跟踪
  const progress = scheduler.getProgress(plan)
  console.log(`\n📈 执行进度:`)
  console.log(`   总任务: ${progress.totalTasks}`)
  console.log(`   已完成: ${progress.completedTasks}`)
  console.log(`   进度: ${(progress.progress * 100).toFixed(1)}%`)
}

/**
 * 示例4：不同调度策略对比
 */
async function example4_SchedulingStrategies() {
  console.log('\n🎯 示例4: 不同调度策略对比\n')

  const decomposer = new TaskDecomposer({
    maxDepth: 2,
  })

  const plan = await decomposer.decompose('复杂项目')

  const strategies = ['topological', 'priority', 'critical_path', 'parallel'] as const

  for (const strategy of strategies) {
    console.log(`\n📊 ${strategy} 策略:`)

    const scheduler = new TaskScheduler({
      strategy,
      maxParallelTasks: 3,
    })

    const result = scheduler.schedule(plan)

    console.log(
      `   执行顺序: ${result.executionOrder.slice(0, 3).join(' → ')}${result.executionOrder.length > 3 ? '...' : ''}`
    )
    console.log(`   并行组数: ${result.parallelGroups.length}`)
    console.log(`   关键路径长度: ${result.criticalPath.length}`)
    console.log(`   资源利用率: ${(result.resourceUtilization * 100).toFixed(1)}%`)
    console.log(`   预估完成时间: ${(result.estimatedCompletionTime / 60).toFixed(1)} 分钟`)
  }
}

/**
 * 示例5：智能分解（使用LLM）
 */
async function example5_IntelligentDecomposition() {
  console.log('\n🎯 示例5: 智能分解（使用LLM）\n')

  const llm = createDeepSeekModel(process.env.DEEPSEEK_API_KEY || 'sk-test')

  const intelligentDecomposer = new TaskDecomposer({
    llm,
    enableIntelligentDecomposition: true,
    maxDepth: 3,
  })

  console.log('⚠️ 注意: 智能分解需要有效的 API key')

  try {
    const plan = await intelligentDecomposer.decompose('构建电商网站')

    console.log(`✅ 智能分解完成:`)
    console.log(`   子目标数: ${plan.subGoals.length}`)
    console.log(`   总任务数: ${plan.subGoals.reduce((sum, g) => sum + g.tasks.length, 0)}`)

    console.log(`\n📋 智能分解结果:`)
    plan.subGoals.forEach((goal, i) => {
      console.log(`   ${i + 1}. ${goal.title}`)
      goal.tasks.forEach((task, j) => {
        console.log(`      ${j + 1}. ${task.title} (${task.type})`)
      })
    })
  } catch (error) {
    console.error(`❌ 智能分解失败: ${(error as Error).message}`)
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('🎯 YunPat 目标分解系统演示\n')
  console.log('='.repeat(70))

  try {
    await example1_BasicDecomposition()
    await example2_PatentWriting()
    await example3_DependencyAnalysisAndScheduling()
    await example4_SchedulingStrategies()
    await example5_IntelligentDecomposition()

    console.log('\n' + '='.repeat(70))
    console.log('🎉 演示完成！\n')

    console.log('✅ 核心功能：')
    console.log('  ✅ 目标分解：将高层目标分解为可执行的子目标和任务')
    console.log('  ✅ 依赖分析：自动检测任务间的依赖关系')
    console.log('  ✅ 任务调度：支持多种调度策略（拓扑排序、优先级、关键路径、并行）')
    console.log('  ✅ 进度跟踪：实时跟踪任务执行进度')
    console.log('  ✅ 领域特定：支持专利撰写、研究任务等特定领域的分解规则')

    console.log('\n📝 使用方式：')
    console.log('  1. 创建 TaskDecomposer 实例')
    console.log('  2. 调用 decompose() 方法分解目标')
    console.log('  3. 使用 DependencyAnalyzer 分析依赖关系')
    console.log('  4. 使用 TaskScheduler 生成执行计划')
    console.log('  5. 跟踪进度并执行任务')
  } catch (error) {
    console.error('\n❌ 演示失败:', (error as Error).message)
  }
}

// 运行演示
main()
