import { describe, it, expect, beforeEach } from 'vitest';
import { InventionUnderstandingAgent } from '../src/InventionUnderstandingAgent.js';

describe('InventionUnderstandingAgent', () => {
  const mockLLM = {
    chat: async () => ({
      message: {
        content: JSON.stringify({
          technicalField: '人工智能技术领域',
          backgroundArt: '传统机器学习模型训练效率低，需要大量计算资源',
          technicalProblem: '如何提高机器学习模型的训练效率',
          technicalSolution: '采用分布式训练和动态批处理技术',
          beneficialEffects: '训练速度提升50%，资源利用率提高30%',
          keyFeatures: ['分布式训练架构', '动态批处理算法', '自适应学习率调整'],
          drawingDescriptions: ['图1为系统架构图', '图2为训练流程图'],
          confidence: 0.92,
        }),
      },
    }),
  };

  const mockEventBus = {
    publish: () => {},
    subscribe: () => {},
  };

  const validInput = {
    title: '一种高效机器学习训练方法',
    field: '人工智能',
    technicalDisclosure: `
本发明涉及一种高效机器学习训练方法，包括以下步骤：
1. 构建分布式训练架构
2. 实现动态批处理算法
3. 采用自适应学习率调整

该方法能够显著提高训练效率。
    `,
    drawings: ['图1: 系统整体架构', '图2: 训练流程示意图'],
    applicant: '测试公司',
    inventors: ['张三', '李四'],
  };

  describe('基础功能', () => {
    it('应该成功理解发明', async () => {
      const agent = new InventionUnderstandingAgent({
        name: 'test-invention',
        description: '测试发明理解智能体',
        eventBus: mockEventBus,
        memory: {},
        tools: {},
        llm: mockLLM,
      });

      const result = await agent.execute(validInput);

      expect(result.technicalField).toBe('人工智能技术领域');
      expect(result.backgroundArt).toContain('机器学习模型训练效率');
      expect(result.technicalProblem).toBe('如何提高机器学习模型的训练效率');
      expect(result.technicalSolution).toContain('分布式训练');
      expect(result.beneficialEffects).toContain('训练速度提升');
      expect(result.keyFeatures).toHaveLength(3);
      expect(result.drawingDescriptions).toHaveLength(2);
      expect(result.confidence).toBe(0.92);
    });

    it('应该验证输入参数', async () => {
      const agent = new InventionUnderstandingAgent({
        name: 'test-invention',
        description: '测试发明理解智能体',
        eventBus: mockEventBus,
        memory: {},
        tools: {},
        llm: mockLLM,
      });

      // 测试空标题
      await expect(
        agent.execute({
          title: '',
          field: 'AI',
          technicalDisclosure: '测试内容',
        })
      ).rejects.toThrow('发明名称不能为空');

      // 测试空技术领域
      await expect(
        agent.execute({
          title: '测试发明',
          field: '',
          technicalDisclosure: '测试内容',
        })
      ).rejects.toThrow('技术领域不能为空');

      // 测试空技术交底书
      await expect(
        agent.execute({
          title: '测试发明',
          field: 'AI',
          technicalDisclosure: '',
        })
      ).rejects.toThrow('技术交底书不能为空');
    });

    it('应该处理没有附图的输入', async () => {
      const agent = new InventionUnderstandingAgent({
        name: 'test-invention',
        description: '测试发明理解智能体',
        eventBus: mockEventBus,
        memory: {},
        tools: {},
        llm: mockLLM,
      });

      const inputWithoutDrawings = {
        title: '测试发明',
        field: 'AI',
        technicalDisclosure: '测试内容',
      };

      const result = await agent.execute(inputWithoutDrawings);

      expect(result.drawingDescriptions).toBeDefined();
      expect(Array.isArray(result.drawingDescriptions)).toBe(true);
    });
  });

  describe('LLM 调用处理', () => {
    it('应该重试失败的 LLM 调用', async () => {
      let attempts = 0;
      const flakyLLM = {
        chat: async () => {
          attempts++;
          if (attempts < 2) {
            throw new Error('Network error');
          }
          return {
            message: {
              content: JSON.stringify({
                technicalField: 'AI',
                backgroundArt: '测试',
                technicalProblem: '问题',
                technicalSolution: '方案',
                beneficialEffects: '效果',
                keyFeatures: ['特征1'],
                drawingDescriptions: [],
                confidence: 0.8,
              }),
            },
          };
        },
      };

      const agent = new InventionUnderstandingAgent({
        name: 'test-invention',
        description: '测试发明理解智能体',
        eventBus: mockEventBus,
        memory: {},
        tools: {},
        llm: flakyLLM,
      });

      const result = await agent.execute(validInput);

      expect(attempts).toBe(2); // 失败1次，成功1次
      expect(result.technicalField).toBe('AI');
    });

    it('应该在所有重试失败时使用回退输出', async () => {
      const alwaysFailingLLM = {
        chat: async () => {
          throw new Error('Always fails');
        },
      };

      const agent = new InventionUnderstandingAgent({
        name: 'test-invention',
        description: '测试发明理解智能体',
        eventBus: mockEventBus,
        memory: {},
        tools: {},
        llm: alwaysFailingLLM,
      });

      const result = await agent.execute(validInput);

      // 回退输出应该使用输入字段
      expect(result.technicalField).toBe(validInput.field);
      expect(result.technicalSolution).toBe(validInput.technicalDisclosure.substring(0, 500));
      expect(result.confidence).toBe(0.5); // 低置信度
      expect(result.keyFeatures).toEqual([]);
    });
  });

  describe('JSON 解析', () => {
    it('应该解析标准 JSON 格式', async () => {
      const jsonLLM = {
        chat: async () => ({
          message: {
            content: JSON.stringify({
              technicalField: '测试领域',
              backgroundArt: '测试背景',
              technicalProblem: '测试问题',
              technicalSolution: '测试方案',
              beneficialEffects: '测试效果',
              keyFeatures: ['特征1'],
              drawingDescriptions: [],
              confidence: 0.9,
            }),
          },
        }),
      };

      const agent = new InventionUnderstandingAgent({
        name: 'test-invention',
        description: '测试发明理解智能体',
        eventBus: mockEventBus,
        memory: {},
        tools: {},
        llm: jsonLLM,
      });

      const result = await agent.execute(validInput);

      expect(result.technicalField).toBe('测试领域');
    });

    it('应该解析 markdown 代码块中的 JSON', async () => {
      const markdownLLM = {
        chat: async () => ({
          message: {
            content: '```json\n{\n  "technicalField": "测试领域",\n  "backgroundArt": "测试背景"\n}\n```',
          },
        }),
      };

      const agent = new InventionUnderstandingAgent({
        name: 'test-invention',
        description: '测试发明理解智能体',
        eventBus: mockEventBus,
        memory: {},
        tools: {},
        llm: markdownLLM,
      });

      const result = await agent.execute(validInput);

      expect(result.technicalField).toBe('测试领域');
      expect(result.backgroundArt).toBe('测试背景');
    });

    it('应该处理无效的 JSON 响应', async () => {
      const invalidJSONLLM = {
        chat: async () => ({
          message: {
            content: '这不是有效的 JSON',
          },
        }),
      };

      const agent = new InventionUnderstandingAgent({
        name: 'test-invention',
        description: '测试发明理解智能体',
        eventBus: mockEventBus,
        memory: {},
        tools: {},
        llm: invalidJSONLLM,
      });

      const result = await agent.execute(validInput);

      // 应该使用回退输出
      expect(result.technicalField).toBe(validInput.field);
      expect(result.confidence).toBeLessThan(1.0);
    });
  });

  describe('输出标准化', () => {
    it('应该标准化缺失字段', async () => {
      const partialLLM = {
        chat: async () => ({
          message: {
            content: JSON.stringify({
              // 缺少 technicalField
              backgroundArt: '背景',
              // 缺少 technicalProblem
              technicalSolution: '方案',
              // 缺少 beneficialEffects
              keyFeatures: ['特征1'],
              drawingDescriptions: ['图1'],
              confidence: 0.85,
            }),
          },
        }),
      };

      const agent = new InventionUnderstandingAgent({
        name: 'test-invention',
        description: '测试发明理解智能体',
        eventBus: mockEventBus,
        memory: {},
        tools: {},
        llm: partialLLM,
      });

      const result = await agent.execute(validInput);

      // 缺失字段应该使用默认值或输入值
      expect(result.technicalField).toBe(validInput.field); // 使用输入值
      expect(result.technicalProblem).toBe(''); // 空字符串
      expect(result.beneficialEffects).toBe(''); // 空字符串
    });

    it('应该处理数组字段', async () => {
      const arrayLLM = {
        chat: async () => ({
          message: {
            content: JSON.stringify({
              technicalField: '测试',
              backgroundArt: '背景',
              technicalProblem: '问题',
              technicalSolution: '方案',
              beneficialEffects: '效果',
              keyFeatures: ['特征1', '特征2', '特征3'],
              drawingDescriptions: ['图1', '图2'],
              confidence: 0.88,
            }),
          },
        }),
      };

      const agent = new InventionUnderstandingAgent({
        name: 'test-invention',
        description: '测试发明理解智能体',
        eventBus: mockEventBus,
        memory: {},
        tools: {},
        llm: arrayLLM,
      });

      const result = await agent.execute(validInput);

      expect(result.keyFeatures).toEqual(['特征1', '特征2', '特征3']);
      expect(result.drawingDescriptions).toEqual(['图1', '图2']);
    });

    it('应该处理非数组的 confidence 字段', async () => {
      const invalidConfidenceLLM = {
        chat: async () => ({
          message: {
            content: JSON.stringify({
              technicalField: '测试',
              backgroundArt: '背景',
              technicalProblem: '问题',
              technicalSolution: '方案',
              beneficialEffects: '效果',
              keyFeatures: [],
              drawingDescriptions: [],
              confidence: 'invalid', // 不是数字
            }),
          },
        }),
      };

      const agent = new InventionUnderstandingAgent({
        name: 'test-invention',
        description: '测试发明理解智能体',
        eventBus: mockEventBus,
        memory: {},
        tools: {},
        llm: invalidConfidenceLLM,
      });

      const result = await agent.execute(validInput);

      // 应该使用默认值 0.8
      expect(result.confidence).toBe(0.8);
    });
  });

  describe('边界情况', () => {
    it('应该处理超长的技术交底书', async () => {
      const longDisclosure = '内容'.repeat(10000);
      const longLLM = {
        chat: async () => ({
          message: {
            content: JSON.stringify({
              technicalField: '测试',
              backgroundArt: '背景',
              technicalProblem: '问题',
              technicalSolution: '方案',
              beneficialEffects: '效果',
              keyFeatures: [],
              drawingDescriptions: [],
              confidence: 0.9,
            }),
          },
        }),
      };

      const agent = new InventionUnderstandingAgent({
        name: 'test-invention',
        description: '测试发明理解智能体',
        eventBus: mockEventBus,
        memory: {},
        tools: {},
        llm: longLLM,
      });

      const input = {
        ...validInput,
        technicalDisclosure: longDisclosure,
      };

      const result = await agent.execute(input);

      // 应该成功处理，不崩溃
      expect(result.technicalField).toBe('测试');
    });

    it('应该处理特殊字符', async () => {
      const specialCharsLLM = {
        chat: async () => ({
          message: {
            content: JSON.stringify({
              technicalField: '测试领域（AI/ML）',
              backgroundArt: '包含"引号"和\'单引号\'',
              technicalProblem: '问题？',
              technicalSolution: '方案：包含\n换行符',
              beneficialEffects: '效果≥90%',
              keyFeatures: ['特征1（重要）', '特征2#标签'],
              drawingDescriptions: [],
              confidence: 0.95,
            }),
          },
        }),
      };

      const agent = new InventionUnderstandingAgent({
        name: 'test-invention',
        description: '测试发明理解智能体',
        eventBus: mockEventBus,
        memory: {},
        tools: {},
        llm: specialCharsLLM,
      });

      const result = await agent.execute(validInput);

      expect(result.technicalField).toContain('AI/ML');
      expect(result.backgroundArt).toContain('引号');
      expect(result.beneficialEffects).toContain('≥90%');
    });

    it('应该处理空的关键特征数组', async () => {
      const emptyFeaturesLLM = {
        chat: async () => ({
          message: {
            content: JSON.stringify({
              technicalField: '测试',
              backgroundArt: '背景',
              technicalProblem: '问题',
              technicalSolution: '方案',
              beneficialEffects: '效果',
              keyFeatures: [],
              drawingDescriptions: [],
              confidence: 0.7,
            }),
          },
        }),
      };

      const agent = new InventionUnderstandingAgent({
        name: 'test-invention',
        description: '测试发明理解智能体',
        eventBus: mockEventBus,
        memory: {},
        tools: {},
        llm: emptyFeaturesLLM,
      });

      const result = await agent.execute(validInput);

      expect(result.keyFeatures).toEqual([]);
      expect(result.confidence).toBe(0.7);
    });
  });
});
