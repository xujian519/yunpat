/**
 * WorkflowEngine 测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { WorkflowEngine, WorkflowDefinition, WorkflowStep } from '../../src/planning/WorkflowEngine.js';
import { EventBus } from '../../src/eventbus/EventBus.js';
import { EnhancedMemoryStore } from '../../src/memory/CheckpointManager.js';
import { Agent, AgentConfig } from '../../src/agent/Agent.js';
import { ExecutionContext } from '../../src/lifecycle/Lifecycle.js';
import { ToolRegistry } from '../../src/tools/ToolRegistry.js';
import { NativeLLMAdapter } from '../../src/llm/NativeLLMAdapter.js';

// 简单的测试Agent
class TestAgent extends Agent<string, string> {
  constructor(config: AgentConfig) {
    super(config);
  }

  protected async plan(input: string, context: ExecutionContext): Promise<any> {
    return { input };
  }

  protected async act(plan: any, context: ExecutionContext): Promise<string> {
    return `processed: ${plan.input}`;
  }
}

describe('WorkflowEngine', () => {
  let eventBus: EventBus;
  let memory: EnhancedMemoryStore;
  let tools: ToolRegistry;
  let llm: NativeLLMAdapter;
  let agents: Map<string, Agent>;

  beforeEach(() => {
    eventBus = new EventBus();
    memory = new EnhancedMemoryStore();
    tools = new ToolRegistry();
    llm = new NativeLLMAdapter({
      name: 'deepseek-chat',
      apiKey: 'test-key',
    });

    // 创建测试Agents
    agents = new Map<string, Agent>([
      ['agent1', new TestAgent({
        name: 'agent1',
        description: '测试Agent 1',
        eventBus,
        memory,
        tools,
        llm,
      })],
      ['agent2', new TestAgent({
        name: 'agent2',
        description: '测试Agent 2',
        eventBus,
        memory,
        tools,
        llm,
      })],
      ['agent3', new TestAgent({
        name: 'agent3',
        description: '测试Agent 3',
        eventBus,
        memory,
        tools,
        llm,
      })],
    ]);
  });

  describe('基础功能', () => {
    it('应该成功执行简单工作流', async () => {
      const workflowEngine = new WorkflowEngine({
        eventBus,
        memory,
        agents,
      });

      const workflow: WorkflowDefinition = {
        id: 'test-workflow',
        name: '测试工作流',
        steps: [
          {
            id: 'step1',
            name: '步骤1',
            agentName: 'agent1',
          },
          {
            id: 'step2',
            name: '步骤2',
            agentName: 'agent2',
          },
        ],
      };

      const result = await workflowEngine.execute(workflow, 'test-input');

      expect(result.success).toBe(true);
      expect(result.stepResults).toHaveLength(2);
      expect(result.stepResults[0].success).toBe(true);
      expect(result.stepResults[1].success).toBe(true);
      // 最后一个步骤的输出
      expect(result.finalOutput).toBe('processed: processed: test-input');
    });

    it('应该支持步骤间数据传递', async () => {
      const workflowEngine = new WorkflowEngine({
        eventBus,
        memory,
        agents,
      });

      const workflow: WorkflowDefinition = {
        id: 'test-workflow',
        name: '测试工作流',
        steps: [
          {
            id: 'step1',
            name: '步骤1',
            agentName: 'agent1',
          },
          {
            id: 'step2',
            name: '步骤2',
            agentName: 'agent2',
            inputMapping: {
              previousOutput: 'steps.step1',
            },
          },
        ],
      };

      const result = await workflowEngine.execute(workflow, 'test-input');

      expect(result.success).toBe(true);
      expect(result.stepResults).toHaveLength(2);
    });

    it('应该正确处理步骤依赖关系', async () => {
      const workflowEngine = new WorkflowEngine({
        eventBus,
        memory,
        agents,
      });

      const workflow: WorkflowDefinition = {
        id: 'test-workflow',
        name: '测试工作流',
        steps: [
          {
            id: 'step1',
            name: '步骤1',
            agentName: 'agent1',
          },
          {
            id: 'step2',
            name: '步骤2',
            agentName: 'agent2',
          },
          {
            id: 'step3',
            name: '步骤3',
            agentName: 'agent3',
          },
        ],
        dependencies: [
          { from: 'step1', to: 'step2' },
          { from: 'step2', to: 'step3' },
        ],
      };

      const result = await workflowEngine.execute(workflow, 'test-input');

      expect(result.success).toBe(true);
      expect(result.stepResults).toHaveLength(3);
    });
  });

  describe('错误处理', () => {
    it('应该拒绝空ID的工作流', async () => {
      const workflowEngine = new WorkflowEngine({
        eventBus,
        memory,
        agents,
      });

      const workflow: WorkflowDefinition = {
        id: '', // 空ID
        name: '测试工作流',
        steps: [
          {
            id: 'step1',
            name: '步骤1',
            agentName: 'agent1',
          },
        ],
      };

      await expect(workflowEngine.execute(workflow, 'test-input')).rejects.toThrow('工作流ID不能为空');
    });

    it('应该拒绝空名称的工作流', async () => {
      const workflowEngine = new WorkflowEngine({
        eventBus,
        memory,
        agents,
      });

      const workflow: WorkflowDefinition = {
        id: 'test-workflow',
        name: '', // 空名称
        steps: [
          {
            id: 'step1',
            name: '步骤1',
            agentName: 'agent1',
          },
        ],
      };

      await expect(workflowEngine.execute(workflow, 'test-input')).rejects.toThrow('工作流名称不能为空');
    });

    it('应该拒绝空步骤列表的工作流', async () => {
      const workflowEngine = new WorkflowEngine({
        eventBus,
        memory,
        agents,
      });

      const workflow: WorkflowDefinition = {
        id: 'test-workflow',
        name: '测试工作流',
        steps: [], // 空步骤列表
      };

      await expect(workflowEngine.execute(workflow, 'test-input')).rejects.toThrow('工作流必须包含至少一个步骤');
    });

    it('应该拒绝步骤ID为空的工作流', async () => {
      const workflowEngine = new WorkflowEngine({
        eventBus,
        memory,
        agents,
      });

      const workflow: WorkflowDefinition = {
        id: 'test-workflow',
        name: '测试工作流',
        steps: [
          {
            id: '', // 空步骤ID
            name: '步骤1',
            agentName: 'agent1',
          },
        ],
      };

      await expect(workflowEngine.execute(workflow, 'test-input')).rejects.toThrow('步骤 0 的ID不能为空');
    });

    it('应该拒绝步骤ID重复的工作流', async () => {
      const workflowEngine = new WorkflowEngine({
        eventBus,
        memory,
        agents,
      });

      const workflow: WorkflowDefinition = {
        id: 'test-workflow',
        name: '测试工作流',
        steps: [
          {
            id: 'step1', // 重复的ID
            name: '步骤1',
            agentName: 'agent1',
          },
          {
            id: 'step1', // 重复的ID
            name: '步骤2',
            agentName: 'agent2',
          },
        ],
      };

      await expect(workflowEngine.execute(workflow, 'test-input')).rejects.toThrow('步骤ID重复: step1');
    });

    it('应该拒绝步骤agentName为空的工作流', async () => {
      const workflowEngine = new WorkflowEngine({
        eventBus,
        memory,
        agents,
      });

      const workflow: WorkflowDefinition = {
        id: 'test-workflow',
        name: '测试工作流',
        steps: [
          {
            id: 'step1',
            name: '步骤1',
            agentName: '', // 空agentName
          },
        ],
      };

      await expect(workflowEngine.execute(workflow, 'test-input')).rejects.toThrow('步骤 step1 的agentName不能为空');
    });

    it('应该拒绝引用不存在步骤的依赖关系', async () => {
      const workflowEngine = new WorkflowEngine({
        eventBus,
        memory,
        agents,
      });

      const workflow: WorkflowDefinition = {
        id: 'test-workflow',
        name: '测试工作流',
        steps: [
          {
            id: 'step1',
            name: '步骤1',
            agentName: 'agent1',
          },
        ],
        dependencies: [
          { from: 'non-existent-step', to: 'step1' }, // 不存在的步骤
        ],
      };

      await expect(workflowEngine.execute(workflow, 'test-input')).rejects.toThrow('依赖关系引用了不存在的步骤: non-existent-step');
    });

    it('应该拒绝自依赖的步骤', async () => {
      const workflowEngine = new WorkflowEngine({
        eventBus,
        memory,
        agents,
      });

      const workflow: WorkflowDefinition = {
        id: 'test-workflow',
        name: '测试工作流',
        steps: [
          {
            id: 'step1',
            name: '步骤1',
            agentName: 'agent1',
          },
        ],
        dependencies: [
          { from: 'step1', to: 'step1' }, // 自依赖
        ],
      };

      await expect(workflowEngine.execute(workflow, 'test-input')).rejects.toThrow('步骤不能依赖自己: step1');
    });

    it('应该拒绝无效的超时时间', async () => {
      const workflowEngine = new WorkflowEngine({
        eventBus,
        memory,
        agents,
      });

      const workflow: WorkflowDefinition = {
        id: 'test-workflow',
        name: '测试工作流',
        steps: [
          {
            id: 'step1',
            name: '步骤1',
            agentName: 'agent1',
            timeout: -100, // 负数超时
          },
        ],
      };

      await expect(workflowEngine.execute(workflow, 'test-input')).rejects.toThrow('步骤 step1 的超时时间必须是正数');
    });

    it('应该处理Agent不存在的错误', async () => {
      const workflowEngine = new WorkflowEngine({
        eventBus,
        memory,
        agents,
      });

      const workflow: WorkflowDefinition = {
        id: 'test-workflow',
        name: '测试工作流',
        steps: [
          {
            id: 'step1',
            name: '步骤1',
            agentName: 'non-existent-agent', // 不存在的Agent
          },
        ],
      };

      const result = await workflowEngine.execute(workflow, 'test-input');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Agent不存在');
    });

    it('应该处理步骤执行失败的错误', async () => {
      // 创建一个会失败的Agent
      class FailingAgent extends TestAgent {
        protected async act(plan: any, context: ExecutionContext): Promise<string> {
          throw new Error('执行失败');
        }
      }

      agents.set('failing-agent', new FailingAgent({
        name: 'failing-agent',
        description: '失败的Agent',
        eventBus,
        memory,
        tools,
        llm,
      }));

      const workflowEngine = new WorkflowEngine({
        eventBus,
        memory,
        agents,
      });

      const workflow: WorkflowDefinition = {
        id: 'test-workflow',
        name: '测试工作流',
        steps: [
          {
            id: 'step1',
            name: '步骤1',
            agentName: 'failing-agent',
          },
        ],
      };

      const result = await workflowEngine.execute(workflow, 'test-input');

      expect(result.success).toBe(false);
      expect(result.stepResults[0].success).toBe(false);
      expect(result.stepResults[0].error).toBe('执行失败');
    });

    it('应该处理依赖步骤失败的情况', async () => {
      class FailingAgent extends TestAgent {
        protected async act(plan: any, context: ExecutionContext): Promise<string> {
          throw new Error('执行失败');
        }
      }

      agents.set('failing-agent', new FailingAgent({
        name: 'failing-agent',
        description: '失败的Agent',
        eventBus,
        memory,
        tools,
        llm,
      }));

      const workflowEngine = new WorkflowEngine({
        eventBus,
        memory,
        agents,
      });

      const workflow: WorkflowDefinition = {
        id: 'test-workflow',
        name: '测试工作流',
        steps: [
          {
            id: 'step1',
            name: '步骤1',
            agentName: 'failing-agent',
          },
          {
            id: 'step2',
            name: '步骤2',
            agentName: 'agent1',
          },
        ],
        dependencies: [
          { from: 'step1', to: 'step2' },
        ],
      };

      const result = await workflowEngine.execute(workflow, 'test-input');

      expect(result.success).toBe(false);
      expect(result.stepResults).toHaveLength(1); // 只执行了step1
      expect(result.stepResults[0].success).toBe(false);
    });
  });

  describe('步骤结果', () => {
    it('应该正确记录步骤执行时间', async () => {
      const workflowEngine = new WorkflowEngine({
        eventBus,
        memory,
        agents,
      });

      const workflow: WorkflowDefinition = {
        id: 'test-workflow',
        name: '测试工作流',
        steps: [
          {
            id: 'step1',
            name: '步骤1',
            agentName: 'agent1',
          },
        ],
      };

      const result = await workflowEngine.execute(workflow, 'test-input');

      expect(result.success).toBe(true);
      expect(result.stepResults[0].duration).toBeGreaterThanOrEqual(0);
      expect(result.stepResults[0].startTime).toBeDefined();
      expect(result.stepResults[0].endTime).toBeDefined();
    });

    it('应该正确记录步骤输出', async () => {
      const workflowEngine = new WorkflowEngine({
        eventBus,
        memory,
        agents,
      });

      const workflow: WorkflowDefinition = {
        id: 'test-workflow',
        name: '测试工作流',
        steps: [
          {
            id: 'step1',
            name: '步骤1',
            agentName: 'agent1',
          },
        ],
      };

      const result = await workflowEngine.execute(workflow, 'test-input');

      expect(result.success).toBe(true);
      expect(result.stepResults[0].output).toBe('processed: test-input');
    });
  });
});
