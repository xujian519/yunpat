# 并行重构计划

## 🚀 并行执行策略

### 阶段一：立即并行启动（Day 1-2）

#### 🔴 P0 任务组 A：修复关键 Bug
- [ ] 修复 EventBus 缩进 Bug
- [ ] 为 EventBus 编写测试
- [ ] 验证修复

**负责人**: Agent A (Bug修复专家)
**预计时间**: 2小时

---

#### 🔴 P0 任务组 B：删除过度设计模块
- [ ] 删除 ModelVoting.ts (1123 行)
- [ ] 删除 PromptOptimizer.ts (368 行)
- [ ] 删除 ResilientLLMAdapter.ts (543 行)
- [ ] 删除 TransactionManager.ts
- [ ] 更新导入和引用

**负责人**: Agent B (重构专家)
**预计时间**: 3小时

---

#### 🔴 P0 任务组 C：清理 Mock 数据
- [ ] 清理 PatentAnalyzerAgent.ts 硬编码
- [ ] 清理 EnhancedPatentWriterAgent.ts 硬编码
- [ ] 清理 PatentManagerAgent.ts 硬编码
- [ ] 清理 cli/patent-cli/index.js 硬编码

**负责人**: Agent C (代码清理专家)
**预计时间**: 4小时

---

#### 🟡 P1 任务组 D：搭建 CI（可并行）
- [ ] 创建 .github/workflows/ci.yml
- [ ] 配置 pnpm action
- [ ] 配置测试运行
- [ ] 验证 CI 工作

**负责人**: Agent D (DevOps专家)
**预计时间**: 1小时

---

### 阶段二：后续并行（Day 3-7）

#### 🟡 P1 任务组 E：简化 Agent 基类（TDD）
- [ ] 为 Agent 基类编写测试
- [ ] 简化 Agent 基类（478行 → ~100行）
- [ ] 移除不必要的泛型
- [ ] 更新所有子类

**负责人**: Agent E (架构师)
**预计时间**: 1天

---

#### 🟡 P1 任务组 F：配置 ESLint（可并行）
- [ ] 创建 .eslintrc.json
- [ ] 配置规则
- [ ] 修复所有 lint 错误
- [ ] 添加 pre-commit hook

**负责人**: Agent F (代码质量专家)
**预计时间**: 4小时

---

#### 🟢 P2 任务组 G：补充测试（可并行）
- [ ] 为 LLM 适配器编写测试
- [ ] 为 Gateway 编写测试
- [ ] 为 Memory 编写测试
- [ ] 配置 coverage 报告

**负责人**: Agent G (测试工程师)
**预计时间**: 2天

---

## 📋 并行执行检查清单

### ✅ Day 1-2（立即启动）
- [ ] **组 A**: EventBus Bug 修复 + 测试
- [ ] **组 B**: 删除 4 个过度设计模块
- [ ] **组 C**: 清理 4 个文件的硬编码
- [ ] **组 D**: 搭建 CI

### ✅ Day 3-7（后续并行）
- [ ] **组 E**: TDD 简化 Agent 基类
- [ ] **组 F**: 配置 ESLint + pre-commit
- [ ] **组 G**: 补充核心模块测试

---

## 🎯 成功标准

### Day 2 结束时
- [ ] EventBus Bug 已修复，测试通过
- [ ] 删除 ~2,000 行过度设计代码
- [ ] 所有硬编码 mock 已清理
- [ ] CI 可以自动运行测试

### Day 7 结束时
- [ ] Agent 基类简化到 < 150 行
- [ ] ESLint 配置完成，无错误
- [ ] 核心模块测试覆盖率达到 60%
- [ ] Pre-commit hook 正常工作

---

## 🔄 任务依赖关系

```
组 A (EventBus) → 无依赖，可立即开始
组 B (删除模块) → 无依赖，可立即开始
组 C (清理Mock) → 无依赖，可立即开始
组 D (CI) → 无依赖，可立即开始

组 E (简化Agent) → 依赖组B完成（删除模块后）
组 F (ESLint) → 无依赖，可立即开始
组 G (测试) → 依赖组A、E完成（代码稳定后）
```
