# YunPat TUI 项目宪法

> 本宪法是 YunPat TUI 项目的最高设计文档。所有架构决策、功能设计、代码实现必须符合本宪法。当技术实现与宪法冲突时，以宪法为准。

---

## 第一章：身份与愿景

### 第一条：项目身份

YunPat TUI 是一个**面向知识产权领域的 AI 代理平台**，以终端交互为核心界面。

它既是：
- **专业生产力工具** — 为专利代理人和企业 IP 部门提供日常工作支持
- **AI 代理运行时** — 可调度多个专业智能体协同完成复杂任务
- **通用编码助手** — 保留 DeepSeek-TUI 的全部现有能力

### 第二条：目标用户

| 用户角色 | 核心诉求 |
|---------|---------|
| 专利代理师 | 高效完成专利撰写、审查意见答辩、复审无效等实务工作 |
| 企业 IP 管理人员 | 全流程管控、质量监控、布局决策 |
| 发明人/技术工程师 | 技术交底、专利理解、侵权预警 |
| IP 决策者 | 专利价值评估、布局策略、风险分析 |

### 第三条：愿景路径

```
Phase 0 (当前): 全新整合 DeepSeek-TUI + YunPat，建立统一代码库与架构
Phase 1: 固定场景智能体 — 专利撰写、OA 答辩、补正、复审、无效、规则研究
Phase 2: 全流程管理 — 从发明披露到授权维护的生命周期管理
Phase 3: 多 IP 类型 — 扩展商标、版权、商业秘密等领域智能体
Phase 4: 协作网络 — 多智能体协同处理跨领域复杂案件
```

---

## 第二章：核心原则

### 第四条：人机协作原则

**人主导，AI 辅助。所有 Phase 1 场景均为"人主导 + AI 辅助"模式。**

1. AI 不替代专业判断 — 涉及法律效力、策略选择、权利要求范围的决策必须经人确认
2. 人在环中 (Human-in-the-Loop) — AI 可主动建议，但执行前必须经用户审批确认
3. 渐进自主 — 随着信任建立和验证通过，逐步扩大 AI 自主操作范围（Phase 2+）
4. 可追溯性 — 每个 AI 生成的内容必须能追溯到具体的指令、上下文和决策点
5. 所有场景统一 — 不存在"AI 主导"的场景，AI 始终是辅助工具而非决策者

### 第五条：专业性原则

**对知识产权领域的准确性负责。**

1. 法律合规 — 所有专利相关功能必须遵循中国专利法及实施细则、审查指南等法规
2. 专业术语精确 — 使用规范的专利术语，不得随意简化或曲解
3. 流程合规 — 专利申请、答辩、复审等流程必须严格遵循国知局规定
4. 知识可验证 — 引用的法规、案例、条款必须可追溯源头

### 第六条：渐进演化原则

**从固定场景开始，逐步扩展到复杂场景。**

1. 先固化后灵活 — 先实现明确流程的自动化，再处理模糊场景
2. 先验证后推广 — 新智能体必须通过专业验证才能进入生产使用
3. 先辅助后自主 — 先提供辅助信息让用户决策，再逐步提供自动化建议
4. 数据驱动迭代 — 根据实际使用数据决定下一个优化方向

### 第七条：平台开放原则

**是一个可扩展的平台，不是一个封闭的产品。**

1. 智能体可插拔 — 每个专业智能体独立开发、独立部署、独立升级
2. 工具可扩展 — 通过 MCP、Skills、Hooks 机制接入外部能力和数据源
3. 模型可替换 — 不绑定特定 LLM，支持多种模型适配不同任务
4. 界面可切换 — 保留 TUI、CLI、HTTP API 多种交互方式

---

## 第三章：能力架构

### 第八条：能力分层

```
┌──────────────────────────────────────────────────┐
│  交互层    TUI / CLI / HTTP API / 未来 Web UI    │
├──────────────────────────────────────────────────┤
│  编排层    Agent Orchestrator（智能体调度引擎）   │
├──────────────────────────────────────────────────┤
│  专业层    Patent Agent | Trademark Agent | ...   │
│           （可插拔的领域智能体）                    │
├──────────────────────────────────────────────────┤
│  通用层    File Ops | Shell | Search | Git | ...  │
│           （保留 DeepSeek-TUI 全部通用工具）       │
├──────────────────────────────────────────────────┤
│  基础层    LLM Client | Session | State | MCP     │
└──────────────────────────────────────────────────┘
```

### 第九条：智能体规范

每个专业智能体必须定义以下六要素：

1. **身份** — 名称、角色描述、专业领域
2. **能力边界** — 能做什么、不能做什么、需要人工确认的边界
3. **知识来源** — 依赖的法规、案例库、模板、外部数据源
4. **输入/输出规范** — 接受什么格式的输入，产生什么格式的输出
5. **质量标准** — 如何验证输出的正确性和专业性
6. **审批流程** — 哪些操作需要人工审批，哪些可以自动执行

所有智能体遵循统一生命周期：`初始化 → 分析 → 建议 → 等待审批 → 执行 → 验证`

---

### 第十条：智能体详细规范（Phase 1）

> **YunPat 资产映射**：标注每个智能体对应的 YunPat 现有实现，便于融合时复用。

---

#### 10.1 规则研究智能体 (Research Agent)

| 要素 | 定义 |
|------|------|
| **身份** | 知识产权法规与实务研究助手。帮助用户研究特定业务规则（如新业务类型、法规变更、实务操作指南） |
| **能力边界** | ✅ 检索法规条文、审查指南、案例；归纳总结规则要点；对比新旧规则差异<br>❌ 不提供法律意见；不替代专业判断；不处理具体案件 |
| **知识来源** | 中国专利法及实施细则、审查指南、审查操作规程、复审无效案例、法院判例、knowledge-base（4,385 文件） |
| **输入** | 自然语言输入，Agent 内部进行意图识别，拆解为：`{ topic: string, scope?: "法规"｜"案例"｜"实务"｜"全部", depth?: "概述"｜"详细"｜"深度" }`<br>示例："请研究一下关于新用途专利创造性的判定规则" → topic="新用途专利创造性判定"，scope="全部"，depth="详细"<br>示例："请研究功能性技术特征的规则判断" → topic="功能性技术特征判断规则"，scope="法规+实务"，depth="详细" |
| **输出** | 研究报告（Markdown）：背景、相关条文、案例摘要、操作要点、参考来源列表 |
| **质量标准** | 引用的每条法规必须标注具体条款号；案例必须标注案号；不允许无出处的断言 |
| **审批流程** | 全部输出为建议性质，用户自行采纳，无需逐条审批 |
| **YunPat 映射** | `@yunpat/patent-knowledge`（知识库桥接，本地 md 规则文件）+ knowledge-base（4,385 文件，含法规、审查指南、案例）+ 外接数据库（法规/案例库）+ 外接 LLM Wiki 知识库 |

**交互流程**：
```
用户: "请研究一下关于新用途专利创造性的判定规则"
  → Agent: [意图识别] 解析研究主题、范围、深度
  → Agent: 确认理解（复述研究意图，确认范围）
  → 用户: 确认或调整
  → Agent: 检索知识库 + 法规库 + 案例库，输出研究报告草案
  → 用户: 审阅、追问、要求补充
  → Agent: 迭代完善
  → 用户: 满意，保存或导出
```

---

#### 10.2 专利撰写智能体 (Drafting Agent)

**本质**：Drafting Agent 不是单一智能体，而是多个子智能体 + 工具的编排流程。由一个编排协调器按 5 个步骤依次调度。

| 要素 | 定义 |
|------|------|
| **身份** | 专利申请文件撰写编排器。从技术交底书出发，协调发明理解、检索、说明书撰写、权利要求撰写、摘要撰写等子智能体，逐步产出完整申请文件 |
| **能力边界** | ✅ 调度子智能体完成发明理解、现有技术检索、说明书撰写、权利要求撰写、摘要撰写；质量检查与迭代优化<br>❌ 不决定权利要求保护范围策略；不签署法律文件；不直接提交申请 |
| **知识来源** | 专利法第2/25/26条、审查指南第二部分、权利要求撰写模板、说明书结构模板、knowledge-base |
| **输入** | `{ disclosure: string ｜ FilePath, patentType: "发明"｜"实用新型", inventionType?: "装置"｜"方法"｜"系统"｜"组合物", existingClaims?: string[] }` |
| **审批流程** | 每个步骤完成后暂停，等待用户确认/修改后才进入下一步骤。权利要求范围的任何修改需用户明确批准 |

**5 步骤流程与子智能体调用**：

##### 步骤 1：发明理解

| 项目 | 说明 |
|------|------|
| 目标 | 从技术交底书中提取结构化的发明理解 |
| 调用子智能体 | InventionUnderstandingAgent |
| 调用工具 | AutoSpecDrafter._understand_invention() |
| 推荐模型 | 轻量快速模型（如 qwen3.5），temperature=0.3 |
| 输出 | `InventionUnderstanding`：发明名称、类型、技术领域、核心创新点、技术问题、技术方案、技术效果、必要特征、可选特征、置信度 |
| 人机交互 | Agent 展示三元组摘要（技术问题-技术方案-技术效果，<300字），用户确认/修改 |

##### 步骤 2：现有技术检索

| 项目 | 说明 |
|------|------|
| 目标 | 检索现有技术，定位发明点 |
| 调用子智能体 | PatentSearchAgent |
| 调用工具 | MultimodalRetrieval（语义检索）、PatentClassifier（IPC/CPC 分类） |
| 输出 | 对比分析报告（对比文件列表 + 区别特征确认 + 发明点定位） |
| 人机交互 | Agent 展示检索结果摘要（<300字），用户确认检索充分性，可补充/排除对比文件 |

##### 步骤 3：说明书撰写

| 项目 | 说明 |
|------|------|
| 目标 | 基于发明理解和对比分析，撰写说明书各章节 |
| 调用子智能体 | SpecificationAgent |
| 调用工具 | AutoSpecDrafter.draft_specification()、PatentDrawingAnalyzer（附图分析） |
| 推荐模型 | 深度推理模型（如 deepseek-reasoner），temperature=0.3 |
| 输出 | SpecificationDraft：技术领域(50-100字) → 背景技术(300-500字) → 发明内容(800-1500字) → 具体实施方式(1500-3000字) → 附图说明 |
| 人机交互 | 逐章节展示，用户逐章节确认/修改 |
| 质量检查 | 每章节生成后自动 QualityCheck，得分 <7.5 则自动迭代（最多 3 轮），超出转人工 |

