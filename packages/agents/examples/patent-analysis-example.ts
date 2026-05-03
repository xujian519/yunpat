/**
 * 专利分析示例
 *
 * 演示如何使用 PatentAnalyzerAgent 对专利进行多维度分析
 */

import { PatentAnalyzerAgent } from '@yunpat/agent-patent-analyzer';
import { EventBus, ShortTermMemory, ToolRegistry } from '@yunpat/core';

// 初始化组件
const eventBus = new EventBus();
const memory = new ShortTermMemory();
const tools = new ToolRegistry(eventBus);

// 创建专利分析智能体
const analyzerAgent = new PatentAnalyzerAgent({
  name: 'patent-analyzer-demo',
  description: '专利分析示例智能体',
  eventBus,
  memory,
  tools,
  llm: {
    chat: async (params) => {
      // 这里应该使用真实的 LLM API
      // 示例中使用模拟响应
      return {
        message: {
          content: JSON.stringify({
            field: '人工智能/自动驾驶',
            problems: [
              '复杂天气条件下检测准确率低',
              '小目标检测效果差',
              '实时性不足',
            ],
            solution: '采用改进的 YOLOv5 网络结合注意力机制',
            effects: [
              '检测准确率提升 25%',
              '小目标检测准确率提升 40%',
              '处理速度达到 45 FPS',
            ],
            keyFeatures: [
              '多尺度特征提取',
              '自适应特征融合',
              '困难样本挖掘',
              '时序信息整合',
            ],
          }),
        },
      };
    },
  } as any,
  enableKnowledge: false,
  enableTemplates: false,
});

async function main() {
  try {
    console.log('=== 专利分析示例 ===\n');

    // 准备专利信息
    const patent = {
      publicationNumber: 'CN112345678A',
      title: '一种基于深度学习的自动驾驶车辆目标检测方法',
      abstract: `
本发明公开了一种基于深度学习的自动驾驶车辆目标检测方法，
属于计算机视觉和自动驾驶技术领域。该方法采用改进的 YOLOv5 网络
作为基础架构，引入注意力机制增强关键特征，设计双向特征金字塔网络
实现多尺度特征的高效融合。通过在线困难样本挖掘策略提升困难样本
的检测精度，并引入 LSTM 模块整合多帧图像的时序信息。
与现有技术相比，本发明在复杂天气条件下检测准确率提升 30%，
小目标检测准确率提升 40%，处理速度达到 45 FPS。
      `.trim(),
      applicant: '未来科技有限公司',
      inventors: ['张三', '李四', '王五'],
      publicationDate: '2023-10-15',
      fullText: `
权利要求书

1. 一种基于深度学习的自动驾驶车辆目标检测方法，其特征在于，包括以下步骤：
   S1：获取车载摄像头采集的连续图像序列；
   S2：对图像进行预处理，包括去噪、增强和归一化；
   S3：使用改进的 YOLOv5 网络提取图像特征，所述网络引入注意力机制；
   S4：通过双向特征金字塔网络融合多尺度特征；
   S5：基于提取的特征进行目标检测，输出目标类别、位置和置信度；
   S6：使用非极大值抑制去除重复检测；
   S7：通过 LSTM 模块整合多帧时序信息，得到最终检测结果。

2. 根据权利要求1所述的方法，其特征在于，所述注意力机制采用
   CBAM（Convolutional Block Attention Module），包括通道注意力
   和空间注意力两个子模块。

3. 根据权利要求1所述的方法，其特征在于，所述双向特征金字塔
   网络采用自适应权重机制，根据目标尺度动态调整特征融合权重。

说明书

本发明涉及自动驾驶技术领域...
      `.trim(),
    };

    console.log('🔬 开始分析专利...\n');

    // 执行专利分析
    const result = await analyzerAgent.execute({
      patent,
      analysisTypes: ['technical', 'claims', 'creativity', 'risk'],
    });

    // 输出分析结果
    console.log('✅ 分析完成！\n');

    console.log('=== 基本信息 ===');
    console.log(`公开号: ${result.basicInfo.publicationNumber}`);
    console.log(`标题: ${result.basicInfo.title}`);
    console.log(`申请人: ${result.basicInfo.applicant}`);
    console.log(`公开日: ${result.basicInfo.publicationDate}`);

    if (result.technicalAnalysis) {
      console.log('\n=== 技术分析 ===');
      console.log(`技术领域: ${result.technicalAnalysis.field}`);
      console.log(`\n技术问题:`);
      result.technicalAnalysis.problems.forEach((problem, i) => {
        console.log(`  ${i + 1}. ${problem}`);
      });
      console.log(`\n技术方案:\n  ${result.technicalAnalysis.solution}`);
      console.log(`\n技术效果:`);
      result.technicalAnalysis.effects.forEach((effect, i) => {
        console.log(`  ${i + 1}. ${effect}`);
      });
      console.log(`\n关键技术特征:`);
      result.technicalAnalysis.keyFeatures.forEach((feature, i) => {
        console.log(`  ${i + 1}. ${feature}`);
      });
    }

    if (result.claimsAnalysis) {
      console.log('\n=== 权利要求分析 ===');
      console.log(`独立权利要求: ${result.claimsAnalysis.independentCount} 项`);
      console.log(`从属权利要求: ${result.claimsAnalysis.dependentCount} 项`);
      console.log(`\n保护范围:`);
      console.log(`  宽窄程度: ${result.claimsAnalysis.protectionScope.breadth}`);
      console.log(`  清晰程度: ${result.claimsAnalysis.protectionScope.clarity}`);
      console.log(`  风险等级: ${result.claimsAnalysis.protectionScope.risk}`);
      console.log(`\n质量评分: ${result.claimsAnalysis.qualityScore}/100`);
    }

    if (result.creativityAssessment) {
      console.log('\n=== 创造性评估 ===');
      const levelMap = {
        inventive: '具有创造性 ✨',
        obvious: '显而易见 ⚠️',
        lacksInventiveness: '缺乏创造性 ❌',
      };
      console.log(`创造性等级: ${levelMap[result.creativityAssessment.level]}`);
      console.log(`创造性评分: ${result.creativityAssessment.score}/100`);
      console.log(`\n评估理由:\n  ${result.creativityAssessment.reasoning}`);
    }

    if (result.riskAssessment) {
      console.log('\n=== 风险评估 ===');
      console.log(`无效风险: ${result.riskAssessment.invalidityRisk.toUpperCase()}`);
      console.log(`侵权风险: ${result.riskAssessment.infringementRisk.toUpperCase()}`);
      if (result.riskAssessment.riskFactors.length > 0) {
        console.log(`\n风险因素:`);
        result.riskAssessment.riskFactors.forEach((factor, i) => {
          console.log(`  ${i + 1}. ${factor}`);
        });
      }
    }

    if (result.recommendations.length > 0) {
      console.log('\n=== 改进建议 ===');
      result.recommendations.forEach((rec, i) => {
        console.log(`  ${i + 1}. ${rec}`);
      });
    }

    // 生成分析报告
    console.log('\n📊 生成分析报告...');
    const report = generateAnalysisReport(result);
    console.log('\n' + '='.repeat(60));
    console.log(report);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ 分析失败:', error);
    if (error instanceof Error) {
      console.error(`错误信息: ${error.message}`);
    }
  }
}

