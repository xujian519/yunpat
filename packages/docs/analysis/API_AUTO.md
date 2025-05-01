# API 文档

自动生成时间: 2026-05-04T16:28:52.295Z

## @yunpat/builtin-tools

**版本**: 0.1.0
**描述**: YunPat 内置工具集 - 文件操作、搜索、网络请求等常用工具

### 导出

- `FileReadTool` (named)
- `FileWriteTool` (named)
- `FileAppendTool` (named)
- `FileDeleteTool` (named)
- `DirectoryListTool` (named)
- `GrepTool` (named)
- `GlobTool` (named)
- `AcademicSearchTool` (named)
- `WebFetchTool` (named)
- `WebSearchTool` (named)
- `WebNavigateTool` (named)
- `WebFindTabTool` (named)
- `WebSnapshotTool` (named)
- `WebClickTool` (named)
- `WebFillTool` (named)
- `WebEvaluateTool` (named)
- `WebScreenshotTool` (named)
- `WebWaitTool` (named)
- `WebExtractTextTool` (named)
- `WebScrollTool` (named)
- `KnowledgeSearchTool` (named)
- `KnowledgeIndexBuilderTool` (named)
- `CardMetadata` (named)
- `KnowledgeIndex` (named)
- `SearchResult` (named)
- `IterativeSearchTool` (named)
- `PatentSearchTool` (named)
- `SearchResultItem` (named)
- `IterativeSearchResult` (named)
- `MermaidChartTool` (named)
- `PatentClaimsStructureTool` (named)
- `PatentProcessChartTool` (named)

### 依赖

- `@yunpat/core`

---

## @yunpat/cli

**版本**: 0.1.0
**描述**: YunPat CLI - 命令行工具

### 依赖

- `@yunpat/agent-abstract-drafter`
- `@yunpat/agent-analysis`
- `@yunpat/agent-claim-generator`
- `@yunpat/agent-claims`
- `@yunpat/agent-invention`
- `@yunpat/agent-patent-analyzer`
- `@yunpat/agent-patent-manager`
- `@yunpat/agent-patent-responder`
- `@yunpat/agent-patent-writer`
- `@yunpat/agent-prior-art-search`
- `@yunpat/agent-quality`
- `@yunpat/agent-researcher`
- `@yunpat/agent-search`
- `@yunpat/agent-specification`
- `@yunpat/agent-specification-drafter`
- `@yunpat/agent-writer`
- `@yunpat/core`
- `@yunpat/patent-tools`

---

## @yunpat/core

**版本**: 0.1.0
**描述**: YunPat 核心框架 - 智能体抽象、事件总线、生命周期管理

### 导出

