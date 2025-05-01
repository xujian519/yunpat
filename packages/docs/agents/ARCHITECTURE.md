# YunPat Agents 架构文档

**版本**: v1.1.0
**更新时间**: 2026-05-06
**包数量**: 28个子包
**架构类型**: 模块化专业智能体系统

---

## 📋 目录

- [概述](#概述)
- [架构设计](#架构设计)
- [Agent 分类](#agent-分类)
- [核心接口](#核心接口)
- [Agent 详解](#agent-详解)
- [协作模式](#协作模式)
- [扩展指南](#扩展指南)
- [最佳实践](#最佳实践)

---

## 概述

### 设计理念

YunPat Agents 采用了**模块化专业智能体**架构，每个 Agent 专注于专利生命周期的特定环节：

- ✅ **单一职责**: 每个 Agent 专注一个领域
- ✅ **统一接口**: 所有 Agent 继承 `ProfessionalAgent` 基类
- ✅ **知识增强**: 集成 Obsidian 知识库
- ✅ **模板驱动**: 使用 PromptTemplateManager 管理提示词
- ✅ **可测试性**: 完整的单元测试和集成测试

### 技术栈

```typescript
// 基础框架
import { ProfessionalAgent } from '@yunpat/agents/base'

// 知识库集成
import { ObsidianKnowledgeBridge } from '@yunpat/patent-knowledge'

// 提示词模板
import { PromptTemplateManager } from '@yunpat/patent-prompts'

// 类型定义
import * as PatentCore from '@yunpat/patent-core'
```

### 与 Core 包的关系

```
┌─────────────────────────────────────────────────────────────┐
│                      @yunpat/core                            │
│  (KnowledgeEnhancedAgent, LLMAdapter, EventBus, Memory...)   │
└──────────────────────────┬──────────────────────────────────┘
                           │ 继承
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              @yunpat/agents/base                             │
│           (ProfessionalAgent 基类)                           │
└──────────────────────────┬──────────────────────────────────┘
                           │ 继承
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   专业层 Agents (28个)                        │
│  (writer, researcher, patent-writer, patent-responder...)     │
└─────────────────────────────────────────────────────────────┘
```

---

## 架构设计

### 分层架构

```
┌─────────────────────────────────────────────────────────────┐
│                        应用层                                 │
│            (CLI, Web UI, API Server)                         │
└──────────────────────────┬──────────────────────────────────┘
                           │ 调用
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    编排层 (Orchestrator)                      │
│           意图识别 → 任务规划 → 智能路由 → 执行               │
└──────────────────────────┬──────────────────────────────────┘
                           │ 路由
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    专业层 Agents (27个)                       │
├─────────────────────────────────────────────────────────────┤
│  🏗️ 基础设施层  │  ✍️ 内容生成  │  🔍 检查验证  │  🔎 检索  │
│  - base        │  - writer     │  - quality    │  - search  │
│  - integration │  - researcher │  - claims     │  - prior-  │
│    -tests     │  - invention  │  - checker    │    art    │
├─────────────────────────────────────────────────────────────┤
│              📐 技术工具  │  🧪 测试工具  │  其他...         │
│              - specification   │   - test                   │
│              - technical-      │                            │
│                drawing         │                            │
└──────────────────────────┬──────────────────────────────────┘
                           │ 依赖
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      Core 包                                 │
│   (LLM, Memory, Tools, EventBus, Knowledge...)              │
└─────────────────────────────────────────────────────────────┘
```

### Plan-Execute 架构

所有专业层 Agent 都遵循 **Plan-Execute** 模式：

```typescript
abstract class ProfessionalAgent<TInput, TOutput> {
  // 1. 规划阶段：分析输入，制定计划
  protected abstract plan(input: TInput, context: ExecutionContext): Promise<Plan>

  // 2. 执行阶段：执行计划，生成结果
  protected abstract act(plan: Plan, context: ExecutionContext): Promise<TOutput>

  // 3. 对外接口：供 Orchestrator 调用
  async run(input: TInput, context: ExecutionContext): Promise<AgentResult>
}
```

**执行流程**：

```
输入 (TInput)
    │
    ▼
┌─────────────┐
│  plan()     │ ← 验证输入、制定计划、准备资源
└──────┬──────┘
       │ Plan
       ▼
┌─────────────┐
│  act()      │ ← 执行计划、调用 LLM、生成结果
└──────┬──────┘
       │
       ▼
输出 (TOutput)
```

---

## Agent 分类

### 🏗️ 基础设施层 (2个)

#### 1. base - Agent 基类

**包名**: `@yunpat/agents/base`
**完成度**: 70%
**职责**: 提供统一的 Agent 基类和接口定义

**核心类**:

- `ProfessionalAgent<TInput, TOutput>`: 所有专业层 Agent 的基类

**主要功能**:

- ✅ 统一的 `run()` 接口（适配 Orchestrator）
- ✅ 错误处理和日志记录
- ✅ 性能监控（执行时间）
- ✅ HITL 支持

**使用示例**:

```typescript
import { ProfessionalAgent } from '@yunpat/agents/base'

class MyAgent extends ProfessionalAgent<Input, Output> {
  protected async plan(input: Input, context: ExecutionContext) {
    // 规划逻辑
    return { plan: '...' }
  }

  protected async act(plan: Plan, context: ExecutionContext) {
    // 执行逻辑
    return { result: '...' }
  }
}
```

#### 2. integration-tests - 集成测试

**包名**: `@yunpat/agents/integration-tests`
**完成度**: 5%
**职责**: 提供跨 Agent 的集成测试框架

**测试覆盖**:

- Agent 间协作
- 端到端工作流
- 错误恢复

---

### ✍️ 内容生成类 (11个)

#### 1. writer - 通用写作助手

**包名**: `@yunpat/agents/writer`
**完成度**: 60%
**职责**: 通用技术文档写作

**输入/输出**:

```typescript
interface WritingTask {
  type: 'article' | 'report' | 'documentation'
  topic: string
  format?: 'markdown' | 'html'
  requirements?: string[]
}

interface WritingResult {
  content: string
  metadata: {
    wordCount: number
    readingTime: number
  }
}
```

#### 2. patent-writer - 专利撰写 ⭐

**包名**: `@yunpat/agents/patent-writer`
**完成度**: 85% 🟢
**职责**: 完整的专利申请文件撰写

**核心功能**:

- ✅ 技术方案理解（知识库增强）
- ✅ 权利要求设计（模板驱动）
- ✅ 说明书生成（分章节撰写）
- ✅ 质量评估（7维度评分）

**输入/输出**:

```typescript
interface PatentWritingInput {
  title: string
  field: string
  applicant: string
  inventors: string[]
  technicalDisclosure: string
  drawings: string[]
}

interface PatentWritingOutput {
  patentApplication: {
    title: string
    abstract: string
    claims: Claim[]
    description: string
    drawings: string
  }
  metrics: {
    durationMinutes: number
    claimsCount: number
    descriptionWordCount: number
    qualityScore: number
  }
}
```

**使用示例**:

```typescript
import { PatentWriterAgent } from '@yunpat/agents/patent-writer'

const agent = new PatentWriterAgent({
  name: 'PatentWriter',
  description: '专利撰写智能体',
  llm: myLLMAdapter,
  // ... 其他配置
})

const result = await agent.run(input, context)
```

#### 3. patent-responder - 专利答复 ⭐

**包名**: `@yunpat/agents/patent-responder`
**完成度**: 95% 🟢
**职责**: OA 审查意见答复

**核心功能**:

- ✅ 审查意见分析
- ✅ 答复策略生成
- ✅ 修改建议生成
- ✅ 先验检索集成

#### 4. patent-analyzer - 专利分析 ⭐

**包名**: `@yunpat/agents/patent-analyzer`
**完成度**: 90% 🟢
**职责**: 专利文献深度分析

**核心功能**:

- ✅ 技术问题提取
- ✅ 技术方案分析
- ✅ 技术效果识别
- ✅ 对比分析

#### 5. researcher - 研究分析

**包名**: `@yunpat/agents/researcher`
**完成度**: 40% 🔴
**职责**: 信息搜集、数据整理、报告生成

#### 6. invention - 发明理解

**包名**: `@yunpat/agents/invention`
**完成度**: 80%
**职责**: 专利交底书分析与结构化理解

#### 7. analysis - 技术分析

**包名**: `@yunpat/agents/analysis`
**完成度**: 92% 🟢 **(最成熟)**
**职责**: 现有技术深度分析、对比分析

**包含的 Agent**:

- `PatentTechnicalAnalyzerAgent`: 专利技术分析
- `ComparisonReportGeneratorAgent`: 对比报告生成
- `DisclosureRefinerAgent`: 交底书精化

#### 8. claim-generator - 权利要求生成

**包名**: `@yunpat/agents/claim-generator`
**完成度**: 70% 🟡
**职责**: 基于发明理解撰写权利要求

#### 9. specification-drafter - 说明书起草

**包名**: `@yunpat/agents/specification-drafter`
**完成度**: 70% 🟡
**职责**: 分章节撰写专利说明书

#### 10. abstract-drafter - 摘要起草

**包名**: `@yunpat/agents/abstract-drafter`
**完成度**: 42%
**职责**: 专利摘要撰写

#### 11. comparison-report-generator - 对比报告生成

**包名**: `@yunpat/agents/comparison-report-generator`
**完成度**: 45%
**职责**: 生成专利申请与现有技术的对比分析报告

---

### 🔍 检查验证类 (7个)

#### 1. quality - 质量评估

**包名**: `@yunpat/agents/quality`
**完成度**: 70%
**职责**: 权利要求/说明书/术语一致性检查

#### 2. quality-checker - 质量检查

**包名**: `@yunpat/agents/quality-checker`
**完成度**: 75%
**职责**: 评估专利申请质量

#### 3. claims - 权利要求验证

**包名**: `@yunpat/agents/claims`
**完成度**: 50%
**职责**: 权利要求书撰写与验证

#### 4. claims-formality-checker - 权利要求格式检查

**包名**: `@yunpat/agents/claims-formality-checker`
**完成度**: 70%
**职责**: 权利要求格式规范检查

#### 5. spec-formality-checker - 说明书格式检查

**包名**: `@yunpat/agents/spec-formality-checker`
**完成度**: 70%
**职责**: 说明书格式规范检查

#### 6. subject-matter-checker - 主题检查

**包名**: `@yunpat/agents/subject-matter-checker`
**完成度**: 70%
**职责**: 专利主题合规性检查

#### 7. unity-checker - 一致性检查

**包名**: `@yunpat/agents/unity-checker`
**完成度**: 70%
**职责**: 专利申请文件一致性检查

---

### 🔎 检索管理类 (3个)

#### 1. search - 通用检索

**包名**: `@yunpat/agents/search`
**完成度**: 95% 🟢
**职责**: 检索策略生成与执行（V3，真实DB）

#### 2. prior-art-search - 先前技术检索 ⭐

**包名**: `@yunpat/agents/prior-art-search`
**完成度**: 83% 🟢
**职责**: 构建检索策略并分析现有技术

**核心功能**:

- ✅ 检索策略构建
- ✅ 多源检索执行
- ✅ 相关性排序
- ✅ 对比分析

**输入/输出**:

```typescript
interface PriorArtSearchInput {
  inventionUnderstanding: {
    technicalProblem: string
    technicalSolution: string
    keyFeatures: string[]
  }
  searchScope?: {
    databases?: string[]
    dateRange?: { start: Date; end: Date }
    languages?: string[]
  }
}

interface PriorArtSearchOutput {
  searchStrategy: {
    keywords: string[]
    classifications: string[]
    booleanQuery: string
  }
  priorArtDocuments: {
    publicationNumber: string
    title: string
    relevance: number
    summary: string
  }[]
  analysis: {
    novelty: boolean
    inventiveStep: boolean
    overlappingFeatures: string[]
    distinctFeatures: string[]
  }
}
```

#### 3. patent-manager - 专利管理

**包名**: `@yunpat/agents/patent-manager`
**完成度**: 70%
**职责**: 专利全生命周期管理与监控（3277行，含DB+状态机+通知）

---

### 📐 技术工具类 (3个)

#### 1. specification - 说明书撰写

**包名**: `@yunpat/agents/specification`
**完成度**: 52%
**职责**: 专利说明书分章节撰写

#### 2. technical-drawing - 技术图纸识别

**包名**: `@yunpat/agents/technical-drawing`
**完成度**: 52%
**职责**: 支持化学结构、数学公式、OCR

#### 3. format-converter - 格式转换

**包名**: `@yunpat/agents/format-converter`
**完成度**: 52%
**职责**: Markdown/结构化内容转 DOCX

---

### 🧪 测试工具 (1个)

#### test - 工作流测试

**包名**: `@yunpat/agents/test`
**完成度**: 50%
**职责**: 验证专利申请工作流

---

## 核心接口

### AgentResult - 统一返回格式

所有 Agent 的 `run()` 方法都返回 `AgentResult`：

```typescript
interface AgentResult {
  /** 是否成功 */
  success: boolean

  /** 数据 */
  data: Record<string, any> | any

  /** 错误信息（失败时） */
  error?: Error

  /** 执行时间（毫秒） */
  executionTime: number

  /** 是否需要HITL */
  requiresHITL?: boolean

  /** HITL检查点（requiresHITL=true时） */
  hitlCheckpoint?: string
}
```

### ExecutionContext - 执行上下文

```typescript
interface ExecutionContext {
  /** LLM 适配器 */
  llm: LLMAdapter

  /** 事件总线 */
  eventBus: EventBus

  /** 内存存储 */
  memory: Memory

  /** 工具注册表 */
  tools: ToolRegistry

  /** 日志记录器（扩展） */
  logger?: {
    info: (...args: any[]) => void
    error: (...args: any[]) => void
    warn: (...args: any[]) => void
  }

  /** 其他元数据 */
  metadata?: Record<string, any>
}
```

---

## Agent 详解

### 最成熟的 Agents (≥80%)

#### 1. patent-responder - 专利答复 🏆

**完成度**: 95%
**推荐指数**: ⭐⭐⭐⭐⭐

**为什么最成熟**:

- ✅ 8383行代码，V5版本
- ✅ 真实数据库集成
- ✅ OA解析、策略推荐、模板系统、成功率预测
- ✅ 历史案例学习

#### 2. search - 通用检索 🏆

**完成度**: 95%
**推荐指数**: ⭐⭐⭐⭐⭐

**为什么最成熟**:

- ✅ V3版本，1714行代码
- ✅ 真实DB（PatentDB 75M + Google Patents）
- ✅ 完整的检索策略生成与执行

#### 3. patent-analyzer - 专利分析 🏆

**完成度**: 90%
**推荐指数**: ⭐⭐⭐⭐⭐

**为什么最成熟**:

- ✅ 完整的单元测试
- ✅ 清晰的接口定义
- ✅ 良好的错误处理
- ✅ 丰富的功能实现

**使用场景**:

- 专利文献深度分析
- 技术方案对比
- 交底书精化
- 对比报告生成

**快速开始**:

```typescript
import { PatentTechnicalAnalyzerAgent } from '@yunpat/agents/analysis'

const analyzer = new PatentTechnicalAnalyzerAgent({
  name: 'TechnicalAnalyzer',
  description: '专利技术分析',
  llm: yourLLM,
  // ... 其他配置
})

const result = await analyzer.run(
  {
    patent: {
      publicationNumber: 'CN123456789A',
      title: '一种智能控制系统',
      abstract: '本发明公开了...',
    },
  },
  context
)
```

#### 4. patent-writer - 专利撰写 🏆

**完成度**: 85%
**推荐指数**: ⭐⭐⭐⭐⭐

**核心优势**:

- ✅ 2124行代码，知识库增强
- ✅ 模板驱动撰写
- ✅ 分章节说明书生成
- ✅ 7维度质量评估

#### 5. invention - 发明理解 🏆

**完成度**: 80%
**推荐指数**: ⭐⭐⭐⭐

**核心优势**:

- ✅ 1972行代码，含测试
- ✅ 交底书分析与结构化理解
- ✅ 多阶段知识检索

### 推荐使用的 Agents (60-79%)

- ✅ 智能检索策略生成
- ✅ 多源检索支持
- ✅ 相关性排序
- ✅ 对比分析

**使用场景**:

- 专利申请前检索
- 无效检索
- FTO 分析
- 技术调研

### 推荐使用的 Agents (60-79%)

#### patent-manager - 专利管理

**完成度**: 70%
**推荐指数**: ⭐⭐⭐⭐

**适用场景**:

- 专利全生命周期管理
- 专利状态监控
- 截止日期提醒

#### quality-checker - 质量检查

**完成度**: 75%
**推荐指数**: ⭐⭐⭐⭐

**适用场景**:

- 专利申请质量评估
- 多维度质量检查

#### specification-drafter - 说明书起草

**完成度**: 70%
**推荐指数**: ⭐⭐⭐

**适用场景**:

- 专利说明书分章节撰写
- 附图说明生成

### 需要改进的 Agents (<60%)

**需要改进的包** (19个):

- invention (54%)
- claims (52%)
- format-converter (52%)
- specification (52%)
- technical-drawing (52%)
- ... (详见评估报告)

**改进优先级**:

1. 🔴 P0: researcher (29%) - 核心功能缺失
2. 🔴 P0: integration-tests (5%) - 测试框架缺失
3. 🟡 P1: writer (42%) - 功能不完整
4. 🟡 P1: base (42%) - 需要更多功能

---

## 协作模式

### 1. 串行协作

```typescript
// 专利撰写工作流
const inventionUnderstanding = await inventionAgent.run(disclosure, context)
const priorArt = await priorArtSearchAgent.run(inventionUnderstanding, context)
const patentApplication = await patentWriterAgent.run(
  {
    inventionUnderstanding,
    priorArt,
  },
  context
)
const qualityCheck = await qualityAgent.run(patentApplication, context)
```

### 2. 并行协作

```typescript
// 并行执行多个独立的分析任务
const [technicalAnalysis, priorArtSearch, marketAnalysis] = await Promise.all([
  technicalAnalyzerAgent.run(patent, context),
  priorArtSearchAgent.run(invention, context),
  marketAnalyzerAgent.run(invention, context),
])
```

### 3. Orchestrator 编排

```typescript
// 通过 OrchestratorAgent 自动编排
const orchestrator = new OrchestratorAgent(config)

const result = await orchestrator.run(
  {
    intent: 'patent_analysis',
    input: {
      patent: patentData,
      analysisType: ['technical', 'legal', 'market'],
    },
  },
  context
)

// Orchestrator 会自动：
// 1. 识别意图
// 2. 规划任务
// 3. 路由到合适的 Agent
// 4. 聚合结果
```

---

## 扩展指南

### 创建新的 Agent

#### 步骤 1: 创建包结构

```bash
mkdir -p packages/agents/my-agent/src
cd packages/agents/my-agent
pnpm init
```

#### 步骤 2: 配置 package.json

```json
{
  "name": "@yunpat/agents/my-agent",
  "version": "0.1.0",
  "description": "我的智能体",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest"
  },
  "dependencies": {
    "@yunpat/core": "workspace:*",
    "@yunpat/agents/base": "workspace:*"
  },
  "devDependencies": {
    "@yunpat/tsconfig": "workspace:*",
    "vitest": "^1.0.0"
  }
}
```

#### 步骤 3: 实现 Agent

```typescript
// src/MyAgent.ts
import { ProfessionalAgent } from '@yunpat/agents/base'
import type { ExecutionContext, AgentResult } from '@yunpat/agents/base'

interface MyInput {
  // 定义输入类型
}

interface MyOutput {
  // 定义输出类型
}

export class MyAgent extends ProfessionalAgent<MyInput, MyOutput> {
  protected async plan(input: MyInput, context: ExecutionContext) {
    // 1. 验证输入
    if (!input.field) {
      throw new Error('field 不能为空')
    }

    // 2. 制定计划
    return {
      steps: ['step1', 'step2'],
      metadata: {
        /* ... */
      },
    }
  }

  protected async act(plan: any, context: ExecutionContext) {
    // 3. 执行计划
    const result = await this.callLLM(plan, context)

    // 4. 返回结果
    return {
      output: result,
    }
  }
}
```

#### 步骤 4: 导出

```typescript
// src/index.ts
export { MyAgent } from './MyAgent'
export type { MyInput, MyOutput } from './MyAgent'
```

#### 步骤 5: 编写测试

```typescript
// test/MyAgent.test.ts
import { describe, it, expect } from 'vitest'
import { MyAgent } from '../src/MyAgent'

describe('MyAgent', () => {
  it('should process input correctly', async () => {
    const agent = new MyAgent({
      name: 'TestAgent',
      description: '测试智能体',
      llm: mockLLM,
      // ... 其他配置
    })

    const result = await agent.run({ field: 'test' }, mockContext)

    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()
  })
})
```

#### 步骤 6: 构建和测试

```bash
# 构建
pnpm build

# 测试
pnpm test

# 添加到 workspace
cd ../../
pnpm install
```

### 最佳实践

#### 1. 输入验证

```typescript
protected async plan(input: MyInput, context: ExecutionContext) {
  // ✅ 好的做法：详细的输入验证
  if (!input.field?.trim()) {
    throw new Error('field 不能为空')
  }
  if (input.array && !Array.isArray(input.array)) {
    throw new Error('array 必须是数组类型')
  }

  // ❌ 不好的做法：没有验证
  return { input }
}
```

#### 2. 错误处理

```typescript
protected async act(plan: Plan, context: ExecutionContext) {
  try {
    // ... 业务逻辑
  } catch (error) {
    // ✅ 好的做法：详细的错误处理和日志
    context.logger?.error('执行失败', {
      error: error.message,
      stack: error.stack,
      plan
    })
    throw error
  }
}
```

#### 3. 性能监控

```typescript
async run(input: TInput, context: ExecutionContext): Promise<AgentResult> {
  const startTime = Date.now()

  try {
    const output = await this.execute(input)

    const executionTime = Date.now() - startTime

    // ✅ 记录性能指标
    context.logger?.info('执行完成', {
      executionTime,
      performance: executionTime < 1000 ? 'good' : 'slow'
    })

    return {
      success: true,
      data: output,
      executionTime
    }
  } catch (error) {
    // ...
  }
}
```

#### 4. 知识库集成

```typescript
import { ObsidianKnowledgeBridge } from '@yunpat/patent-knowledge'

class MyAgent extends ProfessionalAgent {
  private knowledgeBridge: ObsidianKnowledgeBridge

  constructor(config: MyConfig) {
    super(config)
    this.knowledgeBridge = new ObsidianKnowledgeBridge({
      vaultPath: config.vaultPath,
    })
  }

  protected async act(plan: Plan, context: ExecutionContext) {
    // ✅ 使用知识库增强
    const relevantKnowledge = await this.knowledgeBridge.search({
      query: plan.query,
      limit: 5,
    })

    // 将相关知识注入到 LLM 提示中
    const enhancedPrompt = this.buildPrompt(plan, relevantKnowledge)

    return await this.callLLM(enhancedPrompt, context)
  }
}
```

#### 5. 模板管理

```typescript
import { PromptTemplateManager } from '@yunpat/patent-prompts'

class MyAgent extends ProfessionalAgent {
  private templateManager: PromptTemplateManager

  constructor(config: MyConfig) {
    super(config)
    this.templateManager = new PromptTemplateManager()
  }

  protected async act(plan: Plan, context: ExecutionContext) {
    // ✅ 使用模板管理器
    const prompt = await this.templateManager.render('my-template', {
      variables: plan.variables,
    })

    return await this.callLLM(prompt, context)
  }
}
```

---

## 最佳实践

### 1. 选择合适的 Agent

| 任务     | 推荐的 Agent       | 完成度 |
| -------- | ------------------ | ------ |
| 审查答复 | `patent-responder` | 95% 🏆 |
| 检索策略 | `search`           | 95% 🏆 |
| 专利分析 | `patent-analyzer`  | 90% 🏆 |
| 专利撰写 | `patent-writer`    | 85%    |
| 发明理解 | `invention`        | 80%    |
| 质量检查 | `quality-checker`  | 75%    |
| 专利管理 | `patent-manager`   | 70%    |

### 2. 组合使用 Agents

```typescript
// ✅ 推荐：使用 Orchestrator 编排
const result = await orchestrator.run(
  {
    intent: 'patent_application',
    input: disclosure,
  },
  context
)

// ✅ 或者：手动编排
const workflow = async (disclosure) => {
  const understanding = await inventionAgent.run(disclosure, context)
  const priorArt = await priorArtSearchAgent.run(understanding, context)
  const application = await patentWriterAgent.run(
    {
      understanding,
      priorArt,
    },
    context
  )
  const quality = await qualityAgent.run(application, context)

  return quality
}
```

### 3. 错误处理和重试

```typescript
const runWithRetry = async (agent, input, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await agent.run(input, context)
      if (result.success) {
        return result
      }
    } catch (error) {
      if (i === maxRetries - 1) {
        throw error
      }
      console.log(`重试 ${i + 1}/${maxRetries}`)
      await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)))
    }
  }
}
```

### 4. 监控和日志

```typescript
const context = {
  ...baseContext,
  logger: {
    info: (msg, data) => console.log(`[INFO] ${msg}`, data),
    error: (msg, data) => console.error(`[ERROR] ${msg}`, data),
    warn: (msg, data) => console.warn(`[WARN] ${msg}`, data),
  },
}
```

---

## 常见问题

### Q1: 如何选择使用哪个 Agent？

**A**: 根据任务类型选择：

- **分析任务**: 使用 `analysis` (92%)
- **检索任务**: 使用 `prior-art-search` (83%)
- **撰写任务**: 使用 `patent-writer` (74%)
- **答复任务**: 使用 `patent-responder` (74%)

### Q2: Agent 的执行时间是多久？

**A**: 取决于任务复杂度和 LLM 性能：

- **简单任务**: 5-15 秒
- **中等任务**: 15-60 秒
- **复杂任务**: 1-5 分钟

### Q3: 如何处理 Agent 失败？

**A**: 三个层次的处理：

1. **Agent 内部**: try-catch + 日志
2. **调用层**: 重试机制
3. **编排层**: 降级策略

### Q4: 如何扩展 Agent 功能？

**A**: 三种方式：

1. **继承**: 创建子类，覆盖 `plan` 或 `act`
2. **组合**: 多个 Agent 组合使用
3. **装饰**: 使用装饰器模式增强功能

### Q5: Agent 的输入输出格式是什么？

**A**: 每个都有自己的输入输出类型定义，查看各 Agent 的接口文档。

---

## 附录

### A. 完成度评估标准

| 维度     | 权重 | 评估方法                |
| -------- | ---- | ----------------------- |
| 基础框架 | 10%  | package.json + 目录结构 |
| 核心逻辑 | 40%  | 代码行数 + 功能完整性   |
| 测试覆盖 | 20%  | 测试文件 / 源文件       |
| 文档完整 | 10%  | README + API 文档       |
| 生产就绪 | 20%  | 错误处理 + 日志 + 配置  |

### B. Agent 性能基准

| Agent            | 平均执行时间 | 内存使用 | 成功率 |
| ---------------- | ------------ | -------- | ------ |
| analysis         | 15s          | 50MB     | 98%    |
| prior-art-search | 30s          | 80MB     | 95%    |
| patent-writer    | 60s          | 120MB    | 90%    |
| patent-responder | 45s          | 100MB    | 92%    |

### C. 相关文档

- [技术债务评估报告](../TECHNICAL_DEBT_ASSESSMENT.md)
- [技术债务解决方案](../TECHNICAL_DEBT_REMEDIATION_PLAN.md)
- [项目结构文档](../PROJECT_STRUCTURE.md)
- [完成度评估脚本](../../scripts/evaluate-completion.js)

---

**文档维护**: 本文档应随代码变更及时更新
**下次审查**: 2026-05-19
**反馈渠道**: GitHub Issues
