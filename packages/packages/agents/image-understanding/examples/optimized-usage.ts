/**
 * 优化后的附图理解使用示例
 *
 * 演示如何使用缓存和批量处理优化功能
 */

import { DrawingUnderstandingAgent, DrawingOptimizer } from '../src/DrawingUnderstandingAgent.js'
import { EventBus } from '@yunpat/core'

/**
 * 示例 1: 使用缓存优化
 */
export async function example1_CacheOptimization() {
  console.log('=== 示例 1: 缓存优化 ===\n')

  // 1. 创建优化器
  const optimizer = new DrawingOptimizer({
    cache: {
      maxCacheSize: 50 * 1024 * 1024, // 50MB
      maxEntries: 50,
    },
  })

  // 2. 创建智能体
  const agent = new DrawingUnderstandingAgent({
    name: 'drawing-understanding',
    description: '附图理解智能体',
    eventBus: new EventBus(),
    memory: {},
    tools: {},
    llm: {
      chat: async (params: any) => {
        return {
          message: {
            content: JSON.stringify({
              figureType: 'exploded_view',
              overview: '测试附图',
              components: [],
              connections: [],
              labels: [],
              annotations: [],
              structureAnalysis: {
                mainStructure: '',
                subStructures: [],
                hierarchy: [],
              },
              correspondence: {
                technicalFeatures: [],
                suggestedDescription: '图1为测试附图。',
              },
              confidence: 0.85,
            }),
          },
        }
      },
    },
  })

  // 3. 预加载图像
  const imagePaths = ['/path/to/figure1.png', '/path/to/figure2.png', '/path/to/figure3.png']

  console.log('预加载图像到缓存...')
  // 注意：实际使用时，这些文件需要存在
  // await optimizer.preloadImages(imagePaths)

  // 4. 处理附图（第二次处理时会使用缓存）
  console.log('\n第一次处理（未命中缓存）:')
  const result1 = await agent.execute({
    figureNumber: '1',
    imagePath: '/path/to/figure1.png',
  })

  console.log('\n第二次处理（命中缓存）:')
  const result2 = await agent.execute({
    figureNumber: '1',
    imagePath: '/path/to/figure1.png',
  })

  // 5. 查看缓存统计
  const stats = optimizer.getCacheStats()
  console.log('\n缓存统计:')
  console.log(`  条目数: ${stats.entryCount}`)
  console.log(`  总大小: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`)
  console.log(`  命中次数: ${stats.hits}`)
  console.log(`  未命中次数: ${stats.misses}`)
  console.log(`  命中率: ${(stats.hitRate * 100).toFixed(1)}%`)
}

/**
 * 示例 2: 批量处理优化
 */
export async function example2_BatchProcessing() {
  console.log('\n\n=== 示例 2: 批量处理优化 ===\n')

  // 1. 创建优化器
  const optimizer = new DrawingOptimizer({
    batch: {
      batchSize: 3, // 每批处理 3 个
      batchDelay: 1000, // 批次之间延迟 1 秒
      maxConcurrency: 2, // 最大并发 2 个
      retryCount: 2, // 失败重试 2 次
      timeout: 30000, // 超时 30 秒
    },
  })

  // 2. 创建智能体
  const agent = new DrawingUnderstandingAgent({
    name: 'drawing-understanding',
    description: '附图理解智能体',
    eventBus: new EventBus(),
    memory: {},
    tools: {},
    llm: {
      chat: async (params: any) => {
        return {
          message: {
            content: JSON.stringify({
              figureType: 'schematic',
              overview: '原理图',
              components: [],
              connections: [],
              labels: [],
              annotations: [],
              structureAnalysis: {
                mainStructure: '',
                subStructures: [],
                hierarchy: [],
              },
              correspondence: {
                technicalFeatures: [],
                suggestedDescription: '图为原理图。',
              },
              confidence: 0.8,
            }),
          },
        }
      },
    },
  })

  // 3. 准备批量处理的附图
  const drawings = [
    { figureNumber: '1', imagePath: '/path/to/figure1.png' },
    { figureNumber: '2', imagePath: '/path/to/figure2.png' },
    { figureNumber: '3', imagePath: '/path/to/figure3.png' },
    { figureNumber: '4', imagePath: '/path/to/figure4.png' },
    { figureNumber: '5', imagePath: '/path/to/figure5.png' },
    { figureNumber: '6', imagePath: '/path/to/figure6.png' },
  ]

  // 4. 批量处理（带进度回调）
  console.log('开始批量处理...\n')

  const results = await optimizer.processDrawings(
    drawings,
    async (drawing) => {
      console.log(`处理附图 ${drawing.figureNumber}...`)
      const result = await agent.execute(drawing)
      console.log(`✅ 附图 ${drawing.figureNumber} 完成`)
      return result
    },
    (progress) => {
      console.log(`\n📊 进度: ${progress.current}/${progress.total} (${progress.percentage}%)`)
    }
  )

  console.log(`\n✅ 批量处理完成，成功处理 ${results.length} 个附图`)
}

