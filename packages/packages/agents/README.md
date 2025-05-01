# YunPat 专利智能体集合

专业的专利全生命周期智能体，提供从撰写到管理的完整解决方案。

包含 29 个智能体子包，按功能分类组织。

## 目录结构说明

本目录采用扁平结构而非嵌套分类，原因如下：

1. **依赖管理简化** -- pnpm workspace 对扁平结构支持更好
2. **导入路径稳定** -- 避免因重组导致的 import 路径变化
3. **包名清晰** -- 每个包有明确的命名（如 `patent-writer`）
4. **易于维护** -- 新增包时不需要考虑嵌套层级

物理结构是扁平的，通过分类索引组织逻辑视图。

---

## 智能体分类索引

### 基础框架 (Base Framework)

| 包名    | 描述                 |
| ------- | -------------------- |
| `base/` | Agent 基类和核心抽象 |
| `test/` | 测试工具和辅助类     |

### 写作相关 (Writing)

| 包名                      | 描述           |
| ------------------------- | -------------- |
| `writer/`                 | 通用写作助手   |
| `specification/`          | 规格说明书生成 |
| `specification-drafter/`  | 规格草稿生成   |
| `abstract-drafter/`       | 摘要草稿生成   |
| `spec-formality-checker/` | 规格形式检查   |

### 分析相关 (Analysis)

| 包名                      | 描述           |
| ------------------------- | -------------- |
| `analysis/`               | 通用分析智能体 |
| `patent-analyzer/`        | 专利分析智能体 |
| `subject-matter-checker/` | 主题检查器     |

### 检索相关 (Search)

| 包名                | 描述           |
| ------------------- | -------------- |
| `search/`           | 通用搜索智能体 |
| `prior-art-search/` | 先例检索       |
| `researcher/`       | 研究分析师     |

### 质量相关 (Quality)

| 包名               | 描述         |
| ------------------ | ------------ |
| `quality/`         | 通用质量评估 |
| `quality-checker/` | 质量检查器   |
| `unity-checker/`   | 一致性检查器 |

### 发明相关 (Invention)

| 包名               | 描述           |
| ------------------ | -------------- |
| `invention/`       | 发明构思智能体 |
| `claims/`          | 权利要求生成   |
| `claim-generator/` | 权利要求生成器 |

### 专利专用 (Patent-Specific)

| 包名                | 描述           |
| ------------------- | -------------- |
| `patent-writer/`    | 专利撰写智能体 |
| `patent-responder/` | 审查答复智能体 |
| `patent-manager/`   | 专利管理智能体 |

### 格式相关 (Format)

| 包名                        | 描述             |
| --------------------------- | ---------------- |
| `format-converter/`         | 格式转换器       |
| `claims-formality-checker/` | 权利要求形式检查 |

### 对比相关 (Comparison)

| 包名                           | 描述         |
| ------------------------------ | ------------ |
| `comparison-report-generator/` | 对比报告生成 |

### 图像相关 (Image)

| 包名                   | 描述         |
| ---------------------- | ------------ |
| `image-understanding/` | 图像理解     |
| `technical-drawing/`   | 技术图纸理解 |

### 测试相关 (Test)

| 包名                 | 描述     |
| -------------------- | -------- |
| `test/`              | 测试工具 |
| `integration-tests/` | 集成测试 |
| `examples/`          | 示例代码 |

---

## 核心智能体详解

### PatentWriterAgent -- 专利撰写智能体

专业的专利申请文件撰写智能体，支持从技术交底书自动生成完整的专利申请文件。

功能特性：

- 自动生成权利要求书、说明书、摘要
- 支持 CN、PCT、US 三种格式导出
- 集成知识库和提示词模板（懒加载）
- 内置质量检查机制
- 提供撰写 metrics（权利要求数、字数、质量评分）

```typescript
import { PatentWriterAgent } from '@yunpat/agent-patent-writer'

const agent = new PatentWriterAgent({
  name: 'patent-writer',
  description: '专利撰写智能体',
  eventBus,
  memory,
  tools,
  llm: openaiLLM,
  enableKnowledge: true,
  enableTemplates: true,
})

const result = await agent.execute({
  title: '一种基于深度学习的图像识别方法',
  field: '人工智能',
  applicant: '测试科技有限公司',
  inventors: ['张三', '李四'],
  technicalDisclosure: '...',
  drawings: ['图1: 系统架构图'],
})
```

### PatentAnalyzerAgent -- 专利分析智能体

专业的专利文献分析智能体，提供多维度专利分析报告。

功能特性：

- 技术方案深度分析（技术领域、问题、方案、效果、关键特征）
- 权利要求分析（独立/从属权利要求、保护范围、质量评分）
- 现有技术对比（相似度分析、创新点识别）
- 创造性评估（创造性等级、评分、评估理由）
- 专利性风险评估（无效风险、侵权风险、风险因素）

### PatentResponderAgent -- OA 答复智能体

专业的审查意见答复智能体，提供智能化的答复策略和文档生成。

功能特性：

- 审查意见智能分析（关键问题识别、严重程度评估）
- 答复策略生成（argue/amend/abandon/appeal）
- 成功概率评估
- 修改建议生成
- 多格式导出（CN/PCT/US）

### PatentManagerAgent -- 专利管理智能体

专利全生命周期管理智能体。

功能特性：

- 专利申请管理（增删改查）
- 截止日期管理（添加、查询、提醒）
- 费用管理（添加、查询、状态跟踪）
- 专利组合概览（统计分析、风险预警）
- 管理报告生成

---

## 测试

```bash
# 运行单个智能体测试
cd packages/agents/patent-writer && pnpm test
cd packages/agents/patent-analyzer && pnpm test
cd packages/agents/patent-responder && pnpm test
cd packages/agents/patent-manager && pnpm test

# 运行集成测试
cd packages/agents/test && npx vitest run
```

---

## 配置

### LLM 配置

```typescript
import { NativeLLMAdapter } from '@yunpat/core'

const llm = new NativeLLMAdapter({
  apiKey: process.env.DEEPSEEK_API_KEY,
  model: 'deepseek-chat',
})
```

### 事件总线

```typescript
import { EventBus } from '@yunpat/core'
const eventBus = new EventBus()
```

### 记忆存储

```typescript
import { ShortTermMemory } from '@yunpat/core'
const memory = new ShortTermMemory()
```

---

## 工作流集成

完整的专利处理流程：

```typescript
// 1. 撰写专利
const writeResult = await writerAgent.execute(disclosure)

// 2. 分析专利
const analysisResult = await analyzerAgent.execute({
  patent: { publicationNumber, title, abstract },
})

// 3. 管理专利
await managerAgent.execute({
  operation: 'add_patent',
  patent: { applicationNumber, title, status: 'filed' },
})

// 4. OA 答复（如果需要）
const responseResult = await responderAgent.execute({
  officeAction: oaData,
  originalApplication: applicationData,
})
```

---

## 相关文档

- [@yunpat/core](../core/README.md) -- 核心框架文档
- [@yunpat/orchestrator](../orchestrator/README.md) -- 中枢调度文档

## 许可证

MIT

---

最后更新: 2026-05-06
