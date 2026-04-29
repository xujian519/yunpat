# YunPat - 知识产权全生命周期智能体平台

**版本**: v1.0.0 (专利专业版)
**定位**: 为专利代理所、律师事务所和企业 IP 部门提供智能化专利管理

---

## 🎯 产品定位

**使命**：让专利工作更智能、更高效、更专业

**核心价值**：
- ⚡ **撰写效率提升 3-5 倍**：AI 辅助撰写专利申请文件
- 🎯 **授权率提高 20-30%**：智能审查答复，提高专利授权率
- 💰 **成本降低 40-60%**：自动化流程，减少人力投入
- 📊 **全流程可视**：专利全景视图，风险实时预警

---

## 👥 目标客户

### T1: 小型专利代理所（5-50人）
- 💰 年收入：500万-5000万
- 📄 专利量：100-1000 件/年
- ⚡ 核心需求：撰写效率、答复质量

### T2: 律师事务所 IP 团队
- 💰 年收入：1000万-1亿
- 👥 IP 团队：5-20 人
- ⚡ 核心需求：专业深度、诉讼支持

### T3: 企业 IP 管理部门
- 💰 预算：50万-500万/年
- 📄 专利组合：500-5000 件
- ⚡ 核心需求：资产管控、风险防范

---

## 🏗️ 项目结构

```
yunpat/
│
├── apps/                    # 应用层
│   ├── patent-writer/       # 专利撰写应用
│   ├── office-action/       # 审查答复应用
│   ├── patent-analyzer/     # 专利分析应用
│   ├── patent-manager/      # 专利管理应用
│   └── client-portal/       # 客户门户
│
├── services/                # 业务逻辑层
│   ├── patent-lifecycle/    # 专利全生命周期
│   ├── workflow-engine/     # 工作流引擎
│   ├── knowledge-base/      # 专利知识库
│   ├── document-service/    # 文档管理
│   └── user-service/        # 用户权限
│
├── ai/                      # AI 能力层
│   ├── agents/              # 智能体
│   │   ├── writer/           # 撰写智能体（通用）
│   │   ├── responder/        # 答复智能体（新建）
│   │   ├── analyzer/         # 分析智能体（新建）
│   │   └── manager/          # 管理智能体（新建）
│   ├── retrieval/           # 检索引擎
│   ├── generation/          # 生成引擎
│   ├── knowledge/           # 知识系统
│   └── core/                # 核心框架
│
├── infrastructure/          # 基础设施层
│   ├── api/                 # API 网关
│   ├── database/            # 数据库
│   ├── queue/               # 消息队列
│   ├── cache/               # 缓存
│   └── monitoring/          # 监控
│
├── docs/                    # 文档
│   ├── architecture/        # 架构文档
│   ├── api/                # API 文档
│   ├── user-guides/        # 用户指南
│   └── business/           # 业务文档
│       ├── patent-writers/  # 专利代理人指南
│       ├── patent-engineers/# 专利工程师指南
│       ├── ip-managers/      # IP 管理指南
│       └── law-firms/        # 律所指南
│
├── tests/                   # 测试
├── docker/                 # Docker
└── scripts/                # 脚本
```

---

## 🎉 最新更新（2026-04-28）

### ✅ 已完成

1. **核心框架 (packages/core)**
   - ✅ Agent 基类：plan/act/reflect 生命周期
   - ✅ EventBus：发布订阅 + RPC 请求响应（53 个测试用例）
   - ✅ LLM 适配器：LangChain ChatOpenAI，支持流式调用

2. **PatentWriterAgent（最完善的智能体）**
   - ✅ 集成 ObsidianKnowledgeBridge（知识库增强）
   - ✅ 集成 PromptTemplateManager（提示词模板，分步加载）
   - ✅ 权利要求生成、说明书生成、摘要生成（通过 LLM）
   - ⚠️ 未经端到端验证

