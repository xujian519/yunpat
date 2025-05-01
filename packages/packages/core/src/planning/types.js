/**
 * 目标分解系统 - 类型定义
 *
 * 定义层次化规划、任务分解、依赖分析的核心类型
 */
/**
 * 优先级枚举
 */
export var Priority
;(function (Priority) {
  Priority['CRITICAL'] = 'critical'
  Priority['HIGH'] = 'high'
  Priority['MEDIUM'] = 'medium'
  Priority['LOW'] = 'low'
})(Priority || (Priority = {}))
/**
 * 任务状态枚举
 */
export var TaskStatus
;(function (TaskStatus) {
  TaskStatus['PENDING'] = 'pending'
  TaskStatus['IN_PROGRESS'] = 'in_progress'
  TaskStatus['COMPLETED'] = 'completed'
  TaskStatus['FAILED'] = 'failed'
  TaskStatus['SKIPPED'] = 'skipped'
  TaskStatus['BLOCKED'] = 'blocked'
})(TaskStatus || (TaskStatus = {}))
/**
 * 任务类型
 */
export var TaskType
;(function (TaskType) {
  TaskType['RESEARCH'] = 'research'
  TaskType['ANALYSIS'] = 'analysis'
  TaskType['WRITING'] = 'writing'
  TaskType['VALIDATION'] = 'validation'
  TaskType['GENERATION'] = 'generation'
  TaskType['REVIEW'] = 'review'
})(TaskType || (TaskType = {}))
/**
 * 依赖类型
 */
export var DependencyType
;(function (DependencyType) {
  DependencyType['STRONG'] = 'strong'
  DependencyType['WEAK'] = 'weak'
  DependencyType['ORDERING'] = 'ordering'
})(DependencyType || (DependencyType = {}))
/**
 * 计划状态
 */
export var PlanStatus
;(function (PlanStatus) {
  PlanStatus['DRAFT'] = 'draft'
  PlanStatus['READY'] = 'ready'
  PlanStatus['IN_PROGRESS'] = 'in_progress'
  PlanStatus['COMPLETED'] = 'completed'
  PlanStatus['FAILED'] = 'failed'
  PlanStatus['CANCELLED'] = 'cancelled'
})(PlanStatus || (PlanStatus = {}))
//# sourceMappingURL=types.js.map
