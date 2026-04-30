/**
 * Chain-of-Thought (CoT) 推理策略
 *
 * 基础版单路径逐步推理引擎
 *
 * 核心功能：
 * 1. 逐步推理 - 将复杂问题分解为多个推理步骤
 * 2. 步骤解析 - 解析 LLM 返回的推理过程
 * 3. 结论提取 - 从推理过程中提取最终答案
 * 4. 置信度评估 - 评估推理过程的质量
 * 5. 错误恢复 - 推理失败时自动重试
 *
 * @module reasoning/ChainOfThoughtStrategy
 */

import { LLMAdapter } from '../lifecycle/Lifecycle.js';

// ========== 类型定义 ==========

/**
 * 推理步骤
 */
export interface ReasoningStep {
  /** 步骤编号 */
  step: number;

  /** 步骤描述 */
  description: string;

  /** 推理内容 */
  reasoning: string;

  /** 中间结果（可选） */
  intermediateResult?: string;

  /** 置信度 (0-1) */
  confidence: number;
}

/**
 * CoT 推理结果
 */
export interface CoTResult {
  /** 推理步骤 */
  steps: ReasoningStep[];

  /** 最终结论 */
  conclusion: string;

  /** 总体置信度 (0-1) */
  confidence: number;

  /** 推理过程摘要 */
  summary: string;

  /** Token 消耗 */
  tokensUsed: number;

  /** 推理耗时（毫秒） */
  duration: number;
}

/**
 * CoT 配置
 */
export interface CoTConfig {
  /** 最大推理步骤数 */
  maxSteps: number;

  /** 是否启用中间验证 */
  enableIntermediateValidation: boolean;

  /** 是否要求步骤格式化 */
  requireStepFormatting: boolean;

  /** 失败时重试次数 */
  maxRetries: number;

  /** 温度参数（较低温度使推理更确定） */
  temperature: number;

  /** 是否启用详细日志 */
  verbose: boolean;
}

/**
 * 步骤格式类型
 */
export enum StepFormat {
  /** 编号格式：步骤1、步骤2 */
  NUMBERED = 'numbered',

  /** 列表格式：1. 2. 3. */
  LIST = 'list',

  /** 项目符号：• - * */
  BULLET = 'bullet',

  /** 自动检测 */
  AUTO = 'auto',
}

// ========== Chain-of-Thought 策略 ==========

/**
 * Chain-of-Thought 推理策略
 *
 * 让 LLM 逐步思考，展示完整的推理过程
 */
export class ChainOfThoughtStrategy {
  private llm: LLMAdapter;
  private config: CoTConfig;

  constructor(llm: LLMAdapter, config?: Partial<CoTConfig>) {
    this.llm = llm;
    this.config = {
      maxSteps: 10,
      enableIntermediateValidation: true,
      requireStepFormatting: true,
      maxRetries: 2,
      temperature: 0.3,
      verbose: false,
      ...config,
    };
  }

