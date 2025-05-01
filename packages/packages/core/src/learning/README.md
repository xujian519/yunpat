# 主动学习系统使用指南

## 概述

主动学习系统（ActiveLearningSystem）是 YunPat P2 准确率优化方案的核心组件，通过让模型主动选择最有价值的样本请求人工标注，以更少的标注成本达到更高的准确率。

## 核心特性

### 1. 不确定性估计

- 预测不确定性：基于模型输出的置信度
- 语义不确定性：基于输入的模糊程度
- 分布不确定性：基于多次预测的一致性

### 2. 主动标注选择

- **不确定性采样**：选择模型最不确定的样本
- **多样性采样**：选择最具代表性的样本
- **期望模型变化**：选择对模型影响最大的样本

### 3. 模型微调

- 基于新标注数据持续优化
- 支持渐进式学习
- 自动计算学习效率

### 4. 学习效果评估

- A/B 测试支持
- 增量评估
- 准确率趋势追踪

## 快速开始

```typescript
import { createActiveLearningSystem, createDeepSeekModel } from '@yunpat/core'

// 1. 创建 LLM 适配器
const llm = createDeepSeekModel(process.env.DEEPSEEK_API_KEY)

// 2. 创建主动学习系统
const activeLearning = createActiveLearningSystem(llm, {
  strategy: 'uncertainty-sampling', // 采样策略
  annotationBudget: 10, // 每轮标注数量
  uncertaintyThreshold: 0.7, // 触发主动学习的不确定性阈值
  enableABTest: true, // 启用 A/B 测试
  enableIncrementalLearning: true, // 启用渐进式学习
})

// 3. 设置初始准确率
activeLearning.setInitialAccuracy(0.75)

// 4. 添加预测结果样本
const result = {
  input: '用户查询内容',
  result: '模型预测结果',
  confidence: 0.6,
}

const sample = activeLearning.addSample(result, 'prediction')

// 5. 选择需要标注的样本
const samplesToAnnotate = activeLearning.selectSamplesForAnnotation()

// 6. 获取人工标注后添加到系统
activeLearning.addAnnotation(sample.id, {
  id: uuidv4(),
  label: '正确答案',
  annotator: '专家A',
  timestamp: new Date(),
  confidence: 1.0,
})

// 7. 更新模型
const updateResult = await activeLearning.updateModel([sample])

// 8. 获取学习指标
const metrics = activeLearning.getMetrics()
console.log('学习效率:', metrics.learningEfficiency)
```

## 主动学习循环

```typescript
// 运行完整的主动学习轮次
const round = await activeLearning.runLearningRound()

console.log('轮次:', round.round)
console.log('选择样本数:', round.metrics.samplesRequested)
console.log('获取标注数:', round.metrics.samplesAnnotated)
console.log('准确率提升:', round.updateResult?.accuracyGain)
```

## A/B 测试

```typescript
// 运行 A/B 测试
const abTestResult = await activeLearning.runABTest(
  controlSamples, // 对照组样本
  treatmentSamples // 实验组样本
)

console.log('对照组准确率:', abTestResult.controlAccuracy)
console.log('实验组准确率:', abTestResult.treatmentAccuracy)
console.log('提升:', abTestResult.lift)
console.log('是否显著:', abTestResult.isSignificant)
```

## 集成点

### 与 ResultValidator 配合

高不确定性结果自动触发主动学习：

```typescript
import { ResultValidator } from '@yunpat/core'

const validator = new ResultValidator({
  onHighUncertainty: async (result) => {
    const sample = activeLearning.addSample(result)
    // 自动选择并请求标注
  },
})
```

### 与 ApprovalFlow 配合

请求人工标注：

```typescript
import { ApprovalFlow } from '@yunpat/core'

const approvalFlow = new ApprovalFlow({
  async onApprovalRequest(sample) {
    const annotation = await activeLearning.annotateWithHuman(sample, '专家')
    // 标注完成后自动更新
  },
})
```

### 与 KnowledgeBase 配合

标注结果入库：

```typescript
import { KnowledgeBase } from '@yunpat/core'

knowledgeBase.add({
  content: `Q: ${sample.input}\nA: ${annotation.label}`,
  metadata: { source: 'active-learning', annotator: annotation.annotator },
})
```

## 验收标准

- ✅ 通过 `pnpm --filter @yunpat/core build` 编译
- ✅ 更新 `packages/core/src/index.ts` 导出
- ✅ 支持至少 2 种主动学习策略（不确定性采样、多样性采样、期望模型变化）
- ✅ 学习效率提升 > 50%（达到相同准确率需更少样本）
