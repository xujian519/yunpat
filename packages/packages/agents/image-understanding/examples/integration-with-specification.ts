/**
 * DrawingUnderstandingAgent 集成到 SpecificationDrafterAgent 的示例
 *
 * 演示如何使用附图理解智能体增强说明书撰写流程
 */

import { DrawingUnderstandingAgent } from '../src/DrawingUnderstandingAgent.js'
import { EventBus } from '@yunpat/core'
import type {
  SpecificationDrafterInput,
  DrawingDescription,
} from '@yunpat/agent-specification-drafter'

/**
 * 增强的附图输入接口
 */
export interface EnhancedDrawingInput {
  /** 附图编号 */
  figureNumber: string
  /** 附图标题 */
  figureTitle?: string
  /** 附图图像路径 */
  imagePath: string
  /** 附图描述（可选） */
  description?: string
  /** 相关技术方案 */
  technicalSolution?: string
}

/**
 * 增强的说明书撰写输入
 */
export interface EnhancedSpecificationInput extends Omit<SpecificationDrafterInput, 'drawings'> {
  /** 增强的附图列表 */
  drawings?: EnhancedDrawingInput[]
}

/**
 * 附图理解集成器
 *
 * 负责协调附图理解智能体和说明书撰写智能体
 */
export class DrawingUnderstandingIntegrator {
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
   * 理解所有附图
   */
  async understandDrawings(
    drawings: EnhancedDrawingInput[],
    context: {
      technicalField?: string
      technicalSolution?: string
    }
  ): Promise<DrawingDescription[]> {
    const results: DrawingDescription[] = []

    console.log(`\n📊 [附图理解集成] 开始理解 ${drawings.length} 个附图`)

    for (const drawing of drawings) {
      try {
        console.log(`\n处理附图 ${drawing.figureNumber}...`)

        // 使用附图理解智能体
        const understanding = await this.drawingAgent.execute({
          figureNumber: drawing.figureNumber,
          figureTitle: drawing.figureTitle,
          imagePath: drawing.imagePath,
          description: drawing.description,
          technicalField: context.technicalField,
          technicalSolution: drawing.technicalSolution || context.technicalSolution,
        })

        // 转换为 DrawingDescription 格式
        const drawingDescription: DrawingDescription = {
          figureNumber: `图${drawing.figureNumber}`,
          title: drawing.figureTitle || `附图${drawing.figureNumber}`,
          description: understanding.correspondence.suggestedDescription,
          keyElements: understanding.components.map((component, index) => ({
            elementNumber: String(index + 1),
            description: component.description,
          })),
        }

        results.push(drawingDescription)

        console.log(`✅ 附图 ${drawing.figureNumber} 理解完成`)
        console.log(`   类型: ${understanding.figureType}`)
        console.log(`   置信度: ${(understanding.confidence * 100).toFixed(0)}%`)
      } catch (error) {
        console.error(`❌ 附图 ${drawing.figureNumber} 理解失败:`, error)

        // 降级：使用简单的描述
        const fallbackDescription: DrawingDescription = {
          figureNumber: `图${drawing.figureNumber}`,
          title: drawing.figureTitle || `附图${drawing.figureNumber}`,
          description: drawing.description || `图${drawing.figureNumber}为[附图说明]。`,
          keyElements: [],
        }

        results.push(fallbackDescription)
      }
    }

    console.log(`\n✅ [附图理解集成] 完成，成功理解 ${results.length} 个附图`)

    return results
  }

  /**
   * 增强说明书撰写输入
   */
  async enhanceSpecificationInput(
    input: EnhancedSpecificationInput
  ): Promise<SpecificationDrafterInput> {
    // 如果没有附图，直接返回原始输入
    if (!input.drawings || input.drawings.length === 0) {
      return input as SpecificationDrafterInput
    }

    // 理解所有附图
    const drawingDescriptions = await this.understandDrawings(input.drawings, {
      technicalField: input.inventionUnderstanding?.technicalField,
      technicalSolution: input.inventionUnderstanding?.technicalSolution,
    })

    // 转换为字符串数组（保留向后兼容）
    const drawingStrings = drawingDescriptions.map((d) => d.description)

    // 返回增强的输入
    return {
      ...input,
      drawings: drawingStrings,
    }
  }
}

/**
 * 使用示例
 */
