# YunPat 工具集成设计文档

## 1. 现状分析

### 1.1 DeepSeek-TUI 现有能力
- **工具系统**: Rust 实现的工具注册表（`crates/tui/src/tools/`）
- **MCP 支持**: 已集成 Model Context Protocol（`crates/yunpat-mcp/`, `crates/yunpat-mcp-bridge/`）
- **现有工具**: 文件操作、Shell、Git、Web 搜索、代码审查等
- **智能体**: DraftingAgent、TrademarkAgent、OAResponseAgent、ResearchAgent、CreativityAgent
- **输出格式**: Markdown 为主

### 1.2 YunPat 现有能力（TypeScript）
- **专利工具** (`packages/patent-tools/`):
  - `GooglePatentsFetchTool` - Google Patents 爬虫检索
  - `PatentSearchTool` - 综合专利检索（关键词/申请人/IPC/申请号）
  - `PatentDatabaseSearchTool` - 本地专利数据库检索
  - `PatentDownloadTool` - 专利 PDF 下载
  - `PatentDetailTool` - 专利详情获取
  - `ClaimsGeneratorTool` - 权利要求生成
  - `FeatureExtractorTool` - 技术特征提取

- **文档工具** (`packages/document-tools/`):
  - `UniversalDocumentParserTool` - 通用文档解析（PDF/DOCX/Excel/图片）
  - `ImageOcrTool` - OCR（Tesseract.js）
  - `DocxExtractTextTool` / `DocxParseTool` - Word 解析
  - `ExcelReadTool` / `ExcelToMarkdownTool` - Excel 解析
  - `PdfParseTool` / `PdfExtractTextTool` - PDF 解析
  - `PatentDocxGenerator` - 专利文档生成（DOCX）
  - `DocumentConverterTool` - 文档格式转换

- **MCP 服务器** (`packages/mcp-server/`):
  - 已实现 MCP 接口，支持工具列表和调用

### 1.3 差距分析
| 需求 | DeepSeek-TUI | YunPat | 集成策略 |
|------|-------------|--------|---------|
| 专利检索（Google） | ✅ 已实现 | ✅ MCP | Rust 原生实现 |
| 专利检索（本地） | ✅ 已实现 | ✅ MCP | Rust 原生实现（tokio-postgres） |
| 专利下载 | ✅ 已实现 | ✅ MCP | Rust 原生实现 |
| 文档转换（→MD） | ✅ 已实现 | ✅ MCP | Rust 原生实现（lopdf + calamine） |
| OCR | ❌ | ✅ MCP | 待实现 |
| 文档生成（MD→DOCX） | ❌ | ✅ MCP | 待实现 |
| 期刊论文搜索 | ✅ 已实现 | ❌ | Rust 原生实现（Semantic Scholar API） |
| 默认简体中文输出 | ✅ 已实现 | ✅ | 修改智能体模板 |

**已实现工具列表**（Rust 原生）：
- `PatentSearchTool` - Google Patents 检索（`crates/yunpat-agents/src/tools/patent_search.rs`）
- `PatentDatabase` - 本地 PostgreSQL 专利数据库（`crates/yunpat-agents/src/tools/patent_db.rs`）
- `PaperSearchTool` - Semantic Scholar 论文检索（`crates/yunpat-agents/src/tools/paper_search.rs`）
- `PatentDownloadTool` - Google Patents PDF 下载（`crates/yunpat-agents/src/tools/patent_download.rs`）
- `DocumentParser` - 通用文档解析（`crates/yunpat-agents/src/tools/document.rs`）

**数据库连接**：
```rust
let conn_str = std::env::var("PATENT_DB_URL")
    .unwrap_or_else(|_| "host=localhost port=5432 dbname=patent_db user=xujian".to_string());
let db = PatentDatabase::connect(&conn_str).await?;
```

**支持的数据库搜索模式**：
- `search_fulltext(keyword, page, page_size)` - 全文搜索（使用 PostgreSQL tsvector）
- `search_by_keyword(keyword, page, page_size)` - 关键词模糊匹配
- `search_by_ipc(ipc_code, page, page_size)` - IPC 分类号搜索
- `search_by_applicant(applicant, page, page_size)` - 申请人搜索
- `get_patent_by_publication_number(pub_number)` - 按公开号精确查询 |

## 2. 集成架构设计

### 2.1 推荐方案：MCP 集成（方案 A）

