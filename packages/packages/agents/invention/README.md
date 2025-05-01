# InventionUnderstandingAgent 使用指南

## 概述

`InventionUnderstandingAgent` 是一个完整的发明理解智能体，能够从技术交底书中提取**多组问题-特征-效果三元组**，并利用知识库进行增强。

## 核心特性

### 1. 多阶段知识检索

```typescript
阶段 1: 方法论检索
  ├─ 技术问题提取方法
  ├─ 技术特征提取方法
  ├─ 技术效果提取方法
  └─ 三步法框架

阶段 2: 术语标准化检索
  └─ 领域特定术语映射

阶段 3: 领域特定知识检索
  ├─ 撰写指南
  ├─ 类似案例
  └─ 常见错误

阶段 4: 验证规则检索
  └─ 一致性检查规则
```

### 2. 多组三元组提取

```typescript
输出格式：
{
  inventionConcepts: [
    {
      technicalProblem: "阀片密封性差",
      keyFeatures: ["采用陶瓷材料", "表面精度0.01mm"],
      technicalEffects: ["密封性提高50%", "寿命延长3倍"],
      confidence: 0.9
    },
    {
      technicalProblem: "阀杆易磨损",
      keyFeatures: ["镀铬处理", "自润滑结构"],
      technicalEffects: ["耐磨性提高60%"],
      confidence: 0.85
    }
    // ... 更多三元组
  ]
}
```

### 3. 术语标准化

```typescript
自动转换：
"用陶瓷做" → "采用陶瓷材料"
"连接在一起" → "固定连接"
"设置密封件" → "配置密封件"
```

### 4. 一致性验证

```typescript
验证项：
✓ 每个技术特征对应至少一个技术效果
✓ 技术问题不包含解决手段
✓ 技术效果与现有技术有明确对比
✓ 技术特征具体（不是"改进设计"）
```

## 使用示例

### 基础使用

```typescript
import { InventionUnderstandingAgent } from '@yunpat/agents/invention'
import { EventBus } from '@yunpat/core'
import { DeepSeekLLM } from '@yunpat/core'

// 创建 Agent
const agent = new InventionUnderstandingAgent({
  name: 'invention-understanding',
  description: '发明理解智能体',
  eventBus: new EventBus(),
  memory: {},
  tools: {},
  llm: new DeepSeekLLM({ apiKey: 'your-api-key' }),
  enableKnowledgeGraph: true, // 启用知识库
})

// 准备输入
const input = {
  title: '一种陶瓷阀片组件',
  field: '机械工程',
  technicalDisclosure: `
本发明涉及一种阀门组件，特别是陶瓷阀片组件。

现有技术：
传统的金属阀片在高温高压环境下容易磨损，密封性差，寿命短。

发明内容：
本发明采用陶瓷材料制造阀片，表面精度达到0.01mm，
通过特殊的烧结工艺，提高了阀片的硬度和耐磨性。

技术效果：
与现有技术相比，密封性提高50%，使用寿命延长3倍。
  `,
  priorArt: ['专利文献1：金属阀片的制造方法', '专利文献2：阀门密封结构'],
  drawings: ['图1: 陶瓷阀片结构示意图', '图2: 阀门组件装配图'],
}

// 执行分析
const result = await agent.execute(input)

// 输出结果
console.log('发明构思:', result.inventionConcepts)
console.log('技术领域:', result.technicalField)
console.log('置信度:', result.confidence)
console.log('验证结果:', result.validation)
```

### 高级使用（自定义配置）

```typescript
const agent = new InventionUnderstandingAgent({
  name: 'custom-invention-understanding',
  description: '自定义发明理解智能体',

  // 自定义配置
  enableKnowledgeGraph: true,

  // 自定义事件处理
  eventBus: customEventBus,

  // 自定义工具
  tools: {
    'search-patent': patentSearchTool,
    'analyze-prior-art': priorArtAnalyzer,
  },
})

// 带有现有技术分析的输入
const inputWithPriorArt = {
  title: '基于深度学习的图像识别方法',
  field: '人工智能',
  technicalDisclosure: '...',

  // 由检索工具提供的现有技术
  priorArt: [
    'CN123456789A: 传统CNN图像识别方法',
    'US987654321B2: 卷积神经网络优化技术',
    '学术论文: Deep Learning for Image Recognition (2020)',
  ],

  drawings: ['图1: 网络架构图', '图2: 训练流程图'],
}
```

## 输入参数说明

### InventionUnderstandingInput

```typescript
interface InventionUnderstandingInput {
  /** 发明名称（必需） */
  title: string

  /** 技术领域（必需） */
  field: string

  /** 技术交底书内容（必需） */
  technicalDisclosure: string

  /** 现有技术（可选，由检索工具提供） */
  priorArt?: string[]

  /** 附图列表（可选） */
  drawings?: string[]

  /** 申请人（可选） */
  applicant?: string

  /** 发明人列表（可选） */
  inventors?: string[]
}
```

## 输出结果说明

### InventionUnderstandingOutput

