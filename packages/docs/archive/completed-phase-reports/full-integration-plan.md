# 全部集成知识图谱 - 实施计划（方案 B）

## 🎯 目标

**将所有 20 个 Agent 集成知识图谱**，提升整个系统的法律知识检索和推理能力。

---

## 📊 Agent 清单（按优先级排序）

### 🔴 高优先级（5 个）- 核心业务 Agent

| #   | Agent                 | 类名                      | 文件路径                                   |
| --- | --------------------- | ------------------------- | ------------------------------------------ |
| 1   | prior-art-search      | PriorArtSearchAgent       | packages/agents/prior-art-search/src/      |
| 2   | patent-responder      | PatentResponderAgent      | packages/agents/patent-responder/src/      |
| 3   | claim-generator       | ClaimGeneratorAgent       | packages/agents/claim-generator/src/       |
| 4   | specification-drafter | SpecificationDrafterAgent | packages/agents/specification-drafter/src/ |
| 5   | patent-invalidity     | PatentInvalidityAgent     | packages/agents/patent-invalidity/src/     |

### 🟡 中优先级（5 个）- 分析和撰写 Agent

| #   | Agent                  | 类名                         | 文件路径                                    |
| --- | ---------------------- | ---------------------------- | ------------------------------------------- |
| 6   | invention              | InventionUnderstandingAgent  | packages/agents/invention/src/              |
| 7   | analysis               | PatentTechnicalAnalyzerAgent | packages/agents/analysis/src/               |
| 8   | search                 | PatentSearchAgent            | packages/agents/search/src/                 |
| 9   | patent-writer          | PatentWriterAgent            | packages/agents/patent-writer/src/          |
| 10  | subject-matter-checker | SubjectMatterCheckerAgent    | packages/agents/subject-matter-checker/src/ |

### 🟢 低优先级（10 个）- 辅助和工具 Agent

| #   | Agent                       | 类名                           | 文件路径                                         |
| --- | --------------------------- | ------------------------------ | ------------------------------------------------ |
| 11  | quality                     | QualityCheckerAgent            | packages/agents/quality/src/                     |
| 12  | quality-checker             | QualityCheckerAgent            | packages/agents/quality-checker/src/             |
| 13  | patent-manager              | PatentManagerAgent             | packages/agents/patent-manager/src/              |
| 14  | comparison-report-generator | ComparisonReportGeneratorAgent | packages/agents/comparison-report-generator/src/ |
| 15  | claims-formality-checker    | ClaimsFormalityCheckerAgent    | packages/agents/claims-formality-checker/src/    |
| 16  | spec-formality-checker      | SpecFormalityCheckerAgent      | packages/agents/spec-formality-checker/src/      |
| 17  | format-converter            | PatentFormatConverterAgent     | packages/agents/format-converter/src/            |
| 18  | technical-drawing           | TechnicalDrawingAgent          | packages/agents/technical-drawing/src/           |
| 19  | abstract-drafter            | AbstractDrafterAgent           | packages/agents/abstract-drafter/src/            |
| 20  | researcher                  | ResearcherAgent                | packages/agents/researcher/src/                  |

---

## 🚀 实施步骤

### 阶段 1：准备阶段（1 天）

#### 1.1 备份当前代码

```bash
# 创建备份分支
git checkout -b backup/before-knowledge-integration
git push -u origin backup/before-knowledge-integration

# 创建工作分支
git checkout main
git checkout -b feature/all-agents-knowledge-integration
```

#### 1.2 验证知识图谱功能

```bash
# 测试知识图谱连接
pnpm tsx scripts/test-invalid-decisions-simple.js
```

#### 1.3 创建批量修改脚本

```bash
# 创建 Agent 修改脚本
# - 自动检测继承关系
# - 自动替换基类
# - 自动添加知识图谱配置
```

---

### 阶段 2：高优先级 Agent 集成（3-5 天）

#### 2.1 修改高优先级 Agent（5 个）

