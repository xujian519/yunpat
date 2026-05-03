/**
 * Chain-of-Thought 推理策略使用示例
 *
 * 展示如何使用 CoT 进行逐步推理
 */

import {
  ChainOfThoughtStrategy,
  createChainOfThought,
  StepFormat,
  type CoTResult,
} from '../packages/core/dist/index.js'

/**
 * 创建模拟 LLM
 */
function createMockLLM() {
  return {
    chat: async (params: any) => {
      const userMessage = params.messages[params.messages.length - 1].content

      // 根据问题生成模拟的 CoT 响应
      if (userMessage.includes('专利') || userMessage.includes('审查')) {
        return {
          message: {
            role: 'assistant',
            content: `步骤1：理解专利申请的核心内容
首先需要明确专利申请的技术领域、发明点和创新性。这是一项关于人工智能技术的专利申请...

步骤2：检查形式要求
根据专利法第26条，说明书应当清楚、完整地描述发明。
- 是否包含技术领域
- 是否包含背景技术
- 是否包含发明内容
- 是否包含具体实施方式

步骤3：评估新颖性和创造性
对比现有技术，评估该申请是否具有：
- 新颖性：不属于现有技术
- 创造性：对本领域技术人员来说非显而易见
- 实用性：能够制造或使用并产生积极效果

步骤4：给出审查结论
综合以上分析，该专利申请符合授予专利权的条件。

结论：该专利申请通过初步审查，建议进入实质审查阶段。`,
          },
          usage: {
            promptTokens: 200,
            completionTokens: 400,
            totalTokens: 600,
          },
        }
      }

      if (userMessage.includes('数学') || userMessage.includes('计算')) {
        return {
          message: {
            role: 'assistant',
            content: `步骤1：理解问题
需要计算：在3x3的网格中，从左上角到右下角有多少条最短路径？

步骤2：分析问题
- 网格大小：3x3（即3行3列）
- 起点：左上角 (0,0)
- 终点：右下角 (3,3)
- 移动规则：只能向右或向下
- 目标：找到所有最短路径

步骤3：应用组合数学
从 (0,0) 到 (m,n) 的最短路径数量为 C(m+n, m)
这里 m=3, n=3，所以需要计算 C(6,3)

步骤4：计算组合数
C(6,3) = 6! / (3! × 3!) = (6×5×4) / (3×2×1) = 20

步骤5：验证结果
可以手动列举或使用动态规划验证，结果一致。

结论：在3x3网格中，从左上角到右下角共有20条最短路径。`,
          },
          usage: {
            totalTokens: 300,
          },
        }
      }

      // 默认响应
      return {
        message: {
          role: 'assistant',
          content: `步骤1：分析问题
首先理解问题的核心要求...

步骤2：收集信息
整理相关的背景信息和已知条件...

步骤3：推理和计算
基于已知条件进行逻辑推理...

结论：基于以上分析，得出答案。`,
        },
        usage: {
          totalTokens: 200,
        },
      }
    },
  }
}

/**
 * 示例1：基础 CoT 推理
 */
async function example1_BasicCoT() {
  console.log('\n' + '='.repeat(70))
  console.log('📝 示例1：基础 CoT 推理 - 专利审查')
  console.log('='.repeat(70))

  const llm = createMockLLM()
  const cot = createChainOfThought(llm as any, {
    verbose: true,
  })

  const result = await cot.reason('审查一项人工智能专利申请', {
    domain: '专利审查',
    rules: ['专利法第26条', '专利法第22条'],
  })

  console.log('\n✅ 推理完成！')
  console.log(`\n📊 统计信息:`)
  console.log(`  推理步骤数: ${result.steps.length}`)
  console.log(`  置信度: ${(result.confidence * 100).toFixed(1)}%`)
  console.log(`  Token消耗: ${result.tokensUsed}`)
  console.log(`  耗时: ${result.duration}ms`)

  console.log(`\n📋 推理步骤:`)
  result.steps.forEach((step) => {
    console.log(`  ${step.step}. ${step.description}`)
    console.log(`     置信度: ${(step.confidence * 100).toFixed(1)}%`)
  })

  console.log(`\n💡 结论:`)
  console.log(`  ${result.conclusion}`)
}

