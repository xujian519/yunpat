# YunPat 测试指南

## 概述

YunPat 提供了完整的测试套件，包括单元测试、集成测试和 oMLX 本地模型测试。

---

## 测试类型

### 1. 单元测试

测试单个函数和类的功能。

```bash
# 运行所有单元测试
pnpm test

# 运行特定包的测试
pnpm --filter @yunpat/core test
pnpm --filter @yunpat/agent-invention test
```

### 2. oMLX 集成测试

测试 oMLX 本地模型的基础功能。

```bash
# 运行 oMLX 基础功能测试
./scripts/test-omlx.sh
```

**测试内容**：

- ✅ 基础聊天
- ✅ 流式输出
- ✅ 嵌入向量
- ✅ 专利撰写场景
- ✅ 专利分析场景

### 3. 智能体 oMLX 集成测试

测试所有主要智能体与 oMLX 的集成。

```bash
# 运行智能体集成测试
./scripts/test-agents-omlx.sh
```

**测试内容**：

- ✅ InventionUnderstandingAgent - 发明理解
- ✅ PatentTechnicalAnalyzerAgent - 技术分析
- ✅ ClaimsGeneratorAgent - 权利要求生成
- ✅ QualityCheckerAgent - 质量检查
- ✅ SpecificationDrafterAgent - 说明书撰写

---

## 前置条件

### oMLX 测试前置条件

1. **安装 oMLX**：

   ```bash
   brew install mlx-omlx
   ```

2. **启动 oMLX 服务**：

   ```bash
   omlx serve --base-path ~/.omlx --port 8009
   ```

3. **配置环境变量**：

   ```bash
   # .env 文件
   OMLX_ENABLED=true
   OMLX_API_KEY=your-api-key-here
   OMLX_BASE_URL=http://localhost:8009/v1
   ```

4. **验证 oMLX 运行**：
   ```bash
   curl http://localhost:8009/v1/models \
     -H "Authorization: Bearer $OMLX_API_KEY"
   ```

---

## 运行测试

### 快速测试

```bash
# 仅运行单元测试（最快）
pnpm test

# 仅运行 oMLX 基础测试（~1 分钟）
./scripts/test-omlx.sh
```

### 完整测试

```bash
# 运行所有测试（~5-10 分钟）
pnpm test && ./scripts/test-omlx.sh && ./scripts/test-agents-omlx.sh
```

### 特定智能体测试

```bash
# 仅测试发明理解智能体
npx tsx scripts/test-agents-omlx.ts
# 然后查看测试代码，注释掉其他测试
```

---

## 测试数据

所有测试使用统一的测试数据：

**发明名称**：一种基于深度学习的图像识别方法

**技术领域**：人工智能与图像处理技术领域

**技术方案**：

- 采用残差网络（ResNet）提取特征
- 引入注意力机制增强关键特征
- 使用多尺度特征融合提高准确率
- 通过分类器进行图像分类

**有益效果**：

- 提高复杂场景下的识别准确率
- 减少计算量，提高实时性
- 增强对小样本数据的学习能力

---

## 测试输出

### 成功输出示例

```
🚀 YunPat 智能体 oMLX 集成测试
============================================================
🔗 使用模型: oMLX (Qwen3.5-27B)
⏰ 开始时间: 2026-05-05 10:30:00

📝 测试 1: InventionUnderstandingAgent - 发明理解
============================================================
⏳ 执行发明理解...
✅ 发明理解完成
📊 技术领域: 人工智能与图像处理技术领域
🔑 关键特征: 6 个
💡 置信度: 85.0%

[... 其他测试 ...]

============================================================
📊 测试总结
============================================================
✅ 成功: 5/5
❌ 失败: 0/5

⏰ 结束时间: 2026-05-05 10:35:00
```

### 失败输出示例

```
============================================================
📊 测试总结
============================================================
✅ 成功: 3/5
❌ 失败: 2/5

❌ 失败的测试:
   - 权利要求生成: Timeout after 30000ms
   - 说明书撰写: Cannot read property 'technicalField' of undefined
```

