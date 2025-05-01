# YunPat 实施 Beads

> **Beads 说明**: 本文档包含所有可执行的任务（beads），每个 bead 都是一个自包含的工作单元，带有明确的依赖关系、详细描述和验收标准。
>
> **总工作量**: ~120 小时（6 周 × 20 小时/周）
> **团队**: 2-3 名 Rust 工程师
> **优先级**: P0（核心阻塞）> P1（重要功能）> P2（优化增强）

---

## 编号约定

- `BD-1xx`: Phase 1 - 模型层完善
- `BD-2xx`: Phase 2 - TUI 集成层
- `BD-3xx`: Phase 3 - Agent 实现
- `BD-4xx`: Phase 4 - 知识库增强
- `BD-5xx`: Phase 5 - 工作流编排
- `BD-6xx`: Phase 6 - 测试与优化

---

## BD-101: 实现真正的 SSE 流式传输（P0）

### 基本信息
- **标题**: 实现 `OpenAICompatProvider` 的 SSE 流式传输
- **类型**: bugfix / feature
- **优先级**: P0
- **预估工时**: 8 小时
- **负责人**: TBD

### 依赖
- **前置**: 无
- **阻塞**: BD-201, BD-202, BD-301, BD-302, BD-303

### 背景
当前 `OpenAICompatProvider::chat()` 一次性返回完整响应，这是致命缺陷：
1. 用户体验差（等待所有内容生成后才能看到）
2. 无法实时显示 reasoning_content（DeepSeek 思维链）
3. 内存占用大（长响应一次性加载）

### 详细描述

#### 3.1 技术方案

**SSE 格式解析**:
```
data: {"id":"...","choices":[{"delta":{"content":"Hello"}}]}

data: {"id":"...","choices":[{"delta":{"content":" world"}}]}

data: {"id":"...","choices":[{"delta":{},"finish_reason":"stop"}]}

data: [DONE]
```

**关键实现**:
1. 使用 `reqwest::Response::bytes_stream()` 替代 `text()`
2. 逐行解析 SSE data: 前缀
3. JSON 解析每个 data 块，提取 `delta.content` 和 `delta.reasoning_content`
4. 逐块 yield `ChatChunk`
5. 处理 `[DONE]` 信号和 `finish_reason`

**错误处理**:
- 网络中断：重试或返回错误
- JSON 解析失败：跳过该块，记录警告
- API 错误：解析 error 字段，返回结构化错误

#### 3.2 实现步骤

1. **修改 `openai_compat.rs`**:
   - 替换 `resp.text().await?` 为 `resp.bytes_stream()`
   - 创建 `SseDecoder` 结构体处理 SSE 流解析
   - 实现 `Stream<Item = Result<ChatChunk>>`

2. **创建 `sse.rs` 模块**:
   - `SseEvent` 结构体（id, event, data）
   - `SseDecoder` 状态机（Idle, Data, Done）
   - 处理多行 data、空行、注释行

3. **修改 `ChatChunk` 结构**:
   - 确保支持 `delta_reasoning` 字段
   - 添加 `usage` 字段（用于最终 token 统计）

4. **添加测试**:
   - 模拟 SSE 流，验证逐块解析
   - 测试错误恢复（无效 JSON、网络中断）
   - 测试 reasoning_content 提取

#### 3.3 代码结构

```rust
// crates/yunpat-models/src/openai_compat.rs

impl ModelProvider for OpenAICompatProvider {
    fn chat(&self, 
         request: ChatRequest
    ) -> Pin<Box<dyn Stream<Item = Result<ChatChunk>> + Send>> {
        let stream = async_stream::try_stream! {
            let resp = client.post(url)
                .json(&request)
                .send()
                .await?;
            
            let mut decoder = SseDecoder::new();
            let mut bytes_stream = resp.bytes_stream();
            
            while let Some(chunk) = bytes_stream.next().await {
                let bytes = chunk?;
                decoder.feed(&bytes);
                
                while let Some(event) = decoder.next_event() {
                    match event.data.as_str() {
                        "[DONE]" => break,
                        data => {
                            let chunk: ChatChunk = serde_json::from_str(data)?;
                            yield chunk;
                        }
                    }
                }
            }
        };
        
        Box::pin(stream)
    }
}
```

### 验收标准

#### 功能验收
- [ ] 流式响应逐块输出（每块延迟 < 100ms）
- [ ] 支持 `delta_content` 累积显示
- [ ] 支持 `delta_reasoning`（DeepSeek 思维链）
- [ ] 正确处理 `finish_reason` = stop/length/error
- [ ] 支持 `[DONE]` 信号终止

#### 错误处理
- [ ] 网络中断返回友好错误
- [ ] 无效 JSON 跳过不崩溃
- [ ] API 错误（401/429/500）正确解析
- [ ] 超时处理（默认 30s，可配置）

#### 测试验收
- [ ] 单元测试：模拟 SSE 流，验证 100+ 块正确解析
- [ ] 测试 reasoning_content 混合流
- [ ] 测试错误恢复：50% 块损坏仍能继续
- [ ] 性能测试：1MB 响应流解析 < 1s

### 文件变更
- `crates/yunpat-models/src/openai_compat.rs`（修改）
- `crates/yunpat-models/src/sse.rs`（新建）
- `crates/yunpat-models/src/lib.rs`（修改，添加 sse 模块）
- `crates/yunpat-models/tests/sse_tests.rs`（新建）

---

