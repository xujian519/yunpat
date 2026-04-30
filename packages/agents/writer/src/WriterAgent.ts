import {
  Agent,
  AgentConfig,
  ExecutionContext,
  IncrementalGenerator,
  SemanticCache,
  createSimpleSignatureGenerator,
  type EnhancedTool,
  type CachedResponse,
} from '@yunpat/core';
import { z } from 'zod';

// Zod schema for outline validation
const OutlineSchema = z.array(z.string());

/**
 * 语义缓存配置常量
 */
const CACHE_CONFIG = {
  SIMILARITY_THRESHOLD: 0.85,
  MAX_CACHE_SIZE: 1000,
  CACHE_EXPIRATION_MS: 7 * 24 * 60 * 60 * 1000, // 7 天
} as const;

/**
 * 生成配置常量
 */
const GENERATION_CONFIG = {
  DEFAULT_TEMPERATURE: 0.7,
  MAX_OUTLINE_RETRIES: 2,
  DEFAULT_DOCUMENT_LENGTH: 1000,
  OPTIMIZE_DOCUMENT_LENGTH: 500,
} as const;

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

  /** 选定的工具（增强功能） */
  selectedTool?: string;
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

  /** 工具使用统计（增强功能） */
  toolUsageStats?: {
    totalSelections: number;
    successfulExecutions: number;
    failedExecutions: number;
  };
}

/**
 * WriterAgent 配置
 */
export interface WriterAgentConfig {
  /** 基础配置 */
  eventBus: AgentConfig['eventBus'];
  memory: AgentConfig['memory'];
  tools: AgentConfig['tools'];
  llm: AgentConfig['llm'];
  maxIterations?: number;
  timeout?: number;

  /** 是否启用工具能力（默认 false） */
  enableTools?: boolean;

  /** 可选的增强工具列表 */
  enhancedTools?: EnhancedTool[];
}

/**
 * 技术写作助手智能体（统一版）
 *
 * 基础功能：
 * - 文档生成、格式转换、内容优化
 * - 语义缓存（复用相似任务结果）
 * - 增量生成（基于历史版本只修改变更部分）
 *
 * 增强功能（可选）：
 * - 智能工具选择
 * - 工具使用统计
 */
export class WriterAgent extends Agent<WritingTask, WritingResult> {
  /** 语义缓存实例 */
  private semanticCache: SemanticCache<WritingTask, WritingResult>;

  /** 缓存的响应（用于在 act 阶段返回） */
  private cachedResult: WritingResult | null = null;

  /** 当前任务（用于缓存存储） */
  private currentTask: WritingTask | null = null;

  /** 是否启用工具能力 */
  private enableTools: boolean;

  /** 可用工具列表 */
  private availableTools: EnhancedTool[] = [];

  /** 工具使用统计 */
  private toolUsageStats = {
    totalSelections: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
  };

  constructor(config: WriterAgentConfig) {
    super({
      name: 'writer',
      description: config.enableTools
        ? '技术写作助手（增强版）- 文档生成、格式转换、内容优化、智能工具调用'
        : '技术写作助手 - 文档生成、格式转换、内容优化',
      eventBus: config.eventBus,
      memory: config.memory,
      tools: config.tools,
      llm: config.llm,
      maxIterations: config.maxIterations,
      timeout: config.timeout,
    });

    this.enableTools = config.enableTools ?? false;
    if (config.enhancedTools) {
      this.availableTools = config.enhancedTools;
    }

    if (this.enableTools) {
      console.log('🚀 写作助手已启用工具增强功能');
    }

    this.semanticCache = new SemanticCache({
      similarityThreshold: CACHE_CONFIG.SIMILARITY_THRESHOLD,
      maxCacheSize: CACHE_CONFIG.MAX_CACHE_SIZE,
      cacheExpiration: CACHE_CONFIG.CACHE_EXPIRATION_MS,
      generateSignature: createWritingTaskSignature,
    });
  }

  /**
   * 清理资源
   */
  private cleanup() {
    this.cachedResult = null;
    this.currentTask = null;
  }