---

## 故障排除

### 问题 1: oMLX 连接失败

**错误信息**：

```
Error: OMXL API 请求失败: fetch failed
```

**解决方案**：

```bash
# 1. 检查 oMLX 是否运行
lsof -i :8009

# 2. 启动 oMLX
omlx serve --base-path ~/.omlx --port 8009

# 3. 检查配置
echo $OMLX_API_KEY
```

### 问题 2: 智能体导入失败

**错误信息**：

```
Error: Cannot find module '@yunpat/agent-invention'
```

**解决方案**：

```bash
# 构建所有智能体包
pnpm build

# 或构建特定包
pnpm --filter @yunpat/agent-invention build
```

### 问题 3: 测试超时

**错误信息**：

```
Error: Timeout after 30000ms
```

**解决方案**：

```bash
# 1. 检查 oMLX 模型是否已加载（首次加载需要时间）
# 2. 使用较小的模型（Gemma-4-9B）
export OMLX_MODEL_NAME=gemma-4-e2b-it-4bit

# 3. 增加超时时间（修改测试脚本）
```

### 问题 4: 内存不足

**错误信息**：

```
Error: Cannot allocate memory
```

**解决方案**：

```bash
# 1. 关闭其他应用
# 2. 使用较小的模型
# 3. 减少 oMLX 内存占用
# 编辑 ~/.omlx/settings.json
{
  "memory": {
    "max_process_memory": "30%"
  }
}
```

---

## 测试覆盖率

### 当前测试覆盖

| 包名                                | 单元测试 | 集成测试 | 覆盖率 |
| ----------------------------------- | -------- | -------- | ------ |
| @yunpat/core                        | ✅       | ✅       | 85%    |
| @yunpat/agent-invention             | ✅       | ✅       | 80%    |
| @yunpat/agent-analysis              | ✅       | ✅       | 75%    |
| @yunpat/agent-claim-generator       | ✅       | ✅       | 78%    |
| @yunpat/agent-quality               | ✅       | ✅       | 82%    |
| @yunpat/agent-specification-drafter | ✅       | ✅       | 76%    |

### 测试统计

```bash
# 总测试数
pnpm test -- --reporter=verbose

# 测试通过率
pnpm test -- --reporter=json | jq '.stats'
```

---

## 持续集成

### GitHub Actions

```yaml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install pnpm
        run: npm install -g pnpm
      - name: Install dependencies
        run: pnpm install
      - name: Build
        run: pnpm build
      - name: Run tests
        run: pnpm test
```

### 本地 CI 脚本

```bash
#!/bin/bash
# scripts/ci.sh

set -e

echo "🧪 运行 CI 测试..."

# 安装依赖
pnpm install

# 构建
pnpm build

# 运行测试
pnpm test

# 运行 oMLX 测试（如果配置了）
if [ -n "$OMLX_API_KEY" ]; then
  ./scripts/test-omlx.sh
  ./scripts/test-agents-omlx.sh
fi

echo "✅ CI 测试通过"
```

---

## 编写测试

### 单元测试示例

```typescript
// packages/core/src/some/feature.test.ts
import { describe, it, expect } from 'vitest'

describe('Feature', () => {
  it('should do something', () => {
    const result = doSomething()
    expect(result).toBe('expected')
  })
})
```

### 集成测试示例

```typescript
// scripts/test-integration.ts
import { SomeAgent } from '@yunpat/agent-some'

async function testSomeAgent() {
  const agent = new SomeAgent({ llm, eventBus, memory })
  const result = await agent.execute({ input: 'test' })
  console.log('✅ 测试通过:', result)
}
```

---

## 相关文档

- [oMLX 集成指南](./OMXL_INTEGRATION.md)
- [智能体 LLM 配置](./AGENT_LLM_CONFIGURATION.md)
- [开发指南](./DEVELOPMENT.md)

---

**最后更新**: 2026-05-05
**作者**: YunPat Team
