# YunPat 多语言架构迁移计划

**日期**: 2026-04-28
**方案**: TypeScript + Rust + Python（隔离）
**时间表**: 6 个月

---

## 🎯 架构目标

### 三层架构设计

```
┌─────────────────────────────────────────────────────────┐
│  Layer 1: 编排层 (TypeScript - 70%)                    │
│  - Agent 协调与事件路由                                 │
│  - HTTP/WebSocket 服务                                  │
│  - 提示词工程与结果聚合                                 │
└────────────────────┬────────────────────────────────────┘
                     │ gRPC/Protobuf
┌────────────────────▼────────────────────────────────────┐
│  Layer 2: 核心引擎层 (Rust - 30%)                      │
│  - 高性能向量检索 (HNSW)                                │
│  - 任务调度与队列管理                                   │
│  - 高性能事件总线                                       │
│  - 缓存层                                               │
└────────────────────┬────────────────────────────────────┘
                     │ gRPC/Protobuf
┌────────────────────▼────────────────────────────────────┐
│  Layer 3: 工具提供者层 (Python - 隔离)                 │
│  - ML 模型推理 (PyTorch、TF)                            │
│  - 数据分析 (pandas、numpy)                             │
│  - 容器化部署，限制资源                                 │
└─────────────────────────────────────────────────────────┘
```

---

## 📅 阶段 1：基础设施（第 1-2 月）

### 目标

建立 gRPC/Protobuf 接口标准，完成 PoC 验证

### 任务清单

#### 1.1 定义 Protobuf 接口（1 周）

**文件结构**:

```
protos/
├── agent.proto              # Agent 服务
├── llm.proto                # LLM 服务
├── vector.proto             # 向量检索服务
├── scheduler.proto          # 任务调度服务
├── tools.proto              # 工具调用服务
├── common.proto             # 通用类型
└── README.md                # 接口文档
```

**示例: agent.proto**:

```protobuf
syntax = "proto3";

package yunpat.agent;

service AgentService {
  rpc ExecuteAgent(ExecuteAgentRequest) returns (ExecuteAgentResponse);
  rpc StreamExecuteAgent(ExecuteAgentRequest) returns (stream AgentProgress);
  rpc GetAgentStatus(GetAgentStatusRequest) returns (GetAgentStatusResponse);
}

message ExecuteAgentRequest {
  string agent_name = 1;
  string agent_id = 2;
  map<string, string> input = 3;
  ExecutionConfig config = 4;
}

message ExecuteAgentResponse {
  bool success = 1;
  map<string, string> output = 2;
  ExecutionMetrics metrics = 3;
  string error_message = 4;
}

message ExecutionConfig {
  int32 timeout_ms = 1;
  int32 max_iterations = 2;
  bool enable_tracing = 3;
  map<string, string> metadata = 4;
}

message ExecutionMetrics {
  int64 duration_ms = 1;
  int32 total_tokens = 2;
  int32 llm_calls = 3;
  int32 tool_calls = 4;
}
```

#### 1.2 TypeScript gRPC Server（1 周）

**安装依赖**:

```bash
pnpm add @grpc/grpc-js @grpc/proto-loader
```

**实现示例**:

```typescript
// packages/grpc-server/src/AgentServer.ts
import * as grpc from '@grpc/grpc-js'
import * as protoLoader from '@grpc/proto-loader'

const PROTO_PATH = __dirname + '/../../../protos/agent.proto'

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
})

const agentProto = grpc.loadPackageDefinition(packageDefinition).yunpat.agent

export class AgentServer {
  private server: grpc.Server

  constructor() {
    this.server = new grpc.Server()
    this.server.addService(agentProto.AgentService.service, {
      executeAgent: this.executeAgent.bind(this),
      streamExecuteAgent: this.streamExecuteAgent.bind(this),
      getAgentStatus: this.getAgentStatus.bind(this),
    })
  }

  async executeAgent(call: grpc.ServerUnaryCall<any, any>, callback: grpc.requestCallback<any>) {
    const request = call.request

    try {
      // 调用 TypeScript Agent
      const result = await this.runAgent(request)

      callback(null, {
        success: true,
        output: result.output,
        metrics: result.metrics,
      })
    } catch (error) {
      callback({
        code: grpc.status.INTERNAL,
        details: error.message,
      })
    }
  }

  async streamExecuteAgent(call: grpc.ServerWritableStream<any, any>) {
    const request = call.request

    try {
      // 流式执行 Agent
      for await (const progress of this.runAgentStream(request)) {
        call.write(progress)
      }

      call.end()
    } catch (error) {
      call.emit('error', {
        code: grpc.status.INTERNAL,
        details: error.message,
      })
    }
  }

  async getAgentStatus(call: grpc.ServerUnaryCall<any, any>, callback: grpc.requestCallback<any>) {
    // 实现 Agent 状态查询
    callback(null, {
      status: 'running',
      uptime: Date.now() - this.startTime,
    })
  }

  start(port: number) {
    this.server.bindAsync(`0.0.0.0:${port}`, grpc.ServerCredentials.createInsecure(), () => {
      console.log(`Agent gRPC Server started on port ${port}`)
    })
  }

  private async runAgent(request: any): Promise<any> {
    // 调用现有 Agent 实现
    // TODO: 集成到现有 Agent
    return {
      output: { result: 'success' },
      metrics: {
        duration_ms: 1000,
        total_tokens: 100,
        llm_calls: 1,
        tool_calls: 0,
      },
    }
  }

  private async *runAgentStream(request: any) {
    yield { stage: 'plan', progress: 25 }
    yield { stage: 'act', progress: 50 }
    yield { stage: 'reflect', progress: 75 }
    yield { stage: 'complete', progress: 100 }
  }
}
```

