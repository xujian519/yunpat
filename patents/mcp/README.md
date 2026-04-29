# YunPat Patent Tools MCP Server

YunPat 专利工具的 MCP (Model Context Protocol) 服务器实现。

## 功能概述

通过 MCP 协议暴露 YunPat 的专利处理能力，使 Claude Desktop 等 MCP 客户端能够：

- 📚 **知识库检索** - 检索 131 张专利知识卡片和 1,111 个专业文档
- 🔍 **专利检索** - 执行迭代式专利检索
- 📄 **官文解析** - 解析审查意见通知书、驳回决定等官文
- 📝 **文档生成** - 生成专利申请文件、权利要求书、意见陈述书
- 📊 **可视化** - 生成权利要求结构图、专利流程图

## 安装

### 1. 安装依赖

```bash
cd /Users/xujian/projects/YunPat
pnpm install
pnpm build
```

### 2. 配置 Claude Desktop

在 Claude Desktop 的配置文件中添加：

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "yunpat-patent-tools": {
      "command": "node",
      "args": [
        "/Users/xujian/projects/YunPat/patents/mcp/patent-tools-server.ts"
      ]
    }
  }
}
```

### 3. 重启 Claude Desktop

重启 Claude Desktop 以加载 MCP 服务器。

## 可用工具

### knowledge_search

从专利知识库中检索相关卡片和文档。

**参数**：
- `query` (string, 必需): 检索查询（关键词或问题）
- `concepts` (array, 可选): 限定概念范围
- `domains` (array, 可选): 限定领域范围
- `limit` (number, 可选): 返回结果数量限制（默认 10）
- `includeContent` (boolean, 可选): 是否包含卡片内容（默认 true）

**示例**：
```json
{
  "query": "三步法 创造性判断",
  "limit": 5
}
```

### patent_search

执行迭代式专利检索。

**参数**：
- `query` (string, 必需): 检索关键词
- `searchFields` (array, 可选): 检索字段（标题、摘要、权利要求等）
- `dateRange` (object, 可选): 日期范围
- `assignee` (string, 可选): 申请人
- `inventor` (string, 可选): 发明人
- `ipc` (string, 可选): IPC分类号

**示例**：
```json
{
  "query": "智能控制系统",
  "assignee": "某某科技有限公司"
}
```

### official_doc_parse

解析专利官文，提取结构化字段。

**参数**：
- `filePath` (string, 必需): 官文文件路径（PDF/图片）
- `docType` (string, 可选): 官文类型（自动检测）
- `useOcr` (boolean, 可选): 是否使用OCR（默认 false）

**示例**：
```json
{
  "filePath": "/path/to/审查意见通知书.pdf",
  "useOcr": false
}
```

### patent_application_generator

生成专利申请文件。

**参数**：
- `data` (object, 必需): 专利申请数据
  - `inventionTitle` (string): 发明名称
  - `technicalField` (string): 技术领域
  - `backgroundArt` (string): 背景技术
  - `inventionContent` (string): 发明内容
  - `claims` (array): 权利要求书
  - `abstract` (string): 摘要
- `outputPath` (string, 必需): 输出文件路径
- `template` (string, 可选): 文档模板类型（standard/pct/utility）

### patent_claims_generator

生成权利要求书。

**参数**：
- `claims` (array, 必需): 权利要求数组
- `outputPath` (string, 必需): 输出文件路径

### response_statement_generator

生成审查意见陈述书。

**参数**：
- `data` (object, 必需): 答复陈述数据
  - `applicationNumber` (string): 申请号
  - `inventionTitle` (string): 发明名称
  - `reviewOpinionSummary` (string): 审查意见摘要
  - `responsePoints` (array): 答复要点
- `outputPath` (string, 必需): 输出文件路径

### patent_claims_structure

生成专利权利要求结构图（Mermaid 格式）。

**参数**：
- `claims` (array, 必需): 权利要求数组
- `title` (string, 可选): 图表标题

**返回**：Mermaid 图表代码

### patent_process_chart

生成专利申请/审查流程图（Mermaid 格式）。

**参数**：
- `steps` (array, 必需): 流程步骤
- `flows` (array, 必需): 流程连线
- `title` (string, 可选): 图表标题

**返回**：Mermaid 图表代码

## 使用示例

### 在 Claude Desktop 中使用

1. **知识库检索**

```
帮我检索关于"三步法"的知识卡片
```

Claude 会自动调用 `knowledge_search` 工具。

2. **解析审查意见通知书**

```
解析这个审查意见通知书：/path/to/doc.pdf
```

Claude 会自动调用 `official_doc_parse` 工具。

3. **生成专利申请文件**

```
基于以下信息生成专利申请文件：
- 发明名称：一种智能控制系统
- 技术领域：自动化控制
- ...
```

Claude 会自动调用 `patent_application_generator` 工具。

## 开发

### 构建项目

```bash
pnpm build
```

### 测试 MCP 服务器

```bash
# 启动服务器
node patents/mcp/patent-tools-server.ts

# 在另一个终端发送测试请求
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node patents/mcp/patent-tools-server.ts
```

## 架构

```
Claude Desktop (MCP Client)
         ↓ (MCP Protocol)
YunPat Patent Tools MCP Server
         ↓
YunPat Tools (@yunpat/builtin-tools, @yunpat/document-tools)
         ↓
Knowledge Base, File System, etc.
```

## 故障排查

### Claude Desktop 无法连接服务器

1. 检查配置文件路径是否正确
2. 检查服务器文件路径是否正确
3. 重启 Claude Desktop
4. 查看 Claude Desktop 日志

### 工具调用失败

1. 确认已构建项目：`pnpm build`
2. 检查知识库路径是否正确
3. 查看服务器日志

## 下一步

- 添加更多专利工具
- 支持流式响应
- 添加认证和授权
- 性能优化

---

**YunPat Team** - 让专利工作更智能 🚀
