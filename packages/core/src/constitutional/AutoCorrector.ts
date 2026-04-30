/**
 * 自动纠正器
 *
 * 对检测到的违规进行自动纠正，支持基于规则和基于LLM的纠正
 */

import type {
  LLMAdapter,
  Violation,
  CorrectionResult,
  AppliedCorrection,
  CorrectionStrategy,
  ConstitutionalAIConfig,
} from './types.js';
import { CorrectionStrategy as Strategy } from './types.js';

/**
 * 自动纠正器
 */
export class AutoCorrector {
  private llm: LLMAdapter | null;
  private config: ConstitutionalAIConfig;

  constructor(llm: LLMAdapter | null, config: ConstitutionalAIConfig) {
    this.llm = llm;
    this.config = config;
  }

  /**
   * 执行自动纠正
   */
  async correct(
    content: string,
    violations: Violation[]
  ): Promise<CorrectionResult> {
    const startTime = Date.now();

    // 过滤出需要纠正的违规（根据严重程度阈值）
    const correctableViolations = this.filterCorrectableViolations(violations);

    if (correctableViolations.length === 0) {
      return {
        correctedContent: content,
        appliedCorrections: [],
        strategy: Strategy.RULE_BASED,
        duration: Date.now() - startTime,
        correctedAt: new Date(),
      };
    }

    // 根据策略选择纠正方法
    const strategy = this.config.correctionStrategy;

    let result: CorrectionResult;

    switch (strategy) {
      case Strategy.RULE_BASED:
        result = await this.correctWithRules(content, correctableViolations);
        break;

      case Strategy.LLM_BASED:
        result = await this.correctWithLLM(content, correctableViolations);
        break;

      case Strategy.HYBRID:
        result = await this.correctWithHybrid(content, correctableViolations);
        break;

      default:
        result = await this.correctWithRules(content, correctableViolations);
    }

    result.duration = Date.now() - startTime;
    result.correctedAt = new Date();

    return result;
  }

  /**
   * 过滤可纠正的违规
   */
  private filterCorrectableViolations(violations: Violation[]): Violation[] {
    const threshold = this.config.severityThreshold;

    // 只纠正严重程度等于或高于阈值的违规
    const severityOrder = {
      critical: 3,
      major: 2,
      minor: 1,
    };

    return violations.filter(v => {
      const violationLevel = severityOrder[v.severity];
      const thresholdLevel = severityOrder[threshold];

      return violationLevel >= thresholdLevel;
    });
  }

  /**
   * 基于规则的纠正
   */
  private async correctWithRules(
    content: string,
    violations: Violation[]
  ): Promise<CorrectionResult> {
    const appliedCorrections: AppliedCorrection[] = [];
    let correctedContent = content;

    // 过滤掉没有location或location不完整的违规
    const validViolations = violations.filter(v => {
      if (!v.location) {
        console.warn('[AutoCorrector] 跳过没有location的违规:', v.principleId);
        return false;
      }
      // 使用typeof检查，因为start可能是0（falsy但有效）
      if (typeof v.location.start !== 'number' || typeof v.location.end !== 'number') {
        console.warn('[AutoCorrector] 跳过location不完整的违规:', v.principleId, v.location);
        return false;
      }
      return true;
    });

    // 按位置倒序排序（从后往前纠正，避免位置偏移）
    const sortedViolations = validViolations.sort(
      (a, b) => b.location.start - a.location.start
    );

    for (const violation of sortedViolations) {
      const correction = await this.applyRuleCorrection(
        correctedContent,
        violation
      );

      console.log('[AutoCorrector correctWithRules] correction结果:', {
        hasCorrection: !!correction,
        correctedContent: correction?.correctedContent,
        originalText: correction?.originalText,
      });

      if (correction) {
        correctedContent = correction.correctedContent;
        appliedCorrections.push(correction);
      }
    }

    return {
      correctedContent,
      appliedCorrections: appliedCorrections.reverse(), // 恢复正序
      strategy: Strategy.RULE_BASED,
      duration: 0, // 会在外层设置
      correctedAt: new Date(),
    };
  }

