/**
 * YunPat 专利智能体使用示例
 *
 * 本示例展示如何使用四个核心专利智能体：
 * 1. PatentWriterAgent - 专利撰写
 * 2. PatentResponderAgent - 审查答复
 * 3. PatentAnalyzerAgent - 专利分析
 * 4. PatentManagerAgent - 专利管理
 */

import { PatentWriterAgent } from '../../ai/agents/writer/PatentWriterAgent';
import { PatentResponderAgent } from '../../ai/agents/responder/PatentResponderAgent';
import { PatentAnalyzerAgent } from '../../ai/agents/analyzer/PatentAnalyzerAgent';
import { PatentManagerAgent } from '../../ai/agents/manager/PatentManagerAgent';
import { createDeepSeekModel } from '@yunpat/core';

/**
 * 示例 1: 专利撰写
 */
async function examplePatentWriting() {
  console.log('=== 示例 1: 专利撰写 ===\n');

  // 创建专利撰写智能体
  const writer = new PatentWriterAgent({
    llm: createDeepSeekModel(process.env.DEEPSEEK_API_KEY),
  });

  // 准备输入
  const input = {
    title: '一种基于深度学习的图像识别方法',
    field: '计算机视觉',
    applicant: '某某科技公司',
    inventors: ['张三', '李四'],
    technicalDisclosure: `
本发明提供了一种基于深度学习的图像识别方法，包括以下步骤：

1. 采集待识别图像数据，对图像进行预处理；
2. 构建卷积神经网络模型，包括多个卷积层、池化层和全连接层；
3. 使用预处理后的图像数据训练卷积神经网络模型；
4. 将待识别图像输入训练好的模型，输出识别结果。

本发明的优点是识别准确率高，处理速度快，适用于多种应用场景。
    `,
    drawings: [
      '图1：本发明方法的整体流程图',
      '图2：卷积神经网络结构示意图',
      '图3：图像识别效果对比图',
    ],
  };

  // 执行撰写
  const output = await writer.execute(input);

  // 输出结果
  console.log('撰写完成！');
  console.log(`权利要求数量: ${output.metrics.claimsCount}`);
  console.log(`说明书字数: ${output.metrics.descriptionWordCount}`);
  console.log(`质量评分: ${output.metrics.qualityScore}`);
  console.log(`撰写耗时: ${output.metrics.durationMinutes} 分钟\n`);

  return output;
}

/**
 * 示例 2: 审查意见答复
 */
async function exampleOfficeActionResponse() {
  console.log('=== 示例 2: 审查意见答复 ===\n');

  // 创建审查答复智能体
  const responder = new PatentResponderAgent({
    llm: createDeepSeekModel(process.env.DEEPSEEK_API_KEY),
  });

  // 准备输入
  const input = {
    applicationNumber: 'CN202310123456.7',
    patentTitle: '一种基于深度学习的图像识别方法',
    officeAction: `
审查意见通知书

1. 权利要求1不具备创造性，具体理由如下：
对比文件1（CN110123456A）公开了一种基于卷积神经网络的图像识别方法，包括图像采集、预处理、模型训练和识别步骤。
权利要求1与对比文件1的区别在于：本发明使用了深度学习技术，而对比文件1使用的是传统卷积神经网络。
然而，深度学习是卷积神经网络的常规技术优化，本领域技术人员根据对比文件1容易想到采用深度学习技术来提升识别效果。
因此，权利要求1不具备突出的实质性特点和显著的进步，不具备创造性。

2. 从属权利要求2-5也不具备创造性，引用权利要求1的权利要求同样不具备创造性。
    `,
    priorArt: [
      'CN110123456A - 基于卷积神经网络的图像识别方法',
      'US9876543B2 - Deep learning for image recognition',
    ],
    claims: [
      '1. 一种基于深度学习的图像识别方法，其特征在于，包括以下步骤：采集待识别图像数据，对图像进行预处理；构建深度卷积神经网络模型；使用预处理后的图像数据训练模型；将待识别图像输入训练好的模型，输出识别结果。',
      '2. 根据权利要求1所述的方法，其特征在于，所述深度卷积神经网络模型包括ResNet-50架构。',
    ],
    description: '本发明提供了一种基于深度学习的图像识别方法...',
  };

  // 执行答复
  const output = await responder.execute(input);

  // 输出结果
  console.log('答复完成！');
  console.log(`答复策略: ${output.responseStrategy.type}`);
  console.log(`核心论点数量: ${output.responseStrategy.arguments.length}`);
  console.log(`修改权利要求数量: ${output.response.amendedClaims.length}`);
  console.log(`授权成功率预测: ${output.metrics.allowanceProbability}%`);
  console.log(`答复质量评分: ${output.metrics.qualityScore}\n`);

  return output;
}

