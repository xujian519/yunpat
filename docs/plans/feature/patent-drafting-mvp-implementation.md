# 专利撰写 MVP 实施方案

> **生成时间**: 2026-05-01
> **版本**: v1.0
> **状态**: 待评审

---

## 一、执行摘要

本方案目标：以**专利撰写**作为第一个 MVP 业务场景，通过**垂直切片**方式逐步构建，优先"唤醒框架沉睡能力"而非从 0 建造，在 6-8 周内实现一个可承载真实专利撰写业务的、支持人机协作的最小可用系统。

**核心策略**: 框架层已有 ApprovalFlow（人机审批）、CheckpointManager（断点续传）、TaskScheduler（任务调度）、DynamicReplanner（动态重规划）四大能力，但 Agent 基类完全没有调用它们。本方案的首要任务不是新增代码，而是**将这些沉睡能力接入 Agent 执行流**，然后在此基础上构建第一个垂直切片。

---

## 二、现状诊断（基于代码扫描）

### 2.1 可复用的成熟资产

| 模块                        | 状态            | 说明                                                                    |
| --------------------------- | --------------- | ----------------------------------------------------------------------- |
| **Agent 基类**              | ✅ 成熟         | 完整生命周期（before→init→plan→act→reflect→after），事件驱动，356+ 导出 |
| **EventBus**                | ✅ 成熟         | 发布订阅 + RPC request/respond，53 个测试用例通过，性能监控完善         |
| **NativeLLMAdapter**        | ✅ 成熟         | 支持 DeepSeek/通义千问/GLM/Ollama/oMLX，有模型切换能力                  |
| **MultiModelManager**       | ✅ 可用         | 多模型注册与基础路由                                                    |
| **TaskRouter**              | ✅ 可用         | 成本感知的本地/云端路由                                                 |
| **ApprovalFlow**            | ✅ 完整但未接入 | 663 行，CLI/HTTP/WebSocket 三模式，有反馈收集和统计                     |
| **CheckpointManager**       | ✅ 完整但未接入 | 517 行，保存/加载/时间旅行/分支，纯内存实现                             |
| **TaskScheduler**           | ✅ 完整但未接入 | 535 行，拓扑排序/优先级/关键路径/并行调度                               |
| **DynamicReplanner**        | ✅ 完整但未接入 | 378 行，偏离/失败/超时/质量下降检测                                     |
| **PatentWriterAgent**       | ✅ 最成熟       | 905 行，集成知识库+模板+PatentCore 桥接+幻觉检测                        |
| **PromptTemplateManager**   | ✅ 可用         | 分阶段加载策略，3 个高质量模板（权利要求模板非常专业）                  |
| **ObsidianKnowledgeBridge** | ✅ 可用         | 知识库集成，CardRetriever 语义检索                                      |
| **PatentCoreBridge**        | ⚠️ 依赖 Rust    | 类型定义完整，但 Rust CLI 有 25 个编译错误，可能不可用                  |

### 2.2 关键缺口

| 优先级    | 缺口                                              | 影响                                                                |
| --------- | ------------------------------------------------- | ------------------------------------------------------------------- |
| 🔴 **P0** | Agent 基类未调用 ApprovalFlow / CheckpointManager | 框架有人机暂停和断点续传能力，但 `execute()` 里完全没集成，能力沉睡 |
| 🔴 **P0** | CheckpointManager 纯内存，无外部持久化            | 进程重启后状态丢失，无法真正"暂停恢复"                              |
| 🟡 **P1** | TaskScheduler / DynamicReplanner 与 Agent 未打通  | 规划调度是孤立代码，Agent 还是单线程简单循环                        |
| 🟡 **P1** | PatentCoreBridge 依赖 Rust CLI，耦合重            | CLI 路径硬编码，错误处理弱，Rust 有编译错误                         |
| 🟢 **P2** | 整体测试覆盖率约 5%                               | 仅 EventBus 有可靠测试，代码质量难以保障                            |

### 2.3 一句话总结

> 框架层"能力丰富但沉睡"，WriterAgent 是唯一可用的业务智能体，Analyzer 是 LLM 幻觉生成器。最大的投入产出比不在新增功能，而在**唤醒沉睡能力**。

---

## 三、核心设计决策