#### 1.3 性能基准测试（1 周）

**测试脚本**:

```typescript
// benchmarks/grpc-vs-rest.mjs
import { AgentServer } from '@yunpat/grpc-server'
import fetch from 'node-fetch'

async function benchmarkRest() {
  const start = Date.now()

  for (let i = 0; i < 1000; i++) {
    await fetch('http://localhost:3000/api/agent/execute', {
      method: 'POST',
      body: JSON.stringify({ task: 'test' }),
    })
  }

  return Date.now() - start
}

async function benchmarkGrpc() {
  const start = Date.now()

  for (let i = 0; i < 1000; i++) {
    // gRPC 调用
    await agentClient.executeAgent({ task: 'test' })
  }

  return Date.now() - start
}

console.log('REST:', await benchmarkRest(), 'ms')
console.log('gRPC:', await benchmarkGrpc(), 'ms')
```

#### 1.4 Rust PoC（2 周）

**创建 Rust 项目**:

```bash
cargo new --lib rust/vector-service
cd rust/vector-service
cargo add tokio tonic prost async-trait
```

**实现向量检索服务**:

```rust
// rust/vector-service/src/main.rs
use tonic::transport::Server;
use vector_service::vector_server::{VectorServer, Vector as Vector};
use vector_service::{SearchRequest, SearchResponse, Vector as VectorProto};

pub mod vector {
    tonic::include_proto!("yunpat.vector");
}

#[derive(Debug, Default)]
pub struct VectorService {
    // 存储向量数据
    vectors: std::collections::HashMap<String, Vec<f32>>,
}

#[tonic::async_trait]
impl Vector for VectorService {
    async fn search(
        &self,
        request: tonic::Request<SearchRequest>,
    ) -> Result<tonic::Response<SearchResponse>, tonic::Status> {
        let req = request.into_inner();

        // 简单的余弦相似度计算
        let mut results = Vec::new();

        for (id, vector) in &self.vectors {
            let similarity = cosine_similarity(&req.query_vector, vector);
            if similarity > 0.8 {
                results.push((id.clone(), similarity));
            }
        }

        results.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());

        Ok(tonic::Response::new(SearchResponse {
            results: results.into_iter()
                .take(req.top_k as usize)
                .map(|(id, score)| vector_service::SearchResult {
                    id,
                    score,
                })
                .collect(),
        }))
    }
}

fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    let dot_product: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
    let norm_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
    let norm_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();
    dot_product / (norm_a * norm_b)
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let addr = "[::1]:50051".parse()?;
    let vector_service = VectorService::default();

    Server::builder()
        .add_service(VectorServer::new(vector_service))
        .serve(addr)
        .await?;

    Ok(())
}
```

### 阶段 1 产出

- ✅ Protobuf 接口定义（6 个文件）
- ✅ TypeScript gRPC Server 示例
- ✅ Rust 向量检索服务 PoC
- ✅ 性能基准测试报告

---

## 📅 阶段 2：核心迁移（第 3-4 月）

### 目标

迁移核心引擎到 Rust，建立 Python 工具容器

### 任务清单

#### 2.1 Rust 向量检索服务（3 周）

**实现 HNSW 算法**:

