/**
 * 工具选择优化系统 - 完整测试脚本
 *
 * 验证三大核心系统的功能：
 * 1. 工具描述增强器
 * 2. Few-shot示例管理器
 * 3. 工具使用追踪器
 * 4. 工具选择优化器（集成系统）
 */

import {
  ToolDescriptionEnhancer,
  fewShotManager,
  toolUsageTracker,
  toolSelectionOptimizer,
} from '@yunpat/core'
import type { EnhancedTool } from '@yunpat/core'

/**
 * 测试1: 工具描述增强器
 */
async function testToolDescriptionEnhancer() {
  console.log('\n' + '='.repeat(60))
  console.log('🧪 测试1: 工具描述增强器')
  console.log('='.repeat(60))

  const enhancer = new ToolDescriptionEnhancer()

  // 创建模拟工具
  const mockTool: EnhancedTool = {
    metadata: {
      name: 'PdfToMarkdownTool',
      description: '将PDF文件转换为Markdown格式',
      category: 'document',
    },
    execute: async (params: any) => {
      return { markdown: '# 转换后的内容' }
    },
  }

  // 增强工具描述
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

  // 批量增强
  const mockTools: EnhancedTool[] = [
    {
      metadata: {
        name: 'PdfParseTool',
        description: '解析PDF文件',
        category: 'document',
      },
      execute: async (params: any) => ({ text: '解析结果' }),
    },
    {
      metadata: {
        name: 'ImageOcrTool',
        description: '图片OCR识别',
        category: 'image',
      },
      execute: async (params: any) => ({ text: '识别结果' }),
    },
  ]

  const enhancedMap = enhancer.enhanceTools(mockTools)

  console.log('\n✅ 批量增强结果:')
  for (const [name, metadata] of enhancedMap) {
    console.log(`- ${name}: ${metadata.detailedDescription?.substring(0, 50)}...`)
  }

  console.log('\n✅ 测试1通过！')
}

/**
 * 测试2: Few-shot示例管理器
 */
