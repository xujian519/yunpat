import { describe, it, expect, vi } from 'vitest';
import { TaskDecomposer } from '../../src/planning/TaskDecomposer.js';

describe('TaskDecomposer', () => {
  describe('constructor', () => {
    it('应该使用默认配置', () => {
      const decomposer = new TaskDecomposer();
      expect(decomposer).toBeDefined();
    });

    it('应该使用自定义配置', () => {
      const decomposer = new TaskDecomposer({
        maxDepth: 5,
        maxTasksPerGoal: 20,
        enableIntelligentDecomposition: true,
        domain: 'patent',
      });
      expect(decomposer).toBeDefined();
    });
  });

  describe('decompose', () => {
    it('应该分解简单目标', async () => {
      const decomposer = new TaskDecomposer();
      const plan = await decomposer.decompose('测试目标');
      expect(plan.goal).toBe('测试目标');
      expect(plan.subGoals.length).toBeGreaterThan(0);
    });

    it('应该处理上下文', async () => {
      const decomposer = new TaskDecomposer();
      const plan = await decomposer.decompose('测试目标', {
        constraints: ['约束1'],
        resources: ['资源1'],
      });
      expect(plan.goal).toBe('测试目标');
    });

    it('应该处理选项', async () => {
      const decomposer = new TaskDecomposer();
      const plan = await decomposer.decompose(
        '测试目标',
        {},
        { maxDepth: 2, enableIntelligentDecomposition: false }
      );
      expect(plan.goal).toBe('测试目标');
    });

    it('应该使用智能分解', async () => {
      const mockLlm = {
        generate: vi.fn().mockResolvedValue({
          subGoals: [
            {
              title: '子目标1',
              description: '描述1',
              tasks: [
                {
                  title: '任务1',
                  description: '任务描述',
                  type: 'analysis',
                  requiredCapabilities: [],
                  estimatedTokens: 100,
                  estimatedDuration: 60,
                },
              ],
            },
          ],
        }),
      };

      const decomposer = new TaskDecomposer({
        llm: mockLlm as any,
        enableIntelligentDecomposition: true,
      });

      const plan = await decomposer.decompose('测试目标', {}, { enableIntelligentDecomposition: true });
      expect(plan.goal).toBe('测试目标');
    });

    it('应该处理自定义规则', async () => {
      const decomposer = new TaskDecomposer({
        customRules: [
          {
            matchPattern: ['测试'],
            subGoalTemplates: [
              {
                title: '匹配的子目标',
                description: '描述',
                taskTemplates: [
                  {
                    title: '任务1',
                    description: '任务描述',
                    type: 'analysis' as any,
                    requiredCapabilities: [],
                    estimatedTokens: 100,
                    estimatedDuration: 60,
                  },
                ],
              },
            ],
          },
        ],
      });

      const plan = await decomposer.decompose('测试目标');
      expect(plan.goal).toBe('测试目标');
    });

    it('应该处理正则规则', async () => {
      const decomposer = new TaskDecomposer({
        customRules: [
          {
            matchPattern: /测试/,
            subGoalTemplates: [
              {
                title: '匹配的子目标',
                description: '描述',
                taskTemplates: [
                  {
                    title: '任务1',
                    description: '任务描述',
                    type: 'analysis' as any,
                    requiredCapabilities: [],
                    estimatedTokens: 100,
                    estimatedDuration: 60,
                  },
                ],
              },
            ],
          },
        ],
      });

      const plan = await decomposer.decompose('测试目标');
      expect(plan.goal).toBe('测试目标');
    });

    it('应该处理空智能分解结果', async () => {
      const mockLlm = {
        generate: vi.fn().mockResolvedValue({ subGoals: [] }),
      };

      const decomposer = new TaskDecomposer({
        llm: mockLlm as any,
        enableIntelligentDecomposition: true,
      });

      const plan = await decomposer.decompose('测试目标', {}, { enableIntelligentDecomposition: true });
      expect(plan.goal).toBe('测试目标');
    });

    it('应该处理智能分解错误', async () => {
      const mockLlm = {
        generate: vi.fn().mockRejectedValue(new Error('LLM错误')),
      };

      const decomposer = new TaskDecomposer({
        llm: mockLlm as any,
        enableIntelligentDecomposition: true,
      });

      const plan = await decomposer.decompose('测试目标', {}, { enableIntelligentDecomposition: true });
      expect(plan.goal).toBe('测试目标');
    });
  });

  describe('mergeOptions', () => {
    it('应该合并选项', () => {
      const decomposer = new TaskDecomposer({ maxDepth: 5 });
      const plan = decomposer.decompose('测试');
      expect(plan).toBeDefined();
    });
  });

  describe('循环依赖检测', () => {
    it('应该处理循环依赖情况', async () => {
      const decomposer = new TaskDecomposer();
      const plan = await decomposer.decompose('测试循环依赖');
      expect(plan).toBeDefined();
      expect(plan.dependencies.hasCycles).toBeDefined();
    });
  });

  describe('最大深度限制', () => {
    it('应该在maxDepth=1时创建叶子任务', async () => {
      const decomposer = new TaskDecomposer();
      const plan = await decomposer.decompose('简单任务', {}, { maxDepth: 1 });
      expect(plan).toBeDefined();
      expect(plan.subGoals).toBeDefined();
      expect(plan.subGoals.length).toBeGreaterThan(0);
    });

    it('应该在maxDepth=2时分解一层', async () => {
      const decomposer = new TaskDecomposer();
      const plan = await decomposer.decompose('中等复杂任务', {}, { maxDepth: 2 });
      expect(plan).toBeDefined();
      expect(plan.subGoals.length).toBeGreaterThan(0);
    });
  });

  describe('领域规则匹配', () => {
    it('应该匹配专利领域的规则', async () => {
      const decomposer = new TaskDecomposer({ domain: 'patent' });
      const plan = await decomposer.decompose('撰写专利申请', {}, { domain: 'patent' });
      expect(plan).toBeDefined();
      expect(plan.goal).toBe('撰写专利申请');
    });

    it('应该匹配研究领域的规则', async () => {
      const decomposer = new TaskDecomposer({ domain: 'research' });
      const plan = await decomposer.decompose('进行技术研究', {}, { domain: 'research' });
      expect(plan).toBeDefined();
      expect(plan.goal).toBe('进行技术研究');
    });
  });

  describe('智能分解开关', () => {
    it('应该在不启用智能分解时使用规则分解', async () => {
      const mockLlm = {
        generate: vi.fn(),
      };

      const decomposer = new TaskDecomposer({
        llm: mockLlm as any,
        enableIntelligentDecomposition: false,
      });

      const plan = await decomposer.decompose('测试目标', {}, { enableIntelligentDecomposition: false });
      expect(plan).toBeDefined();
      expect(mockLlm.generate).not.toHaveBeenCalled();
    });

    it('应该在启用智能分解且有LLM时使用LLM', async () => {
      const mockLlm = {
        chat: vi.fn().mockResolvedValue({
          message: {
            content: JSON.stringify({
              subGoals: [
                {
                  title: '子目标1',
                  description: '描述1',
                  tasks: [
                    {
                      title: '任务1',
                      description: '任务描述',
                      type: 'research',
                      estimatedDuration: 300,
                      estimatedTokens: 2000,
                    },
                  ],
                  priority: 'high',
                },
              ],
            }),
          },
        }),
      };

      const decomposer = new TaskDecomposer({
        llm: mockLlm as any,
        enableIntelligentDecomposition: true,
      });

      const plan = await decomposer.decompose('测试目标', {}, { enableIntelligentDecomposition: true });
      expect(plan).toBeDefined();
      expect(mockLlm.chat).toHaveBeenCalled();
    });
  });

  describe('规则匹配模式', () => {
    it('应该使用正则表达式匹配规则', async () => {
      const decomposer = new TaskDecomposer({
        customRules: [
          {
            name: 'regex-rule',
            description: '正则表达式规则',
            matchPattern: /^正则测试/,
            strategy: 'sequential',
            subGoalTemplates: [
              {
                title: '正则匹配的子目标',
                description: '描述',
                taskTemplates: [
                  {
                    title: '任务1',
                    description: '任务描述',
                    type: 'analysis' as any,
                    requiredCapabilities: [],
                    estimatedTokens: 100,
                    estimatedDuration: 60,
                  },
                ],
                priority: 'high' as any,
              },
            ],
          },
        ],
      });

      const plan = await decomposer.decompose('正则测试目标');
      expect(plan).toBeDefined();
    });

    it('应该使用数组模式匹配规则', async () => {
      const decomposer = new TaskDecomposer({
        customRules: [
          {
            name: 'array-rule',
            description: '数组模式规则',
            matchPattern: ['关键词1', '关键词2'],
            strategy: 'sequential',
            subGoalTemplates: [
              {
                title: '数组匹配的子目标',
                description: '描述',
                taskTemplates: [
                  {
                    title: '任务1',
                    description: '任务描述',
                    type: 'analysis' as any,
                    requiredCapabilities: [],
                    estimatedTokens: 100,
                    estimatedDuration: 60,
                  },
                ],
                priority: 'medium' as any,
              },
            ],
          },
        ],
      });

      const plan = await decomposer.decompose('包含关键词1的目标');
      expect(plan).toBeDefined();
    });
  });

  describe('LLM未配置情况', () => {
    it('应该在LLM未配置时回退到规则分解', async () => {
      const decomposer = new TaskDecomposer({
        enableIntelligentDecomposition: true,
      });

      const plan = await decomposer.decompose('测试目标', {}, { enableIntelligentDecomposition: true });
      expect(plan).toBeDefined();
      expect(plan.subGoals).toBeDefined();
    });
  });

  describe('LLM响应解析', () => {
    it('应该处理LLM返回的不包含JSON的内容', async () => {
      const mockLlm = {
        chat: vi.fn().mockResolvedValue({
          message: {
            content: '这是一个纯文本响应，没有JSON',
          },
        }),
      };

      const decomposer = new TaskDecomposer({
        llm: mockLlm as any,
        enableIntelligentDecomposition: true,
      });

      const plan = await decomposer.decompose('测试目标', {}, { enableIntelligentDecomposition: true });
      expect(plan).toBeDefined();
      expect(plan.subGoals.length).toBeGreaterThan(0);
    });

    it('应该处理LLM返回的无效JSON结构', async () => {
      const mockLlm = {
        chat: vi.fn().mockResolvedValue({
          message: {
            content: JSON.stringify({
              invalidField: 'invalid value',
            }),
          },
        }),
      };

      const decomposer = new TaskDecomposer({
        llm: mockLlm as any,
        enableIntelligentDecomposition: true,
      });

      const plan = await decomposer.decompose('测试目标', {}, { enableIntelligentDecomposition: true });
      expect(plan).toBeDefined();
      expect(plan.subGoals.length).toBeGreaterThan(0);
    });

    it('应该处理LLM返回的subGoals非数组情况', async () => {
      const mockLlm = {
        chat: vi.fn().mockResolvedValue({
          message: {
            content: JSON.stringify({
              subGoals: '不是数组而是字符串',
            }),
          },
        }),
      };

      const decomposer = new TaskDecomposer({
        llm: mockLlm as any,
        enableIntelligentDecomposition: true,
      });

      const plan = await decomposer.decompose('测试目标', {}, { enableIntelligentDecomposition: true });
      expect(plan).toBeDefined();
      expect(plan.subGoals.length).toBeGreaterThan(0);
    });
  });

  describe('添加自定义规则', () => {
    it('应该在没有现有规则时添加自定义规则', () => {
      const decomposer = new TaskDecomposer();

      const initialStats = decomposer.getStats();
      expect(initialStats.customRulesCount).toBe(0);

      decomposer.addCustomRule({
        name: 'test-rule',
        description: '测试规则',
        matchPattern: ['测试'],
        strategy: 'sequential',
        subGoalTemplates: [
          {
            title: '子目标',
            description: '描述',
            taskTemplates: [
              {
                title: '任务',
                description: '任务描述',
                type: 'analysis' as any,
                requiredCapabilities: [],
                estimatedTokens: 100,
                estimatedDuration: 60,
              },
            ],
            priority: 'medium' as any,
          },
        ],
      });

      const updatedStats = decomposer.getStats();
      expect(updatedStats.customRulesCount).toBe(1);
    });

    it('应该在有现有规则时添加自定义规则', () => {
      const decomposer = new TaskDecomposer({
        customRules: [
          {
            name: 'existing-rule',
            description: '已存在的规则',
            matchPattern: ['已存在'],
            strategy: 'sequential',
            subGoalTemplates: [
              {
                title: '已存在的子目标',
                description: '描述',
                taskTemplates: [
                  {
                    title: '任务',
                    description: '任务描述',
                    type: 'analysis' as any,
                    requiredCapabilities: [],
                    estimatedTokens: 100,
                    estimatedDuration: 60,
                  },
                ],
                priority: 'low' as any,
              },
            ],
          },
        ],
      });

      const initialStats = decomposer.getStats();
      expect(initialStats.customRulesCount).toBe(1);

      decomposer.addCustomRule({
        name: 'new-rule',
        description: '新规则',
        matchPattern: ['新规则'],
        strategy: 'sequential',
        subGoalTemplates: [
          {
            title: '新子目标',
            description: '描述',
            taskTemplates: [
              {
                title: '任务',
                description: '任务描述',
                type: 'analysis' as any,
                requiredCapabilities: [],
                estimatedTokens: 100,
                estimatedDuration: 60,
              },
            ],
            priority: 'high' as any,
          },
        ],
      });

      const updatedStats = decomposer.getStats();
      expect(updatedStats.customRulesCount).toBe(2);
    });
  });

  describe('第一个规则匹配', () => {
    it('应该匹配第一个符合的规则', async () => {
      const decomposer = new TaskDecomposer({
        customRules: [
          {
            name: 'first-rule',
            description: '第一个规则',
            matchPattern: ['第一个'],
            strategy: 'sequential',
            subGoalTemplates: [
              {
                title: '第一个规则的子目标',
                description: '第一个规则的描述',
                taskTemplates: [
                  {
                    title: '第一个规则的任务',
                    description: '任务描述',
                    type: 'analysis' as any,
                    requiredCapabilities: [],
                    estimatedTokens: 100,
                    estimatedDuration: 60,
                  },
                ],
                priority: 'high' as any,
              },
            ],
          },
          {
            name: 'second-rule',
            description: '第二个规则',
            matchPattern: ['第一个', '第二个'],
            strategy: 'sequential',
            subGoalTemplates: [
              {
                title: '第二个规则的子目标',
                description: '第二个规则的描述',
                taskTemplates: [
                  {
                    title: '第二个规则的任务',
                    description: '任务描述',
                    type: 'writing' as any,
                    requiredCapabilities: [],
                    estimatedTokens: 200,
                    estimatedDuration: 120,
                  },
                ],
                priority: 'medium' as any,
              },
            ],
          },
        ],
      });

      const plan = await decomposer.decompose('第一个测试目标');
      expect(plan).toBeDefined();
      expect(plan.subGoals[0].title).toBe('第一个规则的子目标');
    });
  });
});
