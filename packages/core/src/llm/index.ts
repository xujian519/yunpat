/**
 * LLM 模块统一导出
 *
 * 包含所有大语言模型适配器、工厂和工具
 */

// ========== 核心适配器 ==========
export {
  NativeLLMAdapter,
  MultiModelManager,
  createDeepSeekModel,
  createQwenModel,
  createZhipuModel,
  createOllamaModel,
} from './NativeLLMAdapter.js';
export type {
  NativeModel,
  ModelConfig,
  ThinkingConfig,
  ReasoningEffort,
} from './NativeLLMAdapter.js';

// ========== Kimi Code ==========
export { KimiCodeAdapter, createKimiCodeAdapter } from './KimiCodeAdapter.js';
export type { KimiCodeConfig } from './KimiCodeAdapter.js';

// ========== OMXL 本地模型 ==========
export {
  OMXLModelFactory,
  createChatModel,
  createReasoningModel,
  createPatentWritingModel,
  createCodeGenerationModel,
  createModelForTask,
} from './OMXLModelFactory.js';
export type { TaskType, ModelRecommendation } from './OMXLModelFactory.js';

// ========== 统一模型工厂 ==========
export {
  UnifiedModelFactory,
  createModel,
  createDeepSeekPro,
  createKimiCode as createKimi,
  createZhipu,
  createLocalModel as createOMXL,
} from './UnifiedModelFactory.js';
export type {
  ModelSource,
  ModelCategory,
  ModelInfo,
  DeepSeekV4Options,
} from './UnifiedModelFactory.js';

// ========== 嵌入模型 ==========
export { BGEEmbeddingAdapter } from './BGEEmbeddingAdapter.js';
export type { BGEConfig, EmbeddingResult } from './BGEEmbeddingAdapter.js';

// ========== 重排序模型 ==========
export { JinaRerankerAdapter, createJinaReranker, rerankRAG } from './JinaRerankerAdapter.js';
export type { RerankResult, RerankConfig } from './JinaRerankerAdapter.js';

// ========== 其他适配器 ==========
export { EmbeddingAdapter } from './EmbeddingAdapter.js';
export { OMLXAdapter } from './OMXLAdapter.js';

// ========== 工具类 ==========
export { TaskRouter } from './TaskRouter.js';
export { AdaptiveTemperatureController } from './AdaptiveTemperatureController.js';
export { BatchProcessor } from './BatchProcessor.js';
