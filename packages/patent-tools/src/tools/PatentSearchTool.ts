import { z } from 'zod';
import { EnhancedBaseTool, ToolCategory, ToolContext } from '@yunpat/core';
import { GooglePatentsFetchTool, GooglePatentResult } from './GooglePatentsTool.js';

/**
 * 专利检索模式
 */
export enum PatentSearchMode {
  KEYWORD = 'keyword', // 关键词检索
  APPLICANT = 'applicant', // 申请人检索
  IPC = 'ipc', // IPC分类检索
  NUMBER = 'number', // 申请号/公开号检索
}

/**
 * 专利记录
 */
export interface PatentRecord {
  /** 专利ID */
  id: string;
  /** 专利名称 */
  patentName: string;
  /** 申请号 */
  applicationNumber: string;
  /** 公开号 */
  publicationNumber: string;
  /** 申请人 */
  applicant: string;
  /** 发明人 */
  inventor?: string;
  /** IPC分类号 */
  ipcCode?: string;
  /** 摘要 */
  abstract?: string;
  /** 权利要求 */
  claims?: string;
  /** 公开日期 */
  publicationDate?: string;
  /** 申请日期 */
  filingDate?: string;
  /** URL */
  url?: string;
}

/**
 * 专利检索结果
 */
export interface PatentSearchResult {
  /** 匹配的专利列表 */
  patents: PatentRecord[];
  /** 总数（估算） */
  total: number;
  /** 当前页码 */
  page: number;
  /** 每页数量 */
  pageSize: number;
  /** 检索耗时（毫秒） */
  elapsedMs: number;
}

/**
 * 专利检索工具
 *
 * 支持多种检索方式的综合专利检索工具
 */
export class PatentSearchTool extends EnhancedBaseTool<
  {
    query: string;
    mode?: PatentSearchMode;
    page?: number;
    limit?: number;
  },
  PatentSearchResult
