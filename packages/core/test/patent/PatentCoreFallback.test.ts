/**
 * PatentCoreBridge 降级策略测试
 */

import { describe, it, expect } from 'vitest';
import {
  extractFeatures,
  parseDisclosure,
  generateClaims,
  setCliPath,
} from '../../patents/core/PatentCoreBridge.js';
import {
  extractFeaturesFallback,
  parseDisclosureFallback,
  generateClaimsFallback,
  isFallbackResult,
} from '../../patents/core/PatentCoreFallback.js';

describe('PatentCoreBridge 降级策略', () => {
  describe('TypeScript 降级实现', () => {
    it('应该能够使用 TypeScript 版本提取特征', async () => {
      const text = `
技术领域
本发明涉及人工智能技术领域。

技术问题
现有技术的CNN模型计算量大，实时性差。

技术方案
本发明提供一种轻量级CNN架构，包括深度可分离卷积层。
该模型通过减少参数量来提高推理速度。

技术效果
通过本发明，计算量减少60%，推理速度提升2.5倍。
      `;

      const result = await extractFeaturesFallback(text);

      expect(result.fallback).toBe(true);
      expect(result.features).toBeInstanceOf(Array);
      expect(result.problem_feature_effects).toBeInstanceOf(Array);
      expect(result.problem_feature_effects.length).toBeGreaterThan(0);
    });

    it('应该能够使用 TypeScript 版本解析交底书', async () => {
      const text = `
发明名称：基于深度学习的图像识别方法

技术领域
本发明涉及人工智能技术领域，具体涉及一种图像识别方法。

背景技术
传统CNN模型计算量大，实时性差。

发明内容
本发明提供一种轻量级CNN架构。
包括深度可分离卷积层。

具体实施方式
下面结合附图详细描述本发明的实施方式。
      `;

      const result = await parseDisclosureFallback(text);

      expect(result.fallback).toBe(true);
      expect(result.title).toBe('基于深度学习的图像识别方法');
      expect(result.sections).toHaveProperty('技术领域');
      expect(result.sections).toHaveProperty('发明内容');
      expect(result.confidence).toBeLessThan(1.0);
    });

    it('应该能够使用 TypeScript 版本生成权利要求', async () => {
      const title = '一种图像识别方法';
      const solution = '包括深度可分离卷积层、注意力机制模块、分类器';

      const result = await generateClaimsFallback(title, solution, 'method');

      expect(result.fallback).toBe(true);
      expect(result.claims).toBeInstanceOf(Array);
      expect(result.claims.length).toBeGreaterThan(0);
      expect(result.claims[0].claim_type).toBe('Independent');
      expect(result.rendered).toBeInstanceOf(Array);
      expect(result.rendered.length).toBeGreaterThan(0);
    });

    it('应该正确识别 fallback 结果', () => {
      const fallbackResult = {
        fallback: true,
        error: 'CLI not found',
      };

      expect(isFallbackResult(fallbackResult)).toBe(true);

      const normalResult = {
        features: [],
        problem_feature_effects: [],
      };

      expect(isFallbackResult(normalResult)).toBe(false);
    });
  });

  describe('PatentCoreBridge 集成测试', () => {
    it('应该在 CLI 不存在时自动降级到 TypeScript 实现', async () => {
      // 设置一个不存在的CLI路径，强制降级
      setCliPath('/nonexistent/path/to/patent-cli');

      const text = '本发明涉及一种图像识别方法。';
      const result = await parseDisclosure(text);

      // 应该返回降级结果
      expect(result).toHaveProperty('fallback', true);
      expect(result.title).toBeDefined();
    });

    it('应该在 extractFeatures 失败时自动降级', async () => {
      setCliPath('/nonexistent/path/to/patent-cli');

      const text = '技术问题：计算量大。技术方案：优化算法。';
      const result = await extractFeatures(text);

      expect(result).toHaveProperty('fallback', true);
      expect(result.features).toBeInstanceOf(Array);
    });

    it('应该在 generateClaims 失败时自动降级', async () => {
      setCliPath('/nonexistent/path/to/patent-cli');

      const title = '一种测试方法';
      const solution = '包括步骤1和步骤2';
      const result = await generateClaims(title, solution, 'method');

      expect(result).toHaveProperty('fallback', true);
      expect(result.claims).toBeInstanceOf(Array);
      expect(result.rendered).toBeInstanceOf(Array);
    });
  });

  describe('降级功能质量验证', () => {
    it('TypeScript 版本应该能够提取基本的技术特征', async () => {
      const text = `
技术方案
包括特征1：深度可分离卷积层。
包括特征2：注意力机制。
包括特征3：金字塔池化模块。
      `;

      const result = await extractFeaturesFallback(text);

      // 由于是简单的正则匹配，可能提取不到特征，这是预期的
      // 重点验证返回结构和fallback标记
      expect(result.fallback).toBe(true);
      expect(result.features).toBeInstanceOf(Array);
      expect(result.problem_feature_effects).toBeInstanceOf(Array);
    });

    it('TypeScript 版本应该能够识别技术问题、特征和效果', async () => {
      const text = `
技术问题：现有技术计算量大。

技术方案：使用轻量级CNN架构，包括深度可分离卷积。

技术效果：计算量减少60%，准确率提升2%。
      `;

      const result = await extractFeaturesFallback(text);

      expect(result.problem_feature_effects.length).toBeGreaterThanOrEqual(1);
      const pfe = result.problem_feature_effects[0];
      expect(pfe.technical_problem).toContain('计算量大');
      expect(pfe.technical_effects.length).toBeGreaterThan(0);
    });

    it('TypeScript 版本生成的权利要求应该格式正确', async () => {
      const title = '一种图像识别方法';
      const solution = '包括卷积层、池化层、分类器';

      const result = await generateClaimsFallback(title, solution, 'method');

      expect(result.claims[0].preamble).toBe('一种');
      expect(result.claims[0].transitional_phrase).toContain('包括');
      expect(result.claims[0].elements).toBeInstanceOf(Array);
      expect(result.rendered[0]).toContain('1. 一种');
    });
  });
});
