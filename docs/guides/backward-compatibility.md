# 向后兼容性分析与建议

## 📖 什么是向后兼容性？

**向后兼容性**是指：当你修改了代码的内部实现或接口后，**已有的使用者**仍然能正常工作，不会因为你的修改而崩溃。

### 类比说明

想象你在装修房子：

- **不向后兼容**：把厨房拆了重建，做饭时没法用
- **向后兼容**：先在旁边建个新厨房，等新厨房能用再拆旧的

---

## 🔍 YunPat 的兼容性现状

### 外部使用者（无）

```json
{
  "version": "0.1.0", // 早期版本
  "private": true // 未发布到 npm
}
```

✅ **结论**: 没有外部用户，可以大胆重构

### 内部使用者（需要保持兼容）

#### 1. **ai/agents/** - 专利智能体

```typescript
// ai/agents/writer/PatentWriterAgent.ts
import { Agent } from '@yunpat/core'

export class PatentWriterAgent extends Agent<
  PatentWritingInput,
  PatentWritingOutput,
  PatentPlan,
  PatentResult,
  PatentReflection
> {
  // ...
}
```

#### 2. **packages/cli/** - 命令行工具

```typescript
// packages/cli/src/commands.ts
import { EventBus, ShortTermMemory, ToolRegistry, createDeepSeekModel } from '@yunpat/core'
```

#### 3. **packages/agents/** - 示例智能体

```typescript
// packages/agents/writer/src/WriterAgent.ts
import { Agent } from '@yunpat/core'
```

---

## 🎯 向后兼容性建议

### 方案 A：激进重构（推荐用于 v0.1.0）

**适用场景**: 早期版本，使用者少，可以承受破坏性变更

**策略**:

1. 直接修改 `@yunpat/core` 的公共 API
2. 同步更新所有内部使用者（ai/agents, packages/cli, packages/agents）
3. 一次性完成重构

**优点**:

- 代码更简洁
- 架构更合理
- 技术债务少

**缺点**:

- 需要同时修改多个文件
- 可能有遗漏的导入

**实施步骤**:

```
1. 修改 @yunpat/core 的 API
   ↓
2. 运行测试（失败）
   ↓
3. 更新所有内部使用者的导入
   ↓
4. 运行测试（通过）
   ↓
5. 提交
```

---

### 方案 B：渐进式迁移（推荐用于 v1.0+）

**适用场景**: 已有正式版本，有外部用户，不能破坏兼容性

**策略**:

1. 保留旧 API（标记为 `@deprecated`）
2. 创建新 API
3. 逐步迁移内部使用者到新 API
4. 在下个大版本删除旧 API

**示例**:

```typescript
// packages/core/src/agent/Agent.ts

/**
 * @deprecated 请使用 SimpleAgent 替代，将在 v2.0 删除
 */
export abstract class Agent<TInput, TOutput, TPlan, TResult, TReflection> {
  // 旧的复杂实现
}

/**
 * 新的简化 Agent
 */
export class SimpleAgent<Input, Output> {
  // 新的简单实现
}
```

**优点**:

- 不破坏现有代码
- 给使用者迁移时间

**缺点**:

- 维护两套代码
- 技术债务累积

---

## ✅ 我的建议：**方案 A（激进重构）**

### 原因

1. **版本是 0.1.0** - 早期版本，按照语义化版本规范，可以破坏兼容性
2. **private: true** - 未发布到 npm，没有外部用户
3. **内部使用者可控** - 可以同时修改所有内部文件
4. **避免技术债务** - 不需要维护两套 API

### 实施策略

#### 第一步：修改 Core API

**简化 Agent 基类**:

```typescript
// 旧版本（478 行）
export abstract class Agent<
  TInput = any,
  TOutput = any,
  TPlan = any,
  TResult = any,
  TReflection = any,
> {
  abstract plan(input: TInput, context: ExecutionContext): Promise<TPlan>
  abstract act(plan: TPlan, context: ExecutionContext): Promise<TResult>
  abstract reflect(result: TResult, context: ExecutionContext): Promise<TReflection>
}

// 新版本（~100 行）
export abstract class Agent<Input, Output> {
  abstract execute(input: Input, context: ExecutionContext): Promise<Output>
}
```

#### 第二步：同步更新所有使用者

使用 TDD 方式：

```typescript
// 1. 先写测试
describe('PatentWriterAgent', () => {
  it('should write patent', async () => {
    const agent = new PatentWriterAgent()
    const result = await agent.execute({
      title: '测试专利',
      field: 'AI',
      // ...
    })
    expect(result.patentApplication).toBeDefined()
  })
})

// 2. 运行测试（失败 - API 变了）

// 3. 更新 PatentWriterAgent
export class PatentWriterAgent extends Agent<PatentWritingInput, PatentWritingOutput> {
  async execute(input: PatentWritingInput): Promise<PatentWritingOutput> {
    // 实现逻辑
  }
}

// 4. 测试通过
```

#### 第三步：全局搜索替换

```bash
# 查找所有导入 Agent 的文件
grep -r "import.*Agent.*from.*@yunpat/core" --include="*.ts" --include="*.tsx"

# 手动更新每个文件的导入和实现
```

---

## 📋 兼容性检查清单

### ✅ 重构前（准备阶段）

- [ ] 列出所有 `@yunpat/core` 的公共 API
- [ ] 列出所有内部使用者（ai/agents, packages/cli, packages/agents）
- [ ] 评估哪些 API 需要修改
- [ ] 编写测试覆盖现有功能

### ✅ 重构中（执行阶段）

- [ ] 修改 `@yunpat/core` 的 API
- [ ] 更新所有内部使用者的导入
- [ ] 运行测试确保通过
- [ ] 检查是否有遗漏的导入

### ✅ 重构后（验证阶段）

- [ ] 运行所有测试
- [ ] 运行 CLI 工具确保正常
- [ ] 运行专利智能体确保正常
- [ ] 检查 TypeScript 编译无错误

---

## 🚨 风险评估

| 风险         | 概率 | 影响 | 缓解措施                |
| ------------ | ---- | ---- | ----------------------- |
| 遗漏某些导入 | 中   | 高   | 使用全局搜索 + 编译检查 |
| 破坏现有功能 | 中   | 高   | TDD 方式 + 完整测试     |
| 增加工作量   | 低   | 中   | 并行执行多个任务        |

---

## 🎯 最终建议

### 采用**方案 A（激进重构）**，原因：

1. ✅ 版本是 0.1.0，可以破坏兼容性
2. ✅ 没有外部用户，只有内部使用者
3. ✅ 避免技术债务累积
4. ✅ 一次性完成，成本低

### 具体步骤：

1. **TDD 方式**：先为现有功能编写测试
2. **修改 Core**：简化 Agent 基类、删除过度设计模块
3. **更新使用者**：同步更新所有内部导入
4. **验证**：运行测试 + TypeScript 编译

### 兼容性承诺：

- 对外：版本 0.1.0 → 1.0.0 期间可能有破坏性变更
- 对内：确保所有内部使用者同步更新，测试通过

---

## 📚 参考资料

- [语义化版本规范](https://semver.org/lang/zh-CN/)
- [TypeScript Handbook - Module Resolution](https://www.typescriptlang.org/docs/handbook/modules/theory.html#module-resolution)
