import { Agent, type ExecutionContext } from '@yunpat/core';
import { PatentSearchTool, PatentSearchMode, type PatentRecord } from '@yunpat/patent-tools';

export interface SearchStrategy {
  keywords: string[];
  ipcCodes: string[];
  searchQuery: string;
  rationale: string;
}

export interface SearchInput {
  title: string;
  field: string;
  technicalProblem: string;
  technicalSolution: string;
  keyFeatures: string[];
}

export interface SearchOutput {
  strategy: SearchStrategy;
  results: PatentRecord[];
  totalFound: number;
  searchTimeMs: number;
}

interface SearchPlan {
  input: SearchInput;
}

export class PatentSearchAgent extends Agent {
  private searchTool: PatentSearchTool;

  constructor(config: {
    name: string;
    description: string;
    eventBus: any;
    memory: any;
    tools: any;
    llm: any;
    searchTool?: PatentSearchTool;
  }) {
    super(config);
    this.searchTool = config.searchTool || new PatentSearchTool();
  }

  protected async plan(input: SearchInput, _context: ExecutionContext): Promise<SearchPlan> {
    if (!input.title?.trim()) {
      throw new Error('发明名称不能为空');
    }
    if (!input.field?.trim()) {
      throw new Error('技术领域不能为空');
    }

    console.log('\n🔍 [专利检索] 步骤1: 规划阶段');
    console.log(`   发明名称: ${input.title}`);
    console.log(`   技术领域: ${input.field}`);

    return { input };
  }

  protected async act(plan: SearchPlan, context: ExecutionContext): Promise<SearchOutput> {
    console.log('\n🔎 [专利检索] 步骤2: 执行阶段');

    const { input } = plan;

    if (!context.llm) {
      throw new Error('LLM 未配置，无法生成检索策略');
    }

    const startTime = Date.now();

    const strategy = await this.generateSearchStrategy(input, context.llm);
    console.log(`   检索策略: ${strategy.searchQuery}`);
    console.log(`   关键词: ${strategy.keywords.join(', ')}`);
    console.log(`   IPC分类: ${strategy.ipcCodes.join(', ') || '无'}`);

    const toolContext = {
      registry: this.tools,
      llm: context.llm!,
      memory: this.memory,
      eventBus: this.eventBus,
      metadata: {
        agentName: this.name,
        executionId: `search-${Date.now()}`,
      },
    };

    const searchResult = await this.searchTool.execute(
      {
        query: strategy.searchQuery,
        mode: PatentSearchMode.KEYWORD,
        page: 1,
        limit: 10,
      },
      toolContext as any
    );

    const searchTimeMs = Date.now() - startTime;

    console.log(`\n✅ [专利检索] 完成 (找到 ${searchResult.total} 条结果)`);
    console.log(`   耗时: ${searchTimeMs}ms`);

    return {
      strategy,
      results: searchResult.patents,
      totalFound: searchResult.total,
      searchTimeMs,
    };
  }

  private async generateSearchStrategy(
    input: SearchInput,
    llm: NonNullable<ExecutionContext['llm']>
  ): Promise<SearchStrategy> {
    const systemPrompt = `你是一位资深的专利检索专家，擅长构建高效的专利检索策略。

你的任务是基于发明理解结果，生成最优的检索策略。

检索策略要求：
1. 关键词：提取核心技术特征的关键词（中文和英文）
2. IPC分类号：推断可能相关的IPC分类号（如 H04L, G06N 等）
3. 检索式：构建逻辑清晰的检索查询（使用 AND/OR 组合）
4. 理由：解释为什么这样构建检索策略

输出格式必须是严格的 JSON：
{
  "keywords": ["关键词1", "关键词2"],
  "ipcCodes": ["IPC1", "IPC2"],
  "searchQuery": "检索查询字符串",
  "rationale": "策略理由"
}`;

    const userPrompt = `发明名称：${input.title}

技术领域：${input.field}

技术问题：${input.technicalProblem}

技术方案：${input.technicalSolution}

关键特征：${input.keyFeatures.join('、')}

请生成检索策略。`;

    try {
      const response = await llm.chat({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
      });

      const content = response.message.content;
      const parsed = this.safeParseJSON(content);

      if (parsed) {
        return this.normalizeStrategy(parsed);
      }
    } catch (e) {
      console.warn('[PatentSearchAgent] 检索策略生成失败，使用默认策略:', e);
    }

    return this.createFallbackStrategy(input);
  }

  private safeParseJSON(content: unknown): Record<string, unknown> | null {
    if (typeof content !== 'string') {
      return null;
    }

    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) ||
                      content.match(/```\s*([\s\S]*?)\s*```/) ||
                      content.match(/{[\s\S]*}/);

    const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : content;

    try {
      const parsed = JSON.parse(jsonStr);
      return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : null;
    } catch {
      return null;
    }
  }

  private normalizeStrategy(parsed: Record<string, unknown>): SearchStrategy {
    const getStringArray = (key: string): string[] => {
      const value = parsed[key];
      return Array.isArray(value)
        ? value.filter((v): v is string => typeof v === 'string')
        : [];
    };

    const getString = (key: string, fallback: string): string => {
      const value = parsed[key];
      return typeof value === 'string' ? value.trim() : fallback;
    };

    return {
      keywords: getStringArray('keywords'),
      ipcCodes: getStringArray('ipcCodes'),
      searchQuery: getString('searchQuery', ''),
      rationale: getString('rationale', ''),
    };
  }

  private createFallbackStrategy(input: SearchInput): SearchStrategy {
    const keywords = [
      input.title,
      input.field,
      ...input.keyFeatures.slice(0, 3),
    ];

    const searchQuery = keywords.join(' AND ');

    return {
      keywords,
      ipcCodes: [],
      searchQuery,
      rationale: '基于发明标题、技术领域和关键特征构建的默认检索策略',
    };
  }
}