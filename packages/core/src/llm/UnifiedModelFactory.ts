/**
 * 统一模型工厂
 *
 * 整合所有可用模型：
 * - DeepSeek V4（云端，推荐）
 * - Kimi Code（云端，编程专用）
 * - OMXL 本地模型（免费，离线）
 * - 通义千问（云端）
 * - Ollama 本地模型
 */

import { createDeepSeekModel, createZhipuModel, NativeModel, ThinkingConfig, ReasoningEffort } from './NativeLLMAdapter.js';
import { KimiCodeAdapter } from './KimiCodeAdapter.js';
import { OMXLModelFactory } from './OMXLModelFactory.js';
import type { LLMAdapter } from '../lifecycle/Lifecycle.js';

/**
 * 模型来源
 */
export enum ModelSource {
  /** 云端 API */
  CLOUD = 'cloud',

  /** 本地模型 */
  LOCAL = 'local',
}

/**
 * 模型类别
 */
export enum ModelCategory {
  /** 通用对话 */
  CHAT = 'chat',

  /** 代码生成 */
  CODE = 'code',

  /** 复杂推理 */
  REASONING = 'reasoning',

  /** 专利撰写 */
  PATENT = 'patent',

  /** 长文本生成 */
  LONG_FORM = 'long_form',

  /** 文档摘要 */
  SUMMARY = 'summary',
}

/**
 * 模型信息
 */
export interface ModelInfo {
  /** 模型 ID */
  id: string;

  /** 模型名称 */
  name: string;

  /** 模型来源 */
  source: ModelSource;

  /** 模型类别 */
  category: ModelCategory;

  /** 速度评分 (1-5) */
  speed: number;

  /** 质量评分 (1-5) */
  quality: number;

  /** 成本 (免费/按量/订阅) */
  cost: 'free' | 'pay_per_use' | 'subscription';

  /** 推荐理由 */
  reason: string;

  /** 创建适配器 */
  create: () => LLMAdapter;
}

/**
 * DeepSeek V4 模型配置
 */
export interface DeepSeekV4Options {
  /** 思考模式 */
  thinking?: ThinkingConfig;

  /** 推理强度 */
  reasoningEffort?: ReasoningEffort;
}

/**
 * 所有可用模型
 */
