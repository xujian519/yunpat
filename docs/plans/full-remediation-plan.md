# YunPat 全面修复计划

> 基于全量审查报告，依据卡帕西编程四大原则制定
> 
> 审查基准：200K 行 Rust + 188K 行 TypeScript | 18 Rust crate + 42 TS 包 | 202 个测试文件

---

## 修复原则

| 原则 | 本次应用 |
|------|---------|
| 编码前思考 | 每个 Phase 先理解现状再动手，不假设、不猜测 |
| 简洁优先 | 只修复审查中发现的问题，不添加审查范围外的"改进" |
| 精准修改 | 每个改动都能追溯到审查报告的具体发现项 |
| 目标驱动 | 每个 Task 带验证标准，通过后才标记完成 |

---

## Phase 总览

| Phase | 名称 | 优先级 | 风险 | 预估工作量 | 任务数 |
|-------|------|--------|------|-----------|--------|
| P0 | 冗余文件清理 | 🔴 高（零风险） | 无 | 30 分钟 | 6 |
| P1 | Workspace 配置统一 | 🔴 高 | 中 | 2 小时 | 8 |
| P2 | Rust 依赖修复 | 🟡 中 | 低 | 1 小时 | 5 |
| P3 | TypeScript 构建修复 | 🟡 中 | 中 | 3 小时 | 7 |
| P4 | Agent 基类统一 | 🔴 高 | 高 | 8-12 小时 | 13 |
| P5 | 核心代码质量 | 🟡 中 | 中 | 4 小时 | 7 |
| P6 | 测试修复 | 🟡 中 | 低 | 4 小时 | 5 |
| P7 | 长期重构（建议） | 🟢 低 | 高 | 不定 | 6 |

---

## Phase 0：冗余文件清理

> 原则：简洁优先 — 删除所有无源码的空壳目录
> 风险：零 — 这些目录无 package.json、无源码、无被引用

### T0-1 删除外层 agents 孤儿目录

```
目标：packages/agents/（26 个空目录 + node_modules）
现状：无 package.json、无 .ts 文件、仅含空目录和 node_modules
原因：pnpm workspace 指向 packages/packages/agents/*，外层完全未使用
命令：rm -rf packages/agents/
验证：ls packages/agents/ 2>&1 → "No such file or directory"
```

### T0-2 删除 packages/tui/ 空壳

```
目标：packages/tui/
现状：仅有空的 src/commands/ 目录，无 package.json
命令：rm -rf packages/tui/
验证：ls packages/tui/ 2>&1 → "No such file or directory"
```

### T0-3 删除 packages/yunpat-rust/ 空目录

```
目标：packages/yunpat-rust/
现状：完全空目录
命令：rm -rf packages/yunpat-rust/
验证：ls packages/yunpat-rust/ 2>&1 → "No such file or directory"
```

### T0-4 删除顶层 packages/rust-gateway/ 空目录

```
目标：packages/rust-gateway/
现状：空目录，真实代码在 packages/packages/rust-gateway/
命令：rm -rf packages/rust-gateway/
验证：ls packages/rust-gateway/ 2>&1 → "No such file or directory"
```

### T0-5 删除顶层 packages/rust-tools/ 空目录

```
目标：packages/rust-tools/
现状：空目录，真实代码在 packages/packages/rust-tools/
命令：rm -rf packages/rust-tools/
验证：ls packages/rust-tools/ 2>&1 → "No such file or directory"
```

### T0-6 清理根目录残留 pnpm-lock.yaml

```
目标：/pnpm-lock.yaml（根目录下的锁文件）
现状：pnpm workspace 实际根在 packages/，根目录的锁文件未被使用
分析：根目录无 node_modules、无 pnpm-workspace.yaml，此锁文件无意义
命令：rm pnpm-lock.yaml
验证：git status 确认删除；cd packages && pnpm install 正常
注意：此步骤在 P1 完成 workspace 配置后再执行
```

### Phase 0 检查清单

- [ ] `packages/agents/` 已删除
- [ ] `packages/tui/` 已删除
- [ ] `packages/yunpat-rust/` 已删除
- [ ] `packages/rust-gateway/`（顶层）已删除
- [ ] `packages/rust-tools/`（顶层）已删除
- [ ] 根目录 `pnpm-lock.yaml` 已删除（P1 后）
- [ ] `make build-rust` 仍然通过
- [ ] `cd packages && pnpm install` 仍然通过

