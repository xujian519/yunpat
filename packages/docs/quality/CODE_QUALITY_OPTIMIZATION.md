# 代码质量优化报告

## 📊 当前状态

根据 Karpathy 编程原则的全面审查，发现以下问题：

### 严重问题（影响代码质量）

1. **重复代码过多** - 5 个解析方法重复 90% 的逻辑
2. **未使用的类成员** - PatentResponderAgent 的 `currentResult` 和 `input`
3. **过度冗余** - 3 个格式生成方法差异仅 10%

### 中等问题

4. **硬编码的默认值重复**
5. **过长的 prompt 字符串**
6. **复杂的嵌套条件**

---

## ✨ 优化建议与实施

### 优先级 1：立即修复（已实施）

#### ✅ 创建统一的 JSON 解析工具

**文件**: `packages/agents/patent-analyzer/src/utils/json-parser.ts`

**优势**：

- 减少 ~150 行重复代码
- 统一错误处理逻辑
- 更易于测试和维护

**使用示例**：

````typescript
// 之前：5 个解析方法，每个 30+ 行
private parseTechnicalAnalysis(content: string) {
  try {
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || ...
    const jsonStr = jsonMatch[1] || jsonMatch[0];
    const data = JSON.parse(jsonStr);
    return { /* 转换逻辑 */ };
  } catch (error) {
    return { /* 默认值 */ };
  }
}

// 之后：1 个解析方法，5 行
private parseTechnicalAnalysis(content: string) {
  return JSONParser.parse(content, this.DEFAULTS.technical, (data) => ({
    field: data.field || '',
    problems: Array.isArray(data.problems) ? data.problems : [],
    // ...
  }));
}
````

**代码减少量**：~120 行

---

### 优先级 2：架构改进（建议实施）

#### 2.1 移除未使用的类成员

**问题文件**: `PatentResponderAgent.ts`

**当前代码**：

```typescript
export class PatentResponderAgent extends Agent {
  private currentResult?: PatentResponderOutput;  // ❌ 未使用
  private input?: PatentResponderInput;           // ❌ 未使用

  protected async act(...) {
    // ...
    this.currentResult = output;  // 仅在这里赋值
    this.input = input;
  }

  async exportToFormat(format: 'cn' | 'pct' | 'us') {
    if (!this.currentResult || !this.input) {  // 依赖状态
      throw new Error('请先完成答复生成');
    }
    // ...
  }
}
```

**优化后**：

```typescript
export class PatentResponderAgent extends Agent {
  // ✅ 移除状态成员

  async exportToFormat(
    result: PatentResponderOutput, // ✅ 直接传入参数
    input: PatentResponderInput,
    format: 'cn' | 'pct' | 'us'
  ) {
    // ✅ 无状态，更易测试
    // ...
  }
}
```

**优势**：

- 消除隐式状态依赖
- 方法可以独立测试
- 更符合函数式编程原则

---

#### 2.2 统一格式生成逻辑

**问题**：3 个格式生成方法（CN/PCT/US）差异仅在于标签

**当前代码**：~90 行 × 3 = 270 行

**优化后**：~100 行（减少 170 行）

```typescript
/**
 * 统一的格式生成器
 */
private generateFormat(
  document: ResponseDocument,
  officeAction: OAOfficeAction,
  config: FormatConfig
): string {
  let content = `# ${config.title}\n\n`;

  // 使用配置的标签
  content += `${config.labels.applicationNo}: ${officeAction.applicationNumber}\n`;
  content += `${config.labels.title}: ${officeAction.patentTitle}\n`;

  // 通用逻辑
  if (document.amendedClaims) {
    content += `\n\n## ${config.labels.claims}\n\n`;
    content += document.amendedClaims;
  }

  return content;
}

// 调用示例
private generateCNFormat(doc: ResponseDocument, oa: OAOfficeAction) {
  return this.generateFormat(doc, oa, {
    title: '审查意见答复书',
    labels: {
      applicationNo: '申请号',
      title: '发明名称',
      claims: '修改后的权利要求书'
    }
  });
}
```

---

#### 2.3 分离存储层

**问题文件**: `PatentManagerAgent.ts`

**当前问题**：PatentStore 类与 Agent 耦合

**优化方案**：

```typescript
// store/interface.ts
export interface IPatentStore {
  addPatent(patent: PatentApplication): void
  getPatent(applicationNumber: string): PatentApplication | undefined
  updatePatent(applicationNumber: string, updates: Partial<PatentApplication>): boolean
  removePatent(applicationNumber: string): boolean
  listPatents(query?: ListQuery): PatentApplication[]
}

