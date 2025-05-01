# Prompt 模板设计文档

## 概述

本文档定义了 `InventionUnderstandingAgent` 的 Prompt 模板体系，说明如何将知识库检索结果组织成 LLM 可理解的格式。

---

## 一、Prompt 模板架构

### 1.1 三层结构

```
┌─────────────────────────────────────────────────────┐
│              System Prompt (系统提示)                │
├─────────────────────────────────────────────────────┤
│  1. 角色定义（资深专利代理人）                         │
│  2. 任务描述（提取发明构思）                           │
│  3. 核心原则（问题-特征-效果三元组）                  │
│  4. 输出要求（JSON 格式、置信度）                     │
└─────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────┐
│         Knowledge Enhancement (知识增强)            │
├─────────────────────────────────────────────────────┤
│  1. 方法论指导（来自知识库）                          │
│ 2. 术语标准（领域特定）                              │
│ 3. 案例参考（类似发明）                              │
│  4. 验证规则（一致性检查）                            │
└─────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────┐
│              User Prompt (用户提示)                  │
├─────────────────────────────────────────────────────┤
│  1. 发明基本信息                                     │
│ 2. 技术交底书                                         │
│ 3. 现有技术（由检索工具提供）                         │
│ 4. 附图说明                                         │
│ 5. 输出格式示例                                      │
└─────────────────────────────────────────────────────┘
```

### 1.2 模板层次

```typescript
PromptTemplate
├── SystemTemplate (系统模板)
│   ├── RoleTemplate (角色模板)
│   ├── TaskTemplate (任务模板)
│   └── OutputTemplate (输出模板)
├── KnowledgeTemplate (知识模板)
│   ├── MethodologyTemplate (方法论模板)
│   ├── TerminologyTemplate (术语模板)
│   ├── CaseTemplate (案例模板)
│   └── ValidationTemplate (验证模板)
└── UserTemplate (用户模板)
    ├── InputTemplate (输入模板)
    ├── ContextTemplate (上下文模板)
    └── ExampleTemplate (示例模板)
```

---

## 二、System Prompt 模板

### 2.1 基础模板

```markdown
你是一位资深的专利代理人，专精于发明理解和专利申请文件撰写。

## 核心任务

你的任务是深入理解技术交底书，提取**多组**问题-特征-效果三元组：

1. **技术问题** (Technical Problem) - 发明要解决的具体技术问题
2. **技术特征** (Key Features) - 解决技术问题的核心技术特征
3. **技术效果** (Technical Effects) - 与现有技术相比的有益效果

## 核心原则

1. **多组三元组**: 提取多组三元组，覆盖发明的所有创新点
2. **逻辑一致性**: 问题-特征-效果必须一一对应
3. **具体性**: 技术特征必须具体，技术效果必须可量化
4. **对比性**: 技术效果必须与现有技术有明确对比

## 输出要求

- 用中文回答，保持专业术语的准确性
- 输出必须是严格的 JSON 格式
- 为每个三元组提供置信度评估（0-1之间）
- 如果信息不足，降低置信度并说明原因
```

### 2.2 知识增强模板

#### 模板 2.2.1: 方法论增强

```markdown
## 参考方法论（来自专利知识库）

### 三步法框架

根据《以案说法——专利复审、无效典型案例指引》，创造性判断遵循三步法：

1. **第一步**: 确定最接近的现有技术
2. **第二步**: 确定区别特征和实际解决的技术问题
3. **第三步**: 判断是否显而易见

在发明构思提取时，应：

- 先识别区别特征（相对于现有技术）
- 根据区别特征的技术效果，认定实际解决的技术问题
- 确保问题、特征、效果逻辑关联

### 技术问题提取方法

**基本原则**：

- 针对现有技术中存在的缺陷或不足
- 用正面的、尽可能简洁的语言客观而有根据地反映
- 不包含解决手段本身（避免"事后诸葛亮"）

**提取方法**：

1. 直接采用说明书记载的技术问题
2. 从现有技术缺陷中提炼
3. 重新确定技术问题（如果说明书记载的问题未被解决）

### 技术特征提取方法

**划分原则**：

- 独立特征分开划分（各自解决不同问题）
- 协同特征整体考虑（协同解决同一问题）
- 实质对比而非文字对比（看技术实质）

**必要技术特征**：

- 解决技术问题不可缺少的技术特征
- 其总和足以构成保护客体

### 技术效果提取方法

**要求**：

- 由技术特征直接带来或必然产生
- 与现有技术有明确对比
- 具体分析，不能只给断言
- 必要时提供实验数据

**描述方式**：

- 量化对比："提高50%"、"延长3倍"
- 功能描述："解决了...问题"
- 性能参数："精度达到0.01mm"
```

