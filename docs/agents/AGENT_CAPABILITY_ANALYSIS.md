# YunPat Agent 能力边界与接口梳理

> 生成时间：2026-05-09
> 梳理范围：packages/packages/agents/ 下全部 29 个智能体子包

---

## 一、Agent 基类体系

```
Agent (packages/core/src/agent/Agent.ts)
  └── KnowledgeEnhancedAgent (packages/core)
        └── ProfessionalAgent (packages/agents/base)
              └── SkillsProfessionalAgent (packages/agents/base)
                    └── PatentWriterAgent, PatentAnalyzerAgentV2, PatentResponderAgentV5, ...
```

### 1.1 Agent（核心基类）

| 维度 | 说明 |
|------|------|
| **生命周期** | `before → init → [plan → (approval?) → act → reflect → checkpoint] × N → after` |
| **抽象方法** | `plan(input, context)` / `act(plan, context)` |
| **可选钩子** | `before()` / `init()` / `reflect()` / `after()` |
| **核心能力** | EventBus 通信、工具注册表、记忆系统、LLM 适配器、知识图谱集成 |

### 1.2 ProfessionalAgent（专业层基类）

| 维度 | 说明 |
|------|------|
| **统一入口** | `run(input, context) → AgentResult` |
| **内置辅助** | `callLLM(params) → string` / `validateInput()` / `formatErrorMessage()` |
| **输出格式** | `{ success, data, error?, executionTime, requiresHITL?, hitlCheckpoint? }` |
| **配置需求** | `name, description, llm, eventBus, memory, tools` |

### 1.3 SkillsProfessionalAgent（Skills 扩展基类）

| 维度 | 说明 |
|------|------|
| **扩展能力** | 自动加载 `@yunpat/skills` 技能系统 |
| **关键方法** | `loadSkills()` / `callSkill(name)` / `getActiveSkills(filePath)` / `callActiveSkill()` |
| **激活条件** | 基于 `ConditionalActivator` 的条件匹配 |

---

## 二、全部 29 个 Agent 总览

| # | 包名 | Agent 名称 | 基类 | 是否调用 LLM | 外部工具/数据库 | 成熟度 |
|---|------|-----------|------|-------------|----------------|--------|
| 1 | `agent-base` | ProfessionalAgent / SkillsProfessionalAgent | KnowledgeEnhancedAgent | - | - | 核心基类 |
| 2 | `agent-writer` | WriterAgent | KnowledgeEnhancedAgent | ✅ | 语义缓存、增量生成器 | **最成熟** |
| 3 | `agent-patent-analyzer` | ComparisonAnalyzerAgent | ProfessionalAgent | ✅ | PostgreSQLClient（审查规则库） | 成熟(100%) |
| 4 | `agent-patent-analyzer` | CreativeAnalyzerAgent | Agent | ✅ | LLM 多阶段调用 | 成熟(100%) |
| 5 | `agent-patent-responder` | PatentResponderAgentV5 | PatentResponderAgent(V1) | ✅ | PatentDatabaseAdapter、PostgreSQLClient | 成熟(100%) |
| 6 | `agent-search` | PatentSearchAgentV3 | Agent | ✅ | PatentDatabaseSearchTool、AcademicSearchTool | 成熟(100%) |
| 7 | `agent-invention` | InventionUnderstandingAgent | KnowledgeEnhancedAgent | ✅ | DuckDuckGo、Semantic Scholar、知识库 | 中等 |
| 8 | `agent-claims` | ClaimGeneratorAgent | Agent | ✅ | 权利要求模板、提取工具 | 中等 |
| 9 | `agent-specification` | SpecificationDrafterAgent | Agent | ✅ | 说明书模板 | 中等 |
| 10 | `agent-abstract-drafter` | AbstractDrafterAgent | Agent | ✅ | 无 | 较早 |
| 11 | `agent-prior-art-search` | PriorArtSearchAgent | KnowledgeEnhancedAgent | ❌ | Google Patents API | 较早 |
| 12 | `agent-quality` | EnhancedQualityCheckerAgent | QualityCheckerAgent | ✅ | 知识图谱 | 中等 |
| 13 | `agent-quality` | QualityCheckerAgent | Agent | ✅ | 无 | 中等 |
| 14 | `agent-quality-checker` | QualityCheckerAgent（规则版） | Agent | ❌ | 14 条内置规则 | 较早 |
| 15 | `agent-spec-formality-checker` | SpecFormalityChecker | Agent | ❌ | 无 | 较早 |
| 16 | `agent-subject-matter-checker` | SubjectMatterChecker | KnowledgeEnhancedAgent | ❌ | 无 | 较早 |
| 17 | `agent-unity-checker` | UnityChecker | Agent | ❌ | 无 | 较早 |
| 18 | `agent-tech-unit` | MinimumTechUnitAgent | ProfessionalAgent | ✅ | 无 | 较早 |
| 19 | `agent-analysis` | PriorArtAnalyzerAgent | KnowledgeEnhancedAgent | ✅ | 知识图谱(可选) | 较早 |
| 20 | `agent-analysis` | DisclosureRefinerAgent | Agent | ✅ | 无 | 较早 |
| 21 | `agent-analysis` | ComparisonReportGeneratorAgent | Agent | ✅ | 无 | 较早 |
| 22 | `agent-researcher` | ResearcherAgent | Agent | ✅ | 搜索引擎(模拟) | 较早 |
| 23 | `agent-legal-qa` | LegalQAAgent | ProfessionalAgent | ✅ | PostgreSQL（法条/案例/规则库） | 较早 |
| 24 | `agent-patent-manager` | PatentManagerAgent | Agent | ⚠️(仅报告) | PatentDatabase、状态机、通知服务 | 较早 |
| 25 | `agent-comparison-report-generator` | ComparisonReportGeneratorAgent | Agent | ❌ | 无 | 较早 |
| 26 | `agent-image-understanding` | DrawingUnderstandingAgent | Agent | ✅ | 多模态 LLM | 较早 |
| 27 | `agent-technical-drawing` | TechnicalDrawingAgent | Agent | ❌ | ChemicalStructureTool、MathFormulaTool | 较早 |
| 28 | `agent-format-converter` | PatentFormatConverterAgent | Agent | ❌ | PatentApplicationGeneratorTool、PatentClaimsGeneratorTool | 较早 |
| 29 | `agent-patent-manager` | - | - | - | - | - |

