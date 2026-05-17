# 高级算法引入实施计划

> **目标**: 从技术调研报告中引入 9 项核心算法/架构改进，提升 YunPat 的创新性评估、检索质量和多智能体协作能力
> **周期**: 4 阶段，P0→P1→P2→P3 优先级递减
> **影响范围**: `@yunpat/core`、`@yunpat/orchestrator`、`@yunpat/patent-tools`、`@yunpat/unified-knowledge-graph`

---

## 架构总览

```
新增模块:
  core/src/retrieval/
    ├── GraphRAGEngine.ts       # P0-1: 图谱增强检索
    ├── SemanticChunker.ts       # P1-1: 语义分块
    └── AgenticRAGEngine.ts      # P3-1: 自适应 RAG

  core/src/evaluation/
    ├── ACUDecomposer.ts         # P1-2: 原子内容单元分解
    ├── NovAScoreEvaluator.ts    # P1-2: NovAScore 创新性评估
    ├── SAOExtractor.ts          # P1-3: SAO 三元组提取
    ├── SAO2VecEncoder.ts        # P1-3: SAO 向量化
    ├── MARGSimilarity.ts        # P2-1: 多维度推理图
    ├── RNDEvaluator.ts          # P2-2: 相对邻居密度
    └── DualQualityEvaluator.ts  # P3-2: 双重评估

  orchestrator/src/executor/
    └── CritiqueLoop.ts          # P0-2: 批判-反馈循环

修改文件:
  core/src/memory/integration/RAGEngine.ts     # 集成 GraphRAG
  orchestrator/src/executor/TaskExecutor.ts    # 集成 CritiqueLoop
  orchestrator/src/types/index.ts              # 增加 critique 节点类型
```

---

## P0-1: GraphRAG — 图谱增强检索

**核心思路**: 在现有 `RAGEngine.retrieve()` 的向量检索之后，增加 `UnifiedKnowledgeGraph` 的图谱遍历步骤，合并两类上下文。

**实现位置**: `packages/packages/core/src/retrieval/GraphRAGEngine.ts`

**数据流**:
```
Query → BGE-M3 Embedding → 向量检索 (PostgresVectorStore)
                              ↓
                         图谱遍历 (UnifiedKnowledgeGraph)
                         - 从检索结果提取实体
                         - 查询相关实体和关系
                         - 扩展上下文
                              ↓
                         合并去重 → Rerank (可选) → 增强上下文
```

**关键接口**:
```typescript
interface GraphRAGConfig extends RAGConfig {
  knowledgeGraph: UnifiedKnowledgeGraph
  graphExpansionDepth?: number  // 图谱扩展深度，默认 2
  graphWeight?: number          // 图谱上下文权重，默认 0.3
}

class GraphRAGEngine extends RAGEngine {
  async retrieve(query, options?): Promise<GraphRAGResult[]>
  private async expandWithGraph(vectorResults): Promise<GraphExpansionResult>
  private async mergeContexts(vectorResults, graphExpansion): Promise<GraphRAGResult[]>
}
```

**验证标准**:
- [x] 向量检索 + 图谱扩展双通道工作
- [x] 实体提取从检索结果自动触发
- [x] 上下文去重，无重复内容
- [x] 向后兼容：不传 knowledgeGraph 时降级为纯向量检索

---

## P0-2: Critique-Feedback 循环

**核心思路**: 在 `TaskExecutor` 的 DAG 执行中，支持 `critique` 类型节点，执行后自动触发评估，不达标则循环回执行节点。

**实现位置**: `packages/packages/orchestrator/src/executor/CritiqueLoop.ts`

**修改文件**:
- `packages/packages/orchestrator/src/types/index.ts` — 增加 `StepType.critique`
- `packages/packages/orchestrator/src/executor/TaskExecutor.ts` — 集成 CritiqueLoop

**数据流**:
```
Execute Agent A → Critique Agent 评估
                    ↓
                score >= threshold?
                ├── YES → 通过，继续 DAG
                └── NO  → 反馈 + 重试（最多 maxCritiqueRounds 次）
```

**关键接口**:
```typescript
interface CritiqueConfig {
  evaluatorAgentId: string    // 评估 Agent ID
  threshold: number           // 质量阈值（0-1）
  maxCritiqueRounds: number   // 最大批判轮数（默认 3）
  feedbackField?: string      // 反馈字段名
}

interface CritiqueResult {
  passed: boolean
  score: number
  feedback: string
  rounds: number
}
```

