/**
 * 增强版写作助手智能体
 *
 * 集成工具选择优化系统，提升智能体的工具选择准确性
 */

import {
  Agent,
  AgentConfig,
  ExecutionContext,
  toolSelectionOptimizer,
  type EnhancedTool,
} from '@yunpat/core';
import { WriterAgent } from './WriterAgent.js';
import type { WritingTask, WritingResult } from './WriterAgent.js';

/**
 * 增强版写作助手智能体
 *
 * 集成工具选择优化器，提供：
 * - 智能工具选择
 * - 性能追踪
 * - 准确性分析
 */
export class EnhancedWriterAgent extends WriterAgent {
  /**
   * 可用工具列表
   */
  private availableTools: EnhancedTool[] = [];

  /**
   * 工具使用统计
   */
  private toolUsageStats = {
    totalSelections: 0,
    optimizedSelections: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
  };

  constructor(config: Omit<AgentConfig, 'name' | 'description'>) {
    super(config);
    console.log('🚀 增强版写作助手已初始化（集成工具选择优化器）');
  }

  /**
   * 注册可用工具
   */
  registerTools(tools: EnhancedTool[]) {
    this.availableTools = tools;
    console.log(`🔧 已注册 ${tools.length} 个工具`);
    tools.forEach(tool => {
      console.log(`   - ${tool.metadata.name}: ${tool.metadata.description}`);
    });
  }

  /**
   * 重写plan方法 - 集成工具选择优化
   */
  protected async plan(task: WritingTask, context: ExecutionContext): Promise<any> {
    console.log('\n🧠 [增强版] 开始规划...');
    console.log(`📋 任务类型: ${task.type}`);
    console.log(`📝 主题: ${task.topic}`);

    // ========== 工具选择优化 ==========
    const userInput = this.formatTaskToUserInput(task);

    console.log('\n🎯 生成优化的工具选择提示...');
    const optimizedPrompt = toolSelectionOptimizer.optimizeToolSelectionPrompt(
      userInput,
      this.availableTools,
      {
        conversationHistory: context.conversationHistory || [],
        currentTask: `${task.type}: ${task.topic}`,
      }
    );

    console.log('📊 生成的优化提示长度:', optimizedPrompt.length);

    // 使用LLM分析工具选择
    const toolSelection = await this.analyzeToolSelection(
      optimizedPrompt,
      context
    );

    console.log(`✅ 选择的工具: ${toolSelection.selectedTool || '无'}`);
    console.log(`💭 推理过程: ${toolSelection.reasoning?.substring(0, 100)}...`);

    // 更新统计
    this.toolUsageStats.totalSelections++;
    if (toolSelection.useOptimizer) {
      this.toolUsageStats.optimizedSelections++;
    }

    // 调用原始plan方法
    const plan = await super.plan(task, context);

    // 将工具选择信息添加到计划中
    return {
      ...plan,
      toolSelection: toolSelection.selectedTool,
      toolReasoning: toolSelection.reasoning,
    };
  }

