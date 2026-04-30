# YunPat - 知识产权全生命周期智能体平台

**版本**: v0.1.0 (开发中)
**定位**: 为专利代理所、律师事务所和企业 IP 部门提供智能化专利管理

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
│   ├── agents/              # 通用智能体
│   │   ├── writer/          # 技术写作助手（~65%）
│   │   └── researcher/      # 研究分析师（~40%）
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

## 当前状态（2026-04-30）

**总体完成度**: ~30%（基于实际代码审计）

### 已完成

| 模块 | 完成度 | 说明 |
|------|--------|------|
| 核心框架 (packages/core) | 85% | Agent/EventBus/LLM/推理/记忆/工具/知识库，356+ 导出 |
| 知识库集成 | 100% | 1139 个文件，ObsidianKnowledgeBridge |
| PatentWriterAgent | 80% | 知识库+模板+Rust桥接，未经端到端验证 |
| 提示词模板 | 80% | 1821 行，懒加载策略 |
| 文档体系 | 90% | 60+ 文档文件，80000+ 字 |

### 待完成

| 模块 | 完成度 | 问题 |
|------|--------|------|
| Rust 工具链 | 40% | 25 个编译错误，无法构建 |
| CLI 工具 | 20% | 所有方法返回 TODO |
| MCP 服务器 | 40% | 4 个工具返回硬编码数据 |
| PatentAnalyzerAgent | 50% | 分析方法返回 LLM 生成数据，无真实数据库 |
| PatentResponderAgent | 50% | OA 解析有 patent-core 集成，缺真实先验检索 |
| PatentManagerAgent | 20% | 无数据库后端 |
| 测试覆盖 | 5% | 仅 EventBus 有可靠测试（53 用例） |

### 下一步（按优先级）

1. 修复 Rust 编译错误（25 个）
2. 实现 CLI 工具和 MCP 服务器的真实逻辑
3. PatentWriterAgent 端到端验证
4. 实现其余 3 个智能体的核心逻辑
5. 补充测试覆盖率（目标 40%）

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

### 使用智能体 API

```typescript
import { PatentWriterAgent } from './patents/agents/writer/PatentWriterAgent.js';

const writer = new PatentWriterAgent({
  name: 'patent-writer',
  description: '专利撰写智能体',
  eventBus, memory, tools, llm,
});

const result = await writer.execute({
  title: '一种基于深度学习的图像识别方法',
  field: '人工智能',
  technicalSolution: '...',
});
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

- [CLAUDE.md](./CLAUDE.md) - Claude Code 协作指南（含架构详解、开发命令）
- [AGENTS.md](./AGENTS.md) - AI 编程助手指南（完整技术参考）
- [CHANGELOG.md](./CHANGELOG.md) - 版本历史
- [CONTRIBUTING.md](./CONTRIBUTING.md) - 贡献指南
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
