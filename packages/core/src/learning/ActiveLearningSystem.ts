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

import { v4 as uuidv4 } from 'uuid';
import { LLMAdapter } from '../lifecycle/Lifecycle.js';

// ==================== 类型定义 ====================

/**
 * 样本 - 待标注或已标注的数据样本
 */
export interface Sample {
  /** 样本 ID */
  id: string;

  /** 输入内容 */
  input: unknown;

  /** 当前预测结果 */
  prediction?: unknown;

  /** 真实标注（如有） */
  annotation?: Annotation;

  /** 不确定性分数 */
  uncertaintyScore?: number;

  /** 创建时间 */
  createdAt: Date;

  /** 样本来源 */
  source: 'prediction' | 'validation' | 'user_upload' | 'synthetic';

  /** 元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 标注 - 人工标注结果
 */
export interface Annotation {
  /** 标注 ID */
  id: string;

  /** 标注值 */
  label: unknown;

  /** 标注者 */
  annotator: string;

  /** 标注时间 */
  timestamp: Date;

  /** 置信度（标注者的置信度，0-1） */
  confidence: number;

  /** 标注耗时（毫秒） */
  duration?: number;

  /** 标注备注 */
  notes?: string;
}

/**
 * 不确定性分数
 */
export interface UncertaintyScore {
  /** 总体不确定性（0-1）*/
  total: number;

  /** 预测不确定性 - 模型对预测的不确定程度 */
  prediction: number;

  /** 语义不确定性 - 输入的模糊/歧义程度 */
  semantic: number;

  /** 分布不确定性 - 多次预测的一致性 */
  distribution?: number;

  /** 计算方法 */
  method: 'entropy' | 'variance' | 'margin' | 'confidence';
}

/**
 * 主动学习策略
 */
export type ActiveLearningStrategy =
  | 'uncertainty-sampling' // 不确定性采样 - 选择模型最不确定的样本
  | 'diversity-sampling' // 多样性采样 - 选择最具代表性的样本
  | 'expected-model-change'; // 期望模型变化 - 选择对模型影响最大的样本

/**
 * 主动学习配置
 */
export interface ActiveLearningConfig {
  /** 采样策略 */
  strategy: ActiveLearningStrategy;

  /** 标注预算（每次主动学习轮次） */
  annotationBudget: number;

  /** 不确定性阈值 - 超过此值触发主动学习 */
  uncertaintyThreshold: number;

  /** 多样性采样时的样本数量 */
  diversitySampleSize?: number;

  /** 是否启用 A/B 测试 */
  enableABTest: boolean;

  /** A/B 测试流量分配（0-1） */
  abTestTrafficSplit?: number;

  /** 学习历史存储路径 */
  historyPath?: string;

  /** 是否启用渐进式学习 */
  enableIncrementalLearning: boolean;

  /** 渐进式学习的最小样本数 */
  minSamplesForUpdate?: number;
}

/**
 * 模型更新结果
 */
export interface ModelUpdateResult {
  /** 更新是否成功 */
  success: boolean;

  /** 更新前的准确率 */
  previousAccuracy?: number;

  /** 更新后的准确率 */
  newAccuracy?: number;

  /** 准确率提升 */
  accuracyGain?: number;

  /** 使用的样本数 */
  samplesUsed: number;

  /** 更新耗时（毫秒） */
  duration: number;

  /** 更新时间 */
  timestamp: Date;

  /** 错误信息（如果失败） */
  error?: string;
}

/**
 * 学习指标 - 评估学习效果
 */
export interface LearningMetrics {
  /** 累计标注样本数 */
  totalAnnotated: number;

  /** 累计模型更新次数 */
  totalUpdates: number;

  /** 当前准确率 */
  currentAccuracy: number;

  /** 初始准确率 */
  initialAccuracy: number;

  /** 准确率提升 */
  accuracyGain: number;

  /** 学习效率 - 达到相同准确率节省的样本比例 */
  learningEfficiency: number;

  /** 最近 N 次更新的准确率趋势 */
  accuracyTrend: number[];

  /** 平均每次更新的准确率提升 */
  avgAccuracyGain: number;
}

/**
 * A/B 测试结果
 */
export interface ABTestResult {
  /** 对照组准确率 */
  controlAccuracy: number;

