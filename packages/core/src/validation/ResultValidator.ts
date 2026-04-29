/**
 * 结果验证器 - P0 准确率优化方案 #2
 *
 * 核心功能：
 * 1. 结构验证（Zod schema 检查）
 * 2. 内容质量检查（长度、格式、完整性）
 * 3. 逻辑一致性验证（无矛盾、无重复）
 * 4. 自动纠正策略（重试、降级、人工介入）
 */

import { z, ZodSchema } from 'zod';

/**
 * 验证结果
 */
export interface ValidationResult<T = any> {
  /** 是否通过验证 */
  valid: boolean;

  /** 验证通过的数据 */
  data?: T;

  /** 错误信息 */
  errors: string[];

  /** 警告信息 */
  warnings: string[];

  /** 错误类型 */
  errorType?: ValidationErrorType;
}

/**
 * 错误类型
 */
export enum ValidationErrorType {
  /** 结构错误（schema 不匹配） */
  STRUCTURAL = 'structural',

  /** 质量错误（长度、格式、完整性） */
  QUALITY = 'quality',

  /** 逻辑错误（矛盾、重复） */
  LOGICAL = 'logical',
}

/**
 * 质量要求
 */
export interface QualityRequirements {
  /** 最小长度（字符数） */
  minLength?: number;

  /** 最大长度（字符数） */
  maxLength?: number;

  /** 必须包含的关键词 */
  requiredKeywords?: string[];

  /** 禁止包含的关键词 */
  forbiddenKeywords?: string[];

  /** 是否必须完整（不以截断标记结尾） */
  mustBeComplete?: boolean;

  /** 截断标记列表 */
  truncationMarkers?: string[];
}

/**
 * 质量报告
 */
export interface QualityReport {
  /** 是否通过质量检查 */
  passed: boolean;

  /** 长度检查结果 */
  lengthCheck: {
    passed: boolean;
    actualLength: number;
    minLength?: number;
    maxLength?: number;
  };

  /** 关键词检查结果 */
  keywordCheck: {
    passed: boolean;
    missingRequired: string[];
    foundForbidden: string[];
  };

  /** 完整性检查结果 */
  completenessCheck: {
    passed: boolean;
    isTruncated: boolean;
    truncationMarker?: string;
  };
}

/**
 * 不一致性
 */
export interface Inconsistency {
  /** 不一致类型 */
  type: 'contradiction' | 'repetition' | 'gap' | 'other';

  /** 描述 */
  description: string;

  /** 位置（如果有） */
  location?: {
    start: number;
    end: number;
  };
}

/**
 * 纠正策略
 */
export enum CorrectionStrategy {
  /** 重试（简单重试机制） */
  RETRY = 'retry',

  /** 降级（返回部分结果） */
  DEGRADE = 'degrade',

  /** 人工介入（返回错误） */
  MANUAL = 'manual',

  /** 强制接受（标记警告） */
  FORCE_ACCEPT = 'force_accept',
}

/**
 * ResultValidator 配置
 */
export interface ResultValidatorConfig {
  /** 是否启用详细日志 */
  verbose?: boolean;

  /** 默认纠正策略 */
  defaultCorrectionStrategy?: CorrectionStrategy;

  /** 最大重试次数 */
  maxRetries?: number;
}

/**
 * 结果验证器
 */
export class ResultValidator {
  private config: Required<ResultValidatorConfig>;

  constructor(config: ResultValidatorConfig = {}) {
    this.config = {
      verbose: config.verbose ?? true,
      defaultCorrectionStrategy: config.defaultCorrectionStrategy ?? CorrectionStrategy.RETRY,
      maxRetries: config.maxRetries ?? 3,
    };
  }

  /**
   * 验证结果（结构 + 质量 + 逻辑）
   */
  async validate<T>(result: T, schema: ZodSchema<T>): Promise<ValidationResult<T>> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. 结构验证（Zod schema）
    const structuralResult = this.validateStructure(result, schema);
    if (!structuralResult.valid) {
      errors.push(...structuralResult.errors);
      return {
        valid: false,
        errors,
        warnings,
        errorType: ValidationErrorType.STRUCTURAL,
      };
    }

