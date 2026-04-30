/**
 * 提示词模板管理器（支持分步加载）
 *
 * 管理专利撰写相关的提示词模板，支持按需加载和缓存
 */

import { readFile } from 'fs/promises';
import { join } from 'path';

export interface PromptTemplate {
  name: string;
  description: string;
  content: string;
  variables: string[];
  loadedAt: Date;
}

export interface TemplateLoadStrategy {
  /** 预加载阶段 */
  preload?: string[];
  /** 按需加载阶段 */
  onDemand?: string[];
  /** 懒加载阶段 */
  lazy?: string[];
}

/**
 * 提示词模板管理器
 */
export class PromptTemplateManager {
  private templates: Map<string, PromptTemplate> = new Map();
  private templateDir: string;
  private loadStrategy: Map<string, TemplateLoadStrategy>;

  constructor(templateDir?: string) {
    this.templateDir =
      templateDir || process.env.PROMPT_TEMPLATES_DIR || './prompts/patent-drafting';
    this.loadStrategy = new Map();
    this.initializeLoadStrategy();
  }

  /**
   * 初始化加载策略
   */
  private initializeLoadStrategy() {
    // 定义每个阶段的加载策略
    this.loadStrategy.set('invention-understanding', {
      preload: ['03-creativity-analysis'], // 发明理解需要创造性分析模板
    });

    this.loadStrategy.set('claims-generation', {
      onDemand: ['01-claims-generation'], // 权利要求生成时加载
    });

    this.loadStrategy.set('specification-drafting', {
      onDemand: ['02-specification-drafting'], // 说明书撰写时加载
    });

    this.loadStrategy.set('quality-assessment', {
      lazy: ['01-claims-generation', '02-specification-drafting', '03-creativity-analysis'], // 质量评估时才需要全部模板
    });

    this.loadStrategy.set('full-drafting', {
      preload: ['01-claims-generation'], // 预加载权利要求模板
      onDemand: ['02-specification-drafting', '03-creativity-analysis'], // 按需加载其他模板
    });
  }

  /**
   * 预加载模板（在撰写开始前）
   * @param stage 撰写阶段
   */
  async preload(stage: string): Promise<void> {
    const strategy = this.loadStrategy.get(stage);
    if (!strategy || !strategy.preload) {
      return;
    }

    console.log(`[PromptTemplateManager] 预加载模板: ${strategy.preload.join(', ')}`);

    for (const templateName of strategy.preload) {
      await this.loadTemplate(templateName);
    }
  }

  /**
   * 按需加载模板（在需要时）
   * @param templateName 模板名称
   */
  async loadTemplate(templateName: string): Promise<PromptTemplate> {
    // 检查缓存
    if (this.templates.has(templateName)) {
      return this.templates.get(templateName)!;
    }

    console.log(`[PromptTemplateManager] 加载模板: ${templateName}`);

    // 读取模板文件
    const templatePath = join(this.templateDir, `${templateName}.md`);
    const content = await readFile(templatePath, 'utf-8');

    // 提取变量（{{variable}}格式）
    const variableMatches = content.match(/\{\{(\w+)\}\}/g) || [];
    const variables = variableMatches.map((v) => v.replace(/[{}]/g, ''));

    const template: PromptTemplate = {
      name: templateName,
      description: this.extractDescription(content),
      content,
      variables,
      loadedAt: new Date(),
    };

    // 缓存模板
    this.templates.set(templateName, template);

    return template;
  }

  /**
   * 批量加载模板
   * @param templateNames 模板名称数组
   */
  async loadTemplates(templateNames: string[]): Promise<void> {
    await Promise.all(templateNames.map((name) => this.loadTemplate(name)));
  }

  /**
   * 渲染提示词（替换变量）
   * @param templateName 模板名称
   * @param variables 变量值
   */
  render(templateName: string, variables: Record<string, any>): string {
    const template = this.templates.get(templateName);
    if (!template) {
      throw new Error(`模板 ${templateName} 未加载，请先调用 loadTemplate()`);
    }

    let rendered = template.content;

    // 替换变量
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      rendered = rendered.replace(regex, String(value));
    }

    return rendered;
  }

  /**
   * 检查模板是否已加载
   * @param templateName 模板名称
   */
  isLoaded(templateName: string): boolean {
    return this.templates.has(templateName);
  }

  /**
   * 卸载模板（释放内存）
   * @param templateName 模板名称
   */
  unload(templateName: string): void {
    this.templates.delete(templateName);
    console.log(`[PromptTemplateManager] 卸载模板: ${templateName}`);
  }

  /**
   * 卸载所有模板
   */
  unloadAll(): void {
    const count = this.templates.size;
    this.templates.clear();
    console.log(`[PromptTemplateManager] 卸载所有模板: ${count}个`);
  }

  /**
   * 获取已加载的模板列表
   */
  getLoadedTemplates(): string[] {
    return Array.from(this.templates.keys());
  }

  /**
   * 获取缓存统计
   */
  getCacheStats() {
    return {
      templates: this.templates.size,
      loadedAt: Array.from(this.templates.values()).map((t) => ({
        name: t.name,
        loadedAt: t.loadedAt,
      })),
    };
  }

  /**
   * 提取模板描述
   */
  private extractDescription(content: string): string {
    const match = content.match(/^# (.+)$/m);
    return match ? match[1] : '';
  }

  /**
   * 从知识库提炼提示词（高级功能）
   * @param knowledgeBridge 知识库桥接
   * @param concept 概念名称
   */
  async extractFromKnowledge(knowledgeBridge: any, concept: string): Promise<string> {
    console.log(`[PromptTemplateManager] 从知识库提炼: ${concept}`);

    // 1. 查询概念相关页面
    const relatedPages = await knowledgeBridge.queryByConcept(concept);

    // 2. 读取所有相关页面内容
    const contents = await Promise.all(
      relatedPages.map((page: string) => knowledgeBridge.readWikiPage(page))
    );

    // 3. 提炼结构化提示词
    const prompt = `
# ${concept}提示词模板

> 从宝宸知识库自动提炼
> 提炼时间：${new Date().toISOString()}

## 知识来源

${relatedPages.map((page: string) => `- [[${page}]]`).join('\n')}

## 核心知识

${contents.join('\n\n---\n\n')}

---

*本模板基于${contents.length}个知识页面提炼*
    `;

    return prompt;
  }
}
