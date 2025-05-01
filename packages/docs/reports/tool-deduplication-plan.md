# YunPat 工具去重和改进计划

> **生成时间**: 2026-05-05
> **基于**: tool-asset-inventory.md 报告
> **目标**: 提高工具复用率从42.9%到≥80%

---

## 🔍 工具复用率分析（修正版）

### Week 5 Agent 工具使用实际情况

经过详细代码检查，发现**所有Week 5实现的Agent都没有实际使用工具**：

| Agent                          | 声明使用工具          | 实际使用工具 | 复用率 |
| ------------------------------ | --------------------- | ------------ | ------ |
| PriorArtSearchAgent            | ❌ 未声明             | ❌ 未使用    | 0%     |
| QualityCheckerAgent            | ❌ 未声明             | ❌ 未使用    | 0%     |
| ComparisonReportGeneratorAgent | ❌ 未声明             | ❌ 未使用    | 0%     |
| UnityChecker                   | ✅ 声明了ToolRegistry | ❌ 未使用    | 0%     |
| SubjectMatterChecker           | ✅ 声明了ToolRegistry | ❌ 未使用    | 0%     |
| ClaimsFormalityChecker         | ✅ 声明了ToolRegistry | ❌ 未使用    | 0%     |
| SpecFormalityChecker           | ✅ 声明了ToolRegistry | ❌ 未使用    | 0%     |
| **总计**                       | **4/7**               | **0/7**      | **0%** |

### 问题根因分析

1. **Agent架构设计问题**
   - Agent继承了`Agent`基类，但没有利用`tools`参数
   - 所有逻辑都是纯LLM调用，没有工具编排

2. **工具层与Agent层脱节**
   - 87+个工具已经实现
   - 但Agent完全没有使用这些工具
   - 说明架构设计存在根本性问题

3. **开发流程问题**
   - Week 5的开发可能过于追求"完成Agent"
   - 忽略了"Agent应该编排工具"这一核心理念

---

## 🎯 工具去重优先级清单

### 🔴 P0 - 立即处理（本周完成）

#### 1. 专利搜索工具重复

**问题描述**：

- `builtin-tools/src/iterative-search.ts` 中的 `PatentSearchTool`
- `patent-tools/src/tools/PatentSearchTool.ts` 中的 `PatentSearchTool`

**影响**：

- 维护两套相似逻辑
- 功能可能不一致
- 增加测试负担

**处理方案**：

```typescript
// 删除 builtin-tools/src/iterative-search.ts 中的 PatentSearchTool
// 保留 patent-tools/src/tools/PatentSearchTool.ts

// 更新 builtin-tools/src/index.ts
// 删除这行：
- export { PatentSearchTool } from './iterative-search.js'

// 更新 builtin-tools/src/iterative-search.ts
// 只保留 IterativeSearchTool，删除 PatentSearchTool
```

**验证方法**：

- 搜索所有使用`PatentSearchTool`的地方
- 确保都导入自`@yunpat/patent-tools`
- 运行测试确保无破坏性变更

**预期收益**：

- 减少~100行重复代码
- 统一专利搜索逻辑
- 降低维护成本

#### 2. 权利要求生成工具重复

**问题描述**：

- `document-tools/src/tools/PatentDocxGenerator.ts` 中的 `PatentClaimsGeneratorTool`
- `patent-tools/src/tools/ClaimsGeneratorTool.ts` 中的 `ClaimsGeneratorTool`

**影响**：

- 功能重叠
- API不统一
- 用户困惑

**处理方案**：

```typescript
// 方案1：保留patent-tools，document-tools调用它
// document-tools/src/tools/PatentDocxGenerator.ts
import { ClaimsGeneratorTool } from '@yunpat/patent-tools'

export class PatentClaimsGeneratorTool {
  private claimsGenerator = new ClaimsGeneratorTool()

  async execute(input: PatentClaimsInput) {
    // 调用patent-tools的实现
    return this.claimsGenerator.execute(input)
  }
}

// 方案2（推荐）：明确职责边界
// patent-tools/ClaimsGeneratorTool - 专注权利要求内容生成
// document-tools/PatentClaimsGeneratorTool - 专注DOCX文件格式化
// 各司其职，不重复
```

**验证方法**：

- 检查两个工具的实际功能差异
- 如果功能相同，合并；如果不同，明确职责
- 更新文档说明各自的用途

**预期收益**：

- 避免功能重复
- 明确工具职责
- 提高代码可维护性

---

### 🟡 P1 - 近期处理（下周完成）

#### 1. 谷歌专利工具定位不清

**问题描述**：

