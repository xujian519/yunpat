/**
 * BatchProcessor 集成示例
 *
 * 演示如何在 WriterAgent 中集成 BatchProcessor 以节省 API 成本
 */

import { WriterAgent, WritingTask, WritingPlan } from '../src/WriterAgent.js';
import { BatchProcessor } from '@yunpat/core';
import { ExecutionContext } from '@yunpat/core';

/**
 * 增强版 WriterAgent - 集成批处理
 */
export class BatchWriterAgent extends WriterAgent {
  private batchProcessor?: BatchProcessor;

  /**
   * 初始化钩子 - 创建批处理器
   */
  protected async init(task: WritingTask, context: ExecutionContext): Promise<void> {
    // 创建批处理器
    this.batchProcessor = new BatchProcessor(context.llm, {
      maxSectionsPerBatch: 8,
      timeout: 120000,
      enabled: true,
    });

    console.log('[BatchWriterAgent] 批处理器已初始化');
  }

  /**
   * 执行阶段 - 使用批处理优化
   */
  protected async act(plan: WritingPlan, context: ExecutionContext): Promise<any> {
    if (!this.batchProcessor) {
      // 回退到原始实现
      return super.act(plan, context);
    }

    console.log(`[BatchWriterAgent] 开始批量生成 ${plan.structure.sections.length} 个章节`);

    // 估算成本节省
    const savings = this.batchProcessor.estimateCostSavings(plan.structure.sections.length);
    console.log(`[BatchWriterAgent] 预计节省: ${savings.savingsPercentage}% API调用`);

    // 提取章节标题
    const sectionHeadings = plan.structure.sections.map((s) => s.heading);

    // 批量生成章节内容
    const resultMap = await this.batchProcessor.batchGenerate(sectionHeadings, plan, context);

    // 按原始顺序组装内容
    let fullContent = '';
    let totalWords = 0;

    plan.structure.sections.forEach((section) => {
      const result = resultMap.get(section.heading);
      if (result) {
        section.content = result.content;
        fullContent += `## ${section.heading}\n\n${result.content}\n\n`;
        totalWords += result.wordCount;
      }
    });

    // 格式化输出
    const formattedContent = this.formatContent(fullContent, plan);

    return {
      document: {
        title: plan.structure.title,
        content: formattedContent,
        format: 'markdown',
      },
      stats: {
        wordCount: totalWords,
        paragraphCount: plan.structure.sections.length,
        sectionCount: plan.structure.sections.length,
      },
      metadata: {
        generatedAt: new Date(),
        tone: plan.tone,
        revision: 1,
        batchProcessing: true, // 标记使用了批处理
      },
    };
  }

  /**
   * 禁用批处理（用于对比测试）
   */
  disableBatchProcessing(): void {
    this.batchProcessor?.disable();
  }

  /**
   * 启用批处理
   */
  enableBatchProcessing(): void {
    this.batchProcessor?.enable();
  }
}

/**
 * 使用示例
 */
export async function runBatchProcessorExample() {
  console.log('=== BatchProcessor 集成示例 ===\n');

  // 模拟执行上下文（实际使用时需要真实的 LLM 和其他组件）
  const mockContext: any = {
    llm: {
      chat: async (params: any) => {
        // 模拟批量响应
        return {
          message: {
            role: 'assistant',
            content: `{
  "sections": [
    {
      "heading": "引言",
      "content": "这是引言内容..."
    },
    {
      "heading": "架构设计",
      "content": "这是架构设计内容..."
    },
    {
      "heading": "核心组件",
      "content": "这是核心组件内容..."
    }
  ]
}`,
          },
        };
      },
    },
  };

  // 创建增强版 WriterAgent
  const agent = new BatchWriterAgent({
    name: 'batch-writer',
    description: '支持批处理的技术写作助手',
  });

  // 模拟写作任务
  const task: WritingTask = {
    type: 'generate',
    topic: 'YunPat 智能体框架',
    requirements: ['技术文档', '详细'],
  };

  // 模拟计划
  const plan: WritingPlan = {
    outline: ['引言', '架构设计', '核心组件', '应用场景', '总结'],
    structure: {
      title: 'YunPat 智能体框架',
      sections: [
        { heading: '引言', content: '', order: 0 },
        { heading: '架构设计', content: '', order: 1 },
        { heading: '核心组件', content: '', order: 2 },
        { heading: '应用场景', content: '', order: 3 },
        { heading: '总结', content: '', order: 4 },
      ],
    },
    tone: 'technical',
    targetLength: 2000,
  };

  console.log('1. 成本节省估算:');
  const batchProcessor = new BatchProcessor(mockContext.llm);
  const savings = batchProcessor.estimateCostSavings(5);
  console.log(`   原始API调用: ${savings.originalCalls}次`);
  console.log(`   批处理后: ${savings.batchCalls}次`);
  console.log(`   节省: ${savings.savedCalls}次 (${savings.savingsPercentage}%)\n`);

  console.log('2. 批处理配置:');
  console.log(JSON.stringify(batchProcessor.getConfig(), null, 2));

  console.log('\n3. 智能分批示例:');
  const sections = ['第一章', '第二章', '第三章', '第四章', '第五章', '第六章', '第七章', '第八章', '第九章', '第十章'];
  console.log(`   总章节数: ${sections.length}`);
  console.log(`   单批最大: 8个章节`);
  console.log(`   分批数量: ${Math.ceil(sections.length / 8)}批`);

  console.log('\n4. 实际应用场景:');
  console.log('   - 5个章节: 5次API → 1次API (节省80%)');
  console.log('   - 10个章节: 10次API → 2次API (节省80%)');
  console.log('   - 20个章节: 20次API → 3次API (节省85%)');

  console.log('\n=== 示例完成 ===');
}

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
  runBatchProcessorExample().catch(console.error);
}