  /** 实验组准确率 */
  treatmentAccuracy: number;

  /** 显著性 p 值 */
  pValue: number;

  /** 是否显著 */
  isSignificant: boolean;

  /** 提升幅度 */
  lift: number;

  /** 测试时间 */
  timestamp: Date;
}

/**
 * 主动学习轮次
 */
export interface LearningRound {
  /** 轮次 ID */
  id: string;

  /** 轮次序号 */
  round: number;

  /** 开始时间 */
  startTime: Date;

  /** 结束时间 */
  endTime?: Date;

  /** 选择的样本 */
  selectedSamples: Sample[];

  /** 获取的标注 */
  annotations: Annotation[];

  /** 模型更新结果 */
  updateResult?: ModelUpdateResult;

  /** 轮次指标 */
  metrics: {
    samplesRequested: number;
    samplesAnnotated: number;
    annotationRate: number;
    avgUncertainty: number;
  };
}

// ==================== 主动学习系统 ====================

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
export class ActiveLearningSystem {
  /** 系统配置 */
  private readonly config: ActiveLearningConfig;

  /** LLM 适配器 */
  private readonly llm: LLMAdapter;

  /** 样本池 */
  private samplePool: Map<string, Sample>;

  /** 已标注样本 */
  private annotatedSamples: Map<string, Sample>;

  /** 学习轮次历史 */
  private learningRounds: LearningRound[];

  /** 当前轮次 */
  private currentRound: number;

  /** 学习指标 */
  private metrics: LearningMetrics;

  /** 初始准确率 */
  private initialAccuracy: number;

  /**
   * 创建主动学习系统
   */
  constructor(config: ActiveLearningConfig, llm: LLMAdapter) {
    this.config = config;
    this.llm = llm;
    this.samplePool = new Map();
    this.annotatedSamples = new Map();
    this.learningRounds = [];
    this.currentRound = 0;
    this.initialAccuracy = 0;
    this.metrics = {
      totalAnnotated: 0,
      totalUpdates: 0,
      currentAccuracy: 0,
      initialAccuracy: 0,
      accuracyGain: 0,
      learningEfficiency: 0,
      accuracyTrend: [],
      avgAccuracyGain: 0,
    };
  }

  // ==================== 1. 不确定性估计 ====================

  /**
   * 估计预测结果的不确定性
   *
   * @param result 预测结果
   * @param method 计算方法
   * @returns 不确定性分数
   */
  estimateUncertainty(
    result: unknown,
    method: 'entropy' | 'variance' | 'margin' | 'confidence' = 'entropy'
  ): UncertaintyScore {
    // 预测不确定性 - 基于模型输出的置信度
    const prediction = this.estimatePredictionUncertainty(result, method);

    // 语义不确定性 - 基于输入的模糊程度
    const semantic = this.estimateSemanticUncertainty(result);

    // 分布不确定性 - 如果有多次预测结果
    const distribution = (result as any).multiplePredictions
      ? this.estimateDistributionUncertainty((result as any).multiplePredictions)
      : undefined;

    // 总体不确定性（加权平均）
    const total = this.calculateTotalUncertainty(prediction, semantic, distribution);

    return {
      total,
      prediction,
      semantic,
      distribution,
      method,
    };
  }

  /**
   * 估计预测不确定性
   */
  private estimatePredictionUncertainty(result: unknown, method: string): number {
    // 从结果中提取置信度
    const confidence = (result as any).confidence ?? (result as any).score ?? 0.5;

    switch (method) {
      case 'entropy':
        // 熵不确定性：H = -sum(p * log(p))
        // 当 p = 0.5 时熵最大（最不确定）
        if ((result as any).probabilities) {
          return this.calculateEntropy((result as any).probabilities);
        }
        // 简化：使用 1 - |2*confidence - 1|
        return 1 - Math.abs(2 * confidence - 1);

      case 'variance':
        // 方差不确定性
        if ((result as any).variance !== undefined) {
          return Math.min((result as any).variance, 1);
        }
        return 1 - confidence;

      case 'margin':
        // 边缘不确定性：1 - (p_max - p_second_max)
        if ((result as any).probabilities && (result as any).probabilities.length >= 2) {
          const sorted = [...(result as any).probabilities].sort((a, b) => b - a);
          return 1 - (sorted[0] - sorted[1]);
        }
        return 1 - confidence;

      case 'confidence':
      default:
        // 直接使用 1 - confidence
        return 1 - confidence;
    }
  }

