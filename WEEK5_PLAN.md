# Week 5 开发计划 - 高级Agent实现

## 开发时间

- 开始日期: 2025-05-05
- 预计完成: 2025-05-11

## 目标

实现三个高级Agent，扩展系统的专利检索、质量评估和对比分析能力。

## Week 5任务分解

### 任务1: PriorArtSearchAgent（专利检索Agent）

**优先级**: 🔴 高
**预计耗时**: 2天

**功能需求**:

1. 专利检索功能
   - 使用Google Patents API
   - 支持关键词检索
   - 支持分类号检索
   - 支持申请人/发明人检索

2. 检索结果分析
   - 相关性评分
   - 引用关系分析
   - 法律状态查询
   - 同族专利识别

3. 现有技术报告
   - 检索策略记录
   - 相关专利列表
   - 技术领域分布
   - 时间趋势分析

**输入**:

```typescript
interface PriorArtSearchInput {
  claims: Claim[]
  patentType: 'invention' | 'utilityModel' | 'design'
  inventionTitle: string
  specification?: Specification
  searchOptions?: {
    keywords?: string[]
    classification?: string[]
    dateRange?: { start: Date; end: Date }
    applicant?: string
    limit?: number
  }
}
```

**输出**:

```typescript
interface PriorArtSearchResult {
  searchReport: {
    searchStrategy: string[]
    database: string
    queryCount: number
    resultCount: number
  }
  relevantPatents: Array<{
    patentId: string
    title: string
    abstract: string
    relevanceScore: number
    publicationDate: Date
    applicants: string[]
    classifications: string[]
    citationCount: number
    legalStatus: string
    familyMembers: string[]
  }>
  analysis: {
    technologyField: string
    timeDistribution: { year: number; count: number }[]
    topApplicants: { name: string; count: number }[]
    citationNetwork: { source: string; target: string }[]
    noveltyAssessment: {
      score: number
      distinguishingFeatures: string[]
      closestPriorArt: string[]
    }
  }
  overallReport: {
    passed: boolean
    totalIssues: number
    recommendations: string[]
  }
}
```

**技术实现要点**:

- 使用@yunpat/patent-tools中的GooglePatentsTool
- 实现TF-IDF相关性计算
- 构建引用关系图
- 生成新颖性评估

---

### 任务2: QualityCheckerAgent（质量检查Agent）

**优先级**: 🟡 中
**预计耗时**: 2天

**功能需求**:

1. 完整性检查
   - 必要字段完整性
   - 文档格式规范性
   - 附件完整性

2. 质量评分
   - 权利要求质量
   - 说明书质量
   - 语言表达质量
   - 技术披露充分性

3. 改进建议
   - 权利要求优化建议
   - 说明书完善建议
   - 附图改进建议

**输入**:

```typescript
interface QualityCheckInput {
  claims: Claim[]
  specification: Specification
  patentType: 'invention' | 'utilityModel' | 'design'
  inventionTitle: string
  drawings?: Drawing[]
}
```

**输出**:

```typescript
interface QualityCheckResult {
  completenessScore: number // 0-100
  qualityScores: {
    claims: {
      clarity: number
      support: number
      breadth: number
      overall: number
    }
    specification: {
      clarity: number
      sufficiency: number
      consistency: number
      overall: number
    }
    language: {
      grammar: number
      terminology: number
      overall: number
    }
  }
  overallQuality: number // 0-100
  issues: Array<{
    category: string
    severity: 'high' | 'medium' | 'low'
    description: string
    suggestion: string
  }>
  recommendations: Array<{
    area: string
    current: string
    suggested: string
    rationale: string
  }>
  comparison: {
    averageQuality: number
    percentile: number
    ranking: string
  }
}
```

**技术实现要点**:

- 多维度质量评估算法
- 基于规则和启发式的检查
- 文本相似度计算
- 统计分析

---

### 任务3: ComparisonReportGeneratorAgent（对比报告生成Agent）

**优先级**: 🟢 中低
**预计耗时**: 1天

**功能需求**:

1. 对比分析
   - 本申请vs现有技术
   - 技术特征对比
   - 效果对比
   - 优势分析

2. 差异识别
   - 结构差异
   - 功能差异
   - 效果差异

3. 报告生成
   - 对比表格
   - 技术方案图
   - 差异总结
   - 创新点提炼

**输入**:

```typescript
interface ComparisonReportInput {
  application: {
    claims: Claim[]
    specification: Specification
    inventionTitle: string
  }
  priorArt: Array<{
    patentId: string
    title: string
    abstract: string
    claims: string[]
    description: string
  }>
  options?: {
    format: 'markdown' | 'html' | 'pdf'
    includeTables: boolean
    includeDiagrams: boolean
    language: 'zh-CN' | 'en-US'
  }
}
```

