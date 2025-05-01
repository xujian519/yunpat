# 使用示例（自动生成）

**生成时间**: 2026-05-04T16:28:52.297Z

## Agents 使用示例

### abstract-drafter

**描述**: 专利摘要撰写智能体 - 撰写专利摘要

```typescript
import { Abstract-drafter } from '@yunpat/agents/abstract-drafter'

const agent = new Abstract-drafter({
  name: 'abstract-drafter',
  description: '专利摘要撰写智能体 - 撰写专利摘要',
  llm: yourLLMAdapter
})

const result = await agent.run(input, context)
```

---

### analysis

**描述**: 专利分析智能体 - 现有技术深度分析、对比分析、交底书再分析

```typescript
import { Analysis } from '@yunpat/agents/analysis'

const agent = new Analysis({
  name: 'analysis',
  description: '专利分析智能体 - 现有技术深度分析、对比分析、交底书再分析',
  llm: yourLLMAdapter,
})

const result = await agent.run(input, context)
```

---

### base

**描述**: YunPat 专业层Agent基类 - 统一的Agent架构

```typescript
import { Base } from '@yunpat/agents/base'

const agent = new Base({
  name: 'base',
  description: 'YunPat 专业层Agent基类 - 统一的Agent架构',
  llm: yourLLMAdapter,
})

const result = await agent.run(input, context)
```

---

### claim-generator

**描述**: 权利要求生成智能体 - 基于发明理解和检索分析撰写权利要求

```typescript
import { Claim-generator } from '@yunpat/agents/claim-generator'

const agent = new Claim-generator({
  name: 'claim-generator',
  description: '权利要求生成智能体 - 基于发明理解和检索分析撰写权利要求',
  llm: yourLLMAdapter
})

const result = await agent.run(input, context)
```

---

### claims

**描述**: 权利要求生成智能体 - 专利权利要求书撰写

```typescript
import { Claims } from '@yunpat/agents/claims'

const agent = new Claims({
  name: 'claims',
  description: '权利要求生成智能体 - 专利权利要求书撰写',
  llm: yourLLMAdapter,
})

const result = await agent.run(input, context)
```

---

### comparison-report-generator

**描述**: 对比报告生成Agent - 生成专利申请与现有技术的对比分析报告

```typescript
import { Comparison-report-generator } from '@yunpat/agents/comparison-report-generator'

const agent = new Comparison-report-generator({
  name: 'comparison-report-generator',
  description: '对比报告生成Agent - 生成专利申请与现有技术的对比分析报告',
  llm: yourLLMAdapter
})

const result = await agent.run(input, context)
```

---

### format-converter

**描述**: 专利格式转换智能体 - Markdown/结构化内容转DOCX

```typescript
import { Format-converter } from '@yunpat/agents/format-converter'

const agent = new Format-converter({
  name: 'format-converter',
  description: '专利格式转换智能体 - Markdown/结构化内容转DOCX',
  llm: yourLLMAdapter
})

const result = await agent.run(input, context)
```

---

### invention

**描述**: 发明理解智能体 - 专利交底书分析与结构化理解

```typescript
import { Invention } from '@yunpat/agents/invention'

const agent = new Invention({
  name: 'invention',
  description: '发明理解智能体 - 专利交底书分析与结构化理解',
  llm: yourLLMAdapter,
})

const result = await agent.run(input, context)
```

---

### patent-analyzer

**描述**: 专利分析智能体 - 专利文献深度分析

```typescript
import { Patent-analyzer } from '@yunpat/agents/patent-analyzer'

const agent = new Patent-analyzer({
  name: 'patent-analyzer',
  description: '专利分析智能体 - 专利文献深度分析',
  llm: yourLLMAdapter
})

const result = await agent.run(input, context)
```

---

### patent-manager

**描述**: 专利管理智能体 - 专利全生命周期管理与监控

```typescript
import { Patent-manager } from '@yunpat/agents/patent-manager'

const agent = new Patent-manager({
  name: 'patent-manager',
  description: '专利管理智能体 - 专利全生命周期管理与监控',
  llm: yourLLMAdapter
})

const result = await agent.run(input, context)
```

---

### patent-responder

**描述**: 专利答复智能体 - OA 审查意见答复与策略生成

