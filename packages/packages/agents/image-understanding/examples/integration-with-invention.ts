/**
 * DrawingUnderstandingAgent 集成到 InventionUnderstandingAgent 的示例
 *
 * 演示如何使用附图理解智能体增强发明理解流程
 */

import { DrawingUnderstandingAgent } from '../src/DrawingUnderstandingAgent.js'
import { EventBus } from '@yunpat/core'
import type { InventionUnderstandingInput, Triplet } from '@yunpat/agent-invention'

/**
 * 增强的发明理解输入
 */
export interface EnhancedInventionInput extends InventionUnderstandingInput {
  /** 附图列表 */
  drawings?: Array<{
    figureNumber: string
    imagePath: string
    figureTitle?: string
  }>
}

/**
 * 发明理解集成器
 *
 * 负责协调附图理解智能体和发明理解智能体
 */
export class InventionUnderstandingIntegrator {
  private drawingAgent: DrawingUnderstandingAgent

  constructor(llm: any) {
    this.drawingAgent = new DrawingUnderstandingAgent({
      name: 'drawing-understanding',
      description: '附图理解智能体',
      eventBus: new EventBus(),
      memory: {},
      tools: {},
      llm,
    })
  }

  /**
   * 从附图中提取技术特征
   */
  async extractFeaturesFromDrawings(
    drawings: Array<{ figureNumber: string; imagePath: string; figureTitle?: string }>,
    technicalDisclosure: string
  ): Promise<string[]> {
    const allFeatures: string[] = []

    console.log(`\n🔍 [发明理解集成] 从 ${drawings.length} 个附图中提取技术特征`)

    for (const drawing of drawings) {
      try {
        console.log(`\n分析附图 ${drawing.figureNumber}...`)

        // 使用附图理解智能体
        const understanding = await this.drawingAgent.execute({
          figureNumber: drawing.figureNumber,
          imagePath: drawing.imagePath,
          figureTitle: drawing.figureTitle,
          technicalSolution: technicalDisclosure,
        })

        // 提取技术特征
        const features = understanding.correspondence.technicalFeatures
        allFeatures.push(...features)

        console.log(`✅ 从附图 ${drawing.figureNumber} 提取了 ${features.length} 个技术特征`)
        features.forEach((feature) => {
          console.log(`   - ${feature}`)
        })
      } catch (error) {
        console.error(`❌ 附图 ${drawing.figureNumber} 分析失败:`, error)
      }
    }

    console.log(`\n✅ [发明理解集成] 共提取了 ${allFeatures.length} 个技术特征`)

    return allFeatures
  }

  /**
   * 增强发明理解
   */
  async enhanceInventionUnderstanding(
    input: EnhancedInventionInput,
    existingTriplets: Triplet[]
  ): Promise<Triplet[]> {
    // 如果没有附图，直接返回原有的三元组
    if (!input.drawings || input.drawings.length === 0) {
      return existingTriplets
    }

    console.log('\n📊 [发明理解集成] 开始增强发明理解')

    // 从附图中提取技术特征
    const drawingFeatures = await this.extractFeaturesFromDrawings(
      input.drawings,
      input.technicalDisclosure
    )

    // 将附图特征转换为三元组
    const enhancedTriplets = [...existingTriplets]

    for (const feature of drawingFeatures) {
      // 创建新的三元组
      const newTriplet: Triplet = {
        technicalProblem: input.technicalProblem || '技术问题',
        keyFeatures: [feature],
        technicalEffects: [],
        confidence: 0.7, // 附图提取的特征置信度稍低
        source: 'drawing_analysis',
      }

      enhancedTriplets.push(newTriplet)
    }

    console.log(
      `\n✅ [发明理解集成] 三元组从 ${existingTriplets.length} 个增加到 ${enhancedTriplets.length} 个`
    )

    return enhancedTriplets
  }

