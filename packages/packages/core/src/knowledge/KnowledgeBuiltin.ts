/**
 * 内置知识库数据
 *
 * 纯数据声明，不含存储逻辑
 */

import { KnowledgeEntryType } from './KnowledgeTypes.js'

export interface BuiltinEntryData {
  title: string
  content: string
  type: KnowledgeEntryType
  category: string
  tags: string[]
  priority: number
}

export function getWritingBestPractices(): BuiltinEntryData[] {
  return [
    {
      title: '技术文档结构',
      content: `技术文档应遵循清晰的结构：

1. **概述** - 简要说明文档目的和适用范围
2. **前置条件** - 列出阅读本文档需要了解的知识
3. **核心内容** - 主体内容，分章节组织
4. **示例** - 提供具体的使用示例
5. **常见问题** - 预期并解答常见疑问
6. **参考资料** - 相关文档和资源的链接

每个章节应有明确的标题和逻辑顺序。`,
      type: KnowledgeEntryType.BEST_PRACTICE,
      category: 'writing-best-practices',
      tags: ['文档', '结构', '技术写作'],
      priority: 1,
    },
    {
      title: '代码注释规范',
      content: `良好的代码注释应遵循以下原则：

1. **解释"为什么"而非"是什么"** - 代码本身说明了做了什么，注释解释为什么这样做
2. **保持更新** - 过时的注释比没有注释更糟糕
3. **使用文档注释** - 对公共 API 使用 JSDoc/TSDoc 风格的注释
4. **避免显而易见的注释** - 如 \`i++ // i 加 1\` 这种注释毫无价值
5. **标注复杂逻辑** - 对于算法或复杂逻辑，添加简要说明

示例：
\`\`\`typescript
// 使用双指针法避免额外的空间复杂度 O(n)
function findPair(arr: number[], target: number): number[] | null {
  // ...
}
\`\`\``,
      type: KnowledgeEntryType.BEST_PRACTICE,
      category: 'writing-best-practices',
      tags: ['代码', '注释', '规范'],
      priority: 1,
    },
    {
      title: '错误消息编写',
      content: `编写有用的错误消息：

1. **说明问题** - 清楚地说明发生了什么
2. **提供上下文** - 包含相关的操作或状态信息
3. **给出建议** - 告诉用户如何解决问题
4. **使用合适的语气** - 友好但专业

好的错误消息示例：
- ❌ "错误 404"
- ✅ "找不到文件 '/path/to/file'。请检查文件路径是否正确。"

❌ "无效输入"
✅ "年龄必须是正整数，收到: -5"`,
      type: KnowledgeEntryType.BEST_PRACTICE,
      category: 'writing-best-practices',
      tags: ['错误', '用户体验', '消息'],
      priority: 1,
    },
  ]
}

export function getCodePatterns(): BuiltinEntryData[] {
  return [
    {
      title: '单例模式',
      content: `单例模式确保一个类只有一个实例，并提供全局访问点。

\`\`\`typescript
class Singleton {
  private static instance: Singleton;
  private constructor() {}

  static getInstance(): Singleton {
    if (!Singleton.instance) {
      Singleton.instance = new Singleton();
    }
    return Singleton.instance;
  }
}
\`\`\`

**适用场景**：
- 配置管理器
- 数据库连接池
- 日志记录器`,
      type: KnowledgeEntryType.PATTERN,
      category: 'code-patterns',
      tags: ['设计模式', 'TypeScript', '单例'],
      priority: 1,
    },
    {
      title: '工厂模式',
      content: `工厂模式提供创建对象的接口，由子类决定实例化哪个类。

\`\`\`typescript
interface Product {
  operation(): string;
}

class ConcreteProductA implements Product {
  operation(): string {
    return 'Product A';
  }
}

class Factory {
  createProduct(type: 'A' | 'B'): Product {
    switch (type) {
      case 'A': return new ConcreteProductA();
      case 'B': return new ConcreteProductB();
    }
  }
}
\`\`\``,
      type: KnowledgeEntryType.PATTERN,
      category: 'code-patterns',
      tags: ['设计模式', '工厂', '创建'],
      priority: 1,
    },
    {
      title: '观察者模式',
      content: `观察者模式定义对象间的一对多依赖关系，当一个对象状态改变时，所有依赖者都会收到通知。

\`\`\`typescript
interface Observer {
  update(data: unknown): void;
}

class Subject {
  private observers: Observer[] = [];

  subscribe(observer: Observer): void {
    this.observers.push(observer);
  }

  notify(data: unknown): void {
    this.observers.forEach(obs => obs.update(data));
  }
}
\`\`\`

**适用场景**：
- 事件处理系统
- 发布-订阅系统
- 模型-视图架构`,
      type: KnowledgeEntryType.PATTERN,
      category: 'code-patterns',
      tags: ['设计模式', '观察者', '事件'],
      priority: 1,
    },
  ]
}

