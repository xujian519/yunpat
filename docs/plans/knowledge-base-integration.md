# 知识库集成与提示词提炼方案

> **项目**: YunPat - 知识产权全生命周期智能体平台
> **知识库**: 宝宸知识库 (Obsidian)
> **知识库规模**: 556个专利实务文件 + 100个核心概念
> **更新时间**: 2026-04-28

---

## 📊 知识库现状分析

### 知识库结构

```
宝宸知识库/ (总计2082个markdown文件)
├── Wiki/                               # 1139个文件
│   ├── 专利实务/                       # 556个文件
│   │   ├── 说明书/                    # 24个文件 (充分公开、清楚完整等)
│   │   ├── 创造性/                    # 30个文件 (三步法、技术启示等)
│   │   ├── 新颖性/                    # 20+个文件
│   │   ├── 权利要求/                  # 15个文件
│   │   ├── 修改/                      # 10个文件
│   │   ├── 证据的认定/                # 8个文件
│   │   └── ... (共18个子目录)
│   ├── 复审无效/                       # 194个文件
│   │   ├── 创造性/                    # 82个文件
│   │   ├── 新颖性/                    # 35个文件
│   │   ├── 推理模式/                  # 27个文件
│   │   ├── 说明书/                    # 23个文件
│   │   ├── 权利要求/                  # 19个文件
│   │   ├── 外观设计/                  # 6个文件
│   │   └── 修改超范围/                # 2个文件
│   ├── cards/                         # 动态生成的知识卡片
│   │   └── 20260426-什么是创造性-*.md # 问答式知识卡片
│   ├── Concept-Index.md               # 100个核心概念反向索引
│   ├── Concept-Hierarchy.md           # 概念层级结构
│   └── 其他/                          # 389个文件
└── 其他目录/                           # 943个文件
├── patent_agent/                      # 专利智能体相关
├── 方法论/                            # 方法论文档
└── scripts/                           # 知识库管理脚本
```

### 知识库特点

✅ **优势**：

1. **知识体系完整**：覆盖专利法、审查指南、实务操作
2. **卡片化组织**：每个问题都有对应的知识卡片
3. **概念关联**：100个核心概念的反向索引
4. **质量评分**：每个卡片都有质量分（0.0-1.0）
5. **动态生成**：卡片通过LLM动态生成，保持更新

⚠️ **挑战**：

1. **Obsidian格式**：使用`[[wikilink]]`，需要转换
2. **文件数量大**：556个文件，需要智能筛选
3. **知识深度不一**：有些是原理，有些是实务，需要分层

---

## 🎯 集成策略

### 方案选择：三层知识架构

```
┌─────────────────────────────────────────────────────────┐
│  Layer 1: 原始知识层 (Raw Knowledge Layer)              │
│  - 直接引用Obsidian知识库                                │
│  - 用于：深度分析、复杂推理、疑难案例                    │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│  Layer 2: 提示词模板层 (Prompt Template Layer)          │
│  - 从知识库提炼的结构化提示词                            │
│  - 用于：标准撰写流程、常规案例分析                      │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│  Layer 3: 检索增强层 (RAG Layer)                        │
│  - 向量化索引 + 语义检索                                 │
│  - 用于：快速查询、知识验证、上下文补充                  │
└─────────────────────────────────────────────────────────┘
```

---

## 📋 Phase 1: Layer 1 - 原始知识层集成 (Week 1)

### 目标

建立YunPat与Obsidian知识库的连接，支持直接查询

### 实施步骤

#### Step 1: 建立知识库桥接服务

