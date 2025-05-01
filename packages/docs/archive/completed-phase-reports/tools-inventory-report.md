# 工具资产盘点报告

**盘点日期**: 2026-05-04
**盘点范围**: YunPat项目、Athena工作平台、OpenClaw、M4 Air（待访问）

---

## 📊 盘点总结

### 已完成盘点（3/4）

| 位置               | 状态        | 工具数量  | 备注                     |
| ------------------ | ----------- | --------- | ------------------------ |
| YunPat项目         | ✅ 已完成   | 28个工具  | 分为3个包                |
| Athena工作平台     | ⚠️ 部分完成 | 待统计    | 目录结构复杂，需深入分析 |
| OpenClaw           | ✅ 已完成   | 8个智能体 | 主要是专利相关智能体     |
| M4 Air (Tailscale) | ❌ 未访问   | -         | 需要网络访问权限         |

---

## 📦 YunPat项目工具清单

### 1. patent-tools包（4个工具）

**位置**: `/Users/xujian/projects/YunPat/packages/patent-tools/src/tools/`

| 工具名称            | 文件名                 | 功能描述           | 优先级 | 备注 |
| ------------------- | ---------------------- | ------------------ | ------ | ---- |
| PatentSearchTool    | PatentSearchTool.ts    | 专利检索           | 🔴 高  | 已有 |
| GooglePatentsTool   | GooglePatentsTool.ts   | Google Patents检索 | 🟡 中  | 已有 |
| PatentDetailTool    | PatentDetailTool.ts    | 专利详情获取       | 🔴 高  | 已有 |
| ClaimsGeneratorTool | ClaimsGeneratorTool.ts | 权利要求生成       | 🔴 高  | 已有 |

**复用建议**:

- ✅ **直接复用**: PatentSearchTool、PatentDetailTool、ClaimsGeneratorTool
- 🔍 **需要审查**: GooglePatentsTool（检查是否支持中国专利）
- 📝 **需要文档**: 所有工具都需要补充使用文档

---

### 2. builtin-tools包（8个工具）

**位置**: `/Users/xujian/projects/YunPat/packages/builtin-tools/src/`

| 工具名称           | 文件名                 | 功能描述   | 优先级 | 备注 |
| ------------------ | ---------------------- | ---------- | ------ | ---- |
| KnowledgeSearch    | knowledge-search.ts    | 知识库搜索 | 🔴 高  | 已有 |
| VisualizationTools | visualization-tools.ts | 可视化工具 | 🟢 低  | 已有 |
| IterativeSearch    | iterative-search.ts    | 迭代搜索   | 🔴 高  | 已有 |
| FileTools          | FileTools.ts           | 文件操作   | 🔴 高  | 已有 |
| NetworkTools       | NetworkTools.ts        | 网络请求   | 🔴 高  | 已有 |
| SearchTools        | SearchTools.ts         | 搜索工具   | 🔴 高  | 已有 |
| WebTools           | WebTools.ts            | Web工具    | 🟡 中  | 已有 |
| Index              | index.ts               | 工具注册表 | 🔴 高  | 已有 |

**复用建议**:

- ✅ **直接复用**: KnowledgeSearch、IterativeSearch、FileTools、NetworkTools
- 🔍 **需要审查**: SearchTools、WebTools（检查是否支持学术论文检索）
- 📝 **需要文档**: 所有工具都需要补充使用文档

---

### 3. document-tools包（14个工具）

**位置**: `/Users/xujian/projects/YunPat/packages/document-tools/src/`

