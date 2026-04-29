/**
 * 专利撰写智能体（增强版 - 集成知识库和分步加载提示词模板）
 *
 * 专门用于专利申请文件的智能撰写，包括：
 * 1. 技术方案理解（使用知识库增强）
 * 2. 权利要求设计（使用提示词模板）
 * 3. 说明书生成（使用提示词模板）
 * 4. 质量评估（7维度评估）
 *
 * 特性：
 * - 分步加载提示词模板（按需加载，节省内存）
 * - 知识库增强（基于宝宸知识库）
 * - TDD方式（测试驱动开发）
 */

import { Agent } from '@yunpat/core';
import type { LLMAdapter, ExecutionContext } from '@yunpat/core/src/lifecycle/Lifecycle.js';
import { ObsidianKnowledgeBridge, type WikiCard, type WikiPage } from '../../knowledge/ObsidianKnowledgeBridge.js';
import { CardRetriever } from '@yunpat/core/src/knowledge/CardRetriever.js';
import { CardPipeline } from '@yunpat/core/src/knowledge/CardPipeline.js';
import type { EmbeddingAdapter } from '@yunpat/core/src/llm/EmbeddingAdapter.js';
import { PromptTemplateManager } from '../../prompts/PromptTemplateManager.js';
import * as PatentCore from '../../core/PatentCoreBridge.js';
import { renderDraftingClaimsPrompt, renderDraftingSpecificationPrompt } from '../../prompts/business/drafting.js';

/**
 * 专利撰写输入
 */
export interface PatentWritingInput {
  /** 发明名称 */
  title: string;

  /** 技术领域 */
  field: string;

  /** 申请人 */
  applicant: string;

  /** 发明人 */
  inventors: string[];

  /** 技术交底书 */
  technicalDisclosure: string;

  /** 附图列表 */
  drawings: string[];
}

/**
 * 专利撰写输出
 */
export interface PatentWritingOutput {
  /** 专利申请文件 */
  patentApplication: {
    /** 发明名称 */
    title: string;

    /** 摘要 */
    abstract: string;

    /** 权利要求书 */
    claims: Claim[];

    /** 说明书 */
    description: string;

    /** 附图说明 */
    drawings: string;
  };

  /** 撰写指标 */
  metrics: {
    /** 撰写耗时（分钟） */
    durationMinutes: number;

    /** 权利要求数量 */
    claimsCount: number;

    /** 说明书字数 */
    descriptionWordCount: number;

    /** 质量评分 */
    qualityScore: number;
  };
}

/**
 * 权利要求
 */
export interface Claim {
  /** 类型：独立或从属 */
  type: 'independent' | 'dependent';

  /** 编号 */
  number: number;

  /** 权利要求内容 */
  content: string;
}

/**
 * 专利撰写智能体配置
 */
export interface PatentWriterConfig {
  name?: string;
  description?: string;
  eventBus?: any;
  memory?: any;
  tools?: any;
  llm: LLMAdapter;
  knowledgeBasePath?: string;
  templateDir?: string;
  enableKnowledge?: boolean;
  enableTemplates?: boolean;
  maxIterations?: number;
  embedder?: EmbeddingAdapter;
}

/**
 * 专利撰写智能体
 */
export class PatentWriterAgent extends Agent<PatentWritingInput, PatentWritingOutput> {
  private knowledge: ObsidianKnowledgeBridge;
  private cardRetriever: CardRetriever;
  private promptManager: PromptTemplateManager;
  private config: PatentWriterConfig;
  private currentStage: string = 'idle';

  constructor(config: PatentWriterConfig) {
    super({
      ...config,
      name: config.name || 'patent-writer',
      description: config.description || '专利撰写智能体 - 专业的专利申请文件撰写助手',
    });

    this.config = config;

    // 初始化知识库桥接（保留兼容性）
    if (config.enableKnowledge !== false) {
      const knowledgeBasePath = config.knowledgeBasePath || process.env.KNOWLEDGE_BASE_PATH;
      if (!knowledgeBasePath) {
        console.warn('[PatentWriterAgent] 未配置知识库路径，将不使用知识库增强功能');
      } else {
        this.knowledge = new ObsidianKnowledgeBridge(knowledgeBasePath);

        // 初始化卡片检索器（语义检索）
        this.cardRetriever = new CardRetriever(config.embedder);
        const pipeline = new CardPipeline({
          llm: config.llm,
          knowledgeBasePath,
          embedder: config.embedder,
        });
        pipeline.loadPersistedCards().then((count) => {
          if (count > 0) {
            this.cardRetriever = pipeline.getRetriever();
            console.log(`[PatentWriterAgent] 卡片知识库已加载 ${count} 张卡片`);
          }
        }).catch(() => {});

        console.log('[PatentWriterAgent] 知识库已启用');
      }
    }

    // 初始化提示词管理器
    if (config.enableTemplates !== false) {
      this.promptManager = new PromptTemplateManager(config.templateDir);
      console.log('[PatentWriterAgent] 提示词模板已启用');
    }
  }

