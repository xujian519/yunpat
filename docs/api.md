# API 文档

> 云熙知识产权智能体（YunPat Agent）API 参考文档
>
> 最后更新：2026-05-09

本文档涵盖 YunPat Agent 的完整 API 接口，面向集成开发者和贡献者。包括 HTTP API、JSON-RPC API、Rust 公共 API、TypeScript Agent/Tool 接口、MCP 工具接口和数据主权检测 API。

---

## 目录

- [1. HTTP API](#1-http-api)
- [2. JSON-RPC API](#2-json-rpc-api)
- [3. Rust 公共 API](#3-rust-公共-api)
- [4. TypeScript Agent 接口](#4-typescript-agent-接口)
- [5. MCP Server 工具接口](#5-mcp-server-工具接口)
- [6. 数据主权检测 API](#6-数据主权检测-api)

---

## 1. HTTP API

app-server crate 提供 HTTP 服务，默认监听端口 **8080**。基于 axum 框架实现，支持 CORS。

### 1.1 健康检查

#### `GET /healthz`

检查服务健康状态。

**响应**：

```json
{
  "status": "ok",
  "protocol": "v2",
  "service": "deepseek-app-server"
}
```

### 1.2 线程管理

#### `POST /thread`

处理线程相关操作。通过 `ThreadRequest` 的请求体区分具体操作类型。

**请求体**（创建线程示例）：

```json
{
  "Create": {
    "metadata": {}
  }
}
```

**响应**（`ThreadResponse`）：

```json
{
  "thread_id": "thread-uuid",
  "status": "created",
  "thread": { ... },
  "threads": [],
  "model": "auto",
  "model_provider": "deepseek",
  "cwd": "/current/path",
  "approval_policy": null,
  "sandbox": null,
  "events": [],
  "data": {}
}
```

`ThreadRequest` 支持的变体：

| 变体 | 说明 |
|------|------|
| `Create` | 创建新线程 |
| `Start` | 启动线程（带参数） |
| `Resume` | 恢复线程 |
| `Fork` | 分叉线程 |
| `List` | 列出所有线程 |
| `Read` | 读取线程详情 |
| `SetName` | 设置线程名称 |
| `Archive` | 归档线程 |
| `Unarchive` | 取消归档 |
| `Message` | 向线程发送消息 |

### 1.3 提示处理

#### `POST /prompt`

发送提示并获取响应。

**请求体**（`PromptRequest`）：

```json
{
  "thread_id": "thread-uuid",
  "prompt": "请分析这件专利的新颖性",
  "model": "deepseek-v4-pro"
}
```

**响应**（`PromptResponse`）：

```json
{
  "output": "{\"provider\":\"deepseek\",\"model\":\"deepseek-v4-pro\",...}",
  "model": "deepseek-v4-pro",
  "events": [
    { "ResponseStart": { "response_id": "resp-uuid" } },
    { "ResponseDelta": { "response_id": "resp-uuid", "delta": "model-selected" } },
    { "ResponseEnd": { "response_id": "resp-uuid" } }
  ]
}
```

### 1.4 工具调用

#### `POST /tool`

直接调用已注册工具。

**请求体**（`ToolCallRequest`）：

```json
{
  "call": {
    "name": "patent_search",
    "payload": { "Function": { ... } },
    "source": "Direct",
    "raw_tool_call_id": null
  },
  "cwd": "/optional/working/dir"
}
```

**响应**：

```json
{
  "ok": true,
  "status": "completed",
  "execution_kind": "tool",
  "response_id": "tool-uuid",
  "output": { ... },
  "events": [ ... ]
}
```

### 1.5 应用状态

#### `POST /app`

获取或操作应用状态。通过 `AppRequest` 区分操作。

**请求体示例**（获取能力列表）：

```json
"Capabilities"
```

**响应**（`AppResponse`）：

```json
{
  "ok": true,
  "data": {
    "routes": ["/thread", "/app", "/prompt", "/tool", "/jobs", "/mcp/startup"],
    "config": ["get", "set", "unset", "list"],
    "events": ["response_start", "response_delta", "response_end", "tool_call_start", "tool_call_result", "mcp_startup_update", "mcp_startup_complete"],
    "transport": "stdio+http"
  },
  "events": []
}
```

`AppRequest` 支持的变体：

| 变体 | 说明 |
|------|------|
| `Capabilities` | 获取应用能力列表 |
| `ConfigGet { key }` | 获取配置项 |
| `ConfigSet { key, value }` | 设置配置项 |
| `ConfigUnset { key }` | 删除配置项 |
| `ConfigList` | 列出所有配置 |
| `Models` | 获取可用模型列表 |
| `ThreadLoadedList` | 获取已加载线程列表 |

### 1.6 任务管理

#### `GET /jobs`

列出所有任务状态。

**响应**（`AppResponse`）：

```json
{
  "ok": true,
  "data": {
    "jobs": [
      {
        "id": "job-uuid",
        "name": "专利检索任务",
        "status": "running",
        "progress": 45,
        "detail": null,
        "retry": { "attempt": 0, "max_attempts": 3, ... },
        "history": [ ... ]
      }
    ]
  },
  "events": [ ... ]
}
```

### 1.7 MCP 启动

#### `POST /mcp/startup`

触发 MCP 服务器启动流程。

**响应**：

```json
{
  "ok": true,
  "summary": {
    "ready": ["yunpat-mcp"],
    "failed": [],
    "cancelled": []
  }
}
```

---

## 2. JSON-RPC API

app-server 支持通过 stdio 传输的 JSON-RPC 2.0 协议。适用于与编辑器插件、脚本等集成。

### 2.1 连接方式

```bash
deepseek serve --acp
```

通过 stdin 发送 JSON-RPC 请求，每行一个请求，以换行符分隔。

### 2.2 通用方法

#### `healthz` / `app/healthz`

健康检查。

**响应**：

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "status": "ok",
    "service": "deepseek-app-server",
    "transport": "stdio"
  }
}
```

#### `capabilities`

查询服务器支持的所有方法。

**响应**包含 `methods` 数组，列出所有可用方法。

#### `shutdown`

关闭服务。

**响应**：

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "ok": true,
    "status": "stopped"
  }
}
```

### 2.3 线程方法

#### `thread/create`

创建新线程。

**参数**：

```json
{
  "metadata": {}
}
```

#### `thread/start`

启动线程（带完整参数）。

**参数**：

```json
{
  "model_provider": "deepseek",
  "cwd": "/work/path",
  "persist_extended_history": false
}
```

#### `thread/resume`

恢复已存在的线程。

**参数**：

```json
{
  "thread_id": "thread-uuid",
  "history": []
}
```

#### `thread/fork`

从现有线程分叉创建新线程。

**参数**：

```json
{
  "thread_id": "parent-thread-uuid",
  "model_provider": "deepseek",
  "persist_extended_history": false
}
```

#### `thread/list`

列出所有线程。

**参数**：

```json
{
  "include_archived": false,
  "limit": 50
}
```

#### `thread/read`

读取线程详情。

**参数**：

```json
{
  "thread_id": "thread-uuid"
}
```

#### `thread/set_name` / `thread/set-name`

设置线程名称。

**参数**：

```json
{
  "thread_id": "thread-uuid",
  "name": "专利分析会话"
}
```

#### `thread/archive`

归档线程。

**参数**：

```json
{
  "thread_id": "thread-uuid"
}
```

#### `thread/unarchive`

取消归档线程。

**参数**：

```json
{
  "thread_id": "thread-uuid"
}
```

#### `thread/message`

向线程发送消息。

**参数**：

```json
{
  "thread_id": "thread-uuid",
  "input": "请检索关于Transformer的专利"
}
```

### 2.4 应用方法

#### `app/capabilities`

获取应用能力。

#### `app/request`

通用应用请求（传递 `AppRequest`）。

#### `app/config/get`

获取配置项。

**参数**：

```json
{
  "key": "model"
}
```

#### `app/config/set`

设置配置项。

**参数**：

```json
{
  "key": "model",
  "value": "deepseek-v4-pro"
}
```

#### `app/config/unset`

删除配置项。

#### `app/config/list`

列出所有配置。

#### `app/models`

获取可用模型列表。

#### `app/thread_loaded_list` / `app/thread-loaded-list`

获取已加载线程列表。

### 2.5 提示方法

#### `prompt/capabilities`

获取提示处理能力。

#### `prompt/request` / `prompt/run`

发送提示请求。

**参数**（`PromptRequest`）：

```json
{
  "thread_id": "thread-uuid",
  "prompt": "分析这件专利的创造性",
  "model": "deepseek-v4-pro"
}
```

---

## 3. Rust 公共 API

### 3.1 Runtime 核心

定义于 `crates/core/src/lib.rs`。

```rust
pub struct Runtime {
    pub config: ConfigToml,
    pub model_registry: ModelRegistry,
    pub thread_manager: ThreadManager,
    pub tool_registry: Arc<ToolRegistry>,
    pub mcp_manager: Arc<McpManager>,
    pub exec_policy: ExecPolicyEngine,
    pub hooks: HookDispatcher,
    pub hook_pipeline: HookPipeline,
    pub jobs: JobManager,
}

impl Runtime {
    pub fn new(
        config: ConfigToml,
        model_registry: ModelRegistry,
        state: StateStore,
        tool_registry: Arc<ToolRegistry>,
        mcp_manager: Arc<McpManager>,
        exec_policy: ExecPolicyEngine,
        hooks: HookDispatcher,
    ) -> Self;

    pub async fn handle_thread(&mut self, req: ThreadRequest) -> Result<ThreadResponse>;
    pub async fn handle_prompt(
        &mut self,
        req: PromptRequest,
        cli_overrides: &CliRuntimeOverrides,
    ) -> Result<PromptResponse>;
    pub async fn invoke_tool(
        &self,
        call: ToolCall,
        approval_mode: AskForApproval,
        cwd: &Path,
    ) -> Result<Value>;
    pub async fn mcp_startup(&self) -> McpStartupCompleteEvent;
    pub fn app_status(&self) -> AppResponse;

    // 任务管理
    pub fn enqueue_job(&mut self, name: impl Into<String>) -> Result<JobRecord>;
    pub fn set_job_running(&mut self, job_id: &str) -> Result<()>;
    pub fn update_job_progress(&mut self, job_id: &str, progress: u8, detail: Option<String>) -> Result<()>;
    pub fn complete_job(&mut self, job_id: &str) -> Result<()>;
    pub fn fail_job(&mut self, job_id: &str, detail: impl Into<String>) -> Result<()>;
    pub fn cancel_job(&mut self, job_id: &str) -> Result<()>;
    pub fn pause_job(&mut self, job_id: &str, detail: Option<String>) -> Result<()>;
    pub fn resume_job(&mut self, job_id: &str, detail: Option<String>) -> Result<()>;
    pub fn job_history(&self, job_id: &str) -> Vec<JobHistoryEntry>;

    // 检查点管理
    pub fn save_thread_checkpoint(
        &self,
        thread_id: &str,
        checkpoint_id: &str,
        state: &Value,
    ) -> Result<()>;
    pub fn load_thread_checkpoint(
        &self,
        thread_id: &str,
        checkpoint_id: Option<&str>,
    ) -> Result<Option<Value>>;
}
```

`JobStatus` 枚举：

```rust
pub enum JobStatus {
    Queued,
    Running,
    Paused,
    Completed,
    Failed,
    Cancelled,
}
```

### 3.2 yunpat-agents（专利 Agent Trait 系统）

定义于 `crates/yunpat-agents/src/`。

#### `PatentAgent` trait

```rust
#[async_trait]
pub trait PatentAgent: Send + Sync {
    fn id(&self) -> &AgentId;
    fn name(&self) -> &str;
    fn description(&self) -> &str;
    fn capabilities(&self) -> &[String];
    fn can_handle(&self, intent: &UserIntent) -> Confidence;
    fn stages(&self) -> Vec<StageDefinition>;

    async fn initialize(&mut self) -> Result<()>;
    fn execute(&mut self, input: AgentInput) -> Pin<Box<dyn Stream<Item = StageOutput> + Send>>;
    async fn terminate(&mut self) -> Result<()>;
}
```

#### `OrchestrationAgent` trait

```rust
#[async_trait]
pub trait OrchestrationAgent: PatentAgent {
    fn flow_definition(&self) -> crate::flow::OrchestrationFlow;
}
```

#### `AgentRegistry`

```rust
pub struct AgentRegistry;

impl AgentRegistry {
    pub fn new() -> Self;
    pub fn register_native(&mut self, agent: impl PatentAgent + 'static);
    pub fn resolve(&self, intent: &UserIntent) -> Option<&AgentRegistration>;
    pub async fn resolve_with_confidence(&self, intent: &UserIntent) -> Option<&AgentRegistration>;
    pub fn get_by_id(&self, id: &AgentId) -> Option<&AgentRegistration>;
    pub fn get_handler(&self, id: &AgentId) -> Option<Arc<RwLock<dyn PatentAgent>>>;
    pub fn list_all(&self) -> Vec<&AgentRegistration>;
    pub fn len(&self) -> usize;
    pub fn is_empty(&self) -> bool;
}
```

#### 核心类型

```rust
pub struct Case { ... }
pub struct CaseDocument { ... }
pub enum CaseStatus { ... }
pub struct OrchestrationFlow { ... }
pub struct FlowStep { ... }
pub struct AgentContext { ... }
```

### 3.3 yunpat-models（多 LLM 提供商）

定义于 `crates/yunpat-models/src/provider.rs`。

```rust
pub trait ModelProvider: Send + Sync {
    fn chat(&self, request: ChatRequest)
        -> Pin<Box<dyn Stream<Item = Result<ChatChunk>> + Send>>;
    fn multimodal(&self, request: MultimodalRequest)
        -> Pin<Box<dyn Stream<Item = Result<ChatChunk>> + Send>>;
    fn embed(&self, request: EmbedRequest) -> Result<EmbedResponse>;
    fn rerank(&self, request: RerankRequest) -> Result<RerankResponse>;
    fn with_provider(&self, provider_id: &str) -> ProviderView<'_>;
    fn with_model(&self, model_id: &str) -> ProviderView<'_>;
    fn is_provider_available(&self, provider_id: &str) -> bool;
}
```

支持的内置提供商：

| 提供商 | 模型 ID 示例 |
|--------|-------------|
| DeepSeek | `deepseek-v4-pro`, `deepseek-v4-flash` |
| 通义千问 | `qwen-turbo`, `qwen-plus`, `qwen-max` |
| 智谱 GLM | `glm-5.1`, `glm-4.7-flash`, `glm-4.7` |
| 文心一言 | `ernie-bot`, `ernie-bot-4` |
| Ollama（本地） | `ollama/llama3`, `ollama/mistral` |
| NVIDIA NIM | 通过 OpenAI 兼容接口 |
| Fireworks | 通过 OpenAI 兼容接口 |
| SGLang（自托管） | 通过 OpenAI 兼容接口 |
| vLLM（自托管） | 通过 OpenAI 兼容接口 |

### 3.4 yunpat-router（意图路由）

定义于 `crates/yunpat-router/src/router.rs`。

```rust
pub struct Router;

impl Router {
    pub fn new() -> Self;
    pub fn route_command(&self, command: &str) -> Option<RoutingDecision>;
    pub fn route_input(&self, input: &str) -> RoutingDecision;
    pub fn set_active_agent(&mut self, agent_id: Option<String>);
    pub fn active_agent(&self) -> Option<&str>;
}

pub struct RoutingDecision {
    pub agent_id: String,
    pub source: RoutingSource,
    pub topic: Option<String>,
}

pub enum RoutingSource {
    ExplicitCommand,
    ContextAssociation,
    IntentRecognition,
    GenericFallback,
}
```

预定义的 Agent 标识：

| 常量 | 值 | 说明 |
|------|-----|------|
| `AGENT_RESEARCH` | `"research"` | 法律研究 |
| `AGENT_DRAFTING` | `"drafting"` | 专利撰写 |
| `AGENT_OA_RESPONSE` | `"oa-response"` | 审查意见答复 |
| `AGENT_REEXAMINATION` | `"reexamination"` | 复审 |
| `AGENT_INVALIDATION` | `"invalidation"` | 无效宣告 |
| `AGENT_SEARCH` | `"search"` | 专利检索 |
| `AGENT_ANALYSIS` | `"analysis"` | 专利分析 |

### 3.5 yunpat-mcp-bridge（MCP 桥接）

定义于 `crates/yunpat-mcp-bridge/src/bridge.rs`。

```rust
pub struct MCPBridge;

impl MCPBridge {
    pub async fn start_server(
        config: &McpServerStartConfig,
        server_id: &str,
    ) -> Result<ServerHandle>;
    pub async fn stop_server(handle: ServerHandle) -> Result<()>;
    pub async fn health_check(handle: &ServerHandle) -> HealthStatus;
    pub async fn list_tools(handle: &ServerHandle) -> Result<Vec<McpToolDescriptor>>;
    pub async fn invoke(
        handle: &ServerHandle,
        tool: &str,
        input: Value,
        timeout: Option<Duration>,
    ) -> Result<MCPToolResult>;
}

pub struct ServerHandle {
    pub server_id: String,
    // 内部字段省略
}

pub struct McpServerStartConfig {
    pub command: String,
    pub args: Vec<String>,
    pub env: HashMap<String, String>,
}

pub struct MCPToolResult {
    pub content: Value,
    pub is_error: bool,
}

pub enum HealthStatus {
    Healthy,
    Unhealthy(String),
    Stopped,
}
```

### 3.6 tools（工具注册表）

定义于 `crates/tools/src/lib.rs`。

```rust
pub struct ToolRegistry {
    // 内部字段
}

impl ToolRegistry {
    pub fn register(&mut self, spec: ToolSpec, handler: Arc<dyn ToolHandler>) -> Result<()>;
    pub fn list_specs(&self) -> Vec<ConfiguredToolSpec>;
    pub async fn dispatch(
        &self,
        call: ToolCall,
        allow_mutating: bool,
    ) -> std::result::Result<ToolOutput, FunctionCallError>;
}

#[async_trait]
pub trait ToolHandler: Send + Sync {
    fn kind(&self) -> ToolKind;
    fn matches_kind(&self, kind: ToolKind) -> bool;
    fn is_mutating(&self) -> bool;
    async fn handle(
        &self,
        invocation: ToolInvocation,
    ) -> std::result::Result<ToolOutput, FunctionCallError>;
}

pub struct ToolCall {
    pub name: String,
    pub payload: ToolPayload,
    pub source: ToolCallSource,
    pub raw_tool_call_id: Option<String>,
}

pub struct ToolSpec {
    pub name: String,
    pub input_schema: Value,
    pub output_schema: Value,
    pub supports_parallel_tool_calls: bool,
    pub timeout_ms: Option<u64>,
}

pub enum ToolCapability {
    ReadOnly,
    WritesFiles,
    ExecutesCode,
    Network,
    Sandboxable,
    RequiresApproval,
}

pub enum ApprovalRequirement {
    Auto,
    Suggest,
    Required,
}
```

---

## 4. TypeScript Agent 接口

定义于 `packages/core/src/`。

### 4.1 Agent 基类

```typescript
// packages/core/src/agent/Agent.ts

export interface AgentConfig {
  name: string
  description: string
  eventBus: EventBus
  memory: MemoryStore
  tools: ToolRegistry
  llm: LLMAdapter
  maxIterations?: number
  timeout?: number
  approvalFlow?: ApprovalFlow
  approvalStages?: LifecycleStage[]
  checkpointManager?: CheckpointManager
  enableCheckpoints?: boolean
  checkpointConfig?: CheckpointManagerConfig
}

export abstract class Agent<TInput = any, TOutput = any> {
  readonly name: string
  readonly description: string

  constructor(config: AgentConfig)

  // 生命周期钩子（子类可选覆盖）
  protected before?(input: TInput, context: ExecutionContext): Promise<void>
  protected init?(context: ExecutionContext): Promise<void>
  protected abstract plan(input: TInput, context: ExecutionContext): Promise<unknown>
  protected abstract act(plan: unknown, context: ExecutionContext): Promise<unknown>
  protected reflect?(result: unknown, context: ExecutionContext): Promise<unknown>
  protected after?(input: TInput, output: TOutput, context: ExecutionContext): Promise<void>

  // 执行
  async execute(input: TInput): Promise<TOutput>

  // 检查点恢复
  async resumeFromCheckpoint(
    checkpointId: string,
    executionId?: string
  ): Promise<{ checkpoint: Checkpoint; context: Record<string, unknown> }>

  // 工具访问
  getTools(): ToolRegistry
  getLlm(): LLMAdapter

  // 重置
  reset(): void
}
```

#### `KnowledgeEnhancedAgent`

```typescript
// packages/core/src/agent/KnowledgeEnhancedAgent.ts

export class KnowledgeEnhancedAgent extends Agent {
  knowledgeBase: KnowledgeBase
}
```

#### `ProfessionalAgent`

定义于 `packages/agents/base/src/ProfessionalAgent.ts`。

```typescript
export abstract class ProfessionalAgent {
  abstract act(input: any, context: AgentContext): Promise<any>
  async run(input: any): Promise<AgentResult>
  protected async callLLM(prompt: string): Promise<string>
}

export interface AgentResult {
  success: boolean
  data: any
  error?: string
  executionTime: number
  requiresHITL?: boolean
}
```

### 4.2 工具接口

```typescript
// packages/core/src/tools/EnhancedToolRegistry.ts

export class EnhancedToolRegistry {
  constructor(eventBus: EventBus)

  register<TInput, TOutput>(tool: EnhancedTool<TInput, TOutput>): void
  registerBatch(tools: EnhancedTool[]): void
  unregister(name: string): void

  async call<TInput, TOutput>(
    name: string,
    input: TInput,
    context: ToolContext
  ): Promise<TOutput>

  async callBatch<TInput, TOutput>(
    calls: Array<{ name: string; input: TInput }>,
    context: ToolContext
  ): Promise<TOutput[]>

  get(name: string): EnhancedTool | undefined
  has(name: string): boolean
  list(): EnhancedTool[]
  getByCategory(category: ToolCategory): EnhancedTool[]
  getByMcpServer(serverName: string): EnhancedTool[]
  size(): number
  clear(): void

  addMiddleware(middleware: any): void
  removeMiddleware(name: string): void
  getStats(): ToolExecutionStats[]
  getToolStats(toolName: string): ToolExecutionStats | undefined
}
```

#### `BaseTool`

```typescript
export abstract class BaseTool<TInput = any, TOutput = any> implements EnhancedTool<TInput, TOutput> {
  abstract readonly metadata: ToolMetadata<TInput, TOutput>
  abstract execute(input: TInput, context: ToolContext): Promise<TOutput>

  isReadOnly(_input: TInput): boolean
  isConcurrencySafe(_input: TInput): boolean
  isDestructive(_input: TInput): boolean
  async validateInput(_input: TInput): Promise<ToolValidationResult>
  async checkPermissions(_input: TInput, _context: ToolContext): Promise<PermissionResult>

  // 可选钩子
  async before?(input: TInput, context: ToolContext): Promise<void>
  async after?(output: TOutput, context: ToolContext): Promise<void>
}
```

#### `buildTool` 工厂函数

```typescript
export function buildTool<TInput = any, TOutput = any>(
  def: {
    metadata: ToolMetadata<TInput, TOutput>
    execute: (input: TInput, context: ToolContext) => Promise<TOutput>
    before?: (input: TInput, context: ToolContext) => Promise<void>
    after?: (output: TOutput, context: ToolContext) => Promise<void>
  } & Partial<Omit<EnhancedTool<TInput, TOutput>, 'metadata' | 'execute' | 'before' | 'after'>>
): EnhancedTool<TInput, TOutput>
```

### 4.3 LLM 适配器

```typescript
// packages/core/src/llm/NativeLLMAdapter.ts

export class NativeLLMAdapter implements LLMAdapter {
  constructor(config: ModelConfig)

  async chat(params: ChatParams): Promise<ChatResponse>
  async *chatStream(params: ChatParams): AsyncIterable<ChatChunk>
  async embed(texts: string[]): Promise<number[][]>
  switchModel(modelName: NativeModel | string): void
  getProvider(): ModelProvider
  getModel(): string
}

export class MultiModelManager {
  constructor(defaultModel?: NativeModel)
  registerModel(name: string, config: ModelConfig): void
  getAdapter(model?: string): NativeLLMAdapter
  selectModelForTask(taskType: 'code' | 'chat' | 'analysis'): string
  listModels(): string[]
}

// 工厂函数
export function createDeepSeekModel(
  apiKey: string,
  model?: NativeModel,
  options?: {
    thinking?: ThinkingConfig
    reasoningEffort?: ReasoningEffort
  }
): NativeLLMAdapter

export function createQwenModel(apiKey: string, model?: NativeModel): NativeLLMAdapter
export function createZhipuModel(apiKey: string, model?: NativeModel): NativeLLMAdapter
export function createOllamaModel(model?: string): NativeLLMAdapter
```

### 4.4 EventBus（智能体间通信）

```typescript
// packages/core/src/eventbus/EventBus.ts

export class EventBus {
  publish(event: AgentEvent): void
  subscribe(pattern: string, handler: EventHandler): Subscription
  async request(target: string, message: unknown, timeoutMs?: number): Promise<unknown>
}
```

---

## 5. MCP Server 工具接口

YunPat MCP Server 通过 Model Context Protocol 向外部客户端（如 Claude Desktop）暴露专利工具。

### 5.1 服务器信息

- **名称**：`yunpat-patent-tools`
- **版本**：`3.0.0`
- **传输**：stdio
- **二进制**：`packages/mcp-server/dist/index.js`

### 5.2 配置示例（Claude Desktop）

```json
{
  "mcpServers": {
    "yunpat": {
      "command": "node",
      "args": ["/path/to/packages/mcp-server/dist/index.js"]
    }
  }
}
```

### 5.3 工具列表

#### 1. `patent_search` — 专利检索

支持关键词、IPC 分类号、申请人等多维度检索。

**输入参数**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `inventionTitle` | string | 是 | 发明名称 |
| `claims` | string | 否 | 权利要求书 |
| `patentType` | string | 否 | 专利类型（发明/实用新型/外观设计） |
| `specification` | string | 否 | 说明书 |
| `searchOptions` | object | 否 | 检索选项（关键词、分类号、申请人等） |

#### 2. `claims_generator` — 权利要求生成

生成专利权利要求书，包括独立权利要求和从属权利要求。

**输入参数**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `technicalField` | string | 是 | 技术领域 |
| `technicalProblem` | string | 是 | 技术问题 |
| `technicalSolution` | string | 是 | 技术方案 |
| `beneficialEffects` | string | 是 | 有益效果 |
| `keyFeatures` | string[] | 是 | 关键特征列表 |
| `patentType` | string | 否 | 专利类型 |
| `enableDependentClaims` | boolean | 否 | 是否生成从属权利要求 |
| `dependentClaimCount` | number | 否 | 从属权利要求数量 |

#### 3. `quality_checker` — 质量评估

检查专利申请文件的质量。

**输入参数**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `inventionTitle` | string | 是 | 发明名称 |
| `claims` | string | 是 | 权利要求书 |
| `specification` | string | 是 | 说明书 |
| `patentType` | string | 否 | 专利类型 |
| `checkLevel` | number | 否 | 检查级别（1-3） |

#### 4. `legal_knowledge_search` — 法律知识搜索

搜索专利法律法规、审查指南、案例等法律知识。

**输入参数**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `query` | string | 是 | 搜索查询 |
| `category` | string | 否 | 知识类别 |

#### 5. `invalid_decision_search` — 复审无效决定检索

检索专利复审和无效宣告决定。

**输入参数**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `query` | string | 是 | 检索查询 |
| `patentNumber` | string | 否 | 专利号 |

#### 6. `patent_rule_search` — 专利规则搜索

搜索专利审查规则、指南和实务规范。

**输入参数**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `query` | string | 是 | 搜索查询 |

#### 7. `project_scan` — 项目扫描

扫描代码项目，识别可专利化的技术方案。

**输入参数**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `projectPath` | string | 是 | 项目路径 |
| `scanDepth` | number | 否 | 扫描深度 |

#### 8. `patent_dispatch` — 专利任务分发

将专利相关任务分发给最合适的专业 Agent。

**输入参数**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `taskType` | string | 是 | 任务类型 |
| `taskData` | object | 是 | 任务数据 |

#### 9. `patent_writer` — 专利撰写

执行完整的专利撰写工作流。

**输入参数**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `title` | string | 是 | 发明标题 |
| `technicalField` | string | 是 | 技术领域 |
| `technicalProblem` | string | 是 | 技术问题 |
| `technicalSolution` | string | 是 | 技术方案 |
| `beneficialEffects` | string | 是 | 有益效果 |

#### 10. `patent_compare` — 专利对比分析

对比分析两件或多件专利的技术特征。

**输入参数**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `targetPatent` | object | 是 | 目标专利 |
| `comparisonPatents` | object[] | 是 | 对比专利列表 |
| `analysisType` | string | 否 | 分析类型 |

### 5.4 数据主权保护（CON-01）

所有 MCP 工具在执行前会自动进行数据主权检测。如果输入内容被识别为技术交底书等敏感信息，工具将拒绝发送到外部 API，并返回提示信息。

**检测行为**：

- 命中 `CON-01` 规则且路由为 `local`：返回错误，提示用户配置本地模型
- 命中 `CON-01B` 规则：记录日志，继续执行但提示内容需抽象化
- 未命中：正常执行

---

## 6. 数据主权检测 API

定义于 `packages/core/src/constitutional/`。

### 6.1 `detectTechnicalDisclosure`

检测输入内容是否包含技术交底书等敏感信息。

```typescript
import { detectTechnicalDisclosure } from '@yunpat/core'

const result = detectTechnicalDisclosure(content: string): SovereigntyCheckResult
```

**返回类型**：

```typescript
interface SovereigntyCheckResult {
  isViolation: boolean      // 是否违规
  isSensitive: boolean      // 是否包含敏感内容
  rule: string              // 触发的规则 ID
  confidence: number        // 置信度（0-1）
  routing: 'local' | 'cloud' // 建议路由
  reason: string            // 原因说明
  ruleId: string            // 规则编号
}
```

### 6.2 `ConstitutionalAI`

完整的 Constitutional AI 合规检查系统。

```typescript
import { ConstitutionalAI, PATENT_PRINCIPLES } from '@yunpat/core'

const constitutionalAI = new ConstitutionalAI({
  principles: PATENT_PRINCIPLES,
  autoCorrect: true,
})

const report = await constitutionalAI.check(input: string)
```

**返回类型**：

```typescript
interface ComplianceReport {
  violations: Violation[]
  warnings: Warning[]
  corrections: AppliedCorrection[]
  overallScore: number
}
```

### 6.3 `ComplianceChecker`

独立的合规检查器。

```typescript
import { ComplianceChecker } from '@yunpat/core'

const checker = new ComplianceChecker()
const result = await checker.check(input, principles)
```

---

## 附录 A：类型定义速查

### Rust 核心类型

```rust
// Thread
pub struct Thread {
    pub id: String,
    pub preview: String,
    pub ephemeral: bool,
    pub model_provider: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub status: ThreadStatus,
    pub path: Option<String>,
    pub cwd: PathBuf,
    pub cli_version: String,
    pub source: SessionSource,
    pub name: Option<String>,
}

pub enum ThreadStatus {
    Running,
    Idle,
    Completed,
    Failed,
    Paused,
    Archived,
}

// JobRecord
pub struct JobRecord {
    pub id: String,
    pub name: String,
    pub status: JobStatus,
    pub progress: Option<u8>,
    pub detail: Option<String>,
    pub retry: JobRetryMetadata,
    pub history: Vec<JobHistoryEntry>,
    pub created_at: i64,
    pub updated_at: i64,
}
```

### TypeScript 核心类型

```typescript
// ChatParams
interface ChatParams {
  messages: ChatMessage[]
  temperature?: number
  maxTokens?: number
  timeout?: number
}

// ChatResponse
interface ChatResponse {
  message: {
    role: string
    content: string
  }
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

// ToolMetadata
interface ToolMetadata<TInput = any, TOutput = any> {
  name: string
  description: string
  inputSchema: z.ZodSchema<TInput>
  outputSchema?: z.ZodSchema<TOutput>
  category?: ToolCategory
  isMcp?: boolean
  mcpServer?: string
  isConcurrencySafe?: boolean
  maxResultSizeChars?: number
}

// ExecutionContext
interface ExecutionContext {
  executionId: string
  agentName: string
  startTime: Date
  currentStage: LifecycleStage
  memory: MemoryStore
  eventBus: EventBus
  tools: ToolRegistry
  llm: LLMAdapter
  metadata: Record<string, unknown>
  sharedState: Map<string, unknown>
}
```

---

## 附录 B：错误码

### JSON-RPC 标准错误码

| 错误码 | 含义 | 说明 |
|--------|------|------|
| -32700 | Parse error | JSON 解析失败 |
| -32600 | Invalid Request | 无效请求 |
| -32601 | Method not found | 方法不存在 |
| -32602 | Invalid params | 参数无效 |
| -32603 | Internal error | 内部错误 |

### HTTP 状态码

| 状态码 | 说明 |
|--------|------|
| 200 | 请求成功 |
| 400 | 请求参数错误 |
| 500 | 服务器内部错误 |

### Tool 错误类型（Rust）

| 错误变体 | 说明 |
|----------|------|
| `InvalidInput` | 输入验证失败 |
| `MissingField` | 缺少必填字段 |
| `PathEscape` | 路径越界 |
| `ExecutionFailed` | 执行失败 |
| `Timeout` | 执行超时 |
| `NotAvailable` | 工具不可用 |
| `PermissionDenied` | 权限不足 |

---

## 附录 C：环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥 | - |
| `OPENAI_API_KEY` | OpenAI API 密钥（备选） | - |
| `DEEPSEEK_BASE_URL` | DeepSeek API 基础 URL | `https://api.deepseek.com` |
| `OLLAMA_BASE_URL` | Ollama 本地服务地址 | `http://localhost:11434/v1` |
| `DATABASE_URL` | PostgreSQL 连接字符串 | - |
| `KNOWLEDGE_BASE_PATH` | 知识库路径 | `./knowledge-base` |
| `PROMPT_TEMPLATES_DIR` | 提示词模板目录 | `./prompts/patent-drafting` |

---

> 本文档基于代码仓库当前状态编写。API 可能随版本迭代发生变化，建议通过源码中的类型定义确认最新接口。