> **注**：`test`、`integration-tests`、`examples` 为测试与示例目录，不计入业务 Agent。

---

## 三、按类别详细梳理

### 3.1 撰写类 Agent（5 个）

---

#### **WriterAgent**（专利撰写智能体 - 最成熟）

| 维度 | 详情 |
|------|------|
| **能力边界** | 技术文档生成、格式转换、内容优化；语义缓存复用相似任务；增量生成基于历史版本只修改变更部分；可选智能工具选择 |
| **核心流程** | `plan()` 生成大纲 → `act()` 分章节并行生成 → `reflect()` 质量检查 |
| **工具调用** | `SemanticCache`（7天过期，相似度阈值0.85）、`IncrementalGenerator`（差异分析）、`EnhancedTool[]`（可选外部工具） |
| **系统提示词** | `"你是一个技术写作专家。语气：${plan.tone}。"` |
| **关键用户提示词** | 大纲生成：`"请为以下主题创建一个结构化的技术文档大纲..."`；章节生成：`"请为文档'${title}'撰写以下章节..."` |
| **输入** | `WritingTask { type: 'generate'\|'optimize'\|'convert'\|'format', topic, format?, requirements?, references? }` |
| **输出** | `WritingResult { document: {title, content, format}, stats: {wordCount, paragraphCount, sectionCount}, metadata, toolUsageStats? }` |

---

#### **InventionUnderstandingAgent**（发明理解智能体）

| 维度 | 详情 |
|------|------|
| **能力边界** | 深入理解技术交底书，提取**多组**问题-特征-效果三元组；术语标准化；一致性验证；外部技术搜索 |
| **核心流程** | 多阶段知识检索（方法论→术语→领域指南→验证规则）→ LLM 提取三元组 → 一致性验证 |
| **工具调用** | `queryKnowledgeWithFallback()`（知识库）、DuckDuckGo API、Semantic Scholar API、`fetchWebPage()`、`SkillLoader`、两级缓存 |
| **系统提示词** | 资深专利代理人角色；要求提取多组问题-特征-效果三元组；包含三步法框架、逻辑一致性/具体性/对比性要求；输出严格 JSON |
| **用户提示词** | 包含发明基本信息、现有技术、技术交底书全文、附图说明、参考案例、常见错误提醒、外部技术参考 |
| **输入** | `InventionUnderstandingInput { title, field, technicalDisclosure, priorArt?, drawings?, applicant?, inventors? }` |
| **输出** | `InventionUnderstandingOutput { inventionConcepts: Triplet[], technicalField, backgroundArt, embodimentSummary, drawingDescriptions, confidence, validation? }` |

---

#### **ClaimGeneratorAgent**（权利要求生成智能体）

