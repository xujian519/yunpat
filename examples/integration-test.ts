/**
 * PatentWriterAgent 集成测试示例
 *
 * 测试知识库增强和提示词模板懒加载功能
 */

import {
  PatentWriterAgent,
  type PatentWritingInput,
} from '../patents/agents/writer/PatentWriterAgent'
import { createDeepSeekModel } from '../packages/core/src/llm/NativeLLMAdapter'

/**
 * 睿羿科技专利案例 - 便携式智能牙刷
 *
 * 这是一个真实的技术交底书案例，用于测试专利撰写功能
 */
const ruiyiTestCase: PatentWritingInput = {
  title: '一种便携式智能牙刷及其控制方法',
  field: '日用品/智能家居',
  applicant: '睿羿科技有限公司',
  inventors: ['张三', '李四'],
  technicalDisclosure: `
## 技术领域
本发明涉及牙刷技术领域，尤其涉及一种便携式智能牙刷及其控制方法。

## 背景技术
现有电动牙刷存在以下问题：
1. 体积较大，不便携
2. 需要定期更换电池，不环保
3. 缺乏智能提醒功能，用户难以掌握刷牙时间
4. 充电接口容易进水，导致设备损坏

## 发明内容
本发明提供一种便携式智能牙刷，包括：
- 手柄部：内置可充电电池和微型电机
- 刷头部：可拆卸连接手柄部，采用超声波震动技术
- 控制模块：包括定时器、压力传感器、无线通信模块
- 充电接口：采用磁吸式防水设计

核心创新点：
1. 采用磁吸式充电，解决防水问题
2. 内置压力传感器，防止用力过猛损伤牙龈
3. 通过手机APP记录刷牙数据，提供个性化建议
4. 采用超声波震动技术，清洁效率提升50%

## 技术效果
与现有技术相比，本发明具有以下有益效果：
1. 便携性提升30%，重量仅为80g
2. 防水等级达到IPX7
3. 刷牙效率提升50%
4. 续航时间达到90天
  `,
  drawings: [
    '图1：便携式智能牙刷整体结构示意图',
    '图2：手柄部内部结构剖面图',
    '图3：控制模块电路框图',
    '图4：磁吸式充电接口结构示意图',
    '图5：智能控制方法流程图',
  ],
}

/**
 * 运行集成测试
 */
async function runIntegrationTest() {
  console.log('🧪 [集成测试] PatentWriterAgent 知识库增强 + 懒加载\n')

  // 1. 初始化 LLM
  console.log('1️⃣ 初始化 LLM...')
  const llm = createDeepSeekModel(process.env.DEEPSEEK_API_KEY || '')
  console.log('   ✅ LLM 初始化完成\n')

  // 2. 初始化 PatentWriterAgent
  console.log('2️⃣ 初始化 PatentWriterAgent...')
  const agent = new PatentWriterAgent({
    llm,
    enableKnowledge: true, // 启用知识库
    enableTemplates: true, // 启用提示词模板
    knowledgeBasePath: process.env.KNOWLEDGE_BASE_PATH,
    templateDir: './prompts/patent-drafting',
  })
  console.log('   ✅ Agent 初始化完成\n')

  // 3. 检查初始缓存状态
  console.log('3️⃣ 检查初始缓存状态...')
  const initialStats = agent.getCacheStats()
  console.log('   提示词模板缓存:', initialStats.promptManager)
  console.log('   知识库缓存:', initialStats.knowledge)
  console.log('')

  // 4. 执行专利撰写
  console.log('4️⃣ 执行专利撰写...')
  console.log('   ========================================\n')

  const startTime = Date.now()

  try {
    const result = await agent.execute(ruiyiTestCase, {
      llm,
      tools: null,
    })

    const duration = (Date.now() - startTime) / 1000

    console.log('\n   ========================================')
    console.log('   ✅ 专利撰写完成\n')

    // 5. 输出撰写结果
    console.log('5️⃣ 撰写结果统计:')
    console.log(`   ⏱️  耗时: ${Math.round(duration)}秒`)
    console.log(`   📝 权利要求数: ${result.metrics.claimsCount}`)
    console.log(`   📄 说明书字数: ${result.metrics.descriptionWordCount}`)
    console.log(`   ⭐ 质量评分: ${result.metrics.qualityScore}/100`)
    console.log('')

    // 6. 检查最终缓存状态
    console.log('6️⃣ 检查最终缓存状态...')
    const finalStats = agent.getCacheStats()
    console.log('   提示词模板缓存:', finalStats.promptManager)
    console.log('   知识库缓存:', finalStats.knowledge)
    console.log('')

    // 7. 输出权利要求预览
    console.log('7️⃣ 权利要求预览:')
    result.patentApplication.claims.slice(0, 2).forEach((claim, index) => {
      console.log(`   ${index + 1}. [${claim.type === 'independent' ? '独立' : '从属'}]`)
      console.log(`      ${claim.content.substring(0, 100)}...`)
    })
    console.log('')

    // 8. 输出摘要预览
    console.log('8️⃣ 摘要预览:')
    console.log(`   ${result.patentApplication.abstract.substring(0, 200)}...`)
    console.log('')

    console.log('✅ 集成测试完成！')
  } catch (error) {
    console.error('❌ 测试失败:', error)
    throw error
  }
}

