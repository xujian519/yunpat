# YunPat 文档中心

**版本**: v1.0.0 (专利专业版)
**更新时间**: 2026-04-28

---

## 📚 文档导航

### 🚀 快速开始

- [项目介绍](../README.md) - YunPat 项目概述
- [开发指南](../DEVELOPMENT.md) - 详细的开发环境搭建和开发流程 ⭐ 新增
- [API 文档](../API.md) - 完整的 API 接口文档 ⭐ 新增
- [变更日志](../CHANGELOG.md) - 版本历史和变更记录 ⭐ 新增
- [发展路线图](../ROADMAP.md) - 项目发展路线图 ⭐ 新增
- [Claude Code 指南](../CLAUDE.md) - 开发者协作指南
- [贡献指南](../CONTRIBUTING.md) - 如何贡献代码 ⭐ 新增
- [项目结构](./PROJECT_STRUCTURE.md) - 完整的目录结构说明

### 🏗️ 架构文档

- [专利平台架构设计](./RESTRUCTURE_PATENT_PLATFORM.md) - 三层架构设计
- [重构执行计划](./RESTRUCTURE_EXECUTION_PLAN.md) - 分阶段实施计划
- [重构状态](./RESTRUCTURE_STATUS.md) - 当前进度和里程碑

### 💼 业务文档

#### 专利代理人指南
- [专利撰写智能体使用](../examples/patent-agents-usage.README.md)
- [审查答复策略](./business/patent-writers/)

#### 专利工程师指南
- [技术交底书撰写指南](./business/patent-engineers/)
- [专利检索技巧](./business/patent-engineers/)

#### IP 管理人员指南
- [专利组合管理](./business/ip-managers/)
- [期限管理最佳实践](./business/ip-managers/)

### 🔧 开发文档

#### 核心文档
- [开发指南](../DEVELOPMENT.md) - 环境搭建、架构说明、开发流程、测试指南、部署指南 ⭐ 新增
- [API 文档](../API.md) - 智能体 API、Rust 工具 API、MCP 工具接口、REST API、gRPC API ⭐ 新增
- [变更日志](../CHANGELOG.md) - 版本历史、新增功能、Bug 修复、已知问题 ⭐ 新增
- [发展路线图](../ROADMAP.md) - 当前状态、短期目标、中期目标、长期愿景 ⭐ 新增
- [贡献指南](../CONTRIBUTING.md) - 如何报告问题、提交代码、开发规范 ⭐ 新增

#### 智能体开发
- [核心框架](../packages/core/) - Agent 基类和生命周期
- [专利智能体](../ai/agents/) - 四大核心智能体源码
- [事件总线](../packages/core/src/eventbus/) - 智能体通信机制

#### Rust 工具 ⭐ 新增
- [Rust 工具进度](./RUST_TOOLS_PROGRESS.md) - Rust 工具开发进度报告
- [Rust 集成总结](./RUST_INTEGRATION_SUMMARY.md) - Rust 工具集成总结

#### CLI 和 MCP ⭐ 新增
- [CLI/MCP 完成总结](../CLI_MCP_COMPLETION_SUMMARY.md) - CLI 工具和 MCP 集成完成总结

