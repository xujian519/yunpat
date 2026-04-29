import { z } from 'zod';
import { EnhancedBaseTool, ToolCategory, ToolContext } from '@yunpat/core';

/**
 * Google 专利搜索结果
 */
export interface GooglePatentResult {
  /** 专利ID */
  patentId: string;
  /** 标题 */
  title: string;
  /** 摘要 */
  snippet: string;
  /** URL */
  url: string;
  /** 申请人 */
  assignee?: string;
  /** 公开日期 */
  publicationDate?: string;
  /** IPC分类号 */
  ipcCodes?: string[];
}

/**
 * Google Patents 爬虫工具
 *
 * 从 Google Patents 爬取专利数据
 */
export class GooglePatentsFetchTool extends EnhancedBaseTool<
  {
    query: string;
    page?: number;
    language?: string;
  },
  {
    results: GooglePatentResult[];
    total: number;
    page: number;
  }
> {
  readonly metadata = {
    name: 'google_patents_fetch',
    description: '从 Google Patents 爬取专利搜索结果',
    category: ToolCategory.PATENT,
    isConcurrencySafe: true,
    inputSchema: z.object({
      query: z.string().describe('搜索关键词'),
      page: z.number().optional().default(1).describe('页码'),
      language: z.string().optional().default('zh-CN').describe('语言代码'),
    }),
    outputSchema: z.object({
      results: z.array(
        z.object({
          patentId: z.string(),
          title: z.string(),
          snippet: z.string(),
          url: z.string(),
          assignee: z.string().optional(),
          publicationDate: z.string().optional(),
          ipcCodes: z.array(z.string()).optional(),
        })
      ),
      total: z.number(),
      page: z.number(),
    }),
    permissions: ['http:request'],
    version: '1.0.0',
    author: 'YunPat Team',
  };

  async execute(
    input: { query: string; page?: number; language?: string },
    _context: ToolContext
  ): Promise<{
    results: GooglePatentResult[];
    total: number;
    page: number;
  }> {
    const { query, page = 1, language = 'zh-CN' } = input;

    try {
      // 构建搜索 URL
      const encodedQuery = encodeURIComponent(query);
      const url = `https://patents.google.com/xhr/query?url=q%3D${encodedQuery}`;

      // 发送请求
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'Accept-Language': language,
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // 解析结果
      const results = this.parseGooglePatentsResponse(data);

      return {
        results,
        total: results.length, // Google API 不返回总数，使用结果数量
        page,
      };
    } catch (error) {
      throw new Error(
        `Google Patents fetch failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * 解析 Google Patents API 响应
   */
  private parseGooglePatentsResponse(data: any): GooglePatentResult[] {
    const results: GooglePatentResult[] = [];

    // Google Patents API 返回格式可能变化，这里做兼容处理
    if (!data || !data.results) {
      return results;
    }

    const patents = data.results;

    for (const patent of patents) {
      try {
        // 提取专利ID
        const patentId =
          patent.patent_id ||
          patent.id ||
          (patent.publication_number && patent.publication_number[0]);

        // 提取标题
        const title = patent.title || patent.patent_title || '';

        // 提取摘要
        const snippet =
          patent.summary ||
          patent.abstract ||
          patent.description ||
          patent.snippet ||
          '';

        // 构建 URL
        const patentNumber = patent.publication_number
          ? patent.publication_number[0]
          : patentId;
        const url = `https://patents.google.com/patent/${patentNumber}/`;

        // 提取申请人
        const assignee =
          patent.assignee_harmonized ||
          (patent.assignee && patent.assignee[0]) ||
          '';

        // 提取公开日期
        const publicationDate =
          patent.publication_date ||
          patent.filing_date ||
          (patent.publication_date && patent.publication_date[0]) ||
          '';

        // 提取 IPC 分类号
        const ipcCodes =
          patent.ipc_codes ||
          (patent.classifications &&
            patent.classifications.map((c: any) => c.code)) ||
          [];

        results.push({
          patentId: patentId || '',
          title,
          snippet,
          url,
          assignee,
          publicationDate,
          ipcCodes,
        });
      } catch (error) {
        // 跳过解析失败的记录
        console.warn('Failed to parse patent result:', error);
        continue;
      }
    }

    return results;
  }
}

/**
 * Google 专利详情获取工具
 *
 * 获取专利的详细信息，包括权利要求、说明书等
 */
export class GooglePatentDetailTool extends EnhancedBaseTool<
  {
    patentNumber: string;
    language?: string;
  },
  {
    patentNumber: string;
    title: string;
    abstract: string;
    claims: string[];
    description: string;
    ipcCodes: string[];
    applicant: string;
    inventor: string[];
    publicationDate: string;
    filingDate: string;
  }