```rust
// rust/vector-service/src/hnsw.rs
use std::collections::{HashMap, HashSet};

pub struct HNSWIndex {
    layers: Vec<Layer>,
    ef_construction: usize,
    m: usize,
}

struct Layer {
    nodes: HashMap<NodeId, Node>,
    connections: HashMap<NodeId, Vec<NodeId>>,
}

impl HNSWIndex {
    pub fn new(ef_construction: usize, m: usize) -> Self {
        HNSWIndex {
            layers: vec![Layer::new()],
            ef_construction,
            m,
        }
    }

    pub fn insert(&mut self, id: String, vector: Vec<f32>) {
        // 实现 HNSW 插入算法
        // 1. 选择最顶层
        // 2. 贪心搜索最近邻
        // 3. 在每一层插入连接
    }

    pub fn search(&self, query: &[f32], k: usize) -> Vec<(String, f32)> {
        // 实现 HNSW 搜索算法
        // 1. 从最顶层开始
        // 2. 贪心搜索到最底层
        // 3. 返回 top-k 结果
        Vec::new()
    }
}
```

#### 2.2 Rust 任务调度服务（3 周）

**实现任务队列**:

```rust
// rust/scheduler-service/src/scheduler.rs
use std::collections::{HashMap, VecDeque};
use std::time::Duration;

pub struct TaskScheduler {
    queues: HashMap<Priority, VecDeque<Task>>,
    workers: Vec<Worker>,
    max_concurrent: usize,
}

pub enum Priority {
    High,
    Medium,
    Low,
}

pub struct Task {
    id: String,
    payload: Vec<u8>,
    priority: Priority,
    timeout: Duration,
}

#[tonic::async_trait]
impl Scheduler for TaskScheduler {
    async fn submit_task(
        &self,
        request: tonic::Request<SubmitTaskRequest>,
    ) -> Result<tonic::Response<SubmitTaskResponse>, tonic::Status> {
        let req = request.into_inner();

        let task = Task {
            id: uuid::Uuid::new_v4().to_string(),
            payload: req.payload,
            priority: req.priority.unwrap_or(Priority::Medium),
            timeout: Duration::from_millis(req.timeout_ms as u64),
        };

        self.queues.get_mut(&task.priority).unwrap().push_back(task);

        Ok(tonic::Response::new(SubmitTaskResponse {
            task_id: task.id,
        }))
    }

    async fn get_task_result(
        &self,
        request: tonic::Request<GetTaskResultRequest>,
    ) -> Result<tonic::Response<GetTaskResultResponse>, tonic::Status> {
        // 查询任务结果
    }
}
```

#### 2.3 Python 工具容器（2 周）

**Dockerfile**:

```dockerfile
# docker/python-tools/Dockerfile
FROM python:3.11-slim

WORKDIR /app

# 安装依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制代码
COPY yunpat_python /app/yunpat_python

# 只暴露 gRPC 端口
EXPOSE 50052

# 启动 gRPC 服务
CMD ["python", "-m", "yunpat_python.tools_server"]
```

**requirements.txt**:

```
grpcio==1.60.0
protobuf==4.25.1
torch==2.1.0
transformers==4.35.0
pandas==2.1.3
numpy==1.26.2
scikit-learn==1.3.2
```

**Python gRPC Server**:

```python
# yunpat_python/tools_server.py
import grpc
from concurrent import futures
import torch
from transformers import AutoTokenizer, AutoModel

import tools_pb2
import tools_pb2_grpc

class PythonToolsService(tools_pb2_grpc.PythonToolsServicer):
    def __init__(self):
        # 加载 ML 模型
        self.tokenizer = AutoTokenizer.from_pretrained('bert-base-uncased')
        self.model = AutoModel.from_pretrained('bert-base-uncased')

    def ExecuteTool(self, request, context):
        tool_name = request.tool_name
        args = request.args

        if tool_name == 'embed_text':
            # 文本嵌入
            return self.embed_text(args)
        elif tool_name == 'classify_text':
            # 文本分类
            return self.classify_text(args)
        else:
            context.set_code(grpc.StatusCode.NOT_FOUND)
            context.set_details(f'Tool {tool_name} not found')
            return tools_pb2.ToolResponse()

    def embed_text(self, args):
        text = args.get('text', '')

        # 使用 BERT 生成嵌入
        inputs = self.tokenizer(text, return_tensors='pt')
        with torch.no_grad():
            outputs = self.model(**inputs)

        embedding = outputs.last_hidden_state.mean(dim=1).squeeze().tolist()

        return tools_pb2.ToolResponse(
            success=True,
            result={'embedding': embedding}
        )

def serve():
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    tools_pb2_grpc.add_PythonToolsServicer_to_server(
        PythonToolsService(), server
    )
    server.add_insecure_port('[::]:50052')
    server.start()
    server.wait_for_termination()

if __name__ == '__main__':
    serve()
```

**资源限制**:

