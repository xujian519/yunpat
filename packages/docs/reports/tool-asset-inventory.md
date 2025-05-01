# YunPat 工具资产盘点报告

> **生成时间**: 2026-05-05
> **盘点范围**: packages/builtin-tools, packages/document-tools, packages/image-tools, packages/patent-tools
> **目的**: Phase 1 工具层验证 - 识别现有工具、重复功能、gaps

---

## 📊 工具统计概览

| 工具包             | TypeScript文件数 | 导出工具数 | 主要功能                                              |
| ------------------ | ---------------- | ---------- | ----------------------------------------------------- |
| **builtin-tools**  | 8                | 30+        | 文件操作、搜索、网络、浏览器、知识库、可视化          |
| **document-tools** | 14               | 40+        | PDF、DOCX、Excel、OCR、音频、通用文档、官文解析、PPTX |
| **image-tools**    | 2                | 2          | 化学结构识别、数学公式识别                            |
| **patent-tools**   | 6                | 15+        | 专利检索、权利要求生成、专利下载、谷歌专利            |
| **总计**           | **30**           | **87+**    | **专利撰写全流程工具链**                              |

---

## 🔍 详细工具清单

### 1. builtin-tools (基础工具集)

#### 1.1 文件工具 (FileTools.ts)

- `FileReadTool` - 文件读取
- `FileWriteTool` - 文件写入
- `FileAppendTool` - 文件追加
- `FileDeleteTool` - 文件删除
- `DirectoryListTool` - 目录列表

#### 1.2 搜索工具 (SearchTools.ts)

- `GrepTool` - 正则搜索
- `GlobTool` - 文件匹配
- `AcademicSearchTool` - 学术论文搜索

#### 1.3 网络工具 (NetworkTools.ts)

- `WebFetchTool` - 网页抓取
- `WebSearchTool` - 网页搜索

#### 1.4 浏览器工具 (WebTools.ts)

- `WebNavigateTool` - 网页导航
- `WebFindTabTool` - 查找标签页
- `WebSnapshotTool` - 网页快照
- `WebClickTool` - 点击元素
- `WebFillTool` - 填写表单
- `WebEvaluateTool` - 执行JS
- `WebScreenshotTool` - 截图
- `WebWaitTool` - 等待
- `WebExtractTextTool` - 提取文本
- `WebScrollTool` - 滚动页面

#### 1.5 知识库工具 (knowledge-search.ts)

- `KnowledgeSearchTool` - 知识库搜索
- `KnowledgeIndexBuilderTool` - 索引构建

#### 1.6 迭代搜索工具 (iterative-search.ts)

- `IterativeSearchTool` - 迭代搜索
- `PatentSearchTool` - 专利搜索

#### 1.7 可视化工具 (visualization-tools.ts)

- `MermaidChartTool` - Mermaid图表
- `PatentClaimsStructureTool` - 权利要求结构图
- `PatentProcessChartTool` - 专利流程图

---

### 2. document-tools (文档工具集)

#### 2.1 PDF工具 (PdfTools.ts)

- `PdfExtractTextTool` - 提取文本
- `PdfParseTool` - 解析PDF
- `PdfToMarkdownTool` - PDF转Markdown
- `PdfOcrTool` - PDF OCR识别

#### 2.2 DOCX工具 (DocxTools.ts)

- `DocxExtractTextTool` - 提取文本
- `DocxToHtmlTool` - DOCX转HTML
- `DocxToMarkdownTool` - DOCX转Markdown
- `DocxParseTool` - 解析DOCX

#### 2.3 Excel工具 (ExcelTools.ts)

- `ExcelReadTool` - 读取Excel
- `ExcelToJsonTool` - Excel转JSON
- `ExcelToMarkdownTool` - Excel转Markdown
- `ExcelParseTool` - 解析Excel

#### 2.4 OCR工具 (OcrTools.ts)