---

## Phase 1：Workspace 配置统一

> 原则：编码前思考 — 理清 pnpm workspace 的实际根在哪里
> 现状：pnpm 实际 workspace 根在 `packages/`，根目录的配置完全无效

### 现状分析

```
/YunPat/
├── package.json                    ← workspaces: ["packages/*", "packages/agents/*"]（无效）
├── pnpm-lock.yaml                  ← 无效锁文件（无 pnpm-workspace.yaml）
├── packages/
│   ├── pnpm-workspace.yaml         ← ✅ 实际 workspace 配置
│   ├── pnpm-lock.yaml              ← ✅ 实际锁文件
│   ├── package.json                ← workspaces 字段（被 pnpm 忽略）
│   ├── .npmrc                      ← 实际 npmrc
│   └── packages/                   ← 实际 TS 包
```

### T1-1 清理根目录 package.json 的 workspaces 字段

```
目标：/package.json
改动：移除 "workspaces" 字段
原因：根目录无 pnpm-workspace.yaml，workspaces 字段完全无效
保留：name, scripts（这些是 make 命令的入口）
```

### T1-2 确认 packages/pnpm-workspace.yaml 的路径模式

```
目标：packages/pnpm-workspace.yaml
现状内容：
  packages:
    - packages/*
    - packages/agents/*
验证：这两个模式正确解析到 packages/packages/* 和 packages/packages/agents/*
行动：无需修改（路径正确）
```

### T1-3 清理 packages/package.json 的 workspaces 字段

```
目标：packages/package.json
改动：移除 "workspaces" 字段
原因：pnpm 只读 pnpm-workspace.yaml，忽略 package.json 的 workspaces
保留：name, scripts, devDependencies（构建工具链需要）
```

### T1-4 统一构建入口

```
目标：packages/package.json 的 build 脚本
现状：
  "build": "node esbuild.config.mjs build"  ← 只构建 @yunpat/core
  "build:tsc": "pnpm -r --filter './packages/*' --filter './packages/agents/*' build"
问题：`pnpm build` 只构建 core，其他包需 `pnpm build:tsc`
改动方案（二选一）：
  A. 修改 "build" 为 "pnpm -r build"（让每个包自己的 build 脚本执行）
  B. 保持现状，更新 CLAUDE.md 说明
推荐：方案 A
验证：cd packages && pnpm build 后所有包的 dist/ 目录都存在
```

### T1-5 修复 esbuild.config.mjs 的 buildAll 函数

```
目标：packages/esbuild.config.mjs
现状：buildAll() 只调用 buildCore()，日志却显示"所有包构建完成"
改动：要么实现真正的全量构建，要么重命名为 buildCoreOnly()
推荐：如果改用 pnpm -r build，此文件可简化为仅构建 core
```

### T1-6 添加根目录 pnpm-workspace.yaml（可选）

```
分析：当前 pnpm workspace 根在 packages/ 是可行的，因为 Makefile 中的
      TS 命令都 cd 到 packages/ 执行。根目录只是 Rust + Makefile 入口。
决策：保持现状，不添加根目录 pnpm-workspace.yaml
原因：避免打破已有的 packages/ 内的工作流
```

### T1-7 更新 CLAUDE.md 的构建命令说明

```
目标：CLAUDE.md 中 "TypeScript 单包操作" 部分
补充：说明 pnpm workspace 根在 packages/ 目录
补充：说明 `pnpm build` 与 `pnpm build:tsc` 的区别
```

### T1-8 验证完整的依赖安装和构建

```
命令：
  cd packages && rm -rf node_modules && pnpm install
  cd packages && pnpm build
验证：
  - pnpm install 无错误
  - 所有包的 dist/ 目录生成
  - 无类型错误
```

### Phase 1 检查清单

- [ ] 根目录 `package.json` 已移除 workspaces 字段
- [ ] `packages/package.json` 已移除 workspaces 字段
- [ ] `packages/pnpm-workspace.yaml` 路径模式正确
- [ ] `pnpm install` 无错误
- [ ] `pnpm build` 构建所有包
- [ ] CLAUDE.md 已更新构建说明
- [ ] CI pipeline 仍然通过（检查 .github/workflows/ci.yml 的 cwd）

