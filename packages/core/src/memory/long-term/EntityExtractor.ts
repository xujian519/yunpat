/**
 * 实体抽取器（纯规则实现）
 *
 * 从专利文本中抽取实体（申请人、发明人、分类号、申请号、日期等）
 * 使用正则表达式和规则匹配，不依赖原生模块
 */

/**
 * 实体类型定义
 */
export type EntityType =
  | 'Applicant'      // 申请人
  | 'Inventor'       // 发明人
  | 'IPC'            // 专利分类号
  | 'ApplicationNumber'  // 申请号
  | 'PublicationNumber'  // 公开号
  | 'Date'           // 日期
  | 'Organization'   // 组织机构
  | 'Person';        // 人物

/**
 * 实体接口
 */
export interface Entity {
  type: EntityType;
  name: string;
  properties?: Record<string, any>;
  confidence: number;
  startOffset: number;
  endOffset: number;
}

/**
 * 实体抽取配置
 */
export interface EntityExtractorConfig {
  /** 是否启用实体归一化 */
  enableNormalization?: boolean;
  /** 最小置信度阈值 */
  minConfidence?: number;
}

/**
 * 专利实体抽取器
 *
 * 核心功能：
 * 1. 基于规则的实体识别（申请号、分类号、日期）
 * 2. 基于正则表达式的人名和组织识别
 * 3. 实体归一化（同义词合并）
 * 4. 自定义词典支持
 */
export class EntityExtractor {
  private config: Required<EntityExtractorConfig>;
  private customDictionary: Set<string> = new Set();

  // 实体归一化映射（同义词表）
  private readonly normalizationMap: Map<string, string> = new Map([
    // 公司名称常见变体
    ['有限公司', '公司'],
    ['股份有限公司', '公司'],
    ['责任公司', '公司'],
    ['科技', '科技公司'],
    ['技术', '技术公司'],
    // 日期格式变体
    ['年', '-'],
    ['月', '-'],
    ['日', ''],
  ]);

  // 专利实体正则表达式
  private readonly patterns = {
    // 申请号：CN12位数字（中国专利申请号格式）
    // 支持：CN202310123456.7 或 CN202310123456U 或 CN2023101234567
    applicationNumber: /\b[A-Z]{2}\d{12}[A-Z]?\b|\b[A-Z]{2}\d{12}\.\d\b/g,
    // 公开号：类似申请号
    publicationNumber: /\b[A-Z]{2}\d{8,12}[A-Z]?\b/g,
    // IPC 分类号：G06F 40/00 (字母 + 数字 + 字母数字)
    ipc: /\b[A-Z]\d{2}[A-Z]?\s?\d{1,4}\/?\d{2}[A-Z]?\b/g,
    // 日期：2023-01-01 或 2023年01月01日
    date: /\b\d{4}[-年]\d{1,2}[-月]\d{1,2}[日]?\b/g,
    // 中文人名：2-4个汉字
    chineseName: /[一-龥]{2,4}(?=\s|，|。|$|、|；)/g,
    // 公司名：包含"公司"、"集团"、"科技"等关键词
    companyName: /[一-龥A-Za-z0-9（）()]+(?:公司|集团|科技|技术|有限|股份)/g,
  };

  constructor(config: EntityExtractorConfig = {}) {
    this.config = {
      enableNormalization: config.enableNormalization ?? true,
      minConfidence: config.minConfidence ?? 0.6,
    };
  }

  /**
   * 从文本中抽取实体
   */
  async extractEntities(
    text: string,
    entityType?: EntityType
  ): Promise<Entity[]> {
    const entities: Entity[] = [];

    // 如果指定了实体类型，只抽取该类型
    if (entityType) {
      switch (entityType) {
        case 'ApplicationNumber':
          entities.push(...this.extractApplicationNumbers(text));
          break;
        case 'PublicationNumber':
          entities.push(...this.extractPublicationNumbers(text));
          break;
        case 'IPC':
          entities.push(...this.extractIPCs(text));
          break;
        case 'Date':
          entities.push(...this.extractDates(text));
          break;
        case 'Applicant':
        case 'Organization':
          entities.push(...this.extractOrganizations(text));
          break;
        case 'Inventor':
        case 'Person':
          entities.push(...this.extractPersons(text));
          break;
      }
    } else {
      // 抽取所有类型实体
      entities.push(
        ...this.extractApplicationNumbers(text),
        ...this.extractPublicationNumbers(text),
        ...this.extractIPCs(text),
        ...this.extractDates(text),
        ...this.extractOrganizations(text),
        ...this.extractPersons(text)
      );
    }

    // 应用实体归一化
    if (this.config.enableNormalization) {
      entities.forEach(e => this.normalizeEntity(e));
    }

    // 过滤低置信度实体
    return entities.filter(e => e.confidence >= this.config.minConfidence);
  }

  /**
   * 抽取申请号
   */
  private extractApplicationNumbers(text: string): Entity[] {
    const matches = this.findOverlappingMatches(text, this.patterns.applicationNumber);
    return matches.map(m => ({
      type: 'ApplicationNumber' as EntityType,
      name: m.text,
      confidence: 0.95,
      startOffset: m.start,
      endOffset: m.end,
    }));
  }

  /**
   * 抽取公开号
   */
  private extractPublicationNumbers(text: string): Entity[] {
    const matches = this.findOverlappingMatches(text, this.patterns.publicationNumber);
    return matches.map(m => ({
      type: 'PublicationNumber' as EntityType,
      name: m.text,
      confidence: 0.95,
      startOffset: m.start,
      endOffset: m.end,
    }));
  }