## BD-102: 实现 Embedding 接口（P1）

### 基本信息
- **标题**: 实现 `OpenAICompatProvider::embed()` 方法
- **类型**: feature
- **优先级**: P1
- **预估工时**: 6 小时
- **负责人**: TBD

### 依赖
- **前置**: BD-101
- **阻塞**: BD-401

### 背景
Embedding 是知识库语义搜索的核心能力。当前返回 `bail!("not yet implemented")`，需要实现完整的 Embedding 接口。

### 详细描述

#### 3.1 技术方案

**API 调用**:
```bash
POST /embeddings
{
  "model": "deepseek-embedding",
  "input": ["文本1", "文本2", "文本3"],
  "encoding_format": "float"
}
```

**响应**:
```json
{
  "object": "list",
  "data": [
    {
      "object": "embedding",
      "embedding": [0.1, 0.2, ...],
      "index": 0
    }
  ],
  "model": "deepseek-embedding",
  "usage": {
    "prompt_tokens": 100,
    "total_tokens": 100
  }
}
```

**关键实现**:
1. 构建 EmbeddingRequest（单文本或批量）
2. 调用 `/embeddings` 端点
3. 解析响应，提取向量列表
4. 支持不同维度（自动检测或配置）
5. 批量处理（避免单文本多次调用）

#### 3.2 实现步骤

1. **修改 `openai_compat.rs`**:
   - 实现 `embed()` 方法
   - 构建 `EmbedRequest` → API 请求
   - 解析响应为 `EmbedResponse`

2. **添加 Embedding 类型**:
   - `EmbeddingRequest`（OpenAI 格式）
   - `EmbeddingResponse`（OpenAI 格式）
   - 映射到 `EmbedRequest`/`EmbedResponse`

3. **批量处理**:
   - 单文本包装为批量
   - 大批量分批（避免请求过大）

4. **测试**:
   - Mock API 响应
   - 验证向量维度
   - 测试批量处理

### 验收标准

#### 功能验收
- [ ] 单文本 embedding 返回正确维度向量
- [ ] 批量文本 embedding 返回向量列表
- [ ] 维度自动检测（从响应中提取）
- [ ] 批量分批处理（> 100 文本自动分批）

#### 错误处理
- [ ] 模型不支持返回友好错误
- [ ] API 限制（429）重试
- [ ] 空输入返回空结果

#### 测试验收
- [ ] 单元测试：模拟响应，验证向量提取
- [ ] 批量测试：1000 文本分批处理
- [ ] 错误测试：无效模型、API 错误

### 文件变更
- `crates/yunpat-models/src/openai_compat.rs`（修改）
- `crates/yunpat-models/src/types.rs`（扩展 Embedding 类型）
- `crates/yunpat-models/tests/embed_tests.rs`（新建）

---

## BD-103: 配置加载与多 Provider 支持（P1）

### 基本信息
- **标题**: 从 `config.toml` 加载模型 Provider 配置
- **类型**: feature
- **优先级**: P1
- **预估工时**: 6 小时
- **负责人**: TBD

### 依赖
- **前置**: BD-101
- **阻塞**: BD-201, BD-202

### 背景
当前 `OpenAICompatProvider` 需要手动构建 `ModelProviderConfig`。需要从 `~/.deepseek/config.toml` 自动加载配置，支持多 Provider 切换。

### 详细描述

#### 3.1 配置格式

```toml
# ~/.deepseek/config.toml

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

[[models.providers]]
id = "zhipu"
name = "智谱"
base_url = "https://open.bigmodel.cn/api/paas/v4"
api_key = "..."
enabled = true

[[models.providers.models]]
model_id = "glm-4"
model_type = "chat"
```

#### 3.2 实现步骤

1. **修改 `Config` 结构**（`crates/tui/src/config.rs`）:
   - 添加 `models: ModelProviderConfig` 字段
   - 解析 `[[models.providers]]` 数组

2. **创建 `ModelProviderConfig::from_config()`**:
   - 从 `Config` 提取模型配置
   - 环境变量覆盖（`DEEPSEEK_API_KEY` 等）
   - 验证配置（base_url 格式、api_key 非空）

3. **创建 `ModelProviderFactory`**:
   - 根据配置创建 `OpenAICompatProvider`
   - 支持多 Provider 实例
   - Provider 可用性检查

4. **动态切换**:
   - `/model switch <provider>` 命令
   - 运行时切换 Provider

### 验收标准

#### 功能验收
- [ ] 从 `config.toml` 加载模型配置
- [ ] 支持多 Provider（DeepSeek、智谱、豆包等）
- [ ] 环境变量覆盖（`DEEPSEEK_API_KEY`）
- [ ] Provider 可用性检查
- [ ] 运行时切换 Provider

#### 配置验证
- [ ] base_url 格式验证
- [ ] api_key 非空验证
- [ ] model_id 唯一性验证
- [ ] 默认模型存在性验证

#### 测试验收
- [ ] 单元测试：解析有效/无效配置
- [ ] 集成测试：从文件加载配置
- [ ] 环境变量覆盖测试

### 文件变更
- `crates/tui/src/config.rs`（扩展）
- `crates/yunpat-models/src/config.rs`（新建）
- `crates/yunpat-models/src/lib.rs`（修改）

---

## BD-201: ModelProvider 适配 LlmProvider（P0）

### 基本信息
- **标题**: 创建 `ModelProviderAdapter` 桥接两个 trait
- **类型**: feature
- **优先级**: P0
- **预估工时**: 4 小时
- **负责人**: TBD

