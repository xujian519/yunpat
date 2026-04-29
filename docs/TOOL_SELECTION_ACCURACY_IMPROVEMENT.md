# 智能体工具选择准确性提升方案

## 🎯 核心问题

智能体在工具选择时面临的主要挑战：
1. **语义理解** - 准确理解用户意图
2. **工具匹配** - 从大量工具中找到最合适的
3. **参数映射** - 正确映射用户输入到工具参数
4. **上下文感知** - 根据对话历史选择工具
5. **错误恢复** - 工具调用失败时的重试策略

---

## 📊 方案一：工具描述优化（立即可用）

### 1.1 增强工具元数据

**当前问题**：
```typescript
// ❌ 简单描述，缺乏上下文
{
  name: 'pdf_parse',
  description: '解析PDF文件',
}
```

**优化方案**：
```typescript
// ✅ 详细描述，包含使用场景
{
  name: 'pdf_parse',
  description: `
解析PDF文件并提取结构化内容。

使用场景：
- 从PDF中提取文本内容用于分析
- 将PDF转换为Markdown格式便于编辑
- 提取PDF中的表格数据

输入要求：
- filePath: PDF文件的完整路径
- outputFormat: 可选，支持json/markdown/text
- extractImages: 可选，是否提取图片

输出：
- 结构化的文档元素（标题、段落、表格等）
- 文档元数据（作者、创建日期等）
  `.trim(),
  examples: [
    {
      input: { filePath: '/path/to/document.pdf' },
      output: { text: '提取的文本内容...', elements: [...] }
    }
  ]
}
```

### 1.2 添加工具使用示例

```typescript
interface ToolMetadata {
  // 现有字段...
  
  // 🆕 新增字段
  examples?: ToolExample[];        // 使用示例
  commonUseCases?: string[];       // 常见用例
  relatedTools?: string[];         // 相关工具
  prerequisites?: string[];        // 前置条件
  limitations?: string[];          // 限制说明
}

interface ToolExample {
  description: string;             // 示例描述
  input: Record<string, any>;       // 输入示例
  output: Record<string, any>;      // 输出示例
  scenario?: string;               // 使用场景
}
```

---

## 🔍 方案二：智能工具检索（推荐实现）

### 2.1 语义相似度匹配

```typescript
/**
 * 语义工具检索器
 * 使用向量相似度找到最相关的工具
 */
export class SemanticToolRetriever {
  private embeddings: Map<string, number[]>;
  private embeddingModel: EmbeddingModel;

  async initialize(tools: BaseTool[]) {
    this.embeddingModel = new OpenAIEmbeddings();
    this.embeddings = new Map();

    // 为每个工具生成嵌入
    for (const tool of tools) {
      const text = this.generateToolText(tool);
      const embedding = await this.embeddingModel.embedQuery(text);
      this.embeddings.set(tool.metadata.name, embedding);
    }
  }

  /**
   * 根据用户查询检索相关工具
   */
  async retrieveTools(
    query: string,
    topK: number = 5
  ): Promise<Array<{ tool: BaseTool; score: number }>> {
    const queryEmbedding = await this.embeddingModel.embedQuery(query);
    const scores: Array<{ toolName: string; score: number }> = [];

    // 计算相似度
    for (const [toolName, toolEmbedding] of this.embeddings) {
      const score = this.cosineSimilarity(queryEmbedding, toolEmbedding);
      scores.push({ toolName, score });
    }

    // 排序并返回topK
    scores.sort((a, b) => b.score - a.score);
    return scores.slice(0, topK).map(({ toolName, score }) => ({
      tool: this.getToolByName(toolName),
      score,
    }));
  }

  /**
   * 生成工具的文本表示
   */
  private generateToolText(tool: BaseTool): string {
    const metadata = tool.metadata;
    return `
      ${metadata.name}
      ${metadata.description}
      ${metadata.examples?.map(e => e.description).join('\n') || ''}
    `.trim();
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }
}
```