---

## Phase 2：Rust 依赖修复

> 原则：精准修改 — 只修依赖声明，不改代码逻辑

### T2-1 修复 mcp crate 的 path 依赖缺少 version

```
目标：crates/crates/mcp/Cargo.toml:13
现状：yunpat-protocol = { path = "../protocol" }
修改：yunpat-protocol = { path = "../protocol", version = "0.8.15" }
验证：cargo check -p yunpat-mcp 通过
```

### T2-2 修复 tui crate 的 yunpat-router 缺少 version

```
目标：crates/crates/tui/Cargo.toml:27
现状：yunpat-router = { path = "../yunpat-router" }
修改：yunpat-router = { path = "../yunpat-router", version = "0.8.15" }
验证：cargo check -p yunpat-tui 通过
```

### T2-3 迁移 tui crate 依赖到 workspace = true

```
目标：crates/crates/tui/Cargo.toml 的 [dependencies] 段（22-80行）
策略：逐个比对 workspace.dependencies 表，将匹配的依赖改为 workspace = true
需改的依赖（已在 workspace.dependencies 中定义）：
  anyhow, async-trait, axum, chrono, clap, clap_complete, dirs, flate2,
  futures-util, reqwest, serde, serde_json, sha2, thiserror, tokio, toml,
  tower-http, tracing, uuid, image
不改的依赖（不在 workspace 中或需要额外 features）：
  arboard, async-stream, base64, colored, crossterm, dotenvy, fd-lock,
  multimap, pdf-extract, portable-pty, ratatui, regex, rustyline, schemaui,
  shellexpand, shlex, similar, starlark, tar, tempfile, tiny_http,
  tokio-util, unicode-width, unicode-segmentation, wait-timeout, zeroize,
  schemars, ignore
验证：cargo check -p yunpat-tui 通过
```

### T2-4 修复 tui crate 的 axum 版本偏差

```
目标：crates/crates/tui/Cargo.toml
现状（迁移后）：axum.workspace = true（workspace 定义为 0.8.5）
验证：确认 workspace 中的 axum 版本 0.8.5 与 tui 的 features 兼容
如果 tui 需要 extra features，使用：
  axum = { workspace = true, features = ["ws"] }  # 按需添加
```

### T2-5 检查其他 crate 的 workspace 继承一致性

```
目标：检查 yunpat-agents, yunpat-models, yunpat-patent-tui 的 Cargo.toml
行动：grep 每个文件中未使用 workspace = true 的依赖
修复：与 T2-3 相同策略
验证：cargo check --workspace 通过
```

### Phase 2 检查清单

- [ ] `yunpat-mcp` 的 yunpat-protocol 依赖有 version 字段
- [ ] `yunpat-tui` 的 yunpat-router 依赖有 version 字段
- [ ] `yunpat-tui` 的共享依赖已迁移到 workspace = true
- [ ] axum 版本与 workspace 一致
- [ ] `cargo check --workspace` 零错误零警告
- [ ] `cargo clippy --workspace` 零新警告

---

## Phase 3：TypeScript 构建修复

> 原则：精准修改 — 修复配置问题，不改业务代码

### T3-1 修复 tsconfig.base.json 的废弃选项

```
目标：packages/tsconfig.base.json:18
现状："importsNotUsedAsValues": "remove"
修改："verbatimModuleSyntax": true
      移除 "importsNotUsedAsValues"
原因：importsNotUsedAsValues 在 TS 5.x 已废弃
注意：verbatimModuleSyntax 要求使用 `import type` 语法，
      可能需要修复一些文件中的 import 语句
验证：cd packages && pnpm build:tsc 无类型错误
```

### T3-2 修复 @yunpat/core 的 VERSION 硬编码

```
目标：packages/packages/core/src/index.ts:641
现状：export const VERSION = '0.2.0'
修改：从 package.json 动态读取
      import { readFileSync } from 'fs'
      const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf-8'))
      export const VERSION: string = pkg.version
验证：VERSION 值与 package.json 中的 version 一致
```

### T3-3 修复 @yunpat/core 的 export * 通配符冲突

