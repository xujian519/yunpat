# Phase 2详细规划：执行层开发

**规划日期**: 2026-05-04
**规划人**: Claude AI Agent
**周期**: 4-5周
**状态**: 🎯 待启动

---

## 📊 Phase 1成果回顾

### 已完成的工作

✅ **工具层增强** (Phase 1)

- AcademicSearchTool - 学术论文检索
- PatentDownloadTool - 专利PDF下载
- ChemicalStructureTool - 化学结构识别
- MathFormulaTool - 数学公式识别

✅ **Agent集成** (Phase 1)

- PatentSearchAgent - 集成AcademicSearchTool
- PatentAnalyzerAgent - 集成PatentDownloadTool

✅ **质量保证** (Phase 1)

- 34个测试全部通过（100%）
- 工具复用率：76-78%
- 代码质量：A级（优秀）
- 中优先级问题已修复

### 可复用的资产

| 类别      | 资产           | 数量    | 状态    |
| --------- | -------------- | ------- | ------- |
| **工具**  | YunPat内置工具 | 32-34个 | ✅ 可用 |
| **工具**  | 新增工具       | 4个     | ✅ 可用 |
| **工具**  | 外部工具       | 9-11个  | ✅ 可用 |
| **Agent** | 现有Agent      | 6个     | ✅ 可用 |
| **测试**  | 单元测试       | 30个    | ✅ 通过 |
| **测试**  | 集成测试       | 4个     | ✅ 通过 |

---

## 🎯 Phase 2目标

### 核心目标

1. ✅ 实现6个新的执行层Agent
2. ✅ 集成现有工具（充分利用资产）
3. ✅ 单元测试覆盖率≥90%
4. ✅ 集成测试通过
5. ✅ 工具复用率≥80%

### 新增的6个Agent

| #   | Agent名称                  | 职责                        | 优先级 |
| --- | -------------------------- | --------------------------- | ------ |
| 1   | **WritingAgent**           | 格式转换（Markdown → DOCX） | 🔴 高  |
| 2   | **TechnicalDrawingAgent**  | 技术图纸识别                | 🔴 高  |
| 3   | **ClaimsFormalityChecker** | 权利要求形式检查            | 🟡 中  |
| 4   | **SpecFormalityChecker**   | 说明书形式检查              | 🟡 中  |
| 5   | **UnityChecker**           | 单一性检查                  | 🟢 低  |
| 6   | **SubjectMatterChecker**   | 客体检查                    | 🟢 低  |

---

## 📅 详细时间表（4-5周）

### Week 1: WritingAgent + TechnicalDrawingAgent

**目标**: 实现2个高优先级Agent

#### Day 1-2: WritingAgent

**任务清单**:

- [ ] 设计WritingAgent接口
- [ ] 复用`PatentDocxGenerator`（document-tools）
- [ ] 实现Markdown → 结构化内容转换
- [ ] 实现结构化内容 → DOCX转换
- [ ] 实现专利局格式规范验证
- [ ] 编写单元测试（≥90%覆盖率）
- [ ] 编写集成测试
- [ ] 代码审查

**复用的现有工具**:

- ✅ `PatentDocxGenerator` - DOCX生成
- ✅ `FileTools` - 文件操作
- ✅ `StringTools` - 字符串处理

**验收标准**:

- [ ] 单元测试≥90%覆盖率
- [ ] 集成测试通过
- [ ] 能正确生成DOCX文件
- [ ] 格式检查报告准确

---

#### Day 3-5: TechnicalDrawingAgent

**任务清单**:

- [ ] 设计TechnicalDrawingAgent接口
- [ ] 集成`OcrTools`（document-tools）
- [ ] 集成`ChemicalStructureTool`（已实现）
- [ ] 集成`MathFormulaTool`（已实现）
- [ ] 实现说明书附图识别
- [ ] 实现化学结构识别（SMILES格式）
- [ ] 实现数学公式识别（LaTeX格式）
- [ ] 编写单元测试（≥90%覆盖率）
- [ ] 编写集成测试
- [ ] 代码审查

