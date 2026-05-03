/**
 * 专利撰写示例
 *
 * 演示如何使用 PatentWriterAgent 从技术交底书生成完整的专利申请文件
 */

import { PatentWriterAgent } from '@yunpat/agent-patent-writer';
import { EventBus, ShortTermMemory, ToolRegistry } from '@yunpat/core';
import { OpenAI } from 'openai';

// 初始化组件
const eventBus = new EventBus();
const memory = new ShortTermMemory();
const tools = new ToolRegistry(eventBus);

// 配置 LLM（使用 OpenAI）
const llm = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 创建专利撰写智能体
const writerAgent = new PatentWriterAgent({
  name: 'patent-writer-demo',
  description: '专利撰写示例智能体',
  eventBus,
  memory,
  tools,
  llm: {
    chat: async (params) => {
      const response = await llm.chat.completions.create({
        model: 'gpt-4',
        messages: params.messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        temperature: 0.3,
      });

      return {
        message: {
          content: response.choices[0].message.content || '',
        },
      };
    },
  } as any,
  enableKnowledge: true,
  enableTemplates: true,
});

async function main() {
  try {
    console.log('=== 专利撰写示例 ===\n');

    // 准备技术交底书
    const disclosure = {
      title: '一种基于深度学习的自动驾驶车辆目标检测方法',
      field: '人工智能/自动驾驶',
      applicant: '未来科技有限公司',
      inventors: ['张三', '李四', '王五'],
      technicalDisclosure: `
## 技术领域
本发明涉及计算机视觉和自动驾驶技术领域，特别涉及一种基于深度学习的自动驾驶车辆目标检测方法。

## 背景技术
自动驾驶技术是智能交通系统的核心组成部分。目标检测是自动驾驶系统的关键环节，用于识别道路上的车辆、行人、交通标志等物体。

现有技术存在的问题：
1. 在复杂天气条件下（雨雪、雾霾）检测准确率低
2. 小目标检测效果差（远距离的行人、车辆）
3. 实时性不足，难以满足自动驾驶的实时要求
4. 对遮挡目标的处理能力弱

## 发明内容
本发明提供一种基于深度学习的自动驾驶车辆目标检测方法，旨在解决上述技术问题。

### 技术方案
本发明采用以下技术方案：

1. **多尺度特征提取**：使用改进的 YOLOv5 网络作为基础架构，引入注意力机制增强关键特征

2. **自适应特征融合**：设计双向特征金字塔网络（BiFPN），实现多尺度特征的高效融合

3. **困难样本挖掘**：采用在线困难样本挖掘（OHEM）策略，提升困难样本的检测精度

4. **时序信息整合**：引入 LSTM 模块整合多帧图像的时序信息，提高检测稳定性

关键创新点：
- 注意力机制：使用 CBAM（Convolutional Block Attention Module）增强重要特征
- 自适应权重：根据目标尺度动态调整特征融合权重
- 上下文感知：利用上下文信息辅助小目标和遮挡目标的检测

### 技术效果
与现有技术相比，本发明具有以下有益效果：

1. 检测准确率提升 25%（在 KITTI 数据集上 mAP 达到 89.3%）
2. 小目标检测准确率提升 40%
3. 复杂天气条件下准确率提升 30%
4. 实时性能优异，处理速度达到 45 FPS
5. 对遮挡目标的检测准确率提升 35%

### 实施方式
具体实施方式：
1. 输入：车载摄像头采集的连续图像序列
2. 预处理：图像去噪、增强、归一化
3. 特征提取：使用改进的 YOLOv5+CBAM 提取特征
4. 特征融合：通过 BiFPN 融合多尺度特征
5. 目标检测：输出目标类别、位置、置信度
6. 后处理：非极大值抑制（NMS）去除重复检测
7. 时序平滑：使用 LSTM 整合时序信息
8. 输出：最终检测结果

## 附图说明
图1：整体方法流程图
图2：改进的 YOLOv5 网络结构图
图3：注意力机制示意图
图4：特征融合模块结构图
图5：检测结果对比图
      `,
      drawings: [
        '图1: 整体方法流程图',
        '图2: 改进的 YOLOv5 网络结构图',
        '图3: 注意力机制示意图',
        '图4: 特征融合模块结构图',
        '图5: 检测结果对比图',
      ],
    };

    console.log('📝 开始撰写专利...\n');

    // 执行专利撰写
    const result = await writerAgent.execute(disclosure);

    // 输出结果
    console.log('✅ 专利撰写完成！\n');
    console.log('=== 基本信息 ===');
    console.log(`发明名称: ${result.patentApplication.title}`);
    console.log(`申请号: ${result.patentApplication.applicationNumber || '待分配'}`);
    console.log(`申请人: ${result.patentApplication.applicant}`);
    console.log(`发明人: ${result.patentApplication.inventors.join(', ')}`);

    console.log('\n=== 撰写统计 ===');
    console.log(`权利要求数量: ${result.patentApplication.claims.length}`);
    console.log(`说明书字数: ${result.metrics.descriptionWordCount}`);
    console.log(`质量评分: ${result.metrics.qualityScore}/100`);
    console.log(`撰写耗时: ${result.metrics.durationMinutes} 分钟`);

    console.log('\n=== 权利要求书（节选）===');
    console.log(result.patentApplication.claims.slice(0, 500));
    console.log('...');

    console.log('\n=== 摘要 ===');
    console.log(result.patentApplication.abstract);

    console.log('\n=== 质量分析 ===');
    console.log(`整体质量: ${result.metrics.qualityScore >= 80 ? '优秀' : result.metrics.qualityScore >= 60 ? '良好' : '需改进'}`);

    if (result.metrics.qualityScore < 80) {
      console.log('\n💡 改进建议:');
      console.log('- 增加具体实施例的详细描述');
      console.log('- 补充实验数据和对比结果');
      console.log('- 优化权利要求的保护范围');
    }

    // 导出为 CN 格式
    console.log('\n📄 导出为 CN 格式...');
    const exportResult = await writerAgent.exportToFormat('cn');

    console.log(`✅ 导出完成！`);
    console.log(`格式: ${exportResult.format}`);
    console.log(`文档字数: ${exportResult.metadata.wordCount}`);
    console.log(`权利要求数: ${exportResult.metadata.claimsCount}`);

    // 保存到文件
    const fs = await import('fs/promises');
    const outputPath = './patent-application-cn.txt';
    await fs.writeFile(outputPath, exportResult.content, 'utf-8');
    console.log(`\n💾 文档已保存到: ${outputPath}`);

  } catch (error) {
    console.error('❌ 撰写失败:', error);
    if (error instanceof Error) {
      console.error(`错误信息: ${error.message}`);
    }
  }
}

// 运行示例
if (require.main === module) {
  main().catch(console.error);
}

export { main };