```
目标：packages/packages/core/src/index.ts:645
现状：export * from './observability/index.js'
问题：通配符导出与上方具名导出冲突（PerformanceMetrics 等重复）
修改：改为具名导出
      export { type PerformanceMetrics, type MetricSnapshot, ... } from './observability/index.js'
      只导出上方未显式导出的符号
验证：cd packages/packages/core && npx tsc --noEmit 无错误
```

### T3-4 修复 tsconfig.json（根配置）与 tsconfig.base.json 的不一致

```
目标：packages/tsconfig.json（根）vs packages/tsconfig.base.json（包级）
问题：
  - 根配置缺少 declaration, declarationMap, sourceMap
  - 根配置有 lib: ["ES2022"] 但 base 有 lib: ["ES2022", "DOM"]
修改：统一两个配置的 compilerOptions
      或明确根配置只用于 IDE，包配置用于构建
验证：VSCode/其他 IDE 中无类型错误高亮
```

### T3-5 修复 ESLint 配置

```
目标：packages/.eslintrc.json
问题：
  A. 使用已废弃的 .eslintrc.json 格式
  B. ignorePatterns 引用过时路径 "ai/agents/**"
  C. @typescript-eslint/no-explicit-any 全局设为 warn 过于宽松
行动（按优先级）：
  1. 修复 ignorePatterns：改为 "packages/packages/agents/**"
  2. （可选）迁移到 ESLint flat config（eslint.config.js）
  3. （可选）收紧 no-explicit-any 规则
验证：cd packages && pnpm lint 通过
```

### T3-6 统一构建工具链

```
目标：packages/packages/ 下所有包
现状：
  - 大部分包用 tsc（package.json 的 "build": "tsc"）
  - 3 个包用 tsup（unity-checker, spec-formality-checker, subject-matter-checker）
  - core 用 esbuild
行动：
  1. 统一所有包的 build 脚本为 tsc
  2. 如果 tsup 包有特殊需求（如 CJS+ESM 双输出），保留 tsup 但加注释说明原因
验证：pnpm build 后所有包的 dist/ 正确生成
```

### T3-7 修复 @yunpat/skills 的 peerDependencies 问题

```
目标：packages/packages/skills/package.json
现状：peerDependencies 中使用 "workspace:*" 协议
问题：workspace:* 在 peerDeps 中不常见，可能在某些 pnpm 版本下解析异常
修改：peerDependencies 中 @yunpat/core 改为 "*" 或实际版本范围
      devDependencies 中保留 workspace:*
验证：pnpm install 无 peer 依赖警告
```

### Phase 3 检查清单

- [ ] tsconfig.base.json 无废弃选项
- [ ] `@yunpat/core` VERSION 从 package.json 动态读取
- [ ] `@yunpat/core` 无 export * 通配符冲突
- [ ] tsconfig 根配置与 base 配置一致
- [ ] ESLint ignorePatterns 路径正确
- [ ] pnpm lint 通过
- [ ] pnpm build 所有包成功
- [ ] pnpm install 无 peer 依赖警告

---

## Phase 4：Agent 基类统一（最高优先级重构）

> 原则：目标驱动 — 先定义"所有 Agent 都 extend ProfessionalAgent"为成功标准
> 风险：高 — 涉及 24 个 agent 的核心架构改动

### 迁移前现状

| 基类 | Agent 数量 | Agent 列表 |
|------|-----------|-----------|
| `ProfessionalAgent` ✅ | 5 | legal-qa, patent-analyzer(ComparisonAnalyzer), patent-responder, search, tech-unit |
| `KnowledgeEnhancedAgent` ⚠️ | 10 | analysis(PriorArtAnalyzer, DisclosureRefiner, ComparisonReportGen), invention, prior-art-search, quality(Enhanced), researcher, subject-matter-checker, writer |
| `Agent` 🔴 | 11 | abstract-drafter, claim-generator, comparison-report-generator, format-converter, image-understanding, patent-analyzer(CreativeAnalyzer), patent-manager, quality-checker, spec-formality-checker, specification-drafter, technical-drawing, unity-checker |
| `SkillsProfessionalAgent` | 0（已定义但无使用者） | — |

### 迁移策略

分 3 轮执行，每轮迁移后立即运行测试：
- **Round 1**：`Agent` → `ProfessionalAgent`（11 个，风险最高）
- **Round 2**：`KnowledgeEnhancedAgent` → `ProfessionalAgent`（10 个，风险中等）
- **Round 3**：清理 `SkillsProfessionalAgent`（如无使用者，考虑移除）

