# 徐健写作风格使用指南

## 🎯 风格特征总结

基于对您文档的分析，我提取了以下核心写作风格特征：

### 📌 核心特征

1. **结构化程度高** - 使用清晰的层级结构（#、##、###）
2. **金字塔原理** - 先说结论，再展开论述
3. **举例丰富** - 大量使用实际案例说明问题
4. **专业性强** - 技术术语保留英文，但会进行解释
5. **符号丰富** - 大量使用 emoji、表格、代码块、列表

### ✨ 开头方式

**常用开头模式**：
```
- 基于{背景}，{主题}...
- {主题}是{领域}的重要组成部分...
- 本文将介绍/分析/讨论{主题}...
- 在{领域}中，{主题}扮演着重要角色...
```

### 🎨 格式习惯

**格式元素使用频率**：
- ✅ **层级标题**：# ## ###（频繁使用）
- ✅ **加粗强调**：**核心**、**关键**（频繁）
- ✅ **代码块**：```代码示例```（频繁）
- ✅ **表格**：| 对比 | 分析 |（频繁）
- ✅ **列表**：1. 2. 3. 或 ①②③（频繁）
- ✅ **Emoji**：🎯 ✨ 💡（适度使用）
- ✅ **分隔线**：---（划分章节）

### 🔗 逻辑结构

**标准论述流程**：
```
1. 概述/简介（直接切入主题）
2. 核心内容/主体（分层论述）
3. 案例分析/实例说明（具体例子）
4. 对比分析（如有需要）
5. 总结/结论（必须包含）
```

### 📝 句式特征

**常用句式**：
- 总的来说，... / 综上所述，... / 简而言之，...
- 具体而言，... / 具体来说，...
- 例如，... / 举个例子，...
- 基于{原理}，... / 根据{标准}，...
- 值得注意的是，... / 需要强调的是，...

---

## 🚀 快速使用

### 方式 1：直接使用风格配置

```typescript
import { WriterAgent } from '@yunpat/agent-writer';
import { generateXuJianStylePrompt } from '../../config/writing-style-xujian.js';

const writer = new WriterAgent({
  eventBus,
  memory,
  tools,
  llm
});

const result = await writer.execute({
  type: 'generate',
  topic: 'Docker 容器化技术的优势',
  requirements: [
    generateXuJianStylePrompt('Docker 容器化技术')
  ]
});
```

### 方式 2：使用便捷函数

```typescript
import { writeInXuJianStyle } from '@yunpat/agent-writer';

const result = await writeInXujianStyle(
  '微服务架构设计原则',
  { eventBus, memory, tools, llm }
);
```

### 方式 3：批量生成

```typescript
import { batchWriteInXuJianStyle } from '@yunpat/agent-writer';

const topics = [
  'Docker 容器化技术',
  'AI 模型部署最佳实践',
  '专利审查指南'
];

const results = await batchWriteInXuJianStyle(
  topics,
  { eventBus, memory, tools, llm }
);
```

---

## 📋 完整示例

```typescript
// 1. 导入必要的模块
import { writeInXuJianStyle } from '@yunpat/agent-writer';
import { createDeepSeekModel } from '@yunpat/core';

// 2. 配置 LLM
const llm = createDeepSeekModel(process.env.DEEPSEEK_API_KEY);

// 3. 配置其他依赖
const eventBus = /* ... */;
const memory = /* ... */;
const tools = /* ... */;

// 4. 生成文档
const result = await writeInXuJianStyle(
  'WebChat 协作系统的架构设计',
  { eventBus, memory, tools, llm }
);

// 5. 输出结果
console.log(result.document.content);
// 或者保存到文件
fs.writeFileSync('output.md', result.document.content);
```

---

## 🎨 风格效果对比

### 不使用风格模仿

```markdown
# Docker 简介

Docker 是一个开源的容器化平台。它允许开发者将应用及其依赖打包到容器中。容器化技术有很多优势...

## 主要特性

1. 环境一致性
2. 资源隔离
3. 快速部署

## 结论

Docker 是一个很有用的工具。
```

