import { describe, it, expect, vi } from 'vitest';
import { CardGenerator } from '../../src/knowledge/CardGenerator.js';
import type { LLMAdapter } from '../../src/lifecycle/Lifecycle.js';

const mockLLM: LLMAdapter = {
  chat: vi.fn(),
  chatStream: vi.fn().mockImplementation(async function* () {
    yield { message: { role: 'assistant', content: 'test' } };
  }),
  embed: vi.fn().mockResolvedValue([[0.1, 0.2]]),
};

describe('CardGenerator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('应该使用默认配置创建', () => {
      const generator = new CardGenerator({ llm: mockLLM });
      expect(generator).toBeDefined();
    });

    it('应该接受自定义配置', () => {
      const generator = new CardGenerator({
        llm: mockLLM,
        qualityThreshold: 0.8,
        maxCardsPerPage: 5,
      });
      expect(generator).toBeDefined();
    });
  });

  describe('generateFromPage', () => {
    it('应该生成知识卡片', async () => {
      const generator = new CardGenerator({ llm: mockLLM });
      const mockResponse = {
        message: {
          role: 'assistant',
          content: JSON.stringify({
            question: '什么是创造性？',
            content: '创造性是指...',
            tags: ['创造性', '专利授权'],
            quality: 0.9,
          }),
        },
      };
      vi.mocked(mockLLM.chat).mockResolvedValueOnce(mockResponse);

      const cards = await generator.generateFromPage(
        'path/to/page',
        '创造性是指与现有技术相比具有突出的实质性特点。',
        '创造性判断',
        '创造性',
        '专利授权'
      );

      expect(cards.length).toBeGreaterThan(0);
      expect(cards[0].question).toBe('什么是创造性？');
      expect(cards[0].concept).toBe('创造性');
      expect(cards[0].domain).toBe('专利授权');
    });

    it('应该过滤低质量卡片', async () => {
      const generator = new CardGenerator({ llm: mockLLM, qualityThreshold: 0.8 });
      const mockResponse = {
        message: {
          role: 'assistant',
          content: JSON.stringify({
            question: '低质量问题',
            content: '内容',
            tags: ['标签'],
            quality: 0.5,
          }),
        },
      };
      vi.mocked(mockLLM.chat).mockResolvedValueOnce(mockResponse);

      const cards = await generator.generateFromPage(
        'path',
        '内容',
        '标题',
        '概念',
        '领域'
      );

      expect(cards.length).toBe(0);
    });

    it('应该截断过长的内容', async () => {
      const generator = new CardGenerator({ llm: mockLLM });
      const longContent = 'a'.repeat(10000);
      const mockResponse = {
        message: {
          role: 'assistant',
          content: JSON.stringify({
            question: '测试',
            content: '内容',
            tags: ['标签'],
            quality: 0.9,
          }),
        },
      };
      vi.mocked(mockLLM.chat).mockResolvedValueOnce(mockResponse);

      await generator.generateFromPage('path', longContent, '标题', '概念', '领域');

      const callArgs = vi.mocked(mockLLM.chat).mock.calls[0][0];
      expect((callArgs.messages[1].content as string).length).toBeLessThan(10000);
    });

    it('应该在 LLM 调用失败时抛出错误', async () => {
      const generator = new CardGenerator({ llm: mockLLM });
      vi.mocked(mockLLM.chat).mockRejectedValueOnce(new Error('LLM 错误'));

      await expect(
        generator.generateFromPage('path', '内容', '标题', '概念', '领域')
      ).rejects.toThrow();
    });
  });

  describe('generateFromConcept', () => {
    it('应该从多个页面生成卡片', async () => {
      const generator = new CardGenerator({ llm: mockLLM });
      const mockResponse = {
        message: {
          role: 'assistant',
          content: JSON.stringify({
            question: '问题1',
            content: '内容1',
            tags: ['标签'],
            quality: 0.9,
          }),
        },
      };
      vi.mocked(mockLLM.chat).mockResolvedValue(mockResponse);

      const cards = await generator.generateFromConcept('创造性', '专利授权', [
        { path: 'page1', content: '内容1', title: '标题1' },
        { path: 'page2', content: '内容2', title: '标题2' },
      ]);

      expect(cards.length).toBeGreaterThan(0);
    });

    it('应该处理页面生成失败', async () => {
      const generator = new CardGenerator({ llm: mockLLM });
      vi.mocked(mockLLM.chat)
        .mockRejectedValueOnce(new Error('错误'))
        .mockResolvedValueOnce({
          message: {
            role: 'assistant',
            content: JSON.stringify({
              question: '问题',
              content: '内容',
              tags: ['标签'],
              quality: 0.9,
            }),
          },
        });

      const cards = await generator.generateFromConcept('创造性', '专利授权', [
        { path: 'page1', content: '内容1', title: '标题1' },
        { path: 'page2', content: '内容2', title: '标题2' },
      ]);

      expect(cards.length).toBeGreaterThan(0);
    });

    it('应该限制总卡片数', async () => {
      const generator = new CardGenerator({ llm: mockLLM, maxCardsPerPage: 1 });
      const mockResponse = {
        message: {
          role: 'assistant',
          content: JSON.stringify({
            question: '问题',
            content: '内容',
            tags: ['标签'],
            quality: 0.9,
          }),
        },
      };
      vi.mocked(mockLLM.chat).mockResolvedValue(mockResponse);

      const cards = await generator.generateFromConcept('创造性', '专利授权', [
        { path: 'page1', content: '内容1', title: '标题1' },
        { path: 'page2', content: '内容2', title: '标题2' },
        { path: 'page3', content: '内容3', title: '标题3' },
      ]);

      expect(cards.length).toBeLessThanOrEqual(3);
    });

    it('应该去重', async () => {
      const generator = new CardGenerator({ llm: mockLLM });
      const mockResponse = {
        message: {
          role: 'assistant',
          content: JSON.stringify([
            {
              question: '相同问题',
              content: '内容1',
              tags: ['标签'],
              quality: 0.9,
            },
            {
              question: '相同问题',
              content: '内容2',
              tags: ['标签'],
              quality: 0.8,
            },
          ]),
        },
      };
      vi.mocked(mockLLM.chat).mockResolvedValue(mockResponse);

      const cards = await generator.generateFromConcept('创造性', '专利授权', [
        { path: 'page1', content: '内容1', title: '标题1' },
      ]);

      expect(cards.length).toBe(1);
    });
  });

  describe('assessQuality', () => {
    it('应该评估卡片质量', async () => {
      const generator = new CardGenerator({ llm: mockLLM });
      const mockResponse = {
        message: {
          role: 'assistant',
          content: JSON.stringify({
            quality: 0.85,
            issues: ['缺少案例'],
          }),
        },
      };
      vi.mocked(mockLLM.chat).mockResolvedValueOnce(mockResponse);

      const result = await generator.assessQuality({
        id: 'test',
        question: '测试问题',
        content: '测试内容',
        sourcePages: [],
        relatedCards: [],
        concept: '测试',
        domain: '测试领域',
        quality: 0.5,
        tags: [],
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: { generator: 'test', llmModel: 'test', tokenCount: 10, referenceCount: 0 },
      });

      expect(result.quality).toBe(0.85);
      expect(result.issues).toContain('缺少案例');
    });

    it('应该在评估失败时返回原始质量', async () => {
      const generator = new CardGenerator({ llm: mockLLM });
      vi.mocked(mockLLM.chat).mockRejectedValueOnce(new Error('评估失败'));

      const result = await generator.assessQuality({
        id: 'test',
        question: '测试问题',
        content: '测试内容',
        sourcePages: [],
        relatedCards: [],
        concept: '测试',
        domain: '测试领域',
        quality: 0.6,
        tags: [],
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: { generator: 'test', llmModel: 'test', tokenCount: 10, referenceCount: 0 },
      });

      expect(result.quality).toBe(0.6);
      expect(result.issues).toEqual([]);
    });

    it('应该处理无效 JSON 响应', async () => {
      const generator = new CardGenerator({ llm: mockLLM });
      vi.mocked(mockLLM.chat).mockResolvedValueOnce({
        message: { role: 'assistant', content: '无效的响应' },
      });

      const result = await generator.assessQuality({
        id: 'test',
        question: '测试问题',
        content: '测试内容',
        sourcePages: [],
        relatedCards: [],
        concept: '测试',
        domain: '测试领域',
        quality: 0.7,
        tags: [],
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: { generator: 'test', llmModel: 'test', tokenCount: 10, referenceCount: 0 },
      });

      expect(result.quality).toBe(0.7);
    });
  });

  describe('extractJSON', () => {
    it('应该提取 JSON 代码块', async () => {
      const generator = new CardGenerator({ llm: mockLLM });
      const mockResponse = {
        message: {
          role: 'assistant',
          content: '```json\n{"question": "测试", "content": "内容", "quality": 0.9}\n```',
        },
      };
      vi.mocked(mockLLM.chat).mockResolvedValueOnce(mockResponse);

      const cards = await generator.generateFromPage('path', '内容', '标题', '概念', '领域');
      expect(cards[0].question).toBe('测试');
    });

    it('应该提取纯 JSON', async () => {
      const generator = new CardGenerator({ llm: mockLLM });
      const mockResponse = {
        message: {
          role: 'assistant',
          content: '{"question": "测试", "content": "内容", "quality": 0.9}',
        },
      };
      vi.mocked(mockLLM.chat).mockResolvedValueOnce(mockResponse);

      const cards = await generator.generateFromPage('path', '内容', '标题', '概念', '领域');
      expect(cards[0].question).toBe('测试');
    });

    it('应该提取嵌套在文本中的 JSON', async () => {
      const generator = new CardGenerator({ llm: mockLLM });
      const mockResponse = {
        message: {
          role: 'assistant',
          content: '这是一些说明文字\n{"question": "测试", "content": "内容", "quality": 0.9}\n更多文字',
        },
      };
      vi.mocked(mockLLM.chat).mockResolvedValueOnce(mockResponse);

      const cards = await generator.generateFromPage('path', '内容', '标题', '概念', '领域');
      expect(cards[0].question).toBe('测试');
    });

    it('应该解析 JSON 数组', async () => {
      const generator = new CardGenerator({ llm: mockLLM });
      const mockResponse = {
        message: {
          role: 'assistant',
          content: JSON.stringify([
            { question: '问题1', content: '内容1', quality: 0.9 },
            { question: '问题2', content: '内容2', quality: 0.8 },
          ]),
        },
      };
      vi.mocked(mockLLM.chat).mockResolvedValueOnce(mockResponse);

      const cards = await generator.generateFromPage('path', '内容', '标题', '概念', '领域');
      expect(cards.length).toBe(2);
    });

    it('应该在 JSON 提取失败时抛出错误', async () => {
      const generator = new CardGenerator({ llm: mockLLM });
      const mockResponse = {
        message: {
          role: 'assistant',
          content: '完全没有 JSON 内容',
        },
      };
      vi.mocked(mockLLM.chat).mockResolvedValueOnce(mockResponse);

      await expect(
        generator.generateFromPage('path', '内容', '标题', '概念', '领域')
      ).rejects.toThrow('无法从 LLM 响应中提取 JSON');
    });
  });

  describe('deduplicate', () => {
    it('应该根据问题去重', async () => {
      const generator = new CardGenerator({ llm: mockLLM });
      const mockResponse = {
        message: {
          role: 'assistant',
          content: JSON.stringify([
            { question: ' 相同问题 ', content: '内容1', quality: 0.9 },
            { question: '相同问题', content: '内容2', quality: 0.8 },
          ]),
        },
      };
      vi.mocked(mockLLM.chat).mockResolvedValueOnce(mockResponse);

      const cards = await generator.generateFromConcept('创造性', '专利授权', [
        { path: 'page1', content: '内容1', title: '标题1' },
      ]);
      expect(cards.length).toBe(1);
      expect(cards[0].quality).toBe(0.9);
    });
  });
});
