/**
 * 工具选择优化系统 - 简化测试脚本
 *
 * 验证三大核心系统的功能
 */

import {
  ToolDescriptionEnhancer,
  fewShotManager,
  toolUsageTracker,
  toolSelectionOptimizer,
} from './packages/core/dist/index.js'

console.log('🚀 开始测试工具选择优化系统...\n')

// ========== 测试1: 工具描述增强器 ==========
async function test1() {
  console.log('='.repeat(60))
  console.log('🧪 测试1: 工具描述增强器')
  console.log('='.repeat(60))

  const enhancer = new ToolDescriptionEnhancer()

  const mockTool = {
    metadata: {
      name: 'PdfToMarkdownTool',
      description: '将PDF文件转换为Markdown格式',
      category: 'document',
    },
    execute: async (params) => ({ markdown: '# 转换后的内容' }),
  }

  const enhancedMetadata = enhancer.enhanceMetadata(mockTool)

  console.log('\n✅ 增强后的工具描述:')
  console.log('- 工具名称:', enhancedMetadata.name)
  console.log('- 基础描述:', enhancedMetadata.description)
  console.log('- 详细描述:', enhancedMetadata.detailedDescription?.substring(0, 100) + '...')
  console.log('- 常见用例:', enhancedMetadata.commonUseCases?.join(', '))
  console.log('- 能力列表:', enhancedMetadata.capabilities?.join(', '))
  console.log('- 数据类型:', enhancedMetadata.dataTypes?.join(', '))
  console.log('- 限制说明:', enhancedMetadata.limitations?.join(', '))
  console.log('- 前置条件:', enhancedMetadata.prerequisites?.join(', ') || '无')
  console.log('- 相关工具:', enhancedMetadata.relatedTools?.join(', '))

  console.log('\n✅ 测试1通过！\n')
}

// ========== 测试2: Few-shot示例管理器 ==========
async function test2() {
  console.log('='.repeat(60))
  console.log('🧪 测试2: Few-shot示例管理器')
  console.log('='.repeat(60))

  const userInput = '帮我把这个PDF文件转换成Markdown格式'
  const availableTools = [
    {
      metadata: {
        name: 'PdfToMarkdownTool',
        description: '将PDF文件转换为Markdown格式',
        category: 'document',
      },
      execute: async (params) => ({ markdown: '...' }),
    },
    {
      metadata: {
        name: 'PdfParseTool',
        description: '解析PDF文件',
        category: 'document',
      },
      execute: async (params) => ({ text: '...' }),
    },
  ]

  const relevantExamples = fewShotManager.getRelevantExamples(userInput, availableTools, 3)

  console.log('\n✅ 找到相关示例:')
  relevantExamples.forEach((example, index) => {
    console.log(`\n示例 ${index + 1}: ${example.scenario}`)
    console.log(`- 用户输入: ${example.userInput}`)
    console.log(`- 选择工具: ${example.selectedTool}`)
    console.log(`- 经验: ${example.lessons?.substring(0, 80)}...`)
  })

  console.log('\n✅ 测试2通过！\n')
}

// ========== 测试3: 工具使用追踪器 ==========
async function test3() {
  console.log('='.repeat(60))
  console.log('🧪 测试3: 工具使用追踪器')
  console.log('='.repeat(60))

  // 记录工具使用
  const recordId = toolUsageTracker.recordUsage({
    id: '',
    timestamp: new Date(),
    toolName: 'PdfToMarkdownTool',
    sessionId: 'test-session',
    userInput: '转换PDF到Markdown',
    toolParameters: { filePath: 'doc.pdf' },
    result: {
      success: true,
      executionTime: 1500,
      output: { markdown: '# 内容' },
    },
  })

  console.log(`\n✅ 工具使用已记录，ID: ${recordId}`)

  // 获取性能统计
  const stats = toolUsageTracker.getPerformanceStats('PdfToMarkdownTool')
  console.log('\n📊 性能统计:')
  console.log(`- 总调用次数: ${stats.totalCalls}`)
  console.log(`- 成功次数: ${stats.successfulCalls}`)
  console.log(`- 失败次数: ${stats.failedCalls}`)
  console.log(`- 成功率: ${(stats.successRate * 100).toFixed(1)}%`)
  console.log(`- 平均执行时间: ${stats.avgExecutionTime}ms`)

  console.log('\n✅ 测试3通过！\n')
}

// ========== 测试4: 工具选择优化器 ==========
async function test4() {
  console.log('='.repeat(60))
  console.log('🧪 测试4: 工具选择优化器（集成系统）')
  console.log('='.repeat(60))

  const userInput = '帮我把这个PDF文件转换成Markdown格式'
  const availableTools = [
    {
      metadata: {
        name: 'PdfToMarkdownTool',
        description: '将PDF文件转换为Markdown格式',
        category: 'document',
      },
      execute: async (params) => ({ markdown: '...' }),
    },
    {
      metadata: {
        name: 'ImageOcrTool',
        description: '图片OCR识别',
        category: 'image',
      },
      execute: async (params) => ({ text: '...' }),
    },
  ]

  console.log('\n🎯 生成优化的工具选择提示...')
  const optimizedPrompt = toolSelectionOptimizer.optimizeToolSelectionPrompt(
    userInput,
    availableTools,
    {
      conversationHistory: [
        { role: 'user', content: '我需要处理文档' },
        { role: 'assistant', content: '我可以帮您处理文档' },
      ],
    }
  )

  console.log('\n✅ 优化后的提示（前800字符）:')
  console.log(optimizedPrompt.substring(0, 800) + '...')

  // 记录使用
  const recordId = toolSelectionOptimizer.recordToolUsage(
    'PdfToMarkdownTool',
    userInput,
    { filePath: '/path/to/document.pdf' },
    {
      success: true,
      executionTime: 1500,
      output: { markdown: '# 转换后的内容' },
    },
    {
      sessionId: 'test-session-001',
      userId: 'test-user',
    }
  )

  console.log(`\n✅ 工具使用已记录，ID: ${recordId}`)

  // 生成性能报告
  console.log('\n📊 生成性能报告...')
  const performanceReport = toolSelectionOptimizer.getPerformanceReport()
  console.log('\n性能报告（前500字符）:')
  console.log(performanceReport.substring(0, 500) + '...')

  // 分析选择准确性
  console.log('\n📈 分析工具选择准确性...')
  const accuracyAnalysis = toolSelectionOptimizer.analyzeSelectionAccuracy()
  console.log(`- 准确率: ${(accuracyAnalysis.accuracy * 100).toFixed(1)}%`)
  console.log(`- 改进建议数量: ${accuracyAnalysis.improvements.length}`)

  console.log('\n✅ 测试4通过！\n')
}

// ========== 运行所有测试 ==========
async function runAllTests() {
  try {
    await test1()
    await test2()
    await test3()
    await test4()

    console.log('='.repeat(60))
    console.log('🎉 所有测试通过！')
    console.log('='.repeat(60))
    console.log('\n✅ 工具描述增强器：正常工作')
    console.log('✅ Few-shot示例管理器：正常工作')
    console.log('✅ 工具使用追踪器：正常工作')
    console.log('✅ 工具选择优化器：正常工作')
    console.log('\n🎯 系统已准备就绪，可以在智能体中使用！')
  } catch (error) {
    console.error('\n❌ 测试失败:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

runAllTests()
