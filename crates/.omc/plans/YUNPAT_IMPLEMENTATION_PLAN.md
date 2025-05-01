# YunPat TUI 实施计划 v0.9.0

> **目标**: 将 DeepSeek-TUI 扩展为支持专利工作流的智能体系统（YunPat），实现从通用 TUI 到专利专业 Agent 平台的转型。
>
> **版本**: 0.9.0
> **时间线**: 4-6 周
> **状态**: 规划中

---

## 1. 项目概述

### 1.1 背景与动机

DeepSeek-TUI 是一个功能完善的终端 AI 助手，具备文件操作、Shell 执行、Git 管理、Web 搜索等工具能力。当前项目正通过新增 `yunpat-*` crates 向专利工作流领域扩展。

**为什么要做 YunPat？**
- 专利工作流具有高度结构化的特点（OA 答复、复审、无效宣告等），适合 Agent 编排
- 中国市场对专利智能助手有强烈需求
- 现有 TUI 框架可直接复用，降低开发成本
- MCP 协议支持可扩展外部工具（专利检索、法律数据库等）

### 1.2 核心目标

1. **Agent 系统**: 实现可编排的专利智能体（研究、撰写、OA 答复等）
2. **TUI 集成**: 将 Agent 工作流无缝集成到现有 TUI 界面
3. **模型支持**: 支持多模型 Provider（DeepSeek、智谱、豆包等）
4. **知识库**: 本地专利法律知识库 + 语义搜索
5. **工作流编排**: 声明式多步骤工作流（Flow）执行引擎

### 1.3 非目标

- 不替代现有 DeepSeek-TUI 的通用能力
- 不做成 Web 应用（保持 TUI 定位）
- 不实现完整的专利管理系统（聚焦 Agent 工作流）

---

## 2. 架构设计

### 2.1 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        User (Terminal)                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      TUI Layer (ratatui)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Composer     │  │ Transcript   │  │ Status/Footer    │  │
│  │ (输入)       │  │ (对话历史)   │  │ (Token/Cost)     │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Router Layer                              │
│              (yunpat-router crate)                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  1. Explicit Command (/research, /oa, ...)           │  │
│  │  2. Context Association (继续当前 Agent)              │  │
│  │  3. Intent Recognition (关键词/LLM 分类)              │  │
│  │  4. Generic Fallback (通用对话)                       │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Agent Orchestration                        │
│              (yunpat-agents crate)                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ AgentRegistry│  │ FlowEngine   │  │ Stage Rendering  │  │
│  │ (注册/解析)  │  │ (工作流执行) │  │ (阶段输出)       │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Research     │  │ OA Response  │  │ Drafting         │  │
│  │ Agent        │  │ Agent        │  │ Agent            │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Model Provider Layer                      │
│              (yunpat-models crate)                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  OpenAICompatProvider (DeepSeek/智谱/豆包/本地)       │  │
│  │  - Streaming Chat                                    │  │
│  │  - Embedding (语义搜索)                              │  │
│  │  - Multimodal (图文)                                 │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Knowledge Base                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Local Files  │  │ Vector DB    │  │ External APIs    │  │
│  │ (Markdown)   │  │ (Embedding)  │  │ (专利数据库)     │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    MCP Bridge                                │
│              (yunpat-mcp-bridge crate)                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  External MCP Servers (专利检索、法律查询、翻译等)    │  │
│  │  - JSON-RPC 2.0 over stdio                           │  │
│  │  - Tool discovery and invocation                     │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Crate 依赖关系

```
yunpat-router
    └── (无外部 yunpat 依赖)

yunpat-models
    └── (无外部 yunpat 依赖)

yunpat-agents
    └── (无外部 yunpat 依赖，但使用 LlmProvider trait)

yunpat-mcp-bridge
    └── yunpat-agents (Agent trait 适配)

tui (现有)
    └── yunpat-router (路由决策)
    └── yunpat-models (ModelProvider)
    └── yunpat-agents (Agent 执行)
    └── yunpat-mcp-bridge (外部工具)
```

### 2.3 关键设计决策