- `ImageOcrTool` - 图像OCR
- `BatchImageOcrTool` - 批量OCR
- `ImageToMarkdownTool` - 图像转Markdown

#### 2.5 音频工具 (AudioTools.ts)

- `AudioTranscriptionTool` - 音频转写
- `AudioToSrtTool` - 音频转SRT
- `AudioToVttTool` - 音频转VTT
- `AudioToMarkdownTool` - 音频转Markdown

#### 2.6 通用文档工具 (UniversalDocumentTool.ts)

- `UniversalDocumentParserTool` - 通用文档解析
- `BatchDocumentParserTool` - 批量文档解析
- `DocumentConverterTool` - 文档转换

#### 2.7 官文解析工具

- `OfficialDocParserTool` - 官文解析（依赖外部OCR）
- `OfficialDocParserToolV2` - 官文解析V2（不依赖外部OCR）

#### 2.8 专利文档生成工具 (PatentDocxGenerator.ts)

- `PatentApplicationGeneratorTool` - 专利申请生成
- `PatentClaimsGeneratorTool` - 权利要求生成
- `ResponseStatementGeneratorTool` - 答复陈述生成

#### 2.9 PPTX工具 (PptxTools.ts)

- `PptxExtractTextTool` - 提取文本
- `PatentPresentationTool` - 专利演示
- `TechnicalDisclosureTool` - 技术交底
- `PatentTrainingTool` - 专利培训

#### 2.10 文档协作工具 (DocumentCollaborationTools.ts)

- `DocumentCollaborationTool` - 文档协作
- `PatentTemplateLibraryTool` - 模板库

---

### 3. image-tools (图像识别工具集)

#### 3.1 化学结构工具 (ChemicalStructureTool.ts)

- `ChemicalStructureTool` - 化学结构识别

#### 3.2 数学公式工具 (MathFormulaTool.ts)

- `MathFormulaTool` - 数学公式识别

---

### 4. patent-tools (专利工具集)

#### 4.1 权利要求生成工具 (ClaimsGeneratorTool.ts)

- `ClaimsGeneratorTool` - 权利要求生成
- `FeatureExtractorTool` - 技术特征提取

#### 4.2 谷歌专利工具 (GooglePatentsTool.ts)

- `GooglePatentsFetchTool` - 谷歌专利抓取
- `GooglePatentDetailTool` - 谷歌专利详情

#### 4.3 专利搜索工具 (PatentSearchTool.ts)

- `PatentSearchTool` - 专利搜索
- `SimilarPatentSearchTool` - 相似专利搜索

#### 4.4 专利详情工具 (PatentDetailTool.ts)

- `PatentDetailTool` - 专利详情
- `HighCitationPatentsTool` - 高被引专利

#### 4.5 专利下载工具 (PatentDownloadTool.ts)

- `PatentDownloadTool` - 专利下载
- `BatchPatentDownloadTool` - 批量专利下载

---

## 🔄 工具功能去重分析

### 重复功能识别

| 功能               | 位置1                                       | 位置2                                   | 位置3                                  | 建议                                            |
| ------------------ | ------------------------------------------- | --------------------------------------- | -------------------------------------- | ----------------------------------------------- |
| **专利搜索**       | builtin-tools: `PatentSearchTool`           | patent-tools: `PatentSearchTool`        | patent-tools: `GooglePatentsFetchTool` | 保留patent-tools，删除builtin-tools中的重复实现 |
| **学术搜索**       | builtin-tools: `AcademicSearchTool`         | -                                       | -                                      | 无重复，保留                                    |
| **OCR识别**        | document-tools: `ImageOcrTool`              | document-tools: `PdfOcrTool`            | -                                      | 功能类似但用途不同，保留                        |
| **权利要求生成**   | document-tools: `PatentClaimsGeneratorTool` | patent-tools: `ClaimsGeneratorTool`     | -                                      | 功能重复，需要合并或明确职责边界                |
| **文档转Markdown** | document-tools: `PdfToMarkdownTool`         | document-tools: `DocxToMarkdownTool`    | document-tools: `ExcelToMarkdownTool`  | 针对不同格式，不算重复                          |
| **专利下载**       | patent-tools: `PatentDownloadTool`          | patent-tools: `BatchPatentDownloadTool` | -                                      | 批量vs单个，功能互补，保留                      |