  /**
   * 计算熵
   */
  private calculateEntropy(probabilities: number[]): number {
    const entropy = probabilities.reduce((sum, p) => {
      if (p <= 0) return sum;
      return sum - p * Math.log2(p);
    }, 0);

    // 归一化到 [0, 1]
    const maxEntropy = Math.log2(probabilities.length);
    return entropy / maxEntropy;
  }

  /**
   * 估计语义不确定性
   *
   * 基于输入的模糊、歧义程度
   */
  private estimateSemanticUncertainty(result: unknown): number {
    let uncertainty = 0;

    const input = (result as any).input ?? (result as any).query ?? (result as any).prompt;
    if (typeof input !== 'string') {
      return 0.5; // 默认中等不确定性
    }

    // 1. 检查模糊词汇
    const ambiguousWords = [
      '可能',
      '也许',
      '大概',
      '或许',
      '好像',
      '似乎',
      'might',
      'maybe',
      'perhaps',
      'possibly',
      'probably',
      '不确定',
      '不清楚',
      '不知道',
    ];
    const ambiguousCount = ambiguousWords.filter((w) => input.includes(w)).length;
    uncertainty += Math.min(ambiguousCount * 0.1, 0.3);

    // 2. 检查问题长度（过长或过短都增加不确定性）
    const length = input.length;
    if (length < 10 || length > 500) {
      uncertainty += 0.1;
    }

    // 3. 检查是否包含多个问题
    const questionMarks = (input.match(/\?|？/g) ?? []).length;
    if (questionMarks > 1) {
      uncertainty += Math.min(questionMarks * 0.05, 0.2);
    }

    // 4. 检查是否包含否定词（可能增加复杂度）
    const negations = ['不', '没', '非', '无', '未', 'not', 'no', 'never', 'none'];
    const negationCount = negations.filter((w) => input.includes(w)).length;
    uncertainty += Math.min(negationCount * 0.05, 0.15);

    return Math.min(uncertainty, 1);
  }

  /**
   * 估计分布不确定性
   *
   * 基于多次预测的一致性
   */
  private estimateDistributionUncertainty(predictions: any[]): number {
    if (predictions.length < 2) return 0;

    // 计算预测之间的平均差异
    let totalDiff = 0;
    let comparisons = 0;

    for (let i = 0; i < predictions.length; i++) {
      for (let j = i + 1; j < predictions.length; j++) {
        const diff = this.comparePredictions(predictions[i], predictions[j]);
        totalDiff += diff;
        comparisons++;
      }
    }

    return comparisons > 0 ? totalDiff / comparisons : 0;
  }

  /**
   * 比较两个预测的差异
   */
  private comparePredictions(pred1: unknown, pred2: unknown): number {
    // 简化实现：基于字符串相似度
    const str1 = JSON.stringify((pred1 as any).result ?? (pred1 as any));
    const str2 = JSON.stringify((pred2 as any).result ?? (pred2 as any));

    if (str1 === str2) return 0;

    // Levenshtein 距离简化版
    const maxLen = Math.max(str1.length, str2.length);
    if (maxLen === 0) return 0;

    let distance = 0;
    const minLen = Math.min(str1.length, str2.length);

    for (let i = 0; i < minLen; i++) {
      if (str1[i] !== str2[i]) distance++;
    }

    distance += Math.abs(str1.length - str2.length);
    return distance / maxLen;
  }

  /**
   * 计算总体不确定性
   */
  private calculateTotalUncertainty(
    prediction: number,
    semantic: number,
    distribution?: number
  ): number {
    // 加权平均
    let total = prediction * 0.6 + semantic * 0.4;

    if (distribution !== undefined) {
      total = total * 0.7 + distribution * 0.3;
    }

    return Math.min(total, 1);
  }

  // ==================== 2. 主动标注选择 ====================