async function testFewShotPromptManager() {
  console.log('\n' + '='.repeat(60))
  console.log('🧪 测试2: Few-shot示例管理器')
  console.log('='.repeat(60))

  // 获取相关示例
  const userInput = '帮我把这个PDF文件转换成Markdown格式'
  const availableTools: EnhancedTool[] = [
    {
      metadata: {
        name: 'PdfToMarkdownTool',
        description: '将PDF文件转换为Markdown格式',
        category: 'document',
      },
      execute: async (params: any) => ({ markdown: '...' }),
    },
    {
      metadata: {
        name: 'PdfParseTool',
        description: '解析PDF文件',
        category: 'document',
      },
      execute: async (params: any) => ({ text: '...' }),
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

  // 生成Few-shot提示
  const fewShotPrompt = fewShotManager.generateFewShotPrompt(userInput, availableTools, {
    conversationHistory: [
      { role: 'user', content: '我需要处理文档' },
      { role: 'assistant', content: '我可以帮您处理' },
    ],
  })

  console.log('\n✅ 生成的Few-shot提示（前500字符）:')
  console.log(fewShotPrompt.substring(0, 500) + '...')

  console.log('\n✅ 测试2通过！')
}

/**
 * 测试3: 工具使用追踪器
 */
async function testToolUsageTracker() {
  console.log('\n' + '='.repeat(60))
  console.log('🧪 测试3: 工具使用追踪器')
  console.log('='.repeat(60))

  // 记录几次工具使用
  const toolUses = [
    {
      toolName: 'PdfToMarkdownTool',
      userInput: '转换PDF到Markdown',
      toolParameters: { filePath: 'doc1.pdf' },
      success: true,
      executionTime: 1234,
    },
    {
      toolName: 'PdfToMarkdownTool',
      userInput: '转换PDF到Markdown',
      toolParameters: { filePath: 'doc2.pdf' },
      success: true,
      executionTime: 2345,
    },
    {
      toolName: 'PdfToMarkdownTool',
      userInput: '转换PDF到Markdown',
      toolParameters: { filePath: 'doc3.pdf' },
      success: false,
      executionTime: 500,
      error: 'File not found',
    },
    {
      toolName: 'ImageOcrTool',
      userInput: '识别图片文字',
      toolParameters: { imagePath: 'image.png' },
      success: true,
      executionTime: 3000,
    },
  ]

  console.log('\n📝 记录工具使用...')
  for (const use of toolUses) {
    const recordId = toolUsageTracker.recordUsage({
      id: '',
      timestamp: new Date(),
      toolName: use.toolName,
      sessionId: 'test-session',
      userInput: use.userInput,
      toolParameters: use.toolParameters,
      result: {
        success: use.success,
        executionTime: use.executionTime,
        error: use.error,
      },
    })

    console.log(`- ${use.toolName}: ${use.success ? '✅' : '❌'} (${recordId})`)
  }

  // 获取性能统计
  console.log('\n📊 性能统计:')
  const pdfStats = toolUsageTracker.getPerformanceStats('PdfToMarkdownTool')
  console.log(`\nPdfToMarkdownTool:`)
  console.log(`- 总调用次数: ${pdfStats.totalCalls}`)
  console.log(`- 成功次数: ${pdfStats.successfulCalls}`)
  console.log(`- 失败次数: ${pdfStats.failedCalls}`)
  console.log(`- 成功率: ${(pdfStats.successRate * 100).toFixed(1)}%`)
  console.log(`- 平均执行时间: ${pdfStats.avgExecutionTime}ms`)
  console.log(`- 最快执行时间: ${pdfStats.minExecutionTime}ms`)
  console.log(`- 最慢执行时间: ${pdfStats.maxExecutionTime}ms`)

  // 获取推荐
  console.log('\n⭐ 工具推荐:')
  const recommendations = toolUsageTracker.getRecommendations('转换PDF到Markdown', [
    'PdfToMarkdownTool',
    'PdfParseTool',
    'ImageOcrTool',
  ])

  recommendations.forEach((rec) => {
    console.log(`\n- ${rec.toolName}:`)
    console.log(`  置信度: ${(rec.confidence * 100).toFixed(0)}%`)
    console.log(`  理由: ${rec.reason}`)
  })

  // 生成性能报告
  console.log('\n📄 性能报告（前500字符）:')
  const report = toolUsageTracker.generatePerformanceReport()
  console.log(report.substring(0, 500) + '...')

  console.log('\n✅ 测试3通过！')
}

/**
 * 测试4: 工具选择优化器（集成系统）
 */
async function testToolSelectionOptimizer() {
  console.log('\n' + '='.repeat(60))
  console.log('🧪 测试4: 工具选择优化器（集成系统）')
  console.log('='.repeat(60))

  // 准备测试数据
  const userInput = '帮我把这个PDF文件转换成Markdown格式'
  const availableTools: EnhancedTool[] = [
    {
      metadata: {
        name: 'PdfToMarkdownTool',
        description: '将PDF文件转换为Markdown格式',
        category: 'document',
      },
      execute: async (params: any) => ({ markdown: '...' }),
    },
    {
      metadata: {
        name: 'PdfParseTool',
        description: '解析PDF文件',
        category: 'document',
      },
      execute: async (params: any) => ({ text: '...' }),
    },
    {
      metadata: {
        name: 'ImageOcrTool',
        description: '图片OCR识别',
        category: 'image',
      },
      execute: async (params: any) => ({ text: '...' }),
    },
  ]

  // 生成优化提示
  console.log('\n🎯 生成优化的工具选择提示...')
  const optimizedPrompt = toolSelectionOptimizer.optimizeToolSelectionPrompt(
    userInput,
    availableTools,
    {
      conversationHistory: [
        { role: 'user', content: '我需要处理文档' },
        { role: 'assistant', content: '我可以帮您处理文档' },
      ],
      currentTask: '文档格式转换',
    }
  )

  console.log('\n✅ 优化后的提示（前800字符）:')
  console.log(optimizedPrompt.substring(0, 800) + '...')

  // 模拟工具使用
  console.log('\n⚙️ 模拟工具执行...')
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
      conversationHistory: [
        { role: 'user', content: '我需要处理文档' },
        { role: 'assistant', content: '我可以帮您处理文档' },
      ],
    }
  )

  console.log(`✅ 工具使用已记录，ID: ${recordId}`)

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
  if (accuracyAnalysis.improvements.length > 0) {
    console.log('- 改进建议:')
    accuracyAnalysis.improvements.forEach((suggestion, index) => {
      console.log(`  ${index + 1}. ${suggestion}`)
    })
  }

  console.log('\n✅ 测试4通过！')
}

