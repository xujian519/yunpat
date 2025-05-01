# oMLX 本地模型集成指南

## 概述

oMLX 是专为 Apple Silicon 设计的本地大模型运行框架，YunPat 已完全集成 oMLX，支持离线使用强大的本地模型。

### 为什么使用 oMLX？

- ✅ **完全免费** - 无 API 调用费用
- ✅ **隐私保护** - 数据完全本地处理
- ✅ **离线可用** - 无需网络连接
- ✅ **高性能** - 针对 Apple Silicon 优化
- ✅ **多模型支持** - Qwen、Gemma、BGE-M3 等

---

## 快速开始

### 1. 安装 oMLX

```bash
# 使用 Homebrew 安装（推荐）
brew tap mlx-omlx/mlx-omlx
brew install mlx-omlx

# 或下载 macOS 应用
# https://github.com/ml-explore/mlx-ommx/releases
```

### 2. 下载模型

```bash
# oMLX 会自动下载模型到 ~/.omlx/models/
# 或手动下载：
# - Qwen3.5-27B (推荐，27B 参数)
# - Gemma-4-9B (快速，4B 参数)
# - BGE-M3 (嵌入模型)
```

### 3. 启动 oMLX 服务

```bash
# 启动 oMLX 服务器（默认端口 8009）
omlx serve --base-path ~/.omlx --port 8009
```

或在 oMLX 应用中启动服务器。

### 4. 配置 YunPat

在项目根目录的 `.env` 文件中添加：

```bash
# 启用 oMLX
OMLX_ENABLED=true

# oMLX API 地址
OMLX_BASE_URL=http://localhost:8009/v1

# oMLX API Key（从 ~/.omlx/settings.json 获取）
OMLX_API_KEY=xj781102@

# 默认模型名称（可选）
OMLX_MODEL_NAME=Qwen3.5-27B-Claude-4.6-Opus-Distilled-MLX-4bit
```

---

## 可用模型

### 聊天模型

| 模型            | 参数 | 用途               | 速度   | 内存 |
| --------------- | ---- | ------------------ | ------ | ---- |
| **Qwen3.5-27B** | 27B  | 复杂推理、专利撰写 | 18 t/s | 17GB |
| **Gemma-4-9B**  | 4B   | 快速对话、简单任务 | 50 t/s | 5GB  |

### 嵌入模型

| 模型       | 维度 | 用途               |
| ---------- | ---- | ------------------ |
| **BGE-M3** | 1024 | 文本向量、语义搜索 |

---

## 使用方式

### 方式 1：自动模式（推荐）

```bash
# 设置环境变量后，智能体自动使用 oMLX
export OMLX_ENABLED=true
yunpat run invention-understanding --task "分析技术方案"
```

**自动选择逻辑**：

1. 优先使用 oMLX（如果 `OMLX_ENABLED=true` 且有 API Key）
2. 否则使用 DeepSeek（云端）
3. 都不可用则报错

### 方式 2：CLI 指定模型

```bash
# 明确指定使用 oMLX
yunpat run agent --model omlx --task "xxx"

# 明确指定使用 DeepSeek
yunpat run agent --model deepseek --task "xxx"

# 自动选择（默认）
yunpat run agent --model auto --task "xxx"
```

### 方式 3：代码中直接使用

```typescript
import { createPatentWritingModel, createReasoningModel } from '@yunpat/core'

// 创建专利撰写模型
const patentModel = createPatentWritingModel()

// 创建推理模型
const reasoningModel = createReasoningModel()

// 使用模型
const response = await patentModel.chat({
  messages: [{ role: 'user', content: '撰写专利权利要求' }],
  maxTokens: 2000,
})

console.log(response.message.content)
```

---

## 智能体默认配置

### 自动使用 oMLX 的智能体

以下智能体默认使用 oMLX（如果已启用）：

1. **InventionUnderstandingAgent** - 发明理解
2. **PatentTechnicalAnalyzerAgent** - 技术分析
3. **ClaimsGeneratorAgent** - 权利要求生成
4. **QualityCheckerAgent** - 质量检查
5. **SpecificationDrafterAgent** - 说明书撰写
6. **PatentResponderAgent** - 审查答复

### 配置示例

```typescript
// packages/agents/invention/src/InventionUnderstandingAgent.ts

import { createPatentWritingModel } from '@yunpat/core'

export function createInventionAgent() {
  // 优先使用 oMLX，如果未配置则使用 DeepSeek
  const llm = createPatentWritingModel()

  return new InventionUnderstandingAgent({
    llm,
    eventBus: new EventBus(),
    memory: new ShortTermMemory(),
    registry: new ToolRegistry(),
  })
}
```

---

## 性能对比

### 响应速度

| 任务       | oMLX (Qwen3.5-27B) | DeepSeek-V4 | 说明          |
| ---------- | ------------------ | ----------- | ------------- |
| 简单对话   | ~2s                | ~1s         | DeepSeek 略快 |
| 复杂推理   | ~5s                | ~3s         | DeepSeek 略快 |
| 专利撰写   | ~15s               | ~10s        | DeepSeek 略快 |
| 长文本生成 | ~30s               | ~20s        | oMLX 稳定     |

### 成本对比

| 模型         | 成本            | 1000 次调用 |
| ------------ | --------------- | ----------- |
| **oMLX**     | 完全免费        | ¥0          |
| **DeepSeek** | ¥0.14/1M tokens | ~¥14-70     |

