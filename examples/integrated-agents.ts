/**
 * 实际智能体集成示例 - 3种集成方式
 *
 * 演示如何在真实智能体中使用工具选择优化器
 */

import { Agent, toolSelectionOptimizer } from './packages/core/dist/index.js';

// 模拟LLM
class MockLLM {
  async chat(messages) {
    // 简单的模拟响应
    const userMessage = messages[messages.length - 1].content;

    if (userMessage.includes('PDF') && userMessage.includes('Markdown')) {
      return {
        content: `
**需求分析**：用户想要将PDF转换为Markdown格式
**候选工具**：PdfToMarkdownTool, PdfParseTool
**推荐工具**：PdfToMarkdownTool
**选择理由**：这是专门的PDF到Markdown转换工具，能够保留文档结构
**工具参数**：
\`\`\`json
{
  "filePath": "/path/to/document.pdf",
  "includeHeaderFooter": false
}
\`\`\`
**执行计划**：使用PdfToMarkdownTool直接转换
        `,
      };
    }

    return {
      content: `
**需求分析**：处理文档
**推荐工具**：PdfToMarkdownTool
**选择理由**：最适合的工具
**工具参数**：{"filePath": "doc.pdf"}
**执行计划**：执行工具
      `,
    };
  }
}

// 模拟工具
const mockTools = new Map([
  [
    'PdfToMarkdownTool',
    {
      metadata: {
        name: 'PdfToMarkdownTool',
        description: '将PDF文件转换为Markdown格式',
        category: 'document',
      },
      execute: async (params) => {
        return { markdown: `# 转换后的内容\n\n这是从 ${params.filePath} 转换来的内容` };
      },
    },
  ],
  [
    'PdfParseTool',
    {
      metadata: {
        name: 'PdfParseTool',
        description: '解析PDF文件',
        category: 'document',
      },
      execute: async (params) => {
        return { text: `从 ${params.filePath} 解析的文本内容` };
      },
    },
  ],
  [
    'ImageOcrTool',
    {
      metadata: {
        name: 'ImageOcrTool',
        description: '图片OCR识别',
        category: 'image',
      },
      execute: async (params) => {
        return { text: `从 ${params.imagePath} 识别的文字` };
      },
    },
  ],
]);

// ========== 方式1: 基础集成 ==========
class BasicIntegratedAgent extends Agent {
  constructor(config) {
    super(config);
    console.log('🤖 基础集成智能体已初始化');
  }

  protected async plan(input, context) {
    console.log('\n🧠 [基础] 开始规划...');

    // 生成优化提示
    const prompt = toolSelectionOptimizer.optimizeToolSelectionPrompt(
      input.userInput,
      this.getAvailableTools(context)
    );

    // LLM决策
    const response = await context.llm.chat([{ role: 'user', content: prompt }]);

    // 解析选择
    const selection = this.parseToolSelection(response.content);
    console.log(`✅ [基础] 选择的工具: ${selection.toolName}`);

    return selection;
  }

  protected async act(plan, context) {
    console.log('\n⚙️ [基础] 开始执行...');

    const startTime = Date.now();
    try {
      const result = await context.tools.get(plan.toolName).execute(plan.parameters);

      // 记录成功
      toolSelectionOptimizer.recordToolUsage(
        plan.toolName,
        context.userInput,
        plan.parameters,
        {
          success: true,
          executionTime: Date.now() - startTime,
          output: result,
        }
      );

      console.log(`✅ [基础] 执行成功，耗时: ${Date.now() - startTime}ms`);
      return { success: true, result, tool: plan.toolName };
    } catch (error) {
      // 记录失败
      toolSelectionOptimizer.recordToolUsage(
        plan.toolName,
        context.userInput,
        plan.parameters,
        {
          success: false,
          executionTime: Date.now() - startTime,
          error: error.message,
        }
      );

      console.error(`❌ [基础] 执行失败: ${error.message}`);
      throw error;
    }
  }

  getAvailableTools(context) {
    return Array.from(context.tools.entries()).map(([name, tool]) => ({
      metadata: tool.metadata,
      execute: tool.execute.bind(tool),
    }));
  }