> {
  readonly metadata = {
    name: 'google_patent_detail',
    description: '从 Google Patents 获取专利详细信息',
    category: ToolCategory.PATENT,
    isConcurrencySafe: true,
    inputSchema: z.object({
      patentNumber: z.string().describe('专利号（如 CN123456789A）'),
      language: z.string().optional().default('zh-CN').describe('语言代码'),
    }),
    outputSchema: z.object({
      patentNumber: z.string(),
      title: z.string(),
      abstract: z.string(),
      claims: z.array(z.string()),
      description: z.string(),
      ipcCodes: z.array(z.string()),
      applicant: z.string(),
      inventor: z.array(z.string()),
      publicationDate: z.string(),
      filingDate: z.string(),
    }),
    permissions: ['http:request'],
    version: '1.0.0',
    author: 'YunPat Team',
  };

  async execute(
    input: { patentNumber: string; language?: string },
    _context: ToolContext
  ): Promise<{
    patentNumber: string;
    title: string;
    abstract: string;
    claims: string[];
    description: string;
    ipcCodes: string[];
    applicant: string;
    inventor: string[];
    publicationDate: string;
    filingDate: string;
  }> {
    const { patentNumber, language = 'zh-CN' } = input;

    try {
      // 构建详情页 URL
      const url = `https://patents.google.com/patent/${patentNumber}/`;

      // 发送请求
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept-Language': language,
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();

      // 解析 HTML
      return this.parsePatentDetail(html, patentNumber);
    } catch (error) {
      throw new Error(
        `Google Patent detail fetch failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * 解析专利详情页 HTML
   */
  private parsePatentDetail(html: string, patentNumber: string): {
    patentNumber: string;
    title: string;
    abstract: string;
    claims: string[];
    description: string;
    ipcCodes: string[];
    applicant: string;
    inventor: string[];
    publicationDate: string;
    filingDate: string;
  } {
    // 使用正则表达式提取关键信息
    // 注意：实际生产环境建议使用专业的 HTML 解析库如 cheerio

    // 提取标题
    const titleMatch = html.match(/<title>(.+?)<\/title>/);
    const title = titleMatch ? titleMatch[1].replace(' - Google Patents', '').trim() : '';

    // 提取摘要
    const abstractMatch = html.match(/<meta name="description" content="([^"]+)"/);
    const abstract = abstractMatch ? abstractMatch[1] : '';

    // 提取权利要求（简化版）
    const claims: string[] = [];
    const claimsSectionMatch = html.match(/<section[^>]*id="claims"[^>]*>([\s\S]+?)<\/section>/);
    if (claimsSectionMatch) {
      const claimsText = claimsSectionMatch[1];
      // 提取每个权利要求
      const claimMatches = claimsText.match(/<div[^>]*class="claim-text"[^>]*>(.+?)<\/div>/g);
      if (claimMatches) {
        claims.push(...claimMatches.map((c) => this.stripHtml(c)));
      }
    }

    // 提取 IPC 分类号
    const ipcCodes: string[] = [];
    const ipcMatches = html.match(/<span[^>]*itemprop="ipcCode"[^>]*>(.+?)<\/span>/g);
    if (ipcMatches) {
      ipcCodes.push(...ipcMatches.map((c) => this.stripHtml(c)));
    }

    // 提取申请人
    const applicantMatch = html.match(/<span[^>]*itemprop="assignee"[^>]*>(.+?)<\/span>/);
    const applicant = applicantMatch ? this.stripHtml(applicantMatch[1]) : '';

    // 提取发明人
    const inventor: string[] = [];
    const inventorMatches = html.match(/<span[^>]*itemprop="inventor"[^>]*>(.+?)<\/span>/g);
    if (inventorMatches) {
      inventor.push(...inventorMatches.map((c) => this.stripHtml(c)));
    }

    // 提取公开日期和申请日期
    const publicationDateMatch = html.match(
      /<time[^>]*itemprop="publicationDate"[^>]*>(.+?)<\/time>/
    );
    const publicationDate = publicationDateMatch ? publicationDateMatch[1] : '';

    const filingDateMatch = html.match(/<time[^>]*itemprop="filingDate"[^>]*>(.+?)<\/time>/);
    const filingDate = filingDateMatch ? filingDateMatch[1] : '';

    // 提取说明书（简化版）
    const description = abstract; // 简化处理，实际应该提取详细描述

    return {
      patentNumber,
      title,
      abstract,
      claims,
      description,
      ipcCodes,
      applicant,
      inventor,
      publicationDate,
      filingDate,
    };
  }

  /**
   * 移除 HTML 标签
   */
  private stripHtml(html: string): string {
    return html.replace(/<[^>]+>/g, '').trim();
  }
}