##### 步骤 4：权利要求撰写

| 项目 | 说明 |
|------|------|
| 目标 | 基于发明点和说明书，撰写权利要求书 |
| 调用子智能体 | ClaimsAgent、SubjectMatterChecker（保护客体检查） |
| 调用工具 | PatentClaimGenerator（权利要求生成）、ClaimScopeAnalyzer（范围分析） |
| 输出 | ClaimsSet：独立权利要求（中等保护范围）→ 从属权利要求（进一步限定）→ 从属权利要求（具体实现） |
| 人机交互 | 展示权利要求布局规划，用户确认保护范围策略；逐条审阅权利要求 |
| 质量检查 | 清晰性检查（A26.4 符合性）；保护客体适格性检查；范围合理性分析 |
| 模板 | 按发明类型选择：装置模板 / 方法模板 / 系统模板 / 组合物模板 |

##### 步骤 5：摘要撰写与全文整合

| 项目 | 说明 |
|------|------|
| 目标 | 撰写摘要，整合全文，输出完整申请文件 |
| 调用子智能体 | XiaonaPatentDrafter（摘要撰写） |
| 推荐模型 | 轻量快速模型（如 qwen3.5），temperature=0.3 |
| 输出 | 摘要(300字左右) + 专利申请文件_完整版.md |
| 人机交互 | 展示摘要，用户确认 |

**7 维度质量评估体系**：

| 维度 | 权重 | 阈值 | 说明 |
|------|------|------|------|
| completeness（完整性） | 15% | ≥7.5 | 必要技术特征齐全 |
| clarity（清晰性） | 15% | ≥7.5 | 无歧义用语 |
| accuracy（准确性） | 15% | ≥7.5 | 技术描述准确 |
| sufficiency（充分性 A26.3） | 20% | ≥7.5 | 公开充分 |
| consistency（一致性） | 10% | ≥7.5 | 权利要求与说明书一致 |
| compliance（规范性） | 10% | ≥7.5 | 格式符合要求 |
| support（支持性 A26.4） | 15% | ≥7.5 | 权利要求有说明书支持 |

**质量迭代**：得分 <7.5 自动迭代修复，最多 3 轮，超出转人工审核。

**YunPat 映射**：

| 子智能体/工具 | YunPat 对应 |
|-------------|------------|
| InventionUnderstandingAgent | `@yunpat/agent-invention` + `DisclosureRefinerAgent` |
| PatentSearchAgent | `@yunpat/agent-search`（V3）+ `@yunpat/patent-database` |
| SpecificationAgent | `@yunpat/agent-specification` + `@yunpat/agent-patent-writer`（AutoSpecDrafter） |
| ClaimsAgent | `@yunpat/agent-claims` + `PatentClaimGenerator` |
| SubjectMatterChecker | `@yunpat/agent-subject-matter-checker` |
| QualityCheckerAgent | `@yunpat/agent-quality`（EnhancedQualityCheckerAgent） |
| XiaonaPatentDrafter | `@yunpat/agent-patent-writer` |
| ClaimScopeAnalyzer | YunPat 辅助分析模块 |
| PatentDrawingAnalyzer | YunPat 辅助分析模块 |
| MultimodalRetrieval | `@yunpat/patent-database` + 语义检索 |

**交互流程**：
```
用户: 提交技术交底书（文件或文本）
  → Agent: [步骤1-发明理解] 输出三元组摘要，请求确认
  → 用户: 确认/修正技术要点
  → Agent: [步骤2-现有技术检索] 输出检索结果和对比分析
  → 用户: 确认检索充分性，补充/排除对比文件
  → Agent: [步骤3-说明书撰写] 逐章节生成，每章节自动质量检查
    ↻ 质量不达标时自动迭代（≤3轮）
  → 用户: 逐章节审阅修改
  → Agent: [步骤4-权利要求撰写] 展示布局规划 + 保护客体检查
  → 用户: 确认保护范围策略，审阅权利要求
  → Agent: [步骤5-摘要+整合] 输出完整申请文件
  → 用户: 最终确认
```

---

#### 10.3 审查意见答辩智能体 (OA Response Agent)

**本质**：OA Response Agent 不是单一智能体，而是多个子智能体 + 工具的编排流程。由一个编排协调器按 5 个步骤依次调度，覆盖审查意见通知书的全流程答辩。

| 要素 | 定义 |
|------|------|
| **身份** | 审查意见（Office Action）分析与答辩编排器。从审查意见通知书出发，协调解析、深度分析、策略制定、文本撰写、验证打包等子智能体，逐步产出完整答辩文件 |
| **能力边界** | ✅ 解析审查意见要点（引用条款、对比文件、驳回理由）；检索相关案例和复审决定；模拟审查员视角分析；生成多方案答辩策略建议；撰写意见陈述书草案；生成权利要求修改建议；验证答复完整性<br>❌ 不决定最终答辩策略；不直接提交答辩文件；不预测审查结果 |
| **知识来源** | 审查指南（实质审查部分）、专利法第22/33条、审查意见历史数据、复审无效案例库、对比文件全文、knowledge-base |
| **输入** | `{ officeAction: string ｜ FilePath, applicationClaims: string[], priorArtReferences?: string[], prosecutionHistory?: string[] }` |
| **审批流程** | 策略选择必须用户决定（Agent 提供选项和利弊分析）；答辩文件定稿必须用户确认；权利要求修改必须用户逐条批准 |

**5 种驳回理由类型**：

| 驳回理由 | 法律依据 | 严重程度 | 分析框架 |
|---------|---------|---------|---------|
| 新颖性问题 | A22.2 | 中 | 三元组逐一比对（技术领域/技术方案/区别特征） |
| 创造性问题 | A22.3 | 严重 | 三步法（最接近现有技术→区别特征→技术启示→效果） |
| 公开不充分 | A26.3 | 严重 | 实施方案检验（完整性/充分性/可预期性） |
| 权利要求不清楚 | A26.4 | 中 | 保护范围明确性检查 |
| 修改超范围 | A33 | 严重 | 原始公开范围对照 |

**5 步骤流程与子智能体调用**：

##### 步骤 1：审查意见解读与问题分解

| 项目 | 说明 |
|------|------|
| 目标 | 从审查意见通知书中提取结构化数据，识别所有驳回理由 |
| 调用子智能体 | OfficeActionParser（OA 文档结构化解析） |
| 推荐模型 | 轻量快速模型（如 qwen3.5），temperature=0.2 |
| 输出 | `OfficeAction`：OA编号、申请号、驳回类型、驳回理由、对比文件列表、被引权利要求、审查员论点、缺失技术特征、答复期限 |
| 人机交互 | Agent 展示驳回理由清单摘要（<300字），用户确认解析是否完整准确 |

##### 步骤 2：驳回理由深度分析

| 项目 | 说明 |
|------|------|
| 目标 | 针对每个驳回理由进行深度技术-法律分析，生成对比分析报告 |
| 调用子智能体 | SmartOAResponder（核心分析）、ExaminerSimulator（审查员视角模拟） |
| 分析框架 | 新颖性→三元组逐一比对；创造性→三步法分析；公开不充分→实施方案检验；不清楚→范围明确性；超范围→原始公开对照 |
| 输出 | 对比分析报告：每个驳回理由的问题-特征-效果三元组分析、与每篇对比文件的逐一对比、综合判断（完全公开/部分公开/未公开） |
| 人机交互 | Agent 展示分析结果摘要（<300字），用户确认技术理解，可修正分析 |

##### 步骤 3：答复策略制定

| 项目 | 说明 |
|------|------|
| 目标 | 基于深度分析结果，制定多个可选答复策略并评估成功率和风险 |
| 调用子智能体 | SmartOAResponder（策略生成）、HebbianOptimizer（案例学习优化） |
| 策略类型 | 完全反驳 / 部分反驳+修改 / 完全接受+修改 / 组合策略 |
| 输出 | `ResponsePlan`：各策略的修改内容、保护范围影响、成功概率、风险评估的多方案对比表 |
| 人机交互 | Agent 展示方案对比表，用户选择策略（可组合或自定义）**← 关键决策点** |

**策略选择参考矩阵**：

| 场景 | 推荐策略 | 成功概率 | 风险等级 |
|------|---------|---------|---------|
| 审查员观点明显错误 | 完全反驳 | ~70% | 中 |
| 部分认可，可修改克服 | 部分反驳+修改 | ~85% | 低 |
| 完全认可，需缩小保护范围 | 完全接受+修改 | ~95% | 极低 |
| 多个驳回理由组合 | 组合策略 | ~75% | 中 |

##### 步骤 4：答复文本撰写

| 项目 | 说明 |
|------|------|
| 目标 | 基于选定策略，撰写意见陈述书和权利要求修改文本 |
| 调用子智能体 | ClaimReviser（权利要求修订）、OAResponseValidator（答复验证） |
| 推荐模型 | 深度推理模型（如 deepseek-reasoner），temperature=0.3 |
| 输出 | 意见陈述书（逐驳回理由结构化）+ 修改后权利要求书（含修改对照标注） |
| 循环 | 对每个驳回理由逐一撰写，每条完成后用户审阅 |
| 人机交互 | 逐条展示答复内容，用户审阅修改；权利要求修改逐条批准 |
| 质量检查 | 自动验证：答辩理由法律依据引用完整性、修改不超范围、格式符合国知局要求 |

**意见陈述书结构**：
```
一、关于驳回理由N（类型）
  1. 审查员观点概述
  2. 申请人的意见（逐条回应）
  3. 技术对比分析（详细对比表）
  4. 法律依据（法条和审查指南引用）
  5. 结论（明确请求）
二、权利要求修改说明
  修改依据 + 修改内容标注 + 修改后文本
```

##### 步骤 5：验证与打包

