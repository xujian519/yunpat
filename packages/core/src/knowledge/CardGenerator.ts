/**
 * 知识卡片生成器
 *
 * 从 Obsidian Wiki 页面生成结构化的知识卡片
 * 使用 LLM 提取核心问题并生成高质量回答
 */

import type { LLMAdapter } from '../lifecycle/Lifecycle.js';
import type { KnowledgeCard } from './KnowledgeCard.js';
import { generateCardId } from './KnowledgeCard.js';

const GENERATION_PROMPT = `你是一个专利法知识卡片的生成助手。请根据提供的知识页面内容，生成一张高质量的知识卡片。

## 要求

1. **核心问题**：从内容中提炼一个具体的、有实际价值的问题（如"什么是创造性判断的三步法"）
2. **内容结构**：
   - 核心回答（2-3 段精炼回答）
   - 法律依据（相关法条引用，格式：「法规名称」第X条）
   - 实务要点（实践中需要注意的关键点）
   - 案例参考（如有相关案例）
3. **质量标准**：
   - 忠实于来源内容，不添加未提及的信息
   - 引用具体的法条和条款号
   - 内容简洁但有深度（500-1500 字）
   - 使用 [[wikilink]] 链接到相关概念

## 输出格式

请严格按以下 JSON 格式输出，不要输出其他内容：

\`\`\`json
{
  "question": "核心问题",
  "content": "卡片正文（Markdown 格式，使用 ### 分节）",
  "tags": ["标签1", "标签2"],
  "quality": 0.85
}
\`\`\`

## 知识页面内容

标题：{title}
概念：{concept}
领域：{domain}

{content}`;

const QUALITY_ASSESS_PROMPT = `请评估以下知识卡片的质量，返回 0-1 的质量分数。

评估维度：
1. 准确性（是否忠实于专利法专业知识）
2. 完整性（是否充分回答了问题）
3. 实用性（对专利实务是否有指导价值）
4. 简洁性（是否精炼无冗余）

返回 JSON：{"quality": 0.85, "issues": ["问题描述"]}

## 问题
{question}

## 内容
{content}`;

export interface CardGeneratorConfig {
  /** LLM 适配器 */
  llm: LLMAdapter;
  /** 质量阈值 */
  qualityThreshold?: number;
  /** 每个页面最大生成卡片数 */
  maxCardsPerPage?: number;
}

export class CardGenerator {
  private llm: LLMAdapter;
  private qualityThreshold: number;
  private maxCardsPerPage: number;

  constructor(config: CardGeneratorConfig) {
    this.llm = config.llm;
    this.qualityThreshold = config.qualityThreshold ?? 0.7;
    this.maxCardsPerPage = config.maxCardsPerPage ?? 3;
  }

  async generateFromPage(
    pagePath: string,
    pageContent: string,
    pageTitle: string,
    concept: string,
    domain: string
  ): Promise<KnowledgeCard[]> {
    const MAX_CONTENT_LEN = 6000;
    const prompt = GENERATION_PROMPT.replace(/\{title\}/g, pageTitle)
      .replace(/\{concept\}/g, concept)
      .replace(/\{domain\}/g, domain)
      .replace(/\{content\}/g, pageContent.slice(0, MAX_CONTENT_LEN));

    const response = await this.llm.chat({
      messages: [
        {
          role: 'system',
          content: '你是一个专利法知识管理专家，擅长提炼结构化知识卡片。只输出 JSON。',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      maxTokens: 2000,
    });

    const cards = this.parseGenerationResponse(response.message.content, pagePath, concept, domain);
    return cards.filter((c) => c.quality >= this.qualityThreshold);
  }

  async generateFromConcept(
    concept: string,
    domain: string,
    pages: Array<{ path: string; content: string; title: string }>
  ): Promise<KnowledgeCard[]> {
    const allCards: KnowledgeCard[] = [];

    for (const page of pages) {
      try {
        const cards = await this.generateFromPage(
          page.path,
          page.content,
          page.title,
          concept,
          domain
        );
        allCards.push(...cards);
      } catch (error) {
        console.error(`生成卡片失败 (${page.path}): ${error}`);
      }

      if (allCards.length >= this.maxCardsPerPage * pages.length) break;
    }

    return this.deduplicate(allCards);
  }

  async assessQuality(card: KnowledgeCard): Promise<{ quality: number; issues: string[] }> {
    const prompt = QUALITY_ASSESS_PROMPT.replace('{question}', card.question).replace(
      '{content}',
      card.content
    );

    try {
      const response = await this.llm.chat({
        messages: [
          { role: 'system', content: '你是专利法知识质量评估专家。只输出 JSON。' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        maxTokens: 500,
      });

      const parsed = this.extractJSON(response.message.content);
      return {
        quality: parsed.quality ?? 0.5,
        issues: parsed.issues ?? [],
      };
    } catch {
      return { quality: card.quality, issues: [] };
    }
  }

  private parseGenerationResponse(
    content: string,
    sourcePage: string,
    concept: string,
    domain: string
  ): KnowledgeCard[] {
    const parsed = this.extractJSON(content);
    const items = Array.isArray(parsed) ? parsed : [parsed];
    const now = new Date().toISOString();

    return items.map((item: any) => {
      const question = item.question ?? '';
      const card: KnowledgeCard = {
        id: generateCardId(question, concept),
        question,
        content: item.content ?? '',
        sourcePages: [sourcePage],
        relatedCards: [],
        concept,
        domain,
        quality: typeof item.quality === 'number' ? item.quality : 0.5,
        tags: item.tags ?? [],
        version: 1,
        createdAt: now,
        updatedAt: now,
        metadata: {
          generator: 'CardGenerator',
          llmModel: 'unknown',
          tokenCount: (item.content ?? '').length,
          referenceCount: 0,
        },
      };
      return card;
    });
  }

  private extractJSON(text: string): any {
    // 尝试提取 JSON 代码块
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      try {
        return JSON.parse(codeBlockMatch[1].trim());
      } catch (e) {
        console.warn('JSON 代码块解析失败:', (e as Error).message);
      }
    }

    // 尝试直接解析
    try {
      return JSON.parse(text.trim());
    } catch {
      // 直接解析失败，尝试提取 JSON 子串
    }

    // 尝试找到第一个 { 和最后一个 }
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        // 提取子串后解析仍失败
      }
    }

    throw new Error(`无法从 LLM 响应中提取 JSON: ${text.slice(0, 200)}`);
  }

  private deduplicate(cards: KnowledgeCard[]): KnowledgeCard[] {
    const seen = new Map<string, KnowledgeCard>();

    for (const card of cards) {
      const key = card.question.toLowerCase().replace(/\s+/g, '');
      const existing = seen.get(key);
      if (!existing || card.quality > existing.quality) {
        seen.set(key, card);
      }
    }

    return Array.from(seen.values());
  }
}
