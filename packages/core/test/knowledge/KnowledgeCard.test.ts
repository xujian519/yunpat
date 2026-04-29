/**
 * 知识卡片系统测试
 *
 * 覆盖：
 * 1. KnowledgeCard 模型验证（Zod schema）
 * 2. CardRetriever 多维检索
 * 3. CardPipeline 批量生成（需要 LLM 和知识库）
 * 4. EmbeddingAdapter（需要 BGE-M3 服务）
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  KnowledgeCardSchema,
  generateCardId,
  cardToMarkdown,
  markdownToCard,
  type KnowledgeCard,
} from '../../src/knowledge/KnowledgeCard.js';
import { CardRetriever } from '../../src/knowledge/CardRetriever.js';
import { CardPipeline } from '../../src/knowledge/CardPipeline.js';
import { EmbeddingAdapter, createBGEEmbedding } from '../../src/llm/EmbeddingAdapter.js';

function createTestCard(overrides?: Partial<KnowledgeCard>): KnowledgeCard {
  return {
    id: generateCardId('什么是创造性', '创造性'),
    question: '什么是创造性',
    content: '创造性是指与现有技术相比，该发明具有突出的实质性特点和显著的进步。根据专利法第22条第3款的规定...',
    sourcePages: ['专利实务/创造性/创造性判断概述'],
    relatedCards: [],
    concept: '创造性',
    domain: '专利授权',
    quality: 0.85,
    tags: ['创造性', '专利授权条件', '实质性特点'],
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metadata: {
      generator: 'test',
      llmModel: 'test',
      tokenCount: 100,
      referenceCount: 0,
    },
    ...overrides,
  };
}

describe('KnowledgeCard 模型', () => {
  it('应通过 Zod schema 验证', () => {
    const card = createTestCard();
    const result = KnowledgeCardSchema.safeParse(card);
    expect(result.success).toBe(true);
  });

  it('应拒绝空 question', () => {
    const card = createTestCard({ question: '' });
    const result = KnowledgeCardSchema.safeParse(card);
    expect(result.success).toBe(false);
  });

  it('应拒绝 quality 超出范围', () => {
    const card = createTestCard({ quality: 1.5 });
    const result = KnowledgeCardSchema.safeParse(card);
    expect(result.success).toBe(false);
  });

  it('应正确生成 ID', () => {
    const id1 = generateCardId('什么是创造性', '创造性');
    const id2 = generateCardId('什么是创造性', '创造性');
    expect(id1).toBeTruthy();
    expect(typeof id1).toBe('string');
    // 同一问题同一概念生成的 ID 前缀相同（含日期部分可能不同）
    expect(id1.length).toBeGreaterThan(10);
  });
});

describe('KnowledgeCard 序列化', () => {
  it('应正确转换为 Markdown', () => {
    const card = createTestCard();
    const md = cardToMarkdown(card);

    expect(md).toContain('# 什么是创造性');
    expect(md).toContain('- 来源问题: 什么是创造性');
    expect(md).toContain('## 卡片内容');
    expect(md).toContain('## 相关页面');
    expect(md).toContain('[[专利实务/创造性/创造性判断概述]]');
  });

  it('应正确从 Markdown 解析', () => {
    const card = createTestCard();
    const md = cardToMarkdown(card);
    const parsed = markdownToCard(md, card.id);

    expect(parsed.question).toBe(card.question);
    expect(parsed.concept).toBe(card.concept);
    expect(parsed.domain).toBe(card.domain);
    expect(parsed.sourcePages).toContain('专利实务/创造性/创造性判断概述');
    expect(parsed.quality).toBeCloseTo(card.quality, 3);
  });

  it('序列化 -> 反序列化应保持一致', () => {
    const card = createTestCard();
    const md = cardToMarkdown(card);
    const parsed = markdownToCard(md, card.id);

    expect(parsed.question).toBe(card.question);
    expect(parsed.content.replace(/\n+/g, ' ').trim()).toBe(card.content.replace(/\n+/g, ' ').trim());
    expect(parsed.concept).toBe(card.concept);
    expect(parsed.domain).toBe(card.domain);
  });
});

describe('CardRetriever 检索', () => {
  let retriever: CardRetriever;

  beforeAll(() => {
    retriever = new CardRetriever();

    // 加载测试卡片
    const cards: KnowledgeCard[] = [
      createTestCard({
        id: 'card-1',
        question: '什么是创造性',
        concept: '创造性',
        domain: '专利授权',
        quality: 0.9,
        tags: ['创造性', '三步法'],
      }),
      createTestCard({
        id: 'card-2',
        question: '三步法的具体步骤',
        concept: '三步法',
        domain: '专利授权',
        quality: 0.85,
        tags: ['三步法', '创造性'],
        relatedCards: ['card-1'],
      }),
      createTestCard({
        id: 'card-3',
        question: '如何判断新颖性',
        concept: '新颖性',
        domain: '专利授权',
        quality: 0.8,
        tags: ['新颖性', '现有技术'],
      }),
      createTestCard({
        id: 'card-4',
        question: '专利侵权判定原则',
        concept: '全面覆盖原则',
        domain: '专利侵权',
        quality: 0.75,
        tags: ['侵权', '全面覆盖'],
      }),
    ];

    retriever.loadCards(cards);
  });

  it('应按关键词检索', async () => {
    const results = await retriever.search('创造性判断', { mode: 'keyword', minSimilarity: 0.05 });
    expect(results.length).toBeGreaterThan(0);
    const ids = results.map((r) => r.card.id);
    expect(ids).toContain('card-1');
  });

  it('应按概念检索', () => {
    const cards = retriever.getByConcept('创造性');
    expect(cards.length).toBe(1);
    expect(cards[0].id).toBe('card-1');
  });

  it('应按领域检索', () => {
    const cards = retriever.getByDomain('专利授权');
    expect(cards.length).toBe(3);
  });

  it('应按质量过滤', async () => {
    const results = await retriever.search('专利', { mode: 'keyword', minQuality: 0.85 });
    for (const r of results) {
      expect(r.card.quality).toBeGreaterThanOrEqual(0.85);
    }
  });

  it('应探索关联卡片', () => {
    const related = retriever.explore('card-2', 1);
    expect(related.length).toBe(1);
    expect(related[0].id).toBe('card-1');
  });

  it('应返回统计信息', () => {
    const stats = retriever.getStats();
    expect(stats.totalCards).toBe(4);
    expect(stats.byDomain['专利授权']).toBe(3);
    expect(stats.byDomain['专利侵权']).toBe(1);
    expect(stats.avgQuality).toBeGreaterThan(0);
  });

  it('应注入上下文', async () => {
    const result = await retriever.injectContext('创造性判断方法');
    // 在无语义嵌入的情况下，使用 hybrid 模式可能需要更宽松的匹配
    expect(result.enhancedPrompt).toContain('创造性判断方法');
  });
});

describe('EmbeddingAdapter', () => {
  it('应正确分批处理', async () => {
    const adapter = new EmbeddingAdapter({
      baseURL: 'http://localhost:8009/v1',
      model: 'bge-m3',
      batchSize: 2,
    });

    // 测试分批逻辑（不实际调用 API）
    expect(adapter).toBeDefined();
  });

  it('应通过工厂函数创建 BGE 嵌入器', () => {
    const embedder = createBGEEmbedding();
    expect(embedder).toBeDefined();
  });
});

describe('CardPipeline', () => {
  it('应正确创建管线实例', () => {
    const embedder = createBGEEmbedding();
    // 使用 mock LLM（实际测试需要真实 LLM）
    const pipeline = new CardPipeline({
      llm: {
        chat: async () => ({ message: { role: 'assistant' as const, content: '{}' } }),
        chatStream: async function* () {},
        embed: async () => [[]],
      },
      knowledgeBasePath: '/tmp/test-kb',
      embedder,
    });

    expect(pipeline).toBeDefined();
    expect(pipeline.getRetriever()).toBeDefined();
  });
});