  /**
   * 注册可用工具（增强功能）
   */
  registerTools(tools: EnhancedTool[]) {
    this.availableTools = tools;
    this.enableTools = true;
    console.log(`🔧 已注册 ${tools.length} 个工具`);
    tools.forEach((tool) => {
      console.log(`   - ${tool.metadata.name}: ${tool.metadata.description}`);
    });
  }

  /**
   * 获取工具使用统计（增强功能）
   */
  getToolUsageStats() {
    return {
      ...this.toolUsageStats,
      successRate:
        this.toolUsageStats.totalSelections > 0
          ? this.toolUsageStats.successfulExecutions / this.toolUsageStats.totalSelections
          : 0,
    };
  }

  /**
   * 重置工具使用统计（增强功能）
   */
  resetToolUsageStats() {
    this.toolUsageStats = {
      totalSelections: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
    };
  }

  /**
   * 规划阶段 - 生成写作大纲和结构
   */
  protected async plan(task: WritingTask, context: ExecutionContext): Promise<WritingPlan> {
    this.currentTask = task;

    try {
      // 语义缓存检查
      console.log('[语义缓存] 查找相似任务...');
      const cachedData = await this.semanticCache.findSimilar(task);

      if (cachedData) {
        // 修复：正确获取相似度（假设 findSimilar 返回相似度）
        const similarity = this.extractSimilarity(cachedData);
        console.log(`[语义缓存] ✅ 命中！相似度 ${(similarity * 100).toFixed(1)}%`);
        console.log(`[语义缓存] 跳过生成，直接返回缓存结果`);

        this.cachedResult = cachedData.response;

        const cachedPlan: WritingPlan = {
          outline: this.extractOutlineFromContent(cachedData.response.document.content),
          structure: {
            title: cachedData.response.document.title,
            sections: this.extractSectionsFromContent(cachedData.response.document.content),
          },
          tone: this.validateAndCastTone(cachedData.response.metadata.tone),
          targetLength: cachedData.response.stats.wordCount,
          incremental: false,
        };

        return cachedPlan;
      }

      console.log('[语义缓存] ❌ 未命中，继续生成...');

      // 增强功能：工具选择
      let selectedTool: string | undefined;

      if (this.enableTools && this.availableTools.length > 0) {
        console.log('\n🧠 [增强模式] 选择合适的工具...');
        selectedTool = await this.selectToolForTask(task, context);
        if (selectedTool) {
          console.log(`✅ 选择的工具: ${selectedTool}`);
          this.toolUsageStats.totalSelections++;
        }
      }

      // 增量生成检查
      const incrementalPlan = await this.tryIncrementalGeneration(task, context);
      if (incrementalPlan) {
        return { ...incrementalPlan, selectedTool };
      }

      // 完整生成模式
      const outline = await this.generateOutline(task, context);
      const tone = this.determineTone(task);
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
        selectedTool,
      };
    } catch (error) {
      // 清理资源
      this.cleanup();
      throw error;
    }
  }

  /**
   * 执行阶段 - 根据计划生成文档
   */
  protected async act(plan: WritingPlan, context: ExecutionContext): Promise<WritingResult> {
    try {
      // 语义缓存检查
      if (this.cachedResult) {
        console.log('[语义缓存] 返回缓存结果，跳过生成');
        const result = this.cachedResult;
        this.cleanup();
        return result;
      }

      // 增强功能：使用选定工具
      if (plan.selectedTool && this.enableTools) {
        const result = await this.generateWithTool(plan, context);
        if (result) {
          return result;
        }
      }

      // 基础功能：内容生成
      console.log('📝 使用标准写作流程...');
      return await this.generateContent(plan, context);
    } finally {
      // 确保清理资源
      this.cleanup();
    }
  }

  /**
   * 反思阶段 - 评估文档质量
   */
  protected async reflect(
    result: WritingResult,
    context: ExecutionContext
  ): Promise<{ shouldContinue: boolean; feedback?: string }> {
    // 增强功能：工具使用统计
    if (this.enableTools) {
      console.log('\n🔍 [增强模式] 工具使用统计:');
      console.log(`  总选择次数: ${this.toolUsageStats.totalSelections}`);
      console.log(`  成功执行次数: ${this.toolUsageStats.successfulExecutions}`);
      console.log(`  失败执行次数: ${this.toolUsageStats.failedExecutions}`);

      if (result.toolUsageStats) {
        result.toolUsageStats = { ...this.toolUsageStats };
      }
    }

    // 基础功能：质量检查
    const cacheStats = this.semanticCache.getStats();
    console.log('[语义缓存] 统计信息:');
    console.log(`  - 命中率: ${cacheStats.hitRate}%`);
    console.log(`  - 总请求数: ${cacheStats.totalRequests}`);
    console.log(`  - 缓存大小: ${cacheStats.size}`);

    const qualityChecks = [
      result.stats.wordCount > 100,
      result.stats.sectionCount > 1,
      result.document.content.includes('#'),
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
   * 选择合适的工具
   */
  private async selectToolForTask(
    task: WritingTask,
    _context: ExecutionContext
  ): Promise<string | undefined> {
    // 简单的工具选择逻辑：根据任务类型选择
    for (const tool of this.availableTools) {
      const category = tool.metadata.category || '';

      // 任务类型与工具类别匹配
      if (
        (task.type === 'convert' && category.includes('convert')) ||
        (task.type === 'format' && category.includes('format')) ||
        (task.type === 'optimize' && category.includes('optimize'))
      ) {
        return tool.metadata.name;
      }
    }

    // 如果没有匹配的工具，返回 undefined
    return undefined;
  }

  /**
   * 使用工具生成内容
   */
  private async generateWithTool(
    plan: WritingPlan,
    _context: ExecutionContext
  ): Promise<WritingResult | undefined> {
    if (!plan.selectedTool) {
      return undefined;
    }

    const tool = this.availableTools.find((t) => t.metadata.name === plan.selectedTool);
    if (!tool) {
      console.warn(`工具 ${plan.selectedTool} 未找到`);
      return undefined;
    }

    console.log(`🔧 执行工具: ${plan.selectedTool}`);

    try {
      const startTime = Date.now();
      // EnhancedTool.execute 需要两个参数：input 和 context
      const toolResult = await tool.execute(
        {
          action: 'generate',
          plan: plan,
          timestamp: Date.now(),
        } as any,
        {} as any // ToolContext - 使用空对象作为上下文
      );

      this.toolUsageStats.successfulExecutions++;
      console.log(`✅ 工具执行成功，耗时: ${Date.now() - startTime}ms`);

      // 如果工具返回了内容，使用它；否则继续标准流程
      if (toolResult && typeof toolResult === 'object' && 'content' in toolResult) {
        return {
          document: {
            title: plan.structure.title,
            content: toolResult.content as string,
            format: 'markdown',
          },
          stats: {
            wordCount: (toolResult.content as string).split(/\s+/).length,
            paragraphCount: plan.structure.sections.length,
            sectionCount: plan.structure.sections.length,
          },
          metadata: {
            generatedAt: new Date(),
            tone: plan.tone,
            revision: 1,
          },
          toolUsageStats: { ...this.toolUsageStats },
        };
      }

      return undefined;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.toolUsageStats.failedExecutions++;
      console.error(`❌ 工具执行失败: ${errorMsg}`);
      return undefined;
    }
  }

  /**
   * 尝试增量生成
   */
  private async tryIncrementalGeneration(
    task: WritingTask,
    _context: ExecutionContext
  ): Promise<WritingPlan | null> {
    if (task.type === 'generate') {
      return null;
    }

    const taskKey = `writer:${task.type}:${task.topic}`;
    const previousContent = await _context.memory.get(taskKey);

    if (!previousContent) {
      return null;
    }

    console.log('[增量生成] 检测到历史版本，分析差异...');

    try {
      const incrementalGenerator = new IncrementalGenerator(_context.llm);
      const diff = await incrementalGenerator.diff(
        previousContent as string,
        `任务类型: ${task.type}\n主题: ${task.topic}`
      );

      console.log(`[增量生成] 差异分析完成`);

      if (diff.changes && diff.changes.length > 0) {
        const outline = this.extractOutlineFromContent(previousContent as string);
        const tone = this.determineTone(task);
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
          incremental: true,
          previousContent: previousContent as string,
        };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.warn(`[增量生成] 差异分析失败: ${errorMsg}，回退到完整生成`);
    }

    return null;
  }

  /**
   * 生成内容
   */
  private async generateContent(
    plan: WritingPlan,
    context: ExecutionContext
  ): Promise<WritingResult> {
    const sectionPromises = plan.structure.sections.map(async (section) => {
      const sectionPrompt = this.buildSectionPrompt(section.heading, plan);

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
        temperature: GENERATION_CONFIG.DEFAULT_TEMPERATURE,
      });

      return {
        section,
        content: response.message.content,
        wordCount: response.message.content.split(/\s+/).length,
      };
    });

    const results = await Promise.all(sectionPromises);

    let fullContent = '';
    let totalWords = 0;

    results.forEach(({ section, content, wordCount }) => {
      section.content = content;
      fullContent += `## ${section.heading}\n\n${content}\n\n`;
      totalWords += wordCount;
    });

    const formattedContent = this.formatContent(fullContent, plan);

    const result: WritingResult = {
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
        revision: plan.incremental ? 2 : 1,
      },
    };

    if (this.enableTools) {
      result.toolUsageStats = { ...this.toolUsageStats };
    }

    // 存储到语义缓存
    if (this.currentTask) {
      await this.semanticCache.store(this.currentTask, result);
      console.log('[语义缓存] ✅ 已存储生成结果');
    }

    return result;
  }

  /**
   * 生成大纲
   */
  private async generateOutline(task: WritingTask, context: ExecutionContext): Promise<string[]> {
    for (let attempt = 0; attempt <= GENERATION_CONFIG.MAX_OUTLINE_RETRIES; attempt++) {
      try {
        const outlinePrompt = this.buildOutlinePrompt(task);

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
          temperature: GENERATION_CONFIG.DEFAULT_TEMPERATURE,
        });

        return this.parseOutline(outlineResponse.message.content);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);

        if (attempt < GENERATION_CONFIG.MAX_OUTLINE_RETRIES) {
          console.warn(
            `大纲解析失败，正在重试 (${attempt + 1}/${GENERATION_CONFIG.MAX_OUTLINE_RETRIES}): ${errorMsg}`
          );
          continue;
        }

        throw new Error(`无法生成大纲: ${errorMsg}`);
      }
    }

    throw new Error('无法生成大纲');
  }

  /**
   * 构建大纲生成提示
   */
  private buildOutlinePrompt(task: WritingTask): string {
    let prompt = `请为以下主题创建一个结构化的技术文档大纲：

主题：${task.topic}
任务类型：${task.type}

要求：
- 返回 JSON 数组格式
- 每个元素都是字符串类型的章节标题
- 包含 5-8 个主要章节
- 章节按逻辑顺序排列

示例格式：
["引言", "架构设计", "核心组件", "应用场景", "总结"]

请直接返回 JSON 数组，不要包含其他说明文字。`;

    if (task.requirements && task.requirements.length > 0) {
      prompt += `\n\n特殊要求：\n${task.requirements.map((r) => `- ${r}`).join('\n')}`;
    }

    if (task.references && task.references.length > 0) {
      prompt += `\n\n参考资料：\n${task.references.map((r) => `- ${r}`).join('\n')}`;
    }

    return prompt;
  }

  /**
   * 解析大纲
   */
  private parseOutline(content: string): string[] {
    let jsonMatch: RegExpMatchArray | null = null;

    // 尝试提取 markdown 代码块中的 JSON
    jsonMatch = content.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);

    // 如果没找到代码块，尝试直接提取 JSON 数组
    if (!jsonMatch) {
      jsonMatch = content.match(/\[[\s\S]*\]/);
    }

    if (!jsonMatch) {
      throw new Error('无法从 LLM 响应中提取大纲 JSON');
    }

    try {
      const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      return OutlineSchema.parse(parsed);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`大纲解析失败: ${error.message}`);
      }
      throw new Error('大纲解析失败: 未知错误');
    }
  }

  /**
   * 确定语气
   */
  private determineTone(task: WritingTask): WritingPlan['tone'] {
    if (task.requirements?.includes('学术')) {
      return 'academic';
    }
    if (task.requirements?.includes('正式')) {
      return 'formal';
    }
    if (task.requirements?.includes('轻松')) {
      return 'casual';
    }
    return 'technical';
  }

  /**
   * 估算长度
   */
  private estimateLength(task: WritingTask): number {
    switch (task.type) {
      case 'generate':
        return GENERATION_CONFIG.DEFAULT_DOCUMENT_LENGTH;
      case 'optimize':
        return GENERATION_CONFIG.OPTIMIZE_DOCUMENT_LENGTH;
      case 'convert':
      case 'format':
        return 0;
      default:
        return GENERATION_CONFIG.OPTIMIZE_DOCUMENT_LENGTH;
    }
  }

  /**
   * 构建章节生成提示
   */
  private buildSectionPrompt(heading: string, plan: WritingPlan): string {
    const targetLength = Math.round(plan.targetLength / plan.structure.sections.length);

    return `请为文档"${plan.structure.title}"撰写以下章节：

章节标题：${heading}
语气：${plan.tone}
目标长度：约${targetLength}词

要求：
- 内容详细、准确
- 符合技术文档规范
- 使用 Markdown 格式

请直接输出章节内容，不要包含章节标题。`;
  }

  /**
   * 格式化内容
   */
  private formatContent(content: string, plan: WritingPlan): string {
    return `# ${plan.structure.title}\n\n${content}`;
  }

  /**
   * 从内容中提取大纲
   */
  private extractOutlineFromContent(content: string): string[] {
    const headingRegex = /^##\s+(.+)$/gm;
    const matches = content.match(headingRegex);

    if (matches) {
      return matches.map((match) => match.replace(/^##\s+/, ''));
    }

    return ['引言', '主要内容', '总结'];
  }

  /**
   * 从内容中提取章节结构
   */
  private extractSectionsFromContent(content: string): Array<{
    heading: string;
    content: string;
    order: number;
  }> {
    const headingRegex = /^##\s+(.+)$/gm;
    const matches = content.match(headingRegex);

    if (matches) {
      return matches.map((match, index) => ({
        heading: match.replace(/^##\s+/, ''),
        content: '',
        order: index,
      }));
    }

    return [
      { heading: '引言', content: '', order: 0 },
      { heading: '主要内容', content: '', order: 1 },
      { heading: '总结', content: '', order: 2 },
    ];
  }

  /**
   * 提取相似度分数
   */
  private extractSimilarity(cachedData: CachedResponse<WritingTask, WritingResult>): number {
    // 尝试从签名中获取相似度
    if (cachedData.signature && 'similarity' in cachedData.signature) {
      return (cachedData.signature as any).similarity as number;
    }

    // 如果没有存储相似度，使用第一个嵌入值（这不太准确，但作为后备方案）
    if (cachedData.signature.embedding && cachedData.signature.embedding[0]) {
      const value = cachedData.signature.embedding[0];
      // 确保值在 0-1 范围内
      return Math.max(0, Math.min(1, Math.abs(value)));
    }

    // 默认返回高相似度
    return CACHE_CONFIG.SIMILARITY_THRESHOLD;
  }

  /**
   * 验证并转换语气类型
   */
  private validateAndCastTone(tone: string): WritingPlan['tone'] {
    const validTones: WritingPlan['tone'][] = ['formal', 'casual', 'technical', 'academic'];

    if (validTones.includes(tone as WritingPlan['tone'])) {
      return tone as WritingPlan['tone'];
    }

    console.warn(`Invalid tone in cache: ${tone}, using default 'technical'`);
    return 'technical';
  }
}

/**
 * 创建写作助手（向后兼容的工厂函数）
 */
export function createWriterAgent(config: WriterAgentConfig) {
  return new WriterAgent(config);
}

/**
 * 创建增强版写作助手（向后兼容的工厂函数）
 */
export function createEnhancedWriterAgent(config: WriterAgentConfig) {
  return new WriterAgent({
    ...config,
    enableTools: true,
  });
}