### 3.1 "唤醒"而非"重建"

- 不新建工作流引擎，而是在现有 TaskScheduler 基础上封装轻量 WorkflowEngine
- 不新建人机交互层，而是将 ApprovalFlow 接入 Agent 生命周期
- 不新建状态持久化，而是给 CheckpointManager 添加文件系统后端

### 3.2 垂直切片策略

每个切片对应一个真实业务步骤，独立可运行、独立可验收：

| 切片       | 业务步骤                | 框架验证点             |
| ---------- | ----------------------- | ---------------------- |
| **切片 1** | 发明理解 → 人类确认     | 审批接入、检查点持久化 |
| **切片 2** | 检索策略构建 → 人类确认 | 多步骤工作流编排       |
| **切片 3** | 权利要求撰写 → 逐段确认 | 长周期任务、状态恢复   |
| **切片 4** | 说明书撰写 → 逐章确认   | 完整专利文件生成       |

### 3.3 人机协作协议（基于 Athena 文档优化）

- 每个关键步骤输出：**结构化 JSON**（供下游使用）+ **Markdown 摘要**（<300 字，供人类快速审阅）
- 人类操作选项：**y（通过）/ c（修正）/ s（补充）/ r（拒绝重来）**
- 修正/补充内容直接作为反馈注入下一步的上下文

---

## 四、实施阶段

### Phase 1: 框架唤醒（预计 1.5-2 周）

**目标**: 让 Agent 具备"暂停等待人类输入、保存状态到磁盘、恢复执行"的能力。

#### 任务 1.1: 给 CheckpointManager 添加文件系统持久化

```
packages/core/src/memory/CheckpointManager.ts
packages/core/src/memory/FileSystemCheckpointStore.ts [新增]
```

- 新建 `FileSystemCheckpointStore`，将检查点序列化为 JSON 文件存储到 `data/checkpoints/{executionId}/`
- 修改 `CheckpointManager`，支持注入外部 Store（默认仍用内存，可选文件系统）
- 每个检查点保存：memorySnapshot、contextSnapshot、stateSnapshot、timestamp、tags
- 提供 `listResumableExecutions()` 接口，列出所有可恢复的任务

**验收标准**:

- 进程退出后重启，能加载上次的检查点并恢复到正确状态
- 一个 execution 产生多个检查点，能按 iteration 排序恢复

#### 任务 1.2: 修改 Agent 基类，集成 ApprovalFlow 和 CheckpointManager

```
packages/core/src/agent/Agent.ts
packages/core/src/agent/CheckpointedAgent.ts [新增，可选]
```

在 `AgentConfig` 中新增可选配置：

```typescript
export interface AgentConfig {
  // ... 现有配置 ...

  /** 审批流程（可选） */
  approvalFlow?: ApprovalFlow

  /** 检查点管理器（可选） */
  checkpointManager?: CheckpointManager

  /** 哪些生命周期阶段需要人工审批 */
  approvalStages?: LifecycleStage[]

  /** 是否启用自动检查点 */
  enableCheckpoints?: boolean
}
```

修改 `executeInternal` 流程：

```
before → init → [检查点: init] → plan → [检查点: plan] →
[审批: plan 结果] → act → [检查点: act] →
[审批: act 结果] → reflect → [检查点: reflect] → after →
[检查点: completed]
```

关键改动点：

1. `plan` 完成后，如果配置了 `approvalStages` 包含 `PLAN`，调用 `approvalFlow.requestApproval(planResult, context)`
2. `act` 完成后，如果配置了 `approvalStages` 包含 `ACT`，调用审批
3. 每次阶段切换前，如果 `enableCheckpoints`，调用 `checkpointManager.saveCheckpoint(...)`
4. 提供 `resume(executionId)` 静态方法，从最新检查点恢复执行

**验收标准**:

- 一个 Agent 执行到 plan 阶段后暂停，人类输入修正意见，Agent 继续执行时修正意见进入 act 阶段的上下文
- 进程在 act 阶段被杀死，重启后能恢复到 act 阶段重新开始

#### 任务 1.3: 基于 TaskScheduler 封装轻量 WorkflowEngine

```
packages/core/src/planning/WorkflowEngine.ts [新增]
packages/core/src/planning/WorkflowDefinition.ts [新增]
```

