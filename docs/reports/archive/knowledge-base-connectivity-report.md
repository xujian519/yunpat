# YunPat 知识库连接性验证报告

> **验证日期**: 2026-05-09  
> **验证方法**: 实际连接测试（psql / curl / python neo4j driver）  
> **基础设施配置**: `~/.infra/infra.env` + `~/.infra/manage.sh`

---

## 一、基础设施总览

### 本地服务架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                     本地基础设施 (统一管理)                          │
│                     配置: ~/.infra/infra.env                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────┐       │
│  │  PostgreSQL 17 (Homebrew)                                │       │
│  │  直连 :5432  →  xujian@localhost                         │       │
│  │  PgBouncer :6432  →  连接池 (所有应用共享)               │       │
│  │  24 个数据库: patent_db, legal_world_model, yunpat, ...  │       │
│  └─────────────────────────────────────────────────────────┘       │
│                                                                     │
│  ┌──────────────────────┐  ┌──────────────────────┐                │
│  │  Qdrant (Docker)      │  │  Neo4j 5.15 (Docker) │                │
│  │  :6333 REST           │  │  :7687 Bolt          │                │
│  │  :6334 gRPC           │  │  :7474 HTTP          │                │
│  │  3 个集合, 1024维     │  │  93万节点, 6万关系    │                │
│  └──────────────────────┘  └──────────────────────┘                │
│                                                                     │
│  ┌──────────────────────┐                                          │
│  │  Redis (Docker)       │                                          │
│  │  :6380, 密码 redis123 │                                          │
│  └──────────────────────┘                                          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 启停管理

```bash
~/.infra/manage.sh start    # 启动所有服务
~/.infra/manage.sh stop     # 停止所有服务
~/.infra/manage.sh status   # 查看状态
~/.infra/manage.sh restart  # 重启
```

---

## 二、连接性测试结果汇总

| # | 服务 | 端口 | 连接状态 | 数据验证 | 问题 |
|---|------|------|---------|---------|------|
| ① | PostgreSQL (直连) | :5432 | ✅ 通过 | ✅ 24个数据库 | — |
| ② | PgBouncer (连接池) | :6432 | ✅ 通过 | ✅ 同上 | — |
| ③ | Qdrant | :6333 | ✅ 通过 | ✅ 3集合 | ⚠️ 2个空集合 |
| ④ | Neo4j | :7687 | ✅ 通过 | ✅ 93万节点 | ⚠️ 代码密码不匹配 |
| ⑤ | Redis | :6380 | ✅ 通过 | ✅ PONG | — |
| ⑥ | Obsidian 知识库 | 文件系统 | ✅ 通过 | ✅ 4383文件 | — |
| ⑦ | BGE-M3 嵌入服务 | :8009 | ❌ 不可达 | — | ❌ 服务未启动 |
| ⑧ | Google Patents | HTTPS | ⚠️ 未测试 | — | 需外网 |

---

## 三、详细验证结果

### 3.1 PostgreSQL — ✅ 通过

**连接方式**:
- 直连: `psql -h 127.0.0.1 -p 5432 -U xujian`
- 连接池: `psql -h 127.0.0.1 -p 6432 -U xujian`

**数据库清单** (24 个，含 YunPat 相关):

| 数据库 | 拥有者 | 表数 | 用途 |
|--------|--------|------|------|
| `patent_db` | postgres | 3 | 7500万CN专利（GIN全文索引） |
| `legal_world_model` | xujian | 20 | 法律世界模型（法条+向量+图谱） |
| `yunpat` | xujian | 15 | YunPat 应用数据库（客户/案件/费用） |
| `patent_rules` | xujian | — | 专利规则（独立库） |
| `patent_guidelines` | xujian | — | 审查指南（独立库） |
| `athena_*` (6个) | — | — | Athena 平台数据库 |
| `xiaonuo_*` (2个) | postgres | — | 小诺系统数据库 |

#### patent_db 专利数据库

| 表名 | 行数 | 索引 |
|------|------|------|
| `patents` | **75,217,242** | 14个索引（含4个GIN全文索引） |
| `data_import_log` | — | — |
| `patent_search_logs` | — | — |

**GIN 全文索引**:
- `idx_patents_patent_name_fulltext` — `to_tsvector('chinese', patent_name)`
- `idx_patents_abstract_fulltext` — `to_tsvector('chinese', abstract)`
- `idx_patents_search_vector_gin` — `search_vector` (gin, fastupdate)
- `idx_patents_applicant_gin` — `applicant gin_trgm_ops` (模糊搜索)

#### legal_world_model 法律世界模型