| 项目 | 说明 |
|------|------|
| 目标 | 验证答复完整性，生成可提交的答复文件包 |
| 调用子智能体 | OAResponseValidator（完整性验证） |
| 输出 | 答复文件清单：意见陈述书 + 修改后权利要求书 + 修改替换页 |
| 质量检查 | 格式检查、一致性检查（意见陈述书与修改对照）、完整性检查（所有驳回理由均已回应） |
| 人机交互 | 展示完整答复包，用户最终确认提交 |

**YunPat 映射**：

| 子智能体/工具 | YunPat 对应 |
|-------------|------------|
| OfficeActionParser | `@yunpat/patent-core`（OA 文档解析） |
| SmartOAResponder | `@yunpat/agent-patent-responder`（V5，集成真实数据库） |
| ExaminerSimulator | `@yunpat/agent-patent-responder`（审查员模拟模块） |
| ClaimReviser | `@yunpat/agent-patent-responder`（权利要求修订模块） |
| OAResponseValidator | `@yunpat/agent-patent-responder`（答复验证模块） |
| HebbianOptimizer | YunPat 案例学习优化模块 |
| PatentSearchAgent | `@yunpat/agent-search`（V3，对比文件检索） |
| PatentAnalyzerAgent | `@yunpat/agent-patent-analyzer`（V2，技术对比分析） |

**交互流程**：
```
用户: 提交审查意见通知书
  → Agent: [步骤1-解读] 输出驳回理由清单，请求确认
  → 用户: 确认解析完整/补充说明
  → Agent: [步骤2-深度分析] 输出对比分析报告
  → 用户: 确认技术理解/修正分析
  → Agent: [步骤3-策略制定] 输出多方案对比表 ← 关键决策点
  → 用户: 选择策略（可组合或自定义）
  → Agent: [步骤4-文本撰写] 逐驳回理由撰写
    ↻ 每条完成后用户审阅修改
  → Agent: [步骤5-验证打包] 输出完整答复文件包
  → 用户: 最终确认提交
```

---

#### 10.4 专利复审智能体 (Reexamination Agent)

**本质**：Reexamination Agent 不是单一智能体，而是多个子智能体 + 工具的编排流程。由一个编排协调器按 5 个步骤依次调度，覆盖从驳回决定分析到复审请求提交的全流程。

**程序性质**：行政救济程序。申请人收到驳回决定后 3 个月内提出，由专利复审和无效审理部审理。

| 要素 | 定义 |
|------|------|
| **身份** | 专利复审请求编排器。从驳回决定出发，协调驳回分析、补充检索、策略制定、文书撰写、程序跟踪等子智能体，逐步产出完整复审请求文件 |
| **能力边界** | ✅ 解析驳回决定要点（驳回类型、审查员论点、对比文件）；补充检索对比文件和非专利文献；分析驳回逻辑链各环节强弱；检索复审成功先例；生成多方案复审策略；撰写复审请求书草案；修改权利要求建议；跟踪前置审查/合议审查进程<br>❌ 不决定复审策略（是否修改权利要求、修改幅度）；不预测复审结果；不直接提交复审请求 |
| **知识来源** | 专利法第41条、实施细则第60-63条、审查指南第四部分第二章、复审委员会决定案例、knowledge-base |
| **输入** | `{ rejectionDecision: string ｜ FilePath, applicationFile?: string ｜ FilePath, prosecutionHistory?: string[] }` |
| **审批流程** | 驳回分析确认 → 策略选择由用户决定 → 请求书定稿用户确认 → 权利要求修改逐条批准 |

**5 步骤流程与子智能体调用**：

##### 步骤 1：驳回决定分析

| 项目 | 说明 |
|------|------|
| 目标 | 从驳回决定中提取结构化数据，识别所有驳回理由及其逻辑链 |
| 调用子智能体 | AnalyzerAgent（驳回分析） |
| 推荐模型 | 轻量快速模型（如 qwen3.5），temperature=0.2 |
| 输出 | 驳回理由清单：驳回类型（A22.2/A22.3/A26.3/A26.4/A33）、审查员论点、对比文件引用、被引权利要求、各环节逻辑强弱标注 |
| 人机交互 | Agent 展示驳回理由清单摘要（<300字），用户确认理解是否准确 |

##### 步骤 2：补充检索

| 项目 | 说明 |
|------|------|
| 目标 | 补充对比文件和非专利文献，为复审论证提供更充分的证据基础 |
| 调用子智能体 | RetrieverAgent（检索代理） |
| 输出 | 补充对比文件集合 + 非专利文献 + 证据说服力评估 |
| 人机交互 | Agent 展示检索结果摘要，用户确认检索充分性，可补充/排除 |

##### 步骤 3：复审策略制定

| 项目 | 说明 |
|------|------|
| 目标 | 评估各驳回理由的可争辩性，制定复审策略 |
| 调用子智能体 | PatentAnalyzerAgent（可争辩性评估）+ NoveltyAnalyzerAgent/CreativityAnalyzerAgent（按驳回类型） |
| 策略选项 | 完全争辩（成功率 >70%）/ 修改+争辩（成功率 50-70%）/ 接受驳回建议（成功率 <50%） |
| 输出 | 复审策略方案：各策略的论证要点、修改内容（如需）、成功概率评估、风险评估 |
| 人机交互 | Agent 展示策略选项及利弊分析，用户选择策略 **← 关键决策点** |

**程序参考数据**：前置审查约 30% 直接撤销驳回；合议审查成功率约 40-50%。

##### 步骤 4：复审请求书撰写

| 项目 | 说明 |
|------|------|
| 目标 | 基于选定策略，撰写复审请求书和权利要求修改文本（如需） |
| 调用子智能体 | WriterAgent（文书撰写）、ClaimReviser（权利要求修订，如采用修改策略） |
| 推荐模型 | 深度推理模型（如 deepseek-reasoner），temperature=0.3 |
| 输出 | 复审请求书草案 + 修改后权利要求（如策略需要） |
| 人机交互 | 逐节展示请求书内容，用户审阅修改；权利要求修改逐条批准 |
| 质量检查 | 复审理由法律依据引用完整性；修改不超范围（可从原申请文件直接地、毫无疑义地确定）；引用复审先例可追溯 |

**复审请求书论证框架**：
```
一、对驳回理由的总体回应
  - 指出审查员在事实认定或法律适用上的错误
  - 提出新的证据或解释
二、针对新颖性驳回（A22.2）
  - 强调区别特征 + "单独对比"原则
三、针对创造性驳回（A22.3）
  - 重新确定最接近现有技术 → 认定区别特征 → 反驳技术启示 → 预料不到的技术效果
四、针对其他驳回理由
  - A26.3: 补充实验数据/详细说明
  - A26.4: 澄清术语定义
  - A33: 证明修改可从原文直接地、毫无疑义地确定
五、修改说明（如修改了权利要求）
  - 修改依据（实施细则第60条）+ 修改内容 + 如何克服驳回理由
```

##### 步骤 5：验证与程序跟踪

| 项目 | 说明 |
|------|------|
| 目标 | 验证复审请求文件完整性，跟踪后续审查程序 |
| 调用子智能体 | QualityCheckerAgent（完整性验证） |
| 输出 | 完整复审请求文件包 + 时限提醒（法定期限、答复期限） |
| 程序跟踪 | 前置审查结果 → 合议审查（如进入）→ 复审决定（维持驳回/撤销驳回） |
| 后续路径 | 维持驳回 → 行政诉讼（北京知识产权法院）；撤销驳回 → 继续审查/授权 |
| 人机交互 | 展示完整文件包，用户最终确认提交 |

**YunPat 映射**：

| 子智能体/工具 | YunPat 对应 |
|-------------|------------|
| AnalyzerAgent（驳回分析） | `@yunpat/agent-patent-analyzer`（V2） |
| RetrieverAgent（检索） | `@yunpat/agent-search`（V3） |
| NoveltyAnalyzerAgent | `@yunpat/agent-patent-analyzer`（新颖性分析模块） |
| CreativityAnalyzerAgent | `@yunpat/agent-patent-analyzer`（创造性分析模块） |
| WriterAgent（撰写） | `@yunpat/agent-patent-writer` |
| ClaimReviser | `@yunpat/agent-patent-responder`（权利要求修订模块） |
| QualityCheckerAgent | `@yunpat/agent-quality` |
| PatentSearchAgent | `@yunpat/agent-search`（复审先例检索） |

**交互流程**：
```
用户: 提交驳回决定
  → Agent: [步骤1-驳回分析] 输出驳回理由清单+逻辑链强弱标注
  → 用户: 确认理解准确
  → Agent: [步骤2-补充检索] 输出补充对比文件和非专利文献
  → 用户: 确认检索充分性
  → Agent: [步骤3-策略制定] 输出策略选项（争辩/修改+争辩/接受） ← 关键决策点
  → 用户: 选择策略
  → Agent: [步骤4-文书撰写] 逐节撰写复审请求书 + 权利要求修改（如需）
    ↻ 每节完成后用户审阅修改
  → Agent: [步骤5-验证跟踪] 输出完整文件包 + 时限提醒
  → 用户: 最终确认提交
```

---

#### 10.5 专利无效宣告智能体 (Invalidation Agent)

**本质**：Invalidation Agent 不是单一智能体，而是多个子智能体 + 工具的编排流程。由一个编排协调器按 5 个步骤依次调度，覆盖从目标专利分析到无效宣告请求书撰写的全流程。

**程序性质**：行政确权程序。任何单位/个人对已授权专利提出，由专利复审和无效审理部审理，以口审程序为主。

| 要素 | 定义 |
|------|------|
| **身份** | 专利无效宣告请求编排器。从目标专利出发，协调技术分析、证据收集、新颖性/创造性挑战分析、策略制定、文书撰写等子智能体，逐步产出完整无效宣告请求文件 |
| **能力边界** | ✅ 分析目标专利权利要求和说明书（特征提取、保护范围界定、弱点识别）；检索对比文件（专利文献+非专利文献+公开使用证据）；证据真实性验证；特征对比分析；新颖性挑战分析（单独对比原则）；创造性挑战分析（三步法）；无效理由组合优化；证据链构建；撰写无效宣告请求书草案<br>❌ 不决定无效策略（攻击哪些权利要求、使用哪些证据组合）；不预测无效结果；不直接提交无效请求 |
| **知识来源** | 专利法第2/5/9/22/25/26/33/45/46条、实施细则、审查指南第四部分、无效宣告决定案例库、knowledge-base |
| **输入** | `{ targetPatent: string ｜ FilePath ｜ PatentNumber, invalidationGrounds?: ("新颖性"｜"创造性"｜"充分公开"｜"不清楚"｜"修改超范围"｜"不属于授权客体"｜"重复授权")[] }` |
| **审批流程** | 证据收集用户确认充分性 → 无效策略和证据组合用户决定 → 请求书定稿用户确认 |