### 使用徐健风格

```markdown
# Docker 容器化技术：从理论到实践的全面解析

## 🎯 核心优势

说实话，Docker 这玩意儿最大的优点就俩字：解耦。你想啊，以前单体应用改个功能，牵一发动全身，现在好了，各管各的，出问题也好排查。

## 1. 环境一致性：一次配置，到处运行

基于容器化的"构建一次，到处运行"理念，Docker 解决了传统部署中的环境不一致问题。具体来说：

### 传统部署的痛点
- 开发环境：Python 3.8 + Node 16
- 测试环境：Python 3.9 + Node 18
- 生产环境：Python 3.7 + Node 14
- 问题：环境差异导致"在我机器上能跑"问题频发

### Docker 的解决方案
- 镜像打包：包含应用 + 所有依赖
- 环境隔离：每个容器独立运行
- 版本固定：避免"依赖地狱"

## 2. 资源隔离：进程级别的虚拟化

相较于虚拟机的硬件级虚拟化，Docker 容器采用操作系统级虚拟化...

## 📊 总结

总的来说，Docker 容器化技术通过环境一致性、资源隔离和快速部署三大优势，彻底改变了软件交付的方式。
```

---

## 🔧 高级配置

### 调整风格配置

```typescript
import { xuJianWritingStyle } from '../../config/writing-style-xujian.js';

// 自定义风格
const myCustomStyle = {
  ...xuJianWritingStyle,
  vocabulary: {
    ...xuJianWritingStyle.vocabulary,
    // 添加你的常用词
    preferredWords: [
      ...xuJianWritingStyle.vocabulary.preferredWords,
      '咱们', '说白了', '实际上'
    ]
  },
  organization: {
    ...xuJianWritingStyle.organization,
    // 自定义章节结构
    sections: [
      '问题背景',
      '技术方案',
      '实施步骤',
      '风险分析',
      '预期效果'
    ]
  }
};
```

### 持续学习优化

```typescript
// 1. 收集你的写作样本
const myDocuments = [
  '/path/to/doc1.md',
  '/path/to/doc2.md',
  '/path/to/doc3.md'
];

// 2. 学习风格
import { learnWritingStyleFromDocuments } from '@yunpat/agent-writer';
const learnedStyle = await learnWritingStyleFromDocuments(myDocuments);

// 3. 使用优化后的风格
const result = await writer.execute({
  type: 'generate',
  topic: '新主题',
  requirements: [
    generateStylePrompt(learnedStyle)
  ]
});
```

---

## 📊 风格统计

基于文档分析的统计数据：

| 指标 | 数值/特征 |
|------|----------|
| **平均段落长度** | 150 字符 |
| **平均句长** | 20-40 字 |
| **Emoji 使用频率** | 适中（每 3-5 段落） |
| **表格使用频率** | 高（对比分析必用） |
| **代码块使用频率** | 高（技术说明必用） |
| **列表使用频率** | 高（分点论述必用） |
| **引用来源频率** | 高（权威引用） |
| **举例说明频率** | 高（案例丰富） |

---

## 💡 最佳实践

1. **提供具体主题** - 越具体越好
2. **包含参考资料** - 提供相关文档或链接
3. **明确目标读者** - 说明是给谁看的
4. **指定字数范围** - 控制生成内容长度
5. **多轮优化** - 第一次生成后根据结果调整

---

## 🎯 下一步

1. **测试基础功能**：
   ```bash
   pnpm test
   ```

2. **运行示例**：
   ```bash
   ts-node examples/usage-style-mimicry.ts
   ```

3. **集成到项目**：
   - 将风格配置集成到你的写作流程
   - 创建自动化脚本批量生成文档
   - 建立文档模板库

4. **持续优化**：
   - 收集更多写作样本
   - 调整风格配置
   - 训练个性化模型（可选）
