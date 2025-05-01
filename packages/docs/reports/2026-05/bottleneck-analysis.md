# YunPat 项目深度调研：关键卡点分析

> 日期：2026-05-06
> 范围：全项目（718 TS/TSX 源文件、195 测试文件、46 个 package.json、16 个 CI workflow、Docker、Rust）
> 方法：静态分析 + 构建验证 + CI 配置审查 + 测试质量审计

---

## 项目概览

| 指标                     | 数值                                                      |
| ------------------------ | --------------------------------------------------------- |
| TS/TSX 源文件            | 718 个                                                    |
| 测试文件                 | 195 个                                                    |
| package.json             | 46 个                                                     |
| GitHub Actions workflows | 16 个（3 个禁用）                                         |
| 废弃代码 (`_archive/`)   | 114 个源文件，31,686 行                                   |
| Rust 项目                | 2 个（`packages/rust-gateway/` + `packages/rust-tools/`） |
| ESLint 警告              | 377 个                                                    |
| TODO/FIXME               | 25 处                                                     |
| 最近提交活跃度           | 270 次 (2026年)，5月3-5日峰值 172 次                      |
| 声称完成度               | README: ~75%，.env.example: ~40%                          |

---

## 🔴 P0 — 阻塞生产就绪

### 1. CI 核心测试被主动跳过

**当前状态**：`ci.yml` 测试步骤明确跳过 core 包测试：

```yaml
- name: 运行测试
  run: |
    # 暂时跳过core包测试（需要外部服务，作为技术债务处理）
    pnpm --filter "@yunpat/orchestrator" test
    pnpm --filter "@yunpat/grpc-server" test
```

**实际影响**：

- core 包（82 个测试文件、~62,000 行代码）在 CI 中完全未验证
- 只跑了 orchestrator 和 grpc-server 两个包的测试
- GitHub 上的 CI ✅ 绿色状态是虚假的——任何 core 的回归都无法被 CI 捕获

**根因**：core 测试依赖真实 LLM API key（`DEEPSEEK_API_KEY` 或 `GLM_API_KEY`），CI 环境没有配置这些 secrets。

**建议**：

- 引入 mock LLM 适配器，使 core 测试可在无 API key 的 CI 环境运行
- 或为 GitHub Actions 配置 repository secrets
- 将当前跳过测试的注释替换为显式的条件判断（`if: env.DEEPSEEK_API_KEY != ''`）

---

### 2. 零集成/E2E 测试覆盖核心专利流程

**当前状态**：195 个测试文件中，集成/E2E 测试仅 7 个：

```
packages/core/test/llm/embedding.integration.test.ts
packages/core/test/integration/hallucination-detection.integration.test.ts
packages/core/test/planning/planning.integration.test.ts
packages/core/test/replanning/IncrementalPlanner.integration.test.ts
packages/core/test/postgres-store.integration.test.ts
packages/core/test/oauth.integration.test.ts
packages/agents/image-understanding/test/DrawingUnderstandingAgent.integration.test.ts
```

**缺失的集成测试**：

- PatentWriterAgent 端到端撰写流程（发明理解 → 检索 → 说明书 → 权利要求 → 摘要）
- PatentAnalyzerAgentV2 分析管线（6 阶段管线）
- PatentResponderAgentV5 答复管线
- Orchestrator → Agent 调度流程
- Rust Gateway → Orchestrator Adapter → Agent 全链路

**影响**：号称"最成熟"的三个 agent（Writer/Analyzer/Responder）缺乏端到端验证。`README.md` 声称 90% 测试覆盖，实际覆盖的是孤立单元，不验证任何真实专利工作流。

---

### 3. Rust 双项目分裂，集成路径矛盾

存在两个独立的 Rust 项目，彼此无引用关系：

| 位置                     | 文件数  | 代码行数 | 定位                                    | 测试                 |
| ------------------------ | ------- | -------- | --------------------------------------- | -------------------- |
| `packages/rust-gateway/` | 16      | 1,963    | HTTP 网关 (axum)                        | 无测试文件           |
| `packages/rust-tools/`   | 3 crate | ~400     | 工具链 (tokenizer, similarity, service) | 3 个 `it_works` 占位 |

