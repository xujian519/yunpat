/**
 * Agent 集成 ApprovalFlow 和 CheckpointManager 测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Agent, AgentConfig } from '../../src/agent/Agent.js';
import { LifecycleStage, ExecutionContext, MemoryStore } from '../../src/lifecycle/Lifecycle.js';
import { ApprovalFlow, ApprovalMode } from '../../src/gateway/ApprovalFlow.js';
import { CheckpointManager, EnhancedMemoryStore } from '../../src/memory/CheckpointManager.js';
import { EventBus } from '../../src/eventbus/EventBus.js';
import { ToolRegistry } from '../../src/tools/ToolRegistry.js';
import { NativeLLMAdapter } from '../../src/llm/NativeLLMAdapter.js';
import { promises as fs } from 'fs';

// 简单的测试Agent
class TestAgent extends Agent<string, string> {
  planCallCount = 0;
  actCallCount = 0;
  initCallCount = 0;

  protected async init(context: ExecutionContext): Promise<void> {
    this.initCallCount++;
    // 初始化逻辑
  }

  protected async plan(input: string, context: ExecutionContext): Promise<any> {
    this.planCallCount++;
    return { steps: ['step1', 'step2'], currentStep: 0 };
  }

  protected async act(plan: any, context: ExecutionContext): Promise<string> {
    this.actCallCount++;
    plan.currentStep++;
    return plan.currentStep >= plan.steps.length ? 'done' : 'continue';
  }

  protected async reflect(result: any, context: ExecutionContext): Promise<any> {
    return { shouldContinue: result === 'continue' };
  }
}

describe('Agent 集成 ApprovalFlow 和 CheckpointManager', () => {
  let eventBus: EventBus;
  let memory: MemoryStore;
  let tools: ToolRegistry;
  let llm: NativeLLMAdapter;
  let checkpointManager: CheckpointManager;
  let approvalFlow: ApprovalFlow;
  const TEST_DIR = 'data/test-agent-checkpoints';

  beforeEach(async () => {
    // 清理测试目录
    try {
      await fs.rm(TEST_DIR, { recursive: true, force: true });
    } catch {
      // 忽略
    }

    // 创建基础组件
    eventBus = new EventBus();
    memory = new EnhancedMemoryStore();
    tools = new ToolRegistry();
    llm = new NativeLLMAdapter({
      name: 'deepseek-chat',
      apiKey: 'test-key',
    });

    // 创建检查点管理器（不使用文件系统，使用内存）
    checkpointManager = new CheckpointManager({
      autoSave: true,
      maxCheckpoints: 100,
    });

    // 创建审批流程
    approvalFlow = new ApprovalFlow(
      {
        mode: ApprovalMode.CLI,
        defaultTimeout: 5000,
        enableLearning: false,
      },
      eventBus
    );
  });

  afterEach(async () => {
    // 清理测试目录
    try {
      await fs.rm(TEST_DIR, { recursive: true, force: true });
    } catch {
      // 忽略
    }
  });

  describe('CheckpointManager 集成', () => {
    it('应该在关键阶段保存检查点', async () => {
      const agent = new TestAgent({
        name: 'TestAgent',
        description: '测试智能体',
        eventBus,
        memory,
        tools,
        llm,

        checkpointManager,
        enableCheckpoints: true,
      });

      await agent.execute('test input');

      // 验证检查点已保存
      const checkpoints = await checkpointManager.listCheckpoints({
        agentName: 'TestAgent',
      });

      // 应该至少有init, plan, act, completed等检查点
      expect(checkpoints.length).toBeGreaterThanOrEqual(4);
      expect(checkpoints.some((c) => c.tags?.includes('init'))).toBe(true);
      expect(checkpoints.some((c) => c.tags?.includes('plan'))).toBe(true);
      expect(checkpoints.some((c) => c.tags?.some((tag) => tag.startsWith('act')))).toBe(true);
      expect(checkpoints.some((c) => c.tags?.includes('completed'))).toBe(true);
    });

    it('应该支持禁用检查点', async () => {
      const agent = new TestAgent({
        name: 'TestAgent',
        description: '测试智能体',
        eventBus,
        memory,
        tools,
        llm,

        checkpointManager,
        enableCheckpoints: false, // 禁用检查点
      });

      await agent.execute('test input');

      // 验证没有检查点保存
      const checkpoints = await checkpointManager.listCheckpoints({
        agentName: 'TestAgent',
      });

      expect(checkpoints.length).toBe(0);
    });

    it('应该在检查点中保存正确的数据', async () => {
      const agent = new TestAgent({
        name: 'TestAgent',
        description: '测试智能体',
        eventBus,
        memory,
        tools,
        llm,

        checkpointManager,
        enableCheckpoints: true,
      });

      await memory.set('testKey', 'testValue');
      await agent.execute('test input');

      const checkpoints = await checkpointManager.listCheckpoints({
        agentName: 'TestAgent',
      });

      const planCheckpoint = checkpoints.find((c) => c.tags?.includes('plan'));
      expect(planCheckpoint).toBeDefined();
      expect(planCheckpoint?.memorySnapshot).toHaveProperty('testKey', 'testValue');
      expect(planCheckpoint?.stateSnapshot).toHaveProperty('plan');
    });
  });

  describe('ApprovalFlow 集成', () => {
    it('应该在配置的阶段请求审批', async () => {
      let approvalRequested = false;

      // Mock审批流程，自动批准
      const mockApprovalFlow = new ApprovalFlow(
        {
          mode: ApprovalMode.CLI,
          defaultTimeout: 5000,
          enableLearning: false,
        },
        eventBus
      );

      // 覆盖requestApproval方法，自动批准
      mockApprovalFlow.requestApproval = async () => {
        approvalRequested = true;
        return {
          approvalId: 'test-approval-id',
          approved: true,
          timestamp: new Date(),
        };
      };

      const agent = new TestAgent({
        name: 'TestAgent',
        description: '测试智能体',
        eventBus,
        memory,
        tools,
        llm,

        approvalFlow: mockApprovalFlow,
        approvalStages: [LifecycleStage.PLAN, LifecycleStage.ACT],
      });

      await agent.execute('test input');

      // 验证plan阶段请求了审批
      expect(approvalRequested).toBe(true);
    });

    it('应该支持不配置审批流程', async () => {
      const agent = new TestAgent({
        name: 'TestAgent',
        description: '测试智能体',
        eventBus,
        memory,
        tools,
        llm,

        // 不配置审批流程
      });

      const result = await agent.execute('test input');

      // 应该正常执行完成
      expect(result).toBe('done');
    });
  });

  describe('完整集成测试', () => {
    it('应该同时支持审批和检查点', async () => {
      let approvalCount = 0;

      // Mock审批流程
      const mockApprovalFlow = new ApprovalFlow(
        {
          mode: ApprovalMode.CLI,
          defaultTimeout: 5000,
          enableLearning: false,
        },
        eventBus
      );

      mockApprovalFlow.requestApproval = async () => {
        approvalCount++;
        return {
          approvalId: `approval-${approvalCount}`,
          approved: true,
          timestamp: new Date(),
        };
      };

      const agent = new TestAgent({
        name: 'TestAgent',
        description: '测试智能体',
        eventBus,
        memory,
        tools,
        llm,

        approvalFlow: mockApprovalFlow,
        approvalStages: [LifecycleStage.PLAN],

        checkpointManager,
        enableCheckpoints: true,
      });

      await agent.execute('test input');

      // 验证plan阶段请求了审批
      expect(approvalCount).toBe(1);

      // 验证保存了检查点
      const checkpoints = await checkpointManager.listCheckpoints({
        agentName: 'TestAgent',
      });
      expect(checkpoints.length).toBeGreaterThanOrEqual(4);
    });
  });
});