| 维度 | 详情 |
|------|------|
| **能力边界** | 基于发明理解和检索分析，生成结构化独立/从属权利要求；两部分撰写法（前序+特征）；迭代修正（最多3次）；形式检查（清楚性A26.4、简要性、非必要技术特征） |
| **核心流程** | 加载模板 → LLM 生成 JSON → `reflect()` 检查必要特征完整性 + 形式检查 → 迭代修正 |
| **工具调用** | `llm.chat()`、`readFile()`（加载 `01-claims-generation.md` 模板）、`extractRequiredFeatures()`、`isFeatureCoveredInClaim()` |
| **系统提示词** | 资深专利代理师，15年经验；四大原则（清楚性、简要性、支持性、必要技术特征）；两部分撰写法；输出严格 JSON |
| **用户提示词** | 包含技术领域、背景技术、技术问题、方案、效果、关键特征、先导技术分析；要求输出 `independent_claims`、`dependent_claims`、`layout_strategy`、`protection_scope_analysis`、`quality_check` |
| **输入** | `ClaimGeneratorInput { inventionUnderstanding, priorArtSearch?, specificationDraft?, enableStepwiseConfirmation? }` |
| **输出** | `ClaimGeneratorOutput { claimsSet: {independent_claims, dependent_claims, layout_strategy, quality_check}, confidence }` |

---

#### **SpecificationDrafterAgent**（说明书撰写智能体）

| 维度 | 详情 |
|------|------|
| **能力边界** | 基于发明理解、检索分析和权利要求，撰写完整专利说明书（5章节：技术领域→背景技术→发明内容→具体实施方式→附图说明）；支持三种撰写模式（标准/详细/简洁）和质量检查 |
| **核心流程** | 加载模板 → 按章节生成 JSON（5分钟超时）→ 质量检查（术语一致性、充分公开A26.3、支持性A26.4） |
| **工具调用** | `llm.chat()`（5分钟超时）、`readFile()`（加载 `02-specification-drafting.md` 模板） |
| **系统提示词** | 资深专利代理师，15年经验；充分公开原则(A26.3)：清楚/完整/能够实现；各章节撰写要求（技术领域1段、背景技术2-3段、发明内容3-5段等）；输出严格 JSON |
| **用户提示词** | 包含发明理解、权利要求、先导技术分析、附图；明确各章节目标字数；要求按章节输出完整 JSON 结构 |
| **输入** | `SpecificationDrafterInput { inventionUnderstanding, priorArtSearch?, claimsSet?, drawings?, chapters?, draftMode?, patentType?, targetWordCount? }` |
| **输出** | `SpecificationDrafterOutput { specification: SpecificationContent, metrics, qualityScore, confidence, metadata }` |

---

#### **AbstractDrafterAgent**（摘要撰写智能体）

| 维度 | 详情 |
|------|------|
| **能力边界** | 基于说明书和权利要求撰写专利摘要；四大原则（简明扼要≤300字、客观准确、突出核心、避免细节）；关键要素自动检查 |
| **工具调用** | `llm.chat()` |
| **系统提示词** | 资深专利代理师，15年经验；四大摘要原则；输出严格 JSON |
| **用户提示词** | 包含发明理解、说明书发明内容、独立权利要求；要求输出 `content`、`wordCount`、`keyElements`、`confidence`；字数限制 |
| **输入** | `AbstractDrafterInput { inventionUnderstanding, specification, claims?, maxWords? }` |
| **输出** | `AbstractDrafterOutput { abstract: {content, wordCount, keyElements}, confidence }` |

---

### 3.2 检索类 Agent（3 个）

---

#### **PatentSearchAgentV3**（专利检索智能体 V3 - 集成真实数据库）

| 维度 | 详情 |
|------|------|
| **能力边界** | 基于发明理解生成检索策略；使用真实数据库（PatentDB 7500万CN专利 + Google Patents 全球专利）执行检索；支持学术论文检索 |
| **核心流程** | `plan()` 验证输入 → `act()` LLM 生成检索策略 → `PatentDatabaseSearchTool.execute()` 检索专利 → `AcademicSearchTool.execute()` 检索论文 |
| **工具调用** | `PatentDatabaseSearchTool`（双数据源）、`AcademicSearchTool` |
| **系统提示词** | 资深专利检索专家角色；要求生成关键词、IPC分类号、检索式、策略理由；输出严格 JSON |
| **用户提示词** | 包含发明名称、技术领域、技术问题、技术方案、关键特征 |
| **输入** | `SearchInput { title, field, technicalProblem, technicalSolution, keyFeatures[] }` |
| **输出** | `SearchOutput { strategy: SearchStrategy, results: StandardPatentRecord[], totalFound, academicPapers?, executionTime }` |

---

#### **PriorArtSearchAgent**（先导技术检索智能体）