- `patent-tools/src/tools/GooglePatentsTool.ts` 提供了 `GooglePatentsFetchTool` 和 `GooglePatentDetailTool`
- `patent-tools/src/tools/PatentSearchTool.ts` 也支持谷歌专利搜索
- 职责边界不清晰

**处理方案**：

```typescript
// 明确职责分工：
// GooglePatentsFetchTool - 专门抓取谷歌专利网页数据
// GooglePatentDetailTool - 专门解析谷歌专利详情页
// PatentSearchTool - 统一的专利搜索接口（可调用谷歌专利）

// 或者：合并为单一工具
// PatentSearchTool - 支持多数据源（包括谷歌专利）
```

**验证方法**：

- 分析两个工具的使用场景
- 确定是否需要保留两个独立工具
- 更新API文档

#### 2. OCR工具功能重叠

**问题描述**：

- `document-tools/src/tools/OcrTools.ts` 中的 `ImageOcrTool`
- `document-tools/src/tools/PdfTools.ts` 中的 `PdfOcrTool`
- 功能类似但用途不同

**处理方案**：

```typescript
// 保持现状，但明确职责：
// ImageOcrTool - 图像OCR识别
// PdfOcrTool - PDF文档OCR识别
// 底层可以共用同一个OCR引擎
```

---

### 🟢 P2 - 长期优化（未来迭代）

#### 1. 文档转换工具命名一致性

**当前状态**：

- `PdfToMarkdownTool`, `DocxToMarkdownTool`, `ExcelToMarkdownTool`
- `ImageToMarkdownTool`, `AudioToMarkdownTool`
- 命名规范不统一

**改进建议**：

```typescript
// 统一命名规范：
// 格式：[Source]To[Target]Tool
// 示例：PdfToMarkdownTool, DocxToHtmlTool, ImageToTextTool

// 或者使用更通用的工具：
// DocumentConverterTool - 支持多种格式转换
```

#### 2. 专利下载工具功能合并

**当前状态**：

- `PatentDownloadTool` - 单个专利下载
- `BatchPatentDownloadTool` - 批量专利下载
- 功能类似

**改进建议**：

```typescript
// 合并为单一工具：
// PatentDownloadTool - 支持单个和批量下载
// 通过参数控制：
// { patentIds: string[] | string, format: 'pdf' | 'xml' }
```

---

## 🚀 Agent工具使用改进计划

### 现状问题

所有Week 5的Agent都是**纯LLM调用**，没有编排工具：

```typescript
// ❌ 当前实现（纯LLM）
class UnityChecker extends Agent {
  protected async execute(input: UnityCheckInput) {
    // 直接调用LLM
    const response = await this.llm.chat({
      messages: [{ role: 'user', content: prompt }],
    })
    return parseResponse(response)
  }
}
```

### 改进方案

#### 1. UnityChecker 应该使用工具

```typescript
// ✅ 改进实现（工具编排）
class UnityChecker extends Agent {
  protected async execute(input: UnityCheckInput) {
    // 1. 使用权利要求解析工具
    const claimsParser = new ClaimsParserTool()
    const parsedClaims = await claimsParser.execute({ claims: input.claims })

    // 2. 使用技术特征提取工具
    const featureExtractor = new FeatureExtractorTool()
    const features = await featureExtractor.execute({ claims: parsedClaims })

    // 3. 使用相似度计算工具
    const similarityCalculator = new SimilarityCalculatorTool()
    const similarity = await similarityCalculator.execute({
      features1: features[0],
      features2: features[1],
    })

    // 4. 使用LLM生成分析报告
    const report = await this.llm.chat({
      messages: [
        {
          role: 'user',
          content: `基于以下分析结果生成单一性检查报告：${JSON.stringify(similarity)}`,
        },
      ],
    })

    return { similarity, report }
  }
}
```

#### 2. ClaimsFormalityChecker 应该使用工具

```typescript
// ✅ 改进实现（工具编排）
class ClaimsFormalityChecker extends Agent {
  protected async execute(input: ClaimsCheckInput) {
    // 1. 使用权利要求解析工具
    const claimsParser = new ClaimsParserTool()
    const parsedClaims = await claimsParser.execute({ claims: input.claims })

    // 2. 使用权利要求验证工具
    const claimsValidator = new ClaimsValidatorTool()
    const validation = await claimsValidator.execute({
      claims: parsedClaims,
      patentType: input.patentType,
    })

    // 3. 使用说明书对比工具（检查支持性）
    if (input.specification) {
      const specComparer = new SpecificationComparerTool()
      const supportCheck = await specComparer.execute({
        claims: parsedClaims,
        specification: input.specification,
      })
      validation.support = supportCheck
    }

    return validation
  }
}
```

