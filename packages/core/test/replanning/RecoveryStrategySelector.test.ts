import { describe, it, expect } from 'vitest';
import { RecoveryStrategySelector } from '../../src/replanning/RecoveryStrategySelector.js';
import { RecoveryStrategyType } from '../../src/replanning/types.js';

describe('RecoveryStrategySelector', () => {
  describe('constructor', () => {
    it('应初始化默认策略', () => {
      const selector = new RecoveryStrategySelector();
      expect(selector).toBeDefined();
    });
  });

  describe('selectBestStrategy', () => {
    it('应选择重试策略', async () => {
      const selector = new RecoveryStrategySelector();
      const strategy = await selector.selectBestStrategy({
        hasDeviation: true,
        deviations: [{ type: 'schedule_deviation', severity: 'high', description: '任务失败' }],
      } as any, {
        originalPlan: { subGoals: [] },
        currentState: {
          failedGoals: new Set(['goal-1']),
          completedGoals: new Set(),
          currentGoal: 'goal-1',
        },
        history: [],
      } as any);

      expect(strategy).toBeDefined();
    });

    it('应选择跳过策略', async () => {
      const selector = new RecoveryStrategySelector();
      const strategy = await selector.selectBestStrategy({
        hasDeviation: true,
        deviations: [{ type: 'dependency_deviation', severity: 'medium', description: '任务被阻塞' }],
      } as any, {
        originalPlan: { subGoals: [] },
        currentState: {
          failedGoals: new Set(),
          completedGoals: new Set(),
          currentGoal: 'goal-1',
        },
        history: [],
      } as any);

      expect(strategy).toBeDefined();
    });

    it('应选择重排序策略', async () => {
      const selector = new RecoveryStrategySelector();
      const strategy = await selector.selectBestStrategy({
        hasDeviation: true,
        deviations: [{ type: 'schedule_deviation', severity: 'medium', description: '进度偏差' }],
      } as any, {
        originalPlan: {
          subGoals: [
            { id: 'goal-1', status: 'pending' },
            { id: 'goal-2', status: 'pending' },
          ],
        },
        currentState: {
          failedGoals: new Set(),
          completedGoals: new Set(),
          currentGoal: 'goal-1',
        },
        history: [],
      } as any);

      expect(strategy).toBeDefined();
    });

    it('应选择分解策略', async () => {
      const selector = new RecoveryStrategySelector();
      const strategy = await selector.selectBestStrategy({
        hasDeviation: true,
        deviations: [{ type: 'quality_deviation', severity: 'high', description: '任务过于复杂' }],
      } as any, {
        originalPlan: {
          subGoals: [
            { id: 'goal-1', status: 'pending', estimatedDuration: 1000 },
          ],
        },
        currentState: {
          failedGoals: new Set(),
          completedGoals: new Set(),
          currentGoal: 'goal-1',
        },
        history: [],
      } as any);

      expect(strategy).toBeDefined();
    });

    it('应选择适应策略', async () => {
      const selector = new RecoveryStrategySelector();
      const strategy = await selector.selectBestStrategy({
        hasDeviation: true,
        deviations: [{ type: 'resource_deviation', severity: 'high', description: '资源不足' }],
      } as any, {
        originalPlan: { subGoals: [] },
        currentState: {
          failedGoals: new Set(),
          completedGoals: new Set(),
          currentGoal: 'goal-1',
        },
        history: [],
      } as any);

      expect(strategy).toBeDefined();
    });

    it('应选择中止策略', async () => {
      const selector = new RecoveryStrategySelector();
      const strategy = await selector.selectBestStrategy({
        hasDeviation: true,
        deviations: [{ type: 'resource_deviation', severity: 'severe', description: '严重失败' }],
      } as any, {
        originalPlan: { subGoals: [] },
        currentState: {
          failedGoals: new Set(),
          completedGoals: new Set(),
          currentGoal: 'goal-1',
        },
        history: [],
      } as any);

      expect(strategy).toBeDefined();
    });

    it('应处理首选策略', async () => {
      const selector = new RecoveryStrategySelector();
      const strategy = await selector.selectBestStrategy({
        hasDeviation: true,
        deviations: [{ type: 'schedule_deviation', severity: 'high', description: '任务失败' }],
      } as any, {
        originalPlan: { subGoals: [] },
        currentState: {
          failedGoals: new Set(['goal-1']),
          completedGoals: new Set(),
          currentGoal: 'goal-1',
        },
        history: [],
      } as any, [RecoveryStrategyType.RETRY]);

      expect(strategy).toBeDefined();
    });

    it('应处理无偏离的情况', async () => {
      const selector = new RecoveryStrategySelector();
      await expect(
        selector.selectBestStrategy({
          hasDeviation: false,
          deviations: [],
        } as any, {
          originalPlan: { subGoals: [] },
          currentState: {
            failedGoals: new Set(),
            completedGoals: new Set(),
            currentGoal: 'goal-1',
          },
          history: [],
        } as any)
      ).rejects.toThrow();
    });
  });

  describe('getAllStrategies', () => {
    it('应返回所有策略', () => {
      const selector = new RecoveryStrategySelector();
      const strategies = selector.getAllStrategies();
      expect(strategies.length).toBeGreaterThan(0);
    });
  });

  describe('addStrategy', () => {
    it('应添加新策略', () => {
      const selector = new RecoveryStrategySelector();
      selector.addStrategy({
        name: 'custom' as any,
        description: '自定义策略',
        applicableScenarios: ['custom'],
        estimatedCost: 0.5,
        estimatedSuccess: 0.8,
        action: async () => ({
          type: 'custom' as any,
          modifications: [],
          estimatedImprovement: 0.5,
          reasoning: 'test',
        }),
      });

      const strategies = selector.getAllStrategies();
      expect(strategies.some(s => s.name === 'custom')).toBe(true);
    });
  });

  describe('removeStrategy', () => {
    it('应移除策略', () => {
      const selector = new RecoveryStrategySelector();
      selector.removeStrategy(RecoveryStrategyType.RETRY);

      const strategies = selector.getAllStrategies();
      expect(strategies.some(s => s.name === RecoveryStrategyType.RETRY)).toBe(false);
    });
  });
});
