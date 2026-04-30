# YunPat 文档中心

**版本**: v0.1.0 (开发中)
**更新时间**: 2026-04-30

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

- [API 文档](./guides/api.md) - 智能体 API、Rust 工具 API、MCP 工具接口
- [开发指南](./guides/development.md) - 环境搭建、开发流程
- [向后兼容指南](./guides/backward-compatibility.md) - 版本升级说明
- [安全指南](./SECURITY_GUIDELINES.md) - 安全最佳实践

### 项目结构

- [项目结构说明](./PROJECT_STRUCTURE.md) - 完整目录结构
- [文件管理规则](./FILE_MANAGEMENT_RULES.md) - 文档组织规范

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

**2026年4月**
- [2026-04-28 工作总结](./reports/2026-04/2026-04-28-work-summary.md)
- [2026-04-28 清理总结](./reports/2026-04/2026-04-28-cleanup-summary.md)
- [2026-04-28 代码质量审查](./reports/2026-04/2026-04-28-code-quality-review.md)
- [2026-04-28 开发进度](./reports/2026-04/2026-04-28-development-progress.md)
- [2026-04-29 目录重构](./reports/2026-04/2026-04-29-structure-refactor-execution.md)
- [2026-04-29 完整重构总结](./reports/2026-04/2026-04-29-complete-refactor-summary.md)

## 计划文档 (plans/)

- [重构计划](./plans/refactor/2026-04-refactor-plan.md)
- [重构执行报告](./plans/refactor/2026-04-refactor-execution-report.md)

## 架构文档 (architecture/)

- [目录结构决策](./architecture/ADR_001_directory_structure.md)

## 历史归档 (history/ & archive/)

- [历史重构记录](./history/2026-04-restructure/) - 23 个历史文档
- [归档项目分析](./archive/ARCHIVE_PROJECTS_ANALYSIS.md)
- [归档项目总结](./archive/ARCHIVE_PROJECTS_SUMMARY.md)

## 其他文档

- [Rust 工具进度](./RUST_TOOLS_PROGRESS.md)
- [Rust 集成总结](./RUST_INTEGRATION_SUMMARY.md)
- [知识库集成计划](./KNOWLEDGE_BASE_INTEGRATION_PLAN.md)
- [知识库集成总结](./KNOWLEDGE_BASE_INTEGRATION_SUMMARY.md)
- [Prompt 模板总结](./PROMPT_TEMPLATES_SUMMARY.md)
- [生产使用指南](./PRODUCTION_USAGE_GUIDE.md)
- [智能体集成指南](./AGENT_INTEGRATION_GUIDE.md)
- [最终总结](./FINAL_SUMMARY.md)

---

## 按角色查找

| 角色 | 推荐文档 |
|------|---------|
| 开发者 | [CLAUDE.md](../CLAUDE.md)、[AGENTS.md](../AGENTS.md) |
| 专利代理人 | [专利撰写示例](../examples/patent-agents-usage.README.md) |
| IP 管理人员 | [路线图](./roadmap.md) |
| DevOps | [安全指南](./SECURITY_GUIDELINES.md) |
