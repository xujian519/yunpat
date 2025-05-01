/**
 * InventionUnderstandingAgent 集成测试示例
 *
 * 运行方式：
 * npx tsx examples/integration-test.ts
 */

import { InventionUnderstandingAgent } from '../src/InventionUnderstandingAgent.js'

// Mock LLM
const mockLLM = {
  chat: async (params: any) => {
    // 模拟 LLM 响应
    const responses = {
      陶瓷阀片: JSON.stringify({
        inventionConcepts: [
          {
            technicalProblem: '现有金属阀片在高温高压环境下容易磨损，密封性差',
            keyFeatures: ['采用陶瓷材料制造阀片', '表面精度达到0.01mm', '采用特殊的烧结工艺'],
            technicalEffects: ['密封性提高50%', '使用寿命延长3倍', '耐磨性提高60%'],
            confidence: 0.9,
          },
          {
            technicalProblem: '现有阀门更换不方便，维护成本高',
            keyFeatures: ['采用快拆结构设计', '卡扣连接方式'],
            technicalEffects: ['更换时间缩短80%', '维护成本降低50%'],
            confidence: 0.85,
          },
        ],
        technicalField: '机械制造技术领域，具体涉及一种阀门组件',
        embodimentSummary: '本发明通过采用陶瓷材料和快拆结构，显著提高了阀门的性能和维护效率。',
        drawingDescriptions: ['图1为陶瓷阀片结构示意图', '图2为阀门组件装配图'],
      }),
    }

    // 根据输入内容选择响应
    const content = params.messages[1]?.content || ''
    for (const [key, value] of Object.entries(responses)) {
      if (content.includes(key)) {
        return { message: { content: value } }
      }
    }

    // 默认响应
    return {
      message: {
        content: JSON.stringify({
          inventionConcepts: [
            {
              technicalProblem: '示例技术问题',
              keyFeatures: ['特征1', '特征2'],
              technicalEffects: ['效果1'],
              confidence: 0.8,
            },
          ],
          technicalField: '技术领域',
          embodimentSummary: '实施方式摘要',
          drawingDescriptions: [],
        }),
      },
    }
  },
}

