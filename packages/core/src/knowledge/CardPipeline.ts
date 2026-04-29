/**
 * 知识卡片批量生成管线
 *
 * 从 Obsidian 知识库批量生成、向量化、存储知识卡片
 * 支持分批处理，控制内存使用
 */

import { promises as fs } from 'fs';
import * as path from 'path';

import type { LLMAdapter } from '../lifecycle/Lifecycle.js';
import type { EmbeddingAdapter } from '../llm/EmbeddingAdapter.js';
import type {
  KnowledgeCard,
  PipelineConfig,
  PipelineResult,
} from './KnowledgeCard.js';
import { cardToMarkdown } from './KnowledgeCard.js';
import { CardGenerator } from './CardGenerator.js';
import { CardRetriever } from './CardRetriever.js';

interface ConceptInfo {
  name: string;
  domain: string;
  pages: string[];
}

export class CardPipeline {
  private generator: CardGenerator;
  private retriever: CardRetriever;
  private embedder?: EmbeddingAdapter;
  private knowledgeBasePath: string;

  constructor(config: {
    llm: LLMAdapter;
    knowledgeBasePath: string;
    embedder?: EmbeddingAdapter;
  }) {
    this.generator = new CardGenerator({ llm: config.llm });
    this.retriever = new CardRetriever(config.embedder);
    this.embedder = config.embedder;
    this.knowledgeBasePath = config.knowledgeBasePath;
  }

  getRetriever(): CardRetriever {
    return this.retriever;
  }