| 表名 | 行数 | 说明 |
|------|------|------|
| `legal_articles_v2` | 295,733 | 法律条文 V2 |
| `legal_articles_v2_embeddings` | 295,733 | 条文嵌入向量 (vector(1024)) |
| `patent_decisions_v1` | 6,845 | 专利决定 V1 |
| `patent_decisions_v2` | 9,562 | 专利决定 V2 |
| `patent_judgment_cases` | 5,906 | 判决案例 |
| `patent_judgments` | 5,906 | 判决文书 |
| `patent_judgment_vectors` | 17,388 | 判决向量 |
| `patent_rules_unified` | 1,371 | 统一专利规则 |
| `patent_rules_unified_embeddings` | 1,371 | 规则嵌入向量 |
| `openclaw_kg_nodes` | **40,034** | OpenClaw 知识图谱节点 (vector(1024)) |
| `openclaw_kg_edges` | **407,744** | OpenClaw 知识图谱边 |
| `judgment_entities` | **891,659** | 判决实体 |
| `judgment_relations` | 45,770 | 实体关系 |
| `judgment_embeddings` | 20,478 | 判决嵌入 |

**PG 扩展**: `vector 0.8.2` (pgvector), `pg_trgm 1.6`

**⚠️ 注意**: 之前的架构报告中表名不准确。实际表名是 `legal_articles_v2`（非 `law_articles`）、`patent_decisions_v2`（非 `invalid_decisions`）、`patent_rules_unified`（非 `patent_rules`）。

#### yunpat 应用数据库

| 表名 | 行数 | 说明 |
|------|------|------|
| `clients` | 1,242 | 客户信息 |
| `projects` | 1,238 | 项目 |
| `cases` | 6,357 | 案件 |
| `review_opinions` | 1,760 | 审查意见 |
| `financial_records` | 1,658 | 财务记录 |
| `patents` | 0 | 专利（空表，未使用） |
| `patent_deadlines` | 0 | 期限（空） |
| `patent_fees` | 0 | 费用（空） |

**PG 扩展**: `vector 0.8.1`

---

### 3.2 Qdrant — ✅ 通过

**连接**: `http://localhost:6333`  
**健康检查**: `healthz check passed`

| 集合名 | 向量数 | 维度 | 距离 | 状态 |
|--------|--------|------|------|------|
| `agent_memory_vectors` | **186** | 1024 | Cosine | ✅ green |
| `conversation_vectors` | 0 | 1024 | Cosine | ✅ green (空) |
| `knowledge_vectors` | 0 | 1024 | Cosine | ✅ green (空) |

**⚠️ 问题**: `conversation_vectors` 和 `knowledge_vectors` 两个集合为空（0 条数据），仅 `agent_memory_vectors` 有 186 条向量。

**HNSW 配置**: m=16, ef_construct=100（与代码中的 pgvector 配置一致）。

---

### 3.3 Neo4j — ✅ 通过

**连接**: `bolt://localhost:7687`  
**认证**: `neo4j` / `athena_neo4j_2024`  
**版本**: Neo4j 5.15.0

| 标签 | 节点数 | 说明 |
|------|--------|------|
| `Entity` | **891,659** | 法律实体（人/公司/法院等） |
| `OpenClawNode` | **40,034** | OpenClaw 知识图谱节点 |
| `Case` | 0 | — (空) |
| `SupremeCourtJudgment` | 0 | — (空) |
| `GuidelineRule` | 0 | — (空) |
| `IPC` | 0 | — (空) |

**总节点**: 931,693  
**总关系**: 59,770

---

### 3.4 Redis — ✅ 通过

**连接**: `redis://:redis123@localhost:6380`  
**响应**: PONG  
**Keyspace**: 空（无数据）  
**内存限制**: 256mb (allkeys-lru)

---

### 3.5 Obsidian 本地知识库 — ✅ 通过

| 指标 | 数值 |
|------|------|
| 总 MD 文件数 | 4,383 |
| 知识卡片数 | 132 |
| 概念索引 | ✅ Concept-Index.md（100 个核心概念） |
| 全局概念 | ✅ All-Concepts.md（40 个核心概念） |
| 法律体系 | ✅ legal-system/（15 个子目录） |
| 卡片可读性 | ✅ 抽样通过 |

---

### 3.6 BGE-M3 嵌入服务 — ❌ 不可达

**配置端口**: `localhost:8009`  
**状态**: 连接被拒绝，服务未运行

**代码默认配置** (`BGEIntegration.ts`):
```typescript
baseURL: config.baseURL ?? 'http://localhost:8009/v1'
```

**影响**: RAG 引擎无法进行文本向量化。但 `legal_world_model` 中已有 29.5 万条预计算向量（`legal_articles_v2_embeddings` 表），可直接使用 pgvector 余弦搜索，不依赖实时嵌入服务。

---

## 四、代码配置 vs 实际基础设施对比

### 4.1 连接配置匹配问题