// 测试用例
async function runTests() {
  console.log('🧪 开始运行 InventionUnderstandingAgent 集成测试\n')

  // 创建 Agent（禁用知识图谱，使用 Mock LLM）
  const agent = new InventionUnderstandingAgent({
    name: 'test-invention-understanding',
    description: '测试发明理解智能体',
    enableKnowledgeGraph: false, // 集成测试中禁用真实知识图谱
    eventBus: {
      publish: () => {},
      subscribe: () => {},
    } as any,
    memory: {} as any,
    tools: {} as any,
    llm: mockLLM as any,
  })

  // 测试用例 1: 基础功能测试
  console.log('📋 测试 1: 基础功能 - 陶瓷阀片组件')
  try {
    const input1 = {
      title: '一种陶瓷阀片组件',
      field: '机械工程',
      technicalDisclosure: `
本发明涉及一种阀门组件，特别是陶瓷阀片组件。

技术领域：
本发明属于机械制造技术领域，具体涉及一种阀门组件。

背景技术：
现有技术中，传统的金属阀片在高温高压环境下容易磨损，密封性差，使用寿命短。
例如，在石油化工行业中，阀门需要频繁更换，维护成本高。

发明内容：
本发明采用陶瓷材料制造阀片，表面精度达到0.01mm。
通过特殊的烧结工艺，提高了阀片的硬度和耐磨性。
同时采用快拆结构设计，便于维护和更换。

技术效果：
与现有技术相比，密封性提高50%，使用寿命延长3倍，
耐磨性提高60%，更换时间缩短80%，维护成本降低50%。

附图说明：
图1为陶瓷阀片结构示意图
图2为阀门组件装配图
      `,
      priorArt: ['CN123456789A: 金属阀片的制造方法', 'CN987654321B: 阀门密封结构改进'],
      drawings: ['图1: 陶瓷阀片结构示意图', '图2: 阀门组件装配图'],
    }

    // 注入 Mock LLM
    ;(agent as any).callLLM = mockLLM.chat.bind(mockLLM)

    const result1 = await agent.execute(input1 as any, { llm: mockLLM } as any)

    console.log('✅ 测试 1 通过')
    console.log(`   发明构思: ${result1.inventionConcepts.length} 组三元组`)
    console.log(`   技术领域: ${result1.technicalField}`)
    console.log(`   总体置信度: ${(result1.confidence * 100).toFixed(0)}%`)
    console.log(`   验证结果: ${result1.validation?.passed ? '✅ 通过' : '❌ 未通过'}`)

    // 显示第一组三元组
    if (result1.inventionConcepts.length > 0) {
      const concept = result1.inventionConcepts[0]
      console.log('\n   第一组三元组:')
      console.log(`   - 问题: ${concept.technicalProblem}`)
      console.log(`   - 特征: ${concept.keyFeatures.join(', ')}`)
      console.log(`   - 效果: ${concept.technicalEffects.join(', ')}`)
      console.log(`   - 置信度: ${(concept.confidence * 100).toFixed(0)}%`)
    }

    // 显示验证结果
    if (result1.validation) {
      const { errors, warnings, info } = result1.validation
      if (errors.length > 0) {
        console.log(`\n   错误 (${errors.length}):`)
        errors.forEach((err) => console.log(`     - ${err}`))
      }
      if (warnings.length > 0) {
        console.log(`\n   警告 (${warnings.length}):`)
        warnings.forEach((warn) => console.log(`     - ${warn}`))
      }
      if (info.length > 0) {
        console.log(`\n   信息 (${info.length}):`)
        info.forEach((inf) => console.log(`     - ${inf}`))
      }
    }
  } catch (error) {
    console.log('❌ 测试 1 失败:', error)
  }

  // 测试用例 2: 输入验证测试
  console.log('\n\n📋 测试 2: 输入验证')
  try {
    await agent.execute(
      {
        title: '',
        field: '机械工程',
        technicalDisclosure: '测试内容',
      } as any,
      {} as any
    )
    console.log('❌ 测试 2 失败: 应该拒绝空标题')
  } catch (error) {
    console.log('✅ 测试 2 通过: 正确拒绝空标题')
    console.log(`   错误信息: ${(error as Error).message}`)
  }

  // 测试用例 3: 术语标准化测试
  console.log('\n\n📋 测试 3: 术语标准化')
  try {
    // Mock 术语映射
    const terminologyMap = new Map([
      ['用', '采用'],
      ['连接', '固定连接'],
      ['设置', '配置'],
    ])

    const mockResult = {
      inventionConcepts: [
        {
          technicalProblem: '用陶瓷做阀片',
          keyFeatures: ['阀杆和阀盖连接', '设置密封件'],
          technicalEffects: ['密封性提高'],
          confidence: 0.8,
        },
      ],
      technicalField: '机械工程',
      backgroundArt: '',
      embodimentSummary: '',
      drawingDescriptions: [],
    }

    // @ts-expect-error - 访问私有方法进行测试
    const normalized = (agent as any).normalizeTerminology(mockResult, terminologyMap)

    const problemNormalized = normalized.inventionConcepts[0].technicalProblem.includes('采用')
    const feature1Normalized = normalized.inventionConcepts[0].keyFeatures[0].includes('固定连接')
    const feature2Normalized = normalized.inventionConcepts[0].keyFeatures[1].includes('配置')

    if (problemNormalized && feature1Normalized && feature2Normalized) {
      console.log('✅ 测试 3 通过: 术语标准化正确')
      console.log(`   "用" → "采用"`)
      console.log(`   "连接" → "固定连接"`)
      console.log(`   "设置" → "配置"`)
    } else {
      console.log('❌ 测试 3 失败: 术语标准化未生效')
    }
  } catch (error) {
    console.log('❌ 测试 3 失败:', error)
  }

  // 测试用例 4: 一致性验证测试
  console.log('\n\n📋 测试 4: 一致性验证')
  try {
    const mockResult = {
      inventionConcepts: [
        {
          technicalProblem: '通过改进设计解决问题',
          keyFeatures: ['特征1', '特征2'],
          technicalEffects: ['效果1'],
          confidence: 0.8,
        },
      ],
      technicalField: '机械工程',
      backgroundArt: '',
      embodimentSummary: '',
      drawingDescriptions: [],
    }

    // @ts-expect-error - 访问私有方法进行测试
    const validation = (agent as any).validateConsistency(mockResult, [])

    if (!validation.passed && validation.errors.length > 0) {
      console.log('✅ 测试 4 通过: 正确检测到技术问题包含解决手段')
      console.log(`   错误: ${validation.errors[0]}`)
    } else {
      console.log('❌ 测试 4 失败: 未检测到错误')
    }
  } catch (error) {
    console.log('❌ 测试 4 失败:', error)
  }

  console.log('\n\n🎉 集成测试完成!')
}

// 运行测试
runTests().catch(console.error)
