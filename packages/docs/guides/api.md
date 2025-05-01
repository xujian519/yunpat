# YunPat API 文档

**版本**: v1.0.0 (专利专业版)
**更新时间**: 2026-04-28

---

## 📚 目录

- [智能体 API](#智能体-api)
- [Rust 工具 API](#rust-工具-api)
- [MCP 工具接口](#mcp-工具接口)
- [REST API](#rest-api)
- [gRPC API](#grpc-api)

---

## 🤖 智能体 API

### PatentWriterAgent

专利撰写智能体，负责生成完整的专利申请文件。

#### 初始化

```typescript
import { PatentWriterAgent } from '@yunpat/agents'

const writer = new PatentWriterAgent({
  llm: deepseekModel,
  tools: toolRegistry,
})
```

#### 方法

##### `execute(input: WriterInput): Promise<WriterOutput>`

执行专利撰写任务。

**输入参数**:

```typescript
interface WriterInput {
  inventionTitle: string // 发明名称
  technicalField: string // 技术领域
  backgroundArt: string // 背景技术
  inventionContent: string // 发明内容
  technicalFeatures: string[] // 技术特征
  embodiment: string // 具体实施方式
  claims?: ClaimDraft[] // 权利要求草稿（可选）
}
```

**输出结果**:

```typescript
interface WriterOutput {
  application: {
    claims: Claim[] // 权利要求
    description: Description // 说明书
    abstract: string // 摘要
    figures: FigureDescription[] // 附图说明
  }
  quality: QualityScore // 质量评分
  metadata: {
    generatedAt: Date
    model: string
    tokens: number
  }
}
```

**示例**:

```typescript
const result = await writer.execute({
  inventionTitle: '一种基于深度学习的图像识别方法',
  technicalField: '人工智能',
  backgroundArt: '传统图像识别方法准确率低...',
  inventionContent: '本发明提供了一种基于深度学习的图像识别方法...',
  technicalFeatures: ['使用卷积神经网络', '采用注意力机制', '支持实时处理'],
  embodiment: '具体实施方式...',
})

console.log(result.application.claims)
console.log(result.quality.overallScore)
```

---

### PatentResponderAgent

审查答复智能体，负责分析和答复审查意见。

#### 方法

##### `execute(input: ResponderInput): Promise<ResponderOutput>`

执行审查答复任务。

**输入参数**:

```typescript
interface ResponderInput {
  applicationNumber: string // 申请号
  officeActionText: string // 审查意见文本
  currentClaims: Claim[] // 当前权利要求
  priorArt?: PatentRecord[] // 现有技术（可选）
}
```

**输出结果**:

```typescript
interface ResponderOutput {
  analysis: {
    rejections: Rejection[] // 驳回理由分析
    citedReferences: PatentRecord[] // 引用文献
    keyIssues: string[] // 关键问题
  }
  strategy: ResponseStrategy // 答复策略
  response: ResponseDocument // 答复书
  recommendations: string[] // 建议
}
```

**示例**:

```typescript
const result = await responder.execute({
  applicationNumber: 'CN202310123456.7',
  officeActionText: '权利要求1不具备创造性...',
  currentClaims: [...]
});

console.log(result.analysis.rejections);
console.log(result.strategy);
```

---

### PatentAnalyzerAgent

专利分析智能体，提供多维度的专利分析。

#### 方法

##### `analyzeValue(patents: PatentRecord[]): Promise<ValueAnalysis>`

分析专利价值。

**输出结果**:

```typescript
interface ValueAnalysis {
  overallScore: number // 综合评分 (0-100)
  dimensions: {
    marketValue: number // 市场价值
    technicalValue: number // 技术价值
    legalValue: number // 法律价值
  }
  ranking: {
    global: number // 全球排名
    inField: number // 领域内排名
  }
  recommendations: string[] // 建议
}
```

##### `analyzeTrends(query: TrendQuery): Promise<TrendAnalysis>`

分析技术趋势。

**输入参数**:

```typescript
interface TrendQuery {
  field: string // 技术领域
  timeRange: {
    start: Date
    end: Date
  }
  granularity: 'year' | 'month' | 'quarter'
}
```

**输出结果**:

```typescript
interface TrendAnalysis {
  timeline: TimelineData[] // 时间线数据
  emergingTopics: string[] // 新兴主题
  keyPlayers: Company[] // 关键参与者
  predictions: {
    nextYear: string[]
    nextThreeYears: string[]
  }
}
```

**示例**:

```typescript
const valueAnalysis = await analyzer.analyzeValue(patents)
console.log(`综合评分: ${valueAnalysis.overallScore}`)

const trendAnalysis = await analyzer.analyzeTrends({
  field: '深度学习',
  timeRange: {
    start: new Date('2020-01-01'),
    end: new Date('2025-12-31'),
  },
  granularity: 'year',
})

console.log(trendAnalysis.emergingTopics)
```

---

### PatentManagerAgent

专利管理智能体，提供全生命周期管理功能。

#### 方法

##### `manageDeadlines(patents: PatentRecord[]): Promise<DeadlineReport>`

管理专利期限。

**输出结果**:

```typescript
interface DeadlineReport {
  urgent: DeadlineItem[] // 紧急期限（7天内）
  upcoming: DeadlineItem[] // 即将来临（30天内）
  overview: {
    total: number
    completed: number
    overdue: number
  }
  alerts: Alert[] // 预警信息
}
```

##### `analyzePortfolio(portfolio: PatentRecord[]): Promise<PortfolioAnalysis>`

分析专利组合。

**输出结果**:

```typescript
interface PortfolioAnalysis {
  overview: {
    totalPatents: number
    totalValue: number
    averageAge: number
  }
  distribution: {
    byField: Record<string, number>
    byStatus: Record<string, number>
    byJurisdiction: Record<string, number>
  }
  recommendations: {
    optimization: string[]
    costSaving: string[]
    riskMitigation: string[]
  }
}
```

**示例**:

```typescript
const deadlineReport = await manager.manageDeadlines(patents)
console.log(`紧急期限: ${deadlineReport.urgent.length} 项`)

const portfolioAnalysis = await manager.analyzePortfolio(portfolio)
console.log(`总价值: ${portfolioAnalysis.overview.totalValue}`)
```

---

## 🔧 Rust 工具 API

### LLM 客户端

提供类型安全的 LLM 调用接口。

#### 初始化

```rust
use patent_tools::llm::{LlmClient, LlmConfig};

let config = LlmConfig::deepseek("your-api-key");
let client = LlmClient::new(config);
```

#### 方法

##### `chat(&self, messages: Vec<Message>) -> Result<String>`

发送聊天请求。

**参数**:

```rust
pub struct Message {
    pub role: MessageRole,
    pub content: String,
}

pub enum MessageRole {
    System,
    User,
    Assistant,
}
```

**返回**:

```rust
Result<String, Box<dyn std::error::Error>>
```

**示例**:

```rust
use patent_tools::llm::{LlmClient, LlmConfig, Message, MessageRole};

let config = LlmConfig::deepseek("sk-...");
let client = LlmClient::new(config);

let messages = vec![
    Message {
        role: MessageRole::System,
        content: "你是一个专利撰写专家".to_string(),
    },
    Message {
        role: MessageRole::User,
        content: "请帮我撰写权利要求...".to_string(),
    },
];

let response = client.chat(messages)?;
println!("{}", response);
```

##### `chat_simple(&self, content: &str) -> Result<String>`

简化版聊天接口。

**示例**:

```rust
let response = client.chat_simple("请分析这个发明的创造性")?;
println!("{}", response);
```

---

### 权利要求生成器

生成专利权利要求。

#### 方法

##### `generate_claims(&self, params: GenerateParams) -> Result<Claims>`

生成权利要求。

**参数**:

```rust
pub struct GenerateParams {
    pub invention_type: InventionType,
    pub technical_features: Vec<TechnicalFeature>,
    pub prior_art: Option<Vec<PriorArt>>,
}

pub enum InventionType {
    Method,
    Apparatus,
    System,
    Composition,
    Use,
}

pub struct TechnicalFeature {
    pub name: String,
    pub description: String,
    pub feature_type: FeatureType,
}
```

**返回**:

```rust
pub struct Claims {
    pub independent: Vec<Claim>,
    pub dependent: Vec<Claim>,
}

pub struct Claim {
    pub number: u32,
    pub content: String,
    pub claim_type: ClaimType,
}
```

**示例**:

```rust
use patent_tools::generation::{ClaimsGenerator, GenerateParams, TechnicalFeature};

let generator = ClaimsGenerator::new(client);

let params = GenerateParams {
    invention_type: InventionType::Method,
    technical_features: vec![
        TechnicalFeature {
            name: "卷积神经网络".to_string(),
            description: "使用深度卷积神经网络提取特征".to_string(),
            feature_type: FeatureType::Structural,
        }
    ],
    prior_art: None,
};

let claims = generator.generate_claims(params)?;
println!("独立权利要求: {}", claims.independent.len());
```

---

### 质量评估器

评估权利要求质量。

#### 方法

##### `assess_quality(&self, claims: &[Claim]) -> Result<QualityAssessment>`

评估质量。

**返回**:

```rust
pub struct QualityAssessment {
    pub overall_score: f64,      // 总分 (0-100)
    pub clarity_score: f64,      // 清晰度
    pub support_score: f64,      // 支持度
    pub breadth_score: f64,      // 保护范围
    pub issues: Vec<QualityIssue>,
}

pub struct QualityIssue {
    pub severity: IssueSeverity,
    pub description: String,
    pub suggestion: String,
}
```

**示例**:

```rust
use patent_tools::generation::QualityAssessor;

let assessor = QualityAssessor::new(client);
let assessment = assessor.assess_quality(&claims)?;

println!("总分: {}", assessment.overall_score);
for issue in assessment.issues {
    println!("{}: {}", issue.severity, issue.description);
}
```

---

## 🔌 MCP 工具接口

### MCP 服务器

提供标准化的工具调用接口。

#### 初始化

```typescript
import { createPatentMcpServer } from '@yunpat/mcp'

const server = createPatentMcpServer()
await server.start()
```

#### 已注册工具

##### `search_patents`

搜索专利。

**参数**:

```typescript
{
  keywords: string[];            // 关键词
  applicant?: string;            // 申请人（可选）
  limit?: number;                // 限制数量（默认 10）
}
```

**返回**:

```typescript
{
  total: number;
  patents: PatentRecord[];
}
```

##### `generate_claims`

生成权利要求。

**参数**:

```typescript
{
  technicalFeatures: Array<{
    name: string
    description: string
    featureType: string
  }>
  inventionType: string
}
```

**返回**:

```typescript
{
  claims: Array<{
    claimType: string
    number: number
    content: string
  }>
}
```

##### `assess_quality`

评估权利要求质量。

**参数**:

```typescript
{
  claims: Array<{
    number: number
    content: string
  }>
}
```

**返回**:

```typescript
{
  overallScore: number
  clarityScore: number
  supportScore: number
  breadthScore: number
}
```

##### `parse_office_action`

解析审查意见。

**参数**:

```typescript
{
  text: string // 审查意见文本
}
```

**返回**:

```typescript
{
  applicationNumber: string
  actionType: string
  rejections: Array<{
    rejectionType: string
    claimNumbers: number[]
    reasons: string
  }>
  citedReferences: Array<{
    publicationNumber: string
    documentType: string
    relevance: string
  }>
}
```

#### 使用示例

```typescript
// 调用工具
const searchResult = await server.callTool('search_patents', {
  keywords: ['深度学习', '图像识别'],
  limit: 5,
})

console.log(`找到 ${searchResult.content.total} 件专利`)

// 注册自定义工具
server.registerTool(
  {
    name: 'analyze_invention',
    description: '分析发明创造性',
    inputSchema: {
      type: 'object',
      properties: {
        features: { type: 'array' },
        priorArt: { type: 'array' },
      },
    },
  },
  async (params) => {
    return {
      hasNovelty: true,
      hasInventiveStep: true,
      confidence: 0.85,
    }
  }
)

// 监听事件
server.on('toolCalled', ({ name, params, result }) => {
  console.log(`工具 ${name} 被调用`)
})

// 停止服务器
await server.stop()
```

---

## 🌐 REST API

### 基础 URL

```
https://api.yunpat.ai/v1
```

### 认证

所有请求需要包含 API Key：

```
Authorization: Bearer YOUR_API_KEY
```

### 端点

#### POST /patents/generate

生成专利申请文件。

**请求**:

```json
{
  "inventionTitle": "一种基于深度学习的图像识别方法",
  "technicalField": "人工智能",
  "backgroundArt": "传统方法...",
  "inventionContent": "本发明提供...",
  "technicalFeatures": ["使用卷积神经网络", "采用注意力机制"],
  "embodiment": "具体实施方式..."
}
```

**响应**:

```json
{
  "success": true,
  "data": {
    "application": {
      "claims": [...],
      "description": {...},
      "abstract": "...",
      "figures": [...]
    },
    "quality": {
      "overallScore": 85
    }
  }
}
```

#### POST /patents/analyze

分析专利价值。

**请求**:

```json
{
  "patents": [
    {
      "patentNumber": "CN123456789A",
      "title": "...",
      "abstract": "..."
    }
  ]
}
```

**响应**:

```json
{
  "success": true,
  "data": {
    "overallScore": 75,
    "dimensions": {
      "marketValue": 80,
      "technicalValue": 70,
      "legalValue": 75
    }
  }
}
```

#### POST /office-actions/respond

生成审查答复。

**请求**:

```json
{
  "applicationNumber": "CN202310123456.7",
  "officeActionText": "权利要求1不具备创造性...",
  "currentClaims": [...]
}
```

**响应**:

```json
{
  "success": true,
  "data": {
    "analysis": {...},
    "strategy": {...},
    "response": {...}
  }
}
```

---

## 🔐 gRPC API

### 服务定义

```protobuf
service PatentService {
  rpc GeneratePatent(GenerateRequest) returns (GenerateResponse);
  rpc AnalyzePatent(AnalyzeRequest) returns (AnalyzeResponse);
  rpc RespondToOfficeAction(RespondRequest) returns (RespondResponse);
}
```

### 使用示例

```typescript
import { createClient } from '@grpc/grpc-js'
import { ProtoReflectionService } from '@grpc/proto-loader'

const client = createClient('patent-service.proto', 'localhost:50051')

const request = {
  inventionTitle: '一种基于深度学习的图像识别方法',
  technicalField: '人工智能',
  // ... 其他字段
}

const response = await client.generatePatent(request)
console.log(response.application)
```

---

## 📝 错误码

| 错误码 | 说明                   |
| ------ | ---------------------- |
| 400    | 请求参数错误           |
| 401    | 未授权（API Key 无效） |
| 403    | 禁止访问（权限不足）   |
| 404    | 资源不存在             |
| 429    | 请求过于频繁           |
| 500    | 服务器内部错误         |
| 503    | 服务不可用             |

---

## 🔄 速率限制

- **免费版**: 100 次/小时
- **基础版**: 1000 次/小时
- **专业版**: 10000 次/小时
- **企业版**: 无限制

---

**© 2026 YunPat - 智能专利助手，赋能创新保护**