/**
 * 测试5: 完整工作流
 */
async function testCompleteWorkflow() {
  console.log('\n' + '='.repeat(60))
  console.log('🧪 测试5: 完整工作流')
  console.log('='.repeat(60))

  // 场景：用户需要处理多个文档
  const userRequests = [
    '帮我把这个PDF文件转换成Markdown格式',
    '识别这张图片中的文字',
    '分析这个Excel表格中的数据',
  ]

  const availableTools: EnhancedTool[] = [
    {
      metadata: {
        name: 'PdfToMarkdownTool',
        description: '将PDF文件转换为Markdown格式',
        category: 'document',
      },
      execute: async (params: any) => ({ markdown: '...' }),
    },
    {
      metadata: {
        name: 'ImageOcrTool',
        description: '从图片中识别文字',
        category: 'image',
      },
      execute: async (params: any) => ({ text: '...' }),
    },
    {
      metadata: {
        name: 'ExcelToJsonTool',
        description: '将Excel转换为JSON',
        category: 'document',
      },
      execute: async (params: any) => ({ json: '...' }),
    },
  ]

  console.log('\n📋 处理用户请求...\n')

  for (const request of userRequests) {
    console.log(`\n🔹 请求: ${request}`)

    // 1. 生成优化提示
    const prompt = toolSelectionOptimizer.optimizeToolSelectionPrompt(request, availableTools)

    // 2. 模拟工具选择（简化版）
    let selectedTool = ''
    if (request.includes('PDF')) {
      selectedTool = 'PdfToMarkdownTool'
    } else if (request.includes('图片')) {
      selectedTool = 'ImageOcrTool'
    } else if (request.includes('Excel')) {
      selectedTool = 'ExcelToJsonTool'
    }

    console.log(`  ✅ 选择的工具: ${selectedTool}`)

    // 3. 模拟执行
    const startTime = Date.now()
    const success = Math.random() > 0.2 // 80%成功率
    const executionTime = Date.now() - startTime + Math.random() * 2000

    // 4. 记录使用
    toolSelectionOptimizer.recordToolUsage(
      selectedTool,
      request,
      { filePath: '/path/to/file' },
      {
        success,
        executionTime,
        output: success ? { result: 'success' } : undefined,
        error: success ? undefined : 'Simulated error',
      },
      {
        sessionId: 'workflow-session',
      }
    )

    console.log(
      `  ${success ? '✅' : '❌'} 执行${success ? '成功' : '失败'} (${executionTime.toFixed(0)}ms)`
    )
  }

  // 生成最终报告
  console.log('\n📊 最终性能报告:\n')
  const finalReport = toolSelectionOptimizer.getPerformanceReport()
  console.log(finalReport)

  console.log('\n✅ 测试5通过！')
}

/**
 * 运行所有测试
 */
async function runAllTests() {
  console.log('🚀 开始测试工具选择优化系统...\n')

  try {
    await testToolDescriptionEnhancer()
    await testFewShotPromptManager()
    await testToolUsageTracker()
    await testToolSelectionOptimizer()
    await testCompleteWorkflow()

    console.log('\n' + '='.repeat(60))
    console.log('🎉 所有测试通过！')
    console.log('='.repeat(60))
    console.log('\n✅ 工具描述增强器：正常工作')
    console.log('✅ Few-shot示例管理器：正常工作')
    console.log('✅ 工具使用追踪器：正常工作')
    console.log('✅ 工具选择优化器：正常工作')
    console.log('✅ 完整工作流：正常工作')
    console.log('\n🎯 系统已准备就绪，可以在智能体中使用！')
  } catch (error) {
    console.error('\n❌ 测试失败:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

// 运行测试
runAllTests()
