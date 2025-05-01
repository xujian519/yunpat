# 智能体 LLM 默认配置

## 概述

YunPat 智能体现在默认优先使用 oMLX 本地模型（如果已配置），自动降级到云端模型。

---

## 自动选择逻辑

### 优先级

1. **oMLX 本地模型**（如果 `OMLX_ENABLED=true` 且有 API Key）
   - 完全免费
   - 隐私保护
   - 离线可用

2. **DeepSeek 云端模型**（如果 oMLX 不可用）
   - 性能更好
   - 响应更快
   - 按需付费

3. **报错**（都不可用）
   - 提示配置至少一个 LLM

### 配置检测

```typescript
// 检查 oMLX 是否可用
const omxlAPIKey = process.env.OMLX_API_KEY
const omxlEnabled = process.env.OMLX_ENABLED === 'true'

if (omxlEnabled && omxlAPIKey) {
  // 使用 oMLX
  return createPatentWritingModel()
}

// 检查 DeepSeek 是否可用
const deepseekKey = process.env.DEEPSEEK_API_KEY
if (deepseekKey) {
  // 使用 DeepSeek
  return createDeepSeekModel(deepseekKey)
}

// 都不可用，报错
throw new Error('未找到可用的 LLM 配置')
```

---

## 智能体配置

### 默认使用 oMLX 的智能体

| 智能体                       | 默认模型 | oMLX 模型   | 用途         |
| ---------------------------- | -------- | ----------- | ------------ |
| InventionUnderstandingAgent  | 自动     | Qwen3.5-27B | 发明理解     |
| PatentTechnicalAnalyzerAgent | 自动     | Qwen3.5-27B | 技术分析     |
| ClaimsGeneratorAgent         | 自动     | Qwen3.5-27B | 权利要求生成 |
| QualityCheckerAgent          | 自动     | Gemma-4-9B  | 质量检查     |
| SpecificationDrafterAgent    | 自动     | Qwen3.5-27B | 说明书撰写   |
| PatentResponderAgent         | 自动     | Qwen3.5-27B | 审查答复     |

### 配置示例

```typescript
// packages/agents/invention/src/InventionUnderstandingAgent.ts

import { createLLM, ModelProvider } from '@yunpat/cli'

export function createInventionAgent(options?: { model?: string }) {
  // 创建 LLM（自动选择 oMLX 或 DeepSeek）
  const llm = createLLM({
    provider: options?.model ? parseModelProvider(options.model) : undefined,
  })

  return new InventionUnderstandingAgent({
    llm,
    eventBus: new EventBus(),
    memory: new ShortTermMemory(),
    registry: new ToolRegistry(),
  })
}
```

---

## 环境变量配置

### .env 文件

```bash
# ========== oMLX 配置（本地，免费） ==========
# 启用 oMLX
OMLX_ENABLED=true

# oMLX API 地址
OMLX_BASE_URL=http://localhost:8009/v1

# oMLX API Key（从 ~/.omlx/settings.json 获取）
OMLX_API_KEY=your-api-key-here

# 默认模型名称
OMLX_MODEL_NAME=Qwen3.5-27B-Claude-4.6-Opus-Distilled-MLX-4bit

# ========== DeepSeek 配置（云端，付费） ==========
# DeepSeek API Key（备用）
DEEPSEEK_API_KEY=sk-your-deepseek-api-key-here
DEEPSEEK_BASE_URL=https://api.deepseek.com
```

---

## CLI 使用

### 自动模式（推荐）

```bash
# 自动选择 oMLX 或 DeepSeek
yunpat run invention-understanding --task "分析技术方案"
```

### 指定模型

```bash
# 明确使用 oMLX
yunpat run agent --model omlx --task "xxx"

# 明确使用 DeepSeek
yunpat run agent --model deepseek --task "xxx"

# 自动选择
yunpat run agent --model auto --task "xxx"
```

---

## 代码示例

### 创建智能体（自动选择）