### 依赖
- **前置**: BD-101, BD-103
- **阻塞**: BD-301, BD-302, BD-303

### 背景
`yunpat-agents` 定义了 `LlmProvider` trait（最小接口），`yunpat-models` 定义了 `ModelProvider` trait（完整接口）。需要适配器将两者桥接，使 Agent 可以调用模型。

### 详细描述

#### 3.1 适配器设计

```rust
/// 将 ModelProvider 适配为 LlmProvider
pub struct ModelProviderAdapter<'a> {
    provider: &'a dyn ModelProvider,
    model_id: String,
    system_prompt: Option<String>,
}

impl ModelProviderAdapter<'_> {
    pub fn new(provider: &dyn ModelProvider, model_id: &str) -> Self {
        Self {
            provider,
            model_id: model_id.to_string(),
            system_prompt: None,
        }
    }
    
    pub fn with_system_prompt(mut self, prompt: &str) -> Self {
        self.system_prompt = Some(prompt.to_string());
        self
    }
}

impl LlmProvider for ModelProviderAdapter<'_> {
    fn chat_stream(
        &self,
        system_prompt: &str,
        user_message: &str,
    ) -> Pin<Box<dyn Stream<Item = Result<String, anyhow::Error>> + Send>> {
        let request = ChatRequest {
            model: self.model_id.clone(),
            messages: vec![
                ChatMessage {
                    role: "system".to_string(),
                    content: serde_json::json!(system_prompt),
                    tool_calls: None,
                    tool_call_id: None,
                },
                ChatMessage {
                    role: "user".to_string(),
                    content: serde_json::json!(user_message),
                    tool_calls: None,
                    tool_call_id: None,
                },
            ],
            temperature: Some(0.7),
            max_tokens: None,
            tools: vec![],
            stream: true,
        };
        
        let stream = self.provider.chat(request);
        
        // 将 ChatChunk 流映射为 String 流
        let mapped = stream.map(|chunk| {
            chunk.map(|c| c.delta_content.unwrap_or_default())
        });
        
        Box::pin(mapped)
    }
}
```

#### 3.2 实现步骤

1. **创建 `adapter.rs`**:
   - `ModelProviderAdapter` 结构体
   - 实现 `LlmProvider` trait
   - 处理 `ChatChunk` → `String` 映射

2. **处理 reasoning_content**:
   - 可选：将 reasoning_content 作为特殊标记输出
   - 或过滤，仅返回 content

3. **测试**:
   - Mock ModelProvider
   - 验证流式映射正确性

### 验收标准

#### 功能验收
- [ ] Adapter 实现 LlmProvider trait
- [ ] 流式输出正确传递
- [ ] 支持 system_prompt 设置
- [ ] 支持 model_id 指定

#### 测试验收
- [ ] Mock ModelProvider 测试
- [ ] 验证流式映射
- [ ] 错误传播测试

### 文件变更
- `crates/tui/src/llm_client/adapter.rs`（新建）
- `crates/tui/src/llm_client/mod.rs`（扩展）

---

## BD-202: TUI Agent 执行集成（P0）

### 基本信息
- **标题**: 将 Agent 执行集成到 TUI 事件循环
- **类型**: feature
- **优先级**: P0
- **预估工时**: 10 小时
- **负责人**: TBD

### 依赖
- **前置**: BD-101, BD-201
- **阻塞**: BD-301, BD-302, BD-303

### 背景
当前 TUI 仅支持通用对话模式。需要集成 Agent 执行，使 Router 可以将输入路由到 Agent，并在 TUI 中渲染 Agent 的 Stage 输出。

### 详细描述

#### 3.1 集成架构

```
用户输入
  → TUI 输入处理
    → Router 决策
      → 显式命令 / 意图识别 → Agent 模式
        → AgentRegistry 解析 Agent
          → Agent.execute() 启动（独立 async task）
            → StageOutput 流通过 channel 发送到 TUI
              → TUI 渲染 Stage（Progress/Analysis/Draft/Completed）
                → 审批界面（如需要）
      → 通用对话 → 现有模式
```

#### 3.2 关键组件

**1. Agent 执行器**:
```rust
pub struct AgentExecutor {
    registry: AgentRegistry,
    tx: mpsc::Sender<StageOutput>,
}

impl AgentExecutor {
    pub async fn execute(
        &self,
        agent_id: AgentId,
        input: AgentInput,
    ) -> Result<()> {
        let agent = self.registry.get_handler(&agent_id)?;
        let mut agent = agent.write().await;
        
        let mut stream = agent.execute(input);
        while let Some(stage) = stream.next().await {
            self.tx.send(stage).await?;
        }
        
        Ok(())
    }
}
```

**2. TUI 渲染器**:
```rust
// 在 TUI 主循环中
while let Some(stage) = rx.recv().await {
    match stage.stage_type {
        StageType::Progress => {
            // 显示进度条或 spinner
            ui.show_progress(&stage.content);
        }
        StageType::Analysis => {
            // 显示分析结果（表格、列表）
            ui.show_analysis(&stage);
        }
        StageType::Draft => {
            // 显示草案内容（支持 Markdown）
            ui.show_draft(&stage.content);
        }
        StageType::Completed => {
            // 显示完成状态，等待审批
            if stage.requires_approval {
                ui.show_approval(&stage.approval_request)?;
            }
        }
        _ => {}
    }
}
```