  parseToolSelection(llmResponse) {
    const lines = llmResponse.split('\n');
    let toolName = '';
    let parameters = {};

    for (const line of lines) {
      if (line.includes('推荐工具') || line.includes('选择工具')) {
        toolName = line.split('：')[1]?.split('**')[0]?.trim() || '';
      }
      if (line.includes('工具参数')) {
        const jsonMatch = line.match(/```json\n([\s\S]*?)\n```/);
        if (jsonMatch) {
          try {
            parameters = JSON.parse(jsonMatch[1]);
          } catch (e) {
            parameters = {};
          }
        }
      }
    }

    return { toolName, parameters };
  }
}

// ========== 方式2: 高级集成（带推荐和错误恢复） ==========
class AdvancedIntegratedAgent extends Agent {
  constructor(config) {
    super(config);
    console.log('🚀 高级集成智能体已初始化');
  }

  protected async plan(input, context) {
    console.log('\n🧠 [高级] 开始规划...');

    // 获取优化提示（包含推荐）
    const prompt = toolSelectionOptimizer.optimizeToolSelectionPrompt(
      input.userInput,
      this.getAvailableTools(context)
    );

    // 询问LLM是否接受推荐
    const decisionPrompt = `
基于以下推荐，请选择工具：
${prompt}

如果推荐合适，请使用推荐工具；否则说明原因并选择其他工具。
`;

    const response = await context.llm.chat([{ role: 'user', content: decisionPrompt }]);

    const selection = this.parseToolSelection(response.content);
    console.log(`✅ [高级] 选择的工具: ${selection.toolName}`);

    return selection;
  }

  protected async act(plan, context) {
    console.log('\n⚙️ [高级] 开始执行...');

    const startTime = Date.now();
    try {
      const result = await context.tools.get(plan.toolName).execute(plan.parameters);

      // 记录成功
      toolSelectionOptimizer.recordToolUsage(
        plan.toolName,
        context.userInput,
        plan.parameters,
        {
          success: true,
          executionTime: Date.now() - startTime,
          output: result,
        }
      );

      console.log(`✅ [高级] 执行成功，耗时: ${Date.now() - startTime}ms`);
      return { success: true, result, tool: plan.toolName };
    } catch (error) {
      console.error(`❌ [高级] 执行失败: ${error.message}`);
      console.log('🔄 [高级] 尝试使用替代工具...');

      // 尝试替代工具
      return await this.tryAlternativeTool(plan, context, error);
    }
  }

  async tryAlternativeTool(plan, context, error) {
    // 获取推荐
    const recommendations = toolSelectionOptimizer.optimizeToolSelectionPrompt(
      context.userInput,
      this.getAvailableTools(context)
    );

    // 询问LLM选择替代工具
    const retryPrompt = `
工具 ${plan.toolName} 执行失败：
错误：${error.message}

请基于推荐选择替代工具：
${recommendations}
`;

    const response = await context.llm.chat([{ role: 'user', content: retryPrompt }]);
    const newPlan = this.parseToolSelection(response.content);

    console.log(`🔄 [高级] 尝试替代工具: ${newPlan.toolName}`);

    const startTime = Date.now();
    const result = await context.tools.get(newPlan.toolName).execute(newPlan.parameters);

    // 记录重试成功
    toolSelectionOptimizer.recordToolUsage(
      newPlan.toolName,
      context.userInput,
      newPlan.parameters,
      {
        success: true,
        executionTime: Date.now() - startTime,
        output: result,
      }
    );

    console.log(`✅ [高级] 替代工具成功，耗时: ${Date.now() - startTime}ms`);
    return {
      success: true,
      result,
      tool: newPlan.toolName,
      retry: true,
      originalError: error.message,
    };
  }

  getAvailableTools(context) {
    return Array.from(context.tools.entries()).map(([name, tool]) => ({
      metadata: tool.metadata,
      execute: tool.execute.bind(tool),
    }));
  }

  parseToolSelection(llmResponse) {
    const lines = llmResponse.split('\n');
    let toolName = '';
    let parameters = {};

    for (const line of lines) {
      if (line.includes('推荐工具') || line.includes('选择工具')) {
        toolName = line.split('：')[1]?.split('**')[0]?.trim() || '';
      }
      if (line.includes('工具参数')) {
        const jsonMatch = line.match(/```json\n([\s\S]*?)\n```/);
        if (jsonMatch) {
          try {
            parameters = JSON.parse(jsonMatch[1]);
          } catch (e) {
            parameters = {};
          }
        }
      }
    }

    return { toolName, parameters };
  }
}