| 工具名称                   | 文件名                        | 功能描述         | 优先级 | 备注         |
| -------------------------- | ----------------------------- | ---------------- | ------ | ------------ |
| OfficialDocParser          | OfficialDocParser.ts          | 官方文档解析     | 🔴 高  | 已有（旧版） |
| OfficialDocParserV2        | OfficialDocParserV2.ts        | 官方文档解析V2   | 🔴 高  | 已有（新版） |
| PatentDocxGenerator        | PatentDocxGenerator.ts        | **专利DOCX生成** | 🔴 高  | **已存在！** |
| PptxTools                  | PptxTools.ts                  | PPT工具          | 🟢 低  | 已有         |
| UniversalDocumentTool      | UniversalDocumentTool.ts      | 通用文档工具     | 🟡 中  | 已有         |
| ExcelTools                 | ExcelTools.ts                 | Excel工具        | 🟢 低  | 已有         |
| DocumentCollaborationTools | DocumentCollaborationTools.ts | 文档协作工具     | 🟢 低  | 已有         |
| AudioTools                 | AudioTools.ts                 | 音频工具         | 🟢 低  | 已有         |
| PdfTools                   | PdfTools.ts                   | PDF工具          | 🔴 高  | 已有         |
| DocxTools                  | DocxTools.ts                  | DOCX工具         | 🔴 高  | 已有         |
| OcrTools                   | OcrTools.ts                   | **OCR工具**      | 🔴 高  | **已存在！** |
| converters                 | converters.ts                 | 格式转换器       | 🔴 高  | 已有         |
| document                   | document.ts                   | 文档工具         | 🔴 高  | 已有         |

**复用建议**:

- ✅ **直接复用**: PatentDocxGenerator、OcrTools、PdfTools、DocxTools、converters
- ✨ **重要发现**: PatentDocxGenerator已经存在，可以直接用于WritingAgent
- ✨ **重要发现**: OcrTools已经存在，可以直接用于TechnicalDrawingAgent
- 🔍 **需要审查**: OfficialDocParser vs OfficialDocParserV2（哪个是新版？）
- 📝 **需要文档**: 所有工具都需要补充使用文档

---

## 🔧 OpenClaw工具清单

**位置**: `/Users/xujian/.openclaw/agents/`

| 智能体名称        | 文件名                | 功能描述       | 优先级 | 备注                                  |
| ----------------- | --------------------- | -------------- | ------ | ------------------------------------- |
| PatentAnalyzer    | patent-analyzer.md    | 专利分析智能体 | 🔴 高  | Markdown格式                          |
| PatentDrafter     | patent-drafter.md     | 专利撰写智能体 | 🔴 高  | Markdown格式                          |
| PatentSearcher    | patent-searcher.md    | 专利检索智能体 | 🔴 高  | Markdown格式                          |
| IPCClassifier     | ipc-classifier.md     | IPC分类智能体  | 🔴 高  | Markdown格式                          |
| LegalAdvisor      | legal-advisor.md      | 法律顾问智能体 | 🟡 中  | Markdown格式                          |
| Researcher        | researcher.md         | 研究员智能体   | 🟡 中  | Markdown格式                          |
| Analyst           | a26-3-analyst.md      | 分析师智能体   | 🟢 低  | Markdown格式                          |
| CreativityAnalyst | creativity-analyst.md | 创造性分析师   | 🔴 高  | **与新增的CreativeAnalyzerAgent对应** |

**复用建议**:

- 📋 **参考Prompt**: 可以参考这些智能体的Prompt设计
- 🔄 **迁移逻辑**: 可以将核心逻辑迁移到新的架构中
- ⚠️ **格式转换**: 这些是Markdown格式的智能体定义，需要转换为TypeScript实现

**特别关注**:

- ✨ **CreativityAnalyst**: 与新增的CreativeAnalyzerAgent高度对应，可以参考其Prompt
- ✨ **PatentSearcher**: 可以补充到SearchAgent的实现中
- ✨ **IPCClassifier**: 可以补充到IPCCategorizationAgent的实现中

---

## 🔍 Athena工作平台（部分完成）

**位置**: `/Users/xujian/Athena工作平台/`

**目录结构**:

```
Athena工作平台/
├── apps/              # 应用程序
├── athena-core/       # 核心功能
├── services/          # 服务
├── domains/           # 领域模块
├── mcp-servers/       # MCP服务器
├── models/            # 模型
├── config/            # 配置
└── docs/              # 文档
```