```typescript
// ai/knowledge/ObsidianKnowledgeBridge.ts

import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import { EventBus } from '../../packages/core/src/eventbus/EventBus.js';

export interface WikiCard {
  question: string;
  quality: number;
  content: string;
  relatedPages: string[];
  timestamp: string;
}

export class ObsidianKnowledgeBridge {
  private knowledgeBasePath: string;
  private cache: Map<string, WikiCard> = new Map();

  constructor(
    knowledgeBasePath?: string,
    private eventBus?: EventBus
  ) {
    // 从环境变量读取，或使用默认值
    this.knowledgeBasePath = knowledgeBasePath || process.env.KNOWLEDGE_BASE_PATH || '';
    if (!this.knowledgeBasePath) {
      throw new Error('知识库路径未配置，请设置环境变量 KNOWLEDGE_BASE_PATH');
    }
  }

  /**
   * 根据问题查询知识卡片
   */
  async queryCard(question: string): Promise<WikiCard | null> {
    // 1. 检查缓存
    if (this.cache.has(question)) {
      return this.cache.get(question)!;
    }

    // 2. 在cards目录中查找匹配的文件
    const cardsPath = join(this.knowledgeBasePath, 'Wiki/cards');
    const files = await readdir(cardsPath);

    // 简单的模糊匹配（后续可以升级为语义检索）
    const matchedFile = files.find(file => {
      const questionFromFilename = this.extractQuestionFromFilename(file);
      return this.isSimilarQuestion(question, questionFromFilename);
    });

    if (!matchedFile) {
      return null;
    }

    // 3. 读取并解析卡片
    const cardPath = join(cardsPath, matchedFile);
    const content = await readFile(cardPath, 'utf-8');
    const card = this.parseCard(content);

    // 4. 缓存结果
    this.cache.set(question, card);

    return card;
  }

  /**
   * 根据概念查询所有相关页面
   */
  async queryByConcept(concept: string): Promise<string[]> {
    const indexPath = join(this.knowledgeBasePath, 'Wiki/Concept-Index.md');
    const indexContent = await readFile(indexPath, 'utf-8');

    // 解析反向索引，找到该概念对应的所有页面
    const relatedPages = this.parseConceptIndex(indexContent, concept);

    return relatedPages;
  }

  /**
   * 读取Wiki页面内容
   */
  async readWikiPage(pagePath: string): Promise<string> {
    const fullPath = join(this.knowledgeBasePath, 'Wiki', pagePath + '.md');
    return await readFile(fullPath, 'utf-8');
  }

  /**
   * 将Obsidian wikilink转换为实际路径
   */
  resolveWikiLink(link: string): string {
    // [[专利实务/说明书/说明书-充分公开概述]]
    // => Wiki/专利实务/说明书/说明书-充分公开概述.md
    return link
      .replace(/^\[\[/, '')      // 移除开头[[
      .replace(/\]\]$/, '')      // 移除结尾]]
      .replace(/^\/, 'Wiki/');   // 添加Wiki/前缀
  }

  /**
   * 解析卡片内容
   */
  private parseCard(content: string): WikiCard {
    const lines = content.split('\n');

    const question = lines[1].replace(/^- 来源问题:\s*/, '');
    const quality = parseFloat(lines[2].replace(/^- 质量分:\s*/, ''));
    const timestamp = lines[3].replace(/^- 生成时间:\s*/, '');

    // 提取卡片内容（从"## 卡片内容"到文件末尾）
    const cardContentStart = lines.findIndex(l => l === '## 卡片内容');
    const cardContent = lines.slice(cardContentStart + 1).join('\n').trim();

    // 提取相关页面（[[wikilink]]）
    const relatedPages = (content.match(/\[\[([^\]]+)\]\]/g) || [])
      .map(link => link.replace(/[\[\]]/g, ''));

    return {
      question,
      quality,
      content: cardContent,
      relatedPages,
      timestamp
    };
  }

  /**
   * 从文件名提取问题
   */
  private extractQuestionFromFilename(filename: string): string {
    // 20260426-什么是创造性-71092c4775df.md
    // => 什么是创造性
    const match = filename.match(/^(\d{8}-)(.+?)(-[a-f0-9]{11}\.md)$/);
    return match ? match[2] : '';
  }

  /**
   * 简单的问题相似度判断（后续可以升级为语义检索）
   */
  private isSimilarQuestion(q1: string, q2: string): boolean {
    const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, '');
    return normalize(q1) === normalize(q2);
  }

  /**
   * 解析概念索引
   */
  private parseConceptIndex(indexContent: string, concept: string): string[] {
    const lines = indexContent.split('\n');
    const relatedPages: string[] = [];

    let foundConcept = false;
    for (const line of lines) {
      if (line.startsWith(`### ${concept}`)) {
        foundConcept = true;
        continue;
      }

      if (foundConcept) {
        if (line.startsWith('### ')) {
          // 到达下一个概念，停止
          break;
        }

        // 提取wikilink
        const match = line.match(/\[\[([^\]]+)\]\]/);
        if (match) {
          relatedPages.push(match[1]);
        }
      }
    }

    return relatedPages;
  }
}
```

#### Step 2: 在Agent中集成知识库

```typescript
// ai/agents/writer/PatentWriterAgent.ts