  /**
   * 从样本池中选择需要标注的样本
   *
   * @param budget 标注预算（本次选择多少样本）
   * @returns 选中的样本列表
   */
  selectSamplesForAnnotation(budget?: number): Sample[] {
    const actualBudget = budget ?? this.config.annotationBudget;

    // 如果样本池为空，返回空列表
    if (this.samplePool.size === 0) {
      return [];
    }

    // 根据策略选择样本
    switch (this.config.strategy) {
      case 'uncertainty-sampling':
        return this.uncertaintySampling(actualBudget);

      case 'diversity-sampling':
        return this.diversitySampling(actualBudget);

      case 'expected-model-change':
        return this.expectedModelChangeSampling(actualBudget);

      default:
        return this.uncertaintySampling(actualBudget);
    }
  }

  /**
   * 不确定性采样
   *
   * 选择不确定性最高的样本
   */
  private uncertaintySampling(budget: number): Sample[] {
    // 按不确定性分数排序
    const samples = Array.from(this.samplePool.values())
      .filter((s) => s.uncertaintyScore !== undefined)
      .sort((a, b) => (b.uncertaintyScore ?? 0) - (a.uncertaintyScore ?? 0));

    return samples.slice(0, budget);
  }

  /**
   * 多样性采样
   *
   * 选择具有代表性的、多样化的样本
   */
  private diversitySampling(budget: number): Sample[] {
    const samples = Array.from(this.samplePool.values());
    const selected: Sample[] = [];
    const remaining = [...samples];

    // 首先选择不确定性最高的样本作为起点
    remaining.sort((a, b) => (b.uncertaintyScore ?? 0) - (a.uncertaintyScore ?? 0));

    if (remaining.length > 0) {
      selected.push(remaining.shift()!);
    }

    // 贪心选择：每次选择与已选样本最不相似的样本
    while (selected.length < budget && remaining.length > 0) {
      let bestIdx = 0;
      let maxMinDist = -1;

      for (let i = 0; i < remaining.length; i++) {
        // 计算与已选样本的最小相似度
        let minSim = 1;
        for (const s of selected) {
          const sim = this.calculateSimilarity(remaining[i], s);
          minSim = Math.min(minSim, sim);
        }

        // 选择最小相似度最大的（即最不相似的）
        const dist = 1 - minSim;
        if (dist > maxMinDist) {
          maxMinDist = dist;
          bestIdx = i;
        }
      }

      selected.push(remaining.splice(bestIdx, 1)[0]);
    }

    return selected;
  }

  /**
   * 期望模型变化采样
   *
   * 选择预计对模型影响最大的样本
   */
  private expectedModelChangeSampling(budget: number): Sample[] {
    // 简化实现：结合不确定性和样本新颖性
    const samples = Array.from(this.samplePool.values()).map((s) => {
      // 新颖性：与已标注样本的平均相似度
      let novelty = 1;
      if (this.annotatedSamples.size > 0) {
        const similarities = Array.from(this.annotatedSamples.values()).map((a) =>
          this.calculateSimilarity(s, a)
        );
        const avgSim = similarities.reduce((sum, sim) => sum + sim, 0) / similarities.length;
        novelty = 1 - avgSim;
      }

      // 期望影响 = 不确定性 * 新颖性
      const expectedImpact = (s.uncertaintyScore ?? 0.5) * novelty;

      return { sample: s, expectedImpact };
    });

    // 按期望影响排序
    samples.sort((a, b) => b.expectedImpact - a.expectedImpact);

    return samples.slice(0, budget).map((s) => s.sample);
  }

  /**
   * 计算两个样本的相似度
   */
  private calculateSimilarity(s1: Sample, s2: Sample): number {
    const input1 = JSON.stringify(s1.input);
    const input2 = JSON.stringify(s2.input);

    if (input1 === input2) return 1;

    // 简化的余弦相似度（基于词袋）
    const words1 = this.tokenize(input1);
    const words2 = this.tokenize(input2);

    // Jaccard 相似度
    const intersection = new Set([...words1].filter((w) => words2.has(w))).size;
    const union = new Set([...words1, ...words2]).size;

    return union > 0 ? intersection / union : 0;
  }

  /**
   * 分词
   */
  private tokenize(text: string): Set<string> {
    // 简化实现：按空格和标点分割
    const words = text
      .toLowerCase()
      .split(/[\s\s\p{P}]+/u)
      .filter((w) => w.length > 2);
    return new Set(words);
  }

