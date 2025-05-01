/**
 * EnhancedQualityCheckerAgent 使用示例
 *
 * 演示如何使用增强版质量检查智能体
 */

import { EnhancedQualityCheckerAgent } from '../src/EnhancedQualityCheckerAgent.js'
import { EventBus } from '@yunpat/core'
import { LLM } from '@yunpat/core' // 假设有 LLM 类

async function main() {
  // 1. 创建增强版质量检查智能体
  const agent = new EnhancedQualityCheckerAgent({
    name: 'enhanced-quality-checker',
    description: '增强版质量检查智能体（支持知识库检索）',
    eventBus: new EventBus(),
    memory: {}, // 假设的内存对象
    tools: {}, // 假设的工具对象
    llm: new LLM({ model: 'claude-3-5-sonnet-20241022' }),
    knowledgeGraph: {
      query: async (query: string, topK: number) => {
        // 模拟知识图谱检索
        return [
          {
            source: '审查-权利要求-清楚',
            content: '权利要求应当清楚、简明，使用规范的技术术语',
            score: 0.9,
          },
          {
            source: '撰写-常见错误',
            content: '避免使用"约"、"左右"等不确定词汇',
            score: 0.85,
          },
        ]
      },
    },
  })

  // 2. 准备输入数据
  const input = {
    claims: {
      independentClaims: [
        {
          claimNumber: 1,
          fullText:
            '一种陶瓷阀片组件，其特征在于，包括陶瓷阀片和阀座，所述陶瓷阀片采用氧化锆材料制成。',
          claimType: 'product',
          essentialFeatures: ['陶瓷阀片', '阀座', '氧化锆材料'],
        },
      ],
      dependentClaims: [],
    },
    specification: {
      technicalField: '本发明涉及阀门组件技术领域，具体涉及一种陶瓷阀片组件。',
      backgroundArt: '现有金属阀片在高温高压环境下容易磨损，使用寿命短。',
      inventionContent: {
        technicalProblem: '现有金属阀片容易磨损，使用寿命短',
        technicalSolution: '采用陶瓷材料制造阀片，提高耐磨性',
        beneficialEffects: '阀片使用寿命延长3倍，耐磨性提高60%',
      },
      drawingsDescription: '图1为阀片结构示意图',
      detailedDescription: '本发明实施例提供一种陶瓷阀片组件...',
      abstract: '本发明公开了一种陶瓷阀片组件...',
    },
  }

  try {
    // 3. 执行质量检查
    const result = await agent.execute(input)

    // 4. 查看结果
    console.log('质量检查结果：')
    console.log(`综合评分: ${result.overallScore}/100`)
    console.log(`权利要求得分: ${result.claimsCheck.score}/100`)
    console.log(`说明书得分: ${result.specificationCheck.score}/100`)
    console.log(`形式得分: ${result.formalCheck.score}/100`)
    console.log(`改进建议: ${result.improvementSuggestions.length} 条`)

    // 5. 查看详细问题
    if (result.formalCheck.errors.length > 0) {
      console.log('\n形式问题：')
      result.formalCheck.errors.forEach((error) => {
        console.log(`  [${error.severity}] ${error.type}: ${error.description}`)
      })
    }

    if (result.improvementSuggestions.length > 0) {
      console.log('\n改进建议：')
      result.improvementSuggestions.forEach((suggestion) => {
        console.log(`  [${suggestion.priority}] ${suggestion.category}: ${suggestion.description}`)
      })
    }
  } catch (error) {
    console.error('质量检查失败:', error)
  }
}

// 对比示例：使用原版 QualityCheckerAgent
async function compareWithOriginal() {
  const { QualityCheckerAgent } = await import('../src/QualityCheckerAgent.js')

  const originalAgent = new QualityCheckerAgent({
    name: 'quality-checker',
    description: '原版质量检查智能体',
    eventBus: new EventBus(),
    memory: {},
    tools: {},
    llm: new LLM({ model: 'claude-3-5-sonnet-20241022' }),
  })

  const enhancedAgent = new EnhancedQualityCheckerAgent({
    name: 'enhanced-quality-checker',
    description: '增强版质量检查智能体',
    eventBus: new EventBus(),
    memory: {},
    tools: {},
    llm: new LLM({ model: 'claude-3-5-sonnet-20241022' }),
    knowledgeGraph: {
      query: async (query: string, topK: number) => {
        return []
      },
    },
  })

  console.log('对比原版和增强版：')
  console.log('原版: 基础质量检查功能')
  console.log('增强版: 基础功能 + 知识库检索 + 更准确的检查标准')
}

// 运行示例
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}