**复用的现有工具**:

- ✅ `ChemicalStructureTool` - 化学结构识别（Phase 1新增）
- ✅ `MathFormulaTool` - 数学公式识别（Phase 1新增）
- ✅ `OcrTools` - 通用OCR

**验收标准**:

- [ ] 单元测试≥90%覆盖率
- [ ] 集成测试通过
- [ ] 能正确识别化学结构
- [ ] 能正确识别数学公式
- [ ] 能正确识别说明书附图

---

### Week 2: ClaimsFormalityChecker + SpecFormalityChecker

**目标**: 实现2个中优先级形式检查Agent

#### Day 1-3: ClaimsFormalityChecker

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

**复用的现有工具**:

- ✅ `LLMAdapter` - 自然语言处理
- ✅ `StringTools` - 文本分析

**验收标准**:

- [ ] 单元测试≥90%覆盖率
- [ ] 集成测试通过
- [ ] 能准确识别形式问题
- [ ] 修改建议合理有效

---

#### Day 4-5: SpecFormalityChecker

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

**复用的现有工具**:

- ✅ `LLMAdapter` - 自然语言处理
- ✅ `StringTools` - 文本分析

**验收标准**:

- [ ] 单元测试≥90%覆盖率
- [ ] 集成测试通过
- [ ] 能准确识别形式问题
- [ ] 修改建议合理有效

---

### Week 3: UnityChecker + SubjectMatterChecker

**目标**: 实现2个低优先级形式检查Agent

#### Day 1-2: UnityChecker

**任务清单**:

- [ ] 设计UnityChecker接口
- [ ] 实现第31条检查（单一性）
- [ ] 实现权利要求之间的关联性分析
- [ ] 实现单一性缺陷识别
- [ ] 实现分案建议生成
- [ ] 编写单元测试（≥90%覆盖率）
- [ ] 编写集成测试
- [ ] 代码审查

**复用的现有工具**:

- ✅ `LLMAdapter` - 自然语言处理
- ✅ `AnalysisAgent` - 技术特征分析

**验收标准**:

- [ ] 单元测试≥90%覆盖率
- [ ] 集成测试通过
- [ ] 能准确识别单一性问题
- [ ] 分案建议合理有效

---

#### Day 3-4: SubjectMatterChecker

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

**复用的现有工具**:

- ✅ `LLMAdapter` - 自然语言处理
- ✅ `KnowledgeAgent` - 知识库查询

**验收标准**:

- [ ] 单元测试≥90%覆盖率
- [ ] 集成测试通过
- [ ] 能准确识别客体问题
- [ ] 排除建议准确

---

### Week 4: 执行层集成测试

**目标**: 全面测试执行层Agent的协作

#### 任务清单

- [ ] 创建执行层集成测试套件
- [ ] 测试WritingAgent功能
- [ ] 测试TechnicalDrawingAgent功能
- [ ] 测试ClaimsFormalityChecker功能
- [ ] 测试SpecFormalityChecker功能
- [ ] 测试UnityChecker功能
- [ ] 测试SubjectMatterChecker功能
- [ ] 测试Agent之间的协作
- [ ] 测试并行调度（Promise.all）
- [ ] 测试超时处理
- [ ] 测试错误恢复
- [ ] 性能基准测试
- [ ] 生成执行层验收报告

**集成测试场景**:

1. **WritingAgent + TechnicalDrawingAgent**
   - 场景：生成包含化学结构和数学公式的专利申请
   - 测试：格式转换 + 图纸识别集成

2. **ClaimsFormalityChecker + SpecFormalityChecker**
   - 场景：完整的形式检查
   - 测试：权利要求 + 说明书联合检查

3. **全部6个Agent集成**
   - 场景：完整的专利申请生成和检查流程
   - 测试：端到端流程

---

### Week 5: 代码审查 + 文档

**目标**: 确保代码质量和文档完整

#### 任务清单

