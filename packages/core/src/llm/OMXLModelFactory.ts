/**
 * OMXL 模型工厂
 *
 * 根据任务类型自动选择合适的本地模型
 */

import { OMLXAdapter, type OMLXConfig } from './OMXLAdapter.js';

/**
 * 任务类型
 */
export enum TaskType {
  /** 快速对话 */
  CHAT_SIMPLE = 'chat_simple',

  /** 复杂推理 */
  REASONING_COMPLEX = 'reasoning_complex',

  /** 专利撰写 */
  PATENT_WRITING = 'patent_writing',

  /** 专利检索 */
  PATENT_RETRIEVAL = 'patent_retrieval',

  /** 代码生成 */
  CODE_GENERATION = 'code_generation',

  /** 文档摘要 */
  DOCUMENT_SUMMARY = 'document_summary',

  /** 长文本生成 */
  LONG_FORM_GENERATION = 'long_form_generation',
}

/**
 * 模型推荐
 */
export interface ModelRecommendation {
  /** 模型名称 */
  modelName: string;

  /** 推荐理由 */
  reason: string;

  /** 预期速度 (tokens/s) */
  speed: number;

  /** 预期质量 (1-5) */
  quality: number;

  /** 内存占用 (GB) */
  memoryGB: number;
}

/**
 * 任务与模型映射
 */
const TASK_MODEL_MAP: Record<TaskType, ModelRecommendation> = {
  [TaskType.CHAT_SIMPLE]: {
    modelName: 'gemma-4-e2b-it-4bit',
    reason: '轻量快速，适合简单对话',
    speed: 50,
    quality: 3,
    memoryGB: 5,
  },

  [TaskType.REASONING_COMPLEX]: {
    modelName: 'Qwen3.5-27B-Claude-4.6-Opus-Distilled-MLX-4bit',
    reason: '27B 参数提供强大推理能力',
    speed: 18,
    quality: 5,
    memoryGB: 17,
  },

  [TaskType.PATENT_WRITING]: {
    modelName: 'Qwen3.5-27B-Claude-4.6-Opus-Distilled-MLX-4bit',
    reason: 'Claude Opus 蒸馏版，擅长长文本生成',
    speed: 18,
    quality: 5,
    memoryGB: 17,
  },

  [TaskType.PATENT_RETRIEVAL]: {
    modelName: 'gemma-4-e2b-it-4bit',
    reason: '快速检索，适合关键词匹配',
    speed: 50,
    quality: 3,
    memoryGB: 5,
  },

  [TaskType.CODE_GENERATION]: {
    modelName: 'Qwen3.5-27B-Claude-4.6-Opus-Distilled-MLX-4bit',
    reason: 'Qwen 系列在代码任务上表现优秀',
    speed: 18,
    quality: 5,
    memoryGB: 17,
  },

  [TaskType.DOCUMENT_SUMMARY]: {
    modelName: 'gemma-4-e2b-it-4bit',
    reason: '快速摘要，性价比高',
    speed: 50,
    quality: 3,
    memoryGB: 5,
  },

  [TaskType.LONG_FORM_GENERATION]: {
    modelName: 'Qwen3.5-27B-Claude-4.6-Opus-Distilled-MLX-4bit',
    reason: '长文本生成需要大模型能力',
    speed: 18,
    quality: 5,
    memoryGB: 17,
  },
};

/**
 * OMXL 模型工厂
 */
export class OMXLModelFactory {
  private static defaultConfig: OMLXConfig = {
    baseURL: 'http://localhost:8009/v1',
    apiKey: process.env.OMXL_API_KEY || '',
    modelName: 'gemma-4-e2b-it-4bit',
    temperature: 0.7,
    maxTokens: 2048,
    timeout: 180000,  // 本地模型需要更长时间，增加到3分钟
  };

