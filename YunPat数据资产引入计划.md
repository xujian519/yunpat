# YunPat 数据资产引入计划

> 来源：OpenClaw 智能体的技能与知识资产
> 目标：将 OpenClaw 的可用能力移植到 YunPat 专利智能体框架
> 生成时间：2026-04-29

---

## 一、资产盘点

### 1. OpenClaw 可复用技能（23个）

| 分类 | 技能 | 核心文件 | 专利相关度 |
|------|------|---------|-----------|
| **文档处理** | pdf | SKILL.md + 8个Python脚本 + forms.md + reference.md | ⭐⭐⭐ |
| **文档处理** | docx | SKILL.md + docx-js.md + ooxml.md + ooxml/schema + scripts/ | ⭐⭐⭐ |
| **文档处理** | xlsx | SKILL.md + recalc.py | ⭐⭐⭐ |
| **文档处理** | pptx | SKILL.md + ooxml.md + ooxml/schema | ⭐⭐ |
| **文档处理** | libreoffice-cli | SKILL.md | ⭐⭐ |
| **官文解析** | official-doc-parse | SKILL.md（Docling + GLM-OCR 方案） | ⭐⭐⭐⭐⭐ |
| **搜索** | iterative-search | skill.md + config.json + 4个指南文件 | ⭐⭐⭐ |
| **搜索** | web-access | SKILL.md + scripts/ + references/ | ⭐⭐⭐ |
| **可视化** | mermaid | SKILL.md | ⭐⭐ |
| **设计** | canvas-design | SKILL.md | ⭐ |
| **设计** | algorithmic-art | SKILL.md | ⭐ |
| **写作** | doc-coauthoring | SKILL.md | ⭐⭐ |
| **写作** | internal-comms | SKILL.md | ⭐ |
| **文档** | documentation-lookup | SKILL.md | ⭐ |
| **规划** | planning-workflow | SKILL.md | ⭐ |
| **规划** | project-planning | SKILL.md | ⭐ |
| **工具** | mcp-builder | SKILL.md + reference/ + scripts/ | ⭐⭐⭐ |
| **工具** | skill-creator | SKILL.md + references/ + scripts/ | ⭐⭐ |
| **工具** | webapp-testing | SKILL.md | ⭐ |
| **财务** | baochen-finance | (tool-based) | ⭐ |
| **邮件** | gmail-smtp | (config-based) | ⭐ |
| **主题** | theme-factory | SKILL.md | ⭐ |

**技能源路径：** `~/.openclaw/skills/<技能名>/`

### 2. YunPat 知识库资产（已有）

| 目录 | 文件数 | 内容 |
|------|--------|------|
| cards/ | 131 | LLM Wiki 结构化知识卡片 |
| 专利实务/ | 557 | 专利实务操作文档 |
| 复审无效/ | 207 | 复审无效决定 |
| 审查指南/ | 127 | 专利审查指南相关 |
| 专利判决/ | 84 | 判决文书 |
| 专利侵权/ | 69 | 侵权相关文档 |
| 法律法规/ | 41 | 法律法规条文 |
| 个人笔记/ | 42 | 个人学习笔记 |
| 书籍/ | 11 | 书籍摘录 |

**卡片覆盖主题（30+）：** 三步法、新颖性、创造性、实用性、充分公开、功能性特征、等同侵权、帮助侵权、bolar例外、职务发明、外观设计、化学领域专利、权利要求解释、技术方案、公知常识、冲突、一般消费者、权利用尽、专利无效、诉中禁令、证据认定等。

### 3. 卡片数据格式

每张卡片为 Markdown 文件，包含：
```yaml
- 来源问题: <原始问题>
- 质量分: 0.0~1.0
- 生成时间: ISO 8601
- 概念: <主题概念>
- 领域: <分类>
- 版本: 1
```
正文包含：核心回答、判断框架、关键原则、交叉引用（wiki-link）、法律依据、相关页面。

---

## 二、引入策略

### 原则
1. **不是照搬**，是将 OpenClaw 技能中的**处理逻辑和 Prompt 知识**提取出来，适配 YunPat 的 `BaseTool` 架构
2. **知识库优先**，工具能力其次
3. **分阶段引入**，每个阶段独立可用

### 引入路径

