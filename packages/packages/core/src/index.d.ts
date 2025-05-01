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
export {
  AgentInputError,
  AgentExecutionError,
  ExternalServiceError,
  ValidationError,
} from './errors/AgentErrors.js'
export { Logger, createLogger, LogLevel } from './utils/Logger.js'
export type { LogEntry, LoggerConfig } from './utils/Logger.js'
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
} from './gateway/Gateway.js'
export { InputSourceType, OutputTargetType } from './gateway/Gateway.js'
export {
  ApprovalFlow,
  ApprovalMode,
  type ApprovalFlowConfig,
  type ApprovalResponse,
  type UserFeedback,
  type PresentationOptions,
  type FeedbackStats,
} from './gateway/ApprovalFlow.js'
export {
  ReActLoop,
  PlanAndSolveStrategy,
  type ReActConfig,
  type ReActIteration,
  type Observation,
  type Thought,
  type Action as ReasoningAction,
  type ActionResult,
  type ThoughtNode,
} from './reasoning/ReActLoop.js'
export {
  TreeOfThoughtsStrategy,
  type ThoughtOption,
  type ToTConfig,
} from './reasoning/TreeOfThoughtsStrategy.js'
export { ReasoningStrategy } from './reasoning/ReActLoop.js'
export {
  ChainOfThoughtStrategy,
  createChainOfThought,
  type CoTConfig,
  type CoTResult,
  type ReasoningStep,
  StepFormat,
} from './reasoning/ChainOfThoughtStrategy.js'
export {
  ReasoningCache,
  createReasoningCache,
  type CacheEntry,
  type ReasoningCacheStats,
  type CacheConfig,
  type CacheQueryResult,
} from './reasoning/ReasoningCache.js'
export {
  ReasoningMonitor,
  reasoningMonitor,
  type PerformanceMetrics,
  type InferenceRecord,
} from './reasoning/ReasoningMonitor.js'
export {
  ReasoningBatchProcessor,
  createBatchProcessor,
  type BatchProcessConfig,
  type BatchResult,
} from './reasoning/ReasoningBatchProcessor.js'
export {
  EnhancedReflection,
  createEnhancedReflection,
  type ReflectionConfig,
  type ReflectionReport,
  type ReflectionRecord,
  type IterationResult,
  type DimensionAssessment,
  type Improvement,
} from './reasoning/EnhancedReflection.js'
export {
  ReflectionDimension,
  QualityLevel,
  ImprovementPriority,
} from './reasoning/EnhancedReflection.js'
export {
  NativeLLMAdapter,
  MultiModelManager,
  createDeepSeekModel,
  createQwenModel,
  createOllamaModel,
  type ModelConfig,
  type ModelProvider,
} from './llm/NativeLLMAdapter.js'
export { NativeModel } from './llm/NativeLLMAdapter.js'
export { OMLXAdapter, createOMXLModel, type OMLXConfig } from './llm/OMXLAdapter.js'
export {
  EmbeddingAdapter,
  createBGEEmbedding,
  type OpenAIEmbeddingConfig as EmbeddingConfig,
} from './llm/EmbeddingAdapter.js'
export {
  LangChainAdapter,
  type LangChainAdapterConfig,
  MultiModelLLMAdapter,
} from './llm/LLMAdapter.js'
export {
  TaskRouter,
  CostAwareLLMAdapter,
  createCostAwareAdapter,
  TaskComplexity,
  type Task as RoutingTask,
  type RoutingDecision,
  type TaskRouterConfig,
} from './llm/TaskRouter.js'
export {
  PromptTemplate,
  TemplateManager,
  createTemplate,
  createTemplateManager,
} from './prompts/PromptTemplate.js'
export type {
  FewShotExample as TemplateFewShotExample,
  TemplateVariables,
  TemplateMetadata,
  ValidationResult as TemplateValidationResult,
  RenderOptions,
} from './prompts/PromptTemplate.js'
export { BatchProcessor, type BatchSectionResult, type BatchConfig } from './llm/BatchProcessor.js'
export {
  AdaptiveTemperatureController,
  createAdaptiveTemperatureController,
  TemperaturePresets,
  type Task as ATCTask,
  type QualityFeedback,
  type ThermalParams,
  type TemperatureStrategyConfig,
} from './llm/AdaptiveTemperatureController.js'
export {
  SemanticCache,
  createSemanticCache,
  createSimpleSignatureGenerator,
  createEmbeddingBasedSignatureGenerator,
  type TaskSignature,
  type CachedResponse,
  type CacheStats,
  type SemanticCacheConfig,
} from './cache/SemanticCache.js'
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
} from './knowledge/KnowledgeBase.js'
export { KnowledgeEntryType } from './knowledge/KnowledgeBase.js'
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
} from './knowledge/KnowledgeCard.js'
export { CardGenerator, type CardGeneratorConfig } from './knowledge/CardGenerator.js'
export { CardRetriever } from './knowledge/CardRetriever.js'
export { CardPipeline } from './knowledge/CardPipeline.js'
export { IncrementalGenerator, type ContentDiff } from './agent/IncrementalGenerator.js'
export {
  EnhancedMemoryStore,
  CheckpointManager,
  ResumeManager,
  type Checkpoint,
  type TimeMachine,
} from './memory/CheckpointManager.js'
export { ShortTermMemory, MemoryManager } from './memory/MemoryStore.js'
export { ToolRegistry, BaseTool, ToolWrapper as LegacyToolWrapper } from './tools/ToolRegistry.js'
export {
  EnhancedToolRegistry,
  BaseTool as EnhancedBaseTool,
  ToolWrapperClass,
} from './tools/EnhancedToolRegistry.js'
export {
  ToolCategory,
  ToolMetadata,
  ToolContext,
  EnhancedTool,
  ToolExecutionStats,
} from './tools/types.js'
export {
  MiddlewarePipeline,
  LoggingMiddleware,
  PermissionMiddleware,
  CacheMiddleware,
  RateLimitMiddleware,
  TracingMiddleware,
} from './tools/middleware.js'
export { Agent, AgentConfig } from './agent/Agent.js'
export {
  KnowledgeEnhancedAgent,
  type KnowledgeEnhancedAgentConfig,
} from './agent/KnowledgeEnhancedAgent.js'
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
} from './lifecycle/Lifecycle.js'
export { EventBus } from './eventbus/EventBus.js'
export { EventBusMetrics, type EventMetric } from './eventbus/EventBusMetrics.js'
export { ConfigManager, getConfigManager, resetConfigManager } from './config/ConfigManager.js'
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
} from './config/types.js'
export { TelemetryCollector } from './observability/TelemetryCollector.js'
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
} from './observability/types.js'
export {
  ResultValidator,
  CorrectionStrategy as ValidationCorrectionStrategy,
  ValidationErrorType,
} from './validation/ResultValidator.js'
export type {
  ValidationResult,
  QualityRequirements,
  QualityReport,
  Inconsistency,
  ResultValidatorConfig,
} from './validation/ResultValidator.js'
export { HallucinationDetector } from './validation/HallucinationDetector.js'
export type {
  HallucinationReport,
  HallucinationDetectorConfig,
  FactCheckResult,
  LogicalInconsistency,
  SourceAttributionIssue,
  ImprovementSuggestion,
  SuggestionAction,
  LogicalInconsistencyType,
  SourceAttributionIssueType,
} from './validation/hallucination-types.js'
export { WorkflowEngine } from './planning/WorkflowEngine.js'
export type {
  WorkflowStep,
  WorkflowDefinition,
  WorkflowStepResult,
  WorkflowResult,
  WorkflowEngineConfig,
} from './planning/WorkflowEngine.js'
export { TaskDecomposer, DependencyAnalyzer, TaskScheduler } from './planning/index.js'
export type {
  DecompositionOptions,
  DecompositionRule,
  SubGoalTemplate,
  TaskTemplate,
  TaskDecomposerConfig,
  DependencyAnalyzerConfig,
  TaskSchedulerConfig,
  ScheduleResult,
  DeviationDetail,
  DecompositionStats,
  SubGoal,
  Dependency,
  DependencyGraph,
  HierarchicalPlan,
  DeviationReport as PlanningDeviationReport,
  ReplanningContext as PlanningReplanningContext,
  PlanAdjustment as PlanningPlanAdjustment,
  TaskModification as PlanningTaskModification,
} from './planning/types.js'
export { Priority, TaskStatus, TaskType, PlanStatus } from './planning/types.js'
export {
  ConstitutionalAI,
  ComplianceChecker,
  AutoCorrector,
  PATENT_PRINCIPLES,
} from './constitutional/index.js'
export type {
  PrincipleCheckFunction,
  ConstitutionalPrinciple,
  ComplianceResult,
  Violation,
  Warning,
  ComplianceReport,
  CorrectionResult,
  AppliedCorrection,
  ConstitutionalAIConfig,
  ConflictResolution,
} from './constitutional/types.js'
export { PrincipleCategory, ViolationSeverity, CorrectionStrategy } from './constitutional/types.js'
export {
  DynamicReplanner,
  DeviationDetector,
  RecoveryStrategySelector,
  IncrementalPlanner,
} from './replanning/index.js'
export type {
  ReplanningTrigger,
  ExecutionState,
  QualityMetrics,
  ResourceUsage,
  Deviation,
  RecoveryStrategy,
  ReplanningHistory,
  ReplanningResult,
  DynamicReplannerConfig,
  IncrementalPlannerConfig,
  DeviationReport,
  PlanAdjustment,
  TaskModification,
  ReplanningContext,
} from './replanning/types.js'
export {
  ActiveLearningSystem,
  createActiveLearningSystem,
  createDefaultActiveLearningConfig,
} from './learning/ActiveLearningSystem.js'
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
} from './learning/ActiveLearningSystem.js'
export {
  ToolDescriptionEnhancer,
  type EnhancedToolMetadata,
  type ToolExample,
} from './tools/ToolDescriptionEnhancer.js'
export {
  FewShotPromptManager,
  fewShotManager,
  type FewShotExample,
} from './reasoning/FewShotPromptManager.js'
export { ToolUsageTracker, toolUsageTracker } from './tools/ToolUsageTracker.js'
export { ToolSelectionOptimizer, toolSelectionOptimizer } from './tools/ToolSelectionOptimizer.js'
export { SimilarityCalculator, similarityCalculator } from './tools/SimilarityCalculator.js'
export type {
  ToolUsageRecord,
  ToolPerformanceStats,
  ToolRecommendation,
} from './tools/ToolUsageTracker.js'
export declare const VERSION = '0.2.0'
export declare const ARCHITECTURE = 'five-layer'
export * from './observability.js'
//# sourceMappingURL=index.d.ts.map