  async run(config: PipelineConfig): Promise<PipelineResult> {
    const startTime = Date.now();
    const result: PipelineResult = {
      totalGenerated: 0,
      totalStored: 0,
      avgQuality: 0,
      byDomain: {},
      errors: [],
      duration: 0,
    };

    // 1. 加载概念索引
    const concepts = await this.loadConcepts(config.concepts);
    config.onProgress?.({ phase: 'generating', current: 0, total: concepts.length });

    // 2. 逐概念生成卡片
    const allCards: KnowledgeCard[] = [];

    for (let i = 0; i < concepts.length; i++) {
      const concept = concepts[i];
      config.onProgress?.({
        phase: 'generating',
        current: i + 1,
        total: concepts.length,
        concept: concept.name,
      });

      try {
        let pages = await this.loadPages(concept.pages.slice(0, 5));

        // 如果过滤后无页面，尝试从知识库目录中扫描相关文件
        if (pages.length === 0) {
          pages = await this.scanRelatedFiles(concept.name, 5);
        }

        if (pages.length === 0) continue;

        const cards = await this.generator.generateFromConcept(
          concept.name,
          concept.domain,
          pages,
        );

        // 限制每个概念的卡片数
        const limitedCards = cards.slice(0, config.maxCardsPerConcept);
        allCards.push(...limitedCards);
      } catch (error) {
        result.errors.push(`${concept.name}: ${error instanceof Error ? error.message : String(error)}`);
      }

      // 并发控制
      if (i > 0 && i % config.concurrency === 0) {
        await new Promise((r) => setTimeout(r, 100));
      }
    }

    result.totalGenerated = allCards.length;

    // 3. 分批向量化
    if (this.embedder && allCards.length > 0) {
      config.onProgress?.({ phase: 'embedding', current: 0, total: allCards.length });

      for (let i = 0; i < allCards.length; i += config.batchSize) {
        const batch = allCards.slice(i, i + config.batchSize);
        config.onProgress?.({
          phase: 'embedding',
          current: Math.min(i + config.batchSize, allCards.length),
          total: allCards.length,
        });

        try {
          const texts = batch.map((c) => `${c.question}\n${c.content}`);
          const embeddings = await this.embedder.embed(texts);

          for (let j = 0; j < batch.length; j++) {
            if (embeddings[j]) {
              batch[j].embedding = embeddings[j];
            }
          }
        } catch (error) {
          result.errors.push(`向量化批次 ${i}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    // 4. 存储
    config.onProgress?.({ phase: 'storing', current: 0, total: allCards.length });

    for (let i = 0; i < allCards.length; i++) {
      const card = allCards[i];
      if (card.quality >= config.qualityThreshold) {
        this.retriever.addCard(card);
        result.totalStored++;

        result.byDomain[card.domain] = (result.byDomain[card.domain] ?? 0) + 1;
      }

      if ((i + 1) % 10 === 0) {
        config.onProgress?.({
          phase: 'storing',
          current: i + 1,
          total: allCards.length,
        });
      }
    }

    // 5. 持久化到磁盘
    await this.persistCards(allCards.filter((c) => c.quality >= config.qualityThreshold));

    // 统计
    result.avgQuality =
      allCards.length > 0
        ? allCards.reduce((sum, c) => sum + c.quality, 0) / allCards.length
        : 0;
    result.duration = Date.now() - startTime;

    return result;
  }

  private async loadConcepts(targetConcepts?: string[]): Promise<ConceptInfo[]> {
    // 从 Concept-Index.md 加载概念
    const indexPath = path.join(this.knowledgeBasePath, 'Concept-Index.md');
    const hierarchyPath = path.join(this.knowledgeBasePath, 'Concept-Hierarchy.md');

    let conceptPages: Record<string, string[]> = {};
    try {
      const indexContent = await fs.readFile(indexPath, 'utf-8');
      conceptPages = this.parseConceptIndex(indexContent);
    } catch (error) {
      console.error(`读取概念索引失败: ${error}`);
      return [];
    }

    // 加载概念 -> 领域映射
    let conceptDomains: Record<string, string> = {};
    try {
      const hierarchyContent = await fs.readFile(hierarchyPath, 'utf-8');
      conceptDomains = this.parseConceptHierarchy(hierarchyContent);
    } catch {}

    // 构建概念列表
    const concepts: ConceptInfo[] = [];
    const targetSet = targetConcepts && targetConcepts.length > 0 ? new Set(targetConcepts) : null;

    for (const [name, pages] of Object.entries(conceptPages)) {
      if (targetSet && !targetSet.has(name)) {
        // 模糊匹配：如果目标概念是索引概念的子串
        const matched = targetSet.has(name) || [...targetSet].some(
          (t) => name.includes(t) || t.includes(name)
        );
        if (!matched) continue;
      }
      concepts.push({
        name,
        domain: conceptDomains[name] ?? '未分类',
        pages,
      });
    }

    return concepts;
  }

  private parseConceptIndex(content: string): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    const lines = content.split('\n');
    let currentConcept = '';

    for (const line of lines) {
      if (line.startsWith('### ')) {
        currentConcept = line.slice(4).trim();
        result[currentConcept] = [];
      } else if (currentConcept) {
        // 匹配所有 [[wikilink]]，可能有多个
        const matches = line.matchAll(/\[\[([^\]]+)\]\]/g);
        for (const match of matches) {
          let pagePath = match[1];
          // 去掉 # 锚点部分
          if (pagePath.includes('#')) {
            pagePath = pagePath.split('#')[0];
          }
          if (pagePath && !result[currentConcept].includes(pagePath)) {
            result[currentConcept].push(pagePath);
          }
        }
      }
    }

    return result;
  }

  private parseConceptHierarchy(content: string): Record<string, string> {
    const result: Record<string, string> = {};
    const lines = content.split('\n');
    let currentDomain = '';
    let currentConcept = '';

    for (const line of lines) {
      // ### 1. 专利授权  -> 一级领域
      if (line.match(/^###\s+\d+\.\s+/)) {
        currentDomain = line.replace(/^###\s+\d+\.\s+/, '').trim();
        currentConcept = '';
      }
      // #### 新颖性 -> 二级概念（映射到所属一级领域）
      else if (line.startsWith('#### ')) {
        currentConcept = line.slice(5).replace(/\s*\(.*\)\s*$/, '').trim();
        if (currentDomain && currentConcept) {
          result[currentConcept] = currentDomain;
        }
      }
      // - 单独对比 -> 三级概念
      else if (line.startsWith('- ') && currentConcept && currentDomain) {
        const subConcept = line.slice(2).trim();
        if (subConcept) {
          result[subConcept] = currentDomain;
        }
      }
    }

    // 补充未在层级文件中显式出现的概念映射
    const supplement: Record<string, string> = {
      '按许销售': '专利侵权',
      '安全例外': '强制许可',
      '保密义务': '程序问题',
      '不可专利': '专利授权',
      '冲突': '权属问题',
      '二级概念': '专利授权',
      '法律法规': '程序问题',
      '防止权滥用': '专利权效力',
      '非显而易见': '专利授权',
      '公知常识': '现有技术',
      '化学领域': '专利审查',
      '合法来源': '侵权抗辩',
      '既有技术': '现有技术',
      '宽限期': '专利授权',
      '领域技术人员': '专利授权',
      '逻辑推理': '专利审查',
      '偶然因素': '专利授权',
      '专利权效力': '专利权效力',
      '专利无效': '专利无效',
      '普通技术人员': '专利授权',
      '权利要求解释': '权利要求解释',
      '三步法': '专利授权',
      '授权条件': '专利授权',
      '外观设计': '外观设计',
      '信息化': '现有技术',
      '专门用于': '专利侵权',
      '诉讼程序': '程序问题',
      '主题名称': '权利要求与说明书',
    };
    for (const [concept, domain] of Object.entries(supplement)) {
      if (!result[concept]) {
        result[concept] = domain;
      }
    }

    return result;
  }

  /**
   * 扫描知识库目录，查找文件名包含概念关键词的文件
   */
  private async scanRelatedFiles(
    concept: string,
    maxFiles: number,
  ): Promise<Array<{ path: string; content: string; title: string }>> {
    const pages: Array<{ path: string; content: string; title: string }> = [];

    // 自动扫描知识库根目录下的所有子目录
    const rootEntries = await fs.readdir(this.knowledgeBasePath, { withFileTypes: true });
    const subDirs = rootEntries
      .filter((e) => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'cards')
      .map((e) => e.name);

    for (const subDir of subDirs) {
      if (pages.length >= maxFiles) break;

      const dirPath = path.join(this.knowledgeBasePath, subDir);
      let files: string[];
      try {
        files = await this.scanDir(dirPath);
      } catch {
        continue;
      }

      // 匹配包含概念名的文件
      const conceptLower = concept.toLowerCase();
      const matched = files.filter((f) => f.toLowerCase().includes(conceptLower));

      for (const filePath of matched.slice(0, maxFiles - pages.length)) {
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          if (content.length < 200) continue;

          const titleMatch = content.match(/^#\s+(.+)$/m);
          const relPath = path.relative(this.knowledgeBasePath, filePath).replace(/\.md$/, '');
          pages.push({
            path: relPath,
            content,
            title: titleMatch ? titleMatch[1] : relPath,
          });
        } catch {}
      }
    }

    return pages;
  }

  private async scanDir(dirPath: string): Promise<string[]> {
    const results: string[] = [];
    let entries;
    try {
      entries = await fs.readdir(dirPath, { withFileTypes: true });
    } catch {
      return results;
    }

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        const subFiles = await this.scanDir(fullPath);
        results.push(...subFiles);
      } else if (entry.name.endsWith('.md') && entry.name !== 'index.md') {
        results.push(fullPath);
      }
    }

    return results;
  }

  private async loadPages(
    pagePaths: string[],
  ): Promise<Array<{ path: string; content: string; title: string }>> {
    const pages: Array<{ path: string; content: string; title: string }> = [];

    for (const pagePath of pagePaths) {
      try {
        // 跳过 index 文件和目录文件，优先加载实质内容页面
        if (pagePath.endsWith('/index') || pagePath === 'index' || pagePath.endsWith('/目录')) {
          continue;
        }

        const fullPath = path.join(this.knowledgeBasePath, `${pagePath}.md`);
        const content = await fs.readFile(fullPath, 'utf-8');

        // 跳过过短的页面（可能是占位符）
        if (content.length < 200) continue;

        const titleMatch = content.match(/^#\s+(.+)$/m);
        pages.push({
          path: pagePath,
          content,
          title: titleMatch ? titleMatch[1] : pagePath,
        });
      } catch {}
    }

    return pages;
  }

  private async persistCards(cards: KnowledgeCard[]): Promise<void> {
    const cardsDir = path.join(this.knowledgeBasePath, 'cards');

    try {
      await fs.mkdir(cardsDir, { recursive: true });
    } catch {}

    // 持久化为 JSON 索引
    const indexPath = path.join(cardsDir, 'index.json');
    const index = cards.map((c) => ({
      id: c.id,
      question: c.question,
      concept: c.concept,
      domain: c.domain,
      quality: c.quality,
    }));
    await fs.writeFile(indexPath, JSON.stringify(index, null, 2), 'utf-8');

    // 每张卡片存为单独的 markdown 文件
    for (const card of cards) {
      const filename = `${card.id}.md`;
      const filePath = path.join(cardsDir, filename);
      await fs.writeFile(filePath, cardToMarkdown(card), 'utf-8');
    }

    // 存储完整 JSON 数据（含 embedding）
    const dataPath = path.join(cardsDir, 'data.json');
    await fs.writeFile(dataPath, JSON.stringify(cards, null, 2), 'utf-8');
  }

  async loadPersistedCards(): Promise<number> {
    const dataPath = path.join(this.knowledgeBasePath, 'cards', 'data.json');

    try {
      const content = await fs.readFile(dataPath, 'utf-8');
      const cards: KnowledgeCard[] = JSON.parse(content);
      this.retriever.loadCards(cards);
      return cards.length;
    } catch {
      return 0;
    }
  }
}