// ========== 方式3: 完整集成（生产级） ==========
class ProductionIntegratedAgent extends Agent {
  constructor(config) {
    super(config);
    this.metrics = {
      totalToolCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      avgExecutionTime: 0,
    };
    console.log('🏭 生产级集成智能体已初始化');
  }

  protected async before(input, context) {
    console.log('\n📋 [生产] 处理请求:', input.userInput);
    console.log(`🔧 [生产] 可用工具: ${Array.from(context.tools.keys()).join(', ')}`);
  }

  protected async plan(input, context) {
    console.log('\n🧠 [生产] 开始规划...');

    const prompt = toolSelectionOptimizer.optimizeToolSelectionPrompt(
      input.userInput,
      this.getAvailableTools(context),
      {
        conversationHistory: context.conversationHistory,
        currentTask: context.currentTask,
      }
    );

    const response = await context.llm.chat([{ role: 'user', content: prompt }]);
    const selection = this.parseToolSelection(response.content);

    console.log(`✅ [生产] 选择的工具: ${selection.toolName}`);
    console.log(`💭 [生产] 推理过程: ${selection.reasoning?.substring(0, 50)}...`);

    return selection;
  }

  protected async act(plan, context) {
    console.log('\n⚙️ [生产] 开始执行...');
    this.metrics.totalToolCalls++;

    const startTime = Date.now();
    try {
      const result = await context.tools.get(plan.toolName).execute(plan.parameters);

      this.metrics.successfulCalls++;
      this.metrics.avgExecutionTime =
        (this.metrics.avgExecutionTime * (this.metrics.successfulCalls - 1) +
          (Date.now() - startTime)) /
        this.metrics.successfulCalls;

      // 记录成功
      toolSelectionOptimizer.recordToolUsage(
        plan.toolName,
        context.userInput,
        plan.parameters,
        {
          success: true,
          executionTime: Date.now() - startTime,
          output: result,
        },
        {
          sessionId: context.sessionId,
          userId: context.userId,
          conversationHistory: context.conversationHistory,
        }
      );

      console.log(`✅ [生产] 执行成功，耗时: ${Date.now() - startTime}ms`);
      return { success: true, result, tool: plan.toolName };
    } catch (error) {
      this.metrics.failedCalls++;

      // 记录失败
      toolSelectionOptimizer.recordToolUsage(
        plan.toolName,
        context.userInput,
        plan.parameters,
        {
          success: false,
          executionTime: Date.now() - startTime,
          error: error.message,
        },
        {
          sessionId: context.sessionId,
          userId: context.userId,
        }
      );

      console.error(`❌ [生产] 执行失败: ${error.message}`);
      throw error;
    }
  }

  protected async reflect(result, context) {
    console.log('\n🔍 [生产] 开始反思...');

    const report = toolSelectionOptimizer.getPerformanceReport();
    const accuracy = toolSelectionOptimizer.analyzeSelectionAccuracy();

    console.log(`📊 [生产] 性能指标:`, this.metrics);
    console.log(`📈 [生产] 选择准确率: ${(accuracy.accuracy * 100).toFixed(1)}%`);
    console.log(`💡 [生产] 改进建议:`, accuracy.improvements);

    return {
      metrics: this.metrics,
      performanceReport: report,
      accuracyAnalysis: accuracy,
    };
  }

  protected async after(input, output, context) {
    console.log('\n✅ [生产] 执行完成');
    console.log(`🎯 [生产] 最终结果: ${output.success ? '成功' : '失败'}`);
    if (output.result) {
      console.log(`📦 [生产] 结果预览: ${JSON.stringify(output.result).substring(0, 100)}...`);
    }
  }

  getAvailableTools(context) {
    return Array.from(context.tools.entries()).map(([name, tool]) => ({
      metadata: tool.metadata,
      execute: tool.execute.bind(tool),
    }));
  }

