# Prompt 模板使用指南

## 概述

`PromptBuilder` 是一个专门用于构建发明理解 Prompt 的工具类，能够将知识库检索结果组织成 LLM 可理解的格式。

---

## 一、快速开始

### 1.1 基础使用

```typescript
import { PromptBuilder } from '@yunpat/agents/invention'

const builder = new PromptBuilder()

// 构建完整的 System Prompt
const systemPrompt = builder.buildSystemPrompt(knowledge)
const userPrompt = builder.buildUserPrompt(input, knowledge)

// 调用 LLM
const response = await llm.chat({
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ],
})
```

### 1.2 配置选项

```typescript
const builder = new PromptBuilder({
  enableKnowledgeEnhancement: true, // 是否启用知识增强
  maxPromptLength: 8000, // 最大 Prompt 长度
  includeExamples: true, // 是否包含示例
  detailLevel: 'standard', // 详细程度
})
```

---

## 二、API 文档

### 2.1 主要方法

#### buildSystemPrompt()

构建系统提示（角色+任务+原则+输出要求+知识增强）

```typescript
buildSystemPrompt(knowledge?: KnowledgeRetrievalResult): string
```

**参数**：

- `knowledge`（可选）: 知识检索结果

**返回**：完整的 System Prompt 字符串

**示例**：

```typescript
const systemPrompt = builder.buildSystemPrompt(knowledge)
```

**输出结构**：

```markdown
## 角色定义

你是一位资深的专利代理人...

## 核心任务

请深入理解技术交底书...

## 核心原则

### 三元组逻辑

问题 → 特征 → 效果...

## 输出要求

输出必须是严格的 JSON 格式...

## 参考知识（来自专利知识库）

### 三步法框架

...
```

#### buildUserPrompt()

构建用户提示（输入+上下文+输出要求）

```typescript
buildUserPrompt(
  input: InventionUnderstandingInput,
  knowledge?: KnowledgeRetrievalResult
): string
```

**参数**：

- `input`: 发明理解输入
- `knowledge`（可选）: 知识检索结果

**返回**：完整的 User Prompt 字符串

#### buildSimplifiedPrompt()

构建简化版 Prompt（低 Token 场景）

```typescript
buildSimplifiedPrompt(input: InventionUnderstandingInput): string
```

**特点**：

- 省略方法论和案例
- 保留核心任务
- 适合快速处理

#### buildTutorialPrompt()

构建教学版 Prompt（少样本场景）

```typescript
buildTutorialPrompt(input: InventionUnderstandingInput): string
```

**特点**：

- 分步指导
- 便于理解
- 适合教学场景

#### compressKnowledge()

压缩知识内容到指定长度

```typescript
compressKnowledge(
  knowledge: KnowledgeRetrievalResult,
  maxLength?: number
): string
```

**策略**：

- 优先保留核心方法论
- 其次保留常用术语
- 最后保留简化案例

---

## 三、使用场景

### 3.1 场景 1：标准发明理解

```typescript
const builder = new PromptBuilder()

const systemPrompt = builder.buildSystemPrompt(knowledge)
const userPrompt = builder.buildUserPrompt(input, knowledge)

// 标准 Prompt 长度：约 3000-5000 字
```

### 3.2 场景 2：快速处理（Token 有限）

```typescript
const builder = new PromptBuilder({
  maxPromptLength: 2000,
  includeExamples: false,
})

const systemPrompt = builder.buildSystemPrompt()
const userPrompt = builder.buildSimplifiedPrompt(input)

// 简化 Prompt 长度：约 1000-1500 字
```

### 3.3 场景 3：少样本学习

```typescript
const builder = new PromptBuilder({
  detailLevel: 'full',
  includeExamples: true,
})

const userPrompt = builder.buildTutorialPrompt(input)

// 教学 Prompt 长度：约 2000-3000 字
```

### 3.4 场景 4：知识压缩