**3. 审批界面**:
```rust
pub struct ApprovalUI {
    options: Vec<ApprovalOption>,
    selected: usize,
}

impl ApprovalUI {
    pub fn render(&self, frame: &mut Frame) {
        // 渲染审批选项（确认/修改/重试）
        // 支持键盘导航（↑/↓/Enter）
    }
}
```

#### 3.3 实现步骤

1. **创建 `agent_executor.rs`**:
   - `AgentExecutor` 结构体
   - 异步执行 Agent
   - 通过 channel 发送 StageOutput

2. **修改 `engine.rs`**:
   - 在 turn 循环中集成 Agent 执行
   - Router 决策后，启动 AgentExecutor
   - 处理 Agent 输出流

3. **修改 `ui.rs`**:
   - 添加 Stage 渲染函数
   - 添加审批 UI 组件
   - 处理 Agent 模式的界面状态

4. **状态管理**:
   - `AppState::AgentMode`（Agent 执行中）
   - `AppState::Approval`（等待审批）

### 验收标准

#### 功能验收
- [ ] Agent 执行不阻塞 TUI 事件循环
- [ ] Stage 输出实时显示（延迟 < 100ms）
- [ ] Progress 类型显示 spinner
- [ ] Analysis 类型显示结构化内容
- [ ] Draft 类型支持 Markdown 渲染
- [ ] Completed 类型支持审批交互

#### 审批交互
- [ ] 显示审批选项（确认/修改/重试）
- [ ] 键盘导航（↑/↓/Enter）
- [ ] 选择后发送反馈到 Agent
- [ ] 支持取消审批

#### 错误处理
- [ ] Agent 崩溃不崩溃 TUI
- [ ] 网络超时显示友好提示
- [ ] 用户可随时取消 Agent 执行

#### 测试验收
- [ ] 集成测试：完整 Agent 执行流程
- [ ] 性能测试：Agent 启动延迟 < 500ms
- [ ] 压力测试：连续执行 10 个 Agent

### 文件变更
- `crates/tui/src/core/agent_executor.rs`（新建）
- `crates/tui/src/core/engine.rs`（修改）
- `crates/tui/src/tui/ui.rs`（修改）
- `crates/tui/src/tui/components/approval.rs`（新建）

---

## BD-203: Router 与 TUI 输入系统集成（P1）

### 基本信息
- **标题**: 将 yunpat-router 接入 TUI 输入处理
- **类型**: feature
- **优先级**: P1
- **预估工时**: 6 小时
- **负责人**: TBD

### 依赖
- **前置**: BD-202
- **阻塞**: BD-301, BD-302, BD-303

### 背景
当前 TUI 使用简单的命令解析（`/compact`, `/cost` 等）。需要集成 yunpat-router，支持专利 Agent 命令和意图识别。

### 详细描述

#### 3.1 命令映射

**保留现有命令**:
- `/compact` — 压缩上下文
- `/cost` — 显示成本
- `/tokens` — 显示 token 统计
- `/model` — 模型切换
- `/stash` — 草稿暂存

**新增 Agent 命令**:
- `/research <topic>` — 启动 Research Agent
- `/oa` — 启动 OA Response Agent
- `/draft` — 启动 Drafting Agent
- `/reexam` — 启动 Reexamination Agent
- `/invalid` — 启动 Invalidation Agent

#### 3.2 意图识别集成

```rust
fn handle_input(input: &str) -> Action {
    if input.starts_with('/') {
        // 显式命令
        let cmd = input.trim_start_matches('/').trim();
        
        // 检查现有命令
        if let Some(action) = handle_builtin_command(cmd) {
            return action;
        }
        
        // 检查 Agent 命令
        if let Some(decision) = router.route_command(cmd) {
            return Action::StartAgent(decision);
        }
        
        return Action::UnknownCommand;
    }
    
    // 自由输入 → 意图识别
    let decision = router.route_input(input);
    match decision.source {
        RoutingSource::IntentRecognition => {
            Action::StartAgent(decision)
        }
        _ => {
            Action::Chat(input.to_string())
        }
    }
}
```

#### 3.3 上下文关联

```rust
// 在 Agent 执行期间
router.set_active_agent(Some(agent_id));

// 用户输入 "继续分析"
let decision = router.route_input("继续分析");
// → ContextAssociation → 继续当前 Agent
```

### 验收标准

#### 功能验收
- [ ] `/research` 启动 Research Agent
- [ ] `/oa` 启动 OA Response Agent
- [ ] 自由输入触发意图识别
- [ ] 上下文关联正常工作
- [ ] 与现有命令不冲突

#### 用户体验
- [ ] 命令自动补全（Tab）
- [ ] 命令帮助提示（F1）
- [ ] 未知命令友好提示

#### 测试验收
- [ ] 单元测试：所有命令路由正确
- [ ] 集成测试：命令 → Agent 启动
- [ ] 冲突测试：现有命令不受影响

### 文件变更
- `crates/tui/src/commands/mod.rs`（修改）
- `crates/tui/src/core/engine.rs`（修改）
- `crates/tui/src/tui/ui.rs`（修改，添加命令补全）

---

## BD-301: OA Response Agent（P0）

### 基本信息
- **标题**: 实现审查意见答复 Agent
- **类型**: feature
- **优先级**: P0
- **预估工时**: 16 小时
- **负责人**: TBD

### 依赖
- **前置**: BD-101, BD-201, BD-202, BD-203
- **阻塞**: BD-501