```
OpenClaw 技能 (SKILL.md + scripts/)
        ↓ 提取核心逻辑
YunPat BaseTool 插件 (packages/document-tools/src/)
        ↓ 注册到 ToolRegistry
YunPat 专利智能体 (patents/agents/writer|responder|analyzer|manager/)
        ↓ 调用工具 + 知识库
最终用户
```

---

## 三、分阶段实施计划

### Phase 1：知识库整合（1-2天）

**目标：** 让 131 张卡片 + 所有知识文档可被 YunPat 智能体检索

**任务清单：**

- [ ] **1.1** 将卡片目录结构标准化
  - 当前：`knowledge-base/cards/` 下 131 个扁平 md 文件
  - 建议：按概念分类建子目录（如 `cards/三步法/`、`cards/新颖性/`）
  - 或：保持扁平，建立索引文件 `cards/INDEX.md`

- [ ] **1.2** 建立卡片元数据索引
  - 解析每张卡片的 front-matter（概念、质量分、领域）
  - 生成 `knowledge-base/card-index.json`
  - 字段：`{ id, title, concept, quality, domain, filePath, relatedConcepts[] }`

- [ ] **1.3** 创建知识库检索 Tool
  ```
  packages/builtin-tools/src/knowledge-search.ts
  ```
  - 方法：基于关键词 + 概念匹配检索卡片
  - 返回：匹配的卡片内容 + 相关概念卡片
  - 后续可升级为向量检索（RAG）

- [ ] **1.4** 将知识库与 patents/prompts/ 整合
  - 在 writer/responder/analyzer 的 prompt 模板中引用知识库
  - 例如答复审查意见时，自动检索"创造性""三步法"相关卡片

**输出物：**
- `knowledge-base/card-index.json` — 卡片索引
- `packages/builtin-tools/src/knowledge-search.ts` — 知识检索工具
- 知识库可被任意智能体调用

---

### Phase 2：文档处理能力（2-3天）

**目标：** 引入 PDF/DOCX/XLSX 处理能力

**任务清单：**

- [ ] **2.1** PDF 处理工具
  - 源：`~/.openclaw/skills/pdf/`
  - 核心能力：提取文本/表格、PDF转图片、表单填写
  - 目标：`packages/document-tools/src/pdf-tool.ts`
  - 关键脚本可复用：
    - `scripts/extract_form_field_info.py`
    - `scripts/convert_pdf_to_images.py`
    - `scripts/fill_pdf_form.py`

- [ ] **2.2** DOCX 生成工具（专利文件撰写）
  - 源：`~/.openclaw/skills/docx/`
  - 核心能力：创建/编辑 Word 文档，OOXML 格式支持
  - 目标：`packages/document-tools/src/docx-tool.ts`
  - 专利场景：生成权利要求书、说明书、意见陈述书模板

- [ ] **2.3** 官文解析工具（最关键）
  - 源：`~/.openclaw/skills/official-doc-parse/`
  - 核心能力：Docling PDF解析 + GLM-OCR 字段提取
  - 目标：`packages/document-tools/src/official-doc-parser.ts`
  - 专利场景：解析审查意见通知书、复审无效决定、判决文书
  - 注意：需要确认 Docling 和 GLM-OCR(8009端口) 的部署状态

- [ ] **2.4** XLSX 处理工具
  - 源：`~/.openclaw/skills/xlsx/`
  - 核心能力：读写 Excel、公式计算
  - 目标：`packages/document-tools/src/xlsx-tool.ts`
  - 专利场景：案卷管理、费用统计、年费监控

**每个工具的适配模式：**
```typescript
import { BaseTool } from '@yunpat/core';

export class PdfTool extends BaseTool {
  name = 'pdf_processor';
  description = 'PDF文档处理：提取文本表格、转换格式、填写表单';
  
  schema = {
    action: { type: 'string', enum: ['extract', 'toImages', 'fillForm'] },
    filePath: { type: 'string' },
    options: { type: 'object' }
  };

  async execute(input: PdfInput): Promise<PdfOutput> {
    // 从 OpenClaw pdf/SKILL.md 提取的处理逻辑
    // 调用 Python 脚本或 JS 库实现
  }
}
```

---

### Phase 3：搜索与检索能力（1-2天）

**目标：** 引入智能搜索能力

**任务清单：**

- [ ] **3.1** 迭代搜索工具
  - 源：`~/.openclaw/skills/iterative-search/`
  - 核心能力：多轮迭代搜索 + LLM 分析，深度信息挖掘
  - 目标：`packages/builtin-tools/src/iterative-search.ts`
  - 专利场景：专利检索、现有技术搜索、法律条文查证

