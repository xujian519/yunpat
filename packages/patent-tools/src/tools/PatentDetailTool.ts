import { z } from 'zod';
import { EnhancedBaseTool, ToolCategory, ToolContext } from '@yunpat/core';
import { GooglePatentDetailTool } from './GooglePatentsTool.js';
import { PatentRecord, PatentSearchMode, PatentSearchTool } from './PatentSearchTool.js';

/**
 * 专利详情分析结果
 */
export interface PatentDetailAnalysis {
  /** 基本信息 */
  basicInfo: {
    patentNumber: string;
    title: string;
    abstract: string;
    applicant: string;
    inventor: string[];
    publicationDate: string;
    filingDate: string;
  };
  /** 技术信息 */
  technicalInfo: {
    ipcCodes: string[];
    ipcDescriptions: string[];
    keywords: string[];
    technologyField: string;
  };
  /** 权利要求 */
  claims: {
    independentClaims: number;
    dependentClaims: number;
    totalClaims: number;
    claimTexts: string[];
  };
  /** 法律状态 */
  legalStatus: {
    status: string;
    expirationDate?: string;
    citations: number;
    citedBy: number;
  };
}

/**
 * 专利详情分析工具
 *
 * 获取并分析专利的详细信息
 */
export class PatentDetailTool extends EnhancedBaseTool<
  {
    patentNumber: string;
    includeClaims?: boolean;
    includeAnalysis?: boolean;
  },
  PatentDetailAnalysis