**无效理由体系**：

| 无效理由 | 法律依据 | 实务成功率 | 分析框架 |
|---------|---------|----------|---------|
| 新颖性 | A22.2 | 中-高 | 单独对比原则：一篇对比文件公开全部特征 |
| 创造性 | A22.3 | 中 | 三步法：最接近现有技术→区别特征→技术启示→显而易见性 |
| 公开不充分 | A26.3 | 中 | 说明书不清楚/不完整/无法实现 |
| 权利要求不清楚 | A26.4 | 中 | 保护范围不明确 |
| 修改超范围 | A33 | 中 | 修改内容超出原始公开范围 |
| 不属于授权客体 | A2/A5/A25 | 低 | 科学发现、智力活动规则等 |
| 重复授权 | A9 | 低 | 同样的发明创造被授予多项专利权 |

**5 步骤流程与子智能体调用**：

##### 步骤 1：目标专利技术分析

| 项目 | 说明 |
|------|------|
| 目标 | 从目标专利中提取结构化技术特征，界定保护范围，识别弱点 |
| 调用子智能体 | AnalyzerAgent（分析代理） |
| 推荐模型 | 轻量快速模型（如 qwen3.5），temperature=0.2 |
| 输出 | 专利技术分析报告：权利要求特征提取（独立/从属分解）、保护范围界定、技术方案结构化、弱点识别（保护范围过宽、特征易规避等） |
| 人机交互 | Agent 展示技术分析摘要（<300字），用户确认理解 |

##### 步骤 2：证据收集和筛选

| 项目 | 说明 |
|------|------|
| 目标 | 检索对比文件和非专利文献，收集证据，评估证据质量 |
| 调用子智能体 | RetrieverAgent（检索代理） |
| 检索范围 | 专利文献（D1, D2...）、非专利文献、公开使用证据、公知常识证据（教科书/技术手册） |
| 输出 | 证据清单：对比文件集合 + 相关性排序（BM25 + 语义相似度）+ 专利家族去重 + 证据真实性评估 |
| 人机交互 | Agent 展示检索结果和证据清单，用户确认检索充分性，补充/排除证据 |

##### 步骤 3：无效理由分析

| 项目 | 说明 |
|------|------|
| 目标 | 基于证据对目标专利进行多维度无效理由分析 |
| 调用子智能体 | NoveltyAnalyzerAgent（新颖性）、CreativityAnalyzerAgent（创造性）、AnalyzerAgent（其他理由） |
| 新颖性分析 | 单独对比原则：将权利要求与每篇对比文件逐一比对，确认特征是否被公开 |
| 创造性分析 | 三步法：① 确定最接近现有技术（技术领域相同/公开特征最多）→ ② 确定区别特征和实际解决的技术问题 → ③ 判断显而易见性（其他对比文件是否公开区别特征、是否存在技术启示、区别特征是否起相同作用） |
| 其他理由 | A26.3/A26.4/A33/A2/A5/A25/A9 按需分析 |
| 输出 | 各无效理由的分析结果 + 特征对比矩阵 + 各理由成功率评估 |
| 人机交互 | Agent 展示分析结果摘要，用户确认对比准确性 |

##### 步骤 4：策略制定

| 项目 | 说明 |
|------|------|
| 目标 | 优化无效理由组合，构建证据链，制定攻击策略 |
| 调用子智能体 | InvalidationAnalyzerAgent（无效策略专家） |
| 策略内容 | 无效理由组合优化（选择最具说服力的理由组合）、证据链构建（证据组×攻击目标映射）、攻击优先级排序 |
| 输出 | 无效宣告策略方案：理由组合 + 证据链 + 各组合成功率评估 + 风险评估 |
| 人机交互 | Agent 展示策略方案，用户选择攻击策略 **← 关键决策点** |

**证据链构建框架**：
```
├─ 证据组1：新颖性攻击
│   ├─ D1 → 公开权利要求1全部特征
│   └─ D2 → 公开从属权利要求附加特征
├─ 证据组2：创造性攻击
│   ├─ D1（最接近现有技术）→ 公开大部分特征
│   ├─ D2 → 公开区别技术特征
│   └─ D3 / 公知常识 → 提供结合启示
├─ 证据组3：形式缺陷攻击
│   ├─ A26.3：说明书未充分公开
│   ├─ A26.4：权利要求不清楚
│   └─ A33：修改超出原始公开
└─ 辅助证据：教科书、行业标准、专家证言
```

##### 步骤 5：文书撰写与验证

| 项目 | 说明 |
|------|------|
| 目标 | 撰写无效宣告请求书，整理证据清单，验证完整性 |
| 调用子智能体 | WriterAgent（撰写）、QualityCheckerAgent（验证） |
| 推荐模型 | 深度推理模型（如 deepseek-reasoner），temperature=0.3 |
| 输出 | 无效宣告请求书（逐条理由含特征对比表）+ 证据清单（含证明目的）+ 附件清单 |
| 质量检查 | 证据充分性（无重大遗漏）；特征对比基于原文不臆断；无效理由有法律和事实支撑；证据链完整 |
| 人机交互 | 展示完整请求书，用户审阅修改，最终确认提交 |

**无效宣告请求书结构**：
```
一、请求人信息 / 专利权人信息
二、无效宣告理由（逐条）
  理由N：权利要求X不具备Y性（法律依据）
    - 对比文件
    - 特征对比表（权利要求特征 vs 对比文件公开内容 vs 对比结果）
    - 结论
三、证据清单（证据编号/名称/形式/证明目的/页数）
四、附件
```

**YunPat 映射**：

| 子智能体/工具 | YunPat 对应 |
|-------------|------------|
| AnalyzerAgent（目标分析） | `@yunpat/agent-patent-analyzer`（V2） |
| RetrieverAgent（证据检索） | `@yunpat/agent-search`（V3） |
| NoveltyAnalyzerAgent | `@yunpat/agent-patent-analyzer`（新颖性分析模块） |
| CreativityAnalyzerAgent | `@yunpat/agent-patent-analyzer`（创造性分析模块） |
| InvalidationAnalyzerAgent | YunPat 无效分析专用模块 |
| WriterAgent（撰写） | `@yunpat/agent-patent-writer` |
| QualityCheckerAgent | `@yunpat/agent-quality` |
| PatentSearchAgent | `@yunpat/agent-search`（无效先例检索） |
| InfringementAnalyzerAgent | `@yunpat/agent-patent-analyzer`（权利要求解释，辅助无效分析） |

**交互流程**：
```
用户: 提交目标专利号/文件
  → Agent: [步骤1-技术分析] 输出权利要求特征分解+保护范围+弱点识别
  → 用户: 确认理解
  → Agent: [步骤2-证据收集] 输出证据清单（专利文献+非专利文献+公知常识）
  → 用户: 确认检索充分性，补充/排除证据
  → Agent: [步骤3-理由分析] 新颖性(单独对比) + 创造性(三步法) + 其他理由分析
  → 用户: 确认对比准确性
  → Agent: [步骤4-策略制定] 输出理由组合+证据链+成功率评估 ← 关键决策点
  → 用户: 选择攻击策略
  → Agent: [步骤5-文书撰写] 逐条撰写无效宣告请求书 + 证据清单
  → 用户: 审阅修改，最终确认提交
```

---

#### 10.6 共享智能体规范

以下智能体解决特定任务（非编排协调），作为基础服务被多个场景智能体共享。按功能分为 5 类。

##### 检索类

**PatentSearchAgent（检索代理）**

| 项目 | 说明 |
|------|------|
| 职责 | 专利文献检索、非专利文献检索、证据收集和相关性排序 |
| 输入 | `{ query: string, scope: "patent"｜"non_patent"｜"all", filters?: { dateRange?, ipcClass?, keyword? }, maxResults?: number }` |
| 输出 | `SearchResult[]`：对比文件集合（编号、标题、公开日、摘要、相关性评分）+ 专利家族去重 |
| 推荐模型 | 不直接使用 LLM（检索引擎驱动），结果排序可用轻量模型辅助 |
| YunPat 映射 | `@yunpat/agent-search`（V3） |
| 使用者 | Drafting, OA Response, Reexamination, Invalidation, Research |

##### 分析类

**PatentAnalyzerAgent（技术分析代理）**

| 项目 | 说明 |
|------|------|
| 职责 | 技术特征提取、保护范围界定、弱点识别、技术方案结构化 |
| 输入 | `{ patentDocument: string ｜ FilePath, analysisType: "feature_extraction"｜"scope_analysis"｜"weakness" }` |
| 输出 | `AnalysisReport`：权利要求特征列表（独立/从属分解）、保护范围界定、弱点标注 |
| 推荐模型 | 轻量快速模型（如 qwen3.5），temperature=0.2 |
| YunPat 映射 | `@yunpat/agent-patent-analyzer`（V2） |
| 使用者 | OA Response, Reexamination, Invalidation |

**NoveltyAnalyzerAgent（新颖性分析代理）**

| 项目 | 说明 |
|------|------|
| 职责 | 基于单独对比原则的新颖性判断 |
| 输入 | `{ claim: string, priorArt: PriorArtDocument, claimType: "independent"｜"dependent" }` |
| 输出 | `NoveltyAnalysis`：逐特征对比表（权利要求特征 vs 对比文件公开内容 → 公开/未公开）+ 综合判断（完全公开/部分公开/未公开） |
| 推荐模型 | 深度推理模型（如 deepseek-reasoner），temperature=0.2 |
| YunPat 映射 | `@yunpat/agent-patent-analyzer`（新颖性分析模块） |
| 使用者 | Reexamination, Invalidation |