| 配置项 | 代码/`.env` 中的值 | 实际正确值 | 匹配? |
|--------|-------------------|-----------|-------|
| PG 端口 | `:5432` (docker-compose) / `:6432` (packages/.env) | `:6432` (PgBouncer) / `:5432` (直连) | ⚠️ 混用 |
| PG 用户 | `yunpat` / `postgres` | `xujian` (Homebrew PG 超级用户) | ❌ 不匹配 |
| PG 密码 | `yunpat123` | _(空, trust认证)_ | ❌ 不匹配 |
| patent_db 用户 | `postgres` | `xujian` (通过 PgBouncer) | ⚠️ 需确认 |
| Neo4j 密码 | `xujian123456` (代码) | `athena_neo4j_2024` (实际) | ❌ 不匹配 |
| Neo4j 密码 | `athena_neo4j_2024` (infra.env) | `athena_neo4j_2024` | ✅ 匹配 |
| Qdrant URL | `http://localhost:6333` | `http://localhost:6333` | ✅ 匹配 |
| Redis URL | `redis://localhost:6379` (.env.example) | `redis://:redis123@localhost:6380` | ❌ 端口+密码 |
| Redis URL | `redis://:redis123@localhost:6380` (infra.env) | 同上 | ✅ 匹配 |
| BGE-M3 URL | `localhost:8009` | 服务未运行 | ❌ 不可用 |

### 4.2 实际应使用的连接配置

```bash
# 统一使用 ~/.infra/infra.env 的配置:

# PostgreSQL (通过 PgBouncer 连接池, 推荐所有应用使用)
PGHOST=127.0.0.1
PGPORT=6432
PGUSER=xujian
DATABASE_URL=postgresql://xujian@127.0.0.1:6432/yunpat

# PatentDB (7500万专利)
PATENT_DB_URL=postgresql://xujian@127.0.0.1:6432/patent_db

# Legal World Model (法律世界模型)
LEGAL_DB_URL=postgresql://xujian@127.0.0.1:6432/legal_world_model

# Qdrant 向量数据库
QDRANT_URL=http://localhost:6333

# Neo4j 图数据库
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=athena_neo4j_2024

# Redis
REDIS_URL=redis://:redis123@localhost:6380

# Obsidian 知识库
KNOWLEDGE_BASE_PATH=./knowledge-base
```

---

## 五、问题清单与修复建议

### 🔴 P0 — 必须修复

#### 1. Neo4j 密码不匹配
**问题**: 代码/`.env` 中使用 `xujian123456`，实际为 `athena_neo4j_2024`
**修复**: 在项目 `.env` 中添加/修改：
```bash
NEO4J_PASSWORD=athena_neo4j_2024
```

#### 2. PostgreSQL 连接参数不匹配
**问题**: 代码中大量使用 `yunpat:yunpat123@localhost:5432`，实际为 `xujian@127.0.0.1:6432`（PgBouncer）
**影响**: 无法通过 PgBouncer 连接池连接，直连端口可用但绕过连接池
**修复**: 在项目 `.env` 中统一配置：
```bash
DATABASE_URL=postgresql://xujian@127.0.0.1:6432/yunpat
PATENT_DB_URL=postgresql://xujian@127.0.0.1:6432/patent_db
LEGAL_DB_URL=postgresql://xujian@127.0.0.1:6432/legal_world_model
```

### 🟡 P1 — 建议修复

#### 3. BGE-M3 嵌入服务未运行
**问题**: `localhost:8009` 不可达，RAG 引擎无法进行实时文本向量化
**影响**: `RAGEngine` 无法使用；但 `legal_world_model` 中已有预计算向量可直查
**修复**: 启动 BGE-M3 服务或配置替代嵌入服务（如 Ollama nomic-embed-text）

#### 4. Qdrant 两个集合为空
**问题**: `conversation_vectors` 和 `knowledge_vectors` 集合 0 条数据
**影响**: 对话向量和知识向量检索功能不可用
**修复**: 运行数据导入脚本填充向量数据

#### 5. Redis 连接配置
**问题**: `.env.example` 中 Redis 端口 6379，实际为 6380
**修复**: 更新 `.env.example`:
```bash
REDIS_URL=redis://:redis123@localhost:6380
```

### 🟢 P2 — 已知情况

#### 6. legal_world_model 表名与代码不一致
**问题**: 代码中引用 `law_articles`、`invalid_decisions`、`patent_rules`，实际为 `legal_articles_v2`、`patent_decisions_v2`、`patent_rules_unified`
**状态**: `PostgreSQLClient` 可能已使用正确的查询语句；需验证

#### 7. yunpat.patents 表为空
**问题**: YunPat 应用数据库的 patents 表 0 条数据
**状态**: 正常 — 专利管理功能（Phase 6）尚未完成

#### 8. Neo4j 部分标签为空
**问题**: `Case`、`SupremeCourtJudgment`、`GuidelineRule`、`IPC` 标签下 0 节点
**状态**: 仅 `Entity` 和 `OpenClawNode` 有数据；其余待后续迁移