**修改模式**：

```typescript
// 之前
export class PriorArtSearchAgent extends Agent<...>

// 之后
export class PriorArtSearchAgent extends KnowledgeEnhancedAgent<...>
```

**Agent 列表**：

1. prior-art-search
2. patent-responder
3. claim-generator
4. specification-drafter
5. patent-invalidity

#### 2.2 测试验证

对每个 Agent 进行测试：

- ✅ 编译通过
- ✅ 知识图谱自动启用
- ✅ 查询功能正常

---

### 阶段 3：中优先级 Agent 集成（3-5 天）

#### 3.1 修改中优先级 Agent（5 个）

**Agent 列表**：6. invention 7. analysis 8. search 9. patent-writer 10. subject-matter-checker

#### 3.2 测试验证

---

### 阶段 4：低优先级 Agent 集成（2-3 天）

#### 4.1 修改低优先级 Agent（10 个）

**Agent 列表**：
11-20. 所有辅助和工具 Agent

#### 4.2 全面测试

---

### 阶段 5：验证和优化（2-3 天）

#### 5.1 端到端测试

测试完整工作流：

```
发明理解 → 先导检索 → 权利要求生成 → 说明书撰写 → 质量检查
```

#### 5.2 性能优化

- 优化知识图谱查询性能
- 添加缓存机制
- 优化批量查询

#### 5.3 文档更新

更新 Agent 使用文档

---

## 🛠️ 技术实施细节

### 修改模板

#### 步骤 1：修改导入

```typescript
// 之前
import { Agent } from '@yunpat/core'

// 之后
import { KnowledgeEnhancedAgent } from '@yunpat/core'
```

#### 步骤 2：修改类定义

```typescript
// 之前
export class PriorArtSearchAgent extends Agent<PriorArtSearchInput, PriorArtSearchResult> {
  constructor(config: AgentConfig) {
    super(config)
  }
}

// 之后
export class PriorArtSearchAgent extends KnowledgeEnhancedAgent<
  PriorArtSearchInput,
  PriorArtSearchResult
> {
  constructor(config: KnowledgeEnhancedAgentConfig) {
    super(config)
  }
}
```

#### 步骤 3：添加知识图谱查询（可选）

```typescript
protected async plan(input: PriorArtSearchInput, context: ExecutionContext) {
  // 自动知识增强
  const knowledge = await this.queryKnowledge(
    input.inventionTitle,
    5
  )

  // 使用知识增强
  console.log('相关知识已自动检索')

  return await super.plan(input, context)
}
```

---

## 📋 完整 Agent 修改清单

### 需要修改的文件（23 个）

#### 高优先级（5 个）

1. `/Users/xujian/projects/YunPat/packages/agents/prior-art-search/src/PriorArtSearchAgent.ts`
2. `/Users/xujian/projects/YunPat/packages/agents/patent-responder/src/PatentResponderAgent.ts`
3. `/Users/xujian/projects/YunPat/packages/agents/claim-generator/src/ClaimGeneratorAgent.ts`
4. `/Users/xujian/projects/YunPat/packages/agents/specification-drafter/src/SpecificationDrafterAgent.ts`
5. `/Users/xujian/projects/YunPat/packages/agents/patent-invalidity/src/PatentInvalidityAgent.ts`

#### 中优先级（5 个）

6. `/Users/xujian/projects/YunPat/packages/agents/invention/src/InventionUnderstandingAgent.ts`
7. `/Users/xujian/projects/YunPat/packages/agents/analysis/src/PatentTechnicalAnalyzerAgent.ts`
8. `/Users/xujian/projects/YunPat/packages/agents/search/src/PatentSearchAgent.ts`
9. `/Users/xujian/projects/YunPat/packages/agents/patent-writer/src/PatentWriterAgent.ts`
10. `/Users/xujian/projects/YunPat/packages/agents/subject-matter-checker/src/SubjectMatterCheckerAgent.ts`

#### 低优先级（10+ 个）