**CreativityAnalyzerAgent（创造性分析代理）**

| 项目 | 说明 |
|------|------|
| 职责 | 基于三步法的创造性判断 |
| 输入 | `{ claim: string, closestPriorArt: PriorArtDocument, secondaryReferences?: PriorArtDocument[] }` |
| 输出 | `CreativityAnalysis`：① 最接近现有技术确定 → ② 区别特征和实际解决的技术问题 → ③ 显而易见性判断（技术启示分析 + 辅助因素）+ 结论 |
| 推荐模型 | 深度推理模型（如 deepseek-reasoner），temperature=0.2 |
| YunPat 映射 | `@yunpat/agent-patent-analyzer`（创造性分析模块） |
| 使用者 | Reexamination, Invalidation |

**InventionUnderstandingAgent（发明理解代理）**

| 项目 | 说明 |
|------|------|
| 职责 | 从技术交底书中提取结构化的发明理解 |
| 输入 | `{ disclosure: string ｜ FilePath, patentType?: "发明"｜"实用新型" }` |
| 输出 | `InventionUnderstanding`：发明名称、类型、技术领域、核心创新点、技术问题、技术方案、技术效果、必要特征、可选特征、置信度 |
| 推荐模型 | 轻量快速模型（如 qwen3.5），temperature=0.3 |
| YunPat 映射 | `@yunpat/agent-invention` |
| 使用者 | Drafting（Phase 2 全流程管理可能复用） |

**SubjectMatterChecker（保护客体检查代理）**

| 项目 | 说明 |
|------|------|
| 职责 | 检查权利要求是否属于可授权客体 |
| 输入 | `{ claims: string[], inventionType: string }` |
| 输出 | `SubjectMatterCheck`：每条权利要求的客体适格性（通过/不通过/需修改）+ 法律依据（A2/A5/A25）+ 修改建议 |
| 推荐模型 | 轻量快速模型（如 qwen3.5），temperature=0.2 |
| YunPat 映射 | `@yunpat/agent-subject-matter-checker` |
| 使用者 | Drafting |

**OfficeActionParser（OA 文档解析代理）**

| 项目 | 说明 |
|------|------|
| 职责 | 解析审查意见通知书，提取结构化数据 |
| 输入 | `{ document: string ｜ FilePath }` |
| 输出 | `OfficeAction`：OA编号、申请号、驳回类型（A22.2/A22.3/A26.3/A26.4/A33）、驳回理由、对比文件列表、被引权利要求、审查员论点、缺失技术特征、答复期限 |
| 推荐模型 | 轻量快速模型（如 qwen3.5），temperature=0.2 |
| YunPat 映射 | `@yunpat/patent-core`（OA 文档解析） |
| 使用者 | OA Response |

**ExaminerSimulator（审查员模拟代理）**

| 项目 | 说明 |
|------|------|
| 职责 | 模拟审查员视角，预判可能的反驳和关注点 |
| 输入 | `{ application: string, priorArt: PriorArtDocument[], analysisType: "novelty"｜"creativity"｜"full" }` |
| 输出 | `ExaminerPerspective`：审查员可能的反驳论点、关注的技术问题、可能的审查结论建议 |
| 推荐模型 | 深度推理模型（如 deepseek-reasoner），temperature=0.5 |
| YunPat 映射 | `@yunpat/agent-patent-responder`（审查员模拟模块） |
| 使用者 | OA Response |

**InvalidationAnalyzerAgent（无效分析代理）**

| 项目 | 说明 |
|------|------|
| 职责 | 无效理由组合分析、证据链构建、攻击策略优化 |
| 输入 | `{ targetPatent: AnalysisReport, evidence: SearchResult[], grounds: InvalidationGround[] }` |
| 输出 | `InvalidationStrategy`：理由组合方案 + 证据链（证据组×攻击目标映射）+ 各组合成功率评估 |
| 推荐模型 | 深度推理模型（如 deepseek-reasoner），temperature=0.3 |
| YunPat 映射 | YunPat 无效分析专用模块 |
| 使用者 | Invalidation |

**SmartOAResponder（OA 核心分析代理）**

| 项目 | 说明 |
|------|------|
| 职责 | OA 驳回理由深度分析和答复策略生成 |
| 输入 | `{ officeAction: OfficeAction, priorArt: PriorArtDocument[], mode: "analyze"｜"plan_response" }` |
| 输出 | analyze 模式：`ComparisonReport`（三元组对比分析）；plan_response 模式：`ResponsePlan`（多方案策略对比表） |
| 推荐模型 | 深度推理模型（如 deepseek-reasoner），temperature=0.3 |
| YunPat 映射 | `@yunpat/agent-patent-responder`（V5） |
| 使用者 | OA Response |

##### 撰写类

**WriterAgent（法律文书撰写代理）**

| 项目 | 说明 |
|------|------|
| 职责 | 撰写复审请求书、无效宣告请求书等法律文书 |
| 输入 | `{ documentType: "reexamination_request"｜"invalidation_request"｜"response_statement", strategy: Strategy, evidence: Evidence[], template?: string }` |
| 输出 | `LegalDocument`：结构化法律文书（Markdown）+ 证据清单 + 附件清单 |
| 推荐模型 | 深度推理模型（如 deepseek-reasoner），temperature=0.3 |
| YunPat 映射 | `@yunpat/agent-patent-writer` |
| 使用者 | Reexamination, Invalidation |

**ClaimReviser（权利要求修订代理）**

| 项目 | 说明 |
|------|------|
| 职责 | 修改权利要求，生成修改对照标注 |
| 输入 | `{ originalClaims: string[], modificationBasis: "specification"｜"original_filing", strategy: string, allowedModifications?: string[] }` |
| 输出 | `RevisedClaims`：修改后权利要求全文 + 修改对照表（原文 vs 修改后 + 修改依据） |
| 推荐模型 | 深度推理模型（如 deepseek-reasoner），temperature=0.3 |
| YunPat 映射 | `@yunpat/agent-patent-responder`（权利要求修订模块） |
| 使用者 | OA Response, Reexamination |

**SpecificationAgent（说明书撰写代理）**

| 项目 | 说明 |
|------|------|
| 职责 | 撰写说明书各章节 |
| 输入 | `{ invention: InventionUnderstanding, comparison: ComparisonReport, patentType: string }` |
| 输出 | `SpecificationDraft`：技术领域 → 背景技术 → 发明内容 → 具体实施方式 → 附图说明 |
| 推荐模型 | 深度推理模型（如 deepseek-reasoner），temperature=0.3 |
| YunPat 映射 | `@yunpat/agent-specification` + `@yunpat/agent-patent-writer` |
| 使用者 | Drafting |

**ClaimsAgent（权利要求撰写代理）**

| 项目 | 说明 |
|------|------|
| 职责 | 撰写权利要求书 |
| 输入 | `{ invention: InventionUnderstanding, specification: SpecificationDraft, type: "装置"｜"方法"｜"系统"｜"组合物" }` |
| 输出 | `ClaimsSet`：独立权利要求 + 从属权利要求（分层布局） |
| 推荐模型 | 深度推理模型（如 deepseek-reasoner），temperature=0.3 |
| YunPat 映射 | `@yunpat/agent-claims` |
| 使用者 | Drafting |

##### 质量与验证类

**QualityCheckerAgent（质量检查代理）**

| 项目 | 说明 |
|------|------|
| 职责 | 专利文件 7 维度质量评估（completeness/clarity/accuracy/sufficiency/consistency/compliance/support） |
| 输入 | `{ document: string ｜ FilePath, documentType: "specification"｜"claims"｜"response"｜"reexamination"｜"invalidation", checkDimensions?: string[] }` |
| 输出 | `QualityReport`：各维度得分（0-10）+ 权重综合得分 + 不达标项修复建议；阈值 ≥7.5 |
| 推荐模型 | 轻量快速模型（如 qwen3.5），temperature=0.2 |
| YunPat 映射 | `@yunpat/agent-quality` |
| 使用者 | Drafting, OA Response, Reexamination, Invalidation |

**OAResponseValidator（OA 答复验证代理）**

| 项目 | 说明 |
|------|------|
| 职责 | 验证答复文件的完整性、格式合规性、一致性 |
| 输入 | `{ responseStatement: string, revisedClaims: string, officeAction: OfficeAction }` |
| 输出 | `ValidationResult`：通过/不通过 + 各检查项结果（格式/一致性/完整性/修改不超范围） |
| 推荐模型 | 轻量快速模型（如 qwen3.5），temperature=0.1 |
| YunPat 映射 | `@yunpat/agent-patent-responder`（答复验证模块） |
| 使用者 | OA Response |

##### 辅助类

**HebbianOptimizer（案例学习代理）**

| 项目 | 说明 |
|------|------|
| 职责 | 从历史成功/失败案例中学习，优化策略推荐 |
| 输入 | `{ currentCase: CaseFeatures, caseDatabase: CaseDatabase }` |
| 输出 | `StrategyRecommendation`：相似案例（Top-K）+ 成功策略 + 权重调整建议 |
| 推荐模型 | 不直接使用 LLM（检索+统计驱动） |
| YunPat 映射 | YunPat 案例学习优化模块 |
| 使用者 | OA Response |

**DisclosureRefinerAgent（交底精炼代理）**

| 项目 | 说明 |
|------|------|
| 职责 | 精炼和补全技术交底书 |
| 输入 | `{ disclosure: string ｜ FilePath }` |
| 输出 | `RefinedDisclosure`：补全后的交底书 + 缺失信息提示 + 建议补充项 |
| 推荐模型 | 轻量快速模型（如 qwen3.5），temperature=0.3 |
| YunPat 映射 | `@yunpat/agent-analysis/DisclosureRefinerAgent` |
| 使用者 | Drafting |

**ComparisonReportGenerator（对比报告生成代理）**

| 项目 | 说明 |
|------|------|
| 职责 | 生成特征对比分析报告 |
| 输入 | `{ target: ClaimSet, priorArt: PriorArtDocument[], comparisonType: "novelty"｜"creativity"｜"full" }` |
| 输出 | `ComparisonReport`：逐特征对比表 + 区别特征汇总 + 发明点定位 |
| 推荐模型 | 轻量快速模型（如 qwen3.5），temperature=0.2 |
| YunPat 映射 | `@yunpat/agent-analysis/ComparisonReportGeneratorAgent` |
| 使用者 | Invalidation, OA Response |

