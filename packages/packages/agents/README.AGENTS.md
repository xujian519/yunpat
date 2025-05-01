# YunPat 通用智能体包

提供专业的专利分析和撰写智能体，支持发明理解、技术分析、质量检查和说明书撰写。

## 📦 包含的智能体

### 1. InventionUnderstandingAgent (发明理解智能体)

**完成度: 95%**

深入理解技术交底书，提取结构化发明信息。

#### 功能特性

- ✅ 多轮对话支持，通过追问提高理解准确度
- ✅ 详细的置信度计算，标识不确定的部分
- ✅ 知识图谱增强，提供领域专业知识
- ✅ 完善的错误处理和回退机制
- ✅ 支持澄清问题生成

#### 使用示例

```typescript
import { InventionUnderstandingAgent } from '@yunpat/agent-invention'

const agent = new InventionUnderstandingAgent({
  name: 'invention-understanding',
  description: '发明理解智能体',
  llm: yourLLMAdapter,
  eventBus: eventBus,
  memory: memory,
  tools: tools,
})

// 基础使用
const result = await agent.execute({
  title: '一种高效机器学习训练方法',
  field: '人工智能',
  technicalDisclosure: `
    本发明涉及一种高效机器学习训练方法，包括：
    1. 构建分布式训练架构
    2. 实现动态批处理算法
    3. 采用自适应学习率调整
  `,
  drawings: ['图1: 系统架构', '图2: 训练流程'],
})

// 多轮对话模式
const resultWithDialogue = await agent.execute({
  title: '一种高效机器学习训练方法',
  field: '人工智能',
  technicalDisclosure: disclosure,
  enableMultiRound: true,
  maxRounds: 3,
  confidenceThreshold: 0.8,
})

console.log(result.technicalField)
console.log(result.confidence) // 总体置信度
console.log(result.confidenceDetails) // 各维度置信度
console.log(result.clarificationQuestions) // 需要澄清的问题
```

---

### 2. PatentTechnicalAnalyzerAgent (专利技术分析智能体)

**完成度: 95%**

深度分析专利技术问题、方案和效果，与对比发明进行对比。

#### 功能特性

- ✅ 多级分析深度（基础/深入/专家级）
- ✅ 特征分类（必要/重要/可选）
- ✅ 技术效果量化（指标、改进幅度）
- ✅ 新颖性和创造性评估
- ✅ 知识图谱增强

#### 使用示例

```typescript
import { PatentTechnicalAnalyzerAgent } from '@yunpat/agent-analysis'

const agent = new PatentTechnicalAnalyzerAgent({
  name: 'patent-analyzer',
  description: '专利技术分析智能体',
  llm: yourLLMAdapter,
  eventBus: eventBus,
  memory: memory,
  tools: tools,
})

// 对比分析
const result = await agent.execute({
  patent: {
    publicationNumber: 'CN123456789A',
    title: '测试专利',
    abstract: '专利摘要...',
  },
  inventionUnderstanding: {
    technicalProblem: '如何提高测试效率',
    technicalSolution: '采用新算法',
    keyFeatures: ['特征1', '特征2'],
  },
  analysisDepth: 3, // 专家级分析
  enableKnowledgeEnhancement: true,
})

console.log(result.comparison.similarity) // 相似度
console.log(result.comparison.novelty.hasNovelty) // 是否具有新颖性
```

---

### 3. QualityCheckerAgent (质量检查智能体)

**完成度: 95%**

基于规则库进行专利质量检查，提供多维度评分和改进建议。

#### 功能特性

- ✅ 完整的规则库（权利要求、说明书、语言、法律）
- ✅ 可配置的检查级别（1-3级）
- ✅ 自动修复建议
- ✅ 多维度质量评分
- ✅ 对比分析和排名

#### 使用示例