#### 模板 2.2.2: 领域特定增强

```markdown
## 领域特定指导（{field}领域）

### 撰写要点

{domain_writing_guide}

### 常见错误提醒

{common_errors}

### 参考案例

{similar_cases}

---
```

**机械工程领域示例**：

```markdown
## 领域特定指导（机械工程领域）

### 撰写要点

1. **产品权利要求**:
   - 明确产品的结构特征
   - 避免功能性限定（"能...的装置"）
   - 区分必要特征和非必要特征

2. **方法权利要求**:
   - 按步骤顺序描述
   - 包含工艺参数
   - 明确条件和效果

3. **实施方式**:
   - 详细的参数范围
   - 多个实施例
   - 对照附图说明

### 常见错误提醒

❌ "改进设计"（过于抽象）
✅ "采用陶瓷材料，表面精度0.01mm"

❌ "连接在一起"（不明确）
✅ "通过螺纹连接固定" 或 "焊接连接"

❌ "设置有密封件"（位置不明确）
✅ "在阀体上配置密封件"

### 参考案例

**案例1**: 陶瓷阀片组件（撰写-机械-案例-陶瓷阀片组件）

- 问题: 现有金属阀片易磨损
- 特征: 陶瓷材料、表面精度0.01mm
- 效果: 寿命延长3倍

**案例2**: 易拉罐开启装置（撰写-机械-案例-易拉罐开启装置）

- 问题: 开启力大、拉环易断
- 特征: 预刻痕深度、加强筋、安全圆角
- 效果: 开启力降低40%
```

---

## 三、User Prompt 模板

### 3.1 输入组织模板

```markdown
## 发明基本信息

**发明名称**: {title}

**技术领域**: {field}

**申请人**: {applicant}

**发明人**: {inventors}

---

## 现有技术（背景）

{priorArt_section}

---

## 技术交底书

{technicalDisclosure}

---

## 附图说明

{drawings_section}
```

### 3.2 输出格式模板

````markdown
## 输出要求

请提取**多组**问题-特征-效果三元组，输出以下 JSON 格式：

```json
{
  "inventionConcepts": [
    {
      "technicalProblem": "要解决的具体技术问题",
      "keyFeatures": ["特征1", "特征2", "特征3"],
      "technicalEffects": ["效果1", "效果2"],
      "confidence": 0.9
    }
  ],
  "technicalField": "标准化的技术领域描述",
  "embodimentSummary": "实施方式提炼",
  "drawingDescriptions": ["图1描述", "图2描述"]
}
```
````

### 重要提示

1. **多组三元组**: 提取多组三元组，覆盖所有创新点
2. **逻辑对应**: 每个技术特征必须对应至少一个技术效果
3. **量化效果**: 技术效果必须包含具体数据（如"提高50%"、"延长3倍"）
4. **具体特征**: 技术特征必须具体（不是"改进设计"）
5. **问题纯度**: 技术问题不应包含解决手段（避免"通过..."、"采用..."）
6. **置信度**: 根据信息完整度评估置信度

---

## 输出示例

### 示例 1: 单一创新点

**输入**:

- 问题: 阀片密封性差
- 特征: 采用陶瓷材料
- 效果: 密封性提高50%

**输出**:

```json
{
  "inventionConcepts": [
    {
      "technicalProblem": "现有金属阀片在高温高压环境下密封性差",
      "keyFeatures": ["采用氧化锆陶瓷材料", "表面精度达到0.01mm"],
      "technicalEffects": ["密封性提高50%", "使用寿命延长3倍"],
      "confidence": 0.9
    }
  ]
}
```