```yaml
# docker-compose.yml
version: '3.8'

services:
  python-tools:
    build: ./docker/python-tools
    deploy:
      resources:
        limits:
          cpus: '2' # 最多 2 核
          memory: 4G # 最多 4GB
        reservations:
          cpus: '500m' # 保留 0.5 核
          memory: 1G # 保留 1GB
    environment:
      - ROLE=tool_provider_only
      - MAX_CONCURRENT_REQUESTS=10
      - TORCH_THREADS=4
    ports:
      - '50052:50052'
```

### 阶段 2 产出

- ✅ Rust 向量检索服务（HNSW 算法）
- ✅ Rust 任务调度服务
- ✅ Python 工具容器
- ✅ Docker Compose 配置

---

## 📅 阶段 3：集成优化（第 5-6 月）

### 目标

完善监控系统，优化性能

### 任务清单

#### 3.1 OpenTelemetry 集成（2 周）

**TypeScript**:

```typescript
// packages/telemetry/src/TraceService.ts
import { trace, context } from '@opentelemetry/api'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import { Resource } from '@opentelemetry/resources'
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions'
import { JaegerExporter } from '@opentelemetry/exporter-trace-jaeger'

const provider = new NodeTracerProvider({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'yunpat-agent',
  }),
})

provider.register()

export function traceAgent(name: string, fn: () => Promise<any>) {
  const tracer = trace.getTracer('yunpat')

  return tracer.startActiveSpan(name, async (span) => {
    try {
      const result = await fn()
      span.setStatus({ code: SpanStatusCode.OK })
      return result
    } catch (error) {
      span.recordException(error as Error)
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      })
      throw error
    } finally {
      span.end()
    }
  })
}
```

**Rust**:

```rust
// rust/tracing/src/lib.rs
use opentelemetry::trace::TraceError;
use opentelemetry::global;
use opentelemetry_jaeger::{JaegerAgentPipeline, Uninstall};

pub fn init_tracer(service_name: &'static str) -> Result<Uninstall, TraceError> {
    JaegerAgentPipeline::builder()
        .with_service_name(service_name)
        .with_max_packet_size(9_216)
        .init()
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let _uninstall = init_tracer("vector-service")?;

    let tracer = global::tracer("vector-service");

    tracer.in_span("search", |cx| {
        // 执行搜索
    });

    Ok(())
}
```

#### 3.2 性能优化（4 周）

**Profiling 驱动优化**:

1. 识别性能热点（Flame Graph）
2. 优化关键路径
3. 内存泄漏检测
4. 并发调优

#### 3.3 文档完善（2 周）

- 架构设计文档
- API 接口文档
- 部署运维文档
- 故障排查指南

### 阶段 3 产出

- ✅ OpenTelemetry 集成
- ✅ 性能优化报告
- ✅ 完整文档

---

## 📊 资源规划

### 人力投入

| 阶段     | TypeScript | Rust        | Python     | DevOps     | 总计        |
| -------- | ---------- | ----------- | ---------- | ---------- | ----------- |
| 阶段 1   | 2 人周     | 2 人周      | 0          | 1 人周     | 5 人周      |
| 阶段 2   | 1 人周     | 6 人周      | 2 人周     | 1 人周     | 10 人周     |
| 阶段 3   | 2 人周     | 2 人周      | 0          | 2 人周     | 6 人周      |
| **总计** | **5 人周** | **10 人周** | **2 人周** | **4 人周** | **21 人周** |

### 技术栈

**TypeScript**:

- @grpc/grpc-js
- @opentelemetry/api
- ts-proto

**Rust**:

- tokio
- tonic
- prost
- opentelemetry

**Python**:

- grpcio
- torch
- transformers
- pandas

**DevOps**:

- Docker
- Kubernetes
- Jaeger
- Prometheus

---

## 🎯 成功标准

### 性能指标

| 指标        | 目标         | 验证方法 |
| ----------- | ------------ | -------- |
| gRPC 延迟   | P99 < 10ms   | 基准测试 |
| 向量检索    | QPS > 10k    | 压力测试 |
| Python 工具 | 响应 < 500ms | 集成测试 |
| 端到端      | 延迟 < 2s    | E2E 测试 |

### 质量指标

- ✅ 单元测试覆盖率 > 80%
- ✅ 集成测试通过率 100%
- ✅ 文档完整性 100%
- ✅ 无内存泄漏

---

## 📚 相关文档

- [Protobuf 语言指南](https://protobuf.dev/programming-guides/proto3/)
- [gRPC 快速开始](https://grpc.io/docs/languages/quickstart/)
- [Tonic (Rust gRPC)](https://github.com/hyperium/tonic)
- [Tokio 教程](https://tokio.rs/tokio/tutorial)
- [OpenTelemetry 文档](https://opentelemetry.io/docs/)

---

**状态**: 📝 计划已确认
**下一步**: 开始阶段 1 实施