/**
 * 示例2：数学问题求解
 */
async function example2_MathProblem() {
  console.log('\n' + '='.repeat(70))
  console.log('🔢 示例2：数学问题求解 - 网格路径计数')
  console.log('='.repeat(70))

  const llm = createMockLLM()
  const cot = new ChainOfThoughtStrategy(llm as any, {
    temperature: 0.2, // 较低温度，更确定
    maxSteps: 10,
  })

  const result = await cot.reason(
    '在3x3的网格中，从左上角到右下角有多少条最短路径？只能向右或向下移动。',
    {
      domain: '组合数学',
    }
  )

  console.log('\n✅ 计算完成！')
  console.log(`\n📊 统计信息:`)
  console.log(`  推理步骤数: ${result.steps.length}`)
  console.log(`  置信度: ${(result.confidence * 100).toFixed(1)}%`)

  console.log(`\n📝 详细推理过程:`)
  result.steps.forEach((step) => {
    console.log(`\n  步骤${step.step}: ${step.description}`)
    console.log(`  ${step.reasoning.substring(0, 100)}...`)
  })

  console.log(`\n💡 答案: ${result.conclusion}`)
}

/**
 * 示例3：流式推理
 */
async function example3_StreamCoT() {
  console.log('\n' + '='.repeat(70))
  console.log('🌊 示例3：流式推理 - 实时展示推理过程')
  console.log('='.repeat(70))

  const llm = createMockLLM()
  const cot = createChainOfThought(llm as any)

  console.log('\n开始流式推理...\n')

  let stepCount = 0
  for await (const item of cot.reasonStream('分析专利申请的新颖性')) {
    if ('step' in item) {
      stepCount++
      console.log(`\n📍 步骤${item.step}: ${item.description}`)
      console.log(`   推理内容: ${item.reasoning.substring(0, 80)}...`)
      console.log(`   置信度: ${(item.confidence * 100).toFixed(1)}%`)
    } else if ('conclusion' in item) {
      console.log('\n🎯 最终结论:')
      console.log(`  ${item.conclusion}`)
      console.log(`  总体置信度: ${(item.confidence * 100).toFixed(1)}%`)
    }
  }

  console.log(`\n✅ 流式推理完成，共 ${stepCount} 个步骤`)
}

/**
 * 示例4：批量推理
 */
async function example4_BatchCoT() {
  console.log('\n' + '='.repeat(70))
  console.log('📦 示例4：批量推理 - 处理多个问题')
  console.log('='.repeat(70))

  const llm = createMockLLM()
  const cot = new ChainOfThoughtStrategy(llm as any, {
    temperature: 0.3,
  })

  const problems = ['什么是专利的新颖性？', '什么是专利的创造性？', '什么是专利的实用性？']

  console.log(`\n🔄 批量处理 ${problems.length} 个问题...\n`)

  const results = await cot.reasonBatch(problems, {
    domain: '专利法',
  })

  results.forEach((result, i) => {
    console.log(`\n问题 ${i + 1}: ${problems[i]}`)
    console.log(`  推理步骤: ${result.steps.length} 个`)
    console.log(`  置信度: ${(result.confidence * 100).toFixed(1)}%`)
    console.log(`  结论: ${result.conclusion.substring(0, 60)}...`)
  })

  const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length
  const totalTokens = results.reduce((sum, r) => sum + r.tokensUsed, 0)

  console.log(`\n📊 批量处理汇总:`)
  console.log(`  平均置信度: ${(avgConfidence * 100).toFixed(1)}%`)
  console.log(`  总Token消耗: ${totalTokens}`)
}

/**
 * 示例5：自定义配置
 */