### 示例 2: 多个创新点

**输入**:

- 问题1: 阀片密封性差
- 特征1: 陶瓷材料
- 效果1: 密封性提高50%

- 问题2: 更换困难
- 特征2: 快拆结构
- 效果2: 更换时间缩短80%

**输出**:

```json
{
  "inventionConcepts": [
    {
      "technicalProblem": "现有金属阀片在高温高压环境下密封性差",
      "keyFeatures": ["采用氧化锆陶瓷材料", "表面精度达到0.01mm"],
      "technicalEffects": ["密封性提高50%", "使用寿命延长3倍"],
      "confidence": 0.9
    },
    {
      "technicalProblem": "现有阀门更换维护困难，成本高",
      "keyFeatures": ["阀片与阀杆采用可拆卸连接", "快拆结构设计"],
      "technicalEffects": ["更换时间缩短80%", "维护成本降低50%"],
      "confidence": 0.85
    }
  ]
}
```

````

---

## 四、知识内容组织策略

### 4.1 方法论内容的组织

#### 策略 1: 结构化组织

```markdown
### 方法论：技术问题提取

**核心原则**：
1. 针对现有技术缺陷或不足
2. 用正面、简洁语言描述
3. 不包含解决手段本身

**提取方法**：
- 方法1: 直接采用说明书记载
- 方法2: 从现有技术缺陷提炼
- 方法3: 重新确定技术问题

**示例**：
✅ 正确: "现有金属阀片在高温环境下容易磨损"
❌ 错误: "通过改进材料解决磨损问题"
````

#### 策略 2: 案例驱动组织

```markdown
### 技术特征提取示例

**案例**: 第29943号无效决定（陶瓷阀片）

**场景**: 阀片包含两个独立功能

- 端盖防尘
- 圆锥滚子轴承减磨

**提取方法**:

1. 分析两个功能是否相互独立
2. 独立 → 分为两个技术特征
3. 协同 → 作为一个整体特征

**结果**:

- 特征1: 端盖防尘（防粉尘污染）
- 特征2: 圆锥滚子轴承（减少磨损）
```

#### 策略 3: 规则-案例混合

```markdown
### 技术效果认定规则

**规则**: 技术效果必须来自区别特征

**案例1**: 蒸制甜甜圈（第99041号复审决定）
❌ 错误: 配方未记载在权利要求中，不能依据配方的效果
✅ 正确: 限定配方后，才能依据该效果

**案例2**: 除草剂组合物（第87769号复审决定）
❌ 错误: 实施例配比0.2:0.5，权利要求范围1:10000-750:1
✅ 正确: 差距过大，不能推广到整个范围

**应用**:

- 检查效果是否来自权利要求中的特征
- 检查效果是否在整个保护范围内成立
```

### 4.2 术语标准的组织

#### 策略 1: 分类映射表

```markdown
### 术语标准化规则（机械工程）

| 非标准术语     | 标准术语 | 示例                        |
| -------------- | -------- | --------------------------- |
| 用、使用       | 采用     | "用陶瓷做" → "采用陶瓷材料" |
| 连接、连在一起 | 固定连接 | "连接在一起" → "固定连接"   |
| 设置、放在     | 配置     | "设置密封件" → "配置密封件" |
| 装置、设备     | 设备     | "处理装置" → "处理设备"     |

**化学领域**:

| 非标准术语     | 标准术语 |
| -------------- | -------- |
| 包含、含有     | 包括     |
| 反应、进行反应 | 进行反应 |
| 制备、合成     | 制备     |
| 混合           | 复合     |
```

#### 策略 2: 上下文感知

```markdown
### 术语标准化（自动应用）

在提取过程中，自动将以下术语转换为标准专利术语：

**连接类术语**:

- "连在一起" → "固定连接"
- "焊接在一起" → "焊接连接"
- "螺纹连接" → "螺纹配合"

**材料类术语**:

