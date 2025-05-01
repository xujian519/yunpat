import { ChatOpenAI } from '@langchain/openai'
/**
 * LangChain LLM 适配器
 *
 * 将 LangChain 的 ChatOpenAI 适配到统一的 LLM 接口
 */
export class LangChainAdapter {
  llm
  constructor(config) {
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
  }
  /**
   * 聊天 - 单次调用
   */
  async chat(params) {
    // 转换消息格式
    const messages = params.messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }))
    // 调用 LangChain
    const response = await this.llm.call(messages)
    return {
      message: {
        role: 'assistant',
        content: response.content,
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
  async *chatStream(params) {
    const messages = params.messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }))
    const stream = await this.llm.stream(messages)
    for await (const chunk of stream) {
      const content = chunk.content
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
   *
   * TODO: 实现嵌入功能
   */
  async embed(_texts) {
    throw new Error('Embedding not implemented yet')
  }
}
/**
 * 多模型适配器
 *
 * 支持多种 LLM 提供商
 */
export class MultiModelLLMAdapter {
  adapters = new Map()
  defaultModel
  constructor(defaultModel = 'gpt-4') {
    this.defaultModel = defaultModel
  }
  /**
   * 注册模型适配器
   */
  registerModel(name, adapter) {
    this.adapters.set(name, adapter)
  }
  /**
   * 获取模型适配器
   */
  getAdapter(model) {
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
  async chat(params) {
    const adapter = this.getAdapter()
    return adapter.chat(params)
  }
  /**
   * 聊天 - 流式
   */
  async *chatStream(params) {
    const adapter = this.getAdapter()
    yield* adapter.chatStream(params)
  }
  /**
   * 嵌入
   */
  async embed(texts) {
    const adapter = this.getAdapter()
    return adapter.embed(texts)
  }
}
//# sourceMappingURL=LLMAdapter.js.map
