/**
 * GLM-4.7 专利撰写示例
 *
 * 本示例展示如何使用智谱 GLM-4.7 模型进行专利撰写
 */

import { createZhipuModel, NativeModel } from '../packages/core/src/llm/NativeLLMAdapter.js'

/**
 * 示例1：基础使用 - 技术方案分析
 */
async function example1_BasicUsage() {
  console.log('\n=== 示例1：基础使用 ===\n')

  // 创建 GLM-4.7 模型实例
  const llm = createZhipuModel(process.env.GLM_API_KEY!, NativeModel.GLM_4_7)

  // 分析技术方案
  const response = await llm.chat(
    [
      {
        role: 'user',
        content: `请分析以下技术方案的创新点：

技术方案：一种基于深度学习的图像识别方法

核心技术特征：
1. 使用卷积神经网络（CNN）提取图像特征
2. 引入注意力机制增强关键区域识别
3. 采用多尺度特征融合提高准确率

请从技术创新角度分析其创新点。`,
      },
    ],
    {
      temperature: 0.3, // 专利撰写建议使用较低的温度
      max_tokens: 1000,
    }
  )

  console.log('GLM-4.7 分析结果：')
  console.log(response.content)
  console.log('\n---\n')
}

/**
 * 示例2：专利说明书撰写
 */
async function example2_SpecificationDrafting() {
  console.log('\n=== 示例2：专利说明书撰写 ===\n')

  const llm = createZhipuModel(process.env.GLM_API_KEY!, NativeModel.GLM_4_7)

  const inventionData = {
    title: '一种智能专利撰写系统',
    field: '人工智能',
    background: '传统专利撰写依赖人工，效率低且质量不稳定',
    summary: '利用大语言模型自动生成专利文本',
  }

  const response = await llm.chat(
    [
      {
        role: 'system',
        content: '你是一位专业的专利代理师，擅长撰写高质量的专利申请文件。',
      },
      {
        role: 'user',
        content: `请根据以下发明信息撰写专利说明书的技术方案部分：

发明名称：${inventionData.title}
技术领域：${inventionData.field}
背景技术：${inventionData.background}
发明内容：${inventionData.summary}

要求：
1. 详细描述技术实现方案
2. 包含具体的技术特征
3. 说明技术效果
4. 语言专业规范`,
      },
    ],
    {
      temperature: 0.4,
      max_tokens: 2000,
    }
  )

  console.log('生成的技术方案：')
  console.log(response.content)
  console.log('\n---\n')
}

/**
 * 示例3：权利要求撰写
 */
async function example3_ClaimsDrafting() {
  console.log('\n=== 示例3：权利要求撰写 ===\n')

  const llm = createZhipuModel(process.env.GLM_API_KEY!, NativeModel.GLM_4_7)

  const technicalSolution = `
一种基于大语言模型的专利撰写方法，包括以下步骤：
1. 接收用户输入的技术交底书
2. 使用大语言模型理解技术方案
3. 根据专利法规范生成专利文本
4. 质量检查和优化
5. 输出完整的专利申请文件
  `

  const response = await llm.chat(
    [
      {
        role: 'system',
        content: '你是一位经验丰富的专利代理师，擅长撰写清晰、完整的权利要求书。',
      },
      {
        role: 'user',
        content: `请根据以下技术方案撰写独立权利要求：

${technicalSolution}

要求：
1. 撰写1项独立权利要求
2. 保护范围适中
3. 技术特征完整
4. 符合专利法A26.4要求`,
      },
    ],
    {
      temperature: 0.3,
      max_tokens: 800,
    }
  )

  console.log('生成的权利要求：')
  console.log(response.content)
  console.log('\n---\n')
}

/**
 * 示例4：创新点识别
 */
async function example4_InnovationIdentification() {
  console.log('\n=== 示例4：创新点识别 ===\n')

  const llm = createZhipuModel(process.env.GLM_API_KEY!, NativeModel.GLM_4_7)

  const priorArt = `
现有技术1：基于规则的自然语言处理方法
现有技术2：传统的机器学习文本生成
现有技术3：早期的GPT-2模型文本生成
  `

  const currentInvention = `
本发明：基于大语言模型的智能专利撰写系统
特点：使用最新的大语言模型（如GLM-4.7），结合专利领域知识，
      实现端到端的专利自动撰写
  `

  const response = await llm.chat(
    [
      {
        role: 'user',
        content: `请对比分析现有技术和本发明的区别，识别创新点：

现有技术：
${priorArt}

本发明：
${currentInvention}

请列出3-5个关键创新点。`,
      },
    ],
    {
      temperature: 0.4,
      max_tokens: 1500,
    }
  )

  console.log('识别的创新点：')
  console.log(response.content)
  console.log('\n---\n')
}

/**
 * 示例5：技术效果描述
 */
async function example5_TechnicalEffect() {
  console.log('\n=== 示例5：技术效果描述 ===\n')

  const llm = createZhipuModel(process.env.GLM_API_KEY!, NativeModel.GLM_4_7)

  const technicalFeature = '采用注意力机制增强关键区域识别'

  const response = await llm.chat(
    [
      {
        role: 'user',
        content: `请描述以下技术特征的技术效果：

技术特征：${technicalFeature}

要求：
1. 说明为什么有效
2. 量化效果（如果有）
3. 与现有技术对比
4. 语言简洁专业`,
      },
    ],
    {
      temperature: 0.3,
      max_tokens: 600,
    }
  )

  console.log('技术效果描述：')
  console.log(response.content)
  console.log('\n---\n')
}

/**
 * 主函数
 */
async function main() {
  // 检查环境变量
  if (!process.env.GLM_API_KEY) {
    console.error('❌ 错误：未设置 GLM_API_KEY 环境变量')
    console.error('\n请先设置 API Key：')
    console.error('  export GLM_API_KEY=your-key-here')
    console.error('\n或者运行验证脚本：')
    console.error('  node scripts/check-glm-api.js')
    process.exit(1)
  }

  console.log('🚀 GLM-4.7 专利撰写示例')
  console.log('========================')

  try {
    // 运行所有示例
    await example1_BasicUsage()
    await example2_SpecificationDrafting()
    await example3_ClaimsDrafting()
    await example4_InnovationIdentification()
    await example5_TechnicalEffect()

    console.log('\n✅ 所有示例运行完成！')
    console.log('\n💡 提示：')
    console.log('  - GLM-4.7 在专利撰写任务中表现优异')
    console.log('  - 建议温度设置：0.3-0.5（较低温度保证输出稳定性）')
    console.log('  - 更多配置选项请参考：docs/guides/GLM-4-7-SETUP.md')
  } catch (error) {
    console.error('\n❌ 运行出错：', error)
    process.exit(1)
  }
}

// 运行主函数
main()
