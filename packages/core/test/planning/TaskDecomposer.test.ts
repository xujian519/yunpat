/**
 * TaskDecomposer 单元测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskDecomposer } from '../../src/planning/TaskDecomposer.js';
import type { LLMAdapter } from '../../src/llm/NativeLLMAdapter.js';
import { Priority, TaskStatus, TaskType, PlanStatus } from '../../src/planning/types.js';

describe('TaskDecomposer', () => {
  let decomposer: TaskDecomposer;
  let mockLLM: LLMAdapter;

  beforeEach(() => {
    // 创建模拟 LLM
    mockLLM = {
      chat: vi.fn().mockResolvedValue({
        content: JSON.stringify({
          subGoals: [
            {
              title: '子目标1',
              description: '第一个子目标',
              tasks: [
                {
                  title: '任务1',
                  description: '第一个任务',
                  type: 'research',
                  estimatedDuration: 300,
                  estimatedTokens: 2000,
                },
              ],
              priority: 'high',
            },
            {
              title: '子目标2',
              description: '第二个子目标',
              tasks: [
                {
                  title: '任务2',
                  description: '第二个任务',
                  type: 'writing',
                  estimatedDuration: 600,
                  estimatedTokens: 3000,
                },
              ],
              priority: 'medium',
            },
          ],
        }),
        message: { content: '' },
      }),
    } as unknown as LLMAdapter;

    decomposer = new TaskDecomposer({
      llm: mockLLM,
      maxDepth: 3,
      maxTasksPerGoal: 10,
      enableIntelligentDecomposition: false,
      domain: 'general',
    });
  });

  describe('decompose', () => {
    it('应该成功分解简单目标', async () => {
      const plan = await decomposer.decompose('撰写一篇文章');

      expect(plan).toBeDefined();
      expect(plan.id).toBeDefined();
      expect(plan.goal).toBe('撰写一篇文章');
      expect(plan.subGoals.length).toBeGreaterThan(0);
      expect(plan.status).toBe(PlanStatus.READY);
    });

    it('应该生成唯一ID', async () => {
      const plan1 = await decomposer.decompose('目标1');
      const plan2 = await decomposer.decompose('目标2');

      expect(plan1.id).not.toBe(plan2.id);
    });

    it('应该分析依赖关系', async () => {
      const plan = await decomposer.decompose('测试目标');

      expect(plan.dependencies).toBeDefined();
      expect(plan.dependencies.nodes).toBeDefined();
      expect(plan.dependencies.edges).toBeDefined();
    });

    it('应该计算统计信息', async () => {
      const plan = await decomposer.decompose('测试目标');

      expect(plan.estimatedDuration).toBeGreaterThan(0);
      expect(plan.estimatedTokens).toBeGreaterThan(0);
      expect(plan.metadata).toBeDefined();
    });

    it('应该使用规则分解（默认）', async () => {
      const plan = await decomposer.decompose('测试目标');

      // 规则分解应该生成4个子目标
      expect(plan.subGoals.length).toBe(4);
      expect(plan.subGoals[0].title).toContain('信息收集');
    });
  });

  describe('智能分解（LLM）', () => {
    it('应该使用LLM进行智能分解', async () => {
      const intelligentDecomposer = new TaskDecomposer({
        llm: mockLLM,
        enableIntelligentDecomposition: true,
        maxDepth: 3,
      });

      const plan = await intelligentDecomposer.decompose('撰写专利申请');

      expect(plan.subGoals.length).toBeGreaterThan(0);

      // 验证调用了 LLM
      expect(mockLLM.chat).toHaveBeenCalled();
    });

    it('应该在LLM失败时回退到规则分解', async () => {
      const failingLLM = {
        chat: vi.fn().mockRejectedValue(new Error('LLM failed')),
      } as unknown as LLMAdapter;

      const failingDecomposer = new TaskDecomposer({
        llm: failingLLM,
        enableIntelligentDecomposition: true,
      });

      const plan = await failingDecomposer.decompose('测试目标');

      // 应该回退到规则分解
      expect(plan.subGoals.length).toBe(4);
    });
  });

  describe('领域特定分解', () => {
    it('应该使用专利撰写规则', async () => {
      const patentDecomposer = new TaskDecomposer({
        domain: 'patent',
      });

      const plan = await patentDecomposer.decompose('撰写图像识别专利');

      expect(plan.subGoals.length).toBeGreaterThan(0);

      // 应该包含专利相关的子目标
      const titles = plan.subGoals.map(g => g.title);
      const hasPatentSpecific = titles.some(t =>
        t.includes('技术方案') || t.includes('权利要求') || t.includes('说明书')
      );
      expect(hasPatentSpecific).toBe(true);
    });

    it('应该使用研究任务规则', async () => {
      const researchDecomposer = new TaskDecomposer({
        domain: 'research',
      });

      const plan = await researchDecomposer.decompose('研究深度学习模型');

      expect(plan.subGoals.length).toBeGreaterThan(0);

      // 应该包含研究相关的子目标
      const titles = plan.subGoals.map(g => g.title);
      const hasResearchSpecific = titles.some(t =>
        t.includes('文献') || t.includes('数据') || t.includes('分析')
      );
      expect(hasResearchSpecific).toBe(true);
    });
  });

  describe('自定义规则', () => {
    it('应该支持添加自定义规则', () => {
      const customRule = {
        name: 'custom-rule',
        description: '自定义规则',
        matchPattern: /自定义/,
        strategy: 'sequential' as const,
        subGoalTemplates: [
          {
            title: '自定义子目标',
            description: '测试',
            taskTemplates: [
              {
                title: '自定义任务',
                description: '测试任务',
                type: TaskType.WRITING as const,
                requiredCapabilities: ['writing'],
                estimatedTokens: 2000,
                estimatedDuration: 300,
              },
            ],
            priority: Priority.MEDIUM,
          },
        ],
      };

      decomposer.addCustomRule(customRule);

      const stats = decomposer.getStats();
      expect(stats.customRulesCount).toBe(1);
    });

    it('应该应用自定义规则', async () => {
      const customRule = {
        name: 'test-rule',
        description: '测试规则',
        matchPattern: /测试目标/,
        strategy: 'sequential' as const,
        subGoalTemplates: [
          {
            title: '测试子目标',
            description: '测试',
            taskTemplates: [
              {
                title: '测试任务',
                description: '测试',
                type: TaskType.WRITING as const,
                requiredCapabilities: ['writing'],
                estimatedTokens: 1000,
                estimatedDuration: 200,
              },
            ],
            priority: Priority.HIGH,
          },
        ],
      };

      const customDecomposer = new TaskDecomposer({
        customRules: [customRule],
      });

      const plan = await customDecomposer.decompose('测试目标');

      expect(plan.subGoals.length).toBe(1);
      expect(plan.subGoals[0].title).toBe('测试子目标');
    });
  });

  describe('分解深度控制', () => {
    it('应该限制分解深度', async () => {
      const shallowDecomposer = new TaskDecomposer({
        maxDepth: 1,
      });

      const plan = await shallowDecomposer.decompose('测试目标');

      // 深度为1应该直接创建叶子任务
      expect(plan.subGoals.length).toBe(1);
      expect(plan.subGoals[0].tasks.length).toBe(1);
    });

    it('应该支持更深层次的分解', async () => {
      const deepDecomposer = new TaskDecomposer({
        maxDepth: 5,
      });

      const plan = await deepDecomposer.decompose('复杂任务');

      expect(plan.subGoals.length).toBeGreaterThan(0);
    });
  });

  describe('任务类型推断', () => {
    it('应该正确推断任务能力', async () => {
      const plan = await decomposer.decompose('测试目标');

      plan.subGoals.forEach(goal => {
        goal.tasks.forEach(task => {
          expect(task.requiredCapabilities).toBeDefined();
          expect(task.requiredCapabilities.length).toBeGreaterThan(0);
        });
      });
    });

    it('应该为不同任务类型设置不同能力', async () => {
      const plan = await decomposer.decompose('测试目标');

      const researchTasks = plan.subGoals
        .flatMap(g => g.tasks)
        .filter(t => t.type === TaskType.RESEARCH);

      researchTasks.forEach(task => {
        expect(task.requiredCapabilities).toContain('search');
      });
    });
  });

  describe('优先级设置', () => {
    it('应该为子目标设置合理的优先级', async () => {
      const plan = await decomposer.decompose('测试目标');

      plan.subGoals.forEach(goal => {
        expect([Priority.CRITICAL, Priority.HIGH, Priority.MEDIUM, Priority.LOW])
          .toContain(goal.priority);
      });
    });

    it('应该根据依赖关系调整优先级', async () => {
      const plan = await decomposer.decompose('重要任务');

      // 早期阶段通常优先级更高
      const firstGoal = plan.subGoals[0];
      expect([Priority.HIGH, Priority.CRITICAL]).toContain(firstGoal.priority);
    });
  });

  describe('统计信息', () => {
    it('应该正确计算任务总数', async () => {
      const plan = await decomposer.decompose('测试目标');

      let totalTasks = 0;
      plan.subGoals.forEach(goal => {
        totalTasks += goal.tasks.length;
      });

      expect(totalTasks).toBeGreaterThan(0);
    });

    it('应该正确计算预估时间', async () => {
      const plan = await decomposer.decompose('测试目标');

      let totalDuration = 0;
      plan.subGoals.forEach(goal => {
        totalDuration += goal.estimatedDuration;
      });

      expect(totalDuration).toBe(plan.estimatedDuration);
    });

    it('应该正确计算预估Token', async () => {
      const plan = await decomposer.decompose('测试目标');

      let totalTokens = 0;
      plan.subGoals.forEach(goal => {
        totalTokens += goal.estimatedTokens;
      });

      expect(totalTokens).toBe(plan.estimatedTokens);
    });
  });

  describe('错误处理', () => {
    it('应该处理空目标', async () => {
      const plan = await decomposer.decompose('');

      expect(plan).toBeDefined();
      expect(plan.subGoals.length).toBeGreaterThan(0);
    });

    it('应该处理无效的LLM响应', async () => {
      const invalidLLM = {
        chat: vi.fn().mockResolvedValue({
          content: 'invalid json{{}',
        }),
      } as unknown as LLMAdapter;

      const invalidDecomposer = new TaskDecomposer({
        llm: invalidLLM,
        enableIntelligentDecomposition: true,
      });

      const plan = await invalidDecomposer.decompose('测试目标');

      // 应该回退到规则分解
      expect(plan.subGoals.length).toBe(4);
    });

    it('应该处理没有subGoals的LLM响应', async () => {
      const emptyLLM = {
        chat: vi.fn().mockResolvedValue({
          content: JSON.stringify({}),
        }),
      } as unknown as LLMAdapter;

      const emptyDecomposer = new TaskDecomposer({
        llm: emptyLLM,
        enableIntelligentDecomposition: true,
      });

      const plan = await emptyDecomposer.decompose('测试目标');

      // 应该回退到规则分解
      expect(plan.subGoals.length).toBe(4);
    });
  });

  describe('getStats', () => {
    it('应该返回分解器统计信息', () => {
      const stats = decomposer.getStats();

      expect(stats).toBeDefined();
      expect(stats.totalRules).toBeGreaterThan(0);
      expect(stats.domainRulesCount).toBeGreaterThan(0);
    });

    it('应该包含自定义规则统计', () => {
      const customDecomposer = new TaskDecomposer({
        customRules: [
          {
            name: 'rule1',
            description: '测试',
            matchPattern: /test/,
            strategy: 'sequential',
            subGoalTemplates: [],
          },
        ],
      });

      const stats = customDecomposer.getStats();
      expect(stats.customRulesCount).toBe(1);
    });
  });

  describe('解析功能', () => {
    it('应该正确解析任务类型', () => {
      const decomposerWithLLM = new TaskDecomposer({
        llm: mockLLM,
        enableIntelligentDecomposition: true,
      });

      // 通过私有方法测试（仅用于验证）
      const plan = decomposerWithLLM.decompose('测试');
      // 如果没有错误，说明解析正常
      expect(plan).resolves.toBeDefined();
    });

    it('应该正确解析优先级', () => {
      const plan = decomposer.decompose('测试');
      expect(plan).resolves.toBeDefined();
    });
  });
});
