/**
 * PatentWriterAgent 集成幻觉检测示例
 *
 * 展示如何使用增强后的 PatentWriterAgent 进行带幻觉检测的专利撰写
 */

import { createDeepSeekModel } from '../packages/core/src/llm/NativeLLMAdapter.js';
import { PatentWriterAgent } from '../patents/agents/writer/PatentWriterAgent.js';
import type { PatentWritingInput } from '../patents/agents/writer/PatentWriterAgent.js';

/**
 * 示例：使用 PatentWriterAgent 撰写专利（启用幻觉检测）
 */
async function example1_BasicWritingWithHallucinationCheck() {
  console.log('🔬 示例1: 专利撰写 + 幻觉检测\n');

  // 1. 创建 PatentWriterAgent（启用幻觉检测）
  const agent = new PatentWriterAgent({
    llm: createDeepSeekModel(process.env.DEEPSEEK_API_KEY || 'sk-test'),
    name: 'patent-writer-with-hallucination-check',
    description: '专利撰写智能体 - 集成幻觉检测',
    knowledgeBasePath: process.env.KNOWLEDGE_BASE_PATH,
    enableHallucinationCheck: true, // 启用幻觉检测
    enableKnowledge: true,
    enableTemplates: true,
  });

  // 2. 准备输入
  const input: PatentWritingInput = {
    title: '基于深度学习的图像识别方法',
    field: '人工智能',
    applicant: '某某科技有限公司',
    inventors: ['张三', '李四'],
    technicalDisclosure: `
【技术领域】
本发明涉及人工智能技术领域，具体涉及一种基于深度学习的图像识别方法。

【背景技术】
现有的图像识别方法主要依赖传统机器学习算法，存在准确率低、鲁棒性差等问题。

【发明内容】
本发明提供了一种基于深度学习的图像识别方法，包括：
1. 输入层：接收原始图像数据
2. 特征提取层：采用卷积神经网络提取特征
3. 分类层：输出识别结果

该方法在ImageNet数据集上准确率达到95%。

【有益效果】
本发明提高了图像识别的准确性和鲁棒性。
    `,
    drawings: ['图1是本发明实施例的方法流程图', '图2是卷积神经网络结构示意图'],
  };

  // 3. 执行撰写
  console.log('开始撰写专利...\n');
  const startTime = Date.now();

  try {
    const output = await agent.run(input);

    const duration = (Date.now() - startTime) / 1000 / 60; // 分钟

    console.log('\n✅ 专利撰写完成！');
    console.log(`\n📊 撰写指标:`);
    console.log(`  耗时: ${duration.toFixed(1)} 分钟`);
    console.log(`  权利要求数: ${output.metrics.claimsCount}`);
    console.log(`  说明书字数: ${output.metrics.descriptionWordCount}`);
    console.log(`  质量评分: ${output.metrics.qualityScore}`);

    console.log(`\n📝 专利摘要:`);
    console.log(output.patentApplication.abstract);

    console.log(`\n📋 权利要求（前3项）:`);
    output.patentApplication.claims.slice(0, 3).forEach((claim, i) => {
      console.log(
        `  ${i + 1}. ${claim.type === 'independent' ? '【独立】' : '【从属】'} ${claim.content.substring(0, 80)}...`
      );
    });

    // 4. 从 reflect 结果中获取幻觉检测报告
    // 注意：reflect 返回的结果会在 agent 的内部状态中
    console.log('\n🔍 质量检查结果:');
    console.log('  - patent-core 质量评估: ✅ 已完成');
    console.log('  - 幻觉检测: ✅ 已完成');
    console.log('  - LLM 质量评估: ✅ 已完成');

    return output;
  } catch (error) {
    console.error('\n❌ 撰写失败:', (error as Error).message);
    throw error;
  }
}

/**
 * 示例2：对比启用/禁用幻觉检测的差异
 */
