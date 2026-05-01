# GLM (智谱 AI) 模型使用指南

## 概述

YunPat 框架已集成智谱 GLM 系列模型，支持 GLM-4-Flash、GLM-4-Plus、GLM-4.7 等多个版本。

## 快速开始

### 1. 获取 API Key

访问 [智谱 AI 开放平台](https://open.bigmodel.cn/) 注册并获取 API Key。

### 2. 设置环境变量

```bash
export GLM_API_KEY=your_api_key_here
```

或创建 `.env.glm` 文件：

```bash
cat > .env.glm << EOF
GLM_API_KEY=your_api_key_here
GLM_MODEL=glm-4-flash
EOF

# 加载环境变量
source .env.glm
```

### 3. 运行测试

```bash
# 方式 1: 使用测试脚本
./test-glm.sh

# 方式 2: 直接运行
pnpm --filter @yunpat/core exec tsx test-glm.ts

# 方式 3: 运行示例
pnpm --filter @yunpat/core exec tsx examples/glm-usage.ts
```

## 支持的模型

| 模型 | 说明 | 适用场景 |
|------|------|---------|
| `glm-4.7` | 2025 最新旗舰 | 复杂推理、深度分析 |
| `glm-4-flash` | 快速响应 | 实时对话、快速测试 |
| `glm-4-plus` | 平衡性能 | 通用场景、日常使用 |
| `glm-4-air` | 轻量级 | 边缘设备、低资源环境 |
| `glm-3-turbo` | 旧版本 | 兼容性需求 |

## 使用方式

### 方式 1: 使用工厂函数（推荐）

```typescript
import { createZhipuModel, NativeModel } from '@yunpat/core';

// 创建 GLM-4-Flash 模型
const glm = createZhipuModel(process.env.GLM_API_KEY!, NativeModel.GLM_4_FLASH);

// 创建 GLM-4.7 模型（默认）
const glm47 = createZhipuModel(process.env.GLM_API_KEY!);

// 对话
const response = await glm.chat({
  messages: [
    {
      role: 'user',
      content: '你好！',
    },
  ],
});

console.log(response.content);
```

### 方式 2: 直接使用 NativeLLMAdapter

```typescript
import { NativeLLMAdapter, NativeModel } from '@yunpat/core';

const glm = new NativeLLMAdapter({
  name: NativeModel.GLM_4_FLASH,
  apiKey: process.env.GLM_API_KEY!,
  baseURL: 'https://open.bigmodel.cn/api/paas/v4',
});
```

### 方式 3: 与 Gateway 集成

```typescript
import { BaseGateway } from '@yunpat/core';
import { createZhipuModel, NativeModel } from '@yunpat/core';

const gateway = new BaseGateway({
  llm: createZhipuModel(process.env.GLM_API_KEY!, NativeModel.GLM_4_FLASH),
});

const result = await gateway.processInput({
  content: '分析一下 TypeScript 的优缺点',
  userId: 'user-123',
  agentName: 'AnalysisAgent',
});
```

## 编程套餐使用

GLM 模型特别适合编程任务，以下是一些示例：

### 代码生成

```typescript
const glm = createZhipuModel(apiKey, NativeModel.GLM_4_FLASH);

const response = await glm.chat({
  messages: [
    {
      role: 'user',
      content: '用 TypeScript 写一个二叉树遍历函数，包含类型注释和错误处理。',
    },
  ],
  temperature: 0.2, // 降低温度以获得更确定的代码
  maxTokens: 1000,
});

console.log(response.content);
```

### 代码审查

```typescript
const codeReview = await glm.chat({
  messages: [
    {
      role: 'user',
      content: `请审查以下 TypeScript 代码，指出潜在问题和改进建议：

\`\`\`typescript
function processData(data: any[]) {
  return data.map(item => ({
    value: item.value * 2,
    name: item.name
  }));
}
\`\`\`

请关注：
1. 类型安全
2. 错误处理
3. 性能优化
4. 代码规范`,
    },
  ],
  temperature: 0.3,
});
```

### 单元测试生成

```typescript
const testGeneration = await glm.chat({
  messages: [
    {
      role: 'user',
      content: `为以下函数生成单元测试（使用 Vitest）：

\`\`\`typescript
export function calculateDiscount(price: number, discount: number): number {
  if (price < 0 || discount < 0 || discount > 100) {
    throw new Error('Invalid input');
  }
  return price * (1 - discount / 100);
}
\`\`\`

要求：
1. 测试正常情况
2. 测试边界条件
3. 测试异常情况`,
    },
  ],
  temperature: 0.2,
});
```

## 高级功能

### 流式输出

```typescript
const stream = glm.streamChat({
  messages: [
    {
      role: 'user',
      content: '写一个快速排序算法',
    },
  ],
});