/**
 * 示例 3: 组合优化（缓存 + 批量处理）
 */
export async function example3_CombinedOptimization() {
  console.log('\n\n=== 示例 3: 组合优化 ===\n')

  // 1. 创建优化器（同时启用缓存和批量处理）
  const optimizer = new DrawingOptimizer({
    cache: {
      maxCacheSize: 100 * 1024 * 1024, // 100MB
      maxEntries: 100,
    },
    batch: {
      batchSize: 5,
      batchDelay: 500,
      maxConcurrency: 3,
      retryCount: 2,
    },
  })

  // 2. 创建智能体
  const agent = new DrawingUnderstandingAgent({
    name: 'drawing-understanding',
    description: '附图理解智能体',
    eventBus: new EventBus(),
    memory: {},
    tools: {},
    llm: {
      chat: async (params: any) => {
        return {
          message: {
            content: JSON.stringify({
              figureType: 'exploded_view',
              overview: '爆炸图',
              components: [
                {
                  type: 'component',
                  description: '组件1',
                  confidence: 0.9,
                },
              ],
              connections: [],
              labels: [],
              annotations: [],
              structureAnalysis: {
                mainStructure: '组件',
                subStructures: [],
                hierarchy: [],
              },
              correspondence: {
                technicalFeatures: ['特征1'],
                suggestedDescription: '图为爆炸图。',
              },
              confidence: 0.85,
            }),
          },
        }
      },
    },
  })

  // 3. 准备附图列表（包含重复的图像，测试缓存效果）
  const drawings = [
    { figureNumber: '1', imagePath: '/path/to/figure1.png' },
    { figureNumber: '2', imagePath: '/path/to/figure2.png' },
    { figureNumber: '3', imagePath: '/path/to/figure3.png' },
    { figureNumber: '4', imagePath: '/path/to/figure1.png' }, // 重复图像 1
    { figureNumber: '5', imagePath: '/path/to/figure2.png' }, // 重复图像 2
    { figureNumber: '6', imagePath: '/path/to/figure4.png' },
  ]

  // 4. 预加载常用图像
  console.log('预加载图像...')
  // await optimizer.preloadImages(['/path/to/figure1.png', '/path/to/figure2.png'])

  // 5. 批量处理
  console.log('\n开始批量处理...\n')

  const startTime = Date.now()

  const results = await optimizer.processDrawings(
    drawings,
    async (drawing) => {
      const result = await agent.execute(drawing)
      return result
    },
    (progress) => {
      console.log(`进度: ${progress.percentage}%`)
    }
  )

  const duration = Date.now() - startTime

  console.log(`\n✅ 处理完成`)
  console.log(`   总耗时: ${(duration / 1000).toFixed(2)} 秒`)
  console.log(`   平均每个: ${(duration / results.length).toFixed(0)} ms`)

  // 6. 查看缓存统计
  const stats = optimizer.getCacheStats()
  console.log('\n缓存统计:')
  console.log(`  条目数: ${stats.entryCount}`)
  console.log(`  命中率: ${(stats.hitRate * 100).toFixed(1)}%`)

  // 7. 清理缓存
  console.log('\n清理未使用的缓存...')
  optimizer.cleanupCache(3600000) // 清理 1 小时未使用的缓存

  const cleanupStats = optimizer.getCacheStats()
  console.log(`清理后条目数: ${cleanupStats.entryCount}`)
}