- [ ] 代码审查（6个Agent）
- [ ] 代码重构（优化复杂度）
- [ ] 生成API文档
- [ ] 生成使用指南
- [ ] 生成测试报告
- [ ] 生成Phase 2验收报告
- [ ] 准备Phase 3规划

---

## 🎯 详细设计

### 1. WritingAgent

#### 接口设计

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

#### 复用的工具

- `PatentDocxGenerator` - DOCX生成
- `FileTools` - 文件操作
- `StringTools` - 字符串处理

---

### 2. TechnicalDrawingAgent

#### 接口设计

```typescript
interface TechnicalDrawingAgentConfig {
  ocrEngine: 'tesseract' | 'paddleocr'
  chemistryEngine: 'imago' | 'openbabel'
  mathEngine: 'pix2text' | 'mathpix'
}

interface DrawingInput {
  imagePath: string
  drawingType: 'general' | 'chemical' | 'math' | 'electrical'
}

interface DrawingOutput {
  text?: string // OCR文本（通用图纸）
  chemicalStructure?: {
    // 化学结构
    smiles: string
    inchi?: string
    confidence: number
  }
  mathFormula?: {
    // 数学公式
    latex: string
    confidence: number
  }
  elements: {
    // 图纸元素
    type: string
    position: { x: number; y: number }
    content: string
  }[]
}
```

#### 复用的工具

- `ChemicalStructureTool` - 化学结构识别（Phase 1新增）
- `MathFormulaTool` - 数学公式识别（Phase 1新增）
- `OcrTools` - 通用OCR

---

### 3. ClaimsFormalityChecker

#### 接口设计

```typescript
interface ClaimsCheckInput {
  claims: string[]
  patentType: 'invention' | 'utilityModel'
  specification: string // 说明书（用于支持性检查）
}

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

---

### 4. SpecFormalityChecker

#### 接口设计

```typescript
interface SpecCheckInput {
  specification: {
    title: string
    technicalField: string
    backgroundArt: string
    summary: string
    briefDescription: string
    detailedDescription: string
    examples: string[]
  }
  claims: string[] // 权利要求（用于支持性检查）
}

