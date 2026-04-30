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

// ========== ① 交互层 (Gateway) ==========
export {
  BaseGateway,
  type Gateway,
  type MultimodalInput,
  type MultimodalOutput,
  type HumanApproval,
  type ApprovalRequest,
  type AuthResult,
  type Credentials,
  type Permission,
  type Action as GatewayAction,
  type SecurityGatewayConfig,
  type ContentFilterRule,
  type AuditLog,
  type AuditLogStore,
  type AuditLogFilter,
  type AuditMetrics,
} from './gateway/Gateway.js';

export { InputSourceType, OutputTargetType } from './gateway/Gateway.js';

// 人机协同审批流程
export {
  ApprovalFlow,
  ApprovalMode,
  type ApprovalFlowConfig,
  type ApprovalResponse,
  type UserFeedback,
  type PresentationOptions,
  type FeedbackStats,
} from './gateway/ApprovalFlow.js';

// ========== ② 推理层 (Reasoning) ==========
export {
  ReActLoop,
  PlanAndSolveStrategy,
  TreeOfThoughtsStrategy,
  type ReActConfig,
  type ReActIteration,
  type Observation,
  type Thought,
  type Action as ReasoningAction,
  type ActionResult,
} from './reasoning/ReActLoop.js';

export { ReasoningStrategy } from './reasoning/ReActLoop.js';

// Chain-of-Thought 基础推理策略
export {
  ChainOfThoughtStrategy,
  createChainOfThought,
  type CoTConfig,
  type CoTResult,
  type ReasoningStep,
  StepFormat,
} from './reasoning/ChainOfThoughtStrategy.js';

// 增强自我反思机制（P1 准确率优化方案 #4）
export {
  EnhancedReflection,
  createEnhancedReflection,
  type ReflectionConfig,
  type ReflectionReport,
  type ReflectionRecord,
  type IterationResult,
  type DimensionAssessment,
  type Improvement,
} from './reasoning/EnhancedReflection.js';

export {
  ReflectionDimension,
  QualityLevel,
  ImprovementPriority,
} from './reasoning/EnhancedReflection.js';

// ========== ③ 核心推理引擎 (LLM) ==========
export {
  NativeLLMAdapter,
  MultiModelManager,
  createDeepSeekModel,
  createQwenModel,
  createOllamaModel,
  type ModelConfig,
  type ModelProvider,
} from './llm/NativeLLMAdapter.js';

export { NativeModel } from './llm/NativeLLMAdapter.js';

export { OMLXAdapter, createOMXLModel, type OMLXConfig } from './llm/OMXLAdapter.js';

// 嵌入向量适配器
export {
  EmbeddingAdapter,
  createBGEEmbedding,
  type EmbeddingConfig,
} from './llm/EmbeddingAdapter.js';

// 保留原有的 LangChain 适配器（兼容性）
export {
  LangChainAdapter,
  type LangChainAdapterConfig,
  MultiModelLLMAdapter,
} from './llm/LLMAdapter.js';

// 智能任务路由（成本感知）
export {
  TaskRouter,
  CostAwareLLMAdapter,
  createCostAwareAdapter,
  TaskComplexity,
  type Task,
  type RoutingDecision,
  type TaskRouterConfig,
} from './llm/TaskRouter.js';

// 提示词模板系统
export {
  PromptTemplate,
  TemplateManager,
  createTemplate,
  createTemplateManager,
} from './prompts/PromptTemplate.js';

export type {
  FewShotExample as TemplateFewShotExample,
  TemplateVariables,
  TemplateMetadata,
  ValidationResult as TemplateValidationResult,
  RenderOptions,
} from './prompts/PromptTemplate.js';

// 批处理器（成本优化）
export { BatchProcessor, type BatchSectionResult, type BatchConfig } from './llm/BatchProcessor.js';

// 自适应温度控制器（准确率优化）
export {
  AdaptiveTemperatureController,
  createAdaptiveTemperatureController,
  TemperaturePresets,
  type Task as ATCTask,
  type QualityFeedback,
  type ThermalParams,
  type TemperatureStrategyConfig,
} from './llm/AdaptiveTemperatureController.js';

// 语义缓存（成本优化）
export {
  SemanticCache,
  createSemanticCache,
  createSimpleSignatureGenerator,
  createEmbeddingBasedSignatureGenerator,
  type TaskSignature,
  type CachedResponse,
  type CacheStats,
  type SemanticCacheConfig,
} from './cache/SemanticCache.js';

// ========== 知识库系统（准确率优化） ==========
export {
  KnowledgeBase,
  createKnowledgeBase,
  BUILTIN_KNOWLEDGE_BASES,
  type KnowledgeEntry,
  type SearchOptions,
  type SearchResult,
  type KnowledgeInjectionResult,
  type KnowledgeStats,
  type KnowledgeBaseConfig,
} from './knowledge/KnowledgeBase.js';

export { KnowledgeEntryType } from './knowledge/KnowledgeBase.js';

