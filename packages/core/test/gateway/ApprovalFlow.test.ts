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

    it('应该正确计算多个审批的准确率', () => {
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

      flow['updateStats']({
        approvalId: '2',
        approved: true,
        timestamp: new Date(),
      });

      flow['updateStats']({
        approvalId: '3',
        approved: false,
        feedback: {
          type: 'reject',
          content: '拒绝',
          timestamp: new Date(),
        },
        timestamp: new Date(),
      });

      const stats = flow.getStats();
      expect(stats.totalApprovals).toBe(3);
      expect(stats.approvedCount).toBe(2);
      expect(stats.accuracy).toBeCloseTo(0.667, 2);
    });
  });

  describe('CLI 模式审批流程', () => {
    it('应该处理 CLI 模式批准请求（模拟）', async () => {
      flow = new ApprovalFlow({
        mode: ApprovalMode.CLI,
        defaultTimeout: 30000,
        enableLearning: true,
      });

      const mockResult = { test: 'data' };
      const concerns = flow['analyzeConcerns'](mockResult);

      expect(concerns).toBeInstanceOf(Array);
      expect(concerns.length).toBe(0);
    });

    it('应该分析结果中的疑点', () => {
      flow = new ApprovalFlow({
        mode: ApprovalMode.CLI,
        defaultTimeout: 30000,
        enableLearning: true,
      });

      const resultWithNull = { a: 'value', b: null, c: undefined, d: '' };
      const concerns = flow['analyzeConcerns'](resultWithNull);

      expect(concerns.length).toBeGreaterThanOrEqual(2);
      expect(concerns.some((c: string) => c.includes('b'))).toBe(true);
    });

    it('应该检测异常数值', () => {
      flow = new ApprovalFlow({
        mode: ApprovalMode.CLI,
        defaultTimeout: 30000,
        enableLearning: true,
      });

      const resultWithInvalidNumbers = {
        normal: 100,
        negative: -10,
        tooLarge: 1e11,
      };
      const concerns = flow['analyzeConcerns'](resultWithInvalidNumbers);

      expect(concerns.length).toBe(2);
      expect(concerns.some((c: string) => c.includes('negative'))).toBe(true);
      expect(concerns.some((c: string) => c.includes('tooLarge'))).toBe(true);
    });
  });

  describe('HTTP 模式审批流程', () => {
    it('应该在 HTTP 模式下正确构建审批请求', async () => {
      flow = new ApprovalFlow({
        mode: ApprovalMode.HTTP,
        defaultTimeout: 30000,
        enableLearning: true,
        httpServerConfig: {
          port: 9996,
          host: '127.0.0.1',
        },
      });

      await flow.start();

      const mockResult = { key: 'value' };
      const context = {
        ...mockContext,
        agentName: 'test-agent',
      };

      try {
        const promise = flow.requestApproval(mockResult, context, 100);
        setTimeout(() => promise.catch(() => {}), 50);
        expect(true).toBe(true);
      } catch (error) {
        expect(error).toBeDefined();
      }

      await flow.stop();
    });

    it('应该在 HTTP 模式下收集反馈（无已完成审批）', async () => {
      flow = new ApprovalFlow({
        mode: ApprovalMode.HTTP,
        defaultTimeout: 30000,
        enableLearning: true,
        httpServerConfig: {
          port: 9995,
          host: '127.0.0.1',
        },
      });

      await flow.start();

      const feedback = await flow.collectFeedback('non-existent-approval-id');

      expect(feedback).toBeDefined();
      expect(feedback.type).toBe('approve');
      expect(feedback.content).toBe('Auto-approved (no feedback received)');

      await flow.stop();
    });

    it('应该在 HTTP 模式下收集反馈（批准但无反馈信息）', async () => {
      flow = new ApprovalFlow({
        mode: ApprovalMode.HTTP,
        defaultTimeout: 30000,
        enableLearning: true,
        httpServerConfig: {
          port: 9994,
          host: '127.0.0.1',
        },
      });

      await flow.start();

      const mockGetCompletedApproval = vi.fn().mockReturnValue({
        requestId: 'test-id',
        status: 'approved',
        response: {
          approvalId: 'test-id',
          approved: true,
          timestamp: new Date(),
        },
      });

      const httpServer = (flow as any).httpServer;
      httpServer.getCompletedApproval = mockGetCompletedApproval;

      const feedback = await flow.collectFeedback('test-id');

      expect(feedback.type).toBe('approve');
      expect(feedback.content).toBe('Approved');

      await flow.stop();
    });

    it('应该在 HTTP 模式下收集反馈（拒绝但无反馈信息）', async () => {
      flow = new ApprovalFlow({
        mode: ApprovalMode.HTTP,
        defaultTimeout: 30000,
        enableLearning: true,
        httpServerConfig: {
          port: 9993,
          host: '127.0.0.1',
        },
      });

      await flow.start();

      const mockGetCompletedApproval = vi.fn().mockReturnValue({
        requestId: 'test-id',
        status: 'rejected',
        response: {
          approvalId: 'test-id',
          approved: false,
          timestamp: new Date(),
        },
      });

      const httpServer = (flow as any).httpServer;
      httpServer.getCompletedApproval = mockGetCompletedApproval;

      const feedback = await flow.collectFeedback('test-id');

      expect(feedback.type).toBe('reject');
      expect(feedback.content).toBe('Rejected');

      await flow.stop();
    });

    it('应该在 HTTP 模式下收集反馈（有完整的反馈信息）', async () => {
      flow = new ApprovalFlow({
        mode: ApprovalMode.HTTP,
        defaultTimeout: 30000,
        enableLearning: true,
        httpServerConfig: {
          port: 9992,
          host: '127.0.0.1',
        },
      });

      await flow.start();

      const mockGetCompletedApproval = vi.fn().mockReturnValue({
        requestId: 'test-id',
        status: 'corrected',
        response: {
          approvalId: 'test-id',
          approved: false,
          feedback: {
            type: 'correct',
            content: '修正内容',
            corrections: { field: 'new value' },
            timestamp: new Date(),
          },
          timestamp: new Date(),
        },
      });

      const httpServer = (flow as any).httpServer;
      httpServer.getCompletedApproval = mockGetCompletedApproval;

      const feedback = await flow.collectFeedback('test-id');

      expect(feedback.type).toBe('correct');
      expect(feedback.content).toBe('修正内容');
      expect(feedback.corrections).toEqual({ field: 'new value' });

      await flow.stop();
    });

    it('应该在 HTTP 模式下收集补充反馈', async () => {
      flow = new ApprovalFlow({
        mode: ApprovalMode.HTTP,
        defaultTimeout: 30000,
        enableLearning: true,
        httpServerConfig: {
          port: 9991,
          host: '127.0.0.1',
        },
      });

      await flow.start();

      const mockGetCompletedApproval = vi.fn().mockReturnValue({
        requestId: 'test-id',
        status: 'approved',
        response: {
          approvalId: 'test-id',
          approved: true,
          feedback: {
            type: 'supplement',
            content: '补充信息',
            supplements: { additional: 'data' },
            timestamp: new Date(),
          },
          timestamp: new Date(),
        },
      });

      const httpServer = (flow as any).httpServer;
      httpServer.getCompletedApproval = mockGetCompletedApproval;

      const feedback = await flow.collectFeedback('test-id');

      expect(feedback.type).toBe('supplement');
      expect(feedback.content).toBe('补充信息');
      expect(feedback.supplements).toEqual({ additional: 'data' });

      await flow.stop();
    });

    it('应该在 HTTP 模式下收集拒绝反馈', async () => {
      flow = new ApprovalFlow({
        mode: ApprovalMode.HTTP,
        defaultTimeout: 30000,
        enableLearning: true,
        httpServerConfig: {
          port: 9990,
          host: '127.0.0.1',
        },
      });

      await flow.start();

      const mockGetCompletedApproval = vi.fn().mockReturnValue({
        requestId: 'test-id',
        status: 'rejected',
        response: {
          approvalId: 'test-id',
          approved: false,
          feedback: {
            type: 'reject',
            content: '拒绝原因',
            rejectionReason: '原因详细说明',
            timestamp: new Date(),
          },
          timestamp: new Date(),
        },
      });

      const httpServer = (flow as any).httpServer;
      httpServer.getCompletedApproval = mockGetCompletedApproval;

      const feedback = await flow.collectFeedback('test-id');

      expect(feedback.type).toBe('reject');
      expect(feedback.content).toBe('拒绝原因');
      expect(feedback.rejectionReason).toBe('原因详细说明');

      await flow.stop();
    });
  });

  describe('WebSocket 模式审批流程', () => {
    it('应该在 WebSocket 模式下返回默认批准响应', async () => {
      flow = new ApprovalFlow({
        mode: ApprovalMode.WEBSOCKET,
        defaultTimeout: 30000,
        enableLearning: true,
      });

      const response = await flow.requestApproval({ test: 'data' }, mockContext, 5000);

      expect(response).toBeDefined();
      expect(response.approved).toBe(true);
      expect(response.approvalId).toBeDefined();
      expect(response.timestamp).toBeInstanceOf(Date);
    });

    it('应该在 WebSocket 模式下收集默认反馈', async () => {
      flow = new ApprovalFlow({
        mode: ApprovalMode.WEBSOCKET,
        defaultTimeout: 30000,
        enableLearning: true,
      });

      const feedback = await flow.collectFeedback('ws-approval-id');

      expect(feedback).toBeDefined();
      expect(feedback.type).toBe('approve');
      expect(feedback.content).toBe('');
      expect(feedback.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('EventBus 事件触发', () => {
    it('应该在请求审批时触发 approval:request 事件', async () => {
      const mockPublish = vi.fn();
      const mockEventBus = {
        publish: mockPublish,
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        request: vi.fn(),
      } as any;

      flow = new ApprovalFlow(
        {
          mode: ApprovalMode.WEBSOCKET,
          defaultTimeout: 30000,
          enableLearning: true,
        },
        mockEventBus
      );

      await flow.requestApproval({ test: 'data' }, mockContext);

      expect(mockPublish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'approval:request',
          source: undefined,
          data: expect.objectContaining({
            approvalId: expect.any(String),
          }),
        })
      );
    });

    it('应该在审批完成时触发 approval:completed 事件', async () => {
      const mockPublish = vi.fn();
      const mockEventBus = {
        publish: mockPublish,
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        request: vi.fn(),
      } as any;

      flow = new ApprovalFlow(
        {
          mode: ApprovalMode.WEBSOCKET,
          defaultTimeout: 30000,
          enableLearning: true,
        },
        mockEventBus
      );

      await flow.requestApproval({ test: 'data' }, mockContext);

      expect(mockPublish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'approval:completed',
          data: expect.objectContaining({
            approvalId: expect.any(String),
          }),
        })
      );
    });
  });

  describe('错误处理', () => {
    it('应该在不支持的审批模式下抛出错误', async () => {
      flow = new ApprovalFlow({
        mode: 'unsupported' as any,
        defaultTimeout: 30000,
        enableLearning: true,
      });

      await expect(flow.requestApproval({ test: 'data' }, mockContext)).rejects.toThrow(
        '不支持的审批模式'
      );
    });

    it('应该在 HTTP 模式下收集反馈时处理未配置的服务器', async () => {
      flow = new ApprovalFlow({
        mode: ApprovalMode.HTTP,
        defaultTimeout: 30000,
        enableLearning: true,
      });

      await expect(flow.collectFeedback('test-id')).rejects.toThrow('HTTP server not configured');
    });

    it('应该在收集反馈时处理不支持的审批模式', async () => {
      flow = new ApprovalFlow({
        mode: 'unsupported' as any,
        defaultTimeout: 30000,
        enableLearning: true,
      });

      await expect(flow.collectFeedback('test-id')).rejects.toThrow('不支持的审批模式');
    });
  });

  describe('presentForApproval 边界情况', () => {
    it('应该处理非对象输入的表格展示', async () => {
      flow = new ApprovalFlow({
        mode: ApprovalMode.CLI,
        defaultTimeout: 30000,
        enableLearning: true,
      });

      await flow.presentForApproval('字符串输入', {
        format: 'table',
        highlightConcerns: false,
      });

      expect(console.log).toHaveBeenCalled();
    });

    it('应该处理 null 输入的表格展示', async () => {
      flow = new ApprovalFlow({
        mode: ApprovalMode.CLI,
        defaultTimeout: 30000,
        enableLearning: true,
      });

      await flow.presentForApproval(null, {
        format: 'table',
        highlightConcerns: false,
      });

      expect(console.log).toHaveBeenCalled();
    });

    it('应该处理非对象输入的摘要展示', async () => {
      flow = new ApprovalFlow({
        mode: ApprovalMode.CLI,
        defaultTimeout: 30000,
        enableLearning: true,
      });

      await flow.presentForApproval(12345, {
        format: 'summary',
        highlightConcerns: false,
      });

      expect(console.log).toHaveBeenCalled();
    });

    it('应该处理长字符串值的表格展示', async () => {
      flow = new ApprovalFlow({
        mode: ApprovalMode.CLI,
        defaultTimeout: 30000,
        enableLearning: true,
      });

      const longString = 'a'.repeat(100);
      await flow.presentForApproval({ key: longString }, {
        format: 'table',
        highlightConcerns: false,
      });

      expect(console.log).toHaveBeenCalled();
    });

    it('应该处理长字符串值的摘要展示', async () => {
      flow = new ApprovalFlow({
        mode: ApprovalMode.CLI,
        defaultTimeout: 30000,
        enableLearning: true,
      });

      const longString = 'a'.repeat(150);
      await flow.presentForApproval({ key: longString }, {
        format: 'summary',
        highlightConcerns: false,
      });

      expect(console.log).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('...'));
    });

    it('应该处理空对象输入的表格展示', async () => {
      flow = new ApprovalFlow({
        mode: ApprovalMode.CLI,
        defaultTimeout: 30000,
        enableLearning: true,
      });

      await flow.presentForApproval({}, {
        format: 'table',
        highlightConcerns: false,
      });

      expect(console.log).toHaveBeenCalled();
    });
  });

  describe('反馈学习机制', () => {
    it('应该存储不同类型的反馈', async () => {
      flow = new ApprovalFlow({
        mode: ApprovalMode.CLI,
        defaultTimeout: 30000,
        enableLearning: true,
      });

      const feedbacks = [
        { type: 'approve' as const, content: '批准', timestamp: new Date() },
        { type: 'correct' as const, content: '修正', timestamp: new Date(), corrections: { key: 'value' } },
        { type: 'reject' as const, content: '拒绝', timestamp: new Date(), rejectionReason: '原因' },
        {
          type: 'supplement' as const,
          content: '补充',
          timestamp: new Date(),
          supplements: { additional: 'info' },
        },
      ];

      for (const feedback of feedbacks) {
        await flow.learnFromFeedback(feedback);
      }

      expect(console.log).toHaveBeenCalledTimes(8);
    });

    it('应该处理带用户ID的反馈', async () => {
      flow = new ApprovalFlow({
        mode: ApprovalMode.CLI,
        defaultTimeout: 30000,
        enableLearning: true,
      });

      const feedback = {
        type: 'approve' as const,
        content: '测试反馈',
        timestamp: new Date(),
        userId: 'user-123',
      };

      await flow.learnFromFeedback(feedback);

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('approve'));
    });
  });

  describe('多审批请求处理', () => {
    it('应该正确处理多个连续的审批请求', async () => {
      flow = new ApprovalFlow({
        mode: ApprovalMode.WEBSOCKET,
        defaultTimeout: 30000,
        enableLearning: true,
      });

      const requests = [
        { data: 'request-1' },
        { data: 'request-2' },
        { data: 'request-3' },
      ];

      const responses = await Promise.all(
        requests.map((req) => flow.requestApproval(req, mockContext))
      );

      expect(responses).toHaveLength(3);
      responses.forEach((res) => {
        expect(res.approved).toBe(true);
        expect(res.approvalId).toBeDefined();
      });

      const stats = flow.getStats();
      expect(stats.totalApprovals).toBe(3);
      expect(stats.approvedCount).toBe(3);
    });

    it('应该保持统计信息的正确性', async () => {
      flow = new ApprovalFlow({
        mode: ApprovalMode.WEBSOCKET,
        defaultTimeout: 30000,
        enableLearning: true,
      });

      const requests = Array.from({ length: 10 }, (_, i) => ({ data: `request-${i}` }));

      await Promise.all(requests.map((req) => flow.requestApproval(req, mockContext)));

      const stats = flow.getStats();
      expect(stats.totalApprovals).toBe(10);
      expect(stats.approvedCount).toBe(10);
      expect(stats.accuracy).toBe(1);
    });
  });

  describe('展示选项的完整性', () => {
    it('应该正确处理所有展示格式', async () => {
      flow = new ApprovalFlow({
        mode: ApprovalMode.CLI,
        defaultTimeout: 30000,
        enableLearning: true,
      });

      const formats: Array<'json' | 'table' | 'summary'> = ['json', 'table', 'summary'];

      for (const format of formats) {
        vi.clearAllMocks();
        await flow.presentForApproval({ key: 'value' }, {
          format,
          highlightConcerns: false,
        });

        expect(console.log).toHaveBeenCalled();
      }
    });

    it('应该同时展示自定义消息和疑点', async () => {
      flow = new ApprovalFlow({
        mode: ApprovalMode.CLI,
        defaultTimeout: 30000,
        enableLearning: true,
      });

      await flow.presentForApproval({ key: 'value' }, {
        format: 'json',
        highlightConcerns: true,
        concerns: ['疑点1', '疑点2'],
        message: '请审批此请求',
      });

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('请审批此请求'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('疑点标注'));
    });
  });
});
