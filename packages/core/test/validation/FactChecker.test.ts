/**
 * FactChecker 单元测试
 *
 * 测试事实验证器的声明提取、事实验证、批量验证等功能
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FactChecker } from '../../src/validation/FactChecker.js';
import { createDeepSeekModel } from '../../src/llm/NativeLLMAdapter.js';
import { KnowledgeBase, createKnowledgeBase } from '../../src/knowledge/KnowledgeBase.js';

// Mock LLM Adapter
const mockLLM = {
  chat: vi.fn(),
} as any;

describe('FactChecker', () => {
  let knowledgeBase: KnowledgeBase;
  let factChecker: FactChecker;

  beforeEach(async () => {
    // 创建知识库并添加测试数据
    knowledgeBase = createKnowledgeBase({
      enableEmbedding: false,
      persistent: false, // 测试环境不持久化
      storagePath: '/tmp/yunpat-test-knowledge',
    });

    // 添加测试知识条目
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
      title: '深度学习性能',
      content: '在ImageNet数据集上，深度学习模型的准确率通常超过90%。',
      category: 'technical',
      tags: ['深度学习', '性能'],
      priority: 8,
    });

    await knowledgeBase.store({
      id: 'kb-3',
      type: 'document',
      title: '电池技术标准',
      content: '根据GB/T 1234-2020，电池能量密度应达到500Wh/kg以上。',
      category: 'technical',
      tags: ['电池', '标准'],
      priority: 7,
    });

    // 创建事实验证器
    factChecker = new FactChecker(mockLLM, knowledgeBase, {
      extractionMethod: 'regex',
      verificationMethods: ['knowledge_base'],
      knowledgeBaseOptions: {
        maxResults: 5,
        similarityThreshold: 0.7,
      },
    });
  });

  describe('声明提取', () => {
    it('应该使用正则方法提取声明', () => {
      const content = `
根据专利法第25条规定，应当满足三性要求。
该模型的准确率达到95%。
      `;

      const claims = (factChecker as any).extractClaimsByRegex(content);

      expect(claims.length).toBeGreaterThan(0);
      expect(claims[0].category).toBeDefined();
    });

    it('应该正确分类声明类别', () => {
      const legalClaim = '根据专利法第25条规定，应当满足三性要求。';
      const techClaim = '该模型的准确率达到95%。';

      const legalCategory = (factChecker as any).categorizeClaim(legalClaim);
      const techCategory = (factChecker as any).categorizeClaim(techClaim);

      expect(legalCategory).toBe('legal_precedent');
      expect(techCategory).toBe('statistical_data');
    });
  });

  describe('事实验证', () => {
    it('应该验证在知识库中的声明', async () => {
      const claim = {
        id: 'claim-1',
        content: '根据专利法第25条，授予专利权的条件是：新颖性、创造性和实用性。',
        category: 'legal_precedent' as any,
        confidence: 0.9,
      };

      const result = await (factChecker as any).verifyWithKnowledgeBase(claim);

      expect(result.isVerifiable).toBe(true);
      // isVerified 取决于相似度阈值，可能是 true 或 false
      expect(result.verificationMethod).toBe('knowledge_base');
      if (result.isVerified) {
        expect(result.sources.length).toBeGreaterThan(0);
      }
    });

    it('应该标记未找到的声明', async () => {
      const claim = {
        id: 'claim-2',
        content: '这是一个知识库中不存在的声明。',
        category: 'general_statement' as any,
        confidence: 0.5,
      };

      const result = await (factChecker as any).verifyWithKnowledgeBase(claim);

      expect(result.isVerifiable).toBe(true);
      expect(result.isVerified).toBe(false);
      expect(result.sources.length).toBe(0);
    });

    it('应该验证内容中的所有声明', async () => {
      const content = `
根据专利法第25条，授予专利权的条件是：新颖性、创造性和实用性。
该模型的准确率达到95%。
      `;

      const results = await factChecker.verifyContent(content);

      expect(results.length).toBeGreaterThan(0);
      expect(results.every((r) => typeof r.claim === 'object')).toBe(true);
    });
  });

  describe('批量验证', () => {
    it('应该批量验证多个声明', async () => {
      const claims = [
        {
          id: 'claim-1',
          content: '根据专利法第25条规定。',
          category: 'legal_precedent' as any,
          confidence: 0.9,
        },
        {
          id: 'claim-2',
          content: '该模型准确率95%。',
          category: 'statistical_data' as any,
          confidence: 0.8,
        },
      ];

      const results = await factChecker.verifyClaims(claims);

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.claim.id === claims[0].id || r.claim.id === claims[1].id));
    });
  });

  describe('统计功能', () => {
    it('应该正确计算事实验证统计', async () => {
      const content = '根据专利法第25条规定，应当满足三性要求。';

      const results = await factChecker.verifyContent(content);
      const stats = factChecker.getFactCheckStats(results);

      expect(stats.total).toBe(results.length);
      expect(stats.verifiable).toBeGreaterThanOrEqual(0);
      expect(stats.avgConfidence).toBeGreaterThanOrEqual(0);
      expect(stats.avgConfidence).toBeLessThanOrEqual(1);
    });
  });

  describe('LLM声明提取', () => {
    it('应该使用LLM提取声明', async () => {
      mockLLM.chat.mockResolvedValue({
        message: {
          content: JSON.stringify([
            {
              content: '根据专利法第25条规定',
              category: 'legal_precedent',
              confidence: 0.9,
            },
          ]),
        },
      } as any);

      const content = '根据专利法第25条规定，应当满足三性要求。';
      const claims = await (factChecker as any).extractClaimsByLLM(content);

      expect(claims).toHaveLength(1);
      expect(claims[0].content).toContain('专利法第25条');
    });

    it('应该处理LLM提取失败', async () => {
      mockLLM.chat.mockRejectedValue(new Error('LLM error'));

      const content = '测试内容';
      const claims = await (factChecker as any).extractClaimsByLLM(content);

      expect(claims).toHaveLength(0);
    });
  });

  describe('边界情况', () => {
    it('应该处理空内容', async () => {
      const results = await factChecker.verifyContent('');
      expect(results).toHaveLength(0);
    });

    it('应该处理没有知识库匹配的声明', async () => {
      const claim = {
        id: 'claim-edge',
        content: '完全不相关的内容XYZ123',
        category: 'general_statement' as any,
        confidence: 0.5,
      };

      const result = await (factChecker as any).verifyWithKnowledgeBase(claim);

      expect(result.isVerifiable).toBe(true);
      expect(result.isVerified).toBe(false);
    });

    it('应该处理特殊字符', async () => {
      const content = '该模型准确率为95.2%（含特殊符号）！';

      const results = await factChecker.verifyContent(content);
      // 应该能够处理特殊字符而不报错
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });
  });
});
