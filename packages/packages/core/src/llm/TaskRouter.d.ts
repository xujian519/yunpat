/**
 * 智能任务路由 - 成本感知的 LLM 调度器
 *
 * 核心理念:
 * - 简单任务用本地模型(免费)
 * - 复杂任务用云端模型(付费)
 * - 自动评估任务复杂度
 * - 预期节省 50-60% API 成本
 */
import {
  LLMAdapter as ILLMAdapter,
  ChatParams,
  ChatResponse,
  ChatChunk,
} from '../lifecycle/Lifecycle.js'
import { NativeLLMAdapter } from './NativeLLMAdapter.js'
import { OMLXAdapter } from './OMXLAdapter.js'
/**
 * 任务复杂度
 */
export declare enum TaskComplexity {
  /** 简单任务 - 本地 OMLX 处理 */
  SIMPLE = 'simple',
  /** 中等任务 - 本地 OMLX 处理 */
  MEDIUM = 'medium',
  /** 复杂任务 - 云端 DeepSeek 处理 */
  COMPLEX = 'complex',
}
/**
 * 任务描述
 */
export interface Task {
  /** 任务消息 */
  messages: ChatParams['messages']
  /** 任务描述(可选,用于复杂度评估) */
  description?: string
  /** 预期输出长度(可选) */
  expectedOutputLength?: number
}
/**
 * 路由决策
 */
export interface RoutingDecision {
  /** 任务复杂度 */
  complexity: TaskComplexity
  /** 选择的模型适配器 */
  adapter: ILLMAdapter
  /** 选择原因 */
  reason: string
  /** 预估成本(元) */
  estimatedCost: number
}
/**
 * TaskRouter 配置
 */
export interface TaskRouterConfig {
  /** DeepSeek API Key */
  deepSeekApiKey: string
  /** OMLX Base URL */
  omlxBaseURL?: string
  /** OMLX API Key(可选) */
  omlxApiKey?: string
  /** OMLX 模型名称 */
  omlxModelName?: string
  /** DeepSeek 模型名称 */
  deepSeekModelName?: string
  /** 强制使用特定模式(测试用) */
  forceMode?: 'local' | 'cloud' | 'auto'
}
/**
 * 任务复杂度评估器
 */
export declare class TaskRouter {
  private localAdapter
  private cloudAdapter
  private forceMode
  constructor(config: TaskRouterConfig)
  /**
   * 评估任务复杂度
   *
   * 评估维度:
   * 1. 输入文本长度
   * 2. 任务描述关键词
   * 3. 预期输出长度
   * 4. 消息轮数
   */
  evaluateComplexity(task: Task): TaskComplexity
  /**
   * 路由任务到合适的模型
   */
  route(task: Task): RoutingDecision
  /**
   * 估算 token 数量
   *
   * 粗略估算: 1 token ≈ 3-4 个字符(中文)或 4-5 个字符(英文)
   */
  estimateTokens(messages: ChatParams['messages']): number
  /**
   * 获取本地适配器
   */
  getLocalAdapter(): OMLXAdapter
  /**
   * 获取云端适配器
   */
  getCloudAdapter(): NativeLLMAdapter
}
/**
 * 成本感知 LLM 适配器
 *
 * 自动路由任务到合适的模型,对用户透明
 */
export declare class CostAwareLLMAdapter implements ILLMAdapter {
  private router
  private stats
  constructor(config: TaskRouterConfig)
  /**
   * 聊天 - 自动路由
   */
  chat(params: ChatParams): Promise<ChatResponse>
  /**
   * 聊天 - 流式调用(自动路由)
   */
  chatStream(params: ChatParams): AsyncIterable<ChatChunk>
  /**
   * 嵌入 - 默认使用云端模型
   */
  embed(texts: string[]): Promise<number[][]>
  /**
   * 获取统计信息
   */
  getStats(): {
    localRate: string
    cloudRate: string
    totalRequests: number
    localRequests: number
    cloudRequests: number
    totalCost: number
    savedCost: number
  }
  /**
   * 重置统计
   */
  resetStats(): void
  /**
   * 获取底层路由器
   */
  getRouter(): TaskRouter
}
/**
 * 创建成本感知适配器
 *
 * @param deepSeekApiKey - DeepSeek API Key
 * @param omlxBaseURL - OMLX Base URL(默认: http://localhost:8009/v1)
 * @returns 成本感知适配器实例
 */
export declare function createCostAwareAdapter(
  deepSeekApiKey: string,
  omlxBaseURL?: string
): CostAwareLLMAdapter
//# sourceMappingURL=TaskRouter.d.ts.map
