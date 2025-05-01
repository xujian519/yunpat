# 代码质量改进建议

> 基于全面检查的改进建议

---

## 1. 清理调试代码

### 问题

- `patents/mcp/McpServer.ts` 中有大量 console.log
- 应使用统一的日志系统

### 建议

```typescript
// 使用项目统一的日志工具
import { Logger } from '@yunpat/core'

const logger = new Logger('MCP-Server')

logger.info('MCP 服务器启动', { name: this.config.name })
logger.error('工具错误', { name, params, error })
```

---

## 2. 实现待完成功能

### 2.1 iterative-search.ts

**当前状态**：返回模拟数据

**改进建议**：

```typescript
// 集成实际的搜索工具
import { WebSearchTool } from './network/NetworkTools.js';

private async executeSearch(query: string, searchType: string, context: ToolContext) {
  const searchTool = new WebSearchTool();
  return await searchTool.execute({ query }, context);
}
```

### 2.2 PptxTools.ts

**当前状态**：返回 Markdown

**改进建议**：

```typescript
// 使用实际的 PPTX 库
// 参考：https://github.com/ggabor/node-pptx
// 或：https://www.npmjs.com/package/pptxgenjs

import PptxGenJS from 'pptxgenjs'

const pres = new PptxGenJS()
pres.layout = 'LAYOUT_16x9'
pres.defineSlideMaster({
  title: 'MASTER_SLIDE',
  background: { color: '363636' },
})
```

---

## 3. 增强类型安全

### 问题

- `visualization-tools.ts` 使用 `any` 类型

### 改进建议

```typescript
// 定义具体的数据结构
interface ChartData {
  nodes?: ChartNode[];
  edges?: ChartEdge[];
  participants?: Participant[];
  messages?: Message[];
  classes?: ClassDefinition[];
  relationships?: Relationship[];
  branches?: Branch[];
}

inputSchema: z.object({
  chartType: z.enum([...]),
  data: z.object({
    nodes: z.array(z.object({...})).optional(),
    edges: z.array(z.object({...})).optional(),
    // ... 其他字段
  }),
})
```

---

## 4. 添加单元测试

### 测试框架

```bash
# 安装测试依赖
pnpm add -D vitest @vitest/ui

# 配置 vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
});
```

### 示例测试

```typescript
// knowledge-search.test.ts
import { describe, it, expect } from 'vitest'
import { KnowledgeSearchTool } from './knowledge-search.js'

describe('KnowledgeSearchTool', () => {
  it('should build index', async () => {
    const tool = new KnowledgeSearchTool()
    const result = await tool.execute({ forceRebuild: true }, mockContext)
    expect(result.success).toBe(true)
  })

  it('should search cards', async () => {
    const tool = new KnowledgeSearchTool()
    const result = await tool.execute({ query: '三步法', limit: 5 }, mockContext)
    expect(result.cards.length).toBeGreaterThan(0)
  })
})
```

---

## 5. 错误处理增强

### 当前状态

基础 try-catch

### 改进建议

```typescript
class DetailedError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any,
    public suggestions?: string[]
  ) {
    super(message)
    this.name = 'DetailedError'
  }
}

// 使用
throw new DetailedError('文件解析失败', 'PARSE_ERROR', { filePath, line: 10 }, [
  '检查文件格式',
  '确认文件编码',
])
```

---

## 6. 性能优化

### 6.1 缓存机制

```typescript
import { LRUCache } from 'lru-cache';

const cache = new LRUCache<string, any>({ max: 100 });

async execute(input: TInput, context: ToolContext) {
  const cacheKey = JSON.stringify(input);

  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  const result = await this.process(input, context);
  cache.set(cacheKey, result);

  return result;
}
```

### 6.2 流式处理

```typescript
// 大文件流式读取
import { createReadStream } from 'fs'
import { pipeline } from 'stream/promises'

await pipeline(createReadStream(inputPath), transformStream, createWriteStream(outputPath))
```

---

## 7. 安全增强

### 7.1 路径验证

```typescript
import { resolve, normalize } from 'path'

function validatePath(filePath: string, baseDir: string): void {
  const resolved = resolve(baseDir, filePath)
  const normalized = normalize(resolved)

  if (!normalized.startsWith(baseDir)) {
    throw new Error('路径不合法：试图访问项目目录外文件')
  }
}
```

### 7.2 输入清理

```typescript
import * as sanitizer from 'sanitize-html'

function cleanUserInput(input: string): string {
  return sanitizer(input, {
    allowedTags: [],
    allowedAttributes: {},
  })
}
```

---

## 8. 配置管理

### 建议

```typescript
// config/default.ts
export const defaultConfig = {
  knowledgeBasePath: '/Users/xujian/projects/YunPat/knowledge-base',
  indexPath: '/Users/xujian/projects/YunPat/knowledge-base/card-index.json',
  ocrEndpoint: 'http://localhost:8009',
  maxRetries: 3,
  timeout: 30000,
}

// config/prod.ts
export const prodConfig = {
  ...defaultConfig,
  timeout: 60000,
}
```

---

## 9. 监控和日志

### 建议

```typescript
// metrics.ts
export class MetricsCollector {
  private metrics = new Map<string, number>()

  recordToolCall(toolName: string, duration: number): void {
    const key = `tool.${toolName}.calls`
    this.metrics.set(key, (this.metrics.get(key) || 0) + 1)

    this.metrics.set(`tool.${toolName}.duration`, duration)
  }

  getMetrics(): Record<string, number> {
    return Object.fromEntries(this.metrics)
  }
}
```

---

## 10. 文档生成

### 建议

```bash
# 自动生成 API 文档
pnpm add -D typedoc
pnpm docs

# 生成 JSDoc HTML
typedoc --out docs src/**/*.ts
```

---

## 优先级排序

### 🔴 高优先级（立即处理）

1. **清理调试代码** - 移除 console.log
2. **添加基础测试** - 核心功能测试覆盖
3. **实现 TODO 功能** - 集成实际搜索工具

### 🟡 中优先级（本周处理）

4. **增强类型安全** - 移除 any 类型
5. **错误处理增强** - 详细错误信息
6. **性能优化** - 添加缓存机制

### 🟢 低优先级（后续优化）

7. **安全增强** - 路径验证
8. **监控日志** - 添加指标收集
9. **文档生成** - 自动化 API 文档

---

## 总结

代码整体质量优秀，但需要在以下方面改进：

✅ **优点**：

- 架构设计清晰
- 代码规范良好
- 文档完整详细
- 功能实现完整

⚠️ **需要改进**：

- 补充单元测试
- 清理调试代码
- 实现待完成功能
- 增强类型安全

建议按优先级逐步改进，确保代码质量持续提升。
