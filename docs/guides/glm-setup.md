# GLM 编程套餐测试完成 ✅

## 已创建的文件

### 1. 测试文件
- `test-glm.ts` - GLM 模型基础测试（5 个测试场景）
- `test-glm.sh` - 测试执行脚本
- `verify-glm-setup.sh` - 配置验证脚本

### 2. 示例文件
- `examples/glm-usage.ts` - 6 个完整使用示例
  - 直接使用 GLM 模型
  - 与 Gateway 集成
  - 使用不同 GLM 模型
  - 流式输出
  - 多轮对话
  - 代码生成（编程套餐）

### 3. 文档
- `docs/guides/glm-usage.md` - 完整使用指南
- `QUICKSTART_GLM.md` - 快速开始指南
- `.env.glm` - 环境变量模板

## 快速开始

### 步骤 1: 获取 API Key

访问 [智谱 AI 开放平台](https://open.bigmodel.cn/) 注册并获取 API Key。

### 步骤 2: 设置环境变量

```bash
# 方式 1: 直接设置
export GLM_API_KEY=your_api_key_here

# 方式 2: 使用配置文件
source .env.glm
```

### 步骤 3: 验证配置

```bash
./verify-glm-setup.sh
```

### 步骤 4: 运行测试

```bash
# 运行基础测试
./test-glm.sh

# 或直接运行
pnpm --filter @yunpat/core exec tsx test-glm.ts

# 运行完整示例
pnpm --filter @yunpat/core exec tsx examples/glm-usage.ts
```

## 支持的 GLM 模型

| 模型 | 说明 | 适用场景 |
|------|------|---------|
| `glm-4-flash` | 快速响应 | 实时对话、快速测试 ✅ |
| `glm-4-plus` | 平衡性能 | 日常开发、通用任务 |
| `glm-4.7` | 最新旗舰 | 复杂推理、深度分析 |
| `glm-4-air` | 轻量级 | 边缘设备、低资源环境 |
| `glm-3-turbo` | 旧版本 | 兼容性需求 |

## 编程套餐特性

GLM 模型在编程任务上表现优异：

### 1. 代码生成
```typescript
const glm = createZhipuModel(apiKey, NativeModel.GLM_4_FLASH);

const response = await glm.chat({
  messages: [
    {
      role: 'user',
      content: '用 TypeScript 写一个二叉树遍历函数',
    },
  ],
  temperature: 0.2,
});

console.log(response.content);
```

### 2. 代码审查
```typescript
const review = await glm.chat({
  messages: [
    {
      role: 'user',
      content: '审查以下 TypeScript 代码，指出潜在问题：\n\n' + code,
    },
  ],
  temperature: 0.3,
});
```

### 3. 单元测试生成
```typescript
const tests = await glm.chat({
  messages: [
    {
      role: 'user',
      content: '为以下函数生成 Vitest 单元测试：\n\n' + code,
    },
  ],
  temperature: 0.2,
});
```

## 测试场景

### test-glm.ts 包含 5 个测试

1. **简单对话** - 测试基本对话能力
2. **代码生成** - 测试 TypeScript 代码生成
3. **多轮对话** - 测试上下文保持
4. **结构化输出** - 测试 JSON 格式输出
5. **流式输出** - 测试实时响应

### examples/glm-usage.ts 包含 6 个示例

1. 直接使用 GLM 模型
2. 与 Gateway 集成
3. 使用不同的 GLM 模型
4. 流式输出
5. 多轮对话
6. 代码生成（编程套餐）✅

## 工厂函数

项目已提供便捷的工厂函数：

```typescript
import { createZhipuModel, NativeModel } from '@yunpat/core';

// 创建 GLM-4-Flash（快速）
const glmFlash = createZhipuModel(apiKey, NativeModel.GLM_4_FLASH);

// 创建 GLM-4-Plus（平衡）
const glmPlus = createZhipuModel(apiKey, NativeModel.GLM_4_PLUS);

// 创建 GLM-4.7（旗舰，默认）
const glm47 = createZhipuModel(apiKey);
```

## 参数配置

```typescript
const glm = new NativeLLMAdapter({
  name: NativeModel.GLM_4_FLASH,
  apiKey: process.env.GLM_API_KEY!,
  baseURL: 'https://open.bigmodel.cn/api/paas/v4',
  temperature: 0.7,    // 随机性（0-1，默认 0.7）
  maxTokens: 4096,     // 最大输出（默认 4096）
});
```

### 编程任务推荐参数

- **代码生成**: `temperature: 0.2`, `maxTokens: 2000`
- **代码审查**: `temperature: 0.3`, `maxTokens: 1000`
- **文档生成**: `temperature: 0.5`, `maxTokens: 3000`

## 性能对比

| 模型 | 响应速度 | 代码质量 | 推理能力 | 推荐场景 |
|------|---------|---------|---------|---------|
| GLM-4-Flash | ⚡⚡⚡⚡⚡ | ⭐⭐⭐⭐ | ⭐⭐⭐ | 快速测试 |
| GLM-4-Plus | ⚡⚡⚡⚡ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 日常开发 ✅ |
| GLM-4.7 | ⚡⚡⚡ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 复杂任务 |

## 错误处理

```typescript
try {
  const response = await glm.chat({ messages });
} catch (error) {
  if (error.message.includes('401')) {
    console.error('API Key 无效');
  } else if (error.message.includes('429')) {
    console.error('请求过于频繁');
  } else if (error.message.includes('quota')) {
    console.error('API 额度已用尽');
  }
}
```

## 相关链接

- [智谱 AI 官网](https://zhipuai.cn/)
- [智谱开放平台](https://open.bigmodel.cn/)
- [GLM-4 API 文档](https://open.bigmodel.cn/dev/api)
- [定价说明](https://open.bigmodel.cn/pricing)

## 下一步

1. ✅ 获取 API Key
2. ✅ 设置环境变量
3. ✅ 运行 `./test-glm.sh`
4. ✅ 查看 `examples/glm-usage.ts`
5. ✅ 阅读 `docs/guides/glm-usage.md`

## 技术支持

如有问题：

- [GitHub Issues](https://github.com/xujian519/yunpat/issues)
- [智谱 AI 技术支持](https://open.bigmodel.cn/contact)

---

**创建时间**: 2026-05-01
**框架版本**: v0.1.0
**GLM 模型**: glm-4-flash, glm-4-plus, glm-4.7