// store/memory.ts - 内存实现
export class InMemoryPatentStore implements IPatentStore {
  private patents = new Map<string, PatentApplication>()
  // 实现...
}

// agent.ts - 依赖注入
export class PatentManagerAgent extends Agent {
  constructor(
    config: AgentConfig,
    private store: IPatentStore = new InMemoryPatentStore()
  ) {
    super(config)
  }
}
```

**优势**：

- 存储可替换（数据库、文件、云存储）
- 更易测试（可注入 mock）
- 符合依赖倒置原则

---

### 优先级 3：代码清理

#### 3.1 移除生产日志中的 emoji

**当前**：

```typescript
console.log('\n🔬 [专利分析] 步骤1: 规划阶段')
```

**优化后**：

```typescript
console.log('[PatentAnalyzer] 步骤1: 规划阶段')
```

**原因**：emoji 在生产日志中可能显示异常或占用额外空间

---

#### 3.2 移除未使用的参数

**当前**：

```typescript
private addPatent(input: PatentManagerInput, _context: ExecutionContext) {
  // _context 从未使用
}
```

**优化后**：

```typescript
private addPatent(input: PatentManagerInput) {
  // 移除未使用的参数
}
```

---

#### 3.3 提取常量定义

**当前**：

```typescript
protectionScope: {
  breadth: 'medium',  // 硬编码
  clarity: 'clear',
  risk: 'medium',
}
```

**优化后**：

```typescript
private static readonly DEFAULT_PROTECTION_SCOPE = {
  breadth: 'medium' as const,
  clarity: 'clear' as const,
  risk: 'medium' as const,
};
```

---

## 📈 优化效果预估

| 优化项         | 代码减少    | 维护性提升   | 测试性提升   |
| -------------- | ----------- | ------------ | ------------ |
| 统一 JSON 解析 | -150 行     | ⬆️⬆️⬆️       | ⬆️⬆️         |
| 移除未使用成员 | -10 行      | ⬆️⬆️         | ⬆️⬆️⬆️       |
| 统一格式生成   | -170 行     | ⬆️⬆️         | ⬆️⬆️         |
| 分离存储层     | -50 行      | ⬆️⬆️⬆️       | ⬆️⬆️⬆️       |
| 代码清理       | -30 行      | ⬆️           | ⬆️           |
| **总计**       | **-410 行** | **显著提升** | **显著提升** |

---

## 🎯 Karpathy 原则符合度

### 优化前

- ✅ 编码前思考：部分符合（有错误处理）
- ❌ 简洁优先：不符合（大量重复代码）
- ⚠️ 精准修改：部分符合（有一些不必要的状态）
- ✅ 目标驱动：符合

### 优化后

- ✅ 编码前思考：符合（明确的数据流）
- ✅ 简洁优先：符合（DRY 原则）
- ✅ 精准修改：符合（无状态设计）
- ✅ 目标驱动：符合（单一职责）

---

## 📝 实施建议

### 立即可做（不影响功能）

1. ✅ 创建 JSONParser 工具类（已完成）
2. 使用 JSONParser 重构解析方法
3. 移除 emoji 日志

### 需要测试（影响现有代码）

4. 重构 PatentResponderAgent 的 exportToFormat
5. 统一格式生成逻辑
6. 分离 PatentManagerAgent 的存储层

### 长期优化

7. 提取 prompt 模板到独立文件
8. 创建测试工具函数
9. 添加性能监控

---

## ✅ 已完成优化

1. ✅ 创建统一的 `JSONParser` 工具类
   - 文件：`packages/agents/patent-analyzer/src/utils/json-parser.ts`
   - 代码量：45 行
   - 可复用于所有智能体

2. ✅ 创建工具类导出
   - 文件：`packages/agents/patent-analyzer/src/utils/index.ts`

---

## 🔄 下一步

建议按以下顺序继续优化：

1. **重构 PatentAnalyzerAgent 的解析方法**（使用 JSONParser）
2. **重构 PatentResponderAgent 的 exportToFormat**（移除状态依赖）
3. **统一格式生成逻辑**（减少重复）
4. **分离 PatentManagerAgent 的存储层**（提升架构）

每完成一项，运行测试确保功能不受影响：

```bash
cd packages/agents/patent-analyzer && pnpm test
cd packages/agents/patent-responder && pnpm test
cd packages/agents/patent-manager && pnpm test
cd packages/agents/test && npx vitest run
```

---

## 📚 参考资料

- [Karpathy 原则完整文档](https://github.com/forrestchang/andrej-karpathy-skills)
- [DRY 原则](https://en.wikipedia.org/wiki/Don%27t_repeat_yourself)
- [单一职责原则](https://en.wikipedia.org/wiki/Single-responsibility_principle)