export async function example_EnhancedSpecificationDrafting() {
  console.log('=== 示例：增强的说明书撰写 ===\n')

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
                description: '阀座',
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
              technicalFeatures: ['陶瓷材料制造'],
              suggestedDescription:
                '图1为陶瓷阀片组件的结构爆炸图。如图所示，该阀片组件包括陶瓷阀片1、阀座2。',
            },
            confidence: 0.9,
          }),
        },
      }
    },
  }

  const integrator = new DrawingUnderstandingIntegrator(llm)

  // 2. 准备增强的输入
  const enhancedInput: EnhancedSpecificationInput = {
    inventionUnderstanding: {
      technicalField: '机械制造技术领域',
      technicalProblem: '现有阀片耐磨性不足',
      technicalSolution: '采用陶瓷材料制造阀片',
      beneficialEffects: '提高耐磨性和使用寿命',
      triples: [],
    },
    drawings: [
      {
        figureNumber: '1',
        figureTitle: '陶瓷阀片组件爆炸图',
        imagePath: '/path/to/figure1.png',
        technicalSolution: '采用陶瓷材料制造阀片，提高耐磨性。',
      },
      {
        figureNumber: '2',
        figureTitle: '阀片装配图',
        imagePath: '/path/to/figure2.png',
        technicalSolution: '阀片与阀座的装配关系。',
      },
    ],
  }

  // 3. 增强输入
  const standardInput = await integrator.enhanceSpecificationInput(enhancedInput)

  console.log('\n📝 增强后的附图说明:')
  standardInput.drawings?.forEach((description, index) => {
    console.log(`\n附图 ${index + 1}:`)
    console.log(description)
  })

  // 4. 使用增强的输入进行说明书撰写
  // const specificationResult = await specificationDrafter.execute(standardInput)

  return standardInput
}

/**
 * 集成到 SpecificationDrafterAgent 的建议
 *
 * 1. 在 SpecificationDrafterAgent 中添加 DrawingUnderstandingAgent 实例
 * 2. 修改 SpecificationDrafterInput 接口，支持 EnhancedDrawingInput[]
 * 3. 在 act 方法中，如果检测到 EnhancedDrawingInput，使用 DrawingUnderstandingAgent
 * 4. 将理解结果转换为 DrawingDescription 格式
 * 5. 使用增强的附图说明进行后续撰写
 */

export const INTEGRATION_GUIDE = `
# SpecificationDrafterAgent 集成指南

## 步骤 1: 添加依赖

\`\`\`typescript
import { DrawingUnderstandingAgent } from '@yunpat/agent-image-understanding'
\`\`\`

## 步骤 2: 扩展输入接口

\`\`\`typescript
interface EnhancedSpecificationDrafterInput extends SpecificationDrafterInput {
  drawings?: Array<{
    figureNumber: string
    imagePath: string
    figureTitle?: string
    technicalSolution?: string
  }>
}
\`\`\`

## 步骤 3: 在构造函数中初始化

\`\`\`typescript
export class SpecificationDrafterAgent extends Agent<...> {
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

## 步骤 4: 在 plan 或 act 方法中处理附图

\`\`\`typescript
protected async act(plan, context): Promise<SpecificationDrafterOutput> {
  // 如果有图像路径且配置了 drawingAgent
  if (this.hasImagePaths(plan.input.drawings) && this.drawingAgent) {
    const enhancedDrawings = await this.enhanceDrawingsWithUnderstanding(
      plan.input.drawings,
      plan.input.inventionUnderstanding
    )
    plan.input.drawings = enhancedDrawings.map(d => d.description)
  }

  // 继续原有的撰写流程
  ...
}
\`\`\`

## 步骤 5: 添加附图增强方法

\`\`\`typescript
private async enhanceDrawingsWithUnderstanding(
  drawings: any[],
  inventionContext: any
): Promise<DrawingDescription[]> {
  const results = []

  for (const drawing of drawings) {
    if (drawing.imagePath) {
      const understanding = await this.drawingAgent.execute({
        figureNumber: drawing.figureNumber,
        imagePath: drawing.imagePath,
        technicalField: inventionContext.technicalField,
        technicalSolution: drawing.technicalSolution || inventionContext.technicalSolution
      })

      results.push({
        figureNumber: \`图\${drawing.figureNumber}\`,
        title: drawing.figureTitle || \`附图\${drawing.figureNumber}\`,
        description: understanding.correspondence.suggestedDescription,
        keyElements: understanding.components.map(c => ({
          elementNumber: String(understanding.components.indexOf(c) + 1),
          description: c.description
        }))
      })
    }
  }

  return results
}
\`\`\`

## 优势

1. **自动化**: 自动理解附图内容，减少人工编写
2. **准确性**: 基于多模态模型的附图理解，提高准确性
3. **一致性**: 附图说明与技术方案保持一致
4. **降级**: 理解失败时自动降级到基础描述
`

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
  example_EnhancedSpecificationDrafting().catch(console.error)
}
