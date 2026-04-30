import { z } from 'zod';
import { EnhancedBaseTool, ToolCategory, ToolContext } from '@yunpat/core';

/**
 * Web Fetch 工具
 *
 * 获取网页内容
 */
export class WebFetchTool extends EnhancedBaseTool<
  {
    url: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    headers?: Record<string, string>;
    body?: string;
    timeout?: number;
  },
  {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: string;
  }
> {
  readonly metadata = {
    name: 'web_fetch',
    description: '发送 HTTP 请求并获取响应内容',
    category: ToolCategory.NETWORK,
    isConcurrencySafe: true,
    inputSchema: z.object({
      url: z.string().url().describe('要请求的 URL'),
      method: z
        .enum(['GET', 'POST', 'PUT', 'DELETE'])
        .optional()
        .default('GET')
        .describe('HTTP 方法'),
      headers: z.record(z.string()).optional().describe('请求头'),
      body: z.string().optional().describe('请求体（POST/PUT）'),
      timeout: z.number().optional().default(30000).describe('超时时间（毫秒）'),
    }),
    outputSchema: z.object({
      status: z.number().describe('HTTP 状态码'),
      statusText: z.string().describe('HTTP 状态文本'),
      headers: z.record(z.string()).describe('响应头'),
      body: z.string().describe('响应体'),
    }),
    permissions: ['http:request'],
    version: '1.0.0',
    author: 'YunPat Team',
  };

  async execute(
    input: {
      url: string;
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
      headers?: Record<string, string>;
      body?: string;
      timeout?: number;
    },
    _context: ToolContext
  ): Promise<{
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: string;
  }> {
    const { url, method = 'GET', headers = {}, body, timeout = 30000 } = input;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        method,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; YunPat/1.0; +https://yunpat.dev)',
          ...headers,
        },
        body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      const responseBody = await response.text();

      return {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        body: responseBody,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeout}ms`);
      }

      throw new Error(
        `HTTP request failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

/**
 * Web Search 工具
 *
 * 使用搜索引擎搜索网页
 */
export class WebSearchTool extends EnhancedBaseTool<
  {
    query: string;
    numResults?: number;
    lang?: string;
  },
  {
    results: Array<{
      title: string;
      url: string;
      snippet: string;
    }>;
  }
> {
  readonly metadata = {
    name: 'web_search',
    description: '使用搜索引擎搜索网页',
    category: ToolCategory.NETWORK,
    isConcurrencySafe: true,
    inputSchema: z.object({
      query: z.string().describe('搜索查询'),
      numResults: z.number().optional().default(10).describe('返回结果数量'),
      lang: z.string().optional().default('zh-CN').describe('语言代码'),
    }),
    outputSchema: z.object({
      results: z.array(
        z.object({
          title: z.string(),
          url: z.string(),
          snippet: z.string(),
        })
      ),
    }),
    permissions: ['http:request'],
    version: '1.0.0',
    author: 'YunPat Team',
  };

  async execute(
    input: { query: string; numResults?: number; lang?: string },
    _context: ToolContext
  ): Promise<{
    results: Array<{
      title: string;
      url: string;
      snippet: string;
    }>;
  }> {
    const { query, numResults = 10, lang = 'zh-CN' } = input;

    try {
      // 使用 DuckDuckGo Instant Answer API（无需 API Key）
      const searchUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(
        query
      )}&format=json&no_html=1&skip_disambig=0`;

      const response = await fetch(searchUrl);
      const data = (await response.json()) as any;

      // DuckDuckGo API 返回格式有限，这里做简单处理
      const results: Array<{
        title: string;
        url: string;
        snippet: string;
      }> = [];

      // 如果有 RelatedTopics，转换为结果格式
      if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
        for (const topic of data.RelatedTopics) {
          if (results.length >= numResults) {
            break;
          }

          if (topic.Text && topic.FirstURL) {
            results.push({
              title: topic.Text.substring(0, 100),
              url: topic.FirstURL,
              snippet: topic.Text,
            });
          }
        }
      }

      // 如果没有结果，返回一个占位符
      if (results.length === 0) {
        results.push({
          title: 'Search performed',
          url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
          snippet: `No direct results from API. Click to search on Google.`,
        });
      }

      return { results };
    } catch (error) {
      throw new Error(
        `Web search failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