export function getDomainKnowledge(): BuiltinEntryData[] {
  return [
    {
      title: 'TypeScript 类型系统',
      content: `TypeScript 的类型系统核心概念：

1. **基本类型** - string, number, boolean, null, undefined, symbol, bigint
2. **对象类型** - interface, type, class
3. **联合类型** - \`string | number\`
4. **交叉类型** - \`A & B\`
5. **泛型** - \`function identity<T>(arg: T): T\`
6. **类型推断** - 自动推断变量类型
7. **类型守卫** - 运行时类型检查
8. **映射类型** - \`Partial<T>\`, \`Required<T>\`, \`Readonly<T>\`

**高级特性**：
- 条件类型: \`T extends U ? X : Y\`
- 模板字面量类型: \`\`prefix\${T}\`\`
- 递归类型: JSON Schema 示例`,
      type: KnowledgeEntryType.DOMAIN_KNOWLEDGE,
      category: 'domain-knowledge',
      tags: ['TypeScript', '类型', '语言'],
      priority: 1,
    },
    {
      title: '异步编程模式',
      content: `JavaScript/TypeScript 异步编程模式：

1. **Promise** - 表示异步操作的最终结果
2. **async/await** - 同步风格的异步代码
3. **Promise.all** - 并行执行多个异步操作
4. **Promise.race** - 返回最先完成的结果
5. **Promise.allSettled** - 等待所有操作完成
6. **Promise.any** - 返回第一个成功的结果

**最佳实践**：
- 总是处理错误 (try/catch)
- 避免回调地狱
- 使用 Promise 链而非嵌套
- 考虑使用 AbortController 取消长时间运行的请求`,
      type: KnowledgeEntryType.DOMAIN_KNOWLEDGE,
      category: 'domain-knowledge',
      tags: ['JavaScript', '异步', 'Promise'],
      priority: 1,
    },
    {
      title: 'RESTful API 设计原则',
      content: `RESTful API 设计最佳实践：

1. **使用名词而非动词** - \`/users\` 而非 \`/getUsers\`
2. **使用 HTTP 方法** - GET, POST, PUT, DELETE, PATCH
3. **使用复数形式** - \`/users\` 而非 \`/user\`
4. **版本控制** - \`/api/v1/users\`
5. **过滤和排序** - 查询参数 \`?sort=name&order=asc\`
6. **分页** - \`?page=1&limit=20\`
7. **状态码** - 正确使用 HTTP 状态码
8. **HATEOAS** - 在响应中包含相关资源的链接

**常见状态码**：
- 200 OK - 成功
- 201 Created - 创建成功
- 400 Bad Request - 客户端错误
- 401 Unauthorized - 未认证
- 403 Forbidden - 无权限
- 404 Not Found - 资源不存在
- 500 Internal Server Error - 服务器错误`,
      type: KnowledgeEntryType.DOMAIN_KNOWLEDGE,
      category: 'domain-knowledge',
      tags: ['API', 'REST', '设计'],
      priority: 1,
    },
  ]
}

export function getErrorSolutions(): BuiltinEntryData[] {
  return [
    {
      title: 'Cannot find module',
      content: `**错误**: Cannot find module 'xxx'

**原因**:
1. 依赖未安装
2. 路径错误
3. TypeScript 配置问题

**解决方案**:
\`\`\`bash
# 安装缺失的依赖
npm install <package-name>
# 或
pnpm install <package-name>

# 对于开发依赖
npm install -D <package-name>
\`\`\`

**TypeScript 特定**:
- 检查 \`tsconfig.json\` 中的 \`baseUrl\` 和 \`paths\`
- 确保类型声明已安装: \`@types/<package-name>\``,
      type: KnowledgeEntryType.ERROR_SOLUTION,
      category: 'error-solutions',
      tags: ['错误', '模块', '依赖'],
      priority: 1,
    },
    {
      title: 'CORS 错误',
      content: `**错误**: Access to fetch at 'xxx' has been blocked by CORS policy

**原因**: 浏览器同源策略阻止跨域请求

**解决方案**:

**服务端** (Node.js/Express):
\`\`\`typescript
app.use(cors({
  origin: ['http://localhost:3000'], // 允许的源
  credentials: true, // 允许携带 cookie
}));
\`\`\`

**客户端** (开发环境代理):
\`\`\`javascript
// vite.config.js
export default {
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
};
\`\`\``,
      type: KnowledgeEntryType.ERROR_SOLUTION,
      category: 'error-solutions',
      tags: ['错误', 'CORS', '网络'],
      priority: 1,
    },
    {
      title: 'React useEffect 依赖警告',
      content: `**警告**: React Hook useEffect has a missing dependency: 'xxx'

**原因**: useEffect 依赖数组中缺少使用的变量

**解决方案**:

**推荐做法** - 将依赖项加入数组:
\`\`\`typescript
useEffect(() => {
  const handler = () => {
    console.log(value);
  };
  window.addEventListener('click', handler);
  return () => window.removeEventListener('click', handler);
}, [value]); // 包含 value 依赖
\`\`\`

**特殊情况** - 故意忽略依赖:
\`\`\`typescript
// eslint-disable-next-line react-hooks/exhaustive-deps
useEffect(() => {
  // 代码逻辑
}, []); // 空依赖数组
\`\`\`

**更好的做法** - 使用 useCallback:
\`\`\`typescript
const callback = useCallback(() => {
  doSomething(value);
}, [value]);

useEffect(() => {
  callback();
}, [callback]);
\`\`\``,
      type: KnowledgeEntryType.ERROR_SOLUTION,
      category: 'error-solutions',
      tags: ['错误', 'React', 'Hook'],
      priority: 1,
    },
  ]
}
