# YunPat OrchestratorAgent 使用指南

## 概述

OrchestratorAgent是YunPat系统的中枢层，负责智能协调各个专业层Agent完成复杂的专利代理任务。

## 核心特性

### 5次LLM调用

1. **Call 1: 意图识别** - 识别用户意图（9种意图类型）
2. **Call 2: 任务规划** - 为复杂意图生成执行计划
3. **Call 3: HITL生成** - 在关键节点创建人机交互检查点
4. **Call 4: 结果聚合** - 聚合多个Agent的执行结果
5. **Call 5: 异常降级** - 智能处理错误和异常

### 集成的专业层Agent

- **PatentWriterAgent** - 专利撰写
- **PatentResponderAgent** - 审查意见答复
- **PatentAnalyzerAgent** - 专利分析
- **CreativeAnalyzerAgent** - 创造性评估

### 智能路由

- 自动识别意图复杂度
- 简单任务直接路由到专业Agent
- 复杂任务进行任务规划和编排

## 快速开始

### 基本使用

```typescript
import { OrchestratorAgent } from '@yunpat/orchestrator'

// 创建OrchestratorAgent实例
const orchestrator = new OrchestratorAgent({
  agentId: 'orchestrator-agent',
  llmConfig: {
    provider: 'anthropic',
    model: 'claude-3-5-sonnet-20241022',
    apiKey: process.env.ANTHROPIC_API_KEY,
    maxTokens: 4096,
    temperature: 0.7,
  },
  intentConfig: {
    confidenceThreshold: 0.7,
    enableFewShot: true,
    enableConfidenceEvaluation: true,
  },
  planningConfig: {
    maxSteps: 10,
    defaultTimeout: 60000,
    enableParallel: true,
  },
  hitlConfig: {
    enabled: true,
    timeout: 300000,
  },
  professionalAgents: {
    patentWriter: true,
    patentResponder: true,
    patentAnalyzer: true,
    creativeAnalyzer: true,
  },
})

// 执行编排
const result = await orchestrator.execute({
  sessionId: 'session-123',
  userId: 'user-456',
  message: '帮我撰写一个关于智能控制器的专利申请',
})

console.log(result.response)
```

### 处理HITL检查点

```typescript
// 执行请求
const result = await orchestrator.execute({
  sessionId: 'session-123',
  userId: 'user-456',
  message: '帮我撰写专利权利要求，需要人工确认',
})

// 检查是否需要HITL
if (result.requiresHITL && result.hitlRequests) {
  console.log('需要人工确认:')
  for (const request of result.hitlRequests) {
    console.log(`- ${request.description}`)
  }

  // 提交HITL响应
  const checkpointId = result.hitlRequests[0].checkpointId
  const hitlResponse = await orchestrator.submitHITLResponse(checkpointId, {
    action: 'confirm', // 或 'reject' 或 'modify'
  })

  console.log('HITL处理结果:', hitlResponse.status)
}
```

## 使用场景

### 场景1：完整专利撰写

```typescript
const result = await orchestrator.execute({
  sessionId: 'session-1',
  userId: 'user-1',
  message: `帮我撰写一个完整的专利申请，发明名称是"基于深度学习的智能控制系统"。
技术领域是工业自动化控制。技术交底书如下：
该系统包括数据采集模块、深度学习模型模块、控制执行模块。
数据采集模块用于采集工业设备运行数据，
深度学习模型模块用于预测设备状态，
控制执行模块根据预测结果进行智能控制。
该系统能够提高控制精度30%，降低能耗20%。`,
})

// 结果包含：
// - response: 生成的专利申请文件
// - metadata.performance: 性能指标
// - metadata.stats: 执行统计
```

### 场景2：审查意见答复

```typescript
const result = await orchestrator.execute({
  sessionId: 'session-2',
  userId: 'user-1',
  message: `我收到了审查意见，申请号是CN202310000000，
审查员认为权利要求1不具备新颖性。
引用的对比文件是CN112345678A。请帮我分析并制定答复策略。`,
})

// 结果包含：
// - response: 答复策略和答复文档
// - attachments: 修改后的权利要求书
```

### 场景3：专利分析

```typescript
const result = await orchestrator.execute({
  sessionId: 'session-3',
  userId: 'user-1',
  message: '请分析专利CN112345678A的创造性，对比专利CN112345679A',
})

// 结果包含：
// - response: 分析报告
// - attachments: 技术分析、权利要求分析、创造性评估
```

### 场景4：多任务处理

```typescript
const result = await orchestrator.execute({
  sessionId: 'session-4',
  userId: 'user-1',
  message: `我需要完成两个任务：
1. 撰写专利申请：智能温控系统
2. 分析专利：CN112345678A的创造性`,
})

// Orchestrator会自动识别多个意图并分别处理
```

## 性能监控

### 获取性能指标