- `AgentInputError` (named)
- `AgentExecutionError` (named)
- `ExternalServiceError` (named)
- `ValidationError` (named)
- `Logger` (named)
- `createLogger` (named)
- `LogLevel` (named)
- `BaseGateway` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `InputSourceType` (named)
- `OutputTargetType` (named)
- `ApprovalFlow` (named)
- `ApprovalMode` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `ReActLoop` (named)
- `PlanAndSolveStrategy` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `TreeOfThoughtsStrategy` (named)
- `type` (named)
- `type` (named)
- `ReasoningStrategy` (named)
- `ChainOfThoughtStrategy` (named)
- `createChainOfThought` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `StepFormat` (named)
- `ReasoningCache` (named)
- `createReasoningCache` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `ReasoningMonitor` (named)
- `reasoningMonitor` (named)
- `type` (named)
- `type` (named)
- `ReasoningBatchProcessor` (named)
- `createBatchProcessor` (named)
- `type` (named)
- `type` (named)
- `EnhancedReflection` (named)
- `createEnhancedReflection` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `ReflectionDimension` (named)
- `QualityLevel` (named)
- `ImprovementPriority` (named)
- `NativeLLMAdapter` (named)
- `MultiModelManager` (named)
- `createDeepSeekModel` (named)
- `createQwenModel` (named)
- `createOllamaModel` (named)
- `type` (named)
- `type` (named)
- `NativeModel` (named)
- `OMLXAdapter` (named)
- `createOMXLModel` (named)
- `type` (named)
- `EmbeddingAdapter` (named)
- `createBGEEmbedding` (named)
- `type` (named)
- `LangChainAdapter` (named)
- `type` (named)
- `MultiModelLLMAdapter` (named)
- `TaskRouter` (named)
- `CostAwareLLMAdapter` (named)
- `createCostAwareAdapter` (named)
- `TaskComplexity` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `PromptTemplate` (named)
- `TemplateManager` (named)
- `createTemplate` (named)
- `createTemplateManager` (named)
- `BatchProcessor` (named)
- `type` (named)
- `type` (named)
- `AdaptiveTemperatureController` (named)
- `createAdaptiveTemperatureController` (named)
- `TemperaturePresets` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `SemanticCache` (named)
- `createSemanticCache` (named)
- `createSimpleSignatureGenerator` (named)
- `createEmbeddingBasedSignatureGenerator` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `KnowledgeBase` (named)
- `createKnowledgeBase` (named)
- `BUILTIN_KNOWLEDGE_BASES` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `KnowledgeEntryType` (named)
- `KnowledgeCardSchema` (named)
- `generateCardId` (named)
- `cardToMarkdown` (named)
- `markdownToCard` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `CardGenerator` (named)
- `type` (named)
- `CardRetriever` (named)
- `CardPipeline` (named)
- `IncrementalGenerator` (named)
- `type` (named)
- `EnhancedMemoryStore` (named)
- `CheckpointManager` (named)
- `ResumeManager` (named)
- `type` (named)
- `type` (named)
- `ShortTermMemory` (named)
- `MemoryManager` (named)
- `ToolRegistry` (named)
- `BaseTool` (named)
- `ToolWrapper` (named)
- `EnhancedToolRegistry` (named)
- `BaseTool` (named)
- `ToolWrapperClass` (named)
- `ToolCategory` (named)
- `ToolMetadata` (named)
- `ToolContext` (named)
- `EnhancedTool` (named)
- `ToolExecutionStats` (named)
- `MiddlewarePipeline` (named)
- `LoggingMiddleware` (named)
- `PermissionMiddleware` (named)
- `CacheMiddleware` (named)
- `RateLimitMiddleware` (named)
- `TracingMiddleware` (named)
- `Agent` (named)
- `AgentConfig` (named)
- `KnowledgeEnhancedAgent` (named)
- `type` (named)
- `LifecycleStage` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `EventBus` (named)
- `EventBusMetrics` (named)
- `type` (named)
- `ConfigManager` (named)
- `getConfigManager` (named)
- `resetConfigManager` (named)
- `TelemetryCollector` (named)
- `TelemetryEventType` (named)
- `EventStatus` (named)
- `AlertType` (named)
- `AlertSeverity` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `ResultValidator` (named)
- `CorrectionStrategy` (named)
- `ValidationErrorType` (named)
- `HallucinationDetector` (named)
- `WorkflowEngine` (named)
- `TaskDecomposer` (named)
- `DependencyAnalyzer` (named)
- `TaskScheduler` (named)
- `//` (named)
- `TaskStatus` (named)
- `TaskType` (named)
- `PlanStatus` (named)
- `ConstitutionalAI` (named)
- `ComplianceChecker` (named)
- `AutoCorrector` (named)
- `PATENT_PRINCIPLES` (named)
- `PrincipleCategory` (named)
- `ViolationSeverity` (named)
- `CorrectionStrategy` (named)
- `DynamicReplanner` (named)
- `DeviationDetector` (named)
- `RecoveryStrategySelector` (named)
- `IncrementalPlanner` (named)
- `ActiveLearningSystem` (named)
- `createActiveLearningSystem` (named)
- `createDefaultActiveLearningConfig` (named)
- `ToolDescriptionEnhancer` (named)
- `type` (named)
- `type` (named)
- `FewShotPromptManager` (named)
- `fewShotManager` (named)
- `type` (named)
- `ToolUsageTracker` (named)
- `toolUsageTracker` (named)
- `ToolSelectionOptimizer` (named)
- `toolSelectionOptimizer` (named)
- `SimilarityCalculator` (named)
- `similarityCalculator` (named)
- `VERSION` (declaration)
- `ARCHITECTURE` (declaration)

---

## @yunpat/document-tools

**版本**: 0.1.0
**描述**: YunPat 文档解析工具集 - 支持 PDF、DOCX、Excel、图片、音频等多种格式

### 导出

- `PdfExtractTextTool` (named)
- `PdfParseTool` (named)
- `PdfToMarkdownTool` (named)
- `PdfOcrTool` (named)
- `DocxExtractTextTool` (named)
- `DocxToHtmlTool` (named)
- `DocxToMarkdownTool` (named)
- `DocxParseTool` (named)
- `ExcelReadTool` (named)
- `ExcelToJsonTool` (named)
- `ExcelToMarkdownTool` (named)
- `ExcelParseTool` (named)
- `ImageOcrTool` (named)
- `BatchImageOcrTool` (named)
- `ImageToMarkdownTool` (named)
- `AudioTranscriptionTool` (named)
- `AudioToSrtTool` (named)
- `AudioToVttTool` (named)
- `AudioToMarkdownTool` (named)
- `UniversalDocumentParserTool` (named)
- `BatchDocumentParserTool` (named)
- `DocumentConverterTool` (named)
- `OfficialDocParserTool` (named)
- `OfficialDocFields` (named)
- `OfficialDocParseResult` (named)
- `OfficialDocType` (named)
- `OFFICIAL_DOC_PROMPTS` (named)
- `OfficialDocParserToolV2` (named)
- `OfficialDocFields` (named)
- `OfficialDocParseResult` (named)
- `PatentApplicationGeneratorTool` (named)
- `PatentClaimsGeneratorTool` (named)
- `ResponseStatementGeneratorTool` (named)
- `PatentApplicationData` (named)
- `ResponseStatementData` (named)
- `PptxExtractTextTool` (named)
- `PatentPresentationTool` (named)
- `TechnicalDisclosureTool` (named)
- `PatentTrainingTool` (named)
- `SlideData` (named)
- `PresentationData` (named)
- `DocumentCollaborationTool` (named)
- `PatentTemplateLibraryTool` (named)
- `DocumentChange` (named)
- `DocumentVersion` (named)
- `DocumentCollaborationSession` (named)