interface SpecFormalityCheckResult {
  article26_3_disclosure: {
    // 第26条第3款（充分公开）
    passed: boolean
    issues: {
      section: string
      issue: string
      suggestion: string
    }[]
  }
  completeness: {
    // 技术问题、方案、效果完整性
    passed: boolean
    missing: {
      technicalProblem: boolean
      technicalSolution: boolean
      beneficialEffects: boolean
    }
  }
  examples: {
    // 实施例充分性
    passed: boolean
    issues: {
      exampleNumber: number
      issue: string
      suggestion: string
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

---

### 5. UnityChecker

#### 接口设计

```typescript
interface UnityCheckInput {
  claims: string[]
}

interface UnityCheckResult {
  article31_compliance: {
    // 第31条（单一性）
    passed: boolean
    issues: {
      claimNumber: number
      issue: string
      suggestion: string
    }[]
  }
  relatedFeatures: {
    // 权利要求之间的关联性
    groups: {
      representativeClaim: number
      relatedClaims: number[]
      commonTechnicalFeature: string
    }[]
  }
  divisionalRecommendations: {
    // 分案建议
    needsDivision: boolean
    suggestedGroups: {
      claims: number[]
      inventionTitle: string
    }[]
  }
}
```

---

### 6. SubjectMatterChecker

#### 接口设计

```typescript
interface SubjectMatterCheckInput {
  claims: string[]
  specification: string
}

interface SubjectMatterCheckResult {
  article25_compliance: {
    // 第25条（不授予专利权的客体）
    passed: boolean
    exclusions: {
      scientificDiscovery: {
        // 科学发现
        found: boolean
        items: {
          claimNumber: number
          description: string
        }[]
      }
      intellectualActivity: {
        // 智力活动规则
        found: boolean
        items: {
          claimNumber: number
          description: string
        }[]
      }
      medicalMethods: {
        // 疾病诊断治疗方法
        found: boolean
        items: {
          claimNumber: number
          description: string
        }[]
      }
      animalPlantVarieties: {
        // 动植物品种
        found: boolean
        items: {
          claimNumber: number
          description: string
        }[]
      }
      nuclearTransformation: {
        // 原子核变换方法
        found: boolean
        items: {
          claimNumber: number
          description: string
        }[]
      }
    }
  }
  overallReport: {
    passed: boolean
    totalExclusions: number
    recommendations: string[]
  }
}
```

---

## 📊 质量保证

### 测试策略

#### 单元测试

- **覆盖率要求**: ≥90%
- **测试框架**: Vitest
- **Mock策略**: 使用真实工具（不Mock工具层）

#### 集成测试

- **测试场景**: 端到端流程
- **并行调度**: 测试Promise.all
- **错误恢复**: 测试异常情况
- **性能基准**: 响应时间<5s

### 代码审查清单

- [ ] 遵循Karpathy编程原则
- [ ] 代码复杂度≤10（圈复杂度）
- [ ] 无any类型使用
- [ ] 完整的JSDoc注释
- [ ] 单元测试≥90%覆盖率
- [ ] 集成测试通过

---

## 🎯 验收标准

### 必须达成（Must Have）

- [x] 6个Agent全部实现
- [ ] 单元测试覆盖率≥90%
- [ ] 集成测试通过
- [ ] 代码审查通过
- [ ] 工具复用率≥80%

### 最好达成（Should Have）

- [ ] 性能基准测试通过
- [ ] API文档完整
- [ ] 使用指南完整
- [ ] 示例代码完整

### 可以达成（Nice to Have）

- [ ] 性能优化
- [ ] 额外的功能增强
- [ ] 更多的测试用例

---

## 📝 风险管理

| 风险             | 影响 | 概率 | 应对措施                       |
| ---------------- | ---- | ---- | ------------------------------ |
| 现有工具功能不足 | 高   | 中   | 提前验证工具能力，必要时扩展   |
| LLM API不稳定    | 高   | 中   | 实现重试机制，使用本地模型备选 |
| 测试覆盖率不足   | 中   | 低   | 严格执行TDD，每周检查          |
| 进度延迟         | 中   | 中   | 每周检查，及时调整计划         |

---

## 📄 交付物清单

### 代码文件

1. **新增Agent** (6个)
   - `WritingAgent.ts`
   - `TechnicalDrawingAgent.ts`
   - `ClaimsFormalityChecker.ts`
   - `SpecFormalityChecker.ts`
   - `UnityChecker.ts`
   - `SubjectMatterChecker.ts`

2. **测试文件** (6个)
   - `writing-agent.test.ts`
   - `technical-drawing-agent.test.ts`
   - `claims-formality-checker.test.ts`
   - `spec-formality-checker.test.ts`
   - `unity-checker.test.ts`
   - `subject-matter-checker.test.ts`

3. **集成测试** (1个)
   - `execution-layer-integration.test.ts`

### 文档文件

1. **Phase 2规划文档** (本文档)
2. **API文档** (6个Agent)
3. **使用指南** (6个Agent)
4. **测试报告**
5. **Phase 2验收报告**

---

## 🚀 下一步行动

### 立即行动（本周）

1. **开始WritingAgent开发**
   - 设计接口
   - 集成PatentDocxGenerator
   - 编写单元测试

2. **开始TechnicalDrawingAgent开发**
   - 设计接口
   - 集成ChemicalStructureTool
   - 集成MathFormulaTool
   - 编写单元测试

### 后续行动（第2-5周）

3. **实现形式检查Agent** (Week 2-3)
4. **执行层集成测试** (Week 4)
5. **代码审查和文档** (Week 5)

---

**规划生成时间**: 2026-05-04
**状态**: ✅ Phase 2详细规划完成
**下一步**: 开始WritingAgent和TechnicalDrawingAgent开发
