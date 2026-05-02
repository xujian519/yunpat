# 专利撰写 MVP 实施计划 - 整合版

> **生成时间**: 2026-05-01  
> **版本**: v2.0 Integrated  
> **基于**: mvp-super-thinking-analysis-v2-enhanced.md + patent-drafting-mvp-implementation.md  
> **状态**: 待评审

---

## 一、执行摘要

### 1.1 核心策略

本计划整合了两份深度分析文档的核心观点:

**来自 v2.0 Enhanced 分析**:
- ✅ **检索与分析是核心切片** - 从1个交互点扩展到6个
- ✅ **深度技术分析必不可少** - 单篇专利技术分析是识别区别特征的关键
- ✅ **技术交底书再分析** - 基于对比分析提炼真正的问题-特征-效果

**来自 MVP 实施方案**:
- ✅ **"唤醒"而非"重建"** - 优先接入框架沉睡能力
- ✅ **垂直切片策略** - 每个切片独立可验收
- ✅ **人机协作协议** - 每个关键步骤都有人类确认点

### 1.2 关键决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| **开发周期** | 12-16.5周 | 采纳v2.0分析的更现实估算 |
| **切片2细化** | 6个交互点 | 深度技术分析是质量保证 |
| **交付策略** | 分阶段(v1.0 + v1.1) | 平衡质量和时间压力 |
| **框架优先级** | P0级别 | 先唤醒沉睡能力 |

### 1.3 交付方案

**v1.0 MVP** (10-12周):
- 框架唤醒 + 切片1(发明理解) + 切片2简化版(检索策略与执行) + 切片3(权利要求)

**v1.1 完整版** (+4-6.5周):
- 切片2深度分析 + 切片4(说明书) + 切片5(质量检查)

---

## 二、整合后的垂直切片设计

### 2.1 完整切片列表

| 切片 | 业务步骤 | 交互点数 | v1.0 | v1.1 | 优先级 |
|------|----------|---------|------|------|--------|
| **切片0** | 框架唤醒 | - | ✅ | - | P0 |
| **切片1** | 发明理解 → 人类确认 | 1 | ✅ | - | P0 |
| **切片2A** | 检索策略与执行 | 2 | ✅ | - | P1 |
| **切片2B** | 深度技术分析 | 4 | - | ✅ | P1 |
| **切片3** | 权利要求撰写 | 4 | ✅ | - | P0 |
| **切片4** | 说明书撰写 | 5 | - | ✅ | P1 |
| **切片5** | 质量检查 | 1 | - | ✅ | P2 |

**总计**: v1.0 包含7个交互点, v1.1 补充10个交互点, 共17个交互点

### 2.2 切片2的详细拆分

**原方案 (v1.0)** - 粒度过粗:
```
切片2: 检索策略构建 (1个交互点)
```

**整合方案 (v2.0)** - 完整的6个交互点:

#### 切片2A: 检索策略与执行 (v1.0)

1. **交互点2.1**: 检索策略构建
   - 输出: 关键词、IPC/CPC分类号、检索式
   - 人类确认: 检索策略是否覆盖核心技术点

2. **交互点2.2**: 专利数据库检索
   - 输出: 检索结果列表(按相关性排序)
   - 人类确认: 检索结果是否相关,是否需要调整策略

#### 切片2B: 深度技术分析 (v1.1)

3. **交互点2.3**: 专利PDF下载
   - 输出: 下载的PDF文件列表
   - 人类确认: 选择需要下载的专利(最多10篇)

4. **交互点2.4**: 单篇专利深度技术分析 (循环)
   - 输出: 技术问题/方案/效果的结构化提取
   - 人类确认: 逐篇确认技术分析结果

5. **交互点2.5**: 多专利对比分析
   - 输出: 区别特征、技术问题提炼、创造性评估
   - 人类确认: 确认区别特征和保护范围建议

6. **交互点2.6**: 技术交底书再分析
   - 输出: 提炼后的发明理解(去除现有技术部分)
   - 人类确认: 确认真正的问题-特征-效果

---

## 三、分阶段实施计划

### Phase 0: 框架唤醒 (预计1.5-2周) - P0

**目标**: 让Agent具备"暂停等待人类输入、保存状态到磁盘、恢复执行"的能力

#### 任务0.1: CheckpointManager文件系统持久化 (3天)
```
packages/core/src/memory/FileSystemCheckpointStore.ts [新增]
```

