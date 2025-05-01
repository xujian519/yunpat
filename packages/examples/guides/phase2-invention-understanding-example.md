# Phase 2: 发明理解 - 端到端示例

本文档演示如何使用Phase 2完成的发明理解功能。

## 前置条件

1. 设置API密钥：

```bash
export DEEPSEEK_API_KEY=your_key_here
# 或
export OPENAI_API_KEY=your_key_here
```

2. 构建项目：

```bash
pnpm build
```

## 方式1: 使用CLI（推荐）

### 基本用法

```bash
node packages/cli/dist/index.js draft \
  --title "一种基于深度学习的图像识别方法" \
  --field "人工智能" \
  --disclosure examples/disclosure-example.md
```

### 保存结果到文件

```bash
node packages/cli/dist/index.js draft \
  --title "一种基于深度学习的图像识别方法" \
  --field "人工智能" \
  --disclosure examples/disclosure-example.md \
  --output invention-report.md
```

## 方式2: 使用代码

```typescript
import { InventionUnderstandingAgent } from '@yunpat/agent-invention'
import { HumanReadableRenderer } from '@yunpat/agent-invention'
import { EventBus, ShortTermMemory, ToolRegistry } from '@yunpat/core'
import { createDeepSeekModel } from '@yunpat/llm'

// 初始化组件
const eventBus = new EventBus()
const memory = new ShortTermMemory()
const tools = new ToolRegistry(eventBus)
const llm = createDeepSeekModel(process.env.DEEPSEEK_API_KEY!)

// 创建智能体
const agent = new InventionUnderstandingAgent({
  name: 'invention-understanding',
  description: '发明理解智能体',
  llm,
  memory,
  tools,
  eventBus,
})

// 执行分析
const result = await agent.execute({
  title: '一种基于深度学习的图像识别方法',
  field: '人工智能',
  technicalDisclosure: `
本发明提供一种基于深度学习的图像识别方法。

技术问题：
现有图像识别方法在复杂场景下准确率低，对光照变化敏感。

技术方案：
采用卷积神经网络提取图像特征，使用注意力机制增强关键区域，
引入残差连接解决深层网络梯度消失问题。

技术效果：
识别准确率提升20%，对光照变化的鲁棒性增强。
  `,
  drawings: ['图1: 系统整体架构图', '图2: 卷积神经网络结构图'],
})

// 渲染可读报告
const renderer = new HumanReadableRenderer()
const report = renderer.render(result)

console.log(report)
```

## 方式3: 使用工作流引擎

```typescript
import { WorkflowEngine } from '@yunpat/core'
import { createInventionUnderstandingWorkflow } from '@yunpat/workflows'
import { InventionUnderstandingAgent } from '@yunpat/agent-invention'

// 创建工作流
const workflow = createInventionUnderstandingWorkflow()

// 创建工作流引擎
const engine = new WorkflowEngine({
  eventBus,
  agents: {
    'invention-understanding': new InventionUnderstandingAgent({...}),
  },
  approvalFlow: undefined, // 可选：添加人机审批
  checkpointManager: undefined, // 可选：添加检查点持久化
})

// 执行工作流
const result = await engine.execute(workflow, {
  title: '一种基于深度学习的图像识别方法',
  field: '人工智能',
  technicalDisclosure: '...',
})

console.log(result)
```

## 预期输出

### 结构化JSON输出

```json
{
  "technicalField": "人工智能/计算机视觉",
  "backgroundArt": "现有图像识别方法主要基于传统特征提取...",
  "technicalProblem": "在复杂场景下准确率低，对光照变化敏感",
  "technicalSolution": "采用卷积神经网络提取图像特征，使用注意力机制增强关键区域...",
  "beneficialEffects": "识别准确率提升20%，对光照变化的鲁棒性增强",
  "keyFeatures": ["卷积神经网络特征提取", "注意力机制", "残差连接"],
  "drawingDescriptions": ["系统整体架构图", "卷积神经网络结构图"],
  "confidence": 0.92
}
```

### 人类可读报告

```markdown
# 发明理解报告

## 技术领域

人工智能/计算机视觉

## 背景技术

现有图像识别方法主要基于传统特征提取...

## 技术问题

在复杂场景下准确率低，对光照变化敏感

## 技术方案

采用卷积神经网络提取图像特征，使用注意力机制增强关键区域...

## 有益效果

识别准确率提升20%，对光照变化的鲁棒性增强

## 关键特征

1. 卷积神经网络特征提取
2. 注意力机制
3. 残差连接

## 附图说明

- 图1: 系统整体架构图
- 图2: 卷积神经网络结构图

---

分析置信度: 92.0%
```

## 验收标准

Phase 2完成的标准：

- [x] InventionUnderstandingAgent可以分析技术交底书
- [x] 输出结构化的发明理解结果
- [x] HumanReadableRenderer生成可读报告
- [x] CLI命令可以正常运行
- [x] 工作流定义完整
- [ ] 测试覆盖率达到目标（进行中）

## 下一步

完成Phase 2验收后，可以开始Phase 3：检索策略构建

---

**文档更新时间**: 2026-05-03