3. **知识库集成**
   - ✅ ObsidianKnowledgeBridge：桥接宝宸知识库（1139 个文件）
   - ✅ 3 个核心提示词模板（权利要求/说明书/创造性分析，1821 行）
   - ✅ PromptTemplateManager：懒加载策略

4. **代码质量优化（两轮重构）**
   - ✅ 删除 ~3,568 行过度设计代码
   - ✅ EventBus Bug 修复 + 53 个测试用例
   - ✅ ESLint/Prettier 配置

5. **文档体系（38000+ 字）**
   - ✅ 开发指南、API 文档、变更日志、路线图、贡献指南

### 🔴 待完成

- 🔴 **Rust 工具链**：25 个编译错误，无法构建
- 🔴 **CLI 工具**：所有方法返回 TODO + 空数据
- 🔴 **MCP 服务器**：4 个工具返回硬编码数据
- 🔴 **PatentAnalyzerAgent**：4 个分析方法全部返回空数据
- 🔴 **PatentResponderAgent**：核心逻辑未实现
- 🔴 **PatentManagerAgent**：无数据库后端
- 🔴 **测试覆盖**：仅 EventBus 有可靠测试（~5%）
- ⏳ **应用层 / 服务层 / 基础设施层**：15 个空目录

### 📊 完成进度

**总体进度**: ~30%（基于 2026-04-28 实际代码审计）

- ✅ 产品定位转型
- ✅ 架构设计
- ✅ 核心框架（Agent 基类、EventBus、LLM 适配器）
- ✅ PatentWriterAgent（60%，基本功能完成）
- ✅ 知识库集成（1139 个文件，唯一有真实数据的模块）
- ✅ 文档体系完善
- 🔴 Rust 工具（25 个编译错误，不可用）
- 🔴 CLI 工具（空壳，所有方法返回 TODO）
- 🔴 MCP 服务器（4 个工具返回硬编码数据）
- 🔴 其他 3 个智能体（核心逻辑未实现）
- ⏳ 应用层 / 服务层 / 基础设施层（全部为空目录）

详细审计见 [DEVELOPMENT_PROGRESS.md](./DEVELOPMENT_PROGRESS.md)

### 🚀 下一步（按优先级）

1. 修复 Rust 编译错误（25 个）
2. 实现 CLI 工具和 MCP 服务器的真实逻辑
3. PatentWriterAgent 端到端验证
4. 实现其余 3 个智能体的核心逻辑
5. 补充测试覆盖率（目标 40%）
6. 应用层 / 服务层开发

---

## 🚀 快速开始

### 安装

```bash
# 克隆项目
git clone https://github.com/your-org/yunpat.git
cd yunpat

# 安装依赖
pnpm install

# 启动开发环境
pnpm dev
```

### 立即可用的工具 ⭐

> **注意**: 以下工具的代码框架已就位，但 CLI 和 MCP 当前为空壳（返回 TODO/硬编码数据）。
> 真正可用的功能通过 TypeScript API 调用 PatentWriterAgent（需配置 LLM API Key）。

#### 1. 智能体 API（✅ 可用）

```typescript
import { PatentWriterAgent } from '@yunpat/agents';

const writer = new PatentWriterAgent({
  llm: yourLLMAdapter,  // 需要配置 LLM
});
const result = await writer.execute({
  title: '一种基于深度学习的图像识别方法',
  field: '人工智能',
  // ...
});
```

#### 2. CLI 工具（🔴 空壳，方法返回 TODO）

```bash
# 框架已就位，但实际逻辑未实现
patent-cli search -k 深度学习 图像识别   # → 返回空数据
patent-cli generate -t method -f "特征1"   # → 返回空数据
```

#### 3. MCP 服务器（🔴 返回硬编码数据）

```typescript
const server = createPatentMcpServer();
await server.callTool('search_patents', { keywords: ['深度学习'] });
// → 返回 { total: 100, patents: [一个硬编码条目] }
```