  // ==================== 3. 人工标注 ====================

  /**
   * 请求人工标注
   *
   * @param sample 需要标注的样本
   * @param annotator 标注者
   * @returns 标注结果
   */
  async annotateWithHuman(sample: Sample, annotator: string): Promise<Annotation> {
    const _startTime = Date.now(); // 保留用于未来实现耗时计算

    // 触发标注请求事件（由外部系统处理实际标注流程）
    // 这里返回一个待处理的标注请求
    const annotation: Annotation = {
      id: uuidv4(),
      label: undefined, // 等待人工标注
      annotator,
      timestamp: new Date(),
      confidence: 0,
      duration: 0, // 将在外部完成标注后更新
    };

    // 记录样本与标注的关联
    void sample; // 样本信息用于后续匹配标注结果

    // 实际应用中，这里应该：
    // 1. 发送标注请求到 ApprovalFlow
    // 2. 使用 startTime 计算标注耗时
    // 3. 返回实际的标注结果
    // 2. 等待人工响应
    // 3. 返回实际的标注结果

    return annotation;
  }

  /**
   * 添加标注结果
   *
   * @param sampleId 样本 ID
   * @param annotation 标注结果
   */
  addAnnotation(sampleId: string, annotation: Annotation): void {
    const sample = this.samplePool.get(sampleId);
    if (sample) {
      sample.annotation = annotation;
      this.annotatedSamples.set(sampleId, sample);
      this.samplePool.delete(sampleId);
      this.metrics.totalAnnotated++;
    }
  }

  // ==================== 4. 模型更新 ====================