#### 决策 1: 保持 TUI 为核心界面
- **理由**: 专利工作者（代理人、律师）习惯终端/命令行环境
- **影响**: 所有 Agent 输出必须适配 TUI 渲染（流式文本、表格、代码块）

#### 决策 2: Agent  trait 使用 `async_trait` + Stream
- **理由**: Agent 执行是异步的，且需要流式输出到 TUI
- **影响**: `execute()` 返回 `Pin<Box<dyn Stream<Item = StageOutput> + Send>>`

#### 决策 3: LlmProvider 在 yunpat-agents 中定义最小接口
- **理由**: 避免 yunpat-agents ↔ yunpat-models 循环依赖
- **影响**: TUI 层负责将 `ModelProvider` 适配为 `LlmProvider`

#### 决策 4: 关键词意图识别作为 Phase 1
- **理由**: 简单、快速、无需额外 API 调用
- **影响**: 后续升级为 LLM-based 分类（Phase 2）

---

## 3. 实施阶段

### Phase 1: 模型层完善（第 1-2 周）

#### 3.1.1 实现真正的 SSE 流式传输
**目标**: 修复 `OpenAICompatProvider::chat()` 的非流式问题

**当前问题**:
```rust
// 当前实现：一次性返回完整响应
let text = resp.text().await?;
let chunk = ChatChunk { delta_content: Some(text), ... };
yield chunk;
```

**目标实现**:
```rust
// 目标：逐块解析 SSE data: 行
let mut stream = resp.bytes_stream();
while let Some(chunk) = stream.next().await {
    // 解析 SSE 格式，逐块 yield ChatChunk
    // 支持 delta_content 和 delta_reasoning
}
```

**技术要点**:
- 使用 `reqwest::Response::bytes_stream()` 获取字节流
- 解析 SSE 格式：`data: {...}\n\n`
- 处理 JSON 解析错误（跳过无效块）
- 提取 `choices[0].delta.content` 和 `choices[0].delta.reasoning_content`
- 支持 `finish_reason` 检测流结束

**验收标准**:
- [ ] 流式响应逐块输出到 TUI
- [ ] 支持 reasoning_content（DeepSeek 思维链）
- [ ] 错误处理：网络中断、API 错误、JSON 解析失败
- [ ] 单元测试：模拟 SSE 流，验证逐块解析正确性

**文件**:
- `crates/yunpat-models/src/openai_compat.rs`

---

#### 3.1.2 实现 Embedding 接口
**目标**: 支持文本向量化，用于知识库语义搜索

**技术要点**:
- 调用 `/embeddings` 端点
- 支持批量文本（`input: Vec<String>`）
- 返回 `Vec<Vec<f32>>`（每个文本的向量）
- 支持不同维度（DeepSeek 1024, OpenAI 1536 等）

**验收标准**:
- [ ] 单文本 embedding
- [ ] 批量文本 embedding
- [ ] 维度自动检测
- [ ] 错误处理：模型不支持、API 限制

**文件**:
- `crates/yunpat-models/src/openai_compat.rs`
- `crates/yunpat-models/src/provider.rs`

---

#### 3.1.3 配置加载与多 Provider 支持
**目标**: 从 `config.toml` 读取 Provider 配置

**配置格式**:
```toml
[models]
default_chat = "deepseek-v4-pro"
default_embedding = "deepseek-embedding"

[[models.providers]]
id = "deepseek"
name = "DeepSeek"
base_url = "https://api.deepseek.com/v1"
api_key = "sk-..."
enabled = true

[[models.providers.models]]
model_id = "deepseek-v4-pro"
model_type = "chat"
max_tokens = 8192
context_window = 1000000

[[models.providers.models]]
model_id = "deepseek-embedding"
model_type = "embedding"
dimensions = 1024
```

**验收标准**:
- [ ] 从 `~/.deepseek/config.toml` 读取配置
- [ ] 支持多 Provider 切换
- [ ] Provider 可用性检查
- [ ] 环境变量覆盖（`DEEPSEEK_API_KEY` 等）

**文件**:
- `crates/yunpat-models/src/openai_compat.rs`
- `crates/tui/src/config.rs`（扩展）

---

### Phase 2: TUI 集成层（第 2-3 周）