### 2.2 混合检索策略

```typescript
/**
 * 混合工具检索器
 * 结合语义、关键词、分类三种策略
 */
export class HybridToolRetriever {
  private semanticRetriever: SemanticToolRetriever;
  private keywordRetriever: KeywordRetriever;
  private categoryRetriever: CategoryRetriever;

  async retrieveTools(
    query: string,
    context: ToolContext
  ): Promise<BaseTool[]> {
    // 1. 语义检索（权重：0.5）
    const semanticResults = await this.semanticRetriever.retrieveTools(query, 5);
    
    // 2. 关键词检索（权重：0.3）
    const keywordResults = this.keywordRetriever.retrieveTools(query, 5);
    
    // 3. 分类检索（权重：0.2）
    const categoryResults = this.categoryRetriever.retrieveTools(context);

    // 4. 融合结果
    return this.mergeResults([
      { results: semanticResults, weight: 0.5 },
      { results: keywordResults, weight: 0.3 },
      { results: categoryResults, weight: 0.2 },
    ]);
  }

  private mergeResults(
    resultSets: Array<{ results: BaseTool[]; weight: number }>
  ): BaseTool[] {
    const scores = new Map<string, number>();

    for (const { results, weight } of resultSets) {
      for (let i = 0; i < results.length; i++) {
        const toolName = results[i].metadata.name;
        const score = (1 - i / results.length) * weight;
        scores.set(toolName, (scores.get(toolName) || 0) + score);
      }
    }

    // 排序并去重
    return Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([toolName]) => this.getToolByName(toolName));
  }
}
```

---

## 🧠 方案三：提示工程优化（快速见效）

### 3.1 Few-shot示例

```typescript
/**
 * 增强的ReAct提示模板
 */
const ENHANCED_REACT_PROMPT = `
你是一个智能助手，可以使用以下工具来完成任务：

## 可用工具列表

${tools.map(tool => formatToolWithExamples(tool)).join('\n\n')}

## 工具选择示例

### 示例1：文档处理
**用户**: "帮我把这个PDF转换成Markdown"
**思考**: 用户需要将PDF转换为Markdown格式
**工具选择**: PdfToMarkdownTool
**原因**: 该工具专门用于PDF到Markdown的转换

### 示例2：数据分析
**用户**: "分析这个Excel表格中的销售数据"
**思考**: 用户需要从Excel中提取数据并分析
**工具选择**: ExcelReadTool -> DataAnalysisTool
**原因**: 先读取Excel，再进行数据分析

### 示例3：错误恢复
**用户**: "打开百度首页"
**工具调用**: WebNavigateTool(url="https://www.baidu.com")
**结果**: 失败：超时
**重试**: WebNavigateTool(url="https://www.baidu.com", timeout=10000)

## 你的任务

用户输入：${userInput}

请按照以下步骤思考：

1. **理解意图**: 用户想要完成什么任务？
2. **识别需求**: 需要哪些工具？按什么顺序？
3. **选择工具**: 从上述工具列表中选择最合适的工具
4. **准备参数**: 根据用户输入准备工具参数
5. **执行工具**: 调用工具并观察结果
6. **调整策略**: 如果结果不符合预期，如何调整？

现在开始：
`;
```

### 3.2 思维链提示

```typescript
/**
 * CoT工具选择提示
 */
const COT_TOOL_SELECTION_PROMPT = `
选择正确的工具需要逐步推理：

## 推理步骤

1. **分析用户请求**
   - 用户的核心需求是什么？
   - 涉及哪些数据类型或操作？
   - 期望的输出格式是什么？

2. **匹配工具特征**
   - 工具的输入要求是什么？
   - 工具能处理哪些数据类型？
   - 工具的输出是什么格式？

3. **评估工具适配度**
   - 工具A是否能完全满足需求？
   - 是否需要组合多个工具？
   - 是否有更合适的替代工具？

4. **考虑约束条件**
   - 是否有前置条件？
   - 是否需要特殊权限？
   - 是否有性能限制？

