# Bridge Optimization Plan — 借鉴 ZeroClaw 高价值设计

## 目标

借鉴 BCIP/ZeroClaw 的核心桥接设计，优化 YunPat 的 Rust↔TS 通信层。

## 范围

| Phase | 优先级 | 任务 | 借鉴来源 |
|-------|--------|------|---------|
| A | P0 | MCP Transport trait 抽象 + async stdio 传输 | ZeroClaw `mcp_transport.rs` |
| B | P0 | Server Supervisor（心跳 + 自动重启） | ZeroClaw `WebSocketClient` 指数退避 |
| C | P0 | 请求多路复用（并发工具调用） | ZeroClaw `mcp_client.rs` ID 匹配 |
| D | P2 | Provider Capability-driven 降级 | ZeroClaw `Provider` trait default cascade |

---

## Phase A: MCP Transport Trait 抽象

### A-1: 定义 `McpTransport` trait

**文件**: `crates/crates/mcp/src/transport.rs`（新建）

```rust
#[async_trait]
pub trait McpTransport: Send + Sync {
    async fn send_request(&self, id: u64, method: &str, params: Value) -> Result<Value>;
    async fn close(&mut self) -> Result<()>;
    fn is_connected(&self) -> bool;
}
```

**验证**: `cargo check -p yunpat-mcp`

### A-2: 实现 `StdioTransport`

**文件**: `crates/crates/mcp/src/stdio_transport.rs`（新建）

基于现有 `yunpat-mcp-bridge/src/bridge.rs` 的 `ServerHandle::call()` 逻辑，提取为独立的 transport 实现：
- spawn 子进程（`Command::new` + stdin/stdout pipes）
- `\n`-delimited JSON-RPC 帧
- `initialize` 握手
- 支持 `kill_on_drop`

**验证**: `cargo test -p yunpat-mcp`

### A-3: 重构 `McpManagedClient` 为 async

**文件**: `crates/crates/mcp/src/lib.rs`

当前 `McpManagedClient` 是同步 trait（`fn call_tool`），需改为 async：

```rust
#[async_trait]
pub trait McpManagedClient: Send + Sync {
    async fn list_tools(&self) -> Result<Vec<McpToolDescriptor>>;
    async fn call_tool(&self, tool_name: &str, arguments: Value) -> Result<Value>;
    async fn list_resources(&self) -> Result<Vec<McpResourceDescriptor>>;
    async fn read_resource(&self, uri: &str) -> Result<Value>;
}
```

**影响范围**:
- `McpManager` 的所有方法改为 async
- `app-server` crate 中的调用点需加 `.await`
- `InMemoryMcpClient` 实现加 `async`

**验证**: `cargo check --workspace`

### A-4: 重构 `yunpat-mcp-bridge` 使用 transport

**文件**: `crates/crates/yunpat-mcp-bridge/src/bridge.rs`

- `ServerHandle` 持有 `Box<dyn McpTransport>` 而非直接持有 stdin/stdout
- `MCPBridge::start_server()` 创建 `StdioTransport` 并传入
- 删除 `ServerHandle` 中的 `stdin_writer` / `stdout_reader` 字段

**验证**: `cargo test -p yunpat-mcp-bridge`

### 检查清单 A

- [ ] `McpTransport` trait 定义在 `crates/crates/mcp/src/transport.rs`
- [ ] `StdioTransport` 实现在 `crates/crates/mcp/src/stdio_transport.rs`
- [ ] `McpManagedClient` 改为 async trait
- [ ] `McpManager` 方法改为 async
- [ ] `InMemoryMcpClient` 适配 async
- [ ] `app-server` 调用点适配 `.await`
- [ ] `yunpat-mcp-bridge` 使用 transport 抽象
- [ ] `cargo check --workspace` 通过
- [ ] `cargo test -p yunpat-mcp` 通过
- [ ] `cargo test -p yunpat-mcp-bridge` 通过

---

## Phase B: Server Supervisor（心跳 + 自动重启）

### B-1: 定义 `SupervisedServer`

**文件**: `crates/crates/yunpat-mcp-bridge/src/supervisor.rs`（新建）

```rust
pub struct SupervisedServer {
    config: McpServerStartConfig,
    server_id: String,
    handle: Option<Arc<ServerHandle>>,
    health_interval: Duration,     // 默认 30s
    max_restart_attempts: u32,     // 默认 3
    restart_delay_base: Duration,  // 默认 1s，指数退避
}
```

方法：
- `start()` — spawn 进程 + 启动心跳 task
- `stop()` — 停止心跳 + 关闭进程
- `restart()` — 关闭旧进程 + 重新 spawn + initialize
- `health_loop()` — tokio::spawn 的循环：`healthz` → 失败则 restart
- `get_handle()` — 获取当前 `Arc<ServerHandle>`

**验证**: `cargo check -p yunpat-mcp-bridge`

### B-2: 心跳检测

心跳 task 每 30s 发送 `healthz` RPC：
- 连续 2 次失败 → 标记为 unhealthy
- unhealthy → 触发 restart（指数退避：1s, 2s, 4s, 最大 30s）
- 超过 `max_restart_attempts` → 标记为 dead，通知上层

**验证**: 单元测试模拟子进程死亡 + 自动恢复

### B-3: 重构 `McpAgentAdapter` 使用 supervisor