### 依赖

- `@yunpat/core`

---

## @yunpat/grpc-server

**版本**: 0.1.0
**描述**: YunPat gRPC Server - TypeScript 实现

---

## @yunpat/image-tools

**版本**: 0.1.0
**描述**: YunPat 图像识别工具集 - 化学结构、数学公式识别

### 导出

- `ChemicalStructureTool` (named)
- `MathFormulaTool` (named)

### 依赖

- `@yunpat/core`

---

## @yunpat/orchestrator

**版本**: 0.1.0
**描述**: YunPat Orchestrator Agent - 中枢层智能调度系统

### 导出

- `OrchestratorAgent` (named)
- `ContextManager` (named)
- `IntentRecognizer` (named)
- `TaskPlanner` (named)
- `HITLGenerator` (named)
- `ResultAggregator` (named)
- `ExceptionHandler` (named)

### 依赖

- `@yunpat/core`
- `@yunpat/agent-patent-writer`
- `@yunpat/agent-patent-analyzer`
- `@yunpat/agent-patent-responder`
- `@yunpat/agent-search`

---

## @yunpat/patent-core

**版本**: 0.1.0
**描述**: 专利核心算法桥接 - Rust CLI 调用与 TypeScript 降级

### 导出

- `setCliPath` (named)
- `extractFeatures` (named)
- `parseDisclosure` (named)
- `generateClaims` (named)
- `parseOa` (named)
- `recommendStrategy` (named)
- `reviseClaims` (named)
- `assessQuality` (named)
- `classifyIpc` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `extractFeaturesFallback` (named)
- `parseDisclosureFallback` (named)
- `generateClaimsFallback` (named)
- `isFallbackResult` (named)

---

## @yunpat/patent-knowledge

**版本**: 0.1.0
**描述**: 专利知识库桥接 - Obsidian知识库集成

### 导出

- `ObsidianKnowledgeBridge` (named)
- `type` (named)
- `type` (named)
- `KnowledgeGraphExporter` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `KnowledgeGraphTools` (named)
- `KnowledgeRAG` (named)
- `type` (named)

---

## @yunpat/patent-prompts

**版本**: 0.1.0
**描述**: 专利提示词模板管理器 - 支持分步加载和缓存

### 导出

- `PromptTemplateManager` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `DRAFTING_CLAIMS_PROMPT` (named)
- `renderDraftingClaimsPrompt` (named)
- `renderDraftingSpecificationPrompt` (named)

---

## @yunpat/patent-tools

**版本**: 0.1.0
**描述**: YunPat 专利工具集 - 权利要求生成、质量评估、审查答复等

### 导出

- `ClaimsGeneratorTool` (named)
- `FeatureExtractorTool` (named)
- `GooglePatentsFetchTool` (named)
- `GooglePatentDetailTool` (named)
- `PatentSearchTool` (named)
- `SimilarPatentSearchTool` (named)
- `PatentSearchMode` (named)
- `PatentDetailTool` (named)
- `HighCitationPatentsTool` (named)
- `PatentDownloadTool` (named)
- `BatchPatentDownloadTool` (named)
- `PatentType` (named)
- `ApplicantType` (named)
- `ClaimType` (named)
- `InventionType` (named)
- `ObjectionType` (named)
- `PatentRecord` (named)
- `ClaimDraft` (named)
- `TechnicalFeature` (named)
- `IndependentClaimParams` (named)
- `Objection` (named)
- `OfficeAction` (named)
- `CitedReference` (named)
- `QualityAssessment` (named)
- `ResponseStrategy` (named)
- `ResponsePlan` (named)
- `TechnicalFeatureSchema` (named)
- `IndependentClaimParamsSchema` (named)
- `ClaimDraftSchema` (named)
- `ObjectionSchema` (named)
- `OfficeActionSchema` (named)
- `CLAIMS_TEMPLATES` (named)
- `DEFAULT_PREAMBLES` (named)
- `DEFAULT_TRANSITION_WORDS` (named)
- `buildIndependentClaimPrompt` (named)
- `buildDependentClaimPrompt` (named)
- `buildQualityAssessmentPrompt` (named)
- `buildOfficeActionParsePrompt` (named)
- `buildResponseStrategyPrompt` (named)

### 依赖

- `@yunpat/core`

---

## @yunpat/unified-knowledge-graph

**版本**: 0.1.0
**描述**: 统一知识图谱服务 - 整合 OpenClaw、YunPat、Athena 三方专利知识图谱

### 导出

- `PostgreSQLClient` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `YunPatAdapter` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `PostgreSQLFirstKnowledgeGraph` (named)
- `createKnowledgeGraph` (named)
- `type` (named)
- `type` (named)
- `type` (named)
- `OpenClawAdapter` (named)
- `type` (named)
- `type` (named)
- `type` (named)

### 依赖

- `@yunpat/patent-knowledge`

---