#### 3.2.1 Agent 执行与 TUI 渲染集成
**目标**: 将 Agent 的 StageOutput 流式渲染到 TUI

**集成点**:
```rust
// TUI 事件循环中
match routing_decision.source {
    RoutingSource::ExplicitCommand | RoutingSource::IntentRecognition => {
        // 启动 Agent 执行
        let agent = registry.resolve(&intent).await?;
        let mut stream = agent.execute(input);
        
        // 流式渲染到 TUI
        while let Some(stage) = stream.next().await {
            ui.render_stage(&stage)?;
        }
    }
    _ => { /* 通用对话模式 */ }
}
```

**技术要点**:
- Agent 执行在独立 async task 中运行
- 通过 channel 发送 StageOutput 到 TUI 主线程
- TUI 渲染不同类型 Stage（Progress、Analysis、Draft、Completed）
- 支持审批界面（Approval UI）

**验收标准**:
- [ ] Agent 执行不阻塞 TUI 事件循环
- [ ] Stage 输出实时显示
- [ ] 支持审批交互（确认/修改/重试）
- [ ] 错误处理：Agent 崩溃、网络超时

**文件**:
- `crates/tui/src/core/engine.rs`
- `crates/tui/src/tui/ui.rs`

---

#### 3.2.2 Router 与 TUI 输入系统集成
**目标**: 将 yunpat-router 接入 TUI 输入处理

**集成点**:
```rust
// 在 TUI 输入提交时
fn on_submit(input: &str) {
    if input.starts_with('/') {
        // 显式命令
        let cmd = input.trim_start_matches('/');
        let decision = router.route_command(cmd);
    } else {
        // 自由输入
        let decision = router.route_input(input);
    }
}
```

**技术要点**:
- 保留现有 `/` 命令系统（如 `/compact`, `/cost` 等）
- 新增专利 Agent 命令（`/research`, `/oa`, `/draft` 等）
- 上下文关联：当前 Agent 会话中继续对话

**验收标准**:
- [ ] `/research` 启动 Research Agent
- [ ] `/oa` 启动 OA Response Agent
- [ ] 上下文关联正常工作
- [ ] 与现有命令不冲突

**文件**:
- `crates/tui/src/commands/mod.rs`
- `crates/tui/src/core/engine.rs`

---

#### 3.2.3 ModelProvider 适配 LlmProvider
**目标**: 将 yunpat-models 的 ModelProvider 适配为 yunpat-agents 的 LlmProvider

**适配器**:
```rust
pub struct ModelProviderAdapter<'a> {
    provider: &'a dyn ModelProvider,
    model_id: String,
}

impl LlmProvider for ModelProviderAdapter<'_> {
    fn chat_stream(&self, system_prompt: &str, user_message: &str) 
        -> Pin<Box<dyn Stream<Item = Result<String>> + Send>> {
        // 构建 ChatRequest，调用 ModelProvider::chat()
        // 将 ChatChunk 流映射为 String 流
    }
}
```

**验收标准**:
- [ ] Agent 可通过 LlmProvider 调用模型
- [ ] 流式输出正确传递
- [ ] 支持多 Provider 切换

**文件**:
- `crates/tui/src/llm_client/mod.rs`（扩展）

---

### Phase 3: Agent 实现（第 3-4 周）

#### 3.3.1 OA Response Agent（审查意见答复）
**目标**: 实现最核心的专利工作流 Agent

**工作流阶段**:
1. **OA 解析** — 解析审查意见文件（PDF/文本）
2. **检索策略** — 制定检索方案（分类号、关键词）
3. **对比分析** — 分析审查员引用的对比文件
4. **答复撰写** — 生成意见陈述书
5. **质量检查** — 检查答复完整性和逻辑性

**技术要点**:
- 支持上传 OA 文件（PDF、Word）
- 解析审查意见结构（驳回理由、对比文件、权利要求）
- 调用专利检索 API（通过 MCP）
- 生成结构化答复文档

**验收标准**:
- [ ] 上传并解析 OA 文件
- [ ] 提取审查要点
- [ ] 生成检索策略
- [ ] 撰写答复草案
- [ ] 质量检查通过

**文件**:
- `crates/yunpat-agents/src/oa_response.rs`（新建）

---