| 维度 | 详情 |
|------|------|
| **能力边界** | 执行专利检索、分析结果相关性、生成现有技术分析报告、评估新颖性；**不调用 LLM**，纯逻辑处理 |
| **核心流程** | 提取关键词 → 构建多组查询 → Google Patents API 检索 → TF-IDF 相关性评分 → 统计分析 → 新颖性评估 |
| **工具调用** | Google Patents API (`patents.google.com/xhr/query`)、`queryKnowledgeWithFallback()` |
| **提示词** | 无显式 LLM 提示词 |
| **输入** | `PriorArtSearchInput { inventionUnderstanding?, claims[], patentType, inventionTitle, specification?, searchOptions? }` |
| **输出** | `PriorArtSearchResult { searchReport, relevantPatents[], analysis, overallReport, comparisonAnalysis? }` |

---

#### **ResearcherAgent**（研究分析师智能体）

| 维度 | 详情 |
|------|------|
| **能力边界** | 信息搜集、数据整理、分析报告生成；制定研究策略；信息提取与趋势分析；支持多数据源（web/academic/database） |
| **核心流程** | `plan()` 生成搜索策略 → `act()` 执行搜索（模拟）→ 信息提取 → 数据分析 → 趋势分析 |
| **工具调用** | `llm.chat()`（多阶段）、`performSearch()`（模拟实现） |
| **系统提示词** | 规划阶段：`"你是一个信息检索专家，擅长制定高效的研究策略。"`；提取阶段：`"你是一个信息提取专家。"`；分析阶段：`"你是一个数据分析专家。"` |
| **输入** | `ResearchQuery { question, depth, dataSources, timeRange, maxResults }` |
| **输出** | `ResearchResult { coreFindings, dataSummary, detailedAnalysis, rawResults, metadata }` |

---

### 3.3 分析类 Agent（5 个）

---

#### **ComparisonAnalyzerAgent**（对比分析智能体 - patent-analyzer 包）

| 维度 | 详情 |
|------|------|
| **能力边界** | 对目标发明与多篇对比文件进行交叉比对分析；两种模式（完整模式：含发明理解 / 仅对比文件模式）；创造性评估（三步法）；风险评估；审查规则检索 |
| **核心流程** | 规划阶段确定分析场景和阶段 → 对比文件交叉比对 → 找最接近对比文件 → 创造性评估 → 风险评估 → 生成建议 |
| **工具调用** | `PostgreSQLClient`（审查规则库，可选）、`callLLM()`（创造性/风险评估） |
| **系统提示词** | 审查意见分析：`"你是一位专业的专利审查员，擅长使用三步法评估创造性。"`；风险分析：`"你是一位专业的专利风险分析师。"` |
| **用户提示词** | 包含目标发明技术问题/方案/特征、对比文件汇总、最接近对比文件、区别特征、审查规则 |
| **输入** | `ComparisonAnalyzerInput { inventionUnderstanding?, priorArtAnalyses[], scenario? }` |
| **输出** | `ComparisonAnalyzerOutput { scenario, hasInventionUnderstanding, comparisons[], closestPriorArt?, creativityAssessment?, riskAssessment?, examinationRules?, recommendations[], metadata }` |

---

#### **CreativeAnalyzerAgent**（创造性分析智能体 - patent-analyzer 包）

| 维度 | 详情 |
|------|------|
| **能力边界** | 专业的专利创造性评估；技术问题/方案/效果分析；与现有技术区别分析；创造性证据收集；优化建议生成 |
| **核心流程** | 7 阶段管线：分析技术问题 → 分析技术方案 → 分析技术效果 → 对比现有技术 → 评估创造性 → 收集证据 → 生成建议 |
| **工具调用** | `llm.invoke()`（多阶段调用，maxTokens 1000-2000，temperature 0.7） |
| **系统提示词** | 多阶段分别使用：`"你是一位专业的专利分析师，擅长技术问题/方案/效果/现有技术对比/创造性评估。"` |
| **用户提示词** | 各阶段分别注入专利号、标题、摘要、权利要求、说明书、现有技术列表 |
| **输入** | `CreativeAnalyzerInput { patent: {publicationNumber, title, abstract, claims?, description?}, priorArt?, assessmentStandard?, technicalField? }` |
| **输出** | `CreativeAnalyzerOutput { basicInfo, creativityAssessment, problemAnalysis, solutionAnalysis, effectAnalysis, differencesFromPriorArt, evidence, recommendations }` |

---

#### **PriorArtAnalyzerAgent**（对比文件分析智能体 - analysis 包）

| 维度 | 详情 |
|------|------|
| **能力边界** | 对单篇对比文件（专利/论文/调研报告）进行深度技术分析；3 级分析深度（基础/深入/专家级）；可选知识图谱增强 |
| **核心流程** | 验证输入 → 确定分析深度 → LLM 分析（按深度截断 1500/3000/5000 字）→ 解析 JSON |
| **工具调用** | `context.llm.chat()`、`this.queryKnowledge()`（可选，检索 3 条相关知识） |
| **系统提示词** | 资深技术分析专家角色；要求分析技术问题、提取技术方案核心和关键特征、识别并量化技术效果；输出严格 JSON |
| **输入** | `PriorArtAnalyzerInput { document: PriorArtDocument, analysisDepth, enableKnowledgeEnhancement? }` |
| **输出** | `PriorArtAnalysis { documentInfo, technicalAnalysis: {technicalProblem, technicalSolution, keyFeatures, technicalEffects}, metadata }` |