import { ObsidianKnowledgeBridge } from '../../knowledge/ObsidianKnowledgeBridge.js'

export class PatentWriterAgent extends Agent<DisclosureInput, PatentDraft> {
  private knowledge: ObsidianKnowledgeBridge

  constructor(config: AgentConfig) {
    super(config)

    // 初始化知识库桥接
    this.knowledge = new ObsidianKnowledgeBridge(
      '/Users/xujian/Library/Mobile Documents/iCloud~md~obsidian/Documents/宝宸知识库',
      config.eventBus
    )
  }

  /**
   * 步骤1: 发明理解（增强版 - 使用知识库）
   */
  protected async plan(input: DisclosureInput, context: ExecutionContext) {
    // 基础理解（使用LLM）
    const baseUnderstanding = await this.understandInvention(input.disclosure)

    // 知识库增强：查询相关概念
    const enhancedUnderstanding = await this.enhanceWithKnowledge(baseUnderstanding)

    return enhancedUnderstanding
  }

  /**
   * 使用知识库增强发明理解
   */
  private async enhanceWithKnowledge(baseUnderstanding: any) {
    // 查询"创造性"相关知识
    const creativityCard = await this.knowledge.queryCard('什么是创造性')
    if (creativityCard) {
      context.logger.info('找到创造性知识卡片，质量分: ' + creativityCard.quality)

      // 读取相关页面
      for (const page of creativityCard.relatedPages) {
        const content = await this.knowledge.readWikiPage(page)
        // 将知识注入到上下文中
        baseUnderstanding.knowledgeContext += `\n\n${content}`
      }
    }

    return baseUnderstanding
  }
}
```

### 验证测试

```typescript
// test/knowledge/obsidian-bridge.test.ts

describe('Obsidian知识库桥接测试', () => {
  const bridge = new ObsidianKnowledgeBridge(
    process.env.KNOWLEDGE_BASE_PATH || '', // 从环境变量读取
    eventBus
  )

  it('应该能够查询"什么是创造性"卡片', async () => {
    const card = await bridge.queryCard('什么是创造性')

    expect(card).not.toBeNull()
    expect(card?.quality).toBeGreaterThan(0.7)
    expect(card?.content).toContain('技术启示')
    expect(card?.relatedPages.length).toBeGreaterThan(0)
  })

  it('应该能够根据概念查询相关页面', async () => {
    const pages = await bridge.queryByConcept('充分公开')

    expect(pages.length).toBeGreaterThan(5)
    expect(pages).toContain('专利实务/说明书/说明书-充分公开概述')
  })

  it('应该能够读取Wiki页面内容', async () => {
    const content = await bridge.readWikiPage('专利实务/说明书/说明书-充分公开概述')

    expect(content).toContain('充分公开')
    expect(content).toContain('A26.3')
  })
})
```

---

## 📋 Phase 2: Layer 2 - 提示词模板层提炼 (Week 2-3)

### 目标

从知识库中提炼结构化的提示词模板

### 提炼方法

#### Step 1: 分析知识库中的提示词要素

```bash
# 在知识库中搜索与撰写相关的页面
cd "/Users/xujian/Library/Mobile Documents/iCloud~md~obsidian/Documents/宝宸知识库"

# 搜索权利要求撰写
grep -r "权利要求.*撰写" Wiki/专利实务/ --include="*.md"

# 搜索说明书撰写
grep -r "说明书.*撰写" Wiki/专利实务/ --include="*.md"

# 搜索创造性判断
grep -r "三步法" Wiki/专利实务/创造性/ --include="*.md"