### T4-1 建立迁移模板和测试基线

```
目标：创建迁移操作的标准流程
行动：
  1. 编写一个迁移 checklist 模板（见下方）
  2. 运行现有 agent 测试，记录通过/失败基线
  3. 确认 ProfessionalAgent 的抽象方法列表
验证：有清晰的迁移前后对比标准
```

### 单个 Agent 迁移 Checklist（模板）

```
对每个 Agent 执行：
1. 读取当前实现，理解 plan() 和 act() 的签名和逻辑
2. 将 extends Agent/KnowledgeEnhancedAgent 改为 extends ProfessionalAgent
3. 将 import 改为 from '@yunpat/agent-base'
4. 如果缺少 plan() 方法，从 act() 中拆分出规划逻辑
5. 将 config 类型改为 ProfessionalAgentConfig
6. 将 act(context) 签名改为 act(context: ExtendedExecutionContext)
7. 将直接 llm.chat() 调用改为 this.callLLM()（如果有）
8. 将返回值改为 AgentResult<T> 包装
9. 添加 package.json 对 @yunpat/agent-base 的依赖（如果没有）
10. 运行该 agent 的测试
```

### T4-2 Round 1：迁移 Agent 基类的 11 个 Agent

```
按风险从低到高排序（先迁移简单的 checker 类，再迁移复杂的生成类）：

优先级 A（checker 类，通常无 LLM 调用，迁移简单）：
  - unity-checker
  - spec-formality-checker
  - quality-checker

优先级 B（工具类，有明确输入输出）：
  - format-converter
  - technical-drawing
  - image-understanding
  - comparison-report-generator

优先级 C（复杂生成类，有 LLM 调用和重试逻辑）：
  - patent-manager
  - claim-generator
  - specification-drafter
  - abstract-drafter

每完成一个：运行 cargo test + pnpm test
```

### T4-3 Round 2：迁移 KnowledgeEnhancedAgent 基类的 10 个 Agent

```
这些 Agent 已经有 plan()/act() 结构和知识图谱集成，
迁移主要涉及：
  - 改 extends 为 ProfessionalAgent
  - 改 import 来源
  - 改上下文类型为 ExtendedExecutionContext

顺序：
  - researcher
  - writer
  - prior-art-search
  - subject-matter-checker
  - invention
  - analysis (3 个子 Agent)
  - quality (EnhancedQualityCheckerAgent)
```

### T4-4 修复 patent-analyzer 的双 Agent 问题

```
目标：packages/packages/agents/patent-analyzer/
现状：同时导出 ComparisonAnalyzerAgent（ProfessionalAgent）和 CreativeAnalyzerAgent（Agent）
行动：
  1. 确认两个 Agent 的职责划分
  2. 将 CreativeAnalyzerAgent 迁移到 ProfessionalAgent
  3. 如果两者高度重叠，考虑合并
验证：patent-analyzer 的测试全部通过
```

### T4-5 处理 quality 和 quality-checker 的命名冲突

```
目标：packages/packages/agents/quality/ 和 quality-checker/
现状：两个包都导出 QualityCheckerAgent，但基类不同
  - quality/QualityCheckerAgent extends Agent
  - quality/EnhancedQualityCheckerAgent extends KnowledgeEnhancedAgent
  - quality-checker/QualityCheckerAgent extends Agent
行动：
  1. 确认 MCP Server 使用的是哪个
  2. 合并或明确区分两个包的职责
  3. 统一基类为 ProfessionalAgent
验证：MCP Server 的 QualityCheckerTool 指向正确的实现
```

### T4-6 处理 comparison-report-generator 的双重存在

```
目标：packages/packages/agents/comparison-report-generator/ 和 analysis/ 内都有
现状：analysis 包内也有 ComparisonReportGeneratorAgent
行动：
  1. 确认 MCP Server 注册的是哪个
  2. 消除重复，保留一个权威实现
验证：MCP Server 的 ComparisonReportTool 指向唯一实现
```

### T4-7 移除或激活 SkillsProfessionalAgent