```typescript
import { QualityCheckerAgent } from '@yunpat/agent-quality-checker'

const agent = new QualityCheckerAgent({
  name: 'quality-checker',
  description: '质量检查智能体',
  llm: yourLLMAdapter,
  eventBus: eventBus,
  memory: memory,
  tools: tools
})

// 高级检查（启用自动修复）
const result = await agent.execute({
  claims: [...],
  specification: {...},
  patentType: 'invention',
  inventionTitle: '测试装置',
  checkLevel: 3, // 最严格检查
  enableAutoFix: true
})

console.log(result.qualityLevel) // excellent | good | fair | poor
console.log(result.issues) // 问题列表
console.log(result.fixOperations) // 自动修复操作
```

#### 质量检查规则

| 规则ID    | 名称             | 类别     | 严重程度 |
| --------- | ---------------- | -------- | -------- |
| CLAIM_001 | 独立权利要求前置 | 权利要求 | critical |
| CLAIM_002 | 从属权利要求引用 | 权利要求 | high     |
| CLAIM_003 | 权利要求长度     | 权利要求 | medium   |
| SPEC_001  | 技术领域完整性   | 说明书   | high     |
| SPEC_005  | 权利要求支持性   | 说明书   | high     |
| LANG_003  | 模糊表达检查     | 语言表达 | medium   |
| LEGAL_001 | 单一性检查       | 法律要求 | high     |

---

### 4. SpecificationDrafterAgent (说明书撰写智能体)

**完成度: 95%**

基于发明理解撰写完整的专利说明书。

#### 功能特性

- ✅ 完整的5章节撰写
- ✅ 智能实施例生成
- ✅ 附图说明和要素标注
- ✅ 多种撰写模式（标准/详细/简洁）
- ✅ 完整的质量检查指标

#### 使用示例

```typescript
import { SpecificationDrafterAgent } from '@yunpat/agent-specification-drafter'

const agent = new SpecificationDrafterAgent({
  name: 'spec-drafter',
  description: '说明书撰写智能体',
  llm: yourLLMAdapter,
  eventBus: eventBus,
  memory: memory,
  tools: tools,
})

const result = await agent.execute({
  inventionUnderstanding: inventionResult,
  claimsSet: claimsSet,
  drawings: ['图1: 系统架构', '图2: 控制流程'],
  draftMode: 'detailed', // standard | detailed | concise
  patentType: 'invention',
})

console.log(result.specification.embodiments.embodiment_list)
console.log(result.qualityScore.overall)
```

---

## 📊 完成度对比

| 智能体                       | 完成前 | 完成后 | 主要改进                       |
| ---------------------------- | ------ | ------ | ------------------------------ |
| InventionUnderstandingAgent  | 60%    | 95%    | 多轮对话、置信度详情、错误处理 |
| PatentTechnicalAnalyzerAgent | 60%    | 95%    | 深度分析、特征分类、效果量化   |
| QualityCheckerAgent          | 40%    | 95%    | 规则库、自动修复、多维度评分   |
| SpecificationDrafterAgent    | 40%    | 95%    | 实施例生成、附图标注、质量检查 |

---

## 🧪 测试

所有智能体都有完整的单元测试，测试覆盖率 > 80%。

```bash
# 运行所有测试
npm test

# 运行特定智能体的测试
npm test InventionUnderstandingAgent
npm test PatentTechnicalAnalyzerAgent
npm test QualityCheckerAgent
npm test SpecificationDrafterAgent

# 查看测试覆盖率
npm run test:coverage
```

---

## 🔧 配置

### LLM 配置

```typescript
import { OpenAI } from '@yunpat/llm'

const llm = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4',
  temperature: 0.3,
})
```

### 事件总线配置

```typescript
import { EventBus } from '@yunpat/core'

const eventBus = new EventBus()
```

---

## 📚 相关文档

- [@yunpat/core](../core/README.md) - 核心框架文档
- [@yunpat/llm](../llm/README.md) - LLM 适配器文档

---

## 📄 许可证

MIT