WorkflowEngine 是对现有 TaskScheduler 的轻量封装，专为 Agent 编排设计：

```typescript
export interface WorkflowStep {
  id: string
  name: string
  agentName: string // 执行该步骤的 Agent
  inputMapping: Record<string, string> // 从前序步骤输出映射输入
  outputSchema: z.ZodSchema // 输出结构校验
  requiresApproval: boolean // 是否需要人工审批
  timeout?: number
}

export interface WorkflowDefinition {
  id: string
  name: string
  steps: WorkflowStep[]
  dependencies: Array<{ from: string; to: string }>
}

export class WorkflowEngine {
  constructor(eventBus: EventBus, scheduler: TaskScheduler)

  async execute(workflow: WorkflowDefinition, initialInput: unknown): Promise<WorkflowResult>
  async pause(workflowId: string): Promise<void>
  async resume(workflowId: string): Promise<WorkflowResult>
}
```

核心职责：

1. 将 WorkflowDefinition 转换为 TaskScheduler 的 HierarchicalPlan
2. 管理步骤间的数据传递（inputMapping）
3. 在 `requiresApproval` 的步骤后自动插入 ApprovalFlow 调用
4. 保存和恢复工作流级别状态（不仅是单个 Agent 的状态）

**验收标准**:

- 定义一个包含 3 个步骤的工作流，步骤 2 依赖步骤 1 的输出，能正确传递数据
- 步骤 2 配置 `requiresApproval: true`，执行到该步骤时暂停，人类确认后继续
- 工作流执行到一半进程退出，重启后能恢复到正确的步骤

#### 任务 1.4: 修复 PatentCoreBridge 的降级策略

```
patents/core/PatentCoreBridge.ts
```

当前 PatentCoreBridge 直接调用 Rust CLI，无降级策略。由于 Rust 有 25 个编译错误，必须先处理：

1. 在 `runCli` 中添加错误处理：如果 CLI 调用失败（文件不存在、非零退出码、JSON 解析失败），返回一个带有 `fallback: true` 标记的结果
2. 在 PatentWriterAgent 中，当收到 fallback 结果时，回退到纯 LLM 模式（当前已有部分回退逻辑，需完善）
3. 短期方案：将 Rust CLI 的功能用 TypeScript 实现简易版本（交底书解析用正则/规则，特征提取用 LLM + 结构化输出）

**验收标准**:

- Rust CLI 不存在时，PatentWriterAgent 仍能正常运行（降级到 LLM 模式）
- 至少实现 `parseDisclosure` 和 `extractFeatures` 的 TypeScript 降级版本

---

### Phase 2: 垂直切片 1 — 发明理解 → 人类确认（预计 1.5-2 周）

**目标**: 实现 Athena 文档 Phase 1 的能力——技术交底书输入 → 结构化发明理解 → 人类确认 → 保存结果。

#### 任务 2.1: 创建 InventionUnderstandingAgent

```
patents/agents/invention-understanding/InventionUnderstandingAgent.ts [新增]
```

这是专利撰写流程的第一个原子智能体，专精于"理解技术交底书"。

输入：

```typescript
interface InventionUnderstandingInput {
  technicalDisclosure: string // 技术交底书全文
  title?: string // 发明名称（可选，AI 可提取）
  drawings?: string[] // 附图描述列表
}
```

输出（结构化 JSON，与 Athena 文档保持一致）：

```typescript
interface InventionUnderstandingOutput {
  invention_title: string
  invention_type: 'device' | 'method' | 'system' | 'composition'
  technical_field: string
  core_innovation: string
  technical_problem: string
  technical_solution: string
  technical_effects: string[]
  essential_features: TechnicalFeature[]
  optional_features: TechnicalFeature[]
  confidence_score: number // AI 对自身理解的置信度
}
```

实现要点：

1. `plan` 阶段：分析交底书结构，识别技术领域、技术问题、技术方案
2. `act` 阶段：提炼核心创新点，区分必要特征和可选特征
3. `reflect` 阶段：自评置信度，如果 < 0.7 则标记需要人类重点关注
4. 集成知识库：检索相关技术领域的撰写规范、创造性判断标准