5. **最终决策**
   - 选择得分最高的工具
   - 准备调用参数
   - 规划后续步骤

## 示例

用户："分析这个PDF文档中的表格数据"

推理过程：
1. 用户需求：从PDF中提取表格数据
2. 数据类型：PDF文件，包含表格
3. 适配工具：
   - PdfParseTool: 可以解析PDF
   - ExtractTablesTool: 可以提取表格
   - 组合使用：先解析PDF，再提取表格
4. 决策：使用PdfParseTool + ExtractTablesTool
`;
```

---

## 📚 方案四：工具索引和分类（结构化）

### 4.1 多维度标签系统

```typescript
/**
 * 增强的工具元数据
 */
interface EnhancedToolMetadata {
  // 基础信息
  name: string;
  description: string;
  category: ToolCategory;

  // 🆕 多维度标签
  tags: {
    // 功能标签
    capabilities: string[];      // ['parse', 'convert', 'extract']
    
    // 数据类型标签
    dataTypes: string[];         // ['pdf', 'docx', 'image', 'audio']
    
    // 操作类型标签
    operations: string[];        // ['read', 'write', 'transform']
    
    // 领域标签
    domains: string[];           // ['document', 'web', 'database']
    
    // 场景标签
    scenarios: string[];         // ['batch-processing', 'automation']
  };

  // 使用统计
  usage: {
    totalCalls: number;          // 总调用次数
    successRate: number;         // 成功率
    avgExecutionTime: number;    // 平均执行时间
    lastUsed: Date;             // 最后使用时间
  };

  // 依赖关系
  dependencies?: {
    requires?: string[];         // 前置工具
    conflictsWith?: string[];    // 冲突工具
    oftenUsedWith?: string[];    // 经常一起使用
  };
}

/**
 * 基于标签的工具检索
 */
export class TagBasedToolRetriever {
  /**
   * 根据标签检索工具
   */
  retrieveByTags(
    query: {
      capabilities?: string[];
      dataTypes?: string[];
      operations?: string[];
      domains?: string[];
      scenarios?: string[];
    },
    registry: ToolRegistry
  ): BaseTool[] {
    const tools = registry.listAll();
    const matched: BaseTool[] = [];

    for (const tool of tools) {
      const metadata = tool.metadata as EnhancedToolMetadata;
      const score = this.calculateMatchScore(query, metadata.tags);
      
      if (score > 0.5) {  // 相似度阈值
        matched.push(tool);
      }
    }

    return matched.sort((a, b) => {
      const scoreA = this.calculateMatchScore(query, (a.metadata as any).tags);
      const scoreB = this.calculateMatchScore(query, (b.metadata as any).tags);
      return scoreB - scoreA;
    });
  }

  private calculateMatchScore(
    query: Record<string, string[]>,
    tags: Record<string, string[]>
  ): number {
    let totalScore = 0;
    let totalWeight = 0;

    for (const [key, queryValues] of Object.entries(query)) {
      const toolValues = tags[key] || [];
      const matchCount = queryValues.filter(v => toolValues.includes(v)).length;
      const score = matchCount / queryValues.length;
      
      totalScore += score;
      totalWeight += 1;
    }

    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }
}
```

### 4.2 工具层级分类