  /**
   * 执行逐步推理
   *
   * @param problem 需要推理的问题
   * @param context 上下文信息（可选）
   * @param format 步骤格式（可选）
   * @returns 推理结果
   */
  async reason(
    problem: string,
    context?: Record<string, any>,
    format?: StepFormat
  ): Promise<CoTResult> {
    const startTime = Date.now();
    let totalTokens = 0;

    if (this.config.verbose) {
      console.log(`\n🧠 [CoT] 开始推理: ${problem}`);
    }

    // 尝试推理（带重试）
    let lastError: Error | undefined;
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        if (attempt > 0 && this.config.verbose) {
          console.log(`\n🔄 [CoT] 重试第 ${attempt} 次...`);
        }

        // 生成推理过程
        const cotResponse = await this.generateCoT(problem, context, format);
        totalTokens += cotResponse.tokensUsed;

        // 解析推理步骤
        const steps = this.parseReasoningSteps(cotResponse.content, format);

        if (steps.length === 0) {
          throw new Error('未能解析出推理步骤');
        }

        if (this.config.verbose) {
          console.log(`\n✅ [CoT] 解析出 ${steps.length} 个推理步骤`);
          steps.forEach((step) => {
            console.log(
              `  步骤 ${step.step}: ${step.description.substring(0, 50)}...`
            );
          });
        }

        // 提取结论
        const conclusion = this.extractConclusion(cotResponse.content);

        if (!conclusion) {
          throw new Error('未能提取出最终结论');
        }

        if (this.config.verbose) {
          console.log(`\n📝 [CoT] 结论: ${conclusion.substring(0, 100)}...`);
        }

        // 计算置信度
        const confidence = this.calculateConfidence(steps, conclusion);

        // 生成摘要
        const summary = this.generateSummary(steps, conclusion);

        const duration = Date.now() - startTime;

        return {
          steps,
          conclusion,
          confidence,
          summary,
          tokensUsed: totalTokens,
          duration,
        };

      } catch (error) {
        lastError = error as Error;
        if (this.config.verbose) {
          console.error(`\n❌ [CoT] 推理失败: ${(error as Error).message}`);
        }

        // 最后一次尝试失败，抛出错误
        if (attempt === this.config.maxRetries) {
          break;
        }
      }
    }

    throw new Error(
      `Chain-of-Thought 推理失败: ${lastError?.message || '未知错误'}`
    );
  }

  /**
   * 生成 CoT 推理过程
   */
  private async generateCoT(
    problem: string,
    context?: Record<string, any>,
    format?: StepFormat
  ): Promise<{ content: string; tokensUsed: number }> {
    let prompt = this.buildCoTPrompt(problem, context, format);

    const response = await this.llm.chat({
      messages: [
        {
          role: 'system',
          content: this.getSystemPrompt(format),
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: this.config.temperature,
    });

    return {
      content: response.message.content,
      tokensUsed: response.usage?.totalTokens || 0,
    };
  }

  /**
   * 构建 CoT 提示词
   */
  private buildCoTPrompt(
    problem: string,
    context?: Record<string, any>,
    format?: StepFormat
  ): string {
    let prompt = `请通过逐步推理的方式解决以下问题，展示你的完整思考过程。\n\n`;

    prompt += `**问题**：${problem}\n\n`;

    if (context && Object.keys(context).length > 0) {
      prompt += `**上下文信息**：\n`;
      prompt += `\`\`\`\n${JSON.stringify(context, null, 2)}\n\`\`\`\n\n`;
    }

    prompt += `**要求**：\n`;
    prompt += `1. 将问题分解为多个清晰的推理步骤\n`;
    prompt += `2. 每个步骤都要有明确的推理依据\n`;
    prompt += `3. 展示中间计算或推理结果\n`;
    prompt += `4. 最后给出明确的结论\n\n`;

    if (format && format !== StepFormat.AUTO) {
      prompt += `**步骤格式**：${this.getStepFormatDescription(format)}\n\n`;
    }

    prompt += `请开始推理：`;

    return prompt;
  }

  /**
   * 获取系统提示词
   */
  private getSystemPrompt(format?: StepFormat): string {
    let systemPrompt = `你是一个逻辑推理专家，擅长通过逐步推理解决复杂问题。\n\n`;
    systemPrompt += `你的优势：\n`;
    systemPrompt += `- 逻辑严密，推理清晰\n`;
    systemPrompt += `- 善于分解复杂问题\n`;
    systemPrompt += `- 注重推理依据和证据\n`;
    systemPrompt += `- 结论明确，不含糊其辞\n\n`;

    systemPrompt += `**回答格式要求**：\n`;
    systemPrompt += `1. 使用清晰的步骤标记（如"步骤1"、"1."等）\n`;
    systemPrompt += `2. 每个步骤包含：推理内容 + 依据/证据\n`;
    systemPrompt += `3. 最后用"结论"或"答案"明确标出最终答案\n`;

    if (format && format !== StepFormat.AUTO) {
      systemPrompt += `\n**步骤格式示例**：\n`;
      systemPrompt += this.getStepFormatExample(format);
    }

    return systemPrompt;
  }

  /**
   * 获取步骤格式描述
   */
  private getStepFormatDescription(format: StepFormat): string {
    switch (format) {
      case StepFormat.NUMBERED:
        return '使用"步骤1"、"步骤2"格式';
      case StepFormat.LIST:
        return '使用"1."、"2."编号格式';
      case StepFormat.BULLET:
        return '使用项目符号"•"或"-"';
      default:
        return '自动选择合适的格式';
    }
  }

  /**
   * 获取步骤格式示例
   */
  private getStepFormatExample(format: StepFormat): string {
    switch (format) {
      case StepFormat.NUMBERED:
        return `步骤1：分析问题核心
步骤2：收集相关信息
步骤3：推理和计算
结论：最终答案`;

      case StepFormat.LIST:
        return `1. 分析问题核心
   推理内容...

2. 收集相关信息
   推理内容...

3. 推理和计算
   推理内容...

结论：最终答案`;

      case StepFormat.BULLET:
        return `• 分析问题核心
  推理内容...

• 收集相关信息
  推理内容...

• 推理和计算
  推理内容...

结论：最终答案`;

      default:
        return `步骤1：[推理内容]
步骤2：[推理内容]
...
结论：[最终答案]`;
    }
  }

  /**
   * 解析推理步骤
   */
  private parseReasoningSteps(
    content: string,
    _format?: StepFormat
  ): ReasoningStep[] {
    const steps: ReasoningStep[] = [];

    // 定义多种步骤匹配模式
    const patterns = [
      // "步骤1"、"步骤2"格式
      /(?:步骤|Step)[\s　]*([0-9]+)[\s　]*[:：\n]/gi,
      // "1."、"2."编号格式
      /^\s*(\d+)[\.\)]\s+/gm,
      // "(1)"、"(2)"格式
      /^\s*\((\d+)\)\s+/gm,
      // "一、"、"二、"中文数字格式
      /^\s*([一二三四五六七八九十]+)[　、]/gm,
      // 项目符号（作为单个步骤）
      /^\s*[-•*]\s+/gm,
    ];

    // 尝试所有模式
    for (const pattern of patterns) {
      const matches = Array.from(content.matchAll(pattern));

      if (matches.length > 0) {
        for (let i = 0; i < matches.length; i++) {
          const match = matches[i];
          const nextMatch = matches[i + 1];

          // 提取步骤内容
          const startIndex = match.index || 0;
          const endIndex = nextMatch ? nextMatch.index : content.length;
          const stepContent = content.substring(startIndex, endIndex).trim();

          // 提取步骤编号
          const stepNumber = i + 1;

          // 提取描述（第一行或前50个字符）
          const lines = stepContent.split('\n').filter((line) => line.trim());
          const description = lines[0]?.replace(/^[步骤\d\s\.\):：　\-•*]+/, '').trim() ||
                            stepContent.substring(0, 50);

          // 提取推理内容（去除标记后的内容）
          const reasoning = stepContent
            .replace(/^[步骤\d\s\.\):：　\-•*]+/, '')
            .trim();

          if (reasoning) {
            steps.push({
              step: stepNumber,
              description,
              reasoning,
              confidence: 0.8, // 默认置信度，后续可优化
            });
          }
        }

        // 如果成功解析到步骤，停止尝试其他模式
        if (steps.length > 0) {
          break;
        }
      }
    }

    // 如果没有匹配到任何模式，尝试按段落分割
    if (steps.length === 0) {
      const paragraphs = content
        .split(/\n\n+/)
        .filter((p) => p.trim() && p.length > 20); // 忽略太短的段落

      for (let i = 0; i < paragraphs.length; i++) {
        const paragraph = paragraphs[i].trim();
        if (!paragraph.toLowerCase().includes('结论') &&
            !paragraph.toLowerCase().includes('答案')) {
          steps.push({
            step: i + 1,
            description: paragraph.substring(0, 50),
            reasoning: paragraph,
            confidence: 0.7,
          });
        }
      }
    }

    // 限制最大步骤数
    return steps.slice(0, this.config.maxSteps);
  }

  /**
   * 提取结论
   */
  private extractConclusion(content: string): string {
    // 定义结论标记模式
    const conclusionPatterns = [
      /(?:结论|答案|最终|综上所述|总而言之|因此|所以)[\s　]*[:：]\s*([^\n]+)/i,
      /(?:结论|答案|最终)[\s　]*[:：]\s*([^]+?)(?=\n\n|$)/i,
    ];

    // 尝试匹配结论
    for (const pattern of conclusionPatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    // 如果没有明确的结论标记，尝试提取最后一段
    const paragraphs = content.split(/\n\n+/).filter((p) => p.trim());
    if (paragraphs.length > 0) {
      const lastParagraph = paragraphs[paragraphs.length - 1].trim();

      // 检查是否包含结论关键词
      const conclusionKeywords = ['结论', '答案', '最终', '因此', '所以'];
      const hasConclusionKeyword = conclusionKeywords.some((keyword) =>
        lastParagraph.includes(keyword)
      );

      if (hasConclusionKeyword) {
        return lastParagraph.replace(/^[^:：]+[:：]\s*/, '').trim();
      }

      // 如果没有明确的关键词，返回最后一段的前200个字符
      return lastParagraph.substring(0, 200);
    }

    return '';
  }

  /**
   * 计算置信度
   */
  private calculateConfidence(steps: ReasoningStep[], conclusion: string): number {
    let confidence = 0.0;

    // 因素1：步骤数量（3-7步为最佳）
    const stepCount = steps.length;
    if (stepCount >= 3 && stepCount <= 7) {
      confidence += 0.3;
    } else if (stepCount >= 1 && stepCount < 3) {
      confidence += 0.15;
    } else if (stepCount > 7) {
      confidence += 0.2;
    }

    // 因素2：步骤平均置信度
    const avgStepConfidence =
      steps.reduce((sum, step) => sum + step.confidence, 0) / stepCount;
    confidence += avgStepConfidence * 0.4;

    // 因素3：结论质量（长度适中）
    const conclusionLength = conclusion.length;
    if (conclusionLength >= 20 && conclusionLength <= 500) {
      confidence += 0.2;
    } else if (conclusionLength >= 10 && conclusionLength < 20) {
      confidence += 0.1;
    }

    // 因素4：推理连贯性（步骤描述不重复）
    const uniqueDescriptions = new Set(steps.map((s) => s.description));
    if (uniqueDescriptions.size === stepCount) {
      confidence += 0.1;
    }

    return Math.min(1.0, Math.max(0.0, confidence));
  }

  /**
   * 生成摘要
   */
  private generateSummary(steps: ReasoningStep[], conclusion: string): string {
    let summary = `推理过程（共 ${steps.length} 步）：\n`;

    for (const step of steps) {
      summary += `${step.step}. ${step.description}\n`;
    }

    summary += `\n结论：${conclusion}`;

    return summary;
  }

  /**
   * 流式推理（返回 AsyncIterable）
   *
   * @param problem 需要推理的问题
   * @param context 上下文信息（可选）
   * @returns 推理步骤生成器
   */
  async *reasonStream(
    problem: string,
    context?: Record<string, any>
  ): AsyncIterable<ReasoningStep | { conclusion: string; confidence: number }> {
    const result = await this.reason(problem, context);

    // 先返回所有步骤
    for (const step of result.steps) {
      yield step;
    }

    // 最后返回结论
    yield {
      conclusion: result.conclusion,
      confidence: result.confidence,
    };
  }

  /**
   * 批量推理
   *
   * @param problems 问题数组
   * @param context 共享上下文（可选）
   * @returns 推理结果数组
   */
  async reasonBatch(
    problems: string[],
    context?: Record<string, any>
  ): Promise<CoTResult[]> {
    const results: CoTResult[] = [];

    for (let i = 0; i < problems.length; i++) {
      if (this.config.verbose) {
        console.log(`\n📦 [CoT] 批量推理 ${i + 1}/${problems.length}`);
      }

      const result = await this.reason(problems[i], context);
      results.push(result);
    }

    return results;
  }
}

// ========== 辅助函数 ==========

/**
 * 创建 Chain-of-Thought 策略实例（便捷函数）
 *
 * @param llm LLM 适配器
 * @param config 配置（可选）
 * @returns CoT 策略实例
 */
export function createChainOfThought(
  llm: LLMAdapter,
  config?: Partial<CoTConfig>
): ChainOfThoughtStrategy {
  return new ChainOfThoughtStrategy(llm, config);
}