```typescript
const compressedKnowledge = builder.compressKnowledge(knowledge, 800)

// 压缩后的知识：约 800 字
// 包含：核心方法论 + 常用术语
```

---

## 四、Prompt 模板示例

### 示例 1：完整 Prompt（机械工程）

```markdown
## 角色定义

你是一位资深的专利代理人，具有以下专长：

- 深入理解技术交底书，提取发明要点
- 熟悉专利法、审查指南和撰写规范
- 掌握三步法等创造性判断方法

## 核心任务

请深入理解技术交底书，提取以下结构化信息：

1. 多组问题-特征-效果三元组
2. 技术领域（标准化）
3. 背景技术（基于现有技术整理）
4. 实施方式提炼
5. 附图说明

## 参考知识（来自专利知识库）

### 三步法框架

- 第一步：确定最接近的现有技术
- 第二步：确定区别特征和实际解决的技术问题
- 第三步：判断是否显而易见

### 技术问题提取

- 针对现有技术缺陷或不足
- 用正面、简洁语言描述
- 不包含解决手段本身

### 技术特征提取

- 独立特征分开划分
- 协同特征整体考虑
- 实质对比而非文字对比

### 术语标准化规则

- "用" → "采用"
- "连接" → "固定连接"
- "设置" → "配置"

### 参考案例：陶瓷阀片组件

- 问题: 现有金属阀片易磨损
- 特征: 陶瓷材料、表面精度0.01mm
- 效果: 密命延长3倍

---

## 发明基本信息

**发明名称**: 一种陶瓷阀片组件
**技术领域**: 机械工程

## 现有技术（背景）

**现有技术 1**:
CN123456789A: 金属阀片的制造方法
现有金属阀片在高温高压环境下容易磨损，使用寿命仅为3-6个月。

## 技术交底书

本发明涉及一种阀门组件，特别是陶瓷阀片组件。
采用氧化锆陶瓷材料制造阀片，表面精度达到0.01mm...

## 输出要求

### 格式要求

输出必须是严格的 JSON 格式...
```

### 示例 2：简化 Prompt（快速场景）

```markdown
你是一位专利代理人。请分析以下技术交底书，提取问题-特征-效果三元组。

## 技术交底书

一种陶瓷阀片组件

本发明采用陶瓷材料制造阀片，表面精度达到0.01mm。

## 输出 JSON 格式

{
"inventionConcepts": [{
"technicalProblem": "问题",
"keyFeatures": ["特征1", "特征2"],
"technicalEffects": ["效果1", "效果2"],
"confidence": 0.8
}],
"technicalField": "技术领域"
}
```

### 示例 3：教学 Prompt（少样本场景）

```markdown
你是一位资深专利代理人，正在指导新手理解发明。

## 分步指导

**第1步：识别技术问题**

- 从现有技术的不足入手
- 用简洁语言描述
- 避免包含解决手段

**第2步：提取技术特征**

- 识别核心创新点
- 分为必要特征和附加特征
- 使用具体的技术术语

**第3步：描述技术效果**

- 与现有技术对比
- 量化效果（数据、百分比）
- 说明由哪个特征带来

## 实践任务

请按照以上步骤，分析以下技术交底书：

一种陶瓷阀片组件

本发明采用陶瓷材料制造阀片...
```

---

## 五、最佳实践

### 5.1 内容组织原则

#### 原则 1：分层组织

```
System Prompt (系统层)
├── 角色定义 (建立权威)
├── 任务描述 (明确目标)
├── 核心原则 (建立标准)
└── 输出要求 (明确格式)

User Prompt (任务层)
├── 输入信息 (提供数据)
├── 上下文信息 (提供背景)
└── 输出示例 (提供参考)
```

#### 原则 2：优先级排序