```typescript
interface InventionUnderstandingOutput {
  /** 多组问题-特征-效果三元组 */
  inventionConcepts: Triplet[]

  /** 技术领域（标准化） */
  technicalField: string

  /** 背景技术（基于现有技术整理） */
  backgroundArt: string

  /** 实施方式提炼 */
  embodimentSummary: string

  /** 附图说明 */
  drawingDescriptions: string[]

  /** 总体置信度 */
  confidence: number

  /** 验证结果 */
  validation?: ValidationResult
}

interface Triplet {
  /** 技术问题 */
  technicalProblem: string

  /** 技术特征 */
  keyFeatures: string[]

  /** 技术效果 */
  technicalEffects: string[]

  /** 置信度 */
  confidence: number
}

interface ValidationResult {
  /** 是否通过验证 */
  passed: boolean

  /** 错误列表 */
  errors: string[]

  /** 警告列表 */
  warnings: string[]

  /** 信息列表 */
  info: string[]
}
```

## 知识库集成

### 支持的知识库类型

1. **方法论知识** - 如何提取发明构思
2. **术语标准** - 领域特定术语映射
3. **领域知识** - 撰写指南、案例、常见错误
4. **验证规则** - 一致性检查规则

### 知识库检索策略

```typescript
// 自动检索流程
1. 预检索 → 确定技术领域
2. 方法论检索 → 获取提取方法
3. 术语检索 → 获取术语标准
4. 领域检索 → 获取领域知识
5. 验证检索 → 获取验证规则

// 降级策略
检索失败 → 简化查询 → 通用查询 → 硬编码方法论
```

## 错误处理

### 常见错误及解决方案

```typescript
// 1. 输入验证错误
try {
  await agent.execute(invalidInput)
} catch (error) {
  if (error.message.includes('发明名称不能为空')) {
    // 处理缺少发明名称
  }
}

// 2. LLM 调用失败
// Agent 会自动重试（最多2次）
// 如果仍然失败，返回回退输出

// 3. 知识库检索失败
// 自动使用降级策略
// 最终使用硬编码方法论
```

## 性能优化

### 缓存机制

```typescript
// 两级缓存
L1: 内存缓存（会话级）
L2: 文件缓存（持久化）

// 缓存键格式
"methodology:general:技术问题提取"
"terminology:机械工程:"
"domain:化学:"

// 缓存失效
TTL: 1小时
手动清除: agent.clearCache()
```

## 测试

```bash
# 运行单元测试
npm test -- InventionUnderstandingAgent

# 运行集成测试
npm test -- integration

# 查看测试覆盖率
npm run test:coverage
```

## 最佳实践

### 1. 提供高质量的现有技术

```typescript
// ✅ 好的做法
const priorArt = [
  '具体专利文献（包含公开号）',
  '技术论文（包含作者、年份）',
  '技术标准（包含标准号）',
]

// ❌ 差的做法
const priorArt = ['我知道的类似技术', '大概有这种东西']
```

### 2. 技术交底书要详细

```typescript
// ✅ 好的交底书
const disclosure = `
技术领域：本发明涉及阀门制造技术
背景技术：现有金属阀片存在的问题...
发明内容：采用陶瓷材料，具体工艺为...
技术效果：密封性提高50%，测试方法为...
实施方式：具体实施例1、实施例2...
`

// ❌ 差的交底书
const disclosure = '改进了阀门设计'
```

### 3. 利用验证结果

```typescript
const result = await agent.execute(input)

if (result.validation?.passed) {
  // 验证通过，可以继续处理
  console.log('✅ 发明构思提取成功')
} else {
  // 验证失败，需要人工介入
  console.log('❌ 需要人工检查:')
  result.validation.errors.forEach((err) => console.log(err))
}
```

## 与其他 Agent 集成

```typescript
// 完整的专利撰写工作流
const { PatentWriterAgent } = require('@yunpat/agents/patent-writer')
const { PatentAnalyzerAgent } = require('@yunpat/agents/analysis')

// 1. 发明理解
const understandingAgent = new InventionUnderstandingAgent(...)
const inventionConcept = await understandingAgent.execute(input)

// 2. 专利分析
const analyzerAgent = new PatentAnalyzerAgent(...)
const analysisResult = await analyzerAgent.execute({
  inventionConcept: inventionConcept.inventionConcepts,
  priorArt: input.priorArt
})

// 3. 专利撰写
const writerAgent = new PatentWriterAgent(...)
const patentDraft = await writerAgent.execute({
  inventionConcept: inventionConcept,
  analysisResult: analysisResult
})
```

## 常见问题

### Q: 如何提高三元组提取的准确性？

A:

1. 提供详细的技术交底书
2. 提供高质量的现有技术
3. 启用知识库增强
4. 检查验证结果的警告信息

### Q: 知识库检索失败怎么办？

A: Agent 会自动使用降级策略，不会影响核心功能。但建议：

1. 检查知识库配置
2. 确认网络连接
3. 查看日志中的错误信息

### Q: 如何处理复杂的技术方案？

A:

1. Agent 会自动提取多组三元组
2. 每组三元组对应一个创新点
3. 检查 `inventionConcepts` 数组是否完整

## 更新日志

### v2.0.0 (2026-05-05)

- ✨ 完全重写，基于知识库增强
- ✨ 多阶段检索策略
- ✨ 多组三元组提取
- ✨ 术语标准化
- ✨ 一致性验证
- ✨ 两级缓存机制

### v1.0.0

- 基础发明理解功能
- 单组三元组提取