---

#### **DisclosureRefinerAgent**（交底书再分析智能体 - analysis 包）

| 维度 | 详情 |
|------|------|
| **能力边界** | 基于对比分析结果对原始发明理解进行提炼优化；区分创新特征/已知特征/组合特征；优化技术问题表述；明确保护范围建议 |
| **核心流程** | 输入原始发明理解 + 对比分析结果 → LLM 提炼 → 输出优化后的理解和改进建议 |
| **工具调用** | `context.llm.chat()`（temperature 0.3） |
| **系统提示词** | 资深专利代理师角色；要求提炼真正的问题-特征-效果、区分特征类型、优化技术问题、明确保护范围、给出改进建议；输出严格 JSON |
| **输入** | `DisclosureRefinerInput { originalInvention, comparisonReport }` |
| **输出** | `RefinedInventionUnderstanding { refined: {inventionName, coreInnovation, featureClassification, protectionScope}, improvements[] }` |

---

#### **ComparisonReportGeneratorAgent**（对比报告生成智能体 - analysis 包）

| 维度 | 详情 |
|------|------|
| **能力边界** | 分析发明与现有技术的区别；评估区别特征新颖性程度（高/中/低）；分析技术问题提炼；评估创造性；给出保护范围建议 |
| **工具调用** | `context.llm.chat()`（temperature 0.3） |
| **系统提示词** | 资深专利对比分析专家角色；要求识别区别特征、评估新颖性、分析技术问题提炼、评估创造性、给出保护范围建议；输出严格 JSON |
| **输入** | `ComparisonReportInput { inventionUnderstanding, priorArtAnalysis[] }` |
| **输出** | `ComparisonReport { closestPriorArt, distinguishingFeatures, refinedTechnicalProblem/Solution/Effects, creativityAssessment, protectionScope }` |

---

### 3.4 答复类 Agent（1 个主版本）

---

#### **PatentResponderAgentV5**（审查意见答复智能体 V5）

| 维度 | 详情 |
|------|------|
| **能力边界** | OA 审查意见答复全流程：审查意见分析 → 答复策略生成 → 答复文档撰写 → 后续建议生成；集成真实数据库先例检索；法律知识库检索（无效决定/法院案例/审查指南） |
| **核心流程** | `plan()` 自动检索先例 → 父类 `plan()` 分析审查意见 → `act()` 父类生成答复 → 检索法律先例 → 合并输出 |
| **工具调用** | `PatentDatabaseAdapter`（先例检索）、`PostgreSQLClient`（法律先例：无效决定/法院案例/审查规则）、`llm.chat()`（4 阶段）、`SkillLoader`（模板） |
| **系统提示词** | 4 阶段分别使用：审查意见分析专家 → 答复策略专家 → 答复文档撰写专家 → 专利策略顾问 |
| **用户提示词** | 动态注入审查意见内容、对比文件、原始权利要求书、原始说明书（截断 3000 字）、策略偏好 |
| **输入** | `PatentResponderInputV2 { officeAction, originalApplication, strategyPreference?, enablePrecedentSearch?, searchOptions?, enableLegalKnowledge? }` |
| **输出** | `PatentResponderOutputV3 { analysis, strategy, responseDocument, nextSteps, precedentSearchInfo?, precedents?, legalPrecedents? }` |

---

### 3.5 质检类 Agent（7 个）

---

#### **EnhancedQualityCheckerAgent**（增强质量检查智能体 - quality 包）

| 维度 | 详情 |
|------|------|
| **能力边界** | 在基础版质量检查上添加知识库检索能力；执行权利要求质量检查、说明书质量检查、形式检查，并生成改进建议 |
| **工具调用** | `context.llm.chat()`、知识图谱 `queryKnowledge()`（检索 5 个查询主题，各取 Top-2） |
| **系统提示词** | 权利要求检查：`"你是一位专利质量检查专家。检查维度：1.保护范围 2.清楚性 3.支持性（A26.4）"`；说明书检查：`"检查维度：1.充分公开（A26.3）2.术语一致性 3.完整性"` |
| **输入/输出** | 同基础版 QualityCheckerAgent |

---

#### **QualityCheckerAgent**（基础版质量检查智能体 - quality 包）

