/**
 * 外部事实验证器测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ExternalFactChecker,
  FactCheckError,
  aggregateResults,
  calculateConsensus,
  getSourceWeight,
  type ExternalFactCheckOptions,
  type ExternalFactCheckResult,
  type GoogleFactCheckResponse,
} from '../../src/validation/ExternalFactChecker.js';
import { GoogleFactCheckAPI } from '../../src/validation/providers/GoogleFactCheckAPI.js';

describe('ExternalFactChecker', () => {
  let checker: ExternalFactChecker;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // 设置测试环境变量
    process.env.GOOGLE_FACT_CHECK_API_KEY = 'test-api-key';

    // Mock fetch
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    checker = new ExternalFactChecker({
      enableCache: true,
      cacheTTL: 1000,
      rateLimit: 10,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.GOOGLE_FACT_CHECK_API_KEY;
  });

  describe('初始化', () => {
    it('应该使用提供的 API Key 初始化', () => {
      const customChecker = new ExternalFactChecker({
        apiKey: 'custom-key',
      });
      expect(customChecker).toBeDefined();
    });

    it('应该从环境变量读取 API Key', () => {
      expect(checker).toBeDefined();
    });

    it('没有 API Key 时应该发出警告', () => {
      const consoleWarn = vi.spyOn(console, 'warn');
      delete process.env.GOOGLE_FACT_CHECK_API_KEY;
      new ExternalFactChecker();
      expect(consoleWarn).toHaveBeenCalledWith(
        'Google Fact Check API Key 未设置，外部验证功能将不可用'
      );
    });
  });

  describe('验证单个声明', () => {
    it('应该成功验证声明', async () => {
      const mockResponse: GoogleFactCheckResponse = {
        claims: [
          {
            text: '地球是圆的',
            claimReview: [
              {
                publisher: { name: '科学日报', site: 'https://science-daily.com' },
                textualRating: 'True',
                url: 'https://science-daily.com/earth-is-round',
                reviewDate: '2023-01-01',
              },
            ],
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await checker.verifyClaim('地球是圆的');

      expect(result.claim).toBe('地球是圆的');
      expect(result.isValid).toBe('TRUE');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.sources).toHaveLength(1);
      expect(result.sources[0].name).toBe('科学日报');
    });

    it('应该处理没有结果的声明', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ claims: [] }),
      });

      const result = await checker.verifyClaim('无匹配声明');

      expect(result.claim).toBe('无匹配声明');
      expect(result.isValid).toBe('UNKNOWN');
      expect(result.confidence).toBe(0);
      expect(result.sources).toHaveLength(0);
    });

    it('应该处理没有评审的声明', async () => {
      const mockResponse: GoogleFactCheckResponse = {
        claims: [
          {
            text: '某个声明',
            claimReview: [],
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await checker.verifyClaim('某个声明');

      expect(result.isValid).toBe('UNKNOWN');
      expect(result.confidence).toBe(0.3);
    });

    it('应该正确解析各种评级', async () => {
      const testCases = [
        { rating: 'True', expected: 'TRUE' },
        { rating: 'Accurate', expected: 'TRUE' },
        { rating: '准确', expected: 'TRUE' },
        { rating: 'False', expected: 'FALSE' },
        { rating: 'Inaccurate', expected: 'FALSE' },
        { rating: '错误', expected: 'FALSE' },
        { rating: 'Mixed', expected: 'MIXED' },
        { rating: '部分真实', expected: 'MIXED' },
      ];

      for (let i = 0; i < testCases.length; i++) {
        const testCase = testCases[i];
        const mockResponse: GoogleFactCheckResponse = {
          claims: [
            {
              text: `测试声明${i}`,
              claimReview: [
                {
                  publisher: { name: '测试来源', site: 'https://test.com' },
                  textualRating: testCase.rating,
                  url: 'https://test.com/review',
                },
              ],
            },
          ],
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });

        const result = await checker.verifyClaim(`测试声明${i}`);
        expect(result.isValid).toBe(testCase.expected);
      }
    });

    it('应该处理 API 错误', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
      });

      await expect(checker.verifyClaim('测试声明')).rejects.toThrow(
        FactCheckError
      );
    });

    it('应该处理网络错误', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(checker.verifyClaim('测试声明')).rejects.toThrow(
        FactCheckError
      );
    });

    it('应该支持自定义选项', async () => {
      const options: ExternalFactCheckOptions = {
        language: 'en',
        pageSize: 5,
        maxAgeDays: 30,
        timeout: 5000,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ claims: [] }),
      });

      await checker.verifyClaim('test claim', options);

      const callArgs = mockFetch.mock.calls[0];
      const url = new URL(callArgs[0]);
      expect(url.searchParams.get('languageCodes')).toBe('en');
      expect(url.searchParams.get('pageSize')).toBe('5');
      expect(url.searchParams.get('maxAgeDays')).toBe('30');
    });
  });

  describe('批量验证', () => {
    it('应该验证多个声明', async () => {
      const mockResponse: GoogleFactCheckResponse = {
        claims: [
          {
            text: '声明1',
            claimReview: [
              {
                publisher: { name: '来源1', site: 'https://source1.com' },
                textualRating: 'True',
                url: 'https://source1.com/1',
              },
            ],
          },
        ],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const results = await checker.verifyClaims(['声明1', '声明2']);

      expect(results).toHaveLength(2);
      expect(results[0].claim).toBe('声明1');
      expect(results[1].claim).toBe('声明2');
    });

    it('应该处理部分失败', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ claims: [] }),
        })
        .mockRejectedValueOnce(new Error('Network error'));

      const results = await checker.verifyClaims(['声明1', '声明2']);

      expect(results).toHaveLength(2);
      expect(results[0].isValid).toBe('UNKNOWN');
      expect(results[1].isValid).toBe('UNKNOWN');
    });
  });

  describe('缓存功能', () => {
    it('应该缓存验证结果', async () => {
      const mockResponse: GoogleFactCheckResponse = {
        claims: [
          {
            text: '缓存测试',
            claimReview: [
              {
                publisher: { name: '来源', site: 'https://source.com' },
                textualRating: 'True',
                url: 'https://source.com/test',
              },
            ],
          },
        ],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      // 第一次调用
      await checker.verifyClaim('缓存测试');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // 第二次调用应该从缓存读取
      await checker.verifyClaim('缓存测试');
      expect(mockFetch).toHaveBeenCalledTimes(1); // 没有增加
    });

    it('应该处理缓存过期', async () => {
      const checkerWithShortTTL = new ExternalFactChecker({
        cacheTTL: 100, // 100ms TTL
      });

      const mockResponse: GoogleFactCheckResponse = {
        claims: [
          {
            text: '过期测试',
            claimReview: [
              {
                publisher: { name: '来源', site: 'https://source.com' },
                textualRating: 'True',
                url: 'https://source.com/test',
              },
            ],
          },
        ],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      // 第一次调用
      await checkerWithShortTTL.verifyClaim('过期测试');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // 等待缓存过期
      await new Promise((resolve) => setTimeout(resolve, 150));

      // 第二次调用应该重新请求
      await checkerWithShortTTL.verifyClaim('过期测试');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('应该能够清除缓存', async () => {
      const mockResponse: GoogleFactCheckResponse = {
        claims: [
          {
            text: '清除测试',
            claimReview: [
              {
                publisher: { name: '来源', site: 'https://source.com' },
                textualRating: 'True',
                url: 'https://source.com/test',
              },
            ],
          },
        ],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      // 第一次调用
      await checker.verifyClaim('清除测试');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // 清除缓存
      checker.clearCache();

      // 第二次调用应该重新请求
      await checker.verifyClaim('清除测试');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('应该返回缓存统计', () => {
      const stats = checker.getCacheStats();
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('keys');
      expect(Array.isArray(stats.keys)).toBe(true);
    });
  });

  describe('速率限制', () => {
    it('应该应用速率限制', async () => {
      const rateLimitedChecker = new ExternalFactChecker({
        rateLimit: 2, // 每秒2个请求
      });

      const mockResponse: GoogleFactCheckResponse = {
        claims: [],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const startTime = Date.now();
      // 顺序执行以测试速率限制
      await rateLimitedChecker.verifyClaim('声明1');
      await rateLimitedChecker.verifyClaim('声明2');
      await rateLimitedChecker.verifyClaim('声明3');
      const duration = Date.now() - startTime;

      // 3个请求，每秒2个（间隔500ms），应该至少需要1秒
      expect(duration).toBeGreaterThanOrEqual(1000);
    });
  });
});

describe('GoogleFactCheckAPI', () => {
  let api: GoogleFactCheckAPI;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    process.env.GOOGLE_FACT_CHECK_API_KEY = 'test-api-key';
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    api = new GoogleFactCheckAPI();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.GOOGLE_FACT_CHECK_API_KEY;
  });

  describe('搜索声明', () => {
    it('应该成功搜索声明', async () => {
      const mockResponse: GoogleFactCheckResponse = {
        claims: [
          {
            text: '测试声明',
            claimant: ['测试者'],
            claimDate: '2023-01-01',
            claimReview: [
              {
                publisher: { name: '评审者', site: 'https://reviewer.com' },
                textualRating: 'True',
                url: 'https://reviewer.com/test',
                reviewDate: '2023-01-02',
              },
            ],
          },
        ],
        nextPageToken: 'next-page-token',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await api.searchClaims('测试查询');

      expect(result.claims).toHaveLength(1);
      expect(result.claims[0].text).toBe('测试声明');
      expect(result.metadata.nextPageToken).toBe('next-page-token');
      expect(result.metadata.totalResults).toBe(1);
    });

    it('应该支持分页', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ claims: [] }),
      });

      await api.searchClaims('测试查询', { pageToken: 'some-token' });

      const callArgs = mockFetch.mock.calls[0];
      const url = new URL(callArgs[0]);
      expect(url.searchParams.get('pageToken')).toBe('some-token');
    });

    it('应该处理 API 错误响应', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: { message: 'Invalid request' } }),
      });

      await expect(api.searchClaims('测试查询')).rejects.toThrow(
        FactCheckError
      );
    });
  });

  describe('配置', () => {
    it('应该返回配置信息', () => {
      const config = api.getConfig();

      expect(config).toHaveProperty('isConfigured');
      expect(config).toHaveProperty('baseURL');
      expect(config).toHaveProperty('defaultLanguage');
      expect(config).toHaveProperty('defaultPageSize');
      expect(config).toHaveProperty('timeout');
    });
  });
});

describe('辅助函数', () => {
  describe('getSourceWeight', () => {
    it('应该返回正确的源权重', () => {
      expect(getSourceWeight('google_factcheck')).toBe(0.9);
      expect(getSourceWeight('knowledge_base')).toBe(0.8);
      expect(getSourceWeight('llm')).toBe(0.6);
      expect(getSourceWeight('snopes')).toBe(0.85);
      expect(getSourceWeight('unknown')).toBe(0.5);
    });
  });

  describe('calculateConsensus', () => {
    it('应该计算 TRUE 共识', () => {
      const results: ExternalFactCheckResult[] = [
        { claim: 'test', isValid: 'TRUE', confidence: 0.9, sources: [], source: 'google_factcheck', timestamp: new Date() },
        { claim: 'test', isValid: 'TRUE', confidence: 0.8, sources: [], source: 'knowledge_base', timestamp: new Date() },
        { claim: 'test', isValid: 'TRUE', confidence: 0.85, sources: [], source: 'llm', timestamp: new Date() },
      ];
      expect(calculateConsensus(results)).toBe('CONSENSUS_TRUE');
    });

    it('应该计算 FALSE 共识', () => {
      const results: ExternalFactCheckResult[] = [
        { claim: 'test', isValid: 'FALSE', confidence: 0.9, sources: [], source: 'google_factcheck', timestamp: new Date() },
        { claim: 'test', isValid: 'FALSE', confidence: 0.8, sources: [], source: 'knowledge_base', timestamp: new Date() },
        { claim: 'test', isValid: 'FALSE', confidence: 0.85, sources: [], source: 'llm', timestamp: new Date() },
      ];
      expect(calculateConsensus(results)).toBe('CONSENSUS_FALSE');
    });

    it('应该计算 MIXED 共识', () => {
      const results: ExternalFactCheckResult[] = [
        { claim: 'test', isValid: 'MIXED', confidence: 0.7, sources: [], source: 'google_factcheck', timestamp: new Date() },
        { claim: 'test', isValid: 'MIXED', confidence: 0.75, sources: [], source: 'knowledge_base', timestamp: new Date() },
        { claim: 'test', isValid: 'TRUE', confidence: 0.5, sources: [], source: 'llm', timestamp: new Date() },
      ];
      expect(calculateConsensus(results)).toBe('CONSENSUS_MIXED');
    });

    it('应该处理无共识情况', () => {
      const results: ExternalFactCheckResult[] = [
        { claim: 'test', isValid: 'TRUE', confidence: 0.5, sources: [], source: 'google_factcheck', timestamp: new Date() },
        { claim: 'test', isValid: 'FALSE', confidence: 0.5, sources: [], source: 'knowledge_base', timestamp: new Date() },
        { claim: 'test', isValid: 'MIXED', confidence: 0.5, sources: [], source: 'llm', timestamp: new Date() },
      ];
      expect(calculateConsensus(results)).toBe('NO_CONSENSUS');
    });

    it('应该处理空结果', () => {
      expect(calculateConsensus([])).toBe('NO_CONSENSUS');
    });
  });

  describe('aggregateResults', () => {
    it('应该聚合验证结果', () => {
      const results: ExternalFactCheckResult[] = [
        { claim: '测试声明', isValid: 'TRUE', confidence: 0.9, sources: [], source: 'google_factcheck', timestamp: new Date() },
        { claim: '测试声明', isValid: 'TRUE', confidence: 0.8, sources: [], source: 'knowledge_base', timestamp: new Date() },
      ];

      const aggregated = aggregateResults(results);

      expect(aggregated.claim).toBe('测试声明');
      expect(aggregated.confidence).toBeGreaterThan(0);
      expect(aggregated.sources).toContain('google_factcheck');
      expect(aggregated.sources).toContain('knowledge_base');
      expect(aggregated.consensus).toBe('CONSENSUS_TRUE');
      expect(aggregated.results).toEqual(results);
    });

    it('应该处理空结果列表', () => {
      expect(() => aggregateResults([])).toThrow(FactCheckError);
    });

    it('应该正确计算加权置信度', () => {
      const results: ExternalFactCheckResult[] = [
        { claim: '测试', isValid: 'TRUE', confidence: 1.0, sources: [], source: 'google_factcheck', timestamp: new Date() },
        { claim: '测试', isValid: 'TRUE', confidence: 0.5, sources: [], source: 'llm', timestamp: new Date() },
      ];

      const aggregated = aggregateResults(results);

      // google_factcheck 权重 0.9, llm 权重 0.6
      // (1.0 * 0.9 + 0.5 * 0.6) / 2 = (0.9 + 0.3) / 2 = 0.6
      expect(aggregated.confidence).toBeCloseTo(0.6, 1);
    });
  });
});
