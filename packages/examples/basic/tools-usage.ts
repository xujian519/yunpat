/**
 * YunPat 工具系统使用示例
 *
 * 演示如何使用增强的工具注册表和各种工具
 */

import { EnhancedToolRegistry, ToolCategory } from '@yunpat/core'
import { EventBus } from '@yunpat/core'
import { ClaimsGeneratorTool, FeatureExtractorTool } from '@yunpat/patent-tools'
import {
  FileReadTool,
  FileWriteTool,
  GrepTool,
  GlobTool,
  WebFetchTool,
} from '@yunpat/builtin-tools'
import type { ToolContext } from '@yunpat/core'

/**
 * 创建工具上下文
 */
function createToolContext(llm: any, memory: any): ToolContext {
  const eventBus = new EventBus()
  const registry = new EnhancedToolRegistry(eventBus)

  return {
    registry,
    llm,
    memory,
    eventBus,
    userId: 'example-user',
    sessionId: 'example-session',
    metadata: {},
  }
}

/**
 * 示例 1: 使用文件工具
 */
async function example1_FileTools() {
  console.log('=== 示例 1: 文件工具 ===')

  const eventBus = new EventBus()
  const registry = new EnhancedToolRegistry(eventBus)

  // 注册文件工具
  registry.register(new FileReadTool())
  registry.register(new FileWriteTool())

  // 创建工具上下文
  const context = createToolContext(null, null)

  // 写入文件
  await registry.call(
    'file_write',
    {
      filePath: '/tmp/test.txt',
      content: 'Hello, YunPat Tools!',
    },
    context
  )

  // 读取文件
  const result = await registry.call('file_read', { filePath: '/tmp/test.txt' }, context)

  console.log('文件内容:', result.content)
}

/**
 * 示例 2: 使用搜索工具
 */
async function example2_SearchTools() {
  console.log('\n=== 示例 2: 搜索工具 ===')

  const eventBus = new EventBus()
  const registry = new EnhancedToolRegistry(eventBus)

  // 注册搜索工具
  registry.register(new GrepTool())
  registry.register(new GlobTool())

  const context = createToolContext(null, null)

  // 查找所有 TypeScript 文件
  const globResult = await registry.call('glob', { pattern: 'packages/core/src/**/*.ts' }, context)

  console.log(`找到 ${globResult.files.length} 个 TypeScript 文件`)

  // 搜索包含 "Tool" 的行
  const grepResult = await registry.call(
    'grep',
    {
      pattern: 'Tool',
      directory: 'packages/core/src',
      filePattern: '*.ts',
      maxResults: 5,
    },
    context
  )

  console.log(`搜索到 ${grepResult.matches.length} 个匹配:`)
  grepResult.matches.forEach((match) => {
    console.log(`  ${match.file}:${match.lineNumber} - ${match.line.substring(0, 60)}`)
  })
}

/**
 * 示例 3: 使用专利工具
 */
async function example3_PatentTools() {
  console.log('\n=== 示例 3: 专利工具 ===')

  const eventBus = new EventBus()
  const registry = new EnhancedToolRegistry(eventBus)

  // 注册专利工具
  registry.register(new ClaimsGeneratorTool())
  registry.register(new FeatureExtractorTool())

  // 模拟 LLM 上下文
  const mockLLM = {
    chat: async (params: any) => {
      // 返回模拟的权利要求
      return {
        message: {
          content:
            '一种图像识别装置，其特征在于，包括：\n' +
            '图像采集模块，用于采集待识别图像；\n' +
            '特征提取模块，与所述图像采集模块连接，用于从所述待识别图像中提取特征向量；\n' +
            '识别模块，与所述特征提取模块连接，用于基于所述特征向量进行识别。',
        },
      }
    },
  }

  const context = createToolContext(mockLLM, null)

  // 提取技术特征
  const features = await registry.call(
    'extract_features',
    {
      description:
        '本发明提供一种图像识别装置，包括图像采集模块、特征提取模块和识别模块。' +
        '图像采集模块采用CCD相机，特征提取模块使用卷积神经网络，识别模块采用SVM分类器。',
    },
    context
  )

  console.log('提取到的技术特征:')
  features.features.forEach((f) => {
    console.log(`  [${f.isEssential ? '必要' : '附加'}] ${f.text} (${f.category || '未分类'})`)
  })

  // 生成权利要求
  const claims = await registry.call(
    'generate_claims',
    {
      inventionType: 'device' as const,
      coreFeatures: features.features,
    },
    context
  )

  console.log('\n生成的权利要求:')
  claims.forEach((claim) => {
    console.log(`\n${claim.claimNumber}. ${claim.text}`)
  })
}

/**
 * 示例 4: 批量调用工具（智能并发）
 */
async function example4_BatchCalls() {
  console.log('\n=== 示例 4: 批量工具调用 ===')

  const eventBus = new EventBus()
  const registry = new EnhancedToolRegistry(eventBus)

  // 注册工具
  registry.register(new FileReadTool())
  registry.register(new GlobTool())

  const context = createToolContext(null, null)

  // 批量调用（只读工具会并发执行）
  const results = await registry.callBatch(
    [
      { name: 'glob', input: { pattern: 'packages/core/src/**/*.ts' } },
      { name: 'glob', input: { pattern: 'packages/patent-tools/src/**/*.ts' } },
      { name: 'glob', input: { pattern: 'packages/builtin-tools/src/**/*.ts' } },
    ],
    context
  )

  console.log('批量调用结果:')
  results.forEach((result, index) => {
    console.log(`  调用 ${index + 1}: 找到 ${result.files.length} 个文件`)
  })
}

/**
 * 示例 5: 获取工具执行统计
 */
async function example5_Statistics() {
  console.log('\n=== 示例 5: 工具执行统计 ===')

  const eventBus = new EventBus()
  const registry = new EnhancedToolRegistry(eventBus)

  registry.register(new FileReadTool())
  registry.register(new GlobTool())

  const context = createToolContext(null, null)

  // 执行一些操作
  await registry.call('glob', { pattern: 'packages/**/*.ts' }, context)
  await registry.call('glob', { pattern: 'packages/core/**/*.ts' }, context)

  // 获取统计信息
  const stats = registry.getStats()

  console.log('工具执行统计:')
  stats.forEach((stat) => {
    console.log(`\n工具: ${stat.toolName}`)
    console.log(`  总调用次数: ${stat.totalCalls}`)
    console.log(`  成功次数: ${stat.successCount}`)
    console.log(`  平均执行时间: ${stat.avgDuration.toFixed(2)}ms`)
    console.log(`  最小/最大执行时间: ${stat.minDuration}ms / ${stat.maxDuration}ms`)
  })
}

/**
 * 主函数
 */
async function main() {
  try {
    await example1_FileTools()
    await example2_SearchTools()
    await example3_PatentTools()
    await example4_BatchCalls()
    await example5_Statistics()

    console.log('\n✅ 所有示例执行完成！')
  } catch (error) {
    console.error('❌ 示例执行失败:', error)
    process.exit(1)
  }
}

// 运行示例
main()
