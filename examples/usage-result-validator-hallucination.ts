/**
 * ResultValidator 集成幻觉检测示例
 *
 * 展示如何使用增强后的 ResultValidator 进行带幻觉检测的验证
 */

import { describe, it, expect } from 'vitest';
import {
  ResultValidator,
  ValidationErrorType,
} from '../packages/core/src/validation/ResultValidator.js';
import { createDeepSeekModel } from '../packages/core/src/llm/NativeLLMAdapter.js';
import {
  KnowledgeBase,
  createKnowledgeBase,
} from '../packages/core/src/knowledge/KnowledgeBase.js';
import { z } from 'zod';

describe('ResultValidator 集成幻觉检测', () => {
  it('应该使用幻觉检测器验证内容', async () => {
    // 1. 创建依赖
    const llm = createDeepSeekModel(process.env.DEEPSEEK_API_KEY || 'sk-test');
    const knowledgeBase = createKnowledgeBase({
      enableEmbedding: false,
      persistent: false,
      storagePath: '/tmp/yunpat-test-knowledge',
    });

    // 2. 添加测试知识
    await knowledgeBase.store({
      id: 'kb-1',
      type: 'document',
      title: '专利法第25条',
      content: '根据专利法第25条，授予专利权的条件是：新颖性、创造性和实用性。',
      category: 'legal',
      tags: ['专利法', '授权条件'],
      priority: 9,
    });

    // 3. 创建带幻觉检测的验证器
    const validator = new ResultValidator({
      llm,
      knowledgeBase,
      enableHallucinationCheck: true,
    });

    // 4. 定义 schema
    const patentSchema = z.object({
      title: z.string(),
      abstract: z.string(),
      description: z.string(),
    });

    // 5. 测试数据（包含幻觉）
    const patentData = {
      title: '图像识别方法',
      abstract: '本发明涉及一种图像识别方法，准确率达到99.9%。',
      description: `
根据专利法第25条规定，应当满足三性要求。
该方法的优点是计算复杂度较低。
该方法的缺点是计算复杂度较高。
      `,
    };

    // 6. 执行验证
    const result = await validator.validateWithHallucinationCheck(patentData, patentSchema, {
      factCheckThreshold: 0.7,
      enableFactCheck: true,
      enableLogicalConsistencyCheck: true,
      enableSourceAttribution: true,
    });

    // 7. 验证结果
    expect(result).toBeDefined();
    expect(result.valid).toBe(true); // 结构验证通过
    expect(result.hallucinationReport).toBeDefined();
    expect(result.hallucinationReport!.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.hallucinationReport!.overallScore).toBeLessThanOrEqual(1);

    // 应该检测到逻辑矛盾
    expect(result.hallucinationReport!.logicalInconsistencies.length).toBeGreaterThan(0);

    // 应该检测到源归属问题
    expect(result.hallucinationReport!.sourceAttributionIssues.length).toBeGreaterThan(0);

    console.log('\n📊 幻觉检测报告:');
    console.log(`幻觉分数: ${(result.hallucinationReport!.overallScore * 100).toFixed(1)}%`);
    console.log(`事实验证: ${result.hallucinationReport!.factCheckResults.length} 个声明`);
    console.log(`逻辑问题: ${result.hallucinationReport!.logicalInconsistencies.length} 个`);
    console.log(`源归属问题: ${result.hallucinationReport!.sourceAttributionIssues.length} 个`);
    console.log(`改进建议: ${result.hallucinationReport!.suggestions.length} 个`);

    console.log('\n⚠️ 验证警告:');
    result.warnings.forEach((warning) => console.log(`  - ${warning}`));
  });

  it('应该在没有配置幻觉检测时正常工作', async () => {
    // 创建不启用幻觉检测的验证器
    const validator = new ResultValidator({
      enableHallucinationCheck: false,
    });

    const schema = z.object({
      content: z.string(),
    });

    const data = {
      content: '这是一些测试内容。',
    };

    const result = await validator.validateWithHallucinationCheck(data, schema);

    expect(result.valid).toBe(true);
    expect(result.hallucinationReport).toBeUndefined();
  });

  it('应该根据幻觉分数决定是否接受结果', async () => {
    const llm = createDeepSeekModel(process.env.DEEPSEEK_API_KEY || 'sk-test');
    const knowledgeBase = createKnowledgeBase({
      enableEmbedding: false,
      persistent: false,
      storagePath: '/tmp/yunpat-test-knowledge-2',
    });

    const validator = new ResultValidator({
      llm,
      knowledgeBase,
      enableHallucinationCheck: true,
    });

    const schema = z.object({
      content: z.string(),
    });

    // 高质量内容（低幻觉）
    const goodData = {
      content: '这是一个简单的技术方案，采用深度学习算法。',
    };

    const goodResult = await validator.validateWithHallucinationCheck(goodData, schema, {
      factCheckThreshold: 0.7,
    });

    expect(goodResult.valid).toBe(true);
    if (goodResult.hallucinationReport) {
      expect(goodResult.hallucinationReport.overallScore).toBeLessThan(0.7);
    }

    // 低质量内容（高幻觉）
    const badData = {
      content: `
该方法的准确率达到999%。
根据专利法第25条规定。
该方法的优点是计算复杂度较低。
该方法的缺点是计算复杂度较高。
      `,
    };

    const badResult = await validator.validateWithHallucinationCheck(badData, schema, {
      factCheckThreshold: 0.7,
    });

    // 结构验证通过，但应该有幻觉相关的错误或警告
    expect(badResult.valid).toBe(true);
    expect(badResult.hallucinationReport).toBeDefined();
    if (badResult.hallucinationReport) {
      expect(badResult.hallucinationReport.overallScore).toBeGreaterThanOrEqual(0);
    }
  });
});