### 去重建议清单

#### 🔴 高优先级（必须处理）

1. **专利搜索工具重复**
   - 删除 `builtin-tools/src/iterative-search.ts` 中的 `PatentSearchTool`
   - 统一使用 `patent-tools/src/tools/PatentSearchTool.ts`
   - 理由：避免维护两套相似逻辑

2. **权利要求生成工具重复**
   - 合并 `document-tools/src/tools/PatentDocxGenerator.ts` 中的 `PatentClaimsGeneratorTool`
   - 和 `patent-tools/src/tools/ClaimsGeneratorTool.ts` 中的 `ClaimsGeneratorTool`
   - 建议：保留patent-tools版本，document-tools调用它
   - 理由：职责单一，patent-tools专注专利业务逻辑

#### 🟡 中优先级（建议处理）

1. **谷歌专利工具定位不清**
   - `GooglePatentsFetchTool` 和 `GooglePatentDetailTool` 在patent-tools
   - `PatentSearchTool` 也支持谷歌专利搜索
   - 建议：明确职责边界或合并

#### 🟢 低优先级（可选处理）

1. **文档转换工具命名一致性**
   - `PdfToMarkdownTool`, `DocxToMarkdownTool`, `ImageToMarkdownTool`
   - 建议统一命名规范

---

## 🚧 工具Gaps识别

### 缺失工具清单

| 工具类别     | 缺失工具           | 优先级 | 建议                     |
| ------------ | ------------------ | ------ | ------------------------ |
| **专利检索** | 专利分类号检索工具 | 高     | 添加IPC/CPC分类检索      |
| **专利检索** | 引文网络分析工具   | 中     | 添加前向/后向引文分析    |
| **专利分析** | 专利价值评估工具   | 中     | 基于引用、家族、法律状态 |
| **专利分析** | 专利地图生成工具   | 低     | 技术路线图、竞争态势     |
| **文档处理** | 批量格式转换工具   | 中     | 支持多种格式互转         |
| **文档处理** | 文档版本对比工具   | 低     | 类似git diff的文档对比   |
| **图像处理** | 技术图纸识别工具   | 高     | 专利附图中的技术图纸     |
| **图像处理** | 化学结构数据库查询 | 中     | 识别后查询相似结构       |
| **学术检索** | 论文全文下载工具   | 高     | 支持arXiv、PubMed等      |
| **学术检索** | 学术图谱分析工具   | 低     | 作者合作网络、引用关系   |

### Week 5 新增工具验证

| 工具                    | 位置                             | 状态      | 验证结果                     |
| ----------------------- | -------------------------------- | --------- | ---------------------------- |
| `FormatConverter`       | packages/agents/format-converter | ✅ 已实现 | 需验证是否复用document-tools |
| `PatentDownloadTool`    | packages/patent-tools            | ✅ 已实现 | 已存在于patent-tools         |
| `AcademicSearchTool`    | packages/builtin-tools           | ✅ 已实现 | 已存在于builtin-tools        |
| `ChemicalStructureTool` | packages/image-tools             | ✅ 已实现 | 已存在于image-tools          |
| `MathFormulaTool`       | packages/image-tools             | ✅ 已实现 | 已存在于image-tools          |

---

## 📈 工具复用率估算

### 当前复用情况分析

**Week 5 Agent工具使用情况**：