**InfringementAnalyzerAgent（侵权分析代理）**

| 项目 | 说明 |
|------|------|
| 职责 | 权利要求解释和侵权判定（辅助无效分析中的权利要求解释） |
| 输入 | `{ claims: string[], accusedProduct?: string }` |
| 输出 | `InfringementAnalysis`：权利要求解释（最宽合理解释原则）+ 技术特征分解 |
| 推荐模型 | 深度推理模型（如 deepseek-reasoner），temperature=0.2 |
| YunPat 映射 | `@yunpat/agent-patent-analyzer`（侵权分析模块） |
| 使用者 | Invalidation |

##### 多模态类

**PatentImageAnalyzer（专利附图分析代理）**

| 项目 | 说明 |
|------|------|
| 职责 | 分析专利附图（结构图、流程图、电路图、化学结构式），提取技术特征 |
| 输入 | `{ image: FilePath ｜ URL, analysisType: "structure"｜"flow"｜"circuit"｜"chemical"｜"auto", relatedClaims?: string[] }` |
| 输出 | `ImageAnalysis`：图像描述 + 技术特征标注列表 + 与权利要求的特征对照（如提供 claims） |
| 推荐模型 | 多模态模型：glm-4v-plus（优先）/ doubao-vision-pro / 本地 qwen-vl（隐私敏感） |
| YunPat 映射 | 新增（DeepSeek-TUI 未实现） |
| 使用者 | Drafting（附图分析）, OA Response（对比文件附图）, Invalidation（目标专利附图） |

**DocumentParser（文档解析代理）**

| 项目 | 说明 |
|------|------|
| 职责 | 解析 PDF/扫描件文档（审查意见通知书、驳回决定等），提取结构化信息 |
| 输入 | `{ document: FilePath, documentType: "office_action"｜"rejection_decision"｜"patent_document"｜"other" }` |
| 输出 | `ParsedDocument`：提取的结构化数据 + OCR 文本（如需）+ 关键区域标注 |
| 推荐模型 | 多模态模型：moonshot-v1 文件模式（长文档）/ glm-4v（单页扫描件） |
| YunPat 映射 | `@yunpat/patent-core`（文档解析扩展） |
| 使用者 | OA Response, Reexamination |

##### 嵌入与检索类

**EmbeddingService（嵌入服务）**

| 项目 | 说明 |
|------|------|
| 职责 | 文本向量化，支撑语义检索和相似度计算 |
| 输入 | `{ texts: string[], model?: string }` |
| 输出 | `EmbedResponse`：向量矩阵 + 模型信息 + 维度 |
| 推荐模型 | 嵌入模型：智谱 embedding-3 / 豆包 doubao-embedding-large / 本地 bge-m3（隐私敏感） |
| YunPat 映射 | 新增（基础设施服务） |
| 使用者 | PatentSearchAgent, HebbianOptimizer, 知识库向量化 |

**RerankService（重排序服务，可选）**

| 项目 | 说明 |
|------|------|
| 职责 | 对检索结果二次精排，提升 Top-K 精度 |
| 输入 | `{ query: string, documents: string[], topN?: number }` |
| 输出 | `RerankResponse`：重排序后的文档列表 + 相关性评分 |
| 推荐模型 | Rerank 模型：本地 bge-reranker-v2-m3（可选） |
| YunPat 映射 | 新增（可选基础设施） |
| 使用者 | PatentSearchAgent（可选增强） |
| 降级策略 | Rerank 不可用时，直接使用向量检索 + BM25 混合排序结果 |

---

## 第四章：编排层设计

> 编排层是连接交互层（TUI）和专业层（智能体）的中枢。采用分层选型：Rust 实现编排和运行时，智能体实现语言灵活（通过 MCP 协议接入）。

### 第十一条：核心概念模型

```
┌─────────────────────────────────────────────────────────────┐
│                       User                                   │
│                         │                                    │
│                    ┌────▼─────┐                               │
│                    │   TUI    │  交互层（现有 DeepSeek-TUI）  │
│                    └────┬─────┘                               │
│                         │ UserInput / ApprovalDecision       │
│                    ┌────▼─────────────┐                      │
│                    │   Orchestrator   │  编排层（Rust）       │
│                    │  ┌────────────┐  │                      │
│                    │  │   Router   │  │ 意图识别 → 智能体分发 │
│                    │  ├────────────┤  │                      │
│                    │  │  Session   │  │ 会话 & 案件状态管理   │
│                    │  ├────────────┤  │                      │
│                    │  │  Approval  │  │ 审批流控制            │
│                    │  ├────────────┤  │                      │
│                    │  │  Registry  │  │ 智能体注册与发现      │
│                    │  ├────────────┤  │                      │
│                    │  │ MCP Bridge │  │ 外部智能体桥接        │
│                    │  └────────────┘  │                      │
│                    └──┬───┬───┬───┬──┘                      │
│                       │   │   │   │                          │
│              ┌────────┘   │   │   └────────┐                │
│         ┌────▼───┐ ┌─────▼┐ ┌▼─────┐ ┌────▼─────┐          │
│         │Research│ │Draft │ │OA Resp│ │Reexam/   │  场景层  │
│         │ Agent  │ │Agent │ │Agent  │ │Inval Agent│          │
│         │ (编排流)│ │(编排流)│ │(编排流)│ │ (编排流)  │          │
│         └────┬───┘ └──┬───┘ └──┬────┘ └────┬─────┘          │
│              │        │        │            │                 │
│         ┌────▼────────▼────────▼────────────▼────┐           │
│         │        Shared Agents（共享层）          │           │
│         │  ┌───────────────────────────────┐     │           │
│         │  │  Rust 原生智能体               │     │           │
│         │  │  (高性能/核心路径)             │     │           │
│         │  └───────────────────────────────┘     │           │
│         │  ┌───────────────────────────────┐     │           │
│         │  │  MCP 外部智能体               │     │           │
│         │  │  (TS/Python 实现，按需启动)    │     │           │
│         │  └───────────────────────────────┘     │           │
│         └────────────────────────────────────────┘           │
│              │        │        │            │                 │
│         ┌────▼────────▼────────▼────────────▼────┐           │
│         │          Tool Layer（工具层，Rust）      │           │
│         │  File | Shell | DB | MCP | Web | ...    │          │
│         └────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

### 第十二条：核心接口定义

#### 12.1 智能体接口 (Agent)

所有专业智能体和共享智能体必须实现此接口。支持两种传输方式：Rust 原生（进程内）和 MCP 外部（跨进程）：

```
interface Agent {
  // 身份
  id: AgentId
  name: string
  description: string
  capabilities: string[]          // 声明的能力标签
  transport: "native" | "mcp"    // 传输方式

  // 生命周期
  initialize(context: AgentContext): void
  execute(input: AgentInput, context: AgentContext): AsyncGenerator<StageOutput>
  terminate(): void

  // 自省
  canHandle(input: UserIntent): Confidence   // 0.0 ~ 1.0
  getStages(): StageDefinition[]             // 声明阶段列表（编排流返回步骤定义）
}

// 编排流智能体额外实现此接口
interface OrchestrationAgent extends Agent {
  getFlowDefinition(): OrchestrationFlow     // 返回编排流程定义
}
```

关键设计决策：
- `execute` 返回 `AsyncGenerator` — 支持流式输出和阶段间暂停
- `canHandle` 返回置信度而非布尔值 — 允许多个智能体候选，由 Router 决策
- `getStages` 声明式暴露阶段定义 — TUI 可据此渲染进度和审批点
- `transport` 标识传输方式 — `native` 为 Rust 进程内调用，`mcp` 为外部进程调用（对上层透明）
- `OrchestrationAgent` — 场景智能体（Drafting/OA/Reexamination/Invalidation）额外暴露编排流定义

#### 12.2 阶段输出 (StageOutput)

智能体在每个阶段产生的输出：

```
interface StageOutput {
  stageId: string                 // 当前阶段标识
  stageName: string               // 显示名称
  type: StageType                 // 见下表
  content: string                 // 输出内容（Markdown）
  multimodalContent?: MultimodalContent[]  // 多模态内容（图像分析结果、附图标注等）
  artifacts: Artifact[]           // 产生的文件/数据
  requiresApproval: boolean       // 是否需要用户审批
  approvalRequest?: ApprovalRequest
  metadata: StageMetadata         // 网络调用、token 用量等
}

interface MultimodalContent {
  type: "image_analysis"｜"document_scan"｜"diagram_annotation"
  source: string                  // 原始图像/文档路径
  description: string             // AI 生成的描述/分析
  annotations?: Annotation[]      // 标注（特征标注、区域标记等）
}

enum StageType {
  "analysis"      // 分析结果（审查意见解析、特征对比等）
  "suggestion"    // 策略建议（答辩选项、检索策略等）
  "draft"         // 草案输出（权利要求、意见陈述书等）
  "question"      // 向用户提问（澄清需求、确认理解等）
  "progress"      // 中间进度（检索中、分析中等）
  "completed"     // 阶段完成
}
```

#### 12.3 审批接口 (ApprovalGate)

```
interface ApprovalRequest {
  approvalId: string
  stageId: string
  summary: string                 // 一句话描述需要审批的内容
  content: string                 // 待审批内容全文
  options: ApprovalOption[]       // 可选操作
  defaultOption: string           // 推荐选项
}

interface ApprovalOption {
  id: string                      // "approve" | "modify" | "reject" | "retry"
  label: string                   // "确认" | "修改" | "拒绝" | "重新生成"
  prompt?: string                 // 选择此选项后的提示（如"请输入修改意见"）
}

interface ApprovalDecision {
  approvalId: string
  selectedOption: string
  modifications?: string          // 用户修改意见
}
```

#### 12.4 上下文接口 (AgentContext)

智能体执行时可访问的运行时环境：

```
interface AgentContext {
  // 身份与会话
  sessionId: string
  caseId?: string                 // 关联的专利案件 ID
  userId: string

  // 知识与数据
  knowledgeBase: KnowledgeSource  // 法规库、案例库、模板库
  caseRepository: CaseRepository  // 案件数据读写

