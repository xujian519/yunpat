/**
 * 评估模块统一调优配置
 */

/**
 * 评估模块调优配置
 */
export interface EvaluationTuningConfig {
  /** MARG 三维相似度权重 */
  marg: {
    /** 技术维度权重 */
    technicalWeight: number
    /** 语义维度权重 */
    semanticWeight: number
    /** 结构维度权重 */
    structuralWeight: number
    /** 归一化方法 */
    normalizationMethod: 'minmax' | 'zscore' | 'none'
  }
  /** NovAScore 创新性评估 */
  novaScore: {
    /** ACU 分解深度 */
    acuDecompositionDepth: number
    /** 新颖性权重 */
    noveltyWeight: number
    /** 适用性权重 */
    applicabilityWeight: number
    /** 显著性权重 */
    significanceWeight: number
    /** 相似度阈值 */
    similarityThreshold: number
    /** 高新颖阈值 */
    highNovelThreshold: number
    /** 低新颖阈值 */
    lowNovelThreshold: number
    /** 检索的 top K 数量 */
    topK: number
  }
  /** RND 邻居密度 */
  rnd: {
    /** K 近邻参数 */
    neighborK: number
    /** 密度阈值 */
    densityThreshold: number
    /** 距离度量 */
    distanceMetric: 'cosine' | 'euclidean' | 'manhattan'
    /** 向量搜索的 topK 候选数量 */
    searchTopK: number
  }
  /** SAO2Vec 编码 */
  sao2vec: {
    /** 单文档最大 SAO 提取数 */
    maxSAOPerDocument: number
    /** 编码维度 */
    encodingDimension: number
    /** 是否标准化动词 */
    verbNormalization: boolean
  }
}

/**
 * 默认评估调优配置
 *
 * 调优指南：
 * - 高精度相似度：提高 similarityThreshold (0.75+)，增大 technicalWeight (0.4-0.5)
 * - 严格创新性评估：提高 lowNovelThreshold (0.7+)，增大 significanceWeight (0.35-0.4)
 * - 宽松创新性评估：降低 highNovelThreshold (0.2)，增大 noveltyWeight (0.35-0.4)
 */
export const DEFAULT_EVALUATION_CONFIG: EvaluationTuningConfig = {
  marg: {
    technicalWeight: 0.4,
    semanticWeight: 0.35,
    structuralWeight: 0.25,
    normalizationMethod: 'minmax',
  },
  novaScore: {
    acuDecompositionDepth: 3,
    noveltyWeight: 0.33,
    applicabilityWeight: 0.33,
    significanceWeight: 0.34,
    similarityThreshold: 0.6,
    highNovelThreshold: 0.3,
    lowNovelThreshold: 0.6,
    topK: 3,
  },
  rnd: {
    neighborK: 10,
    densityThreshold: 0.5,
    distanceMetric: 'cosine',
    searchTopK: 100,
  },
  sao2vec: {
    maxSAOPerDocument: 20,
    encodingDimension: 768,
    verbNormalization: true,
  },
}

/**
 * 创建评估调优配置
 */
export function createEvaluationConfig(
  overrides?: Partial<EvaluationTuningConfig>
): EvaluationTuningConfig {
  return {
    marg: {
      ...DEFAULT_EVALUATION_CONFIG.marg,
      ...overrides?.marg,
    },
    novaScore: {
      ...DEFAULT_EVALUATION_CONFIG.novaScore,
      ...overrides?.novaScore,
    },
    rnd: {
      ...DEFAULT_EVALUATION_CONFIG.rnd,
      ...overrides?.rnd,
    },
    sao2vec: {
      ...DEFAULT_EVALUATION_CONFIG.sao2vec,
      ...overrides?.sao2vec,
    },
  }
}

/**
 * 从环境变量读取配置
 */
export function readEvaluationConfigFromEnv(): Partial<EvaluationTuningConfig> {
  const margOverrides: Partial<EvaluationTuningConfig['marg']> = {}
  const novaOverrides: Partial<EvaluationTuningConfig['novaScore']> = {}
  const rndOverrides: Partial<EvaluationTuningConfig['rnd']> = {}

  // MARG 权重
  if (process.env.YUNPAT_MARG_TECHNICAL_WEIGHT) {
    margOverrides.technicalWeight = parseFloat(process.env.YUNPAT_MARG_TECHNICAL_WEIGHT)
  }

  // NovAScore 阈值
  if (process.env.YUNPAT_NOVA_SIMILARITY_THRESHOLD) {
    novaOverrides.similarityThreshold = parseFloat(process.env.YUNPAT_NOVA_SIMILARITY_THRESHOLD)
  }

  // RND K 值
  if (process.env.YUNPAT_RND_NEIGHBOR_K) {
    rndOverrides.neighborK = parseInt(process.env.YUNPAT_RND_NEIGHBOR_K, 10)
  }

  // 仅组装非空的子配置
  const overrides: Partial<EvaluationTuningConfig> = {}
  if (Object.keys(margOverrides).length > 0)
    overrides.marg = margOverrides as EvaluationTuningConfig['marg']
  if (Object.keys(novaOverrides).length > 0)
    overrides.novaScore = novaOverrides as EvaluationTuningConfig['novaScore']
  if (Object.keys(rndOverrides).length > 0)
    overrides.rnd = rndOverrides as EvaluationTuningConfig['rnd']

  return overrides
}

/**
 * 创建评估调优配置（从环境变量读取 + 可选覆盖）
 */
export function createEvaluationConfigWithEnv(
  overrides?: Partial<EvaluationTuningConfig>
): EvaluationTuningConfig {
  const envConfig = readEvaluationConfigFromEnv()
  return createEvaluationConfig({ ...envConfig, ...overrides })
}