#### 3. PriorArtSearchAgent 应该使用工具

```typescript
// ✅ 改进实现（工具编排）
class PriorArtSearchAgent extends Agent {
  protected async execute(input: PriorArtSearchInput) {
    // 1. 使用专利搜索工具
    const patentSearch = new PatentSearchTool()
    const searchResults = await patentSearch.execute({
      keywords: input.searchOptions?.keywords,
      classification: input.searchOptions?.classification,
      limit: input.searchOptions?.limit || 10,
    })

    // 2. 使用专利详情工具获取详细信息
    const patentDetail = new PatentDetailTool()
    const detailedResults = await Promise.all(
      searchResults.map((result) => patentDetail.execute({ patentId: result.id }))
    )

    // 3. 使用相似度计算工具
    const similarityCalculator = new SimilarityCalculatorTool()
    const similarities = await similarityCalculator.execute({
      sourceClaims: input.claims,
      targetPatents: detailedResults,
    })

    // 4. 使用LLM生成分析报告
    const report = await this.llm.chat({
      messages: [
        {
          role: 'user',
          content: `基于以下检索结果生成先导技术分析报告：${JSON.stringify(similarities)}`,
        },
      ],
    })

    return { similarities, report }
  }
}
```

### 改进优先级

| Agent                          | 当前状态 | 改进紧急度 | 预期工作量 |
| ------------------------------ | -------- | ---------- | ---------- |
| UnityChecker                   | 纯LLM    | 🔴 高      | 2天        |
| ClaimsFormalityChecker         | 纯LLM    | 🔴 高      | 2天        |
| SpecFormalityChecker           | 纯LLM    | 🔴 高      | 2天        |
| SubjectMatterChecker           | 纯LLM    | 🟡 中      | 1天        |
| PriorArtSearchAgent            | 纯LLM    | 🟡 中      | 2天        |
| QualityCheckerAgent            | 纯LLM    | 🟢 低      | 1天        |
| ComparisonReportGeneratorAgent | 纯LLM    | 🟢 低      | 1天        |

---

## 📊 预期成果

### 工具去重后

| 指标     | 去重前 | 去重后 | 改善   |
| -------- | ------ | ------ | ------ |
| 工具总数 | 87+    | ~80    | -7     |
| 重复工具 | 2组    | 0组    | -100%  |
| 代码行数 | ~5000  | ~4800  | -200行 |

### Agent改进后

| 指标            | 改进前 | 改进后 | 目标 |
| --------------- | ------ | ------ | ---- |
| Agent工具使用率 | 0%     | 100%   | ≥80% |
| 工具复用率      | 0%     | 70%+   | ≥80% |
| 测试覆盖率      | 未统计 | ≥90%   | ≥90% |
| Agent编排复杂度 | 低     | 高     | -    |

---

## 🎯 实施计划

### Week 1: 工具去重

**Day 1-2**:

- [ ] 删除builtin-tools中的PatentSearchTool重复实现
- [ ] 合并权利要求生成工具
- [ ] 更新所有引用
- [ ] 运行测试验证

**Day 3-4**:

- [ ] 明确谷歌专利工具职责边界
- [ ] 更新API文档
- [ ] 编写迁移指南

**Day 5**:

- [ ] 代码审查
- [ ] 文档更新
- [ ] 发布新版本

### Week 2-3: Agent工具编排改进

**Week 2**:

- [ ] 重构UnityChecker（增加工具编排）
- [ ] 重构ClaimsFormalityChecker（增加工具编排）
- [ ] 重构SpecFormalityChecker（增加工具编排）
- [ ] 编写集成测试

**Week 3**:

- [ ] 重构其他4个Agent
- [ ] 验证工具复用率≥80%
- [ ] 性能测试和优化

### Week 4: 验证和文档

- [ ] 端到端测试
- [ ] 性能基准测试
- [ ] 编写最佳实践文档
- [ ] 团队培训

---

## 📋 成功标准

### 工具层

- ✅ 无重复工具
- ✅ 工具职责清晰
- ✅ API文档完整
- ✅ 测试覆盖率≥90%

### Agent层

- ✅ 所有Agent都使用工具编排
- ✅ 工具复用率≥80%
- ✅ Agent测试覆盖率≥90%
- ✅ 性能满足要求

### 架构层面

- ✅ 工具层与Agent层清晰分离
- ✅ 工具可独立测试和复用
- ✅ Agent专注于编排而非实现
- ✅ 架构文档完整

---

**文档版本**: v1.0
**下次更新**: 完成P0去重工作后
**责任人**: 开发团队
**审核者**: 架构师