```
目标：packages/packages/agents/base/ 中的 SkillsProfessionalAgent
现状：已定义但无任何 Agent 使用
行动（二选一）：
  A. 如果短期无使用计划，标记 @deprecated 并在 CLAUDE.md 记录
  B. 如果有明确的 Skills 集成需求，为至少一个 Agent 实现迁移
推荐：方案 A
验证：base 包的测试通过，导出列表不变
```

### T4-8 更新 MCP Server 的工具映射

```
目标：packages/packages/mcp-server/src/tools/
行动：
  1. 确认所有 28 个 MCP 工具指向的 Agent 实现已更新
  2. 验证工具的输入/输出 schema 与新基类的 AgentResult<T> 兼容
  3. 更新工具构造函数中的 Agent 实例化代码
验证：cd packages/packages/mcp-server && npx vitest run
```

### T4-9 更新 orchestrator 的调度逻辑

```
目标：packages/packages/orchestrator/
行动：
  1. 确认 orchestrator 的 Agent 调度接口兼容 ProfessionalAgent 的 run() 方法
  2. 更新类型引用
验证：cd packages/packages/orchestrator && pnpm test
```

### T4-10 运行完整 Agent 集成测试

```
目标：packages/packages/agents/integration-tests/ 和 packages/packages/agents/test/
命令：
  cd packages/packages/agents && pnpm test
  cd packages/packages/agents/integration-tests && pnpm test
验证：所有 agent 测试通过，零 skip
```

### T4-11 更新 Rust 端的 PatentAgent trait 对齐

```
目标：crates/crates/yunpat-agents/src/lib.rs
行动：
  1. 确认 Rust 侧的 PatentAgent trait 与 TS 侧的 ProfessionalAgent 接口对齐
  2. 如果 TS 侧新增了统一的返回类型，Rust 侧的 AgentResult 也应同步
验证：cargo test -p yunpat-agents 通过
```

### T4-12 更新 CLAUDE.md 的 Agent 架构说明

```
目标：CLAUDE.md "专业 Agent" 部分
补充：
  - 所有 24 个 Agent 统一继承 ProfessionalAgent
  - 迁移后的架构图
  - 新增 Agent 的 checklist（必须 extend ProfessionalAgent）
```

### T4-13 Phase 4 完整回归验证

```
命令：
  make build
  make test-rust
  cd packages && pnpm test
  cd packages/packages/mcp-server && npx vitest run test/e2e.test.ts
验证：
  - Rust 全部通过
  - TS 全部通过，零 skip
  - MCP Server E2E 通过
  - 无类型错误
```

### Phase 4 检查清单

- [ ] 所有 24 个 Agent 都 extends ProfessionalAgent
- [ ] 无 Agent 直接 extends Agent（除 base 包本身）
- [ ] 无 Agent 直接 extends KnowledgeEnhancedAgent（除 base 包本身）
- [ ] 所有 Agent 使用 AgentResult<T> 返回类型
- [ ] 所有 Agent 使用 ExtendedExecutionContext
- [ ] patent-analyzer 的双 Agent 已统一
- [ ] quality / quality-checker 的重复已消除
- [ ] comparison-report-generator 的重复已消除
- [ ] MCP Server 28 个工具映射正确
- [ ] orchestrator 调度逻辑兼容
- [ ] Rust PatentAgent trait 同步
- [ ] CLAUDE.md 已更新
- [ ] `make test` 全部通过
- [ ] `make build` 全部通过

---

## Phase 5：核心代码质量

> 原则：简洁优先 — 解决直接影响可维护性的问题

### T5-1 拆分 yunpat-core/lib.rs

```
目标：crates/crates/core/src/lib.rs（1645 行）
拆分为：
  - mod runtime;      // Runtime 结构体和核心编排
  - mod job_manager;  // JobManager（带重试/退避/持久化）
  - mod thread_manager; // ThreadManager（线程生命周期）
  - mod helpers;      // ~20 个序列化/转换辅助函数
  - lib.rs 只保留 mod 声明和 pub use 重导出
验证：cargo check -p yunpat-core && cargo test -p yunpat-core
```

### T5-2 修复 orchestrator 的关键 TODO（HITL）

```
目标：packages/packages/orchestrator/src/executor/TaskExecutor.ts:293
现状：HITL（Human-in-the-loop）处理是 stub
行动：
  1. 实现 HITL 暂停/恢复机制
  2. 集成 execpolicy-hook 的审批门控
  3. 编写测试
验证：HITL 场景的测试通过
```

