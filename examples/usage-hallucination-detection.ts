/**
 * 幻觉检测系统使用示例
 *
 * 展示如何使用 HallucinationDetector 检测专利文档中的幻觉、事实错误和逻辑不一致
 */

import { createDeepSeekModel } from '../packages/core/dist/index.js'
import { KnowledgeBase, createKnowledgeBase } from '../packages/core/dist/index.js'
import { EventBus } from '../packages/core/dist/eventbus/index.js'
import {
  HallucinationDetector,
  FactChecker,
  LogicalConsistencyChecker,
  SourceAttributionValidator,
} from '../packages/core/dist/validation/index.js'

/**
 * 示例1: 基础幻觉检测
 */
async function example1_BasicDetection() {
  console.log('🔍 示例1: 基础幻觉检测\n')

  // 1. 创建依赖
  const llm = createDeepSeekModel(process.env.DEEPSEEK_API_KEY || 'sk-test')
  const eventBus = new EventBus()
  const knowledgeBase = createKnowledgeBase({
    enableEmbedding: false,
  })

  // 2. 初始化一些测试知识
  await knowledgeBase.store({
    id: 'kb-1',
    type: 'document',
    title: '专利法基础知识',
    content: '根据专利法第25条，授予专利权的条件是：新颖性、创造性和实用性。',
    category: 'legal',
    tags: ['专利法', '授权条件'],
    quality: 0.95,
  })

  await knowledgeBase.store({
    id: 'kb-2',
    type: 'document',
    title: '深度学习性能基准',
    content: '在ImageNet数据集上，深度学习模型的准确率通常超过90%。',
    category: 'technical',
    tags: ['深度学习', '性能'],
    quality: 0.9,
  })

  // 3. 创建幻觉检测器
  const detector = new HallucinationDetector(llm, knowledgeBase, {
    enableFactCheck: true,
    enableLogicalConsistencyCheck: true,
    enableSourceAttribution: true,
    factCheckThreshold: 0.7,
  })

  // 4. 准备测试内容（包含一些事实和潜在幻觉）
  const testContent = `
本发明涉及一种基于深度学习的图像识别方法。

根据专利法第25条，授予专利权的条件包括新颖性、创造性和实用性。
该方法的创新点在于采用了多层卷积神经网络架构。

在ImageNet数据集上，该模型的准确率达到95.2%，远超传统方法。

然而，该方法的缺点是计算复杂度较高，需要大量计算资源。
该方法的优点是计算复杂度较低，只需要少量计算资源。

该技术方案已在多个领域得到应用，包括医疗诊断、自动驾驶和工业检测。
  `

  // 5. 执行检测
  console.log('开始检测...\n')
  const report = await detector.detect(testContent)

  // 6. 输出报告
  console.log(detector.generateReport(report))

  return report
}

/**
 * 示例2: 批量检测多个文档
 */
async function example2_BatchDetection() {
  console.log('\n📚 示例2: 批量检测多个文档\n')

  const llm = createDeepSeekModel(process.env.DEEPSEEK_API_KEY || 'sk-test')
  const knowledgeBase = createKnowledgeBase()
  const detector = new HallucinationDetector(llm, knowledgeBase)

  // 准备多个测试文档
  const documents = [
    `
权利要求书：
1. 一种基于深度学习的图像识别方法，其特征在于：
   包括输入层、特征提取层和输出层；
   所述特征提取层采用卷积神经网络架构；
   所述卷积神经网络包括5个卷积层。
    `,
    `
说明书：
本发明公开了一种新型电池技术。
该电池的能量密度达到500Wh/kg，循环寿命超过2000次。

根据相关标准GB/T 1234-2020，该电池符合安全要求。

然而，该电池的能量密度仅为100Wh/kg。
    `,
    `
摘要：
本发明涉及一种自然语言处理技术。
该技术采用Transformer架构，在GLUE基准测试中达到92.5%的性能。

该方法的创新点在于采用了自注意力机制。
该方法的缺点是推理速度较慢。
该方法的优点是推理速度较快。
    `,
  ]

  // 批量检测
  console.log(`开始批量检测 ${documents.length} 个文档...\n`)

  const reports = await detector.detectBatch(documents, (completed, total) => {
    console.log(`进度: ${completed}/${total} (${((completed / total) * 100).toFixed(0)}%)`)
  })

  console.log('\n检测完成！\n')

  // 输出统计
  const stats = detector.getDetectorStats(reports)
  console.log('📊 批量检测统计:')
  console.log(`  总文档数: ${stats.totalReports}`)
  console.log(`  平均幻觉分数: ${(stats.avgScore * 100).toFixed(1)}%`)
  console.log(`  高风险文档: ${stats.highRiskCount}`)
  console.log(`  中风险文档: ${stats.mediumRiskCount}`)
  console.log(`  低风险文档: ${stats.lowRiskCount}`)
  console.log(`  平均检测耗时: ${stats.avgDuration.toFixed(0)}ms`)

  return reports
}

