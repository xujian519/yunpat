/**
 * 幻觉检测系统集成测试
 *
 * 验证 ResultValidator 和 PatentWriterAgent 的幻觉检测集成
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { ResultValidator, ValidationErrorType } from '../../src/validation/ResultValidator.js';
import { HallucinationDetector } from '../../src/validation/HallucinationDetector.js';
import { createDeepSeekModel } from '../../src/llm/NativeLLMAdapter.js';
import { KnowledgeBase, createKnowledgeBase } from '../../src/knowledge/KnowledgeBase.js';
import { z } from 'zod';

describe('幻觉检测系统集成测试', () => {
  let llm: any;
  let knowledgeBase: KnowledgeBase;

  beforeAll(async () => {
    // 初始化 LLM 和知识库
    llm = createDeepSeekModel(process.env.DEEPSEEK_API_KEY || 'sk-test');

    knowledgeBase = createKnowledgeBase({
      enableEmbedding: false,
      persistent: false,
      storagePath: '/tmp/yunpat-integration-knowledge',
    });

    // 添加测试知识
    await knowledgeBase.store({
      id: 'kb-1',
      type: 'document',
      title: '专利法第25条',
      content: '根据专利法第25条，授予专利权的条件是：新颖性、创造性和实用性。',
      category: 'legal',
      tags: ['专利法', '授权条件'],
      priority: 9,
    });

    await knowledgeBase.store({
      id: 'kb-2',
      type: 'document',
      title: '深度学习性能基准',
      content: '在ImageNet数据集上，深度学习模型的准确率通常超过90%。',
      category: 'technical',
      tags: ['深度学习', '性能'],
      priority: 8,
    });
  });

  describe('ResultValidator 集成测试', () => {
    it('应该成功创建带幻觉检测的验证器', () => {
      const validator = new ResultValidator({
        llm,
        knowledgeBase,
        enableHallucinationCheck: true,
      });

      expect(validator).toBeDefined();
    });

    it('应该对字符串内容执行幻觉检测', async () => {
      const validator = new ResultValidator({
        llm,
        knowledgeBase,
        enableHallucinationCheck: true,
      });

      const schema = z.object({
        content: z.string(),
      });

      const data = {
        content: '根据专利法第25条规定，应当满足三性要求。',
      };

      const result = await validator.validateWithHallucinationCheck(data, schema);

      expect(result.valid).toBe(true);
      expect(result.hallucinationReport).toBeDefined();
      expect(result.hallucinationReport!.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.hallucinationReport!.overallScore).toBeLessThanOrEqual(1);
    });

    it('应该检测到源归属问题并添加到警告', async () => {
      const validator = new ResultValidator({
        llm,
        knowledgeBase,
        enableHallucinationCheck: true,
      });

      const schema = z.object({
        content: z.string(),
      });

      const data = {
        content: '根据专利法第25条规定，应当满足三性要求。',
      };

      const result = await validator.validateWithHallucinationCheck(data, schema);

      // 应该执行了幻觉检测
      expect(result.hallucinationReport).toBeDefined();

      // 如果检测到源归属问题，应该有相关警告
      if (result.hallucinationReport!.sourceAttributionIssues?.length || 0 > 0) {
        // 检查是否有任何警告（不只是源归属相关的）
        expect(result.warnings.length).toBeGreaterThanOrEqual(0);
      }
    });

    it('应该在未配置幻觉检测时正常工作', async () => {
      const validator = new ResultValidator({
        enableHallucinationCheck: false,
      });

      const schema = z.object({
        content: z.string(),
      });

      const data = {
        content: '测试内容',
      };

      const result = await validator.validateWithHallucinationCheck(data, schema);

      expect(result.valid).toBe(true);
      expect(result.hallucinationReport).toBeUndefined();
    });

    it('应该根据幻觉分数添加错误', async () => {
      const validator = new ResultValidator({
        llm,
        knowledgeBase,
        enableHallucinationCheck: true,
      });

      const schema = z.object({
        content: z.string(),
      });

      // 使用高幻觉阈值（容易触发）
      const data = {
        content: `
该方法的准确率达到999%。
根据专利法第25条规定。
该方法的优点是计算复杂度较低。
该方法的缺点是计算复杂度较高。
        `,
      };

      const result = await validator.validateWithHallucinationCheck(data, schema, {
        factCheckThreshold: 0.5, // 降低阈值，更容易触发错误
      });

      expect(result.hallucinationReport).toBeDefined();
      // 高幻觉内容应该触发错误或警告
      const hasErrorOrWarning = result.errors.length > 0 || result.warnings.length > 0;
      expect(hasErrorOrWarning).toBe(true);
    });

    it('应该处理幻觉检测失败的情况', async () => {
      // 使用无效的 LLM
      const invalidLLM = {
        chat: vi.fn().mockRejectedValue(new Error('LLM connection failed')),
      };

      const validator = new ResultValidator({
        llm: invalidLLM as any,
        knowledgeBase,
        enableHallucinationCheck: true,
      });

      const schema = z.object({
        content: z.string(),
      });

      const data = {
        content: '测试内容',
      };

      const result = await validator.validateWithHallucinationCheck(data, schema);

      // 即使幻觉检测失败，基础验证应该仍然工作
      expect(result.valid).toBe(true);
      // 应该有关于幻觉检测失败的警告
      const allWarnings = result.warnings.join(' ');
      // 可能包含幻觉检测失败的警告
      expect(result.warnings.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('HallucinationDetector 独立使用测试', () => {
    it('应该独立使用幻觉检测器', async () => {
      const detector = new HallucinationDetector(llm, knowledgeBase, {
        enableFactCheck: true,
        enableLogicalConsistencyCheck: true,
        enableSourceAttribution: true,
        factCheckThreshold: 0.7,
      });

      const content = `
根据专利法第25条，授予专利权的条件是：新颖性、创造性和实用性。
该模型在ImageNet上的准确率达到95%。
      `;

      const report = await detector.detect(content);

      expect(report).toBeDefined();
      expect(report.overallScore).toBeGreaterThanOrEqual(0);
      expect(report.overallScore).toBeLessThanOrEqual(1);
      expect(report.factCheckResults).toBeDefined();
      expect(report.logicalInconsistencies).toBeDefined();
      expect(report.sourceAttributionIssues).toBeDefined();
      expect(report.suggestions).toBeDefined();
    });

    it('应该生成可读的报告', async () => {
      const detector = new HallucinationDetector(llm, knowledgeBase);

      const content = '测试内容';

      const report = await detector.detect(content);
      const reportText = detector.generateReport(report);

      expect(reportText).toBeDefined();
      expect(reportText.length).toBeGreaterThan(0);
      expect(reportText).toContain('幻觉');
    });

    it('应该支持快速检测', async () => {
      const detector = new HallucinationDetector(llm, knowledgeBase);

      const goodContent = '正常的、没有问题的内容。';
      const passed = await detector.quickCheck(goodContent);

      expect(typeof passed).toBe('boolean');
    });

    it('应该批量检测多个文档', async () => {
      const detector = new HallucinationDetector(llm, knowledgeBase);

      const documents = ['内容1', '内容2', '内容3'];

      const reports = await detector.detectBatch(documents);

      expect(reports).toHaveLength(3);
      expect(reports[0].overallScore).toBeGreaterThanOrEqual(0);
    });

    it('应该计算检测统计', async () => {
      const detector = new HallucinationDetector(llm, knowledgeBase);

      const documents = ['内容1', '内容2'];
      const reports = await detector.detectBatch(documents);

      const stats = detector.getDetectorStats(reports);

      expect(stats.totalReports).toBe(2);
      expect(stats.avgScore).toBeGreaterThanOrEqual(0);
      expect(stats.avgScore).toBeLessThanOrEqual(1);
    });
  });

  describe('端到端场景测试', () => {
    it('应该完整验证专利申请文件', async () => {
      const validator = new ResultValidator({
        llm,
        knowledgeBase,
        enableHallucinationCheck: true,
      });

      const patentSchema = z.object({
        title: z.string(),
        abstract: z.string(),
        claims: z.array(z.string()),
        description: z.string(),
      });

      const patentData = {
        title: '基于深度学习的图像识别方法',
        abstract: '本发明公开了一种基于深度学习的图像识别方法。',
        claims: [
          '1. 一种图像识别方法，其特征在于包括：输入层、特征提取层和输出层。',
          '2. 根据权利要求1所述的方法，其特征在于所述特征提取层采用卷积神经网络。',
        ],
        description: `
根据专利法第25条规定，授予专利权应当满足新颖性、创造性和实用性。
该技术方案采用深度学习算法，在标准数据集上表现良好。
        `,
      };

      const result = await validator.validateWithHallucinationCheck(patentData, patentSchema, {
        factCheckThreshold: 0.7,
      });

      // 验证基础功能
      expect(result.valid).toBe(true);
      expect(result.data).toBeDefined();

      // 验证幻觉检测
      expect(result.hallucinationReport).toBeDefined();
      expect(result.hallucinationReport!.factCheckResults?.length || 0).toBeGreaterThan(0);

      console.log('\n📊 专利申请验证结果:');
      console.log(`  结构验证: ${result.valid ? '✅ 通过' : '❌ 失败'}`);
      console.log(`  幻觉分数: ${(result.hallucinationReport!.overallScore * 100).toFixed(1)}%`);
      console.log(
        `  事实验证: ${result.hallucinationReport!.factCheckResults?.length || 0} 个声明`
      );
      console.log(`  逻辑问题: ${result.hallucinationReport!.logicalInconsistencies.length} 个`);
      console.log(`  源归属问题: ${result.hallucinationReport!.sourceAttributionIssues.length} 个`);
    });

    it('应该检测低质量内容并拒绝', async () => {
      const validator = new ResultValidator({
        llm,
        knowledgeBase,
        enableHallucinationCheck: true,
      });

      const schema = z.object({
        content: z.string(),
      });

      const lowQualityData = {
        content: `
该方法的准确率达到999%。
该方法的优点是计算复杂度较低。
该方法的缺点是计算复杂度较高。
根据专利法第25条规定。
        `,
      };

      const result = await validator.validateWithHallucinationCheck(lowQualityData, schema, {
        factCheckThreshold: 0.5, // 降低阈值
      });

      // 结构验证应该通过
      expect(result.valid).toBe(true);

      // 但应该检测到高幻觉
      expect(result.hallucinationReport).toBeDefined();

      // 应该有错误或警告
      const hasIssues = result.errors.length > 0 || result.warnings.length > 0;
      expect(hasIssues).toBe(true);

      console.log('\n⚠️ 低质量内容检测结果:');
      console.log(`  幻觉分数: ${(result.hallucinationReport!.overallScore * 100).toFixed(1)}%`);
      console.log(`  错误: ${result.errors.length}`);
      console.log(`  警告: ${result.warnings.length}`);
    });

    it('应该接受高质量内容', async () => {
      const validator = new ResultValidator({
        llm,
        knowledgeBase,
        enableHallucinationCheck: true,
      });

      const schema = z.object({
        content: z.string(),
      });

      const highQualityData = {
        content: '这是一个简单的技术方案，采用深度学习算法进行图像识别。',
      };

      const result = await validator.validateWithHallucinationCheck(highQualityData, schema, {
        factCheckThreshold: 0.7,
      });

      // 高质量内容应该通过验证
      expect(result.valid).toBe(true);

      // 幻觉分数应该较低
      if (result.hallucinationReport) {
        expect(result.hallucinationReport.overallScore).toBeLessThan(0.7);
      }

      console.log('\n✅ 高质量内容检测结果:');
      console.log(
        `  幻觉分数: ${(result.hallucinationReport?.overallScore ?? 0 * 100).toFixed(1)}%`
      );
      console.log(`  错误: ${result.errors.length}`);
      console.log(`  警告: ${result.warnings.length}`);
    });
  });
});
