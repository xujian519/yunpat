# YunPat 多语言架构快速开始指南

## 📁 项目结构

```
yunpat/
├── protos/                      # gRPC/Protobuf 接口定义
│   ├── common.proto
│   ├── agent.proto
│   ├── vector.proto
│   ├── scheduler.proto
│   └── tools.proto
│
├── packages/                    # TypeScript 实现（编排层）
│   ├── core/                    # 核心框架
│   ├── grpc-server/             # gRPC Server
│   └── agents/                  # Agent 实现
│       ├── writer/
│       └── researcher/
│
├── rust/                        # Rust 实现（核心引擎）
│   ├── vector-service/          # 向量检索服务
│   ├── scheduler-service/       # 任务调度服务
│   └── eventbus/                # 高性能事件总线
│
├── docker/                      # 容器化部署
│   ├── python-tools/            # Python 工具容器
│   │   ├── Dockerfile
│   │   └── requirements.txt
│   └── docker-compose.yml
│
└── yunpat_python/               # Python 实现（工具层）
    ├── yunpat_python/
    │   ├── tools/               # 工具实现
    │   │   ├── ml_tools.py      # ML 工具
    │   │   └── data_tools.py    # 数据工具
    │   └── tools_server.py      # gRPC Server
    └── requirements.txt
```

---

## 🚀 快速开始

### 前置要求

- **Node.js** >= 18.0
- **Rust** >= 1.70
- **Python** >= 3.11
- **Docker** >= 24.0
- **protoc** >= 3.20

### 1. 安装依赖

```bash
# TypeScript
pnpm install

# Rust
cd rust/vector-service && cargo build

# Python
pip install -r yunpat_python/requirements.txt
```

### 2. 生成 gRPC 代码

```bash
# TypeScript
npx ts-proto --protoPath=protos --outputDir=packages/grpc-server/src/generated

# Rust (自动执行)
cd rust/vector-service && cargo build

# Python
python -m grpc_tools.protoc -Iprotos \
  --python_out=yunpat_python \
  --grpc_python_out=yunpat_python \
  protos/*.proto
```

### 3. 启动服务

#### 方式 A：本地开发（推荐）

```bash
# Terminal 1: 启动 TypeScript gRPC Server
pnpm --filter @yunpat/grpc-server dev

# Terminal 2: 启动 Rust Vector Service
cd rust/vector-service && cargo run

# Terminal 3: 启动 Python Tools
python -m yunpat_python.tools_server
```

#### 方式 B：Docker Compose（生产）

```bash
docker-compose up -d
```

### 4. 测试服务

```bash
# 测试 TypeScript Agent Service
pnpm test:agent

# 测试 Rust Vector Service
cd rust/vector-service && cargo test

# 测试 Python Tools
pnpm test:python-tools
```

---

## 📖 示例代码

### TypeScript: 调用 Rust Vector Service

```typescript
// packages/grpc-server/src/examples/callVectorService.ts
import { createVectorClient } from '@yunpat/grpc-server';

const vectorClient = createVectorClient('localhost:50051');

async function example() {
  // 添加向量
  await vectorClient.addVector({
    id: 'doc-001',
    vector: [0.1, 0.2, 0.3, ...],
    metadata: { category: 'tech' },
  });

  // 搜索向量
  const results = await vectorClient.search({
    query_vector: [0.1, 0.2, 0.3, ...],
    top_k: 10,
    threshold: 0.8,
  });

  console.log('搜索结果:', results);
}
```

### Rust: 调用 Python Tools Service

```rust
// rust/scheduler-service/src/call_python.rs
use yunpat::tools::python_tools_client::PythonToolsClient;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut client = PythonToolsClient::connect("http://[::1]:50052").await?;

    // 调用 Python ML 工具
    let request = tonic::Request::new(ExecuteToolRequest {
        tool_name: "embed_text".to_string(),
        args: vec![("text".to_string(), "Hello, world!".to_string())].into_iter().collect(),
        timeout_ms: 5000,
        options: Default::default(),
    });

    let response = client.execute_tool(request).await?;
    println!("工具结果: {:?}", response.into_inner());

    Ok(())
}
```

### Python: 调用 TypeScript Agent Service

