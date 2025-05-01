/**
 * 主动学习系统 - P2 准确率优化方案 #8
 *
 * 核心理念：让模型主动选择最有价值的样本请求人工标注
 * 从而以更少的标注成本达到更高的准确率
 *
 * 设计原则：
 * 1. 不确定性估计 - 识别模型不确定的样本
 * 2. 主动标注 - 选择最有价值的样本请求人工标注
 * 3. 模型微调 - 基于新数据持续优化
 * 4. 学习效果评估 - A/B 测试、增量评估
 */
import { LLMAdapter } from '../lifecycle/Lifecycle.js'
/**
 * 样本 - 待标注或已标注的数据样本
 */
export interface Sample {
  /** 样本 ID */
  id: string
  /** 输入内容 */
  input: unknown
  /** 当前预测结果 */
  prediction?: unknown
  /** 真实标注（如有） */
  annotation?: Annotation
  /** 不确定性分数 */
  uncertaintyScore?: number
  /** 创建时间 */
  createdAt: Date
  /** 样本来源 */
  source: 'prediction' | 'validation' | 'user_upload' | 'synthetic'
  /** 元数据 */
  metadata?: Record<string, unknown>
}
/**
 * 标注 - 人工标注结果
 */
export interface Annotation {
  /** 标注 ID */
  id: string
  /** 标注值 */
  label: unknown
  /** 标注者 */
  annotator: string
  /** 标注时间 */
  timestamp: Date
  /** 置信度（标注者的置信度，0-1） */
  confidence: number
  /** 标注耗时（毫秒） */
  duration?: number
  /** 标注备注 */
  notes?: string
}
/**
 * 不确定性分数
 */
export interface UncertaintyScore {
  /** 总体不确定性（0-1）*/
  total: number
  /** 预测不确定性 - 模型对预测的不确定程度 */
  prediction: number
  /** 语义不确定性 - 输入的模糊/歧义程度 */
  semantic: number
  /** 分布不确定性 - 多次预测的一致性 */
  distribution?: number
  /** 计算方法 */
  method: 'entropy' | 'variance' | 'margin' | 'confidence'
}
/**
 * 主动学习策略
 */
export type ActiveLearningStrategy =
  | 'uncertainty-sampling'
  | 'diversity-sampling'
  | 'expected-model-change'
/**
 * 主动学习配置
 */
export interface ActiveLearningConfig {
  /** 采样策略 */
  strategy: ActiveLearningStrategy
  /** 标注预算（每次主动学习轮次） */
  annotationBudget: number
  /** 不确定性阈值 - 超过此值触发主动学习 */
  uncertaintyThreshold: number
  /** 多样性采样时的样本数量 */
  diversitySampleSize?: number
  /** 是否启用 A/B 测试 */
  enableABTest: boolean
  /** A/B 测试流量分配（0-1） */
  abTestTrafficSplit?: number
  /** 学习历史存储路径 */
  historyPath?: string
  /** 是否启用渐进式学习 */
  enableIncrementalLearning: boolean
  /** 渐进式学习的最小样本数 */
  minSamplesForUpdate?: number
}
/**
 * 模型更新结果
 */
export interface ModelUpdateResult {
  /** 更新是否成功 */
  success: boolean
  /** 更新前的准确率 */
  previousAccuracy?: number
  /** 更新后的准确率 */
  newAccuracy?: number
  /** 准确率提升 */
  accuracyGain?: number
  /** 使用的样本数 */
  samplesUsed: number
  /** 更新耗时（毫秒） */
  duration: number
  /** 更新时间 */
  timestamp: Date
  /** 错误信息（如果失败） */
  error?: string
}
/**
 * 学习指标 - 评估学习效果
 */
export interface LearningMetrics {
  /** 累计标注样本数 */
  totalAnnotated: number
  /** 累计模型更新次数 */
  totalUpdates: number
  /** 当前准确率 */
  currentAccuracy: number
  /** 初始准确率 */
  initialAccuracy: number
  /** 准确率提升 */
  accuracyGain: number
  /** 学习效率 - 达到相同准确率节省的样本比例 */
  learningEfficiency: number
  /** 最近 N 次更新的准确率趋势 */
  accuracyTrend: number[]
  /** 平均每次更新的准确率提升 */
  avgAccuracyGain: number
}
/**
 * A/B 测试结果
 */
export interface ABTestResult {
  /** 对照组准确率 */
  controlAccuracy: number
  /** 实验组准确率 */
  treatmentAccuracy: number
  /** 显著性 p 值 */
  pValue: number
  /** 是否显著 */
  isSignificant: boolean
  /** 提升幅度 */
  lift: number
  /** 测试时间 */
  timestamp: Date
}
/**
 * 主动学习轮次
 */
export interface LearningRound {
  /** 轮次 ID */
  id: string
  /** 轮次序号 */
  round: number
  /** 开始时间 */
  startTime: Date
  /** 结束时间 */
  endTime?: Date
  /** 选择的样本 */
  selectedSamples: Sample[]
  /** 获取的标注 */
  annotations: Annotation[]
  /** 模型更新结果 */
  updateResult?: ModelUpdateResult
  /** 轮次指标 */
  metrics: {
    samplesRequested: number
    samplesAnnotated: number
    annotationRate: number
    avgUncertainty: number
  }
}
/**
 * 主动学习系统
 *
 * 实现完整的主动学习循环：
 * 1. 估计不确定性
 * 2. 选择样本进行标注
 * 3. 获取人工标注
 * 4. 更新模型
 * 5. 评估学习效果
 */
