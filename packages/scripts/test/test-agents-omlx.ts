#!/usr/bin/env node

/**
 * YunPat 智能体 oMLX 集成测试
 *
 * 测试所有主要智能体与 oMLX 本地模型的集成：
 * 1. InventionUnderstandingAgent - 发明理解
 * 2. PatentTechnicalAnalyzerAgent - 技术分析
 * 3. ClaimsGeneratorAgent - 权利要求生成
 * 4. QualityCheckerAgent - 质量检查
 * 5. SpecificationDrafterAgent - 说明书撰写
 */

import { EventBus, ShortTermMemory, ToolRegistry } from '../packages/core/dist/index.js'
import { createPatentWritingModel, createReasoningModel } from '../packages/core/dist/llm/index.js'

// 动态导入智能体
const importAgent = async (packageName: string) => {
  const module = await import(packageName)
  return module
}

/**
 * 测试数据
 */
const testInput = {
  title: '一种基于深度学习的图像识别方法',
  field: '人工智能与图像处理技术领域',
  disclosure: `
## 技术领域
本发明涉及人工智能与图像处理技术领域，具体涉及一种基于深度学习的图像识别方法。

## 背景技术
随着人工智能技术的发展，图像识别技术在各个领域得到广泛应用。现有的图像识别方法主要使用卷积神经网络（CNN）进行特征提取，然后通过全连接层进行分类。然而，现有方法存在以下问题：
1. 对复杂场景的识别准确率不高
2. 计算量大，实时性差
3. 对小样本数据的学习能力有限

## 发明内容
本发明提供一种基于深度学习的图像识别方法，包括以下步骤：
1. 获取待识别图像
2. 使用残差网络（ResNet）提取图像特征
3. 引入注意力机制增强关键特征
4. 使用多尺度特征融合提高识别准确率
5. 通过分类器进行图像分类

## 技术方案
核心创新点：
- 采用残差网络结构，避免深层网络梯度消失
- 引入通道注意力和空间注意力机制
- 使用特征金字塔网络（FPN）进行多尺度特征融合
- 采用迁移学习策略，利用预训练模型

## 有益效果
与现有技术相比，本发明具有以下有益效果：
1. 提高复杂场景下的识别准确率
2. 减少计算量，提高实时性
3. 增强对小样本数据的学习能力
4. 模型泛化能力强
  `.trim(),
}

/**
 * 测试 1: 发明理解智能体
 */
async function testInventionUnderstandingAgent() {
  console.log('\n📝 测试 1: InventionUnderstandingAgent - 发明理解')
  console.log('='.repeat(60))

  try {
    const { InventionUnderstandingAgent } = await importAgent(
      '../packages/agents/invention/dist/index.js'
    )

    const eventBus = new EventBus()
    const memory = new ShortTermMemory()
    const tools = new ToolRegistry(eventBus)
    const llm = createPatentWritingModel()

    const agent = new InventionUnderstandingAgent({
      name: 'invention-understanding',
      description: '发明理解智能体',
      llm,
      memory,
      tools,
      eventBus,
    })

    console.log('⏳ 执行发明理解...')
    const result = await agent.execute({
      title: testInput.title,
      field: testInput.field,
      technicalDisclosure: testInput.disclosure,
    })

    console.log('✅ 发明理解完成')
    console.log(`📊 技术领域: ${result.technicalField}`)
    console.log(`🔑 关键特征: ${result.keyFeatures.length} 个`)
    console.log(`💡 置信度: ${(result.confidence * 100).toFixed(1)}%`)

    if (result.clarificationQuestions && result.clarificationQuestions.length > 0) {
      console.log(`❓ 需要澄清的问题: ${result.clarificationQuestions.length} 个`)
    }

    return result
  } catch (error) {
    console.error('❌ 发明理解失败:', error)
    throw error
  }
}

/**
 * 测试 2: 技术分析智能体
 */
async function testPatentTechnicalAnalyzerAgent() {
  console.log('\n🔍 测试 2: PatentTechnicalAnalyzerAgent - 技术分析')
  console.log('='.repeat(60))

  try {
    const { PatentTechnicalAnalyzerAgent } = await importAgent(
      '../packages/agents/analysis/dist/index.js'
    )

    const eventBus = new EventBus()
    const memory = new ShortTermMemory()
    const tools = new ToolRegistry(eventBus)
    const llm = createReasoningModel()

    const agent = new PatentTechnicalAnalyzerAgent({
      name: 'patent-technical-analyzer',
      description: '技术分析智能体',
      llm,
      memory,
      tools,
      eventBus,
    })

    console.log('⏳ 执行技术分析...')
    const result = await agent.execute({
      patentDescription: testInput.disclosure,
      analysisDepth: 'standard',
    })

    console.log('✅ 技术分析完成')
    console.log(`📊 技术领域: ${result.technicalField}`)
    console.log(`🔑 关键技术点: ${result.keyTechnicalPoints?.length || 0} 个`)

    if (result.overlappingFeatures && result.overlappingFeatures.length > 0) {
      console.log(`🔄 重叠特征: ${result.overlappingFeatures.length} 个`)
    }

    if (result.distinctiveFeatures && result.distinctiveFeatures.length > 0) {
      console.log(`⭐ 独特特征: ${result.distinctiveFeatures.length} 个`)
    }

    return result
  } catch (error) {
    console.error('❌ 技术分析失败:', error)
    throw error
  }
}