- "用陶瓷做" → "采用陶瓷材料"
- "塑料材质" → "塑料材料"
- "金属材料" → "金属"

**方法类术语**:

- "通过...方法" → "采用...技术方案"
- "利用...手段" → "使用...方法"
```

### 4.3 案例参考的组织

#### 策略 1: 简化案例

```markdown
### 参考案例（简化版）

**案例**: 陶瓷阀片组件（撰写-机械-案例-陶瓷阀片组件）

**问题**: 现有金属阀片在高温高压环境下容易磨损

**特征**:

- 采用氧化锆陶瓷材料
- 表面精度达到0.01mm

**效果**:

- 密封性提高50%
- 使用寿命延长3倍

**启示**:

- 陶瓷材料显著提高耐磨性
- 高精度加工是密封性的关键
```

#### 策略 2: 对比案例

```markdown
### 正反案例对比

**案例**: 阀片密封结构

❌ **错误描述**:
"阀片设置有密封结构，密封性好"

✅ **正确描述**:
"阀片配置有弹性密封件，密封性提高50%"

**差异分析**:

- 错误: "设置有"（位置不明确）、"密封性好"（无对比）
- 正确: "配置有"（明确位置）、"提高50%"（量化对比）
```

---

## 五、上下文压缩策略

### 5.1 知识内容优先级

```typescript
interface KnowledgePriority {
  critical: string[] // 核心方法论，必须包含
  important: string[] // 重要指导，强烈建议
  optional: string[] // 参考信息，可选
}

const KNOWLEDGE_PRIORITY: KnowledgePriority = {
  critical: [
    // 三步法框架
    '创造性-区别特征与实际解决的技术问题',

    // 基本原则
    '问题-特征-效果必须一一对应',
    '技术问题不应包含解决手段',
    '技术效果必须有量化对比',
  ],

  important: [
    // 具体方法
    '技术问题的确定原则',
    '技术特征的划分原则',
    '技术效果的认定规则',

    // 领域特定
    '{field}-撰写指南',
    '{field}-常见错误',
  ],

  optional: [
    // 参考案例
    '{field}-案例',

    // 扩展阅读
    '说明书-充分公开概述',
    '权利要求-清楚的要求',
  ],
}
```

### 5.2 内容长度控制

```markdown
### 知识内容长度控制

**System Prompt**: 1000-1500 字

- 角色定义: ~200 字
- 任务描述: ~300 字
- 核心原则: ~200 字
- 输出要求: ~300 字

**知识增强**: 500-1000 字

- 方法论: ~300 字（只包含核心要点）
- 术语标准: ~200 字（只包含常用映射）
- 案例参考: ~500 字（1-2个简化案例）

**User Prompt**: 根据输入动态调整

- 发明信息: 全文包含
- 现有技术: 每篇限制在 300 字
- 附图说明: 简洁描述
```

### 5.3 智能截断策略

```typescript
class KnowledgeCompressor {
  /**
   * 压缩知识内容到指定长度
   */
  compress(knowledge: KnowledgeRetrievalResult, maxLength: number): string {
    let content = ''

    // 1. 添加核心方法论（优先级最高）
    content += this.formatMethodology(knowledge.methodology)

    // 2. 添加术语标准（如果空间允许）
    if (content.length < maxLength * 0.7) {
      content += this.formatTerminology(knowledge.terminology)
    }

    // 3. 添加案例参考（如果空间允许）
    if (content.length < maxLength * 0.9) {
      content += this.formatCases(knowledge.domainKnowledge.similarCases?.slice(0, 1))
    }

    // 4. 截断到最大长度
    if (content.length > maxLength) {
      content = content.substring(0, maxLength) + '\n\n...(更多内容请参考知识库)'
    }

    return content
  }

