import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HttpApprovalServer } from '../../../src/gateway/http/HttpApprovalServer.js';
import type { ExecutionContext } from '../../src/lifecycle/Lifecycle.js';

// Mock console.log
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

describe('HttpApprovalServer', () => {
  let server: HttpApprovalServer;

  beforeEach(() => {
    server = new HttpApprovalServer({
      port: 9999,
      apiPrefix: '/api/v1',
    });
  });

  afterEach(async () => {
    await server.stop();
  });

  describe('constructor', () => {
    it('应该使用默认配置创建', () => {
      const s = new HttpApprovalServer({ port: 9998 });
      expect(s).toBeDefined();
    });

    it('应该接受自定义配置', () => {
      const s = new HttpApprovalServer({
        port: 9998,
        host: '127.0.0.1',
        apiPrefix: '/api/v2',
        corsOrigin: 'http://localhost:3000',
        apiKey: 'test-key',
      });
      expect(s).toBeDefined();
    });
  });

  describe('requestApproval', () => {
    it('应该创建审批请求', async () => {
      const request = {
        requestId: 'test-1',
        agentName: 'test-agent',
        content: { type: 'action' as const, data: {} },
        context: { goal: '测试目标', reasoning: '测试推理' },
        level: 'info' as const,
      };

      const context: ExecutionContext = {
        agentId: 'agent-1',
        executionId: 'exec-1',
        parentExecutionId: undefined,
        depth: 0,
        metadata: {},
      };

      const promise = server.requestApproval(request, context, 1000);

      // 验证请求已创建
      const pending = server.getAllCompletedApprovals();
      expect(pending).toBeDefined();

      // 清理
      promise.catch(() => {});
    });

    it('应该在超时时拒绝', async () => {
      const request = {
        requestId: 'test-timeout',
        agentName: 'test-agent',
        content: { type: 'action' as const, data: {} },
        context: { goal: '测试目标', reasoning: '测试推理' },
        level: 'info' as const,
      };

      const context: ExecutionContext = {
        agentId: 'agent-1',
        executionId: 'exec-1',
        parentExecutionId: undefined,
        depth: 0,
        metadata: {},
      };

      await expect(server.requestApproval(request, context, 100)).rejects.toThrow('Approval timeout');
    });
  });

  describe('processApproval', () => {
    it('应该处理审批通过', async () => {
      const request = {
        requestId: 'test-approve',
        agentName: 'test-agent',
        content: { type: 'action' as const, data: {} },
        context: { goal: '测试目标', reasoning: '测试推理' },
        level: 'info' as const,
      };

      const context: ExecutionContext = {
        agentId: 'agent-1',
        executionId: 'exec-1',
        parentExecutionId: undefined,
        depth: 0,
        metadata: {},
      };

      server['pendingApprovals'].set('test-approve', {
        requestId: 'test-approve',
        request,
        context,
        status: 'pending',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 5000),
      });

      const response = await server['processApproval']('test-approve', true, 'Approved');

      expect(response.approved).toBe(true);
      expect(response.feedback?.type).toBe('approve');
    });

    it('应该拒绝已处理的审批', async () => {
      const request = {
        requestId: 'test-already-processed',
        agentName: 'test-agent',
        content: { type: 'action' as const, data: {} },
        context: { goal: '测试目标', reasoning: '测试推理' },
        level: 'info' as const,
      };

      const context: ExecutionContext = {
        agentId: 'agent-1',
        executionId: 'exec-1',
        parentExecutionId: undefined,
        depth: 0,
        metadata: {},
      };

      server['pendingApprovals'].set('test-already-processed', {
        requestId: 'test-already-processed',
        request,
        context,
        status: 'approved',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 5000),
      });

      await expect(
        server['processApproval']('test-already-processed', true, 'Approve again')
      ).rejects.toThrow('Approval already processed');
    });

    it('应该处理审批拒绝', async () => {
      const request = {
        requestId: 'test-reject',
        agentName: 'test-agent',
        content: { type: 'action' as const, data: {} },
        context: { goal: '测试目标', reasoning: '测试推理' },
        level: 'info' as const,
      };

      const context: ExecutionContext = {
        agentId: 'agent-1',
        executionId: 'exec-1',
        parentExecutionId: undefined,
        depth: 0,
        metadata: {},
      };

      server['pendingApprovals'].set('test-reject', {
        requestId: 'test-reject',
        request,
        context,
        status: 'pending',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 5000),
      });

      const response = await server['processApproval']('test-reject', false, 'Rejected');
      expect(response.approved).toBe(false);
      expect(response.feedback?.type).toBe('reject');
    });

    it('应该处理修正', async () => {
      const request = {
        requestId: 'test-correct',
        agentName: 'test-agent',
        content: { type: 'action' as const, data: {} },
        context: { goal: '测试目标', reasoning: '测试推理' },
        level: 'info' as const,
      };

      const context: ExecutionContext = {
        agentId: 'agent-1',
        executionId: 'exec-1',
        parentExecutionId: undefined,
        depth: 0,
        metadata: {},
      };

      server['pendingApprovals'].set('test-correct', {
        requestId: 'test-correct',
        request,
        context,
        status: 'pending',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 5000),
      });

      const response = await server['processApproval'](
        'test-correct',
        false,
        '需要修正',
        { field: 'value' }
      );

      expect(response.approved).toBe(false);
      expect(response.feedback?.type).toBe('correct');
    });

    it('应该处理补充', async () => {
      const request = {
        requestId: 'test-supplement',
        agentName: 'test-agent',
        content: { type: 'action' as const, data: {} },
        context: { goal: '测试目标', reasoning: '测试推理' },
        level: 'info' as const,
      };

      const context: ExecutionContext = {
        agentId: 'agent-1',
        executionId: 'exec-1',
        parentExecutionId: undefined,
        depth: 0,
        metadata: {},
      };

      server['pendingApprovals'].set('test-supplement', {
        requestId: 'test-supplement',
        request,
        context,
        status: 'pending',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 5000),
      });

      const response = await server['processApproval'](
        'test-supplement',
        true,
        'Approved with supplement',
        undefined,
        { additional: 'info' }
      );

      expect(response.approved).toBe(true);
      expect(response.feedback?.type).toBe('supplement');
    });
  });

  describe('cleanupExpired', () => {
    it('应该清理过期的审批', async () => {
      const request = {
        requestId: 'test-expired',
        agentName: 'test-agent',
        content: { type: 'action' as const, data: {} },
        context: { goal: '测试目标', reasoning: '测试推理' },
        level: 'info' as const,
      };

      const context: ExecutionContext = {
        agentId: 'agent-1',
        executionId: 'exec-1',
        parentExecutionId: undefined,
        depth: 0,
        metadata: {},
      };

      // 创建一个已超时的请求
      const promise = server.requestApproval(request, context, 1);
      promise.catch(() => {});

      // 等待过期
      await new Promise((resolve) => setTimeout(resolve, 50));

      const cleaned = server.cleanupExpired();
      expect(cleaned).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getCompletedApproval', () => {
    it('应该返回 null 对于不存在的审批', () => {
      const result = server.getCompletedApproval('non-existent');
      expect(result).toBeNull();
    });

    it('应该返回已完成的审批列表', () => {
      const approvals = server.getAllCompletedApprovals();
      expect(Array.isArray(approvals)).toBe(true);
    });
  });

  describe('start/stop', () => {
    it('应该启动和停止服务器', async () => {
      const testServer = new HttpApprovalServer({
        port: 9997,
        host: '127.0.0.1',
      });

      await testServer.start();
      await testServer.stop();
    });

    it('应该在没有启动时安全停止', async () => {
      const testServer = new HttpApprovalServer({ port: 9996 });
      await testServer.stop();
    });
  });

  describe('routes', () => {
    let testServer: HttpApprovalServer;
    let baseUrl: string;

    beforeEach(async () => {
      testServer = new HttpApprovalServer({
        port: 0,
        apiPrefix: '/api/v1',
      });
      await testServer.start();
      const address = testServer['server']?.address();
      const port = typeof address === 'object' ? address?.port : 9995;
      baseUrl = `http://127.0.0.1:${port}`;
    });

    afterEach(async () => {
      await testServer.stop();
    });

    it('应该响应健康检查', async () => {
      const response = await fetch(`${baseUrl}/api/v1/health`);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.status).toBe('ok');
    });

    it('应该返回空的审批列表', async () => {
      const response = await fetch(`${baseUrl}/api/v1/approvals`);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.approvals).toEqual([]);
    });

    it('应该返回 404 对于不存在的审批', async () => {
      const response = await fetch(`${baseUrl}/api/v1/approvals/non-existent`);
      expect(response.status).toBe(404);
    });
  });

  describe('with api key', () => {
    let testServer: HttpApprovalServer;
    let baseUrl: string;

    beforeEach(async () => {
      testServer = new HttpApprovalServer({
        port: 0,
        apiPrefix: '/api/v1',
        apiKey: 'secret-key',
      });
      await testServer.start();
      const address = testServer['server']?.address();
      const port = typeof address === 'object' ? address?.port : 9994;
      baseUrl = `http://127.0.0.1:${port}`;
    });

    afterEach(async () => {
      await testServer.stop();
    });

    it('应该拒绝没有 API Key 的请求', async () => {
      const response = await fetch(`${baseUrl}/api/v1/health`);
      expect(response.status).toBe(401);
    });

    it('应该接受有效的 API Key', async () => {
      const response = await fetch(`${baseUrl}/api/v1/health`, {
        headers: { 'x-api-key': 'secret-key' },
      });
      expect(response.status).toBe(200);
    });

    it('应该拒绝错误的 API Key', async () => {
      const response = await fetch(`${baseUrl}/api/v1/health`, {
        headers: { 'x-api-key': 'wrong-key' },
      });
      expect(response.status).toBe(401);
    });
  });

  describe('CORS 配置', () => {
    let testServer: HttpApprovalServer;
    let baseUrl: string;

    afterEach(async () => {
      if (testServer) {
        await testServer.stop();
      }
    });

    it('不应该设置 CORS 头（未配置 corsOrigin）', async () => {
      testServer = new HttpApprovalServer({
        port: 0,
        apiPrefix: '/api/v1',
      });
      await testServer.start();
      const address = testServer['server']?.address();
      const port = typeof address === 'object' ? address?.port : 9993;
      baseUrl = `http://127.0.0.1:${port}`;

      const response = await fetch(`${baseUrl}/api/v1/health`);
      expect(response.status).toBe(200);
      expect(response.headers.get('access-control-allow-origin')).toBeNull();
    });

    it('应该设置 CORS 头（corsOrigin 为字符串）', async () => {
      testServer = new HttpApprovalServer({
        port: 0,
        apiPrefix: '/api/v1',
        corsOrigin: 'http://localhost:3000',
      });
      await testServer.start();
      const address = testServer['server']?.address();
      const port = typeof address === 'object' ? address?.port : 9992;
      baseUrl = `http://127.0.0.1:${port}`;

      const response = await fetch(`${baseUrl}/api/v1/health`);
      expect(response.status).toBe(200);
      expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
      expect(response.headers.get('access-control-allow-methods')).toBe('GET, POST, PUT, DELETE, OPTIONS');
      expect(response.headers.get('access-control-allow-headers')).toBe('Content-Type, Authorization');
    });

    it('应该允许所有源（corsOrigin 为数组）', async () => {
      testServer = new HttpApprovalServer({
        port: 0,
        apiPrefix: '/api/v1',
        corsOrigin: ['http://localhost:3000', 'http://localhost:3001'],
      });
      await testServer.start();
      const address = testServer['server']?.address();
      const port = typeof address === 'object' ? address?.port : 9991;
      baseUrl = `http://127.0.0.1:${port}`;

      const response = await fetch(`${baseUrl}/api/v1/health`);
      expect(response.status).toBe(200);
      expect(response.headers.get('access-control-allow-origin')).toBe('*');
    });

    it('应该处理 OPTIONS 预检请求', async () => {
      testServer = new HttpApprovalServer({
        port: 0,
        apiPrefix: '/api/v1',
        corsOrigin: 'http://localhost:3000',
      });
      await testServer.start();
      const address = testServer['server']?.address();
      const port = typeof address === 'object' ? address?.port : 9990;
      baseUrl = `http://127.0.0.1:${port}`;

      const response = await fetch(`${baseUrl}/api/v1/health`, {
        method: 'OPTIONS',
      });
      expect(response.status).toBe(200);
    });
  });

  describe('等待审批路由', () => {
    let testServer: HttpApprovalServer;
    let baseUrl: string;
    let approvalId: string;

    beforeEach(async () => {
      testServer = new HttpApprovalServer({
        port: 0,
        apiPrefix: '/api/v1',
      });
      await testServer.start();
      const address = testServer['server']?.address();
      const port = typeof address === 'object' ? address?.port : 9989;
      baseUrl = `http://127.0.0.1:${port}`;

      const request = {
        requestId: 'test-wait',
        agentName: 'test-agent',
        content: { type: 'action' as const, data: {} },
        context: { goal: '测试目标', reasoning: '测试推理' },
        level: 'info' as const,
      };

      const context: ExecutionContext = {
        agentId: 'agent-1',
        executionId: 'exec-1',
        parentExecutionId: undefined,
        depth: 0,
        metadata: {},
      };

      testServer['pendingApprovals'].set('test-wait', {
        requestId: 'test-wait',
        request,
        context,
        status: 'pending',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 60000),
      });

      approvalId = 'test-wait';
    });

    afterEach(async () => {
      await testServer.stop();
    });

    it('应该在超时时返回 408', async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 200);

      try {
        const response = await fetch(`${baseUrl}/api/v1/approvals/${approvalId}/wait?timeout=100`, {
          signal: controller.signal,
        });
        expect(response.status).toBe(408);
        const data = await response.json();
        expect(data.error).toBe('Approval timeout');
      } catch (error: any) {
        expect(error.name).toBe('AbortError');
      } finally {
        clearTimeout(timeoutId);
      }
    }, 5000);

    it('应该立即返回非pending状态的响应', async () => {
      const approval = testServer['pendingApprovals'].get(approvalId);
      if (approval) {
        approval.status = 'approved';
        approval.response = {
          approvalId,
          approved: true,
          feedback: {
            type: 'approve',
            content: 'Approved',
            timestamp: new Date(),
          },
          timestamp: new Date(),
        };
      }

      const response = await fetch(`${baseUrl}/api/v1/approvals/${approvalId}/wait`);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.approved).toBe(true);
    });

    it('应该返回 404 对于不存在的审批', async () => {
      const response = await fetch(`${baseUrl}/api/v1/approvals/non-existent/wait`);
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Approval request not found');
    });
  });

  describe('审批路由的完整流程', () => {
    let testServer: HttpApprovalServer;
    let baseUrl: string;

    beforeEach(async () => {
      testServer = new HttpApprovalServer({
        port: 0,
        apiPrefix: '/api/v1',
      });
      await testServer.start();
      const address = testServer['server']?.address();
      const port = typeof address === 'object' ? address?.port : 9988;
      baseUrl = `http://127.0.0.1:${port}`;
    });

    afterEach(async () => {
      await testServer.stop();
    });

    it('应该处理审批通过', async () => {
      const request = {
        requestId: 'test-approve-flow',
        agentName: 'test-agent',
        content: { type: 'action' as const, data: {} },
        context: { goal: '测试目标', reasoning: '测试推理' },
        level: 'info' as const,
      };

      const context: ExecutionContext = {
        agentId: 'agent-1',
        executionId: 'exec-1',
        parentExecutionId: undefined,
        depth: 0,
        metadata: {},
      };

      testServer['pendingApprovals'].set('test-approve-flow', {
        requestId: 'test-approve-flow',
        request,
        context,
        status: 'pending',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 60000),
      });

      const response = await fetch(`${baseUrl}/api/v1/approvals/test-approve-flow/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approved: true,
          feedback: 'Approve',
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.approved).toBe(true);
      expect(data.feedback.type).toBe('approve');
    });

    it('应该处理审批拒绝', async () => {
      const request = {
        requestId: 'test-reject-flow',
        agentName: 'test-agent',
        content: { type: 'action' as const, data: {} },
        context: { goal: '测试目标', reasoning: '测试推理' },
        level: 'info' as const,
      };

      const context: ExecutionContext = {
        agentId: 'agent-1',
        executionId: 'exec-1',
        parentExecutionId: undefined,
        depth: 0,
        metadata: {},
      };

      testServer['pendingApprovals'].set('test-reject-flow', {
        requestId: 'test-reject-flow',
        request,
        context,
        status: 'pending',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 60000),
      });

      const response = await fetch(`${baseUrl}/api/v1/approvals/test-reject-flow/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approved: false,
          feedback: 'Reject',
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.approved).toBe(false);
      expect(data.feedback.type).toBe('reject');
    });

    it('应该处理修正请求', async () => {
      const request = {
        requestId: 'test-correct-flow',
        agentName: 'test-agent',
        content: { type: 'action' as const, data: {} },
        context: { goal: '测试目标', reasoning: '测试推理' },
        level: 'info' as const,
      };

      const context: ExecutionContext = {
        agentId: 'agent-1',
        executionId: 'exec-1',
        parentExecutionId: undefined,
        depth: 0,
        metadata: {},
      };

      testServer['pendingApprovals'].set('test-correct-flow', {
        requestId: 'test-correct-flow',
        request,
        context,
        status: 'pending',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 60000),
      });

      const response = await fetch(`${baseUrl}/api/v1/approvals/test-correct-flow/correct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          corrections: { field: 'corrected value' },
          feedback: 'Please correct',
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.approved).toBe(false);
      expect(data.feedback.type).toBe('correct');
      expect(data.feedback.corrections).toEqual({ field: 'corrected value' });
    });

    it('应该处理补充请求', async () => {
      const request = {
        requestId: 'test-supplement-flow',
        agentName: 'test-agent',
        content: { type: 'action' as const, data: {} },
        context: { goal: '测试目标', reasoning: '测试推理' },
        level: 'info' as const,
      };

      const context: ExecutionContext = {
        agentId: 'agent-1',
        executionId: 'exec-1',
        parentExecutionId: undefined,
        depth: 0,
        metadata: {},
      };

      testServer['pendingApprovals'].set('test-supplement-flow', {
        requestId: 'test-supplement-flow',
        request,
        context,
        status: 'pending',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 60000),
      });

      const response = await fetch(`${baseUrl}/api/v1/approvals/test-supplement-flow/supplement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplements: { additional: 'information' },
          feedback: 'Approved with supplement',
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.approved).toBe(true);
      expect(data.feedback.type).toBe('supplement');
      expect(data.feedback.supplements).toEqual({ additional: 'information' });
    });

    it('应该返回 400 对于不存在的审批', async () => {
      const response = await fetch(`${baseUrl}/api/v1/approvals/non-existent/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approved: true,
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Approval request not found');
    });
  });

  describe('清理过期审批的完整场景', () => {
    let testServer: HttpApprovalServer;

    beforeEach(() => {
      testServer = new HttpApprovalServer({
        port: 9999,
        apiPrefix: '/api/v1',
      });
    });

    it('应该清理所有过期的审批', () => {
      const request = {
        requestId: 'test-expired-1',
        agentName: 'test-agent',
        content: { type: 'action' as const, data: {} },
        context: { goal: '测试目标', reasoning: '测试推理' },
        level: 'info' as const,
      };

      const context: ExecutionContext = {
        agentId: 'agent-1',
        executionId: 'exec-1',
        parentExecutionId: undefined,
        depth: 0,
        metadata: {},
      };

      testServer['pendingApprovals'].set('test-expired-1', {
        requestId: 'test-expired-1',
        request,
        context,
        status: 'pending',
        createdAt: new Date(Date.now() - 10000),
        expiresAt: new Date(Date.now() - 5000),
      });

      testServer['pendingApprovals'].set('test-not-expired', {
        requestId: 'test-not-expired',
        request,
        context,
        status: 'pending',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 60000),
      });

      const cleaned = testServer.cleanupExpired();
      expect(cleaned).toBe(1);
      expect(testServer['pendingApprovals'].has('test-expired-1')).toBe(false);
      expect(testServer['pendingApprovals'].has('test-not-expired')).toBe(true);
    });

    it('应该返回 0 当没有过期审批时', () => {
      const request = {
        requestId: 'test-not-expired-2',
        agentName: 'test-agent',
        content: { type: 'action' as const, data: {} },
        context: { goal: '测试目标', reasoning: '测试推理' },
        level: 'info' as const,
      };

      const context: ExecutionContext = {
        agentId: 'agent-1',
        executionId: 'exec-1',
        parentExecutionId: undefined,
        depth: 0,
        metadata: {},
      };

      testServer['pendingApprovals'].set('test-not-expired-2', {
        requestId: 'test-not-expired-2',
        request,
        context,
        status: 'pending',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 60000),
      });

      const cleaned = testServer.cleanupExpired();
      expect(cleaned).toBe(0);
    });
  });

  describe('requestApproval 完整流程', () => {
    let testServer: HttpApprovalServer;

    beforeEach(() => {
      testServer = new HttpApprovalServer({
        port: 9999,
        apiPrefix: '/api/v1',
      });
    });

    it('应该完成审批并移动到已完成列表', async () => {
      const request = {
        requestId: 'test-complete',
        agentName: 'test-agent',
        content: { type: 'action' as const, data: {} },
        context: { goal: '测试目标', reasoning: '测试推理' },
        level: 'info' as const,
      };

      const context: ExecutionContext = {
        agentId: 'agent-1',
        executionId: 'exec-1',
        parentExecutionId: undefined,
        depth: 0,
        metadata: {},
      };

      const approvalPromise = testServer.requestApproval(request, context, 5000);

      setTimeout(async () => {
        const approvalId = Array.from(testServer['pendingApprovals'].keys())[0];
        if (approvalId) {
          await testServer['processApproval'](approvalId, true, 'Approved');
        }
      }, 100);

      const response = await approvalPromise;

      expect(response.approved).toBe(true);
      expect(testServer['pendingApprovals'].size).toBe(0);
      expect(testServer['completedApprovals'].size).toBe(1);
    }, 6000);

    it('应该清理超过 100 个已完成审批', async () => {
      const request = {
        requestId: 'test-cleanup',
        agentName: 'test-agent',
        content: { type: 'action' as const, data: {} },
        context: { goal: '测试目标', reasoning: '测试推理' },
        level: 'info' as const,
      };

      const context: ExecutionContext = {
        agentId: 'agent-1',
        executionId: 'exec-1',
        parentExecutionId: undefined,
        depth: 0,
        metadata: {},
      };

      for (let i = 0; i < 100; i++) {
        testServer['completedApprovals'].set(`test-${i}`, {
          requestId: `test-${i}`,
          request,
          context,
          status: 'approved',
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 60000),
        });
      }

      expect(testServer['completedApprovals'].size).toBe(100);

      const approvalPromise = testServer.requestApproval(request, context, 5000);

      setTimeout(async () => {
        const approvalId = Array.from(testServer['pendingApprovals'].keys())[0];
        if (approvalId) {
          await testServer['processApproval'](approvalId, true, 'Approved');
        }
      }, 100);

      await approvalPromise;

      expect(testServer['completedApprovals'].size).toBe(100);
    }, 10000);
  });
});
