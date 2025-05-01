/**
 * 国产大模型 + 本地模型适配器
 *
 * 优先支持：
 * - DeepSeek (深度求索)
 * - 通义千问 (阿里)
 * - 文心一言 (百度)
 * - 智谱 GLM
 * - 本地模型 (Ollama)
 */
import {
  LLMAdapter as ILLMAdapter,
  ChatParams,
  ChatResponse,
  ChatChunk,
} from '../lifecycle/Lifecycle.js'
/**
 * 支持的国产模型列表
 */
export declare enum NativeModel {
  /** DeepSeek V4 (深度求索) - 2025 新版本 */
  DEEPSEEK_V4_FLASH = 'deepseek-v4-flash',
  DEEPSEEK_V4_PRO = 'deepseek-v4-pro',
  /** DeepSeek 旧版本 (将于 2026/07/24 弃用) */
  DEEPSEEK_CHAT = 'deepseek-chat',
  DEEPSEEK_CODER = 'deepseek-coder',
  /** 通义千问 (阿里) */
  QWEN_TURBO = 'qwen-turbo',
  QWEN_PLUS = 'qwen-plus',
  QWEN_MAX = 'qwen-max',
  /** 文心一言 (百度) */
  ERNIE_BOT_TURBO = 'ernie-bot-turbo',
  ERNIE_BOT = 'ernie-bot',
  ERNIE_BOT_4 = 'ernie-bot-4',
  /** 智谱 GLM */
  GLM_5_1 = 'glm-5.1', // 2026 最新旗舰（推荐）
  GLM_4_7_FLASH = 'glm-4.7-flash', // 极速响应（推荐）
  GLM_4_7 = 'glm-4.7', // 2025 旗舰
  GLM_4_6_V = 'glm-4.6-v', // 视觉增强版
  GLM_4_FLASH = 'glm-4-flash', // 快速响应
  GLM_4_PLUS = 'glm-4-plus', // 平衡性能
  GLM_4_AIR = 'glm-4-air', // 轻量级
  GLM_4 = 'glm-4',
  GLM_3_TURBO = 'glm-3-turbo',
  /** 本地模型 (Ollama) */
  OLLAMA_LLAMA3 = 'ollama/llama3',
  OLLAMA_MISTRAL = 'ollama/mistral',
  OLLAMA_QWEN = 'ollama/qwen',
}
/**
 * 思考模式配置
 */
export interface ThinkingConfig {
  /** 思考模式类型 */
  type: 'enabled' | 'disabled'
}
/**
 * 推理强度
 */
export type ReasoningEffort = 'high' | 'medium' | 'low'
/**
 * 模型配置
 */
export interface ModelConfig {
  /** 模型名称 */
  name: NativeModel | string
  /** API 基础 URL */
  baseURL: string
  /** API 密钥 */
  apiKey: string
  /** 温度 */
  temperature?: number
  /** 最大 Token 数 */
  maxTokens?: number
  /** 超时时间（毫秒） */
  timeout?: number
  /** 思考模式配置（仅 DeepSeek V4 支持） */
  thinking?: ThinkingConfig
  /** 推理强度（仅 DeepSeek V4 支持） */
  reasoningEffort?: ReasoningEffort
}
/**
 * 模型提供商
 */
export declare enum ModelProvider {
  /** DeepSeek */
  DEEPSEEK = 'deepseek',
  /** 阿里云 */
  ALIYUN = 'aliyun',
  /** 百度千帆 */
  BAIDU = 'baidu',
  /** 智谱 */
  ZHIPU = 'zhipu',
  /** 本地 Ollama */
  OLLAMA = 'ollama',
}
/**
 * 国产大模型适配器
 *
 * 支持多个国产大模型和本地模型，提供统一的接口
 */
export declare class NativeLLMAdapter implements ILLMAdapter {
  private config
  private provider
  constructor(config: ModelConfig)
  /**
   * 检测模型提供商
   */
  private detectProvider
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
   * 支持的嵌入端点：
   * - DeepSeek: 使用 OpenAI 兼容的 /embeddings 端点
   * - 通义千问: 使用 DashScope 嵌入 API
   * - 智谱 GLM: 使用 GLM 嵌入 API
   */
  embed(texts: string[]): Promise<number[][]>
  /**
   * DeepSeek 嵌入
   *
   * 使用 OpenAI 兼容的 /embeddings 端点
   * 模型: deepseek-ai/deepseek-v2-lite (支持 1024 维)
   */
  private embedDeepSeek
  /**
   * 通义千问嵌入
   *
   * 使用 DashScope text-embedding-v3 模型
   * 维度: 1024
   */
  private embedQwen
  /**
   * 智谱 GLM 嵌入
   *
   * 使用 Embedding-3 模型
   * 维度: 1024
   */
  private embedZhipu
  /**
   * Ollama 嵌入
   *
   * 使用本地 Ollama 嵌入端点
   * 默认模型: nomic-embed-text (768 维)
   */
  private embedOllama
  /**
   * 切换模型
   */
  switchModel(modelName: NativeModel | string): void
  /**
   * 获取当前提供商
   */
  getProvider(): ModelProvider
  /**
   * 获取当前模型
   */
  getModel(): string
}
/**
 * 多模型管理器
 *
 * 管理多个模型实例，支持模型路由和负载均衡
 */
export declare class MultiModelManager {
  private adapters
  private defaultModel
  constructor(defaultModel?: NativeModel)
  /**
   * 注册模型
   */
  registerModel(name: string, config: ModelConfig): void
  /**
   * 获取模型适配器
   */
  getAdapter(model?: string): NativeLLMAdapter
  /**
   * 智能模型选择
   *
   * 根据任务类型自动选择最合适的模型
   */
  selectModelForTask(taskType: 'code' | 'chat' | 'analysis'): string
  /**
   * 获取所有可用模型
   */
  listModels(): string[]
}
/**
 * 快速创建函数
 */
/**
 * 创建 DeepSeek 模型（推荐使用 V4 版本）
 */
export declare function createDeepSeekModel(
  apiKey: string,
  model?: NativeModel,
  options?: {
    thinking?: ThinkingConfig
    reasoningEffort?: ReasoningEffort
  }
): NativeLLMAdapter
/**
 * 创建通义千问模型
 */
export declare function createQwenModel(apiKey: string, model?: NativeModel): NativeLLMAdapter
/**
 * 创建智谱 GLM 模型（推荐使用 GLM-4.7）
 */
export declare function createZhipuModel(apiKey: string, model?: NativeModel): NativeLLMAdapter
/**
 * 创建本地 Ollama 模型
 */
export declare function createOllamaModel(model?: string): NativeLLMAdapter
//# sourceMappingURL=NativeLLMAdapter.d.ts.map
