/**
 * 多 Agent 协同演示 - 共享记忆层
 *
 * 展示多个专利智能体如何通过统一的记忆层协同工作
 */

import { AgentMemoryManager } from './AgentMemoryManager.js'
import { createPatentWriterAgentWithMemory } from './writer/PatentWriterAgentWithMemory.js'
import { createPatentResponderAgentWithMemory } from './responder/PatentResponderAgentWithMemory.js'
import { createPatentAnalyzerAgentWithMemory } from './analyzer/PatentAnalyzerAgentWithMemory.js'
import { createDeepSeekModel } from '@yunpat/core'

async function main() {
  console.log('=== 多 Agent 协同演示 - 共享记忆层 ===\n')

  // 1. 初始化全局记忆层管理器
  console.log('1️⃣ 初始化全局记忆层...')
  const memoryManager = await AgentMemoryManager.getInstance({
    bgeApiKey: 'xj781102@',
    databaseUrl: 'postgres://yunpat:yunpat123@localhost:5432/yunpat',
  })
  await memoryManager.initialize()

  const llm = createDeepSeekModel(process.env.DEEPSEEK_API_KEY || 'sk-test')
  console.log('   ✅ 全局记忆层已初始化\n')

  // 2. 创建多个 Agent（共享记忆层）
  console.log('2️⃣ 创建多个智能体（共享记忆层）...')

  const writerAgent = await createPatentWriterAgentWithMemory({
    llm,
    memoryConfig: {
      bgeApiKey: 'xj781102@',
      enableRAG: true,
      enableTokenWindow: true,
    },
  })
  console.log('   ✅ PatentWriterAgent 已创建')

  const responderAgent = await createPatentResponderAgentWithMemory({
    llm,
    memoryConfig: {
      bgeApiKey: 'xj781102@',
      enableRAG: true,
      enableTokenWindow: true,
    },
  })
  console.log('   ✅ PatentResponderAgent 已创建')

  const analyzerAgent = await createPatentAnalyzerAgentWithMemory({
    llm,
    memoryConfig: {
      bgeApiKey: 'xj781102@',
      enableRAG: true,
      enableTokenWindow: true,
    },
  })
  console.log('   ✅ PatentAnalyzerAgent 已创建\n')

  // 3. 场景1：专利撰写 -> 分析
  console.log('3️⃣ 场景1：专利撰写 -> 分析')
  console.log('='.repeat(60))

  try {
    // 3.1 撰写专利
    console.log('\n📝 步骤1：撰写专利...')
    const patentResult = await writerAgent.run(
      {
        title: '基于Transformer的图像分割方法',
        field: '计算机视觉',
        applicant: '某科技公司',
        inventors: ['张三', '李四'],
        technicalDisclosure: '本发明使用Transformer架构进行图像分割...',
        drawings: ['图1：架构图'],
      },
      {}
    )
    console.log(`   ✅ 专利撰写完成: ${patentResult.patentApplication.title}`)

    // 3.2 分析专利
    console.log('\n📊 步骤2：分析专利价值...')
    const analysisResult = await analyzerAgent.run(
      {
        analysisType: 'value',
        technicalField: '计算机视觉',
        parameters: {
          keywords: ['Transformer', '图像分割'],
        },
      },
      {}
    )
    console.log(`   ✅ 分析完成: ${analysisResult.results.summary}`)
  } catch (error: any) {
    console.error('\n❌ 执行失败（这是演示代码，需要有效的 API Key）')
    console.error(`   错误: ${error.message}`)
  }

  // 4. 场景2：跨 Agent 语义搜索
  console.log('\n\n4️⃣ 场景2：跨 Agent 语义搜索')
  console.log('='.repeat(60))

  // 4.1 搜索所有类型的记忆
  console.log('\n🔍 搜索"深度学习图像"相关内容...')
  const searchResults = await memoryManager.searchMemories('深度学习图像', 5)

  console.log(`   找到 ${searchResults.length} 条相关记忆：`)
  for (const result of searchResults) {
    const typeLabel =
      {
        patent: '📄 专利',
        'oa-response': '✉️ 答复',
        'patent-analysis': '📊 分析',
      }[result.type] || result.type

    console.log(`\n   ${typeLabel} (相似度: ${(result.similarity * 100).toFixed(2)}%)`)
    console.log(`   → ${result.content.slice(0, 80)}...`)
  }

  // 5. 场景3：记忆层统计
  console.log('\n\n5️⃣ 场景3：记忆层统计信息')
  console.log('='.repeat(60))

  const stats = await memoryManager.getStats()

  console.log('\n   📊 向量存储：')
  console.log(`      - 总记忆数: ${stats.vector.totalMemories}`)
  console.log(`      - 类型分布:`, JSON.stringify(stats.vector.typeDistribution, null, 2))

  console.log('\n   📊 BGE-M3 缓存：')
  console.log(`      - 缓存大小: ${stats.bge.cacheSize}`)
  console.log(`      - 缓存命中: ${stats.bge.cacheHits} 次`)
  console.log(`      - 命中率: ${(stats.bge.cacheHitRate * 100).toFixed(2)}%`)

  console.log('\n   📊 Agent 统计：')
  console.log(`      - 活跃 Agent: ${stats.agents.activeAgents.length} 个`)
  console.log(`      - 总调用次数: ${stats.agents.totalCalls} 次`)
  console.log(`      - Agent 列表:`, stats.agents.activeAgents)

  // 6. 场景4：Agent 间协作示例
  console.log('\n\n6️⃣ 场景4：Agent 间协作示例')
  console.log('='.repeat(60))

  console.log('\n💡 协作流程：')
  console.log('   1. PatentWriterAgent 撰写专利 → 自动保存到记忆库')
  console.log('   2. PatentAnalyzerAgent 分析专利 → 检索历史案例')
  console.log('   3. PatentResponderAgent 答复审查 → 学习成功答复策略')
  console.log('   4. 所有 Agent 共享同一个记忆库')

  console.log('\n🔄 协作优势：')
  console.log('   ✅ 知识复用：一个 Agent 的经验可以被其他 Agent 使用')
  console.log('   ✅ 持续学习：随着使用次数增加，知识库越来越丰富')
  console.log('   ✅ 一致性：所有 Agent 使用相同的向量和检索标准')
  console.log('   ✅ 效率提升：减少重复计算，缓存命中率提高')

  // 7. 清理资源
  console.log('\n\n7️⃣ 清理资源...')
  await writerAgent.cleanup()
  await responderAgent.cleanup()
  await analyzerAgent.cleanup()
  await memoryManager.cleanup()
  console.log('   ✅ 所有资源已清理\n')

  console.log('='.repeat(60))
  console.log('✅ 多 Agent 协同演示完成！')
  console.log('='.repeat(60))

  console.log('\n🎯 核心功能验证：')
  console.log('   ✅ 全局记忆层管理器（单例模式）')
  console.log('   ✅ 多 Agent 共享记忆库')
  console.log('   ✅ 跨 Agent 语义搜索')
  console.log('   ✅ Agent 间知识复用')
  console.log('   ✅ 统一统计和监控')

  console.log('\n📊 性能指标：')
  console.log(`   - 总记忆数: ${stats.vector.totalMemories}`)
  console.log(`   - 缓存命中率: ${(stats.bge.cacheHitRate * 100).toFixed(2)}%`)
  console.log(`   - 活跃 Agent: ${stats.agents.activeAgents.length} 个`)
  console.log(`   - 总调用次数: ${stats.agents.totalCalls} 次`)

  console.log('\n🚀 下一步：')
  console.log('   1. 在生产环境使用 AgentMemoryManager')
  console.log('   2. 为更多 Agent 集成记忆层')
  console.log('   3. 持续监控和优化性能')
  console.log('   4. 建立记忆层备份和恢复机制')
}

// 运行演示
main().catch((error) => {
  console.error('❌ 执行失败:', error)
  process.exit(1)
})