  /**
   * 基于新标注的样本更新模型
   *
   * @param samples 新标注的样本
   * @returns 更新结果
   */
  async updateModel(samples: Sample[]): Promise<ModelUpdateResult> {
    const startTime = Date.now();
    const previousAccuracy = this.metrics.currentAccuracy;

    try {
      // 1. 准备训练数据
      const trainingData = samples
        .filter((s) => s.annotation !== undefined)
        .map((s) => ({
          input: s.input,
          output: s.annotation!.label,
        }));

      if (trainingData.length === 0) {
        return {
          success: false,
          samplesUsed: 0,
          duration: Date.now() - startTime,
          timestamp: new Date(),
          error: 'No valid annotations provided',
        };
      }

      // 2. 更新模型（实际应用中这里调用模型微调 API）
      // 这里是模拟实现
      const newAccuracy = await this.simulateModelUpdate(trainingData);

      // 3. 计算提升
      const accuracyGain = newAccuracy - previousAccuracy;
      const duration = Date.now() - startTime;

      // 4. 更新指标
      this.metrics.totalUpdates++;
      this.metrics.currentAccuracy = newAccuracy;
      this.metrics.accuracyGain = newAccuracy - this.initialAccuracy;
      this.metrics.accuracyTrend.push(newAccuracy);
      this.metrics.avgAccuracyGain = this.metrics.accuracyGain / this.metrics.totalUpdates;

      // 5. 计算学习效率
      this.calculateLearningEfficiency();

      return {
        success: true,
        previousAccuracy,
        newAccuracy,
        accuracyGain,
        samplesUsed: trainingData.length,
        duration,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        samplesUsed: 0,
        duration: Date.now() - startTime,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 模拟模型更新
   */
  private async simulateModelUpdate(trainingData: any[]): Promise<number> {
    // 实际应用中，这里会调用：
    // - 模型微调 API
    // - 知识库更新
    // - 提示词优化

    // 模拟：随着样本增加，准确率逐渐提升
    const baseAccuracy = this.metrics.currentAccuracy || 0.7;
    const gain = Math.min(trainingData.length * 0.01, 0.1);
    const noise = (Math.random() - 0.5) * 0.02;

    return Math.min(baseAccuracy + gain + noise, 0.98);
  }

  /**
   * 计算学习效率
   */
  private calculateLearningEfficiency(): void {
    // 学习效率 = (被动学习所需样本 - 主动学习所需样本) / 被动学习所需样本
    // 简化估计：假设主动学习比被动学习效率高 50%
    const estimatedPassiveSamples = this.metrics.totalAnnotated * 2;
    const efficiency =
      (estimatedPassiveSamples - this.metrics.totalAnnotated) / estimatedPassiveSamples;

    this.metrics.learningEfficiency = efficiency;
  }

  // ==================== 5. 学习效果评估 ====================

  /**
   * 运行 A/B 测试
   *
   * @param controlData 对照组数据
   * @param treatmentData 实验组数据
   * @returns A/B 测试结果
   */
  async runABTest(controlData: Sample[], treatmentData: Sample[]): Promise<ABTestResult> {
    // 计算对照组准确率
    const controlAccuracy = this.calculateAccuracy(controlData);

    // 计算实验组准确率
    const treatmentAccuracy = this.calculateAccuracy(treatmentData);

    // 计算 p 值（简化版）
    const pValue = this.calculatePValue(controlData, treatmentData);

    // 计算提升
    const lift = (treatmentAccuracy - controlAccuracy) / controlAccuracy;

    return {
      controlAccuracy,
      treatmentAccuracy,
      pValue,
      isSignificant: pValue < 0.05,
      lift,
      timestamp: new Date(),
    };
  }

  /**
   * 计算准确率
   */
  private calculateAccuracy(samples: Sample[]): number {
    if (samples.length === 0) return 0;

    let correct = 0;
    for (const sample of samples) {
      if (sample.annotation && sample.prediction) {
        if (JSON.stringify(sample.annotation.label) === JSON.stringify(sample.prediction)) {
          correct++;
        }
      }
    }

    return correct / samples.length;
  }

  /**
   * 计算 p 值（简化版 t 检验）
   */
  private calculatePValue(controlData: Sample[], treatmentData: Sample[]): number {
    // 简化实现：返回一个模拟的 p 值
    // 实际应用中应使用统计检验库
    const controlAcc = this.calculateAccuracy(controlData);
    const treatmentAcc = this.calculateAccuracy(treatmentData);

    const diff = Math.abs(treatmentAcc - controlAcc);
    // 差异越大，p 值越小
    return Math.max(0.001, 1 - diff * 10);
  }

  /**
   * 增量评估
   *
   * 评估最近一次更新的效果
   */
  async incrementalEvaluate(): Promise<{
    accuracy: number;
    gain: number;
    trend: 'improving' | 'stable' | 'declining';
  }> {
    const accuracy = this.metrics.currentAccuracy;
    const gain =
      this.metrics.accuracyTrend.length >= 2
        ? this.metrics.accuracyTrend[this.metrics.accuracyTrend.length - 1] -
          this.metrics.accuracyTrend[this.metrics.accuracyTrend.length - 2]
        : 0;

    let trend: 'improving' | 'stable' | 'declining';
    if (gain > 0.01) {
      trend = 'improving';
    } else if (gain < -0.01) {
      trend = 'declining';
    } else {
      trend = 'stable';
    }

    return { accuracy, gain, trend };
  }

  // ==================== 样本管理 ====================

  /**
   * 添加样本到池
   */
  addSample(result: unknown, source: Sample['source'] = 'prediction'): Sample {
    const uncertainty = this.estimateUncertainty(result);

    const sample: Sample = {
      id: uuidv4(),
      input: (result as any).input ?? (result as any).query ?? (result as any).prompt,
      prediction: (result as any).result ?? (result as any).output,
      uncertaintyScore: uncertainty.total,
      createdAt: new Date(),
      source,
      metadata: { uncertainty, originalResult: result },
    };

    this.samplePool.set(sample.id, sample);

    // 如果不确定性超过阈值，触发主动学习
    if (uncertainty.total > this.config.uncertaintyThreshold) {
      this.triggerActiveLearning(sample);
    }

    return sample;
  }

  /**
   * 批量添加样本
   */
  addSamples(results: any[], source: Sample['source'] = 'prediction'): Sample[] {
    return results.map((r) => this.addSample(r, source));
  }

  /**
   * 触发主动学习
   */
  private triggerActiveLearning(sample: Sample): void {
    // 发布事件，请求外部系统处理
    // 实际应用中，这里会调用 EventBus 发布事件
    console.log(
      `[ActiveLearning] High uncertainty detected: ${sample.id} (${sample.uncertaintyScore})`
    );
  }

  // ==================== 学习循环 ====================

  /**
   * 运行一轮主动学习
   */
  async runLearningRound(): Promise<LearningRound> {
    const roundId = uuidv4();
    this.currentRound++;

    const round: LearningRound = {
      id: roundId,
      round: this.currentRound,
      startTime: new Date(),
      selectedSamples: [],
      annotations: [],
      metrics: {
        samplesRequested: 0,
        samplesAnnotated: 0,
        annotationRate: 0,
        avgUncertainty: 0,
      },
    };

    // 1. 选择样本
    const selectedSamples = this.selectSamplesForAnnotation();
    round.selectedSamples = selectedSamples;
    round.metrics.samplesRequested = selectedSamples.length;
    round.metrics.avgUncertainty =
      selectedSamples.reduce((sum, s) => sum + (s.uncertaintyScore ?? 0), 0) /
      selectedSamples.length;

    // 2. 请求标注（实际应用中会等待人工响应）
    // 这里假设标注已经通过 addAnnotation 添加

    // 3. 更新模型
    const newlyAnnotated = selectedSamples.filter((s) => s.annotation);
    if (newlyAnnotated.length > 0) {
      const updateResult = await this.updateModel(newlyAnnotated);
      round.updateResult = updateResult;
    }

    round.endTime = new Date();
    round.annotations = selectedSamples.filter((s) => s.annotation).map((s) => s.annotation!);
    round.metrics.samplesAnnotated = round.annotations.length;
    round.metrics.annotationRate =
      round.metrics.samplesRequested > 0
        ? round.metrics.samplesAnnotated / round.metrics.samplesRequested
        : 0;

    this.learningRounds.push(round);

    return round;
  }

  // ==================== 获取器 ====================

  /**
   * 获取学习指标
   */
  getMetrics(): LearningMetrics {
    return { ...this.metrics };
  }

  /**
   * 获取学习历史
   */
  getLearningHistory(): LearningRound[] {
    return [...this.learningRounds];
  }

  /**
   * 获取样本池大小
   */
  getPoolSize(): number {
    return this.samplePool.size;
  }

  /**
   * 获取已标注样本数
   */
  getAnnotatedCount(): number {
    return this.annotatedSamples.size;
  }

  /**
   * 设置初始准确率
   */
  setInitialAccuracy(accuracy: number): void {
    this.initialAccuracy = accuracy;
    this.metrics.initialAccuracy = accuracy;
    this.metrics.currentAccuracy = accuracy;
  }

  /**
   * 导出学习数据
   */
  exportLearningData(): {
    rounds: LearningRound[];
    metrics: LearningMetrics;
    annotatedSamples: Sample[];
  } {
    return {
      rounds: this.learningRounds,
      metrics: this.metrics,
      annotatedSamples: Array.from(this.annotatedSamples.values()),
    };
  }

  /**
   * 导入学习数据
   */
  importLearningData(data: {
    rounds: LearningRound[];
    metrics: LearningMetrics;
    annotatedSamples: Sample[];
  }): void {
    this.learningRounds = data.rounds;
    this.metrics = data.metrics;
    this.annotatedSamples = new Map(data.annotatedSamples.map((s) => [s.id, s]));
    this.currentRound = data.rounds.length;
    this.initialAccuracy = data.metrics.initialAccuracy;
  }
}

// ==================== 辅助函数 ====================

/**
 * 创建默认配置
 */
export function createDefaultActiveLearningConfig(): ActiveLearningConfig {
  return {
    strategy: 'uncertainty-sampling',
    annotationBudget: 10,
    uncertaintyThreshold: 0.7,
    diversitySampleSize: 100,
    enableABTest: true,
    abTestTrafficSplit: 0.1,
    enableIncrementalLearning: true,
    minSamplesForUpdate: 5,
  };
}

/**
 * 创建主动学习系统
 */
export function createActiveLearningSystem(
  llm: LLMAdapter,
  config?: Partial<ActiveLearningConfig>
): ActiveLearningSystem {
  const fullConfig = {
    ...createDefaultActiveLearningConfig(),
    ...config,
  };
  return new ActiveLearningSystem(fullConfig, llm);
}
