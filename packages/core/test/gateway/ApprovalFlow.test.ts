import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ApprovalFlow,
  ApprovalMode,
  type ApprovalFlowConfig,
  type PresentationOptions,
} from '../../src/gateway/ApprovalFlow.js';
import type { ExecutionContext } from '../../src/lifecycle/Lifecycle.js';

// Mock console
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

const mockContext: ExecutionContext = {
  agentId: 'agent-1',
  executionId: 'exec-1',
  parentExecutionId: undefined,
  depth: 0,
  metadata: {},
};

describe('ApprovalFlow', () => {
  let flow: ApprovalFlow;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('应该创建 CLI 模式的实例', () => {
      flow = new ApprovalFlow({
        mode: ApprovalMode.CLI,
        defaultTimeout: 30000,
        enableLearning: true,
      });
      expect(flow).toBeDefined();
    });

    it('应该创建 HTTP 模式的实例', () => {
      flow = new ApprovalFlow({
        mode: ApprovalMode.HTTP,
        defaultTimeout: 30000,
        enableLearning: true,
        httpServerConfig: {
          port: 9999,
          host: '127.0.0.1',
        },
      });
      expect(flow).toBeDefined();
    });
  });

  describe('start/stop', () => {
    it('应该启动和停止 HTTP 服务器', async () => {
      flow = new ApprovalFlow({
        mode: ApprovalMode.HTTP,
        defaultTimeout: 30000,
        enableLearning: true,
        httpServerConfig: {
          port: 9998,
          host: '127.0.0.1',
        },
      });

      await flow.start();
      await flow.stop();
    });

    it('应该在 CLI 模式下安全启动/停止', async () => {
      flow = new ApprovalFlow({
        mode: ApprovalMode.CLI,
        defaultTimeout: 30000,
        enableLearning: true,
      });

      await flow.start();
      await flow.stop();
    });
  });

  describe('requestApproval', () => {
    it('应该在 WebSocket 模式下返回默认批准', async () => {
      flow = new ApprovalFlow({
        mode: ApprovalMode.WEBSOCKET,
        defaultTimeout: 30000,
        enableLearning: true,
      });

      const response = await flow.requestApproval({ test: 'data' }, mockContext);

      expect(response.approved).toBe(true);
      expect(response.approvalId).toBeDefined();
    });
  });

  describe('presentForApproval', () => {
    it('应该以 JSON 格式展示', async () => {
      flow = new ApprovalFlow({
        mode: ApprovalMode.CLI,
        defaultTimeout: 30000,
        enableLearning: true,
      });

      await flow.presentForApproval({ key: 'value' }, {
        format: 'json',
        highlightConcerns: false,
      });

      expect(console.log).toHaveBeenCalled();
    });

    it('应该以表格格式展示', async () => {
      flow = new ApprovalFlow({
        mode: ApprovalMode.CLI,
        defaultTimeout: 30000,
        enableLearning: true,
      });

      await flow.presentForApproval({ key1: 'value1', key2: 'value2' }, {
        format: 'table',
        highlightConcerns: false,
      });

      expect(console.log).toHaveBeenCalled();
    });

    it('应该以摘要格式展示', async () => {
      flow = new ApprovalFlow({
        mode: ApprovalMode.CLI,
        defaultTimeout: 30000,
        enableLearning: true,
      });

      await flow.presentForApproval({ key: 'value' }, {
        format: 'summary',
        highlightConcerns: false,
      });

      expect(console.log).toHaveBeenCalled();
    });

    it('应该展示自定义消息', async () => {
      flow = new ApprovalFlow({
        mode: ApprovalMode.CLI,
        defaultTimeout: 30000,
        enableLearning: true,
      });

      await flow.presentForApproval({ key: 'value' }, {
        format: 'json',
        highlightConcerns: false,
        message: '自定义消息',
      });

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('自定义消息'));
    });

    it('应该标注疑点', async () => {
      flow = new ApprovalFlow({
        mode: ApprovalMode.CLI,
        defaultTimeout: 30000,
        enableLearning: true,
      });

      await flow.presentForApproval({ key: 'value' }, {
        format: 'json',
        highlightConcerns: true,
        concerns: ['疑点1', '疑点2'],
      });

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('疑点标注'));
    });
  });

  describe('collectFeedback', () => {
    it('应该在 WebSocket 模式下返回默认反馈', async () => {
      flow = new ApprovalFlow({
        mode: ApprovalMode.WEBSOCKET,
        defaultTimeout: 30000,
        enableLearning: true,
      });

      const feedback = await flow.collectFeedback('test-id');

      expect(feedback.type).toBe('approve');
    });

    it('应该在 HTTP 模式下返回默认反馈（没有 HTTP 服务器）', async () => {
      flow = new ApprovalFlow({
        mode: ApprovalMode.HTTP,
        defaultTimeout: 30000,
        enableLearning: true,
        httpServerConfig: {
          port: 9997,
          host: '127.0.0.1',
        },
      });

      const feedback = await flow.collectFeedback('non-existent');

      expect(feedback.type).toBe('approve');
    });
  });

  describe('learnFromFeedback', () => {
    it('应该存储反馈', async () => {
      flow = new ApprovalFlow({
        mode: ApprovalMode.CLI,
        defaultTimeout: 30000,
        enableLearning: true,
      });

      const feedback = {
        type: 'reject' as const,
        content: '测试反馈',
        timestamp: new Date(),
        rejectionReason: '测试原因',
      };

      await flow.learnFromFeedback(feedback);

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('reject'));
    });

    it('应该在禁用学习时跳过', async () => {
      flow = new ApprovalFlow({
        mode: ApprovalMode.CLI,
        defaultTimeout: 30000,
        enableLearning: false,
      });

      const feedback = {
        type: 'approve' as const,
        content: '测试',
        timestamp: new Date(),
      };

      await flow.learnFromFeedback(feedback);

      expect(console.log).not.toHaveBeenCalledWith(expect.stringContaining('反馈学习'));
    });
  });

  describe('getStats', () => {
    it('应该返回初始统计', () => {
      flow = new ApprovalFlow({
        mode: ApprovalMode.CLI,
        defaultTimeout: 30000,
        enableLearning: true,
      });

      const stats = flow.getStats();

      expect(stats.totalApprovals).toBe(0);
      expect(stats.approvedCount).toBe(0);
      expect(stats.rejectedCount).toBe(0);
      expect(stats.correctedCount).toBe(0);
      expect(stats.supplementedCount).toBe(0);
      expect(stats.accuracy).toBe(0);
    });
  });

  describe('analyzeConcerns', () => {
    it('应该检测空值', () => {
      flow = new ApprovalFlow({
        mode: ApprovalMode.CLI,
        defaultTimeout: 30000,
        enableLearning: true,
      });

      const concerns = flow['analyzeConcerns']({ a: 'value', b: null, c: undefined, d: '' });

      expect(concerns.length).toBe(3);
      expect(concerns[0]).toContain('b');
    });

    it('应该检测异常数值', () => {
      flow = new ApprovalFlow({
        mode: ApprovalMode.CLI,
        defaultTimeout: 30000,
        enableLearning: true,
      });

      const concerns = flow['analyzeConcerns']({ a: -1, b: 1e11 });

      expect(concerns.length).toBe(2);
    });

    it('应该处理非对象输入', () => {
      flow = new ApprovalFlow({
        mode: ApprovalMode.CLI,
        defaultTimeout: 30000,
        enableLearning: true,
      });

      const concerns = flow['analyzeConcerns']('字符串');

      expect(concerns.length).toBe(0);
    });
  });

  describe('updateStats', () => {
    it('应该更新批准统计', () => {
      flow = new ApprovalFlow({
        mode: ApprovalMode.CLI,
        defaultTimeout: 30000,
        enableLearning: true,
      });

      flow['updateStats']({
        approvalId: '1',
        approved: true,
        timestamp: new Date(),
      });

      const stats = flow.getStats();
      expect(stats.totalApprovals).toBe(1);
      expect(stats.approvedCount).toBe(1);
      expect(stats.accuracy).toBe(1);
    });

    it('应该更新拒绝统计', () => {
      flow = new ApprovalFlow({
        mode: ApprovalMode.CLI,
        defaultTimeout: 30000,
        enableLearning: true,
      });

      flow['updateStats']({
        approvalId: '1',
        approved: false,
        feedback: {
          type: 'reject',
          content: '拒绝',
          timestamp: new Date(),
        },
        timestamp: new Date(),
      });

      const stats = flow.getStats();
      expect(stats.totalApprovals).toBe(1);
      expect(stats.rejectedCount).toBe(1);
      expect(stats.accuracy).toBe(0);
    });

    it('应该更新修正统计', () => {
      flow = new ApprovalFlow({
        mode: ApprovalMode.CLI,
        defaultTimeout: 30000,
        enableLearning: true,
      });

      flow['updateStats']({
        approvalId: '1',
        approved: false,
        feedback: {
          type: 'correct',
          content: '修正',
          timestamp: new Date(),
        },
        timestamp: new Date(),
      });

      const stats = flow.getStats();
      expect(stats.correctedCount).toBe(1);
    });

    it('应该更新补充统计', () => {
      flow = new ApprovalFlow({
        mode: ApprovalMode.CLI,
        defaultTimeout: 30000,
        enableLearning: true,
      });

      flow['updateStats']({
        approvalId: '1',
        approved: false,
        feedback: {
          type: 'supplement',
          content: '补充',
          timestamp: new Date(),
        },
        timestamp: new Date(),
      });

      const stats = flow.getStats();
      expect(stats.supplementedCount).toBe(1);
    });
  });
});