### T5-3 实现 orchestrator 的本地模型支持

```
目标：packages/packages/orchestrator/src/llm/LLMClient.ts:151
现状：Ollama 本地模型支持未实现
行动：
  1. 实现 Ollama provider（OpenAI 兼容 API）
  2. 与 DataSovereigntyChecker 的 CON-01 路由集成
  3. 编写测试
验证：CON-01 规则触发时能路由到本地模型
```

### T5-4 实现核心重试逻辑

```
目标：packages/packages/core/src/coordinator/PatentCoordinator.ts:601
现状：无重试逻辑
行动：
  1. 为 LLM 调用添加指数退避重试
  2. 配置化最大重试次数
  3. 编写测试
验证：模拟 API 失败后重试成功
```

### T5-5 实现 LLM 摘要压缩

```
目标：
  - packages/packages/core/src/compact/session-memory-compact.ts:113,137
  - packages/packages/core/src/compact/api-summary-compact.ts:100,127
现状：LLM 摘要生成未实现
行动：
  1. 实现 session memory 的 LLM 压缩
  2. 实现 API 摘要的 LLM 生成
  3. 编写测试
验证：长对话历史能正确压缩
```

### T5-6 修复 AgentTeam 的 failFast 配置

```
目标：packages/packages/core/src/coordinator/AgentTeam.ts:245
现状：failFast 选项不可配置
行动：暴露为 AgentTeamConfig 的一个字段
验证：测试中可配置 failFast=true/false
```

### T5-7 清理 yunpat-tui 的双重 HTTP 框架

```
目标：crates/crates/tui/Cargo.toml
现状：同时依赖 axum 和 tiny_http
行动：
  1. grep 源码中 tiny_http 的使用位置
  2. 如果功能与 axum 重叠，迁移到 axum 并移除 tiny_http
  3. 如果 tiny_http 有独特用途（如轻量健康检查），保留但加注释
验证：cargo check -p yunpat-tui
```

### Phase 5 检查清单

- [ ] `yunpat-core` 的 lib.rs 已拆分为 4 个模块
- [ ] HITL 机制已实现并有测试
- [ ] 本地模型（Ollama）支持已实现
- [ ] LLM 调用重试逻辑已实现
- [ ] 会话记忆压缩已实现
- [ ] AgentTeam.failFast 可配置
- [ ] tui 的 HTTP 框架冗余已清理
- [ ] 所有修改有对应测试
- [ ] `make test` 全部通过

---

## Phase 6：测试修复

> 原则：目标驱动 — 零 skip 是唯一成功标准

### T6-1 修复 4 个跳过的测试套件

```
行动：
  1. 定位所有 test.skip / describe.skip / it.skip
  2. 分析每个 skip 的原因
  3. 修复底层问题
  4. 移除 skip 标记
验证：grep -r "test.skip\|describe.skip\|it.skip" packages/ --include="*.ts" 返回零结果
```

### T6-2 补充 Agent 迁移后的回归测试

```
目标：Phase 4 迁移后的 24 个 Agent
行动：
  1. 每个 Agent 至少有一个基本的 plan+act 单元测试
  2. 验证 AgentResult<T> 返回类型
  3. 验证错误路径返回 AgentError
验证：所有 agent 包的 pnpm test 通过
```

### T6-3 补充 MCP Server 工具注册测试

```
目标：packages/packages/mcp-server/
行动：
  1. 验证所有 28 个工具都能正确实例化
  2. 验证 tool schema 的 inputSchema 和 outputSchema 有效
  3. 验证工具到 Agent 的映射正确
验证：cd packages/packages/mcp-server && npx vitest run
```

### T6-4 补充 Rust 端集成测试

```
目标：yunpat-mcp-bridge 和 yunpat-router
行动：
  1. bridge：添加 MCP handshake → tools/list → tools/call 的端到端测试
  2. router：验证 18 个 slash 命令的正确路由
验证：cargo test -p yunpat-mcp-bridge && cargo test -p yunpat-router
```

### T6-5 运行完整测试套件并记录基线