  /**
   * 根据任务类型创建适配器
   */
  static createForTask(taskType: TaskType): OMLXAdapter {
    const recommendation = TASK_MODEL_MAP[taskType];

    console.log(`\n🎯 任务类型: ${taskType}`);
    console.log(`📦 推荐模型: ${recommendation.modelName}`);
    console.log(`💡 推荐理由: ${recommendation.reason}`);
    console.log(`⚡ 预期速度: ~${recommendation.speed} tokens/s`);
    console.log(`⭐ 质量评分: ${recommendation.quality}/5`);
    console.log(`💾 内存占用: ~${recommendation.memoryGB} GB\n`);

    return new OMLXAdapter({
      baseURL: this.defaultConfig.baseURL,
      apiKey: this.defaultConfig.apiKey,
      modelName: recommendation.modelName,
      temperature: this.getDefaultTemperature(taskType),
      maxTokens: this.getDefaultMaxTokens(taskType),
      timeout: this.defaultConfig.timeout,
    });
  }

  /**
   * 智能选择模型（基于任务描述）
   */
  static selectModel(taskDescription: string): OMLXAdapter {
    const desc = taskDescription.toLowerCase();

    // 检测任务类型
    if (
      desc.includes('专利') ||
      desc.includes('撰写') ||
      desc.includes('长文本') ||
      desc.includes('报告')
    ) {
      return this.createForTask(TaskType.PATENT_WRITING);
    }

    if (desc.includes('代码') || desc.includes('编程') || desc.includes('code')) {
      return this.createForTask(TaskType.CODE_GENERATION);
    }

    if (
      desc.includes('推理') ||
      desc.includes('分析') ||
      desc.includes('复杂') ||
      desc.includes('深度')
    ) {
      return this.createForTask(TaskType.REASONING_COMPLEX);
    }

    if (desc.includes('摘要') || desc.includes('总结')) {
      return this.createForTask(TaskType.DOCUMENT_SUMMARY);
    }

    // 默认使用 Gemma
    return this.createForTask(TaskType.CHAT_SIMPLE);
  }

  /**
   * 获取任务推荐
   */
  static getRecommendation(taskType: TaskType): ModelRecommendation {
    return TASK_MODEL_MAP[taskType];
  }

  /**
   * 列出所有可用模型
   */
  static listAvailableModels(): Array<{
    taskType: TaskType;
    recommendation: ModelRecommendation;
  }> {
    return Object.entries(TASK_MODEL_MAP).map(([taskType, recommendation]) => ({
      taskType: taskType as TaskType,
      recommendation,
    }));
  }

  /**
   * 获取默认温度参数
   */
  private static getDefaultTemperature(taskType: TaskType): number {
    switch (taskType) {
      case TaskType.CODE_GENERATION:
        return 0.2; // 代码需要确定性
      case TaskType.PATENT_WRITING:
      case TaskType.LONG_FORM_GENERATION:
        return 0.8; // 创造性任务需要更高温度
      case TaskType.REASONING_COMPLEX:
        return 0.7; // 推理需要平衡
      default:
        return 0.7;
    }
  }

  /**
   * 获取默认最大 Token 数
   */
  private static getDefaultMaxTokens(taskType: TaskType): number {
    switch (taskType) {
      case TaskType.PATENT_WRITING:
      case TaskType.LONG_FORM_GENERATION:
        return 8192; // 长文本
      case TaskType.DOCUMENT_SUMMARY:
        return 1024; // 摘要较短
      case TaskType.CODE_GENERATION:
        return 4096; // 代码中等
      default:
        return 2048; // 默认
    }
  }
}

/**
 * 快捷函数
 */

/**
 * 创建简单对话模型
 */
export function createChatModel(): OMLXAdapter {
  return OMXLModelFactory.createForTask(TaskType.CHAT_SIMPLE);
}

/**
 * 创建推理模型
 */
export function createReasoningModel(): OMLXAdapter {
  return OMXLModelFactory.createForTask(TaskType.REASONING_COMPLEX);
}

/**
 * 创建专利撰写模型
 */
export function createPatentWritingModel(): OMLXAdapter {
  return OMXLModelFactory.createForTask(TaskType.PATENT_WRITING);
}

/**
 * 创建代码生成模型
 */
export function createCodeGenerationModel(): OMLXAdapter {
  return OMXLModelFactory.createForTask(TaskType.CODE_GENERATION);
}

/**
 * 智能创建模型（基于任务描述）
 */
export function createModelForTask(taskDescription: string): OMLXAdapter {
  return OMXLModelFactory.selectModel(taskDescription);
}
