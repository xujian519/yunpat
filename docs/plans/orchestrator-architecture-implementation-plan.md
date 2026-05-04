# YunPat 编排器架构实施计划

**创建日期**: 2026-05-04
**版本**: v2.0 (基于用户5个想法优化)
**状态**: 🎯 待启动
**更新日期**: 2026-05-04

---

## 📋 目录

- [核心理念](#核心理念)
- [架构总览](#架构总览)
- [四阶段实施计划](#四阶段实施计划)
  - [Phase 1: 工具层验证](#phase-1-工具层验证)
  - [Phase 2: 执行层开发](#phase-2-执行层开发)
  - [Phase 3: 专业层重构](#phase-3-专业层重构)
  - [Phase 4: 中枢层实现](#phase-4-中枢层实现)
- [质量保证标准](#质量保证标准)
- [风险管理](#风险管理)
- [里程碑与验收](#里程碑与验收)

---

## 🎯 核心理念

### 三大优先级

1. **架构优先** - 方向的正确性 > 功能的完善度
2. **质量至上** - 稳定、质量、性能 > 速度
3. **充分利用资产** - 复用现有代码资产和数据资产

### 开发原则

- ✅ **严格TDD** - 测试驱动开发，覆盖率≥90%
- ✅ **真实LLM测试** - 不使用Mock，测试时可使用本地模型
- ✅ **自底向上** - 工具层 → 执行层 → 专业层 → 中枢层
- ✅ **每周检查** - 无时间压力，每周Code Review和测试验证
- ✅ **完整重构** - 不打补丁，从根本上重构架构
- ✅ **Karpathy编程原则** - 对抗LLM的三大默认缺陷（默默假设、过度复杂、无关修改）

#### Karpathy编程原则（四大原则）

**1. 编码前思考 (Think Before Coding)**

对抗默默假设、隐藏困惑、缺少权衡

- **明确说明假设** - 如果不确定，询问而非猜测
- **呈现多种解释** - 当存在歧义时，不要默默选择
- **适时提出异议** - 如果存在更简单的方法，说出来
- **困惑时停下来** - 指出不清楚的地方并要求澄清

**2. 简洁优先 (Simplicity First)**

对抗过度工程、臃肿抽象、推测未来

- 不添加要求之外的功能
- 不为一次性代码创建抽象
- 不添加未要求的"灵活性"或"可配置性"
- 如果200行能写成50行，重写它

**检验标准**: "资深工程师会觉得这过于复杂吗？如果是，简化。"

**3. 精准修改 (Surgical Changes)**

对抗无关编辑、触碰不应碰的代码、风格漂移

- **不"改进"相邻代码、注释或格式**
- **不重构没坏的东西**
- **匹配现有风格**，即使你更倾向于不同的写法
- **只删除自己改动造成的孤儿代码**

**检验标准**: "每一行修改都应该能直接追溯到用户的请求。"

**4. 目标驱动执行 (Goal-Driven Execution)**

对抗模糊指令、缺乏验证、无法独立循环

- **定义成功标准**
- **将指令式任务转化为可验证目标**
- **多步骤任务说明验证计划**
- **循环直到验证通过**

**转化示例**:

| 指令式（避免） | 声明式目标（推荐）                   |
| -------------- | ------------------------------------ |
| "添加验证"     | "为无效输入编写测试，然后让它们通过" |
| "修复bug"      | "编写重现bug的测试，然后让它通过"    |
| "重构X"        | "确保重构前后测试都能通过"           |

#### 智能触发机制

根据任务复杂度自动调整严格程度：

- **🟢 简化模式** - 单行修改、拼写错误修正、明显格式调整
- **🟡 标准模式** - 小功能实现、简单bug修复、单文件修改（默认）
- **🔴 完整模式** - 重构任务、架构设计、多文件修改、API设计

#### 本项目的应用

- **架构重构时**: 应用完整模式（🔴），深度思考、简洁优先、精准修改、目标驱动
- **新增智能体时**: 应用标准模式（🟡），适度思考、简洁优先、精准修改
- **修复bug时**: 应用简化模式（🟢），精准修改、目标驱动

#### 参考资源

- [完整文档和案例](https://github.com/forrestchang/andrej-karpathy-skills)
- [整合方案](~/.claude/CLAUDE_KARPATHY_INTEGRATION.md)
- [本地案例库](~/.claude/卡帕西/EXAMPLES.md)

---

## 🏗️ 架构总览

### 四层架构 + 1个中枢

```
┌─────────────────────────────────────────────────────────┐
│   Layer 0: OrchestratorAgent（中枢层）                   │
│   ┌─────────────────────────────────────────────────┐   │
│   │ • 意图识别 (Call 1) - 9个意图类型               │   │
│   │ • 任务规划 (Call 2) - TaskPlan生成              │   │
│   │ • HITL生成 (Call 3) - 人机交互确认              │   │
│   │ • 结果聚合 (Call 4) - 多智能体结果整合          │   │
│   │ • 异常降级 (Call 5) - 错误处理与降级            │   │
│   └─────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────┐
│   Layer 1: Domain Agents（专业层）                       │
│   ┌─────────────────────────────────────────────────┐   │
│   │ • PatentWriterAgent      - 专利撰写编排          │   │
│   │ • PatentResponderAgent   - 审查答复编排          │   │
│   │ • PatentAnalyzerAgent    - 专利分析编排          │   │
│   │ • CreativeAnalyzerAgent   - 创造性分析编排（新增）│   │
│   └─────────────────────────────────────────────────┘   │
│   职责：业务策略、任务编排、结果合成                      │
│   特点：有状态、不直接调用工具层                          │
└────────────────────┬────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────┐
│   Layer 2: Execution Agents（执行层）                    │
│   ┌─────────────────────────────────────────────────┐   │
│   │ 原有9个：                                       │   │
│   │ 1. SearchAgent              - 检索（简单+迭代）  │   │
│   │ 2. AnalysisAgent            - 技术特征分析      │   │
│   │ 3. QualityAgent             - 质量评估          │   │
│   │ 4. KnowledgeAgent           - 知识库查询        │   │
│   │ 5. DocumentAgent            - 文档解析          │   │
│   │ 6. ResearchAgent            - 技术研究          │   │
│   │ 7. PriorArtAnalysisAgent    - 现有技术分析      │   │
│   │ 8. IPCCategorizationAgent   - IPC分类           │   │
│   │ 9. SearchQueryBuilderAgent  - 检索式构建        │   │
│   │                                                 │   │
│   │ 新增6个：                                       │   │
│   │ 10. WritingAgent            - 撰写与格式转换    │   │
│   │ 11. TechnicalDrawingAgent   - 技术图纸识别      │   │
│   │ 12. ClaimsFormalityChecker  - 权利要求形式检查  │   │
│   │ 13. SpecFormalityChecker    - 说明书形式检查    │   │
│   │ 14. UnityChecker            - 单一性检查        │   │
│   │ 15. SubjectMatterChecker    - 客体检查          │   │
│   └─────────────────────────────────────────────────┘   │
│   职责：原子能力、单一职责、可并行调度                    │
│   特点：无状态、超时可控、无业务逻辑                      │
└────────────────────┬────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────┐
│   Layer 3: Tools（工具层）                               │
│   ┌─────────────────────────────────────────────────┐   │
│   │ • patent-tools    - 专利专用工具（4个）          │   │
│   │ • builtin-tools   - 内置基础工具（8个）          │   │
│   │ • document-tools  - 文档解析工具（14个）         │   │
│   │ • 学术论文检索    - Google Scholar/CNKI（新增）  │   │
│   │ • 化学结构识别    - ChemDraw/OpenBabel（新增）   │   │
│   │ • 数学公式识别    - Mathpix/LaTeX OCR（新增）    │   │
│   └─────────────────────────────────────────────────┘   │
│   职责：基础设施、外部API、数据库连接                     │
│   优化：充分利用已有工具，补充缺失工具                    │
└─────────────────────────────────────────────────────────┘
```

### 第一版支持的功能（9个意图）

**核心业务意图（6个）**：

| 意图代码            | 说明                                      | 复杂度  | 路由策略                          |
| ------------------- | ----------------------------------------- | ------- | --------------------------------- |
| `DRAFT_FULL`        | 完整专利撰写（检索+说明书+权利要求+摘要） | complex | 编排多步计划                      |
| `DRAFT_CLAIMS`      | 仅撰写/修改权利要求                       | simple  | 直接路由PatentWriterAgent         |
| `DRAFT_SPEC`        | 仅撰写说明书                              | simple  | 直接路由PatentWriterAgent         |
| `RESPOND_OA`        | 审查意见答复                              | complex | 直接路由PatentResponderAgent      |
| `SEARCH`            | 现有技术检索                              | simple  | 直接路由SearchAgent（跳过专业层） |
| `ANALYZE_PORTFOLIO` | 专利组合分析                              | complex | 路由PatentAnalyzerAgent           |

**系统意图（3个）**：

| 意图代码       | 说明                 | 处理方式             |
| -------------- | -------------------- | -------------------- |
| `MULTI_INTENT` | 一条消息包含多个任务 | 中枢拆分为多个子任务 |
| `CLARIFY`      | 意图不明确，需要追问 | 中枢生成追问语句     |
| `CHITCHAT`     | 闲聊、感谢、询问功能 | 中枢直接回复         |

**中期/长期规划**：

- 🕐 `MANAGE_STATUS`（中期）- 专利状态查询/年费管理
- 🕐 `ANALYZE_FTO`（长期）- 自由实施分析
- 🕐 `MONITOR_SETUP`（长期）- 竞争对手监控

---

## 🚀 四阶段实施计划

### Phase 1: 工具层验证

**周期**: 1-2周（新增工具盘点和补充）
**目标**: 充分利用已有工具，补充缺失工具，测试覆盖率≥90%

#### 任务清单

**1.1 审查patent-tools**

- [ ] 列出所有patent-tools中的工具函数
- [ ] 逐个测试每个工具的功能
- [ ] 记录问题清单和修复优先级
- [ ] 修复发现的问题
- [ ] 补充单元测试至≥90%覆盖率

**1.2 审查builtin-tools**

- [ ] 列出所有builtin-tools中的工具函数
- [ ] 逐个测试每个工具的功能
- [ ] 记录问题清单和修复优先级
- [ ] 修复发现的问题
- [ ] 补充单元测试至≥90%覆盖率

**1.3 审查document-tools**

- [ ] 测试PDF解析功能
- [ ] 测试Word解析功能
- [ ] 测试其他文档格式支持
- [ ] 修复发现的问题
- [ ] 补充单元测试至≥90%覆盖率

**1.4 工具资产盘点与整合** 🆕

- [ ] 完成Athena工作平台工具盘点
- [ ] 完成OpenClaw工具盘点（已完成8个智能体）
- [ ] 访问M4 Air（Tailscale）并完成工具盘点
- [ ] 生成工具去重清单
- [ ] 制定工具复用方案
- [ ] 参考工具盘点报告：[tools-inventory-report.md](./tools-inventory-report.md)

**1.5 补充缺失工具** 🆕

- [ ] 实现学术论文检索工具
  - [ ] Google Scholar检索
  - [ ] CNKI检索
  - [ ] Web of Science检索
- [ ] 实现专利下载工具
  - [ ] 专利全文PDF下载
  - [ ] 批量下载支持
- [ ] 集成化学结构识别工具
  - [ ] 调研并选择开源方案（Open Babel / RDKit）
  - [ ] 集成到TechnicalDrawingAgent
- [ ] 集成数学公式识别工具
  - [ ] 调研并选择开源方案（LaTeX OCR / Mathpix）
  - [ ] 集成到TechnicalDrawingAgent
- [ ] 编写单元测试（≥90%覆盖率）
- [ ] 编写集成测试
- [ ] 代码审查

**1.6 工具层集成测试**

- [ ] 创建工具层集成测试套件
- [ ] 测试工具链的端到端流程
- [ ] 性能基准测试（每个工具的响应时间）
- [ ] 生成工具层验收报告

#### 更新后的验收标准

- ✅ 所有工具函数单元测试覆盖率≥90%
- ✅ 所有工具函数集成测试通过
- ✅ 性能基准测试通过（每个工具响应时间<2s）
- ✅ 代码审查通过（无critical问题）
- ✅ 文档更新（工具API文档）
- ✅ **工具资产盘点完成**（4个位置全部盘点）
- ✅ **工具去重清单完成**
- ✅ **缺失工具补充完成**（学术论文检索、专利下载、化学结构、公式识别）
- ✅ **工具复用率≥80%**（充分利用已有工具）

#### 测试用例清单

```
patent-tools/
  ├─ IPC分类工具
  │   ├─ 测试IPC分类号识别
  │   ├─ 测试IPC分类号层级解析
  │   └─ 测试IPC分类号转换
  ├─ 检索工具
  │   ├─ 测试关键词检索
  │   ├─ 测试分类号检索
  │   └─ 测试组合检索
  └─ 其他专利专用工具...

builtin-tools/
  ├─ 字符串处理工具
  ├─ 日期处理工具
  ├─ 文件操作工具
  └─ 其他基础工具...

document-tools/
  ├─ PDF解析工具
  │   ├─ 测试纯文本PDF
  │   ├─ 测试扫描版PDF
  │   └─ 测试复杂格式PDF
  ├─ Word解析工具
  └─ 其他文档格式工具...
```

#### 风险与应对

| 风险                    | 影响 | 应对措施                           |
| ----------------------- | ---- | ---------------------------------- |
| 工具依赖的外部API不稳定 | 高   | 实现Mock模式，测试时使用本地数据   |
| 工具性能不达标          | 中   | 性能优化，或考虑并行处理           |
| 工具功能缺失            | 中   | 优先实现核心功能，次要功能后续补充 |

---

### Phase 2: 执行层开发

**周期**: 4-5周（新增6个智能体）
**目标**: 实现15个执行层智能体，每个TDD，单元测试≥90%

#### 任务清单

**2.1 实现SearchAgent（Week 1）**

- [ ] 设计SearchAgent接口（继承BaseExecutionAgent）
- [ ] 实现简单检索模式（一次性检索）
- [ ] 实现迭代检索模式（多轮检索+策略优化）
- [ ] 集成patent-tools的检索功能
- [ ] 编写单元测试（≥90%覆盖率）
- [ ] 编写集成测试（Mock工具层）
- [ ] 性能测试（检索响应时间<5s）
- [ ] 代码审查

**SearchAgent详细设计**:

```typescript
interface SearchAgentConfig {
  defaultMode: 'simple' | 'iterative'
  maxIterations: number // 迭代模式最大轮数
  timeout: number // 单次检索超时（ms）
}

interface SearchInput {
  query: string
  databases: string[] // ['cn_patent', 'us_patent', ...]
  options: {
    mode: 'simple' | 'iterative'
    maxResults: number
    dateRange?: { start: Date; end: Date }
  }
}

interface SearchResult {
  patentId: string
  title: string
  abstract: string
  relevanceScore: number
  metadata: Record<string, any>
}

interface IterativeSearchResult extends SearchResult {
  iterationCount: number
  refinedQueries: string[]
  strategyAdjustments: string[]
}
```

**2.2 实现AnalysisAgent（Week 1）**

- [ ] 设计AnalysisAgent接口
- [ ] 实现技术特征提取
- [ ] 实现技术特征比对
- [ ] 实现相似度计算
- [ ] 编写单元测试（≥90%覆盖率）
- [ ] 编写集成测试
- [ ] 代码审查

**2.3 实现QualityAgent（Week 2）**

- [ ] 设计QualityAgent接口
- [ ] 实现格式检查
- [ ] 实现逻辑一致性校验
- [ ] 实现法律语言合规审查
- [ ] 编写单元测试（≥90%覆盖率）
- [ ] 编写集成测试
- [ ] 代码审查

**2.4 实现KnowledgeAgent（Week 2）**

- [ ] 设计KnowledgeAgent接口
- [ ] 集成ObsidianKnowledgeBridge
- [ ] 实现知识卡片检索
- [ ] 实现知识卡片过滤
- [ ] 编写单元测试（≥90%覆盖率）
- [ ] 编写集成测试
- [ ] 代码审查

**2.5 实现DocumentAgent（Week 2）**

- [ ] 设计DocumentAgent接口
- [ ] 集成document-tools
- [ ] 实现PDF解析
- [ ] 实现Word解析
- [ ] 实现文档结构化提取
- [ ] 编写单元测试（≥90%覆盖率）
- [ ] 编写集成测试
- [ ] 代码审查

**2.6 实现ResearchAgent（Week 3）**

- [ ] 设计ResearchAgent接口
- [ ] 实现技术领域理解
- [ ] 实现技术发展趋势分析
- [ ] 编写单元测试（≥90%覆盖率）
- [ ] 编写集成测试
- [ ] 代码审查

**2.7 实现PriorArtAnalysisAgent（Week 3）**

- [ ] 设计PriorArtAnalysisAgent接口
- [ ] 实现申请日与公开日对比
- [ ] 实现证据有效性判断（新颖性/创造性）
- [ ] 编写单元测试（≥90%覆盖率）
- [ ] 编写集成测试
- [ ] 代码审查

**2.8 实现IPCCategorizationAgent（Week 3）**

- [ ] 设计IPCCategorizationAgent接口
- [ ] 实现IPC分类号识别
- [ ] 实现IPC分类号分析
- [ ] 编写单元测试（≥90%覆盖率）
- [ ] 编写集成测试
- [ ] 代码审查

**2.9 实现SearchQueryBuilderAgent（Week 4）**

- [ ] 设计SearchQueryBuilderAgent接口
- [ ] 实现技术特征提取
- [ ] 实现检索式构建逻辑
- [ ] 实现检索式优化
- [ ] 编写单元测试（≥90%覆盖率）
- [ ] 编写集成测试
- [ ] 代码审查

**2.10 执行层集成测试（Week 4）**

- [ ] 创建执行层集成测试套件
- [ ] 测试智能体之间的协作
- [ ] 测试并行调度（Promise.all）
- [ ] 测试超时处理
- [ ] 测试错误恢复
- [ ] 性能基准测试
- [ ] 生成执行层验收报告

---

#### 🆕 新增6个执行层智能体（Week 4-5）

**2.11 实现WritingAgent（Week 4）**

**职责**: 格式转换（Markdown → DOCX），不负责内容生成

**任务清单**:

- [ ] 设计WritingAgent接口
- [ ] 复用`document-tools/PatentDocxGenerator.ts`
- [ ] 实现Markdown → 结构化内容转换
- [ ] 实现结构化内容 → DOCX转换
- [ ] 实现专利局格式规范验证
- [ ] 实现自动化格式检查
- [ ] 编写单元测试（≥90%覆盖率）
- [ ] 编写集成测试
- [ ] 代码审查

**WritingAgent详细设计**:

```typescript
interface WritingAgentConfig {
  outputFormat: 'markdown' | 'docx'
  patentOfficeFormat: 'CNIPA' | 'USPTO' | 'EPO'
  autoFormatCheck: boolean
}

interface WritingInput {
  content: {
    claims: string[] // 权利要求（结构化）
    specification: {
      // 说明书（结构化）
      title: string
      technicalField: string
      backgroundArt: string
      summary: string
      briefDescription: string
      detailedDescription: string
      examples: string[]
    }
    abstract: string
    drawings?: string[] // 附图说明
  }
  metadata: {
    applicationNumber?: string
    inventionTitle: string
    applicant?: string
    inventor?: string
  }
}

interface WritingOutput {
  markdown: string // Markdown格式
  docx: Buffer // DOCX二进制
  formatCheckReport: {
    // 格式检查报告
    passed: boolean
    errors: string[]
    warnings: string[]
  }
}
```

**2.12 实现TechnicalDrawingAgent（Week 4）**

**职责**: 技术图纸识别（附图、化学结构、公式、电学符号）

**任务清单**:

- [ ] 设计TechnicalDrawingAgent接口
- [ ] 复用`document-tools/OcrTools.ts`
- [ ] 集成开源化学结构识别工具（Open Babel / RDKit）
- [ ] 集成开源公式识别工具（LaTeX OCR）
- [ ] 实现说明书附图识别
- [ ] 实现化学结构识别（SMILES / InChI）
- [ ] 实现数学公式识别（LaTeX）
- [ ] 实现电学符号识别
- [ ] 编写单元测试（≥90%覆盖率）
- [ ] 编写集成测试
- [ ] 代码审查

**推荐开源方案**:

- **化学结构**: Open Babel、RDKit、Indigo
- **数学公式**: Mathpix API、LaTeX OCR、Pix2Tex
- **通用OCR**: Tesseract、PaddleOCR
- **电学符号**: 自定义训练模型（基于YOLO）

**2.13 实现ClaimsFormalityChecker（Week 4）**

**职责**: 权利要求形式检查（4个核心条款）

**任务清单**:

- [ ] 设计ClaimsFormalityChecker接口
- [ ] 实现第26条第4款检查（清楚、简要）
- [ ] 实现第26条第4款检查（权利要求书支持）
- [ ] 实现第4条第1款检查（发明/实用新型定义）
- [ ] 实现实施细则第20条第1款检查（非必要技术特征）
- [ ] 实现形式问题自动标记
- [ ] 实现修改建议生成
- [ ] 编写单元测试（≥90%覆盖率）
- [ ] 编写集成测试
- [ ] 代码审查

**ClaimsFormalityChecker详细设计**:

```typescript
interface ClaimsFormalityCheckResult {
  article26_4_clarity: {
    // 第26条第4款（清楚、简要）
    passed: boolean
    issues: {
      claimNumber: number
      issue: string
      suggestion: string
    }[]
  }
  article26_4_support: {
    // 第26条第4款（权利要求书支持）
    passed: boolean
    issues: {
      claimNumber: number
      unsupportedFeature: string
      suggestion: string
    }[]
  }
  article4_1_definition: {
    // 第4条第1款（发明/实用新型定义）
    passed: boolean
    patentType: 'invention' | 'utilityModel'
    issues: {
      claimNumber: number
      issue: string
      suggestion: string
    }[]
  }
  rule20_1_necessaryFeatures: {
    // 实施细则第20条第1款
    passed: boolean
    unnecessaryFeatures: {
      claimNumber: number
      feature: string
      reason: string
    }[]
  }
  overallReport: {
    passed: boolean
    totalIssues: number
    criticalIssues: number
    recommendations: string[]
  }
}
```

**2.14 实现SpecFormalityChecker（Week 5）**

**职责**: 说明书形式检查（充分公开）

**任务清单**:

- [ ] 设计SpecFormalityChecker接口
- [ ] 实现第26条第3款检查（充分公开）
- [ ] 实现技术问题、方案、效果完整性检查
- [ ] 实现实施例充分性检查
- [ ] 实现形式问题自动标记
- [ ] 实现修改建议生成
- [ ] 编写单元测试（≥90%覆盖率）
- [ ] 编写集成测试
- [ ] 代码审查

**2.15 实现UnityChecker（Week 5）**

**职责**: 单一性检查

**任务清单**:

- [ ] 设计UnityChecker接口
- [ ] 实现第31条检查（单一性）
- [ ] 实现权利要求之间的关联性分析
- [ ] 实现单一性缺陷识别
- [ ] 实现分案建议生成
- [ ] 编写单元测试（≥90%覆盖率）
- [ ] 编写集成测试
- [ ] 代码审查

**2.16 实现SubjectMatterChecker（Week 5）**

**职责**: 客体检查（不授予专利权的客体）

**任务清单**:

- [ ] 设计SubjectMatterChecker接口
- [ ] 实现第25条检查（不授予专利权的客体）
  - [ ] 科学发现
  - [ ] 智力活动规则
  - [ ] 疾病诊断治疗方法
  - [ ] 动植物品种
  - [ ] 原子核变换方法
- [ ] 实现客体问题识别
- [ ] 实现排除建议生成
- [ ] 编写单元测试（≥90%覆盖率）
- [ ] 编写集成测试
- [ ] 代码审查

**2.17 执行层集成测试（Week 5）**

- [ ] 更新执行层集成测试套件
- [ ] 测试新增6个智能体
- [ ] 测试智能体之间的协作
- [ ] 测试并行调度（Promise.all）
- [ ] 测试超时处理
- [ ] 测试错误恢复
- [ ] 性能基准测试
- [ ] 生成执行层验收报告

---

#### 更新后的验收标准

- ✅ **15个执行层智能体**全部实现（原有9个 + 新增6个）
- ✅ 每个智能体单元测试覆盖率≥90%
- ✅ 每个智能体集成测试通过
- ✅ 并行调度测试通过
- ✅ 超时处理测试通过
- ✅ 性能基准测试通过
- ✅ 代码审查全部通过
- ✅ 工具复用率≥80%（充分利用已有工具）

#### 验收标准

- ✅ 9个执行层智能体全部实现
- ✅ 每个智能体单元测试覆盖率≥90%
- ✅ 每个智能体集成测试通过
- ✅ 并行调度测试通过
- ✅ 超时处理测试通过
- ✅ 性能基准测试通过
- ✅ 代码审查全部通过

#### 测试用例清单

```
SearchAgent/
  ├─ 简单检索模式
  │   ├─ 测试关键词检索
  │   ├─ 测试分类号检索
  │   ├─ 测试组合检索
  │   ├─ 测试结果排序
  │   └─ 测试结果过滤
  ├─ 迭代检索模式
  │   ├─ 测试第一轮检索
  │   ├─ 测试结果评估
  │   ├─ 测试策略调整
  │   ├─ 测试第二轮检索
  │   └─ 测试收敛条件
  ├─ 错误处理
  │   ├─ 测试超时处理
  │   ├─ 测试无结果处理
  │   └─ 测试API失败处理
  └─ 性能测试
      ├─ 测试响应时间
      └─ 测试并发检索

AnalysisAgent/
  ├─ 技术特征提取
  ├─ 技术特征比对
  ├─ 相似度计算
  └─ 错误处理

QualityAgent/
  ├─ 格式检查
  ├─ 逻辑一致性校验
  ├─ 法律语言合规审查
  └─ 错误处理

KnowledgeAgent/
  ├─ 知识卡片检索
  ├─ 知识卡片过滤
  ├─ 知识卡片排序
  └─ 错误处理

DocumentAgent/
  ├─ PDF解析
  ├─ Word解析
  ├─ 文档结构化提取
  └─ 错误处理

ResearchAgent/
  ├─ 技术领域理解
  ├─ 技术发展趋势分析
  └─ 错误处理

PriorArtAnalysisAgent/
  ├─ 申请日与公开日对比
  ├─ 证据有效性判断
  └─ 错误处理

IPCCategorizationAgent/
  ├─ IPC分类号识别
  ├─ IPC分类号分析
  └─ 错误处理

SearchQueryBuilderAgent/
  ├─ 技术特征提取
  ├─ 检索式构建
  ├─ 检索式优化
  └─ 错误处理
```

#### 风险与应对

| 风险                   | 影响 | 应对措施                     |
| ---------------------- | ---- | ---------------------------- |
| 智能体实现复杂度超预期 | 高   | 拆分为更小的子任务，分步实现 |
| 性能不达标             | 中   | 优化算法，或增加缓存         |
| 测试覆盖率不足         | 中   | 补充边界案例测试             |
| 并行调度冲突           | 低   | 使用独立的执行上下文         |

---

### Phase 3: 专业层重构

**周期**: 3-4周
**目标**: 将4个智能体重构为纯编排层，不直接调用工具层（原有3个 + 新增1个）

#### 任务清单

**3.1 重构PatentWriterAgent（Week 1-2）**

**Week 1: 架构重构**

- [ ] 分析现有PatentWriterAgent的职责
- [ ] 识别需要下沉到执行层的逻辑
- [ ] 设计新的PatentWriterAgent接口（纯编排层）
- [ ] 实现发明的理解（调用执行层）
- [ ] 实现检索编排（调用SearchAgent）
- [ ] 实现知识库查询编排（调用KnowledgeAgent）

**Week 2: 撰写流程实现**

- [ ] 实现权利要求撰写编排（调用AnalysisAgent）
- [ ] 实现说明书撰写编排
- [ ] 实现摘要生成编排
- [ ] 实现质量检查编排（调用QualityAgent）
- [ ] 编写集成测试（Mock执行层）
- [ ] 代码审查

**PatentWriterAgent重构前后对比**:

```
重构前（直接调用工具层）:
PatentWriterAgent
  ├─ 直接调用patent-tools.search()
  ├─ 直接调用patent-tools.analyze()
  ├─ 直接调用patent-core
  └─ 自己实现检索、分析、撰写逻辑

重构后（纯编排层）:
PatentWriterAgent
  ├─ 调用SearchAgent（检索）
  ├─ 调用KnowledgeAgent（知识库）
  ├─ 调用AnalysisAgent（特征分析）
  ├─ 调QualityAgent（质量检查）
  └─ 自己只负责：业务策略、任务编排、结果合成
```

**3.2 重构PatentResponderAgent（Week 2-3）**

**Week 2: OA解析重构**

- [ ] 分析现有PatentResponderAgent的职责
- [ ] 保留patent-core集成（OA解析）
- [ ] 设计新的PatentResponderAgent接口
- [ ] 实现OA解析（保留现有逻辑）
- [ ] 实现答复策略决策

**Week 3: 答复流程重构**

- [ ] 实现反证检索编排（调用SearchAgent）
- [ ] 实现技术比对编排（调用AnalysisAgent）
- [ ] 实现答复模板查询编排（调用KnowledgeAgent）
- [ ] 实现答复文件生成编排
- [ ] 编写集成测试（Mock执行层）
- [ ] 代码审查

**3.3 重构PatentAnalyzerAgent（Week 3-4）**

- [ ] 分析现有PatentAnalyzerAgent的职责
- [ ] 识别需要下沉到执行层的逻辑
- [ ] 设计新的PatentAnalyzerAgent接口
- [ ] 实现专利组合分析编排
- [ ] 实现技术分布分析编排（调用AnalysisAgent）
- [ ] 实现价值评估编排
- [ ] 编写集成测试（Mock执行层）
- [ ] 代码审查

**3.4 实现CreativeAnalyzerAgent（Week 4）** 🆕

**职责**: 创造性分析编排（参考OpenClaw的CreativityAnalyst）

**任务清单**:

- [ ] 设计CreativeAnalyzerAgent接口
- [ ] 参考OpenClaw的CreativityAnalyst Prompt
- [ ] 实现检索编排（现有技术检索）
- [ ] 实现对比编排（区别特征分析）
- [ ] 实现技术效果判断编排
- [ ] 实现创造性结论生成
- [ ] 实现显而易见性判断
- [ ] 编写集成测试（Mock执行层）
- [ ] 代码审查

**CreativeAnalyzerAgent详细设计**:

```typescript
interface CreativityAnalysisInput {
  targetPatent: {
    claims: string[]
    specification: string
    applicationDate: Date
  }
  priorArt: {
    patentId: string
    publicationDate: Date
    content: string
  }[]
}

interface CreativityAnalysisOutput {
  distinctFeatures: {
    // 区别特征
    feature: string
    source: 'claim' | 'specification'
    description: string
  }[]
  technicalEffect: {
    // 技术效果
    effect: string
    evidence: string
    unexpected?: boolean // 是否预料不到
  }[]
  obviousness: {
    // 显而易见性
    assessment: 'obvious' | 'non-obvious' | 'uncertain'
    reasoning: string
    problemSolutionApproach?: {
      problem: string
      solution: string
      motivation: string
    }
  }
  conclusion: {
    creative: boolean
    confidence: number
    supportingEvidence: string[]
    recommendedActions: string[]
  }
}
```

**3.5 专业层集成测试（Week 4）**

- [ ] 创建专业层集成测试套件
- [ ] 测试PatentWriterAgent完整流程
- [ ] 测试PatentResponderAgent完整流程
- [ ] 测试PatentAnalyzerAgent完整流程
- [ ] 测试CreativeAnalyzerAgent完整流程 🆕
- [ ] 测试专业层与执行层的交互
- [ ] 测试HITL检查点
- [ ] 生成专业层验收报告

#### 更新后的验收标准

- ✅ **4个专业层智能体**全部实现（原有3个重构 + 新增1个）
- ✅ 专业层不直接调用工具层（仅通过执行层）
- ✅ 每个智能体集成测试通过
- ✅ HITL检查点测试通过
- ✅ 代码审查全部通过
- ✅ 文档更新（专业层架构文档）
- ✅ **OpenClaw资产复用**（参考CreativityAnalyst）

#### 测试用例清单

```
PatentWriterAgent/
  ├─ 发明理解
  │   ├─ 测试技术特征提取编排
  │   ├─ 测试发明点识别编排
  │   └─ 测试技术效果分析编排
  ├─ 检索编排
  │   ├─ 测试SearchAgent调用
  │   ├─ 测试检索结果评估
  │   └─ 测试迭代检索触发
  ├─ 知识库查询编排
  │   ├─ 测试KnowledgeAgent调用
  │   └─ 测试知识卡片过滤
  ├─ 权利要求撰写编排
  │   ├─ 测试AnalysisAgent调用
  │   ├─ 测试保护策略决策
  │   └─ 测试权利要求生成
  ├─ 说明书撰写编排
  │   ├─ 测试章节规划
  │   └─ 测试内容生成
  ├─ 质量检查编排
  │   ├─ 测试QualityAgent调用
  │   └─ 测试问题修复流程
  └─ HITL检查点
      ├─ 测试权利要求确认
      └─ 测试修改反馈处理

PatentResponderAgent/
  ├─ OA解析
  │   ├─ 测试审查意见类型识别
  │   ├─ 测试拒绝理由提取
  │   └─ 测试引证文件解析
  ├─ 答复策略决策
  │   ├─ 测试修改权利要求策略
  │   ├─ 测试争辩策略
  │   └─ 测试组合策略
  ├─ 反证检索编排
  │   ├─ 测试SearchAgent调用
  │   └─ 测试反证文献评估
  ├─ 技术比对编排
  │   ├─ 测试AnalysisAgent调用
  │   └─ 测试差异点识别
  ├─ 答复文件生成编排
  │   ├─ 测试意见陈述生成
  │   └─ 测试修改后权利要求生成
  └─ HITL检查点
      ├─ 测试答复策略确认
      └─ 测试修改反馈处理

PatentAnalyzerAgent/
  ├─ 专利组合分析编排
  │   ├─ 测试组合范围确定
  │   ├─ 测试技术领域分析
  │   └─ 测试时间轴生成
  ├─ 技术分布分析编排
  │   ├─ 测试AnalysisAgent调用
  │   └─ 测试技术聚类
  ├─ 价值评估编排
  │   ├─ 测试价值指标计算
  │   └─ 测试维持建议生成
  └─ 报告生成编排
      ├─ 测试数据可视化
      └─ 测试报告导出
```

#### 风险与应对

| 风险             | 影响 | 应对措施                       |
| ---------------- | ---- | ------------------------------ |
| 重构导致功能回归 | 高   | 完整的回归测试，保留旧代码对比 |
| 业务逻辑复杂度高 | 中   | 分步重构，每步验证             |
| 执行层依赖不稳定 | 中   | 使用Mock进行集成测试           |
| 性能下降         | 低   | 性能基准测试，优化编排逻辑     |

---

### Phase 4: 中枢层实现

**周期**: 4-5周
**目标**: 实现OrchestratorAgent，完整5次LLM调用

#### 任务清单

**4.1 实现意图识别（Call 1）（Week 1）**

- [ ] 设计意图识别接口
- [ ] 实现System Prompt（角色+规则）
- [ ] 实现9个意图类型的分类逻辑
- [ ] 实现Few-shot示例库
- [ ] 实现置信度计算
- [ ] 实现字段提取（title、field、hasAttachment等）
- [ ] 实现CLARIFY追问生成
- [ ] 编写单元测试（≥90%覆盖率）
- [ ] 编写集成测试（使用真实LLM）
- [ ] 代码审查

**意图识别详细设计**:

```typescript
interface IntentClassificationResult {
  intent: IntentType
  confidence: number
  complexity: 'simple' | 'complex'
  extracted: {
    title?: string
    field?: string
    hasAttachment: boolean
    urgency: 'normal' | 'urgent'
  }
  clarifyQuestion?: string // 仅当intent=CLARIFY时
}

type IntentType =
  | 'DRAFT_FULL'
  | 'DRAFT_CLAIMS'
  | 'DRAFT_SPEC'
  | 'RESPOND_OA'
  | 'SEARCH'
  | 'ANALYZE_PORTFOLIO'
  | 'MULTI_INTENT'
  | 'CLARIFY'
  | 'CHITCHAT'
```

**4.2 实现任务规划（Call 2）（Week 1-2）**

- [ ] 设计任务规划接口
- [ ] 实现System Prompt（角色+规则）
- [ ] 实现TaskPlan生成逻辑
- [ ] 实现步骤依赖关系管理
- [ ] 实现并行标记逻辑
- [ ] 实现HITL检查点生成
- [ ] 实现超时设置逻辑
- [ ] 编写单元测试（≥90%覆盖率）
- [ ] 编写集成测试（使用真实LLM）
- [ ] 代码审查

**任务规划详细设计**:

```typescript
interface TaskPlan {
  planId: string
  intent: IntentType
  estimatedMinutes: number
  steps: TaskStep[]
  hitlCheckpoints: string[] // 需要用户确认的stepId列表
}

interface TaskStep {
  stepId: string
  agentId: string
  layer: 'domain' | 'execution'
  parallel: boolean
  dependsOn: string[] // 依赖的stepId列表
  timeout: number
  input: Record<string, any>
  hitl: boolean
  hitlDescription?: string
}
```

**4.3 实现HITL生成（Call 3）（Week 2）**

- [ ] 设计HITL生成接口
- [ ] 实现System Prompt（角色+规则）
- [ ] 实现HITL请求生成逻辑
- [ ] 实现HITL响应解析逻辑
- [ ] 实现确认/修改/重新生成的处理
- [ ] 编写单元测试（≥90%覆盖率）
- [ ] 编写集成测试（使用真实LLM）
- [ ] 代码审查

**4.4 实现结果聚合（Call 4）（Week 2-3）**

- [ ] 设计结果聚合接口
- [ ] 实现System Prompt（角色+规则）
- [ ] 实现多智能体结果整合逻辑
- [ ] 实现Markdown格式化
- [ ] 实现附件列表生成
- [ ] 实现建议操作生成
- [ ] 编写单元测试（≥90%覆盖率）
- [ ] 编写集成测试（使用真实LLM）
- [ ] 代码审查

**4.5 实现异常降级（Call 5）（Week 3）**

- [ ] 设计异常降级接口
- [ ] 实现System Prompt（角色+规则）
- [ ] 实现四类异常场景的降级策略
  - [ ] 执行层超时/工具调用失败
  - [ ] 意图识别置信度低
  - [ ] LLM输出格式错误
  - [ ] 专业层业务异常
- [ ] 实现降级回复生成
- [ ] 实现替代方案生成
- [ ] 编写单元测试（≥90%覆盖率）
- [ ] 编写集成测试（使用真实LLM）
- [ ] 代码审查

**4.6 实现上下文管理（Week 3）**

- [ ] 设计OrchestratorContext接口
- [ ] 实现对话历史管理
- [ ] 实现对话历史压缩策略
- [ ] 实现活跃任务状态管理
- [ ] 实现用户画像管理
- [ ] 实现知识域管理
- [ ] 实现HITL等待状态管理
- [ ] 实现Token预算控制
- [ ] 编写单元测试（≥90%覆盖率）
- [ ] 代码审查

**上下文管理详细设计**:

```typescript
interface OrchestratorContext {
  sessionId: string
  userId: string
  conversationHistory: Message[]
  activeTaskPlan?: TaskPlan
  pendingHITL?: HITLCheckpoint
  agentSnapshots: Map<string, AgentState>
  knowledgeScope: string[]
  userProfile: UserProfile
}

interface UserProfile {
  role: 'patent_agent' | 'lawyer' | 'enterprise_ip'
  outputFormat: 'detailed' | 'concise'
  domains: string[]
}
```

**4.7 实现EventBus通信协议（Week 3-4）**

- [ ] 复用现有EventBus（53个测试用例）
- [ ] 实现中枢→专业层的通信协议
- [ ] 实现专业层→中枢的通信协议
- [ ] 实现执行层并行调度协议
- [ ] 实现错误传播机制
- [ ] 编写集成测试
- [ ] 代码审查

**EventBus通信协议**:

```typescript
// 中枢 → 专业层
eventBus.emit('agent:dispatch', {
  agentId: 'patent-writer',
  taskId: uuid(),
  payload: contextSnapshot,
  timeout: 30_000,
})

// 专业层 → 中枢
eventBus.emit('agent:complete', {
  taskId,
  agentId: 'patent-writer',
  result: DraftResult,
  requiresHITL: true,
  hitlCheckpoint: 'review-claims',
})

// 执行层并行任务
eventBus.emitAll([
  { event: 'exec:search', payload: query },
  { event: 'exec:knowledge', payload: templateQuery },
])
```

**4.8 实现OrchestratorAgent主流程（Week 4）**

- [ ] 实现主流程编排
- [ ] 实现意图识别→路由决策
- [ ] 实现简单路由（单智能体直达）
- [ ] 实现复杂编排（TaskPlan执行）
- [ ] 实现HITL检查点处理
- [ ] 实现结果聚合
- [ ] 实现异常降级
- [ ] 编写集成测试
- [ ] 代码审查

**4.9 端到端测试（Week 4-5）**

- [ ] 创建端到端测试套件
- [ ] 测试所有9个意图类型
  - [ ] DRAFT_FULL完整流程
  - [ ] DRAFT_CLAIMS完整流程
  - [ ] DRAFT_SPEC完整流程
  - [ ] RESPOND_OA完整流程
  - [ ] SEARCH完整流程
  - [ ] ANALYZE_PORTFOLIO完整流程
  - [ ] MULTI_INTENT完整流程
  - [ ] CLARIFY完整流程
  - [ ] CHITCHAT完整流程
- [ ] 测试HITL检查点
- [ ] 测试异常降级
- [ ] 测试并发场景
- [ ] 性能测试
- [ ] 生成中枢层验收报告

#### 验收标准

- ✅ OrchestratorAgent全部实现
- ✅ 5次LLM调用全部通过
- ✅ 9个意图类型全部支持
- ✅ 端到端测试全部通过
- ✅ HITL检查点测试通过
- ✅ 异常降级测试通过
- ✅ 性能测试通过
- ✅ 代码审查全部通过
- ✅ 文档完整（OrchestratorAgent架构文档）

#### 测试用例清单

```
OrchestratorAgent/
  ├─ 意图识别（Call 1）
  │   ├─ 测试DRAFT_FULL意图
  │   ├─ 测试DRAFT_CLAIMS意图
  │   ├─ 测试DRAFT_SPEC意图
  │   ├─ 测试RESPOND_OA意图
  │   ├─ 测试SEARCH意图
  │   ├─ 测试ANALYZE_PORTFOLIO意图
  │   ├─ 测试MULTI_INTENT意图
  │   ├─ 测试CLARIFY意图
  │   ├─ 测试CHITCHAT意图
  │   ├─ 测试置信度计算
  │   ├─ 测试字段提取
  │   └─ 测试CLARIFY追问生成
  ├─ 任务规划（Call 2）
  │   ├─ 测试DRAFT_FULL任务计划
  │   ├─ 测试DRAFT_CLAIMS任务计划
  │   ├─ 测试RESPOND_OA任务计划
  │   ├─ 测试SEARCH任务计划
  │   ├─ 测试步骤依赖关系
  │   ├─ 测试并行标记
  │   ├─ 测试HITL检查点生成
  │   └─ 测试超时设置
  ├─ HITL生成（Call 3）
  │   ├─ 测试HITL请求生成
  │   ├─ 测试HITL响应解析
  │   ├─ 测试确认处理
  │   ├─ 测试修改处理
  │   └─ 测试重新生成处理
  ├─ 结果聚合（Call 4）
  │   ├─ 测试单智能体结果聚合
  │   ├─ 测试多智能体结果聚合
  │   ├─ 测试Markdown格式化
  │   ├─ 测试附件列表生成
  │   └─ 测试建议操作生成
  ├─ 异常降级（Call 5）
  │   ├─ 测试执行层超时降级
  │   ├─ 测试意图识别置信度低降级
  │   ├─ 测试LLM输出格式错误降级
  │   └─ 测试专业层业务异常降级
  ├─ 上下文管理
  │   ├─ 测试对话历史管理
  │   ├─ 测试对话历史压缩
  │   ├─ 测试活跃任务状态管理
  │   ├─ 测试用户画像管理
  │   ├─ 测试知识域管理
  │   ├─ 测试HITL等待状态管理
  │   └─ 测试Token预算控制
  └─ 端到端测试
      ├─ 测试DRAFT_FULL完整流程
      ├─ 测试DRAFT_CLAIMS完整流程
      ├─ 测试DRAFT_SPEC完整流程
      ├─ 测试RESPOND_OA完整流程
      ├─ 测试SEARCH完整流程
      ├─ 测试ANALYZE_PORTFOLIO完整流程
      ├─ 测试MULTI_INTENT完整流程
      ├─ 测试CLARIFY完整流程
      ├─ 测试CHITCHAT完整流程
      ├─ 测试HITL检查点
      ├─ 测试异常降级
      ├─ 测试并发场景
      └─ 测试性能
```

#### 风险与应对

| 风险             | 影响 | 应对措施                         |
| ---------------- | ---- | -------------------------------- |
| LLM输出不稳定    | 高   | Few-shot示例、温度控制、重试机制 |
| Token超限        | 中   | 历史压缩、预算控制、分段处理     |
| 性能不达标       | 中   | 并行处理、缓存优化               |
| 意图识别准确率低 | 高   | Few-shot优化、置信度阈值调整     |

---

## 📊 质量保证标准

### 代码审查标准（Karpathy原则优先） 🆕

**审查清单（四大原则）**:

**1. 编码前思考检查**

- [ ] 是否明确说明了假设？
- [ ] 是否呈现了多种解释（如有歧义）？
- [ ] 是否在困惑时停下来询问？
- [ ] 是否有必要的权衡说明？

**2. 简洁优先检查**

- [ ] 是否添加了要求之外的功能？
- [ ] 是否为一次性代码创建了不必要的抽象？
- [ ] 是否添加了未要求的"灵活性"？
- [ ] 代码是否足够简洁？（能否用更少的行数实现？）

**3. 精准修改检查**

- [ ] 是否"改进"了相邻代码或注释？
- [ ] 是否重构了没坏的东西？
- [ ] 是否匹配了现有风格？
- [ ] 每一行修改是否都能追溯到用户请求？

**4. 目标驱动检查**

- [ ] 是否定义了成功标准？
- [ ] 是否将指令式任务转化为可验证目标？
- [ ] 是否有验证计划？
- [ ] 是否循环直到验证通过？

**审查角色与流程**:

1. **作者自审** - 提交前自检四大原则
2. **同伴审查** - 重点检查Karpathy原则违反
3. **架构师审查** - 关键模块额外审查

**违反处理**:

- 🔴 **严重违反**（过度复杂、无关修改）- 打回重写
- 🟡 **轻微违反**（缺少假设说明）- 要求补充说明
- 🟢 **符合原则** - 通过审查

### 测试策略

**测试金字塔**:

```
        /\
       /  \      端到端测试（10%）
      /____\
     /      \    集成测试（30%）
    /________\
   /          \  单元测试（60%）
  /____________\
```

**测试覆盖率要求**:

| 层级              | 单元测试 | 集成测试 | 端到端测试 | 总覆盖率 |
| ----------------- | -------- | -------- | ---------- | -------- |
| 工具层（Layer 3） | ≥90%     | ✓        | -          | ≥90%     |
| 执行层（Layer 2） | ≥90%     | ✓        | -          | ≥90%     |
| 专业层（Layer 1） | ≥70%     | ≥80%     | ✓          | ≥85%     |
| 中枢层（Layer 0） | ≥70%     | ≥80%     | 全部意图   | ≥85%     |

### LLM测试标准

**使用真实LLM测试**:

- ✅ 不使用Mock，测试时可使用本地模型（如Ollama）
- ✅ 每个LLM调用至少5个测试用例
- ✅ 包含正常案例和边缘案例
- ✅ 验证输出格式（JSON Schema）
- ✅ 验证输出质量（人工抽检）

**本地模型推荐**:

- Qwen2.5 7B（意图识别、任务规划）
- DeepSeek-R1（复杂推理）
- 通义千问（通用任务）

### 代码审查标准

**审查清单**:

- [ ] 代码符合架构设计原则
- [ ] 代码符合命名规范
- [ ] 代码有适当的注释
- [ ] 代码有错误处理
- [ ] 代码有日志记录
- [ ] 代码有性能考虑
- [ ] 测试覆盖充分
- [ ] 文档完整

**审查角色**:

- 作者：自审
- 同伴：交叉审查
- 架构师：关键模块审查

### 性能标准

**响应时间要求**:

| 操作                   | 目标 | 最大可接受 |
| ---------------------- | ---- | ---------- |
| 意图识别               | <1s  | 2s         |
| 任务规划               | <2s  | 5s         |
| 执行层智能体           | <3s  | 10s        |
| 专业层智能体           | <10s | 30s        |
| 完整流程（DRAFT_FULL） | <60s | 120s       |

**并发性能**:

- 支持10个并发会话
- 支持100个并发用户
- 99%请求在目标响应时间内完成

---

## ⚠️ 风险管理

### 风险清单

| 风险ID | 风险描述                     | 概率 | 影响 | 应对措施                         | 负责人 |
| ------ | ---------------------------- | ---- | ---- | -------------------------------- | ------ |
| R001   | LLM输出不稳定                | 高   | 高   | Few-shot示例、温度控制、重试机制 | 待定   |
| R002   | Token超限                    | 中   | 高   | 历史压缩、预算控制、分段处理     | 待定   |
| R003   | 性能不达标                   | 中   | 中   | 并行处理、缓存优化、性能测试     | 待定   |
| R004   | 意图识别准确率低             | 中   | 高   | Few-shot优化、置信度阈值调整     | 待定   |
| R005   | 执行层智能体实现复杂度超预期 | 中   | 中   | 拆分为更小的子任务，分步实现     | 待定   |
| R006   | 专业层重构导致功能回归       | 高   | 高   | 完整的回归测试，保留旧代码对比   | 待定   |
| R007   | EventBus通信协议不稳定       | 低   | 中   | 充分的集成测试，错误处理机制     | 待定   |
| R008   | 测试覆盖率不足               | 中   | 中   | 强制TDD，代码审查检查测试        | 待定   |
| R009   | 知识库集成问题               | 低   | 低   | Mock测试，分阶段集成             | 待定   |
| R010   | 开发进度延误                 | 中   | 低   | 无时间压力，质量优先             | 待定   |

### 风险应对策略

**高风险（R001、R006、R004）**:

- 优先处理
- 专项测试
- 备选方案

**中风险（R002、R003、R005、R007、R008）**:

- 监控指标
- 定期评审
- 优化方案

**低风险（R009、R010）**:

- 常规处理
- 记录日志

---

## 🎯 里程碑与验收

### 里程碑定义

**Milestone 1: 工具层验证完成（Phase 1）**

- 日期：Phase 1结束后
- 验收标准：见Phase 1验收标准
- 交付物：工具层验收报告

**Milestone 2: 执行层开发完成（Phase 2）**

- 日期：Phase 2结束后
- 验收标准：见Phase 2验收标准
- 交付物：执行层验收报告

**Milestone 3: 专业层重构完成（Phase 3）**

- 日期：Phase 3结束后
- 验收标准：见Phase 3验收标准
- 交付物：专业层验收报告

**Milestone 4: 中枢层实现完成（Phase 4）**

- 日期：Phase 4结束后
- 验收标准：见Phase 4验收标准
- 交付物：中枢层验收报告

**Milestone 5: 架构落地完成**

- 日期：所有Phase结束后
- 验收标准：
  - 所有Phase验收标准全部满足
  - 端到端测试全部通过
  - 性能测试全部通过
  - 代码审查全部通过
  - 文档完整
- 交付物：
  - 架构落地完成报告
  - 完整技术文档
  - 用户使用手册
  - 开发者指南

### 每周检查流程

**每周五下午进行周检查**:

1. **进度回顾**
   - 本周完成的任务
   - 未完成的任务及原因
   - 下周计划

2. **质量检查**
   - 测试覆盖率
   - 代码审查结果
   - 性能指标

3. **风险评估**
   - 新出现的风险
   - 风险应对效果
   - 风险优先级调整

4. **决策记录**
   - 重要决策
   - 架构调整
   - 计划变更

### 最终验收标准

**功能验收**:

- ✅ 9个意图类型全部支持
- ✅ **4个专业层智能体**全部实现（原有3个重构 + 新增1个）
- ✅ **15个执行层智能体**全部实现（原有9个 + 新增6个）
- ✅ OrchestratorAgent完整实现
- ✅ **工具资产充分复用**（复用率≥80%）

**质量验收**:

- ✅ 单元测试覆盖率≥90%（执行层、工具层）
- ✅ 集成测试覆盖率≥80%（专业层、中枢层）
- ✅ 端到端测试全部通过
- ✅ 性能测试全部通过
- ✅ 代码审查全部通过

**文档验收**:

- ✅ 架构文档完整
- ✅ API文档完整
- ✅ 测试文档完整
- ✅ 用户手册完整
- ✅ 开发者指南完整
- ✅ **工具盘点报告完整** 🆕

---

## 📚 附录

### A. 参考文档

- [YunPat编排器架构文档](./2026.5.4/yunpat_orchestrator_architecture.html)
- [YunPat Prompt策略文档](./2026.5.4/orchestrator_prompt_strategy.html)
- [**工具资产盘点报告**](./tools-inventory-report.md) 🆕
- [项目README](../README.md)
- [开发指南](./guides/development.md)

### B. 相关工具

- **测试框架**: Vitest
- **LLM SDK**: Anthropic SDK
- **本地LLM**: Ollama
- **代码审查**: ESLint + Prettier
- **文档生成**: TypeDoc

### C. 联系方式

- 作者：Xu Jian <xujian519@gmail.com>
- 项目：YunPat Agent Framework
- 许可证：MIT

---

**文档版本**: v2.1
**最后更新**: 2026-05-04
**更新内容**:

- **v2.1**: 新增Karpathy编程原则作为核心开发原则
- **v2.0**:
  - 新增6个执行层智能体（WritingAgent、TechnicalDrawingAgent等）
  - 新增1个专业层智能体（CreativeAnalyzerAgent）
  - 新增工具资产盘点与补充任务
  - 更新验收标准（15个执行层 + 4个专业层）
  - 强调充分利用已有工具

**下次审查**: 每周五