**输出**:

```typescript
interface ComparisonReportResult {
  report: {
    title: string
    summary: string
    sections: Array<{
      heading: string
      content: string
      tables?: Array<{
        headers: string[]
        rows: string[][]
      }>
      diagrams?: Array<{
        type: 'flowchart' | 'structure' | 'network'
        content: string
      }>
    }>
    conclusions: string[]
    recommendations: string[]
  }
  analysis: {
    technicalDifferences: string[]
    advantages: string[]
    disadvantages: string[]
    novelty: string
    inventiveStep: string
  }
  metadata: {
    generatedAt: Date
    format: string
    version: string
  }
}
```

**技术实现要点**:

- 使用LLM生成对比文本
- 表格生成
- Markdown/HTML格式化
- 差异高亮显示

---

## 技术架构

### Agent继承结构

```
BaseAgent (core)
  ↓
PriorArtSearchAgent
  - 使用GooglePatentsTool
  - 实现相关性算法
  - 构建引用网络

QualityCheckerAgent
  - 多维度评分算法
  - 启发式规则引擎
  - 统计分析模块

ComparisonReportGeneratorAgent
  - 文本生成引擎
  - 表格生成器
  - 格式化器
```

### 依赖关系

```
PriorArtSearchAgent
  ├─ @yunpat/patent-tools (GooglePatentsTool)
  ├─ @yunpat/core (Agent, Tool)
  └─ @yunpat/patent-core (Patent类型)

QualityCheckerAgent
  ├─ @yunpat/core (Agent)
  ├─ @yunpat/claims-formality-checker (复用检查逻辑)
  └─ @yunpat/spec-formality-checker (复用检查逻辑)

ComparisonReportGeneratorAgent
  ├─ @yunpat/core (Agent, LLMAdapter)
  ├─ @yunpat/patent-core (Patent类型)
  └─ PriorArtSearchAgent (检索结果)
```

### 数据流

```
用户输入
  ↓
PriorArtSearchAgent → 检索现有技术
  ↓
QualityCheckerAgent → 评估申请质量
  ↓
ComparisonReportGeneratorAgent → 生成对比报告
  ↓
输出报告
```

---

## 开发顺序

### Day 1-2: PriorArtSearchAgent

1. 创建包结构
2. 实现检索功能
3. 实现相关性算法
4. 编写单元测试（≥90%覆盖率）
5. 集成测试

### Day 3-4: QualityCheckerAgent

1. 创建包结构
2. 实现完整性检查
3. 实现质量评分算法
4. 编写单元测试（≥90%覆盖率）
5. 集成测试

### Day 5: ComparisonReportGeneratorAgent

1. 创建包结构
2. 实现对比分析
3. 实现报告生成
4. 编写单元测试（≥90%覆盖率）
5. 集成测试

### Day 6-7: 集成与优化

1. Agent间协作测试
2. 性能优化
3. 文档完善
4. 生成Week 5总结

---

## 测试策略

### 单元测试

- 每个Agent ≥90%覆盖率
- 测试主要算法逻辑
- Mock外部依赖（API调用）

### 集成测试

- Agent间协作
- 端到端流程
- 真实API调用（使用测试环境）

### 性能测试

- 检索响应时间 <5s
- 质量评分 <1s
- 报告生成 <3s

---

## 成功标准

1. **功能完整性**
   - ✅ PriorArtSearchAgent可检索并分析专利
   - ✅ QualityCheckerAgent可评估申请质量
   - ✅ ComparisonReportGeneratorAgent可生成对比报告

2. **测试覆盖**
   - ✅ 单元测试 ≥90%
   - ✅ 集成测试通过
   - ✅ 性能测试达标

3. **代码质量**
   - ✅ TypeScript类型完整
   - ✅ 代码注释清晰
   - ✅ 遵循项目规范

4. **文档完整性**
   - ✅ README文档
   - ✅ API文档
   - ✅ 使用示例

---

## 风险与缓解

### 风险1: Google Patents API限制

**缓解**: 实现请求限流和缓存机制

### 风险2: 相关性算法准确性

**缓解**: 结合多种算法（TF-IDF、语义相似度）

### 风险3: 报告生成质量

**缓解**: 使用高质量LLM，提供prompt模板

---

**计划制定时间**: 2025-05-04
**计划执行周期**: Week 5 (2025-05-05 至 2025-05-11)
**下一步**: 开始实现PriorArtSearchAgent
