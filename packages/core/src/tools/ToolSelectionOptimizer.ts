/**
 * 工具选择准确性提升系统
 *
 * 整合工具描述增强、Few-shot提示、使用追踪三大系统
 */

import { EnhancedTool } from './types.js';
import { ToolDescriptionEnhancer } from './ToolDescriptionEnhancer.js';
import { FewShotPromptManager } from '../reasoning/FewShotPromptManager.js';
import { toolUsageTracker } from './ToolUsageTracker.js';

type ToolUsageRecord = import('./ToolUsageTracker.js').ToolUsageRecord;

/**
 * 工具选择优化器
 */
export class ToolSelectionOptimizer {
  private descriptionEnhancer: ToolDescriptionEnhancer;
  private fewShotManager: FewShotPromptManager;

  constructor() {
    this.descriptionEnhancer = new ToolDescriptionEnhancer();
    this.fewShotManager = new FewShotPromptManager();
  }

  /**
   * 优化工具选择提示
   */
  optimizeToolSelectionPrompt(
    userInput: string,
    availableTools: EnhancedTool[],
    context?: {
      conversationHistory?: Array<{ role: string; content: string }>;
      currentTask?: string;
    }
  ): string {
    // 1. 生成增强的工具描述
    const enhancedMetadata = this.descriptionEnhancer.enhanceTools(availableTools);

    // 2. 获取相关Few-shot示例
    const relevantExamples = this.fewShotManager.getRelevantExamples(userInput, availableTools, 3);

    // 3. 获取工具推荐（基于使用历史）
    const recommendations = toolUsageTracker.getRecommendations(
      userInput,
      availableTools.map((t) => t.metadata.name)
    );

    // 4. 生成优化后的提示
    return this.generateOptimizedPrompt(
      userInput,
      availableTools,
      enhancedMetadata,
      relevantExamples,
      recommendations,
      context
    );
  }

  /**
   * 生成优化提示
   */
  private generateOptimizedPrompt(
    userInput: string,
    availableTools: EnhancedTool[],
    enhancedMetadata: Map<string, any>,
    relevantExamples: any[],
    recommendations: any[],
    context?: Record<string, any>
  ): string {
    let prompt = `
# 工具选择辅助系统

你是一个智能助手，需要为用户的请求选择最合适的工具。

## 📋 用户请求
${userInput}

${context?.currentTask ? `**当前任务**: ${context.currentTask}` : ''}

${
  context?.conversationHistory && context.conversationHistory.length > 0
    ? `
## 💬 对话历史
${this.formatConversationHistory(context.conversationHistory)}
`
    : ''
}

## 🛠️ 可用工具（已优化描述）

`;

    // 添加增强的工具描述
    for (const tool of availableTools) {
      const metadata = enhancedMetadata.get(tool.metadata.name) || tool.metadata;
      prompt += this.formatToolDescription(metadata);
    }

    // 添加推荐工具
    if (recommendations.length > 0) {
      prompt += `\n## ⭐ 推荐工具（基于历史表现）\n\n`;
      for (const rec of recommendations.slice(0, 3)) {
        prompt += `- **${rec.toolName}** (置信度：${(rec.confidence * 100).toFixed(0)}%)\n`;
        prompt += `  理由：${rec.reason}\n`;
        if (rec.expectedPerformance.successRate) {
          prompt += `  历史成功率：${(rec.expectedPerformance.successRate * 100).toFixed(0)}%\n`;
        }
      }
      prompt += '\n';
    }

    // 添加Few-shot示例
    prompt += `\n## 📚 工具选择示例\n\n`;
    for (const example of relevantExamples) {
      prompt += this.formatFewShotExample(example);
    }

    // 添加选择指南
    prompt += `
## 🎯 工具选择指南

### 选择原则
1. **精确匹配优先** - 选择专门为该任务设计的工具
2. **历史表现** - 优先选择历史成功率高的工具
3. **参数完整性** - 确保所需的参数都能从用户输入中获得
4. **错误恢复** - 考虑如果工具调用失败如何重试

### 决策流程
\`\`\`
用户需求分析
    ↓
识别操作类型和数据类型
    ↓
匹配候选工具（关键词+语义）
    ↓
评估工具适配度（功能+性能）
    ↓
检查参数可用性
    ↓
选择最优工具
\`\`\`

### 常见错误及避免方法
- ❌ 错误：选择通用工具而忽略专用工具
  ✅ 正确：优先选择专门工具（如PdfToMarkdownTool vs PdfParseTool）

- ❌ 错误：忽略工具的前置条件
  ✅ 正确：检查工具是否需要特殊环境或配置

- ❌ 错误：一次性尝试所有工具
  ✅ 正确：根据推理选择最合适的工具

## 💬 你的任务

请基于上述信息，为用户的请求选择最合适的工具：

**输出格式**：
\`\`\`
**需求分析**：[分析用户想要完成什么]
**候选工具**：[列出2-3个可能合适的工具]
**推荐工具**：[最终选择的工具]
**选择理由**：[为什么选择这个工具]
**工具参数**：[从用户输入中提取的参数]
**执行计划**：[如何使用工具完成任务]
\`\`\`
`;

    return prompt;
  }