```
┌─────────────────────────────────────────────────────────────┐
│                    DeepSeek-TUI (Rust)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  智能体系统   │  │  工具注册表   │  │  MCP 客户端  │      │
│  │  (Agent)     │  │  (Registry)  │  │  (Client)    │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                 │              │
│         └─────────────────┴─────────────────┘              │
│                           │                                │
│                    ┌──────┴──────┐                        │
│                    │  ToolSpec   │                        │
│                    │  统一接口   │                        │
│                    └──────┬──────┘                        │
└───────────────────────────┼────────────────────────────────┘
                            │
                    ┌───────┴───────┐
                    │   MCP 协议    │
                    │  (stdio/sse)  │
                    └───────┬───────┘
                            │
┌───────────────────────────┼────────────────────────────────┐
│                    YunPat MCP Server                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ patent-tools │  │ document-tools│  │ other-tools  │     │
│  │              │  │               │  │              │     │
│  │ • Search     │  │ • Parse       │  │ • Analysis   │     │
│  │ • Download   │  │ • Convert     │  │ • Generation │     │
│  │ • Detail     │  │ • OCR         │  │              │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 为什么不重写为 Rust（方案 B）

| 因素 | MCP 集成 | Rust 重写 |
|------|---------|----------|
| 开发时间 | 1-2 周 | 2-3 个月 |
| 维护成本 | 低（复用 YunPat） | 高（双份代码） |
| 功能完整性 | 100%（立即获得） | 逐步完善 |
| 团队负担 | 轻 | 重 |
| 测试覆盖 | 已有 | 需新建 |

### 2.3 MCP 配置方式

DeepSeek-TUI 通过 `~/.deepseek/mcp.json` 配置 MCP 服务器：

```json
{
  "mcpServers": {
    "yunpat-patent-tools": {
      "command": "node",
      "args": ["/path/to/YunPat/packages/mcp-server/dist/index.js"],
      "env": {
        "DEEPSEEK_API_KEY": "${DEEPSEEK_API_KEY}",
        "PATENT_DB_HOST": "localhost",
        "PATENT_DB_PORT": "5432"
      }
    },
    "yunpat-document-tools": {
      "command": "node",
      "args": ["/path/to/YunPat/packages/document-tools/dist/mcp-server.js"]
    }
  }
}
```

## 3. 实施计划

### 阶段 1：智能体默认语言改为简体中文
**目标**: 所有智能体输出使用简体中文
**文件**:
- `crates/yunpat-agents/src/drafting.rs` - 修改模板内容
- `crates/yunpat-agents/src/trademark.rs` - 修改模板内容
- `crates/yunpat-agents/src/oa_response.rs` - 修改模板内容
- `crates/yunpat-agents/src/research.rs` - 修改模板内容
- `crates/yunpat-agents/src/creativity.rs` - 修改模板内容（已完成）
- `crates/yunpat-agents/src/flow.rs` - 修改质量维度描述

**工作量**: 1-2 天

### 阶段 2：MCP 集成专利工具
**目标**: 通过 MCP 调用 YunPat 专利工具
**步骤**:
1. 确认 YunPat MCP 服务器启动方式
2. 配置 DeepSeek-TUI 的 MCP 连接
3. 验证工具调用链路
4. 在 PatentWorkflowTool 中集成专利检索/下载

**工具映射**:
| YunPat 工具 | MCP 工具名 | 功能 |
|------------|-----------|------|
| `GooglePatentsFetchTool` | `google_patents_fetch` | Google 专利检索 |
| `PatentSearchTool` | `patent_search` | 综合专利检索 |
| `PatentDatabaseSearchTool` | `patent_db_search` | 本地数据库检索 |
| `PatentDownloadTool` | `patent_download` | 专利 PDF 下载 |
| `PatentDetailTool` | `patent_detail` | 专利详情获取 |

**工作量**: 3-5 天

### 阶段 3：MCP 集成文档工具
**目标**: 通过 MCP 调用 YunPat 文档工具
**步骤**:
1. 配置文档工具 MCP 服务器
2. 验证文档解析和转换功能
3. 在智能体工作流中集成文档处理

**工具映射**:
| YunPat 工具 | MCP 工具名 | 功能 |
|------------|-----------|------|
| `UniversalDocumentParserTool` | `universal_document_parser` | 通用文档解析 |
| `ImageOcrTool` | `image_ocr` | 图片 OCR |
| `DocxExtractTextTool` | `docx_extract_text` | Word 提取文本 |
| `ExcelToMarkdownTool` | `excel_to_markdown` | Excel 转 Markdown |
| `PatentDocxGenerator` | `patent_docx_generator` | 专利 DOCX 生成 |
| `DocumentConverterTool` | `document_converter` | 文档格式转换 |

**工作量**: 3-5 天

### 阶段 4：期刊论文搜索工具（新开发）
**目标**: 实现期刊论文搜索
**方案**:
- 方案 A: 集成 Google Scholar API / Semantic Scholar API
- 方案 B: 集成 arXiv API
- 方案 C: 集成 PubMed API（医学领域）

**建议**: 先实现 Semantic Scholar API（免费，无限制）

**工作量**: 5-7 天

### 阶段 5：智能体工作流集成
**目标**: 让智能体能够调用新工具
**步骤**:
1. 在 `PatentWorkflowTool` 中集成专利检索
2. 在 `DraftingAgent` 中集成现有技术检索
3. 在 `CreativityAgent` 中集成对比文件检索
4. 在 `OAResponseAgent` 中集成审查意见相关专利检索
5. 在所有智能体中集成文档处理（输入解析和输出生成）

**工作量**: 5-7 天

### 阶段 6：测试和验证
**目标**: 确保所有工具正常工作
**测试项**:
- MCP 连接测试
- 专利检索功能测试（Google + 本地）
- 专利下载功能测试
- 文档解析测试（PDF/DOCX/Excel/图片）
- OCR 功能测试
- 文档生成测试（Markdown → DOCX）
- 期刊论文搜索测试
- 智能体端到端测试

**工作量**: 3-5 天

## 4. 技术细节

### 4.1 工具调用流程

```rust
// 在 PatentWorkflowTool 中调用 MCP 工具
async fn call_patent_search(query: &str) -> Result<Vec<PatentRecord>> {
    let mcp_pool = /* 获取 MCP 连接池 */;
    
    let args = json!({
        "query": query,
        "mode": "keyword",
        "limit": 10
    });
    
    let result = mcp_pool
        .call_tool("patent_search", args)
        .await?;
    
    // 解析结果
    let patents: Vec<PatentRecord> = serde_json::from_value(result)?;
    Ok(patents)
}
```

### 4.2 文档处理流程

```rust
// 在 Agent execute() 中处理输入文档
async fn process_input_documents(&self, file_paths: &[String]) -> Result<String> {
    let mut contents = Vec::new();
    
    for path in file_paths {
        let result = mcp_pool
            .call_tool("universal_document_parser", json!({
                "filePath": path,
                "outputFormat": "markdown"
            }))
            .await?;
        
        contents.push(result["text"].as_str().unwrap_or("").to_string());
    }
    
    Ok(contents.join("\n\n---\n\n"))
}
```

### 4.3 输出生成流程

```rust
// 将 Markdown 输出转换为 DOCX
async fn generate_docx_output(&self, markdown: &str, output_path: &str) -> Result<()> {
    mcp_pool
        .call_tool("patent_docx_generator", json!({
            "content": markdown,
            "outputPath": output_path,
            "docType": "patent_application"
        }))
        .await?;
    
    Ok(())
}
```

## 5. 配置示例

### 5.1 MCP 服务器配置

```json
{
  "mcpServers": {
    "yunpat-patent-tools": {
      "command": "node",
      "args": [
        "/Users/xujian/projects/YunPat/packages/mcp-server/dist/index.js"
      ],
      "env": {
        "DEEPSEEK_API_KEY": "${DEEPSEEK_API_KEY}",
        "PATENT_DB_HOST": "localhost",
        "PATENT_DB_PORT": "5432",
        "PATENT_DB_NAME": "patent_db",
        "PATENT_DB_USER": "yunpat",
        "PATENT_DB_PASSWORD": "${DB_PASSWORD}"
      }
    },
    "yunpat-document-tools": {
      "command": "node",
      "args": [
        "/Users/xujian/projects/YunPat/packages/document-tools/dist/mcp-server.js"
      ],
      "env": {
        "TESSDATA_PREFIX": "/usr/local/share/tessdata"
      }
    }
  }
}
```

### 5.2 环境变量

```bash
# 专利数据库
export PATENT_DB_HOST=localhost
export PATENT_DB_PORT=5432
export PATENT_DB_NAME=patent_db
export PATENT_DB_USER=yunpat
export PATENT_DB_PASSWORD=secret