**结论**：

- 高频使用场景 → oMLX 节省成本
- 低频/快速响应 → DeepSeek 更优

---

## 故障排除

### 问题 1：无法连接 oMLX

**错误信息**：

```
Error: OMXL API 请求失败: fetch failed
```

**解决方案**：

```bash
# 1. 检查 oMLX 是否运行
lsof -i :8009

# 2. 启动 oMLX 服务
omlx serve --base-path ~/.omlx --port 8009

# 3. 检查配置
cat ~/.omlx/settings.json | jq .auth
```

### 问题 2：API Key 错误

**错误信息**：

```
Error: OMXL API 请求失败: 401 Unauthorized
```

**解决方案**：

```bash
# 1. 获取 API Key
cat ~/.omlx/settings.json | jq .auth.api_key

# 2. 更新 .env 文件
export OMLX_API_KEY="your-api-key-here"

# 3. 测试连接
curl http://localhost:8009/v1/models \
  -H "Authorization: Bearer your-api-key"
```

### 问题 3：模型加载慢

**原因**：首次加载模型需要时间

**解决方案**：

- 使用较小的模型（Gemma-4-9B）
- 增加 SSD 缓存大小
- 保持 oMLX 服务运行

```bash
# 查看缓存配置
cat ~/.omlx/settings.json | jq .cache
```

### 问题 4：内存不足

**错误信息**：

```
Error: Cannot allocate memory
```

**解决方案**：

```bash
# 1. 使用较小的模型
export OMLX_MODEL_NAME=gemma-4-e2b-it-4bit

# 2. 减少最大进程内存
# 编辑 ~/.omlx/settings.json
{
  "memory": {
    "max_process_memory": "30%"  # 从 42% 降低
  }
}

# 3. 关闭其他应用
```

---

## 高级配置

### 自定义模型路径

```bash
# ~/.omlx/settings.json
{
  "model": {
    "model_dirs": [
      "/custom/path/to/models",
      "~/.omlx/models"
    ]
  }
}
```

### 调整内存占用

```bash
# ~/.omlx/settings.json
{
  "memory": {
    "max_process_memory": "42%",  // 最大内存占用
    "prefill_memory_guard": true   // 启用内存保护
  }
}
```

### 并发请求配置

```bash
# ~/.omlx/settings.json
{
  "scheduler": {
    "max_concurrent_requests": 3  // 最大并发请求数
  }
}
```

---

## 测试与验证

### 运行集成测试

```bash
# 从项目根目录
./scripts/test-omlx.sh
```

**测试内容**：

1. 基础聊天
2. 流式输出
3. 嵌入向量
4. 专利撰写场景
5. 专利分析场景

### 手动测试

```bash
# 测试聊天
curl http://localhost:8009/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OMLX_API_KEY" \
  -d '{
    "model": "Qwen3.5-27B-Claude-4.6-Opus-Distilled-MLX-4bit",
    "messages": [{"role": "user", "content": "你好"}],
    "max_tokens": 50
  }'

# 测试嵌入
curl http://localhost:8009/v1/embeddings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OMLX_API_KEY" \
  -d '{
    "model": "bge-m3-mlx-8bit",
    "input": ["专利是一种知识产权"]
  }'
```

---

## 最佳实践

### 1. 模型选择

- **复杂任务**（专利撰写、分析）→ Qwen3.5-27B
- **简单任务**（对话、摘要）→ Gemma-4-9B
- **批量处理**→ 使用 DeepSeek（更快）

### 2. 成本优化

```bash
# 开发/测试：使用 oMLX（免费）
export OMLX_ENABLED=true

# 生产环境：使用 DeepSeek（更快）
export OMLX_ENABLED=false
export DEEPSEEK_API_KEY=your-key
```

### 3. 性能优化

```bash
# 保持 oMLX 服务运行（避免重复加载模型）
# 后台启动 oMLX
nohup omlx serve --base-path ~/.omlx --port 8009 > /dev/null 2>&1 &

# 设置超时时间（本地模型需要更长）
export OMLX_TIMEOUT=180000  # 3 分钟
```

### 4. 错误处理

```typescript
// 优雅降级：oMLX 失败时使用 DeepSeek
try {
  llm = createPatentWritingModel() // oMLX
} catch (error) {
  console.warn('oMLX 不可用，切换到 DeepSeek')
  llm = createDeepSeekModel(process.env.DEEPSEEK_API_KEY)
}
```

---

## 相关文档

- [oMLX 官方文档](https://github.com/ml-explore/mlx-ommx)
- [Qwen 模型介绍](https://github.com/QwenLM/Qwen)
- [BGE-M3 嵌入模型](https://github.com/FlagOpen/FlagEmbedding)
- [YunPat CLI 文档](../packages/cli/README.md)
- [环境变量配置](./.env.example)

---

## 更新日志

### 2026-05-05

- ✅ 完成 oMLX 集成
- ✅ 添加 CLI --model 选项
- ✅ 智能体默认使用 oMLX
- ✅ 编写集成文档

### 待办事项

- [ ] 添加模型性能监控
- [ ] 实现模型自动切换
- [ ] 支持更多本地模型
- [ ] 优化内存使用

---

**作者**: YunPat Team
**最后更新**: 2026-05-05
**许可证**: MIT