```typescript
import { Patent-responder } from '@yunpat/agents/patent-responder'

const agent = new Patent-responder({
  name: 'patent-responder',
  description: '专利答复智能体 - OA 审查意见答复与策略生成',
  llm: yourLLMAdapter
})

const result = await agent.run(input, context)
```

---

### patent-writer

**描述**: 专利撰写智能体 - 集成知识库和分步加载提示词模板

```typescript
import { Patent-writer } from '@yunpat/agents/patent-writer'

const agent = new Patent-writer({
  name: 'patent-writer',
  description: '专利撰写智能体 - 集成知识库和分步加载提示词模板',
  llm: yourLLMAdapter
})

const result = await agent.run(input, context)
```

---

### prior-art-search

**描述**: 先导技术检索智能体 - 构建检索策略并分析现有技术

```typescript
import { Prior-art-search } from '@yunpat/agents/prior-art-search'

const agent = new Prior-art-search({
  name: 'prior-art-search',
  description: '先导技术检索智能体 - 构建检索策略并分析现有技术',
  llm: yourLLMAdapter
})

const result = await agent.run(input, context)
```

---

### quality

**描述**: 专利质量检查智能体 - 权利要求/说明书/术语一致性检查

```typescript
import { Quality } from '@yunpat/agents/quality'

const agent = new Quality({
  name: 'quality',
  description: '专利质量检查智能体 - 权利要求/说明书/术语一致性检查',
  llm: yourLLMAdapter,
})

const result = await agent.run(input, context)
```

---

### quality-checker

**描述**: 质量检查Agent - 评估专利申请质量

```typescript
import { Quality-checker } from '@yunpat/agents/quality-checker'

const agent = new Quality-checker({
  name: 'quality-checker',
  description: '质量检查Agent - 评估专利申请质量',
  llm: yourLLMAdapter
})

const result = await agent.run(input, context)
```

---

### researcher

**描述**: 研究分析师智能体 - 信息搜集、数据整理、报告生成

```typescript
import { Researcher } from '@yunpat/agents/researcher'

const agent = new Researcher({
  name: 'researcher',
  description: '研究分析师智能体 - 信息搜集、数据整理、报告生成',
  llm: yourLLMAdapter,
})

const result = await agent.run(input, context)
```

---

### search

**描述**: 专利检索智能体 - 检索策略生成与执行

```typescript
import { Search } from '@yunpat/agents/search'

const agent = new Search({
  name: 'search',
  description: '专利检索智能体 - 检索策略生成与执行',
  llm: yourLLMAdapter,
})

const result = await agent.run(input, context)
```

---

### specification

**描述**: 说明书撰写智能体 - 专利说明书分章节撰写

```typescript
import { Specification } from '@yunpat/agents/specification'

const agent = new Specification({
  name: 'specification',
  description: '说明书撰写智能体 - 专利说明书分章节撰写',
  llm: yourLLMAdapter,
})

const result = await agent.run(input, context)
```

---

### specification-drafter

**描述**: 说明书撰写智能体 - 分章节撰写专利说明书

```typescript
import { Specification-drafter } from '@yunpat/agents/specification-drafter'

const agent = new Specification-drafter({
  name: 'specification-drafter',
  description: '说明书撰写智能体 - 分章节撰写专利说明书',
  llm: yourLLMAdapter
})

const result = await agent.run(input, context)
```

---

### technical-drawing

**描述**: 技术图纸识别智能体 - 支持化学结构、数学公式、OCR

```typescript
import { Technical-drawing } from '@yunpat/agents/technical-drawing'

const agent = new Technical-drawing({
  name: 'technical-drawing',
  description: '技术图纸识别智能体 - 支持化学结构、数学公式、OCR',
  llm: yourLLMAdapter
})

const result = await agent.run(input, context)
```

---

### test

**描述**: 工作流测试 - 验证专利申请工作流

```typescript
import { Test } from '@yunpat/agents/test'

const agent = new Test({
  name: 'test',
  description: '工作流测试 - 验证专利申请工作流',
  llm: yourLLMAdapter,
})

const result = await agent.run(input, context)
```

---

### writer

**描述**: 专利撰写智能体 - 集成知识库和分步加载提示词模板

```typescript
import { Writer } from '@yunpat/agents/writer'

const agent = new Writer({
  name: 'writer',
  description: '专利撰写智能体 - 集成知识库和分步加载提示词模板',
  llm: yourLLMAdapter,
})

const result = await agent.run(input, context)
```

---