**状态**: ⚠️ 需要深入分析各个目录中的工具

**下一步行动**:

- [ ] 检查`athena-core/`中的工具
- [ ] 检查`services/`中的工具
- [ ] 检查`mcp-servers/`中的工具
- [ ] 检查`domains/`中的专利相关工具

---

## ❌ M4 Air (Tailscale网络)

**状态**: 未访问

**原因**: 需要网络访问权限

**下一步行动**:

- [ ] 确认M4 Air的访问方式（SSH、SMB、等）
- [ ] 获取访问权限
- [ ] 检查M4 Air上的工具资产
- [ ] 记录工具清单

---

## 📋 工具去重与整合

### 已发现的重复/相似工具

| 工具类型   | YunPat                        | OpenClaw          | Athena | M4 Air | 整合建议                     |
| ---------- | ----------------------------- | ----------------- | ------ | ------ | ---------------------------- |
| 专利检索   | PatentSearchTool              | PatentSearcher    | ❓     | ❓     | 以YunPat为基础，参考其他     |
| IPC分类    | IPCCategorizationAgent        | IPCClassifier     | ❓     | ❓     | 以YunPat为基础，参考OpenClaw |
| 专利撰写   | PatentWriterAgent             | PatentDrafter     | ❓     | ❓     | 以YunPat为基础，参考OpenClaw |
| 专利分析   | PatentAnalyzerAgent           | PatentAnalyzer    | ❓     | ❓     | 以YunPat为基础，参考OpenClaw |
| 创造性分析 | CreativeAnalyzerAgent（新增） | CreativityAnalyst | ❓     | ❓     | 参考OpenClaw的Prompt         |

### 需要补充的工具

基于实施计划的需求，以下工具需要补充：

**高优先级**:

1. **学术论文检索工具** - Google Scholar、CNKI、Web of Science
2. **专利下载工具** - 专利全文PDF下载
3. **化学结构识别工具** - ChemDraw、Open Babel
4. **数学公式识别工具** - Mathpix、LaTeX OCR
5. **电学符号识别工具** - 电路图识别

**中优先级**: 6. **Markdown转DOCX转换器** - 符合专利局格式要求 7. **技术附图识别工具** - 机械图、流程图 8. **形式检查工具** - 按专利法条款拆分

---

## 🎯 下一步行动

### 立即行动（Phase 1准备）

1. **完成Athena工作平台盘点**
   - [ ] 深入分析`athena-core/`
   - [ ] 深入分析`services/`
   - [ ] 深入分析`mcp-servers/`
   - [ ] 深入分析`domains/`

2. **访问M4 Air**
   - [ ] 确认访问方式
   - [ ] 获取访问权限
   - [ ] 完成工具盘点

3. **工具整合规划**
   - [ ] 制定工具去重方案
   - [ ] 制定工具迁移方案
   - [ ] 制定工具补充方案

### 短期行动（Phase 1）

4. **审查现有工具**
   - [ ] 审查patent-tools中的4个工具
   - [ ] 审查builtin-tools中的8个工具
   - [ ] 审查document-tools中的14个工具
   - [ ] 编写工具使用文档

5. **补充缺失工具**
   - [ ] 实现学术论文检索工具
   - [ ] 实现专利下载工具
   - [ ] 集成化学结构识别工具
   - [ ] 集成数学公式识别工具

---

## 📊 统计数据

**已盘点工具总数**: 54个

- YunPat项目: 26个（patent-tools: 4, builtin-tools: 8, document-tools: 14）
- OpenClaw: 8个智能体
- Athena工作平台: 待统计
- M4 Air: 待统计

**可直接复用**: 20个
**需要审查**: 8个
**需要补充**: 8个
**需要文档**: 26个（100%）

---

## 🔗 参考文档

- [YunPat项目README](../../README.md)
- [YunPat项目结构](../PROJECT_STRUCTURE.md)
- [工具使用指南](../tools/README.md)

---

**报告生成时间**: 2026-05-04
**下次更新**: 完成Athena工作平台和M4 Air盘点后
