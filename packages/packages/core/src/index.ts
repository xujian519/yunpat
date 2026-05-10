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
  ToolExecutionError,
  PermissionDeniedError,
} from './errors/AgentErrors.js'

// ========== 工具类 ==========
export { Logger, createLogger, LogLevel } from './utils/Logger.js'

export type { LogEntry, LoggerConfig } from './utils/Logger.js'
export { safeParseJSON } from './utils/safeParseJSON.js'

export {
  extractRequiredFeatures,
  isFeatureCoveredInClaim,
  isSemanticallySimilar,
  identifyIncludedUnnecessaryFeatures,
} from './utils/claimFeatureMatcher.js'
export type { InventionFeatureData, EssentialFeatureAnalysis } from './utils/claimFeatureMatcher.js'

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
} from './gateway/Gateway.js'

export { InputSourceType, OutputTargetType } from './gateway/Gateway.js'

// 人机协同审批流程
export {
  ApprovalFlow,
  ApprovalMode,
  type ApprovalFlowConfig,
  type ApprovalResponse,
  type UserFeedback,
  type PresentationOptions,
  type FeedbackStats,
} from './gateway/ApprovalFlow.js'

// ========== ② 推理层 (Reasoning) ==========
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

// Chain-of-Thought 基础推理策略
export {
  ChainOfThoughtStrategy,
  createChainOfThought,
  type CoTConfig,
  type CoTResult,
  type ReasoningStep,
  StepFormat,
} from './reasoning/ChainOfThoughtStrategy.js'

// 推理缓存系统
export {
  ReasoningCache,
  createReasoningCache,
  type CacheEntry,
  type ReasoningCacheStats,
  type CacheConfig,
  type CacheQueryResult,
} from './reasoning/ReasoningCache.js'

// 推理性能监控
export {
  ReasoningMonitor,
  reasoningMonitor,
  type PerformanceMetrics,
  type InferenceRecord,
} from './reasoning/ReasoningMonitor.js'

// 批量推理处理器
export {
  ReasoningBatchProcessor,
  createBatchProcessor,
  type BatchProcessConfig,
  type BatchResult,
} from './reasoning/ReasoningBatchProcessor.js'

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
} from './reasoning/EnhancedReflection.js'

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
  type ModelConfig,
  type ModelProvider,
} from './llm/NativeLLMAdapter.js'

export { NativeModel } from './llm/NativeLLMAdapter.js'

export { AISDKAdapter } from './llm/AISDKAdapter.js'
export type {
  AIProvider,
  AISDKConfig,
  GenerateObjectParams,
  GenerateObjectResult,
} from './llm/AISDKAdapter.js'

export { OMLXAdapter, createOMXLModel, type OMLXConfig } from './llm/OMXLAdapter.js'

// 嵌入向量适配器
export {
  EmbeddingAdapter,
  createBGEEmbedding,
  type OpenAIEmbeddingConfig as EmbeddingConfig,
} from './llm/EmbeddingAdapter.js'

// 保留原有的 LangChain 适配器（兼容性）
export {
  LangChainAdapter,
  type LangChainAdapterConfig,
  MultiModelLLMAdapter,
} from './llm/LLMAdapter.js'

// 智能任务路由（成本感知）
export {
  TaskRouter,
  CostAwareLLMAdapter,
  createCostAwareAdapter,
  TaskComplexity,
  type Task as RoutingTask,
  type RoutingDecision,
  type TaskRouterConfig,
} from './llm/TaskRouter.js'

// 提示词模板系统
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

// 批处理器（成本优化）
export { BatchProcessor, type BatchSectionResult, type BatchConfig } from './llm/BatchProcessor.js'

// 自适应温度控制器（准确率优化）
export {
  AdaptiveTemperatureController,
  createAdaptiveTemperatureController,
  TemperaturePresets,
  type Task as ATCTask,
  type QualityFeedback,
  type ThermalParams,
  type TemperatureStrategyConfig,
} from './llm/AdaptiveTemperatureController.js'

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
} from './cache/SemanticCache.js'

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
} from './knowledge/KnowledgeBase.js'

export { KnowledgeEntryType } from './knowledge/KnowledgeBase.js'

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
} from './knowledge/KnowledgeCard.js'

