/**
 * 恢复策略选择器
 *
 * 根据偏离类型和严重程度，选择最合适的恢复策略
 */
import { RecoveryStrategyType as Strategy } from './types.js'
/**
 * 恢复策略选择器
 */
export class RecoveryStrategySelector {
  strategies
  constructor() {
    this.strategies = new Map()
    this.initializeDefaultStrategies()
  }
  /**
   * 初始化默认策略
   */
  initializeDefaultStrategies() {
    // 重试策略
    this.strategies.set(Strategy.RETRY, {
      name: Strategy.RETRY,
      description: '重新执行失败的任务',
      applicableScenarios: ['task_failure', 'temporary_error', 'network_issue'],
      estimatedCost: 0.2,
      estimatedSuccess: 0.7,
      action: async (context) => {
        const failedGoal = context.currentState.failedGoals.values().next().value
        if (!failedGoal) {
          throw new Error('没有失败的任务可以重试')
        }
        return {
          type: Strategy.RETRY,
          modifications: [
            {
              type: 'modify',
              goalId: failedGoal,
              changes: {
                newStatus: 'pending',
              },
            },
          ],
          estimatedImprovement: 0.3,
          reasoning: `重试失败的任务: ${failedGoal}`,
        }
      },
    })
    // 跳过策略
    this.strategies.set(Strategy.SKIP, {
      name: Strategy.SKIP,
      description: '跳过当前任务，继续执行后续任务',
      applicableScenarios: ['blocked_task', 'optional_task', 'low_priority'],
      estimatedCost: 0.1,
      estimatedSuccess: 0.9,
      action: async (context) => {
        const currentGoal = context.currentState.currentGoal
        if (!currentGoal) {
          throw new Error('没有当前任务可以跳过')
        }
        return {
          type: Strategy.SKIP,
          modifications: [
            {
              type: 'modify',
              goalId: currentGoal,
              changes: {
                newStatus: 'skipped',
              },
            },
          ],
          estimatedImprovement: 0.5,
          reasoning: `跳过被阻塞的任务: ${currentGoal}`,
        }
      },
    })
    // 重排序策略
    this.strategies.set(Strategy.REORDER, {
      name: Strategy.REORDER,
      description: '调整任务执行顺序以优化进度',
      applicableScenarios: ['schedule_deviation', 'dependency_bottleneck'],
      estimatedCost: 0.4,
      estimatedSuccess: 0.8,
      action: async (context) => {
        // 找出可以提前执行的任务
        const modifications = []
        const pendingGoals = context.originalPlan.subGoals
          .filter((g) => !context.currentState.completedGoals.has(g.id))
          .sort((a, b) => b.priority - a.priority) // 按优先级降序
        for (let i = 0; i < pendingGoals.length; i++) {
          modifications.push({
            type: 'modify',
            goalId: pendingGoals[i].id,
            changes: {
              newPriority: 10 - i, // 重新分配优先级
            },
          })
        }
        return {
          type: Strategy.REORDER,
          modifications,
          estimatedImprovement: 0.6,
          reasoning: '按优先级重新排序任务以优化进度',
        }
      },
    })
    // 分解策略
    this.strategies.set(Strategy.DECOMPOSE, {
      name: Strategy.DECOMPOSE,
      description: '将复杂任务分解为更小的子任务',
      applicableScenarios: ['complex_task', 'quality_issue', 'resource_shortage'],
      estimatedCost: 0.7,
      estimatedSuccess: 0.85,
      action: async (context) => {
        const currentGoal = context.currentState.currentGoal
        if (!currentGoal) {
          throw new Error('没有当前任务可以分解')
        }
        // 这里简化处理，实际应该调用TaskDecomposer
        return {
          type: Strategy.DECOMPOSE,
          modifications: [
            {
              type: 'modify',
              goalId: currentGoal,
              changes: {
                newEstimate: {
                  duration:
                    (context.originalPlan.subGoals.find((g) => g.id === currentGoal)
                      ?.estimatedDuration ?? 0) * 0.6,
                  tokens:
                    (context.originalPlan.subGoals.find((g) => g.id === currentGoal)
                      ?.estimatedTokens ?? 0) * 0.6,
                },
              },
            },
          ],
          estimatedImprovement: 0.7,
          reasoning: `分解复杂任务: ${currentGoal}`,
        }
      },
    })
    // 适应策略
    this.strategies.set(Strategy.ADAPT, {
      name: Strategy.ADAPT,
      description: '调整参数和配置以适应新情况',
      applicableScenarios: ['quality_drop', 'resource_shortage', 'changing_requirements'],
      estimatedCost: 0.3,
      estimatedSuccess: 0.75,
      action: async (context) => {
        const modifications = []
        // 调整资源分配
        for (const goal of context.originalPlan.subGoals) {
          if (!context.currentState.completedGoals.has(goal.id)) {
            const currentEstimate = goal.estimatedTokens
            const newEstimate = Math.floor(currentEstimate * 0.8) // 减少20%
            modifications.push({
              type: 'modify',
              goalId: goal.id,
              changes: {
                newEstimate: {
                  tokens: newEstimate,
                },
              },
            })
          }
        }
        return {
          type: Strategy.ADAPT,
          modifications,
          estimatedImprovement: 0.4,
          reasoning: '调整资源分配以适应限制',
        }
      },
    })
    // 中止策略
    this.strategies.set(Strategy.ABORT, {
      name: Strategy.ABORT,
      description: '中止当前计划，请求人工干预',
      applicableScenarios: ['critical_failure', 'unrecoverable_error', 'severe_deviation'],
      estimatedCost: 1.0,
      estimatedSuccess: 0.5, // 依赖人工干预
      action: async (_context) => {
        return {
          type: Strategy.ABORT,
          modifications: [],
          estimatedImprovement: 0,
          reasoning: '中止计划，需要人工干预来解决严重问题',
        }
      },
    })
  }
  /**
   * 选择最佳恢复策略
   */
  async selectBestStrategy(deviationReport, context, preferredStrategies) {
    // 如果有首选策略，优先使用
    if (preferredStrategies && preferredStrategies.length > 0) {
      for (const strategyName of preferredStrategies) {
        const strategy = this.strategies.get(strategyName)
        if (strategy && this.isStrategyApplicable(strategy, deviationReport)) {
          return strategy
        }
      }
    }
    // 根据偏离类型和严重程度选择策略
    const candidateStrategies = this.getCandidateStrategies(deviationReport)
    // 评分并选择最佳策略
    const scoredStrategies = await this.scoreStrategies(
      candidateStrategies,
      deviationReport,
      context
    )
    // 按分数降序排序
    scoredStrategies.sort((a, b) => b.score - a.score)
    return scoredStrategies[0].strategy
  }
  /**
   * 获取候选策略
   */
  getCandidateStrategies(deviationReport) {
    const candidates = []
    for (const strategy of this.strategies.values()) {
      if (this.isStrategyApplicable(strategy, deviationReport)) {
        candidates.push(strategy)
      }
    }
    return candidates
  }
  /**
   * 判断策略是否适用
   */
  isStrategyApplicable(strategy, deviationReport) {
    // 如果没有偏离，所有策略都不适用
    if (!deviationReport.hasDeviation) {
      return false
    }
    // 检查策略的适用场景
    for (const deviation of deviationReport.deviations) {
      for (const scenario of strategy.applicableScenarios) {
        // 简化的场景匹配逻辑
        if (this.scenarioMatches(deviation, scenario)) {
          return true
        }
      }
    }
    return false
  }
  /**
   * 场景匹配
   */
  scenarioMatches(deviation, scenario) {
    const deviationType = deviation.type
    // 映射偏离类型到场景
    const scenarioMap = {
      schedule_deviation: ['schedule_deviation', 'delay', 'behind_schedule'],
      quality_deviation: ['quality_issue', 'quality_drop', 'low_quality'],
      resource_deviation: ['resource_shortage', 'over_budget'],
      dependency_deviation: ['dependency_bottleneck', 'blocked_task'],
    }
    const applicableScenarios = scenarioMap[deviationType] || []
    return (
      applicableScenarios.includes(scenario) ||
      deviation.description.toLowerCase().includes(scenario.replace('_', ' '))
    )
  }
  /**
   * 为策略评分
   */
  async scoreStrategies(strategies, deviationReport, context) {
    const scored = []
    for (const strategy of strategies) {
      const score = await this.calculateStrategyScore(strategy, deviationReport, context)
      scored.push({ strategy, score })
    }
    return scored
  }
  /**
   * 计算策略分数
   */
  async calculateStrategyScore(strategy, deviationReport, context) {
    let score = 0
    // 1. 成功概率权重 (40%)
    score += strategy.estimatedSuccess * 0.4
    // 2. 成本权重 (30% - 成本越低分数越高)
    score += (1 - strategy.estimatedCost) * 0.3
    // 3. 偏离严重程度匹配 (20%)
    const maxSeverity = this.getMaxSeverity(deviationReport)
    const severityMatch = this.calculateSeverityMatch(strategy, maxSeverity)
    score += severityMatch * 0.2
    // 4. 历史成功率 (10%)
    const historicalScore = this.getHistoricalSuccess(strategy.name, context.history)
    score += historicalScore * 0.1
    return score
  }
  /**
   * 获取最大严重程度
   */
  getMaxSeverity(deviationReport) {
    if (deviationReport.deviations.length === 0) {
      return 'minor'
    }
    const severityOrder = { minor: 1, moderate: 2, severe: 3 }
    const maxDeviation = deviationReport.deviations.reduce((max, d) =>
      severityOrder[d.severity] > severityOrder[max.severity] ? d : max
    )
    return maxDeviation.severity
  }
  /**
   * 计算严重程度匹配度
   */
  calculateSeverityMatch(strategy, maxSeverity) {
    // 不同策略对不同严重程度的适用性
    const matchMatrix = {
      minor: {
        retry: 0.9,
        skip: 0.7,
        reorder: 0.8,
        decompose: 0.5,
        adapt: 0.6,
        abort: 0.1,
      },
      moderate: {
        retry: 0.7,
        skip: 0.8,
        reorder: 0.9,
        decompose: 0.8,
        adapt: 0.7,
        abort: 0.3,
      },
      severe: {
        retry: 0.3,
        skip: 0.5,
        reorder: 0.6,
        decompose: 0.7,
        adapt: 0.8,
        abort: 0.9,
      },
    }
    return matchMatrix[maxSeverity]?.[strategy.name] || 0.5
  }
  /**
   * 获取历史成功率
   */
  getHistoricalSuccess(strategyName, history) {
    if (history.length === 0) {
      return 0.5 // 无历史数据时返回中性分数
    }
    const strategyHistory = history.filter((h) => h.adjustment.type === strategyName)
    if (strategyHistory.length === 0) {
      return 0.5
    }
    const successCount = strategyHistory.filter((h) => h.result === 'success').length
    return successCount / strategyHistory.length
  }
  /**
   * 添加自定义策略
   */
  addStrategy(strategy) {
    this.strategies.set(strategy.name, strategy)
  }
  /**
   * 移除策略
   */
  removeStrategy(strategyName) {
    this.strategies.delete(strategyName)
  }
  /**
   * 获取所有策略
   */
  getAllStrategies() {
    return Array.from(this.strategies.values())
  }
}
//# sourceMappingURL=RecoveryStrategySelector.js.map