function generateAnalysisReport(result: any): string {
  let report = '专利分析报告\n';
  report += `公开号: ${result.basicInfo.publicationNumber}\n`;
  report += `标题: ${result.basicInfo.title}\n\n`;

  if (result.technicalAnalysis) {
    report += '【技术分析】\n';
    report += `技术领域: ${result.technicalAnalysis.field}\n`;
    report += `创新点数量: ${result.technicalAnalysis.keyFeatures.length}\n`;
    report += `技术效果数量: ${result.technicalAnalysis.effects.length}\n\n`;
  }

  if (result.creativityAssessment) {
    report += '【创造性评估】\n';
    report += `等级: ${result.creativityAssessment.level}\n`;
    report += `评分: ${result.creativityAssessment.score}/100\n\n`;
  }

  if (result.riskAssessment) {
    report += '【风险评估】\n';
    report += `无效风险: ${result.riskAssessment.invalidityRisk}\n`;
    report += `侵权风险: ${result.riskAssessment.infringementRisk}\n\n`;
  }

  report += '【总体评价】\n';
  const creativityScore = result.creativityAssessment?.score || 50;
  const qualityScore = result.claimsAnalysis?.qualityScore || 50;

  if (creativityScore >= 80 && qualityScore >= 80) {
    report += '✅ 专利质量优秀，建议积极布局\n';
  } else if (creativityScore >= 60 && qualityScore >= 60) {
    report += '⚠️ 专利质量良好，可考虑申请\n';
  } else {
    report += '❌ 专利质量一般，建议优化后再申请\n';
  }

  return report;
}

// 运行示例
if (require.main === module) {
  main().catch(console.error);
}

export { main };