- 新建 `FileSystemCheckpointStore`，序列化为JSON到 `data/checkpoints/{executionId}/`
- 修改 `CheckpointManager` 支持注入外部Store
- 提供 `listResumableExecutions()` 接口

**验收**: 进程重启后能恢复到上次检查点

#### 任务0.2: Agent基类集成ApprovalFlow和CheckpointManager (4天)
```
packages/core/src/agent/Agent.ts
```

- 在 `AgentConfig` 中新增 `approvalFlow`、`checkpointManager`、`approvalStages`、`enableCheckpoints`
- 修改 `executeInternal` 流程，在关键阶段插入审批和检查点
- 提供 `resume(executionId)` 静态方法

**验收**: Agent执行到plan阶段后暂停,人类输入修正意见后继续执行

#### 任务0.3: 轻量WorkflowEngine封装 (4天)
```
packages/core/src/planning/WorkflowEngine.ts [新增]
packages/core/src/planning/WorkflowDefinition.ts [新增]
```

- 对现有TaskScheduler的轻量封装
- 支持步骤间数据传递(inputMapping)
- 在 `requiresApproval` 的步骤后自动插入ApprovalFlow
- 保存和恢复工作流级别状态

**验收**: 能编排3步骤工作流,支持数据传递和审批暂停

#### 任务0.4: PatentCoreBridge降级策略 (2天)
```
patents/core/PatentCoreBridge.ts
```

- 在 `runCli` 中添加错误处理,返回fallback标记
- 在PatentWriterAgent中实现LLM降级模式
- 短期: 用TypeScript实现简易版本

**验收**: Rust CLI不可用时,PatentWriterAgent仍能正常运行

---

### Phase 1: 切片1 - 发明理解 (预计1.5-2周) - P0

**目标**: 技术交底书 → 结构化发明理解 → 人类确认

#### 任务1.1: 创建InventionUnderstandingAgent (5天)
```
patents/agents/invention-understanding/InventionUnderstandingAgent.ts [新增]
```

**输入**:
```typescript
interface InventionUnderstandingInput {
  technicalDisclosure: string;
  title?: string;
  drawings?: string[];
}
```

**输出**:
```typescript
interface InventionUnderstandingOutput {
  invention_title: string;
  invention_type: 'device' | 'method' | 'system' | 'composition';
  technical_field: string;
  core_innovation: string;
  technical_problem: string;
  technical_solution: string;
  technical_effects: string[];
  essential_features: TechnicalFeature[];
  optional_features: TechnicalFeature[];
  confidence_score: number;
}
```

**实现要点**:
- plan阶段: 分析交底书结构,识别技术领域/问题/方案
- act阶段: 提炼核心创新点,区分必要/可选特征
- reflect阶段: 自评置信度,<0.7则标记需要人类重点关注
- 集成知识库: 检索相关技术领域的撰写规范

#### 任务1.2: 人类可读摘要渲染器 (2天)
```
patents/agents/invention-understanding/HumanReadableRenderer.ts [新增]
```

渲染为<300字的Markdown摘要:
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

⚠️ 需要关注: {如果置信度<0.7,列出不确定点}
```

#### 任务1.3: 定义第一个工作流 (2天)
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
      requiresApproval: false,
    },
    {
      id: 'understand-invention',
      name: '发明理解',
      agentName: 'invention-understanding',
      requiresApproval: true, // ⭐ 人类确认点
    },
  ],
};
```

#### 任务1.4: CLI入口 (3天)
```
packages/cli/src/commands/draft-patent.ts [新增]
```

提供命令:
```bash
yunpat draft-patent --disclosure ./path/to/disclosure.md --mode cli
```

**验收**: 提供真实交底书,5分钟内输出结构化发明理解结果

---

### Phase 2A: 切片2简化版 - 检索策略与执行 (预计1周) - P1

**目标**: 发明理解 → 检索策略 → 检索执行 → 人类确认

#### 任务2.1: SearchStrategyBuilderAgent (3天)
```
patents/agents/search/SearchStrategyBuilderAgent.ts [新增]
```

**输出**:
```typescript
interface SearchStrategy {
  keywords: {
    primary: string[];
    secondary: string[];
    synonyms: string[];
  };
  classification: {
    ipc: string[];
    cpc: string[];
  };
  searchQueries: {
    database: 'cnpatent' | 'uspto' | 'epo' | 'google-patents';
    query: string;
    expectedResults: number;
  }[];
  strategy: string; // AI解释为什么这样构建检索策略
}
```