**验证标准**:
- [x] critique 节点自动触发评估 Agent
- [x] 不达标时自动重试，附带反馈信息
- [x] 超过最大轮数后强制通过并标记
- [x] 向后兼容：无 critique 节点时行为不变

---

## P1-1: 语义分块策略

**核心思路**: 检测相邻句子嵌入的余弦相似度断崖，识别主题边界，替代固定长度分块。

**实现位置**: `packages/packages/core/src/retrieval/SemanticChunker.ts`

**关键算法**:
```
1. 文档按句子分割
2. 每句生成 BGE-M3 嵌入
3. 计算相邻句子余弦相似度
4. 相似度低于阈值处 → 主题边界
5. 合并相邻小段落（低于 minChunkSize）
6. 输出语义连贯的文本块
```

**关键接口**:
```typescript
interface SemanticChunkerConfig {
  embeddingClient: BGEM3Client
  similarityThreshold?: number   // 主题边界阈值，默认 0.5
  minChunkSize?: number          // 最小块大小（字符），默认 100
  maxChunkSize?: number          // 最大块大小（字符），默认 2000
}

interface Chunk {
  content: string
  index: number
  startSentence: number
  endSentence: number
  coherenceScore: number  // 块内连贯性得分
}

class SemanticChunker {
  async chunk(text: string): Promise<Chunk[]>
  async chunkPatentDocument(doc: PatentDocument): Promise<Chunk[]>  // 专利专用分块
}
```

**验证标准**:
- [x] 分块结果边界处语义断裂
- [x] 块内连贯性得分 > 0.7
- [x] 专利文档按结构（权利要求/说明书/摘要）智能分块
- [x] 集成到 RAGEngine.addDocument()

---

## P1-2: NovAScore ACU

**核心思路**: 将文档分解为原子内容单元 (ACU)，每个 ACU 在历史文档库中做语义对比，结合显著性权重聚合文档级创新性评分。

**实现位置**: `packages/packages/core/src/evaluation/`

**关键算法**:
```
1. LLM 将文档分解为 ACU 列表
2. 每个 ACU 用 BGE-M3 编码
3. 在 ACUBank (PostgresVectorStore) 中检索最相似历史 ACU
4. NLI/QA 判断每个 ACU 新颖性
5. 显著性权重（摘要中出现 = 高权重）
6. 加权聚合 = 文档创新性评分
```

**关键接口**:
```typescript
interface ACU {
  id: string
  content: string
  embedding?: number[]
  salienceWeight: number  // 0-1，摘要中出现则高
  noveltyScore?: number   // 0-1，与历史 ACU 对比
  noveltyLabel?: 'novel' | 'partial' | 'redundant'
}

interface NovAScoreResult {
  documentScore: number      // 0-1 文档级创新性
  acuAnalysis: ACU[]
  novelACUs: number          // 新颖 ACU 数
  totalACUs: number
  coverageScore: number      // 创新覆盖度
}

class ACUDecomposer {
  async decompose(document: string): Promise<ACU[]>
}

class NovAScoreEvaluator {
  constructor(acuBank: PostgresVectorStore, embedder: BGEM3Client)
  async evaluate(document: string, options?): Promise<NovAScoreResult>
  async addReference(document: string): Promise<void>  // 添加到 ACUBank
}
```

**验证标准**:
- [x] 文档分解为多个独立 ACU
- [x] 每个 ACU 有独立的创新性标签
- [x] 文档级评分与人工判断方向一致
- [x] ACUBank 增量更新

---

## P1-3: SAO2Vec — 功能语义提取

**核心思路**: 从专利文本提取 主语-动作-宾语 三元组，编码为向量表示，支持功能级语义相似度计算。

**实现位置**: `packages/packages/core/src/evaluation/`

**关键接口**:
```typescript
interface SAOTriplet {
  subject: string    // 技术组件
  action: string     // 功能动作
  object: string     // 作用对象
  rawText: string    // 原始文本
  confidence: number // 提取置信度
}

interface SAOEmbedding {
  triplet: SAOTriplet
  embedding: number[]
}

class SAOExtractor {
  async extract(text: string): Promise<SAOTriplet[]>
  async extractFromClaims(claims: string[]): Promise<SAOTriplet[]>
}

class SAO2VecEncoder {
  constructor(embeddingClient: BGEM3Client)
  async encode(triplet: SAOTriplet): Promise<number[]>
  async encodeBatch(triplets: SAOTriplet[]): Promise<number[][]>
  similarity(a: SAOEmbedding, b: SAOEmbedding): number
  async findSimilar(target: SAOTriplet, candidates: SAOTriplet[], topK: number): Promise<SAOTriplet[]>
}
```