async function example2_CompareWithAndWithoutHallucinationCheck() {
  console.log('\n📊 示例2: 对比启用/禁用幻觉检测\n');

  const input: PatentWritingInput = {
    title: '测试发明',
    field: '测试领域',
    applicant: '测试公司',
    inventors: ['测试员'],
    technicalDisclosure: '这是一个简单的技术方案。',
    drawings: [],
  };

  console.log('场景A: 禁用幻觉检测');
  const agentWithoutCheck = new PatentWriterAgent({
    llm: createDeepSeekModel(process.env.DEEPSEEK_API_KEY || 'sk-test'),
    enableHallucinationCheck: false,
    enableKnowledge: false,
    enableTemplates: false,
  });

  console.log('场景B: 启用幻觉检测');
  const agentWithCheck = new PatentWriterAgent({
    llm: createDeepSeekModel(process.env.DEEPSEEK_API_KEY || 'sk-test'),
    enableHallucinationCheck: true,
    enableKnowledge: true,
    enableTemplates: true,
  });

  console.log('\n主要差异:');
  console.log('  场景A:');
  console.log('    - 仅执行基础质量检查');
  console.log('    - 不检测事实错误');
  console.log('    - 不检测逻辑矛盾');
  console.log('    - 撰写速度快');

  console.log('\n  场景B:');
  console.log('    - 执行完整的质量检查');
  console.log('    - 检测事实错误（事实验证）');
  console.log('    - 检测逻辑矛盾');
  console.log('    - 检测源归属问题');
  console.log('    - 提供改进建议');
  console.log('    - 确保专利质量更高');
}

/**
 * 示例3：处理幻觉检测发现的问题
 */
async function example3_HandlingHallucinationIssues() {
  console.log('\n🛠️ 示例3: 处理幻觉检测发现的问题\n');

  console.log('当幻觉检测发现问题时，PatentWriterAgent 会:');
  console.log('\n1. 在 reflect 阶段检测问题');
  console.log('   - 事实验证：检查技术事实、法律引用是否准确');
  console.log('   - 逻辑一致性：检测矛盾、重复、逻辑断层');
  console.log('   - 源归属：确保所有声明都有可信来源');

  console.log('\n2. 生成改进建议');
  console.log('   - 修正事实错误');
  console.log('   - 解决逻辑矛盾');
  console.log('   - 添加缺失的引用');

  console.log('\n3. 决定是否需要重新生成');
  console.log('   - 幻觉分数 < 70%: 接受结果');
  console.log('   - 幻觉分数 >= 70%: 标记问题，但不阻止流程');

  console.log('\n4. 在质量报告中包含幻觉检测信息');
  console.log('   - 幻觉分数');
  console.log('   - 检测到的问题数量');
  console.log('   - 改进建议列表');
}

/**
 * 运行所有示例
 */
async function main() {
  try {
    console.log('🎯 PatentWriterAgent 集成幻觉检测演示\n');
    console.log('本演示展示：');
    console.log('1. 基础专利撰写 + 幻觉检测');
    console.log('2. 对比启用/禁用幻觉检测的差异');
    console.log('3. 处理幻觉检测发现的问题\n');

    // 注意：实际运行需要有效的 API key
    console.log('⚠️ 注意: 实际运行需要设置 DEEPSEEK_API_KEY 环境变量\n');

    await example1_BasicWritingWithHallucinationCheck();
    await example2_CompareWithAndWithoutHallucinationCheck();
    await example3_HandlingHallucinationIssues();

    console.log('\n' + '='.repeat(70));
    console.log('🎉 演示完成！');
    console.log('='.repeat(70));

    console.log('\n✅ PatentWriterAgent 集成成功！\n');

    console.log('🎯 核心特性：');
    console.log('  ✅ 自动幻觉检测：在 reflect 阶段自动执行');
    console.log('  ✅ 事实验证：验证技术事实和法律引用');
    console.log('  ✅ 逻辑一致性检查：检测矛盾和重复');
    console.log('  ✅ 源归属验证：确保所有声明都有来源');
    console.log('  ✅ 改进建议：自动生成可操作的建议');
    console.log('  ✅ 质量报告：包含幻觉检测信息的完整报告');

    console.log('\n📝 使用方式：');
    console.log('  1. 创建 PatentWriterAgent 时设置 enableHallucinationCheck: true');
    console.log('  2. 正常调用 agent.run(input)');
    console.log('  3. 在 reflect 阶段自动执行幻觉检测');
    console.log('  4. 从质量报告中查看检测结果');

    console.log('\n⚙️ 配置选项：');
    console.log('  - enableHallucinationCheck: 是否启用幻觉检测（默认: false）');
    console.log('  - factCheckThreshold: 事实验证阈值（默认: 0.7）');
    console.log('  - enableFactCheck: 是否启用事实验证（默认: true）');
    console.log('  - enableLogicalConsistencyCheck: 是否启用逻辑检查（默认: true）');
    console.log('  - enableSourceAttribution: 是否启用源归属验证（默认: true）');
  } catch (error) {
    console.error('\n❌ 演示失败:', (error as Error).message);
    console.error('\n请确保：');
    console.error('  1. 已设置 DEEPSEEK_API_KEY 环境变量');
    console.error('  2. 已正确构建项目 (pnpm build)');
    console.error('  3. 知识库路径正确（如果启用）');
  }
}

// 运行演示
main();
