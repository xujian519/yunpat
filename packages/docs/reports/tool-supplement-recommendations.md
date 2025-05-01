# YunPat 工具补充建议

> **生成时间**: 2026-05-05
> **基于**: tool-asset-inventory.md 报告
> **目的**: 补充缺失工具，完善工具链

---

## 🚧 高优先级工具（立即补充）

### 1. 专利分类号检索工具

**功能需求**：

- 支持IPC（国际专利分类）检索
- 支持CPC（联合专利分类）检索
- 支持FI/F-term（日本分类）检索
- 支持分类号层级浏览
- 支持分类号转换

**使用场景**：

```typescript
// 场景1：按分类号检索专利
const results = await PatentClassificationSearchTool.execute({
  classification: 'H04L 29/06', // IPC分类号
  depth: 'all', // 检索深度：all/subclass/group
  limit: 50,
})

// 场景2：浏览分类号层级
const hierarchy = await PatentClassificationSearchTool.browse({
  classification: 'H04L',
  format: 'tree', // tree/flat
})

// 场景3：分类号转换
const converted = await PatentClassificationSearchTool.convert({
  from: 'IPC',
  to: 'CPC',
  classification: 'H04L 29/06',
})
```

**实现方案**：

```typescript
// packages/patent-tools/src/tools/PatentClassificationSearchTool.ts
export class PatentClassificationSearchTool extends Tool {
  async execute(input: {
    classification: string
    depth?: 'all' | 'subclass' | 'group'
    limit?: number
  }) {
    // 1. 解析分类号
    // 2. 构建检索查询
    // 3. 调用专利数据库API
    // 4. 返回检索结果
  }

  async browse(input: { classification: string; format?: 'tree' | 'flat' }) {
    // 返回分类号层级结构
  }

  async convert(input: {
    from: 'IPC' | 'CPC' | 'FI'
    to: 'IPC' | 'CPC' | 'FI'
    classification: string
  }) {
    // 分类号格式转换
  }
}
```

**依赖API**：

- EPO OPS API（免费）
- Google Patents API
- CNIPA API（中国国家知识产权局）

**预期收益**：

- 提高专利检索精确度
- 支持专业检索策略
- 覆盖更多检索场景

---

### 2. 技术图纸识别工具

**功能需求**：

- 识别专利附图中的技术图纸
- 提取图纸中的标注、尺寸、符号
- 识别图纸类型（装配图、零件图、流程图、电路图）
- 生成图纸描述文本

**使用场景**：

```typescript
// 场景1：识别技术图纸
const图纸识别 = await TechnicalDrawingTool.execute({
  imagePath: '/path/to/patent-drawing.png',
  drawingType: 'auto', // auto/assembly/part/flowchart/circuit
  outputFormat: 'structured' // text/structured/json
})

// 返回结果：
{
  drawingType: 'assembly',
  components: [
    { id: '1', name: '螺丝', position: {x: 100, y: 200} },
    { id: '2', name: '螺母', position: {x: 150, y: 200} }
  ],
  annotations: [
    { text: '10mm', position: {x: 120, y: 210}, type: 'dimension' },
    { text: 'A', position: {x: 300, y: 100}, type: 'label' }
  ],
  description: '这是一个装配图，显示了螺丝和螺母的组装关系'
}
```

**实现方案**：

```typescript
// packages/image-tools/src/tools/TechnicalDrawingTool.ts
export class TechnicalDrawingTool extends Tool {
  async execute(input: {
    imagePath: string
    drawingType?: 'auto' | 'assembly' | 'part' | 'flowchart' | 'circuit'
    outputFormat?: 'text' | 'structured' | 'json'
  }) {
    // 1. 图像预处理（去噪、增强）
    // 2. 图纸类型识别（CNN分类器）
    // 3. 元素提取（OCR + 计算机视觉）
    // 4. 结构化输出
  }

  private detectDrawingType(image: Buffer): string {
    // 使用CNN模型识别图纸类型
  }

  private extractComponents(image: Buffer): Component[] {
    // 使用目标检测算法识别组件
  }

  private extractAnnotations(image: Buffer): Annotation[] {
    // 使用OCR识别标注
  }
}
```

**依赖服务**：

- AWS Textract（图纸+OCR）
- Google Cloud Vision API
- Azure Computer Vision
- 或本地模型：OpenCV + Tesseract

**预期收益**：

- 自动解析专利附图
- 提取技术特征
- 辅助权利要求理解

---

### 3. 论文全文下载工具

