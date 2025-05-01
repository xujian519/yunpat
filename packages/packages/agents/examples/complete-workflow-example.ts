/**
 * YunPat 智能体完整使用示例
 *
 * 本示例展示如何使用四个通用智能体完成完整的专利分析流程：
 * 1. 发明理解
 * 2. 专利技术分析
 * 3. 质量检查
 * 4. 说明书撰写
 */

import {
  InventionUnderstandingAgent,
  PatentTechnicalAnalyzerAgent,
  QualityCheckerAgent,
  SpecificationDrafterAgent,
} from '@yunpat/agents'

// 模拟技术交底书
const technicalDisclosure = `
发明名称：一种基于深度学习的智能图像识别系统

技术领域：
本发明涉及人工智能和计算机视觉技术领域，特别涉及一种基于深度学习的智能图像识别系统。

背景技术：
现有图像识别技术存在以下问题：
1. 在复杂场景下识别准确率较低
2. 对小目标物体的检测能力不足
3. 计算资源消耗较大，难以在边缘设备部署

技术方案：
本发明提供一种基于深度学习的智能图像识别系统，包括：
1. 多尺度特征提取模块：采用改进的卷积神经网络架构
2. 注意力机制模块：增强关键区域的特征表示
3. 轻量化设计：使用模型压缩技术降低计算复杂度

关键特征：
- 采用注意力增强的卷积神经网络
- 多尺度特征融合策略
- 知识蒸馏实现的轻量化模型
- 自适应阈值调整机制

有益效果：
与现有技术相比，本发明具有以下优势：
- 识别准确率提升25%
- 小目标检测精度提升40%
- 模型参数量减少60%
- 推理速度提升3倍

附图：
图1：系统整体架构图
图2：多尺度特征提取模块示意图
图3：注意力机制工作流程图
`