  private formatMethodology(methodology: KnowledgeRetrievalResult['methodology']): string {
    // 只包含核心要点，不包含冗长的解释
    return `
### 提取方法

**技术问题**: 针对现有技术缺陷，不包含解决手段
**技术特征**: 独立特征分开，协同特征整体
**技术效果**: 量化对比，由特征直接带来
`
  }
}
```

---

## 六、不同场景的模板变体

### 6.1 简化模板（低 Token 场景）

````markdown
你是一位专利代理人。请分析以下技术交底书，提取问题-特征-效果三元组。

## 技术交底书

{technicalDisclosure}

## 输出格式

```json
{
  "inventionConcepts": [
    {
      "technicalProblem": "问题",
      "keyFeatures": ["特征1", "特征2"],
      "technicalEffects": ["效果1", "效果2"],
      "confidence": 0.8
    }
  ]
}
```
````

````

### 6.2 完整模板（高质量场景）

```markdown
{full_system_template}

{knowledge_enhancement}

{user_template_with_examples}
````

### 6.3 教学模板（少样本场景）

```markdown
你是一位资深专利代理人，正在指导新手理解发明。

## 分步指导

**第1步**: 识别技术问题

- 从现有技术的不足入手
- 用简洁语言描述
- 避免包含解决手段

**第2步**: 提取技术特征

- 识别核心创新点
- 分为必要特征和附加特征
- 使用具体的技术术语

**第3步**: 描述技术效果

- 与现有技术对比
- 量化效果（数据、百分比）
- 说明由哪个特征带来

**示例**:
{detailed_example}

## 实践任务

请按照以上步骤，分析以下技术交底书：
{technicalDisclosure}
```

---

## 七、Prompt 质量评估

### 7.1 评估指标

```typescript
interface PromptQualityMetrics {
  // 清晰度
  clarity: number // 0-10，指令是否清晰
  specificity: number // 0-10，要求是否具体
  completeness: number // 0-10，信息是否完整
  consistency: number // 0-10，逻辑是否一致
  conciseness: number // 0-10，是否简洁

  // 效果
  effectiveness: number // 0-10，能否得到好的输出
  robustness: number // 0-10，对异常情况的处理
  tokenEfficiency: number // 0-10，Token 使用效率
}
```

### 7.2 评估检查清单

```markdown
## Prompt 质量检查清单

### 角色定义

- [ ] 明确定义了角色（资深专利代理人）
- [ ] 说明了角色的专长
- [ ] 建立了角色可信度

### 任务描述

- [ ] 明确说明了核心任务（提取三元组）
- [ ] 说明了任务的上下文（专利撰写）
- [ ] 定义了成功的标准

### 知识增强

- [ ] 方法论指导清晰可操作
- [ ] 术语标准具体实用
- [ ] 案例参考相关且简化
- [ ] 验证规则明确可执行

### 输出要求

- [ ] 输出格式明确（JSON）
- [ ] 字段定义清晰
- [ ] 提供了示例
- [ ] 说明了置信度评估

### 用户提示

- [ ] 输入信息完整
- [ ] 结构清晰易读
- [ ] 包含所有必需信息
- [ ] 示例相关有帮助
```

---

## 八、最佳实践

### 8.1 设计原则

1. **渐进式复杂度**: 从简单到复杂，逐步增加指令
2. **正反例对比**: 用示例说明正确和错误的做法
3. **分步指导**: 复杂任务分解为多个步骤
4. **上下文感知**: 根据领域和场景调整内容
5. **Token 优化**: 在质量和效率之间平衡

### 8.2 常见错误

| 错误           | 影响                 | 解决方案         |
| -------------- | -------------------- | ---------------- |
| 指令过长       | Token 浪费，LLM 遗漏 | 分段、使用摘要   |
| 指令模糊       | 输出质量不稳定       | 具体化、提供示例 |
| 上下文不足     | 输出不符合预期       | 提供背景、案例   |
| 格式要求不明确 | 解析失败             | 提供模板、示例   |
| 知识过多       | 噪音干扰             | 优先级排序、截断 |

### 8.3 优化技巧

#### 技巧 1: 使用结构化标记

````markdown
## 核心任务

提取多组问题-特征-效果三元组

## 输出格式

```json
{...}
```
````

## 重要提示

- 提取多组三元组
- 确保逻辑对应
- 量化技术效果

````

#### 技巧 2: 使用视觉分隔

```markdown
---

### 第一部分：输入

---

### 第二部分：输出

---
````

#### 技巧 3: 使用强调和列表

```markdown
**核心要求**：

