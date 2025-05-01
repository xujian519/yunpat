# YunPat Protobuf 接口定义

## 概述

本目录包含 YunPat 框架的 gRPC/Protobuf 接口定义，实现**语言无关**的智能体通信。

## 设计原则

1. **接口优先**: 无论内部用什么语言，智能体间通信使用 gRPC/Protobuf
2. **语言无关**: 支持 TypeScript、Rust、Python 等多语言实现
3. **版本兼容**: 使用 Protobuf 保证向后兼容性
4. **类型安全**: 强类型定义，减少运行时错误

## 文件结构

```
protos/
├── common.proto       # 通用类型定义
├── agent.proto        # Agent 服务定义
├── vector.proto       # 向量检索服务定义
├── scheduler.proto    # 任务调度服务定义
├── tools.proto        # 工具调用服务定义
└── README.md          # 本文档
```

## 服务架构

```
┌─────────────────────────────────────────────────────────┐
│  TypeScript (编排层)                                    │
│  - AgentService (agent.proto)                          │
│  - HTTP/WebSocket 服务                                  │
└────────────────────┬────────────────────────────────────┘
                     │ gRPC
┌────────────────────▼────────────────────────────────────┐
│  Rust (核心引擎)                                        │
│  - VectorService (vector.proto)                        │
│  - SchedulerService (scheduler.proto)                  │
└────────────────────┬────────────────────────────────────┘
                     │ gRPC
┌────────────────────▼────────────────────────────────────┐
│  Python (工具容器)                                      │
│  - PythonToolsService (tools.proto)                   │
└─────────────────────────────────────────────────────────┘
```

## 接口说明

### 1. Agent Service (agent.proto)

**职责**: Agent 协调与事件路由

**核心方法**:

- `ExecuteAgent`: 执行 Agent 任务
- `StreamExecuteAgent`: 流式执行（实时反馈）
- `GetAgentStatus`: 获取 Agent 状态
- `CancelAgent`: 取消执行

**实现语言**: TypeScript

---

### 2. Vector Service (vector.proto)

**职责**: 高性能向量检索

**核心方法**:

- `AddVector`: 添加向量
- `Search`: 搜索相似向量
- `DeleteVector`: 删除向量
- `GetIndexStats`: 获取索引统计

**实现语言**: Rust

**性能指标**:

- QPS > 10k
- P99 延迟 < 10ms

---

### 3. Scheduler Service (scheduler.proto)

**职责**: 任务调度与队列管理

**核心方法**:

- `SubmitTask`: 提交任务
- `GetTaskResult`: 获取任务结果
- `CancelTask`: 取消任务
- `GetQueueStatus`: 获取队列状态

**实现语言**: Rust

**特性**:

- 优先级队列（4 级）
- 超时管理
- 自动重试

---

### 4. Python Tools Service (tools.proto)

**职责**: ML 模型推理、数据分析

**核心方法**:

- `ExecuteTool`: 执行工具
- `ExecuteTools`: 批量执行工具
- `ListTools`: 列出可用工具
- `HealthCheck`: 健康检查

**实现语言**: Python

**限制**:

- 最多 2 核 CPU
- 最多 4GB 内存
- 最多 10 并发请求

---

## 使用示例

### TypeScript 客户端

```typescript
import * as grpc from '@grpc/grpc-js'
import * as protoLoader from '@grpc/proto-loader'

const PROTO_PATH = __dirname + '/protos/agent.proto'
const packageDefinition = protoLoader.loadSync(PROTO_PATH)
const agentProto = grpc.loadPackageDefinition(packageDefinition).yunpat.agent

const client = new agentProto.AgentService('localhost:50051', grpc.credentials.createInsecure())

const response = await client.executeAgent({
  agent_name: 'writer',
  agent_id: 'writer-001',
  input: { task: 'Write a document' },
  config: {
    timeout_ms: 30000,
    max_iterations: 10,
  },
})
```

### Rust 客户端

```rust
use yunpat::agent::agent_service_client::AgentServiceClient;
use yunpat::agent::ExecuteAgentRequest;

let mut client = AgentServiceClient::connect("http://[::1]:50051").await?;

let request = tonic::Request::new(ExecuteAgentRequest {
    agent_name: "writer".to_string(),
    agent_id: "writer-001".to_string(),
    input: vec![("task".to_string(), "Write a document".to_string())].into_iter().collect(),
    config: None,
});

let response = client.execute_agent(request).await?;
```

### Python 客户端

```python
import grpc
from protos import agent_pb2, agent_pb2_grpc

channel = grpc.insecure_channel('localhost:50051')
stub = agent_pb2_grpc.AgentServiceStub(channel)

request = agent_pb2.ExecuteAgentRequest(
    agent_name='writer',
    agent_id='writer-001',
    input={'task': 'Write a document'},
)

response = stub.ExecuteAgent(request)
```

---

## 代码生成

### TypeScript

```bash
# 安装依赖
pnpm add @grpc/grpc-js @grpc/proto-loader ts-proto

# 生成类型
npx ts-proto --protoPath=protos --outputDir=src/generated
```

### Rust

```bash
# 添加依赖
cargo add prost tonic tonic-build

# 构建（build.rs 自动生成）
cargo build
```

### Python

```bash
# 安装依赖
pip install grpcio-tools grpcio

# 生成代码
python -m grpc_tools.protoc -Iprotos \
  --python_out=. \
  --grpc_python_out=. \
  protos/*.proto
```

---

## 版本管理

### 版本号规则

- **Major (v1.x)**: 不兼容的 API 变更
- **Minor (v1.x)**: 向后兼容的功能新增
- **Patch (v1.0.x)**: 向后兼容的问题修复

### 变更流程

1. 修改 `.proto` 文件
2. 更新版本号（如 `v1.1.0`）
3. 重新生成代码
4. 更新所有实现
5. 测试兼容性

---

## 性能基准

| 服务               | QPS | P99 延迟 | 实现       |
| ------------------ | --- | -------- | ---------- |
| AgentService       | 1k  | 50ms     | TypeScript |
| VectorService      | 10k | 10ms     | Rust       |
| SchedulerService   | 50k | 5ms      | Rust       |
| PythonToolsService | 100 | 500ms    | Python     |

---

## 相关文档

- [Protobuf 语言指南](https://protobuf.dev/programming-guides/proto3/)
- [gRPC 概念](https://grpc.io/docs/what-is-grpc/)
- [Tonic (Rust gRPC)](https://github.com/hyperium/tonic)

---

**维护者**: YunPat 团队
**最后更新**: 2026-04-28
