# YunPat 专利智能体使用示例

本目录包含 YunPat 四个核心专利智能体的使用示例。

## 📋 智能体列表

### 1. PatentWriterAgent - 专利撰写智能体

**功能**：自动撰写专利申请文件

**输入**：

- 发明名称
- 技术领域
- 申请人
- 发明人
- 技术交底书
- 附图列表

**输出**：

- 权利要求书
- 说明书
- 摘要
- 附图说明

**示例**：

```typescript
const writer = new PatentWriterAgent({
  llm: createDeepSeekModel(process.env.DEEPSEEK_API_KEY),
})

const output = await writer.execute({
  title: '一种基于深度学习的图像识别方法',
  field: '计算机视觉',
  applicant: '某某科技公司',
  inventors: ['张三', '李四'],
  technicalDisclosure: '...',
  drawings: ['图1', '图2'],
})

console.log(`撰写完成！权利要求 ${output.metrics.claimsCount} 项`)
```

---

### 2. PatentResponderAgent - 审查答复智能体

**功能**：智能答复专利审查意见

**输入**：

- 申请号
- 专利名称
- 审查意见通知书
- 对比文件列表
- 权利要求书
- 说明书

**输出**：

- 答复策略
- 意见陈述书
- 修改后的权利要求
- 修改对照页

**示例**：

```typescript
const responder = new PatentResponderAgent({
  llm: createDeepSeekModel(process.env.DEEPSEEK_API_KEY),
})

const output = await responder.execute({
  applicationNumber: 'CN202310123456.7',
  patentTitle: '一种基于深度学习的图像识别方法',
  officeAction: '审查意见内容...',
  priorArt: ['CN110123456A', 'US9876543B2'],
  claims: ['权利要求1...', '权利要求2...'],
  description: '说明书内容...',
})

console.log(`授权成功率预测: ${output.metrics.allowanceProbability}%`)
```

---

### 3. PatentAnalyzerAgent - 专利分析智能体

**功能**：专利价值分析、技术趋势分析、竞品分析

**分析类型**：

#### 3.1 专利价值分析

```typescript
const output = await analyzer.execute({
  analysisType: 'value',
  targetPatents: ['CN123456789A', 'US9876543B2'],
  technicalField: '人工智能',
})

console.log('高价值专利:', output.results.valueAssessment.highValuePatents)
```

#### 3.2 技术趋势分析

```typescript
const output = await analyzer.execute({
  analysisType: 'trend',
  technicalField: '人工智能',
  timeRange: {
    start: '2020-01-01',
    end: '2026-04-28',
  },
})

console.log('技术发展阶段:', output.results.trendAnalysis.stage)
```

#### 3.3 竞品分析

```typescript
const output = await analyzer.execute({
  analysisType: 'competitor',
  technicalField: '人工智能',
  competitors: ['腾讯', '阿里巴巴', '百度'],
})

console.log('竞争对手排名:', output.results.competitorAnalysis.rankings)
```

#### 3.4 专利地图分析

```typescript
const output = await analyzer.execute({
  analysisType: 'landscape',
  technicalField: '人工智能',
  parameters: {
    keywords: ['深度学习', '图像识别'],
  },
})

console.log('技术聚类:', output.results.patentLandscape.clusters)
```

---

### 4. PatentManagerAgent - 专利管理智能体

**功能**：专利全生命周期管理

**管理类型**：

#### 4.1 期限管理

```typescript
const output = await manager.execute({
  managementType: 'deadline',
  targetPatents: ['CN123456789A', 'US9876543B2'],
})

console.log('即将到期:', output.results.deadlineManagement.upcomingDeadlines)
```

#### 4.2 流程管理

```typescript
const output = await manager.execute({
  managementType: 'workflow',
})

console.log('待处理任务:', output.results.workflowManagement.pendingTasks)
```

#### 4.3 费用管理

```typescript
const output = await manager.execute({
  managementType: 'cost',
})

console.log('费用统计:', output.results.costManagement.statistics)
```

#### 4.4 专利组合管理