  /**
   * 规划阶段：理解技术方案并设计保护策略
   *
   * 分步加载策略：
   * - Stage 1: 发明理解 - 预加载创造性分析模板
   */
  protected async plan(
    input: PatentWritingInput,
    context: ExecutionContext
  ): Promise<any> {
    console.log('\n📝 [专利撰写] 步骤1: 规划阶段');
    console.log(`   发明名称: ${input.title}`);
    console.log(`   技术领域: ${input.field}`);
    console.log(`   申请人: ${input.applicant}`);

    this.currentStage = 'planning';

    // patent-core 预处理：解析交底书 + 提取特征
    let parsedDisclosure: any = null;
    let extractedFeatures: any = null;
    try {
      parsedDisclosure = await PatentCore.parseDisclosure(input.technicalDisclosure);
      extractedFeatures = await PatentCore.extractFeatures(input.technicalDisclosure);
      console.log(`[PatentWriterAgent] 交底书解析置信度: ${parsedDisclosure.confidence.toFixed(2)}, 特征数: ${extractedFeatures.features.length}`);
    } catch (e) {
      console.warn('[PatentWriterAgent] patent-core 预处理失败，回退到纯 LLM 模式:', (e as Error).message);
    }

    // 预加载创造性分析模板（发明理解阶段需要）
    if (this.promptManager) {
      await this.promptManager.preload('invention-understanding');
      console.log('[PatentWriterAgent] 已预加载创造性分析模板');
    }

    // 构建增强的提示词，包含 patent-core 提取的结构化信息
    const preprocessedInfo = this.buildPreprocessedContext(parsedDisclosure, extractedFeatures);

    // 使用 LLM 分析技术交底书
    const analysis = await context.llm.chat({
      messages: [
        {
          role: 'system',
          content: `你是一位资深的专利代理人，擅长理解技术方案并设计权利要求。

你的任务是：
1. 深入理解技术交底书中的技术方案
2. 识别核心创新点
3. 设计合理的保护范围
4. 规划权利要求布局

请分析以下技术方案，并给出撰写计划。`,
        },
        {
          role: 'user',
          content: `发明名称：${input.title}

技术领域：${input.field}

申请人：${input.applicant}

发明人：${input.inventors.join('、')}

技术交底书：
${input.technicalDisclosure}

附图：
${input.drawings.join('\n')}

${preprocessedInfo}`,
        },
      ],
      temperature: 0.3,
    });

    // 知识库增强（如果启用）
    let enhancedAnalysis = analysis.message.content;
    if (this.knowledge) {
      enhancedAnalysis = await this.enhanceWithKnowledge(analysis.message.content, context);
    }

    return {
      plan: enhancedAnalysis,
      coreInnovation: '待识别',
      protectionScope: '待设计',
      parsedDisclosure,
      extractedFeatures,
    };
  }

  /** 构建 patent-core 预处理上下文 */
  private buildPreprocessedContext(disclosure: any, features: any): string {
    if (!disclosure && !features) return '';
    const parts: string[] = ['\n## 算法预处理结果（patent-core）'];
    if (disclosure) {
      parts.push(`\n### 交底书结构解析（置信度: ${disclosure.confidence.toFixed(2)}）`);
      for (const [section, content] of Object.entries(disclosure.sections || {})) {
        if (content && (content as string).trim()) {
          parts.push(`- ${section}: ${(content as string).substring(0, 200)}`);
        }
      }
    }
    if (features && features.features?.length > 0) {
      parts.push(`\n### 提取的技术特征（${features.features.length}个）`);
      for (const f of features.features.slice(0, 10)) {
        parts.push(`- [${f.category}/${f.feature_type}] ${f.description}`);
      }
    }
    return parts.join('\n');
  }