**集成**: PatentClassifier(分类号生成)

#### 任务2.2: PatentDatabaseSearcherAgent (3天)
```
patents/agents/search/PatentDatabaseSearcherAgent.ts [新增]
```

**输出**:
```typescript
interface PatentSearchResults {
  patents: {
    publicationNumber: string;
    title: string;
    abstract: string;
    applicant: string;
    publicationDate: string;
    relevanceScore: number;
  }[];
  quality: {
    precision: number;
    recall: number;
    needsRefinement: boolean;
  };
}
```

**集成**: Google Patents API(免费、覆盖广)

#### 任务2.3: 工作流扩展 (1天)
```
patents/workflows/patent-drafting/02-prior-art-search-simple.workflow.ts [新增]
```

**验收**: 输出检索策略和检索结果,人类能确认或调整

---

### Phase 3: 切片3 - 权利要求撰写 (预计2-3周) - P0

**目标**: 发明理解 + 检索分析 → 权利要求布局 → 逐段撰写 → 人类确认

#### 任务3.1: ClaimGeneratorAgent重构 (7天)
```
patents/agents/writer/ClaimGeneratorAgent.ts [新增]
```

将权利要求生成逻辑从PatentWriterAgent中提取:

**输入**:
```typescript
interface ClaimGeneratorInput {
  inventionUnderstanding: InventionUnderstandingOutput;
  priorArtAnalysis?: {
    distinctFeatures: string[];
    closestPriorArt: PatentReference;
  };
  specificationDraft?: string;
}
```

**输出**:
```typescript
interface ClaimsSet {
  independentClaims: IndependentClaim[];
  dependentClaims: DependentClaim[];
  layoutStrategy: string;
  protectionScopeAnalysis: string;
}
```

**使用模板**: `01-claims-generation.md`

#### 任务3.2: 逐段确认机制 (5天)
```
packages/core/src/approval/SegmentApprovalFlow.ts [新增]
```

支持长文档的分段确认:
1. 独立权利要求(最关键)
2. 从属权利要求2-3(进一步限定)
3. 从属权利要求4+(具体实施方式)

每段生成后调用ApprovalFlow展示该段的权利要求文本+保护范围分析

#### 任务3.3: 工作流扩展 (2天)
```
patents/workflows/patent-drafting/03-claim-generation.workflow.ts [新增]
```

**验收**: 生成完整的权利要求书,人类能逐段确认或修正

---

### Phase 4: v1.0整合与测试 (预计1周) - P0

#### 任务4.1: 完整工作流串联 (3天)
```
patents/workflows/patent-drafting/full-patent-drafting-v10.workflow.ts [新增]
```

将切片1+2A+3串联:
```
验证输入 → 发明理解 → [确认] → 检索策略 → 检索执行 → [确认] → 
权利要求布局 → [确认] → 独立权利要求 → [确认] → 从属权利要求 → [确认] → 
输出v1.0完整文件(发明理解+检索分析+权利要求)
```

#### 任务4.2: 集成测试 (2天)
```
test/integration/patent-drafting/slice-01-invention-understanding.test.ts
test/integration/patent-drafting/slice-02-prior-art-search.test.ts
test/integration/patent-drafting/slice-03-claim-generation.test.ts
```

#### 任务4.3: CLI完善 (2天)

**验收**: 完整的v1.0工作流能从交底书运行到权利要求

---

### Phase 2B: 切片2深度分析 (预计2-3周) - v1.1

**目标**: 检索结果 → PDF下载 → 单篇技术分析 → 对比分析 → 技术交底书再分析

#### 任务2.4: PatentPDFDownloaderAgent (3天)
```
patents/agents/search/PatentPDFDownloaderAgent.ts [新增]
```

支持CNIPA、USPTO、EPO的PDF下载

#### 任务2.5: PatentTechnicalAnalyzerAgent (10天)
```
patents/agents/analysis/PatentTechnicalAnalyzerAgent.ts [新增]
```

**输出**:
```typescript
interface PatentTechnicalAnalysis {
  patentInfo: { ... };
  technicalAnalysis: {
    technicalProblems: { main: string; sub: string[] };
    technicalSolution: {
      core: string;
      keyFeatures: { feature: string; necessity: 'essential' | 'optional' }[];
      implementation: string;
    };
    technicalEffects: { main: string; sub: string[] };
    drawings: { figureNumber: string; description: string; keyElements: string[] }[];
  };
  comparison: {
    similarity: number;
    overlappingFeatures: string[];
    distinctFeatures: string[];
    novelty: boolean;
  };
}
```