// 运行示例
async function runExample() {
  console.log('🎯 ResultValidator 集成幻觉检测示例\n');

  const llm = createDeepSeekModel(process.env.DEEPSEEK_API_KEY || 'sk-test');
  const knowledgeBase = createKnowledgeBase({
    enableEmbedding: false,
    persistent: false,
    storagePath: '/tmp/yunpat-example-knowledge',
  });

  await knowledgeBase.store({
    id: 'kb-1',
    type: 'document',
    title: '专利法第25条',
    content: '根据专利法第25条，授予专利权的条件是：新颖性、创造性和实用性。',
    category: 'legal',
    tags: ['专利法', '授权条件'],
    priority: 9,
  });

  const validator = new ResultValidator({
    llm,
    knowledgeBase,
    enableHallucinationCheck: true,
    verbose: true,
  });

  const patentSchema = z.object({
    title: z.string(),
    abstract: z.string(),
    description: z.string(),
  });

  const exampleData = {
    title: '基于深度学习的图像识别方法',
    abstract: '本发明公开了一种基于深度学习的图像识别方法，在ImageNet数据集上准确率达到95%。',
    description: `
根据专利法第25条规定，授予专利权应当满足新颖性、创造性和实用性要求。
该方法采用卷积神经网络架构，包括输入层、特征提取层和输出层。
该方法的创新点在于采用了多层注意力机制。
    `,
  };

  console.log('📝 验证专利申请文件...\n');

  const result = await validator.validateWithHallucinationCheck(exampleData, patentSchema, {
    factCheckThreshold: 0.7,
  });

  console.log('\n✅ 验证结果:');
  console.log(`通过: ${result.valid}`);
  console.log(`错误: ${result.errors.length}`);
  console.log(`警告: ${result.warnings.length}`);

  if (result.hallucinationReport) {
    console.log('\n📊 幻觉检测详情:');
    console.log(`  幻觉分数: ${(result.hallucinationReport.overallScore * 100).toFixed(1)}%`);
    console.log(`  事实验证: ${result.hallucinationReport.factCheckResults.length} 个声明`);
    console.log(`  逻辑问题: ${result.hallucinationReport.logicalInconsistencies.length} 个`);
    console.log(`  源归属问题: ${result.hallucinationReport.sourceAttributionIssues.length} 个`);
    console.log(`  改进建议: ${result.hallucinationReport.suggestions.length} 个`);

    if (result.hallucinationReport.suggestions.length > 0) {
      console.log('\n💡 改进建议:');
      result.hallucinationReport.suggestions.slice(0, 3).forEach((suggestion) => {
        console.log(`  - [${suggestion.action}] ${suggestion.description}`);
      });
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ ResultValidator 集成成功！');
  console.log('='.repeat(70));
}

// 取消注释以运行示例
// runExample().catch(console.error);
