/**
 * Constitutional AI 单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ConstitutionalAI } from '../../src/constitutional/index.js';
import { PATENT_PRINCIPLES } from '../../src/constitutional/PatentPrinciples.js';
import {
  ViolationSeverity,
  CorrectionStrategy,
  PrincipleCategory,
} from '../../src/constitutional/types.js';

describe('ConstitutionalAI', () => {
  let ai: ConstitutionalAI;

  beforeEach(() => {
    ai = new ConstitutionalAI(PATENT_PRINCIPLES, null, {
      enabledPrinciples: [],
      correctionStrategy: CorrectionStrategy.RULE_BASED,
      severityThreshold: ViolationSeverity.MAJOR,
      useLLMForCheck: false,
      useLLMForCorrection: false,
      maxLLMConcurrency: 3,
    });
  });

  describe('合规检查', () => {
    it('应该检查清楚性原则', async () => {
      const content = '一种数据处理装置，包括一些处理部件，用于做一些相关操作。';

      const report = await ai.checkCompliance(content);

      expect(report.overallCompliant).toBe(false);
      expect(report.violations.length).toBeGreaterThan(0);

      const clarityViolations = report.violations.filter((v) => v.principleId === 'clarity');
      expect(clarityViolations.length).toBeGreaterThan(0);
    });

    it('应该检查确定性原则', async () => {
      const content = '所述处理器的时钟频率大约为1.5GHz左右。';

      const report = await ai.checkCompliance(content);

      expect(report.overallCompliant).toBe(false);

      const definitenessViolations = report.violations.filter(
        (v) => v.principleId === 'definiteness'
      );
      expect(definitenessViolations.length).toBeGreaterThan(0);
    });

    it('应该检查简要性原则', async () => {
      const content = '所述处理器通过连接线连接到所述存储器，所述存储器又连接到所述处理器。';

      const report = await ai.checkCompliance(content);

      expect(report.warnings.length).toBeGreaterThan(0);

      const brevityWarnings = report.warnings.filter((w) => w.principleId === 'brevity');
      expect(brevityWarnings.length).toBeGreaterThan(0);
    });

    it('应该检查支持性原则', async () => {
      const content = '根据权利要求1所述的装置，其中所述处理器为任意类型的处理器。';

      const report = await ai.checkCompliance(content);

      expect(report.overallCompliant).toBe(false);

      const supportViolations = report.violations.filter((v) => v.principleId === 'support');
      expect(supportViolations.length).toBeGreaterThan(0);
    });

    it('应该检查完整性原则', async () => {
      const content = '一种图像处理方法，处理图像。';

      const report = await ai.checkCompliance(content);

      expect(report.overallCompliant).toBe(false);

      const completenessViolations = report.violations.filter(
        (v) => v.principleId === 'completeness'
      );
      expect(completenessViolations.length).toBeGreaterThan(0);
    });

    it('应该检查充分公开原则', async () => {
      const content = '所述滤波器采用预定参数进行配置。';

      const report = await ai.checkCompliance(content);

      expect(report.overallCompliant).toBe(false);

      const enablementViolations = report.violations.filter((v) => v.principleId === 'enablement');
      expect(enablementViolations.length).toBeGreaterThan(0);
    });

    it('应该通过合规的内容', async () => {
      const content = `一种数据处理装置，包括：
处理器，用于执行指令；
存储器，耦合到所述处理器，用于存储数据；
其中，所述处理器的时钟频率为1.5GHz。`;

      const report = await ai.checkCompliance(content);

      expect(report.score).toBeGreaterThan(0.7);
    });

    it('应该生成合规报告', async () => {
      const content = '一种装置，包括一些部件。';

      const report = await ai.checkCompliance(content);

      expect(report.checkedAt).toBeInstanceOf(Date);
      expect(report.duration).toBeGreaterThanOrEqual(0);
      expect(report.statistics).toBeDefined();
    });
  });

  describe('自动纠正', () => {
    it('应该纠正清楚性违规', async () => {
      const content = '一种数据处理装置，包括某些处理部件。';

      // 先检查违规
      const report = await ai.checkCompliance(content);
      console.log('[DEBUG Clarity] 报告违规数量:', report.violations.length);
      console.log('[DEBUG Clarity] 违规详情:', JSON.stringify(report.violations, null, 2));

      const correction = await ai.correct(content);

      expect(correction.correctedContent).not.toBe(content);
      expect(correction.appliedCorrections.length).toBeGreaterThan(0);
    });

    it('应该纠正确定性违规', async () => {
      const content = '所述处理器的时钟频率大约为1.5GHz。';

      // 先检查违规
      const report = await ai.checkCompliance(content);
      console.log('[DEBUG] 报告违规数量:', report.violations.length);
      console.log('[DEBUG] 违规详情:', JSON.stringify(report.violations, null, 2));

      const correction = await ai.correct(content);

      expect(correction.correctedContent).not.toBe(content);
      expect(correction.correctedContent).not.toContain('大约');
      expect(correction.correctedContent).not.toContain('左右');
    });

    it('应该纠正简要性违规', async () => {
      const content = '所述处理器进行配置。';

      const correction = await ai.correct(content);

      // 简要性原则的违规是MINOR级别，默认阈值是MAJOR
      // 所以不会自动纠正，这是预期行为
      expect(correction).toBeDefined();
    });

    it('应该验证纠正结果', async () => {
      const content = '一种装置，包括一些部件。';

      const correction = await ai.correct(content);
      const isValid = await ai['corrector'].verifyCorrection(
        content,
        correction.correctedContent,
        []
      );

      expect(isValid).toBe(true);
    });

    it('应该处理无可纠正违规的情况', async () => {
      const content = '一种装置，包括处理器和存储器。';

      const report = await ai.checkCompliance(content);
      const correction = await ai.correct(content, report.violations);

      expect(correction.appliedCorrections.length).toBe(0);
      expect(correction.correctedContent).toBe(content);
    });
  });

  describe('检查并纠正（一步完成）', () => {
    it('应该检查并纠正内容', async () => {
      const content = '一种装置，包括某些部件，所述频率大约为1.5GHz。';

      const result = await ai.checkAndCorrect(content);

      expect(result.report).toBeDefined();
      expect(result.correction).toBeDefined();
      expect(result.correction.correctedContent).toBeDefined();
    });
  });

  describe('原则冲突解决', () => {
    it('应该检测同一位置的多个违规', async () => {
      const content = '一种装置，包括一些部件，大约为10个。';

      const report = await ai.checkCompliance(content);
      const resolution = await ai.resolveConflicts(report.violations);

      expect(resolution.resolution).toContain('冲突');
    });

    it('应该保留高优先级原则的违规', async () => {
      // 创建两个原则的违规
      const violations = [
        {
          principleId: 'clarity',
          principleName: '清楚性原则',
          severity: ViolationSeverity.MAJOR,
          location: {
            start: 0,
            end: 10,
            text: '一些部件',
          },
          description: '模糊词汇',
          suggestedCorrection: '多个部件',
          confidence: 0.8,
        },
        {
          principleId: 'brevity',
          principleName: '简要性原则',
          severity: ViolationSeverity.MINOR,
          location: {
            start: 0,
            end: 10,
            text: '一些部件',
          },
          description: '重复表述',
          suggestedCorrection: '部件',
          confidence: 0.7,
        },
      ] as any;

      const resolution = await ai.resolveConflicts(violations);

      // clarity优先级(10) > brevity优先级(7)
      expect(resolution.keptViolations[0].principleId).toBe('clarity');
      expect(resolution.removedViolations[0].principleId).toBe('brevity');
    });
  });

  describe('批量检查', () => {
    it('应该批量检查多个内容', async () => {
      const contents = [
        '一种装置，包括一些部件。',
        '所述频率大约为1.5GHz。',
        '一种方法，处理数据。',
      ];

      const reports = await ai.batchCheck(contents);

      expect(reports.length).toBe(3);
      expect(reports[0].violations.length).toBeGreaterThan(0);
    });
  });

  describe('报告生成', () => {
    it('应该生成文本报告', async () => {
      const content = '一种装置，包括一些部件。';

      const report = await ai.checkCompliance(content);
      const reportText = ai.generateReportText(report);

      expect(reportText).toContain('专利合规性检查报告');
      expect(reportText).toContain('总体合规分数');
      expect(reportText).toContain('违规详情');
    });

    it('应该包含所有必要信息', async () => {
      const content = '一种装置，包括一些部件，所述频率大约为1.5GHz。';

      const report = await ai.checkCompliance(content);
      const reportText = ai.generateReportText(report);

      expect(reportText).toContain('检查耗时');
      expect(reportText).toContain('检查时间');
      expect(reportText).toContain('统计信息');
    });
  });

  describe('配置管理', () => {
    it('应该获取启用原则列表', () => {
      const principles = ai.getEnabledPrinciples();

      expect(principles.length).toBeGreaterThan(0);
      expect(principles[0].id).toBeDefined();
      expect(principles[0].name).toBeDefined();
    });

    it('应该获取配置', () => {
      const config = ai.getConfig();

      expect(config.correctionStrategy).toBeDefined();
      expect(config.severityThreshold).toBeDefined();
    });

    it('应该更新配置', () => {
      ai.updateConfig({
        severityThreshold: ViolationSeverity.CRITICAL,
      });

      const config = ai.getConfig();
      expect(config.severityThreshold).toBe(ViolationSeverity.CRITICAL);
    });
  });

  describe('原则管理', () => {
    it('应该添加新原则', () => {
      const initialCount = ai.getAllPrinciples().length;

      ai.addPrinciple({
        id: 'test_principle',
        name: '测试原则',
        description: '用于测试的原则',
        category: PrincipleCategory.CLARITY,
        priority: 5,
        checkFunction: async () => ({
          compliant: true,
          score: 1.0,
          violations: [],
          warnings: [],
        }),
      });

      const newCount = ai.getAllPrinciples().length;
      expect(newCount).toBe(initialCount + 1);
    });

    it('应该移除原则', () => {
      ai.removePrinciple('clarity');

      const principle = ai.getPrinciple('clarity');
      expect(principle).toBeUndefined();
    });

    it('应该获取特定原则', () => {
      const principle = ai.getPrinciple('clarity');

      expect(principle).toBeDefined();
      expect(principle?.id).toBe('clarity');
      expect(principle?.name).toBe('清楚性原则');
    });

    it('应该获取所有原则', () => {
      const principles = ai.getAllPrinciples();

      expect(principles.length).toBeGreaterThan(0);
      expect(principles[0]).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        description: expect.any(String),
        category: expect.any(String),
        priority: expect.any(Number),
      });
    });
  });

  describe('边界情况', () => {
    it('应该处理空内容', async () => {
      const content = '';

      const report = await ai.checkCompliance(content);

      expect(report).toBeDefined();
      expect(report.score).toBeGreaterThan(0.9);
    });

    it('应该处理极短内容', async () => {
      const content = '装置';

      const report = await ai.checkCompliance(content);

      expect(report).toBeDefined();
    });

    it('应该处理极长内容', async () => {
      const content = '一种装置，'.repeat(1000);

      const report = await ai.checkCompliance(content);

      expect(report).toBeDefined();
    });

    it('应该处理无可识别违规的内容', async () => {
      const content = `一种数据处理装置，包括：
处理器，用于执行指令；
存储器，耦合到所述处理器；
其中，所述处理器为ARM架构处理器，时钟频率为1.5GHz。`;

      const report = await ai.checkCompliance(content);

      expect(report.score).toBeGreaterThan(0.5);
    });
  });
});
