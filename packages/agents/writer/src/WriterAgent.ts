import {
  Agent,
  AgentConfig,
  ExecutionContext,
  PromptOptimizer,
  IncrementalGenerator,
  SemanticCache,
  createSimpleSignatureGenerator,
  type TaskSignature,
  type CachedResponse,
} from '@yunpat/core';
import { z } from 'zod';

// Zod schema for outline validation
const OutlineSchema = z.array(z.string());

// 创建提示词优化器实例
const promptOptimizer = new PromptOptimizer();

/**
 * 创建写作任务的签名生成器
 */
const createWritingTaskSignature = createSimpleSignatureGenerator<WritingTask>((task) => {
  const features: string[] = [
    task.type,
    task.topic,
    task.format || 'markdown',
    ...(task.requirements || []),
  ];
  return features;
});

/**
 * 写作任务
 */
export interface WritingTask {
  /** 任务类型 */
  type: 'generate' | 'optimize' | 'convert' | 'format';

  /** 主题或内容 */
  topic: string;

  /** 目标格式 */
  format?: 'markdown' | 'html' | 'pdf';

  /** 额外要求 */
  requirements?: string[];

  /** 参考资料 */
  references?: string[];
}

/**
 * 写作计划
 */
export interface WritingPlan {
  /** 大纲 */
  outline: string[];

  /** 结构 */
  structure: {
    title: string;
    sections: Array<{
      heading: string;
      content: string;
      order: number;
    }>;
  };

  /** 语气和风格 */
  tone: 'formal' | 'casual' | 'technical' | 'academic';

  /** 目标长度 */
  targetLength: number;

  /** 是否使用增量生成 */
  incremental?: boolean;

  /** 历史版本内容（增量模式） */
  previousContent?: string;
}

/**
 * 写作结果
 */
export interface WritingResult {
  /** 生成的文档 */
  document: {
    title: string;
    content: string;
    format: string;
  };

  /** 统计信息 */
  stats: {
    wordCount: number;
    paragraphCount: number;
    sectionCount: number;
  };

  /** 元数据 */
  metadata: {
    generatedAt: Date;
    tone: string;
    revision: number;
  };
}

/**
 * 技术写作助手智能体
 *
 * 专门用于技术文档的生成和优化
 */
export class WriterAgent extends Agent<WritingTask, WritingResult> {
  /** 语义缓存实例 */
  private semanticCache: SemanticCache<WritingTask, WritingResult>;
  /** 缓存的响应（用于在 act 阶段返回） */
  private cachedResult: WritingResult | null = null;
  /** 当前任务（用于缓存存储） */
  private currentTask: WritingTask | null = null;

  constructor(config: Omit<AgentConfig, 'name' | 'description'>) {
    super({
      ...config,
      name: 'writer',
      description: '技术写作助手 - 文档生成、格式转换、内容优化',
    });

    // 初始化语义缓存
    this.semanticCache = new SemanticCache({
      similarityThreshold: 0.85,
      maxCacheSize: 1000,
      cacheExpiration: 7 * 24 * 60 * 60 * 1000, // 7 天
      generateSignature: createWritingTaskSignature,
    });
  }

