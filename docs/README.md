# YunPat 文档中心

**版本**: v0.1.0 (开发中)
**更新时间**: 2026-05-01

---

## 文档导航

### 快速开始

- [项目介绍](../README.md) - YunPat 项目概述和快速开始
- [Claude Code 指南](../CLAUDE.md) - 开发者协作指南（含架构详解、开发命令）
- [AI 助手指南](../AGENTS.md) - 完整技术参考（面向 AI 编程助手）
- [变更日志](../CHANGELOG.md) - 版本历史
- [贡献指南](../CONTRIBUTING.md) - 如何贡献代码
- [发展路线图](./roadmap.md) - 项目发展路线图

### 开发指南 (guides/)

- [快速开始指南](./guides/quick-start.md) - 推理层增强功能快速上手
- [GLM 快速开始](./guides/quickstart-glm.md) - GLM 模型快速配置指南
- [GLM 设置指南](./guides/glm-setup.md) - GLM 环境配置详解
- [GLM 使用指南](./guides/glm-usage.md) - GLM 模型使用指南
- [API 文档](./guides/api.md) - 智能体 API、Rust 工具 API、MCP 工具接口
- [开发指南](./guides/development.md) - 环境搭建、开发流程
- [生产环境使用指南](./guides/production-usage.md) - 生产环境最佳实践
- [智能体集成指南](./guides/agent-integration.md) - 智能体集成完整指南
- [写作风格指南](./guides/writing-style.md) - 文档写作风格规范
- [向后兼容指南](./guides/backward-compatibility.md) - 版本升级说明
- [安全指南](./SECURITY_GUIDELINES.md) - 安全最佳实践

### 项目结构

- [项目结构说明](./PROJECT_STRUCTURE.md) - 完整目录结构
- [文件管理规则](./FILE_MANAGEMENT_RULES.md) - 文档组织规范

---

## 工具文档 (tools/)

- [工具系统总览](./tools/overview.md) - YunPat 工具系统概述
- [工具状态报告](./tools/status.md) - 工具库完成情况
- [工具选择准确性改进](./tools/selection-accuracy-improvement.md) - 智能体工具选择优化方案
- [ClawCode 专利工具](./tools/clawcode-patent-tools.md) - claw-code 专利检索工具清单

---

## 总结文档 (summaries/)

- [最终总结](./summaries/final-summary.md) - YunPat 工具库实施完成总结
- [集成测试总结](./summaries/integration-test.md) - PatentWriterAgent 集成测试完成总结
- [知识库集成总结](./summaries/knowledge-base-integration.md) - 知识库集成与提示词提炼完成总结
- [Rust 集成总结](./summaries/rust-integration.md) - Rust 工具移植工作总结
- [专利工具实现总结](./summaries/patent-tools-implementation.md) - 专利检索工具实施完成报告
- [工具实现总结](./summaries/tools-implementation.md) - YunPat 工具体系实施总结
- [提示词模板总结](./summaries/prompt-templates.md) - 提示词模板提炼完成总结

---

## 进度追踪 (progress/)

- [Rust 工具进度](./progress/rust-tools.md) - Rust 工具和 CLI/MCP 集成进度报告

---

## 项目进度

**总体完成度**: ~30%（基于 2026-04-30 实际代码审计）

### 已完成

| 模块 | 完成度 | 说明 |
|------|--------|------|
| 核心框架 (packages/core) | ~85% | 356+ 导出，五层架构完整 |
| 知识库集成 | 100% | 1139 个文件 |
| PatentWriterAgent | ~80% | 最成熟的智能体 |
| 提示词模板 | ~80% | 1821 行模板代码 |

### 部分完成

| 模块 | 完成度 | 说明 |
|------|--------|------|
| PatentResponderAgent | ~50% | 有 patent-core 集成 |
| PatentAnalyzerAgent | ~50% | 分析返回 LLM 生成数据 |
| document-tools | ~75% | 文档解析工具 |
| patent-tools | ~70% | 专利工具集 |
| builtin-tools | ~60% | 基础工具 |
| grpc-server | ~50% | gRPC 服务器 |