#### 任务 2.2: 创建人类可读摘要渲染器

```
patents/agents/invention-understanding/HumanReadableRenderer.ts [新增]
```

将 `InventionUnderstandingOutput` 渲染为 <300 字的 Markdown 摘要，供人类快速审阅：

```markdown
## 发明理解摘要

**发明名称**: {title}
**技术领域**: {field}
**核心创新**: {core_innovation} (50字以内)
**解决的技术问题**: {technical_problem}
**关键技术方案**: {technical_solution} (100字以内)
**主要技术效果**: {effects.join(', ')}
**必要特征数**: {essential_features.length}
**AI 置信度**: {confidence_score}

⚠️ 需要关注: {如果置信度<0.7，列出不确定点}
```

#### 任务 2.3: 定义第一个工作流

```
patents/workflows/patent-drafting/01-invention-understanding.workflow.ts [新增]
```

```typescript
export const inventionUnderstandingWorkflow: WorkflowDefinition = {
  id: 'patent-drafting-slice-1',
  name: '发明理解',
  steps: [
    {
      id: 'validate-input',
      name: '验证输入',
      agentName: 'input-validator',
      inputMapping: { technicalDisclosure: 'input.technicalDisclosure' },
      outputSchema: InputValidationSchema,
      requiresApproval: false,
    },
    {
      id: 'understand-invention',
      name: '发明理解',
      agentName: 'invention-understanding',
      inputMapping: {
        technicalDisclosure: 'steps.validate-input.technicalDisclosure',
        drawings: 'input.drawings',
      },
      outputSchema: InventionUnderstandingSchema,
      requiresApproval: true, // ⭐ 关键：人类确认点
    },
  ],
  dependencies: [{ from: 'validate-input', to: 'understand-invention' }],
}
```

#### 任务 2.4: 构建 CLI 入口

```
packages/cli/src/commands/draft-patent.ts [新增或修改]
```

提供命令：

```bash
yunpat draft-patent --disclosure ./path/to/disclosure.md --mode cli
```

执行流程：

1. 读取交底书文件
2. 启动 WorkflowEngine，执行 inventionUnderstandingWorkflow
3. 在 `understand-invention` 步骤后暂停，CLI 展示 Markdown 摘要
4. 人类输入 y/c/s/r
5. 如果通过，保存 `InventionUnderstandingOutput` 到 `data/drafts/{caseId}/01-invention-understanding.json`
6. 如果修正，将修正内容注入上下文重新生成

**验收标准**:

- 提供一个真实的专利交底书，系统能输出结构化的发明理解结果
- 人类在 CLI 中确认结果后，结果保存到磁盘，下次可以从该状态继续
- 人类提出修正意见后，系统能重新生成并展示修正后的结果

---

### Phase 3: 垂直切片 2 — 检索策略构建 → 人类确认（预计 1.5-2 周）

**目标**: 在发明理解的基础上，构建检索策略、执行检索、输出对比分析，供人类确认。

#### 任务 3.1: 创建 PriorArtSearchAgent

```
patents/agents/prior-art-search/PriorArtSearchAgent.ts [新增]
```

输入：

```typescript
interface PriorArtSearchInput {
  inventionUnderstanding: InventionUnderstandingOutput
  searchDatabases?: ('cnki' | 'patent' | 'google-scholar' | 'web')[]
}
```

输出：

```typescript
interface PriorArtSearchOutput {
  searchStrategy: {
    keywords: string[]
    ipcCpcClasses: string[]
    searchQueries: string[] // 实际执行的检索式
  }
  results: {
    patents: PatentReference[]
    papers: PaperReference[]
    webResources: WebReference[]
  }
  comparisonAnalysis: {
    closestPriorArt: PatentReference
    differences: string[]
    technicalProblemSolved: string
  }
}
```

**关键限制**: 当前没有真实的专利数据库 API 接入，因此：

- 检索策略构建（关键词、IPC/CPC 分类、检索式）由 AI 生成
- 实际检索结果先用模拟数据/LLM 生成（标记为 `simulated: true`）
- 预留真实数据库接入接口，后续替换

#### 任务 3.2: 扩展工作流到第二步

```
patents/workflows/patent-drafting/02-prior-art-search.workflow.ts [新增]
```

新增步骤：