  /**
   * 执行阶段：撰写专利申请文件
   *
   * 分步加载策略：
   * - Step 1: 权利要求生成 - 按需加载权利要求模板
   * - Step 2: 说明书撰写 - 按需加载说明书模板
   * - Step 3: 质量评估 - 懒加载所有模板
   */
  protected async act(plan: any, context: any): Promise<PatentWritingOutput> {
    console.log('\n✍️ [专利撰写] 步骤2: 执行阶段');

    const startTime = Date.now();

    // 1. 生成权利要求（按需加载模板）
    console.log('   1️⃣ 生成权利要求...');
    const claims = await this.generateClaims(plan, context);
    console.log(`      ✅ 生成了 ${claims.length} 项权利要求`);

    // 2. 生成说明书（按需加载模板）
    console.log('   2️⃣ 生成说明书...');
    const description = await this.generateDescription(plan, context);
    console.log(`      ✅ 说明书长度：${description.split(/\s+/).length} 字`);

    // 3. 生成摘要
    console.log('   3️⃣ 生成摘要...');
    const abstract = await this.generateAbstract(plan, context);
    console.log(`      ✅ 摘要长度：${abstract.split(/\s+/).length} 字`);

    // 4. 生成附图说明
    console.log('   4️⃣ 生成附图说明...');
    const drawings = await this.generateDrawings(plan, context);
    console.log('      ✅ 附图说明完成');

    const duration = (Date.now() - startTime) / 1000 / 60; // 分钟

    return {
      patentApplication: {
        title: context.input.title,
        abstract,
        claims,
        description,
        drawings,
      },
      metrics: {
        durationMinutes: Math.round(duration),
        claimsCount: claims.length,
        descriptionWordCount: description.split(/\s+/).length,
        qualityScore: this.calculateQualityScore(plan, claims, description),
      },
    };
  }

  /**
   * 反思阶段：质量检查和改进建议
   *
   * 分步加载策略：
   * - 懒加载所有模板（质量评估需要全面检查）
   */
  protected async reflect(
    output: PatentWritingOutput,
    context: any
  ): Promise<any> {
    console.log('\n🤔 [专利撰写] 步骤3: 质量检查');

    this.currentStage = 'quality-assessment';

    // patent-core 质量评估（规则化评分，不依赖 LLM）
    let coreAssessment: any = null;
    try {
      const claimDrafts = output.patentApplication.claims.map((c, i) => ({
        id: String(i + 1),
        claim_type: (c.type === 'independent' ? 'Independent' : 'Dependent') as 'Independent' | 'Dependent',
        preamble: c.content.substring(0, 50),
        transitional_phrase: '',
        elements: [c.content],
        dependent_on: c.type === 'dependent' ? String(Math.max(1, i)) : null,
      }));
      coreAssessment = await PatentCore.assessQuality(claimDrafts);
      console.log(`[PatentWriterAgent] patent-core 质量评分: ${coreAssessment.overall_score.toFixed(2)}`);
      if (coreAssessment.issues?.length > 0) {
        console.log(`[PatentWriterAgent] 发现 ${coreAssessment.issues.length} 个质量问题`);
      }
    } catch (e) {
      console.warn('[PatentWriterAgent] patent-core 质量评估失败:', (e as Error).message);
    }

    // 懒加载所有模板（质量评估需要）
    if (this.promptManager) {
      console.log('[PatentWriterAgent] 加载所有模板用于质量评估...');
      await this.promptManager.loadTemplates([
        '01-claims-generation',
        '02-specification-drafting',
        '03-creativity-analysis',
      ]);
    }

    const coreInfo = coreAssessment
      ? `\n\n## patent-core 规则化评估\n清晰性: ${coreAssessment.clarity_score}\n支持性: ${coreAssessment.support_score}\n保护范围: ${coreAssessment.scope_score}\n综合: ${coreAssessment.overall_score}\n${coreAssessment.issues?.map((i: any) => `- [${i.severity}] ${i.dimension}: ${i.suggestion}`).join('\n') || ''}`
      : '';

    const qualityCheck = await context.llm.chat({
      messages: [
        {
          role: 'system',
          content: `你是一位专利质量审核专家。

请评估以下专利申请文件的质量：

1. 权利要求是否清晰、完整
2. 说明书是否充分公开
3. 保护范围是否合理
4. 是否存在明显的法律风险

给出评分（0-100）和改进建议。`,
        },
        {
          role: 'user',
          content: `权利要求数量：${output.metrics.claimsCount}
摘要：${output.patentApplication.abstract}
说明书长度：${output.metrics.descriptionWordCount} 字${coreInfo}`,
        },
      ],
      temperature: 0.3,
    });

    return {
      qualityCheck: qualityCheck.message.content,
      coreAssessment,
      improvementSuggestions: coreAssessment?.issues?.map((i: any) => i.suggestion) || [],
    };
  }

