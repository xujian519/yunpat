# claw-code 专利检索工具清单

## 📋 发现的专利检索工具

### 1. GooglePatentsTool（Google专利爬虫）

**文件**: `/rust/crates/ip-tools/src/google_patents.rs`

**功能**:

- ✅ 关键词搜索
- ✅ 支持代理
- ✅ 返回结构化搜索结果
- ✅ 支持分页

**数据结构**:

```rust
pub struct PatentSearchResult {
    pub patent_id: String,
    pub title: String,
    pub snippet: String,
    pub url: String,
    pub assignee: Option<String>,
    pub publication_date: Option<String>,
    pub ipc_codes: Option<Vec<String>>,
}
```

**API端点**: `https://patents.google.com/xhr/query`

---

### 2. SearchEngine（专利检索引擎）

**文件**: `/rust/crates/ip-tools/src/search.rs`

**功能**:

- ✅ **4种检索模式**
  - `Keyword` - 关键词全文检索（PostgreSQL tsquery）
  - `Exact` - 精确匹配（申请号、公开号）
  - `Hybrid` - 混合检索（关键词+结构化）
  - `Vector` - 向量检索

- ✅ **缓存优化**
  - LRU缓存
  - 缓存命中统计
- ✅ **性能优化**
  - 使用PostgreSQL全文检索索引
  - 复合索引优化
  - gin_trgm索引（模糊匹配）

**检索参数**:

```rust
pub struct PatentSearchQuery {
    pub keywords: Option<String>,           // 关键词
    pub applicant: Option<String>,          // 申请人
    pub inventor: Option<String>,           // 发明人
    pub ipc_code: Option<String>,           // IPC分类号
    pub application_number: Option<String>, // 申请号
    pub publication_number: Option<String>, // 公开号
    pub search_mode: SearchMode,            // 检索模式
    pub limit: i32,                         // 返回数量
    pub offset: i32,                        // 偏移量
    pub sort_by: Option<SortField>,         // 排序字段
    pub sort_order: Option<SortOrder>,      // 排序方向
}
```

**性能数据**:

- 关键词检索: ~137ms (cited_count >= 100)
- 混合检索: ~18s (cited_count >= 10)

---

### 3. PatentDatabase（专利数据库）

**文件**: `/rust/crates/ip-tools/src/patent.rs`

**功能**:

- ✅ **多种检索方式**
  - 按申请号检索
  - 按公开号检索
  - 按申请人检索
  - 按IPC分类检索
  - 按关键词检索
  - 高被引专利检索

- ✅ **统计功能**
  - 专利统计信息
  - 最新专利列表

- ✅ **缓存支持**
  - 默认启用缓存
  - 可配置缓存大小

**方法列表**:

```rust
// 检索方法
async fn search(&self, query: &PatentSearchQuery) -> Result<SearchResult>
async fn get_by_application_number(&self, app_no: &str) -> Result<Option<PatentRecord>>
async fn get_by_publication_number(&self, pub_no: &str) -> Result<Option<PatentRecord>>
async fn search_by_applicant(&self, applicant: &str, limit: i32) -> Result<Vec<PatentRecord>>
async fn search_by_ipc(&self, ipc_code: &str, limit: i32) -> Result<Vec<PatentRecord>>
async fn search_by_keywords(&self, keywords: &str, limit: i32) -> Result<Vec<PatentRecord>>

// 统计方法
async fn get_statistics(&self) -> Result<PatentStatistics>
async fn get_latest(&self, limit: i32) -> Result<Vec<PatentRecord>>
```

---

### 4. 向量检索（语义搜索）

**文件**: `/rust/crates/ip-tools/src/vector/search.rs`

**功能**:

- ✅ 基于embedding的语义检索
- ✅ 与Qdrant向量数据库集成
- ✅ 相似度计算

---

## 🎯 可引入到YunPat的工具

### 优先级 P0（立即引入）

#### 1. PatentSearchTool（专利检索工具）

**功能**:

- 关键词检索
- 申请人检索
- IPC分类检索
- 申请号/公开号检索

**实现方案**:

- 将Rust实现编译为Node.js原生模块
- 或重写为TypeScript版本（推荐）

**预计工作量**: 2-3天

---

#### 2. GooglePatentsFetchTool（Google专利爬虫工具）

