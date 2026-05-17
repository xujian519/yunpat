# 云熙知识产权智能体 — 开发日志

## v0.2.0 (2026-05-11)

**阶段 3：大文件拆分与代码质量提升**

### 质量审计与代码治理 (2026-05-18)

#### Phase 0: 快赢
- 统一 zod (^3.25.76)、vitest (^4.1.5)、TypeScript (^5.6.3) 版本
- 修复 Dockerfile: rust:1.88-alpine, node:20-alpine
- 添加 .editorconfig, 移除 Cargo.lock 排除

#### Phase 1: P0 修复
- secrets unwrap 安全修复 (3处)
- CI Rust toolchain 锁定 1.88.0, lockfile 冻结, pnpm action 升级

#### Phase 2: 质量治理
- tsconfig strict 继承修复 (7包)
- 3个 CI 文件合并为统一 ci.yml (15 jobs, path filtering)
- Rust 测试 +40

#### Phase 3: 架构优化
- 生产代码 `as any` 全部归零 (172→0)
- tui 专利模块提取为 yunpat-patent-tui crate
- orchestrator peer deps 从 21 降至 0
- Release CI (binary builds + GitHub Release)
- 测试代码 `as any` 减少 58% (703→296)

### 重构

- 拆分 10 个大文件，消除所有 >450 行的 TypeScript 文件
- 拆分 QualityChecker、WriterAgent、ClaimGeneratorAgent、SpecificationDrafterAgent 等上帝文件
- 拆分 ResponseTemplateManager、KnowledgeBase、InventionUnderstandingAgent
- 拆分 AllTools 和 PatentDocxGenerator 死代码
- Cargo workspace 统一，类型去重，config 动态解析

### 修复

- 修复 5 个测试失败和 4 个 lint error
- 修复 MCP 适配器真实桥接和流式防护测试
- 修复 patent-responder 断裂导入（.v3.ts 已删除但 index.ts 仍引用）
- 修复 PatentResponderAgentV5 类型冲突字段
- 修复 PatentResponderAgent.v1 generationTime 计算错误
- 修复测试跨平台兼容性（`/tmp/` → `os.tmpdir()`）
- 修复 HttpApprovalServer Promise 不 reject 的隐患
- 修复 Rust E2E 测试硬编码绝对路径

### 文档

- 清理冗余文档：删除临时 CI 报告、过期计划、.bak 文件
- 更新 CLAUDE.md、README.md、docs/architecture.md 统计数据
- 移除不存在的 tui-core crate 条目

---

## v0.1.1 (2026-05-09)

**Phase 2：深度融合与基础设施加固**

- 宪法引擎实现（constitutional/ YAML 规则体系）
- 意图路由框架（yunpat-router crate）
- Agent 增强：LLM 注入全链路修复
- MCP 协议升级与工具适配
- 法律知识库集成
- CI 集成（GitHub Actions）
- 执行策略 Hook 和审批门控

---

## v0.1.0 (2026-05-08)

**项目初始化**

- 建立 Monorepo 架构（Rust + TypeScript 双语言）
- 整合 DeepSeek-TUI（Rust 交互层）
- 整合 YunPat（TypeScript 业务层，24 个专业 Agent）
- 统一品牌：云熙知识产权智能体
- MCP Server 基础设施（stdio 通信）
- 知识库集成（法律法规、审查指南、实务案例）

**技术栈**

- Rust 1.88+（交互层、宪法引擎）
- TypeScript 5.3+（业务逻辑、Agent 编排）
- Node.js 18+ / pnpm 8+
- Cargo workspace + pnpm workspace

---

**作者**: 徐健 <xujian519@gmail.com>
**许可证**: MIT