```python
# yunpat_python/examples/call_agent.py
import grpc
from protos import agent_pb2, agent_pb2_grpc

def call_agent():
    channel = grpc.insecure_channel('localhost:50051')
    stub = agent_pb2_grpc.AgentServiceStub(channel)
    
    request = agent_pb2.ExecuteAgentRequest(
        agent_name='writer',
        agent_id='writer-001',
        input={'task': 'Write a document'},
        config=agent_pb2.ExecutionConfig(
            timeout_ms=30000,
            max_iterations=10,
        ),
    )
    
    response = stub.ExecuteAgent(request)
    print(f"Agent 结果: {response.output}")
```

---

## 🔧 开发工作流

### 修改 Protobuf 接口

1. 编辑 `.proto` 文件
2. 更新版本号
3. 重新生成代码
4. 更新实现
5. 测试兼容性

```bash
# 1. 编辑接口
vim protos/agent.proto

# 2. 生成代码
npx ts-proto --protoPath=protos --outputDir=packages/grpc-server/src/generated
cd rust/vector-service && cargo build
python -m grpc_tools.protoc -Iprotos --python_out=yunpat_python protos/agent.proto

# 3. 测试
pnpm test
```

### 添加新的 Rust 服务

```bash
# 1. 创建项目
cd rust
cargo new --lib my-service

# 2. 添加依赖
cd my-service
cargo add tokio tonic prost

# 3. 在 protos/ 创建 my_service.proto
# 4. 实现 gRPC 服务
# 5. 在 docker-compose.yml 添加服务
```

### 添加新的 Python 工具

```python
# yunpat_python/tools/my_tool.py
from protos import tools_pb2, tools_pb2_grpc

class MyTool:
    def execute(self, args):
        # 实现工具逻辑
        return {'result': 'success'}

# 在 tools_server.py 注册
TOOLS = {
    'my_tool': MyTool(),
}
```

---

## 🐳 Docker 部署

### 本地开发

```bash
docker-compose -f docker/docker-compose.dev.yml up
```

### 生产环境

```bash
docker-compose -f docker/docker-compose.prod.yml up -d
```

### Kubernetes

```bash
kubectl apply -f kubernetes/
```

---

## 📊 监控与调试

### 查看服务状态

```bash
# TypeScript
curl http://localhost:3000/health

# Rust
curl http://localhost:50051/health

# Python
curl http://localhost:50052/health
```

### 查看日志

```bash
# TypeScript
pnpm logs

# Rust
RUST_LOG=debug cargo run

# Python
LOG_LEVEL=debug python -m yunpat_python.tools_server
```

### 性能分析

```bash
# TypeScript Flame Graph
pnpm flamegraph

# Rust Profiling
cargo flamegraph

# Python Profiling
python -m cProfile -o profile.stats
```

---

## 🧪 测试

### 单元测试

```bash
# TypeScript
pnpm test

# Rust
cargo test

# Python
pytest
```

### 集成测试

```bash
# 启动所有服务
docker-compose up -d

# 运行集成测试
pnpm test:integration
```

### 性能测试

```bash
# Agent Service
k6 run benchmarks/agent-service.js

# Vector Service
cargo run --release --bin benchmark

# Python Tools
pytest benchmarks/test_python_tools.py --benchmark-only
```

---

## 📚 下一步

1. **阅读架构文档**: [MULTILING_ARCHITECTURE_MIGRATION.md](./MULTILING_ARCHITECTURE_MIGRATION.md)
2. **查看接口定义**: [protos/README.md](./protos/README.md)
3. **运行示例**: [examples/](./examples/)
4. **贡献代码**: [CONTRIBUTING.md](./CONTRIBUTING.md)

---

## 🆘 故障排查

### gRPC 连接失败

```bash
# 检查服务是否启动
lsof -i :50051

# 检查防火墙
telnet localhost 50051
```

### Protobuf 版本不匹配

```bash
# 清理并重新生成
rm -rf packages/grpc-server/src/generated
npx ts-proto --protoPath=protos --outputDir=packages/grpc-server/src/generated
```

### Python 内存泄漏

```bash
# 限制内存
docker run --memory=4g yunpat/python-tools

# 监控内存
docker stats
```

---

**维护者**: YunPat 团队  
**最后更新**: 2026-04-28