```
知识内容优先级：

1. 核心方法论（必须包含）
   ├─ 三步法框架
   ├─ 问题/特征/效果提取方法
   └─ 一致性要求

2. 领域特定知识（高优先级）
   ├─ 领域撰写指南
   ├─ 常见错误提醒
   └─ 相关案例

3. 参考案例（中优先级）
   ├─ 简化案例（1-2个）
   └─ 对比案例（正反例）

4. 扩展阅读（低优先级）
   ├─ 完整案例（全文）
   └─ 相关法条
```

#### 原则 3：长度控制

| 场景 | System Prompt | User Prompt  | 总计         |
| ---- | ------------- | ------------ | ------------ |
| 标准 | 1000-1500 字  | 2000-3000 字 | 3000-4500 字 |
| 简化 | 500-800 字    | 1000-1500 字 | 1500-2300 字 |
| 教学 | 1500-2000 字  | 1000-1500 字 | 2500-3500 字 |

### 5.2 知识内容组织技巧

#### 技巧 1：结构化呈现

**❌ 不好的组织**：

```markdown
知识内容：
撰写-机械-权利要求书撰写-基本问题
撰写-机械-说明书撰写-名称与技术领域
撰写-机械-案例-陶瓷阀片组件
...
（2000+ 字未组织的内容）
```

**✅ 好的组织**：

```markdown
### 参考知识（来自专利知识库）

#### 撰写要点

1. 明确产品的结构特征
2. 避免功能性限定
3. 区分必要特征和非必要特征

#### 常见错误

❌ "设置有密封件"（位置不明确）
✅ "在阀体上配置密封件"

#### 参考案例

**案例**: 陶瓷阀片组件

- 问题: 现有金属阀片易磨损
- 特征: 陶瓷材料、表面精度0.01mm
- 效果: 寿命延长3倍
```

#### 技巧 2：使用标记和分类

```markdown
### 三步法框架

**第一步**: 确定最接近的现有技术
**第二步**: 确定区别特征和实际解决的技术问题
**第三步**: 判断是否显而易见

**应用**: 在提取时，按三步法框架进行：

1. 先识别最接近的现有技术
2. 再识别区别特征
3. 最后判断技术启示
```

#### 技巧 3：使用示例对比

```markdown
### 技术问题提取示例

✅ **正确**: "现有金属阀片在高温环境下容易磨损"
❌ **错误**: "通过改进材料解决磨损问题"

**原因**: 错误示例包含了解决手段（"通过改进材料"）
```

### 5.3 Prompt 优化技巧

#### 优化 1：根据输入调整

```typescript
// 根据 input.field 动态调整
const domainPrompt =
  input.field === '生物技术'
    ? getBiotechPrompt() // 包含生物技术特定指导
    : getGeneralPrompt() // 通用指导
```

#### 优化 2：根据置信度调整

```typescript
// 如果初步提取置信度低，添加追问
if (preliminaryConfidence < 0.7) {
  prompt += `\n\n## 补充要求\n由于信息不足，请特别关注：...`
}
```

#### 优化 3：Token 优化

```typescript
// 计算当前 Prompt 长度
const currentLength = systemPrompt.length + userPrompt.length
if (currentLength > MAX_TOKENS) {
  // 使用压缩版知识
  const compressedKnowledge = builder.compressKnowledge(knowledge, 500)
  systemPrompt = builder.buildSystemPrompt(compressedKnowledge)
}
```

---

## 六、质量评估

### 6.1 评估维度

| 维度       | 指标               | 评估方法   |
| ---------- | ------------------ | ---------- |
| **清晰度** | 指令明确，无歧义   | 人工评估   |
| **完整性** | 包含所有必需信息   | 检查清单   |
| **简洁性** | 无冗余，重点突出   | Token 计数 |
| **组织性** | 结构清晰，层次分明 | 人工评估   |
| **有效性** | 能否得到好的输出   | A/B 测试   |

### 6.2 评估检查清单

```markdown
## Prompt 质量检查清单

### 角色定义

- [ ] 明确定义角色（专利代理人）
- [ ] 说明角色专长
- [ ] 建立可信度

### 任务描述