| 维度 | 详情 |
|------|------|
| **能力边界** | 权利要求质量检查、说明书质量检查、形式检查、改进建议生成；支持 camelCase/snake_case 自动转换 |
| **工具调用** | `context.llm.chat()`（权利要求+说明书检查）、纯程序化规则（形式检查） |
| **系统提示词** | 同 Enhanced 版（无 knowledgeContext 拼接）；temperature 0.3 |
| **输入** | `QualityCheckerInput { claims: {independentClaims[], dependentClaims[]}, specification, inventionUnderstanding? }` |
| **输出** | `QualityCheckResult { overallScore, claimsCheck, specificationCheck, formalCheck, improvementSuggestions[] }` |

---

#### **QualityCheckerAgent**（规则版质量检查智能体 - quality-checker 包）

| 维度 | 详情 |
|------|------|
| **能力边界** | 纯规则驱动的质量检查；完整性检查、4 维度质量评分（权利要求/说明书/语言/法律）、14 条内置规则库、自动修复建议、对比分析和排名 |
| **工具调用** | **无 LLM 调用**；`createLogger`、14 条内置规则（CLAIM_001~004, SPEC_001~005, LANG_001~003, LEGAL_001） |
| **输入** | `QualityCheckInput { claims[], specification, patentType, inventionTitle, drawings?, checkLevel?, enableAutoFix? }` |
| **输出** | `QualityCheckResult { completenessScore, qualityScores, overallQuality, qualityLevel, issues[], recommendations[], fixOperations?, comparison, metadata }` |

---

#### **SpecFormalityChecker**（说明书形式审查智能体）

| 维度 | 详情 |
|------|------|
| **能力边界** | 说明书形式审查：A26.3 充分公开、A26.4 清楚简要、实施细则第 17 条必要组成部分、第 18 条附图说明、第 19 条具体实施方式、权利要求书一致性 |
| **工具调用** | **无 LLM 调用**；纯规则/正则匹配；`createLogger` |
| **输入** | `SpecCheckInput { specification, claims?, patentType }` |
| **输出** | `SpecFormalityCheckResult { article26_3_disclosure, article26_4_clarity, rule17_components, rule18_drawings, rule19_embodiment, claimsConsistency, overallReport }` |

---

#### **SubjectMatterChecker**（保护客体审查智能体）

| 维度 | 详情 |
|------|------|
| **能力边界** | 保护客体审查：A2 发明定义/技术方案判断、A25 不授予专利权的客体、智力活动规则和方法、疾病诊断治疗方法、违法性检查（A5）、其他排除客体（科学发现/动植物品种/原子核变换/单纯计算机程序） |
| **工具调用** | **无 LLM 调用**；纯正则模式匹配 + 关键词提取；`createLogger` |
| **输入** | `SubjectMatterCheckInput { inventionTitle, claims[], specification?, patentType }` |
| **输出** | `SubjectMatterCheckResult { article2_inventionDefinition, article25_exclusions, technicalSolutionAnalysis, intellectualActivityCheck, legalityCheck, overallReport }` |

---

#### **UnityChecker**（单一性审查智能体）

| 维度 | 详情 |
|------|------|
| **能力边界** | 单一性审查：实施细则第 43-44 条；识别独立权利要求技术特征；识别相同或相应的特定技术特征；检查单一性要求；评估总的发明构思；技术关联性评分（0-100） |
| **工具调用** | **无 LLM 调用**；纯算法驱动（字符重叠度、Jaccard 相似度、余弦相似度基于二元组）；`createLogger` |
| **输入** | `UnityCheckInput { claims[], patentType, inventionTitle? }` |
| **输出** | `UnityCheckResult { rule43_unity, rule44_generalConcept, featureAnalysis, unityAnalysis, overallReport }` |

---

#### **MinimumTechUnitAgent**（最小技术单元提取智能体）

| 维度 | 详情 |
|------|------|
| **能力边界** | 最小技术单元提取；基于《专利侵权判定指南》第 8 条、最高法判决确立的"最小技术单元"概念；五步识别法；自动检测技术方案类型（产品/方法） |
| **工具调用** | `this.callLLM()`（增强技术特征分析：确定技术功能、效果、不可再分性、置信度）；基于正则和标点分割的特征提取 |
| **提示词** | 单一用户 Prompt：`"你是一位专利技术特征分析专家。请分析以下{product/method}权利要求，为每个已提取的技术特征确定其独立的技术功能和技术效果。"`；temperature 0.3；输出 JSON 数组 |
| **输入** | `TechUnitExtractInput { claimText, schemeType?, technicalField?, technicalProblem?, technicalEffects?, specificationSummary?, scenario?, granularityBias? }` |
| **输出** | `TechUnitExtractOutput { schemeType, detectionMethod, units[], indivisibilityTests[], synergyTests[], selfCheckResults[], summary }` |

---

### 3.6 工具类 Agent（3 个）