  /**
   * 验证附图与技术方案的一致性
   */
  async validateConsistency(
    input: EnhancedInventionInput,
    triplets: Triplet[]
  ): Promise<{
    isConsistent: boolean
    inconsistencies: string[]
    suggestions: string[]
  }> {
    if (!input.drawings || input.drawings.length === 0) {
      return {
        isConsistent: true,
        inconsistencies: [],
        suggestions: [],
      }
    }

    console.log('\n🔍 [发明理解集成] 验证附图与技术方案的一致性')

    const inconsistencies: string[] = []
    const suggestions: string[] = []

    // 提取技术方案中的所有特征
    const solutionFeatures = new Set(triplets.flatMap((t) => t.keyFeatures))

    // 从附图中提取特征
    const drawingFeatures = await this.extractFeaturesFromDrawings(
      input.drawings,
      input.technicalDisclosure
    )

    // 检查一致性
    for (const drawingFeature of drawingFeatures) {
      // 简单的字符串匹配（实际应用中可以使用更复杂的相似度算法）
      const isMentioned = Array.from(solutionFeatures).some(
        (solutionFeature) =>
          solutionFeature.includes(drawingFeature) || drawingFeature.includes(solutionFeature)
      )

      if (!isMentioned) {
        inconsistencies.push(`附图中体现的技术特征 "${drawingFeature}" 在技术方案中没有明确提及`)
        suggestions.push(`建议在技术方案中补充说明 "${drawingFeature}"`)
      }
    }

    const isConsistent = inconsistencies.length === 0

    console.log(`\n${isConsistent ? '✅' : '⚠️'} 一致性检查完成`)
    console.log(`   发现 ${inconsistencies.length} 个不一致之处`)

    return {
      isConsistent,
      inconsistencies,
      suggestions,
    }
  }
}

/**
 * 使用示例
 */
export async function example_EnhancedInventionUnderstanding() {
  console.log('=== 示例：增强的发明理解 ===\n')

  // 1. 创建集成器
  const llm = {
    chat: async (params: any) => {
      // 模拟多模态 LLM 响应
      return {
        message: {
          content: JSON.stringify({
            figureType: 'exploded_view',
            overview: '陶瓷阀片组件的爆炸图',
            components: [
              {
                type: 'component',
                description: '陶瓷阀片',
                confidence: 0.95,
              },
              {
                type: 'component',
                description: '表面精度0.01mm',
                confidence: 0.9,
              },
            ],
            connections: [],
            labels: [],
            annotations: [],
            structureAnalysis: {
              mainStructure: '阀片组件',
              subStructures: [],
              hierarchy: [],
            },
            correspondence: {
              technicalFeatures: ['陶瓷材料制造阀片', '表面精度达到0.01mm', '氧化锆材料'],
              suggestedDescription: '图1为陶瓷阀片组件的结构爆炸图。',
            },
            confidence: 0.9,
          }),
        },
      }
    },
  }

  const integrator = new InventionUnderstandingIntegrator(llm)

  // 2. 准备输入
  const enhancedInput: EnhancedInventionInput = {
    technicalDisclosure: '一种陶瓷阀片，采用氧化锆材料制造，表面精度达到0.01mm，提高耐磨性。',
    technicalProblem: '现有金属阀片耐磨性不足',
    drawings: [
      {
        figureNumber: '1',
        imagePath: '/path/to/figure1.png',
        figureTitle: '陶瓷阀片组件爆炸图',
      },
      {
        figureNumber: '2',
        imagePath: '/path/to/figure2.png',
        figureTitle: '阀片表面处理图',
      },
    ],
  }

  // 3. 原有的三元组
  const existingTriplets: Triplet[] = [
    {
      technicalProblem: '现有金属阀片耐磨性不足',
      keyFeatures: ['采用氧化锆材料制造'],
      technicalEffects: ['提高耐磨性'],
      confidence: 0.9,
    },
  ]

  // 4. 增强发明理解
  const enhancedTriplets = await integrator.enhanceInventionUnderstanding(
    enhancedInput,
    existingTriplets
  )

  console.log('\n📊 增强后的三元组:')
  enhancedTriplets.forEach((triplet, index) => {
    console.log(`\n三元组 ${index + 1}:`)
    console.log(`  问题: ${triplet.technicalProblem}`)
    console.log(`  特征: ${triplet.keyFeatures.join(', ')}`)
    console.log(`  效果: ${triplet.technicalEffects.join(', ')}`)
    console.log(`  置信度: ${triplet.confidence}`)
    console.log(`  来源: ${triplet.source || '原始输入'}`)
  })

  // 5. 验证一致性
  const validation = await integrator.validateConsistency(enhancedInput, enhancedTriplets)

  console.log('\n🔍 一致性验证结果:')
  console.log(`  是否一致: ${validation.isConsistent ? '是' : '否'}`)
  if (validation.inconsistencies.length > 0) {
    console.log('\n  不一致之处:')
    validation.inconsistencies.forEach((issue) => {
      console.log(`    - ${issue}`)
    })
  }
  if (validation.suggestions.length > 0) {
    console.log('\n  改进建议:')
    validation.suggestions.forEach((suggestion) => {
      console.log(`    - ${suggestion}`)
    })
  }

  return {
    enhancedTriplets,
    validation,
  }
}

