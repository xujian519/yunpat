# YunPat 代码重构优化计划

> **基于**: CODE_QUALITY_REVIEW_KARPATHY.md
> **原则**: 编码前思考 · 简洁优先 · 精准修改 · 目标驱动执行
> **日期**: 2026-04-28

---

## 📊 问题诊断总结

| 核心问题         | 严重程度 | 影响                          |
| ---------------- | -------- | ----------------------------- |
| 过度工程化       | 🔴 严重  | 代码量是实际需要的 5-10 倍    |
| 缺少测试         | 🔴 严重  | 测试覆盖率 < 5%，无 CI/CD     |
| 死代码/Mock 数据 | 🔴 严重  | ~40% 是硬编码模拟数据         |
| 代码重复         | 🟡 中等  | Agent 基类内部 200 行重复     |
| 关键 Bug         | 🔴 严重  | EventBus 缩进错误导致功能失败 |

---

## 🎯 优化策略（三阶段）

### 阶段一：止血修复（P0 - 立即执行）

**目标**: 修复会导致功能失败的关键问题

#### 1.1 修复 EventBus 缩进 Bug

- **文件**: `packages/core/src/eventbus/EventBus.ts` 第 141-146 行
- **问题**: `request()` 方法会立即 reject，超时机制失效
- **修复**:

  ```typescript
  // 修复前（错误缩进）
  const timer = setTimeout(() => {
    this.pendingRequests.delete(requestId)
    reject(new Error(`Request timeout: ${requestId}`))
  }, timeout)
  this.pendingRequests.delete(requestId) // ← 错误！
  reject(new Error(`Request timeout: ${requestId}`))

  // 修复后
  const timer = setTimeout(() => {
    this.pendingRequests.delete(requestId)
    reject(new Error(`Request timeout: ${requestId}`))
  }, timeout)
  ```

#### 1.2 删除过度设计的模块（等真正需要时再加）

**删除列表**（共 ~3,500 行）:

- `packages/core/src/gateway/Gateway.ts` (551 行，全是 mock)
- `packages/core/src/llm/ModelVoting.ts` (1123 行，解决不存在的问题)
- `packages/core/src/llm/PromptOptimizer.ts` (368 行，删除"请"字)
- `packages/core/src/llm/ResilientLLMAdapter.ts` (543 行，可用 10 行替代)
- `packages/core/src/memory/TransactionManager.ts` (内存事务无意义)

**替代方案**:

```typescript
// ResilientLLMAdapter 替代（10 行）
async function chatWithRetry(adapter, params, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await adapter.chat(params)
    } catch (e) {
      if (i === retries - 1) throw e
      await sleep(1000 * 2 ** i)
    }
  }
}
```

#### 1.3 删除或替换硬编码的 Mock 数据

**目标文件**:

- `ai/agents/analyzer/PatentAnalyzerAgent.ts` (594 行)
- `ai/agents/writer/EnhancedPatentWriterAgent.ts`
- `ai/agents/manager/PatentManagerAgent.ts`
- `cli/patent-cli/index.js` (310 行)

**策略**:

- 删除返回硬编码数据的方法
- 保留接口定义，添加 `// TODO: 实现真实逻辑` 注释
- 或用简单的随机数据生成替代（用于演示）

#### 1.4 搭建基础 CI（GitHub Actions）

**目标**: 至少运行现有的 vitest 测试

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm test
```

---

### 阶段二：简化重构（P1 - 本周内）

**目标**: 简化核心架构，消除重复

#### 2.1 简化 Agent 基类

**当前**: 5 个泛型参数 + 抽象类 + 6 个生命周期钩子 (478 行)
**目标**: 普通函数或简单配置对象 (~50 行)

```typescript
// 简化后的 Agent 定义
interface AgentConfig {
  name: string
  prompt: string
  llm: LLMAdapter
}

