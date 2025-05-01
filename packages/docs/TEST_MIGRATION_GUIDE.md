# YunPat 真实 LLM 测试迁移指南

**更新时间**: 2026-05-06
**测试规模**: 236 个测试文件（核心包 82 个），覆盖 20 个顶层包 + 29 个 Agent 子包

## 概述

本项目已从 Mock 测试迁移到真实 LLM 调用，以提供更可靠的测试结果。

## 迁移前后对比

| 特性         | 迁移前 (Mock) | 迁移后 (真实 LLM) |
| ------------ | ------------- | ----------------- |
| **LLM 调用** | 返回预设 JSON | 真实 API 调用     |
| **数据服务** | Mock          | 真实数据库/知识库 |
| **测试速度** | 快 (~1s)      | 慢 (~5-30s)       |
| **可信度**   | 低            | 高                |
| **API 费用** | 无            | 有（可控制）      |
| **网络依赖** | 无            | 有                |

## 快速开始

### 1. 配置环境变量

在 `.env` 文件中配置至少一个 LLM 提供商：

```bash
# 选项 1: DeepSeek（推荐，性价比高）
DEEPSEEK_API_KEY=sk-your-deepseek-api-key-here

# 选项 2: Anthropic Claude
ANTHROPIC_API_KEY=sk-ant-your-anthropic-api-key-here

# 选项 3: OpenAI GPT
OPENAI_API_KEY=sk-your-openai-api-key-here

# 选项 4: 本地 Ollama（免费）
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen

# 选项 5: 本地 OMLX（免费，Apple Silicon）
OMLX_API_KEY=your-omlx-api-key-here
OMLX_ENABLED=true
```

### 2. 运行测试

```bash
# 默认：使用真实 LLM（自动选择可用提供商）
pnpm test

# 显式使用真实 LLM
pnpm test:real

# 使用 Mock 模式（无 API 调用）
pnpm test:mock
```

## 新增文件

```
packages/core/test/
├── helpers/
│   ├── real-test-setup.ts      # 真实 LLM 测试辅助类
│   ├── test-env-setup.ts       # 测试环境验证
│   └── test-setup.ts           # Mock 测试辅助类（保留）
├── eventbus/                   # EventBus 测试（最完善，53 个用例）
├── reasoning/                  # 推理引擎测试
├── planning/                   # 规划引擎测试
├── memory/                     # 记忆系统测试
├── llm/                        # LLM 适配器测试
├── agent/                      # Agent 基类测试
├── tools-selection/            # 工具选择优化测试
├── gateway/                    # 网关测试
├── knowledge/                  # 知识卡片测试
├── observability/              # 可观测性测试
├── validation/                 # 验证器测试
└── stability/                  # 并发智能体测试
```

## 代码迁移示例

### 迁移前 (Mock)

```typescript
import { createTestHelper } from '../helpers/test-setup.js'

describe('意图识别测试', () => {
  it('应该识别 DRAFT_FULL 意图', async () => {
    const helper = createTestHelper()
    const orchestrator = await helper.setupOrchestrator()

    // 设置 Mock 响应
    const mockLLMClient = helper.getLastMockLLMClient()
    mockLLMClient!.enqueueResponse({
      content: JSON.stringify({
        intent: 'DRAFT_FULL',
        confidence: 0.9,
        // ...
      }),
    })

    const result = await orchestrator.execute(input)

    expect(result.metadata.intent).toBe('DRAFT_FULL')
  })
})
```

### 迁移后 (真实 LLM)

```typescript
import { createRealTestHelper } from '../helpers/real-test-setup.js'

describe('意图识别测试', () => {
  it('应该识别 DRAFT_FULL 意图', { timeout: 60000 }, async () => {
    const helper = createRealTestHelper()
    const orchestrator = await helper.setupOrchestrator()

    const result = await orchestrator.execute(input)

    // 真实 LLM 返回，断言需要更灵活
    expect(result.metadata.intent).toBeDefined()
    expect(result.metadata.confidence).toBeGreaterThan(0)
  })
})
```

