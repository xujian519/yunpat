import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai'
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
 * LangChain 消息响应
 */
interface LangChainMessageResponse {
  /** 响应内容 */
  content: string
  /** 使用元数据 */
  usage_metadata?: {
    /** 输入 token 数 */
    input_tokens?: number
    /** 输出 token 数 */
    output_tokens?: number
    /** 总 token 数 */
    total_tokens?: number
  }
}

/**
 * LangChain LLM 适配器
 *
 * 将 LangChain 的 ChatOpenAI 适配到统一的 LLM 接口
 */
export class LangChainAdapter implements ILLMAdapter {
  private llm: ChatOpenAI
  private embeddings?: OpenAIEmbeddings

  constructor(config: LangChainAdapterConfig) {
    this.llm = new ChatOpenAI({
      openAIApiKey: config.apiKey,
      modelName: config.modelName ?? 'gpt-4',
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens ?? 4096,
      configuration: config.baseURL
        ? {
            baseURL: config.baseURL,
          }
        : undefined,
    })

    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: config.apiKey,
      configuration: config.baseURL
        ? {
            baseURL: config.baseURL,
          }
        : undefined,
    })
  }

  /**
   * 聊天 - 单次调用
   */
  async chat(params: ChatParams): Promise<ChatResponse> {
    // 转换消息格式
    const messages = params.messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }))

    // 调用 LangChain
    const response = (await this.llm.call(messages)) as LangChainMessageResponse

    return {
      message: {
        role: 'assistant',
        content: response.content as string,
      },
      usage: response.usage_metadata
        ? {
            promptTokens: response.usage_metadata.input_tokens || 0,
            completionTokens: response.usage_metadata.output_tokens || 0,
            totalTokens:
              (response.usage_metadata.input_tokens || 0) +
              (response.usage_metadata.output_tokens || 0),
          }
        : undefined,
    }
  }

  /**
   * 聊天 - 流式调用
   */
  async *chatStream(params: ChatParams): AsyncIterable<ChatChunk> {
    const messages = params.messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }))

    const stream = await this.llm.stream(messages)

    for await (const chunk of stream) {
      const content = chunk.content as string

      yield {
        delta: content,
        done: false,
      }
    }

    // 发送结束标记
    yield {
      delta: '',
      done: true,
    }
  }

  /**
   * 嵌入 - 生成向量
   */
  async embed(texts: string[]): Promise<number[][]> {
    if (!this.embeddings) {
      throw new Error('Embeddings not initialized')
    }

    const embeddings = await this.embeddings.embedDocuments(texts)
    return embeddings
  }
}

/**
 * 多模型适配器
 *
 * 支持多种 LLM 提供商
 */
export class MultiModelLLMAdapter implements ILLMAdapter {
  private adapters = new Map<string, ILLMAdapter>()
  private defaultModel: string

  constructor(defaultModel = 'gpt-4') {
    this.defaultModel = defaultModel
  }

  /**
   * 注册模型适配器
   */
  registerModel(name: string, adapter: ILLMAdapter): void {
    this.adapters.set(name, adapter)
  }

  /**
   * 获取模型适配器
   */
  private getAdapter(model?: string): ILLMAdapter {
    const modelName = model ?? this.defaultModel
    const adapter = this.adapters.get(modelName)

    if (!adapter) {
      throw new Error(`Model not found: ${modelName}`)
    }

    return adapter
  }

  /**
   * 聊天
   */
  async chat(params: ChatParams): Promise<ChatResponse> {
    const adapter = this.getAdapter()
    return adapter.chat(params)
  }

  /**
   * 聊天 - 流式
   */
  async *chatStream(params: ChatParams): AsyncIterable<ChatChunk> {
    const adapter = this.getAdapter()
    yield* adapter.chatStream(params)
  }

  /**
   * 嵌入
   */
  async embed(texts: string[]): Promise<number[][]> {
    const adapter = this.getAdapter()
    return adapter.embed(texts)
  }
}
