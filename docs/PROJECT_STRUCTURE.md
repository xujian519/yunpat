# YunPat 项目结构

**版本**: v1.0.0 (专利专业版)
**更新时间**: 2026-04-28

---

## 📁 完整目录结构

```
yunpat/
│
├── 📱 apps/                           # 应用层（5个专利应用）
│   ├── patent-writer/                 # 专利撰写应用
│   ├── office-action/                 # 审查答复应用
│   ├── patent-analyzer/               # 专利分析应用
│   ├── patent-manager/                # 专利管理应用
│   └── client-portal/                 # 客户门户
│
├── 🔧 services/                       # 服务层（5个业务服务）
│   ├── patent-lifecycle/              # 专利全生命周期服务
│   ├── workflow-engine/               # 工作流引擎服务
│   ├── knowledge-base/                # 专利知识库服务
│   ├── document-service/              # 文档管理服务
│   └── user-service/                  # 用户权限服务
│
├── 🤖 ai/                             # AI能力层（专利专用智能体）
│   ├── agents/                        # 专利智能体
│   │   ├── writer/                    # 专利撰写智能体
│   │   │   └── PatentWriterAgent.ts   # ✅ 已完成
│   │   ├── responder/                 # 审查答复智能体
│   │   │   └── PatentResponderAgent.ts # ✅ 已完成
│   │   ├── analyzer/                  # 专利分析智能体
│   │   │   └── PatentAnalyzerAgent.ts # ✅ 已完成
│   │   └── manager/                   # 专利管理智能体
│   │       └── PatentManagerAgent.ts  # ✅ 已完成
│   ├── retrieval/                     # 专利检索引擎（待开发）
│   ├── generation/                    # 专利生成引擎（待开发）
│   ├── knowledge/                     # 专利知识系统（待开发）
│   └── core/                          # AI核心框架（保留packages/core）
│
├── 🏗️ infrastructure/                 # 基础设施层
│   ├── api/                           # API网关
│   ├── database/                      # 数据库
│   ├── queue/                         # 消息队列
│   ├── cache/                         # 缓存
│   └── monitoring/                    # 监控
│
├── 📚 packages/                       # 核心框架（保持不变）
│   ├── core/                          # 核心框架
│   │   ├── src/                       # 源代码
│   │   │   ├── agent/                 # Agent抽象基类
│   │   │   ├── gateway/               # 交互层
│   │   │   ├── reasoning/             # 推理层
│   │   │   ├── llm/                   # LLM适配器
│   │   │   ├── memory/                # 记忆层
│   │   │   ├── tools/                 # 工具层
│   │   │   ├── eventbus/              # 事件总线
│   │   │   └── lifecycle/             # 生命周期
│   │   └── package.json
│   ├── agents/                        # 示例智能体（通用）
│   │   ├── writer/                    # 技术写作助手
│   │   └── researcher/                # 研究分析师
│   ├── cli/                           # 命令行工具
│   └── grpc-server/                   # gRPC服务器
│
├── 📖 docs/                           # 文档
│   ├── architecture/                  # 架构文档
│   ├── api/                           # API文档
│   ├── user-guides/                   # 用户指南
│   └── business/                      # 业务文档
│       ├── patent-writers/            # 专利代理人指南
│       ├── patent-engineers/          # 专利工程师指南
│       ├── ip-managers/               # IP管理人员指南
│       └── law-firms/                 # 律所指南
│
├── 📝 examples/                       # 示例和演示
│   ├── patent-agents-usage.ts         # ✅ 专利智能体使用示例
│   └── patent-agents-usage.README.md  # ✅ 使用说明文档
│
├── 🔨 scripts/                        # 脚本和工具
│
├── 🐳 docker/                         # Docker配置
│
├── 🧪 tests/                          # 测试
│
├── 📋 核心文档
│   ├── README.md                      # ✅ 项目介绍（专利专业版）
│   ├── CLAUDE.md                      # ✅ Claude Code指南
│   ├── STRUCTURE.md                   # 旧结构文档
│   ├── ARCHITECTURE.md                # 旧架构文档
│   ├── RESTRUCTURE_PATENT_PLATFORM.md # ✅ 专利平台架构设计
│   ├── RESTRUCTURE_EXECUTION_PLAN.md  # ✅ 重构执行计划
│   ├── RESTRUCTURE_STATUS.md          # ✅ 重构状态
│   ├── FINAL_PATENT_PLATFORM_SUMMARY.md # ✅ 转型总结
│   └── PROJECT_STRUCTURE.md           # ✅ 本文档
│
└── ⚙️ 配置文件
    ├── package.json                   # 根package.json
    ├── pnpm-workspace.yaml            # Monorepo配置
    ├── tsconfig.base.json             # TypeScript配置
    └── .gitignore                     # Git忽略文件
```

---

## 🎯 层级说明

### 1️⃣ 应用层（apps/）

**职责**：面向用户的具体应用

**包含应用**：