#### 3.3.2 Drafting Agent（专利撰写）
**目标**: 辅助专利说明书和权利要求书撰写

**工作流阶段**:
1. **技术交底书解析** — 理解发明内容
2. **现有技术检索** — 检索相关专利
3. **权利要求布局** — 设计独立权利要求和从属权利要求
4. **说明书撰写** — 生成技术领域、背景技术、具体实施方式
5. **审核优化** — 检查保护范围和撰写质量

**验收标准**:
- [ ] 解析技术交底书
- [ ] 生成权利要求书草案
- [ ] 生成说明书草案
- [ ] 支持修改和迭代

**文件**:
- `crates/yunpat-agents/src/drafting.rs`（新建）

---

#### 3.3.3 Reexamination & Invalidation Agents
**目标**: 复审和无效宣告 Agent

**Reexamination Agent**:
- 分析驳回决定
- 制定复审策略
- 撰写复审请求书

**Invalidation Agent**:
- 分析目标专利
- 检索无效证据
- 撰写无效宣告请求书

**验收标准**:
- [ ] 复审请求书生成
- [ ] 无效宣告请求书生成
- [ ] 证据检索和整理

**文件**:
- `crates/yunpat-agents/src/reexamination.rs`（新建）
- `crates/yunpat-agents/src/invalidation.rs`（新建）

---

### Phase 4: 知识库增强（第 4-5 周）

#### 3.4.1 向量语义搜索
**目标**: 从关键词搜索升级到语义搜索

**技术要点**:
- 使用 Embedding 接口生成文档向量
- 本地向量存储（SQLite + vec0 扩展，或纯内存）
- 余弦相似度计算
- 增量更新（新文档自动索引）

**验收标准**:
- [ ] 文档向量化
- [ ] 语义相似度搜索
- [ ] 搜索结果排序
- [ ] 增量索引更新

**文件**:
- `crates/yunpat-agents/src/knowledge.rs`（扩展）

---

#### 3.4.2 知识库管理工具
**目标**: 提供知识库管理命令

**命令**:
- `/kb add <path>` — 添加文档到知识库
- `/kb search <query>` — 搜索知识库
- `/kb list` — 列出知识库文档
- `/kb remove <id>` — 移除文档

**验收标准**:
- [ ] 添加文档并自动索引
- [ ] 语义搜索
- [ ] 文档列表和删除

**文件**:
- `crates/tui/src/commands/kb.rs`（新建）

---

### Phase 5: 工作流编排（第 5-6 周）

#### 3.5.1 声明式工作流定义
**目标**: 支持 YAML/JSON 工作流定义

**工作流示例**:
```yaml
flow_id: oa-response
flow_name: 审查意见答复
steps:
  - step_id: parse_oa
    step_name: 解析审查意见
    agent_calls:
      - agent_id: oa-parser
        output_key: oa_analysis
    
  - step_id: search_prior_art
    step_name: 检索现有技术
    agent_calls:
      - agent_id: patent-search
        input_mapping:
          query: oa_analysis.claims
        output_key: search_results
    condition: oa_analysis.has_rejection
    
  - step_id: draft_response
    step_name: 撰写答复
    agent_calls:
      - agent_id: oa-response
        input_mapping:
          oa: oa_analysis
          prior_art: search_results
        output_key: response_draft
    quality_check:
      dimensions:
        - 逻辑完整性
        - 法律依据充分性
        - 权利要求保护范围
      threshold: 7.0
      max_auto_retries: 2
```

**验收标准**:
- [ ] YAML/JSON 工作流解析
- [ ] 条件执行（condition）
- [ ] 循环执行（loop）
- [ ] 质量检查（quality_check）
- [ ] 人工审批（requires_approval）

**文件**:
- `crates/yunpat-agents/src/flow.rs`（扩展）
- `crates/yunpat-agents/src/flow_executor.rs`（扩展）

---

#### 3.5.2 工作流执行可视化
**目标**: 在 TUI 中显示工作流执行进度

**技术要点**:
- 工作流步骤进度条
- 当前步骤状态（运行中/完成/失败/等待审批）
- 步骤输出预览
- 质量检查分数显示

