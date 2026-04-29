# 专利文档生成工具 - 快速开始

## 功能概述

专利文档生成工具提供完整的专利申请文件、权利要求书、意见陈述书等文档的自动生成能力。

## 核心组件

### 1. PatentApplicationGeneratorTool - 专利申请文件生成器

```typescript
import { PatentApplicationGeneratorTool } from '@yunpat/document-tools';

const generator = new PatentApplicationGeneratorTool();

const result = await generator.execute(
  {
    data: {
      inventionTitle: '一种智能控制系统',
      technicalField: '本发明涉及自动化控制技术领域...',
      backgroundArt: '现有的控制系统存在以下问题...',
      inventionContent: '本发明提供了一种智能控制系统...',
      drawingsDescription: '图1是系统结构图...',
      embodiment: '如图1所示，本发明包括...',
      claims: [
        {
          type: 'independent',
          number: 1,
          content: '一种智能控制系统，其特征在于，包括：...',
        },
        {
          type: 'dependent',
          number: 2,
          content: '根据权利要求1所述的系统...',
          dependsOn: 1,
        },
      ],
      abstract: '本发明公开了一种智能控制系统...',
    },
    outputPath: '/path/to/专利申请文件.docx',
    template: 'standard',
  },
  context
);

console.log(`文档已生成：${result.outputPath}`);
console.log(`预估页数：${result.pages}`);
```

### 2. PatentClaimsGeneratorTool - 权利要求书生成器

```typescript
import { PatentClaimsGeneratorTool } from '@yunpat/document-tools';

const generator = new PatentClaimsGeneratorTool();

const result = await generator.execute(
  {
    claims: [
      {
        type: 'independent',
        number: 1,
        content: '一种智能控制系统，其特征在于，包括：传感器模块、控制器和执行器...',
      },
      {
        type: 'dependent',
        number: 2,
        content: '根据权利要求1所述的智能控制系统，其特征在于，所述传感器模块包括...',
        dependsOn: 1,
      },
      {
        type: 'dependent',
        number: 3,
        content: '根据权利要求1所述的智能控制系统，其特征在于，所述控制器采用...',
        dependsOn: 1,
      },
    ],
    outputPath: '/path/to/权利要求书.docx',
  },
  context
);

console.log(`权利要求书已生成，共 ${result.claimsCount} 项权利要求`);
```

### 3. ResponseStatementGeneratorTool - 意见陈述书生成器

```typescript
import { ResponseStatementGeneratorTool } from '@yunpat/document-tools';

const generator = new ResponseStatementGeneratorTool();

const result = await generator.execute(
  {
    data: {
      applicationNumber: '202310123456.7',
      inventionTitle: '一种智能控制系统',
      reviewOpinionSummary: '审查员认为权利要求1-3不具备创造性...',
      responsePoints: [
        {
          examinerView: '权利要求1相对于对比文件1的区别特征仅在于...',
          applicantResponse: '申请人认为，权利要求1与对比文件1相比具有以下区别技术特征...',
          legalBasis: '专利法第22条第3款',
        },
        {
          examinerView: '从属权利要求2的附加技术特征被对比文件2公开...',
          applicantResponse: '对比文件2虽然公开了类似特征，但应用场景不同...',
        },
      ],
      amendments: [
        {
          location: '权利要求1',
          originalContent: '包括控制器',
          newContent: '包括基于AI算法的智能控制器',
          reason: '进一步限定技术特征，以区别于现有技术',
        },
      ],
      applicant: {
        name: '某某科技有限公司',
        address: '北京市海淀区...',
      },
      date: '2024-06-01',
    },
    outputPath: '/path/to/意见陈述书.docx',
  },
  context
);

console.log(`意见陈述书已生成：${result.outputPath}`);
```

## 数据结构详解

### PatentApplicationData - 专利申请数据

```typescript
interface PatentApplicationData {
  /** 发明名称 */
  inventionTitle: string;
  
  /** 技术领域 */
  technicalField: string;
  
  /** 背景技术 */
  backgroundArt: string;
  
  /** 发明内容 */
  inventionContent: string;
  
  /** 附图说明（可选） */
  drawingsDescription?: string;
  
  /** 具体实施方式（可选） */
  embodiment?: string;
  
  /** 权利要求书 */
  claims: Array<{
    /** 权利要求类型（独立/从属） */
    type: 'independent' | 'dependent';
    /** 权利要求编号 */
    number: number;
    /** 权利要求内容 */
    content: string;
    /** 从属关系（仅从属权利要求） */
    dependsOn?: number;
  }>;
  
  /** 摘要 */
  abstract: string;
  
  /** 申请人信息（可选） */
  applicant?: {
    name: string;
    address: string;
  };
  
  /** 发明人信息（可选） */
  inventors?: Array<{
    name: string;
    address: string;
  }>;
}
```

### ResponseStatementData - 意见陈述数据