**文件**: `crates/crates/yunpat-mcp-bridge/src/agent_adapter.rs`

- `server_handle` 字段改为 `Option<Arc<SupervisedServer>>`
- `execute()` 从 supervisor 获取当前 handle（可能因重启而变化）
- 移除直接的 `ServerHandle` 依赖

**验证**: `cargo test -p yunpat-mcp-bridge`

### 检查清单 B

- [ ] `SupervisedServer` 结构体定义
- [ ] 心跳 task（30s interval healthz）
- [ ] 自动重启（指数退避，最大 3 次）
- [ ] `McpAgentAdapter` 使用 `SupervisedServer`
- [ ] 重启时 `initialize` 握手自动完成
- [ ] `cargo check --workspace` 通过
- [ ] 心跳失败 → 自动重启的测试
- [ ] 超过最大重启次数的测试

---

## Phase C: 请求多路复用

### C-1: ID 匹配的请求-响应关联

**问题**: 当前 `ServerHandle::call()` write-then-read 严格串行——写一个请求后必须读完响应才能发下一个。

**方案**: 使用 `tokio::sync::mpsc` + `tokio::sync::oneshot` 实现多路复用：

```rust
pub struct MultiplexedTransport {
    pending: Arc<Mutex<HashMap<u64, oneshot::Sender<Result<Value>>>>>,
    writer_tx: mpsc::Sender<String>,
}
```

- 写入端：通过 `mpsc::Sender` 发送序列化的 JSON-RPC 行（多 task 可并发发送）
- 读取端：单独的 tokio::task 循环读取 stdout，按 `id` 分发到对应的 `oneshot::Sender`
- 每个调用者通过 `oneshot::Receiver` 等待自己的响应

**文件**: `crates/crates/mcp/src/multiplexed.rs`（新建）

### C-2: 集成到 `StdioTransport`

- `StdioTransport` 内部使用 `MultiplexedTransport`
- spawn 读取 task 在构造时
- `send_request()` 通过 channel 发送并等待 oneshot

**验证**: 并发调用测试（spawn 10 个并发 `tools/call`，验证全部成功）

### C-3: `McpManager` 支持并发调用

- `call_tool()` 可被多个 task 并发调用
- `list_tools()` 同理

**验证**: `cargo test -p yunpat-mcp`

### 检查清单 C

- [ ] `MultiplexedTransport` 实现（mpsc + oneshot + 读取 task）
- [ ] `StdioTransport` 内部使用多路复用
- [ ] 并发 `send_request()` 不会串响应
- [ ] 读取 task 处理 notification（无 id 的消息）
- [ ] 读取 task 在子进程退出时优雅结束
- [ ] `cargo check --workspace` 通过
- [ ] 并发调用测试通过

---

## Phase D: Provider Capability-driven 降级

### D-1: 定义 `ProviderCapabilities`

**文件**: `crates/crates/yunpat-models/src/capabilities.rs`（新建）

```rust
#[derive(Debug, Clone, Default)]
pub struct ProviderCapabilities {
    pub native_tool_calling: bool,   // 默认 true（OpenAI-compatible）
    pub streaming: bool,             // 默认 true
    pub vision: bool,                // 默认 false
    pub prompt_caching: bool,        // 默认 false
    pub max_context_tokens: usize,   // 默认 128000
}
```

### D-2: `ModelProvider` trait 加 capability 查询

```rust
pub trait ModelProvider: Send + Sync {
    fn capabilities(&self) -> &ProviderCapabilities;
    // ... 现有方法保持不变
}
```

### D-3: 工具调用降级

当 `native_tool_calling == false` 时，将工具描述注入 system prompt，解析文本中的工具调用。

**验证**: `cargo check --workspace`

### 检查清单 D

- [ ] `ProviderCapabilities` 结构体定义
- [ ] `ModelProvider` trait 加 `capabilities()` 方法
- [ ] 各 Provider 实现（DeepSeek, OpenAI, Zhipu 等）返回正确的 capabilities
- [ ] `cargo check --workspace` 通过

---

## 实施顺序

```
Phase A (transport trait) → Phase C (multiplexing) → Phase B (supervisor) → Phase D (capabilities)
```

理由：
1. A 是基础——所有后续改进都依赖 transport 抽象
2. C 依赖 A 的 transport trait，在 transport 层实现多路复用
3. B 依赖 A+C——supervisor 管理的是 multiplexed transport
4. D 独立，可在任意阶段实施

## 风险评估

| 风险 | 影响 | 缓解 |
|------|------|------|
| async trait 重构影响范围大 | app-server 等调用点需改 | 逐步迁移，保持同步版本兼容 |
| 多路复用引入并发 bug | 响应串台 | 严格 ID 匹配 + 并发测试 |
| 心跳误判导致不必要重启 | 用户体验中断 | 连续 2 次失败才触发 + 指数退避 |
| TS MCP Server 不支持并发 | Rust 侧多路复用无用 | TS 侧 `StdioServerTransport` 本身是串行的——需要测试 |

## 不在本计划范围内

- 统一 Gateway（P1，涉及架构重构，单独规划）
- WebSocket 审批流（P1，依赖统一 Gateway）
- WASM 插件系统（P3，未来扩展）
- 30+ 消息渠道、硬件桥接、Tauri 封装