# ⚠️ 注意：实际使用时，将 Wiki 替换为你的知识库根目录
```

#### Step 2: 提炼提示词模板

````typescript
// prompts/patent-drafting/claims-generation-template.md

# 权利要求生成提示词模板

> 从知识库提炼：专利实务/权利要求、创造性/三步法
> 提炼时间：2026-05-XX
> 知识来源：宝宸知识库

## 角色设定

你是一位资深的专利代理师，拥有15年的专利撰写经验，精通中国专利法和审查指南。

## 任务目标

根据技术交底书，撰写符合中国专利法要求的权利要求书。

## 知识库支持

### 权利要求撰写要点（来自知识库）

1. **权利要求的基本要求**：
   - 清楚：每项权利要求应当清楚限定保护范围（[[专利实务/权利要求/权利要求-清楚]]）
   - 简洁：权利要求应当简明
   - 支持：权利要求应当得到说明书支持（A26.4）

2. **独立权利要求与从属权利要求**：
   - 独立权利要求：应当反映发明的必要技术特征
   - 从属权利要求：可以进一步限定技术特征

3. **保护范围的平衡**：
   - 过宽：容易被现有技术抗辩
   - 过窄：保护不充分
   - 需要根据现有技术合理布局

### 创造性判断框架（三步法）

1. **确定最接近的现有技术**
2. **确定区别特征和实际解决的技术问题**
3. **判断要求保护的发明对本领域技术人员来说是否显而易见**

## 输入格式

```json
{
  "invention_title": "发明名称",
  "invention_type": "device|method|system|composition",
  "technical_field": "技术领域",
  "technical_problem": "技术问题",
  "technical_solution": "技术方案",
  "technical_effects": ["技术效果1", "技术效果2"],
  "essential_features": [
    {
      "name": "特征名称",
      "description": "特征描述"
    }
  ],
  "optional_features": [...],
  "prior_art": {
    "documents": ["对比文件1", "对比文件2"],
    "differences": ["区别特征1", "区别特征2"]
  }
}
````

## 输出格式

```json
{
  "independent_claims": [
    {
      "claim_number": 1,
      "claim_type": "device|method|system|composition",
      "content": "权利要求内容",
      "essential_features": ["必要特征1", "必要特征2"]
    }
  ],
  "dependent_claims": [
    {
      "claim_number": 2,
      "parent_claim": 1,
      "content": "从属权利要求内容",
      "additional_features": ["附加特征"]
    }
  ],
  "layout_strategy": "权利要求布局说明",
  "protection_scope_analysis": "保护范围分析"
}
```

## 撰写流程

1. **分析现有技术**：根据对比文件，确定区别特征
2. **确定独立权利要求**：包含解决技术问题所必需的 features
3. **布局从属权利要求**：
   - 进一步限定独立权利要求
   - 包含替代方案
   - 包含优选实施例
4. **质量检查**：
   - 清楚性检查
   - 支持性检查（A26.4）
   - 创造性预判

## 示例

（这里可以从知识库中提取实际的撰写案例）

## 注意事项

- 避免功能性限定（除非必须）
- 避免上位概念过宽
- 注意方法-装置对应
- 注意用语一致性

---

_本提示词模板基于宝宸知识库提炼，包含以下知识来源：_

- [[专利实务/权利要求/权利要求-清楚]]
- [[专利实务/权利要求/权利要求-支持]]
- [[创造性-概述与三步法框架]]
- [[创造性-技术启示的判断]]

````

#### Step 3: 创建提示词管理系统

```typescript
// ai/prompts/PromptTemplateManager.ts

import { readFile } from 'fs/promises';
import { join } from 'path';

export class PromptTemplateManager {
  private templates: Map<string, string> = new Map();

  constructor(private templateDir: string) {}

  /**
   * 加载提示词模板
   */
  async loadTemplate(templateName: string): Promise<string> {
    if (this.templates.has(templateName)) {
      return this.templates.get(templateName)!;
    }

    const templatePath = join(this.templateDir, `${templateName}.md`);
    const content = await readFile(templatePath, 'utf-8');

    this.templates.set(templateName, content);
    return content;
  }

  /**
   * 渲染提示词（替换变量）
   */
  render(templateName: string, variables: Record<string, any>): string {
    const template = this.templates.get(templateName);
    if (!template) {
      throw new Error(`Template ${templateName} not found`);
    }

    let rendered = template;

    // 替换 {{variable}} 格式的变量
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      rendered = rendered.replace(regex, String(value));
    }

    return rendered;
  }

  /**
   * 从知识库提炼提示词
   */
  async extractFromKnowledge(
    knowledgeBridge: ObsidianKnowledgeBridge,
    concept: string
  ): Promise<string> {
    // 1. 查询概念相关页面
    const relatedPages = await knowledgeBridge.queryByConcept(concept);

    // 2. 读取所有相关页面内容
    const contents = await Promise.all(
      relatedPages.map(page => knowledgeBridge.readWikiPage(page))
    );

    // 3. 提炼结构化提示词
    const prompt = `
