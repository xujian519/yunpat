/**
 * Constitutional AI 主类
 *
 * 整合合规检查和自动纠正功能，提供完整的Constitutional AI能力
 */

import type {
  LLMAdapter,
  ConstitutionalPrinciple,
  ComplianceReport,
  CorrectionResult,
  Violation,
  ConstitutionalAIConfig,
  ConflictResolution,
} from './types.js';
import { CorrectionStrategy, ViolationSeverity } from './types.js';
import { ComplianceChecker } from './ComplianceChecker.js';
import { AutoCorrector } from './AutoCorrector.js';

/**
 * 默认配置
 */
const DEFAULT_CONFIG: ConstitutionalAIConfig = {
  enabledPrinciples: [],
  correctionStrategy: CorrectionStrategy.HYBRID,
  severityThreshold: ViolationSeverity.MAJOR,
  useLLMForCheck: false,
  useLLMForCorrection: true,
  maxLLMConcurrency: 3,
};

/**
 * Constitutional AI 主类
 */
export class ConstitutionalAI {
  private principles: ConstitutionalPrinciple[];
  private config: ConstitutionalAIConfig;
  private checker: ComplianceChecker;
  private corrector: AutoCorrector;
  private llm: LLMAdapter | null;

  constructor(
    principles: ConstitutionalPrinciple[],
    llm: LLMAdapter | null = null,
    config: Partial<ConstitutionalAIConfig> = {}
  ) {
    this.principles = principles;
    this.llm = llm;
    this.config = { ...DEFAULT_CONFIG, ...config };

    this.checker = new ComplianceChecker(principles, this.config);
    this.corrector = new AutoCorrector(llm, this.config);
  }

  /**
   * 检查内容合规性
   */
  async checkCompliance(content: string): Promise<ComplianceReport> {
    return this.checker.checkCompliance(content);
  }

  /**
   * 纠正违规内容
   */
  async correct(content: string, violations?: Violation[]): Promise<CorrectionResult> {
    let violationsToCorrect = violations;

    // 如果没有提供违规列表，先进行检查
    if (!violationsToCorrect) {
      const report = await this.checkCompliance(content);
      violationsToCorrect = report.violations;
    }

    // 执行纠正
    const result = await this.corrector.correct(content, violationsToCorrect);

    console.log('[ConstitutionalAI.correct] 纠正结果:', {
      originalContent: content,
      correctedContent: result.correctedContent,
      appliedCorrections: result.appliedCorrections.length,
    });

    // 验证纠正结果
    const isValid = await this.corrector.verifyCorrection(
      content,
      result.correctedContent,
      violationsToCorrect
    );

    console.log('[ConstitutionalAI.correct] 验证结果:', isValid);

    if (!isValid) {
      console.warn('[ConstitutionalAI] 纠正结果验证失败，返回原始内容');
      return {
        correctedContent: content,
        appliedCorrections: [],
        strategy: result.strategy,
        duration: result.duration,
        correctedAt: new Date(),
      };
    }

    console.log('[ConstitutionalAI.correct] 返回纠正结果');
    return result;
  }

  /**
   * 检查并纠正（一步完成）
   */
  async checkAndCorrect(content: string): Promise<{
    report: ComplianceReport;
    correction: CorrectionResult;
  }> {
    const report = await this.checkCompliance(content);
    const correction = await this.correct(content, report.violations);

    return { report, correction };
  }

  /**
   * 解决原则冲突
   */
  async resolveConflicts(violations: Violation[]): Promise<ConflictResolution> {
    // 按原则分组违规
    const violationsByPrinciple = new Map<string, Violation[]>();
    for (const violation of violations) {
      if (!violationsByPrinciple.has(violation.principleId)) {
        violationsByPrinciple.set(violation.principleId, []);
      }
      violationsByPrinciple.get(violation.principleId)!.push(violation);
    }

    // 检测冲突：同一位置的多个违规
    const conflicts = this.detectConflicts(violations);

    if (conflicts.length === 0) {
      return {
        keptViolations: violations,
        removedViolations: [],
        resolution: '无原则冲突',
      };
    }

    // 解决冲突：保留高优先级原则的违规
    const resolvedViolations: Violation[] = [];
    const removedViolations: Violation[] = [];

    for (const conflict of conflicts) {
      const sortedByPriority = conflict.sort((a, b) => {
        const priorityA = this.getPrinciplePriority(a.principleId);
        const priorityB = this.getPrinciplePriority(b.principleId);
        return priorityB - priorityA; // 降序
      });

      // 保留最高优先级的违规
      const kept = sortedByPriority[0];
      resolvedViolations.push(kept);

      // 移除低优先级的违规
      const removed = sortedByPriority.slice(1);
      removedViolations.push(...removed);
    }

    // 添加无冲突的违规
    const conflictIds = new Set(
      conflicts.flat().map((v) => `${v.principleId}-${v.location.start}`)
    );
    for (const violation of violations) {
      const key = `${violation.principleId}-${violation.location.start}`;
      if (!conflictIds.has(key)) {
        resolvedViolations.push(violation);
      }
    }

    return {
      keptViolations: resolvedViolations,
      removedViolations,
      resolution: `解决了${conflicts.length}个原则冲突，保留高优先级原则的违规`,
    };
  }

