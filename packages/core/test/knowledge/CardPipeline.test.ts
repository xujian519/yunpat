import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CardPipeline } from '../../src/knowledge/CardPipeline.js';
import type { LLMAdapter } from '../../src/lifecycle/Lifecycle.js';
import type { EmbeddingAdapter } from '../../src/llm/EmbeddingAdapter.js';

// Mock fs module
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    readdir: vi.fn(),
  },
}));

import { promises as fs } from 'fs';

const mockLLM: LLMAdapter = {
  chat: vi.fn().mockResolvedValue({
    message: { role: 'assistant', content: '测试回复' },
  }),
  chatStream: vi.fn().mockImplementation(async function* () {
    yield { message: { role: 'assistant', content: 'test' } };
  }),
  embed: vi.fn().mockResolvedValue({ embeddings: [[0.1, 0.2]] }),
};

const mockEmbedder: EmbeddingAdapter = {
  embed: vi.fn().mockResolvedValue({ embeddings: [[0.1, 0.2, 0.3]] }),
} as unknown as EmbeddingAdapter;

describe('CardPipeline', () => {
  let pipeline: CardPipeline;
  const kbPath = '/tmp/test-kb';

  beforeEach(() => {
    vi.clearAllMocks();
    pipeline = new CardPipeline({
      llm: mockLLM,
      knowledgeBasePath: kbPath,
      embedder: mockEmbedder,
    });
  });

  describe('constructor', () => {
    it('应该创建实例', () => {
      expect(pipeline).toBeDefined();
    });

    it('应该返回retriever', () => {
      const retriever = pipeline.getRetriever();
      expect(retriever).toBeDefined();
    });
  });

  describe('run', () => {
    it('应该处理空概念列表', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('not found'));

      const result = await pipeline.run({
        concepts: [],
        maxCardsPerConcept: 5,
        qualityThreshold: 0.5,
        concurrency: 2,
        batchSize: 10,
      });

      expect(result.totalGenerated).toBe(0);
      expect(result.totalStored).toBe(0);
    });

    it('应该处理概念索引读取失败', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('not found'));

      const result = await pipeline.run({
        concepts: ['创造性'],
        maxCardsPerConcept: 5,
        qualityThreshold: 0.5,
        concurrency: 2,
        batchSize: 10,
      });

      expect(result.totalGenerated).toBe(0);
    });

    it('应该调用进度回调', async () => {
      const conceptIndex = `### 创造性\n- [[创造性/创造性判断]]\n- [[创造性/三步法]]`;
      vi.mocked(fs.readFile).mockImplementation(async (filePath: string) => {
        if (filePath.includes('Concept-Index.md')) return conceptIndex;
        if (filePath.includes('Concept-Hierarchy.md')) return '';
        if (filePath.includes('.md') && !filePath.includes('index')) {
          return '# 测试页面\n\n这是一段足够长的测试内容，用于满足最小长度要求。创造性是指与现有技术相比具有突出的实质性特点和显著的进步。'.repeat(5);
        }
        throw new Error('not found');
      });

      vi.mocked(fs.readdir).mockResolvedValue([]);

      const progressCalls: Array<{ phase: string; current: number; total: number }> = [];
      const onProgress = (p: { phase: string; current: number; total: number }) => {
        progressCalls.push(p);
      };

      await pipeline.run({
        concepts: ['创造性'],
        maxCardsPerConcept: 5,
        qualityThreshold: 0.5,
        concurrency: 2,
        batchSize: 10,
        onProgress,
      });

      expect(progressCalls.length).toBeGreaterThan(0);
      expect(progressCalls[0].phase).toBe('generating');
    });
  });

  describe('loadPersistedCards', () => {
    it('应该加载持久化的卡片', async () => {
      const mockCards = [
        {
          id: 'card-1',
          question: '测试问题',
          content: '测试内容',
          sourcePages: [],
          relatedCards: [],
          concept: '测试',
          domain: '测试领域',
          quality: 0.8,
          tags: ['测试'],
          version: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          metadata: { generator: 'test', llmModel: 'test', tokenCount: 10, referenceCount: 0 },
        },
      ];

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockCards));

      const count = await pipeline.loadPersistedCards();
      expect(count).toBe(1);
    });

    it('应该在文件不存在时返回0', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('not found'));

      const count = await pipeline.loadPersistedCards();
      expect(count).toBe(0);
    });
  });

  describe('error handling', () => {
    it('应该处理向量化错误', async () => {
      const badEmbedder: EmbeddingAdapter = {
        embed: vi.fn().mockRejectedValue(new Error('embedding failed')),
      } as unknown as EmbeddingAdapter;

      const pipelineWithBadEmbedder = new CardPipeline({
        llm: mockLLM,
        knowledgeBasePath: kbPath,
        embedder: badEmbedder,
      });

      const conceptIndex = `### 创造性\n- [[创造性/创造性判断]]`;
      vi.mocked(fs.readFile).mockImplementation(async (filePath: string) => {
        if (filePath.includes('Concept-Index.md')) return conceptIndex;
        if (filePath.includes('Concept-Hierarchy.md')) return '';
        if (filePath.includes('.md')) {
          return '# 测试页面\n\n这是一段足够长的测试内容。'.repeat(5);
        }
        throw new Error('not found');
      });

      vi.mocked(fs.readdir).mockResolvedValue([]);

      // Mock generator to return cards
      const result = await pipelineWithBadEmbedder.run({
        concepts: ['创造性'],
        maxCardsPerConcept: 5,
        qualityThreshold: 0.5,
        concurrency: 2,
        batchSize: 10,
      });

      // Should complete without throwing, but may have errors
      expect(result).toBeDefined();
    });
  });

  describe('loadConcepts', () => {
    it('应该解析概念索引', async () => {
      const conceptIndex = `### 创造性\n- [[创造性/创造性判断]]\n- [[创造性/三步法]]\n### 新颖性\n- [[新颖性/单独对比]]`;

      vi.mocked(fs.readFile).mockImplementation(async (filePath: string) => {
        if (filePath.includes('Concept-Index.md')) return conceptIndex;
        if (filePath.includes('Concept-Hierarchy.md')) return '';
        throw new Error('not found');
      });

      const result = await (pipeline as any).loadConcepts(['创造性']);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].name).toBe('创造性');
    });

    it('应该解析概念层级', async () => {
      const hierarchy = `### 1. 专利授权\n#### 创造性\n- 三步法\n### 2. 现有技术\n#### 公知常识`;

      const result = (pipeline as any).parseConceptHierarchy(hierarchy);
      expect(result['创造性']).toBe('专利授权');
      expect(result['三步法']).toBe('专利授权');
      expect(result['公知常识']).toBe('现有技术');
    });

    it('应该处理空概念列表', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('not found'));

      const result = await (pipeline as any).loadConcepts([]);
      expect(result).toEqual([]);
    });
  });

  describe('persistCards', () => {
    it('应该持久化卡片', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const cards = [
        {
          id: 'card-1',
          question: '测试',
          content: '内容',
          quality: 0.9,
          sourcePages: ['page1'],
          relatedCards: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      await (pipeline as any).persistCards(cards);
      expect(fs.writeFile).toHaveBeenCalled();
    });
  });
});