### 运行应用

```bash
# 专利撰写应用
pnpm --filter @yunpat/patent-writer dev

# 审查答复应用
pnpm --filter @yunpat/office-action dev

# 客户门户
pnpm --filter @yunpat/client-portal dev
```

---

## 📦 核心应用

### 1. 专利撰写 (Patent Writer)

**功能**：
- 技术方案理解
- 权利要求设计
- 说明书生成
- 申请文件导出

### 2. 审查答复 (Office Action)

**功能**：
- 审查意见分析
- 对比文件检索
- 答复策略制定
- 答复书生成

### 3. 专利分析 (Patent Analyzer)

**功能**：
- 专利价值评估
- 技术趋势分析
- 竞品监控
- 专利地图绘制

### 4. 专利管理 (Patent Manager)

**功能**：
- 期限管理
- 流程管理
- 费用管理
- 客户门户

---

## 💡 技术架构

### 多语言架构

- **TypeScript (70%)**: 应用层、业务逻辑层
- **Rust (30%)**: 检索引擎、ML 推理
- **Python (隔离)**: ML 模型、数据分析

### 接口设计

- **gRPC/Protobuf**: 服务间通信
- **REST API**: 外部接口
- **WebSocket**: 实时通信

---

## 📚 文档

### 核心文档 ⭐ 新增

- [开发指南](./DEVELOPMENT.md) - 环境搭建、架构说明、开发流程、测试指南、部署指南
- [API 文档](./API.md) - 智能体 API、Rust 工具 API、MCP 工具接口、REST API、gRPC API
- [变更日志](./CHANGELOG.md) - 版本历史、新增功能、Bug 修复、已知问题
- [发展路线图](./ROADMAP.md) - 当前状态、短期目标、中期目标、长期愿景
- [贡献指南](./CONTRIBUTING.md) - 如何报告问题、提交代码、开发规范

### 架构文档

- [专利平台架构设计](./docs/RESTRUCTURE_PATENT_PLATFORM.md) - 三层架构设计
- [重构执行计划](./docs/RESTRUCTURE_EXECUTION_PLAN.md) - 分阶段实施计划
- [重构状态](./docs/RESTRUCTURE_STATUS.md) - 当前进度和里程碑
- [项目结构](./docs/PROJECT_STRUCTURE.md) - 完整的目录结构说明

### 历史文档和分析 ⭐ 新增

- [归档项目分析](./docs/ARCHIVE_PROJECTS_ANALYSIS.md) - claude-code 和 claw-code 项目分析（6000+ 字）
- [归档项目总结](./docs/ARCHIVE_PROJECTS_SUMMARY.md) - 核心发现和优化建议
- [项目转型总结](./FINAL_PATENT_PLATFORM_SUMMARY.md) - 从通用框架到专利平台的完整转型过程

### 使用示例 ⭐ 新增

- [专利智能体使用示例](./examples/patent-agents-usage.README.md) - 如何使用四大核心智能体
- [MCP 使用示例](./examples/mcp-usage.ts) - 如何使用 MCP 服务器

### 其他文档

- [文档中心](./docs/README.md) - 完整的文档索引
- [Claude Code 指南](./CLAUDE.md) - 开发者协作指南

---

## 🎯 商业模式

### SaaS 订阅

- **基础版**: ¥5,000/月（5 用户，100 件/年）
- **专业版**: ¥20,000/月（20 用户，500 件/年）
- **企业版**: ¥50,000/月（50 用户，2000 件/年）

### 增值服务

- 培训服务：¥5,000/次
- 定制开发：按需报价
- 数据服务：按次收费

---

## 📞 联系我们

- 官网：https://yunpat.ai
- 邮箱：contact@yunpat.ai
- 微信：YunPat助手

---

**© 2026 YunPat - 智能专利助手，赋能创新保护**
