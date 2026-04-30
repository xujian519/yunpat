/**
 * 批处理器 - 优化 LLM API 调用成本
 *
 * 核心功能：
 * 1. 批量生成章节 - 将多个章节合并为单个请求
 * 2. 批量接口适配 - 使用结构化输出格式
 * 3. 智能分批 - 根据章节数量自动分批
 *
 * 成本节省：
 * - 当前：5个章节 = 5次API调用
 * - 优化后：5个章节 = 1次API调用
 * - 节省：60-80% API成本
 */

import { LLMAdapter } from '../lifecycle/Lifecycle.js';

/**
 * 章节生成结果
 */
export interface BatchSectionResult {
  /** 章节标题 */
  heading: string;
  /** 章节内容 */
  content: string;
  /** 词数 */
  wordCount: number;
}

/**
 * 批处理配置
 */
export interface BatchConfig {
  /** 单批最大章节数 */
  maxSectionsPerBatch: number;
  /** 批处理超时时间（毫秒） */
  timeout: number;
  /** 是否启用批处理 */
  enabled: boolean;
}

/**
 * 默认配置
 */
const DEFAULT_BATCH_CONFIG: BatchConfig = {
  maxSectionsPerBatch: 8,
  timeout: 120000, // 2分钟
  enabled: true,
};

/**
 * 批处理器
 *
 * 通过合并多个章节生成请求为单个API调用来降低成本
 */
export class BatchProcessor {
  private config: BatchConfig;
  private llm: LLMAdapter;

  constructor(llm: LLMAdapter, config?: Partial<BatchConfig>) {
    this.llm = llm;
    this.config = { ...DEFAULT_BATCH_CONFIG, ...config };
  }

  /**
   * 批量生成章节
   *
   * @param sections - 章节标题列表
   * @param plan - 写作计划
   * @param context - 执行上下文
   * @returns 章节标题到内容的映射
   */
  async batchGenerate(
    sections: string[],
    plan: unknown,
    context: unknown
  ): Promise<Map<string, BatchSectionResult>> {
    // 检查是否启用批处理
    if (!this.config.enabled) {
      return this.fallbackToSequential(sections, plan, context);
    }

    // 智能分批：根据章节数量决定是否分批
    const batches = this.createBatches(sections);

    // 如果只有1批且章节数<=1，回退到顺序处理
    if (batches.length === 1 && batches[0].length <= 1) {
      return this.fallbackToSequential(sections, plan, context);
    }

    console.log(`[BatchProcessor] 批处理模式: ${sections.length}个章节分为${batches.length}批`);

    // 并行处理所有批次
    const batchResults = await Promise.all(
      batches.map((batch, index) =>
        this.processBatch(batch, plan, context, index + 1, batches.length)
      )
    );

    // 合并所有批次的结果
    const resultMap = new Map<string, BatchSectionResult>();
    batchResults.forEach((batchMap) => {
      batchMap.forEach((result) => {
        resultMap.set(result.heading, result);
      });
    });

    return resultMap;
  }

  /**
   * 创建批次 - 智能分批策略
   */
  private createBatches(sections: string[]): string[][] {
    const batches: string[][] = [];
    const maxPerBatch = this.config.maxSectionsPerBatch;

    // 如果章节数量小于等于阈值，不分批
    if (sections.length <= maxPerBatch) {
      return [sections];
    }

    // 否则，按maxSectionsPerBatch分批
    for (let i = 0; i < sections.length; i += maxPerBatch) {
      batches.push(sections.slice(i, i + maxPerBatch));
    }

    return batches;
  }

  /**
   * 处理单个批次
   */
  private async processBatch(
    sections: string[],
    plan: unknown,
    context: unknown,
    batchIndex: number,
    totalBatches: number
  ): Promise<Map<string, BatchSectionResult>> {
    console.log(`[BatchProcessor] 处理第${batchIndex}/${totalBatches}批: ${sections.length}个章节`);

    try {
      // 构建批量提示
      const batchPrompt = this.buildBatchPrompt(sections, plan);

      // 调用 LLM
      const response = await this.llm.chat({
        messages: [
          {
            role: 'system',
            content: `你是技术写作专家。语气：${(plan as any).tone}。你需要批量生成多个章节的内容。`,
          },
          {
            role: 'user',
            content: batchPrompt,
          },
        ],
        temperature: 0.7,
        maxTokens: this.config.maxSectionsPerBatch * 1000, // 每章节约1000 tokens
      });

      // 解析批量响应
      const results = this.parseBatchResponse(response.message.content, sections);

      console.log(`[BatchProcessor] 第${batchIndex}批完成，成功生成${results.size}个章节`);

      return results;
    } catch (error) {
      console.error(`[BatchProcessor] 第${batchIndex}批处理失败:`, error);
      // 回退到顺序处理
      return this.fallbackToSequential(sections, plan, context);
    }
  }