async function runAgent(input: string, config: AgentConfig): Promise<string> {
  const response = await config.llm.chat([
    { role: 'system', content: config.prompt },
    { role: 'user', content: input },
  ])
  return response.message.content
}
```

#### 2.2 合并重复的专利智能体

**问题**:

- `PatentWriterAgent` vs `EnhancedPatentWriterAgent`（后者无实质增强）
- 4 个专利智能体高度同质化

**策略**:

1. 删除 `EnhancedPatentWriterAgent`
2. 提取公共的 `PatentAgent` 基类
3. 共享 LLM 调用模式和专利领域模型

#### 2.3 配置 ESLint

**当前**: 已安装 eslint 但无配置文件
**目标**: 添加 `.eslintrc.json`

```json
{
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:prettier/recommended"
  ],
  "parser": "@typescript-eslint/parser",
  "plugins": ["@typescript-eslint"],
  "rules": {
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/explicit-function-return-type": "off"
  }
}
```

#### 2.4 使用现成的库替代自制实现

| 自制实现                          | 替代库                  | 减少代码量 |
| --------------------------------- | ----------------------- | ---------- |
| `PromptTemplate.ts` (504 行)      | Handlebars / Mustache   | -500 行    |
| `ResilientLLMAdapter.ts` (543 行) | p-retry                 | -530 行    |
| 事件系统                          | EventEmitter3 ✅ 已使用 | 0          |

---

### 阶段三：清理完善（P2 - 本月内）

**目标**: 清理技术债务，建立质量保障

#### 3.1 清理空目录

**删除**:

- `apps/*` (5 个空目录)
- `services/*` (5 个空目录)
- `ai/core`, `ai/retrieval`, `ai/generation`, `ai/knowledge`

#### 3.2 合并重复的 CLI

**问题**: 三处重复

- `cli/patent-cli/`
- `packages/cli/`
- `rust/crates/patent-cli/`

**策略**: 统一为 `packages/cli/`

#### 3.3 补充核心模块测试

**目标**: 核心模块覆盖率达到 60%

**优先级**:

1. `packages/core/src/agent/Agent.ts` - 核心抽象
2. `packages/core/src/llm/` - LLM 适配器
3. `packages/core/src/eventbus/EventBus.ts` - 事件总线

#### 3.4 添加测试覆盖率报告

```json
// package.json
{
  "scripts": {
    "test:coverage": "vitest --coverage"
  }
}
```

#### 3.5 添加 pre-commit hook

```bash
pnpm add -D husky lint-staged
npx husky install
```

```json
// package.json
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"]
  }
}
```

---

## 📋 实施检查清单

### ✅ 阶段一（P0 - 立即执行）

- [ ] 修复 EventBus 缩进 Bug
- [ ] 删除 Gateway.ts (551 行)
- [ ] 删除 ModelVoting.ts (1123 行)
- [ ] 删除 PromptOptimizer.ts (368 行)
- [ ] 删除 ResilientLLMAdapter.ts (543 行)
- [ ] 删除 TransactionManager.ts
- [ ] 清理 PatentAnalyzerAgent.ts 硬编码数据
- [ ] 清理 EnhancedPatentWriterAgent.ts 硬编码数据
- [ ] 清理 PatentManagerAgent.ts 硬编码数据
- [ ] 清理 cli/patent-cli/index.js 硬编码数据
- [ ] 创建 .github/workflows/ci.yml
- [ ] 验证 CI 可以运行测试

### ✅ 阶段二（P1 - 本周内）

- [ ] 简化 Agent 基类（从 478 行到 ~50 行）
- [ ] 删除 EnhancedPatentWriterAgent
- [ ] 提取 PatentAgent 公共基类
- [ ] 创建 .eslintrc.json
- [ ] 替换 PromptTemplate 为 Handlebars
- [ ] 替换 ResilientLLMAdapter 为 p-retry
- [ ] 运行 eslint 修复所有问题

### ✅ 阶段三（P2 - 本月内）

- [ ] 删除 apps/\* 空目录
- [ ] 删除 services/\* 空目录
- [ ] 删除 ai/core, ai/retrieval, ai/generation, ai/knowledge
- [ ] 统一 CLI 到 packages/cli/
- [ ] 为 Agent.ts 添加单元测试
- [ ] 为 LLM 适配器添加单元测试
- [ ] 为 EventBus.ts 添加单元测试
- [ ] 配置 vitest coverage
- [ ] 安装 husky + lint-staged
- [ ] 运行测试覆盖率报告

---

## 🎯 成功标准

### 阶段一成功标准

- [ ] EventBus Bug 已修复，测试通过
- [ ] 删除 ~3,500 行过度设计的代码
- [ ] CI 可以自动运行测试
- [ ] 所有硬编码 mock 数据已清理或标记 TODO

### 阶段二成功标准

- [ ] Agent 基类简化到 < 100 行
- [ ] ESLint 可以正常运行
- [ ] 无重复的智能体实现
- [ ] 使用现成库替代自制实现

### 阶段三成功标准

- [ ] 无空目录
- [ ] 核心模块测试覆盖率达到 60%
- [ ] Pre-commit hook 正常工作
- [ ] 代码总量减少 40%+

---

## 🤔 需要澄清的问题

在开始实施前，需要确认：

1. **保留哪些功能？**
   - 是否需要保留 Gateway 的接口定义（用于未来扩展）？
   - 是否需要保留 ModelVoting 的接口定义？

2. **测试策略？**
   - 是否优先为核心模块编写测试？
   - 是否使用 TDD 方式（先写测试再重构）？

3. **向后兼容性？**
   - 是否有外部依赖需要保持兼容？
   - 是否可以大规模删除代码？

4. **实施顺序？**
   - 是否从阶段一（P0）开始依次执行？
   - 还是可以并行执行多个阶段？