```typescript
const result = await orchestrator.execute({
  sessionId: 'session-5',
  userId: 'user-1',
  message: '帮我撰写专利',
})

// 访问性能指标
if (result.metadata.metrics) {
  console.log('总执行时间:', result.metadata.metrics.totalDuration, 'ms')
  console.log('LLM调用次数:', result.metadata.metrics.llmCallsCount)
  console.log('意图识别时间:', result.metadata.metrics.intentRecognitionDuration, 'ms')
  console.log('任务规划时间:', result.metadata.metrics.taskPlanningDuration, 'ms')
  console.log('任务执行时间:', result.metadata.metrics.taskExecutionDuration, 'ms')
  console.log('结果聚合时间:', result.metadata.metrics.resultAggregationDuration, 'ms')
}
```

### 获取执行统计

```typescript
const result = await orchestrator.execute({
  sessionId: 'session-6',
  userId: 'user-1',
  message: '帮我撰写专利',
})

// 访问执行统计
if (result.metadata.stats) {
  console.log('执行的步骤数:', result.metadata.stats.stepsExecuted)
  console.log('成功的步骤数:', result.metadata.stats.successfulSteps)
  console.log('失败的步骤数:', result.metadata.stats.failedSteps)
  console.log('HITL检查点数:', result.metadata.stats.hitlCheckpoints)
}
```

## 上下文管理

### 获取对话历史

```typescript
const contextManager = orchestrator.getContextManager()
const history = await contextManager.getHistory('session-123')

for (const message of history) {
  console.log(`[${message.role}] ${message.content}`)
}
```

### 获取用户画像

```typescript
const contextManager = orchestrator.getContextManager()
const profile = await contextManager.getUserProfile('user-456')

console.log('用户角色:', profile.role)
console.log('总任务数:', profile.statistics.totalTasks)
console.log('平均任务时长:', profile.statistics.averageTaskDuration)
console.log('任务类型分布:', profile.statistics.taskTypes)
```

## 高级配置

### 自定义意图识别阈值

```typescript
const orchestrator = new OrchestratorAgent({
  // ... 其他配置
  intentConfig: {
    confidenceThreshold: 0.8, // 提高置信度阈值
    enableFewShot: true,
    enableConfidenceEvaluation: true,
  },
})
```

### 启用/禁用并行执行

```typescript
const orchestrator = new OrchestratorAgent({
  // ... 其他配置
  planningConfig: {
    maxSteps: 15,
    defaultTimeout: 90000,
    enableParallel: true, // 启用并行优化
  },
})
```

### 选择性启用专业Agent

```typescript
const orchestrator = new OrchestratorAgent({
  // ... 其他配置
  professionalAgents: {
    patentWriter: true,
    patentResponder: true,
    patentAnalyzer: false, // 禁用专利分析Agent
    creativeAnalyzer: false, // 禁用创造性分析Agent
  },
})
```

## 错误处理

### 处理执行错误

```typescript
try {
  const result = await orchestrator.execute({
    sessionId: 'session-7',
    userId: 'user-1',
    message: '帮我撰写专利',
  })

  if (result.metadata.stats && result.metadata.stats.failedSteps > 0) {
    console.warn('有步骤执行失败，但已降级处理')
  }

  console.log(result.response)
} catch (error) {
  console.error('执行失败:', error)
}
```

### 查看活跃的HITL检查点

```typescript
const activeCheckpoints = orchestrator.getActiveHITLCheckpoints()
console.log('活跃的HITL检查点:', activeCheckpoints.length)

for (const checkpoint of activeCheckpoints) {
  console.log(`- ${checkpoint.checkpointId}: ${checkpoint.status}`)
}
```

## 最佳实践

1. **使用会话ID** - 为每个用户会话使用唯一的sessionId，Orchestrator会自动管理对话历史
2. **提供清晰的输入** - 详细的输入能提高意图识别和任务规划的准确性
3. **处理HITL检查点** - 及时处理HITL请求，避免任务超时
4. **监控性能指标** - 定期检查性能指标，优化系统配置
5. **利用上下文** - Orchestrator会学习用户偏好，提供个性化服务

## 故障排查

### 问题：意图识别不准确

**解决方案**：

- 提供更详细的输入
- 降低confidenceThreshold
- 启用enableFewShot

### 问题：任务执行超时

**解决方案**：

- 增加defaultTimeout
- 减少maxSteps
- 启用enableParallel

### 问题：HITL检查点过多

**解决方案**：

- 在TaskPlanner中调整HITL检查点设置策略
- 禁用某些步骤的HITL

### 问题：性能慢

**解决方案**：

- 启用enableParallel
- 减少LLM调用次数
- 优化LLM模型选择

## 相关文档

- [Phase 4 Week 1完成报告](../docs/plans/phase4-day4-5-completion-report.md)
- [Phase 4 Week 2完成报告](../docs/plans/phase4-week2-completion-report.md)
- [Phase 4 Week 3完成报告](../docs/plans/phase4-week3-completion-report.md)
- [OrchestratorAgent API文档](./api/orchestrator.md)
