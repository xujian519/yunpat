/**
 * 检索模块统一调优配置
 * 所有参数提供默认值，可通过环境变量或构造函数覆盖
 */

/**
 * 检索模块调优配置
 */
export interface RetrievalTuningConfig {
  /** RAGEngine 基础参数 */
  rag: {
    /** 默认返回结果数 */
    defaultTopK: number
    /** 相似度阈值 */
    similarityThreshold: number
    /** 是否启用重排序 */
    rerankEnabled: boolean
    /** 最大重试次数 */
    maxRetries: number
  }
  /** GraphRAG 图增强参数 */
  graphRag: {
    /** 图扩展深度 */
    expansionDepth: number
    /** 每层扩展的实体数量 */
    topKPerLevel: number
    /** 关系权重衰减因子 */
    relationWeightDecay: number
    /** 图结果提升因子 */
    graphBoostFactor: number
    /** 最小图关联度 */
    minGraphRelevance: number
    /** 向量检索权重 */
    vectorWeight: number
    /** 图检索权重 */
    graphWeight: number
    /** 去重相似度阈值 */
    dedupThreshold: number
  }
  /** AgenticRAG 自适应参数 */
  agenticRag: {
    /** 最大检索步数 */
    maxSteps: number
    /** 置信度阈值 */
    confidenceThreshold: number
    /** 是否启用查询优化 */
    queryRefinementEnabled: boolean
    /** 是否自适应 topK */
    adaptiveTopK: boolean
  }
  /** SemanticChunker 分块参数 */
  semanticChunker: {
    /** 最小分块大小（字符） */
    minChunkSize: number
    /** 最大分块大小（字符） */
    maxChunkSize: number
    /** 语义边界阈值 */
    boundaryThreshold: number
    /** 重叠大小 */
    overlapSize: number
    /** 嵌入批处理大小 */
    embeddingBatchSize: number
  }
}

/**
 * 默认检索调优配置
 *
 * 调优指南：
 * - 高精度场景：增大 defaultTopK (10-20)，提高 similarityThreshold (0.75+)
 * - 快速响应场景：减小 defaultTopK (5-10)，降低 similarityThreshold (0.65)
 * - 图增强场景：增大 expansionDepth (2-3)，提高 graphWeight (0.35-0.4)
 * - 自适应检索：增大 maxSteps (3-5)，提高 confidenceThreshold (0.75+)
 */
export const DEFAULT_RETRIEVAL_CONFIG: RetrievalTuningConfig = {
  rag: {
    defaultTopK: 10,
    similarityThreshold: 0.7,
    rerankEnabled: true,
    maxRetries: 3,
  },
  graphRag: {
    expansionDepth: 2,
    topKPerLevel: 5,
    relationWeightDecay: 0.9,
    graphBoostFactor: 1.2,
    minGraphRelevance: 0.3,
    vectorWeight: 0.7,
    graphWeight: 0.3,
    dedupThreshold: 0.95,
  },
  agenticRag: {
    maxSteps: 3,
    confidenceThreshold: 0.7,
    queryRefinementEnabled: true,
    adaptiveTopK: false,
  },
  semanticChunker: {
    minChunkSize: 100,
    maxChunkSize: 2000,
    boundaryThreshold: 0.5,
    overlapSize: 50,
    embeddingBatchSize: 32,
  },
}

/**
 * 创建检索调优配置
 *
 * @param overrides - 配置覆盖项（可选）
 * @returns 合并后的配置
 */
export function createRetrievalConfig(
  overrides?: Partial<RetrievalTuningConfig>
): RetrievalTuningConfig {
  return {
    rag: {
      ...DEFAULT_RETRIEVAL_CONFIG.rag,
      ...overrides?.rag,
    },
    graphRag: {
      ...DEFAULT_RETRIEVAL_CONFIG.graphRag,
      ...overrides?.graphRag,
    },
    agenticRag: {
      ...DEFAULT_RETRIEVAL_CONFIG.agenticRag,
      ...overrides?.agenticRag,
    },
    semanticChunker: {
      ...DEFAULT_RETRIEVAL_CONFIG.semanticChunker,
      ...overrides?.semanticChunker,
    },
  }
}

