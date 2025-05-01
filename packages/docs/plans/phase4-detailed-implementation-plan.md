# Phase 4: 中枢层详细实施计划

**创建日期**: 2026-05-04
**版本**: v1.0
**状态**: 🎯 待启动
**预计周期**: 4-5周（无时间压力，质量优先）
**基于**: Phase 1-3已完成（工具层95%、执行层90%、专业层100%）

---

## 📋 目录

- [项目背景](#项目背景)
- [总体目标](#总体目标)
- [架构设计](#架构设计)
- [实施策略](#实施策略)
- [Week 1-2: 核心框架开发](#week-1-2-核心框架开发)
- [Week 3: 上下文管理](#week-3-上下文管理)
- [Week 4: 事件系统与集成](#week-4-事件系统与集成)
- [Week 5: 端到端测试与优化](#week-5-端到端测试与优化)
- [质量保证](#质量保证)
- [风险管理](#风险管理)
- [验收标准](#验收标准)

---

## 项目背景

### 当前项目状态

**已完成阶段**：

| 阶段             | 完成度 | 关键成果                              |
| ---------------- | ------ | ------------------------------------- |
| Phase 1 - 工具层 | 95%    | 所有核心工具已实现，微服务架构完善    |
| Phase 2 - 执行层 | 90%    | 15个Agent中的9个+已完成，测试覆盖优异 |
| Phase 3 - 专业层 | 100%   | 4个专业Agent全部实现（31k+行代码）    |
| 代码质量改进     | 100%   | 7.2→8.5（+18%），400+测试用例         |

**测试覆盖**：

- 1586个测试全部通过 ✅
- 70个测试文件
- 55个源文件

**代码质量**：

- 整体评分：8.5/10
- 类型安全：8/10
- 测试覆盖：优异
- 文档完整：完整

---

## 总体目标

### Phase 4核心目标

实现**OrchestratorAgent（中枢层）**，作为整个系统的智能调度中心：

1. **意图识别** - 理解用户需求，分类为9种意图类型
2. **任务规划** - 自动生成多步骤执行计划
3. **HITL交互** - 关键节点人机交互确认
4. **结果聚合** - 整合多Agent输出结果
5. **异常降级** - 优雅处理错误和边缘情况

### 关键指标

- **测试覆盖率**：≥90%（单元测试）+ ≥80%（集成测试）
- **响应时间**：意图识别<2s，任务规划<5s，完整流程<120s
- **准确率**：意图识别≥90%，任务规划有效性≥85%
- **代码质量**：≥8.5/10（保持当前水平）
- **文档完整度**：100%（API文档、架构文档、使用指南）

---

## 架构设计

### OrchestratorAgent架构

```
┌─────────────────────────────────────────────────────────────┐
│                   OrchestratorAgent                          │
│                  (中枢层 - Layer 0)                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           Context Manager（上下文管理）                │   │
│  │  • 对话历史  • 活跃任务  • 用户画像  • 知识域        │   │
│  └──────────────────────────────────────────────────────┘   │
│                          ↓                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           5-Call LLM Pipeline（5次调用流程）          │   │
│  │                                                        │   │
│  │  Call 1: Intent Recognition（意图识别）               │   │
│  │  Call 2: Task Planning（任务规划）                    │   │
│  │  Call 3: HITL Generation（人机交互生成）             │   │
│  │  Call 4: Result Aggregation（结果聚合）               │   │
│  │  Call 5: Exception Handling（异常降级）               │   │
│  └──────────────────────────────────────────────────────┘   │
│                          ↓                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           EventBus Communication（事件总线）           │   │
│  │  • 中枢→专业层  • 专业层→中枢  • 执行层并行调度      │   │
│  └──────────────────────────────────────────────────────┘   │
│                          ↓                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           Routing Logic（路由逻辑）                   │   │
│  │  • 简单路由（直达Agent）  • 复杂编排（TaskPlan）     │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                   Layer 1: 专业层                            │
│  PatentWriterAgent | PatentResponderAgent | ...           │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                   Layer 2: 执行层                            │
│  15个执行层Agent（SearchAgent, AnalysisAgent, ...）         │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                   Layer 3: 工具层                            │
│  patent-tools | builtin-tools | document-tools              │
└─────────────────────────────────────────────────────────────┘
```

---

## 实施策略

### 开发原则

1. **Karpathy编程原则**
   - 🟢 **简化模式**：单行修改、明显格式调整
   - 🟡 **标准模式**：小功能实现、简单bug修复（默认）
   - 🔴 **完整模式**：架构设计、多文件修改、API设计（Phase 4默认）

2. **TDD驱动开发**
   - 测试覆盖率≥90%（单元测试）
   - 集成测试覆盖率≥80%
   - 使用真实LLM测试（不使用Mock）
   - 本地模型：Qwen2.5 7B、DeepSeek-R1

3. **质量优先**
   - 无时间压力
   - 每周Code Review
   - 持续集成验证
   - 性能基准测试

4. **增量交付**
   - Week 1-2：核心框架（Call 1-2）
   - Week 3：上下文管理
   - Week 4：事件系统与集成
   - Week 5：端到端测试与优化

---

## Week 1-2: 核心框架开发

### 目标

实现OrchestratorAgent核心功能：意图识别和任务规划

---

### Day 1-2: 架构设计与基础框架

#### 任务1.1：设计OrchestratorAgent接口

**文件**：`packages/orchestrator/src/OrchestratorAgent.ts`

**接口定义**：

```typescript
interface OrchestratorAgentConfig extends AgentConfig {
  // LLM配置
  llmConfig: {
    provider: 'anthropic' | 'openai' | 'local'
    model: string
    temperature?: number
    maxTokens?: number
  }

  // 意图识别配置
  intentConfig: {
    confidenceThreshold: number // 默认0.7
    maxClarifyRounds: number // 默认3
  }

  // 任务规划配置
  planningConfig: {
    maxSteps: number // 默认20
    defaultTimeout: number // 默认30000ms
    enableParallel: boolean // 默认true
  }

  // HITL配置
  hitlConfig: {
    autoConfirmThreshold: number // 默认0.9
    timeout: number // 默认300000ms（5分钟）
  }
}

interface OrchestratorInput {
  sessionId: string
  userId: string
  message: string
  attachments?: Attachment[]
  context?: Record<string, any>
}

interface OrchestratorOutput {
  response: string
  attachments?: Attachment[]
  suggestedActions?: string[]
  requiresHITL: boolean
  hitlCheckpoint?: HITLCheckpoint
  metadata: {
    intent: IntentType
    confidence: number
    executionTime: number
    stepsExecuted: number
  }
}
```

**验收标准**：

- ✅ 接口定义完整
- ✅ TypeScript类型安全
- ✅ JSDoc注释完整
- ✅ 通过编译检查

---

#### 任务1.2：实现OrchestratorAgent基础框架

**文件**：`packages/orchestrator/src/OrchestratorAgent.ts`

**实现内容**：

```typescript
export class OrchestratorAgent extends Agent<
  OrchestratorInput,
  OrchestratorOutput,
  OrchestratorPlan
> {
  private contextManager: ContextManager
  private intentRecognizer: IntentRecognizer
  private taskPlanner: TaskPlanner
  private hitlGenerator: HITLGenerator
  private resultAggregator: ResultAggregator
  private exceptionHandler: ExceptionHandler

  constructor(config: OrchestratorAgentConfig) {
    super(config)
    // 初始化各个组件
    this.contextManager = new ContextManager(config)
    this.intentRecognizer = new IntentRecognizer(config)
    this.taskPlanner = new TaskPlanner(config)
    this.hitlGenerator = new HITLGenerator(config)
    this.resultAggregator = new ResultAggregator(config)
    this.exceptionHandler = new ExceptionHandler(config)
  }

  // 主入口
  async execute(input: OrchestratorInput): Promise<OrchestratorOutput> {
    // 实现主流程
  }

  // 5次LLM调用
  private async call1_IntentRecognition(input: OrchestratorInput): Promise<IntentRecognitionResult>
  private async call2_TaskPlanning(intent: IntentRecognitionResult): Promise<TaskPlan>
  private async call3_HITLGeneration(plan: TaskPlan): Promise<HITLRequest | null>
  private async call4_ResultAggregation(results: AgentResult[]): Promise<AggregatedResult>
  private async call5_ExceptionHandling(
    error: Error,
    context: ExecutionContext
  ): Promise<RecoveryResult>
}
```

**验收标准**：

- ✅ 基础框架搭建完成
- ✅ 5个组件初始化成功
- ✅ 主流程框架定义
- ✅ 单元测试通过（基础功能）

---

### Day 3-5: Call 1 - 意图识别

#### 任务1.3：实现IntentRecognizer

**文件**：`packages/orchestrator/src/intent/IntentRecognizer.ts`

**核心功能**：

1. **9种意图类型分类**

```typescript
type IntentType =
  | 'DRAFT_FULL' // 完整专利撰写
  | 'DRAFT_CLAIMS' // 仅撰写/修改权利要求
  | 'DRAFT_SPEC' // 仅撰写说明书
  | 'RESPOND_OA' // 审查意见答复
  | 'SEARCH' // 现有技术检索
  | 'ANALYZE_PORTFOLIO' // 专利组合分析
  | 'MULTI_INTENT' // 一条消息包含多个任务
  | 'CLARIFY' // 意图不明确，需要追问
  | 'CHITCHAT' // 闲聊、感谢、询问功能

interface IntentRecognitionResult {
  intent: IntentType
  confidence: number // 0-1
  complexity: 'simple' | 'complex'
  extracted: {
    title?: string
    field?: string
    hasAttachment: boolean
    urgency: 'normal' | 'urgent'
    keywords: string[]
  }
  clarifyQuestion?: string // 仅当intent=CLARIFY时
}
```

2. **System Prompt设计**

```typescript
private getIntentRecognitionSystemPrompt(): string {
  return `你是一个专利代理AI助手的中枢意图识别专家。

## 你的角色
你是用户输入的第一道关口，负责准确理解用户意图，为后续任务规划提供基础。

## 9种意图类型

### 核心业务意图（6个）
1. **DRAFT_FULL** - 完整专利撰写
   - 特征：用户要求撰写完整的专利申请文件
   - 关键词："撰写专利"、"写专利"、"申请专利"、"完整"
   - 提取：发明名称、技术领域、申请人信息

2. **DRAFT_CLAIMS** - 仅撰写/修改权利要求
   - 特征：明确提到"权利要求"、"权要"、" Claims"
   - 关键词："权利要求"、"权要"、"保护范围"
   - 提取：权利要求数量、类型（独立/从属）

3. **DRAFT_SPEC** - 仅撰写说明书
   - 特征：明确提到"说明书"、"具体实施方式"
   - 关键词："说明书"、"具体实施方式"、"背景技术"
   - 提取：说明书章节要求

4. **RESPOND_OA** - 审查意见答复
   - 特征：提到"审查意见"、"OA"、"答复"、"反驳"
   - 关键词："审查意见"、"OA"、"答复"、"审查员"
   - 提取：OA文件、审查意见类型

5. **SEARCH** - 现有技术检索
   - 特征：明确要求检索、查找相关技术
   - 关键词："检索"、"搜索"、"查新"、"现有技术"
   - 提取：检索关键词、技术领域、时间范围

6. **ANALYZE_PORTFOLIO** - 专利组合分析
   - 特征：分析多个专利的组合情况
   - 关键词："专利组合"、"专利分析"、"技术布局"
   - 提取：专利列表、分析维度

### 系统意图（3个）
7. **MULTI_INTENT** - 一条消息包含多个任务
   - 特征：包含多个不同的任务需求
   - 判断：包含2个及以上核心意图的特征

8. **CLARIFY** - 意图不明确，需要追问
   - 特征：信息不足，无法确定具体意图
   - 处理：生成追问语句

9. **CHITCHAT** - 闲聊、感谢、询问功能
   - 特征：非业务相关的对话
   - 示例："你好"、"谢谢"、"你能做什么"

## 置信度评估
- **≥0.9**：非常确定，直接执行
- **0.7-0.9**：较确定，正常执行
- **<0.7**：不确定，进入CLARIFY流程

## 复杂度评估
- **simple**：可直接路由到单一Agent
- **complex**：需要编排多步计划

## 输出格式
严格按照JSON Schema输出。`
}
```

3. **Few-shot示例库**

```typescript
private getFewShotExamples(): FewShotExample[] {
  return [
    {
      input: "帮我撰写一个关于智能控制器的专利申请",
      output: {
        intent: "DRAFT_FULL",
        confidence: 0.95,
        complexity: "complex",
        extracted: {
          title: "智能控制器",
          field: "控制技术",
          hasAttachment: false,
          urgency: "normal",
          keywords: ["智能控制器", "撰写", "专利申请"]
        }
      }
    },
    {
      input: "我有一份审查意见，需要帮忙答复",
      output: {
        intent: "CLARIFY",
        confidence: 0.5,
        complexity: "complex",
        extracted: {
          hasAttachment: false,
          urgency: "normal",
          keywords: ["审查意见", "答复"]
        },
        clarifyQuestion: "请问您是否已经上传了审查意见文件？如果已上传，我将自动分析审查意见并生成答复策略。"
      }
    },
    // ... 更多示例
  ]
}
```

**验收标准**：

- ✅ 9种意图类型分类准确
- ✅ 置信度计算合理
- ✅ Few-shot示例≥10个
- ✅ 单元测试≥20个（覆盖所有意图类型）
- ✅ 集成测试使用真实LLM
- ✅ 测试准确率≥90%

---

#### 任务1.4：实现路由逻辑

**文件**：`packages/orchestrator/src/router/Router.ts`

**路由策略**：

```typescript
interface RoutingDecision {
  type: 'direct' | 'orchestrated' | 'clarify' | 'chitchat'
  targetAgent?: string
  taskPlan?: TaskPlan
  clarifyQuestion?: string
  chitchatResponse?: string
}

class Router {
  route(intent: IntentRecognitionResult): RoutingDecision {
    // CHITCHAT - 直接回复
    if (intent.intent === 'CHITCHAT') {
      return {
        type: 'chitchat',
        chitchatResponse: this.generateChitchatResponse(),
      }
    }

    // CLARIFY - 追问
    if (intent.intent === 'CLARIFY') {
      return {
        type: 'clarify',
        clarifyQuestion: intent.clarifyQuestion,
      }
    }

    // SIMPLE - 直接路由（跳过专业层）
    if (intent.complexity === 'simple') {
      return {
        type: 'direct',
        targetAgent: this.getDirectAgent(intent.intent),
      }
    }

    // COMPLEX - 编排执行
    return {
      type: 'orchestrated',
      // taskPlan将在Call 2中生成
    }
  }

  private getDirectAgent(intent: IntentType): string {
    const directRoutes = {
      DRAFT_CLAIMS: 'patent-writer',
      DRAFT_SPEC: 'patent-writer',
      SEARCH: 'search-agent',
      DRAFT_FULL: 'patent-writer', // 编排模式
      RESPOND_OA: 'patent-responder', // 编排模式
      ANALYZE_PORTFOLIO: 'patent-analyzer', // 编排模式
    }
    return directRoutes[intent]
  }
}
```

**验收标准**：

- ✅ 9种意图类型路由正确
- ✅ 简单路由直达Agent
- ✅ 复杂编排进入TaskPlanning
- ✅ 单元测试≥15个

---

### Day 6-8: Call 2 - 任务规划

#### 任务1.5：实现TaskPlanner

**文件**：`packages/orchestrator/src/planning/TaskPlanner.ts`

**核心功能**：

1. **TaskPlan生成**

```typescript
interface TaskPlan {
  planId: string
  intent: IntentType
  estimatedMinutes: number
  steps: TaskStep[]
  hitlCheckpoints: string[] // 需要用户确认的stepId列表
  metadata: {
    createdAt: Date
    parallelizable: boolean
    estimatedCost?: number
  }
}

interface TaskStep {
  stepId: string
  agentId: string
  layer: 'domain' | 'execution'
  parallel: boolean
  dependsOn: string[] // 依赖的stepId列表
  timeout: number
  input: Record<string, any>
  hitl: boolean
  hitlDescription?: string
  retryOnFailure: boolean
  maxRetries: number
}
```

2. **System Prompt设计**

```typescript
private getTaskPlanningSystemPrompt(): string {
  return `你是一个专利代理AI助手的中枢任务规划专家。

## 你的角色
基于识别出的用户意图，生成可执行的多步骤任务计划。

## 可用Agent资源

### 专业层（Layer 1）- 编排层
- **patent-writer**: 专利撰写编排
  - 能力：检索编排、知识库查询、权利要求生成、说明书撰写
  - 超时：60s
  - 并行：支持部分步骤并行

- **patent-responder**: 审查答复编排
  - 能力：OA解析、反证检索、答复策略、答复生成
  - 超时：90s
  - 并行：支持部分步骤并行

- **patent-analyzer**: 专利分析编排
  - 能力：组合分析、技术分布、价值评估
  - 超时：45s
  - 并行：支持大部分步骤并行

- **creative-analyzer**: 创造性分析编排
  - 能力：区别特征分析、技术效果判断、创造性评估
  - 超时：30s
  - 并行：有限并行

### 执行层（Layer 2）- 原子能力
- **search-agent**: 检索（简单+迭代）
- **analysis-agent**: 技术特征分析
- **quality-agent**: 质量评估
- **knowledge-agent**: 知识库查询
- **document-agent**: 文档解析
- **research-agent**: 技术研究
- **prior-art-search-agent**: 现有技术检索
- **ipc-categorization-agent**: IPC分类
- **search-query-builder-agent**: 检索式构建
- **writing-agent**: 格式转换（Markdown → DOCX）
- **technical-drawing-agent**: 技术图纸识别
- **claims-formality-checker**: 权利要求形式检查
- **spec-formality-checker**: 说明书形式检查
- **unity-checker**: 单一性检查
- **subject-matter-checker**: 客体检查

## 任务规划原则

1. **依赖关系明确**
   - 必须明确标注步骤之间的依赖关系
   - 并行步骤之间不能有依赖

2. **超时合理设置**
   - 检索类：30-60s
   - 分析类：20-40s
   - 撰写类：40-80s
   - 格式转换：10-20s

3. **HITL检查点**
   - 关键决策点必须设置HITL
   - 权利要求确认
   - 答复策略确认
   - 重要修改确认

4. **错误处理**
   - 关键步骤设置重试
   - 非关键步骤可降级
   - 明确失败影响

5. **并行优化**
   - 无依赖的步骤必须并行
   - 估算时间节省

## 输出格式
严格按照JSON Schema输出。`
}
```

3. **意图→TaskPlan映射**

```typescript
private generateTaskPlan(intent: IntentRecognitionResult): TaskPlan {
  switch (intent.intent) {
    case 'DRAFT_FULL':
      return this.generateDraftFullPlan(intent)
    case 'DRAFT_CLAIMS':
      return this.generateDraftClaimsPlan(intent)
    case 'DRAFT_SPEC':
      return this.generateDraftSpecPlan(intent)
    case 'RESPOND_OA':
      return this.generateRespondOAPlan(intent)
    case 'SEARCH':
      return this.generateSearchPlan(intent)
    case 'ANALYZE_PORTFOLIO':
      return this.generateAnalyzePortfolioPlan(intent)
    default:
      throw new Error(`Unsupported intent: ${intent.intent}`)
  }
}

private generateDraftFullPlan(intent: IntentRecognitionResult): TaskPlan {
  return {
    planId: uuid(),
    intent: 'DRAFT_FULL',
    estimatedMinutes: 45,
    steps: [
      // Step 1: 并行检索（可并行）
      {
        stepId: 'search-prior-art',
        agentId: 'search-agent',
        layer: 'execution',
        parallel: true,
        dependsOn: [],
        timeout: 60000,
        input: {
          mode: 'iterative',
          query: intent.extracted.title,
          databases: ['cn_patent', 'us_patent']
        },
        hitl: false,
        retryOnFailure: true,
        maxRetries: 3
      },
      {
        stepId: 'query-knowledge-base',
        agentId: 'knowledge-agent',
        layer: 'execution',
        parallel: true,
        dependsOn: [],
        timeout: 30000,
        input: {
          query: intent.extracted.title,
          domain: intent.extracted.field
        },
        hitl: false,
        retryOnFailure: true,
        maxRetries: 2
      },
      // Step 2: 发明理解（依赖Step 1）
      {
        stepId: 'understand-invention',
        agentId: 'patent-writer',
        layer: 'domain',
        parallel: false,
        dependsOn: ['search-prior-art', 'query-knowledge-base'],
        timeout: 60000,
        input: {
          task: 'understand-invention',
          inventionTitle: intent.extracted.title
        },
        hitl: false,
        retryOnFailure: true,
        maxRetries: 2
      },
      // Step 3: 权利要求撰写（HITL检查点）
      {
        stepId: 'draft-claims',
        agentId: 'patent-writer',
        layer: 'domain',
        parallel: false,
        dependsOn: ['understand-invention'],
        timeout: 90000,
        input: {
          task: 'draft-claims'
        },
        hitl: true,
        hitlDescription: '请审阅生成的权利要求，确认保护范围和技术特征是否准确',
        retryOnFailure: true,
        maxRetries: 2
      },
      // Step 4: 说明书撰写
      {
        stepId: 'draft-specification',
        agentId: 'patent-writer',
        layer: 'domain',
        parallel: false,
        dependsOn: ['draft-claims'],
        timeout: 120000,
        input: {
          task: 'draft-specification'
        },
        hitl: false,
        retryOnFailure: true,
        maxRetries: 2
      },
      // Step 5: 形式检查（并行）
      {
        stepId: 'claims-formality-check',
        agentId: 'claims-formality-checker',
        layer: 'execution',
        parallel: true,
        dependsOn: ['draft-claims'],
        timeout: 30000,
        input: {},
        hitl: false,
        retryOnFailure: false,
        maxRetries: 0
      },
      {
        stepId: 'spec-formality-check',
        agentId: 'spec-formality-checker',
        layer: 'execution',
        parallel: true,
        dependsOn: ['draft-specification'],
        timeout: 30000,
        input: {},
        hitl: false,
        retryOnFailure: false,
        maxRetries: 0
      },
      // Step 6: 格式转换
      {
        stepId: 'generate-docx',
        agentId: 'writing-agent',
        layer: 'execution',
        parallel: false,
        dependsOn: ['draft-specification', 'claims-formality-check', 'spec-formality-check'],
        timeout: 30000,
        input: {
          format: 'docx',
          patentOfficeFormat: 'CNIPA'
        },
        hitl: false,
        retryOnFailure: true,
        maxRetries: 2
      }
    ],
    hitlCheckpoints: ['draft-claims'],
    metadata: {
      createdAt: new Date(),
      parallelizable: true,
      estimatedCost: 0.15
    }
  }
}
```

**验收标准**：

- ✅ 6种核心意图的TaskPlan生成
- ✅ 依赖关系正确
- ✅ 并行优化合理
- ✅ HITL检查点设置合理
- ✅ 单元测试≥30个（覆盖所有意图）
- ✅ 集成测试使用真实LLM
- ✅ 任务规划有效性≥85%

---

#### 任务1.6：实现TaskExecutor

**文件**：`packages/orchestrator/src/executor/TaskExecutor.ts`

**核心功能**：

1. **TaskPlan执行**

```typescript
class TaskExecutor {
  async execute(plan: TaskPlan, context: ExecutionContext): Promise<TaskExecutionResult> {
    // 构建DAG
    const dag = this.buildDAG(plan.steps)

    // 执行
    const results = await this.executeDAG(dag, context)

    // 处理HITL
    if (this.hasHITLCheckpoints(plan)) {
      const hitlResults = await this.handleHITL(plan, results)
      return { ...results, hitlResults }
    }

    return results
  }

  private buildDAG(steps: TaskStep[]): DAG {
    // 构建有向无环图
    // 拓扑排序
    // 识别并行层
  }

  private async executeDAG(dag: DAG, context: ExecutionContext): Promise<Map<string, AgentResult>> {
    const results = new Map<string, AgentResult>()

    // 按层执行
    for (const layer of dag.layers) {
      if (layer.length === 1) {
        // 串行
        const result = await this.executeStep(layer[0], context)
        results.set(layer[0].stepId, result)
      } else {
        // 并行
        const layerResults = await Promise.all(layer.map((step) => this.executeStep(step, context)))
        layerResults.forEach((result, i) => {
          results.set(layer[i].stepId, result)
        })
      }
    }

    return results
  }

  private async executeStep(step: TaskStep, context: ExecutionContext): Promise<AgentResult> {
    const agent = this.agentRegistry.get(step.agentId)

    try {
      const result = await this.executeWithTimeout(agent.execute(step.input, context), step.timeout)

      if (step.hitl) {
        return { ...result, requiresHITL: true }
      }

      return result
    } catch (error) {
      if (step.retryOnFailure && step.maxRetries > 0) {
        return this.retryStep(step, context, error)
      }

      throw error
    }
  }

  private async executeWithTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeout)),
    ])
  }

  private async retryStep(
    step: TaskStep,
    context: ExecutionContext,
    error: Error
  ): Promise<AgentResult> {
    // 实现重试逻辑
  }

  private hasHITLCheckpoints(plan: TaskPlan): boolean {
    return plan.hitlCheckpoints.length > 0
  }

  private async handleHITL(
    plan: TaskPlan,
    results: Map<string, AgentResult>
  ): Promise<HITLResult[]> {
    // 实现HITL处理
  }
}
```

**验收标准**：

- ✅ DAG构建正确
- ✅ 并行执行效率提升≥50%
- ✅ 超时处理正确
- ✅ 重试机制工作正常
- ✅ 单元测试≥20个
- ✅ 集成测试≥5个

---

### Day 9-10: Week 1-2总结与测试

#### 任务1.7：集成测试与验收

**测试文件**：`packages/orchestrator/test/integration/week1-2-integration.test.ts`

**测试用例**：

```typescript
describe('Week 1-2 Integration Tests', () => {
  describe('Intent Recognition', () => {
    it('should correctly identify DRAFT_FULL intent', async () => {
      const input = {
        sessionId: 'test-1',
        userId: 'test-user',
        message: '帮我撰写一个关于智能控制器的专利申请',
      }

      const result = await orchestrator.execute(input)

      expect(result.metadata.intent).toBe('DRAFT_FULL')
      expect(result.metadata.confidence).toBeGreaterThanOrEqual(0.7)
    })

    it('should correctly identify CLARIFY intent', async () => {
      const input = {
        sessionId: 'test-2',
        userId: 'test-user',
        message: '我有一份审查意见，需要帮忙答复',
      }

      const result = await orchestrator.execute(input)

      expect(result.metadata.intent).toBe('CLARIFY')
      expect(result.requiresHITL).toBe(true)
    })

    // ... 更多测试
  })

  describe('Task Planning', () => {
    it('should generate valid TaskPlan for DRAFT_FULL', async () => {
      const intent: IntentRecognitionResult = {
        intent: 'DRAFT_FULL',
        confidence: 0.95,
        complexity: 'complex',
        extracted: {
          title: '智能控制器',
          field: '控制技术',
          hasAttachment: false,
          urgency: 'normal',
          keywords: ['智能控制器', '撰写', '专利申请'],
        },
      }

      const plan = await taskPlanner.generatePlan(intent)

      expect(plan.steps.length).toBeGreaterThan(0)
      expect(plan.hitlCheckpoints.length).toBeGreaterThan(0)
      expect(plan.estimatedMinutes).toBeGreaterThan(0)
    })

    it('should correctly identify parallelizable steps', async () => {
      const plan = await taskPlanner.generatePlan(/* ... */)

      const parallelSteps = plan.steps.filter((s) => s.parallel)
      expect(parallelSteps.length).toBeGreaterThan(0)
    })

    // ... 更多测试
  })

  describe('End-to-End', () => {
    it('should execute complete DRAFT_FULL workflow', async () => {
      const input = {
        sessionId: 'test-e2e-1',
        userId: 'test-user',
        message: '帮我撰写一个关于智能控制器的专利申请',
      }

      const result = await orchestrator.execute(input)

      expect(result.metadata.intent).toBe('DRAFT_FULL')
      expect(result.metadata.stepsExecuted).toBeGreaterThan(0)
      expect(result.metadata.executionTime).toBeLessThan(120000)
    }, 120000)

    // ... 更多测试
  })
})
```

**验收标准**：

- ✅ 所有集成测试通过
- ✅ 意图识别准确率≥90%
- ✅ 任务规划有效性≥85%
- ✅ 性能测试通过（完整流程<120s）
- ✅ 代码审查通过
- ✅ 文档更新

---

## Week 3: 上下文管理

### 目标

实现完整的上下文管理系统，支持对话历史、活跃任务、用户画像等。

---

### Day 1-3: Context Manager实现

#### 任务2.1：实现ContextManager核心功能

**文件**：`packages/orchestrator/src/context/ContextManager.ts`

**核心功能**：

1. **对话历史管理**

```typescript
interface ConversationMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  metadata?: Record<string, any>
}

interface ConversationHistory {
  sessionId: string
  messages: ConversationMessage[]
  totalTokens: number
  lastUpdated: Date
}

class ContextManager {
  private histories: Map<string, ConversationHistory>
  private maxHistoryLength: number = 100
  private maxTokens: number = 100000

  async addMessage(sessionId: string, message: ConversationMessage): Promise<void> {
    let history = this.histories.get(sessionId)

    if (!history) {
      history = {
        sessionId,
        messages: [],
        totalTokens: 0,
        lastUpdated: new Date(),
      }
      this.histories.set(sessionId, history)
    }

    history.messages.push(message)
    history.totalTokens += await this.estimateTokens(message.content)
    history.lastUpdated = new Date()

    // 压缩历史
    await this.compressHistoryIfNeeded(sessionId)
  }

  async getHistory(sessionId: string): Promise<ConversationMessage[]> {
    const history = this.histories.get(sessionId)
    return history?.messages || []
  }

  private async compressHistoryIfNeeded(sessionId: string): Promise<void> {
    const history = this.histories.get(sessionId)

    if (!history) return

    // Token超限，压缩
    if (history.totalTokens > this.maxTokens) {
      await this.compressHistory(sessionId)
    }

    // 消息过多，压缩
    if (history.messages.length > this.maxHistoryLength) {
      await this.compressHistory(sessionId)
    }
  }

  private async compressHistory(sessionId: string): Promise<void> {
    const history = this.histories.get(sessionId)
    if (!history) return

    // 保留最近20条消息
    const recentMessages = history.messages.slice(-20)

    // 早期消息摘要
    const earlyMessages = history.messages.slice(0, -20)
    const summary = await this.summarizeMessages(earlyMessages)

    history.messages = [
      {
        id: uuid(),
        role: 'system',
        content: `[历史对话摘要]\n${summary}`,
        timestamp: new Date(),
      },
      ...recentMessages,
    ]

    history.totalTokens = await this.recalculateTokens(sessionId)
  }

  private async summarizeMessages(messages: ConversationMessage[]): Promise<string> {
    // 使用LLM生成摘要
  }

  private async estimateTokens(text: string): Promise<number> {
    // 简单估算：中文≈0.7 token/字符，英文≈0.25 token/字符
    const chineseChars = text.match(/[一-龥]/g)?.length || 0
    const englishChars = text.length - chineseChars

    return Math.ceil(chineseChars * 0.7 + englishChars * 0.25)
  }
}
```

2. **活跃任务状态管理**

```typescript
interface ActiveTask {
  taskId: string
  sessionId: string
  plan: TaskPlan
  status: 'running' | 'waiting_hitl' | 'paused' | 'completed' | 'failed'
  currentStepId?: string
  completedSteps: string[]
  results: Map<string, AgentResult>
  startTime: Date
  lastUpdate: Date
}

class ContextManager {
  private activeTasks: Map<string, ActiveTask>

  async createActiveTask(plan: TaskPlan, sessionId: string): Promise<string> {
    const task: ActiveTask = {
      taskId: uuid(),
      sessionId,
      plan,
      status: 'running',
      completedSteps: [],
      results: new Map(),
      startTime: new Date(),
      lastUpdate: new Date(),
    }

    this.activeTasks.set(task.taskId, task)
    return task.taskId
  }

  async updateTaskStatus(
    taskId: string,
    status: ActiveTask['status'],
    currentStepId?: string
  ): Promise<void> {
    const task = this.activeTasks.get(taskId)
    if (!task) throw new Error(`Task not found: ${taskId}`)

    task.status = status
    task.currentStepId = currentStepId
    task.lastUpdate = new Date()
  }

  async getActiveTask(sessionId: string): Promise<ActiveTask | null> {
    const tasks = Array.from(this.activeTasks.values())
    return tasks.find((t) => t.sessionId === sessionId && t.status === 'running') || null
  }

  async completeStep(taskId: string, stepId: string, result: AgentResult): Promise<void> {
    const task = this.activeTasks.get(taskId)
    if (!task) throw new Error(`Task not found: ${taskId}`)

    task.completedSteps.push(stepId)
    task.results.set(stepId, result)
    task.lastUpdate = new Date()
  }
}
```

3. **用户画像管理**

```typescript
interface UserProfile {
  userId: string
  role: 'patent_agent' | 'lawyer' | 'enterprise_ip' | 'individual'
  outputFormat: 'detailed' | 'concise' | 'technical'
  domains: string[] // 常用技术领域
  preferences: {
    language: 'zh' | 'en'
    includeLegalBasis: boolean
    includeExamples: boolean
    tone: 'formal' | 'friendly' | 'professional'
  }
  statistics: {
    totalTasks: number
    taskTypes: Record<string, number>
    averageTaskDuration: number
    lastActive: Date
  }
}

class ContextManager {
  private userProfiles: Map<string, UserProfile>

  async getUserProfile(userId: string): Promise<UserProfile> {
    let profile = this.userProfiles.get(userId)

    if (!profile) {
      profile = await this.createDefaultProfile(userId)
      this.userProfiles.set(userId, profile)
    }

    return profile
  }

  async updateUserPreferences(
    userId: string,
    preferences: Partial<UserProfile['preferences']>
  ): Promise<void> {
    const profile = await this.getUserProfile(userId)
    profile.preferences = { ...profile.preferences, ...preferences }
  }

  async recordTaskCompletion(
    userId: string,
    taskType: IntentType,
    duration: number
  ): Promise<void> {
    const profile = await this.getUserProfile(userId)
    profile.statistics.totalTasks++
    profile.statistics.taskTypes[taskType] = (profile.statistics.taskTypes[taskType] || 0) + 1

    // 更新平均时长
    const total = profile.statistics.totalTasks
    const current = profile.statistics.averageTaskDuration
    profile.statistics.averageTaskDuration = (current * (total - 1) + duration) / total

    profile.statistics.lastActive = new Date()
  }

  private async createDefaultProfile(userId: string): Promise<UserProfile> {
    return {
      userId,
      role: 'individual',
      outputFormat: 'detailed',
      domains: [],
      preferences: {
        language: 'zh',
        includeLegalBasis: true,
        includeExamples: true,
        tone: 'professional',
      },
      statistics: {
        totalTasks: 0,
        taskTypes: {},
        averageTaskDuration: 0,
        lastActive: new Date(),
      },
    }
  }
}
```

**验收标准**：

- ✅ 对话历史管理正常
- ✅ 历史压缩工作正常
- ✅ 活跃任务状态跟踪正确
- ✅ 用户画像管理完整
- ✅ 单元测试≥25个
- ✅ 集成测试≥5个

---

### Day 4-5: HITL系统实现

#### 任务2.2：实现HITLGenerator

**文件**：`packages/orchestrator/src/hitl/HITLGenerator.ts`

**核心功能**：

```typescript
interface HITLRequest {
  checkpointId: string
  stepId: string
  description: string
  data: Record<string, any>
  options: {
    confirmButtonText: string
    rejectButtonText: string
    modificationAllowed: boolean
    timeout: number
  }
}

interface HITLResponse {
  action: 'confirm' | 'reject' | 'modify'
  modifications?: Record<string, any>
  feedback?: string
}

class HITLGenerator {
  async generateHITLRequest(step: TaskStep, result: AgentResult): Promise<HITLRequest | null> {
    if (!step.hitl) return null

    return {
      checkpointId: uuid(),
      stepId: step.stepId,
      description: step.hitlDescription || '请确认以下结果',
      data: result.data,
      options: {
        confirmButtonText: '确认',
        rejectButtonText: '修改',
        modificationAllowed: true,
        timeout: 300000, // 5分钟
      },
    }
  }

  async processHITLResponse(request: HITLRequest, response: HITLResponse): Promise<HITLResult> {
    switch (response.action) {
      case 'confirm':
        return { status: 'confirmed', data: request.data }
      case 'reject':
        return { status: 'rejected', feedback: response.feedback }
      case 'modify':
        return { status: 'modified', data: response.modifications }
    }
  }
}
```

**验收标准**：

- ✅ HITL请求生成正确
- ✅ HITL响应处理正确
- ✅ 超时处理正常
- ✅ 单元测试≥15个
- ✅ 集成测试≥3个

---

### Day 6-7: Week 3总结与测试

#### 任务2.3：集成测试与验收

**测试文件**：`packages/orchestrator/test/integration/week3-integration.test.ts`

**验收标准**：

- ✅ 所有集成测试通过
- ✅ 对话历史压缩正常
- ✅ HITL流程完整
- ✅ 用户画像工作正常
- ✅ 性能测试通过
- ✅ 代码审查通过
- ✅ 文档更新

---

## Week 4: 事件系统与集成

### 目标

实现EventBus通信协议，完成与专业层、执行层的集成。

---

### Day 1-3: EventBus实现

#### 任务3.1：实现EventBus通信协议

**文件**：`packages/orchestrator/src/eventbus/EventBus.ts`

**核心功能**：

```typescript
type EventHandler = (event: Event) => Promise<void> | void

interface Event {
  type: string
  payload: any
  timestamp: Date
  source: string
}

class EventBus {
  private handlers: Map<string, EventHandler[]>
  private eventHistory: Event[]
  private maxHistorySize: number = 1000

  on(eventType: string, handler: EventHandler): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, [])
    }
    this.handlers.get(eventType)!.push(handler)
  }

  off(eventType: string, handler: EventHandler): void {
    const handlers = this.handlers.get(eventType)
    if (!handlers) return

    const index = handlers.indexOf(handler)
    if (index > -1) {
      handlers.splice(index, 1)
    }
  }

  async emit(eventType: string, payload: any, source: string = 'orchestrator'): Promise<void> {
    const event: Event = {
      type: eventType,
      payload,
      timestamp: new Date(),
      source,
    }

    // 记录历史
    this.eventHistory.push(event)
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift()
    }

    // 触发处理器
    const handlers = this.handlers.get(eventType) || []
    await Promise.all(handlers.map((handler) => handler(event)))
  }

  async emitAll(events: { type: string; payload: any }[]): Promise<void> {
    await Promise.all(events.map((e) => this.emit(e.type, e.payload)))
  }

  getHistory(eventType?: string): Event[] {
    if (eventType) {
      return this.eventHistory.filter((e) => e.type === eventType)
    }
    return [...this.eventHistory]
  }

  clearHistory(): void {
    this.eventHistory = []
  }
}
```

**通信协议**：

```typescript
// 中枢 → 专业层
eventBus.emit('agent:dispatch', {
  agentId: 'patent-writer',
  taskId: uuid(),
  payload: contextSnapshot,
  timeout: 30_000,
})

// 专业层 → 中枢
eventBus.emit('agent:complete', {
  taskId,
  agentId: 'patent-writer',
  result: DraftResult,
  requiresHITL: true,
  hitlCheckpoint: 'review-claims',
})

// 执行层并行任务
eventBus.emitAll([
  { event: 'exec:search', payload: query },
  { event: 'exec:knowledge', payload: templateQuery },
])
```

**验收标准**：

- ✅ EventBus基础功能正常
- ✅ 通信协议定义完整
- ✅ 事件历史记录正常
- ✅ 单元测试≥20个
- ✅ 集成测试≥5个

---

### Day 4-5: Agent集成

#### 任务3.2：集成专业层Agent

**文件**：`packages/orchestrator/src/integration/AgentRegistry.ts`

**核心功能**：

```typescript
class AgentRegistry {
  private agents: Map<string, Agent>

  register(agentId: string, agent: Agent): void {
    this.agents.set(agentId, agent)
  }

  get(agentId: string): Agent {
    const agent = this.agents.get(agentId)
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`)
    }
    return agent
  }

  async dispatch(agentId: string, input: any, context: ExecutionContext): Promise<AgentResult> {
    const agent = this.get(agentId)

    try {
      const result = await agent.execute(input, context)
      return result
    } catch (error) {
      // 错误处理
      throw error
    }
  }

  async dispatchParallel(
    requests: Array<{
      agentId: string
      input: any
      context: ExecutionContext
    }>
  ): Promise<AgentResult[]> {
    return Promise.all(requests.map((req) => this.dispatch(req.agentId, req.input, req.context)))
  }
}
```

**集成测试**：

```typescript
describe('Agent Integration Tests', () => {
  it('should dispatch task to PatentWriterAgent', async () => {
    const result = await registry.dispatch(
      'patent-writer',
      {
        task: 'draft-claims',
        input: {
          /* ... */
        },
      },
      context
    )

    expect(result).toBeDefined()
    expect(result.success).toBe(true)
  })

  it('should dispatch parallel tasks', async () => {
    const results = await registry.dispatchParallel([
      {
        agentId: 'search-agent',
        input: {
          /* ... */
        },
        context,
      },
      {
        agentId: 'knowledge-agent',
        input: {
          /* ... */
        },
        context,
      },
    ])

    expect(results).toHaveLength(2)
    expect(results.every((r) => r.success)).toBe(true)
  })

  // ... 更多测试
})
```

**验收标准**：

- ✅ Agent注册正常
- ✅ Agent调度正常
- ✅ 并行调度效率提升≥50%
- ✅ 错误处理完善
- ✅ 单元测试≥15个
- ✅ 集成测试≥8个

---

### Day 6-7: Week 4总结与测试

#### 任务3.3：集成测试与验收

**测试文件**：`packages/orchestrator/test/integration/week4-integration.test.ts`

**验收标准**：

- ✅ 所有集成测试通过
- ✅ EventBus通信正常
- ✅ Agent集成完整
- ✅ 并行调度效率达标
- ✅ 性能测试通过
- ✅ 代码审查通过
- ✅ 文档更新

---

## Week 5: 端到端测试与优化

### 目标

完成端到端测试、性能优化、文档完善。

---

### Day 1-3: 端到端测试

#### 任务4.1：实现端到端测试套件

**测试文件**：`packages/orchestrator/test/e2e/e2e.test.ts`

**测试用例**：

```typescript
describe('End-to-End Tests', () => {
  describe('9 Intent Types', () => {
    it('DRAFT_FULL - complete workflow', async () => {
      const input = {
        sessionId: 'e2e-draft-full',
        userId: 'test-user',
        message: '帮我撰写一个关于智能控制器的专利申请',
      }

      const result = await orchestrator.execute(input)

      // 验证意图识别
      expect(result.metadata.intent).toBe('DRAFT_FULL')
      expect(result.metadata.confidence).toBeGreaterThanOrEqual(0.7)

      // 验证执行步骤
      expect(result.metadata.stepsExecuted).toBeGreaterThan(0)

      // 验证输出
      expect(result.response).toBeDefined()
      expect(result.attachments).toBeDefined()
    }, 120000)

    it('DRAFT_CLAIMS - claims only workflow', async () => {
      // ... 测试实现
    }, 60000)

    it('DRAFT_SPEC - specification only workflow', async () => {
      // ... 测试实现
    }, 60000)

    it('RESPOND_OA - OA response workflow', async () => {
      // ... 测试实现
    }, 90000)

    it('SEARCH - search only workflow', async () => {
      // ... 测试实现
    }, 30000)

    it('ANALYZE_PORTFOLIO - portfolio analysis workflow', async () => {
      // ... 测试实现
    }, 60000)

    it('MULTI_INTENT - multi-task workflow', async () => {
      // ... 测试实现
    }, 120000)

    it('CLARIFY - clarification workflow', async () => {
      // ... 测试实现
    }, 30000)

    it('CHITCHAT - chitchat workflow', async () => {
      // ... 测试实现
    }, 10000)
  })

  describe('HITL Checkpoints', () => {
    it('should handle HITL confirmation', async () => {
      // ... 测试实现
    })

    it('should handle HITL modification', async () => {
      // ... 测试实现
    })

    it('should handle HITL rejection', async () => {
      // ... 测试实现
    })

    it('should handle HITL timeout', async () => {
      // ... 测试实现
    })
  })

  describe('Exception Handling', () => {
    it('should handle execution timeout', async () => {
      // ... 测试实现
    })

    it('should handle low confidence intent', async () => {
      // ... 测试实现
    })

    it('should handle LLM output format error', async () => {
      // ... 测试实现
    })

    it('should handle agent execution failure', async () => {
      // ... 测试实现
    })
  })

  describe('Performance', () => {
    it('should complete DRAFT_FULL within 120s', async () => {
      // ... 测试实现
    }, 120000)

    it('should complete SEARCH within 30s', async () => {
      // ... 测试实现
    }, 30000)

    it('should handle concurrent sessions', async () => {
      // ... 测试实现
    }, 60000)
  })
})
```

**验收标准**：

- ✅ 所有9种意图类型测试通过
- ✅ HITL测试全部通过
- ✅ 异常处理测试全部通过
- ✅ 性能测试全部通过
- ✅ 并发测试通过

---

### Day 4-5: 性能优化

#### 任务4.2：性能优化

**优化项目**：

1. **LLM调用优化**
   - 批量调用合并
   - 缓存策略
   - 并行调用优化

2. **缓存策略**
   - 意图识别缓存
   - 任务规划缓存
   - Agent结果缓存

3. **并行处理优化**
   - DAG优化
   - 资源调度优化
   - 负载均衡

**性能基准**：

| 操作       | 目标 | 最大可接受 |
| ---------- | ---- | ---------- |
| 意图识别   | <1s  | 2s         |
| 任务规划   | <2s  | 5s         |
| DRAFT_FULL | <60s | 120s       |
| SEARCH     | <10s | 30s        |

**验收标准**：

- ✅ 所有性能指标达标
- ✅ 性能提升≥30%
- ✅ 内存使用优化
- ✅ 并发能力提升

---

### Day 6-7: 文档完善与交付

#### 任务4.3：文档完善

**文档清单**：

1. **API文档**
   - OrchestratorAgent API
   - EventBus API
   - ContextManager API

2. **架构文档**
   - 中枢层架构设计
   - 5次LLM调用流程
   - 事件系统设计

3. **使用指南**
   - 快速开始
   - 常见场景示例
   - 故障排查指南

4. **测试文档**
   - 测试覆盖报告
   - 性能基准报告
   - 集成测试报告

**验收标准**：

- ✅ 所有文档完整
- ✅ API文档100%覆盖
- ✅ 示例代码可运行
- ✅ 文档审查通过

---

## 质量保证

### 测试策略

**测试金字塔**：

```
        /\
       /  \      端到端测试（10%）
      /____\
     /      \    集成测试（30%）
    /________\
   /          \  单元测试（60%）
  /____________\
```

**覆盖率要求**：

| 层级   | 单元测试 | 集成测试 | 端到端测试 | 总覆盖率 |
| ------ | -------- | -------- | ---------- | -------- |
| 中枢层 | ≥90%     | ≥80%     | 全部意图   | ≥85%     |

### 代码审查标准

**Karpathy原则审查**：

1. **编码前思考检查**
   - ✅ 架构设计有充分论证
   - ✅ 技术选型有合理依据
   - ✅ 风险评估完整

2. **简洁优先检查**
   - ✅ 代码简洁明了
   - ✅ 无过度设计
   - ✅ 无冗余抽象

3. **精准修改检查**
   - ✅ 修改范围精确
   - ✅ 无无关改动
   - ✅ 风格一致

4. **目标驱动检查**
   - ✅ 验收标准清晰
   - ✅ 测试覆盖充分
   - ✅ 性能达标

---

## 风险管理

### 风险清单

| 风险ID | 风险描述          | 概率 | 影响 | 应对措施               |
| ------ | ----------------- | ---- | ---- | ---------------------- |
| R401   | LLM输出不稳定     | 高   | 高   | Few-shot优化、重试机制 |
| R402   | Token超限         | 中   | 高   | 历史压缩、预算控制     |
| R403   | 性能不达标        | 中   | 中   | 并行优化、缓存策略     |
| R404   | 意图识别准确率低  | 中   | 高   | Few-shot优化、阈值调整 |
| R405   | Agent集成复杂度高 | 中   | 中   | 充分测试、错误处理     |
| R406   | HITL流程复杂      | 低   | 中   | 简化流程、充分测试     |

---

## 验收标准

### 功能验收

- ✅ 9个意图类型全部支持
- ✅ 5次LLM调用全部实现
- ✅ HITL检查点工作正常
- ✅ 异常降级机制完善
- ✅ 事件系统运行稳定
- ✅ Agent集成完整

### 质量验收

- ✅ 单元测试覆盖率≥90%
- ✅ 集成测试覆盖率≥80%
- ✅ 端到端测试全部通过
- ✅ 性能测试全部通过
- ✅ 代码审查全部通过

### 文档验收

- ✅ API文档完整
- ✅ 架构文档完整
- ✅ 测试文档完整
- ✅ 使用指南完整

---

## 附录

### A. 参考文档

- [YunPat编排器架构文档](./2026.5.4/yunpat_orchestrator_architecture.html)
- [Phase 1-3实施总结](./phase1-3-summary.md)
- [代码审查报告](./CODE_REVIEW_REPORT.md)

### B. 相关工具

- **测试框架**: Vitest
- **LLM SDK**: Anthropic SDK
- **本地LLM**: Ollama
- **代码审查**: ESLint + Prettier
- **文档生成**: TypeDoc

### C. 联系方式

- 作者：Xu Jian <xujian519@gmail.com>
- 项目：YunPat Agent Framework
- 许可证：MIT

---

**文档版本**: v1.0
**最后更新**: 2026-05-04
**下次审查**: 每周五

---

## 📊 总体时间表

```
Week 1-2: 核心框架开发
  Day 1-2: 架构设计与基础框架
  Day 3-5: Call 1 - 意图识别
  Day 6-8: Call 2 - 任务规划
  Day 9-10: 集成测试与验收

Week 3: 上下文管理
  Day 1-3: Context Manager实现
  Day 4-5: HITL系统实现
  Day 6-7: 集成测试与验收

Week 4: 事件系统与集成
  Day 1-3: EventBus实现
  Day 4-5: Agent集成
  Day 6-7: 集成测试与验收

Week 5: 端到端测试与优化
  Day 1-3: 端到端测试
  Day 4-5: 性能优化
  Day 6-7: 文档完善与交付
```

**总周期**: 4-5周（无时间压力，质量优先）

---

**祝Phase 4实施顺利！** 🚀