for await (const chunk of stream) {
  if (chunk.content) {
    process.stdout.write(chunk.content);
  }
}
```

### 多轮对话

```typescript
const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

// 第一轮
messages.push({ role: 'user', content: '什么是 React？' });
const response1 = await glm.chat({ messages });
messages.push({ role: 'assistant', content: response1.content });

// 第二轮
messages.push({ role: 'user', content: '它和 Vue 有什么区别？' });
const response2 = await glm.chat({ messages });
```

### 参数调优

```typescript
const glm = new NativeLLMAdapter({
  name: NativeModel.GLM_4_FLASH,
  apiKey: process.env.GLM_API_KEY!,
  baseURL: 'https://open.bigmodel.cn/api/paas/v4',
  temperature: 0.7,    // 控制随机性（0-1，默认 0.7）
  maxTokens: 4096,     // 最大输出 token 数（默认 4096）
});
```

## 性能对比

| 模型 | 响应速度 | 代码质量 | 推理能力 | 成本 |
|------|---------|---------|---------|------|
| GLM-4-Flash | ⚡⚡⚡⚡⚡ | ⭐⭐⭐⭐ | ⭐⭐⭐ | 低 |
| GLM-4-Plus | ⚡⚡⚡⚡ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 中 |
| GLM-4.7 | ⚡⚡⚡ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 高 |

## 最佳实践

### 1. 选择合适的模型

- **快速测试**: 使用 `GLM-4-Flash`
- **日常开发**: 使用 `GLM-4-Plus`
- **复杂任务**: 使用 `GLM-4.7`

### 2. 优化代码生成

```typescript
// 降低温度以获得更确定的代码
const codeResponse = await glm.chat({
  messages: [...],
  temperature: 0.2,
  maxTokens: 2000,
});
```

### 3. 使用结构化提示

```typescript
const structuredPrompt = `
请按照以下格式生成代码：

## 类型定义
[定义 TypeScript 接口和类型]

## 函数实现
[实现函数逻辑，包含错误处理]

## 使用示例
[提供使用示例]

## 单元测试
[提供关键测试用例]
`;
```

### 4. 处理长代码

```typescript
// 对于长代码，分块处理
const chunks = splitLongCode(code);

for (const chunk of chunks) {
  const response = await glm.chat({
    messages: [
      {
        role: 'user',
        content: `审查以下代码片段：\n\n${chunk}`,
      },
    ],
  });
}
```

## 错误处理

```typescript
try {
  const response = await glm.chat({
    messages: [...],
  });
} catch (error) {
  if (error.message.includes('401')) {
    console.error('API Key 无效');
  } else if (error.message.includes('429')) {
    console.error('请求过于频繁，请稍后重试');
  } else if (error.message.includes('quota')) {
    console.error('API 额度已用尽');
  } else {
    console.error('未知错误:', error);
  }
}
```

## 配额和限制

- **免费额度**: 新用户有一定的免费额度
- **速率限制**: 根据套餐不同，有不同的 QPS 限制
- **Token 限制**: 每个模型有最大 token 限制

查看详情: https://open.bigmodel.cn/pricing

## 相关链接

- [智谱 AI 官网](https://zhipuai.cn/)
- [智谱开放平台](https://open.bigmodel.cn/)
- [GLM-4 API 文档](https://open.bigmodel.cn/dev/api)
- [定价说明](https://open.bigmodel.cn/pricing)

## 故障排除

### 问题 1: API Key 无效

```bash
# 检查环境变量
echo $GLM_API_KEY

# 重新设置
export GLM_API_KEY=your_correct_api_key
```

### 问题 2: 网络超时

```typescript
const glm = new NativeLLMAdapter({
  name: NativeModel.GLM_4_FLASH,
  apiKey: process.env.GLM_API_KEY!,
  baseURL: 'https://open.bigmodel.cn/api/paas/v4',
  timeout: 30000, // 增加超时时间到 30 秒
});
```

### 问题 3: 输出被截断

```typescript
const response = await glm.chat({
  messages: [...],
  maxTokens: 8192, // 增加 maxTokens
});
```

## 示例代码

完整示例请参考：

- `test-glm.ts` - 基础测试
- `examples/glm-usage.ts` - 完整使用示例
- `examples/basic-usage.ts` - 框架基础用法

## 技术支持

如有问题，请访问：

- [GitHub Issues](https://github.com/xujian519/yunpat/issues)
- [智谱 AI 技术支持](https://open.bigmodel.cn/contact)
