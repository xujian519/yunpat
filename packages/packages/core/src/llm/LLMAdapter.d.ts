import {
  LLMAdapter as ILLMAdapter,
  ChatParams,
  ChatResponse,
  ChatChunk,
} from '../lifecycle/Lifecycle.js'
/**
 * LangChain LLM 适配器配置
 */
export interface LangChainAdapterConfig {
  /** API 密钥 */
  apiKey: string
  /** 模型名称 */
  modelName?: string
  /** 温度 */
  temperature?: number
  /** 最大 token 数 */
  maxTokens?: number
  /** 基础 URL（用于兼容其他 API） */
  baseURL?: string
}
/**
 * LangChain LLM 适配器
 *
 * 将 LangChain 的 ChatOpenAI 适配到统一的 LLM 接口
 */
export declare class LangChainAdapter implements ILLMAdapter {
  private llm
  constructor(config: LangChainAdapterConfig)
  /**
   * 聊天 - 单次调用
   */
  chat(params: ChatParams): Promise<ChatResponse>
  /**
   * 聊天 - 流式调用
   */
  chatStream(params: ChatParams): AsyncIterable<ChatChunk>
  /**
   * 嵌入 - 生成向量
   *
   * TODO: 实现嵌入功能
   */
  embed(_texts: string[]): Promise<number[][]>
}
/**
 * 多模型适配器
 *
 * 支持多种 LLM 提供商
 */
export declare class MultiModelLLMAdapter implements ILLMAdapter {
  private adapters
  private defaultModel
  constructor(defaultModel?: string)
  /**
   * 注册模型适配器
   */
  registerModel(name: string, adapter: ILLMAdapter): void
  /**
   * 获取模型适配器
   */
  private getAdapter
  /**
   * 聊天
   */
  chat(params: ChatParams): Promise<ChatResponse>
  /**
   * 聊天 - 流式
   */
  chatStream(params: ChatParams): AsyncIterable<ChatChunk>
  /**
   * 嵌入
   */
  embed(texts: string[]): Promise<number[][]>
}
//# sourceMappingURL=LLMAdapter.d.ts.map
