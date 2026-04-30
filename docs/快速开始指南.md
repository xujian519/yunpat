# YunPat 推理层增强 - 快速开始指南

## 📋 目录

- [安装](#安装)
- [快速开始](#快速开始)
- [核心功能](#核心功能)
- [示例代码](#示例代码)
- [API参考](#api参考)
- [常见问题](#常见问题)

---

## 安装

### 1. 安装依赖

```bash
# 克隆仓库
git clone https://github.com/your-org/YunPat.git
cd YunPat

# 安装依赖
pnpm install

# 构建项目
pnpm build
```

### 2. 环境配置

创建 `.env` 文件：

```bash
# DeepSeek API (推荐)
DEEPSEEK_API_KEY=sk-xxxxxxxx

# 或使用通义千问
DASHSCOPE_API_KEY=sk-xxxxxxxx
```

---

## 快速开始

### 基础使用

```typescript
import {
  Agent,
  createDeepSeekModel,
  PatentWriterAgent
} from '@yunpat/core';

// 1. 创建LLM实例
const llm = createDeepSeekModel(process.env.DEEPSEEK_API_KEY);

// 2. 创建智能体
const agent = new PatentWriterAgent({
  llm,
  knowledgeBase,
});

// 3. 执行任务
const result = await agent.run({
  title: '一种数据处理装置',
  description: '包括处理器、存储器和总线...',
  type: 'utility',
});

console.log(result.content);
```

---

## 核心功能

### 1. 幻觉检测系统

自动检测专利文档中的事实错误和逻辑矛盾。

```typescript
import { HallucinationDetector } from '@yunpat/core';

const detector = new HallucinationDetector(knowledgeBase, {
  enableFactCheck: true,
  enableLogicalCheck: true,
  enableSourceCheck: true,
});

const report = await detector.detect(patentContent);

console.log(`幻觉分数: ${report.overallScore}`);
console.log(`发现问题: ${report.factCheckResults.length + report.logicalInconsistencies.length}`);
```

### 2. 目标分解系统

将复杂任务自动分解为可执行的子任务。

```typescript
import { TaskDecomposer } from '@yunpat/core';

const decomposer = new TaskDecomposer(llm);

const plan = await decomposer.depose('撰写一份专利申请', {
  maxDepth: 3,
  enableParallel: true,
});

console.log(`分解为 ${plan.subGoals.length} 个子目标`);
console.log(`预估时间: ${plan.estimatedDuration}秒`);
```

### 3. Constitutional AI

确保专利文档符合专利法规范。

```typescript
import { ConstitutionalAI, PATENT_PRINCIPLES } from '@yunpat/core';

const ai = new ConstitutionalAI(PATENT_PRINCIPLES, llm);

// 检查合规性
const report = await ai.checkCompliance(patentContent);

if (!report.overallCompliant) {
  console.log(`发现 ${report.violations.length} 个违规`);

  // 自动纠正
  const correction = await ai.correct(patentContent);
  console.log(correction.correctedContent);
}
```

### 4. 动态重规划系统

任务失败时自动调整策略。

```typescript
import { DynamicReplanner } from '@yunpat/core';

const replanner = new DynamicReplanner(null, {
  enableDeviationDetection: true,
  enableFailureDetection: true,
  deviationThreshold: 0.2,
});

// 检测是否需要重规划
const { shouldReplan, trigger } = await replanner.shouldReplan(
  plannedState,
  actualState
);

if (shouldReplan) {
  const result = await replanner.replan(currentPlan, actualState, trigger);
  console.log(`重规划完成，置信度: ${result.confidence}`);
}
```

### 5. 任务依赖图可视化

在CLI中可视化任务依赖关系。

```typescript
import { DependencyVisualizer } from '@yunpat/cli';

const visualizer = new DependencyVisualizer();

// 文本渲染
const result = visualizer.render(plan, {
  format: 'text',
  showProgress: true,
  showMetrics: true,
});

console.log(result.content);

// 导出为PNG
await visualizer.export(plan, {
  format: ExportFormat.PNG,
  outputPath: './dependency-graph.png',
  width: 1200,
  height: 800,
});
```

---

## 示例代码

### 完整的专利撰写流程

```typescript
import {
  PatentWriterAgent,
  HallucinationDetector,
  ConstitutionalAI,
  TaskDecomposer,
  DynamicReplanner,
  createDeepSeekModel,
  PATENT_PRINCIPLES,
} from '@yunpat/core';
import { DependencyVisualizer } from '@yunpat/cli';

async function writePatentWithQualityControl(input: PatentInput) {
  // 1. 初始化组件
  const llm = createDeepSeekModel(process.env.DEEPSEEK_API_KEY);
  const taskDecomposer = new TaskDecomposer(llm);
  const hallucinationDetector = new HallucinationDetector(knowledgeBase);
  const constitutionalAI = new ConstitutionalAI(PATENT_PRINCIPLES, llm);
  const dynamicReplanner = new DynamicReplanner();

  // 2. 创建智能体
  const agent = new PatentWriterAgent({
    llm,
    taskDecomposer,
    hallucinationDetector,
    constitutionalAI,
    dynamicReplanner,
  });

  // 3. 分解任务
  const plan = await taskDecomposer.decompose(input.description);

  // 4. 可视化任务依赖
  const visualizer = new DependencyVisualizer();
  console.log(visualizer.render(plan, { format: 'tree' }).content);

  // 5. 执行撰写
  const result = await agent.run(input);

  // 6. 质量检查
  const hallucinationReport = await hallucinationDetector.detect(result.content);
  const complianceReport = await constitutionalAI.checkCompliance(result.content);

  // 7. 输出结果
  console.log('=== 撰写完成 ===');
  console.log(`幻觉分数: ${hallucinationReport.overallScore}`);
  console.log(`合规分数: ${complianceReport.score}`);
  console.log(`内容长度: ${result.content.length} 字符`);

  return {
    content: result.content,
    quality: {
      hallucinationScore: hallucinationReport.overallScore,
      complianceScore: complianceReport.score,
    },
  };
}

// 使用示例
const result = await writePatentWithQualityControl({
  title: '一种数据处理装置',
  description: '包括处理器、存储器和总线...',
  type: 'utility',
});
```

### 批量处理多个专利

```typescript
import { PatentWriterAgent } from '@yunpat/core';
import { TaskDecomposer } from '@yunpat/core';

async function batchProcessPatents(inputs: PatentInput[]) {
  const decomposer = new TaskDecomposer(llm);

  // 并行分解任务
  const plans = await Promise.all(
    inputs.map(input => decomposer.decompose(input.description))
  );

  // 按优先级排序
  const sortedPlans = plans.sort((a, b) => {
    const aPriority = a.subGoals.reduce((sum, g) => sum + g.priority, 0);
    const bPriority = b.subGoals.reduce((sum, g) => sum + g.priority, 0);
    return bPriority - aPriority;
  });

  // 串行执行（避免资源竞争）
  const results = [];
  for (const plan of sortedPlans) {
    const agent = new PatentWriterAgent({ llm });
    const result = await agent.run(plan);
    results.push(result);
  }

  return results;
}
```

---

## API参考

### HallucinationDetector

```typescript
class HallucinationDetector {
  constructor(
    knowledgeBase: KnowledgeBase,
    config?: HallucinationDetectorConfig
  )

  async detect(content: string): Promise<HallucinationReport>
}

interface HallucinationReport {
  overallScore: number;              // 0-1，越低越好
  factCheckResults: FactCheckResult[];
  logicalInconsistencies: Inconsistency[];
  sourceAttributionIssues: SourceIssue[];
  suggestions: ImprovementSuggestion[];
}
```

### ConstitutionalAI

```typescript
class ConstitutionalAI {
  constructor(
    principles: ConstitutionalPrinciple[],
    llm: LLMAdapter
  )

  async checkCompliance(content: string): Promise<ComplianceReport>
  async correct(content: string): Promise<CorrectionResult>
}

interface ComplianceReport {
  overallCompliant: boolean;
  violations: Violation[];
  warnings: Warning[];
  score: number;                     // 0-1，越高越好
}
```

### DynamicReplanner

```typescript
class DynamicReplanner {
  constructor(
    llm: LLMAdapter | null,
    config?: Partial<DynamicReplannerConfig>
  )

  async shouldReplan(
    plannedState: ExecutionState,
    actualState: ExecutionState
  ): Promise<{ shouldReplan: boolean; trigger?: ReplanningTrigger }>

  async replan(
    currentPlan: HierarchicalPlan,
    executionState: ExecutionState,
    trigger: ReplanningTrigger
  ): Promise<ReplanningResult>
}
```

### DependencyVisualizer

```typescript
class DependencyVisualizer {
  constructor()

  render(
    plan: HierarchicalPlan,
    options?: VisualizationOptions
  ): RenderResult

  async export(
    plan: HierarchicalPlan,
    options: ExportOptions
  ): Promise<void>
}

enum ExportFormat {
  DOT = 'dot',
  PNG = 'png',
  SVG = 'svg',
  JSON = 'json',
  MERMAID = 'mermaid',
}
```

---

## 常见问题

### Q1: 如何提高幻觉检测的准确率？

**A**:
1. 提供更丰富的知识库
2. 调整检测阈值（`deviationThreshold`, `qualityDropThreshold`）
3. 启用LLM辅助检测（`useLLMForAnalysis: true`）
4. 定期更新知识库内容

### Q2: Constitutional AI太严格怎么办？

**A**:
1. 调整原则优先级
2. 禁用某些原则（`enabledPrinciples`）
3. 降低阈值（`threshold`）
4. 只使用警告而非强制纠正

### Q3: 如何优化重规划性能？

**A**:
1. 减少检测频率（`deviationThreshold`）
2. 禁用不必要的检测（`enableTimeoutDetection: false`）
3. 使用缓存避免重复检测
4. 调整策略选择算法

### Q4: 导出PNG时提示缺少Graphviz？

**A**:
```bash
# macOS
brew install graphviz

# Ubuntu/Debian
sudo apt-get install graphviz

# Windows
# 下载并安装: https://graphviz.org/download/
```

### Q5: 如何自定义渲染样式？

**A**:
```typescript
const visualizer = new DependencyVisualizer();
const textRenderer = visualizer.getTextRenderer();

// 设置节点样式
textRenderer.setNodeStyle('completed', {
  shape: 'box',
  color: '#388e3c',
  fillColor: '#e8f5e9',
  borderColor: '#4caf50',
  borderWidth: 2,
  fontSize: 14,
  fontColor: '#1b5e20',
});

// 设置边样式
textRenderer.setEdgeStyle('strong', {
  color: '#1976d2',
  style: 'solid',
  thickness: 3,
});
```

---

## 性能优化建议

### 1. 启用缓存

```typescript
const detector = new HallucinationDetector(knowledgeBase, {
  enableCache: true,
  cacheTTL: 3600000, // 1小时
});
```

### 2. 并行处理

```typescript
const plans = await Promise.all(
  inputs.map(input => decomposer.decompose(input))
);
```

### 3. 增量更新

```typescript
// 只重新检测变更的部分
const newReport = await detector.detectIncremental(
  oldContent,
  newContent,
  oldReport
);
```

---

## 下一步

- 查看 [API参考文档](./API参考.md)
- 阅读 [架构设计文档](./架构设计.md)
- 浏览 [示例代码](../examples/)
- 加入 [社区讨论](https://github.com/your-org/YunPat/discussions)

---

**最后更新**: 2026-04-30
**版本**: v0.2.0