/**
 * 集成到 InventionUnderstandingAgent 的建议
 *
 * 1. 在 InventionUnderstandingAgent 中添加 DrawingUnderstandingAgent 实例
 * 2. 扩展输入接口，支持附图列表
 * 3. 在三元组提取后，如果有附图，使用 DrawingUnderstandingAgent 提取额外特征
 * 4. 合并原有三元组和附图特征三元组
 * 5. 可选：添加一致性检查功能
 */

export const INTEGRATION_GUIDE = `
# InventionUnderstandingAgent 集成指南

## 步骤 1: 添加依赖

\`\`\`typescript
import { DrawingUnderstandingAgent } from '@yunpat/agent-image-understanding'
\`\`\`

## 步骤 2: 扩展输入接口

\`\`\`typescript
interface EnhancedInventionUnderstandingInput extends InventionUnderstandingInput {
  drawings?: Array<{
    figureNumber: string
    imagePath: string
    figureTitle?: string
  }>
}
\`\`\`

## 步骤 3: 在构造函数中初始化

\`\`\`typescript
export class InventionUnderstandingAgent extends Agent<...> {
  private drawingAgent?: DrawingUnderstandingAgent

  constructor(config) {
    super(config)
    if (config.llm) {
      this.drawingAgent = new DrawingUnderstandingAgent({
        name: 'drawing-understanding',
        eventBus: config.eventBus,
        memory: config.memory,
        tools: config.tools,
        llm: config.llm
      })
    }
  }
}
\`\`\`

## 步骤 4: 在三元组提取后增强

\`\`\`typescript
protected async act(plan, context): Promise<InventionUnderstandingOutput> {
  // 原有的三元组提取
  let triplets = await this.extractTriplets(plan.input, knowledge)

  // 如果有附图且配置了 drawingAgent，增强三元组
  if (plan.input.drawings && this.drawingAgent) {
    const enhancedTriplets = await this.enhanceTripletsWithDrawings(
      plan.input.drawings,
      plan.input.technicalDisclosure,
      triplets
    )
    triplets = enhancedTriplets
  }

  // 继续原有流程
  ...
}
\`\`\`

## 步骤 5: 添加附图增强方法

\`\`\`typescript
private async enhanceTripletsWithDrawings(
  drawings: Array<{ imagePath: string; figureNumber: string }>,
  technicalDisclosure: string,
  existingTriplets: Triplet[]
): Promise<Triplet[]> {
  const enhanced = [...existingTriplets]

  for (const drawing of drawings) {
    try {
      const understanding = await this.drawingAgent.execute({
        figureNumber: drawing.figureNumber,
        imagePath: drawing.imagePath,
        technicalSolution: technicalDisclosure
      })

      // 将附图特征转换为三元组
      for (const feature of understanding.correspondence.technicalFeatures) {
        enhanced.push({
          technicalProblem: plan.input.technicalProblem || '技术问题',
          keyFeatures: [feature],
          technicalEffects: [],
          confidence: 0.7,
          source: 'drawing_analysis'
        })
      }
    } catch (error) {
      console.error(\`附图 \${drawing.figureNumber} 分析失败:\`, error)
    }
  }

  return enhanced
}
\`\`\`

## 优势

1. **特征补充**: 从附图中提取技术方案中遗漏的特征
2. **一致性检查**: 验证附图与技术方案的一致性
3. **完整性**: 确保技术特征的全面性
4. **质量提升**: 提高发明理解的准确性和完整性
`

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
  example_EnhancedInventionUnderstanding().catch(console.error)
}