// 知识卡片系统
export {
  KnowledgeCardSchema,
  generateCardId,
  cardToMarkdown,
  markdownToCard,
  type KnowledgeCard,
  type CardSearchOptions,
  type CardSearchResult,
  type PipelineConfig,
  type PipelineProgress,
  type PipelineResult,
} from './knowledge/KnowledgeCard.js';

export { CardGenerator, type CardGeneratorConfig } from './knowledge/CardGenerator.js';
export { CardRetriever } from './knowledge/CardRetriever.js';
export { CardPipeline } from './knowledge/CardPipeline.js';

// 增量生成器（成本优化）
export { IncrementalGenerator, type ContentDiff } from './agent/IncrementalGenerator.js';

// ========== ④ 记忆层 (Memory) ==========
export {
  EnhancedMemoryStore,
  CheckpointManager,
  ResumeManager,
  type Checkpoint,
  type TimeMachine,
} from './memory/CheckpointManager.js';

export { ShortTermMemory, MemoryManager } from './memory/MemoryStore.js';

// ========== ⑤ 工具层 (Tools) ==========
export { ToolRegistry, BaseTool, ToolWrapper as LegacyToolWrapper } from './tools/ToolRegistry.js';

// 增强的工具系统
export {
  EnhancedToolRegistry,
  BaseTool as EnhancedBaseTool,
  ToolWrapperClass,
} from './tools/EnhancedToolRegistry.js';

export {
  ToolCategory,
  ToolMetadata,
  ToolContext,
  EnhancedTool,
  ToolExecutionStats,
} from './tools/types.js';

export {
  MiddlewarePipeline,
  LoggingMiddleware,
  PermissionMiddleware,
  CacheMiddleware,
  RateLimitMiddleware,
  TracingMiddleware,
} from './tools/middleware.js';

// ========== 核心抽象 ==========
export { Agent, AgentConfig } from './agent/Agent.js';

// ========== 生命周期 ==========
export {
  LifecycleStage,
  type ExecutionContext,
  type MemoryStore,
  type EventBus as IEventBus,
  type ToolRegistry as IToolRegistry,
  type LLMAdapter,
  type AgentEvent,
  type EventHandler,
  type Subscription,
  type Tool,
  type ChatParams,
  type ChatResponse,
  type ChatChunk,
  type ChatMessage,
} from './lifecycle/Lifecycle.js';

// ========== 事件总线 ==========
export { EventBus } from './eventbus/EventBus.js';
export { EventBusMetrics, type EventMetric } from './eventbus/EventBusMetrics.js';

// ========== 配置管理 ==========
export { ConfigManager, getConfigManager, resetConfigManager } from './config/ConfigManager.js';

export type {
  YunPatConfig,
  ConfigFile,
  ConfigManagerOptions,
  ResolvedConfig,
  Environment,
  LLMProviderConfig,
  LLMConfig,
  MemoryConfig,
  ToolConfig,
  GatewayConfig,
  ReasoningConfig,
} from './config/types.js';

// ========== 可观测性 (Observability) ==========
export { TelemetryCollector } from './observability/TelemetryCollector.js';

export {
  TelemetryEventType,
  EventStatus,
  AlertType,
  AlertSeverity,
  type TelemetryEvent,
  type TelemetryReport,
  type AgentMetrics,
  type StageMetrics,
  type ErrorMetric,
  type Alert,
  type AlertConfig,
  type TelemetryConfig,
} from './observability/types.js';

// ========== 验证 (Validation) ==========
export {
  ResultValidator,
  CorrectionStrategy,
  ValidationErrorType,
} from './validation/ResultValidator.js';

export type {
  ValidationResult,
  QualityRequirements,
  QualityReport,
  Inconsistency,
  ResultValidatorConfig,
} from './validation/ResultValidator.js';

// ========== 主动学习 (Active Learning) ==========
export {
  ActiveLearningSystem,
  createActiveLearningSystem,
  createDefaultActiveLearningConfig,
} from './learning/ActiveLearningSystem.js';

export type {
  Sample,
  Annotation,
  UncertaintyScore,
  ActiveLearningStrategy,
  ActiveLearningConfig,
  ModelUpdateResult,
  LearningMetrics,
  ABTestResult,
  LearningRound,
} from './learning/ActiveLearningSystem.js';

// ========== 工具选择优化 (Tool Selection Optimization) ==========
export {
  ToolDescriptionEnhancer,
  type EnhancedToolMetadata,
  type ToolExample,
} from './tools/ToolDescriptionEnhancer.js';

export {
  FewShotPromptManager,
  fewShotManager,
  type FewShotExample,
} from './reasoning/FewShotPromptManager.js';

export { ToolUsageTracker, toolUsageTracker } from './tools/ToolUsageTracker.js';

export { ToolSelectionOptimizer, toolSelectionOptimizer } from './tools/ToolSelectionOptimizer.js';

export { SimilarityCalculator, similarityCalculator } from './tools/SimilarityCalculator.js';

export type {
  ToolUsageRecord,
  ToolPerformanceStats,
  ToolRecommendation,
} from './tools/ToolUsageTracker.js';

// ========== 版本信息 ==========
export const VERSION = '0.2.0';
export const ARCHITECTURE = 'five-layer';