# Google Patents（无需 API Key）

# Semantic Scholar（免费，可选）
export SEMANTIC_SCHOLAR_API_KEY=your_key
```

## 6. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| YunPat MCP 服务器不稳定 | 高 | 实现fallback机制，超时重试 |
| Node.js 依赖问题 | 中 | 使用 Docker 容器化部署 |
| 专利数据库连接失败 | 高 | 优先使用 Google Patents，本地 DB 作为增强 |
| OCR 识别质量差 | 中 | 支持多语言 OCR，提供置信度评分 |
| 大文件处理超时 | 中 | 分块处理，异步任务队列 |

## 7. 验收标准

- [x] 所有智能体默认输出简体中文
- [x] 可通过 `/creativity` 命令启动创造性判断工作流
- [x] 可检索 Google Patents 并显示结果
- [x] 可检索本地专利数据库并显示结果
- [x] 本地专利数据库支持 IPC 分类号过滤搜索
- [x] 本地专利数据库支持申请人过滤搜索
- [x] 可下载专利 PDF
- [x] 可解析 PDF/DOCX/Excel/图片为 Markdown
- [x] 可从图片中提取文字（OCR）
- [x] 可将 Markdown 转换为 DOCX
- [x] 可搜索期刊论文（Semantic Scholar）
- [x] 所有功能通过单元测试
- [ ] 端到端测试通过

## 8. TUI 命令使用指南

### 8.1 专利检索命令

```bash
# 本地专利数据库搜索
/patent-db 人工智能
/patent-db --ipc G06N
/patent-db --applicant 华为
/patent-db 电池 --ipc H01M --applicant 宁德时代
/pdb 人工智能