  parseToolSelection(llmResponse) {
    const lines = llmResponse.split('\n');
    let toolName = '';
    let parameters = {};
    let reasoning = '';

    for (const line of lines) {
      if (line.includes('推荐工具') || line.includes('选择工具')) {
        toolName = line.split('：')[1]?.split('**')[0]?.trim() || '';
      }
      if (line.includes('工具参数')) {
        const jsonMatch = line.match(/```json\n([\s\S]*?)\n```/);
        if (jsonMatch) {
          try {
            parameters = JSON.parse(jsonMatch[1]);
          } catch (e) {
            parameters = {};
          }
        }
      }
      if (line.includes('选择理由') || line.includes('推荐理由')) {
        reasoning = line.split('：')[1]?.trim() || '';
      }
    }

    return { toolName, parameters, reasoning };
  }
}

// ========== 运行示例 ==========

async function runBasicAgent() {
  console.log('\n' + '='.repeat(60));
  console.log('🔵 方式1: 基础集成智能体');
  console.log('='.repeat(60));

  const agent = new BasicIntegratedAgent({
    name: 'basic-document-processor',
    description: '基础文档处理智能体',
  });

  const context = {
    llm: new MockLLM(),
    tools: mockTools,
    userInput: '帮我把这个PDF文件转换成Markdown格式',
  };

  try {
    const plan = await agent.plan({ userInput: context.userInput }, context);
    const result = await agent.act(plan, context);

    console.log('\n✅ 基础集成演示完成！');
    console.log('📊 结果:', result.success ? '成功' : '失败');
  } catch (error) {
    console.error('❌ 基础集成演示失败:', error.message);
  }
}

async function runAdvancedAgent() {
  console.log('\n' + '='.repeat(60));
  console.log('🟢 方式2: 高级集成智能体（带错误恢复）');
  console.log('='.repeat(60));

  const agent = new AdvancedIntegratedAgent({
    name: 'advanced-document-processor',
    description: '高级文档处理智能体',
  });

  const context = {
    llm: new MockLLM(),
    tools: mockTools,
    userInput: '帮我把这个PDF文件转换成Markdown格式',
  };

  try {
    const plan = await agent.plan({ userInput: context.userInput }, context);
    const result = await agent.act(plan, context);

    console.log('\n✅ 高级集成演示完成！');
    console.log('📊 结果:', result.success ? '成功' : '失败');
    if (result.retry) {
      console.log('🔄 使用了替代工具');
    }
  } catch (error) {
    console.error('❌ 高级集成演示失败:', error.message);
  }
}

async function runProductionAgent() {
  console.log('\n' + '='.repeat(60));
  console.log('🟣 方式3: 生产级集成智能体');
  console.log('='.repeat(60));

  const agent = new ProductionIntegratedAgent({
    name: 'production-document-processor',
    description: '生产级文档处理智能体',
  });

  const context = {
    llm: new MockLLM(),
    tools: mockTools,
    userInput: '帮我把这个PDF文件转换成Markdown格式',
    conversationHistory: [
      { role: 'user', content: '我需要处理文档' },
      { role: 'assistant', content: '我可以帮您处理文档' },
    ],
    sessionId: 'prod-session-001',
    userId: 'prod-user',
    currentTask: '文档格式转换',
  };

  try {
    await agent.before({ userInput: context.userInput }, context);
    const plan = await agent.plan({ userInput: context.userInput }, context);
    const result = await agent.act(plan, context);
    const reflection = await agent.reflect(result, context);
    await agent.after({ userInput: context.userInput }, result, context);

    console.log('\n✅ 生产级集成演示完成！');
    console.log('📊 结果:', result.success ? '成功' : '失败');
    console.log('📈 性能指标:', reflection.metrics);
  } catch (error) {
    console.error('❌ 生产级集成演示失败:', error.message);
  }
}

async function runAllExamples() {
  console.log('🚀 开始运行3种集成方式示例...\n');

  await runBasicAgent();
  await runAdvancedAgent();
  await runProductionAgent();

  console.log('\n' + '='.repeat(60));
  console.log('🎉 所有集成方式演示完成！');
  console.log('='.repeat(60));

  console.log('\n✅ 方式1（基础集成）：适合新手，简单直接');
  console.log('✅ 方式2（高级集成）：带错误恢复，更智能');
  console.log('✅ 方式3（生产集成）：完整监控，生产级');

  console.log('\n🎯 选择建议：');
  console.log('- 新手学习：使用方式1');
  console.log('- 进阶开发：使用方式2');
  console.log('- 生产环境：使用方式3');
}

runAllExamples();