### 待修复

| 模块 | 完成度 | 问题 |
|------|--------|------|
| Rust 工具链 | 40% | 25 个编译错误 |
| MCP 服务器 | 40% | 硬编码数据 |
| PatentManagerAgent | 20% | 无数据库 |
| CLI 工具 | 20% | 返回 TODO |
| 测试覆盖 | ~5% | 仅 EventBus 有可靠测试 |

---

## 代码统计

| 模块 | 文件数 | 语言 | 状态 |
|------|--------|------|------|
| 核心框架 (packages/core) | 48+ | TypeScript | 可用 |
| 专利智能体 (patents/agents/) | 4 | TypeScript | 部分可用 |
| 通用智能体 (packages/agents/) | 2 | TypeScript | 部分可用 |
| 工具包 (packages/*-tools/) | 30+ | TypeScript | 部分可用 |
| Rust 工具 (packages/rust-tools/) | 20+ | Rust | 编译失败 |
| Python 工具 (packages/python-tools/) | 6 | Python | 可用 |
| 使用示例 (examples/) | 19 | TypeScript/JS | 可用 |
| 维护脚本 (scripts/) | 14 | Shell/TS | 可用 |
| 知识库 (knowledge-base/) | 1139+ | Markdown | 可用 |

---

## 工作报告 (reports/)

**2026年5月**
- [代码清理总结](./reports/2026-05/code-cleanup-summary.md) - 代码清理工作总结
- [代码审查总结](./reports/2026-05/code-review-summary.md) - 代码审查报告
- [综合修复报告](./reports/2026-05/comprehensive-fix-report.md) - 综合问题修复报告
- [网关层进度报告](./reports/2026-05/gateway-progress.md) - 交互层网关开发进度
- [交互层修复总结](./reports/2026-05/interactive-layer-fixes.md) - 交互层修复工作总结
- [Phase 1 完成报告](./reports/2026-05/phase1-completion.md) - Phase 1 完成报告
- [Phase 1 最终总结](./reports/2026-05/phase1-final-summary.md) - Phase 1 最终总结
- [安全修复报告](./reports/2026-05/security-fixes.md) - 安全问题修复报告
- [工具验证报告](./reports/2026-05/tools-verification.md) - 工具验证测试报告
- [GLM 测试报告](./reports/2026-05/glm-test.md) - GLM 模型测试报告
- [代码质量审计（Karpathy）](./reports/2026-05/code-quality-audit-karpathy.md) - 基于 Karpathy 原则的代码质量审计
- [目录结构审计](./reports/2026-05/directory-structure-audit.md) - 目录结构审计报告

**2026年4月**
- [2026-04-28 工作总结](./reports/2026-04/2026-04-28-work-summary.md)
- [2026-04-28 清理总结](./reports/2026-04/2026-04-28-cleanup-summary.md)
- [2026-04-28 代码质量审查](./reports/2026-04/2026-04-28-code-quality-review.md)
- [2026-04-28 开发进度](./reports/2026-04/2026-04-28-development-progress.md)
- [2026-04-29 目录重构](./reports/2026-04/2026-04-29-structure-refactor-execution.md)
- [2026-04-29 完整重构总结](./reports/2026-04/2026-04-29-complete-refactor-summary.md)

**综合报告**
- [CI/CD 状态检查报告](./reports/ci-cd-status.md) - YunPat CI/CD 状态检查
- [CI 质量报告](./reports/ci-quality-20260430.md) - 2026-04-30 CI/CD 质量检查
- [代码审查报告](./reports/code-review.md) - 推理层增强代码审查
- [代码质量审查报告](./reports/code-quality-review.md) - 推理层增强代码质量审查
- [最终验证报告](./reports/final-verification.md) - 代码质量最终验证
- [阶段5进度报告](./reports/stage5-progress.md) - 推理层增强阶段5进度
- [项目总结报告](./reports/project-summary.md) - 推理层增强项目总结

## 计划文档 (plans/)

- [知识库集成计划](./plans/knowledge-base-integration.md) - 知识库集成与提示词提炼方案
- [重构计划](./plans/refactor/2026-04-refactor-plan.md)
- [重构执行报告](./plans/refactor/2026-04-refactor-execution-report.md)

## 架构文档 (architecture/)

- [目录结构决策](./architecture/ADR_001_directory_structure.md)

## 历史归档 (history/ & archive/)

- [历史重构记录](./history/2026-04-restructure/) - 23 个历史文档
- [归档项目分析](./archive/ARCHIVE_PROJECTS_ANALYSIS.md)
- [归档项目总结](./archive/ARCHIVE_PROJECTS_SUMMARY.md)

---

## 目录结构概览

```
docs/
├── README.md                    # 文档中心首页（本文件）
├── roadmap.md                   # 发展路线图
├── PROJECT_STRUCTURE.md         # 项目结构说明
├── FILE_MANAGEMENT_RULES.md     # 文件管理规则
├── SECURITY_GUIDELINES.md       # 安全指南
│
├── guides/                      # 开发指南
│   ├── quick-start.md          # 快速开始指南
│   ├── api.md                  # API 文档
│   ├── development.md          # 开发指南
│   ├── production-usage.md     # 生产环境使用指南
│   ├── agent-integration.md    # 智能体集成指南
│   ├── writing-style.md        # 写作风格指南
│   └── backward-compatibility.md # 向后兼容指南
│
├── tools/                       # 工具文档
│   ├── overview.md             # 工具系统总览
│   ├── status.md               # 工具状态报告
│   ├── selection-accuracy-improvement.md # 工具选择准确性改进
│   └── clawcode-patent-tools.md # ClawCode 专利工具
│
├── summaries/                   # 总结文档
│   ├── final-summary.md        # 最终总结
│   ├── integration-test.md     # 集成测试总结
│   ├── knowledge-base-integration.md # 知识库集成总结
│   ├── rust-integration.md     # Rust 集成总结
│   ├── patent-tools-implementation.md # 专利工具实现总结
│   ├── tools-implementation.md # 工具实现总结
│   └── prompt-templates.md     # 提示词模板总结
│
├── progress/                    # 进度追踪
│   └── rust-tools.md           # Rust 工具进度
│
├── reports/                     # 工作报告
│   ├── 2026-04/                # 2026年4月报告
│   ├── ci-quality-20260430.md  # CI 质量报告
│   ├── ci-cd-status.md         # CI/CD 状态检查
│   ├── code-review.md          # 代码审查报告
│   ├── code-quality-review.md  # 代码质量审查报告
│   ├── final-verification.md   # 最终验证报告
│   ├── stage5-progress.md      # 阶段5进度报告
│   └── project-summary.md      # 项目总结报告
│
├── plans/                       # 计划文档
│   ├── knowledge-base-integration.md # 知识库集成计划
│   └── refactor/               # 重构计划
│
├── architecture/                # 架构文档
├── ci/                         # CI/CD 相关
├── quality/                    # 质量保证
├── testing/                    # 测试文档
├── meta/                       # 元数据
├── history/                    # 历史记录
├── archive/                    # 归档文档
└── 资产引入/                    # 数据资产引入文档
```

---

## 按角色查找

| 角色 | 推荐文档 |
|------|---------|
| 开发者 | [CLAUDE.md](../CLAUDE.md)、[AGENTS.md](../AGENTS.md) |
| 专利代理人 | [专利撰写示例](../examples/patent-agents-usage.README.md) |
| IP 管理人员 | [路线图](./roadmap.md) |
| DevOps | [安全指南](./SECURITY_GUIDELINES.md) |
