/**
 * 工具选择准确性提升 - 使用示例
 *
 * 演示如何使用三大系统提升智能体工具选择准确性
 */

import { ToolSelectionOptimizer } from '../packages/core/src/tools/ToolSelectionOptimizer.js';
import { toolUsageTracker } from '../packages/core/src/tools/ToolUsageTracker.js';

// 示例：在智能体中使用工具选择优化器

/**
 * 示例1：基础使用 - 生成优化的工具选择提示
 */
async function example1_BasicUsage() {
  console.log('=== 示例1：基础使用 ===\n');

  const optimizer = new ToolSelectionOptimizer();

  // 模拟可用工具列表
  const availableTools = [
    {
      metadata: {
        name: 'PdfToMarkdownTool',
        description: '将PDF文件转换为Markdown格式',
        category: 'DOCUMENT',
      },
    },
    {
      metadata: {
        name: 'ExcelToJsonTool',
        description: '将Excel文件转换为JSON格式',
        category: 'DOCUMENT',
      },
    },
  ];

  // 用户输入
  const userInput = '帮我把这个PDF文件转换成Markdown格式';

  // 生成优化提示
  const optimizedPrompt = optimizer.optimizeToolSelectionPrompt(
    userInput,
    availableTools,
    {
      currentTask: '文档格式转换',
    }
  );

  console.log('优化后的提示：');
  console.log(optimizedPrompt);
  console.log('\n');
}

/**
 * 示例2：记录工具使用
 */
async function example2_RecordUsage() {
  console.log('=== 示例2：记录工具使用 ===\n');

  const optimizer = new ToolSelectionOptimizer();

  // 模拟工具调用
  const recordId = optimizer.recordToolUsage(
    'PdfToMarkdownTool',
    '帮我把这个PDF文件转换成Markdown格式',
    { filePath: '/path/to/document.pdf' },
    {
      success: true,
      executionTime: 1500,
      output: { markdown: '# 文档标题\n\n内容...' },
    },
    {
      sessionId: 'session-123',
      userId: 'user-456',
      conversationHistory: [
        { role: 'user', content: '帮我把这个PDF文件转换成Markdown格式' },
      ],
    }
  );

  console.log(`工具使用已记录，ID: ${recordId}`);

  // 获取性能统计
  const stats = toolUsageTracker.getPerformanceStats('PdfToMarkdownTool');
  console.log('工具性能统计：');
  console.log(`  总调用次数：${stats.totalCalls}`);
  console.log(`  成功率：${(stats.successRate * 100).toFixed(1)}%`);
  console.log(`  平均执行时间：${stats.avgExecutionTime.toFixed(0)}ms`);
  console.log('\n');
}

/**
 * 示例3：获取工具推荐
 */
async function example3_GetRecommendations() {
  console.log('=== 示例3：获取工具推荐 ===\n');

  const userInput = '分析这个Excel表格中的销售数据';
  const availableTools = [
    'ExcelReadTool',
    'ExcelToJsonTool',
    'PdfParseTool',
    'DataAnalysisTool',
  ];

  // 获取推荐
  const recommendations = toolUsageTracker.getRecommendations(
    userInput,
    availableTools
  );

  console.log('工具推荐：');
  for (const rec of recommendations) {
    console.log(`  ${rec.toolName}`);
    console.log(`    置信度：${(rec.confidence * 100).toFixed(0)}%`);
    console.log(`    理由：${rec.reason}`);
    if (rec.expectedPerformance.successRate) {
      console.log(`    预期成功率：${(rec.expectedPerformance.successRate * 100).toFixed(0)}%`);
    }
  }
  console.log('\n');
}

/**
 * 示例4：生成性能报告
 */
async function example4_PerformanceReport() {
  console.log('=== 示例4：生成性能报告 ===\n');

  const optimizer = new ToolSelectionOptimizer();
  const report = optimizer.getPerformanceReport();

  console.log('工具性能报告：');
  console.log(report);
  console.log('\n');
}

/**
 * 示例5：分析选择准确性
 */
async function example5_AnalyzeAccuracy() {
  console.log('=== 示例5：分析选择准确性 ===\n');

  const optimizer = new ToolSelectionOptimizer();
  const analysis = optimizer.analyzeSelectionAccuracy();

  console.log('选择准确性分析：');
  console.log(`  当前准确率：${(analysis.accuracy * 100).toFixed(1)}%`);
  console.log(`  改进建议：`);
  analysis.improvements.forEach((improvement, index) => {
    console.log(`    ${index + 1}. ${improvement}`);
  });
  console.log('\n');
}

/**
 * 示例6：在智能体中集成
 */
class EnhancedAgent {
  private optimizer: ToolSelectionOptimizer;

  constructor() {
    this.optimizer = new ToolSelectionOptimizer();
  }

  /**
   * 使用优化器选择工具
   */
  async selectTool(userInput: string, availableTools: any[]) {
    // 1. 生成优化提示
    const prompt = this.optimizer.optimizeToolSelectionPrompt(
      userInput,
      availableTools,
      {
        currentTask: userInput,
      }
    );

    // 2. 调用LLM获取决策
    // const decision = await this.llm.generate(prompt);

    // 3. 解析决策，提取工具名称和参数
    // const { toolName, parameters } = this.parseDecision(decision);

    // 4. 执行工具调用
    // const result = await this.executeTool(toolName, parameters);

    // 5. 记录使用情况
    /*
    this.optimizer.recordToolUsage(
      toolName,
      userInput,
      parameters,
      result
    );
    */

    console.log('已生成优化的工具选择提示');
    console.log('提示长度：', prompt.length, '字符');
    console.log('包含Few-shot示例和工具推荐');
  }

  /**
   * 获取性能反馈并优化
   */
  async optimizeBasedOnHistory() {
    const report = this.optimizer.getPerformanceReport();
    const analysis = this.optimizer.analyzeSelectionAccuracy();

    console.log('=== 基于历史的优化建议 ===\n');
    console.log(report);
    console.log('\n');
    console.log('=== 准确性分析 ===\n');
    console.log(`准确率：${(analysis.accuracy * 100).toFixed(1)}%`);
    console.log('改进建议：');
    analysis.improvements.forEach((item, index) => {
      console.log(`  ${index + 1}. ${item}`);
    });
  }
}

/**
 * 示例7：完整工作流
 */
async function example7_CompleteWorkflow() {
  console.log('=== 示例7：完整工作流 ===\n');

  const agent = new EnhancedAgent();

  // 用户请求
  const userInput = '帮我把这个PDF文件转换成Markdown格式';
  const availableTools = [
    { metadata: { name: 'PdfToMarkdownTool', description: 'PDF转Markdown', category: 'DOCUMENT' } },
    { metadata: { name: 'PdfParseTool', description: '解析PDF', category: 'DOCUMENT' } },
  ];

  // 步骤1：选择工具
  await agent.selectTool(userInput, availableTools);

  // 步骤2：基于历史优化
  console.log('\n基于历史数据优化...\n');
  await agent.optimizeBasedOnHistory();
}

// 主函数
async function main() {
  console.log('🚀 工具选择准确性提升 - 实际应用示例\n');
  console.log('========================================\n');

  try {
    await example1_BasicUsage();
    await example2_RecordUsage();
    await example3_GetRecommendations();
    await example4_PerformanceReport();
    await example5_AnalyzeAccuracy();
    await example7_CompleteWorkflow();
  } catch (error) {
    console.error('执行示例时出错:', error);
  }
}

// 运行示例
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