  /**
   * 格式化工具描述
   */
  private formatToolDescription(metadata: unknown): string {
    let desc = `
### ${(metadata as any).name}

**描述**：${(metadata as any).description}
`;

    if ((metadata as any).commonUseCases && (metadata as any).commonUseCases.length > 0) {
      desc += `\n**常见用例**：\n`;
      (metadata as any).commonUseCases.forEach((useCase: string) => {
        desc += `- ${useCase}\n`;
      });
    }

    if ((metadata as any).capabilities && (metadata as any).capabilities.length > 0) {
      desc += `\n**能力**：${(metadata as any).capabilities.join('、')}`;
    }

    if ((metadata as any).examples && (metadata as any).examples.length > 0) {
      const example = (metadata as any).examples[0];
      desc += `\n**示例**：${example.description}`;
      if (example.scenario) {
        desc += ` (${example.scenario})`;
      }
    }

    return desc + '\n';
  }

  /**
   * 格式化Few-shot示例
   */
  private formatFewShotExample(example: unknown): string {
    return `
#### 示例：${(example as any).scenario}

**用户输入**：${(example as any).userInput}

**思考过程**：
${(example as any).reasoning}

**选择工具**：${(example as any).selectedTool}

**工具参数**：
\`\`\`json
${JSON.stringify((example as any).toolParameters, null, 2)}
\`\`\`

**结果**：${(example as any).outcome}

${(example as any).lessons ? `**经验**：${(example as any).lessons}` : ''}

---
`;
  }

  /**
   * 格式化对话历史
   */
  private formatConversationHistory(history: Array<{ role: string; content: string }>): string {
    return history.map((msg) => `- **${msg.role}**: ${msg.content}`).join('\n');
  }

  /**
   * 记录工具使用
   */
  recordToolUsage(
    toolName: string,
    userInput: string,
    toolParameters: Record<string, unknown>,
    result: {
      success: boolean;
      executionTime: number;
      output?: unknown;
      error?: string;
    },
    context?: {
      sessionId?: string;
      userId?: string;
      conversationHistory?: Array<{ role: string; content: string }>;
    }
  ): string {
    const record: ToolUsageRecord = {
      id: '',
      timestamp: new Date(),
      toolName,
      sessionId: context?.sessionId || 'default',
      userId: context?.userId,
      userInput,
      toolParameters,
      context: {
        conversationHistory: context?.conversationHistory,
      },
      result,
    };

    return toolUsageTracker.recordUsage(record);
  }

  /**
   * 获取性能报告
   */
  getPerformanceReport(): string {
    return toolUsageTracker.generatePerformanceReport();
  }

  /**
   * 分析选择准确性
   */
  analyzeSelectionAccuracy() {
    return toolUsageTracker.analyzeSelectionAccuracy();
  }

  /**
   * 生成工具描述文档
   */
  generateToolDocumentation(availableTools: EnhancedTool[]): string {
    const enhancedMetadata = this.descriptionEnhancer.enhanceTools(availableTools);
    return this.descriptionEnhancer.generateDocumentation(enhancedMetadata);
  }
}

// 导出单例
export const toolSelectionOptimizer = new ToolSelectionOptimizer();