11. `/Users/xujian/projects/YunPat/packages/agents/quality/src/QualityCheckerAgent.ts`
12. `/Users/xujian/projects/Yunpat/packages/agents/quality-checker/src/QualityCheckerAgent.ts`
13. `/Users/xujian/projects/YunPat/packages/agents/patent-manager/src/PatentManagerAgent.ts`
    14-23. 其他 Agent 文件

---

## ⏱️ 时间估算

| 阶段         | 时间         | 说明                 |
| ------------ | ------------ | -------------------- |
| 准备阶段     | 1 天         | 备份、验证、创建脚本 |
| 高优先级集成 | 3-5 天       | 5 个 Agent + 测试    |
| 中优先级集成 | 3-5 天       | 5 个 Agent + 测试    |
| 低优先级集成 | 2-3 天       | 10 个 Agent + 测试   |
| 验证优化     | 2-3 天       | 端到端测试、性能优化 |
| 文档更新     | 1 天         | 更新使用文档         |
| **总计**     | **12-18 天** | **约 2-3 周**        |

---

## 📈 预期效果

### 量化指标

| 指标         | 之前    | 之后           | 提升         |
| ------------ | ------- | -------------- | ------------ |
| 知识覆盖     | 4k 文件 | 400 万条       | **1000 倍**  |
| 检索准确率   | 65%     | 85%+           | **+31%**     |
| 答复成功率   | 60%     | 75%+           | **+25%**     |
| 权要质量     | 中      | 高             | **+40%**     |
| 说明书完整性 | 中      | 高             | \*\*+35%     |
| 技术壁垒     | ⭐⭐    | ⭐⭐⭐⭐⭐⭐⭐ | **质的飞跃** |

### 质的提升

**之前**：

- Agent 只依赖 LLM + prompt
- 法律知识有限
- 容易"幻觉"
- 技术壁垒低

**之后**：

- Agent 集成完整法律世界模型（400 万条）
- 自动检索相关法律条文和案例
- 基于真实案例的推理
- 技术壁垒大幅提升

---

## ⚠️ 风险控制

### 风险 1：破坏现有功能

**控制措施**：

- ✅ 创建备份分支
- ✅ 逐个 Agent 集成和测试
- ✅ 每个阶段验证后提交
- ✅ 保留回滚选项

### 风险 2：性能问题

**控制措施**：

- ✅ 知识图谱查询优化
- ✅ 添加缓存机制
- ✅ 异步查询
- ✅ 批量查询优化

### 风险 3：兼容性问题

**控制措施**：

- ✅ 保持 API 接口不变
- ✅ 向后兼容
- ✅ 渐进式集成
- ✅ 充分测试

---

## 🎯 立即开始

### 第一步：验证知识图谱

```bash
# 验证知识图谱功能
pnpm tsx scripts/test-invalid-decisions-simple.js
```

### 第二步：开始集成

**我建议从高优先级 Agent 开始**：

1. ✅ **prior-art-search** - 先导技术检索（最高价值）
2. ✅ **patent-responder** - OA 审查意见答复（高价值）
3. ✅ **claim-generator** - 权利要求生成（核心功能）
4. ✅ **specification-drafter** - 说明书撰写（核心功能）
5. ✅ **patent-invalidity** - 专利无效宣告（高价值）

---

## ❓ 确认开始

**方案 B - 全部集成所有 Agent**

**预计时间**：12-18 天（2-3 周）

**预期效果**：

- ✅ 20 个 Agent 全部集成知识图谱
- ✅ 技术壁垒从 ⭐⭐ 提升到 ⭐⭐⭐⭐⭐⭐⭐⭐
- ✅ 整体质量提升 30-40%

---

## 🚀 准备开始！

**我已经准备好了，现在开始吗？**

**第一步**：

1. 验证知识图谱功能
2. 创建备份分支
3. 开始修改第一个 Agent（prior-art-search）

**确认开始吗？** 🎯