---

## 六、知识库实际数据规模修正

> 基于实际连接测试的结果，修正上一版架构报告中的数据量。

| 知识源 | 原报告数据量 | 实际验证数据量 | 差异 |
|--------|-------------|--------------|------|
| ① Obsidian 本地知识库 | 4,382 文件 + 131 卡片 | 4,383 文件 + **132** 卡片 | 微调 |
| ② PatentDB | 7500万 CN 专利 | **75,217,242** 条 | 一致 |
| ③ Legal World Model - 法条 | 397万条 | **295,733** 条 (v2) | ❌ 原报告严重偏高 |
| ③ Legal World Model - 向量 | 33万向量 | **295,733** (法条嵌入) + **1,371** (规则嵌入) + **17,388** (判决向量) | ❌ 结构不同 |
| ③ Legal World Model - OpenClaw | 4万节点+40万边 | **40,034** 节点 + **407,744** 边 | ✅ 一致 |
| ③ Legal World Model - 实体 | 未提及 | **891,659** 实体 + **45,770** 关系 | 新发现 |
| ④ Neo4j - OpenClawNode | — | **40,034** | 与PG重复存储 |
| ④ Neo4j - Entity | — | **891,659** | 与PG重复存储 |
| ⑥ Qdrant - agent_memory | 未提及 | **186** 条 (1024维) | 新发现 |

---

## 七、修正后的知识库架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     YunPat 知识库架构 (修正版)                                │
│                     基础设施: ~/.infra/ 统一管理                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────────┐                                                      │
│  │  PostgreSQL 17     │  Homebrew :5432 + PgBouncer :6432                   │
│  │  (统一存储层)      │  xujian@127.0.0.1, pgvector 0.8.2                   │
│  │                   │                                                      │
│  │  ┌─ patent_db ───┐│  75,217,242 条专利                                  │
│  │  │  patents      ││  GIN 全文索引 (chinese config)                      │
│  │  │  + 14 索引     ││                                                      │
│  │  └───────────────┘│                                                      │
│  │                   │                                                      │
│  │  ┌─ legal_world ─┐│  法律世界模型                                        │
│  │  │  legal_articles_v2              295,733 条                           │
│  │  │  legal_articles_v2_embeddings   295,733 向量(1024维)                  │
│  │  │  patent_decisions_v2             9,562 条                            │
│  │  │  patent_judgment_cases           5,906 条                            │
│  │  │  patent_judgment_vectors        17,388 向量                           │
│  │  │  patent_rules_unified            1,371 条                            │
│  │  │  openclaw_kg_nodes              40,034 节点 + 1024维向量              │
│  │  │  openclaw_kg_edges             407,744 边                             │
│  │  │  judgment_entities             891,659 实体                           │
│  │  │  judgment_relations             45,770 关系                           │
│  │  └───────────────┘│                                                      │
│  │                   │                                                      │
│  │  ┌─ yunpat ──────┐│  应用数据库 (vector 0.8.1)                          │
│  │  │  clients 1,242 │  cases 6,357                                         │
│  │  │  patents  0    │  patent_deadlines 0                                  │
│  │  └───────────────┘│                                                      │
│  └───────────────────┘                                                      │
│                                                                             │
│  ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐       │
│  │  Qdrant (Docker)   │  │  Neo4j 5.15       │  │  Redis (Docker)    │       │
│  │  :6333 REST        │  │  :7687 Bolt       │  │  :6380             │       │
│  │  :6334 gRPC        │  │  neo4j/[掩码]     │  │  redis123          │       │
│  │                   │  │                   │  │                   │       │
│  │  agent_memory  186│  │  Entity     891,659│  │  Keyspace: 空     │       │
│  │  conversation   0 │  │  OpenClawNode 40,034│  │                   │       │
│  │  knowledge      0 │  │  合计 931,693 节点 │  │                   │       │
│  │  维度: 1024 Cosine│  │  59,770 关系      │  │                   │       │
│  └───────────────────┘  └───────────────────┘  └───────────────────┘       │
│                                                                             │
│  ┌───────────────────┐  ┌───────────────────┐                              │
│  │  Obsidian 知识库   │  │  BGE-M3 嵌入服务   │                              │
│  │  ./knowledge-base │  │  :8009 (未运行)    │                              │
│  │  4,383 MD 文件    │  │                   │                              │
│  │  132 张知识卡片   │  │  ❌ 不可用         │                              │
│  │  100 核心概念     │  │  替代: 使用预计算  │                              │
│  │  ✅ 可读          │  │  向量(pgvector)    │                              │
│  └───────────────────┘  └───────────────────┘                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

> **验证作者**: YunPat Agent 知识库连接性测试  
> **最后更新**: 2026-05-09