- `patent-writer` - 专利撰写应用
- `office-action` - 审查答复应用
- `patent-analyzer` - 专利分析应用
- `patent-manager` - 专利管理应用
- `client-portal` - 客户门户

**技术栈**：

- 前端：React + TypeScript + Vite
- 后端：Node.js + Express/Fastify
- 通信：REST API + WebSocket

---

### 2️⃣ 服务层（services/）

**职责**：业务逻辑和数据处理

**包含服务**：

- `patent-lifecycle` - 专利全生命周期管理
- `workflow-engine` - 工作流引擎
- `knowledge-base` - 专利知识库
- `document-service` - 文档管理
- `user-service` - 用户权限

**技术栈**：

- TypeScript + Node.js
- gRPC/Protobuf（服务间通信）
- PostgreSQL + Redis

---

### 3️⃣ AI能力层（ai/）

**职责**：专利专用AI智能体

**包含智能体**：

- `PatentWriterAgent` - 专利撰写 ✅
- `PatentResponderAgent` - 审查答复 ✅
- `PatentAnalyzerAgent` - 专利分析 ✅
- `PatentManagerAgent` - 专利管理 ✅

**包含模块**：

- `retrieval` - 专利检索引擎（Rust）
- `generation` - 专利生成引擎
- `knowledge` - 专利知识系统

**技术栈**：

- TypeScript（智能体逻辑）
- Rust（检索引擎、ML推理）
- Python（完全隔离，容器化）

---

### 4️⃣ 核心框架层（packages/）

**职责**：通用智能体框架（保持不变）

**包含包**：

- `core` - 核心框架
- `agents` - 示例智能体
- `cli` - 命令行工具
- `grpc-server` - gRPC服务器

**设计原则**：

- 框架笨、智能体专
- 新增智能体不需要修改框架代码
- 通用能力与业务逻辑分离

---

### 5️⃣ 基础设施层（infrastructure/）

**职责**：底层技术支撑

**包含模块**：

- `api` - API网关
- `database` - 数据库
- `queue` - 消息队列
- `cache` - 缓存
- `monitoring` - 监控

---

## 🔄 通信机制

### 服务间通信

```
应用层 ←── gRPC/Protobuf ──→ 服务层
服务层 ←── gRPC/Protobuf ──→ AI能力层
AI能力层 ←── 事件总线 ──→ 核心框架层
```

### 外部接口

```
用户 ←── REST API/WebSocket ──→ 应用层
用户 ←── Web UI ──→ 客户门户
```

---

## 📊 开发进度

### ✅ 已完成（40%）

- ✅ 产品定位转型（通用框架 → 专利专业平台）
- ✅ 架构设计（三层架构）
- ✅ 目录结构（apps/services/infrastructure/ai）
- ✅ 核心智能体（4个专利专用智能体）
- ✅ 使用示例（patent-agents-usage.ts）

### 🔄 进行中（20%）

- 🔄 AI能力层完善（检索/生成/知识库）
- 🔄 应用层初始化

### ⏳ 待开始（40%）

- ⏳ 服务层开发
- ⏳ 基础设施层搭建
- ⏳ 集成测试
- ⏳ MVP演示

---

## 🚀 快速导航

### 智能体开发

- [PatentWriterAgent 源码](../ai/agents/writer/PatentWriterAgent.ts)
- [PatentResponderAgent 源码](../ai/agents/responder/PatentResponderAgent.ts)
- [PatentAnalyzerAgent 源码](../ai/agents/analyzer/PatentAnalyzerAgent.ts)
- [PatentManagerAgent 源码](../ai/agents/manager/PatentManagerAgent.ts)

### 核心框架

- [Agent 基类](../packages/core/src/agent/Agent.ts)
- [事件总线](../packages/core/src/eventbus/)
- [LLM 适配器](../packages/core/src/llm/)
- [生命周期管理](../packages/core/src/lifecycle/)

### 文档

- [项目介绍](../README.md)
- [专利平台架构设计](../RESTRUCTURE_PATENT_PLATFORM.md)
- [使用示例](../examples/patent-agents-usage.README.md)
- [Claude Code指南](../CLAUDE.md)

---

## 🎯 下一步工作

### 立即可做

1. **完善AI能力层**
   - 创建专利检索引擎（ai/retrieval）
   - 创建专利生成引擎（ai/generation）
   - 创建专利知识系统（ai/knowledge）

2. **初始化应用项目**
   - 初始化patent-writer应用
   - 创建基本的用户界面
   - 集成PatentWriterAgent

3. **创建服务层**
   - 创建patent-lifecycle服务
   - 定义gRPC接口
   - 实现基本功能

### 短期目标（1个月）

4. **完成MVP开发**
5. **集成测试**
6. **性能优化**
7. **文档完善**

### 中期目标（3-6个月）

8. **寻找种子用户**
9. **收集反馈**
10. **功能迭代**
11. **市场推广**

---

**© 2026 YunPat - 智能专利助手，赋能创新保护**