/**
 * 测试懒加载策略
 */
async function testLazyLoadingStrategy() {
  console.log('\n🧪 [懒加载测试] 测试分步加载策略\n')

  const llm = createDeepSeekModel(process.env.DEEPSEEK_API_KEY || '')

  const agent = new PatentWriterAgent({
    llm,
    enableKnowledge: true,
    enableTemplates: true,
    knowledgeBasePath: process.env.KNOWLEDGE_BASE_PATH,
    templateDir: './prompts/patent-drafting',
  })

  console.log('📊 加载策略:')
  console.log('   Stage 1 (planning): preload [03-creativity-analysis]')
  console.log('   Stage 2 (claims): onDemand [01-claims-generation]')
  console.log('   Stage 3 (specification): onDemand [02-specification-drafting]')
  console.log('   Stage 4 (quality): lazy [all templates]')
  console.log('')

  // 检查初始状态
  let stats = agent.getCacheStats()
  console.log('初始状态:')
  console.log(`   已加载模板: ${stats.promptManager?.templates || 0}个`)
  console.log('')

  // 执行撰写
  const result = await agent.execute(ruiyiTestCase, { llm, tools: null })

  // 检查最终状态
  stats = agent.getCacheStats()
  console.log('最终状态:')
  console.log(`   已加载模板: ${stats.promptManager?.templates || 0}个`)
  console.log(
    `   加载时间: ${stats.promptManager?.loadedAt?.map((t: any) => `${t.name}: ${t.loadedAt}`).join('\n                ') || 'N/A'}`
  )
  console.log('')

  console.log('✅ 懒加载测试完成！')
}

/**
 * 测试知识库增强
 */
async function testKnowledgeEnhancement() {
  console.log('\n🧪 [知识库测试] 测试知识库增强功能\n')

  const llm = createDeepSeekModel(process.env.DEEPSEEK_API_KEY || '')

  const agent = new PatentWriterAgent({
    llm,
    enableKnowledge: true,
    enableTemplates: false, // 关闭模板，只测试知识库
    knowledgeBasePath: process.env.KNOWLEDGE_BASE_PATH,
  })

  console.log('📚 知识库查询测试:')
  console.log('   查询: "什么是创造性"')
  console.log('   查询: "什么是充分公开"')
  console.log('')

  try {
    const result = await agent.execute(ruiyiTestCase, { llm, tools: null })

    console.log('✅ 知识库增强测试完成！')
    console.log(`   生成了 ${result.metrics.claimsCount} 项权利要求`)
    console.log(`   说明书长度: ${result.metrics.descriptionWordCount} 字`)
  } catch (error) {
    console.error('❌ 测试失败:', error)
    throw error
  }
}

// 主函数
async function main() {
  try {
    // 完整集成测试
    await runIntegrationTest()

    // 懒加载测试
    await testLazyLoadingStrategy()

    // 知识库增强测试
    await testKnowledgeEnhancement()

    console.log('\n🎉 所有测试完成！\n')
  } catch (error) {
    console.error('\n💥 测试失败:', error)
    process.exit(1)
  }
}

// 如果直接运行此文件
if (require.main === module) {
  main()
}

export { runIntegrationTest, testLazyLoadingStrategy, testKnowledgeEnhancement }