export declare class ActiveLearningSystem {
  /** 系统配置 */
  private readonly config
  /** LLM 适配器 */
  private readonly llm
  /** 样本池 */
  private samplePool
  /** 已标注样本 */
  private annotatedSamples
  /** 学习轮次历史 */
  private learningRounds
  /** 当前轮次 */
  private currentRound
  /** 学习指标 */
  private metrics
  /** 初始准确率 */
  private initialAccuracy
  /**
   * 创建主动学习系统
   */
  constructor(config: ActiveLearningConfig, llm: LLMAdapter)
  /**
   * 估计预测结果的不确定性
   *
   * @param result 预测结果
   * @param method 计算方法
   * @returns 不确定性分数
   */
  estimateUncertainty(
    result: unknown,
    method?: 'entropy' | 'variance' | 'margin' | 'confidence'
  ): UncertaintyScore
  /**
   * 估计预测不确定性
   */
  private estimatePredictionUncertainty
  /**
   * 计算熵
   */
  private calculateEntropy
  /**
   * 估计语义不确定性
   *
   * 基于输入的模糊、歧义程度
   */
  private estimateSemanticUncertainty
  /**
   * 估计分布不确定性
   *
   * 基于多次预测的一致性
   */
  private estimateDistributionUncertainty
  /**
   * 比较两个预测的差异
   */
  private comparePredictions
  /**
   * 计算总体不确定性
   */
  private calculateTotalUncertainty
  /**
   * 从样本池中选择需要标注的样本
   *
   * @param budget 标注预算（本次选择多少样本）
   * @returns 选中的样本列表
   */
  selectSamplesForAnnotation(budget?: number): Sample[]
  /**
   * 不确定性采样
   *
   * 选择不确定性最高的样本
   */
  private uncertaintySampling
  /**
   * 多样性采样
   *
   * 选择具有代表性的、多样化的样本
   */
  private diversitySampling
  /**
   * 期望模型变化采样
   *
   * 选择预计对模型影响最大的样本
   */
  private expectedModelChangeSampling
  /**
   * 计算两个样本的相似度
   */
  private calculateSimilarity
  /**
   * 分词
   */
  private tokenize
  /**
   * 请求人工标注
   *
   * @param sample 需要标注的样本
   * @param annotator 标注者
   * @returns 标注结果
   */
  annotateWithHuman(sample: Sample, annotator: string): Promise<Annotation>
  /**
   * 添加标注结果
   *
   * @param sampleId 样本 ID
   * @param annotation 标注结果
   */
  addAnnotation(sampleId: string, annotation: Annotation): void
  /**
   * 基于新标注的样本更新模型
   *
   * @param samples 新标注的样本
   * @returns 更新结果
   */
  updateModel(samples: Sample[]): Promise<ModelUpdateResult>
  /**
   * 模拟模型更新
   */
  private simulateModelUpdate
  /**
   * 计算学习效率
   */
  private calculateLearningEfficiency
  /**
   * 运行 A/B 测试
   *
   * @param controlData 对照组数据
   * @param treatmentData 实验组数据
   * @returns A/B 测试结果
   */
  runABTest(controlData: Sample[], treatmentData: Sample[]): Promise<ABTestResult>
  /**
   * 计算准确率
   */
  private calculateAccuracy
  /**
   * 计算 p 值（简化版 t 检验）
   */
  private calculatePValue
  /**
   * 增量评估
   *
   * 评估最近一次更新的效果
   */
  incrementalEvaluate(): Promise<{
    accuracy: number
    gain: number
    trend: 'improving' | 'stable' | 'declining'
  }>
  /**
   * 添加样本到池
   */
  addSample(result: unknown, source?: Sample['source']): Sample
  /**
   * 批量添加样本
   */
  addSamples(results: any[], source?: Sample['source']): Sample[]
  /**
   * 触发主动学习
   */
  private triggerActiveLearning
  /**
   * 运行一轮主动学习
   */
  runLearningRound(): Promise<LearningRound>
  /**
   * 获取学习指标
   */
  getMetrics(): LearningMetrics
  /**
   * 获取学习历史
   */
  getLearningHistory(): LearningRound[]
  /**
   * 获取样本池大小
   */
  getPoolSize(): number
  /**
   * 获取已标注样本数
   */
  getAnnotatedCount(): number
  /**
   * 设置初始准确率
   */
  setInitialAccuracy(accuracy: number): void
  /**
   * 导出学习数据
   */
  exportLearningData(): {
    rounds: LearningRound[]
    metrics: LearningMetrics
    annotatedSamples: Sample[]
  }
  /**
   * 导入学习数据
   */
  importLearningData(data: {
    rounds: LearningRound[]
    metrics: LearningMetrics
    annotatedSamples: Sample[]
  }): void
}
/**
 * 创建默认配置
 */
export declare function createDefaultActiveLearningConfig(): ActiveLearningConfig
/**
 * 创建主动学习系统
 */
export declare function createActiveLearningSystem(
  llm: LLMAdapter,
  config?: Partial<ActiveLearningConfig>
): ActiveLearningSystem
//# sourceMappingURL=ActiveLearningSystem.d.ts.map