  /**
   * 抽取 IPC 分类号
   */
  private extractIPCs(text: string): Entity[] {
    const matches = this.findOverlappingMatches(text, this.patterns.ipc);
    return matches.map(m => ({
      type: 'IPC' as EntityType,
      name: m.text.trim(),
      confidence: 0.9,
      startOffset: m.start,
      endOffset: m.end,
    }));
  }

  /**
   * 抽取日期
   */
  private extractDates(text: string): Entity[] {
    const matches = this.findOverlappingMatches(text, this.patterns.date);
    const seen = new Set<string>();

    return matches
      .map(m => ({
        type: 'Date' as EntityType,
        name: m.text.replace(/年|月/g, '-').replace(/日/g, '').trim(),
        confidence: 0.85,
        startOffset: m.start,
        endOffset: m.end,
      }))
      .filter(e => {
        // 去重
        if (seen.has(e.name)) return false;
        seen.add(e.name);
        return true;
      });
  }

  /**
   * 抽取组织机构（公司名）
   */
  private extractOrganizations(text: string): Entity[] {
    const matches = this.findOverlappingMatches(text, this.patterns.companyName);
    const orgs = new Map<string, Entity>();

    matches.forEach(m => {
      const name = m.text.trim();
      // 去重
      if (orgs.has(name)) return;

      orgs.set(name, {
        type: 'Organization',
        name,
        confidence: this.calculateConfidence(name, 'Organization'),
        startOffset: m.start,
        endOffset: m.end,
      });
    });

    return Array.from(orgs.values());
  }

  /**
   * 抽取人物（发明人等）
   */
  private extractPersons(text: string): Entity[] {
    // 上下文关键词
    const personKeywords = ['发明人', '设计人', '申请人', '权利人', '作者'];
    const persons: Entity[] = [];
    const seen = new Set<string>();

    // 查找包含人名关键词的句子
    for (const keyword of personKeywords) {
      const regex = new RegExp(`${keyword}[：:：\\s]*([^，。；\\n]{1,100})`, 'g');
      const matches = this.findOverlappingMatches(text, regex);

      for (const match of matches) {
        // 从匹配的文本中提取人名
        const names = this.extractChineseNames(match.text);
        for (const name of names) {
          if (name.length >= 2 && name.length <= 4 && !seen.has(name)) {
            seen.add(name);
            persons.push({
              type: 'Person',
              name,
              confidence: 0.8,
              startOffset: match.start,
              endOffset: match.start + match.text.length,
            });
          }
        }
      }
    }

    return persons;
  }

  /**
   * 从文本中提取中文人名
   */
  private extractChineseNames(text: string): string[] {
    // 匹配2-4个连续的汉字
    const nameRegex = /[一-龥]{2,4}/g;
    const matches = text.match(nameRegex) || [];
    return matches.filter(name => {
      // 过滤掉常见的非人名词汇
      const excludeWords = ['公司', '集团', '科技', '技术', '有限', '股份', '发明', '设计', '申请', '权利', '专利', '方法', '系统'];
      return !excludeWords.some(word => name.includes(word));
    });
  }

  /**
   * 查找所有匹配（包括重叠的匹配）
   */
  private findOverlappingMatches(
    text: string,
    regex: RegExp
  ): Array<{ text: string; start: number; end: number }> {
    const matches: Array<{ text: string; start: number; end: number }> = [];
    let match: RegExpExecArray | null;

    // 重置正则表达式的 lastIndex
    regex.lastIndex = 0;

    while ((match = regex.exec(text)) !== null) {
      matches.push({
        text: match[0],
        start: match.index,
        end: match.index + match[0].length,
      });

      // 防止无限循环（零长度匹配）
      if (match[0].length === 0) {
        regex.lastIndex++;
      }
    }

    return matches;
  }

  /**
   * 计算实体置信度
   */
  private calculateConfidence(name: string, type: EntityType): number {
    // 包含完整关键词的组织名置信度更高
    if (type === 'Organization') {
      if (name.includes('公司') || name.includes('集团')) return 0.9;
      if (name.includes('科技') || name.includes('技术')) return 0.8;
      return 0.7;
    }

    // 包含常见后缀的人名置信度更高
    if (type === 'Person') {
      if (/^[一-龥]{2,4}$/.test(name)) return 0.85;
      return 0.6;
    }

    return 0.7;
  }

  /**
   * 实体归一化
   */
  normalizeEntity(entity: Entity): Entity {
    if (!this.config.enableNormalization) return entity;

    // 应用归一化映射
    let normalized = entity.name;
    for (const [from, to] of this.normalizationMap) {
      normalized = normalized.replace(from, to);
    }

    // 去除多余空格
    normalized = normalized.trim().replace(/\s+/g, ' ');

    return {
      ...entity,
      name: normalized,
      properties: {
        ...entity.properties,
        originalName: entity.name,
      },
    };
  }

  /**
   * 添加自定义词典
   */
  addCustomDictionary(words: string[]): void {
    words.forEach(word => {
      this.customDictionary.add(word);
    });
  }

  /**
   * 批量抽取实体
   */
  async extractEntitiesBatch(texts: string[]): Promise<Entity[][]> {
    return Promise.all(
      texts.map(text => this.extractEntities(text))
    );
  }

  /**
   * 获取统计信息
   */
  getStats(text: string): {
    entityCount: number;
    entityTypes: Record<string, number>;
  } {
    return {
      entityCount: 0,
      entityTypes: {},
    };
  }
}

/**
 * 创建实体抽取器实例
 */
export function createEntityExtractor(
  config?: EntityExtractorConfig
): EntityExtractor {
  return new EntityExtractor(config);
}