/**
 * 从环境变量读取配置
 *
 * 支持的环境变量：
 * - YUNPAT_RAG_TOP_K
 * - YUNPAT_RAG_SIMILARITY_THRESHOLD
 * - YUNPAT_GRAPH_RAG_EXPANSION_DEPTH
 * - YUNPAT_GRAPH_RAG_VECTOR_WEIGHT
 * - YUNPAT_AGENTIC_RAG_MAX_STEPS
 * - YUNPAT_CHUNKER_MIN_SIZE
 * - YUNPAT_CHUNKER_MAX_SIZE
 */
export function readRetrievalConfigFromEnv(): Partial<RetrievalTuningConfig> {
  const ragOverrides: Partial<RetrievalTuningConfig['rag']> = {}
  const graphRagOverrides: Partial<RetrievalTuningConfig['graphRag']> = {}
  const agenticRagOverrides: Partial<RetrievalTuningConfig['agenticRag']> = {}
  const chunkerOverrides: Partial<RetrievalTuningConfig['semanticChunker']> = {}

  // RAG 基础参数
  if (process.env.YUNPAT_RAG_TOP_K) {
    ragOverrides.defaultTopK = parseInt(process.env.YUNPAT_RAG_TOP_K, 10)
  }
  if (process.env.YUNPAT_RAG_SIMILARITY_THRESHOLD) {
    ragOverrides.similarityThreshold = parseFloat(
      process.env.YUNPAT_RAG_SIMILARITY_THRESHOLD
    )
  }

  // GraphRAG 参数
  if (process.env.YUNPAT_GRAPH_RAG_EXPANSION_DEPTH) {
    graphRagOverrides.expansionDepth = parseInt(
      process.env.YUNPAT_GRAPH_RAG_EXPANSION_DEPTH,
      10
    )
  }
  if (process.env.YUNPAT_GRAPH_RAG_VECTOR_WEIGHT) {
    graphRagOverrides.vectorWeight = parseFloat(
      process.env.YUNPAT_GRAPH_RAG_VECTOR_WEIGHT
    )
  }

  // AgenticRAG 参数
  if (process.env.YUNPAT_AGENTIC_RAG_MAX_STEPS) {
    agenticRagOverrides.maxSteps = parseInt(
      process.env.YUNPAT_AGENTIC_RAG_MAX_STEPS,
      10
    )
  }

  // SemanticChunker 参数
  if (process.env.YUNPAT_CHUNKER_MIN_SIZE) {
    chunkerOverrides.minChunkSize = parseInt(process.env.YUNPAT_CHUNKER_MIN_SIZE, 10)
  }
  if (process.env.YUNPAT_CHUNKER_MAX_SIZE) {
    chunkerOverrides.maxChunkSize = parseInt(process.env.YUNPAT_CHUNKER_MAX_SIZE, 10)
  }

  // 仅组装非空的子配置
  const overrides: Partial<RetrievalTuningConfig> = {}
  if (Object.keys(ragOverrides).length > 0) overrides.rag = ragOverrides as RetrievalTuningConfig['rag']
  if (Object.keys(graphRagOverrides).length > 0) overrides.graphRag = graphRagOverrides as RetrievalTuningConfig['graphRag']
  if (Object.keys(agenticRagOverrides).length > 0) overrides.agenticRag = agenticRagOverrides as RetrievalTuningConfig['agenticRag']
  if (Object.keys(chunkerOverrides).length > 0) overrides.semanticChunker = chunkerOverrides as RetrievalTuningConfig['semanticChunker']

  return overrides
}

/**
 * 创建检索调优配置（从环境变量读取 + 可选覆盖）
 *
 * @param overrides - 配置覆盖项（可选，优先级高于环境变量）
 * @returns 合并后的配置
 */
export function createRetrievalConfigWithEnv(
  overrides?: Partial<RetrievalTuningConfig>
): RetrievalTuningConfig {
  const envConfig = readRetrievalConfigFromEnv()
  return createRetrievalConfig({ ...envConfig, ...overrides })
}