**验收标准**:
- [ ] 工作流进度可视化
- [ ] 步骤状态实时更新
- [ ] 审批界面集成

**文件**:
- `crates/tui/src/tui/ui.rs`（扩展）

---

### Phase 6: 测试与优化（持续）

#### 3.6.1 单元测试
**目标**: 核心组件测试覆盖率 > 80%

**测试范围**:
- `yunpat-router`: 路由决策、意图识别
- `yunpat-models`: SSE 解析、Embedding、配置加载
- `yunpat-agents`: Agent 执行、Flow 执行、知识库搜索
- `yunpat-mcp-bridge`: MCP 通信、Tool 调用

**验收标准**:
- [ ] 路由测试：所有路径覆盖
- [ ] 模型测试：模拟 API 响应
- [ ] Agent 测试：Mock LLM Provider
- [ ] Flow 测试：条件、循环、质量检查

---

#### 3.6.2 集成测试
**目标**: 端到端工作流测试

**测试场景**:
1. 用户输入 → Router → Agent → Model → TUI 渲染
2. 工作流执行：多步骤、条件、审批
3. 知识库：添加 → 索引 → 搜索
4. MCP：启动 Server → 发现 Tool → 调用

**验收标准**:
- [ ] 完整工作流端到端测试
- [ ] 错误恢复测试
- [ ] 性能测试（大文档、长工作流）

---

#### 3.6.3 性能优化
**目标**: 确保系统响应迅速

**优化点**:
- Agent 执行异步化，不阻塞 TUI
- 知识库索引后台更新
- 模型调用并发（多个 Agent 并行）
- 缓存：Embedding、搜索结果

**验收标准**:
- [ ] TUI 帧率 > 30fps
- [ ] Agent 启动延迟 < 500ms
- [ ] 知识库搜索 < 2s（1000 文档）

---

## 4. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| SSE 流式实现复杂 | 高 | 先实现基础版本，再优化错误处理 |
| Agent 输出质量不稳定 | 高 | 质量检查 + 人工审批 + 迭代优化 |
| 知识库语义搜索性能差 | 中 | 本地向量库 + 增量索引 + 缓存 |
| 多 Provider 兼容性问题 | 中 | 统一 OpenAI 兼容接口 + 适配层 |
| TUI 渲染复杂度高 | 中 | 复用现有 ratatui 组件 + 渐进增强 |

---

## 5. 里程碑

| 里程碑 | 时间 | 交付物 |
|--------|------|--------|
| M1: 模型层完善 | 第 2 周末 | SSE 流式、Embedding、配置加载 |
| M2: TUI 集成 | 第 3 周末 | Agent 执行渲染、Router 集成 |
| M3: 核心 Agent | 第 4 周末 | OA Response、Drafting Agent |
| M4: 知识库 | 第 5 周末 | 语义搜索、知识库管理 |
| M5: 工作流 | 第 6 周末 | 声明式工作流、可视化 |
| M6: 发布 | 第 6 周末 | v0.9.0 发布 |

---

## 6. 附录

### 6.1 现有代码状态

**已完成**:
- `yunpat-router`: 基础路由框架 ✅
- `yunpat-models`: 接口定义 ✅
- `yunpat-agents`: Agent trait、Flow 定义、Research Agent ✅
- `yunpat-mcp-bridge`: MCP 客户端 ✅

**待完善**:
- `yunpat-models`: SSE 流式、Embedding、配置加载
- `yunpat-agents`: OA Response、Drafting、Reexamination、Invalidation
- TUI 集成：Agent 渲染、Router 接入、审批 UI

### 6.2 技术栈

- **语言**: Rust 1.88+
- **异步**: tokio
- **TUI**: ratatui
- **HTTP**: reqwest
- **序列化**: serde
- **配置**: toml
- **测试**: tokio-test + mockall

### 6.3 参考资源

- [DeepSeek API 文档](https://api-docs.deepseek.com/)
- [OpenAI API 兼容指南](https://platform.openai.com/docs/api-reference)
- [MCP 协议规范](https://modelcontextprotocol.io/)
- [ratatui 文档](https://ratatui.rs/)

---

*计划版本: v1.0*
*最后更新: 2026-05-08*
*作者: Sisyphus*
