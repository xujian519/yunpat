/**
 * Token 窗口管理器测试
 *
 * 测试覆盖：
 * - 滑动窗口算法
 * - Token 估算
 * - 语义摘要
 * - 重要性评分
 */

import { describe, it, expect } from 'vitest';
import { TokenWindowManager, createTokenWindowManager } from '../short-term/TokenWindow.js';

describe('Token 窗口管理器', () => {
  describe('Token 估算', () => {
    it('应该正确估算中文 Token 数', async () => {
      const manager = new TokenWindowManager();

      const tokens = await manager.estimateTokens({
        role: 'user',
        content: '你好世界', // 4 个中文字符
      });

      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(10); // 4 / 1.5 + 10 ≈ 12.67
    });

    it('应该正确估算英文 Token 数', async () => {
      const manager = new TokenWindowManager();

      const tokens = await manager.estimateTokens({
        role: 'user',
        content: 'Hello world', // 11 个字符
      });

      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(20); // 11 / 4 + 10 ≈ 12.75
    });

    it('应该正确估算中英文混合 Token 数', async () => {
      const manager = new TokenWindowManager();

      const tokens = await manager.estimateTokens({
        role: 'user',
        content: '你好 Hello 世界', // 4 中文 + 6 英文
      });

      expect(tokens).toBeGreaterThan(0);
    });

    it('应该正确估算长文本 Token 数', async () => {
      const manager = new TokenWindowManager();

      const longText = '专利撰写的关键在于权利要求书的撰写。'.repeat(10);

      const tokens = await manager.estimateTokens({
        role: 'user',
        content: longText,
      });

      expect(tokens).toBeGreaterThan(100);
    });
  });

  describe('滑动窗口', () => {
    it('应该保留所有消息（未超限）', async () => {
      const manager = new TokenWindowManager({
        maxTokens: 1000,
        reservedTokens: 100,
      });

      const messages = [
        { role: 'user' as const, content: '你好' },
        { role: 'assistant' as const, content: '你好！有什么可以帮助你？' },
      ];

      const { messages: result, stats } = await manager.slideWindow(messages);

      expect(result.length).toBe(2);
      expect(stats.compressionRatio).toBe(1.0);
      expect(stats.summaryUsed).toBe(false);
    });

    it('应该压缩消息（超限）', async () => {
      const manager = new TokenWindowManager({
        maxTokens: 100,
        reservedTokens: 10,
        enableSummary: true,
      });

      const messages = Array.from({ length: 20 }, (_, i) => ({
        role: 'user' as const,
        content: `这是第 ${i + 1} 条消息`.repeat(10),
      }));

      const { messages: result, stats } = await manager.slideWindow(messages);

      expect(result.length).toBeLessThan(messages.length);
      expect(stats.compressionRatio).toBeLessThan(1.0);
      expect(stats.compressedTokens).toBeLessThanOrEqual(90);
    });

    it('应该优先保留最新消息', async () => {
      const manager = new TokenWindowManager({
        maxTokens: 50,
        reservedTokens: 5,
      });

      const messages = [
        { role: 'user' as const, content: '旧消息' },
        { role: 'user' as const, content: '新消息' },
      ];

      const { messages: result } = await manager.slideWindow(messages);

      expect(result[result.length - 1].content).toBe('新消息');
    });

    it('应该生成摘要（如果启用）', async () => {
      const manager = new TokenWindowManager({
        maxTokens: 100,
        reservedTokens: 10,
        enableSummary: true,
      });

      const messages = Array.from({ length: 10 }, (_, i) => ({
        role: i % 2 === 0 ? ('user' as const) : ('assistant' as const),
        content: `这是第 ${i + 1} 条消息`.repeat(5),
      }));

      const { messages: result, stats } = await manager.slideWindow(messages);

      expect(stats.summaryUsed).toBe(true);
      expect(result.some((msg) => msg.content.includes('历史对话摘要'))).toBe(true);
    });
  });

  describe('重要性评分', () => {
    it('应该给用户消息更高分数', async () => {
      const manager = new TokenWindowManager();

      const userScore = await manager.scoreImportance({
        role: 'user',
        content: '重要问题',
        timestamp: new Date(),
      });

      const assistantScore = await manager.scoreImportance({
        role: 'assistant',
        content: '普通回复',
        timestamp: new Date(),
      });

      expect(userScore).toBeGreaterThan(assistantScore);
    });

    it('应该给最新消息更高分数', async () => {
      const manager = new TokenWindowManager();

      const oldScore = await manager.scoreImportance({
        role: 'user',
        content: '旧消息',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 小时前
      });

      const newScore = await manager.scoreImportance({
        role: 'user',
        content: '新消息',
        timestamp: new Date(),
      });

      expect(newScore).toBeGreaterThan(oldScore);
    });

    it('应该检测重复消息', async () => {
      const manager = new TokenWindowManager();

      const recentMessages = [
        { role: 'user' as const, content: '你好' },
        { role: 'assistant' as const, content: '你好！' },
      ];

      const duplicateScore = await manager.scoreImportance(
        {
          role: 'user' as const,
          content: '你好',
          timestamp: new Date(),
        },
        { recentMessages }
      );

      const originalScore = await manager.scoreImportance(
        {
          role: 'user' as const,
          content: '你好吗',
          timestamp: new Date(),
        },
        { recentMessages }
      );

      expect(originalScore).toBeGreaterThan(duplicateScore);
    });
  });

  describe('窗口优化', () => {
    it('应该过滤低分消息', async () => {
      const manager = new TokenWindowManager({
        importanceThreshold: 0.7,
      });

      const messages = [
        { role: 'user' as const, content: '重要问题', timestamp: new Date() },
        {
          role: 'assistant' as const,
          content: '不重要',
          timestamp: new Date(Date.now() - 10 * 60 * 60 * 1000),
        },
      ];

      const { messages: result, stats } = await manager.optimizeWindow(messages);

      expect(result.length).toBeLessThanOrEqual(messages.length);
      expect(stats.avgImportance).toBeGreaterThanOrEqual(0.7);
    });
  });

  describe('配置管理', () => {
    it('应该返回正确的配置信息', () => {
      const manager = new TokenWindowManager({
        maxTokens: 5000,
        reservedTokens: 500,
        compressionRatio: 0.5,
      });

      const config = manager.getConfig();

      expect(config.maxTokens).toBe(5000);
      expect(config.reservedTokens).toBe(500);
      expect(config.availableTokens).toBe(4500);
    });
  });

  describe('便捷函数', () => {
    it('应该正确创建管理器', () => {
      const manager = createTokenWindowManager({
        maxTokens: 3000,
      });

      expect(manager).toBeInstanceOf(TokenWindowManager);
      expect(manager.getConfig().maxTokens).toBe(3000);
    });
  });
});