**功能**:

- 从Google Patents爬取专利数据
- 支持关键词搜索
- 支持代理

**实现方案**:

- 使用fetch API重写
- 无需数据库依赖

**预计工作量**: 1天

---

### 优先级 P1（近期引入）

#### 3. PatentDetailTool（专利详情工具）

**功能**:

- 获取专利详细信息
- 包括权利要求、说明书等

**实现方案**:

- 集成Google Patents详情页解析
- 或连接专利数据库

**预计工作量**: 2天

---

#### 4. HighCitationPatentsTool（高被引专利工具）

**功能**:

- 查找高被引专利
- 用于现有技术分析

**实现方案**:

- 基于检索引擎实现
- 需要被引数据支持

**预计工作量**: 1天

---

## 📊 数据库Schema参考

```sql
CREATE TABLE patents (
    id UUID PRIMARY KEY,
    patent_name VARCHAR(500),
    patent_type VARCHAR(50),
    application_number VARCHAR(100) UNIQUE,
    application_date DATE,
    publication_number VARCHAR(100),
    publication_date DATE,
    applicant VARCHAR(500),
    applicant_type VARCHAR(50),
    inventor TEXT,
    ipc_code VARCHAR(100),
    abstract TEXT,
    claims_content TEXT,
    citation_count INTEGER DEFAULT 0,
    cited_count INTEGER DEFAULT 0,

    -- 全文检索向量
    search_vector tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('chinese', patent_name), 'A') ||
        setweight(to_tsvector('chinese', COALESCE(abstract, '')), 'B')
    ) STORED,

    created_at TIMESTAMP DEFAULT NOW()
);

-- 性能优化索引
CREATE INDEX idx_patents_applicant_date ON patents(applicant, application_date DESC);
CREATE INDEX idx_patents_ipc_date ON patents(ipc_code, application_date DESC);
CREATE INDEX idx_patents_cited_count ON patents(cited_count DESC) WHERE cited_count > 0;
CREATE INDEX idx_patents_fts ON patents USING gin(search_vector);
CREATE INDEX idx_patents_applicant_trgm ON patents USING gin(applicant gin_trgm_ops);
```

---

## 🚀 引入建议

### 方案A: TypeScript重写（推荐）

**优势**:

- 类型安全
- 易于维护
- 无需跨语言边界

**步骤**:

1. 创建 `PatentSearchTool` 类
2. 使用 `node-postgres` 连接数据库
3. 实现关键词检索、精确检索、混合检索
4. 添加缓存支持

### 方案B: FFI调用Rust

**优势**:

- 性能更好
- 复用已有代码

**步骤**:

1. 使用 `neon-bindings` 或 `napi-rs`
2. 将Rust代码编译为Node.js模块
3. 在TypeScript中调用

---

## 📝 工具接口设计（TypeScript）

```typescript
interface PatentSearchTool {
  // 关键词检索
  searchByKeywords(keywords: string, limit?: number): Promise<PatentRecord[]>

  // 申请人检索
  searchByApplicant(applicant: string, limit?: number): Promise<PatentRecord[]>

  // IPC分类检索
  searchByIPC(ipcCode: string, limit?: number): Promise<PatentRecord[]>

  // 申请号检索
  getByApplicationNumber(appNo: string): Promise<PatentRecord | null>

  // 公开号检索
  getByPublicationNumber(pubNo: string): Promise<PatentRecord | null>
}

interface GooglePatentsFetchTool {
  // 从Google Patents爬取
  fetchFromGoogle(query: string, page?: number): Promise<PatentSearchResult[]>
}
```

---

## ✅ 总结

**发现的工具数量**: 3个主要工具

1. ✅ GooglePatentsTool - Google专利爬虫
2. ✅ SearchEngine - 专利检索引擎（4种模式）
3. ✅ PatentDatabase - 专利数据库操作

**可引入的专利工具**: 4个

1. ⭐⭐⭐ PatentSearchTool - 专利检索
2. ⭐⭐⭐ GooglePatentsFetchTool - Google专利爬虫
3. ⭐⭐ PatentDetailTool - 专利详情
4. ⭐ HighCitationPatentsTool - 高被引专利

**预计增加工具数**: 4个
**完成后总工具数**: 18 + 4 = 22个
**专利工具完成度**: 29% → 71%