### 背景
OA Response Agent 是 YunPat 最核心的专利工作流 Agent。它需要解析审查意见文件、制定检索策略、分析对比文件、撰写答复意见。

### 详细描述

#### 3.1 工作流阶段

**Stage 1: OA 解析**
- 输入：OA 文件（PDF/Word/文本）
- 输出：结构化 OA 分析
  - 驳回理由（新颖性/创造性/实用性）
  - 引用的对比文件（专利号、公开日、相关内容）
  - 被驳回的权利要求
  - 审查员意见摘要

**Stage 2: 检索策略**
- 输入：OA 分析结果
- 输出：检索方案
  - IPC/CPC 分类号
  - 关键词组合
  - 检索数据库（中国专利、PCT、非专利文献）

**Stage 3: 对比分析**
- 输入：检索结果
- 输出：对比文件分析
  - 对比文件与权利要求的逐项对比
  - 区别技术特征识别
  - 创造性分析（是否显而易见）

**Stage 4: 答复撰写**
- 输入：OA 分析 + 对比分析
- 输出：意见陈述书草案
  - 修改后的权利要求书
  - 意见陈述（针对每条驳回理由）
  - 修改说明

**Stage 5: 质量检查**
- 输入：答复草案
- 输出：质量评分和改进建议
  - 逻辑完整性
  - 法律依据充分性
  - 权利要求保护范围合理性

#### 3.2 技术实现

```rust
pub struct OaResponseAgent {
    id: AgentId,
    llm_provider: Option<Box<dyn LlmProvider>>,
    knowledge_base: KnowledgeBase,
}

#[async_trait]
impl PatentAgent for OaResponseAgent {
    fn stages(&self) -> Vec<StageDefinition> {
        vec![
            StageDefinition { stage_id: "parse_oa", stage_name: "解析审查意见", ... },
            StageDefinition { stage_id: "search_strategy", stage_name: "制定检索策略", ... },
            StageDefinition { stage_id: "comparison", stage_name: "对比分析", ... },
            StageDefinition { stage_id: "draft_response", stage_name: "撰写答复", ... },
            StageDefinition { stage_id: "quality_check", stage_name: "质量检查", ... },
            StageDefinition { stage_id: "completed", stage_name: "完成", ... },
        ]
    }
    
    fn execute(&mut self, 
         input: AgentInput
    ) -> Pin<Box<dyn Stream<Item = StageOutput> + Send>> {
        Box::pin(async_stream::stream! {
            // Stage 1: 解析 OA
            yield StageOutput {
                stage_id: "parse_oa",
                stage_type: StageType::Analysis,
                content: parse_oa_content(&input).await?,
                ...
            };
            
            // Stage 2: 检索策略
            yield StageOutput {
                stage_id: "search_strategy",
                stage_type: StageType::Suggestion,
                content: generate_search_strategy(...).await?,
                ...
            };
            
            // ... 其他阶段
        })
    }
}
```

#### 3.3 OA 解析

**PDF 解析**:
- 使用 `pdf-extract` 或 `lopdf` crate
- 提取文本内容
- 识别结构化信息（表格、段落）

**结构化提取**:
- 正则表达式匹配：
  - 对比文件：`CN\d+.*`、`<US\d+.*>`
  - 权利要求："权利要求 \d+"
  - 驳回理由："不具备专利法.*"

**LLM 辅助解析**:
- 将 OA 文本发送给 LLM
- 要求返回结构化 JSON
- 验证解析结果

#### 3.4 答复撰写

**模板系统**:
```markdown
# 意见陈述书

## 一、修改说明
{{modification_description}}

## 二、针对审查意见的答复

### （一）关于新颖性
{{novelty_response}}

### （二）关于创造性
{{inventiveness_response}}

## 三、修改后的权利要求书
{{amended_claims}}
```

**LLM 生成**:
- 构建详细 prompt（OA 分析 + 对比分析 + 模板）
- 流式生成答复内容
- 支持用户修改和迭代

### 验收标准

#### 功能验收
- [ ] 上传并解析 OA 文件（PDF/Word）
- [ ] 提取审查要点（驳回理由、对比文件、权利要求）
- [ ] 生成检索策略（分类号、关键词）
- [ ] 对比文件分析（区别特征、创造性）
- [ ] 生成答复草案（意见陈述书）
- [ ] 质量检查评分（0-10）

#### 输出质量
- [ ] 答复逻辑完整
- [ ] 法律依据准确
- [ ] 权利要求修改合理
- [ ] 符合专利局格式要求

#### 测试验收
- [ ] 使用真实 OA 文件测试（10+ 案例）
- [ ] 解析准确率 > 90%
- [ ] 答复质量评分 > 7.0

### 文件变更
- `crates/yunpat-agents/src/oa_response.rs`（新建）
- `crates/yunpat-agents/src/lib.rs`（修改）

---

## BD-302: Drafting Agent（P1）

### 基本信息
- **标题**: 实现专利撰写 Agent
- **类型**: feature
- **优先级**: P1
- **预估工时**: 12 小时
- **负责人**: TBD

### 依赖
- **前置**: BD-101, BD-201, BD-202
- **阻塞**: 无

### 背景
Drafting Agent 辅助专利代理人和发明人撰写专利申请文件，包括说明书和权利要求书。

### 详细描述

#### 3.1 工作流阶段

