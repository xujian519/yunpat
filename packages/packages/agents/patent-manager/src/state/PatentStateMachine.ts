/**
 * 专利状态机
 *
 * 管理专利生命周期的状态转换，确保状态变更符合业务规则
 */

import type { PatentStatus, PatentApplication } from '../types/PatentTypes.js'
import type { StateTransitionResult } from '../types/PatentTypes.js'

/**
 * 状态转换规则定义
 * key: 当前状态
 * value: 允许转换到的目标状态列表
 */
const STATE_TRANSITIONS: Record<PatentStatus, PatentStatus[]> = {
  // 草稿状态可以转换为：已提交、已撤回、已放弃
  draft: ['filed', 'withdrawn', 'abandoned'],

  // 已提交可以转换为：审查中、已撤回、已放弃
  filed: ['under_exam', 'withdrawn', 'abandoned'],

  // 审查中可以转换为：OA发出、已授权、已驳回、已放弃
  under_exam: ['oa_issued', 'allowed', 'rejected', 'abandoned'],

  // OA发出可以转换为：已补正、已授权、已驳回、已放弃
  oa_issued: ['amended', 'allowed', 'rejected', 'abandoned'],

  // 已补正可以转换为：审查中、OA发出、已授权、已驳回
  amended: ['under_exam', 'oa_issued', 'allowed', 'rejected'],

  // 已授权可以转换为：已授权（终态）、已失效
  allowed: ['granted', 'abandoned'],

  // 已授权是终态，只能转换为已失效或已过期
  granted: ['expired', 'abandoned'],

  // 已驳回是终态，只能转换为已放弃（用于申诉失败等情况）
  rejected: ['abandoned'],

  // 已放弃是终态
  abandoned: [],

  // 已失效是终态
  expired: [],

  // 已撤回是终态
  withdrawn: [],
}

/**
 * 状态描述（中文）
 */
const STATE_DESCRIPTIONS: Record<PatentStatus, string> = {
  draft: '草稿',
  filed: '已提交',
  under_exam: '审查中',
  oa_issued: '审查意见已发出',
  amended: '已补正',
  allowed: '拟授权',
  granted: '已授权',
  rejected: '已驳回',
  abandoned: '已放弃',
  expired: '已失效',
  withdrawn: '已撤回',
}

/**
 * 状态是否为终态
 */
const TERMINAL_STATES: Set<PatentStatus> = new Set([
  'granted',
  'rejected',
  'abandoned',
  'expired',
  'withdrawn',
])

/**
 * 需要提醒的状态变更
 */
const ALERT_TRANSITIONS: Array<{
  from: PatentStatus
  to: PatentStatus
  alertLevel: 'info' | 'warning' | 'error'
}> = [
  { from: 'oa_issued', to: 'amended', alertLevel: 'info' },
  { from: 'oa_issued', to: 'allowed', alertLevel: 'info' },
  { from: 'oa_issued', to: 'rejected', alertLevel: 'error' },
  { from: 'allowed', to: 'granted', alertLevel: 'info' },
  { from: 'under_exam', to: 'rejected', alertLevel: 'error' },
  { from: 'filed', to: 'abandoned', alertLevel: 'warning' },
  { from: 'under_exam', to: 'abandoned', alertLevel: 'warning' },
]

/**
 * 状态转换钩子函数类型
 */
export type StateTransitionHook = (
  patent: PatentApplication,
  fromState: PatentStatus,
  toState: PatentStatus
) => Promise<void> | void

/**
 * 状态机配置
 */
export interface StateMachineConfig {
  /** 是否允许自动跳过某些状态 */
  allowSkipStates?: boolean
  /** 是否在状态变更时自动记录历史 */
  autoRecordHistory?: boolean
  /** 转换前钩子 */
  beforeTransition?: StateTransitionHook
  /** 转换后钩子 */
  afterTransition?: StateTransitionHook
}

/**
 * 专利状态机类
 */
export class PatentStateMachine {
  private config: Required<StateMachineConfig>

  constructor(config: StateMachineConfig = {}) {
    this.config = {
      allowSkipStates: config.allowSkipStates ?? false,
      autoRecordHistory: config.autoRecordHistory ?? true,
      beforeTransition: config.beforeTransition ?? (() => {}),
      afterTransition: config.afterTransition ?? (() => {}),
    }
  }

  /**
   * 检查状态转换是否有效
   */
  canTransition(fromState: PatentStatus, toState: PatentStatus): boolean {
    // 相同状态不需要转换
    if (fromState === toState) {
      return false
    }

    const allowedStates = STATE_TRANSITIONS[fromState]
    return allowedStates.includes(toState)
  }