  /**
   * 重写act方法 - 集成工具使用追踪
   */
  protected async act(plan: any, context: ExecutionContext): Promise<WritingResult> {
    console.log('\n⚙️ [增强版] 开始执行...');

    // 如果有选定的工具，执行工具
    if (plan.toolSelection && this.availableTools.length > 0) {
      const tool = this.availableTools.find(t => t.metadata.name === plan.toolSelection);

      if (tool) {
        console.log(`🔧 执行工具: ${plan.toolSelection}`);
        const startTime = Date.now();

        try {
          // 准备工具参数
          const toolParams = this.prepareToolParameters(plan);

          // 执行工具
          const toolResult = await tool.execute(toolParams);

          // 记录成功的工具使用
          toolSelectionOptimizer.recordToolUsage(
            plan.toolSelection,
            this.formatTaskToUserInput(context.currentTask),
            toolParams,
            {
              success: true,
              executionTime: Date.now() - startTime,
              output: toolResult,
            },
            {
              sessionId: context.sessionId,
              userId: context.userId,
              conversationHistory: context.conversationHistory,
            }
          );

          this.toolUsageStats.successfulExecutions++;
          console.log(`✅ 工具执行成功，耗时: ${Date.now() - startTime}ms`);

          // 将工具结果整合到写作内容中
          return this.integrateToolResult(toolResult, plan, context);

        } catch (error) {
          // 记录失败的工具使用
          toolSelectionOptimizer.recordToolUsage(
            plan.toolSelection,
            this.formatTaskToUserInput(context.currentTask),
            {},
            {
              success: false,
              executionTime: Date.now() - startTime,
              error: error.message,
            },
            {
              sessionId: context.sessionId,
            }
          );

          this.toolUsageStats.failedExecutions++;
          console.error(`❌ 工具执行失败: ${error.message}`);

          // 尝试使用替代工具
          return this.tryAlternativeTool(plan, context, error);
        }
      }
    }

    // 没有工具或工具执行失败，使用原始act方法
    console.log('📝 使用标准写作流程...');
    return super.act(plan, context);
  }

  /**
   * 重写reflect方法 - 添加性能分析
   */
  protected async reflect(result: WritingResult, context: ExecutionContext): Promise<any> {
    console.log('\n🔍 [增强版] 开始反思...');

    // 生成性能报告
    const performanceReport = toolSelectionOptimizer.getPerformanceReport();
    console.log('\n📊 性能报告:');
    console.log(performanceReport.substring(0, 500) + '...');

    // 分析选择准确性
    const accuracyAnalysis = toolSelectionOptimizer.analyzeSelectionAccuracy();
    console.log(`\n📈 工具选择准确率: ${(accuracyAnalysis.accuracy * 100).toFixed(1)}%`);
    console.log(`💡 改进建议:`, accuracyAnalysis.improvements);

    // 显示工具使用统计
    console.log('\n📊 工具使用统计:');
    console.log(`  总选择次数: ${this.toolUsageStats.totalSelections}`);
    console.log(`  优化选择次数: ${this.toolUsageStats.optimizedSelections}`);
    console.log(`  成功执行次数: ${this.toolUsageStats.successfulExecutions}`);
    console.log(`  失败执行次数: ${this.toolUsageStats.failedExecutions}`);

    const reflection = await super.reflect(result, context);

    return {
      ...reflection,
      performanceReport,
      accuracyAnalysis,
      toolUsageStats: this.toolUsageStats,
    };
  }

  /**
   * 分析工具选择
   */
  private async analyzeToolSelection(
    optimizedPrompt: string,
    context: ExecutionContext
  ): Promise<{
    selectedTool?: string;
    reasoning?: string;
    useOptimizer: boolean;
  }> {
    try {
      // 使用LLM分析工具选择
      const response = await context.llm.chat([
        {
          role: 'system',
          content: '你是一个工具选择专家，请分析用户的请求并推荐最合适的工具。',
        },
        {
          role: 'user',
          content: optimizedPrompt,
        },
      ]);

      // 解析LLM响应
      const selection = this.parseToolSelection(response.content);

      return {
        ...selection,
        useOptimizer: true,
      };

    } catch (error) {
      console.error('工具选择分析失败:', error.message);
      return {
        useOptimizer: false,
      };
    }
  }

  /**
   * 解析工具选择
   */
  private parseToolSelection(llmResponse: string): {
    selectedTool?: string;
    reasoning?: string;
  } {
    const lines = llmResponse.split('\n');
    let selectedTool = '';
    let reasoning = '';

    for (const line of lines) {
      if (line.includes('推荐工具') || line.includes('选择工具')) {
        selectedTool = line.split('：')[1]?.split('**')[0]?.trim() || '';
      }
      if (line.includes('选择理由') || line.includes('推荐理由')) {
        reasoning = line.split('：')[1]?.trim() || '';
      }
    }

    return { selectedTool, reasoning };
  }