**矛盾点**：

| 配置文件                  | 引用的 Rust 路径              |
| ------------------------- | ----------------------------- |
| `Dockerfile` 阶段 0       | `packages/rust-gateway/`      |
| `ci.yml.disabled`         | `packages/rust-tools/`        |
| `ci-stable.yml`           | `packages/rust-tools/`        |
| root `docker-compose.yml` | 无 Rust 服务                  |
| `README.md`               | 描述为 `packages/rust-tools/` |

**问题**：

- Docker 构建 Rust Gateway 的二进制放入 `/usr/local/bin/yunpat-gateway`
- 但 `packages/patent-core` 通过 `PatentCoreBridge.js` 调用 Rust CLI，这个 CLI 在哪里构建？
- 两个 Rust 项目编译都通过，但没有明确的职责划分文档

**建议**：

- 决定哪个 Rust 项目是主项目（推荐统一到 `packages/rust-tools/`）
- 更新 Dockerfile 引用正确路径
- 或显式声明两项目的职责分工（gateway = 网络层，rust-tools = 算法层）

---

### 4. Orchestrator 零 Lint 覆盖

```json
// packages/orchestrator/package.json
"lint": "echo 'Orchestrator lint skipped - ESLint 9.x migration needed'",
"lint:fix": "echo 'Orchestrator lint fix skipped - ESLint 9.x migration needed'"
```

**背景**：根 `.eslintrc.json` 使用旧版 eslintrc 格式，ESLint 9.x 已迁移到 flat config (`eslint.config.mjs`)。orchestrator 包的 ESLint 检查因此被完全跳过。

**影响**：

- orchestrator 是中枢调度层，依赖 26 个 agent 包（`workspace:*`）
- 类型安全是 error 级别（`no-explicit-any: error`）但 lint 根本不跑
- 约 17 个源文件未经任何代码质量检查

**额外发现**：根 `.eslintrc.json` 有 overrides 规则对 orchestrator 设定了更严格的 `error` 级别：

```json
{
  "overrides": [
    {
      "files": ["packages/orchestrator/**", "packages/agents/test/**"],
      "rules": {
        "@typescript-eslint/no-unused-vars": "error",
        "@typescript-eslint/no-explicit-any": "error"
      }
    }
  ]
}
```

但这些规则因为 lint 被跳过而从未生效。

---

## 🟠 P1 — 重大技术债务

### 5. 31,686 行废弃代码（`_archive/`）

```
_archive/patents/    # 旧版 patents 代码
_archive/test/       # 旧版测试代码
```

- 114 个 TS/TSX 源文件
- 31,686 行代码
- 约占活跃代码库的 17%

**影响**：

- `grep` 搜索会命中废弃代码，增加噪音
- 新开发者可能参考过时的实现
- 代码库看起来比实际大 17%

---

### 6. 377 个 ESLint 警告

主要类别：

- `@typescript-eslint/no-explicit-any`：系统性使用了 `any` 类型
- `@typescript-eslint/no-unused-vars`：未使用的导入和变量

按包分布（部分）：

- `packages/agents/base`：23 个 warning
- orchestrator：lint 完全跳过（实际未知）
- 多数包的 `no-explicit-any` 设置为 warn，但数量已累积到 377

---

### 7. 8 个包测试缺失或为占位

| 包                                | 测试状态                          | 风险等级                    |
| --------------------------------- | --------------------------------- | --------------------------- |
| `@yunpat/patent-core`             | `echo "Test not implemented yet"` | **高** — Rust bridge 零验证 |
| `@yunpat/patent-knowledge`        | `echo "Test not implemented yet"` | 中 — 知识库桥接             |
| `@yunpat/patent-prompts`          | `echo "Test not implemented yet"` | 中 — 提示词模板             |
| `@yunpat/unified-knowledge-graph` | `echo "Test not implemented yet"` | 中 — 知识图谱               |
| `@yunpat/agent-researcher`        | `echo "Test not implemented yet"` | 低 — 较少使用               |
| `@yunpat/agent-writer`            | `echo "Test not implemented yet"` | 低 — 较少使用               |
| `@yunpat/orchestrator-adapter`    | 无 test script                    | **高** — Rust↔Node 桥接     |
| `@yunpat/tui`                     | 无 test script                    | 中 — 终端 UI                |