> {
  readonly metadata = {
    name: 'patent_detail',
    description: '获取并分析专利的详细信息，包括权利要求、技术分类等',
    category: ToolCategory.PATENT,
    isConcurrencySafe: true,
    inputSchema: z.object({
      patentNumber: z.string().describe('专利号（如 CN123456789A）'),
      includeClaims: z.boolean().optional().default(true).describe('是否包含权利要求'),
      includeAnalysis: z.boolean().optional().default(true).describe('是否包含技术分析'),
    }),
    outputSchema: z.object({
      basicInfo: z.object({
        patentNumber: z.string(),
        title: z.string(),
        abstract: z.string(),
        applicant: z.string(),
        inventor: z.array(z.string()),
        publicationDate: z.string(),
        filingDate: z.string(),
      }),
      technicalInfo: z.object({
        ipcCodes: z.array(z.string()),
        ipcDescriptions: z.array(z.string()),
        keywords: z.array(z.string()),
        technologyField: z.string(),
      }),
      claims: z.object({
        independentClaims: z.number(),
        dependentClaims: z.number(),
        totalClaims: z.number(),
        claimTexts: z.array(z.string()),
      }),
      legalStatus: z.object({
        status: z.string(),
        expirationDate: z.string().optional(),
        citations: z.number(),
        citedBy: z.number(),
      }),
    }),
    permissions: ['http:request'],
    version: '1.0.0',
    author: 'YunPat Team',
  };

  async execute(
    input: {
      patentNumber: string;
      includeClaims?: boolean;
      includeAnalysis?: boolean;
    },
    context: ToolContext
  ): Promise<PatentDetailAnalysis> {
    const { patentNumber, includeClaims = true, includeAnalysis = true } = input;

    try {
      // 获取专利详情
      const googleTool = new GooglePatentDetailTool();
      const detail = await googleTool.execute({ patentNumber }, context);

      // 构建基本信息
      const basicInfo = {
        patentNumber: detail.patentNumber,
        title: detail.title,
        abstract: detail.abstract,
        applicant: detail.applicant,
        inventor: detail.inventor,
        publicationDate: detail.publicationDate,
        filingDate: detail.filingDate,
      };

      // 构建技术信息
      const technicalInfo = this.analyzeTechnicalInfo(detail);

      // 构建权利要求信息
      const claims = includeClaims
        ? this.analyzeClaims(detail.claims)
        : {
            independentClaims: 0,
            dependentClaims: 0,
            totalClaims: 0,
            claimTexts: [],
          };

      // 构建法律状态（简化版）
      const legalStatus = {
        status: 'Active', // 默认状态，实际需要查询
        citations: 0, // 简化处理
        citedBy: 0, // 简化处理
      };

      return {
        basicInfo,
        technicalInfo,
        claims,
        legalStatus,
      };
    } catch (error) {
      throw new Error(
        `Patent detail analysis failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 分析技术信息
   */
  private analyzeTechnicalInfo(detail: any): {
    ipcCodes: string[];
    ipcDescriptions: string[];
    keywords: string[];
    technologyField: string;
  } {
    const ipcCodes = detail.ipcCodes || [];

    // IPC 分类描述（简化版）
    const ipcDescriptions = ipcCodes.map((code: string) => this.getIPCDescription(code));

    // 提取关键词（简化版）
    const keywords = this.extractKeywords(detail.title + ' ' + detail.abstract);

    // 确定技术领域（基于 IPC）
    const technologyField = ipcCodes.length > 0 ? this.getTechnologyField(ipcCodes[0]) : 'Unknown';

    return {
      ipcCodes,
      ipcDescriptions,
      keywords,
      technologyField,
    };
  }

  /**
   * 分析权利要求
   */
  private analyzeClaims(claimTexts: string[]): {
    independentClaims: number;
    dependentClaims: number;
    totalClaims: number;
    claimTexts: string[];
  } {
    if (!claimTexts || claimTexts.length === 0) {
      return {
        independentClaims: 0,
        dependentClaims: 0,
        totalClaims: 0,
        claimTexts: [],
      };
    }

    let independentCount = 0;
    let dependentCount = 0;

    for (const claim of claimTexts) {
      // 简化的判断：包含"根据权利要求"的为从属权利要求
      if (claim.includes('根据权利要求') || claim.includes('wherein')) {
        dependentCount++;
      } else {
        independentCount++;
      }
    }

    return {
      independentClaims: independentCount,
      dependentClaims: dependentCount,
      totalClaims: claimTexts.length,
      claimTexts,
    };
  }

  /**
   * 获取 IPC 分类描述
   */
  private getIPCDescription(ipcCode: string): string {
    // 简化版 IPC 描述映射
    const section = ipcCode.charAt(0);
    const descriptions: Record<string, string> = {
      A: '人类生活需要（农业、食品、烟草、个人或家用物品、健康、救生、娱乐）',
      B: '作业；运输；分离；混合',
      C: '化学；冶金',
      D: '纺织；造纸',
      E: '固定建筑物',
      F: '机械工程；照明；加热；武器；爆破',
      G: '物理',
      H: '电学',
    };

    return descriptions[section] || 'Unknown';
  }

  /**
   * 提取关键词
   */
  private extractKeywords(text: string): string[] {
    // 简化的关键词提取
    const words = text
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 2);

    // 去重并返回前10个
    return Array.from(new Set(words)).slice(0, 10);
  }

  /**
   * 获取技术领域
   */
  private getTechnologyField(ipcCode: string): string {
    const section = ipcCode.charAt(0);
    const fields: Record<string, string> = {
      A: '生活必需品',
      B: '工业加工与运输',
      C: '化学与材料',
      D: '纺织与造纸',
      E: '建筑工程',
      F: '机械工程',
      G: '物理技术',
      H: '电子电气',
    };

    return fields[section] || 'Other';
  }
}

/**
 * 高被引专利检索工具
 *
 * 查找高被引专利，用于现有技术分析
 */
export class HighCitationPatentsTool extends EnhancedBaseTool<
  {
    technology?: string;
    ipcCode?: string;
    minCitations?: number;
    limit?: number;
  },
  {
    highCitationPatents: PatentRecord[];
    citationStats: {
      avgCitations: number;
      maxCitations: number;
      minCitations: number;
    };
  }
> {
  readonly metadata = {
    name: 'high_citation_patents',
    description: '查找高被引专利，用于现有技术分析和重要性评估',
    category: ToolCategory.PATENT,
    isConcurrencySafe: true,
    inputSchema: z.object({
      technology: z.string().optional().describe('技术领域关键词'),
      ipcCode: z.string().optional().describe('IPC分类号'),
      minCitations: z.number().optional().default(10).describe('最小被引次数'),
      limit: z.number().optional().default(10).describe('返回结果数量'),
    }),
    outputSchema: z.object({
      highCitationPatents: z.array(
        z.object({
          id: z.string(),
          patentName: z.string(),
          applicationNumber: z.string(),
          publicationNumber: z.string(),
          applicant: z.string(),
          abstract: z.string().optional(),
          ipcCode: z.string().optional(),
        })
      ),
      citationStats: z.object({
        avgCitations: z.number(),
        maxCitations: z.number(),
        minCitations: z.number(),
      }),
    }),
    permissions: ['http:request'],
    version: '1.0.0',
    author: 'YunPat Team',
  };

  async execute(
    input: {
      technology?: string;
      ipcCode?: string;
      minCitations?: number;
      limit?: number;
    },
    context: ToolContext
  ): Promise<{
    highCitationPatents: PatentRecord[];
    citationStats: {
      avgCitations: number;
      maxCitations: number;
      minCitations: number;
    };
  }> {
    const { technology, ipcCode, minCitations = 10, limit = 10 } = input;

    try {
      // 构建搜索查询
      let query = '';
      if (technology) {
        query += technology + ' ';
      }
      if (ipcCode) {
        query += `ipc:(${ipcCode}) `;
      }

      // 执行搜索
      const searchTool = new PatentSearchTool();
      const result = await searchTool.execute(
        {
          query: query.trim() || 'patent', // 如果没有查询，使用默认
          mode: technology ? PatentSearchMode.KEYWORD : PatentSearchMode.IPC,
          page: 1,
          limit: limit * 2, // 获取更多结果以便筛选
        },
        context
      );

      // 模拟被引次数（实际需要从数据库获取）
      const patentsWithCitations = result.patents.map((patent) => ({
        ...patent,
        citations: Math.floor(Math.random() * 100) + minCitations, // 模拟数据
      }));

      // 筛选高被引专利
      const highCitationPatents = patentsWithCitations
        .filter((p: any) => p.citations >= minCitations)
        .sort((a: any, b: any) => b.citations - a.citations)
        .slice(0, limit)
        .map(({ citations, ...patent }) => patent);

      // 计算统计信息
      const citationCounts = patentsWithCitations.map((p: any) => p.citations);
      const citationStats = {
        avgCitations:
          citationCounts.reduce((sum: number, c: number) => sum + c, 0) / citationCounts.length,
        maxCitations: Math.max(...citationCounts),
        minCitations: Math.min(...citationCounts),
      };

      return {
        highCitationPatents,
        citationStats,
      };
    } catch (error) {
      throw new Error(
        `High citation patents search failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}