  /**
   * 检测冲突的违规
   */
  private detectConflicts(violations: Violation[]): Violation[][] {
    const conflicts: Violation[][] = [];

    // 按位置分组违规
    const violationsByLocation = new Map<string, Violation[]>();
    for (const violation of violations) {
      const locationKey = `${violation.location.start}-${violation.location.end}`;
      if (!violationsByLocation.has(locationKey)) {
        violationsByLocation.set(locationKey, []);
      }
      violationsByLocation.get(locationKey)!.push(violation);
    }

    // 找出有多个违规的位置
    for (const [_location, violationsAtLocation] of violationsByLocation) {
      if (violationsAtLocation.length > 1) {
        conflicts.push(violationsAtLocation);
      }
    }

    return conflicts;
  }

  /**
   * 获取原则优先级
   */
  private getPrinciplePriority(principleId: string): number {
    const principle = this.principles.find((p) => p.id === principleId);
    return principle ? principle.priority : 0;
  }

  /**
   * 批量检查多个内容
   */
  async batchCheck(contents: string[]): Promise<ComplianceReport[]> {
    const reports: ComplianceReport[] = [];

    for (const content of contents) {
      const report = await this.checkCompliance(content);
      reports.push(report);
    }

    return reports;
  }

  /**
   * 生成合规报告（文本格式）
   */
  generateReportText(report: ComplianceReport): string {
    const lines: string[] = [];

    lines.push('='.repeat(80));
    lines.push('专利合规性检查报告');
    lines.push('='.repeat(80));
    lines.push('');

    // 总体结果
    lines.push(`📊 总体合规分数: ${(report.score * 100).toFixed(1)}%`);
    lines.push(`📋 合规状态: ${report.overallCompliant ? '✅ 合规' : '❌ 不合规'}`);
    lines.push(`⏱️  检查耗时: ${report.duration}ms`);
    lines.push(`🕐 检查时间: ${report.checkedAt.toLocaleString('zh-CN')}`);
    lines.push('');

    // 违规详情
    if (report.violations.length > 0) {
      lines.push('❌ 违规详情');
      lines.push('-'.repeat(80));

      for (const violation of report.violations) {
        lines.push(`[${violation.severity.toUpperCase()}] ${violation.principleName}`);
        lines.push(`  位置: ${violation.location.text}`);
        lines.push(`  描述: ${violation.description}`);
        lines.push(`  建议: ${violation.suggestedCorrection}`);
        lines.push(`  置信度: ${(violation.confidence * 100).toFixed(1)}%`);
        lines.push('');
      }
    }

    // 警告详情
    if (report.warnings.length > 0) {
      lines.push('⚠️  警告详情');
      lines.push('-'.repeat(80));

      for (const warning of report.warnings) {
        lines.push(`[${warning.principleName}]`);
        lines.push(`  描述: ${warning.description}`);
        if (warning.location) {
          lines.push(`  位置: ${warning.location.text}`);
        }
        lines.push(`  建议: ${warning.suggestion}`);
        lines.push('');
      }
    }

    // 统计信息
    if (report.statistics.length > 0) {
      lines.push('📈 统计信息');
      lines.push('-'.repeat(80));

      for (const stat of report.statistics) {
        lines.push(
          `  ${stat.principleName}: ${stat.violationCount} 违规, ${stat.warningCount} 警告`
        );
      }
      lines.push('');
    }

    lines.push('='.repeat(80));

    return lines.join('\n');
  }

  /**
   * 获取启用的原则列表
   */
  getEnabledPrinciples(): ConstitutionalPrinciple[] {
    return this.checker.getPrinciples();
  }

  /**
   * 获取配置
   */
  getConfig(): ConstitutionalAIConfig {
    return this.checker.getConfig();
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<ConstitutionalAIConfig>): void {
    this.config = { ...this.config, ...config };
    this.checker.updateConfig(config);

    // 更新corrector配置
    this.corrector = new AutoCorrector(this.llm, this.config);
  }

  /**
   * 添加原则
   */
  addPrinciple(principle: ConstitutionalPrinciple): void {
    this.principles.push(principle);
    this.checker = new ComplianceChecker(this.principles, this.config);
  }

  /**
   * 移除原则
   */
  removePrinciple(principleId: string): void {
    this.principles = this.principles.filter((p) => p.id !== principleId);
    this.checker = new ComplianceChecker(this.principles, this.config);
  }

  /**
   * 获取原则详情
   */
  getPrinciple(principleId: string): ConstitutionalPrinciple | undefined {
    return this.principles.find((p) => p.id === principleId);
  }

  /**
   * 获取所有原则
   */
  getAllPrinciples(): ConstitutionalPrinciple[] {
    return [...this.principles];
  }
}
