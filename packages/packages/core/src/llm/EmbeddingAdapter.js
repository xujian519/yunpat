/**
 * 嵌入向量适配器
 *
 * 支持通过 OpenAI 兼容的 /embeddings 端点生成向量
 * 默认使用 BGE-M3 模型 (localhost:8009)
 */
import { BaseEmbeddingProvider, EmbeddingError, EmbeddingErrorCode } from './EmbeddingProvider.js'
/**
 * 默认配置
 */
const DEFAULT_CONFIG = {
  model: 'bge-m3-mlx-8bit',
  timeout: 30000,
  batchSize: 32,
  normalize: true,
}
/**
 * OpenAI 兼容嵌入适配器
 *
 * 支持 BGE-M3、M3E 等兼容 OpenAI /embeddings 端点的模型
 */
export class EmbeddingAdapter extends BaseEmbeddingProvider {
  config
  capabilities
  constructor(config) {
    super()
    this.config = {
      baseURL: config.baseURL,
      model: config.model ?? DEFAULT_CONFIG.model,
      timeout: config.timeout ?? DEFAULT_CONFIG.timeout,
      batchSize: config.batchSize ?? DEFAULT_CONFIG.batchSize,
      normalize: config.normalize ?? DEFAULT_CONFIG.normalize,
      apiKey: config.apiKey,
    }
    // 设置默认能力（BGE-M3: 1024 维）
    this.capabilities = {
      dimension: 1024,
      maxTokens: 8192,
      maxBatchSize: this.config.batchSize,
      supportsNormalization: true,
    }
  }
  /**
   * 批量嵌入
   */
  async embed(params) {
    const { texts, normalize = this.config.normalize } = params
    // 验证输入
    this.validateInput(texts)
    if (texts.length === 0) {
      return {
        embeddings: [],
        dimension: this.capabilities.dimension,
        model: this.config.model,
      }
    }
    try {
      // 分批处理
      const embeddings = await this.processBatch(texts, this.config.batchSize, async (batch) => {
        return await this.embedBatch(batch)
      })
      // 归一化处理
      const finalEmbeddings = normalize ? embeddings.map((emb) => this.normalize(emb)) : embeddings
      return {
        embeddings: finalEmbeddings,
        dimension: this.capabilities.dimension,
        model: this.config.model,
      }
    } catch (error) {
      if (error instanceof EmbeddingError) {
        throw error
      }
      throw new EmbeddingError(
        `嵌入失败: ${error instanceof Error ? error.message : String(error)}`,
        EmbeddingErrorCode.API_ERROR,
        this.config.model
      )
    }
  }
  /**
   * 嵌入单个文本
   */
  async embedSingle(text, normalize = this.config.normalize) {
    const result = await this.embed({ texts: [text], normalize })
    return {
      embedding: result.embeddings[0],
      model: result.model,
    }
  }
  /**
   * 获取能力元数据
   */
  getCapabilities() {
    return { ...this.capabilities }
  }
  /**
   * 获取模型名称
   */
  getModel() {
    return this.config.model
  }
  /**
   * 调用 API 嵌入一批文本
   */
  async embedBatch(texts) {
    const url = `${this.config.baseURL}/embeddings`
    const headers = {
      'Content-Type': 'application/json',
    }
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`
    }
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: this.config.model,
          input: texts,
        }),
        signal: AbortSignal.timeout(this.config.timeout),
      })
      if (!response.ok) {
        const errorText = await response.text().catch(() => '')
        throw new EmbeddingError(
          `API 请求失败: ${response.status} ${errorText}`,
          EmbeddingErrorCode.API_ERROR,
          this.config.model
        )
      }
      const data = await response.json()
      // 验证响应格式
      if (!data.data || !Array.isArray(data.data)) {
        throw new EmbeddingError(
          'API 返回格式异常: 缺少 data 字段',
          EmbeddingErrorCode.API_ERROR,
          this.config.model
        )
      }
      // 按 index 排序确保顺序正确
      const sorted = data.data.sort((a, b) => a.index - b.index)
      // 验证向量维度
      const embeddings = sorted.map((item) => {
        const embedding = item.embedding
        this.validateDimension(embedding, this.capabilities.dimension)
        return embedding
      })
      return embeddings
    } catch (error) {
      if (error instanceof EmbeddingError) {
        throw error
      }
      // 网络错误或其他异常
      throw new EmbeddingError(
        `网络请求失败: ${error instanceof Error ? error.message : String(error)}`,
        EmbeddingErrorCode.API_ERROR,
        this.config.model
      )
    }
  }
  /**
   * 更新能力配置
   *
   * 用于不同模型的能力设置
   */
  setCapabilities(capabilities) {
    this.capabilities = {
      ...this.capabilities,
      ...capabilities,
    }
  }
}
/**
 * 创建 BGE-M3 嵌入适配器
 *
 * BGE-M3: 1024 维，支持多语言
 */
export function createBGEEmbedding(baseURL = 'http://localhost:8009/v1', apiKey) {
  const adapter = new EmbeddingAdapter({
    baseURL,
    model: 'bge-m3-mlx-8bit',
    apiKey,
  })
  // BGE-M3: 1024 维
  adapter.setCapabilities({
    dimension: 1024,
    maxTokens: 8192,
    maxBatchSize: 32,
    supportsNormalization: true,
  })
  return adapter
}
/**
 * 创建 M3E-base 嵌入适配器
 *
 * M3E-base: 768 维，中文优化
 */
export function createM3EEmbedding(baseURL = 'http://localhost:8009/v1', apiKey) {
  const adapter = new EmbeddingAdapter({
    baseURL,
    model: 'm3e-base',
    apiKey,
  })
  // M3E-base: 768 维
  adapter.setCapabilities({
    dimension: 768,
    maxTokens: 512,
    maxBatchSize: 32,
    supportsNormalization: true,
  })
  return adapter
}
//# sourceMappingURL=EmbeddingAdapter.js.map
