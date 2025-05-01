# YunPat 瓶颈修复计划

> 基于瓶颈分析报告验证结果，制定分阶段修复计划
> 日期：2026-05-07
> 前置条件：报告核心结论已验证属实

---

## 阶段一：P0 阻塞项修复（优先级最高）

### 任务 1.1：修复 CI 假绿灯 — 让 core 测试在 CI 中运行

**目标**：core 包的测试在 CI 中实际运行并通过
**验证标准**：CI 绿灯代表所有包（含 core）的测试均通过

**子任务**：

- [ ] 1.1.1 审计 core 包中所有依赖 LLM API 的测试，列出清单
- [ ] 1.1.2 创建 MockLLMAdapter，实现 LLMClient 接口的 mock 版本
- [ ] 1.1.3 创建 MockEmbeddingProvider，替代真实 embedding 调用
- [ ] 1.1.4 为需要 API key 的测试添加环境检测，无 key 时自动切换 mock
- [ ] 1.1.5 更新 ci.yml，添加 core 包测试步骤
- [ ] 1.1.6 在 CI 中运行并确认全部通过

**预估工时**：2-3 天

---

### 任务 1.2：为核心专利流程添加 E2E 测试

**目标**：Writer/Analyzer/Responder 三条核心管线各有至少 1 个 E2E 测试
**验证标准**：CI 中运行 E2E 测试覆盖主流程

**子任务**：

- [ ] 1.2.1 设计 E2E 测试架构（mock LLM + fixture 数据 + 断言框架）
- [ ] 1.2.2 编写 PatentWriterAgent E2E 测试（发明理解 → 检索 → 说明书 → 权利要求 → 摘要）
- [ ] 1.2.3 编写 PatentAnalyzerAgentV2 E2E 测试（6 阶段分析管线）
- [ ] 1.2.4 编写 PatentResponderAgentV5 E2E 测试（答复管线）
- [ ] 1.2.5 编写 Orchestrator → Agent 调度 E2E 测试
- [ ] 1.2.6 在 CI 中集成 E2E 测试步骤

**预估工时**：3-5 天

---

### 任务 1.3：统一 Rust 项目路径

**目标**：明确两个 Rust 项目的职责，统一构建路径
**验证标准**：Dockerfile 和 CI 引用正确的 Rust 项目，构建通过

**子任务**：

- [ ] 1.3.1 编写两个 Rust 项目的职责分工文档（gateway = 网络层，rust-tools = 算法层）
- [ ] 1.3.2 更新 Dockerfile，正确引用两个 Rust 项目的构建路径
- [ ] 1.3.3 更新 ci-stable.yml 中的 Rust 构建步骤
- [ ] 1.3.4 验证 Docker 构建 `docker build .` 成功
- [ ] 1.3.5 在 docker-compose.yml 中添加 Rust Gateway 服务定义

**预估工时**：1-2 天

---

## 阶段二：P1 技术债务清理

### 任务 2.1：修复 Orchestrator ESLint 零覆盖

**目标**：orchestrator 包 lint 正常运行，零 warning
**验证标准**：`pnpm --filter @yunpat/orchestrator lint` 返回 0 exit code

**子任务**：

- [ ] 2.1.1 为 orchestrator 创建 `eslint.config.mjs`（flat config 格式）
- [ ] 2.1.2 修复所有 `no-explicit-any` 错误（替换 any 为具体类型）
- [ ] 2.1.3 修复所有 `no-unused-vars` 错误（清理未使用导入）
- [ ] 2.1.4 更新 package.json 的 lint 脚本为实际 ESLint 命令
- [ ] 2.1.5 在 CI 中验证 orchestrator lint 通过

**预估工时**：1-2 天

---

### 任务 2.2：清理 \_archive 废弃代码

**目标**：\_archive/ 不再污染主分支的搜索和构建
**验证标准**：\_archive/ 内容移至独立分支或完全删除

**子任务**：

