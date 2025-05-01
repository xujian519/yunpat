/**
 * DrawingUnderstandingAgent 使用示例
 *
 * 演示如何使用附图理解智能体
 */

import { DrawingUnderstandingAgent } from '../src/DrawingUnderstandingAgent.js'
import { EventBus } from '@yunpat/core'

// 示例 1: 基础使用 - 理解单个附图
async function example1_BasicUsage() {
  console.log('=== 示例 1: 基础使用 ===\n')

  const agent = new DrawingUnderstandingAgent({
    name: 'drawing-understanding',
    description: '附图理解智能体',
    eventBus: new EventBus(),
    memory: {},
    tools: {},
    llm: {
      chat: async (params: any) => {
        // 模拟多模态 LLM 响应
        return {
          message: {
            content: JSON.stringify({
              figureType: 'exploded_view',
              overview: '陶瓷阀片组件的爆炸图，展示了阀片、阀座和密封圈的装配关系',
              components: [
                {
                  type: 'component',
                  description: '陶瓷阀片',
                  boundingBox: { x: 30, y: 20, width: 40, height: 60 },
                  confidence: 0.95,
                },
                {
                  type: 'component',
                  description: '阀座',
                  boundingBox: { x: 25, y: 70, width: 50, height: 25 },
                  confidence: 0.9,
                },
                {
                  type: 'component',
                  description: '密封圈',
                  boundingBox: { x: 10, y: 50, width: 20, height: 20 },
                  confidence: 0.85,
                },
              ],
              connections: [],
              labels: [
                {
                  type: 'label',
                  description: '1-陶瓷阀片',
                  boundingBox: { x: 35, y: 25, width: 30, height: 15 },
                  confidence: 0.92,
                },
                {
                  type: 'label',
                  description: '2-阀座',
                  boundingBox: { x: 35, y: 75, width: 30, height: 15 },
                  confidence: 0.88,
                },
              ],
              annotations: [],
              structureAnalysis: {
                mainStructure: '阀片组件',
                subStructures: ['阀片部分', '阀座部分'],
                hierarchy: ['组件级', '零件级'],
              },
              correspondence: {
                technicalFeatures: ['陶瓷材料制造阀片', '表面精度达到0.01mm'],
                suggestedDescription:
                  '图1为陶瓷阀片组件的结构爆炸图。如图所示，该阀片组件包括陶瓷阀片1、阀座2和密封圈3。陶瓷阀片1采用氧化锆材料制成，设置在阀座2的上部，密封圈3位于阀片1和阀座2之间，确保密封连接。',
              },
              confidence: 0.9,
            }),
          },
        }
      },
    },
  })

  const input = {
    figureNumber: '1',
    figureTitle: '陶瓷阀片组件爆炸图',
    imagePath: '/path/to/figure1.png',
    technicalField: '机械制造技术领域，具体涉及一种阀门组件',
    technicalSolution: '采用陶瓷材料制造阀片，表面精度达到0.01mm，提高耐磨性和密封性。',
  }

  try {
    const result = await agent.execute(input)

    console.log('附图类型:', result.figureType)
    console.log('主要内容:', result.overview)
    console.log('识别组件:', result.components.length)
    console.log('文字标签:', result.labels.length)
    console.log('置信度:', result.confidence)

    console.log('\n建议附图说明:')
    console.log(result.correspondence.suggestedDescription)
  } catch (error) {
    console.error('附图理解失败:', error)
  }
}

// 示例 2: 批量理解多个附图
async function example2_BatchProcessing() {
  console.log('\n\n=== 示例 2: 批量处理 ===\n')

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
              overview: '技术方案原理图',
              components: [],
              connections: [],
              labels: [],
              annotations: [],
              structureAnalysis: {
                mainStructure: '系统架构',
                subStructures: [],
                hierarchy: [],
              },
              correspondence: {
                technicalFeatures: [],
                suggestedDescription: '图2为技术方案的原理示意图。',
              },
              confidence: 0.85,
            }),
          },
        }
      },
    },
  })

  const drawings = [
    {
      figureNumber: '1',
      imagePath: '/path/to/figure1.png',
      technicalField: '机械工程',
    },
    {
      figureNumber: '2',
      imagePath: '/path/to/figure2.png',
      technicalField: '机械工程',
    },
    {
      figureNumber: '3',
      imagePath: '/path/to/figure3.png',
      technicalField: '机械工程',
    },
  ]

  const results = []

  for (const drawing of drawings) {
    try {
      const result = await agent.execute(drawing)
      results.push(result)
      console.log(`✅ 图${drawing.figureNumber} 理解完成`)
    } catch (error) {
      console.error(`❌ 图${drawing.figureNumber} 理解失败:`, error.message)
    }
  }

  console.log(`\n批量处理完成: ${results.length}/${drawings.length}`)
}