**功能需求**：

- 支持arXiv论文下载
- 支持PubMed论文下载
- 支持IEEE Xplore论文下载
- 支持DOI解析
- 批量下载功能

**使用场景**：

```typescript
// 场景1：通过DOI下载论文
const paper = await AcademicPaperDownloadTool.execute({
  identifier: '10.1038/nature12373',
  identifierType: 'doi',
  format: 'pdf', // pdf/xml/txt
})

// 场景2：通过arXiv ID下载
const paper = await AcademicPaperDownloadTool.execute({
  identifier: '2301.07041',
  identifierType: 'arxiv',
  format: 'pdf',
})

// 场景3：批量下载
const papers = await AcademicPaperDownloadTool.batchDownload({
  identifiers: [
    { identifier: '10.1038/nature12373', type: 'doi' },
    { identifier: '2301.07041', type: 'arxiv' },
  ],
  format: 'pdf',
  outputDir: '/downloads/papers',
})
```

**实现方案**：

```typescript
// packages/builtin-tools/src/tools/AcademicPaperDownloadTool.ts
export class AcademicPaperDownloadTool extends Tool {
  async execute(input: {
    identifier: string
    identifierType: 'doi' | 'arxiv' | 'pmid' | 'url'
    format?: 'pdf' | 'xml' | 'txt'
  }) {
    // 1. 识别论文来源
    // 2. 构建下载URL
    // 3. 下载论文
    // 4. 返回文件路径或内容
  }

  async batchDownload(input: {
    identifiers: Array<{ identifier: string; type: string }>
    format?: 'pdf' | 'xml' | 'txt'
    outputDir: string
  }) {
    // 批量下载，支持并发控制
  }

  private resolveDoi(doi: string): string {
    // DOI解析为下载URL
  }

  private resolveArxiv(arxivId: string): string {
    // arXiv ID解析为下载URL
  }
}
```

**依赖API**：

- arXiv API（免费）
- PubMed Central API（免费）
- IEEE Xplore API（付费）
- Springer Nature API（付费）
- DOI Foundation API（免费）

**预期收益**：

- 完善学术检索工具链
- 支持先导技术分析
- 覆盖更多文献来源

---

## 🟡 中优先级工具（近期补充）

### 4. 专利价值评估工具

**功能需求**：

- 基于引用次数评估专利价值
- 基于专利家族规模评估
- 基于法律状态评估
- 基于市场影响力评估
- 综合评分算法

**使用场景**：

```typescript
// 评估专利价值
const value = await PatentValueAssessmentTool.execute({
  patentId: 'CN123456789A',
  assessmentFactors: {
    citations: true,
    family: true,
    legalStatus: true,
    marketImpact: true
  },
  weightConfig: {
    citations: 0.4,
    family: 0.3,
    legalStatus: 0.2,
    marketImpact: 0.1
  }
})

// 返回结果：
{
  patentId: 'CN123456789A',
  overallScore: 85.5,
  breakdown: {
    citations: { score: 90, weight: 0.4, contribution: 36 },
    family: { score: 80, weight: 0.3, contribution: 24 },
    legalStatus: { score: 95, weight: 0.2, contribution: 19 },
    marketImpact: { score: 65, weight: 0.1, contribution: 6.5 }
  },
  level: 'high', // high/medium/low
  recommendation: 'core-asset' // core-asset/standard/monitor-only
}
```

**实现方案**：

```typescript
// packages/patent-tools/src/tools/PatentValueAssessmentTool.ts
export class PatentValueAssessmentTool extends Tool {
  async execute(input: {
    patentId: string
    assessmentFactors: {
      citations?: boolean
      family?: boolean
      legalStatus?: boolean
      marketImpact?: boolean
    }
    weightConfig?: {
      citations?: number
      family?: number
      legalStatus?: number
      marketImpact?: number
    }
  }) {
    // 1. 获取专利详细信息
    // 2. 计算各项因子得分
    // 3. 加权求和
    // 4. 生成评级和建议
  }

  private async assessCitations(patentId: string): Promise<number> {
    // 基于引用次数评分
  }

  private async assessFamily(patentId: string): Promise<number> {
    // 基于家族规模评分
  }
}
```

**依赖数据**：

- 专利引用数据（PatentsView、Google Patents）
- 专利家族数据（EPO、CNIPA）
- 法律状态数据（各专利局官方数据）
- 市场数据（第三方数据提供商）

---

### 5. 专利引文网络分析工具

**功能需求**：