```
命令：
  make test 2>&1 | tee test-baseline.log
记录：
  - Rust 测试总数、通过数、失败数
  - TS 测试总数、通过数、失败数、跳过数
  - 总耗时
验证：零失败、零跳过
```

### Phase 6 检查清单

- [ ] 零 test.skip / describe.skip / it.skip
- [ ] 24 个 Agent 各有基本单元测试
- [ ] MCP Server 28 个工具注册验证
- [ ] Rust bridge 和 router 有集成测试
- [ ] 测试基线已记录
- [ ] `make test` 零失败零跳过

---

## Phase 7：长期重构建议（不在此轮执行）

> 记录但不立即执行，供后续规划参考

### R-1 yunpat-tui crate 拆分

```
目标：将 ~170K 行的 tui crate 拆分为：
  - yunpat-tui-core：TUI 渲染、事件循环
  - yunpat-app-server：HTTP/SSE 服务（已有独立 crate）
  - yunpat-document-processing：PDF/DOCX/图片处理
  - yunpat-scripting：Starlark 脚本引擎
优先级：低（功能正常，仅可维护性）
```

### R-2 crates/crates/ 路径重构

```
目标：消除 crates/crates/ 双层嵌套
方案：将 crates/crates/* 移到 crates/* 上层目录
      将 crates/ 中的非 Rust 内容（Dockerfile, website 等）移出
优先级：低（不影响功能）
风险：高（需修改所有 Cargo.toml 的 path 引用 + CI 路径）
```

### R-3 ESLint 迁移到 flat config

```
目标：从 .eslintrc.json 迁移到 eslint.config.js
优先级：低
```

### R-4 自动化 Agent 基类检查

```
目标：添加 CI 检查，确保新 Agent 必须继承 ProfessionalAgent
方案：编写脚本扫描所有 agent 的 extends 声明
优先级：中（防止技术债回归）
```

### R-5 统一包构建工具

```
目标：所有 TS 包统一使用 tsc 或统一使用 tsup
优先级：低
```

### R-6 实现完整的 version drift 检测

```
目标：CI 中自动检测 crate 间版本号不一致
现状：CI 已有 rust-version-check job，可扩展
优先级：中
```

---

## 执行时间线

```
Week 1:
  Day 1-2: Phase 0（冗余清理）+ Phase 2（Rust 依赖修复）+ Phase 1（Workspace 配置）
  Day 3-4: Phase 3（TS 构建修复）
  Day 5:   Phase 6-T6-1（修复跳过的测试）+ 基线记录

Week 2:
  Day 1-3: Phase 4 Round 1（Agent 基类迁移 — 11 个 Agent 包）
  Day 4-5: Phase 4 Round 2（Agent 基类迁移 — 10 个 Agent 包）

Week 3:
  Day 1-2: Phase 4 收尾（MCP 映射、orchestrator、文档）
  Day 3-5: Phase 5（核心代码质量 — HITL、重试、压缩）

Week 4:
  Day 1-2: Phase 6（测试补充）
  Day 3-5: Phase 7 中的 R-4（自动化基类检查）+ 回归测试 + 文档更新
```

---

## 全局验证清单（所有 Phase 完成后）

### 编译与构建

- [ ] `cargo check --workspace` 零错误
- [ ] `cargo clippy --workspace` 零新警告
- [ ] `cargo fmt --check --all` 通过
- [ ] `cd packages && pnpm build` 所有包成功
- [ ] `cd packages && pnpm lint` 通过

### 测试

- [ ] `make test-rust` 全部通过
- [ ] `make test-ts` 全部通过，零 skip
- [ ] MCP Server E2E 测试通过
- [ ] 数据主权检测测试通过
- [ ] Intent hook 测试通过

### 结构

- [ ] 无孤儿目录
- [ ] Workspace 配置唯一且一致
- [ ] 所有 Rust path 依赖有 version 字段
- [ ] 共享依赖使用 workspace = true

### Agent 架构

- [ ] 24 个 Agent 全部继承 ProfessionalAgent
- [ ] 无类型名冲突（export * 通配符已消除）
- [ ] MCP Server 28 工具注册正确
- [ ] Rust PatentAgent trait 与 TS 对齐

### 文档

- [ ] CLAUDE.md 已更新所有变更
- [ ] 构建命令说明准确
- [ ] Agent 架构描述与实际代码一致