```typescript
/**
 * 工具分类树
 */
const TOOL_TAXONOMY = {
  document: {
    parsing: {
      pdf: ['PdfParseTool', 'PdfOcrTool'],
      docx: ['DocxParseTool'],
      excel: ['ExcelParseTool'],
    },
    conversion: {
      toMarkdown: ['PdfToMarkdownTool', 'DocxToMarkdownTool'],
      toJson: ['ExcelToJsonTool'],
      toHtml: ['DocxToHtmlTool'],
    },
    extraction: {
      text: ['PdfExtractTextTool', 'DocxExtractTextTool'],
      tables: ['ExtractTablesTool'],
      images: ['ExtractImagesTool'],
    },
  },
  web: {
    navigation: ['WebNavigateTool', 'WebFindTabTool'],
    interaction: ['WebClickTool', 'WebFillTool'],
    analysis: ['WebSnapshotTool', 'WebExtractTextTool'],
  },
  // ... 更多分类
};

/**
 * 层级检索器
 */
export class HierarchicalToolRetriever {
  retrieveByPath(path: string[]): BaseTool[] {
    let current = TOOL_TAXONOMY;
    
    for (const segment of path) {
      if (current[segment]) {
        current = current[segment];
      } else {
        return [];
      }
    }

    return current; // 返回最终的工具列表
  }
}

// 使用示例
const retriever = new HierarchicalToolRetriever();

// 检索所有PDF转Markdown的工具
const tools = retriever.retrieveByPath(['document', 'conversion', 'toMarkdown']);
// 结果: ['PdfToMarkdownTool', 'DocxToMarkdownTool']
```

---

## 🔄 方案五：学习和反馈（长期优化）

### 5.1 工具使用追踪

```typescript
/**
 * 工具使用分析器
 */
export class ToolUsageAnalyzer {
  private usageHistory: Map<string, ToolUsageRecord[]> = new Map();

  /**
   * 记录工具使用
   */
  recordUsage(
    toolName: string,
    context: {
      userInput: string;
      success: boolean;
      executionTime: number;
      error?: string;
    }
  ) {
    const record: ToolUsageRecord = {
      timestamp: new Date(),
      userInput: context.userInput,
      success: context.success,
      executionTime: context.executionTime,
      error: context.error,
    };

    if (!this.usageHistory.has(toolName)) {
      this.usageHistory.set(toolName, []);
    }
    
    this.usageHistory.get(toolName)!.push(record);
  }

  /**
   * 分析工具性能
   */
  analyzePerformance(toolName: string): ToolPerformance {
    const records = this.usageHistory.get(toolName) || [];
    
    return {
      totalCalls: records.length,
      successRate: records.filter(r => r.success).length / records.length,
      avgExecutionTime: records.reduce((sum, r) => sum + r.executionTime, 0) / records.length,
      commonErrors: this.getCommonErrors(records),
      bestUseCases: this.getBestUseCases(records),
    };
  }

  /**
   * 获取推荐工具
   */
  getRecommendedTools(userInput: string): ToolRecommendation[] {
    const recommendations: ToolRecommendation[] = [];

    for (const [toolName, records] of this.usageHistory) {
      const performance = this.analyzePerformance(toolName);
      
      // 基于历史表现推荐
      if (
        performance.successRate > 0.8 &&
        this.isInputSimilar(userInput, records)
      ) {
        recommendations.push({
          toolName,
          confidence: performance.successRate,
          reason: `历史成功率 ${(performance.successRate * 100).toFixed(0)}%`,
        });
      }
    }

    return recommendations.sort((a, b) => b.confidence - a.confidence);
  }

  private isInputSimilar(input: string, records: ToolUsageRecord[]): boolean {
    // 使用简单的关键词匹配
    const inputWords = input.toLowerCase().split(/\s+/);
    
    return records.some(record => {
      const recordWords = record.userInput.toLowerCase().split(/\s+/);
      const intersection = inputWords.filter(w => recordWords.includes(w));
      return intersection.length / inputWords.length > 0.3;
    });
  }
}
```

### 5.2 A/B测试框架

```typescript
/**
 * 工具选择A/B测试
 */
export class ToolSelectionABTester {
  private variants: Map<string, string[]> = new Map();

  /**
   * 注册测试变体
   */
  registerVariant(scenario: string, variants: string[]) {
    this.variants.set(scenario, variants);
  }

  /**
   * 选择工具（带A/B测试）
   */
  selectTool(scenario: string): string {
    const variants = this.variants.get(scenario);
    if (!variants || variants.length === 0) {
      throw new Error(`No variants found for scenario: ${scenario}`);
    }

    // 随机选择（可以改为更智能的策略）
    const index = Math.floor(Math.random() * variants.length);
    return variants[index];
  }

  /**
   * 记录结果
   */
  recordResult(
    scenario: string,
    toolName: string,
    result: {
      success: boolean;
      userSatisfaction: number;
      executionTime: number;
    }
  ) {
    // 保存到数据库或文件
    // 用于后续分析最优工具
  }

  /**
   * 分析最佳工具
   */
  getBestTool(scenario: string): string {
    // 分析历史数据，返回表现最好的工具
    // 基于成功率、用户满意度、执行时间等指标
  }
}
```