# ${concept}提示词模板

> 从宝宸知识库自动提炼
> 提炼时间：${new Date().toISOString()}

## 知识来源

${relatedPages.map(page => `- [[${page}]]`).join('\n')}

## 核心知识

${contents.join('\n\n---\n\n')}

---

*本模板基于${contents.length}个知识页面提炼*
    `;

    return prompt;
  }
}
````

### 验证测试

```typescript
// test/prompts/template-extraction.test.ts

describe('提示词模板提炼测试', () => {
  const manager = new PromptTemplateManager(
    process.env.PROMPT_TEMPLATES_DIR || './prompts/patent-drafting'
  )
  const knowledge = new ObsidianKnowledgeBridge(process.env.KNOWLEDGE_BASE_PATH || '', eventBus)

  it('应该能够从知识库提炼"权利要求"提示词', async () => {
    const prompt = await manager.extractFromKnowledge(knowledge, '权利要求')

    expect(prompt).toContain('知识来源')
    expect(prompt).toContain('核心知识')
    expect(prompt).toContain('专利实务/权利要求')
  })

  it('应该能够从知识库提炼"创造性"提示词', async () => {
    const prompt = await manager.extractFromKnowledge(knowledge, '创造性')

    expect(prompt).toContain('三步法')
    expect(prompt).toContain('技术启示')
  })
})
```

---

## 📋 Phase 3: Layer 3 - 检索增强层 (RAG) (Week 4)

### 目标

建立向量索引，实现语义检索

### 实施步骤

#### Step 1: 向量化知识库

```typescript
// ai/knowledge/VectorStore.ts

import { embed } from '../../packages/core/src/llm/embedding.js'

export class VectorStore {
  private index: Map<string, number[]> = new Map()

  /**
   * 向量化Wiki页面
   */
  async indexWikiPage(pagePath: string, content: string) {
    // 分块（每500字一块）
    const chunks = this.chunkContent(content, 500)

    for (const chunk of chunks) {
      const embedding = await embed(chunk.text)
      this.index.set(`${pagePath}#${chunk.index}`, embedding)
    }
  }

  /**
   * 语义检索
   */
  async search(query: string, topK: number = 5): Promise<SearchResult[]> {
    const queryEmbedding = await embed(query)

    const results: Array<{ page: string; score: number }> = []

    for (const [key, embedding] of this.index) {
      const score = this.cosineSimilarity(queryEmbedding, embedding)
      results.push({ page: key, score })
    }

    // 按相似度排序，返回topK
    return results.sort((a, b) => b.score - a.score).slice(0, topK)
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    // 计算余弦相似度
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0)
    const normA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0))
    const normB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0))
    return dotProduct / (normA * normB)
  }

  private chunkContent(content: string, chunkSize: number) {
    const chunks: Array<{ index: number; text: string }> = []
    const paragraphs = content.split('\n\n')

    let currentChunk = ''
    let chunkIndex = 0

    for (const para of paragraphs) {
      if (currentChunk.length + para.length > chunkSize) {
        chunks.push({ index: chunkIndex++, text: currentChunk })
        currentChunk = para
      } else {
        currentChunk += '\n\n' + para
      }
    }

    if (currentChunk) {
      chunks.push({ index: chunkIndex, text: currentChunk })
    }

    return chunks
  }
}
```

#### Step 2: 集成到Agent

```typescript
// ai/agents/writer/PatentWriterAgent.ts

export class PatentWriterAgent extends Agent<DisclosureInput, PatentDraft> {
  private vectorStore: VectorStore

  /**
   * RAG增强的发明理解
   */
  protected async plan(input: DisclosureInput, context: ExecutionContext) {
    // 1. 基础理解
    const baseUnderstanding = await this.understandInvention(input.disclosure)

    // 2. 语义检索相关知识
    const relevantKnowledge = await this.vectorStore.search(baseUnderstanding.core_innovation, 3)

    // 3. 将检索到的知识注入上下文
    const enhancedContext = {
      ...baseUnderstanding,
      retrievedKnowledge: relevantKnowledge,
    }

    return enhancedContext
  }
}
```

---

## 📊 知识库质量保证

### 卡片质量筛选

```typescript
// ai/knowledge/QualityFilter.ts