/**
 * 示例 3: 专利价值分析
 */
async function examplePatentAnalysis() {
  console.log('=== 示例 3: 专利价值分析 ===\n');

  // 创建专利分析智能体
  const analyzer = new PatentAnalyzerAgent({
    llm: createDeepSeekModel(process.env.DEEPSEEK_API_KEY),
  });

  // 准备输入
  const input = {
    analysisType: 'value' as const,
    targetPatents: [
      'CN123456789A',
      'US9876543B2',
      'EP3456789A1',
    ],
    technicalField: '人工智能',
    parameters: {
      regions: ['CN', 'US', 'EP'],
      patentTypes: ['invention'],
      keywords: ['深度学习', '图像识别', '卷积神经网络'],
    },
  };

  // 执行分析
  const output = await analyzer.execute(input);

  // 输出结果
  console.log('分析完成！');
  console.log(`分析专利数量: ${output.metrics.totalPatents}`);
  console.log(`数据覆盖率: ${output.metrics.coverage * 100}%`);
  console.log(`可信度: ${output.metrics.confidence * 100}%`);
  console.log(`分析耗时: ${output.metrics.durationMinutes} 分钟\n`);

  if (output.results.valueAssessment) {
    console.log('高价值专利:');
    output.results.valueAssessment.highValuePatents.forEach(patent => {
      console.log(`  - ${patent.patentNumber}: ${patent.score}分`);
      patent.reasons.forEach(reason => console.log(`    * ${reason}`));
    });
    console.log();
  }

  return output;
}

/**
 * 示例 4: 技术趋势分析
 */
async function exampleTrendAnalysis() {
  console.log('=== 示例 4: 技术趋势分析 ===\n');

  // 创建专利分析智能体
  const analyzer = new PatentAnalyzerAgent({
    llm: createDeepSeekModel(process.env.DEEPSEEK_API_KEY),
  });

  // 准备输入
  const input = {
    analysisType: 'trend' as const,
    technicalField: '人工智能',
    timeRange: {
      start: '2020-01-01',
      end: '2026-04-28',
    },
    parameters: {
      regions: ['CN', 'US'],
      keywords: ['人工智能', '机器学习', '深度学习'],
    },
  };

  // 执行分析
  const output = await analyzer.execute(input);

  // 输出结果
  console.log('趋势分析完成！');
  console.log(`技术发展阶段: ${output.results.trendAnalysis?.stage}`);
  console.log(`关键技术趋势数量: ${output.results.trendAnalysis?.keyTrends.length || 0}`);
  console.log(`主要参与者: ${output.results.trendAnalysis?.keyPlayers.join('、') || '无'}\n`);

  return output;
}

/**
 * 示例 5: 竞品分析
 */
