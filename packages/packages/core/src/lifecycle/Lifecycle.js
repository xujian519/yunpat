/**
 * 生命周期阶段枚举
 *
 * 框架按照固定顺序调用各阶段钩子：
 * 1. before -> 前置处理（可选）
 * 2. init -> 初始化（首次）
 * 3. plan -> 规划（必需）
 * 4. act -> 执行（必需，可能循环多次）
 * 5. reflect -> 反思（可选）
 * 6. after -> 后置处理（可选）
 */
export var LifecycleStage
;(function (LifecycleStage) {
  /** 前置钩子 - 在所有处理之前 */
  LifecycleStage['BEFORE'] = 'before'
  /** 初始化 - 首次执行时调用一次 */
  LifecycleStage['INIT'] = 'init'
  /** 规划 - 生成执行计划 */
  LifecycleStage['PLAN'] = 'plan'
  /** 执行 - 执行计划中的步骤 */
  LifecycleStage['ACT'] = 'act'
  /** 反思 - 评估执行结果 */
  LifecycleStage['REFLECT'] = 'reflect'
  /** 后置钩子 - 在所有处理之后 */
  LifecycleStage['AFTER'] = 'after'
})(LifecycleStage || (LifecycleStage = {}))
//# sourceMappingURL=Lifecycle.js.map
