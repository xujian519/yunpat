# YunPat 专利智能体集合

专业的专利全生命周期智能体，提供从撰写到管理的完整解决方案。

## 📦 智能体列表

### 1. PatentWriterAgent - 专利撰写智能体

专业的专利申请文件撰写智能体，支持从技术交底书自动生成完整的专利申请文件。

**功能特性**:
- 📝 自动生成权利要求书、说明书、摘要
- 🎨 支持 CN、PCT、US 三种格式导出
- 🔍 集成知识库和提示词模板
- ✅ 内置质量检查机制
- 📊 提供撰写 metrics（权利要求数、字数、质量评分）

**快速开始**:
```typescript
import { PatentWriterAgent } from '@yunpat/agent-patent-writer';

const agent = new PatentWriterAgent({
  name: 'patent-writer',
  description: '专利撰写智能体',
  eventBus,
  memory,
  tools,
  llm: openaiLLM,
  enableKnowledge: true,
  enableTemplates: true,
});

const result = await agent.execute({
  title: '一种基于深度学习的图像识别方法',
  field: '人工智能',
  applicant: '测试科技有限公司',
  inventors: ['张三', '李四'],
  technicalDisclosure: `
本发明提供一种基于深度学习的图像识别方法。

技术问题：
现有图像识别方法在复杂场景下准确率低。

技术方案：
采用卷积神经网络提取图像特征。

技术效果：
识别准确率提升20%。
  `,
  drawings: ['图1: 系统架构图'],
});

console.log(result.patentApplication);

// 导出为 CN 格式
const exportResult = await agent.exportToFormat('cn');
console.log(exportResult.content);
```

### 2. PatentAnalyzerAgent - 专利分析智能体

专业的专利文献分析智能体，提供多维度专利分析报告。

**功能特性**:
- 🔬 技术方案深度分析（技术领域、问题、方案、效果、关键特征）
- ⚖️ 权利要求分析（独立/从属权利要求、保护范围、质量评分）
- 🔍 现有技术对比（相似度分析、创新点识别）
- 💡 创造性评估（创造性等级、评分、评估理由）
- ⚠️ 专利性风险评估（无效风险、侵权风险、风险因素）

**快速开始**:
```typescript
import { PatentAnalyzerAgent } from '@yunpat/agent-patent-analyzer';

const agent = new PatentAnalyzerAgent({
  name: 'patent-analyzer',
  description: '专利分析智能体',
  eventBus,
  memory,
  tools,
  llm: openaiLLM,
});

const result = await agent.execute({
  patent: {
    publicationNumber: 'CN112345678A',
    title: '一种图像识别方法',
    abstract: '本发明公开了一种图像识别方法...',
    applicant: '测试公司',
    publicationDate: '2023-10-15',
    fullText: '权利要求书\n\n1. 一种方法...',
  },
  analysisTypes: ['technical', 'claims', 'creativity', 'risk'],
});

console.log(result.technicalAnalysis);
console.log(result.creativityAssessment);
console.log(result.recommendations);
```

### 3. PatentResponderAgent - OA答复智能体

专业的审查意见答复智能体，提供智能化的答复策略和文档生成。

**功能特性**:
- 📋 审查意见智能分析（关键问题识别、严重程度评估）
- 🎯 答复策略生成（argue/amend/abandon/appeal）
- 📈 成功概率评估
- ✍️ 修改建议生成
- 📄 多格式导出（CN/PCT/US）

**快速开始**:
```typescript
import { PatentResponderAgent } from '@yunpat/agent-patent-responder';

const agent = new PatentResponderAgent({
  name: 'patent-responder',
  description: 'OA答复智能体',
  eventBus,
  memory,
  tools,
  llm: openaiLLM,
});

const result = await agent.execute({
  officeAction: {
    applicationNumber: 'CN202310000000.0',
    patentTitle: '测试专利',
    notificationDate: '2024-01-15',
    deadline: '2024-04-15',
    officeActionContent: '权利要求1-3不具备创造性...',
    citedReferences: [
      {
        publicationNumber: 'CN112345678A',
        title: '对比文件1',
        relevance: '用于评价创造性',
      },
    ],
    rejectionTypes: ['inventiveness'],
  },
  originalApplication: {
    title: '测试专利',
    claims: '1. 一种方法...',
    description: '本发明提供...',
  },
  strategyPreference: 'moderate',
  documentType: 'cn',
});

console.log(result.strategy);
console.log(result.responseDocument.responseLetter);

// 导出答复文档
const exportResult = await agent.exportToFormat('cn');
console.log(exportResult.content);
```

### 4. PatentManagerAgent - 专利管理智能体

专利全生命周期管理智能体，提供专利申请、期限、费用等管理功能。

**功能特性**:
- 📝 专利申请管理（增删改查）
- ⏰ 截止日期管理（添加、查询、提醒）
- 💰 费用管理（添加、查询、状态跟踪）
- 📊 专利组合概览（统计分析、风险预警）
- 📄 管理报告生成