- [ ] 明确核心任务（提取三元组）
- [ ] 说明任务上下文
- [ ] 定义成功标准

### 知识增强

- [ ] 方法论指导清晰可操作
- [ ] 术语标准具体实用
- [ ] 案例参考相关简化
- [ ] 验证规则明确可执行

### 输出要求

- [ ] 输出格式明确（JSON）
- [ ] 字段定义清晰
- [ ] 提供具体示例
- [ ] 说明置信度评估

### 内容组织

- [ ] 结构清晰，层次分明
- [ ] 重点突出，优先级明确
- [ ] 长度适中，不冗余
- [ ] 格式统一，易于阅读
```

---

## 七、故障排除

### 7.1 常见问题

#### 问题 1：LLM 输出不符合预期

**可能原因**：

- 指令不够清晰
- 示例不够具体
- 格式要求不明确

**解决方案**：

1. 检查 System Prompt 是否明确
2. 增加具体的输出示例
3. 强化格式要求说明

#### 问题 2：LLM 忽略重要信息

**可能原因**：

- Prompt 过长，关键信息被淹没
- 内容组织混乱，重点不突出
- 知识内容过多，干扰理解

**解决方案**：

1. 使用 `compressKnowledge()` 压缩知识
2. 使用标记和分类突出重点
3. 删除不必要的知识内容

#### 问题 3：Token 使用过多

**可能原因**：

- 包含了过多案例
- 知识内容过于详细
- 示例过于冗长

**解决方案**：

1. 减少 case 数量（1-2个）
2. 简化知识内容
3. 使用 `buildSimplifiedPrompt()`

### 7.2 调试技巧

#### 技巧 1：逐步简化

```typescript
// 第1步：只包含核心任务
const minimalPrompt = `
请提取发明构思：
${technicalDisclosure}
`

// 第2步：添加输出要求
const withFormatPrompt =
  minimalPrompt +
  `
输出 JSON 格式：{...}
`

// 第3步：添加方法论
const withMethodology = withFormatPrompt + methodology

// 第4步：添加案例
const withCases = withMethodology + cases
```

#### 技巧 2：A/B 测试

```typescript
// 测试不同组织方式
const promptA = organizeByPriority(knowledge)
const promptB = organizeByCategory(knowledge)

const resultA = await llm.chat({ messages: [{ content: promptA }] })
const resultB = await llm.chat({ messages: [{ content: promptB }] })

// 比较输出质量
const qualityA = evaluateOutput(resultA)
const qualityB = evaluateOutput(resultB)
```

#### 技巧 3：监控 Token 使用

```typescript
function logTokenUsage(prompt: string, label: string) {
  const tokenCount = estimateTokens(prompt)
  console.log(`[${label}] Token 数量: ${tokenCount}`)
  console.log(`[${label}] 字符数: ${prompt.length}`)
}

// 使用
logTokenUsage(systemPrompt, 'System')
logTokenUsage(userPrompt, 'User')
logTokenUsage(systemPrompt + userPrompt, 'Total')
```

---

## 八、总结

### 核心要点

1. **结构化组织**：清晰的层次结构，易于理解和维护
2. **优先级排序**：方法论 > 领域知识 > 案例 > 扩展阅读
3. **长度控制**：根据场景调整长度，优化 Token 使用
4. **上下文感知**：根据领域和输入动态调整内容
5. **质量评估**：使用检查清单和 A/B 测试持续优化

### 使用建议

- **标准场景**：使用 `buildSystemPrompt()` + `buildUserPrompt()`
- **快速场景**：使用 `buildSimplifiedPrompt()`
- **教学场景**：使用 `buildTutorialPrompt()`
- **Token 有限**：使用 `compressKnowledge()` + `buildSimplifiedPrompt()`

### 持续改进

- 收集 LLM 输出质量数据
- 分析错误案例，优化 Prompt
- 根据领域特点定制模板
- 建立 Prompt 版本管理机制