1. `build-search-strategy` - 构建检索策略（AI 生成关键词、IPC、检索式）
2. `execute-search` - 执行检索（当前模拟）
3. `analyze-prior-art` - 对比分析（AI 分析最接近现有技术、区别特征）
4. `human-confirm-search` - 人类确认检索结果和对比分析

#### 任务 3.3: 工作流串联

修改 CLI 入口，支持从切片 1 的结果继续执行切片 2：

```bash
yunpat draft-patent --case-id CASE-20260501-001 --step prior-art-search
```

**验收标准**:

- 给定一个发明理解结果，系统能输出检索策略和对比分析报告
- 人类能确认或修改检索策略、补充关键词
- 对比分析报告能正确识别区别特征和实际解决的技术问题

---

### Phase 4: 垂直切片 3 — 权利要求撰写 → 逐段确认（预计 2-3 周）

**目标**: 在发明理解和检索分析的基础上，撰写权利要求书，支持逐段人类确认。

#### 任务 4.1: 重构 PatentWriterAgent 的权利要求生成

```
patents/agents/writer/PatentWriterAgent.ts
patents/agents/writer/ClaimGeneratorAgent.ts [新增]
```

当前 PatentWriterAgent 的权利要求解析非常粗糙（按行分割），需要重构：

1. 将权利要求生成逻辑提取为独立的 `ClaimGeneratorAgent`
2. 使用现有的 `01-claims-generation.md` 模板（非常专业）
3. 模板要求输入 structured JSON，因此需要先构建正确的输入格式
4. 解析 LLM 输出时，按模板定义的 JSON 结构解析（不是按行分割）
5. 输出结构化 `ClaimsSet`（独立权利要求 + 从属权利要求）

输入：

```typescript
interface ClaimGeneratorInput {
  inventionUnderstanding: InventionUnderstandingOutput
  priorArtAnalysis: PriorArtSearchOutput['comparisonAnalysis']
  specificationDraft?: string // 如果已有说明书草稿
}
```

输出：

```typescript
interface ClaimsSet {
  independentClaims: IndependentClaim[]
  dependentClaims: DependentClaim[]
  layoutStrategy: string // 布局策略说明
  protectionScopeAnalysis: string // 保护范围分析
}
```

#### 任务 4.2: 逐段确认机制

权利要求书通常包含：

1. 独立权利要求（最关键，需人类重点确认保护范围）
2. 从属权利要求 2-3（进一步限定）
3. 从属权利要求 4+（具体实施方式）

每段生成后，调用 ApprovalFlow 展示该段的权利要求文本 + 保护范围分析，人类确认后才生成下一段。

#### 任务 4.3: 说明书撰写（摘要版本）

```
patents/agents/writer/SpecificationDrafterAgent.ts [新增]
```

使用 `02-specification-drafting.md` 模板，分章节撰写，**各章节不设字数上限，以清楚、完整、充分公开为唯一标准**：

1. **技术领域** — 说明发明所属技术领域
2. **背景技术** — 介绍相关现有技术及其缺陷
3. **发明内容** — 详细描述技术方案（技术问题、技术方案、有益效果）
4. **具体实施方式** — 结合附图详细描述至少一个实施例，以所属领域技术人员能够实现为准
5. **附图说明** — 对各幅附图做简要说明

每章生成后人类确认。

**验收标准**:

- 给定发明理解和检索分析，系统能生成完整的权利要求书
- 人类能对独立权利要求的保护范围提出修正，系统重新生成
- 说明书各章节连贯一致，术语统一

---

### Phase 5: 整合与质量保障（预计 1 周，贯穿全程）

#### 任务 5.1: 整合完整工作流

```
patents/workflows/patent-drafting/full-patent-drafting.workflow.ts [新增]
```

将所有垂直切片串联为一个完整的专利撰写工作流：

```
验证输入 → 发明理解 → [人类确认] → 检索策略 → 执行检索 → 对比分析 → [人类确认] →
权利要求布局规划 → [人类确认] → 独立权利要求 → [人类确认] → 从属权利要求 → [人类确认] →
说明书撰写（逐章）→ [人类逐章确认] → 摘要 → [人类确认] → 质量检查 → 输出完整文件
```