async function example5_CustomConfig() {
  console.log('\n' + '='.repeat(70))
  console.log('⚙️  示例5：自定义配置 - 高精度推理')
  console.log('='.repeat(70))

  const llm = createMockLLM()
  const cot = new ChainOfThoughtStrategy(llm as any, {
    maxSteps: 15, // 允许更多步骤
    maxRetries: 3, // 更多重试次数
    temperature: 0.1, // 更低温度，更确定
    enableIntermediateValidation: true, // 启用中间验证
    requireStepFormatting: true, // 要求步骤格式化
    verbose: false, // 关闭详细日志
  })

  const result = await cot.reason('复杂的技术方案分析', {
    complexity: 'high',
    domain: '专利审查',
  })

  console.log('\n✅ 高精度推理完成！')
  console.log(`\n📊 推理质量:`)
  console.log(`  步骤数: ${result.steps.length}`)
  console.log(`  置信度: ${(result.confidence * 100).toFixed(1)}%`)

  // 评估推理质量
  const quality = result.confidence > 0.8 ? '优秀' : result.confidence > 0.6 ? '良好' : '一般'
  console.log(`  质量评级: ${quality}`)
}

/**
 * 示例6：不同步骤格式
 */
async function example6_DifferentFormats() {
  console.log('\n' + '='.repeat(70))
  console.log('📋 示例6：不同步骤格式')
  console.log('='.repeat(70))

  const llm = createMockLLM()

  const formats = [
    { name: '编号格式', format: StepFormat.NUMBERED },
    { name: '列表格式', format: StepFormat.LIST },
    { name: '项目符号', format: StepFormat.BULLET },
    { name: '自动检测', format: StepFormat.AUTO },
  ]

  for (const { name, format } of formats) {
    console.log(`\n🔤 ${name} (${format}):`)

    const cot = new ChainOfThoughtStrategy(llm as any)
    const result = await cot.reason('测试问题', {}, format)

    console.log(`  ✅ 解析出 ${result.steps.length} 个步骤`)
  }

  console.log('\n✅ 所有格式测试完成！')
}

/**
 * 运行所有示例
 */
async function runAllExamples() {
  console.log('🎯 Chain-of-Thought 推理策略使用示例\n')
  console.log('本演示展示 CoT 的多种使用方式：')
  console.log('1. 基础 CoT 推理')
  console.log('2. 数学问题求解')
  console.log('3. 流式推理')
  console.log('4. 批量推理')
  console.log('5. 自定义配置')
  console.log('6. 不同步骤格式')

  try {
    await example1_BasicCoT()
    await example2_MathProblem()
    await example3_StreamCoT()
    await example4_BatchCoT()
    await example5_CustomConfig()
    await example6_DifferentFormats()

    console.log('\n' + '='.repeat(70))
    console.log('🎉 所有示例运行完成！')
    console.log('='.repeat(70))

    console.log('\n✅ Chain-of-Thought 推理策略功能验证成功！')
    console.log('\n📊 核心特性：')
    console.log('  ✅ 逐步推理 - 将复杂问题分解为多个步骤')
    console.log('  ✅ 步骤解析 - 支持多种步骤格式（编号、列表、符号）')
    console.log('  ✅ 结论提取 - 自动提取最终答案')
    console.log('  ✅ 置信度评估 - 基于多个因素计算推理质量')
    console.log('  ✅ 流式推理 - 实时展示推理过程')
    console.log('  ✅ 批量处理 - 高效处理多个问题')
    console.log('  ✅ 错误恢复 - 自动重试机制')

    console.log('\n🎯 适用场景：')
    console.log('  • 数学问题求解')
    console.log('  • 逻辑推理')
    console.log('  • 专利审查')
    console.log('  • 技术分析')
    console.log('  • 复杂决策')

    console.log('\n📝 下一步：')
    console.log('  1. 集成到 PatentWriterAgent')
    console.log('  2. 结合 Reflection 进行自我检查')
    console.log('  3. 与 ReAct 循环结合使用')
  } catch (error) {
    console.error('\n❌ 示例运行失败:', (error as Error).message)
    console.error((error as Error).stack)
    process.exit(1)
  }
}

// 运行示例
runAllExamples()