另有 3 个 agent 包使用占位测试（7 行 stub）：

```
packages/agents/claim-generator/test/placeholder.test.ts     (7 行)
packages/agents/base/test/placeholder.test.ts                 (7 行)
packages/agents/abstract-drafter/test/placeholder.test.ts     (7 行)
```

---

### 8. Rust 测试只有占位

三个 Rust crate 各一个 `it_works` 测试：

```
running 1 test
test tests::it_works ... ok    # yunpat-tokenizer (14 行 lib.rs)

running 1 test
test tests::it_works ... ok    # yunpat-similarity (14 行 lib.rs)

running 1 test
test tests::it_works ... ok    # tools-service (374 行 main.rs)
```

tools-service 有 374 行业务逻辑，零测试覆盖。Tokenizer 和 similarity 各 14 行，可能也未实现实质功能。

---

### 9. pnpm audit 不可用

```
ERR_PNPM_AUDIT_ENDPOINT_NOT_EXISTS
The audit endpoint (at https://registry.npmmirror.com/-/npm/v1/security/audits) is doesn't exist.
```

项目配置使用了 npmmirror.com（淘宝 npm 镜像），该镜像不支持安全审计端点。

**影响**：

- 无法检测依赖安全漏洞
- CI 中的 `pnpm audit` 步骤同样会失败（包括 `automation.yml` 中的定期检查）
- 建议切回 `https://registry.npmjs.org/` 或配置 scoped registry

---

## 🟡 P2 — 开发效率瓶颈

### 10. CI 配置碎片化

存在 4 个互相矛盾的 CI workflow：

| Workflow                | 状态  | Runner                  | Node 版本  | pnpm 版本 | 范围                                                              |
| ----------------------- | ----- | ----------------------- | ---------- | --------- | ----------------------------------------------------------------- |
| `ci.yml`                | 活跃  | ubuntu-latest           | 20.x, 22.x | 10        | lint + type-check + build + 测试(orchestrator+grpc)               |
| `ci.yml.disabled`       | 禁用  | ubuntu-latest           | 18.x, 20.x | 9         | lint + type-check + format + test + Rust + Python + Docker + 安全 |
| `ci-stable.yml`         | 活跃  | self-hosted macos-arm64 | 20.x       | 9         | lint + type-check + format + test + Rust + 安全 + build           |
| `optimized-ci.yml`      | 活跃? | ubuntu-latest           | 20         | 10        | lint + format + type-check + unit-test + build + integration-test |
| `ci-local.yml.disabled` | 禁用  | self-hosted             | -          | -         | -                                                                 |

**问题**：

- 多个 workflow 使用不同版本号（pnpm 9 vs 10，Node 18 vs 20 vs 22）
- 不清楚哪个是"真正的" CI
- 禁用的 workflow（最完整的那个）保留了但未启用——为什么？
- `ci-stable.yml` 依赖 self-hosted runner，外部贡献者无法运行

---

### 11. Docker 路径与多语言架构不匹配

- `Dockerfile` 构建 `packages/rust-gateway/`，但 root `docker-compose.yml` 不包含 Rust 服务
- `docker/python-tools/docker-compose.yml` 中 vector-service、scheduler-service、agent-service 全部被注释（标记"待实现"）
- Docker Compose 为 4 个 agent 定义独立容器（patent-writer, patent-analyzer, patent-responder, patent-search），但都使用同一个 `Dockerfile`
- `entrypoint.sh` 定义了 5 种启动模式但只有 `full` 模式引用 Rust Gateway

---

### 12. orchestrator 依赖爆炸

```json
// packages/orchestrator/package.json
"dependencies": {
  "@yunpat/core": "workspace:*",
  "@yunpat/agent-patent-writer": "workspace:*",
  "@yunpat/agent-patent-analyzer": "workspace:*",
  "@yunpat/agent-patent-responder": "workspace:*",
  "@yunpat/agent-search": "workspace:*",
  // ... 共 26 个 agent 包
}
```

**问题**：