- ✅ PriorArtSearchAgent → 使用PatentSearchTool
- ✅ QualityCheckerAgent → 使用ClaimsGeneratorTool
- ✅ ComparisonReportGeneratorAgent → 使用DocumentConverterTool
- ⚠️ UnityChecker → 未发现工具使用（纯LLM逻辑）
- ⚠️ SubjectMatterChecker → 未发现工具使用（纯LLM逻辑）
- ⚠️ ClaimsFormalityChecker → 未发现工具使用（纯LLM逻辑）
- ⚠️ SpecFormalityChecker → 未发现工具使用（纯LLM逻辑）

**复用率计算**：

- 工具使用率：3/7 = 42.9%
- 目标准：≥80%
- **差距：37.1%**

### 改进建议

1. **提高形式检查类Agent的工具使用**
   - ClaimsFormalityChecker应该使用权利要求解析工具
   - SpecFormalityChecker应该使用说明书解析工具
   - UnityChecker应该使用相似度计算工具

2. **创建工具组合模式**
   - 例如：专利质量检查工具组合
     - ClaimsGeneratorTool（权利要求生成）
     - PatentDetailTool（专利详情）
     - PatentSearchTool（对比文件）

3. **工具复用文档**
   - 为每个工具创建使用示例
   - 在Agent文档中明确引用的工具

---

## 🎯 下一步行动计划

### 立即行动（本周完成）

1. **✅ 工具资产盘点** - 已完成
2. **🔧 处理高优先级重复工具**
   - [ ] 删除builtin-tools中的PatentSearchTool重复实现
   - [ ] 合并权利要求生成工具
3. **📝 编写工具复用指南**
   - [ ] 创建工具使用文档
   - [ ] 创建Agent工具使用模板
4. **🔍 验证Week 5 Agent工具使用**
   - [ ] 检查7个Agent的工具使用情况
   - [ ] 提出工具使用改进建议

### 短期行动（下周完成）

1. **🚀 补充高优先级缺失工具**
   - [ ] 专利分类号检索工具
   - [ ] 技术图纸识别工具
   - [ ] 论文全文下载工具
2. **📊 提高工具复用率**
   - [ ] 重构4个形式检查Agent，增加工具使用
   - [ ] 验证复用率达到≥80%
3. **🧪 工具层集成测试**
   - [ ] 编写工具链测试
   - [ ] 验证工具协作正确性
   - [ ] 确保测试覆盖率≥90%

---

## 📋 总结

### 工具层现状

**优势** ✅：

- 工具数量充足（87+个工具）
- 覆盖专利撰写全流程
- 文档处理能力强
- 图像识别已起步

**劣势** ⚠️：

- 存在功能重复（专利搜索、权利要求生成）
- 工具复用率低（42.9% vs 目标80%）
- 缺少高优先级工具（分类检索、图纸识别）
- Week 5的Agent工具使用不足

### Phase 1 验证目标达成情况

| 指标         | 当前状态    | 目标 | 达成情况  |
| ------------ | ----------- | ---- | --------- |
| 工具资产盘点 | ✅ 完成     | 100% | ✅ 达成   |
| 工具去重     | ⚠️ 识别完成 | 100% | ⚠️ 待执行 |
| 工具复用率   | 42.9%       | ≥80% | ❌ 未达成 |
| 测试覆盖率   | 未统计      | ≥90% | ⚠️ 待统计 |
| 缺失工具补充 | 0/10        | 100% | ❌ 未达成 |

### 关键发现

1. **工具数量不是问题，复用才是关键**
   - 87+个工具足够支撑当前需求
   - 问题在于Agent没有充分使用已有工具

2. **Week 5开发暴露了工具层gaps**
   - 形式检查类Agent完全没有使用工具
   - 说明工具层可能缺少某些专用工具

3. **去重工作势在必行**
   - 专利搜索工具有2个实现
   - 权利要求生成工具有2个实现
   - 维护成本高，容易产生不一致

---

**报告生成者**: Claude (Sonnet 4.6)
**报告版本**: v1.0
**下次更新**: 完成去重工作后