**Stage 1: 技术交底书解析**
- 输入：技术交底书（Markdown/Word/PDF）
- 输出：结构化发明内容
  - 技术领域
  - 背景技术
  - 发明内容（技术问题、技术方案、有益效果）
  - 具体实施方式
  - 附图说明

**Stage 2: 现有技术检索**
- 输入：发明内容摘要
- 输出：相关专利列表
  - 检索策略
  - 相关专利（标题、摘要、相关性）

**Stage 3: 权利要求布局**
- 输入：发明内容 + 现有技术
- 输出：权利要求书草案
  - 独立权利要求（必要技术特征）
  - 从属权利要求（附加技术特征）
  - 权利要求层次结构

**Stage 4: 说明书撰写**
- 输入：发明内容 + 权利要求书
- 输出：说明书草案
  - 技术领域
  - 背景技术
  - 发明内容
  - 附图说明
  - 具体实施方式

**Stage 5: 审核优化**
- 输入：权利要求书 + 说明书
- 输出：审核报告
  - 保护范围合理性
  - 支持性问题
  - 清楚性检查
  - 单一性检查

#### 3.2 权利要求布局算法

**独立权利要求**:
1. 识别必要技术特征（解决技术问题的最小特征集）
2. 构建上位概念（避免过度限定）
3. 确保支持性（说明书中有充分描述）

**从属权利要求**:
1. 识别附加技术特征（优选实施方式）
2. 层次化布局（一般 → 具体）
3. 引用关系清晰

**LLM Prompt**:
```markdown
请根据以下发明内容，设计权利要求书：

## 发明内容
{{invention_content}}

## 要求
1. 独立权利要求包含必要技术特征，但不过度限定
2. 从属权利要求层次化布局
3. 权利要求引用关系清晰
4. 符合中国专利法要求
```

### 验收标准

#### 功能验收
- [ ] 解析技术交底书
- [ ] 生成权利要求书草案
- [ ] 生成说明书草案
- [ ] 审核报告（保护范围、支持性、清楚性）

#### 输出质量
- [ ] 权利要求层次清晰
- [ ] 保护范围合理
- [ ] 说明书支持权利要求
- [ ] 符合专利局格式

#### 测试验收
- [ ] 使用真实技术交底书测试（5+ 案例）
- [ ] 权利要求质量评分 > 7.0

### 文件变更
- `crates/yunpat-agents/src/drafting.rs`（新建）

---

## BD-303: Reexamination & Invalidation Agents（P2）

### 基本信息
- **标题**: 实现复审和无效宣告 Agent
- **类型**: feature
- **优先级**: P2
- **预估工时**: 10 小时
- **负责人**: TBD

### 依赖
- **前置**: BD-301
- **阻塞**: 无

### 背景
复审和无效宣告是专利代理人的重要工作。这两个 Agent 与 OA Response Agent 类似，但针对不同的法律程序。

### 详细描述

#### 3.1 Reexamination Agent

**工作流**:
1. **驳回决定解析** — 提取驳回理由和证据
2. **复审策略** — 确定复审请求的法律依据
3. **证据补充** — 检索新的对比文件或证据
4. **复审请求书** — 撰写复审请求书

#### 3.2 Invalidation Agent

**工作流**:
1. **目标专利分析** — 解析目标专利的权利要求
2. **无效证据检索** — 检索现有技术证据
3. **证据整理** — 按无效理由分类证据
4. **无效宣告请求书** — 撰写无效宣告请求书

### 验收标准

#### 功能验收
- [ ] 复审请求书生成
- [ ] 无效宣告请求书生成
- [ ] 证据检索和整理

### 文件变更
- `crates/yunpat-agents/src/reexamination.rs`（新建）
- `crates/yunpat-agents/src/invalidation.rs`（新建）

---

## BD-401: 向量语义搜索（P1）

### 基本信息
- **标题**: 实现知识库向量语义搜索
- **类型**: feature
- **优先级**: P1
- **预估工时**: 10 小时
- **负责人**: TBD

### 依赖
- **前置**: BD-102
- **阻塞**: BD-402

### 背景
当前知识库使用关键词搜索，准确率有限。需要升级为语义搜索，使用 Embedding 向量计算相似度。

### 详细描述

#### 3.1 技术方案

**向量存储**:
- 使用 SQLite + `vec0` 扩展（或纯内存 HashMap）
- 存储：文档 ID → 向量
- 索引：Faiss 或纯余弦相似度计算

**搜索流程**:
1. 查询文本 → Embedding API → 向量
2. 计算与所有文档向量的余弦相似度
3. 返回 Top-K 最相似的文档

**增量更新**:
- 新文档自动向量化
- 更新向量存储
- 删除文档时移除向量

#### 3.2 实现步骤

1. **创建 `vector_store.rs`**:
   - `VectorStore` 结构体
   - 添加/删除/查询向量
   - 余弦相似度计算

2. **修改 `knowledge.rs`**:
   - 集成 VectorStore
   - 搜索时先语义搜索，再关键词搜索（混合）

3. **索引管理**:
   - 后台任务：文档向量化
   - 持久化：向量存储到磁盘

### 验收标准

#### 功能验收
- [ ] 文档向量化
- [ ] 语义相似度搜索
- [ ] 搜索结果排序（相似度）
- [ ] 增量索引更新

#### 性能
- [ ] 搜索延迟 < 2s（1000 文档）
- [ ] 内存占用 < 500MB

### 文件变更
- `crates/yunpat-agents/src/vector_store.rs`（新建）
- `crates/yunpat-agents/src/knowledge.rs`（修改）