## 测试策略

### 单元测试

- **范围**: 单个函数/类
- **LLM**: 使用 Mock
- **数据**: 使用 Mock
- **命令**: `pnpm test:unit`

### 集成测试

- **范围**: 多个组件协作
- **LLM**: 真实调用
- **数据**: 真实数据库
- **命令**: `pnpm test`

### E2E 测试

- **范围**: 完整用户流程
- **LLM**: 真实调用
- **数据**: 真实数据库 + 知识库
- **命令**: `pnpm test`

## 高级用法

### 指定 LLM 提供商

```typescript
import { createRealTestHelper, LLMProvider } from '../helpers/real-test-setup.js'

// 使用 DeepSeek
const helper = createRealTestHelper({
  llmProvider: LLMProvider.DEEPSEEK,
})

// 使用本地 Ollama
const helper = createRealTestHelper({
  llmProvider: LLMProvider.OLLAMA,
})
```

### 自动选择提供商

```typescript
// 自动按优先级选择：本地 OMLX > 本地 Ollama > DeepSeek > Claude > GPT
const helper = createRealTestHelper()
```

### 条件跳过测试

```typescript
it('使用 Claude API', { timeout: 60000 }, async () => {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('⚠️ 跳过：未设置 ANTHROPIC_API_KEY')
    return
  }
  // ... 测试代码
})
```

## 配置选项

### vitest.config.ts

```typescript
export default defineConfig({
  test: {
    // 真实 API 需要更长超时
    testTimeout: 120000,
    hookTimeout: 60000,
    // 限制并发，避免 API 速率限制
    maxConcurrency: 2,
  },
})
```

### 环境变量

| 变量                  | 说明               | 默认值                   |
| --------------------- | ------------------ | ------------------------ |
| `DEEPSEEK_API_KEY`    | DeepSeek API 密钥  | -                        |
| `GLM_API_KEY`         | 智谱 GLM API 密钥  | -                        |
| `DASHSCOPE_API_KEY`   | 通义千问 API 密钥  | -                        |
| `ANTHROPIC_API_KEY`   | Anthropic API 密钥 | -                        |
| `OPENAI_API_KEY`      | OpenAI API 密钥    | -                        |
| `OLLAMA_BASE_URL`     | Ollama 地址        | `http://localhost:11434` |
| `OMLX_API_KEY`        | OMLX API 密钥      | -                        |
| `MOCK_TESTS`          | 强制使用 Mock      | `false`                  |
| `RUN_REAL_LLM_TESTS`  | 强制真实 LLM 测试  | `false`                  |
| `KNOWLEDGE_BASE_PATH` | 知识库路径         | `./knowledge-base`       |

## 故障排除

### 问题：测试超时

**原因**: 真实 API 调用比 Mock 慢

**解决**:

```typescript
it('测试', { timeout: 120000 }, async () => {
  // ...
})
```

### 问题：API 速率限制

**原因**: 并发请求过多

**解决**: 在 `vitest.config.ts` 中设置 `maxConcurrency: 1`

### 问题：未找到可用的 LLM 配置

**原因**: 环境变量未设置

**解决**: 检查 `.env` 文件，或设置 `MOCK_TESTS=true`

## 费用估算

| 提供商   | 输入          | 输出          | 单次测试成本 |
| -------- | ------------- | ------------- | ------------ |
| DeepSeek | ¥1/百万token  | ¥2/百万token  | ~¥0.001      |
| Claude   | $3/百万token  | $15/百万token | ~$0.01       |
| GPT-4    | $30/百万token | $60/百万token | ~$0.05       |
| Ollama   | 免费          | 免费          | ¥0           |
| OMLX     | 免费          | 免费          | ¥0           |

## 参考资料

- [DeepSeek API](https://platform.deepseek.com/)
- [Anthropic Claude](https://docs.anthropic.com/)
- [Ollama](https://ollama.ai/)
- [OMLX](https://github.com/ml-explore/mlx-ommx)