export class QualityFilter {
  /**
   * 筛选高质量卡片（质量分 > 0.7）
   */
  filterHighQualityCards(cards: WikiCard[]): WikiCard[] {
    return cards.filter((card) => card.quality > 0.7)
  }

  /**
   * 筛选相关卡片（根据问题相似度）
   */
  filterRelevantCards(cards: WikiCard[], query: string): WikiCard[] {
    return cards.filter((card) => this.isRelevant(card.question, query))
  }

  private isRelevant(cardQuestion: string, query: string): boolean {
    // 简单的关键词匹配（后续可以升级为语义相似度）
    const cardKeywords = cardQuestion.toLowerCase().split(/\s+/)
    const queryKeywords = query.toLowerCase().split(/\s+/)

    const intersection = cardKeywords.filter((k) => queryKeywords.includes(k))
    return intersection.length > 0
  }
}
```

---

## 🎯 实施时间表

| Week       | Phase       | 任务                     | 验证                 |
| ---------- | ----------- | ------------------------ | -------------------- |
| **Week 1** | Layer 1     | ObsidianKnowledgeBridge  | 查询"什么是创造性"   |
| **Week 2** | Layer 2     | 提炼权利要求提示词       | 生成第一个提示词模板 |
| **Week 3** | Layer 2     | 提炼说明书、创造性提示词 | 生成3-5个核心模板    |
| **Week 4** | Layer 3     | 向量化 + RAG             | 语义检索验证         |
| **Week 5** | Integration | 集成到睿羿科技案例       | 端到端测试           |

---

## 💡 使用示例

### 示例1: 直接查询知识库

```typescript
// 在Agent中使用
const creativityCard = await knowledge.queryCard('什么是创造性')

if (creativityCard && creativityCard.quality > 0.7) {
  // 使用高质量知识卡片
  const prompt = `
基于以下知识，分析本发明的创造性：

${creativityCard.content}

发明信息：${invention}
  `

  const analysis = await llm.chat({ messages: [{ role: 'user', content: prompt }] })
}
```

### 示例2: 使用提示词模板

```typescript
// 加载模板
const template = await promptManager.loadTemplate('claims-generation')

// 渲染模板
const prompt = promptManager.render('claims-generation', {
  invention_title: '自动驾驶掉头方法',
  invention_type: 'method',
  // ... 其他变量
})

// 生成权利要求
const claims = await llm.chat({ messages: [{ role: 'user', content: prompt }] })
```

### 示例3: RAG增强检索

```typescript
// 语义检索
const relevantDocs = await vectorStore.search('如何判断发明的创造性？', 3)

// 将检索结果注入提示词
const prompt = `
基于以下相关知识，回答问题：

问题：如何判断发明的创造性？

相关知识：
${relevantDocs
  .map(
    (doc, i) => `
【资料${i + 1}】${doc.page}
相关度：${(doc.score * 100).toFixed(1)}%
`
  )
  .join('\n')}
`
```

---

## 🎉 预期成果

### 短期（1个月）

- ✅ 建立Obsidian知识库桥接
- ✅ 提炼5-10个核心提示词模板
- ✅ 支持直接查询和RAG检索
- ✅ 睿羿科技案例验证通过

### 中期（2-3个月）

- ✅ 完整的提示词模板体系（30+个模板）
- ✅ 向量索引覆盖1000+个Wiki卡片
- ✅ 知识库动态更新机制
- ✅ 复审无效案例集成（194个案例）
- ✅ 推理模式卡片应用（27个推理模式）

### 长期（6个月+）

- ✅ 知识库自动扩展（新增案例自动学习）
- ✅ 提示词自动优化（根据反馈迭代）
- ✅ 知识图谱增强（概念关联可视化）
- ✅ 多模态支持（附图、流程图）
- ✅ 复审无效预测（基于194个案例）
- ✅ 推理模式推荐（27个推理模式智能匹配）

---

## 🔧 技术栈

- **知识库桥接**：Node.js fs/promises
- **提示词管理**：Handlebars / EJS模板引擎
- **向量检索**：DeepSeek Embedding + 余弦相似度
- **缓存**：Redis / 内存Map
- **监控**：知识库使用统计、质量追踪

---

**© 2026 YunPat - 基于宝宸知识库的智能专利撰写平台**