---

## BD-402: 知识库管理工具（P2）

### 基本信息
- **标题**: 实现知识库管理命令
- **类型**: feature
- **优先级**: P2
- **预估工时**: 6 小时
- **负责人**: TBD

### 依赖
- **前置**: BD-401
- **阻塞**: 无

### 背景
用户需要方便地管理知识库文档（添加、搜索、删除）。

### 详细描述

#### 3.1 命令实现

```rust
pub enum KbCommand {
    Add { path: PathBuf },
    Search { query: String },
    List,
    Remove { doc_id: String },
}

impl KbCommand {
    pub async fn execute(&self, kb: &mut KnowledgeBase
    ) -> Result<String> {
        match self {
            KbCommand::Add { path } => {
                kb.add_document(path).await?;
                Ok("文档已添加并索引".to_string())
            }
            KbCommand::Search { query } => {
                let results = kb.search(query, 10).await?;
                Ok(format_results(&results))
            }
            ...
        }
    }
}
```

#### 3.2 TUI 集成

- `/kb add <path>` — 添加文档
- `/kb search <query>` — 搜索知识库
- `/kb list` — 列出文档
- `/kb remove <id>` — 删除文档

### 验收标准

#### 功能验收
- [ ] 添加文档并自动索引
- [ ] 语义搜索
- [ ] 文档列表和删除

### 文件变更
- `crates/tui/src/commands/kb.rs`（新建）

---

## BD-501: 声明式工作流定义（P1）

### 基本信息
- **标题**: 支持 YAML/JSON 工作流定义
- **类型**: feature
- **优先级**: P1
- **预估工时**: 10 小时
- **负责人**: TBD

### 依赖
- **前置**: BD-301
- **阻塞**: BD-502

### 背景
当前工作流是硬编码的。需要支持声明式定义，使用户可以自定义工作流。

### 详细描述

#### 3.1 工作流格式

```yaml
flow_id: oa-response-v2
flow_name: 审查意见答复（增强版）
description: 包含自动检索和质量检查

steps:
  - step_id: parse_oa
    step_name: 解析审查意见
    agent_calls:
      - agent_id: oa-parser
        output_key: oa_analysis
    
  - step_id: auto_search
    step_name: 自动检索
    agent_calls:
      - agent_id: patent-search
        input_mapping:
          query: oa_analysis.claims
          classification: oa_analysis.ipc
        output_key: search_results
    condition: oa_analysis.has_rejection
    
  - step_id: comparison
    step_name: 对比分析
    agent_calls:
      - agent_id: comparison-analyzer
        input_mapping:
          oa: oa_analysis
          prior_art: search_results
        output_key: comparison
    
  - step_id: draft_response
    step_name: 撰写答复
    agent_calls:
      - agent_id: oa-response
        input_mapping:
          oa: oa_analysis
          comparison: comparison
        output_key: response_draft
    quality_check:
      dimensions:
        - 逻辑完整性
        - 法律依据充分性
        - 权利要求保护范围
      threshold: 7.0
      max_auto_retries: 2
      escalate_to_human: true
    
  - step_id: review
    step_name: 人工审核
    requires_approval: true
    approval_prompt: "请审核答复草案"
```

#### 3.2 实现步骤

1. **修改 `flow.rs`**:
   - 添加 YAML/JSON 序列化支持
   - 验证工作流定义（步骤顺序、Agent 存在性）

2. **创建 `flow_loader.rs`**:
   - 从文件加载工作流
   - 从字符串加载工作流
   - 验证工作流

3. **修改 `flow_executor.rs`**:
   - 支持条件执行（condition）
   - 支持循环执行（loop）
   - 支持质量检查（quality_check）

### 验收标准

#### 功能验收
- [ ] YAML/JSON 工作流解析
- [ ] 条件执行
- [ ] 循环执行
- [ ] 质量检查
- [ ] 人工审批

### 文件变更
- `crates/yunpat-agents/src/flow.rs`（扩展）
- `crates/yunpat-agents/src/flow_loader.rs`（新建）

---

## BD-502: 工作流执行可视化（P2）

### 基本信息
- **标题**: 在 TUI 中显示工作流执行进度
- **类型**: feature
- **优先级**: P2
- **预估工时**: 8 小时
- **负责人**: TBD

### 依赖
- **前置**: BD-501
- **阻塞**: 无

### 背景
工作流可能包含多个步骤，需要可视化显示执行进度。

### 详细描述

#### 3.1 可视化组件

```rust
pub struct WorkflowProgress {
    flow_id: String,
    steps: Vec<StepStatus>,
}

pub enum StepStatus {
    Pending,
    Running { start_time: Instant },
    Completed { duration: Duration, quality_score: Option<f32> },
    Failed { error: String },
    WaitingApproval,
}

impl WorkflowProgress {
    pub fn render(&self, frame: &mut Frame) {
        // 渲染步骤列表
        // 每个步骤：名称 + 状态图标 + 进度条
        // 当前步骤高亮
    }
}
```

#### 3.2 状态更新

- FlowEngine 每步完成后发送状态更新
- TUI 实时更新进度显示
- 审批步骤暂停，等待用户输入

### 验收标准

#### 功能验收
- [ ] 工作流进度可视化
- [ ] 步骤状态实时更新
- [ ] 审批界面集成

### 文件变更
- `crates/tui/src/tui/components/workflow_progress.rs`（新建）

---

## BD-601: 单元测试（P1）

