/**
 * DynamicReplanner 单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DynamicReplanner } from '../../src/replanning/index.js';
import { Priority, TaskStatus, PlanStatus } from '../../src/planning/types.js';
import { ReplanningTriggerType, DeviationType, RecoveryStrategyType } from '../../src/replanning/types.js';

describe('DynamicReplanner', () => {
  let replanner: DynamicReplanner;

  beforeEach(() => {
    replanner = new DynamicReplanner(null, {
      enableDeviationDetection: true,
      enableFailureDetection: true,
      enableTimeoutDetection: true,
      enableQualityDropDetection: true,
      deviationThreshold: 0.2,
      qualityDropThreshold: 0.15,
      timeoutTolerance: 0.25,
      maxReplanningAttempts: 3,
      minConfidenceThreshold: 0.6,
    });
  });

  /**
   * 辅助函数：创建测试计划
   */
  function createTestPlan() {
    return {
      id: 'plan1',
      goal: '测试计划',
      subGoals: [
        {
          id: 'goal1',
          title: '研究阶段',
          description: '收集信息',
          tasks: [{
            id: 'task1',
            title: '搜索资料',
            description: '搜索相关资料',
            type: 'research' as any,
            status: TaskStatus.PENDING,
            requiredCapabilities: ['search'],
            estimatedTokens: 2000,
            estimatedDuration: 300,
            createdAt: new Date(),
          }],
          dependencies: [],
          priority: Priority.HIGH,
          status: TaskStatus.PENDING,
          estimatedDuration: 300,
          estimatedTokens: 2000,
        },
        {
          id: 'goal2',
          title: '撰写阶段',
          description: '撰写内容',
          tasks: [{
            id: 'task2',
            title: '撰写草稿',
            description: '撰写初稿',
            type: 'writing' as any,
            status: TaskStatus.PENDING,
            requiredCapabilities: ['writing'],
            estimatedTokens: 3000,
            estimatedDuration: 600,
            createdAt: new Date(),
          }],
          dependencies: ['goal1'],
          priority: Priority.HIGH,
          status: TaskStatus.PENDING,
          estimatedDuration: 600,
          estimatedTokens: 3000,
        },
      ],
      dependencies: {
        nodes: new Map(),
        edges: [],
        hasCycles: false,
        topologicalOrder: ['goal1', 'goal2'],
      },
      estimatedDuration: 900,
      estimatedTokens: 5000,
      status: PlanStatus.READY,
      createdAt: new Date(),
    };
  }

  /**
   * 辅助函数：创建执行状态
   */
  function createExecutionState(completed: string[] = [], failed: string[] = []) {
    return {
      plan: createTestPlan(),
      completedGoals: new Set(completed),
      failedGoals: new Set(failed),
      currentGoal: 'goal1',
      startTime: Date.now(),
      elapsedTime: 150,
      qualityMetrics: {
        overallQuality: 0.9,
        taskSuccessRate: 1.0,
        averageQuality: 0.9,
        qualityTrend: 'stable' as any,
      },
      resourceUsage: {
        tokensUsed: 1500,
        estimatedTokens: 5000,
        timeElapsed: 150,
        estimatedTime: 900,
        resources: new Map(),
      },
    };
  }

  describe('shouldReplan', () => {
    it('应该检测进度偏离并触发重规划', async () => {
      const plannedState = createExecutionState(['goal1'], []);
      const actualState = createExecutionState([], []); // 实际进度落后

      const result = await replanner.shouldReplan(plannedState, actualState);

      expect(result.shouldReplan).toBe(true);
      expect(result.trigger?.type).toBe(ReplanningTriggerType.DEVIATION);
    });

    it('应该检测任务失败并触发重规划', async () => {
      const plannedState = createExecutionState();
      const actualState = createExecutionState([], ['goal1']);

      const result = await replanner.shouldReplan(plannedState, actualState);

      expect(result.shouldReplan).toBe(true);
      expect(result.trigger?.type).toBe(ReplanningTriggerType.FAILURE);
    });

    it('应该检测超时并触发重规划', async () => {
      const plannedState = createExecutionState();
      const actualState = createExecutionState(['goal1']);

      // 模拟超时
      actualState.elapsedTime = 1200; // 超过900的1.25倍
      actualState.resourceUsage.timeElapsed = 1200;

      const result = await replanner.shouldReplan(plannedState, actualState);

      expect(result.shouldReplan).toBe(true);
      expect(result.trigger?.type).toBe(ReplanningTriggerType.TIMEOUT);
    });

    it('应该检测质量下降并触发重规划', async () => {
      const plannedState = createExecutionState();
      const actualState = createExecutionState(['goal1']);

      // 模拟质量下降
      actualState.qualityMetrics.overallQuality = 0.6;

      const result = await replanner.shouldReplan(plannedState, actualState);

      expect(result.shouldReplan).toBe(true);
      expect(result.trigger?.type).toBe(ReplanningTriggerType.QUALITY_DROP);
    });

    it('不应该触发重规划（状态正常）', async () => {
      const plannedState = createExecutionState(['goal1']);
      const actualState = createExecutionState(['goal1']);

      const result = await replanner.shouldReplan(plannedState, actualState);

      expect(result.shouldReplan).toBe(false);
    });
  });

  describe('replan', () => {
    it('应该执行重规划并生成调整后的计划', async () => {
      const plan = createTestPlan();
      const executionState = createExecutionState([], ['goal1']);

      const trigger: any = {
        type: ReplanningTriggerType.FAILURE,
        threshold: 0,
        description: '任务失败',
        condition: () => true,
      };

      const result = await replanner.replan(plan, executionState, trigger);

      expect(result).toBeDefined();
      expect(result.adjustedPlan).toBeDefined();
      expect(result.adjustment).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.estimatedImprovement).toBeGreaterThanOrEqual(0);
    });

    it('应该选择合适的恢复策略', async () => {
      const plan = createTestPlan();
      const executionState = createExecutionState([], ['goal1']);

      const trigger: any = {
        type: ReplanningTriggerType.FAILURE,
        threshold: 0,
        description: '任务失败',
        condition: () => true,
      };

      const result = await replanner.replan(plan, executionState, trigger);

      expect(result.adjustment.type).toBeDefined();
      expect(Object.values(RecoveryStrategyType)).toContain(result.adjustment.type);
    });

    it('应该生成合理的推理说明', async () => {
      const plan = createTestPlan();
      const executionState = createExecutionState([], ['goal1']);

      const trigger: any = {
        type: ReplanningTriggerType.FAILURE,
        threshold: 0,
        description: '任务失败',
        condition: () => true,
      };

      const result = await replanner.replan(plan, executionState, trigger);

      expect(result.reasoning).toBeDefined();
      expect(result.reasoning.length).toBeGreaterThan(0);
    });

    it('应该记录重规划历史', async () => {
      const plan = createTestPlan();
      const executionState = createExecutionState([], ['goal1']);

      const trigger: any = {
        type: ReplanningTriggerType.FAILURE,
        threshold: 0,
        description: '任务失败',
        condition: () => true,
      };

      await replanner.replan(plan, executionState, trigger);

      const history = replanner.getHistory();
      expect(history.length).toBe(1);
      expect(history[0].trigger).toBe(ReplanningTriggerType.FAILURE);
    });
  });

  describe('DeviationDetector', () => {
    it('应该检测进度偏离', async () => {
      const plannedState = createExecutionState(['goal1']);
      const actualState = createExecutionState([], []);

      const detector = replanner.getDeviationDetector();
      const report = await detector.detectDeviations(plannedState, actualState);

      expect(report.hasDeviation).toBe(true);
      expect(report.deviations.length).toBeGreaterThan(0);

      const scheduleDeviation = report.deviations.find(
        d => d.type === DeviationType.SCHEDULE_DEVIATION
      );
      expect(scheduleDeviation).toBeDefined();
    });

    it('应该检测质量偏离', async () => {
      const plannedState = createExecutionState();
      const actualState = createExecutionState(['goal1']);

      actualState.qualityMetrics.overallQuality = 0.5;

      const detector = replanner.getDeviationDetector();
      const report = await detector.detectDeviations(plannedState, actualState, {
        qualityDeviation: 0.3,
      });

      expect(report.hasDeviation).toBe(true);

      const qualityDeviation = report.deviations.find(
        d => d.type === DeviationType.QUALITY_DEVIATION
      );
      expect(qualityDeviation).toBeDefined();
    });

    it('应该计算总体偏离分数', async () => {
      const plannedState = createExecutionState(['goal1']);
      const actualState = createExecutionState([], []);

      const detector = replanner.getDeviationDetector();
      const report = await detector.detectDeviations(plannedState, actualState);

      expect(report.overallDeviationScore).toBeGreaterThanOrEqual(0);
      expect(report.overallDeviationScore).toBeLessThanOrEqual(1);
    });
  });

  describe('RecoveryStrategySelector', () => {
    it('应该选择最佳恢复策略', async () => {
      const selector = replanner.getStrategySelector();
      const strategies = selector.getAllStrategies();

      expect(strategies.length).toBeGreaterThan(0);
      expect(strategies[0].name).toBeDefined();
      expect(strategies[0].action).toBeDefined();
    });
  });

  describe('IncrementalPlanner', () => {
    it('应该验证调整', async () => {
      const planner = replanner.getIncrementalPlanner();

      const plan = createTestPlan();
      const adjustment: any = {
        type: RecoveryStrategyType.RETRY,
        modifications: [
          {
            type: 'modify',
            goalId: 'goal1',
            changes: {
              newStatus: 'pending',
            },
          },
        ],
        estimatedImprovement: 0.5,
        reasoning: '测试调整',
      };

      const isValid = await planner.validateAdjustment(plan, adjustment);

      expect(isValid).toBe(true);
    });

    it('应该拒绝超过限制的调整', async () => {
      const planner = replanner.getIncrementalPlanner();

      const plan = createTestPlan();
      const adjustment: any = {
        type: RecoveryStrategyType.REORDER,
        modifications: Array(10).fill(null).map((_, i) => ({
          type: 'modify',
          goalId: `goal${i}`,
          changes: {},
        })),
        estimatedImprovement: 0.5,
        reasoning: '测试调整',
      };

      const isValid = await planner.validateAdjustment(plan, adjustment);

      expect(isValid).toBe(false);
    });
  });

  describe('配置管理', () => {
    it('应该获取配置', () => {
      const config = replanner.getConfig();

      expect(config).toBeDefined();
      expect(config.deviationThreshold).toBeDefined();
      expect(config.maxReplanningAttempts).toBeDefined();
    });

    it('应该更新配置', () => {
      replanner.updateConfig({
        deviationThreshold: 0.3,
        maxReplanningAttempts: 5,
      });

      const config = replanner.getConfig();
      expect(config.deviationThreshold).toBe(0.3);
      expect(config.maxReplanningAttempts).toBe(5);
    });
  });

  describe('边界情况', () => {
    it('应该处理空计划', async () => {
      const plan: any = {
        id: 'empty',
        goal: '空计划',
        subGoals: [],
        dependencies: {
          nodes: new Map(),
          edges: [],
          hasCycles: false,
          topologicalOrder: [],
        },
        estimatedDuration: 0,
        estimatedTokens: 0,
        status: PlanStatus.READY,
        createdAt: new Date(),
      };

      const executionState: any = {
        plan,
        completedGoals: new Set(),
        failedGoals: new Set(),
        startTime: Date.now(),
        elapsedTime: 0,
        qualityMetrics: {
          overallQuality: 1.0,
          taskSuccessRate: 1.0,
          averageQuality: 1.0,
          qualityTrend: 'stable',
        },
        resourceUsage: {
          tokensUsed: 0,
          estimatedTokens: 0,
          timeElapsed: 0,
          estimatedTime: 0,
          resources: new Map(),
        },
      };

      const result = await replanner.shouldReplan(executionState, executionState);

      expect(result.shouldReplan).toBe(false);
    });

    it('应该处理所有任务完成的计划', async () => {
      const plan = createTestPlan();
      const executionState = createExecutionState(['goal1', 'goal2']);

      const result = await replanner.shouldReplan(
        executionState,
        executionState
      );

      expect(result.shouldReplan).toBe(false);
    });
  });
});