  /**
   * 准备工具参数
   */
  private prepareToolParameters(plan: any): Record<string, any> {
    // 根据任务类型准备参数
    if (plan.task && plan.task.type === 'convert') {
      return {
        sourceFormat: plan.task.format || 'markdown',
        targetFormat: plan.task.format || 'markdown',
        content: plan.task.topic,
      };
    }

    return {};
  }

  /**
   * 整合工具结果到写作内容
   */
  private async integrateToolResult(
    toolResult: any,
    plan: any,
    context: ExecutionContext
  ): Promise<WritingResult> {
    // 将工具结果整合到写作流程中
    console.log('🔄 整合工具结果到写作内容...');

    // 这里可以根据具体的工具结果来调整写作计划
    // 例如：如果工具提供了文档大纲，可以基于大纲生成内容

    return super.act(plan, context);
  }

  /**
   * 尝试使用替代工具
   */
  private async tryAlternativeTool(
    plan: any,
    context: ExecutionContext,
    error: Error
  ): Promise<WritingResult> {
    console.log('🔄 尝试使用替代工具...');

    // 获取推荐
    const recommendations = toolSelectionOptimizer.optimizeToolSelectionPrompt(
      this.formatTaskToUserInput(context.currentTask),
      this.availableTools
    );

    // 询问LLM选择替代工具
    const retryPrompt = `
工具 ${plan.toolSelection} 执行失败：
错误：${error.message}

请基于推荐选择替代工具：
${recommendations}
`;

    const response = await context.llm.chat([
      { role: 'user', content: retryPrompt }
    ]);

    const selection = this.parseToolSelection(response.content);

    if (selection.selectedTool) {
      const tool = this.availableTools.find(
        t => t.metadata.name === selection.selectedTool
      );

      if (tool) {
        console.log(`🔄 尝试替代工具: ${selection.selectedTool}`);
        const startTime = Date.now();

        try {
          const toolResult = await tool.execute(this.prepareToolParameters(plan));

          toolSelectionOptimizer.recordToolUsage(
            selection.selectedTool,
            this.formatTaskToUserInput(context.currentTask),
            this.prepareToolParameters(plan),
            {
              success: true,
              executionTime: Date.now() - startTime,
              output: toolResult,
            }
          );

          console.log(`✅ 替代工具成功，耗时: ${Date.now() - startTime}ms`);
          return this.integrateToolResult(toolResult, plan, context);

        } catch (retryError) {
          console.error(`❌ 替代工具也失败: ${retryError.message}`);
          throw retryError;
        }
      }
    }

    // 没有合适的替代工具，使用原始流程
    return super.act(plan, context);
  }

  /**
   * 格式化任务为用户输入
   */
  private formatTaskToUserInput(task: WritingTask | any): string {
    if (task.type && task.topic) {
      return `${task.type} ${task.format || '文档'}: ${task.topic}`;
    }
    return '技术写作任务';
  }

  /**
   * 从内容中提取大纲
   */
  private extractOutlineFromContent(content: string): string[] {
    const lines = content.split('\n');
    const outline: string[] = [];

    for (const line of lines) {
      // 匹配Markdown标题
      const match = line.match(/^(#{1,6})\s+(.+)/);
      if (match) {
        outline.push(match[2]);
      }
    }

    return outline;
  }

  /**
   * 获取工具使用统计
   */
  getToolUsageStats() {
    return {
      ...this.toolUsageStats,
      optimizationRate: this.toolUsageStats.totalSelections > 0
        ? this.toolUsageStats.optimizedSelections / this.toolUsageStats.totalSelections
        : 0,
    };
  }

  /**
   * 重置统计
   */
  resetToolUsageStats() {
    this.toolUsageStats = {
      totalSelections: 0,
      optimizedSelections: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
    };
  }
}

/**
 * 创建增强版写作助手
 */
export function createEnhancedWriterAgent(config?: Omit<AgentConfig, 'name' | 'description'>) {
  return new EnhancedWriterAgent(config || {});
}
