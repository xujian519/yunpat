/**
 * OMLX 本地模型适配器
 *
 * OMLX 是本地部署的大模型服务，兼容 OpenAI API 格式
 * 端口：8009
 */
import {
  LLMAdapter as ILLMAdapter,
  ChatParams,
  ChatResponse,
  ChatChunk,
} from '../lifecycle/Lifecycle.js'
/**
 * OMLX 配置
 */
export interface OMLXConfig {
  /** API 基础 URL */
  baseURL: string
  /** API 密钥（OMXL 可能需要） */
  apiKey?: string
  /** 模型名称 */
  modelName?: string
  /** 温度 */
  temperature?: number
  /** 最大 Token 数 */
  maxTokens?: number
  /** 超时时间（毫秒） */
  timeout?: number
}
/**
 * OMLX 适配器
 *
 * 连接本地 OMLX 服务
 */
export declare class OMLXAdapter implements ILLMAdapter {
  private config
  constructor(config: OMLXConfig)
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
   * 使用 OMLX 的 /embeddings 端点
   * 支持 BGE-M3 等本地嵌入模型
   */
  embed(texts: string[]): Promise<number[][]>
}
/**
 * 快速创建 OMLX 适配器
 */
export declare function createOMXLModel(apiKey?: string): OMLXAdapter
//# sourceMappingURL=OMXLAdapter.d.ts.map