- 构建专利引文网络图
- 识别前向引文和后向引文
- 分析引文路径和关键节点
- 计算引文影响力指标

**使用场景**：

```typescript
// 分析专利引文网络
const network = await PatentCitationNetworkTool.execute({
  patentId: 'CN123456789A',
  depth: 2, // 引文深度
  includeTypes: ['forward', 'backward'], // 前向/后向引文
  metrics: ['pagerank', 'betweenness', 'closeness'] // 网络指标
})

// 返回结果：
{
  patentId: 'CN123456789A',
  network: {
    nodes: [
      { id: 'CN123456789A', type: 'root' },
      { id: 'US9876543B2', type: 'backward', citationCount: 50 },
      { id: 'EP3456789A1', type: 'forward', citationCount: 10 }
    ],
    edges: [
      { from: 'US9876543B2', to: 'CN123456789A', type: 'cites' },
      { from: 'CN123456789A', to: 'EP3456789A1', type: 'cites' }
    ]
  },
  metrics: {
    pagerank: 0.05,
    betweenness: 0.8,
    closeness: 0.6
  },
  keyPatents: ['US9876543B2', 'EP3456789A1'],
  paths: [
    ['US9876543B2', 'CN123456789A', 'EP3456789A1']
  ]
}
```

**实现方案**：

```typescript
// packages/patent-tools/src/tools/PatentCitationNetworkTool.ts
export class PatentCitationNetworkTool extends Tool {
  async execute(input: {
    patentId: string
    depth?: number
    includeTypes?: Array<'forward' | 'backward'>
    metrics?: Array<'pagerank' | 'betweenness' | 'closeness'>
  }) {
    // 1. 获取引文数据（递归）
    // 2. 构建网络图
    // 3. 计算网络指标
    // 4. 识别关键节点和路径
  }

  private async getCitations(patentId: string, depth: number): Promise<Citation[]> {
    // 递归获取引文数据
  }

  private calculateNetworkMetrics(network: Network): Metrics {
    // 使用图论算法计算指标
  }
}
```

**依赖库**：

- networkx（Python，可用node调用）
- vis.js（可视化）
- D3.js（可视化）

---

### 6. 批量格式转换工具

**功能需求**：

- 支持多种文档格式互转
- 批量处理能力
- 保持格式完整性
- 支持自定义转换规则

**使用场景**：

```typescript
// 批量格式转换
const results = await BatchFormatConverterTool.execute({
  files: [
    '/path/to/file1.pdf',
    '/path/to/file2.docx',
    '/path/to/file3.png'
  ],
  targetFormat: 'markdown',
  outputDir: '/converted',
  options: {
    preserveFormatting: true,
    extractImages: true,
    ocr: true
  }
})

// 返回结果：
{
  totalFiles: 3,
  successCount: 3,
  failedCount: 0,
  results: [
    { file: 'file1.pdf', status: 'success', output: '/converted/file1.md' },
    { file: 'file2.docx', status: 'success', output: '/converted/file2.md' },
    { file: 'file3.png', status: 'success', output: '/converted/file3.md' }
  ]
}
```

**实现方案**：

```typescript
// packages/document-tools/src/tools/BatchFormatConverterTool.ts
export class BatchFormatConverterTool extends Tool {
  async execute(input: {
    files: string[]
    targetFormat: 'pdf' | 'docx' | 'markdown' | 'html' | 'txt'
    outputDir: string
    options?: {
      preserveFormatting?: boolean
      extractImages?: boolean
      ocr?: boolean
    }
  }) {
    // 1. 识别文件类型
    // 2. 选择合适的转换器
    // 3. 并发转换（控制并发数）
    // 4. 返回转换结果
  }

  private getConverter(sourceFormat: string, targetFormat: string): Converter {
    // 根据源格式和目标格式选择转换器
  }
}
```

---

## 🟢 低优先级工具（未来补充）

### 7. 专利地图生成工具

**功能需求**：

- 技术路线图生成
- 竞争态势分析图
- 技术热点图
- 专利布局图

**使用场景**：

```typescript
// 生成专利地图
const map = await PatentMapGeneratorTool.execute({
  patents: patentArray,
  mapType: 'technology-landscape', // technology-landscape/competition/hotspot
  clustering: 'hierarchical', // hierarchical/kmeans/dbscan
  visualization: 'interactive', // static/interactive
})
```

**实现方案**：

- 使用机器学习聚类算法
- 使用D3.js或ECharts可视化
- 支持交互式探索