1. 多组三元组
2. 逻辑一致性
3. 量化效果

**禁止**：

- 抽象描述（"改进设计"）
- 无对比的效果（"效果好"）
- 包含手段的问题（"通过..."）
```

---

## 九、实现示例

### 9.1 完整的 Prompt 构建函数

```typescript
class PromptBuilder {
  /**
   * 构建完整的 System Prompt
   */
  buildSystemPrompt(knowledge: KnowledgeRetrievalResult): string {
    const sections = []

    // 1. 角色定义
    sections.push(this.buildRoleSection())

    // 2. 任务描述
    sections.push(this.buildTaskSection())

    // 3. 核心原则
    sections.push(this.buildPrinciplesSection())

    // 4. 输出要求
    sections.push(this.buildOutputSection())

    // 5. 知识增强（如果启用）
    if (knowledge) {
      sections.push(this.buildKnowledgeSection(knowledge))
    }

    return sections.join('\n\n')
  }

  /**
   * 构建知识增强部分
   */
  buildKnowledgeSection(knowledge: KnowledgeRetrievalResult): string {
    const parts = []

    // 方法论
    if (knowledge.methodology) {
      parts.push(this.formatMethodology(knowledge.methodology))
    }

    // 术语标准
    if (knowledge.terminology && knowledge.terminology.size > 0) {
      parts.push(this.formatTerminology(knowledge.terminology))
    }

    // 案例参考
    if (knowledge.domainKnowledge.similarCases) {
      parts.push(this.formatCases(knowledge.domainKnowledge.similarCases))
    }

    return `## 参考知识（来自专利知识库）\n\n${parts.join('\n\n')}`
  }

  /**
   * 构建用户 Prompt
   */
  buildUserPrompt(input: InventionUnderstandingInput, knowledge: KnowledgeRetrievalResult): string {
    const sections = []

    // 1. 发明基本信息
    sections.push(this.buildBasicInfoSection(input))

    // 2. 现有技术
    if (input.priorArt && input.priorArt.length > 0) {
      sections.push(this.buildPriorArtSection(input.priorArt))
    }

    // 3. 技术交底书
    sections.push(this.buildDisclosureSection(input.technicalDisclosure))

    // 4. 附图说明
    if (input.drawings && input.drawings.length > 0) {
      sections.push(this.buildDrawingsSection(input.drawings))
    }

    // 5. 输出要求和示例
    sections.push(this.buildOutputRequirementSection())

    return sections.join('\n\n')
  }

  /**
   * 压缩知识内容
   */
  compressKnowledge(knowledge: KnowledgeRetrievalResult, maxLength: number): string {
    // 按优先级组织内容
    const prioritized = [
      { priority: 1, content: this.extractCoreMethodology(knowledge) },
      { priority: 2, content: this.extractEssentialTerminology(knowledge) },
      { priority: 3, content: this.extractSimplifiedCases(knowledge) },
    ]

    let result = ''
    for (const item of prioritized) {
      if (result.length + item.content.length > maxLength) {
        break
      }
      result += item.content + '\n\n'
    }

    return result
  }
}
```

### 9.2 使用示例

```typescript
const builder = new PromptBuilder()

// 构建完整的 Prompt
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

---

## 十、总结

### 核心设计原则

1. **结构化**: 清晰的层次结构，易于理解和维护
2. **模块化**: 各部分独立，可灵活组合
3. **可配置**: 根据场景和需求调整
4. **可扩展**: 容易添加新的领域和案例
5. **高效**: 在质量和 Token 使用之间平衡

### 关键要点

- **System Prompt**: 建立角色、定义任务、说明原则
- **知识增强**: 提供方法论、术语、案例、规则
- **User Prompt**: 提供输入、上下文、示例
- **组织策略**: 按优先级排序，智能截断
- **质量评估**: 持续优化和改进

这个 Prompt 模板系统确保了 LLM 能够：

1. 准确理解任务要求
2. 有效利用知识库信息
3. 生成高质量的输出
4. 保持逻辑一致性