**集成**:
- PDF解析: PyPDF2(通过gRPC调用Python服务)
- 附图分析: OCR + DeepSeek
- LLM: DeepSeek-Reasoner(长文本理解)

#### 任务2.6: ComparisonReportGeneratorAgent (5天)
```
patents/agents/analysis/ComparisonReportGeneratorAgent.ts [新增]
```

**输出**:
```typescript
interface ComparisonReport {
  closestPriorArt: { ... };
  distinctFeatures: {
    feature: string;
    novelty: 'high' | 'medium' | 'low';
    evidence: string[];
  }[];
  technicalProblem: { original: string; refined: string; refinementReason: string };
  technicalSolution: { original: string; refined: { core: string; innovative: string[]; obvious: string[] } };
  technicalEffects: { original: string[]; refined: { unexpected: string[]; expected: string[] } };
  inventiveness: { score: number; keyFactors: string[] };
  protectionScope: { independentClaims: string[]; dependentClaims: string[][]; breadth: string };
}
```

#### 任务2.7: DisclosureRefinerAgent (4天)
```
patents/agents/analysis/DisclosureRefinerAgent.ts [新增]
```

**输出**:
```typescript
interface RefinedInventionUnderstanding {
  original: InventionUnderstandingOutput;
  refined: {
    invention_title: string;
    core_innovation: string;
    technical_problem: string;
    technical_solution: string;
    technical_effects: string[];
    features: {
      innovative: TechnicalFeature[];
      known: TechnicalFeature[];
      combination: TechnicalFeature[];
    };
    protectionScope: { independent: string; dependent: string[] };
  };
}
```

**验收**: 深度技术分析能准确提取技术问题/方案/效果,对比分析能识别区别特征

---

### Phase 5: 切片4 - 说明书撰写 (预计2-3周) - v1.1

#### 任务5.1: SpecificationDrafterAgent (10天)
```
patents/agents/writer/SpecificationDrafterAgent.ts [新增]
```

使用 `02-specification-drafting.md` 模板,分章节撰写:
1. 技术领域
2. 背景技术
3. 发明内容(技术问题/方案/效果)
4. 具体实施方式(结合附图,至少一个实施例)
5. 附图说明

**关键**: 各章节不设字数上限,以"清楚、完整、充分公开"为唯一标准

#### 任务5.2: 逐章确认机制 (5天)

每章生成后人类确认

#### 任务5.3: 工作流扩展 (2天)

**验收**: 说明书各章节连贯一致,术语统一

---

### Phase 6: 切片5 - 质量检查 (预计1-1.5周) - v1.1

#### 任务6.1: QualityCheckerAgent (5天)
```
patents/agents/quality/QualityCheckerAgent.ts [新增]
```

**检查项**:
- 权利要求保护范围是否合理
- 说明书是否充分公开
- 术语是否一致
- 是否有明显的形式错误

#### 任务6.2: 完整工作流串联 (3天)
```
patents/workflows/patent-drafting/full-patent-drafting-v11.workflow.ts [新增]
```

**验收**: 完整的v1.1工作流能从交底书运行到完整专利申请文件

---

### Phase 7: v1.1整合与测试 (预计1周) - v1.1

#### 任务7.1: 集成测试 (3天)
```
test/integration/patent-drafting/slice-04-specification.test.ts
test/integration/patent-drafting/slice-05-quality-check.test.ts
test/integration/patent-drafting/full-patent-drafting.test.ts
```

#### 任务7.2: 数据飞轮 (2天)
```
data/feedback/{caseId}/{stepId}-{timestamp}.json
```

记录:
- 原始AI输出
- 人类反馈类型(approve/correct/supplement/reject)
- 修正内容
- 重新生成后的输出

#### 任务7.3: 文档完善 (2天)

**验收**: 至少5个集成测试通过,数据飞轮建立

---

## 四、时间规划与里程碑

### 4.1 详细时间表