async function exampleCompetitorAnalysis() {
  console.log('=== 示例 5: 竞品分析 ===\n');

  // 创建专利分析智能体
  const analyzer = new PatentAnalyzerAgent({
    llm: createDeepSeekModel(process.env.DEEPSEEK_API_KEY),
  });

  // 准备输入
  const input = {
    analysisType: 'competitor' as const,
    technicalField: '人工智能',
    competitors: ['腾讯', '阿里巴巴', '百度'],
    parameters: {
      regions: ['CN'],
    },
  };

  // 执行分析
  const output = await analyzer.execute(input);

  // 输出结果
  console.log('竞品分析完成！');
  if (output.results.competitorAnalysis) {
    console.log('竞争对手排名:');
    output.results.competitorAnalysis.rankings.forEach((company, index) => {
      console.log(`  ${index + 1}. ${company.company}`);
      console.log(`     专利数量: ${company.patentCount}`);
      console.log(`     市场份额: ${company.marketShare}%`);
      console.log(`     技术优势: ${company.strength.join('、')}`);
    });
    console.log();
  }

  return output;
}

/**
 * 示例 6: 专利组合管理
 */
async function examplePortfolioManagement() {
  console.log('=== 示例 6: 专利组合管理 ===\n');

  // 创建专利管理智能体
  const manager = new PatentManagerAgent({
    llm: createDeepSeekModel(process.env.DEEPSEEK_API_KEY),
  });

  // 准备输入
  const input = {
    managementType: 'portfolio' as const,
    filters: {
      clients: ['某某科技公司'],
    },
  };

  // 执行管理
  const output = await manager.execute(input);

  // 输出结果
  console.log('专利组合分析完成！');
  if (output.results.portfolioManagement) {
    const overview = output.results.portfolioManagement.overview;
    console.log('专利组合概览:');
    console.log(`  总专利数: ${overview.totalPatents}`);
    console.log(`  有效专利: ${overview.activePatents}`);
    console.log(`  待审申请: ${overview.pendingApplications}`);
    console.log(`  已授权专利: ${overview.grantedPatents}`);
    console.log(`  已失效专利: ${overview.expiredPatents}`);
    console.log();
  }

  console.log('建议操作:');
  output.recommendedActions.forEach((action, index) => {
    console.log(`  ${index + 1}. ${action}`);
  });
  console.log();

  return output;
}

/**
 * 示例 7: 期限管理
 */
async function exampleDeadlineManagement() {
  console.log('=== 示例 7: 期限管理 ===\n');

  // 创建专利管理智能体
  const manager = new PatentManagerAgent({
    llm: createDeepSeekModel(process.env.DEEPSEEK_API_KEY),
  });

  // 准备输入
  const input = {
    managementType: 'deadline' as const,
    targetPatents: ['CN123456789A', 'US9876543B2'],
  };

  // 执行管理
  const output = await manager.execute(input);

  // 输出结果
  console.log('期限管理完成！');
  if (output.results.deadlineManagement) {
    const deadlines = output.results.deadlineManagement;
    console.log(`即将到期的期限: ${deadlines.upcomingDeadlines.length}个`);
    console.log(`逾期期限: ${deadlines.overdueDeadlines.length}个`);
    console.log();
  }

  return output;
}

/**
 * 主函数：运行所有示例
 */
async function main() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   YunPat 专利智能体使用示例               ║');
  console.log('║   知识产权全生命周期智能体平台             ║');
  console.log('╚════════════════════════════════════════════╝\n');

  try {
    // 运行示例
    await examplePatentWriting();
    await exampleOfficeActionResponse();
    await examplePatentAnalysis();
    await exampleTrendAnalysis();
    await exampleCompetitorAnalysis();
    await examplePortfolioManagement();
    await exampleDeadlineManagement();

    console.log('✅ 所有示例执行完成！');
  } catch (error) {
    console.error('❌ 示例执行失败:', error);
  }
}

// 运行主函数
if (require.main === module) {
  main();
}

export {
  examplePatentWriting,
  exampleOfficeActionResponse,
  examplePatentAnalysis,
  exampleTrendAnalysis,
  exampleCompetitorAnalysis,
  examplePortfolioManagement,
  exampleDeadlineManagement,
};