    // 2. 内容质量检查（仅对字符串类型）
    if (typeof result === 'string' || (typeof result === 'object' && result !== null)) {
      const content = this.extractContent(result);
      if (content) {
        const qualityResult = this.checkQuality(content, {});
        if (!qualityResult.passed) {
          if (!qualityResult.lengthCheck.passed) {
            errors.push(
              `长度检查失败: 实际 ${qualityResult.lengthCheck.actualLength} 字符` +
                (qualityResult.lengthCheck.minLength
                  ? `, 要求最小 ${qualityResult.lengthCheck.minLength}`
                  : '') +
                (qualityResult.lengthCheck.maxLength
                  ? `, 要求最大 ${qualityResult.lengthCheck.maxLength}`
                  : '')
            );
          }
          if (!qualityResult.keywordCheck.passed) {
            if (qualityResult.keywordCheck.missingRequired.length > 0) {
              errors.push(
                `缺少必需关键词: ${qualityResult.keywordCheck.missingRequired.join(', ')}`
              );
            }
            if (qualityResult.keywordCheck.foundForbidden.length > 0) {
              errors.push(
                `包含禁止关键词: ${qualityResult.keywordCheck.foundForbidden.join(', ')}`
              );
            }
          }
          if (!qualityResult.completenessCheck.passed) {
            errors.push(
              `内容被截断，检测到标记: ${qualityResult.completenessCheck.truncationMarker}`
            );
          }
          return {
            valid: false,
            errors,
            warnings,
            errorType: ValidationErrorType.QUALITY,
          };
        }
      }
    }

    // 3. 逻辑一致性验证
    const content = this.extractContent(result);
    if (content && typeof content === 'string') {
      const inconsistencies = await this.detectInconsistencies(content);
      if (inconsistencies.length > 0) {
        warnings.push(`检测到 ${inconsistencies.length} 个潜在逻辑问题:`);
        inconsistencies.forEach((inc) => {
          warnings.push(`  - ${inc.type}: ${inc.description}`);
        });
        // 逻辑问题不阻止验证，只发出警告
      }
    }