```typescript
interface ResponseStatementData {
  /** 申请号 */
  applicationNumber: string;
  
  /** 发明名称 */
  inventionTitle: string;
  
  /** 审查意见摘要 */
  reviewOpinionSummary: string;
  
  /** 答复要点 */
  responsePoints: Array<{
    /** 审查员观点 */
    examinerView: string;
    /** 申请人答复 */
    applicantResponse: string;
    /** 法律依据（可选） */
    legalBasis?: string;
  }>;
  
  /** 修改说明（可选） */
  amendments?: Array<{
    /** 修改位置 */
    location: string;
    /** 原内容 */
    originalContent: string;
    /** 新内容 */
    newContent: string;
    /** 修改理由 */
    reason: string;
  }>;
  
  /** 申请人信息（可选） */
  applicant?: {
    name: string;
    address: string;
  };
  
  /** 日期（可选） */
  date?: string;
}
```

## 使用场景

### 场景 1：从技术交底书生成专利申请

```typescript
// 1. 解析技术交底书
const inventionDisclosure = await parseInventionDisclosure('/path/to/技术交底书.pdf');

// 2. 提取关键信息
const applicationData: PatentApplicationData = {
  inventionTitle: inventionDisclosure.title,
  technicalField: inventionDisclosure.field,
  backgroundArt: inventionDisclosure.background,
  inventionContent: inventionDisclosure.content,
  claims: inventionDisclosure.claims,
  abstract: inventionDisclosure.summary,
};

// 3. 生成专利申请文件
const result = await generator.execute(
  { data: applicationData, outputPath: '专利申请文件.docx' },
  context
);
```

### 场景 2：批量生成权利要求书

```typescript
// 为多个申请案生成权利要求书
const applications = [
  { id: 'app1', claims: claims1 },
  { id: 'app2', claims: claims2 },
  { id: 'app3', claims: claims3 },
];

for (const app of applications) {
  await generator.execute(
    {
      claims: app.claims,
      outputPath: `/output/${app.id}_权利要求书.docx`,
    },
    context
  );
}
```

### 场景 3：智能体自动答复审查意见

```typescript
// 在专利答复智能体中使用
class PatentResponderAgent extends Agent {
  protected async act(plan: Plan, context: ExecutionContext): Promise<Result> {
    // 1. 解析审查意见通知书
    const docParser = new OfficialDocParserToolV2();
    const docResult = await docParser.execute(
      { filePath: this.reviewOpinionPath },
      context
    );

    // 2. 生成答复策略
    const responseStrategy = await this.generateResponseStrategy(docResult.fields);

    // 3. 生成意见陈述书
    const responseGenerator = new ResponseStatementGeneratorTool();
    const statementResult = await responseGenerator.execute(
      {
        data: {
          applicationNumber: docResult.fields.applicationNumber!,
          inventionTitle: docResult.fields.inventionTitle!,
          reviewOpinionSummary: docResult.fields.reviewSummary!,
          responsePoints: responseStrategy.points,
          amendments: responseStrategy.amendments,
        },
        outputPath: this.outputPath,
      },
      context
    );

    return { success: true, outputPath: statementResult.outputPath };
  }
}
```

## 文档格式

生成的 DOCX 文档符合标准专利申请文件格式：

- **字体**：宋体
- **字号**：12磅（24半角磅）
- **行距**：1.5倍行距
- **页边距**：上下2.5cm，左右2.0cm
- **标题层级**：符合专利局要求

## 高级功能

### 自定义模板

```typescript
// 使用 PCT 申请模板
const result = await generator.execute(
  {
    data: applicationData,
    outputPath: 'PCT申请.docx',
    template: 'pct', // 使用 PCT 模板
  },
  context
);
```

### 添加格式化

```typescript
const { TextRun } = await import('docx');

// 在文档内容中添加格式化
children.push(
  new Paragraph({
    children: [
      new TextRun({
        text: '重要内容',
        bold: true,
        color: 'FF0000',
      }),
    ],
  })
);
```

### 插入表格

```typescript
const { Table, TableRow, TableCell } = await import('docx');

children.push(
  new Table({
    rows: [
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph('单元格1')] }),
          new TableCell({ children: [new Paragraph('单元格2')] }),
        ],
      }),
    ],
  })
);
```

## 最佳实践

1. **结构化数据**：确保输入数据格式正确，特别是权利要求的从属关系
2. **内容质量**：提供高质量的技术描述和答复理由
3. **格式统一**：使用标准模板和格式规范
4. **版本控制**：保留生成文档的版本记录
5. **人工审核**：生成后应进行人工审核和修改

## 故障排查

### docx 依赖问题

```bash
# 重新安装 docx
pnpm install docx@latest
```

### 文档生成失败

**问题**：生成的文档无法打开

**解决方案**：
1. 检查数据格式是否正确
2. 确保输出路径有写权限
3. 查看 TypeScript 编译错误

### 中文乱码

**问题**：文档中中文显示为乱码

**解决方案**：
- 已在工具中设置字体为"宋体"
- 确保系统已安装中文字体
- 使用支持中文的文档查看器

## 下一步

- 查看 [README.md](./README.md) 了解完整功能
- 集成到专利智能体中使用
- 扩展自定义模板和格式

---

**YunPat Team** - 让专利工作更智能 🚀