> {
  readonly metadata = {
    name: 'patent_search',
    description: '综合专利检索工具，支持关键词、申请人、IPC分类、申请号等多种检索方式',
    category: ToolCategory.PATENT,
    isConcurrencySafe: true,
    inputSchema: z.object({
      query: z.string().describe('检索查询内容（关键词/申请人/IPC/专利号）'),
      mode: z.nativeEnum(PatentSearchMode).optional().default(PatentSearchMode.KEYWORD).describe('检索模式'),
      page: z.number().optional().default(1).describe('页码'),
      limit: z.number().optional().default(10).describe('每页结果数量'),
    }),
    outputSchema: z.object({
      patents: z.array(
        z.object({
          id: z.string(),
          patentName: z.string(),
          applicationNumber: z.string(),
          publicationNumber: z.string(),
          applicant: z.string(),
          inventor: z.string().optional(),
          ipcCode: z.string().optional(),
          abstract: z.string().optional(),
          claims: z.string().optional(),
          publicationDate: z.string().optional(),
          filingDate: z.string().optional(),
          url: z.string().optional(),
        })
      ),
      total: z.number(),
      page: z.number(),
      pageSize: z.number(),
      elapsedMs: z.number(),
    }),
    permissions: ['http:request'],
    version: '1.0.0',
    author: 'YunPat Team',
  };

  /**
   * 执行专利检索
   */
  async execute(
    input: {
      query: string;
      mode?: PatentSearchMode;
      page?: number;
      limit?: number;
    },
    context: ToolContext
  ): Promise<PatentSearchResult> {
    const { query, mode = PatentSearchMode.KEYWORD, page = 1, limit = 10 } = input;
    const startTime = Date.now();

    try {
      // 根据检索模式执行不同的检索策略
      let googleResults: GooglePatentResult[] = [];

      switch (mode) {
        case PatentSearchMode.KEYWORD:
          googleResults = await this.searchByKeyword(query, page, limit, context);
          break;

        case PatentSearchMode.APPLICANT:
          googleResults = await this.searchByApplicant(query, page, limit, context);
          break;

        case PatentSearchMode.IPC:
          googleResults = await this.searchByIPC(query, page, limit, context);
          break;

        case PatentSearchMode.NUMBER:
          googleResults = await this.searchByNumber(query, context);
          break;

        default:
          throw new Error(`Unsupported search mode: ${mode}`);
      }

      // 转换为标准格式
      const patents = googleResults.map(this.convertToPatentRecord);

      const elapsedMs = Date.now() - startTime;

      return {
        patents,
        total: patents.length,
        page,
        pageSize: limit,
        elapsedMs,
      };
    } catch (error) {
      throw new Error(
        `Patent search failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * 关键词检索
   */
  private async searchByKeyword(
    keyword: string,
    page: number,
    limit: number,
    context: ToolContext
  ): Promise<GooglePatentResult[]> {
    // 使用 Google Patents 搜索
    const googleTool = new GooglePatentsFetchTool();
    const result = await googleTool.execute(
      {
        query: keyword,
        page,
      },
      context
    );

    // 应用限制
    return result.results.slice(0, limit);
  }

  /**
   * 申请人检索
   */
  private async searchByApplicant(
    applicant: string,
    page: number,
    limit: number,
    context: ToolContext
  ): Promise<GooglePatentResult[]> {
    // 构建申请人搜索查询
    const query = `assignee:(${applicant})`;

    const googleTool = new GooglePatentsFetchTool();
    const result = await googleTool.execute(
      {
        query,
        page,
      },
      context
    );

    // 过滤结果，确保申请人匹配
    const filtered = result.results.filter(
      (r) => r.assignee && r.assignee.includes(applicant)
    );

    return filtered.slice(0, limit);
  }

  /**
   * IPC分类检索
   */
  private async searchByIPC(
    ipcCode: string,
    page: number,
    limit: number,
    context: ToolContext
  ): Promise<GooglePatentResult[]> {
    // 构建IPC分类搜索查询
    const query = `ipc:(${ipcCode})`;

    const googleTool = new GooglePatentsFetchTool();
    const result = await googleTool.execute(
      {
        query,
        page,
      },
      context
    );

    // 过滤结果，确保IPC分类匹配
    const filtered = result.results.filter(
      (r) => r.ipcCodes && r.ipcCodes.some((code) => code.startsWith(ipcCode))
    );

    return filtered.slice(0, limit);
  }

  /**
   * 申请号/公开号检索
   */
  private async searchByNumber(
    patentNumber: string,
    context: ToolContext
  ): Promise<GooglePatentResult[]> {
    // 直接使用专利号作为查询
    const googleTool = new GooglePatentsFetchTool();
    const result = await googleTool.execute(
      {
        query: patentNumber,
        page: 1,
      },
      context
    );

    // 精确匹配专利号
    const exactMatch = result.results.find(
      (r) =>
        r.patentId === patentNumber ||
        r.url.includes(patentNumber) ||
        patentNumber.includes(r.patentId)
    );

    return exactMatch ? [exactMatch] : [];
  }

  /**
   * 转换为标准专利记录格式
   */
  private convertToPatentRecord(googleResult: GooglePatentResult): PatentRecord {
    return {
      id: googleResult.patentId,
      patentName: googleResult.title,
      applicationNumber: googleResult.patentId, // 简化处理
      publicationNumber: googleResult.patentId,
      applicant: googleResult.assignee || '',
      ipcCode: googleResult.ipcCodes?.join(', '),
      abstract: googleResult.snippet,
      publicationDate: googleResult.publicationDate,
      url: googleResult.url,
    };
  }
}

/**
 * 相似专利检索工具
 *
 * 基于技术相似度检索相关专利
 */
export class SimilarPatentSearchTool extends EnhancedBaseTool<
  {
    technology: string;
    features: string[];
    limit?: number;
  },
  {
    similarPatents: PatentRecord[];
    similarityScores: number[];
  }
> {
  readonly metadata = {
    name: 'similar_patent_search',
    description: '基于技术描述检索相似专利',
    category: ToolCategory.PATENT,
    isConcurrencySafe: true,
    inputSchema: z.object({
      technology: z.string().describe('技术领域或技术方案描述'),
      features: z
        .array(z.string())
        .describe('技术特征列表，用于提高检索精度'),
      limit: z.number().optional().default(10).describe('返回结果数量'),
    }),
    outputSchema: z.object({
      similarPatents: z.array(
        z.object({
          id: z.string(),
          patentName: z.string(),
          applicationNumber: z.string(),
          publicationNumber: z.string(),
          applicant: z.string(),
          abstract: z.string().optional(),
        })
      ),
      similarityScores: z.array(z.number()),
    }),
    permissions: ['http:request'],
    version: '1.0.0',
    author: 'YunPat Team',
  };

  async execute(
    input: { technology: string; features: string[]; limit?: number },
    context: ToolContext
  ): Promise<{
    similarPatents: PatentRecord[];
    similarityScores: number[];
  }> {
    const { technology, features, limit = 10 } = input;

    // 构建增强的检索查询
    const query = this.buildEnhancedQuery(technology, features);

    // 使用专利检索工具
    const searchTool = new PatentSearchTool();
    const result = await searchTool.execute(
      {
        query,
        mode: PatentSearchMode.KEYWORD,
        page: 1,
        limit,
      },
      context
    );

    // 计算相似度分数（简化版）
    const similarityScores = result.patents.map((patent) => {
      return this.calculateSimilarity(query, patent.patentName + ' ' + (patent.abstract || ''));
    });

    // 按相似度排序
    const sortedIndices = similarityScores
      .map((score, index) => ({ score, index }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    const similarPatents = sortedIndices.map((item) => result.patents[item.index]);
    const sortedScores = sortedIndices.map((item) => item.score);

    return {
      similarPatents,
      similarityScores: sortedScores,
    };
  }

  /**
   * 构建增强的检索查询
   */
  private buildEnhancedQuery(technology: string, features: string[]): string {
    // 组合技术领域和特征
    const featureKeywords = features.join(' OR ');
    return `${technology} ${featureKeywords}`;
  }

  /**
   * 计算相似度分数（简化版，使用关键词重叠）
   */
  private calculateSimilarity(query: string, content: string): number {
    const queryWords = new Set(query.toLowerCase().split(/\s+/));
    const contentWords = new Set(content.toLowerCase().split(/\s+/));

    let overlap = 0;
    for (const word of queryWords) {
      if (contentWords.has(word)) {
        overlap++;
      }
    }

    return queryWords.size > 0 ? overlap / queryWords.size : 0;
  }
}