---

#### **DrawingUnderstandingAgent**（附图理解智能体）

| 维度 | 详情 |
|------|------|
| **能力边界** | 使用多模态 LLM 理解专利说明书附图；分析附图类型、主要组件、连接关系、文字标签、结构层次、技术特征提取；输出带置信度的结构化理解结果 |
| **工具调用** | `context.llm.chat()`（temperature 0.3）、`fs/promises`（读取本地图像文件并 Base64 编码） |
| **系统提示词** | 资深专利代理师和技术文档专家角色；要求输出严格 JSON 格式，包含 8 个字段（figureType, overview, components, connections, labels, annotations, structureAnalysis, correspondence, confidence） |
| **用户提示词** | 动态构建，包含附图编号/标题/原描述、相关技术方案、Base64 编码图像 |
| **输入** | `DrawingInput { figureNumber, figureTitle?, description?, imagePath, imageFormat?, imageBase64?, technicalField?, technicalSolution? }` |
| **输出** | `DrawingUnderstanding { figureNumber, figureType, overview, components, connections, labels, annotations, structureAnalysis, correspondence, confidence, timestamp }` |

---

#### **TechnicalDrawingAgent**（技术图纸识别智能体）

| 维度 | 详情 |
|------|------|
| **能力边界** | 技术图纸识别和提取；支持 4 种图纸类型：通用图纸（OCR）、化学结构（SMILES）、数学公式（LaTeX）、电学符号；自动类型检测 |
| **工具调用** | `ChemicalStructureTool`（化学结构→SMILES）、`MathFormulaTool`（数学公式→LaTeX）、模拟 OCR、内置电学符号表（15 种） |
| **输入** | `DrawingRecognitionInput { imageData, imageFormat?, drawingType?, autoDetect? }` |
| **输出** | `DrawingRecognitionOutput { success, detectedType, ocrText?, chemicalStructure?, mathFormula?, elements[], recognitionTimeMs }` |

---

#### **PatentFormatConverterAgent**（专利格式转换智能体）

| 维度 | 详情 |
|------|------|
| **能力边界** | Markdown → DOCX 格式转换；支持 CNIPA/USPTO/EPO 三种专利局格式；Markdown 章节解析、权利要求解析（独立/从属）、格式合规检查（摘要≤300字、名称≤40字、权利要求≤10项） |
| **工具调用** | `PatentApplicationGeneratorTool`（生成说明书 DOCX）、`PatentClaimsGeneratorTool`（生成权利要求书 DOCX）、`fs` |
| **输入** | `FormatConverterInput { inputFormat, outputFormat, patentOfficeFormat, content, outputPath, metadata?, autoFormatCheck? }` |
| **输出** | `FormatConverterOutput { success, outputPath, outputFormat, fileSize, pages, formatCheckReport?, conversionTimeMs }` |

---

### 3.7 管理类 Agent（2 个）

---

#### **PatentManagerAgent**（专利管理智能体）

| 维度 | 详情 |
|------|------|
| **能力边界** | 专利全生命周期管理：专利申请 CRUD、期限管理与提醒、费用管理与监控、状态跟踪与报告、工作流程协调（状态机验证状态流转） |
| **工具调用** | `PatentDatabase`（CRUD）、`PatentStateMachine`（状态流转验证）、`NotificationService`（通知）、`llm.chat()`（仅生成管理报告） |
| **系统提示词**（报告生成） | 专利管理顾问角色；要求生成包括总体概况、状态分析、风险提示、建议的管理报告 |
| **输入** | `PatentManagerInput { operation: ManagerOperation, data? }`（14 种操作类型） |
| **输出** | `PatentManagerOutput { success, data?, error?, metadata }` |

---

#### **LegalQAAgent**（法律问答智能体）

| 维度 | 详情 |
|------|------|
| **能力边界** | 基于法律世界模型的三库联动问答系统；多源法律知识检索（法条、案例、审查指南）；回答中清晰标注引用来源；结构化回答（先结论后分析） |
| **工具调用** | `PostgreSQLClient`（`structuredSearch()` 法条搜索、`queryInvalidDecisions()` 无效决定、`entitySearch()` 实体搜索、直接 SQL 查询 `patent_rules_unified` 表）、`this.callLLM()`（基于检索结果生成回答） |
| **系统提示词** | 专业法律专家角色；要求基于提供的事实和法条回答、清晰标注引用来源、结构化回答（先结论后分析）、信息不足时明确说明 |
| **用户提示词** | 包含问题 + 相关法条列表 + 相关案例列表 + 审查指南列表 |
| **输入** | `LegalQAInput { question, domain?, dataSources?, topK? }` |
| **输出** | `LegalQAOutput { answer, legalReferences, caseReferences, ruleReferences, confidence, sourceStats, executionTime }` |