  /**
   * 规划阶段 - 生成写作大纲和结构
   */
  protected async plan(task: WritingTask, context: ExecutionContext): Promise<WritingPlan> {
    // 保存当前任务（用于后续缓存存储）
    this.currentTask = task;

    // ========== 语义缓存检查 ==========
    console.log('[语义缓存] 查找相似任务...');
    const cachedResponse = await this.semanticCache.findSimilar(task);

    if (cachedResponse) {
      console.log(`[语义缓存] ✅ 命中！相似度 ${(cachedResponse.signature.embedding[0] * 100).toFixed(1)}%`);
      console.log(`[语义缓存] 跳过生成，直接返回缓存结果`);

      // 保存缓存结果
      this.cachedResult = cachedResponse.response;

      // 从缓存的响应中提取计划
      const cachedPlan: WritingPlan = {
        outline: [], // 将从缓存内容中提取
        structure: {
          title: cachedResponse.response.document.title,
          sections: [], // 将从缓存内容中提取
        },
        tone: cachedResponse.response.metadata.tone as WritingPlan['tone'],
        targetLength: cachedResponse.response.stats.wordCount,
        incremental: false,
      };

      // 提取大纲
      cachedPlan.outline = this.extractOutlineFromContent(cachedResponse.response.document.content);

      // 构建结构
      cachedPlan.structure.sections = cachedPlan.outline.map((heading, index) => ({
        heading,
        content: '', // 内容将在 act 阶段从缓存获取
        order: index,
      }));

      return cachedPlan;
    }

    console.log('[语义缓存] ❌ 未命中，继续生成...');

    // 检查是否有历史版本（增量生成优化）
    const taskKey = `writer:${task.type}:${task.topic}`;
    const previousContent = await context.memory.get(taskKey);
    const incrementalGenerator = new IncrementalGenerator(context.llm);

    let outline: string[] | null = null;
    let lastError: Error | null = null;
    const maxRetries = 2; // 最多重试 2 次

    // 如果有历史版本，尝试增量生成
    if (previousContent && task.type !== 'generate') {
      console.log('[增量生成] 检测到历史版本，分析差异...');

      try {
        // 分析差异
        const diff = await incrementalGenerator.diff(
          previousContent,
          `任务类型: ${task.type}\n主题: ${task.topic}\n要求: ${task.requirements?.join(', ') || '无'}`
        );

        console.log(`[增量生成] 差异分析完成: ${diff.summary}`);
        console.log(`[增量生成] 预估节省: ${Math.round(diff.estimatedSavings * 100)}%`);

        // 如果有实质性差异，使用增量模式
        if (diff.changes.length > 0 && diff.estimatedSavings > 0.2) {
          // 确定语气
          const tone = this.determineTone(task);

          // 估算长度
          const targetLength = this.estimateLength(task);

          // 从历史内容中提取大纲（简化版）
          const outline = this.extractOutlineFromContent(previousContent);

          return {
            outline,
            structure: {
              title: task.topic,
              sections: outline.map((heading, index) => ({
                heading,
                content: '',
                order: index,
              })),
            },
            tone,
            targetLength,
            incremental: true,
            previousContent,
          };
        }
      } catch (error) {
        console.warn('[增量生成] 差异分析失败，回退到完整生成:', error);
        // 继续使用完整生成
      }
    }

    // 完整生成模式
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const outlinePrompt = this.buildOutlinePrompt(task);

        // 如果是重试，添加更严格的格式提示
        const finalPrompt =
          attempt > 0
            ? outlinePrompt +
              `\n\n**重要：这是第 ${attempt + 1} 次尝试，请确保严格遵循 JSON 格式！**`
            : outlinePrompt;

        const outlineResponse = await context.llm.chat({
          messages: [
            {
              role: 'system',
              content: '你是一个技术写作专家，擅长创建清晰、结构化的文档大纲。',
            },
            {
              role: 'user',
              content: finalPrompt,
            },
          ],
          temperature: 0.7,
        });

        // 尝试解析大纲
        outline = this.parseOutline(outlineResponse.message.content);

        // 如果成功，跳出循环
        break;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < maxRetries) {
          // 继续重试
          console.warn(`大纲解析失败，正在重试 (${attempt + 1}/${maxRetries})...`, lastError.message);
        } else {
          // 最后一次尝试也失败了
          console.error('大纲解析失败，已达到最大重试次数', lastError);
          throw lastError;
        }
      }
    }

    // 如果所有重试都失败，抛出异常
    if (!outline) {
      throw new Error(
        `无法生成大纲: ${lastError?.message || '未知错误'}`
      );
    }

    // 确定语气
    const tone = this.determineTone(task);

    // 估算长度
    const targetLength = this.estimateLength(task);

    return {
      outline,
      structure: {
        title: task.topic,
        sections: outline.map((heading, index) => ({
          heading,
          content: '',
          order: index,
        })),
      },
      tone,
      targetLength,
      incremental: false,
    };
  }

  /**
   * 执行阶段 - 根据计划生成文档（支持增量生成）
   */
  protected async act(plan: WritingPlan, context: ExecutionContext): Promise<WritingResult> {
    // ========== 语义缓存检查 ==========
    // 如果 plan 阶段命中了缓存，直接返回缓存结果
    if (this.cachedResult) {
      console.log('[语义缓存] 返回缓存结果，跳过生成');
      const result = this.cachedResult;
      this.cachedResult = null; // 清空缓存引用
      return result;
    }

    // 增量模式：基于历史内容更新
    if (plan.incremental && plan.previousContent) {
      console.log('[增量生成] 使用增量模式生成内容（并行）...');

      // 根据任务类型应用不同的增量策略（并行执行）
      const sectionUpdatePromises = plan.structure.sections.map(async (section) => {
        if (!section.content) {
          // 生成新章节或更新现有章节
          const sectionPrompt = this.buildSectionPrompt(section.heading, plan, context);

          const response = await context.llm.chat({
            messages: [
              {
                role: 'system',
                content: `你是一个技术写作专家。语气：${plan.tone}。`,
              },
              {
                role: 'user',
                content: sectionPrompt,
              },
            ],
            temperature: 0.7,
          });

          return {
            section,
            content: response.message.content,
          };
        }
        return { section, content: section.content };
      });

      // 等待所有章节更新完成（并行执行）
      const sectionUpdates = await Promise.all(sectionUpdatePromises);

      // 更新章节内容
      sectionUpdates.forEach(({ section, content }) => {
        if (content) {
          section.content = content;
        }
      });

      // 组装内容
      let fullContent = '';
      let totalWords = 0;

      for (const section of plan.structure.sections) {
        fullContent += `## ${section.heading}\n\n${section.content}\n\n`;
        totalWords += section.content.split(/\s+/).length;
      }

      // 格式化输出
      const formattedContent = this.formatContent(fullContent, plan);

      const result = {
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
          revision: 2, // 增量生成的版本号
        },
      };

      // 存储到语义缓存
      if (this.currentTask) {
        await this.semanticCache.store(this.currentTask, result);
        console.log('[语义缓存] ✅ 已存储增量生成结果');
      }

      return result;
    }

    // 完整生成模式（原始逻辑）
    // 并发生成所有章节内容
    const sectionPromises = plan.structure.sections.map(async (section) => {
      const sectionPrompt = this.buildSectionPrompt(section.heading, plan, context);

      const response = await context.llm.chat({
        messages: [
          {
            role: 'system',
            content: `你是一个技术写作专家。语气：${plan.tone}。`,
          },
          {
            role: 'user',
            content: sectionPrompt,
          },
        ],
        temperature: 0.7,
      });

      return {
        section,
        content: response.message.content,
        wordCount: response.message.content.split(/\s+/).length,
      };
    });

    // 等待所有章节完成（并行执行）
    const results = await Promise.all(sectionPromises);

    // 按原始顺序组装内容
    let fullContent = '';
    let totalWords = 0;

    results.forEach(({ section, content, wordCount }) => {
      section.content = content;
      fullContent += `## ${section.heading}\n\n${content}\n\n`;
      totalWords += wordCount;
    });

    // 格式化输出
    const formattedContent = this.formatContent(fullContent, plan);

    const result = {
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
      },
    };

    // 存储到语义缓存
    if (this.currentTask) {
      await this.semanticCache.store(this.currentTask, result);
      console.log('[语义缓存] ✅ 已存储完整生成结果');
    }

    return result;
  }

  /**
   * 反思阶段 - 评估文档质量
   */
  protected async reflect(
    result: WritingResult,
    _context: ExecutionContext
  ): Promise<{ shouldContinue: boolean; feedback?: string }> {
    // 输出缓存统计
    const cacheStats = this.semanticCache.getStats();
    console.log('[语义缓存] 统计信息:');
    console.log(`  - 命中率: ${cacheStats.hitRate}%`);
    console.log(`  - 总请求数: ${cacheStats.totalRequests}`);
    console.log(`  - 缓存命中: ${cacheStats.cacheHits}`);
    console.log(`  - 缓存未命中: ${cacheStats.cacheMisses}`);
    console.log(`  - 当前缓存大小: ${cacheStats.size}`);
    console.log(`  - 平均相似度: ${cacheStats.averageSimilarity}`);

    // 检查是否满足要求
    const qualityChecks = [
      result.stats.wordCount > 100, // 至少 100 词
      result.stats.sectionCount > 1, // 至少 2 个章节
      result.document.content.includes('#'), // 包含标题
    ];

    const passed = qualityChecks.every((check) => check);

    if (!passed) {
      return {
        shouldContinue: false,
        feedback: '文档质量检查未通过，但已生成基本内容',
      };
    }

    return {
      shouldContinue: false,
      feedback: '文档生成成功',
    };
  }

  /**
   * 构建大纲生成提示（使用 PromptOptimizer 优化）
   */
  private buildOutlinePrompt(task: WritingTask): string {
    // 使用 PromptOptimizer 优化提示词
    const optimized = promptOptimizer.optimize(
      {
        task: '创建技术文档大纲',
        topic: task.topic,
        format: 'JSON 数组',
        requirements: task.requirements || [],
        constraints: [
          '必须是有效的 JSON 数组格式',
          '每个元素都是字符串类型的章节标题',
          '可以使用 markdown 代码块包裹（可选）',
          '也可以直接返回 JSON 数组（不使用代码块）',
          '只返回 JSON 数组，不要包含其他说明文字',
        ],
      },
      // 添加少样本示例
      [
        {
          input: 'AI 智能体框架',
          output: '["引言", "架构设计", "核心组件", "应用场景", "总结"]',
        },
      ]
    );

    // 添加参考资料（如果有）
    let finalPrompt = optimized;
    if (task.references && task.references.length > 0) {
      finalPrompt += `\n\n参考资料:\n${task.references.map((r) => `- ${r}`).join('\n')}`;
    }

    return finalPrompt;
  }

  /**
   * 解析大纲 - 使用 zod 验证，支持多种 JSON 格式
   * @throws {Error} 当无法提取或验证 JSON 时抛出异常
   */
  private parseOutline(content: string): string[] {
    // 尝试多种方式提取 JSON
    let jsonMatch: RegExpMatchArray | null = null;

    // 方式1: 尝试提取 markdown 代码块中的 JSON (```json ... ``` 或 ``` ... ```)
    jsonMatch = content.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);

    // 方式2: 如果没找到代码块，尝试直接提取 JSON 数组
    if (!jsonMatch) {
      jsonMatch = content.match(/\[[\s\S]*\]/);
    }

    // 如果都没找到，抛出异常
    if (!jsonMatch) {
      throw new Error('无法从 LLM 响应中提取大纲 JSON');
    }

    try {
      // 解析 JSON
      const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);

      // 使用 zod schema 验证
      const validatedOutline = OutlineSchema.parse(parsed);

      return validatedOutline;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`大纲解析失败: ${error.message}`);
      }
      throw new Error(`大纲解析失败: 未知错误`);
    }
  }

  /**
   * 确定语气
   */
  private determineTone(task: WritingTask): WritingPlan['tone'] {
    // 根据主题和要求确定语气
    if (task.requirements?.includes('学术')) {
      return 'academic';
    }
    if (task.requirements?.includes('正式')) {
      return 'formal';
    }
    if (task.requirements?.includes('轻松')) {
      return 'casual';
    }
    return 'technical'; // 默认技术语气
  }

  /**
   * 估算长度
   */
  private estimateLength(task: WritingTask): number {
    // 根据类型估算
    switch (task.type) {
      case 'generate':
        return 1000;
      case 'optimize':
        return 500;
      case 'convert':
        return 0; // 转换不改变长度
      case 'format':
        return 0; // 格式化不改变长度
      default:
        return 500;
    }
  }

  /**
   * 构建章节生成提示（使用 PromptOptimizer 优化）
   */
  private buildSectionPrompt(
    heading: string,
    plan: WritingPlan,
    _context: ExecutionContext
  ): string {
    // 使用 PromptOptimizer 优化提示词
    const optimized = promptOptimizer.optimize({
      task: `撰写文档章节内容`,
      topic: `文档"${plan.structure.title}"的章节"${heading}"`,
      format: 'Markdown',
      requirements: [
        `语气：${plan.tone}`,
        `目标长度：约${Math.round(plan.targetLength / plan.structure.sections.length)}词`,
        '内容详细、准确',
      ],
    });

    return optimized;
  }

  /**
   * 格式化内容
   */
  private formatContent(content: string, plan: WritingPlan): string {
    let formatted = `# ${plan.structure.title}\n\n`;
    formatted += content;
    return formatted;
  }

  /**
   * 从内容中提取大纲（用于增量生成）
   */
  private extractOutlineFromContent(content: string): string[] {
    // 使用正则表达式提取所有二级标题
    const headingRegex = /^##\s+(.+)$/gm;
    const matches = content.match(headingRegex);

    if (matches) {
      return matches.map((match) => match.replace(/^##\s+/, ''));
    }

    // 如果没有找到标题，返回默认大纲
    return ['引言', '主要内容', '总结'];
  }
}