export { CardGenerator, type CardGeneratorConfig } from './knowledge/CardGenerator.js'
export { CardRetriever } from './knowledge/CardRetriever.js'
export { CardPipeline } from './knowledge/CardPipeline.js'

// 增量生成器（成本优化）
export { IncrementalGenerator, type ContentDiff } from './agent/IncrementalGenerator.js'

// ========== ④ 记忆层 (Memory) ==========
export {
  EnhancedMemoryStore,
  CheckpointManager,
  ResumeManager,
  type Checkpoint,
  type TimeMachine,
} from './memory/CheckpointManager.js'

export { ShortTermMemory, MemoryManager } from './memory/MemoryStore.js'

export {
  RustCheckpointBridge,
  type UnifiedCheckpoint,
  type HITLCheckpointData,
} from './memory/RustCheckpointBridge.js'

// ========== ⑤ 工具层 (Tools) ==========
export { ToolRegistry, BaseTool, ToolWrapper as LegacyToolWrapper } from './tools/ToolRegistry.js'

// 增强的工具系统
export {
  EnhancedToolRegistry,
  BaseTool as EnhancedBaseTool,
  ToolWrapperClass,
  buildTool,
} from './tools/EnhancedToolRegistry.js'

export { toolToLLMFunction, toolsToLLMFunctions } from './tools/SchemaToLLM.js'
export type { LLMFunctionDefinition } from './tools/SchemaToLLM.js'

export {
  ToolCategory,
  ToolMetadata,
  ToolContext,
  EnhancedTool,
  ToolExecutionStats,
  ToolValidationResult,
  type InterruptBehavior,
  type ToolResultBlockParam,
  type UIRenderSpec,
  type PermissionResult,
} from './tools/types.js'

export {
  MiddlewarePipeline,
  LoggingMiddleware,
  PermissionMiddleware,
  CacheMiddleware,
  RateLimitMiddleware,
  TracingMiddleware,
} from './tools/middleware.js'

export {
  ToolExecutionEngine,
  defaultToolExecutionEngine,
  type ToolExecutionEngineConfig,
  type ExecuteOptions,
  type BatchExecuteOptions,
} from './tools/ToolExecutionEngine.js'

export {
  ToolResultRenderer,
  defaultToolResultRenderer,
  type RenderTarget,
} from './tools/ToolResultRenderer.js'

// ========== 核心抽象 ==========
export { Agent, AgentConfig } from './agent/Agent.js'

// ========== 知识增强 Agent ==========
export {
  KnowledgeEnhancedAgent,
  type KnowledgeEnhancedAgentConfig,
} from './agent/KnowledgeEnhancedAgent.js'

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
} from './lifecycle/Lifecycle.js'

// ========== 事件总线 ==========
export { EventBus } from './eventbus/EventBus.js'
export { EventBusMetrics, type EventMetric } from './eventbus/EventBusMetrics.js'

// ========== 配置管理 ==========
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

// ========== 可观测性 (Observability) ==========
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

// ========== 验证 (Validation) ==========
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

// ========== 规划系统 (Planning) ==========
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
  // 配置和选项
  DecompositionOptions,
  DecompositionRule,
  SubGoalTemplate,
  TaskTemplate,
  TaskDecomposerConfig,
  DependencyAnalyzerConfig,
  TaskSchedulerConfig,

  // 调度和分析
  ScheduleResult,
  DeviationDetail,

  // 统计
  DecompositionStats,

  // 核心接口
  SubGoal,
  Dependency,
  DependencyGraph,
  HierarchicalPlan,
  DeviationReport as PlanningDeviationReport,
  ReplanningContext as PlanningReplanningContext,
  PlanAdjustment as PlanningPlanAdjustment,
  TaskModification as PlanningTaskModification,
} from './planning/types.js'

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
  detectTechnicalDisclosure,
  createAuditEntry,
} from './constitutional/index.js'

export type { SovereigntyCheckResult } from './constitutional/index.js'

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

// ========== 动态重规划 (Dynamic Replanning) ==========
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

// ========== 主动学习 (Active Learning) ==========
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

// ========== 工具选择优化 (Tool Selection Optimization) ==========
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