| 阶段 | 内容 | 时间 | 累计 | 里程碑 |
|------|------|------|------|--------|
| **Phase 0** | 框架唤醒 | 1.5-2周 | 1.5-2周 | ✅ Agent支持暂停/恢复 |
| **Phase 1** | 切片1: 发明理解 | 1.5-2周 | 3-4周 | ✅ 发明理解可验收 |
| **Phase 2A** | 切片2A: 检索策略与执行 | 1周 | 4-5周 | ✅ 检索结果可验收 |
| **Phase 3** | 切片3: 权利要求撰写 | 2-3周 | 6-8周 | ✅ 权利要求可验收 |
| **Phase 4** | v1.0整合与测试 | 1周 | 7-9周 | 🎉 **v1.0发布** |
| **Phase 2B** | 切片2B: 深度技术分析 | 2-3周 | 9-12周 | ✅ 深度分析可验收 |
| **Phase 5** | 切片4: 说明书撰写 | 2-3周 | 11-15周 | ✅ 说明书可验收 |
| **Phase 6** | 切片5: 质量检查 | 1-1.5周 | 12-16.5周 | ✅ 质量检查可验收 |
| **Phase 7** | v1.1整合与测试 | 1周 | 13-17.5周 | 🎉 **v1.1发布** |

### 4.2 里程碑定义

**v1.0 MVP** (7-9周):
- ✅ 框架层: Agent支持暂停/恢复/检查点
- ✅ 切片1: 发明理解(1个交互点)
- ✅ 切片2A: 检索策略与执行(2个交互点)
- ✅ 切片3: 权利要求撰写(4个交互点)
- ✅ CLI: `yunpat draft-patent` 命令可用
- ✅ 输出: 发明理解 + 检索分析 + 权利要求

**v1.1 完整版** (13-17.5周):
- ✅ v1.0的所有功能
- ✅ 切片2B: 深度技术分析(4个交互点)
- ✅ 切片4: 说明书撰写(5个交互点)
- ✅ 切片5: 质量检查(1个交互点)
- ✅ 输出: 完整专利申请文件(发明理解+检索分析+权利要求+说明书)

---

## 五、技术栈与工具选择

### 5.1 专利数据库API

| 数据库 | API | 成本 | 覆盖范围 | 推荐度 | 阶段 |
|--------|-----|------|---------|--------|------|
| **Google Patents** | ✅ 免费 | 免费 | 全球 | ⭐⭐⭐⭐⭐ | v1.0 |
| **EPO OPS** | ✅ 免费 | 免费 | 欧洲专利 | ⭐⭐⭐⭐ | v1.1 |
| **USPTO** | ✅ 免费 | 免费 | 美国专利 | ⭐⭐⭐⭐ | v1.1 |
| **CNIPA** | ⚠️ 爬虫 | 免费 | 中国专利 | ⭐⭐⭐ | v1.1 |

**建议**:
- v1.0: 仅使用Google Patents API
- v1.1: 补充EPO OPS和USPTO, CNIPA使用爬虫

### 5.2 PDF解析

| 技术 | 语言 | 优势 | 劣势 | 推荐度 |
|------|------|------|------|--------|
| **PyPDF2** | Python | 成熟稳定 | 需要Python环境 | ⭐⭐⭐⭐ |
| **pdf.js** | JS | 原生支持 | 解析精度一般 | ⭐⭐⭐ |

**建议**: v1.0使用pdf.js,v1.1升级到PyPDF2(通过gRPC调用Python服务)

### 5.3 附图分析

| 技术 | 方法 | 优势 | 劣势 | 推荐度 |
|------|------|------|------|--------|
| **OCR + DeepSeek** | Tesseract + LLM | 低成本 | 精度一般 | ⭐⭐⭐ |
| **Vision API** | GPT-4V | 高精度 | 成本高 | ⭐⭐⭐⭐ |

**建议**: v1.1使用OCR + DeepSeek(成本可控)

### 5.4 LLM模型

| 任务 | 模型 | 理由 |
|------|------|------|
| **通用生成** | DeepSeek-V3 | 性价比高,中文优秀 |
| **长文本理解** | DeepSeek-Reasoner | 128K上下文,推理能力强 |
| **附图分析** | DeepSeek-V3-Vision | 多模态支持 |
| **备用** | 通义千问-Max | DeepSeek不可用时降级 |

---

## 六、风险与对策

### 6.1 v1.0特有风险