  /**
   * 应用单个规则纠正
   */
  private async applyRuleCorrection(
    content: string,
    violation: Violation
  ): Promise<AppliedCorrection & { correctedContent: string } | null> {
    // 调试日志
    if (!violation.location) {
      console.error('[AutoCorrector] 违规对象缺少location字段:', violation);
      return null;
    }

    const { location, suggestedCorrection } = violation;
    const originalText = content.substring(location.start, location.end);

    console.log('[AutoCorrector] 尝试纠正:', {
      principleId: violation.principleId,
      originalText,
      suggestedCorrection,
      location,
    });

    // suggestedCorrection通常是描述性文本，不是具体的替换词
    // 只有当它是一个简短的替换词时才直接使用
    if (suggestedCorrection && suggestedCorrection.length > 0 && suggestedCorrection.length < 10) {
      const correctedText = suggestedCorrection;

      const correctedContent =
        content.substring(0, location.start) +
        correctedText +
        content.substring(location.end);

      console.log('[AutoCorrector] 应用建议纠正:', {
        originalText,
        correctedText,
        correctedContent,
      });

      return {
        principleId: violation.principleId,
        originalText,
        correctedText,
        location: { start: location.start, end: location.start + correctedText.length },
        reason: violation.description,
        correctedContent,
      };
    }

    // 否则根据违规类型应用通用规则
    const correction = this.applyGenericCorrection(violation, originalText);
    if (correction !== null) { // 使用 !== null 而不是 if (correction)，因为空字符串是有效纠正
      const correctedContent =
        content.substring(0, location.start) +
        correction +
        content.substring(location.end);

      console.log('[AutoCorrector] 应用通用纠正:', {
        originalText,
        correction,
        correctedContent,
      });

      return {
        principleId: violation.principleId,
        originalText,
        correctedText: correction,
        location: { start: location.start, end: location.start + correction.length },
        reason: violation.description,
        correctedContent,
      };
    }

    console.log('[AutoCorrector] 没有找到合适的纠正方法');
    return null;
  }

  /**
   * 应用通用纠正规则
   */
  private applyGenericCorrection(violation: Violation, originalText: string): string | null {
    // 清楚性原则：替换模糊词汇
    if (violation.principleId === 'clarity') {
      const vagueToSpecific: Record<string, string> = {
        '一些': '多个',
        '某些': '多个',
        '相关': '特定的',
        '适当': '预定的',
        '相应的': '对应的',
      };

      for (const [vague, specific] of Object.entries(vagueToSpecific)) {
        if (originalText === vague) {
          return specific;
        }
      }
    }

    // 确定性原则：移除不确定词汇
    if (violation.principleId === 'definiteness') {
      const indefiniteRemoval: Record<string, string> = {
        '大约': '',
        '左右': '',
        '大概': '',
        '约': '',
      };

      console.log('[AutoCorrector applyGenericCorrection] 检查确定性原则:', {
        originalText,
        dictionary: indefiniteRemoval,
      });

      for (const [term, replacement] of Object.entries(indefiniteRemoval)) {
        if (originalText === term) {
          console.log('[AutoCorrector applyGenericCorrection] 找到匹配:', term, '->', replacement);
          return replacement;
        }
      }

      console.log('[AutoCorrector applyGenericCorrection] 没有找到匹配');
    }

    // 简要性原则：移除冗余表述
    if (violation.principleId === 'brevity') {
      const redundantRemovals: Record<string, string> = {
        '通过连接线连接': '连接',
        '进行配置': '配置',
        '执行操作': '执行',
      };

      for (const [redundant, concise] of Object.entries(redundantRemovals)) {
        if (originalText === redundant) {
          return concise;
        }
      }
    }

    return null;
  }

  /**
   * 基于LLM的纠正
   */
  private async correctWithLLM(
    content: string,
    violations: Violation[]
  ): Promise<CorrectionResult> {
    if (!this.llm || !this.config.useLLMForCorrection) {
      // 如果没有LLM，回退到规则纠正
      return this.correctWithRules(content, violations);
    }

    const appliedCorrections: AppliedCorrection[] = [];
    let correctedContent = content;

    // 按位置倒序排序
    const sortedViolations = [...violations].sort(
      (a, b) => b.location.start - a.location.start
    );

    for (const violation of sortedViolations) {
      const correction = await this.applyLLMCorrection(
        correctedContent,
        violation
      );

      if (correction) {
        // 重新计算完整的correctedContent
        const newCorrectedContent =
          correctedContent.substring(0, violation.location.start) +
          correction.correctedText +
          correctedContent.substring(violation.location.end);

        correctedContent = newCorrectedContent;
        appliedCorrections.push(correction);
      }
    }

    return {
      correctedContent,
      appliedCorrections: appliedCorrections.reverse(),
      strategy: Strategy.LLM_BASED,
      duration: 0,
      correctedAt: new Date(),
    };
  }

  /**
   * 应用单个LLM纠正
   */
  private async applyLLMCorrection(
    content: string,
    violation: Violation
  ): Promise<AppliedCorrection | null> {
    try {
      const prompt = this.buildCorrectionPrompt(content, violation);

      const response = await this.llm!.chat({
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.3, // 低温度，确保纠正的一致性
        maxTokens: 500,
      });

      const correctedText = response.message.content.trim();

      // 验证纠正结果
      if (correctedText && correctedText !== violation.location.text) {
        const correctedContent =
          content.substring(0, violation.location.start) +
          correctedText +
          content.substring(violation.location.end);

        return {
          principleId: violation.principleId,
          originalText: violation.location.text,
          correctedText,
          location: {
            start: violation.location.start,
            end: violation.location.start + correctedText.length,
          },
          reason: `LLM纠正: ${violation.description}`,
        };
      }
    } catch (error) {
      console.error('[AutoCorrector] LLM纠正失败:', error);
    }

    return null;
  }