// ========== Skill 模板系统 ==========
/** @deprecated 使用 @yunpat/skills 包代替 */
export { SkillLoader, createSkillLoader } from './skills/SkillLoader.js'

export type {
  SkillMetadata,
  SkillTemplate,
  SkillLoaderConfig,
  RenderOptions as SkillRenderOptions,
  ValidationResult as SkillValidationResult,
} from './skills/SkillLoader.js'

// 安全内容提供者（提示词加密保护）
export { SecureContentProvider, sealContent } from './skills/SecureContentProvider.js'

export type {
  SecureContentProviderConfig,
  KeySource,
  SealOptions,
} from './skills/SecureContentProvider.js'

// ========== 协调器 (Coordinator) ==========
export {
  PatentCoordinator,
  createPatentCoordinator,
  type CoordinatorInput,
  type CoordinatorOutput,
} from './coordinator/PatentCoordinator.js'

export {
  AgentTeam,
  createAgentTeam,
  PATENT_DRAFTING_TEAM,
  PATENT_SEARCH_TEAM,
  OA_RESPONSE_TEAM,
  type TeamTask,
  type TeamTaskResult,
} from './coordinator/AgentTeam.js'

export {
  SharedTaskList,
  createSharedTaskList,
  type TaskFilter,
  type TaskUpdateHandler,
} from './coordinator/SharedTaskList.js'

export {
  CoordinatorTaskStatus,
  type CaseUnderstanding,
  type WorkflowPlan,
  type WorkflowPlanStep,
  type AgentTask,
  type HandoffContext,
  type HandoffResult,
  type ReviewResult,
  type ReviewCriteria,
  type PatentCoordinatorConfig,
  type CoordinatorEventType,
  type AgentRole,
} from './coordinator/types.js'

// ========== 版本信息 ==========
export const VERSION = '0.2.0'
export const ARCHITECTURE = 'five-layer'

// Observability
export * from './observability/index.js'

// ========== Phase 0: Prompt 工程重构 ==========
export {
  type SystemPrompt,
  asSystemPrompt,
  SYSTEM_PROMPT_DYNAMIC_BOUNDARY,
  hasDynamicBoundary,
  splitByDynamicBoundary,
  removeBoundary,
  type Persona,
  PERSONA_LIBRARY,
  PERSONA_REF_REGEX,
  renderPersonaRefs,
  getPersona,
  listPersonaIds,
  type PromptSection,
  sectionRegistry,
  registerSection,
  registerDynamicSection,
  registerDefaultPromptSections,
  type PromptConfig,
  PromptAssemblyPipeline,
  promptPipeline,
  type AgentDefinition,
  parseAgentDefinition,
  parseAgentDefinitionContent,
  AgentDefinitionLoader,
  agentDefinitionLoader,
} from './prompt/index.js'

// ========== Phase 1: Token 预算与压缩 ==========
export {
  type TokenBudgetConfig,
  type TokenBudget,
  type PatentTokenBudget,
  TokenBudgetManager,
  defaultTokenBudgetManager,
  type ContentType,
  type EstimateOptions,
  type ImageEstimateParams,
  estimateTextTokens,
  estimateMessagesTokens,
  estimateImageTokens,
  estimateBase64ImageTokens,
  TokenEstimator,
  tokenEstimator,
} from './token/index.js'

export {
  type CompactType,
  type CompactBoundary,
  type CompactResult,
  type CompactConfig,
  type ContentSummary,
  type CompactableContentType,
  type DocumentSegment,
  type SegmentLoadStrategy,
  microCompact,
  isCompactable,
  getCompactableTypes,
  createCompactBoundaryContent,
  parseCompactBoundary,
  isCompactBoundary,
  isMicroCompactBoundary,
  getMessagesAfterLastBoundary,
  extractBoundaries,
  calculateTotalTokensSaved,
  sessionMemoryCompact,
  calculateMessagesToKeepIndex,
  apiSummaryCompact,
  POST_COMPACT_TOKEN_BUDGET,
  POST_COMPACT_MAX_FILES_TO_RESTORE,
  POST_COMPACT_MAX_TOKENS_PER_FILE,
  DocumentSegmentLoader,
  PATENT_SECTION_TYPES,
  parseSpecificationIntoSegments,
  parseClaimsIntoSegments,
} from './compact/index.js'