/**
 * 测试 3: 权利要求生成智能体
 */
async function testClaimsGeneratorAgent() {
  console.log('\n📜 测试 3: ClaimsGeneratorAgent - 权利要求生成')
  console.log('='.repeat(60))

  try {
    const { ClaimsGeneratorAgent } = await importAgent(
      '../packages/agents/claim-generator/dist/index.js'
    )

    const eventBus = new EventBus()
    const memory = new ShortTermMemory()
    const tools = new ToolRegistry(eventBus)
    const llm = createPatentWritingModel()

    const agent = new ClaimsGeneratorAgent({
      name: 'claims-generator',
      description: '权利要求生成智能体',
      llm,
      memory,
      tools,
      eventBus,
    })

    console.log('⏳ 生成权利要求...')
    const result = await agent.execute({
      technicalField: testInput.field,
      technicalProblem: '现有图像识别方法准确率不高、计算量大',
      technicalSolution: testInput.disclosure,
      beneficialEffects: '提高准确率、减少计算量、增强泛化能力',
      keyFeatures: ['残差网络结构', '注意力机制', '多尺度特征融合', '迁移学习策略'],
      patentType: 'invention',
      enableDependentClaims: true,
      dependentClaimCount: 3,
    })

    console.log('✅ 权利要求生成完成')
    console.log(`📊 总权利要求: ${result.claims?.length || 0} 项`)
    console.log(`📄 独立权利要求: ${result.independentClaims?.length || 0} 项`)
    console.log(`📄 从属权利要求: ${result.dependentClaims?.length || 0} 项`)

    if (result.claims && result.claims.length > 0) {
      console.log('\n📋 权利要求 1（前100字符）:')
      const firstClaim = result.claims[0]
      const preview = firstClaim.content?.substring(0, 100) || ''
      console.log(`   ${preview}...`)
    }

    return result
  } catch (error) {
    console.error('❌ 权利要求生成失败:', error)
    throw error
  }
}

/**
 * 测试 4: 质量检查智能体
 */
async function testQualityCheckerAgent() {
  console.log('\n✓ 测试 4: QualityCheckerAgent - 质量检查')
  console.log('='.repeat(60))

  try {
    const { QualityCheckerAgent } = await importAgent(
      '../packages/agents/quality-checker/dist/index.js'
    )

    const eventBus = new EventBus()
    const memory = new ShortTermMemory()
    const tools = new ToolRegistry(eventBus)
    const llm = createReasoningModel()

    const agent = new QualityCheckerAgent({
      name: 'quality-checker',
      description: '质量检查智能体',
      llm,
      memory,
      tools,
      eventBus,
    })

    console.log('⏳ 执行质量检查...')
    const result = await agent.execute({
      inventionTitle: testInput.title,
      claims: [
        {
          type: 'independent',
          number: 1,
          content:
            '一种基于深度学习的图像识别方法，其特征在于，包括：获取待识别图像；使用残差网络提取图像特征；引入注意力机制增强关键特征；进行多尺度特征融合；通过分类器进行图像分类。',
        },
      ],
      specification: {
        technicalField: testInput.field,
        backgroundArt: '现有图像识别技术存在准确率不高、计算量大的问题',
        inventionContent: testInput.disclosure,
        embodiment: '具体实施方式：采用ResNet-50作为基础网络...',
      },
      patentType: 'invention',
      checkLevel: 2,
    })

    console.log('✅ 质量检查完成')
    console.log(`📊 总体评分: ${result.overallScore || 0}/100`)
    console.log(`⭐ 质量等级: ${result.qualityLevel || '未知'}`)
    console.log(`📋 完整性评分: ${result.completenessScore || 0}/100`)

    if (result.issues && result.issues.length > 0) {
      console.log(`⚠️  发现问题: ${result.issues.length} 个`)
      result.issues.slice(0, 3).forEach((issue: any, index: number) => {
        console.log(`   ${index + 1}. ${issue.category}: ${issue.description}`)
      })
    } else {
      console.log('✅ 未发现问题')
    }

    return result
  } catch (error) {
    console.error('❌ 质量检查失败:', error)
    throw error
  }
}