- [ ] 2.2.1 创建 `archive/cleanup` 分支，将 \_archive/ 内容提交到该分支
- [ ] 2.2.2 确认 \_archive/ 不被任何 package.json 或 tsconfig 引用
- [ ] 2.2.3 从 main 分支删除 \_archive/ 目录
- [ ] 2.2.4 更新 .gitignore 添加 `_archive/` 防止误提交

**预估工时**：0.5 天

---

### 任务 2.3：修复 pnpm audit 不可用

**目标**：`pnpm audit` 正常运行
**验证标准**：`pnpm audit` 返回审计结果（即使有漏洞也视为成功）

**子任务**：

- [ ] 2.3.1 创建 `.npmrc` 文件，显式设置 `registry=https://registry.npmjs.org/`
- [ ] 2.3.2 运行 `pnpm audit` 确认可用
- [ ] 2.3.3 如发现漏洞，按严重程度创建后续修复任务
- [ ] 2.3.4 更新 CI 中的 audit 步骤

**预估工时**：0.5 天

---

### 任务 2.4：为关键缺失测试包补充测试

**目标**：高优先级包（patent-core, orchestrator-adapter）有基本测试覆盖
**验证标准**：`pnpm test` 对目标包返回非零 exit code（有实际测试在跑）

**子任务（按优先级）**：

- [ ] 2.4.1 为 `@yunpat/patent-core` 编写 Rust bridge 基本测试
- [ ] 2.4.2 为 `@yunpat/orchestrator-adapter` 编写桥接层测试
- [ ] 2.4.3 为 `@yunpat/patent-knowledge` 编写知识库桥接测试
- [ ] 2.4.4 为 `@yunpat/patent-prompts` 编写模板渲染测试
- [ ] 2.4.5 为 `@yunpat/unified-knowledge-graph` 编写图谱操作测试

**预估工时**：5-10 天

---

### 任务 2.5：补充 Rust 实质测试

**目标**：Rust crate 有覆盖核心逻辑的测试
**验证标准**：`cargo test` 有 >1 个有意义的测试（非 it_works）

**子任务**：

- [ ] 2.5.1 为 yunpat-tokenizer 编写分词逻辑测试
- [ ] 2.5.2 为 yunpat-similarity 编写相似度计算测试
- [ ] 2.5.3 为 tools-service（374 行）编写核心业务逻辑测试
- [ ] 2.5.4 为 packages/rust-gateway 编写 HTTP 端点测试

**预估工时**：2-3 天

---

## 阶段三：P2 开发效率改善

### 任务 3.1：统一 CI 配置

**目标**：只保留 1 个主 CI workflow + 1 个稳定版 workflow
**验证标准**：CI 配置文件 ≤ 3 个活跃 workflow

**子任务**：

- [ ] 3.1.1 审计现有 12+ workflow，确定保留/合并/删除方案
- [ ] 3.1.2 统一 Node 版本为 20.x，pnpm 版本为 10
- [ ] 3.1.3 将 ci.yml 设为主 CI，整合 optimized-ci.yml 的优点
- [ ] 3.1.4 保留 ci-stable.yml 作为 self-hosted 备用
- [ ] 3.1.5 删除或禁用冗余 workflow（automation, code-quality, monitoring 等按需合并）
- [ ] 3.1.6 更新 README 中的 CI badge 指向正确 workflow

**预估工时**：1-2 天

---

### 任务 3.2：修复 Docker 配置矛盾

**目标**：Docker 构建路径与实际项目结构一致
**验证标准**：`docker-compose up` 能启动完整服务栈

**子任务**：

- [ ] 3.2.1 修复 docker/entrypoint.sh 的 `$$` → `$!` bug（第 53 行）
- [ ] 3.2.2 更新 docker-compose.yml 添加 Rust Gateway 服务
- [ ] 3.2.3 清理 python-tools/docker-compose.yml 中的注释服务（标记或删除）
- [ ] 3.2.4 验证 entrypoint.sh 5 种启动模式均可正常工作
- [ ] 3.2.5 运行 `docker-compose up` 端到端验证