  // 工具
  toolRegistry: ToolRegistry      // 可调用的工具集

  // 共享智能体
  agentPool: AgentPool            // 可调用的共享智能体

  // 模型服务（按需启动）
  modelProvider: ModelProvider    // 统一模型提供商入口
  // modelProvider.chat(text, config)          → 文本/推理
  // modelProvider.multimodal(image, text)     → 图像理解
  // modelProvider.embed(texts)                → 向量嵌入
  // modelProvider.rerank(query, docs)         → 重排序（可选，不可用时返回原始排序）

  // 历史
  conversationHistory: Message[]  // 对话历史
  previousStages: StageOutput[]   // 本智能体已完成阶段的输出
}

// 统一模型提供商接口
interface ModelProvider {
  // 文本/推理模型
  chat(request: ChatRequest): AsyncGenerator<ChatChunk>
  // 多模态模型（必须支持）
  multimodal(request: MultimodalRequest): AsyncGenerator<ChatChunk>
  // 嵌入模型（必须支持）
  embed(request: EmbedRequest): EmbedResponse
  // Rerank 模型（可选）
  rerank?(request: RerankRequest): RerankResponse
  // 按需选择特定提供商
  withProvider(providerId: string): ModelProvider
  // 按需选择特定模型
  withModel(modelId: string): ModelProvider
}

interface MultimodalRequest {
  messages: (TextMessage | ImageMessage)[]
  model?: string                       // 指定多模态模型，默认取 provider defaults
  temperature?: number
  maxTokens?: number
}

interface ImageMessage {
  role: "user"｜"assistant"
  content: [
    { type: "text", text: string },
    { type: "image_url", image_url: { url: string } }  // 本地路径或 URL
  ]
}

interface EmbedRequest {
  texts: string[]
  model?: string                       // 指定嵌入模型
}

interface EmbedResponse {
  embeddings: number[][]               // 每个文本的向量
  model: string
  dimensions: number
}

interface RerankRequest {
  query: string
  documents: string[]
  model?: string                       // 指定 rerank 模型
  topN?: number                        // 返回 Top-N
}

interface RerankResponse {
  results: { index: number; score: number; text: string }[]
  model: string
}
```

#### 12.5 智能体注册表 (AgentRegistry)

```
interface AgentRegistry {
  // 注册
  register(agent: Agent): void
  unregister(agentId: AgentId): void

  // 发现
  resolve(intent: UserIntent): Agent | null
  getById(agentId: AgentId): Agent | null
  listByDomain(domain: string): Agent[]
  listAll(): AgentInfo[]
}

interface AgentInfo {
  id: AgentId
  name: string
  description: string
  capabilities: string[]
  stages: StageDefinition[]
}
```

#### 12.6 编排器 (Orchestrator)

编排层的顶层协调者：

```
interface Orchestrator {
  // 路由 — 根据用户输入选择智能体
  dispatch(input: UserInput, session: Session): AsyncGenerator<StageOutput>

  // 审批 — 用户对审批请求做出决策后继续执行
  approve(decision: ApprovalDecision): AsyncGenerator<StageOutput>

  // 中断 — 用户中途打断当前智能体
  interrupt(): void

  // 查询 — 当前活跃智能体状态
  getActiveTask(): ActiveTask | null

  // 通用模式 — 不涉及专业智能体时的通用对话（保留现有 DeepSeek-TUI 行为）
  chat(input: UserInput, session: Session): AsyncGenerator<ChatOutput>
}

interface ActiveTask {
  agentId: AgentId
  currentStage: string
  awaitingApproval: boolean
  startedAt: Timestamp
}
```

#### 12.7 编排流程模型 (OrchestrationFlow)

场景智能体（Drafting、OA Response、Reexamination、Invalidation）均为编排流程，由多个步骤组成，每个步骤调用一个或多个共享智能体：

```
interface OrchestrationFlow {
  flowId: string                       // "drafting" | "oa_response" | ...
  flowName: string                     // 显示名称
  description: string

  // 步骤定义（有序）
  steps: FlowStep[]

  // 全局质量标准
  qualityDimensions: QualityDimension[]
}

interface FlowStep {
  stepId: string                       // "step_1_understand"
  stepName: string                     // "发明理解"
  order: number                        // 执行顺序

  // 调用的共享智能体
  agentCalls: AgentCall[]

  // 人机交互
  requiresApproval: boolean            // 步骤完成后是否暂停等待用户确认
  approvalPrompt?: string              // 审批提示模板

  // 质量检查
  qualityCheck?: QualityCheckConfig    // 步骤级质量检查配置
}

interface AgentCall {
  agentId: string                      // 共享智能体 ID
  inputMapping: Record<string, string> // 输入参数映射（从上下文/前序步骤输出中取值）
  outputKey: string                    // 输出存入上下文的 key
  condition?: string                   // 条件执行（如 "strategy == 'modify'"）
  loop?: LoopConfig                    // 循环执行（如"逐驳回理由撰写"）
}

interface LoopConfig {
  iterateOver: string                  // 循环源（如 "officeAction.rejectionReasons"）
  maxIterations: number                // 安全上限
}

interface QualityCheckConfig {
  dimensions: string[]                 // 检查维度
  threshold: number                    // 阈值（默认 7.5）
  maxAutoRetries: number               // 自动迭代次数（默认 3）
  escalateToHuman: boolean             // 超出自动迭代后是否转人工
}
```

设计要点：
- **声明式定义** — 编排流程通过配置描述（TOML/JSON），而非硬编码。新增场景只需定义 FlowStep 序列
- **输入映射** — `inputMapping` 支持从前序步骤输出或会话上下文中取值，实现步骤间数据传递
- **条件执行** — `condition` 支持按策略选择不同子智能体（如 OA Response 步骤 3 按驳回类型选择分析框架）
- **循环** — `loop` 支持对列表数据的逐项处理（如逐驳回理由撰写）
- **质量守卫** — 每个步骤可配置质量检查，自动迭代修复，超出阈值转人工

#### 12.8 MCP 桥接接口 (MCPBridge)

Rust 编排层通过 MCP 协议与外部智能体（TS/Python 实现）通信。复用 DeepSeek-TUI 现有 MCP 基础设施：

```
interface MCPBridge {
  // 智能体进程管理
  startServer(config: MCPServerConfig): Promise<ServerHandle>
  stopServer(handle: ServerHandle): void
  healthCheck(handle: ServerHandle): HealthStatus

  // 调用外部智能体（统一封装为 Agent 接口）
  invoke(
    handle: ServerHandle,
    tool: string,                       // MCP tool 名称
    input: Record<string, any>,
    timeout?: number
  ): Promise<MCPToolResult>
}

interface MCPServerConfig {
  serverId: string                     // 与共享智能体 ID 对应
  command: string                      // 启动命令（如 "node /path/to/agent-server.js"）
  args?: string[]
  env?: Record<string, string>
  transport: "stdio"                   // Phase 1 仅支持 stdio
}

interface MCPToolResult {
  success: boolean
  output: string                       // JSON 序列化的智能体输出
  error?: string
  metadata?: {
    tokenUsage?: TokenUsage
    duration?: number
  }
}
```

与现有 Agent 接口的关系：
- MCP 桥接的智能体在 `AgentRegistry` 中注册时标记 `transport: "mcp"`
- Orchestrator 调用 `agent.execute()` 时，若检测到 MCP 类型，自动通过 `MCPBridge` 转发
- 对上层调用者透明 — 无论是 Rust 原生智能体还是 MCP 外部智能体，接口一致

```
// 智能体注册时的传输类型扩展
interface AgentRegistration {
  agent: Agent
  transport: "native"                  // Rust 进程内
           | "mcp"                     // 外部 MCP 进程
  mcpConfig?: MCPServerConfig          // MCP 类型时必填
}
```

### 第十三条：路由规则

编排器的 Router 负责将用户输入分发到正确的处理器：

```
路由优先级：
1. 显式指定 — 用户通过命令选择智能体（如 /draft, /oa, /reexam, /invalid, /research）
2. 上下文关联 — 当前会话已有活跃智能体，继续该智能体的下一个阶段
3. 意图识别 — 根据输入内容和文件类型推断意图，匹配智能体的 canHandle()
4. 通用模式 — 无匹配时走现有 DeepSeek-TUI 的通用对话路径
```

意图识别规则（Phase 1 简化版）：

| 触发条件 | 路由目标 |
|---------|---------|
| 输入包含"研究"+"法规/规则/案例" | Research Agent |
| 输入包含"撰写/申请"+ 附带技术文档 | Drafting Agent |
| 输入附带审查意见通知书文件 | OA Response Agent |
| 输入包含"复审/驳回决定" | Reexamination Agent |
| 输入包含"无效/无效宣告" | Invalidation Agent |
| 其他 | 通用对话（保留 DeepSeek-TUI 行为） |

### 第十四条：会话与案件分离

```
Session（会话）— 一次 TUI 启动后的完整交互过程
  ├── 可包含多个 Agent 任务
  ├── 继承 DeepSeek-TUI 现有会话管理
  └── 支持会话保存/恢复

Case（案件）— 一个具体的专利案件（可选）
  ├── 包含案件元数据（申请号、发明人、代理师等）
  ├── 关联多个文档（交底书、申请文件、审查意见等）
  ├── 关联多个 Agent 任务（撰写、答辩、复审等）
  ├── 案件数据跨会话持久化
  └── 同一会话可处理多个案件，不同案件数据隔离
```

Case 数据结构：

```
interface Case {
  caseId: string
  applicationNo?: string               // 申请号（如已有）
  title: string                        // 发明名称
  patentType: "发明"｜"实用新型"｜"外观设计"

  // 关联人员
  inventor?: string
  agent?: string                       // 代理师
  applicant?: string                   // 申请人

  // 文档
  documents: CaseDocument[]            // 关联文档列表

  // 任务历史
  tasks: CaseTask[]                    // 已执行的 Agent 任务

  // 状态
  status: CaseStatus                   // "active" | "closed" | "archived"
  createdAt: Timestamp
  updatedAt: Timestamp
}