### 基本信息
- **标题**: 核心组件单元测试
- **类型**: test
- **优先级**: P1
- **预估工时**: 12 小时
- **负责人**: TBD

### 依赖
- **前置**: 所有功能 bead
- **阻塞**: BD-602

### 详细描述

#### 3.1 测试范围

**yunpat-router**:
- 路由决策（所有路径）
- 意图识别（关键词匹配）
- 上下文关联

**yunpat-models**:
- SSE 解析（模拟流）
- Embedding（Mock API）
- 配置加载

**yunpat-agents**:
- Agent 执行（Mock LLM）
- Flow 执行（条件、循环、质量检查）
- 知识库搜索

**yunpat-mcp-bridge**:
- MCP 通信（Mock Server）
- Tool 调用

#### 3.2 Mock 实现

```rust
// Mock LLM Provider
pub struct MockLlmProvider {
    responses: HashMap<String, String>,
}

impl LlmProvider for MockLlmProvider {
    fn chat_stream(&self, 
         system_prompt: &str, 
         user_message: &str
    ) -> Pin<Box<dyn Stream<Item = Result<String>> + Send>> {
        let response = self.responses
            .get(user_message)
            .cloned()
            .unwrap_or_default();
        Box::pin(async_stream::stream! {
            yield Ok(response);
        })
    }
}
```

### 验收标准

#### 测试覆盖
- [ ] 路由：100% 路径覆盖
- [ ] 模型：SSE、Embedding、配置
- [ ] Agent：执行、Flow、知识库
- [ ] MCP：通信、Tool

#### 测试质量
- [ ] 不使用外部 API（全部 Mock）
- [ ] 异步测试使用 `tokio::test`
- [ ] 错误场景覆盖

### 文件变更
- 各 crate 的 `tests/` 目录

---

## BD-602: 集成测试（P2）

### 基本信息
- **标题**: 端到端工作流测试
- **类型**: test
- **优先级**: P2
- **预估工时**: 8 小时
- **负责人**: TBD

### 依赖
- **前置**: BD-601
- **阻塞**: 无

### 详细描述

#### 3.1 测试场景

**场景 1: 完整 OA Response 工作流**
1. 用户输入："/oa"
2. 系统：启动 OA Response Agent
3. 用户：上传 OA 文件
4. Agent：解析 OA → 检索策略 → 对比分析 → 答复草案
5. 用户：审批答复

**场景 2: 工作流执行**
1. 加载 YAML 工作流
2. 执行工作流
3. 验证每个步骤输出

**场景 3: 知识库**
1. 添加文档
2. 搜索知识库
3. 验证搜索结果

### 验收标准

#### 测试覆盖
- [ ] 完整工作流端到端
- [ ] 错误恢复
- [ ] 性能测试

### 文件变更
- `tests/integration/` 目录

---

## 依赖图

```
BD-101 (SSE 流式)
  ├── BD-201 (ModelProvider 适配)
  │     ├── BD-301 (OA Response Agent)
  │     │     └── BD-501 (工作流定义)
  │     │           └── BD-502 (工作流可视化)
  │     ├── BD-302 (Drafting Agent)
  │     └── BD-303 (Reexamination/Invalidation)
  ├── BD-202 (TUI Agent 集成)
  │     ├── BD-301
  │     ├── BD-302
  │     └── BD-303
  └── BD-203 (Router 集成)
        ├── BD-301
        ├── BD-302
        └── BD-303

BD-102 (Embedding)
  └── BD-401 (向量搜索)
        └── BD-402 (知识库管理)

BD-103 (配置加载)
  ├── BD-201
  └── BD-202

BD-601 (单元测试)
  └── BD-602 (集成测试)
```

---

## 执行计划

### 第 1 周：模型层
- **Day 1-2**: BD-101 (SSE 流式)
- **Day 3-4**: BD-102 (Embedding)
- **Day 5**: BD-103 (配置加载)

### 第 2 周：TUI 集成
- **Day 1-2**: BD-201 (ModelProvider 适配)
- **Day 3-5**: BD-202 (TUI Agent 集成)
- **Day 5**: BD-203 (Router 集成)

### 第 3 周：核心 Agent
- **Day 1-3**: BD-301 (OA Response Agent)
- **Day 4-5**: BD-302 (Drafting Agent)

### 第 4 周：知识库 + 更多 Agent
- **Day 1-3**: BD-401 (向量搜索)
- **Day 4**: BD-402 (知识库管理)
- **Day 5**: BD-303 (Reexamination/Invalidation)

### 第 5 周：工作流
- **Day 1-3**: BD-501 (工作流定义)
- **Day 4-5**: BD-502 (工作流可视化)

### 第 6 周：测试 + 发布
- **Day 1-3**: BD-601 (单元测试)
- **Day 4**: BD-602 (集成测试)
- **Day 5**: 发布 v0.9.0

---

## 风险缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| SSE 实现复杂 | 高 | 分阶段实现：先基础流式，再优化错误处理 |
| Agent 输出质量不稳定 | 高 | 质量检查 + 人工审批 + Prompt 迭代 |
| 向量搜索性能差 | 中 | 本地存储 + 缓存 + 分批处理 |
| 多 Provider 兼容性 | 中 | 统一 OpenAI 接口 + 适配层 |
| TUI 渲染复杂 | 中 | 复用现有组件 + 渐进增强 |

---

*Beads 版本: v1.0*
*最后更新: 2026-05-08*
*作者: Sisyphus*