**验证标准**:
- [x] 从权利要求文本提取 SAO 三元组
- [x] 同功能不同描述的三元组相似度高
- [x] 不同功能的三元组相似度低
- [x] 支持中文专利文本

---

## P2-1: PatentMind MARG

**核心思路**: 专利相似度三维分解（技术特征 × 应用领域 × 权利范围），四阶段推理。

**实现位置**: `packages/packages/core/src/evaluation/MARGSimilarity.ts`

**关键接口**:
```typescript
interface MARGResult {
  overallSimilarity: number
  dimensions: {
    technical: { score: number; reasoning: string }
    application: { score: number; reasoning: string }
    claimScope: { score: number; reasoning: string }
  }
  domainRelation: string
  weights: { technical: number; application: number; claimScope: number }
  crossValidation: string
}

class MARGSimilarity {
  constructor(llmClient: any)  // 需要 LLM 做推理
  async compare(patentA: PatentInfo, patentB: PatentInfo): Promise<MARGResult>
}
```

---

## P2-2: RND — 相对邻居密度

**核心思路**: 在嵌入空间中计算目标 idea 的 kNN 邻居密度，密度越低越新颖。

**实现位置**: `packages/packages/core/src/evaluation/RNDEvaluator.ts`

**关键接口**:
```typescript
interface RNDResult {
  noveltyScore: number         // 0-1，越高越新颖
  neighborDensity: number      // 邻居密度
  nearestNeighbors: Array<{
    content: string
    distance: number
    source: string
  }>
  domain: string               // 检测到的技术领域
  isCrossDomain: boolean       // 是否跨领域
}

class RNDEvaluator {
  constructor(vectorStore: PostgresVectorStore, embedder: BGEM3Client)
  async evaluate(idea: string, options?: { k?: number; threshold?: number }): Promise<RNDResult>
}
```

---

## P3-1: Agentic RAG

**核心思路**: 在 GraphRAGEngine 基础上增加自纠错循环——检索后检查质量，弱结果触发补充检索。

**实现位置**: `packages/packages/core/src/retrieval/AgenticRAGEngine.ts`

**关键接口**:
```typescript
class AgenticRAGEngine extends GraphRAGEngine {
  async retrieve(query, options?): Promise<AgenticRAGResult>
  private assessRetrievalQuality(results): QualityAssessment
  private generateFollowUpQuery(original, results, gaps): string
}

interface AgenticRAGResult extends GraphRAGResult {
  retrievalRounds: number
  qualityScore: number
  followUpQueries: string[]
}
```

---

## P3-2: 双重评估机制

**核心思路**: 两个不同模型从不同角度评估——绝对质量 + 相对排名。

**实现位置**: `packages/packages/core/src/evaluation/DualQualityEvaluator.ts`

**关键接口**:
```typescript
interface DualEvaluationResult {
  absoluteScore: number         // 绝对质量分 (0-100)
  relativeRank: number          // 相对排名 (percentile)
  combinedScore: number         // 加权综合分
  absoluteFeedback: string
  relativeFeedback: string
}

class DualQualityEvaluator {
  constructor(evaluatorA: any, evaluatorB: any)  // 两个 LLM 客户端
  async evaluate(content: string, rubric?: string): Promise<DualEvaluationResult>
}
```

---

## 执行顺序

| 阶段 | 任务 | 预计工作量 | 依赖 |
|------|------|-----------|------|
| P0-1 | GraphRAG | 中 | 无（现有基础设施） |
| P0-2 | Critique-Feedback | 中 | 无 |
| P1-1 | SemanticChunker | 低 | BGE-M3 |
| P1-2 | NovAScore ACU | 高 | SemanticChunker, PostgresVectorStore |
| P1-3 | SAO2Vec | 高 | BGE-M3 |
| P2-1 | MARG | 中 | LLM Client |
| P2-2 | RND | 中 | PostgresVectorStore, BGE-M3 |
| P3-1 | Agentic RAG | 中 | GraphRAG |
| P3-2 | Dual Evaluator | 低 | LLM Client |

---

## 验证清单

每个任务完成后必须通过：

- [ ] TypeScript 编译无错误 (`tsc --noEmit`)
- [ ] 遵循项目代码风格 (semi: false, singleQuote, ESM imports with .js)
- [ ] 向后兼容（不破坏现有接口）
- [ ] 包含中文注释
- [ ] 模块导出正确（index.ts 中导出）