    return {
      valid: true,
      data: structuralResult.data,
      errors,
      warnings,
    };
  }

  /**
   * 结构验证（Zod schema）
   */
  private validateStructure<T>(result: T, schema: ZodSchema<T>): ValidationResult<T> {
    try {
      const data = schema.parse(result);
      return {
        valid: true,
        data,
        errors: [],
        warnings: [],
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorsList = error.errors.map((e) => `${e.path.join('.') || 'root'}: ${e.message}`);
        return {
          valid: false,
          errors: errorsList,
          warnings: [],
        };
      }
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : String(error)],
        warnings: [],
      };
    }
  }

  /**
   * 内容质量检查
   */
  checkQuality(content: string, requirements: QualityRequirements): QualityReport {
    const lengthCheck = this.checkLength(content, requirements);
    const keywordCheck = this.checkKeywords(content, requirements);
    const completenessCheck = this.checkCompleteness(content, requirements);

    const passed = lengthCheck.passed && keywordCheck.passed && completenessCheck.passed;

    return {
      passed,
      lengthCheck,
      keywordCheck,
      completenessCheck,
    };
  }

  /**
   * 长度检查
   */
  private checkLength(
    content: string,
    requirements: QualityRequirements
  ): QualityReport['lengthCheck'] {
    const actualLength = content.length;
    const minLength = requirements.minLength;
    const maxLength = requirements.maxLength;

    const passed =
      (!minLength || actualLength >= minLength) && (!maxLength || actualLength <= maxLength);

    return {
      passed,
      actualLength,
      minLength,
      maxLength,
    };
  }

  /**
   * 关键词检查
   */
  private checkKeywords(
    content: string,
    requirements: QualityRequirements
  ): QualityReport['keywordCheck'] {
    const missingRequired: string[] = [];
    const foundForbidden: string[] = [];

    // 检查必需关键词
    if (requirements.requiredKeywords) {
      for (const keyword of requirements.requiredKeywords) {
        if (!content.includes(keyword)) {
          missingRequired.push(keyword);
        }
      }
    }

    // 检查禁止关键词
    if (requirements.forbiddenKeywords) {
      for (const keyword of requirements.forbiddenKeywords) {
        if (content.includes(keyword)) {
          foundForbidden.push(keyword);
        }
      }
    }

    const passed = missingRequired.length === 0 && foundForbidden.length === 0;

    return {
      passed,
      missingRequired,
      foundForbidden,
    };
  }

  /**
   * 完整性检查
   */
  private checkCompleteness(
    content: string,
    requirements: QualityRequirements
  ): QualityReport['completenessCheck'] {
    if (!requirements.mustBeComplete) {
      return {
        passed: true,
        isTruncated: false,
      };
    }

    const truncationMarkers = requirements.truncationMarkers || [
      '...',
      '（未完）',
      '(未完)',
      '待续',
      'To be continued',
      '[TRUNCATED]',
      '[INCOMPLETE]',
    ];

    const trimmedContent = content.trim();
    for (const marker of truncationMarkers) {
      if (trimmedContent.endsWith(marker)) {
        return {
          passed: false,
          isTruncated: true,
          truncationMarker: marker,
        };
      }
    }

    return {
      passed: true,
      isTruncated: false,
    };
  }

  /**
   * 逻辑一致性验证
   */
  async detectInconsistencies(content: string): Promise<Inconsistency[]> {
    const inconsistencies: Inconsistency[] = [];

    // 1. 检测矛盾陈述
    const contradictions = this.detectContradictions(content);
    inconsistencies.push(...contradictions);

    // 2. 检测重复内容
    const repetitions = this.detectRepetitions(content);
    inconsistencies.push(...repetitions);

    // 3. 检测逻辑断层
    const gaps = this.detectGaps(content);
    inconsistencies.push(...gaps);

    return inconsistencies;
  }

  /**
   * 检测矛盾陈述
   */
  private detectContradictions(content: string): Inconsistency[] {
    const contradictions: Inconsistency[] = [];

    // 简单矛盾模式：A是对的... A是错的
    const patterns = [
      { pattern: /(.{5,30})是正确的[。，,]?\s*.{0,100}\1是错误的/gs, desc: '相互矛盾的陈述' },
      { pattern: /(.{5,30})是[对真][。，,]?\s*.{0,100}\1是[错假]/gs, desc: '真值矛盾' },
      { pattern: /应该做(.{5,20})[。，,]?\s*.{0,100}不应该做\1/gs, desc: '行动矛盾' },
    ];

    for (const { pattern, desc } of patterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        contradictions.push({
          type: 'contradiction',
          description: desc,
          location: {
            start: match.index || 0,
            end: (match.index || 0) + match[0].length,
          },
        });
      }
    }

    return contradictions;
  }

  /**
   * 检测重复内容
   */
  private detectRepetitions(content: string): Inconsistency[] {
    const repetitions: Inconsistency[] = [];

    // 按句子分割
    const sentences = content.split(/[。！？.!?]/).filter((s) => s.trim().length > 10);

    // 检查相似句子（简单编辑距离）
    for (let i = 0; i < sentences.length; i++) {
      for (let j = i + 1; j < sentences.length; j++) {
        const similarity = this.calculateSimilarity(sentences[i], sentences[j]);
        if (similarity > 0.85) {
          repetitions.push({
            type: 'repetition',
            description: `重复内容: "${sentences[i].trim().substring(0, 30)}..."`,
          });
        }
      }
    }

    return repetitions;
  }

  /**
   * 检测逻辑断层
   */
  private detectGaps(content: string): Inconsistency[] {
    const gaps: Inconsistency[] = [];

    // 检测缺少过渡词的句子序列
    const transitionWords = [
      '因此',
      '所以',
      '然而',
      '但是',
      '此外',
      '另外',
      '首先',
      '其次',
      '最后',
      'then',
      'however',
      'therefore',
    ];

    const sentences = content.split(/[。！？.!?]/).filter((s) => s.trim().length > 5);
    for (let i = 1; i < sentences.length; i++) {
      const prevSentence = sentences[i - 1].trim();
      const currSentence = sentences[i].trim();

      // 如果前一句以结论词结尾，当前句没有过渡词，可能存在断层
      const prevEndsWithConclusion = /因此|所以|综上|可见|得出结论|therefore|thus/.test(
        prevSentence
      );
      const currStartsWithTransition = transitionWords.some((word) =>
        currSentence.startsWith(word)
      );

      if (prevEndsWithConclusion && !currStartsWithTransition && currSentence.length > 20) {
        gaps.push({
          type: 'gap',
          description: '可能缺少过渡词或逻辑连接',
        });
      }
    }

    return gaps;
  }

  /**
   * 计算两个字符串的相似度（简化版）
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const s1 = str1.trim().toLowerCase();
    const s2 = str2.trim().toLowerCase();

    if (s1 === s2) return 1;

    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;

    if (longer.length === 0) return 1;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Levenshtein 距离
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * 提取内容（从对象或字符串）
   */
  private extractContent(result: any): string | null {
    if (typeof result === 'string') {
      return result;
    }

    if (typeof result === 'object' && result !== null) {
      // 尝试提取常见的 content/message/text 字段
      if (typeof result.content === 'string') return result.content;
      if (typeof result.message === 'string') return result.message;
      if (typeof result.text === 'string') return result.text;
      if (typeof result.output === 'string') return result.output;

      // 尝试提取 LLM 响应格式
      if (result.choices && result.choices[0]?.message?.content) {
        return result.choices[0].message.content;
      }
    }

    return null;
  }

  /**
   * 纠正结果
   */
  async correct<T>(
    result: T,
    validationResult: ValidationResult<T>,
    retryFn?: () => Promise<T>
  ): Promise<T> {
    const strategy = this.determineCorrectionStrategy(validationResult);

    this.log(`执行纠正策略: ${strategy}`);

    switch (strategy) {
      case CorrectionStrategy.RETRY:
        if (!retryFn) {
          throw new Error('重试策略需要提供 retryFn');
        }
        return await this.retryWithBackoff(retryFn);

      case CorrectionStrategy.DEGRADE:
        return this.degradeResult(result, validationResult);

      case CorrectionStrategy.MANUAL:
        throw new Error(`验证失败，需要人工介入: ${validationResult.errors.join('; ')}`);

      case CorrectionStrategy.FORCE_ACCEPT:
        this.log('强制接受结果（带有警告）');
        if (validationResult.warnings.length > 0) {
          console.warn('[ResultValidator] 警告:', validationResult.warnings);
        }
        return result;

      default:
        throw new Error(`未知的纠正策略: ${strategy}`);
    }
  }

  /**
   * 确定纠正策略
   */
  private determineCorrectionStrategy<T>(result: ValidationResult<T>): CorrectionStrategy {
    // 结构错误：重试
    if (result.errorType === ValidationErrorType.STRUCTURAL) {
      return CorrectionStrategy.RETRY;
    }

    // 质量错误：根据默认策略
    if (result.errorType === ValidationErrorType.QUALITY) {
      return this.config.defaultCorrectionStrategy;
    }

    // 逻辑错误：强制接受（只警告）
    if (result.errorType === ValidationErrorType.LOGICAL) {
      return CorrectionStrategy.FORCE_ACCEPT;
    }

    // 未知错误：使用默认策略
    return this.config.defaultCorrectionStrategy;
  }

  /**
   * 重试（带指数退避）
   */
  private async retryWithBackoff<T>(retryFn: () => Promise<T>): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        this.log(`重试 ${attempt}/${this.config.maxRetries}`);
        return await retryFn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.log(`重试 ${attempt} 失败: ${lastError.message}`);

        if (attempt < this.config.maxRetries) {
          const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new Error('所有重试均失败');
  }

  /**
   * 降级结果
   */
  private degradeResult<T>(result: T, validationResult: ValidationResult<T>): T {
    this.log('降级处理: 返回部分结果');

    // 如果是字符串，添加警告前缀
    if (typeof result === 'string') {
      return `[警告: 验证未通过] ${result}` as T;
    }

    // 如果是对象，尝试添加警告字段
    if (typeof result === 'object' && result !== null && !Array.isArray(result)) {
      const degradedResult = {
        ...result,
        _validationWarnings: validationResult.errors,
      };
      return degradedResult as T;
    }

    // 其他情况，直接返回
    return result;
  }

  /**
   * 延迟函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 日志输出
   */
  private log(message: string): void {
    if (!this.config.verbose) return;

    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [ResultValidator] ${message}`);
  }
}