const AVAILABLE_MODELS: Record<string, ModelInfo> = {
  // ========== DeepSeek V4 系列（推荐） ==========
  'deepseek-v4-pro': {
    id: 'deepseek-v4-pro',
    name: 'DeepSeek V4 Pro',
    source: ModelSource.CLOUD,
    category: ModelCategory.REASONING,
    speed: 4,
    quality: 5,
    cost: 'pay_per_use',
    reason: '最强大的国产模型，适合复杂推理和长文本生成',
    create: () =>
      createDeepSeekModel(process.env.DEEPSEEK_API_KEY || '', NativeModel.DEEPSEEK_V4_PRO, {
        thinking: { type: 'enabled' },
        reasoningEffort: 'high',
      }),
  },

  'deepseek-v4-flash': {
    id: 'deepseek-v4-flash',
    name: 'DeepSeek V4 Flash',
    source: ModelSource.CLOUD,
    category: ModelCategory.CHAT,
    speed: 5,
    quality: 4,
    cost: 'pay_per_use',
    reason: '快速响应，适合日常对话和简单任务',
    create: () =>
      createDeepSeekModel(process.env.DEEPSEEK_API_KEY || '', NativeModel.DEEPSEEK_V4_FLASH),
  },

  // ========== Kimi Code 系列 ==========
  'kimi-code': {
    id: 'kimi-code',
    name: 'Kimi Code',
    source: ModelSource.CLOUD,
    category: ModelCategory.CODE,
    speed: 5,
    quality: 5,
    cost: 'subscription',
    reason: '专为编程设计，最高 100 tokens/s，需要 Kimi 会员',
    create: () => new KimiCodeAdapter({ apiKey: process.env.KIMI_CODE_API_KEY || '' }),
  },

  // ========== 智谱 GLM 系列 ==========
  'glm-4.7': {
    id: 'glm-4.7',
    name: 'GLM-4.7（智谱）',
    source: ModelSource.CLOUD,
    category: ModelCategory.CODE,
    speed: 4,
    quality: 5,
    cost: 'pay_per_use',
    reason: '智谱最新旗舰模型，编程能力优秀，¥20/月起',
    create: () => createZhipuModel(process.env.ZHIPU_API_KEY || '', NativeModel.GLM_4_7),
  },

  'glm-4-flash': {
    id: 'glm-4-flash',
    name: 'GLM-4-Flash（智谱）',
    source: ModelSource.CLOUD,
    category: ModelCategory.CHAT,
    speed: 5,
    quality: 4,
    cost: 'pay_per_use',
    reason: '智谱快速响应模型，性价比高',
    create: () => createZhipuModel(process.env.ZHIPU_API_KEY || '', NativeModel.GLM_4_FLASH),
  },

  // ========== OMXL 本地模型系列 ==========
  'omxl-qwen': {
    id: 'omxl-qwen',
    name: 'Qwen3.5-27B (本地)',
    source: ModelSource.LOCAL,
    category: ModelCategory.REASONING,
    speed: 3,
    quality: 5,
    cost: 'free',
    reason: '本地最强模型，完全免费，需要 17GB 内存',
    create: () => OMXLModelFactory.createForTask('reasoning_complex' as never),
  },

  'omxl-gemma': {
    id: 'omxl-gemma',
    name: 'Gemma-4-9B (本地)',
    source: ModelSource.LOCAL,
    category: ModelCategory.CHAT,
    speed: 4,
    quality: 3,
    cost: 'free',
    reason: '轻量快速，适合简单对话，需要 5GB 内存',
    create: () => OMXLModelFactory.createForTask('chat_simple' as never),
  },
};

/**
 * 统一模型工厂
 */
export class UnifiedModelFactory {
  /**
   * 根据任务类型推荐模型
   */
  static recommendModel(category: ModelCategory, preferLocal = false): ModelInfo {
    // 优先级：本地 > 云端（如果 preferLocal）
    // 云端优先：DeepSeek V4 Pro > Kimi Code > 其他

    const candidates = Object.values(AVAILABLE_MODELS).filter((m) => m.category === category);

    if (preferLocal) {
      const local = candidates.find((m) => m.source === ModelSource.LOCAL);
      if (local) return local;
    }

    // 云端模型按质量排序
    const cloudModels = candidates.filter((m) => m.source === ModelSource.CLOUD);
    const best = cloudModels.sort((a, b) => b.quality - a.quality)[0];

    return best || candidates[0];
  }

  /**
   * 智能选择模型（基于任务描述）
   */
  static selectModel(taskDescription: string, preferLocal = false): LLMAdapter {
    const desc = taskDescription.toLowerCase();

    // 检测任务类别
    let category: ModelCategory;

    if (desc.includes('代码') || desc.includes('编程') || desc.includes('code')) {
      category = ModelCategory.CODE;
    } else if (
      desc.includes('专利') ||
      desc.includes('撰写') ||
      desc.includes('长文本') ||
      desc.includes('报告')
    ) {
      category = ModelCategory.PATENT;
    } else if (
      desc.includes('推理') ||
      desc.includes('分析') ||
      desc.includes('复杂') ||
      desc.includes('深度')
    ) {
      category = ModelCategory.REASONING;
    } else if (desc.includes('摘要') || desc.includes('总结')) {
      category = ModelCategory.SUMMARY;
    } else {
      category = ModelCategory.CHAT;
    }

    const model = this.recommendModel(category, preferLocal);

    console.log(`\n🎯 智能模型选择`);
    console.log(`📝 任务描述: ${taskDescription}`);
    console.log(`📦 推荐模型: ${model.name}`);
    console.log(`💡 推荐理由: ${model.reason}`);
    console.log(`⭐ 质量评分: ${model.quality}/5`);
    console.log(`⚡ 速度评分: ${model.speed}/5`);
    console.log(`💰 成本: ${model.cost}\n`);

    return model.create();
  }