  /**
   * 构建批量提示
   */
  private buildBatchPrompt(sections: string[], plan: unknown): string {
    const wordsPerSection = Math.round((plan as any).targetLength / sections.length);

    return `请为文档"${(plan as any).structure.title}"批量生成以下${sections.length}个章节的内容：

${sections.map((heading, index) => `${index + 1}. ${heading}`).join('\n')}

**要求**：
1. 语气：${(plan as any).tone}
2. 目标长度：每章节约${wordsPerSection}词
3. 内容详细、准确

**输出格式**：
请严格按照以下JSON格式输出（不要使用markdown代码块）：
{
  "sections": [
    {
      "heading": "章节标题1",
      "content": "章节内容1..."
    },
    {
      "heading": "章节标题2",
      "content": "章节内容2..."
    }
  ]
}

注意：
- 必须是有效的JSON格式
- "heading"必须与上述章节标题完全一致
- "content"为该章节的完整内容
- 不要添加任何其他说明文字`;
  }

  /**
   * 解析批量响应
   */
  private parseBatchResponse(
    response: string,
    expectedSections: string[]
  ): Map<string, BatchSectionResult> {
    const resultMap = new Map<string, BatchSectionResult>();

    try {
      // 尝试提取JSON（支持代码块和直接JSON）
      let jsonMatch = response.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (!jsonMatch) {
        // 尝试直接提取JSON对象
        const objectMatch = response.match(/\{[\s\S]*\}/);
        if (objectMatch) {
          jsonMatch = objectMatch;
        }
      }

      if (!jsonMatch) {
        throw new Error('无法从响应中提取JSON');
      }

      const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);

      if (!parsed.sections || !Array.isArray(parsed.sections)) {
        throw new Error('响应格式错误：缺少sections数组');
      }

      // 构建结果映射
      parsed.sections.forEach((section: unknown) => {
        if ((section as any).heading && (section as any).content) {
          resultMap.set((section as any).heading, {
            heading: (section as any).heading,
            content: (section as any).content,
            wordCount: (section as any).content.split(/\s+/).length,
          });
        }
      });

      // 验证是否所有章节都已生成
      const missingSections = expectedSections.filter((heading) => !resultMap.has(heading));

      if (missingSections.length > 0) {
        console.warn(`[BatchProcessor] 部分章节生成失败: ${missingSections.join(', ')}`);
      }

      return resultMap;
    } catch (error) {
      console.error('[BatchProcessor] 解析批量响应失败:', error);
      throw error;
    }
  }

  /**
   * 回退到顺序处理（兼容模式）
   *
   * @param context - 保留参数，用于未来扩展（如使用 context 中的其他信息）
   */
  private async fallbackToSequential(
    sections: string[],
    plan: unknown,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    context: unknown
  ): Promise<Map<string, BatchSectionResult>> {
    console.log('[BatchProcessor] 回退到顺序处理模式');

    const resultMap = new Map<string, BatchSectionResult>();

    for (const heading of sections) {
      try {
        const sectionPrompt = this.buildSectionPrompt(heading, plan);

        const response = await this.llm.chat({
          messages: [
            {
              role: 'system',
              content: `你是技术写作专家。语气：${(plan as any).tone}。`,
            },
            {
              role: 'user',
              content: sectionPrompt,
            },
          ],
          temperature: 0.7,
        });

        resultMap.set(heading, {
          heading,
          content: response.message.content,
          wordCount: response.message.content.split(/\s+/).length,
        });
      } catch (error) {
        console.error(`[BatchProcessor] 章节生成失败: ${heading}`, error);
        // 即使失败也添加空结果，保持章节顺序
        resultMap.set(heading, {
          heading,
          content: `[生成失败: ${error instanceof Error ? error.message : String(error)}]`,
          wordCount: 0,
        });
      }
    }

    return resultMap;
  }

  /**
   * 构建单个章节提示（用于回退模式）
   */
  private buildSectionPrompt(heading: string, plan: unknown): string {
    const wordsPerSection = Math.round(
      (plan as any).targetLength / (plan as any).structure.sections.length
    );

    return `请为文档"${(plan as any).structure.title}"撰写以下章节的内容：

**章节标题**：${heading}

**要求**：
1. 语气：${(plan as any).tone}
2. 目标长度：约${wordsPerSection}词
3. 内容详细、准确

请直接输出章节内容，不要包含章节标题。`;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<BatchConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取当前配置
   */
  getConfig(): BatchConfig {
    return { ...this.config };
  }

  /**
   * 启用批处理
   */
  enable(): void {
    this.config.enabled = true;
  }

  /**
   * 禁用批处理
   */
  disable(): void {
    this.config.enabled = false;
  }

  /**
   * 估算成本节省
   *
   * @param sectionCount - 章节总数
   * @returns 成本节省信息
   */
  estimateCostSavings(sectionCount: number): {
    originalCalls: number;
    batchCalls: number;
    savedCalls: number;
    savingsPercentage: number;
  } {
    const originalCalls = sectionCount;
    const batches = Math.ceil(sectionCount / this.config.maxSectionsPerBatch);
    const batchCalls = batches;
    const savedCalls = originalCalls - batchCalls;
    const savingsPercentage = Math.round((savedCalls / originalCalls) * 100);

    return {
      originalCalls,
      batchCalls,
      savedCalls,
      savingsPercentage,
    };
  }
}