**快速开始**:
```typescript
import { PatentManagerAgent } from '@yunpat/agent-patent-manager';

const agent = new PatentManagerAgent({
  name: 'patent-manager',
  description: '专利管理智能体',
  eventBus,
  memory,
  tools,
  llm: openaiLLM,
});

// 添加专利
await agent.execute({
  operation: 'add_patent',
  patent: {
    applicationNumber: 'CN202310000000.0',
    title: '测试专利',
    applicant: '测试公司',
    inventors: ['张三'],
    patentType: 'invention',
    filingDate: new Date('2023-01-01'),
    status: 'filed',
  },
});

// 添加截止日期
await agent.execute({
  operation: 'add_deadline',
  applicationNumber: 'CN202310000000.0',
  deadline: {
    type: 'oa_response',
    deadlineDate: new Date('2024-12-31'),
    description: 'OA答复期限',
    priority: 'high',
    completed: false,
  },
});

// 获取专利组合概览
const portfolio = await agent.execute({
  operation: 'get_portfolio',
});

console.log(portfolio.data.statistics);
console.log(portfolio.data.riskAlerts);

// 生成管理报告
const report = await agent.execute({
  operation: 'generate_report',
});
console.log(report.data);
```

## 🧪 测试

所有智能体都有完整的单元测试和集成测试。

```bash
# 运行单个智能体测试
cd packages/agents/patent-writer && pnpm test
cd packages/agents/patent-analyzer && pnpm test
cd packages/agents/patent-responder && pnpm test
cd packages/agents/patent-manager && pnpm test

# 运行集成测试
cd packages/agents/test && npx vitest run
```

## 📊 测试覆盖

| 智能体 | 测试数量 | 通过率 |
|--------|---------|--------|
| PatentWriterAgent | 12 | 100% |
| PatentAnalyzerAgent | 16 | 100% |
| PatentResponderAgent | 18 | 100% |
| PatentManagerAgent | 21 | 100% |
| 集成测试 | 6 | 100% |
| **总计** | **73** | **100%** |

## 🔧 配置

### LLM 配置

所有智能体都需要配置 LLM 服务：

```typescript
import { OpenAI } from '@yunpat/llm';

const llm = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4',
  temperature: 0.3,
});
```

### 事件总线配置

```typescript
import { EventBus } from '@yunpat/core';

const eventBus = new EventBus();
```

### 内存配置

```typescript
import { ShortTermMemory } from '@yunpat/core';

const memory = new ShortTermMemory();
```

### 工具注册表配置

```typescript
import { ToolRegistry } from '@yunpat/core';

const tools = new ToolRegistry(eventBus);
```

## 💡 最佳实践

### 1. 错误处理

```typescript
try {
  const result = await agent.execute(input);
  // 处理结果
} catch (error) {
  if (error.message.includes('不能为空')) {
    // 处理验证错误
  } else {
    // 处理其他错误
  }
}
```

### 2. 进度监控

智能体会在执行过程中输出进度日志：

```
📝 [专利撰写] 步骤1: 规划阶段
   发明名称: xxx
✍️ [专利撰写] 步骤2: 执行阶段
   1️⃣ 生成权利要求...
   2️⃣ 生成说明书...
✅ [专利撰写] 完成
```

### 3. 结果验证

```typescript
// 验证必要字段
if (result.patentApplication?.claims?.length === 0) {
  throw new Error('权利要求未生成');
}

// 检查质量评分
if (result.metrics?.qualityScore < 70) {
  console.warn('质量评分较低，建议人工审核');
}
```

### 4. 批量处理

```typescript
const disclosures = [...]; // 多个技术交底书

const results = await Promise.all(
  disclosures.map(disclosure => agent.execute(disclosure))
);

// 统计结果
const stats = {
  total: results.length,
  success: results.filter(r => r.patentApplication).length,
  failed: results.filter(r => !r.patentApplication).length,
};
```

## 🔄 工作流集成

### 完整的专利流程

```typescript
import {
  PatentWriterAgent,
  PatentAnalyzerAgent,
  PatentResponderAgent,
  PatentManagerAgent,
} from '@yunpat/agents';

// 1. 撰写专利
const writer = new PatentWriterAgent({ ... });
const writeResult = await writer.execute(disclosure);

// 2. 分析专利
const analyzer = new PatentAnalyzerAgent({ ... });
const analysisResult = await analyzer.execute({
  patent: {
    publicationNumber: writeResult.applicationNumber,
    title: writeResult.title,
    abstract: writeResult.abstract,
  },
});

// 3. 管理专利
const manager = new PatentManagerAgent({ ... });
await manager.execute({
  operation: 'add_patent',
  patent: {
    applicationNumber: writeResult.applicationNumber,
    title: writeResult.title,
    status: 'filed',
    ...
  },
});

// 4. OA 答复（如果需要）
const responder = new PatentResponderAgent({ ... });
const responseResult = await responder.execute({
  officeAction: oaData,
  originalApplication: applicationData,
});
```

## 📚 相关文档

- [@yunpat/core](../core/README.md) - 核心框架文档
- [@yunpat/llm](../llm/README.md) - LLM 适配器文档
- [@yunpat/patent-knowledge](../patent-knowledge/README.md) - 专利知识库文档

## 🤝 贡献

欢迎贡献代码、报告问题或提出建议！

## 📄 许可证

MIT