**预估工时**：1 天

---

### 任务 3.3：降低 Orchestrator 依赖耦合

**目标**：orchestrator 不硬依赖所有 agent 包，改为动态注册
**验证标准**：agent 包变更不触发 orchestrator 重新构建

**子任务**：

- [ ] 3.3.1 设计 Agent 注册机制（EventBus / 插件模式）
- [ ] 3.3.2 创建 AgentRegistry 接口和实现
- [ ] 3.3.3 重构 orchestrator，将 workspace:\* 依赖改为 peerDependencies
- [ ] 3.3.4 实现动态 agent 发现和加载机制
- [ ] 3.3.5 确保现有 agent 无需修改即可被 orchestrator 发现
- [ ] 3.3.6 更新测试验证动态注册功能

**预估工时**：3-5 天

---

### 任务 3.4：统一文档进度声明

**目标**：README、.env.example、AGENTS.md 中的完成度声明一致
**验证标准**：所有文档中只有一个统一的进度声明

**子任务**：

- [ ] 3.4.1 定义统一的进度度量标准（功能完成度 × 测试覆盖率 × 文档完整度）
- [ ] 3.4.2 更新 README.md 的完成度声明
- [ ] 3.4.3 更新 .env.example 删除旧进度声明或对齐
- [ ] 3.4.4 更新 AGENTS.md 各模块状态

**预估工时**：0.5 天

---

## 阶段四：P3 改进项（按需执行）

### 任务 4.1：清理项目配置

- [ ] 修复 pnpm-workspace.yaml，移除不存在的 `patents/mcp` 引用
- [ ] 将 3 个 `.disabled` workflow 移至 `_archive/` 或删除
- [ ] 清理 invention 和 patent-manager 的重复 vitest 配置
- [ ] 将硬编码路径 `KNOWLEDGE_BASE_PATH` 改为相对路径

### 任务 4.2：examples 和 Python 服务

- [ ] 为 examples/ 添加 smoke test（确保示例不腐烂）
- [ ] 为 services/ Python 服务添加基本 CI 测试或标记为实验性
- [ ] 确认 deploy.yml 中的域名是否有效

---

## 总工时估算

| 阶段        | 范围         | 预估工时     |
| ----------- | ------------ | ------------ |
| 阶段一 (P0) | 3 个阻塞项   | 6-10 天      |
| 阶段二 (P1) | 5 个技术债务 | 9-17 天      |
| 阶段三 (P2) | 4 个效率项   | 6-9 天       |
| 阶段四 (P3) | 3 个改进项   | 2-3 天       |
| **合计**    |              | **23-39 天** |

---

## 检查清单（每个阶段完成前验证）

### 阶段一完成检查

- [ ] `pnpm test` 在 CI 中覆盖所有包（含 core）
- [ ] Writer/Analyzer/Responder 各有 ≥1 个 E2E 测试通过
- [ ] Docker build 成功，Rust 项目路径明确
- [ ] CI 绿灯 = 真实质量状态（非虚假通过）

### 阶段二完成检查

- [ ] `pnpm --filter @yunpat/orchestrator lint` 通过
- [ ] \_archive/ 已从 main 分支移除
- [ ] `pnpm audit` 可正常运行
- [ ] patent-core 和 orchestrator-adapter 有实际测试
- [ ] Rust crate 有非占位测试

### 阶段三完成检查

- [ ] 活跃 CI workflow ≤ 3 个
- [ ] `docker-compose up` 成功启动
- [ ] orchestrator agent 依赖 ≤ 5 个核心包（其余动态注册）
- [ ] 文档进度声明统一

### 最终验收

- [ ] 所有 P0 项修复，CI 代表真实质量
- [ ] ESLint warning < 50 个（从 370 降低）
- [ ] `pnpm audit` 无高危漏洞
- [ ] Docker 全栈可启动
- [ ] 文档一致性验证通过