  /**
   * 生成权利要求（使用提示词模板）
   */
  private async generateClaims(plan: any, context: any): Promise<Claim[]> {
    // 按需加载权利要求模板
    if (this.promptManager && !this.promptManager.isLoaded('01-claims-generation')) {
      console.log('[PatentWriterAgent] 加载权利要求生成模板...');
      await this.promptManager.loadTemplate('01-claims-generation');
    }

    // 使用提示词模板
    let prompt: string;
    if (this.promptManager) {
      // 准备变量
      const variables = {
        invention_title: context.input.title,
        invention_type: 'device', // 简化，实际应该从输入中提取
        technical_field: context.input.field,
        technical_problem: '技术问题',
        technical_solution: plan.plan.substring(0, 1000), // 取前1000字
        technical_effects: '技术效果',
        essential_features: JSON.stringify([]),
        optional_features: JSON.stringify([]),
      };

      // 渲染提示词
      prompt = this.promptManager.render('01-claims-generation', variables);
    } else {
      // 降级到基础提示词
      prompt = `请根据以下技术方案撰写权利要求：\n\n${plan.plan}`;
    }

    const claims = await context.llm.chat({
      messages: [
        {
          role: 'system',
          content: `你是权利要求撰写专家。

请根据技术方案撰写权利要求书：

1. 独立权利要求：包含发明的必要技术特征
2. 从属权利要求：包含从属权利要求
3. 每项权利要求应当清晰、简洁、完整

要求：
- 权利要求以"一种[主题]，其特征在于..."开始
- 技术特征应当具体、明确
- 保护范围应当合理，不应过宽或过窄

输出格式：
1. 独立权利要求 1
2. 从属权利要求 2（根据权利要求1）
3. 从属权利要求 3（根据权利要求2）
...`,
        },
        {
          role: 'user',
          content: `请根据以下技术方案撰写权利要求：

${plan.plan}

技术交底书：
${context.input.technicalDisclosure}

请撰写 3-5 项权利要求，包括 1 项独立权利要求和 2-4 项从属权利要求。`,
        },
      ],
      temperature: 0.4,
    });

    // 解析生成的权利要求
    const content = claims.message.content;
    const claimItems = content.split(/\n/).filter((line) => line.trim().length > 0);

    return claimItems.map((item, index) => ({
      type: index === 0 ? 'independent' : 'dependent',
      number: index + 1,
      content: item.replace(/^\d+\.\s*/, ''), // 移除序号
    }));
  }

  /**
   * 生成说明书（使用提示词模板）
   */
  private async generateDescription(plan: any, context: any): Promise<string> {
    // 按需加载说明书模板
    if (this.promptManager && !this.promptManager.isLoaded('02-specification-drafting')) {
      console.log('[PatentWriterAgent] 加载说明书撰写模板...');
      await this.promptManager.loadTemplate('02-specification-drafting');
    }

    let prompt: string;
    if (this.promptManager) {
      // 准备变量
      const variables = {
        invention_title: context.input.title,
        technical_field: context.input.field,
        background_art: '背景技术', // 简化
        technical_problem: '技术问题',
        technical_solution: plan.plan.substring(0, 1500),
        technical_effects: '技术效果',
        claims_summary: '权利要求摘要',
      };

      // 渲染提示词
      prompt = this.promptManager.render('02-specification-drafting', variables);
    } else {
      // 降级到基础提示词
      prompt = `请根据以下技术方案撰写说明书：\n\n${plan.plan}`;
    }

    const description = await context.llm.chat({
      messages: [
        {
          role: 'system',
          content: `你是专利说明书撰写专家。

请撰写完整的专利说明书，包括：

1. 背景技术（介绍发明所属技术领域）
2. 背景技术（介绍相关现有技术及其缺陷）
3. 发明内容（详细描述技术方案、实现方式）
4. 附图说明（结合附图说明具体实施方式）

要求：
- 说明书应当充分公开技术方案，使本领域技术人员能够实现
- 不得使用商业性宣传用语
- 应当清晰、具体、详实

字数：2000-5000 字`,
        },
        {
          role: 'user',
          content: `请根据以下技术方案撰写说明书：

${plan.plan}

技术交底书：
${context.input.technicalDisclosure}

附图：
${context.input.drawings.join('\n')}`,
        },
      ],
      temperature: 0.5,
    });

    return description.message.content;
  }