#### 任务 5.2: 建立回归测试

为每个垂直切片编写至少一个集成测试：

```
test/integration/patent-drafting/slice-01-invention-understanding.test.ts
test/integration/patent-drafting/slice-02-prior-art-search.test.ts
test/integration/patent-drafting/slice-03-claim-generation.test.ts
```

测试不调用真实 LLM（使用 mock），验证：

- 工作流步骤按正确顺序执行
- 数据在步骤间正确传递
- 审批点正确暂停和恢复
- 检查点正确保存和加载

#### 任务 5.3: 数据飞轮（初步）

建立简单的反馈记录机制：

```
data/feedback/{caseId}/{stepId}-{timestamp}.json
```

记录：

- 原始 AI 输出
- 人类反馈类型（approve/correct/supplement/reject）
- 修正内容
- 重新生成后的输出

这些数据后续可用于：

- 优化提示词模板
- 构建 Few-shot 示例
- 评估 AI 输出质量趋势

---

## 五、验收标准汇总

### Phase 1 验收（框架层）

- [ ] CheckpointManager 支持文件系统持久化，进程重启后可恢复
- [ ] Agent.execute() 集成 ApprovalFlow，plan/act 阶段可配置人工审批
- [ ] WorkflowEngine 能编排 3 步骤工作流，支持数据传递和审批暂停
- [ ] PatentCoreBridge 在 Rust CLI 不可用时能降级到 LLM 模式

### Phase 2 验收（切片 1）

- [ ] 提供真实交底书，5 分钟内输出结构化发明理解结果
- [ ] 人类在 CLI 中确认后，结果正确保存到磁盘
- [ ] 人类提出修正后，系统能重新生成并展示修正结果

### Phase 3 验收（切片 2）

- [ ] 基于发明理解结果，输出合理的检索策略和对比分析
- [ ] 人类能修改检索策略关键词，系统重新执行分析

### Phase 4 验收（切片 3）

- [ ] 生成完整的权利要求书（独立 + 从属），保护范围合理
- [ ] 人类能逐段确认或修正权利要求
- [ ] 生成完整的说明书（技术领域/背景技术/发明内容/实施方式/附图说明）

### Phase 5 验收（整合）

- [ ] 完整的专利撰写工作流能从交底书运行到完整专利申请文件
- [ ] 每个关键步骤都有人类确认点
- [ ] 任务中断后可从上次确认点恢复
- [ ] 至少 3 个集成测试通过

---

## 六、风险与对策

| 风险                                    | 概率 | 影响 | 对策                                                          |
| --------------------------------------- | ---- | ---- | ------------------------------------------------------------- |
| ApprovalFlow CLI 模式在复杂输出时体验差 | 中   | 中   | 优先实现 HTTP 模式，用本地 Web 界面展示结果                   |
| CheckpointManager 文件持久化性能差      | 低   | 中   | 初期用 JSON 文件，后续可替换为 SQLite/PostgreSQL              |
| LLM 输出不稳定，结构化 JSON 解析失败    | 高   | 高   | 使用 Zod 严格校验，解析失败时要求 LLM 重新生成                |
| PatentCore Rust 长期无法修复            | 中   | 中   | 已实现 TypeScript 降级，不影响主流程                          |
| 真实专利数据库 API 接入延迟             | 中   | 低   | 切片 2 先用模拟数据，不影响框架验证                           |
| 工作流编排复杂度超预期                  | 中   | 高   | 限制 Phase 1 的 WorkflowEngine 为顺序执行（无并行），简化实现 |

---

## 七、资源需求

- **人力**: 1 人（开发者即用户）
- **LLM API**: DeepSeek API Key（主要）+ 通义千问 API Key（备用）
- **计算**: 本地开发机即可，无需额外服务器
- **时间**: 6-8 周（按 1 人全职估算）

---

## 八、下一步行动

1. **立即**: 评审本方案，确认垂直切片的范围和优先级
2. **本周**: 开始 Phase 1 任务 1.1（CheckpointManager 文件持久化）
3. **本周**: 确认 PatentCore Rust 的修复可行性（如果 1 周内无法修复，全力投入 TypeScript 降级）

---

_本方案基于 2026-05-01 代码库扫描结果制定，随着开发进展应定期更新。_
