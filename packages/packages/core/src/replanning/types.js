/**
 * 动态重规划系统 - 类型定义
 *
 * 定义偏离检测、恢复策略、增量规划的核心类型
 */
/**
 * 重规划触发类型
 */
export var ReplanningTriggerType
;(function (ReplanningTriggerType) {
  ReplanningTriggerType['DEVIATION'] = 'deviation'
  ReplanningTriggerType['FAILURE'] = 'failure'
  ReplanningTriggerType['TIMEOUT'] = 'timeout'
  ReplanningTriggerType['QUALITY_DROP'] = 'quality_drop'
  ReplanningTriggerType['USER_REQUEST'] = 'user_request'
})(ReplanningTriggerType || (ReplanningTriggerType = {}))
/**
 * 偏离类型
 */
export var DeviationType
;(function (DeviationType) {
  DeviationType['SCHEDULE_DEVIATION'] = 'schedule_deviation'
  DeviationType['QUALITY_DEVIATION'] = 'quality_deviation'
  DeviationType['RESOURCE_DEVIATION'] = 'resource_deviation'
  DeviationType['DEPENDENCY_DEVIATION'] = 'dependency_deviation'
})(DeviationType || (DeviationType = {}))
/**
 * 恢复策略类型
 */
export var RecoveryStrategyType
;(function (RecoveryStrategyType) {
  RecoveryStrategyType['RETRY'] = 'retry'
  RecoveryStrategyType['SKIP'] = 'skip'
  RecoveryStrategyType['REORDER'] = 'reorder'
  RecoveryStrategyType['DECOMPOSE'] = 'decompose'
  RecoveryStrategyType['ADAPT'] = 'adapt'
  RecoveryStrategyType['ABORT'] = 'abort'
})(RecoveryStrategyType || (RecoveryStrategyType = {}))
/**
 * 计划冲突错误
 */
export class PlanConflictError extends Error {
  conflicts
  constructor(conflicts) {
    super(`计划冲突: ${conflicts.join(', ')}`)
    this.name = 'PlanConflictError'
    this.conflicts = conflicts
  }
}
/**
 * 循环依赖错误
 */
export class CircularDependencyError extends Error {
  taskId
  constructor(taskId) {
    super(`检测到循环依赖: ${taskId}`)
    this.name = 'CircularDependencyError'
    this.taskId = taskId
  }
}
//# sourceMappingURL=types.js.map
