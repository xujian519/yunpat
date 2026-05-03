# YunPat - 知识产权全生命周期智能体平台

**版本**: v0.1.0 (开发中)
**定位**: 为专利代理所、律师事务所和企业 IP 部门提供智能化专利管理

[![CI](https://github.com/xujian519/yunpat/workflows/CI/badge.svg)](https://github.com/xujian519/yunpat/actions/workflows/ci.yml)
[![代码质量](https://github.com/xujian519/yunpat/workflows/代码质量/badge.svg)](https://github.com/xujian519/yunpat/actions/workflows/code-quality.yml)
[![发布](https://github.com/xujian519/yunpat/workflows/发布/badge.svg)](https://github.com/xujian519/yunpat/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm](https://img.shields.io/npm/v/@yunpat/core)](https://www.npmjs.com/package/@yunpat/core)

---

## 产品定位

**使命**：让专利工作更智能、更高效、更专业

**核心价值**：

- 撰写效率提升 3-5 倍：AI 辅助撰写专利申请文件
- 授权率提高 20-30%：智能审查答复，提高专利授权率
- 成本降低 40-60%：自动化流程，减少人力投入
- 全流程可视：专利全景视图，风险实时预警

---

## 目标客户

### T1: 小型专利代理所（5-50人）

- 年收入：500万-5000万
- 专利量：100-1000 件/年
- 核心需求：撰写效率、答复质量

### T2: 律师事务所 IP 团队

- 年收入：1000万-1亿
- IP 团队：5-20 人
- 核心需求：专业深度、诉讼支持

### T3: 企业 IP 管理部门

- 预算：50万-500万/年
- 专利组合：500-5000 件
- 核心需求：资产管控、风险防范

---

## 项目结构

```
yunpat/
├── packages/                # 可复用代码包（pnpm workspace）
│   ├── core/                # 核心框架（TypeScript，~85% 完成）
│   │   └── src/
│   │       ├── agent/       # Agent 抽象基类
│   │       ├── gateway/     # 交互层（多模态、HITL、安全网关）
│   │       ├── reasoning/   # 推理层（ReAct/PlanAndSolve/ToT）
│   │       ├── llm/         # LLM 适配器（DeepSeek/Qwen/Ollama）
│   │       ├── memory/      # 记忆层（检查点、时间旅行）
│   │       ├── tools/       # 工具层（注册表、中间件、选择优化）
│   │       ├── eventbus/    # 事件总线（53 个测试用例）
│   │       ├── knowledge/   # 知识库系统（卡片、管道）
│   │       ├── validation/  # 结果验证与修正
│   │       ├── observability/ # 可观测性（遥测、告警）
│   │       └── config/      # 配置管理
│   │
│   ├── agents/              # 通用智能体（9 个专用智能体包）
│   │   ├── writer/          # 技术写作助手（~70%）
│   │   ├── researcher/      # 研究分析师（~50%）
│   │   ├── invention/       # 发明构思智能体（~40%）
│   │   ├── analysis/        # 技术分析智能体（~40%）
│   │   ├── quality/         # 质量评估智能体（~30%）
│   │   ├── specification/   # 规格生成智能体（~30%）
│   │   ├── patent-writer/   # 专利写作智能体（~50%）
│   │   ├── search/          # 搜索智能体（~40%）
│   │   └── claims/          # 权利要求生成智能体（~30%）
│   │
│   ├── patent-tools/        # 专利专用工具（~70%）
│   ├── builtin-tools/       # 内置基础工具（~60%）
│   ├── document-tools/      # 文档解析工具（~75%）
│   ├── grpc-server/         # gRPC 服务器（~50%）
│   └── cli/                 # 命令行工具（~20%，骨架实现）
│
├── patents/                 # 专利专用业务逻辑
│   ├── agents/              # 四大专利智能体
│   │   ├── writer/          # 专利撰写智能体（~80%，最成熟）
│   │   ├── responder/       # 审查答复智能体（~50%）
│   │   ├── analyzer/        # 专利分析智能体（~50%）
│   │   └── manager/         # 专利管理智能体（~20%）
│   ├── prompts/             # Prompt 模板（~80%，1821 行模板代码）
│   ├── knowledge/           # ObsidianKnowledgeBridge
│   ├── core/                # Rust 桥接层（PatentCoreBridge）
│   └── mcp/                 # MCP 工具服务器（~40%，硬编码数据）
│
├── cli/patent-cli/          # 独立 CLI 工具（空壳）
├── knowledge-base/          # 专利知识库（1139+ 文件）
├── docs/                    # 项目文档
├── examples/                # 使用示例（19 个）
├── scripts/                 # 维护脚本（14 个）
├── test/                    # 测试文件
├── docker/                  # Docker 配置
└── protos/                  # gRPC/Protobuf 定义
```

---

## 当前状态（2026-05-03）

**总体完成度**: ~45%（基于实际代码审计）

### 已完成

| 模块                     | 完成度 | 说明                                                                                                       |
| ------------------------ | ------ | ---------------------------------------------------------------------------------------------------------- |
| 核心框架 (packages/core) | 95%    | 131 个 TS 文件，~47,000 行代码，完整测试覆盖                                                               |
| 知识库集成               | 100%   | 4384 个文件，ObsidianKnowledgeBridge                                                                       |
| 推理层增强               | 100%   | 5 大核心功能全部完成并集成                                                                                 |
| 通用智能体包             | 40%    | 9 个专用智能体包（writer/researcher/invention/analysis/quality/specification/patent-writer/search/claims） |
| PatentWriterAgent        | 85%    | 知识库+模板+Rust桥接，最成熟的智能体                                                                       |
| 提示词模板               | 85%    | 1821+ 行，懒加载策略                                                                                       |
| 文档体系                 | 90%    | 60+ 文档文件，80000+ 字                                                                                    |
| 测试覆盖                 | 85%    | 71 个测试文件，1582/1596 测试通过（99.1%）                                                                 |

### 待完成

| 模块                 | 完成度 | 问题                                       |
| -------------------- | ------ | ------------------------------------------ |
| Rust 工具链          | 40%    | 编译错误待修复                             |
| CLI 工具             | 30%    | 部分功能实现                               |
| MCP 服务器           | 50%    | 部分工具返回硬编码数据                     |
| PatentAnalyzerAgent  | 60%    | 分析方法返回 LLM 生成数据，无真实数据库    |
| PatentResponderAgent | 60%    | OA 解析有 patent-core 集成，缺真实先验检索 |
| PatentManagerAgent   | 40%    | 无数据库后端                               |
| 通用智能体包         | 30-50% | 大部分处于骨架阶段，需要实现核心逻辑       |

### 下一步（按优先级）

1. 修复 Rust 编译错误
2. 实现通用智能体包的核心逻辑（invention/analysis/quality/specification）
3. 实现 CLI 工具和 MCP 服务器的真实逻辑
4. PatentWriterAgent 端到端验证
5. 完善其余 3 个专利智能体的核心逻辑
6. 补充测试覆盖率（目标 90%）

---

## 快速开始

### 安装

```bash
git clone https://github.com/your-org/yunpat.git
cd yunpat
pnpm install
pnpm build
```

### 配置环境变量

```bash
cp .env.example .env
# 编辑 .env，至少配置一个 LLM API Key
# DEEPSEEK_API_KEY=sk-...
# DASHSCOPE_API_KEY=sk-...
```

### 命令行使用

#### 1. 初始化框架

```bash
export DEEPSEEK_API_KEY=your_key
yunpat init
```

#### 2. 完整专利撰写工作流（推荐）

```bash
yunpat draft-full \
  --title "一种基于深度学习的图像识别方法" \
  --field "人工智能" \
  --disclosure examples/disclosure-example.md \
  --output patent-application.json
```

**流程**: 发明理解 → 检索 → 说明书 → 权利要求 → 摘要

#### 3. 专利检索

```bash
yunpat search \
  --title "..." \
  --field "..." \
  --disclosure examples/disclosure-example.md \
  --output search-report.json
```

#### 4. 列出可用智能体

```bash
yunpat list
```

### 使用智能体 API

```typescript
import { PatentWriterAgent } from './patents/agents/writer/PatentWriterAgent.js'

const writer = new PatentWriterAgent({
  name: 'patent-writer',
  description: '专利撰写智能体',
  eventBus,
  memory,
  tools,
  llm,
})

const result = await writer.execute({
  title: '一种基于深度学习的图像识别方法',
  field: '人工智能',
  technicalSolution: '...',
})
```

---

## 技术架构

### 五层架构

```
① 交互层 (Gateway) → 多模态输入、HITL、安全网关
         ↓
② 推理层 (Reasoning) → ReAct 循环、PlanAndSolve、思维树
         ↓
③ 核心引擎 (LLM) → DeepSeek/通义千问/Ollama
         ↓
④ 记忆层 (Memory) → 检查点、时间旅行、断点续传
         ↓
⑤ 工具层 (Tools) → 函数调用、MCP 协议、中间件管道
```

### 多语言架构

- **TypeScript (70%)**: 应用层、业务逻辑层
- **Rust (30%)**: 性能关键型算法（IPC 分类、质量评估、特征提取）
- **Python (隔离)**: ML 模型、数据分析（gRPC 通信）

### 接口设计

- **gRPC/Protobuf**: 服务间通信
- **REST API**: 外部接口
- **WebSocket**: 实时通信
- **EventBus**: 智能体间通信（发布订阅 + RPC）

---

## 文档

### 核心文档

- [CLAUDE.md](./docs/guides/CLAUDE.md) - Claude Code 协作指南（含架构详解、开发命令）
- [AGENTS.md](./docs/guides/AGENTS.md) - AI 编程助手指南（完整技术参考）
- [CHANGELOG.md](./CHANGELOG.md) - 版本历史
- [CONTRIBUTING.md](./docs/guides/CONTRIBUTING.md) - 贡献指南
- [路线图](./docs/roadmap.md) - 发展路线图

### 开发文档

- [开发指南](./docs/guides/development.md) - 环境搭建、开发流程
- [API 文档](./docs/guides/api.md) - API 接口文档
- [项目结构](./docs/PROJECT_STRUCTURE.md) - 目录结构说明
- [安全指南](./docs/SECURITY_GUIDELINES.md) - 安全最佳实践
- [文件管理规则](./docs/FILE_MANAGEMENT_RULES.md) - 文档组织规范

### 文档中心

- [docs/README.md](./docs/README.md) - 完整的文档索引

---

## 商业模式（规划中）

### SaaS 订阅

- **基础版**: 5,000/月（5 用户，100 件/年）
- **专业版**: 20,000/月（20 用户，500 件/年）
- **企业版**: 50,000/月（50 用户，2000 件/年）

---

## 联系方式

- 作者：Xu Jian <xujian519@gmail.com>
- 许可证：MIT