/**
 * 示例3: 快速检测
 */
async function example3_QuickCheck() {
  console.log('\n⚡ 示例3: 快速检测\n')

  const llm = createDeepSeekModel(process.env.DEEPSEEK_API_KEY || 'sk-test')
  const knowledgeBase = createKnowledgeBase()
  const detector = new HallucinationDetector(llm, knowledgeBase)

  const testContent = `
根据专利法第25条，授予专利权需要满足新颖性、创造性和实用性要求。
该技术方案采用深度学习算法，准确率达到95%。
  `

  // 快速检测
  const passed = await detector.quickCheck(testContent)

  console.log(`快速检测结果: ${passed ? '✅ 通过' : '❌ 未通过'}`)
  console.log(`(幻觉分数 ${passed ? '<' : '>='} 70%)`)

  return passed
}

/**
 * 示例4: 使用子检测器
 */
async function example4_UsingSubCheckers() {
  console.log('\n🔬 示例4: 使用子检测器\n')

  const llm = createDeepSeekModel(process.env.DEEPSEEK_API_KEY || 'sk-test')
  const knowledgeBase = createKnowledgeBase()

  // 事实验证器
  const factChecker = new FactChecker(llm, knowledgeBase)
  console.log('📝 事实验证器:')
  const factResults = await factChecker.verifyContent(`
该模型在ImageNet上的准确率达到95%。
该技术的能量密度为500Wh/kg。
  `)
  console.log(`验证了 ${factResults.length} 个声明`)
  const factStats = factChecker.getFactCheckStats(factResults)
  console.log(`验证率: ${(factStats.verificationRate * 100).toFixed(1)}%\n`)

  // 逻辑一致性检查器
  const logicChecker = new LogicalConsistencyChecker(llm)
  console.log('🔄 逻辑一致性检查器:')
  const inconsistencies = await logicChecker.checkConsistency(`
该方法的优点是计算复杂度较低。
该方法的缺点是计算复杂度较高。
  `)
  console.log(`发现 ${inconsistencies.length} 个逻辑问题`)
  if (inconsistencies.length > 0) {
    console.log(logicChecker.generateConsistencyReport(inconsistencies))
  }

  // 源归属验证器
  const attributionValidator = new SourceAttributionValidator(llm, knowledgeBase)
  console.log('📚 源归属验证器:')
  const attributionIssues = await attributionValidator.validateAttribution(`
根据专利法第25条规定，应当满足三性要求。
    `)
  console.log(`发现 ${attributionIssues.length} 个源归属问题`)
  if (attributionIssues.length > 0) {
    console.log(attributionValidator.generateAttributionReport(attributionIssues))
  }
}

/**
 * 运行所有示例
 */
async function main() {
  try {
    console.log('🎯 幻觉检测系统演示\n')
    console.log('本演示展示：')
    console.log('1. 基础幻觉检测 - 综合评估内容质量')
    console.log('2. 批量检测 - 处理多个文档')
    console.log('3. 快速检测 - 快速判断是否通过')
    console.log('4. 子检测器 - 使用独立的检测器\n')

    await example1_BasicDetection()
    await example2_BatchDetection()
    await example3_QuickCheck()
    await example4_UsingSubCheckers()

    console.log('\n' + '='.repeat(70))
    console.log('🎉 演示完成！')
    console.log('='.repeat(70))

    console.log('\n✅ 幻觉检测系统已就绪！')
    console.log('\n🎯 核心特性：')
    console.log('  ✅ 事实验证：验证技术事实、法律判例、统计数据')
    console.log('  ✅ 逻辑一致性检查：检测矛盾、重复、逻辑断层')
    console.log('  ✅ 源归属验证：确保所有声明都有可信来源')
    console.log('  ✅ 综合评分：0-1分数，越低幻觉越少')
    console.log('  ✅ 改进建议：自动生成可操作的改进建议')

    console.log('\n📝 使用方式：')
    console.log('  1. 创建 HallucinationDetector 实例')
    console.log('  2. 调用 detect() 方法进行完整检测')
    console.log('  3. 调用 quickCheck() 进行快速检测')
    console.log('  4. 使用 generateReport() 生成可读报告')
  } catch (error) {
    console.error('\n❌ 演示失败:', (error as Error).message)
    console.error('请确保：')
    console.error('  1. 已设置 DEEPSEEK_API_KEY 环境变量')
    console.error('  2. 已正确构建项目 (pnpm build)')
    console.error('  3. 知识库已正确配置')
  }
}

// 运行演示
main()