  /**
   * 创建 DeepSeek V4 模型
   */
  static createDeepSeekV4(
    model: 'pro' | 'flash' = 'pro',
    options?: DeepSeekV4Options
  ): LLMAdapter {
    const modelName = model === 'pro' ? NativeModel.DEEPSEEK_V4_PRO : NativeModel.DEEPSEEK_V4_FLASH;
    return createDeepSeekModel(process.env.DEEPSEEK_API_KEY || '', modelName, options);
  }

  /**
   * 创建 Kimi Code 模型
   */
  static createKimiCode(): LLMAdapter {
    return new KimiCodeAdapter({ apiKey: process.env.KIMI_CODE_API_KEY || '' });
  }

  /**
   * 创建本地 OMXL 模型
   */
  static createLocalModel(taskType: 'chat' | 'reasoning' | 'patent' = 'chat'): LLMAdapter {
    const taskMap = {
      chat: 'chat_simple' as never,
      reasoning: 'reasoning_complex' as never,
      patent: 'patent_writing' as never,
    };

    return OMXLModelFactory.createForTask(taskMap[taskType]);
  }

  /**
   * 创建智谱 GLM 模型
   */
  static createZhipuModel(model: '4.7' | 'flash' | 'plus' = '4.7'): LLMAdapter {
    const modelMap = {
      '4.7': NativeModel.GLM_4_7,
      'flash': NativeModel.GLM_4_FLASH,
      'plus': NativeModel.GLM_4_PLUS,
    };

    return createZhipuModel(process.env.ZHIPU_API_KEY || '', modelMap[model]);
  }

  /**
   * 列出所有可用模型
   */
  static listModels(filters?: {
    source?: ModelSource;
    category?: ModelCategory;
    cost?: Array<'free' | 'pay_per_use' | 'subscription'>;
  }): ModelInfo[] {
    let models = Object.values(AVAILABLE_MODELS);

    if (filters?.source) {
      models = models.filter((m) => m.source === filters.source);
    }

    if (filters?.category) {
      models = models.filter((m) => m.category === filters.category);
    }

    if (filters?.cost && filters.cost.length > 0) {
      models = models.filter((m) => filters.cost!.includes(m.cost as never));
    }

    return models;
  }

  /**
   * 获取模型信息
   */
  static getModelInfo(modelId: string): ModelInfo | undefined {
    return AVAILABLE_MODELS[modelId];
  }
}

/**
 * 快捷函数
 */

/**
 * 智能创建模型（最常用）
 */
export function createModel(taskDescription: string, preferLocal = false): LLMAdapter {
  return UnifiedModelFactory.selectModel(taskDescription, preferLocal);
}

/**
 * 创建 DeepSeek V4 Pro（最强云端模型）
 */
export function createDeepSeekPro(options?: DeepSeekV4Options): LLMAdapter {
  return UnifiedModelFactory.createDeepSeekV4('pro', options);
}

/**
 * 创建 Kimi Code（编程专用）
 */
export function createKimiCode(): LLMAdapter {
  return UnifiedModelFactory.createKimiCode();
}

/**
 * 创建智谱 GLM-4.7（编程专用）
 */
export function createZhipu(): LLMAdapter {
  return UnifiedModelFactory.createZhipuModel('4.7');
}

/**
 * 创建本地模型（免费）
 */
export function createLocalModel(taskType?: 'chat' | 'reasoning' | 'patent'): LLMAdapter {
  return UnifiedModelFactory.createLocalModel(taskType);
}