  /**
   * 构建纠正提示词
   */
  private buildCorrectionPrompt(content: string, violation: Violation): string {
    return `请纠正以下专利文本中的违规问题。

**原则**: ${violation.principleName}
**违规描述**: ${violation.description}
**违规文本**: "${violation.location.text}"
**上下文**: "${violation.location.context || violation.location.text}"

**要求**:
1. 只提供纠正后的文本，不要解释
2. 保持技术准确性
3. 使用专利撰写规范用语
4. 纠正后的文本应当符合${violation.principleName}的要求

**纠正后的文本**:`;
  }

  /**
   * 混合纠正策略
   */
  private async correctWithHybrid(
    content: string,
    violations: Violation[]
  ): Promise<CorrectionResult> {
    const appliedCorrections: AppliedCorrection[] = [];
    let correctedContent = content;

    // 分为两类违规：简单的用规则，复杂的用LLM
    const ruleBasedViolations: Violation[] = [];
    const llmBasedViolations: Violation[] = [];

    for (const violation of violations) {
      // 判断是否适合规则纠正
      if (this.isSimpleViolation(violation)) {
        ruleBasedViolations.push(violation);
      } else {
        llmBasedViolations.push(violation);
      }
    }

    // 先应用规则纠正（快速）
    const ruleResult = await this.correctWithRules(
      correctedContent,
      ruleBasedViolations
    );
    correctedContent = ruleResult.correctedContent;
    appliedCorrections.push(...ruleResult.appliedCorrections);

    // 再应用LLM纠正（智能）
    const llmResult = await this.correctWithLLM(
      correctedContent,
      llmBasedViolations
    );
    correctedContent = llmResult.correctedContent;
    appliedCorrections.push(...llmResult.appliedCorrections);

    return {
      correctedContent,
      appliedCorrections,
      strategy: Strategy.HYBRID,
      duration: 0,
      correctedAt: new Date(),
    };
  }

  /**
   * 判断是否为简单违规（适合规则纠正）
   */
  private isSimpleViolation(violation: Violation): boolean {
    // 清楚性、确定性、简要性的违规通常可以用规则纠正
    const simplePrinciples = ['clarity', 'definiteness', 'brevity'];

    // 如果违规文本较短（<20字），适合规则纠正
    const isShortText = violation.location.text.length < 20;

    return simplePrinciples.includes(violation.principleId) && isShortText;
  }

  /**
   * 验证纠正结果
   */
  async verifyCorrection(
    originalContent: string,
    correctedContent: string,
    violations: Violation[]
  ): Promise<boolean> {
    console.log('[AutoCorrector verifyCorrection] 验证纠正结果:', {
      originalLength: originalContent.length,
      correctedLength: correctedContent.length,
      violationsCount: violations.length,
    });

    // 基本验证：纠正后的文本不应为空
    if (!correctedContent || correctedContent.trim().length === 0) {
      console.warn('[AutoCorrector verifyCorrection] 纠正后文本为空');
      return false;
    }

    // 长度验证：纠正后的文本长度应该相近（±50%，更宽松）
    const originalLength = originalContent.length;
    const correctedLength = correctedContent.length;
    const lengthRatio = correctedLength / originalLength;

    if (lengthRatio < 0.5 || lengthRatio > 1.5) {
      console.warn(
        `[AutoCorrector verifyCorrection] 纠正后文本长度变化过大: ${(lengthRatio * 100).toFixed(1)}%`
      );
      return false;
    }

    // 内容验证：纠正后的文本应该包含所有必要技术特征
    const essentialFeatures = originalContent.match(/包括|包含|设有/g);
    if (essentialFeatures) {
      const featureCount = essentialFeatures.length;
      const correctedFeatures = correctedContent.match(/包括|包含|设有/g);
      const correctedFeatureCount = correctedFeatures ? correctedFeatures.length : 0;

      console.log('[AutoCorrector verifyCorrection] 技术特征检查:', {
        featureCount,
        correctedFeatureCount,
      });

      if (correctedFeatureCount < featureCount * 0.8) {
        console.warn(
          `[AutoCorrector verifyCorrection] 纠正后可能丢失技术特征: ${featureCount} -> ${correctedFeatureCount}`
        );
        return false;
      }
    }

    console.log('[AutoCorrector verifyCorrection] 验证通过');
    return true;
  }
}