async function main() {
  // ==================== 配置部分 ====================
  const config = {
    llm: {
      // 配置你的LLM适配器
      chat: async ({ messages, temperature }: any) => {
        // 这里应该是实际的LLM调用
        console.log('调用LLM...')
        return {
          message: {
            content: JSON.stringify({
              // 模拟响应
              technicalField: '人工智能和计算机视觉技术领域',
              backgroundArt: '现有图像识别技术存在准确率低、资源消耗大等问题',
              technicalProblem: '如何在复杂场景下提高图像识别准确率并降低计算复杂度',
              technicalSolution: '采用注意力增强的卷积神经网络和多尺度特征融合策略',
              beneficialEffects: '识别准确率提升25%，模型参数量减少60%',
              keyFeatures: [
                '注意力增强的卷积神经网络',
                '多尺度特征融合策略',
                '知识蒸馏实现的轻量化模型',
                '自适应阈值调整机制',
              ],
              drawingDescriptions: [
                '图1为系统整体架构图，展示了各模块的连接关系',
                '图2为多尺度特征提取模块示意图',
                '图3为注意力机制工作流程图',
              ],
              confidence: 0.92,
            }),
          },
        }
      },
    },
    eventBus: {
      publish: () => {},
      subscribe: () => {},
    },
    memory: {},
    tools: {},
  }

  // ==================== 步骤1: 发明理解 ====================
  console.log('\n=== 步骤1: 发明理解 ===\n')

  const inventionAgent = new InventionUnderstandingAgent({
    name: 'invention-understanding',
    description: '发明理解智能体',
    ...config,
  })

  const inventionResult = await inventionAgent.execute({
    title: '一种基于深度学习的智能图像识别系统',
    field: '人工智能',
    technicalDisclosure: technicalDisclosure,
    drawings: ['图1: 系统架构图', '图2: 特征提取模块', '图3: 注意力机制'],
    enableMultiRound: false, // 设置为true启用多轮对话
    confidenceThreshold: 0.8,
  })

  console.log('发明理解结果:')
  console.log(`- 技术领域: ${inventionResult.technicalField}`)
  console.log(`- 技术问题: ${inventionResult.technicalProblem}`)
  console.log(`- 关键特征: ${inventionResult.keyFeatures.length} 个`)
  console.log(`- 置信度: ${(inventionResult.confidence * 100).toFixed(1)}%`)

  // ==================== 步骤2: 专利技术分析（对比分析） ====================
  console.log('\n=== 步骤2: 专利技术分析 ===\n')

  const analyzerAgent = new PatentTechnicalAnalyzerAgent({
    name: 'patent-analyzer',
    description: '专利技术分析智能体',
    ...config,
  })

  // 模拟对比专利
  const comparisonPatent = {
    publicationNumber: 'CN112345678A',
    title: '一种图像识别方法及装置',
    abstract: '本发明公开了一种图像识别方法，包括：提取图像特征...',
    applicant: '对比公司',
    publicationDate: '2023-05-15',
  }

  const analysisResult = await analyzerAgent.execute({
    patent: comparisonPatent,
    inventionUnderstanding: {
      technicalProblem: inventionResult.technicalProblem,
      technicalSolution: inventionResult.technicalSolution,
      keyFeatures: inventionResult.keyFeatures,
    },
    analysisDepth: 2,
    enableKnowledgeEnhancement: false,
  })

  console.log('技术分析结果:')
  console.log(`- 相似度: ${(analysisResult.comparison.similarity * 100).toFixed(1)}%`)
  console.log(
    `- 新颖性: ${analysisResult.comparison.novelty.hasNovelty ? '✓ 具有新颖性' : '✗ 不具有新颖性'}`
  )
  console.log(
    `- 创造性: ${analysisResult.comparison.inventive_step.hasInventiveStep ? '✓ 具有创造性' : '✗ 不具有创造性'}`
  )
  console.log(`- 区别特征: ${analysisResult.comparison.distinctFeatures.length} 个`)

  // ==================== 步骤3: 质量检查 ====================
  console.log('\n=== 步骤3: 质量检查 ===\n')

  const qualityAgent = new QualityCheckerAgent({
    name: 'quality-checker',
    description: '质量检查智能体',
    ...config,
  })

  // 模拟专利申请文件
  const patentApplication = {
    claims: [
      {
        type: 'independent' as const,
        number: 1,
        content:
          '一种基于深度学习的智能图像识别系统，其特征在于，包括：多尺度特征提取模块，用于提取图像的多层次特征；注意力机制模块，用于增强关键区域的特征表示；轻量化模块，用于降低模型计算复杂度。',
      },
      {
        type: 'dependent' as const,
        number: 2,
        content:
          '根据权利要求1所述的系统，其特征在于，所述多尺度特征提取模块采用改进的卷积神经网络架构。',
        dependsOn: 1,
      },
      {
        type: 'dependent' as const,
        number: 3,
        content:
          '根据权利要求1所述的系统，其特征在于，所述注意力机制模块采用自注意力机制与卷积注意力相结合的方式。',
        dependsOn: 1,
      },
    ],
    specification: {
      technicalField: inventionResult.technicalField,
      backgroundArt: inventionResult.backgroundArt,
      inventionContent: `${inventionResult.technicalProblem}\n\n${inventionResult.technicalSolution}\n\n${inventionResult.beneficialEffects}`,
      embodiment:
        '如图1所示，本发明包括多尺度特征提取模块10、注意力机制模块20和轻量化模块30。多尺度特征提取模块10采用改进的ResNet架构，包括三个不同尺度的特征提取分支...',
    },
    patentType: 'invention' as const,
    inventionTitle: '一种基于深度学习的智能图像识别系统',
  }

  const qualityResult = await qualityAgent.execute({
    ...patentApplication,
    checkLevel: 2, // 1=基础, 2=标准, 3=严格
    enableAutoFix: true,
  })

  console.log('质量检查结果:')
  console.log(`- 完整性评分: ${qualityResult.completenessScore.toFixed(1)}/100`)
  console.log(`- 总体质量: ${qualityResult.overallQuality.toFixed(1)}/100`)
  console.log(`- 质量等级: ${qualityResult.qualityLevel}`)
  console.log(`- 发现问题: ${qualityResult.issues.length} 个`)
  console.log(`- 改进建议: ${qualityResult.recommendations.length} 条`)

  if (qualityResult.issues.length > 0) {
    console.log('\n主要问题:')
    qualityResult.issues.slice(0, 3).forEach((issue) => {
      console.log(`  - [${issue.severity.toUpperCase()}] ${issue.description}`)
    })
  }

  // ==================== 步骤4: 说明书撰写 ====================
  console.log('\n=== 步骤4: 说明书撰写 ===\n')

  const drafterAgent = new SpecificationDrafterAgent({
    name: 'spec-drafter',
    description: '说明书撰写智能体',
    ...config,
  })

  const draftResult = await drafterAgent.execute({
    inventionUnderstanding: inventionResult,
    priorArtSearch: undefined, // 可选：传入检索结果
    claimsSet: undefined, // 可选：传入权利要求
    drawings: ['图1: 系统整体架构图', '图2: 多尺度特征提取模块', '图3: 注意力机制流程'],
    draftMode: 'standard', // standard | detailed | concise
    patentType: 'invention',
  })

  console.log('说明书撰写结果:')
  console.log(`- 总字数: ${draftResult.metrics.totalWordCount}`)
  console.log(`- 质量评分: ${(draftResult.qualityScore.overall * 100).toFixed(1)}/100`)
  console.log(`- 术语一致性: ${draftResult.metrics.terminologyConsistency ? '✓' : '✗'}`)
  console.log(`- 充分公开: ${draftResult.metrics.enablementCheck ? '✓' : '✗'}`)
  console.log(`- 实施例数量: ${draftResult.specification.embodiments.embodiment_list.length}`)

  // ==================== 输出摘要报告 ====================
  console.log('\n=== 分析摘要报告 ===\n')

  console.log('发明理解:')
  console.log(`  置信度: ${(inventionResult.confidence * 100).toFixed(1)}%`)
  console.log(`  关键特征: ${inventionResult.keyFeatures.join(', ')}`)

  console.log('\n对比分析:')
  console.log(`  与对比专利相似度: ${(analysisResult.comparison.similarity * 100).toFixed(1)}%`)
  console.log(`  新颖性: ${analysisResult.comparison.novelty.hasNovelty ? '具备' : '不具备'}`)
  console.log(
    `  创造性: ${analysisResult.comparison.inventive_step.hasInventiveStep ? '具备' : '不具备'}`
  )

  console.log('\n质量评估:')
  console.log(`  完整性: ${qualityResult.completenessScore.toFixed(1)}/100`)
  console.log(`  质量等级: ${qualityResult.qualityLevel}`)
  console.log(`  需改进项: ${qualityResult.issues.length} 个`)

  console.log('\n说明书撰写:')
  console.log(`  总字数: ${draftResult.metrics.totalWordCount}`)
  console.log(`  质量评分: ${(draftResult.qualityScore.overall * 100).toFixed(1)}/100`)
  console.log(`  实施例: ${draftResult.specification.embodiments.embodiment_list.length} 个`)

  return {
    invention: inventionResult,
    analysis: analysisResult,
    quality: qualityResult,
    draft: draftResult,
  }
}

// 运行示例
if (require.main === module) {
  main().catch(console.error)
}

export { main }
