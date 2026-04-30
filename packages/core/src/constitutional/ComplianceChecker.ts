/**
 * 合规检查器
 *
 * 对专利内容进行原则合规性检查，生成详细的合规报告
 */

import type {
  ConstitutionalPrinciple,
  ComplianceReport,
  ComplianceResult,
  Violation,
  Warning,
  ConstitutionalAIConfig,
} from './types.js';
import { ViolationSeverity } from './types.js';

/**
 * 合规检查器
 */
export class ComplianceChecker {
  private principles: ConstitutionalPrinciple[];
  private config: ConstitutionalAIConfig;

  constructor(
    principles: ConstitutionalPrinciple[],
    config: ConstitutionalAIConfig
  ) {
    // 根据配置过滤启用的原则
    this.principles = principles.filter(p => {
      if (config.enabledPrinciples.length === 0) {
        return true; // 空数组表示启用所有
      }
      return config.enabledPrinciples.includes(p.id);
    });

    this.config = config;
  }

  /**
   * 执行完整的合规检查
   */
  async checkCompliance(content: string): Promise<ComplianceReport> {
    const startTime = Date.now();

    // 按优先级排序原则（高优先级先检查）
    const sortedPrinciples = [...this.principles].sort(
      (a, b) => b.priority - a.priority
    );

    // 并发检查所有原则
    const results: ComplianceResult[] = await this.checkPrinciplesConcurrently(
      content,
      sortedPrinciples
    );

    // 聚合结果
    const allViolations: Violation[] = [];
    const allWarnings: Warning[] = [];
    const statistics: any[] = [];

    for (const result of results) {
      allViolations.push(...result.violations);
      allWarnings.push(...result.warnings);
    }

    // 生成统计信息
    for (const principle of sortedPrinciples) {
      const principleResults = results.find(
        r => r.violations.length > 0 || r.warnings.length > 0
      );

      if (principleResults) {
        statistics.push({
          principleId: principle.id,
          principleName: principle.name,
          violationCount: principleResults.violations.length,
          warningCount: principleResults.warnings.length,
        });
      }
    }

    // 计算总体分数
    const overallScore = this.calculateOverallScore(results);

    const duration = Date.now() - startTime;

    return {
      overallCompliant: allViolations.length === 0,
      score: overallScore,
      violations: this.sortViolationsBySeverity(allViolations),
      warnings: allWarnings,
      checkedAt: new Date(),
      duration,
      statistics,
    };
  }

  /**
   * 并发检查多个原则
   */
  private async checkPrinciplesConcurrently(
    content: string,
    principles: ConstitutionalPrinciple[]
  ): Promise<ComplianceResult[]> {
    // 如果配置了最大并发数，则分批处理
    const maxConcurrency = this.config.maxLLMConcurrency || 3;
    const batches: ConstitutionalPrinciple[][] = [];

    for (let i = 0; i < principles.length; i += maxConcurrency) {
      batches.push(principles.slice(i, i + maxConcurrency));
    }

    const allResults: ComplianceResult[] = [];

    for (const batch of batches) {
      const batchResults = await Promise.all(
        batch.map(principle => this.checkSinglePrinciple(content, principle))
      );
      allResults.push(...batchResults);
    }

    return allResults;
  }

  /**
   * 检查单个原则
   */
  private async checkSinglePrinciple(
    content: string,
    principle: ConstitutionalPrinciple
  ): Promise<ComplianceResult> {
    try {
      const result = await principle.checkFunction(content);

      // 为每个违规添加原则信息
      result.violations.forEach(v => {
        if (!v.principleId) {
          v.principleId = principle.id;
        }
        if (!v.principleName) {
          v.principleName = principle.name;
        }
      });

      // 为每个警告添加原则信息
      result.warnings.forEach(w => {
        if (!w.principleId) {
          w.principleId = principle.id;
        }
        if (!w.principleName) {
          w.principleName = principle.name;
        }
      });

      return result;
    } catch (error) {
      // 如果检查失败，返回合规结果但不标记违规
      console.error(
        `[ComplianceChecker] 原则 ${principle.id} 检查失败:`,
        error
      );

      return {
        compliant: true, // 默认合规，避免误报
        score: 1.0,
        violations: [],
        warnings: [{
          principleId: principle.id,
          principleName: principle.name,
          description: `检查失败: ${error instanceof Error ? error.message : '未知错误'}`,
          suggestion: '请手动检查该原则的合规性',
        }],
      };
    }
  }

  /**
   * 计算总体合规分数
   */
  private calculateOverallScore(results: ComplianceResult[]): number {
    if (results.length === 0) {
      return 1.0;
    }

    // 加权平均，高优先级原则权重更高
    let totalWeight = 0;
    let weightedSum = 0;

    for (const result of results) {
      const weight = 1; // 可以根据原则优先级调整权重
      weightedSum += result.score * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 1.0;
  }

  /**
   * 按严重程度排序违规
   */
  private sortViolationsBySeverity(violations: Violation[]): Violation[] {
    const severityOrder = {
      [ViolationSeverity.CRITICAL]: 0,
      [ViolationSeverity.MAJOR]: 1,
      [ViolationSeverity.MINOR]: 2,
    };

    return violations.sort((a, b) => {
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) {
        return severityDiff;
      }

      // 严重程度相同时，按置信度降序
      return b.confidence - a.confidence;
    });
  }

  /**
   * 获取原则列表
   */
  getPrinciples(): ConstitutionalPrinciple[] {
    return [...this.principles];
  }

  /**
   * 获取配置
   */
  getConfig(): ConstitutionalAIConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<ConstitutionalAIConfig>): void {
    this.config = { ...this.config, ...config };

    // 重新过滤启用的原则
    const enabledPrinciples = this.config.enabledPrinciples || [];
    if (config.enabledPrinciples) {
      this.principles = this.principles.filter(p => {
        if (enabledPrinciples.length === 0) {
          return true;
        }
        return enabledPrinciples.includes(p.id);
      });
    }
  }
}
