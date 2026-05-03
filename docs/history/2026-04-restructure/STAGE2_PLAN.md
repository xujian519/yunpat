# YunPat 阶段 2 实施计划

**目标**: 核心引擎迁移到 Rust，Python ML 工具集成

## 📅 时间表: 第 3-4 月

---

## 🔧 任务 1: Rust 向量检索服务（3 周）

### 1.1 HNSW 算法实现（2 周）

**文件**: `rust/vector-service/src/hnsw.rs`

**核心数据结构**:

```rust
pub struct HNSWIndex {
    layers: Vec<Layer>,
    ef_construction: usize,
    m: usize,
    m_max: usize,
}

struct Layer {
    level: usize,
    nodes: HashMap<NodeId, Node>,
    connections: HashMap<NodeId, Vec<NodeId>>,
}

struct Node {
    id: NodeId,
    vector: Vec<f32>,
    connections: Vec<NodeId>,
}
```

**关键算法**:

- `insert()` - 插入向量
- `search()` - 搜索最近邻
- `build_layer()` - 构建层级索引

### 1.2 性能优化（1 周）

- 并行插入
- SIMD 优化
- 内存池管理

---

## 🔧 任务 2: Rust 任务调度服务（3 周）

### 2.1 任务队列实现（2 周）

**文件**: `rust/scheduler-service/src/scheduler.rs`

**核心数据结构**:

```rust
pub struct TaskScheduler {
    queues: HashMap<Priority, VecDeque<Task>>,
    workers: Vec<Worker>,
    max_concurrent: usize,
}

pub enum Priority {
    Low = 0,
    Medium = 1,
    High = 2,
    Urgent = 3,
}

pub struct Task {
    id: String,
    payload: Vec<u8>,
    priority: Priority,
    timeout: Duration,
}
```

**关键算法**:

- `submit_task()` - 提交任务
- `schedule()` - 调度任务
- `timeout_manager()` - 超时管理

### 2.2 优先级队列（1 周）

- 4 级优先级队列
- 公平调度算法
- 饥饿预防

---

## 🔧 任务 3: Python ML 工具集成（2 周）

### 3.1 BERT 集成（1 周）

**文件**: `yunpat_python/tools/bert_tools.py`

```python
class BertEmbeddingTool:
    def __init__(self):
        from transformers import AutoTokenizer, AutoModel
        self.tokenizer = AutoTokenizer.from_pretrained('bert-base-uncased')
        self.model = AutoModel.from_pretrained('bert-base-uncased')

    def embed(self, text: str) -> List[float]:
        inputs = self.tokenizer(text, return_tensors='pt')
        with torch.no_grad():
            outputs = self.model(**inputs)
        return outputs.last_hidden_state.mean(dim=1).squeeze().tolist()
```

### 3.2 数据分析工具（1 周）

- pandas 集成
- numpy 集成
- scikit-learn 集成

---

## 🔧 任务 4: 集成与测试（2 周）

### 4.1 端到端测试（1 周）

- Agent → Vector → Tools 完整流程
- 性能基准测试
- 压力测试

### 4.2 文档完善（1 周）

- API 文档
- 部署文档
- 故障排查指南

---

## 📊 阶段 2 产出

- ✅ Rust 向量检索服务（HNSW）
- ✅ Rust 任务调度服务
- ✅ Python ML 工具集成
- ✅ 端到端集成测试
- ✅ 完整文档

**预计投入**: 8-10 周
**关键里程碑**:

- Week 6: HNSW PoC 完成
- Week 8: 调度服务完成
- Week 10: ML 工具集成完成

---

**状态**: 🚀 开始实施