interface CaseDocument {
  docId: string
  docType: "disclosure"｜"application"｜"office_action"｜"response"｜"reexamination_request"｜"invalidation_request"｜"other"
  filePath: string
  uploadedAt: Timestamp
  metadata?: Record<string, any>       // 文档特定的元数据
}

interface CaseTask {
  taskId: string
  agentId: AgentId                     // 执行的场景智能体
  startedAt: Timestamp
  completedAt?: Timestamp
  status: "running"｜"completed"｜"failed"｜"canceled"
  outputArtifacts?: string[]           // 产出的文件路径
}
```

### 第十五条：通用模式兼容

当用户的输入不触发任何专业智能体时，系统完全退化为现有 DeepSeek-TUI 的行为：

1. 通用对话 — 所有编码、文件操作、搜索等现有功能不变
2. 工具体系 — 现有全部工具（shell, file, git, web, subagent 等）不变
3. 模型调用 — 现有 streaming Chat Completions 流程不变
4. 审批体系 — 现有 plan/agent/yolo 模式和工具审批流程不变

专业智能体和通用模式共享同一个会话，可在同一对话中无缝切换。用户可以在写专利文件的间隙让 AI 修一段代码，然后继续写权利要求。

---

## 第五章：技术约束

### 第十六条：融合架构与分层选型

YunPat TUI 采用全新整合方式，从 DeepSeek-TUI 和 YunPat 两个项目中选取模块组合为统一代码库。遵循以下规则：

1. **统一入口** — 一个二进制文件，通过配置和子命令切换工作模式
2. **统一会话** — 编码任务和专利任务共享会话状态和上下文
3. **统一工具注册** — 通用工具和专利工具在同一个工具注册表中管理
4. **保留现有能力** — 所有 DeepSeek-TUI 现有功能必须 100% 保留，不得降级

**分层选型原则**：按职责选择技术栈，不追求单一语言。

5. **Rust 编排层** — 智能体调度器（Orchestrator）、会话/案件管理、TUI/CLI/HTTP API、MCP 客户端、工具系统、Prompt 模板加载，均在 Rust 中实现（复用 DeepSeek-TUI 现有基础设施）
6. **智能体实现层（语言灵活）** — 智能体的具体实现（如 OfficeActionParser、SmartOAResponder 等）可采用 TypeScript/Python 等语言，通过 MCP 协议接入 Rust 运行时
7. **Prompt 外部化** — 智能体的 prompt 模板以 TOML/Markdown 文件存储，运行时动态加载，无需重编译
8. **渐进收敛** — 经过验证稳定的智能体可逐步用 Rust 重写，但非强制要求

**模型提供商层**：支持多模型提供商，按需启动，按任务选型。

9. **多提供商支持（必须）** — 必须支持以下提供商，均通过 OpenAI 兼容 API 接入：

| 提供商 | 用途 | 接入方式 | 必选/可选 |
|--------|------|---------|----------|
| DeepSeek | 文本推理/生成（默认） | `api.deepseek.com/beta` | 必选（已有） |
| 智谱（GLM） | 文本/多模态/嵌入 | `open.bigmodel.cn/api/paas/v4` | 必选 |
| 月之暗面（Kimi） | 长文本/文档理解 | `api.moonshot.cn/v1` | 必选 |
| 豆包（字节跳动） | 文本/多模态/嵌入 | `ark.cn-beijing.volces.com/api/v3` | 必选 |
| 本地模型 | 隐私敏感场景 | Ollama / oMLX / vLLM（OpenAI 兼容） | 可选 |

本地模型运行时优先级（macOS 环境）：**oMLX > Ollama > vLLM**
- **oMLX**（首选）— Apple Silicon 原生 MLX 推理服务器，SSD KV 缓存（编码智能体场景 TTFT <5s），同时服务 LLM/VLM/Embedding/Reranker，OpenAI + Anthropic 兼容 API，原生支持 Tool Calling + MCP
- **Ollama** — 跨平台通用方案，2026.3 起默认使用 MLX 后端（macOS），社区模型生态丰富
- **vLLM** — Linux 服务器部署方案，高吞吐量场景

10. **多模态模型（必须）** — 专利工作必须支持图像理解，按需启动：

| 提供商 | 多模态模型 | 专利场景 |
|--------|-----------|---------|
| 智谱 | glm-4v / glm-4v-plus | 专利附图分析、技术图表理解 |
| 月之暗面 | moonshot-v1（文件模式） | 审查意见 PDF 解析、长文档理解 |
| 豆包 | doubao-vision-pro | 图像理解、文档扫描件 OCR |
| 本地 | llava / qwen-vl / internvl2 | 隐私敏感的图像分析（未公开发明内容） |

多模态在专利领域的核心场景：
- 专利附图分析（结构图、流程图、电路图、化学结构式）
- 审查意见通知书 PDF 扫描件解析
- 技术交底书中的照片/截图/手绘图理解
- 对比文件附图与权利要求特征对照

11. **嵌入模型（必须）** — 语义检索和向量检索的必要基础设施，按需启动：

| 提供商 | 嵌入模型 | 维度 | 用途 |
|--------|---------|------|------|
| 智谱 | embedding-3 | 2048 | 法规/案例语义检索、知识库向量化 |
| 豆包 | doubao-embedding-large | 1024 | 专利文献语义检索 |
| 本地 | bge-m3 / bge-large-zh | 1024 | 隐私敏感数据的本地向量化 |

嵌入模型用于：
- PatentSearchAgent 的语义检索（替代纯关键词检索）
- 知识库（法规/案例/模板）的向量化索引
- 对比文件与目标专利的语义相似度计算
- HebbianOptimizer 的案例特征向量化

12. **Rerank 模型（可选）** — 当可用时提升检索精度，不可用时降级为纯向量检索：

| 提供商 | Rerank 模型 | 用途 |
|--------|-----------|------|
| 智谱 | — | （按可用性） |
| 本地 | bge-reranker-v2-m3 | 本地重排序 |

Rerank 用于：检索结果二次排序（BM25 + 向量 → Rerank 精排），提升对比文件检索的 Top-K 精度。

**模型配置接口**：

```
interface ModelProviderConfig {
  providers: ProviderConfig[]          // 多提供商配置

  // 任务级默认模型映射
  defaults: {
    chat: string                       // 默认文本模型
    reasoning: string                  // 默认推理模型
    multimodal: string                 // 默认多模态模型
    embedding: string                  // 默认嵌入模型
    rerank?: string                    // 可选 Rerank 模型
  }
}

interface ProviderConfig {
  id: string                           // "deepseek" | "zhipu" | "moonshot" | "doubao" | "local"
  name: string                         // 显示名称
  baseUrl: string                      // API endpoint
  apiKey?: string                      // 可选（本地模型无需）
  enabled: boolean                     // 是否启用
  models: ModelConfig[]                // 该提供商下的模型列表
}

interface ModelConfig {
  modelId: string                      // 模型 ID（如 "glm-4v"）
  type: "chat"｜"reasoning"｜"multimodal"｜"embedding"｜"rerank"
  maxTokens?: number
  contextWindow?: number
  capabilities?: string[]              // ["vision", "file", "function_calling"]
}
```

**按需启动**：模型提供商和模型不默认全部连接。规则如下：
- DeepSeek 始终启动（默认提供商）
- 其他提供商在首次调用时按需初始化连接（懒加载）
- 本地模型（Ollama/vLLM）仅在配置启用时尝试连接，不可用时静默降级
- 嵌入模型在首次语义检索时按需启动
- Rerank 模型仅在配置存在时启用，否则跳过精排步骤

### 第十七条：数据与隐私

1. 本地优先 — 所有案件数据默认存储在本地，不强制上传云端
2. 数据隔离 — 不同案件的数据严格隔离，不得交叉污染
3. 敏感信息保护 — 涉及未公开发明内容的操作需额外的安全措施
4. 可审计 — 所有 AI 参与的操作留有完整日志

### 第十八条：质量保证

1. 专业审校 — AI 生成的法律文件必须经过专业审校流程
2. 模板驱动 — 专利文件生成基于经过验证的模板，不凭空生成
3. 一致性检查 — 权利要求与说明书的一致性自动检查
4. 法规更新 — 专利法及相关规则的变更必须及时反映到系统中

---

## 第六章：修订与治理

### 第十九条

本宪法的修订需要明确记录修订原因和影响范围。每次修订产生新版本，旧版本归档保留。

### 第二十条

当技术实现细节与宪法原则冲突时：
1. 首先评估是否可以通过调整实现方式解决
2. 如果技术限制确实无法满足宪法要求，提出宪法修正案讨论
3. 在修正案通过前，技术实现应尽可能接近宪法要求

---

*宪法版本: v0.6-draft*
*创建日期: 2026-05-07*
*状态: 草案，待讨论确认*
*变更记录:*
- *v0.6 — 多模型供应商支持（DeepSeek/智谱GLM/月之暗面Kimi/豆包/本地模型 5 供应商）；强制多模态（专利附图分析/OA PDF 解析/技术图纸理解）；强制嵌入模型（语义检索/向量召回/知识库索引）；可选 Rerank；本地模型优先级 oMLX > Ollama > vLLM；共享智能体扩展至 22 个（+PatentImageAnalyzer/DocumentParser/EmbeddingService/RerankService）；AgentContext 统一 ModelProvider 接口；StageOutput 新增 MultimodalContent；ModelProviderConfig/ProviderConfig/ModelConfig 接口定义；懒加载规则*
- *v0.5 — 重写全部 5 个场景智能体为编排流程（5步骤/子智能体调用/分析框架/策略矩阵/文档模板）；共享智能体扩展至 18 个（含完整输入/输出规范）；编排层新增 OrchestrationFlow 模型 + MCP Bridge 接口；第十六条新增分层选型原则；Case 数据结构定义；移除补正模式*
- *v0.4 — 新增第四章编排层设计（6 个核心接口 + 路由规则 + 会话案件分离 + 通用兼容）；补正合并到 OA Response Agent；条款重编号至 20 条*
- *v0.3 — 扩展智能体规范为完整定义（5 个独立智能体 + 7 个共享智能体）；YunPat 资产映射*
- *v0.2 — 确认项目名称 YunPat TUI、人主导+AI辅助统一模式、全新整合策略*