// 示例 3: 使用 Base64 编码的图像
async function example3_Base64Image() {
  console.log('\n\n=== 示例 3: Base64 图像 ===\n')

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
              figureType: 'cross_section',
              overview: '剖视图展示了内部结构',
              components: [],
              connections: [],
              labels: [],
              annotations: [],
              structureAnalysis: {
                mainStructure: '剖面结构',
                subStructures: [],
                hierarchy: [],
              },
              correspondence: {
                technicalFeatures: [],
                suggestedDescription: '图4为沿A-A线的剖视图。',
              },
              confidence: 0.88,
            }),
          },
        }
      },
    },
  })

  // 模拟 Base64 编码的图像
  const mockBase64 =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

  const input = {
    figureNumber: '4',
    figureTitle: 'A-A剖视图',
    imagePath: '/path/to/figure4.png',
    imageBase64: mockBase64,
    technicalField: '机械工程',
  }

  try {
    const result = await agent.execute(input)
    console.log('附图类型:', result.figureType)
    console.log('主要内容:', result.overview)
  } catch (error) {
    console.error('附图理解失败:', error)
  }
}

// 示例 4: 集成到专利撰写流程
async function example4_Integration() {
  console.log('\n\n=== 示例 4: 集成到专利撰写 ===\n')

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
              overview: '组件爆炸图',
              components: [
                {
                  type: 'component',
                  description: '控制器',
                  confidence: 0.9,
                },
              ],
              connections: [],
              labels: [],
              annotations: [],
              structureAnalysis: {
                mainStructure: '控制系统',
                subStructures: [],
                hierarchy: [],
              },
              correspondence: {
                technicalFeatures: ['分布式控制架构'],
                suggestedDescription:
                  '图5为智能控制系统的组成框图。如图所示，该系统包括控制器、传感器模块和执行机构。',
              },
              confidence: 0.85,
            }),
          },
        }
      },
    },
  })

  // 模拟专利撰写场景
  const patentInput = {
    figureNumber: '5',
    imagePath: '/path/to/figure5.png',
    technicalField: '计算机程序',
    technicalSolution: '一种分布式智能控制系统，包括多个控制器节点，通过总线连接。',
  }

  try {
    // 1. 理解附图
    const understanding = await agent.execute(patentInput)

    // 2. 生成附图说明
    const drawingDescription = understanding.correspondence.suggestedDescription

    // 3. 提取技术特征
    const technicalFeatures = understanding.correspondence.technicalFeatures

    console.log('附图说明:')
    console.log(drawingDescription)
    console.log('\n体现的技术特征:')
    technicalFeatures.forEach((feature, index) => {
      console.log(`  ${index + 1}. ${feature}`)
    })
  } catch (error) {
    console.error('集成处理失败:', error)
  }
}

// 示例 5: 错误处理
async function example5_ErrorHandling() {
  console.log('\n\n=== 示例 5: 错误处理 ===\n')

  const agent = new DrawingUnderstandingAgent({
    name: 'drawing-understanding',
    description: '附图理解智能体',
    eventBus: new EventBus(),
    memory: {},
    tools: {},
    llm: {
      chat: async (params: any) => {
        // 模拟失败情况
        throw new Error('LLM 服务不可用')
      },
    },
  })

  const input = {
    figureNumber: '6',
    imagePath: '/path/to/nonexistent.png', // 不存在的文件
  }

  try {
    const result = await agent.execute(input)
  } catch (error) {
    console.error('捕获到预期错误:', error.message)

    // 降级处理：使用默认附图说明
    const defaultDescription = `图${input.figureNumber}为[附图说明]`
    console.log('使用默认说明:', defaultDescription)
  }
}

// 运行所有示例
async function main() {
  await example1_BasicUsage()
  await example2_BatchProcessing()
  await example3_Base64Image()
  await example4_Integration()
  await example5_ErrorHandling()
}

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}