# Google Patents 搜索
/patent-search artificial intelligence
/ps machine learning

# 论文搜索
/paper-search deep learning
/ss transformer

# OCR 文字提取
/ocr /path/to/image.png
/ocr /path/to/image.jpg chi_sim

# Markdown 转 DOCX
/docx report.md
/docx report.md output.docx
```

### 8.2 智能体工作流命令

```bash
# 创造性判断
/creativity 创造性判断分析
/inv 新用途专利

# 专利研究
/research 专利创造性判定规则

# 专利撰写
/draft 一种新型电池技术

# 审查意见答复
/oa --case abc123

# 复审
/reexam --case abc123

# 无效宣告
/invalid --case abc123

# 商标
/trademark 云智商标
/tm 商标注册
```

## 9. 实现状态总结

| 功能 | 状态 | 文件 |
|------|------|------|
| 创造性判断智能体 | ✅ 完成 | `crates/yunpat-agents/src/creativity.rs` |
| 智能体中文输出 | ✅ 完成 | 所有智能体文件 |
| Google Patents 搜索 | ✅ 完成 | `crates/yunpat-agents/src/tools/patent_search.rs` |
| Semantic Scholar 论文搜索 | ✅ 完成 | `crates/yunpat-agents/src/tools/paper_search.rs` |
| 本地专利数据库 | ✅ 完成 | `crates/yunpat-agents/src/tools/patent_db.rs` |
| IPC 分类号搜索 | ✅ 完成 | `PatentDatabase::search_by_ipc()` |
| 申请人搜索 | ✅ 完成 | `PatentDatabase::search_by_applicant()` |
| 专利 PDF 下载 | ✅ 完成 | `crates/yunpat-agents/src/tools/patent_download.rs` |
| 文档解析 | ✅ 完成 | `crates/yunpat-agents/src/tools/document.rs` |
| TUI 命令集成 | ✅ 完成 | `crates/tui/src/commands/patent.rs` |
| 多语言本地化 | ✅ 完成 | `crates/tui/src/localization.rs` |
| OCR | ✅ 完成 | `crates/yunpat-agents/src/tools/ocr.rs` |
| DOCX 生成 | ✅ 完成 | `crates/yunpat-agents/src/tools/document.rs` |

## 10. 下一步行动

1. **已实现**: 阶段 1-5 核心功能全部完成，OCR 和 DOCX 生成已完成
2. **优化**: 根据用户反馈优化搜索算法和结果展示
3. **测试**: 补充端到端测试和性能测试
4. **文档**: 完善用户文档和 API 文档

**OCR 功能说明**: 
- 默认情况下 OCR 功能不可用（feature flag 控制）
- 要启用 OCR，使用 `cargo build --features ocr` 编译
- 需要系统安装 Tesseract OCR：
  - macOS: `brew install tesseract tesseract-lang`
  - Ubuntu: `sudo apt-get install tesseract-ocr tesseract-ocr-chi-sim`
- 支持多语言：`chi_sim`（简体中文）、`eng`（英文）、`chi_sim+eng`（混合）

**DOCX 生成功能说明**:
- 纯 Rust 实现，无需外部依赖
- 支持 Markdown 基础语法：标题、列表、粗体、斜体、代码块、引用
- 使用 `docx-rs` 库生成标准 .docx 文件

**架构决策变更**: 原计划通过 MCP 集成 YunPat TypeScript 工具，但实际实施中改为 Rust 原生实现，原因：
- 避免 Node.js 运行时依赖
- 更好的性能和类型安全
- 更简单的部署（单一二进制文件）
- 利用现有的 PostgreSQL 连接和 tokio 异步生态