- [ ] **3.2** 网页访问工具
  - 源：`~/.openclaw/skills/web-access/`
  - 核心能力：网页抓取、CDP 协议控制浏览器
  - 目标：`packages/builtin-tools/src/web-access.ts`
  - 专利场景：查询 CNIPA/WIPO/ESPACENET 等专利数据库

---

### Phase 4：可视化与辅助能力（1-2天）

**目标：** 增强输出质量

**任务清单：**

- [ ] **4.1** Mermaid 图表工具
  - 源：`~/.openclaw/skills/mermaid/`
  - 专利场景：权利要求结构图、专利流程图、时序图

- [ ] **4.2** LibreOffice 格式转换工具
  - 源：`~/.openclaw/skills/libreoffice-cli/`
  - 专利场景：批量文档格式转换（doc↔pdf↔odt）

- [ ] **4.3** 文档协作写作工具
  - 源：`~/.openclaw/skills/doc-coauthoring/`
  - 专利场景：协作撰写专利文件

---

### Phase 5：MCP 协议封装（2-3天）

**目标：** 将工具封装为 MCP 服务，供外部智能体复用

**任务清单：**

- [ ] **5.1** 参考 `~/.openclaw/skills/mcp-builder/` 的最佳实践
- [ ] **5.2** 将 Phase 2-4 的工具封装为 MCP Server
  - `patents/mcp/patent-tools-server.ts`
  - 暴露工具：知识检索、官文解析、文档生成、专利检索
- [ ] **5.3** 编写 MCP 客户端配置，其他智能体可直接接入

---

## 四、技能文件提取指南

### 如何从 OpenClaw 技能提取有用信息

每个技能目录下 `SKILL.md` 是核心，它包含：
1. **触发条件** — 什么时候使用这个技能
2. **处理流程** — 具体步骤和逻辑
3. **代码示例** — 可直接复用的脚本
4. **参考信息** — 相关技术文档

**提取步骤：**
```bash
# 1. 读取技能核心
cat ~/.openclaw/skills/<技能名>/SKILL.md

# 2. 查看是否有脚本可复用
ls ~/.openclaw/skills/<技能名>/scripts/

# 3. 查看参考文档
ls ~/.openclaw/skills/<技能名>/reference/
ls ~/.openclaw/skills/<技能名>/references/
```

### 关键技能文件清单

| 技能 | 必读文件 |
|------|---------|
| official-doc-parse | `SKILL.md` (8KB，非常详细) |
| pdf | `SKILL.md` + `scripts/*.py` + `reference.md` |
| docx | `SKILL.md` + `docx-js.md` + `scripts/*.js` |
| xlsx | `SKILL.md` + `recalc.py` |
| iterative-search | `skill.md` + `QUICKREF.md` + `NATURAL_LANGUAGE_GUIDE.md` |
| web-access | `SKILL.md` + `scripts/*.mjs` |
| mermaid | `SKILL.md` |
| mcp-builder | `SKILL.md` + `reference/*.md` |

---

## 五、优先级总结

```
Phase 1 知识库整合     ████████████ 最高  ← 让131张卡片活起来
Phase 2 文档处理能力   ██████████   高   ← 专利核心工作流
Phase 5 MCP封装       ████████     中高 ← 让其他智能体也能用
Phase 3 搜索能力       ██████       中
Phase 4 可视化辅助     ████         低   ← 锦上添花
```

**建议启动顺序：** Phase 1 → Phase 2.3(官文解析) → Phase 2.2(DOCX) → Phase 5 → 其余按需

---

## 六、注意事项

1. **official-doc-parse 依赖外部服务**：需要 Docling 和 GLM-OCR(8009端口) 就绪
2. **Python 脚本依赖**：PDF/XLSX 的脚本需要 Python 环境和相关库
3. **OOXML Schema**：docx/pptx 的 schema 文件较重，建议只引入需要的部分
4. **知识库卡片扩展**：当前131张，可从 557份专利实务文档、207份复审无效决定中继续生成
5. **模型适配**：OpenClaw 技能基于 Claude 的 prompt，YunPat 用 DeepSeek，部分 prompt 需要调整措辞

---

*此文件由 OpenClaw 智能体生成，供 YunPat 项目 Claude Code 引入使用。*