---

### 8. 文档版本对比工具

**功能需求**：

- 类似git diff的文档对比
- 支持多种文档格式
- 高亮显示差异
- 生成对比报告

**使用场景**：

```typescript
// 对比两个版本的文档
const diff = await DocumentDiffTool.execute({
  file1: '/path/to/version1.docx',
  file2: '/path/to/version2.docx',
  outputFormat: 'html' // text/html/json
})

// 返回结果：
{
  file1: 'version1.docx',
  file2: 'version2.docx',
  changes: [
    { type: 'addition', position: {line: 10}, content: '新增内容' },
    { type: 'deletion', position: {line: 15}, content: '删除内容' },
    { type: 'modification', position: {line: 20}, old: '原内容', new: '新内容' }
  ],
  summary: {
    additions: 5,
    deletions: 3,
    modifications: 2
  }
}
```

---

### 9. 化学结构数据库查询工具

**功能需求**：

- 识别化学结构后查询相似结构
- 连接PubChem、ChEMBL等数据库
- 返回化合物性质信息

**使用场景**：

```typescript
// 查询化学结构
const results = await ChemicalStructureQueryTool.execute({
  structure: 'CC(=O)OC1=CC=CC=C1C(=O)O', // SMILES
  searchType: 'similarity', // similarity/exact/substructure
  threshold: 0.8,
  databases: ['pubchem', 'chembl'],
})
```

---

### 10. 学术图谱分析工具

**功能需求**：

- 作者合作网络分析
- 论文引用关系分析
- 研究趋势分析
- 学科交叉分析

**使用场景**：

```typescript
// 分析学术图谱
const graph = await AcademicGraphAnalysisTool.execute({
  papers: paperArray,
  analysisType: 'collaboration', // collaboration/citation/trend
  depth: 2,
})
```

---

## 📊 工具补充优先级矩阵

| 工具               | 业务价值 | 实现难度 | 紧急程度 | 优先级 |
| ------------------ | -------- | -------- | -------- | ------ |
| 专利分类号检索     | 高       | 中       | 高       | **P0** |
| 技术图纸识别       | 高       | 高       | 高       | **P0** |
| 论文全文下载       | 高       | 低       | 高       | **P0** |
| 专利价值评估       | 中       | 中       | 中       | **P1** |
| 专利引文网络分析   | 中       | 高       | 中       | **P1** |
| 批量格式转换       | 中       | 低       | 中       | **P1** |
| 专利地图生成       | 低       | 高       | 低       | **P2** |
| 文档版本对比       | 低       | 中       | 低       | **P2** |
| 化学结构数据库查询 | 低       | 中       | 低       | **P2** |
| 学术图谱分析       | 低       | 高       | 低       | **P2** |

---

## 🎯 实施建议

### Phase 1: 立即实施（1-2周）

**工具**：

1. 专利分类号检索工具
2. 论文全文下载工具

**理由**：

- 实现难度低
- 业务价值高
- 可快速完善工具链

**资源需求**：

- 1个开发工程师
- 预计5-7个工作日

### Phase 2: 近期实施（2-4周）

**工具**：

1. 技术图纸识别工具
2. 专利价值评估工具
3. 专利引文网络分析工具
4. 批量格式转换工具

**理由**：

- 业务价值高
- 实现难度中等
- 需要更多测试和验证

**资源需求**：

- 2个开发工程师
- 预计15-20个工作日

### Phase 3: 未来规划（长期）

**工具**：

1. 专利地图生成工具
2. 文档版本对比工具
3. 化学结构数据库查询工具
4. 学术图谱分析工具

**理由**：

- 锦上添花功能
- 实现难度高
- 需求不紧急

**资源需求**：

- 根据业务发展情况决定
- 预计30-40个工作日

---

## 📋 总结

### 当前工具链状态

**已有工具**：87+个
**缺失工具**：10个（P0: 3个, P1: 4个, P2: 3个）
**覆盖率**：约90%（按功能点计算）

### 补充后预期

**补充工具**：10个
**工具总数**：97+个
**覆盖率**：98%+
**业务支撑能力**：显著提升

### 关键成功因素

1. **优先级管理**：先补充高价值、低难度工具
2. **API依赖**：提前申请和测试外部API
3. **质量控制**：每个工具都需要完整的测试
4. **文档完善**：提供清晰的使用示例和API文档

---

**文档版本**: v1.0
**下次更新**: 完成P0工具补充后
**责任人**: 开发团队
**审核者**: 产品经理