- 任何 agent 包的变更都需要重新构建 orchestrator
- 这与"框架笨、智能体专"的设计理念矛盾——框架层不应硬依赖所有智能体
- 合理设计应是 agent 通过 EventBus 注册，orchestrator 动态发现

---

### 13. 文档内进度不一致

| 来源                | 声称完成度           |
| ------------------- | -------------------- |
| `README.md` 顶部    | "总体完成度: ~75%"   |
| `.env.example` 底部 | "总体进度：~40%"     |
| `AGENTS.md`         | 各模块 40%-100% 不等 |

**影响**：外部贡献者和用户无法判断项目真实状态。建议统一到真实度量（如：功能完成度、测试覆盖率、文档完整度的加权平均）。

---

### 14. `docker/entrypoint.sh` 潜在 Bug

```sh
node packages/orchestrator-adapter/dist/index.js &
ADAPTER_PID=$$   # ❌ $$ 是 shell 自身 PID，应为 $!
```

**影响**：`trap 'kill $ADAPTER_PID'` 清理逻辑会尝试杀死 shell 自身而非 adapter 后台进程。

---

## 🟢 P3 — 改进建议

| #   | 问题                                                                                | 建议                                             |
| --- | ----------------------------------------------------------------------------------- | ------------------------------------------------ |
| 1   | 16 个 workflow 文件中 3 个显式禁用 (`.disabled`)                                    | 删除或移动到 `_archive/`                         |
| 2   | `pnpm-workspace.yaml` 引用 `cli/patent-cli` 和 `patents/mcp`（已不存在）            | 清理为只保留 `packages/*` 和 `packages/agents/*` |
| 3   | `invention` 和 `patent-manager` 各有两个 vitest 配置 (`.js` + `.ts`)                | 删除 `.js` 副本                                  |
| 4   | `deploy.yml` 引用 `staging.yunpat.com` / `yunpat.com`                               | 确认域名或移除                                   |
| 5   | 知识库路径硬编码 `KNOWLEDGE_BASE_PATH=/Users/xujian/projects/YunPat/knowledge-base` | 使用相对路径 `./knowledge-base`                  |
| 6   | `examples/` 有 8,188 行示例代码但无 CI 验证                                         | 为示例添加 smoke test 确保不会腐烂               |
| 7   | `services/` 下 3 个 Python 服务无 CI 测试                                           | 添加 CI job 或明确标记为实验性                   |

---

## 总结：五大卡点速查

| 优先级 | 卡点                 | 一句话                           | 建议动作                                          | 预估工时 |
| ------ | -------------------- | -------------------------------- | ------------------------------------------------- | -------- |
| **P0** | CI 假绿灯            | core 包 82 个测试在 CI 中被跳过  | 引入 mock LLM 适配器或配置 CI secrets             | 2-3 天   |
| **P0** | 零管道测试           | 专利管线无端到端验证             | 为 Writer+Analyzer+Responder 管线写 1 个 E2E 测试 | 3-5 天   |
| **P0** | Rust 双轨            | 两个独立 Rust 项目，集成路径矛盾 | 统一到 `packages/rust-tools/`，更新 Dockerfile    | 1-2 天   |
| **P1** | 31K 行废弃代码       | `_archive/` 占代码库 17%         | 迁移到独立分支或删除                              | 0.5 天   |
| **P1** | 测试冰山             | 8 个包无测试，Rust 测试为占位    | 优先补 patent-core bridge 测试，其次 agent 测试   | 5-10 天  |
| **P1** | pnpm audit 不可用    | 依赖漏洞完全不可见               | 切换回 npm 官方 registry                          | 0.5 天   |
| **P1** | Orchestrator 零 Lint | ESLint 9.x 迁移被跳过            | 完成 ESLint flat config 迁移                      | 1-2 天   |

**核心判断**：项目处于"框架层相对完善，但缺乏验证层"的状态。代码写了很多，但缺少将各部分串联起来的集成测试、CI 质量门禁和清晰的多语言构建路径。每次变更的风险不可见，所谓"75% 完成"无法被客观度量。

优先解决 **P0 三大卡点**后，项目将从"能编译的代码库"变为"有质量保障的代码库"。
