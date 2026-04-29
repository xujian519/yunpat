/**
 * Obsidian知识库桥接服务
 *
 * 连接YunPat与宝宸知识库（Obsidian），支持查询知识卡片和Wiki页面
 */

import { readFile, readdir } from 'fs/promises';
import { join } from 'path';

export interface WikiCard {
  question: string;
  quality: number;
  content: string;
  relatedPages: string[];
  timestamp: string;
}

export interface WikiPage {
  path: string;
  title: string;
  content: string;
  links: string[];
}

/**
 * Obsidian知识库桥接类
 */
export class ObsidianKnowledgeBridge {
  private knowledgeBasePath: string;
  private cache: Map<string, WikiCard> = new Map();
  private pageCache: Map<string, WikiPage> = new Map();

  constructor(knowledgeBasePath?: string) {
    // 从环境变量读取，或使用默认值
    this.knowledgeBasePath = knowledgeBasePath || process.env.KNOWLEDGE_BASE_PATH || '';
    if (!this.knowledgeBasePath) {
      throw new Error('知识库路径未配置，请设置环境变量 KNOWLEDGE_BASE_PATH');
    }
  }

  /**
   * 根据问题查询知识卡片
   * @param question - 要查询的问题
   * @returns 知识卡片，如果未找到则返回null
   */
  async queryCard(question: string): Promise<WikiCard | null> {
    // 1. 检查缓存
    if (this.cache.has(question)) {
      return this.cache.get(question)!;
    }

    // 2. 在cards目录中查找匹配的文件
    const cardsPath = join(this.knowledgeBasePath, 'Wiki/cards');

    try {
      const files = await readdir(cardsPath);

      // 简单的模糊匹配（后续可以升级为语义检索）
      const matchedFile = files.find((file) => {
        const questionFromFilename = this.extractQuestionFromFilename(file);
        return this.isSimilarQuestion(question, questionFromFilename);
      });

      if (!matchedFile) {
        return null;
      }

      // 3. 读取并解析卡片
      const cardPath = join(cardsPath, matchedFile);
      const content = await readFile(cardPath, 'utf-8');
      const card = this.parseCard(content);

      // 4. 缓存结果
      this.cache.set(question, card);

      return card;
    } catch (error) {
      console.error(`查询知识卡片失败: ${error}`);
      return null;
    }
  }

  /**
   * 根据概念查询所有相关页面
   * @param concept - 概念名称
   * @returns 相关页面的路径数组
   */
  async queryByConcept(concept: string): Promise<string[]> {
    const indexPath = join(this.knowledgeBasePath, 'Wiki/Concept-Index.md');

    try {
      const indexContent = await readFile(indexPath, 'utf-8');

      // 解析反向索引，找到该概念对应的所有页面
      const relatedPages = this.parseConceptIndex(indexContent, concept);

      return relatedPages;
    } catch (error) {
      console.error(`查询概念失败: ${error}`);
      return [];
    }
  }

  /**
   * 读取Wiki页面内容
   * @param pagePath - Wiki页面路径（相对于Wiki目录）
   * @returns 页面内容
   */
  async readWikiPage(pagePath: string): Promise<string> {
    const fullPath = join(this.knowledgeBasePath, 'Wiki', `${pagePath}.md`);

    try {
      return await readFile(fullPath, 'utf-8');
    } catch (error) {
      console.error(`读取Wiki页面失败: ${error}`);
      return '';
    }
  }

  /**
   * 读取Wiki页面的完整信息
   * @param pagePath - Wiki页面路径
   * @returns Wiki页面对象
   */
  async getWikiPage(pagePath: string): Promise<WikiPage | null> {
    // 检查缓存
    if (this.pageCache.has(pagePath)) {
      return this.pageCache.get(pagePath)!;
    }

    const content = await this.readWikiPage(pagePath);
    if (!content) {
      return null;
    }

    // 提取标题（第一个#标题）
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1] : pagePath;

    // 提取所有wikilink
    const links = (content.match(/\[\[([^\]]+)\]\]/g) || []).map((link) =>
      link.replace(/[\[\]]/g, '')
    );

    const page: WikiPage = {
      path: pagePath,
      title,
      content,
      links,
    };

    // 缓存
    this.pageCache.set(pagePath, page);

    return page;
  }

  /**
   * 解析卡片内容
   * @param content - 卡片文件的完整内容
   * @returns 解析后的知识卡片
   */
  private parseCard(content: string): WikiCard {
    const lines = content.split('\n');

    const question = lines[1].replace(/^- 来源问题:\s*/, '');
    const quality = parseFloat(lines[2].replace(/^- 质量分:\s*/, ''));
    const timestamp = lines[3].replace(/^- 生成时间:\s*/, '');

    // 提取卡片内容（从"## 卡片内容"到文件末尾）
    const cardContentStart = lines.findIndex((l) => l === '## 卡片内容');
    const cardContent = lines.slice(cardContentStart + 1).join('\n').trim();

    // 提取相关页面（[[wikilink]]）
    const relatedPages = (content.match(/\[\[([^\]]+)\]\]/g) || []).map((link) =>
      link.replace(/[\[\]]/g, '')
    );

    return {
      question,
      quality,
      content: cardContent,
      relatedPages,
      timestamp,
    };
  }

  /**
   * 从文件名提取问题
   * @param filename - 文件名
   * @returns 提取的问题
   */
  private extractQuestionFromFilename(filename: string): string {
    // 20260426-什么是创造性-71092c4775df.md
    // => 什么是创造性
    const match = filename.match(/^(\d{8}-)(.+?)(-[a-f0-9]{11}\.md)$/);
    return match ? match[2] : '';
  }

  /**
   * 简单的问题相似度判断（后续可以升级为语义检索）
   * @param q1 - 问题1
   * @param q2 - 问题2
   * @returns 是否相似
   */
  private isSimilarQuestion(q1: string, q2: string): boolean {
    const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, '');
    return normalize(q1) === normalize(q2);
  }

  /**
   * 解析概念索引
   * @param indexContent - Concept-Index.md的内容
   * @param concept - 要查询的概念
   * @returns 相关页面的路径数组
   */
  private parseConceptIndex(indexContent: string, concept: string): string[] {
    const lines = indexContent.split('\n');
    const relatedPages: string[] = [];

    let foundConcept = false;
    for (const line of lines) {
      if (line.startsWith(`### ${concept}`)) {
        foundConcept = true;
        continue;
      }

      if (foundConcept) {
        if (line.startsWith('### ')) {
          // 到达下一个概念，停止
          break;
        }

        // 提取wikilink
        const match = line.match(/\[\[([^\]]+)\]\]/);
        if (match) {
          relatedPages.push(match[1]);
        }
      }
    }

    return relatedPages;
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear();
    this.pageCache.clear();
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats() {
    return {
      cards: this.cache.size,
      pages: this.pageCache.size,
    };
  }
}