/**
 * 测试 5: 说明书撰写智能体
 */
async function testSpecificationDrafterAgent() {
  console.log('\n📄 测试 5: SpecificationDrafterAgent - 说明书撰写')
  console.log('='.repeat(60))

  try {
    const { SpecificationDrafterAgent } = await importAgent(
      '../packages/agents/specification-drafter/dist/index.js'
    )

    const eventBus = new EventBus()
    const memory = new ShortTermMemory()
    const tools = new ToolRegistry(eventBus)
    const llm = createPatentWritingModel()

    const agent = new SpecificationDrafterAgent({
      name: 'specification-drafter',
      description: '说明书撰写智能体',
      llm,
      memory,
      tools,
      eventBus,
    })

    console.log('⏳ 撰写说明书...')
    const result = await agent.execute({
      inventionTitle: testInput.title,
      inventionUnderstanding: {
        technicalField: testInput.field,
        backgroundArt: '现有图像识别技术存在准确率不高的问题',
        technicalProblem: '提高图像识别准确率',
        technicalSolution: testInput.disclosure,
        beneficialEffects: '提高准确率、减少计算量',
        keyFeatures: ['残差网络', '注意力机制', '多尺度融合'],
      },
      priorArtSearch: {
        relevantPatents: [],
        searchStrategy: ['深度学习', '图像识别', 'ResNet'],
      },
    })

    console.log('✅ 说明书撰写完成')
    console.log(`📊 总字数: ${result.metrics?.totalWordCount || 0}`)
    console.log(`📚 章节数: ${result.metrics?.chapterCount || 0}`)

    if (result.specification && result.specification.technicalField) {
      console.log('\n📋 技术领域（前100字符）:')
      const preview = result.specification.technicalField.substring(0, 100)
      console.log(`   ${preview}...`)
    }

    return result
  } catch (error) {
    console.error('❌ 说明书撰写失败:', error)
    throw error
  }
}

/**
 * 主测试函数
 */
async function main() {
  console.log('🚀 YunPat 智能体 oMLX 集成测试')
  console.log('='.repeat(60))
  console.log(`🔗 使用模型: oMLX (Qwen3.5-27B)`)
  console.log(`⏰ 开始时间: ${new Date().toLocaleString()}`)

  const results = {
    inventionUnderstanding: null as unknown,
    technicalAnalysis: null as unknown,
    claimsGeneration: null as unknown,
    qualityCheck: null as unknown,
    specificationDrafting: null as unknown,
  }

  const errors = []

  // 测试 1: 发明理解
  try {
    results.inventionUnderstanding = await testInventionUnderstandingAgent()
  } catch (error) {
    errors.push({ test: '发明理解', error })
  }

  // 测试 2: 技术分析
  try {
    results.technicalAnalysis = await testPatentTechnicalAnalyzerAgent()
  } catch (error) {
    errors.push({ test: '技术分析', error })
  }

  // 测试 3: 权利要求生成
  try {
    results.claimsGeneration = await testClaimsGeneratorAgent()
  } catch (error) {
    errors.push({ test: '权利要求生成', error })
  }

  // 测试 4: 质量检查
  try {
    results.qualityCheck = await testQualityCheckerAgent()
  } catch (error) {
    errors.push({ test: '质量检查', error })
  }

  // 测试 5: 说明书撰写
  try {
    results.specificationDrafting = await testSpecificationDrafterAgent()
  } catch (error) {
    errors.push({ test: '说明书撰写', error })
  }

  // 输出总结
  console.log('\n' + '='.repeat(60))
  console.log('📊 测试总结')
  console.log('='.repeat(60))

  const successCount = 5 - errors.length
  console.log(`✅ 成功: ${successCount}/5`)
  console.log(`❌ 失败: ${errors.length}/5`)

  if (errors.length > 0) {
    console.log('\n❌ 失败的测试:')
    errors.forEach(({ test, error }) => {
      console.log(`   - ${test}: ${error instanceof Error ? error.message : String(error)}`)
    })
  }

  console.log(`\n⏰ 结束时间: ${new Date().toLocaleString()}`)
  console.log('\n💡 提示：')
  console.log('   - 所有测试均使用 oMLX 本地模型')
  console.log('   - 如果测试失败，请检查 oMLX 服务是否运行')
  console.log('   - 测试数据：基于深度学习的图像识别方法')
}

// 运行测试
main().catch((error) => {
  console.error('❌ 测试运行失败:', error)
  process.exit(1)
})