| 风险 | 概率 | 影响 | 对策 |
|------|------|------|------|
| 框架集成复杂度超预期 | 中 | 高 | 限制Phase 0为顺序执行,不涉及并行 |
| PatentCore Rust无法修复 | 中 | 中 | 已实现TypeScript降级,不影响主流程 |
| 权利要求生成质量差 | 高 | 高 | 使用专业模板(01-claims-generation.md) |
| 时间压力(v1.0仅7-9周) | 中 | 中 | 如超期,优先完成切片1+3,切片2A可降级到模拟数据 |

### 6.2 v1.1特有风险

| 风险 | 概率 | 影响 | 对策 |
|------|------|------|------|
| 专利数据库API限流 | 高 | 高 | 1. 使用多个API轮换<br>2. 添加缓存<br>3. 夜间批量下载 |
| PDF解析失败 | 中 | 中 | 1. 多种解析器备份<br>2. 人工复核机制 |
| 技术分析不准确 | 高 | 高 | 1. 多轮迭代优化<br>2. 人工确认点<br>3. 置信度评分 |
| 2B开发周期过长(2-3周) | 中 | 中 | 1. 分阶段交付<br>2. 先用简化版 |

### 6.3 降级策略

**降级1: 检索执行降级**
- 理想: 真实专利数据库API
- 降级: 使用公开数据集(如PatentsView)
- 最坏: 使用LLM生成模拟数据(标记为simulated)

**降级2: PDF分析降级**
- 理想: 完整PDF解析 + 附图分析
- 降级: 仅解析文本(跳过附图)
- 最坏: 使用专利摘要(不下载PDF)

**降级3: 技术分析降级**
- 理想: 结构化技术分析
- 降级: 简化版分析(仅提取技术问题/方案/效果)
- 最坏: 仅检索,不深度分析

---

## 七、验收标准汇总

### 7.1 Phase 0验收(框架层)

- [ ] CheckpointManager支持文件系统持久化,进程重启后可恢复
- [ ] Agent.execute()集成ApprovalFlow,plan/act阶段可配置人工审批
- [ ] WorkflowEngine能编排3步骤工作流,支持数据传递和审批暂停
- [ ] PatentCoreBridge在Rust CLI不可用时能降级到LLM模式

### 7.2 Phase 1验收(切片1)

- [ ] 提供真实交底书,5分钟内输出结构化发明理解结果
- [ ] 人类在CLI中确认后,结果正确保存到磁盘
- [ ] 人类提出修正后,系统能重新生成并展示修正结果

### 7.3 Phase 2A验收(切片2A)

- [ ] 基于发明理解结果,输出合理的检索策略和检索结果
- [ ] 人类能修改检索策略关键词,系统重新执行检索
- [ ] 检索结果按相关性排序,相关性评分>0.7的至少10篇

### 7.4 Phase 3验收(切片3)

- [ ] 生成完整的权利要求书(独立+从属),保护范围合理
- [ ] 人类能逐段确认或修正权利要求
- [ ] 权利要求术语一致,布局合理

### 7.5 v1.0验收

- [ ] 完整的v1.0工作流能从交底书运行到权利要求
- [ ] 每个关键步骤都有人类确认点(共7个交互点)
- [ ] 任务中断后可从上次确认点恢复
- [ ] 至少3个集成测试通过

### 7.6 Phase 2B验收(切片2B)

- [ ] 成功下载至少10篇相关专利的PDF
- [ ] 单篇专利技术分析准确率>80%(技术问题/方案/效果)
- [ ] 对比分析能识别至少3个区别特征
- [ ] 技术交底书再分析能提炼真正的问题-特征-效果

### 7.7 Phase 5验收(切片4)

- [ ] 生成完整的说明书(技术领域/背景技术/发明内容/实施方式/附图说明)
- [ ] 说明书各章节连贯一致,术语统一
- [ ] 说明书满足"清楚、完整、充分公开"要求

### 7.8 Phase 6验收(切片5)

- [ ] 质量检查能识别明显错误
- [ ] 质量检查报告可操作

### 7.9 v1.1验收

- [ ] 完整的v1.1工作流能从交底书运行到完整专利申请文件
- [ ] 每个关键步骤都有人类确认点(共17个交互点)
- [ ] 至少5个集成测试通过
- [ ] 数据飞轮建立

---

## 八、资源需求

### 8.1 人力

- **开发**: 1人(开发者即用户)
- **测试**: 开发者兼任
- **领域专家**: 按需咨询(专利代理人)

### 8.2 LLM API

- **主要**: DeepSeek API Key
- **备用**: 通义千问API Key

