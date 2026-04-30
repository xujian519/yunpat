/**
 * EventBus 测试
 *
 * 采用 TDD 方式：
 * 1. 先写测试（红色 - 失败）
 * 2. 修复代码
 * 3. 运行测试（绿色 - 通过）
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventBus } from '../../src/eventbus/EventBus.js';

describe('EventBus', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
  });

  afterEach(() => {
    eventBus.clear();
  });

  describe('基本功能', () => {
    it('应该能够发布和订阅事件', () => {
      const handler = vi.fn();

      eventBus.subscribe('test:event', handler);
      eventBus.publish({
        type: 'test:event',
        source: 'test',
        data: { message: 'hello' },
        timestamp: new Date(),
      });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'test:event',
          data: { message: 'hello' },
        })
      );
    });

    it('应该支持取消订阅', () => {
      const handler = vi.fn();

      const subscription = eventBus.subscribe('test:event', handler);
      eventBus.unsubscribe(subscription);

      eventBus.publish({
        type: 'test:event',
        source: 'test',
        data: { message: 'hello' },
        timestamp: new Date(),
      });

      expect(handler).not.toHaveBeenCalled();
    });

    it('应该支持目标特定事件', () => {
      const allHandler = vi.fn();
      const targetHandler = vi.fn();

      eventBus.subscribe('test:event', allHandler);
      eventBus.subscribe('test:event:target1', targetHandler);

      eventBus.publish({
        type: 'test:event',
        source: 'test',
        target: 'target1',
        data: { message: 'hello' },
        timestamp: new Date(),
      });

      // allHandler应该被调用一次（test:event）
      // targetHandler应该被调用一次（test:event:target1）
      expect(allHandler).toHaveBeenCalledTimes(1);
      expect(targetHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('request/response 模式', () => {
    it('应该能够发送请求并接收响应', async () => {
      // 订阅请求事件以获取requestId
      let requestId: string | undefined;

      eventBus.subscribe('message:request', (event: any) => {
        requestId = event.data.requestId;

        // 模拟目标智能体响应
        setTimeout(() => {
          eventBus.respond(requestId!, { result: 'success' });
        }, 100);
      });

      // 创建一个请求
      const requestPromise = eventBus.request('target-agent', { action: 'test' });

      const response = await requestPromise;
      expect(response).toEqual({ result: 'success' });
    });

    it('应该在超时后拒绝请求', async () => {
      // 使用短超时时间
      const timeout = 500;

      await expect(
        eventBus.request('non-existent-agent', { action: 'test' }, timeout)
      ).rejects.toThrow('Request timeout');
    });

    /**
     * ✅ Bug修复验证：request方法不应该立即reject
     *
     * 这个测试验证超时机制正常工作。
     * 如果有Bug，请求会立即reject（< 100ms）
     * 如果没有Bug，请求会等待完整的超时时间
     */
    it('不应该立即reject请求（Bug修复验证）', async () => {
      const startTime = Date.now();
      const timeout = 1000; // 1秒超时

      try {
        await eventBus.request('target-agent', { action: 'test' }, timeout);
      } catch (error: any) {
        const endTime = Date.now();
        const duration = endTime - startTime;

        console.log(`请求持续时间: ${duration}ms`);

        // 验证超时机制正常工作
        // 请求应该等待接近超时时间（至少800ms）
        expect(duration).toBeGreaterThanOrEqual(800);
        expect(error.message).toContain('Request timeout');
      }
    }, 2000);
  });

  describe('性能监控', () => {
    it('应该记录事件发布性能', () => {
      eventBus.setMetricsEnabled(true);

      const handler = vi.fn();
      eventBus.subscribe('test:event', handler);

      // 发布多个事件
      for (let i = 0; i < 10; i++) {
        eventBus.publish({
          type: 'test:event',
          source: 'test',
          data: { index: i },
          timestamp: new Date(),
        });
      }

      const metrics = eventBus.getMetrics();
      expect(metrics).toBeDefined();

      const report = eventBus.generatePerformanceReport();
      expect(report).toContain('test:event');
    });
  });

  describe('订阅管理', () => {
    it('应该正确跟踪订阅数量', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      eventBus.subscribe('test:event', handler1);
      eventBus.subscribe('test:event', handler2);

      const subscriptions = eventBus.getSubscriptions();
      const testEventSub = subscriptions.find((sub) => sub.pattern === 'test:event');

      expect(testEventSub).toBeDefined();
      expect(testEventSub?.handlers).toBe(2);
    });

    it('应该能够清空所有订阅', () => {
      const handler = vi.fn();
      eventBus.subscribe('test:event', handler);

      eventBus.clear();

      const subscriptions = eventBus.getSubscriptions();
      expect(subscriptions).toHaveLength(0);
    });
  });
});