#### API 文档
- [智能体 API](../API.md#-智能体-api) - PatentWriterAgent、PatentResponderAgent、PatentAnalyzerAgent、PatentManagerAgent
- [Rust 工具 API](../API.md#-rust-工具-api) - LLM 客户端、权利要求生成器、质量评估器
- [MCP 工具接口](../API.md#-mcp-工具接口) - MCP 服务器和已注册工具
- [REST API](../API.md#-rest-api) - HTTP 接口文档
- [gRPC API](../API.md#-grpc-api) - 服务间通信协议

#### 测试
- [测试指南](./development/testing/)
- [测试数据](../tests/fixtures/)

#### 部署
- [环境搭建](./development/setup/)
- [Docker 部署](./development/deployment/docker/)
- [生产环境配置](./development/deployment/production/)

### 📖 历史文档和分析 ⭐ 新增

- [归档项目分析](./ARCHIVE_PROJECTS_ANALYSIS.md) - claude-code 和 claw-code 项目分析（6000+ 字）
- [归档项目总结](./ARCHIVE_PROJECTS_SUMMARY.md) - 核心发现和优化建议
- [项目转型总结](../FINAL_PATENT_PLATFORM_SUMMARY.md) - 从通用框架到专利平台的完整转型过程

---

## 🎯 核心概念

### 三层架构

```
┌─────────────────────────────────────┐
│         应用层 (apps/)               │
│  专利撰写 | 审查答复 | 专利分析      │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│         服务层 (services/)           │
│  生命周期 | 工作流 | 知识库          │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│         AI 能力层 (ai/)              │
│  智能体 | 检索 | 生成 | 知识         │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│       核心框架层 (packages/)         │
│  Agent | EventBus | LLM | Tools     │
└─────────────────────────────────────┘
```

### 四大核心智能体

1. **PatentWriterAgent** - 专利撰写智能体
   - 技术方案理解
   - 权利要求设计
   - 说明书生成
   - [源码](../ai/agents/writer/PatentWriterAgent.ts)

2. **PatentResponderAgent** - 审查答复智能体
   - 审查意见分析
   - 答复策略制定
   - 答复书生成
   - [源码](../ai/agents/responder/PatentResponderAgent.ts)

3. **PatentAnalyzerAgent** - 专利分析智能体
   - 专利价值评估
   - 技术趋势分析
   - 竞品监控
   - [源码](../ai/agents/analyzer/PatentAnalyzerAgent.ts)

4. **PatentManagerAgent** - 专利管理智能体
   - 期限管理
   - 流程管理
   - 费用管理
   - [源码](../ai/agents/manager/PatentManagerAgent.ts)

---

## 🔍 快速查找

### 按角色查找

| 角色 | 推荐文档 |
|------|---------|
| 专利代理人 | [专利撰写示例](../examples/patent-agents-usage.README.md) |
| 专利工程师 | [技术架构](./RESTRUCTURE_PATENT_PLATFORM.md) |
| IP 管理人员 | [专利管理示例](../examples/patent-agents-usage.README.md) |
| 开发者 | [项目结构](./PROJECT_STRUCTURE.md) |
| DevOps | [部署指南](./development/deployment/) |

### 按问题查找

| 问题 | 查看文档 |
|------|---------|
| 如何开始？ | [README](../README.md) |
| 如何使用智能体？ | [使用示例](../examples/patent-agents-usage.README.md) |
| 如何开发新智能体？ | [核心框架](../packages/core/) |
| 架构设计？ | [架构文档](./RESTRUCTURE_PATENT_PLATFORM.md) |
| API 接口？ | [API 文档](./api/) |
| 如何部署？ | [部署指南](./development/deployment/) |

---

## 📊 项目进度

**当前版本**: v1.0.0 (专利专业版)
**完成度**: 80%

### ✅ 已完成
- ✅ 产品定位转型（通用框架 → 专利专业平台）
- ✅ 架构设计（三层架构）
- ✅ 目录结构创建
- ✅ 核心智能体开发（4 个专利专用智能体）
- ✅ Rust 工具集成（LLM 客户端、权利要求生成器、质量评估器）⭐ 新增
- ✅ CLI 工具开发（Node.js 版本，立即可用）⭐ 新增
- ✅ MCP 集成（4 个核心工具）⭐ 新增
- ✅ 文档体系完善（33000+ 字）⭐ 新增
- ✅ 使用示例编写

### 🔄 进行中
- 🔄 Rust 编译错误修复（80% 完成）
- 🔄 AI 能力层完善（检索/生成/知识库）

### ⏳ 计划中
- ⏳ 应用层开发
- ⏳ 服务层开发
- ⏳ 基础设施层搭建
- ⏳ 集成测试
- ⏳ MVP 演示

### 📈 代码统计

| 模块 | 文件数 | 代码行数 | 状态 |
|------|--------|---------|------|
| 核心智能体 | 4 | 2100+ | ✅ |
| Rust 工具 | 5 | 1200+ | ✅ |
| CLI 工具 | 1 | 300+ | ✅ |
| MCP 服务器 | 1 | 400+ | ✅ |
| 集成层 | 3 | 500+ | ✅ |
| **总计** | **14** | **4500+** | **✅** |

### 📚 文档统计

| 类型 | 文件数 | 字数 | 状态 |
|------|--------|------|------|
| 核心文档 | 12 | 20000+ | ✅ |
| 架构文档 | 4 | 8000+ | ✅ |
| 分析文档 | 2 | 8000+ | ✅ |
| 示例文档 | 2 | 2000+ | ✅ |
| **总计** | **20** | **38000+** | **✅** |

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

### 文档贡献指南

1. 新增文档请放在合适的分类下
2. 使用清晰的标题和目录
3. 提供代码示例
4. 保持文档与代码同步

---

## 📞 联系我们

- 官网：https://yunpat.ai
- 邮箱：contact@yunpat.ai
- 微信：YunPat助手

---

**© 2026 YunPat - 智能专利助手，赋能创新保护**