**成本估算**:
- v1.0: 约¥500-1000(测试+少量真实案例)
- v1.1: 约¥1000-2000(深度分析消耗更多token)

### 8.3 计算

- 本地开发机即可(MacBook Pro M1/M2或同等性能)
- 无需额外服务器

### 8.4 存储

- 检查点: `data/checkpoints/` - 约100MB/案例
- PDF下载: `data/cases/{caseId}/prior-art-pdfs/` - 约50MB/专利
- 工作流状态: `data/drafts/{caseId}/` - 约10MB/案例

**估算**: 100个案例约10GB

---

## 九、下一步行动

### 9.1 立即行动(本周)

1. **评审本整合计划** - 确认v1.0和v1.1的范围划分
2. **确认开发周期** - 是否接受12-16.5周的周期
3. **确认技术选型** - Google Patents API、PyPDF2、DeepSeek
4. **准备环境** - 安装依赖、配置API Key

### 9.2 Phase 0启动(下周)

1. **开始任务0.1** - CheckpointManager文件持久化
2. **确认PatentCore Rust** - 如果1周内无法修复,全力投入TypeScript降级
3. **搭建工作流框架** - WorkflowEngine基础结构

### 9.3 关键决策点

**决策1**: 是否接受分阶段交付(v1.0 + v1.1)?
- 如果是 → 按本计划执行
- 如果否 → 考虑延长v1.0周期,直接交付完整版

**决策2**: 切片2B的深度分析是否必须?
- 如果是 → 按完整6个交互点实现
- 如果否 → v1.1可简化为3个交互点(跳过单篇技术分析)

**决策3**: 是否需要真实的专利数据库API?
- v1.0: 可用模拟数据(标记为simulated)
- v1.1: 必须接入真实API

---

## 十、成功标准

### 10.1 v1.0成功标准

1. ✅ **框架层可用** - Agent支持暂停/恢复/检查点
2. ✅ **切片1可用** - 发明理解准确率>80%
3. ✅ **切片2A可用** - 检索策略合理,检索结果相关性>0.7
4. ✅ **切片3可用** - 权利要求保护范围合理,术语一致
5. ✅ **CLI可用** - `yunpat draft-patent` 命令端到端运行
6. ✅ **测试通过** - 至少3个集成测试通过

### 10.2 v1.1成功标准

1. ✅ **v1.0所有功能**
2. ✅ **切片2B可用** - 深度技术分析准确率>80%,对比分析能识别区别特征
3. ✅ **切片4可用** - 说明书充分公开,术语一致
4. ✅ **切片5可用** - 质量检查能识别明显错误
5. ✅ **完整工作流** - 从交底书到完整专利申请文件
6. ✅ **测试通过** - 至少5个集成测试通过
7. ✅ **数据飞轮** - 反馈记录机制建立

---

## 十一、附录

### 11.1 与原方案的对比

| 维度 | 原方案 | 整合方案 | 变化原因 |
|------|--------|---------|---------|
| **开发周期** | 6-8周 | 12-16.5周 | 采纳v2.0分析的更现实估算 |
| **切片2交互点** | 1个 | 6个(2A:2个,2B:4个) | 深度技术分析是质量保证 |
| **总交互点** | 9个 | 17个 | 切片2细化+切片4/5补充 |
| **交付策略** | 一次性 | 分阶段(v1.0+v1.1) | 平衡质量和时间压力 |
| **框架优先级** | 未明确 | P0 | 先唤醒沉睡能力 |

### 11.2 关键文档引用

- **Athena文档**: 检索与分析协议(Phase 2)
- **v2.0 Enhanced分析**: 切片2的6个交互点设计
- **MVP实施方案**: 框架唤醒策略、垂直切片方法
- **现有模板**: `01-claims-generation.md`、`02-specification-drafting.md`

### 11.3 术语表

- **垂直切片**: 端到端的业务流程,独立可验收
- **交互点**: 需要人类确认的关键步骤
- **检查点**: Agent执行状态的保存点,支持断点续传
- **降级策略**: 当理想方案不可行时的备用方案
- **数据飞轮**: 人类反馈的记录机制,用于持续优化

---

*本计划整合了两份深度分析文档的核心观点,采用分阶段交付策略,优先唤醒框架沉睡能力,将检索与分析细化为6个交互点,总开发周期12-16.5周。*

*计划生成时间: 2026-05-01*
*计划制定者: Claude (Sonnet 4.6)*