```typescript
const output = await manager.execute({
  managementType: 'portfolio',
  filters: {
    clients: ['某某科技公司'],
  },
})

console.log('专利组合概览:', output.results.portfolioManagement.overview)
```

---

## 🚀 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

创建 `.env` 文件：

```bash
# DeepSeek API Key（推荐）
DEEPSEEK_API_KEY=sk-...

# 或使用其他模型
# DASHSCOPE_API_KEY=sk-...  # 通义千问
```

### 3. 运行示例

```bash
# 编译 TypeScript
pnpm build

# 运行所有示例
node examples/patent-agents-usage.js

# 或使用 ts-node
npx ts-node examples/patent-agents-usage.ts
```

---

## 📊 输出示例

### 专利撰写输出

```
=== 示例 1: 专利撰写 ===

撰写完成！
权利要求数量: 5
说明书字数: 3245
质量评分: 85
撰写耗时: 3 分钟
```

### 审查答复输出

```
=== 示例 2: 审查意见答复 ===

答复完成！
答复策略: combination
核心论点数量: 3
修改权利要求数量: 3
授权成功率预测: 75%
答复质量评分: 82
```

### 专利分析输出

```
=== 示例 3: 专利价值分析 ===

分析完成！
分析专利数量: 3
数据覆盖率: 85%
可信度: 75%
分析耗时: 2 分钟

高价值专利:
  - CN123456789A: 92分
    * 技术创新性高
    * 市场需求强
    * 法律稳定性好
```

---

## 🔧 高级用法

### 自定义 LLM 模型

```typescript
import { createDeepSeekModel, createQwenModel, createOllamaModel } from '@yunpat/core'

// 使用 DeepSeek（推荐）
const llm = createDeepSeekModel(process.env.DEEPSEEK_API_KEY)

// 使用通义千问
const llm = createQwenModel(process.env.DASHSCOPE_API_KEY)

// 使用本地 Ollama
const llm = createOllamaModel('http://localhost:11434', 'deepseek-chat')
```

### 智能体协作

```typescript
// 1. 先用分析智能体评估专利价值
const analyzer = new PatentAnalyzerAgent({ llm })
const analysis = await analyzer.execute({
  analysisType: 'value',
  targetPatents: ['CN123456789A'],
})

// 2. 根据分析结果决定是否撰写答复
if (analysis.results.valueAssessment.highValuePatents.length > 0) {
  const responder = new PatentResponderAgent({ llm })
  await responder.execute({
    applicationNumber: 'CN202310123456.7',
    // ...
  })
}
```

### 批量处理

```typescript
const patents = ['CN123456789A', 'CN987654321A', 'CN555555555A']

const writer = new PatentWriterAgent({ llm })

for (const patentNumber of patents) {
  const input = await loadPatentInput(patentNumber)
  const output = await writer.execute(input)
  console.log(`${patentNumber}: 撰写完成`)
}
```

---

## 📝 注意事项

### 1. API Key 安全

**不要**将 API Key 提交到代码仓库：

- 使用 `.env` 文件（已加入 `.gitignore`）
- 或使用环境变量

### 2. Token 消耗

专利撰写和分析任务消耗较多 tokens：

- 专利撰写：约 5,000-10,000 tokens
- 审查答复：约 3,000-8,000 tokens
- 专利分析：约 2,000-5,000 tokens

建议使用 DeepSeek（¥0.001/1k tokens）以降低成本。

### 3. 响应时间

智能体执行时间（使用 DeepSeek）：

- 专利撰写：3-5 分钟
- 审查答复：2-4 分钟
- 专利分析：1-3 分钟
- 专利管理：1-2 分钟

### 4. 输出质量

智能体输出质量取决于：

- 输入信息的完整性和准确性
- LLM 模型的选择
- Prompt 的优化

建议：

- 提供详细的技术交底书
- 选择适合的模型（DeepSeek 用于中文，通义千问用于分析）
- 根据反馈不断优化 Prompt

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

## 📄 许可证

MIT License

---

**© 2026 YunPat - 智能专利助手，赋能创新保护**
