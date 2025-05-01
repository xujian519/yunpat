/**
 * YunPat 核心框架 - 五层架构版本
 *
 * 完整的五层架构实现：
 * ① 交互层 (Gateway)
 * ② 推理层 (Reasoning)
 * ③ 核心推理引擎 (LLM)
 * ④ 记忆层 (Memory)
 * ⑤ 编排层 (Orchestration)
 */
// ========== 错误类 ==========
export {
  AgentInputError,
  AgentExecutionError,
  ExternalServiceError,
  ValidationError,
} from './errors/AgentErrors.js'
// ========== 工具类 ==========
export { Logger, createLogger, LogLevel } from './utils/Logger.js'
// ========== ① 交互层 (Gateway) ==========
export { BaseGateway } from './gateway/Gateway.js'
export { InputSourceType, OutputTargetType } from './gateway/Gateway.js'
// 人机协同审批流程
export { ApprovalFlow, ApprovalMode } from './gateway/ApprovalFlow.js'
// ========== ② 推理层 (Reasoning) ==========
export { ReActLoop, PlanAndSolveStrategy } from './reasoning/ReActLoop.js'
export { TreeOfThoughtsStrategy } from './reasoning/TreeOfThoughtsStrategy.js'
export { ReasoningStrategy } from './reasoning/ReActLoop.js'
// Chain-of-Thought 基础推理策略
export {
  ChainOfThoughtStrategy,
  createChainOfThought,
  StepFormat,
} from './reasoning/ChainOfThoughtStrategy.js'
// 推理缓存系统
export { ReasoningCache, createReasoningCache } from './reasoning/ReasoningCache.js'
// 推理性能监控
export { ReasoningMonitor, reasoningMonitor } from './reasoning/ReasoningMonitor.js'
// 批量推理处理器
export {
  ReasoningBatchProcessor,
  createBatchProcessor,
} from './reasoning/ReasoningBatchProcessor.js'
// 增强自我反思机制（P1 准确率优化方案 #4）
export { EnhancedReflection, createEnhancedReflection } from './reasoning/EnhancedReflection.js'
export {
  ReflectionDimension,
  QualityLevel,
  ImprovementPriority,
} from './reasoning/EnhancedReflection.js'
// ========== ③ 核心推理引擎 (LLM) ==========
export {
  NativeLLMAdapter,
  MultiModelManager,
  createDeepSeekModel,
  createQwenModel,
  createOllamaModel,
} from './llm/NativeLLMAdapter.js'
export { NativeModel } from './llm/NativeLLMAdapter.js'
export { OMLXAdapter, createOMXLModel } from './llm/OMXLAdapter.js'
// 嵌入向量适配器
export { EmbeddingAdapter, createBGEEmbedding } from './llm/EmbeddingAdapter.js'
// 保留原有的 LangChain 适配器（兼容性）
export { LangChainAdapter, MultiModelLLMAdapter } from './llm/LLMAdapter.js'
// 智能任务路由（成本感知）
export {
  TaskRouter,
  CostAwareLLMAdapter,
  createCostAwareAdapter,
  TaskComplexity,
} from './llm/TaskRouter.js'
// 提示词模板系统
export {
  PromptTemplate,
  TemplateManager,
  createTemplate,
  createTemplateManager,
} from './prompts/PromptTemplate.js'
// 批处理器（成本优化）
export { BatchProcessor } from './llm/BatchProcessor.js'
// 自适应温度控制器（准确率优化）
export {
  AdaptiveTemperatureController,
  createAdaptiveTemperatureController,
  TemperaturePresets,
} from './llm/AdaptiveTemperatureController.js'
// 语义缓存（成本优化）
export {
  SemanticCache,
  createSemanticCache,
  createSimpleSignatureGenerator,
  createEmbeddingBasedSignatureGenerator,
} from './cache/SemanticCache.js'
// ========== 知识库系统（准确率优化） ==========
export {
  KnowledgeBase,
  createKnowledgeBase,
  BUILTIN_KNOWLEDGE_BASES,
} from './knowledge/KnowledgeBase.js'
export { KnowledgeEntryType } from './knowledge/KnowledgeBase.js'
// 知识卡片系统
export {
  KnowledgeCardSchema,
  generateCardId,
  cardToMarkdown,
  markdownToCard,
} from './knowledge/KnowledgeCard.js'
export { CardGenerator } from './knowledge/CardGenerator.js'
export { CardRetriever } from './knowledge/CardRetriever.js'
export { CardPipeline } from './knowledge/CardPipeline.js'
// 增量生成器（成本优化）
export { IncrementalGenerator } from './agent/IncrementalGenerator.js'
// ========== ④ 记忆层 (Memory) ==========
export {
  EnhancedMemoryStore,
  CheckpointManager,
  ResumeManager,
} from './memory/CheckpointManager.js'
export { ShortTermMemory, MemoryManager } from './memory/MemoryStore.js'
// ========== ⑤ 工具层 (Tools) ==========
export { ToolRegistry, BaseTool, ToolWrapper as LegacyToolWrapper } from './tools/ToolRegistry.js'
// 增强的工具系统
export {
  EnhancedToolRegistry,
  BaseTool as EnhancedBaseTool,
  ToolWrapperClass,
} from './tools/EnhancedToolRegistry.js'
export { ToolCategory } from './tools/types.js'
export {
  MiddlewarePipeline,
  LoggingMiddleware,
  PermissionMiddleware,
  CacheMiddleware,
  RateLimitMiddleware,
  TracingMiddleware,
} from './tools/middleware.js'
// ========== 核心抽象 ==========
export { Agent } from './agent/Agent.js'
// ========== 知识增强 Agent ==========
export { KnowledgeEnhancedAgent } from './agent/KnowledgeEnhancedAgent.js'
// ========== 生命周期 ==========
export { LifecycleStage } from './lifecycle/Lifecycle.js'
// ========== 事件总线 ==========
export { EventBus } from './eventbus/EventBus.js'
export { EventBusMetrics } from './eventbus/EventBusMetrics.js'
// ========== 配置管理 ==========
export { ConfigManager, getConfigManager, resetConfigManager } from './config/ConfigManager.js'
// ========== 可观测性 (Observability) ==========
export { TelemetryCollector } from './observability/TelemetryCollector.js'
export { TelemetryEventType, EventStatus, AlertType, AlertSeverity } from './observability/types.js'
// ========== 验证 (Validation) ==========
export {
  ResultValidator,
  CorrectionStrategy as ValidationCorrectionStrategy,
  ValidationErrorType,
} from './validation/ResultValidator.js'
export { HallucinationDetector } from './validation/HallucinationDetector.js'
// ========== 规划系统 (Planning) ==========
export { WorkflowEngine } from './planning/WorkflowEngine.js'
export { TaskDecomposer, DependencyAnalyzer, TaskScheduler } from './planning/index.js'
export {
  // 基础类型（enum）
  Priority,
  TaskStatus,
  TaskType,
  PlanStatus,
} from './planning/types.js'
// ========== Constitutional AI ==========
export {
  ConstitutionalAI,
  ComplianceChecker,
  AutoCorrector,
  PATENT_PRINCIPLES,
} from './constitutional/index.js'
export { PrincipleCategory, ViolationSeverity, CorrectionStrategy } from './constitutional/types.js'
// ========== 动态重规划 (Dynamic Replanning) ==========
export {
  DynamicReplanner,
  DeviationDetector,
  RecoveryStrategySelector,
  IncrementalPlanner,
} from './replanning/index.js'
// ========== 主动学习 (Active Learning) ==========
export {
  ActiveLearningSystem,
  createActiveLearningSystem,
  createDefaultActiveLearningConfig,
} from './learning/ActiveLearningSystem.js'
// ========== 工具选择优化 (Tool Selection Optimization) ==========
export { ToolDescriptionEnhancer } from './tools/ToolDescriptionEnhancer.js'
export { FewShotPromptManager, fewShotManager } from './reasoning/FewShotPromptManager.js'
export { ToolUsageTracker, toolUsageTracker } from './tools/ToolUsageTracker.js'
export { ToolSelectionOptimizer, toolSelectionOptimizer } from './tools/ToolSelectionOptimizer.js'
export { SimilarityCalculator, similarityCalculator } from './tools/SimilarityCalculator.js'
// ========== 版本信息 ==========
export const VERSION = '0.2.0'
export const ARCHITECTURE = 'five-layer'
// Observability
export * from './observability'
//# sourceMappingURL=index.js.map