/**
 * 示例 4: 性能对比
 */
export async function example4_PerformanceComparison() {
  console.log('\n\n=== 示例 4: 性能对比 ===\n')

  const agent = new DrawingUnderstandingAgent({
    name: 'drawing-understanding',
    description: '附图理解智能体',
    eventBus: new EventBus(),
    memory: {},
    tools: {},
    llm: {
      chat: async (params: any) => {
        return {
          message: {
            content: JSON.stringify({
              figureType: 'schematic',
              overview: '原理图',
              components: [],
              connections: [],
              labels: [],
              annotations: [],
              structureAnalysis: {
                mainStructure: '',
                subStructures: [],
                hierarchy: [],
              },
              correspondence: {
                technicalFeatures: [],
                suggestedDescription: '图为原理图。',
              },
              confidence: 0.8,
            }),
          },
        }
      },
    },
  })

  const drawings = Array.from({ length: 10 }, (_, i) => ({
    figureNumber: String(i + 1),
    imagePath: `/path/to/figure${i + 1}.png`,
  }))

  // 方案 1: 串行处理（无优化）
  console.log('方案 1: 串行处理（无优化）')
  const startTime1 = Date.now()

  for (const drawing of drawings.slice(0, 3)) {
    await agent.execute(drawing)
  }

  const duration1 = Date.now() - startTime1
  console.log(`耗时: ${duration1} ms`)

  // 方案 2: 批量处理（有优化）
  console.log('\n方案 2: 批量处理（有优化）')
  const optimizer = new DrawingOptimizer({
    batch: {
      batchSize: 3,
      batchDelay: 0,
      maxConcurrency: 3,
    },
  })

  const startTime2 = Date.now()

  await optimizer.processDrawings(
    drawings.slice(0, 3),
    async (drawing) => await agent.execute(drawing)
  )

  const duration2 = Date.now() - startTime2
  console.log(`耗时: ${duration2} ms`)

  // 性能提升
  const improvement = (((duration1 - duration2) / duration1) * 100).toFixed(1)
  console.log(`\n性能提升: ${improvement}%`)
}

/**
 * 集成到 DrawingUnderstandingAgent 的建议
 *
 * 可以在 DrawingUnderstandingAgent 中添加优化器支持：
 *
 * \`\`\`typescript
 * export class DrawingUnderstandingAgent extends Agent<...> {
 *   private optimizer?: DrawingOptimizer
 *
 *   constructor(config) {
 *     super(config)
 *     if (config.enableOptimization) {
 *       this.optimizer = new DrawingOptimizer(config.optimizationConfig)
 *     }
 *   }
 *
 *   protected async plan(input: DrawingInput, context: ExecutionContext) {
 *     // 如果启用了优化器，使用缓存加载图像
 *     if (this.optimizer && !input.imageBase64) {
 *       input.imageBase64 = await this.optimizer.getOrLoadImage(input.imagePath)
 *       return { input, imageBase64: input.imageBase64 }
 *     }
 *
 *     // 原有逻辑
 *     ...
 *   }
 * }
 * \`\`\`
 */

// 运行所有示例
export async function runAllExamples() {
  await example1_CacheOptimization()
  await example2_BatchProcessing()
  await example3_CombinedOptimization()
  await example4_PerformanceComparison()
}

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllExamples().catch(console.error)
}