  /**
   * 获取允许的转换状态列表
   */
  getAllowedTransitions(currentState: PatentStatus): PatentStatus[] {
    return [...STATE_TRANSITIONS[currentState]]
  }

  /**
   * 检查状态是否为终态
   */
  isTerminalState(state: PatentStatus): boolean {
    return TERMINAL_STATES.has(state)
  }

  /**
   * 获取状态描述
   */
  getStateDescription(state: PatentStatus): string {
    return STATE_DESCRIPTIONS[state] || state
  }

  /**
   * 获取状态转换的提醒级别
   */
  getAlertLevel(
    fromState: PatentStatus,
    toState: PatentStatus
  ): 'info' | 'warning' | 'error' | null {
    const transition = ALERT_TRANSITIONS.find((t) => t.from === fromState && t.to === toState)
    return transition?.alertLevel ?? null
  }

  /**
   * 执行状态转换
   */
  async transition(
    patent: PatentApplication,
    toState: PatentStatus,
    userId?: string
  ): Promise<StateTransitionResult> {
    const fromState = patent.status

    // 检查是否需要转换
    if (fromState === toState) {
      return {
        success: false,
        error: `状态已经是 ${this.getStateDescription(toState)}`,
      }
    }

    // 检查转换是否有效
    if (!this.canTransition(fromState, toState)) {
      const allowed = this.getAllowedTransitions(fromState)
      return {
        success: false,
        error: `不能从 ${this.getStateDescription(fromState)} 转换到 ${this.getStateDescription(toState)}。允许的状态: ${allowed.map((s) => this.getStateDescription(s)).join(', ')}`,
      }
    }

    try {
      // 执行转换前钩子
      await this.config.beforeTransition(patent, fromState, toState)

      // 更新状态
      const updatedPatent: PatentApplication = {
        ...patent,
        status: toState,
        updatedAt: new Date(),
      }

      // 执行转换后钩子
      await this.config.afterTransition(updatedPatent, fromState, toState)

      return {
        success: true,
        newState: toState,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  /**
   * 批量状态转换（用于直接设置到某个状态，跳过中间状态）
   * 仅在配置允许时可用
   */
  async forceTransition(
    patent: PatentApplication,
    toState: PatentStatus,
    userId?: string
  ): Promise<StateTransitionResult> {
    if (!this.config.allowSkipStates) {
      return {
        success: false,
        error: '强制转换未启用，请使用正常的状态转换流程',
      }
    }

    if (patent.status === toState) {
      return {
        success: false,
        error: `状态已经是 ${this.getStateDescription(toState)}`,
      }
    }

    try {
      const fromState = patent.status

      await this.config.beforeTransition(patent, fromState, toState)

      const updatedPatent: PatentApplication = {
        ...patent,
        status: toState,
        updatedAt: new Date(),
      }

      await this.config.afterTransition(updatedPatent, fromState, toState)

      return {
        success: true,
        newState: toState,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  /**
   * 获取状态路径（从一个状态到另一个状态的所有可能路径）
   */
  getStatePath(fromState: PatentStatus, toState: PatentStatus): PatentStatus[][] {
    if (fromState === toState) {
      return [[fromState]]
    }

    const paths: PatentStatus[][] = []
    const visited = new Set<PatentStatus>()

    const dfs = (current: PatentStatus, path: PatentStatus[]) => {
      if (current === toState) {
        paths.push([...path])
        return
      }

      visited.add(current)

      for (const next of STATE_TRANSITIONS[current]) {
        if (!visited.has(next)) {
          dfs(next, [...path, next])
        }
      }

      visited.delete(current)
    }

    dfs(fromState, [fromState])
    return paths
  }

  /**
   * 获取最短状态转换路径
   */
  getShortestPath(fromState: PatentStatus, toState: PatentStatus): PatentStatus[] | null {
    const paths = this.getStatePath(fromState, toState)
    if (paths.length === 0) {
      return null
    }

    return paths.reduce((shortest, current) =>
      current.length < shortest.length ? current : shortest
    )
  }

  /**
   * 验证专利状态是否有效
   */
  isValidState(state: string): state is PatentStatus {
    return Object.keys(STATE_DESCRIPTIONS).includes(state)
  }

  /**
   * 获取所有可用的状态
   */
  getAllStates(): PatentStatus[] {
    return Object.keys(STATE_DESCRIPTIONS) as PatentStatus[]
  }

  /**
   * 获取所有终态
   */
  getTerminalStates(): PatentStatus[] {
    return Array.from(TERMINAL_STATES)
  }

  /**
   * 创建状态机实例（工厂方法）
   */
  static create(config?: StateMachineConfig): PatentStateMachine {
    return new PatentStateMachine(config)
  }
}

/**
 * 默认状态机实例
 */
export const defaultStateMachine = new PatentStateMachine()
