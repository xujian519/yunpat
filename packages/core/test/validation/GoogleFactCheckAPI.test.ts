import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  GoogleFactCheckAPI,
  createGoogleFactCheckAPI,
} from '../../src/validation/providers/GoogleFactCheckAPI.js';
import { FactCheckError } from '../../src/validation/ExternalFactChecker.js';

const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe('GoogleFactCheckAPI', () => {
  let api: GoogleFactCheckAPI;

  beforeEach(() => {
    vi.clearAllMocks();
    api = new GoogleFactCheckAPI({ apiKey: 'test-key' });
  });

  describe('constructor', () => {
    it('应该使用自定义配置', () => {
      const a = new GoogleFactCheckAPI({
        apiKey: 'key',
        baseURL: 'https://custom.api.com',
        defaultLanguage: 'en',
        defaultPageSize: 20,
        timeout: 5000,
      });
      const config = a.getConfig();
      expect(config.isConfigured).toBe(true);
      expect(config.baseURL).toBe('https://custom.api.com');
      expect(config.defaultLanguage).toBe('en');
      expect(config.defaultPageSize).toBe(20);
      expect(config.timeout).toBe(5000);
    });

    it('应该使用环境变量', () => {
      process.env.GOOGLE_FACT_CHECK_API_KEY = 'env-key';
      const a = new GoogleFactCheckAPI();
      expect(a.getConfig().isConfigured).toBe(true);
      delete process.env.GOOGLE_FACT_CHECK_API_KEY;
    });

    it('应该在未配置时警告', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      new GoogleFactCheckAPI();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('未配置'));
      warnSpy.mockRestore();
    });
  });

  describe('searchClaims', () => {
    it('应该在未配置时抛出错误', async () => {
      const a = new GoogleFactCheckAPI();
      await expect(a.searchClaims('test')).rejects.toThrow(FactCheckError);
    });

    it('应该成功搜索声明', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            claims: [
              {
                text: '声明1',
                claimant: ['某人'],
                claimDate: '2024-01-01',
                claimReview: [
                  {
                    publisher: { name: 'Publisher1' },
                    url: 'http://example.com',
                    textualRating: 'True',
                    reviewDate: '2024-01-02',
                  },
                ],
              },
            ],
            nextPageToken: 'token123',
          }),
      });

      const result = await api.searchClaims('查询');
      expect(result.claims).toHaveLength(1);
      expect(result.claims[0].text).toBe('声明1');
      expect(result.metadata.nextPageToken).toBe('token123');
    });

    it('应该处理空结果', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const result = await api.searchClaims('查询');
      expect(result.claims).toHaveLength(0);
    });

    it('应该传递分页参数', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ claims: [] }),
      });

      await api.searchClaims('查询', { pageSize: 5, pageToken: 'token', maxAgeDays: 30 });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('pageSize=5'),
        expect.anything()
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('pageToken=token'),
        expect.anything()
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('maxAgeDays=30'),
        expect.anything()
      );
    });

    it('应该处理API错误', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: () => Promise.resolve(''),
        json: () => Promise.resolve({ error: { message: 'invalid key' } }),
      });

      await expect(api.searchClaims('查询')).rejects.toThrow(FactCheckError);
    });

    it('应该处理API错误（无JSON）', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Server Error',
        text: () => Promise.resolve(''),
      });

      await expect(api.searchClaims('查询')).rejects.toThrow(FactCheckError);
    });

    it('应该处理网络错误', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(api.searchClaims('查询')).rejects.toThrow(FactCheckError);
    });
  });

  describe('verifyClaim', () => {
    it('应该返回UNKNOWN（无结果）', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ claims: [] }),
      });

      const result = await api.verifyClaim('测试声明');
      expect(result.isValid).toBe('UNKNOWN');
      expect(result.confidence).toBe(0);
    });

    it('应该返回UNKNOWN（无评审）', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            claims: [{ text: '声明', claimReview: [] }],
          }),
      });

      const result = await api.verifyClaim('测试声明');
      expect(result.isValid).toBe('UNKNOWN');
      expect(result.confidence).toBe(0.3);
    });

    it('应该验证声明为TRUE', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            claims: [
              {
                text: '测试声明',
                claimReview: [
                  { publisher: { name: 'A' }, url: 'http://a.com', textualRating: 'True' },
                ],
              },
            ],
          }),
      });

      const result = await api.verifyClaim('测试声明');
      expect(result.isValid).toBe('TRUE');
      expect(result.sources).toHaveLength(1);
    });
  });

  describe('verifyClaims', () => {
    it('应该批量验证', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ claims: [] }),
      });

      const results = await api.verifyClaims(['声明1', '声明2']);
      expect(results).toHaveLength(2);
      expect(results[0].isValid).toBe('UNKNOWN');
    });

    it('应该处理单个失败', async () => {
      mockFetch.mockRejectedValueOnce(new Error('error')).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ claims: [] }),
      });

      const results = await api.verifyClaims(['声明1', '声明2']);
      expect(results).toHaveLength(2);
      expect(results[0].isValid).toBe('UNKNOWN');
    });
  });

  describe('normalizeRating', () => {
    it('应该归一化TRUE评级', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            claims: [
              {
                text: '声明',
                claimReview: [{ publisher: { name: 'A' }, url: 'http://a.com', textualRating: 'Accurate' }],
              },
            ],
          }),
      });

      const result = await api.verifyClaim('声明');
      expect(result.isValid).toBe('TRUE');
    });

    it('应该归一化FALSE评级', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            claims: [
              {
                text: '声明',
                claimReview: [{ publisher: { name: 'A' }, url: 'http://a.com', textualRating: 'False' }],
              },
            ],
          }),
      });

      const result = await api.verifyClaim('声明');
      expect(result.isValid).toBe('FALSE');
    });

    it('应该归一化MIXED评级', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            claims: [
              {
                text: '声明',
                claimReview: [{ publisher: { name: 'A' }, url: 'http://a.com', textualRating: 'Mixed' }],
              },
            ],
          }),
      });

      const result = await api.verifyClaim('声明');
      expect(result.isValid).toBe('MIXED');
    });

    it('应该归一化中文评级', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            claims: [
              {
                text: '声明',
                claimReview: [{ publisher: { name: 'A' }, url: 'http://a.com', textualRating: '准确' }],
              },
            ],
          }),
      });

      const result = await api.verifyClaim('声明');
      expect(result.isValid).toBe('TRUE');
    });
  });

  describe('calculateSimilarity', () => {
    it('应该计算完全相同的文本', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            claims: [
              {
                text: '完全相同的声明',
                claimReview: [{ publisher: { name: 'A' }, url: 'http://a.com', textualRating: 'True' }],
              },
              {
                text: '不同的声明内容',
                claimReview: [{ publisher: { name: 'B' }, url: 'http://b.com', textualRating: 'False' }],
              },
            ],
          }),
      });

      const result = await api.verifyClaim('完全相同的声明');
      expect(result.isValid).toBe('TRUE');
    });
  });

  describe('calculateConfidence', () => {
    it('应该计算高置信度（一致评审）', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            claims: [
              {
                text: '声明',
                claimReview: [
                  { publisher: { name: 'A' }, url: 'http://a.com', textualRating: 'True' },
                  { publisher: { name: 'B' }, url: 'http://b.com', textualRating: 'True' },
                ],
              },
            ],
          }),
      });

      const result = await api.verifyClaim('声明');
      expect(result.confidence).toBeGreaterThan(0.5);
    });
  });

  describe('getConfig', () => {
    it('应该返回配置', () => {
      const config = api.getConfig();
      expect(config.isConfigured).toBe(true);
      expect(config.baseURL).toBe('https://factchecktools.googleapis.com/v1alpha1');
    });
  });

  describe('createGoogleFactCheckAPI', () => {
    it('应该创建实例', () => {
      const a = createGoogleFactCheckAPI({ apiKey: 'key' });
      expect(a.getConfig().isConfigured).toBe(true);
    });
  });
});