---

### 3.8 其他 Agent（1 个）

---

#### **ComparisonReportGeneratorAgent**（对比报告生成智能体 - 独立包）

| 维度 | 详情 |
|------|------|
| **能力边界** | 本申请 vs 现有技术的对比分析（纯规则/模板驱动，不调用 LLM）；差异识别（结构、功能、效果）；生成 Markdown 格式结构化报告 |
| **工具调用** | **无 LLM 调用**；纯确定性规则；`createLogger` |
| **输入** | `ComparisonReportInput { application, priorArt[], options? }` |
| **输出** | `ComparisonReportResult { report, analysis, metadata }` |

> **注**：该 Agent 与 `analysis` 包中的同名 Agent 关键区别在于：analysis 包版本是 LLM 驱动，独立包版本是纯规则驱动。

---

## 四、关键横向对比

### 4.1 LLM 依赖度分布

| 依赖度 | Agent 列表 |
|--------|-----------|
| **强依赖**（核心逻辑由 LLM 驱动） | WriterAgent、InventionUnderstandingAgent、ClaimGeneratorAgent、SpecificationDrafterAgent、AbstractDrafterAgent、PatentSearchAgentV3、ComparisonAnalyzerAgent、CreativeAnalyzerAgent、PriorArtAnalyzerAgent、DisclosureRefinerAgent、ComparisonReportGeneratorAgent(analysis)、ResearcherAgent、LegalQAAgent、PatentResponderAgentV5、DrawingUnderstandingAgent、MinimumTechUnitAgent、EnhancedQualityCheckerAgent、QualityCheckerAgent(quality) |
| **弱依赖**（仅报告/辅助使用 LLM） | PatentManagerAgent |
| **无 LLM**（纯规则/算法驱动） | PriorArtSearchAgent、QualityCheckerAgent(quality-checker)、SpecFormalityChecker、SubjectMatterChecker、UnityChecker、TechnicalDrawingAgent、PatentFormatConverterAgent、ComparisonReportGeneratorAgent(独立包) |

### 4.2 数据库/外部服务依赖

| 服务类型 | 使用 Agent |
|----------|-----------|
| **PostgreSQL**（专利规则/法条/案例） | ComparisonAnalyzerAgent、PatentResponderAgentV5、LegalQAAgent |
| **PatentDatabaseAdapter**（7500万CN专利） | PatentSearchAgentV3、PatentResponderAgentV5 |
| **Google Patents API** | PriorArtSearchAgent、PatentSearchAgentV3 |
| **AcademicSearchTool** | PatentSearchAgentV3 |
| **DuckDuckGo / Semantic Scholar** | InventionUnderstandingAgent |
| **知识图谱** | InventionUnderstandingAgent、EnhancedQualityCheckerAgent、PriorArtAnalyzerAgent |

### 4.3 提示词设计模式

| 模式 | 代表 Agent | 说明 |
|------|-----------|------|
| **单阶段 JSON 输出** | AbstractDrafterAgent、ClaimGeneratorAgent、SpecificationDrafterAgent | 一次 LLM 调用，要求输出严格 JSON |
| **多阶段分治** | PatentResponderAgentV5、CreativeAnalyzerAgent | 将任务拆分为多个阶段，每阶段独立 System Prompt |
| **RAG 增强** | LegalQAAgent、ComparisonAnalyzerAgent | 先检索相关知识/法条/案例，再注入 LLM Prompt |
| **模板渲染** | ClaimGeneratorAgent、SpecificationDrafterAgent、PatentResponderAgentV5 | 从文件系统加载 `.md` 模板，动态渲染后作为 Prompt |
| **无提示词** | 纯规则 Agent | 不调用 LLM，无 Prompt 设计 |

---

## 五、输入输出类型系统汇总

全部 Agent 共享基础类型定义在 `packages/agents/base/src/types.ts`：

```typescript
// Agent 唯一标识符
export type AgentId =
  | 'patent-search' | 'patent-analyzer' | 'patent-responder' | 'patent-writer'
  | 'patent-manager' | 'claim-generator' | 'specification-drafter' | 'abstract-drafter'
  | 'invention' | 'tech-unit' | 'analysis' | 'prior-art-search' | 'quality'
  | 'quality-checker' | 'image-understanding' | 'researcher' | 'legal-qa' | 'writer'

// 统一执行结果
export interface AgentResult<T = unknown> {
  success: boolean
  data: T
  error?: AgentError
  executionTime: number
  requiresHITL?: boolean
  hitlCheckpoint?: string
  metadata?: Record<string, unknown>
}

// 结构化错误
export interface AgentError {
  code: AgentErrorCode
  message: string
  details?: unknown
  retryable: boolean
}
```

---

*文档结束*
