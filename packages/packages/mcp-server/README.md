# YunPat MCP Server

YunPat 专利工具的 Model Context Protocol (MCP) 服务器。

## 简介

MCP Server 提供了 YunPat 专利工具的标准协议接口，允许支持 MCP 的客户端（如 Claude Desktop）直接调用 YunPat 的专利处理能力。

包含 6 个源文件，提供 5 个核心工具。

---

## 功能特性

### 1. 专利搜索 (patent_search)

执行专利检索，分析现有技术，评估新颖性。

输入参数：

- `inventionTitle`: 发明名称
- `claims`: 权利要求书
- `patentType`: 专利类型（发明/实用新型/外观设计）
- `specification`: 说明书（可选）
- `searchOptions`: 检索选项（关键词、分类号、申请人等）

输出：检索策略、相关专利列表、新颖性评估、时间分布分析、申请人统计

### 2. 权利要求生成 (claims_generator)

生成专利权利要求书，包括独立权利要求和从属权利要求。

输入参数：

- `technicalField`: 技术领域
- `technicalProblem`: 技术问题
- `technicalSolution`: 技术方案
- `beneficialEffects`: 有益效果
- `keyFeatures`: 关键特征列表
- `patentType`: 专利类型
- `enableDependentClaims`: 是否生成从属权利要求
- `dependentClaimCount`: 从属权利要求数量

输出：权利要求集合、布局策略说明、保护范围分析、质量检查结果

### 3. 质量检查 (quality_checker)

检查专利申请文件的质量。

输入参数：

- `inventionTitle`: 发明名称
- `claims`: 权利要求书
- `specification`: 说明书
- `patentType`: 专利类型
- `checkLevel`: 检查级别（1-3）

输出：完整性评分、总体质量评分、质量等级、问题列表、改进建议

### 4. 专利分析 (patent_analyzer)

对专利申请文件进行综合分析。

输入参数：

- `inventionTitle`: 发明名称
- `claims`: 权利要求书
- `specification`: 说明书
- `analysisTypes`: 分析类型（可选）

输出：完整性分析、权利要求结构分析、保护范围分析、风险评估、总体评估

### 5. 审查答复 (patent_responder)

分析审查意见并生成答复文档。

输入参数：

- `officeAction`: 审查意见内容
- `originalClaims`: 原始权利要求书
- `originalDescription`: 原始说明书
- `strategyPreference`: 策略偏好（激进/温和/保守）

输出：审查意见分析、答复策略、答复文档、后续建议

---

## 架构

```
packages/mcp-server/
  src/
    index.ts                # MCP 服务器入口
    types.ts                # 类型定义
    tools/
      index.ts              # 工具导出
      BaseMcpTool.ts        # 工具基类
      AllTools.ts           # 工具注册汇总
      RealTools.ts          # 实际工具实现
```

---

## 安装与配置

### 安装

```bash
npm install
npm run build
```

### Claude Desktop 配置

在 Claude Desktop 配置文件中添加：

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

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

---

## 工具运行模式

所有工具都支持两种运行模式：

1. **简化模式** -- 无需 LLM 配置，使用内置算法快速返回结果
2. **智能体模式** -- 当配置 LLM 时，自动调用相应的 YunPat 智能体进行深度分析

输入验证使用 Zod 进行严格的参数校验。工具执行失败时返回结构化错误信息。

---

## 开发

```bash
npm install        # 安装依赖
npm run dev        # 开发模式（监听文件变化）
npm run build      # 构建
npm start          # 运行
npm test           # 测试
```

---

## 许可证

MIT

---

最后更新: 2026-05-06