  /**
   * 生成摘要
   */
  private async generateAbstract(plan: any, context: any): Promise<string> {
    const abstract = await context.llm.chat({
      messages: [
        {
          role: 'system',
          content: `请撰写专利摘要，要求：
1. 简明扼要地说明发明的技术方案
2. 字数：100-300 字
3. 客观、准确地描述技术方案及其有益效果`,
        },
        {
          role: 'user',
          content: `请为以下发明撰写摘要：

${context.input.title}

技术领域：${context.input.field}

技术方案：
${context.input.technicalDisclosure.substring(0, 500)}...
`,
        },
      ],
      temperature: 0.3,
    });

    return abstract.message.content;
  }

  /**
   * 生成附图说明
   */
  private async generateDrawings(plan: any, context: any): Promise<string> {
    const drawings = await context.llm.chat({
      messages: [
        {
          role: 'system',
          content: `请撰写附图说明，要求：
1. 结合附图详细描述实施方式
2. 每幅附图都应当说明
3. 字数适中，清晰易懂`,
        },
        {
          role: 'user',
          content: `请为以下附图撰写说明：

${context.input.drawings.join('\n')}

技术方案：
${plan.plan.substring(0, 1000)}...
`,
        },
      ],
      temperature: 0.4,
    });

    return drawings.message.content;
  }

  /**
   * 知识库增强
   *
   * 优先使用 CardRetriever 语义检索多张相关知识卡片，
   * 回退到 ObsidianKnowledgeBridge 单卡片查询
   */
  private async enhanceWithKnowledge(
    analysis: string,
    context: ExecutionContext
  ): Promise<string> {
    // 优先使用语义检索
    if (this.cardRetriever) {
      const stats = this.cardRetriever.getStats();
      if (stats.totalCards > 0) {
        console.log(`[PatentWriterAgent] 语义检索知识卡片 (库: ${stats.totalCards} 张)`);
        const { enhancedPrompt, injectedCards } = await this.cardRetriever.injectContext(
          analysis.slice(0, 500),
          3,
        );
        if (injectedCards.length > 0) {
          console.log(`[PatentWriterAgent] 注入 ${injectedCards.length} 张知识卡片: ${injectedCards.map((c) => c.concept).join(', ')}`);
          return enhancedPrompt;
        }
      }
    }

    // 回退到简单卡片查询
    if (this.knowledge) {
      console.log('[PatentWriterAgent] 回退到简单卡片查询');
      const creativityCard = await this.knowledge.queryCard('什么是创造性');
      if (creativityCard && creativityCard.quality > 0.7) {
        return analysis + `\n\n## 知识库增强 - 创造性判断要点\n\n${creativityCard.content}`;
      }
    }

    return analysis;
  }

  /**
   * 计算质量评分
   */
  private calculateQualityScore(plan: any, claims: Claim[], description: string): number {
    let score = 70; // 基础分

    // 权利要求数量评估（3-5 项最佳）
    if (claims.length >= 3 && claims.length <= 5) {
      score += 10;
    }

    // 说明书长度评估（2000-5000 字最佳）
    const wordCount = description.split(/\s+/).length;
    if (wordCount >= 2000 && wordCount <= 5000) {
      score += 10;
    }

    // 权利要求质量评估
    const hasIndependentClaim = claims.some((c) => c.type === 'independent');
    if (hasIndependentClaim) {
      score += 10;
    }

    return Math.min(score, 100);
  }

  /**
   * 导出为正式申请文件格式
   */
  async exportToFormat(format: 'cn' | 'pct'): Promise<any> {
    // 导出为中国或 PCT 格式
    // TODO: 实现具体的导出逻辑
    return {};
  }

  /**
   * 获取当前阶段
   */
  getCurrentStage(): string {
    return this.currentStage;
  }

  /**
   * 获取缓存统计
   */
  getCacheStats() {
    return {
      promptManager: this.promptManager?.getCacheStats(),
      knowledge: this.knowledge?.getCacheStats(),
    };
  }
}