---

## 🎯 实施路线图

### 阶段1：快速优化（1-2天）
- ✅ 优化工具描述（添加示例、用例）
- ✅ 实现Few-shot提示模板
- ✅ 添加工具使用指南文档

### 阶段2：智能检索（3-5天）
- ✅ 实现语义工具检索
- ✅ 实现混合检索策略
- ✅ 添加多维度标签系统

### 阶段3：学习优化（1-2周）
- ✅ 实现工具使用追踪
- ✅ 建立性能分析系统
- ✅ 实现A/B测试框架

### 阶段4：持续优化（长期）
- ✅ 基于用户反馈调整
- ✅ 自动优化工具选择
- ✅ 机器学习模型训练

---

## 📝 最佳实践建议

1. **从简单开始**：先优化工具描述，再实现复杂检索
2. **渐进增强**：逐步添加智能功能，不要一次到位
3. **数据驱动**：基于实际使用数据优化，而非主观判断
4. **用户反馈**：建立反馈机制，持续改进
5. **性能监控**：追踪工具选择准确率和执行效果

---

## 🔧 实施示例

### 立即可用：优化工具描述

```typescript
// 修改前
export class PdfParseTool extends EnhancedBaseTool {
  readonly metadata = {
    name: 'pdf_parse',
    description: '解析PDF文件',
  };
}

// 修改后
export class PdfParseTool extends EnhancedBaseTool {
  readonly metadata = {
    name: 'pdf_parse',
    description: `
解析PDF文件并提取结构化内容。

适用场景：
- 从PDF中提取文本内容
- 将PDF转换为Markdown格式
- 分析PDF文档结构

输入：PDF文件路径
输出：结构化的文档元素（标题、段落、表格等）
    `.trim(),
    examples: [
      {
        description: '解析PDF并提取文本',
        input: { filePath: '/path/to/document.pdf' },
        output: { text: '提取的内容...' }
      }
    ],
    commonUseCases: [
      '文档内容提取',
      'PDF格式转换',
      '文档数据分析'
    ]
  };
}
```

### 推荐实施：语义检索

```typescript
// 在Agent中添加工具检索
class EnhancedAgent extends Agent {
  private toolRetriever: SemanticToolRetriever;

  async plan(input: Input, context: ExecutionContext): Promise<Plan> {
    // 1. 检索相关工具（而非使用全部工具）
    const relevantTools = await this.toolRetriever.retrieveTools(
      input.taskDescription,
      10  // 只检索top 10
    );

    // 2. 生成计划时只考虑相关工具
    const prompt = this.generatePrompt(input, relevantTools);
    const plan = await this.llm.generate(prompt);

    return plan;
  }
}
```

---

## 🎉 总结

提升智能体工具选择准确性需要多管齐下：

1. **立即可用**：优化工具描述、添加示例
2. **短期见效**：实现语义检索、Few-shot提示
3. **中期优化**：建立标签系统、追踪使用数据
4. **长期目标**：机器学习优化、自动调优

**建议优先级**：
1. 🔥 **高优先级**：优化工具描述（1天）
2. 🔥 **高优先级**：Few-shot提示（1天）
3. 🌟 **中优先级**：语义检索（3天）
4. 🌟 **中优先级**：使用追踪（5天）
5. 💡 **低优先级**：机器学习优化（长期）

从简单开始，逐步迭代，基于数据和反馈持续优化！