```typescript
import { InventionUnderstandingAgent } from '@yunpat/agent-invention'
import { createLLM } from '@yunpat/cli'

// 自动选择 LLM
const llm = createLLM()

const agent = new InventionUnderstandingAgent({
  llm,
  eventBus,
  memory,
  registry,
})
```

### 创建智能体（指定模型）

```typescript
import { InventionUnderstandingAgent } from '@yunpat/agent-invention'
import { createLLM, ModelProvider } from '@yunpat/cli'

// 强制使用 oMLX
const llm = createLLM({
  provider: ModelProvider.OMLX,
})

// 强制使用 DeepSeek
const llm = createLLM({
  provider: ModelProvider.DEEPSEEK,
})

const agent = new InventionUnderstandingAgent({
  llm,
  eventBus,
  memory,
  registry,
})
```

---

## 切换模型

### 全局切换（推荐）

修改 `.env` 文件：

```bash
# 使用 oMLX（本地）
OMLX_ENABLED=true
# DEEPSEEK_API_KEY=xxx  # 注释掉

# 使用 DeepSeek（云端）
# OMLX_ENABLED=false
DEEPSEEK_API_KEY=sk-xxx
```

### 运行时切换

```bash
# 临时使用 oMLX
OMLX_ENABLED=true yunpat run agent --task "xxx"

# 临时使用 DeepSeek
DEEPSEEK_API_KEY=sk-xxx yunpat run agent --task "xxx"
```

---

## 性能对比

### 响应时间（专利撰写任务）

| 模型                   | 平均响应 | 启动时间  | 稳定性     |
| ---------------------- | -------- | --------- | ---------- |
| **oMLX (Qwen3.5-27B)** | ~15s     | 首次 ~10s | ⭐⭐⭐⭐⭐ |
| **DeepSeek-V4**        | ~10s     | <1s       | ⭐⭐⭐⭐   |

### 成本对比（1000 次调用）

| 模型         | 成本 | 网络要求 |
| ------------ | ---- | -------- |
| **oMLX**     | ¥0   | 无需网络 |
| **DeepSeek** | ~¥50 | 需要网络 |

---

## 故障排除

### oMLX 不可用时自动降级

```typescript
try {
  // 尝试使用 oMLX
  llm = createPatentWritingModel()
  console.log('✅ 使用 oMLX 本地模型')
} catch (error) {
  // 降级到 DeepSeek
  console.warn('⚠️ oMLX 不可用，切换到 DeepSeek')
  llm = createDeepSeekModel(process.env.DEEPSEEK_API_KEY)
}
```

### 检查配置

```bash
# 检查 oMLX 配置
echo $OMLX_ENABLED
echo $OMLX_API_KEY

# 检查 DeepSeek 配置
echo $DEEPSEEK_API_KEY

# 测试 oMLX 连接
curl http://localhost:8009/v1/models \
  -H "Authorization: Bearer $OMLX_API_KEY"

# 测试 DeepSeek 连接
curl https://api.deepseek.com/v1/models \
  -H "Authorization: Bearer $DEEPSEEK_API_KEY"
```

---

## 最佳实践

### 开发环境

```bash
# 使用 oMLX（免费，无限制）
OMLX_ENABLED=true
OMLX_API_KEY=xxx
```

### 生产环境

```bash
# 使用 DeepSeek（更快，更稳定）
DEEPSEEK_API_KEY=sk-xxx
OMLX_ENABLED=false
```

### 混合模式

```bash
# 日常使用 oMLX，紧急任务使用 DeepSeek
OMLX_ENABLED=true
DEEPSEEK_API_KEY=sk-xxx  # 备用

# 运行时选择
yunpat run agent --model omlx --task "日常任务"
yunpat run agent --model deepseek --task "紧急任务"
```

---

## 相关文档

- [oMLX 集成指南](./OMXL_INTEGRATION.md)
- [环境变量配置](../.env.example)
- [CLI 使用说明](../packages/cli/README.md)
- [智能体开发指南](./AGENT_DEVELOPMENT.md)

---

**最后更新**: 2026-05-05
**作者**: YunPat Team
