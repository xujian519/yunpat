# YunPat 文档工具集

YunPat 专利智能体框架的文档处理工具包，支持 PDF、DOCX、Excel、图片等多种格式。

## 🎯 核心功能

### 1. 官文解析工具（推荐）

**基于 Docling + GLM-OCR 的专利官文解析方案**

- ✅ 支持审查意见通知书、驳回决定、缴费通知书
- ✅ 自动提取结构化字段（申请号、发明名称、审查意见等）
- ✅ 高精度 OCR 识别
- ✅ 本地部署，数据安全

```typescript
import { OfficialDocParserTool, OfficialDocType } from '@yunpat/document-tools';

const parser = new OfficialDocParserTool();

const result = await parser.execute(
  {
    filePath: '/path/to/review_opinion.pdf',
    docType: OfficialDocType.REVIEW_OPINION,
    useOcr: true,
    ocrEndpoint: 'http://localhost:8009',
  },
  context
);

console.log(result.fields);
// {
//   applicationNumber: '202310123456.7',
//   inventionTitle: '一种智能控制系统',
//   reviewSummary: '权利要求1-3不具备创造性...',
//   responseDeadline: '2024-06-01',
//   examiner: '张某某',
//   referenceDocuments: ['CN112345678A', 'US20230012345A1']
// }
```

### 2. PDF 工具

- ✅ 文本提取
- ✅ OCR 识别（扫描版 PDF）
- ✅ 转换为 Markdown

### 3. DOCX 工具

- ✅ 创建/编辑 Word 文档
- ✅ 提取文本和样式
- ✅ 专利文档模板

### 4. Excel 工具

- ✅ 读写 Excel 文件
- ✅ 公式计算
- ✅ 案卷管理

### 5. OCR 工具

- ✅ Tesseract OCR
- ✅ 多语言支持
- ✅ 图片文字识别

### 6. 音频工具

- ✅ Whisper 语音识别
- ✅ 音频转文本

## 📦 安装

```bash
# 安装 Node.js 依赖
pnpm install

# 安装 Python 依赖（用于官文解析）
pip install docling requests

# 启动 GLM-OCR 服务（端口 8009）
# 参考：https://github.com/ml-explore/mlx
```

## 🔧 官文解析工具部署

### 1. 安装 Docling

```bash
pip install docling
```

### 2. 部署 GLM-OCR 服务

```bash
# 使用 oMLX 部署 GLM-OCR-4bit 模型
# 参考：https://github.com/ml-explore/mlx

# 启动服务（端口 8009）
python -m omlx.server --port 8009 --model GLM-OCR-4bit
```

### 3. 测试服务

```bash
# 测试 Docling
python -c "from docling.document_converter import DocumentConverter; print('Docling OK')"

# 测试 GLM-OCR
curl http://localhost:8009/health
```

## 📖 使用示例

### 审查意见通知书解析

```typescript
const result = await parser.execute({
  filePath: '/path/to/审查意见通知书.pdf',
  docType: OfficialDocType.REVIEW_OPINION,
  useOcr: true,
}, context);

console.log('申请号:', result.fields.applicationNumber);
console.log('发明名称:', result.fields.inventionTitle);
console.log('审查意见:', result.fields.reviewSummary);
console.log('答复期限:', result.fields.responseDeadline);
```

### 驳回决定解析

```typescript
const result = await parser.execute({
  filePath: '/path/to/驳回决定.pdf',
  docType: OfficialDocType.REJECTION_DECISION,
  useOcr: true,
}, context);

console.log('驳回理由:', result.fields.rejectionReason);
console.log('法律条款:', result.fields.legalArticles);
```

### 缴费通知书解析

```typescript
const result = await parser.execute({
  filePath: '/path/to/缴费通知书.pdf',
  docType: OfficialDocType.PAYMENT_NOTICE,
  useOcr: true,
}, context);

console.log('费用类型:', result.fields.feeType);
console.log('缴费金额:', result.fields.feeAmount);
console.log('截止日期:', result.fields.paymentDeadline);
```

## 🎨 与专利智能体集成

### 在专利撰写智能体中使用

```typescript
import { WriterAgent } from './WriterAgent.js';
import { OfficialDocParserTool } from '@yunpat/document-tools';

class PatentWriterAgent extends WriterAgent {
  protected before(input: any, context: any): Promise<void> {
    // 注册官文解析工具
    const parser = new OfficialDocParserTool();
    context.tools.register(parser);
  }
}
```

### 在审查答复智能体中使用

```typescript
import { ResponderAgent } from './ResponderAgent.js';

class PatentResponderAgent extends ResponderAgent {
  protected async plan(input: any, context: any): Promise<Plan> {
    // 1. 解析审查意见通知书
    const parser = new OfficialDocParserTool();
    const docResult = await parser.execute({
      filePath: input.reviewOpinionPath,
      docType: OfficialDocType.REVIEW_OPINION,
      useOcr: true,
    }, context);

    // 2. 基于解析结果制定答复策略
    return this.createResponsePlan(docResult.fields);
  }
}
```

## 📊 支持的文件类型

| 类型 | 格式 | Docling | GLM-OCR |
|------|------|---------|---------|
| PDF | `.pdf` | ✅ | ✅ |
| 图片 | `.png`, `.jpg`, `.jpeg`, `.webp` | ✅ | ✅ |
| 扫描件 | 图片格式 | ✅ | ✅ |
| DOCX | `.docx` | ✅ | 需转PDF |

## 🔍 性能优化

### Docling 优化

```python
from docling.document_converter import DocumentConverter, Option
from docling.datamodel.base_models import InputFormat

converter = DocumentConverter(
    format_options={
        InputFormat.PDF: Option(pdf_backend="dl_parse_v1")  # 使用深度学习模型
    }
)
```

### GLM-OCR 批处理

```typescript
// 批量处理多个官文
const files = ['doc1.pdf', 'doc2.pdf', 'doc3.pdf'];
const results = await Promise.all(
  files.map(file => parser.execute({ filePath: file, useOcr: true }, context))
);
```

## 🚨 故障排查

### Docling 报错

```bash
# 检查版本
pip show docling

# 更新到最新版本
pip install --upgrade docling
```

### GLM-OCR 无响应

```bash
# 检查端口是否运行
lsof -i :8009

# 检查服务健康状态
curl http://localhost:8009/health
```

### 字段提取不准确

- 调整提示词模板（参考 `OFFICIAL_DOC_PROMPTS`）
- 增加图片分辨率（DPI ≥ 300）
- 尝试直接输入文本而非图片

## 📝 API 参考

### OfficialDocParserTool

```typescript
class OfficialDocParserTool extends EnhancedBaseTool {
  readonly metadata = {
    name: 'official_doc_parse',
    description: '解析专利官文（审查意见通知书、驳回决定等），提取结构化字段',
    category: ToolCategory.DOCUMENT,
  };

  async execute(
    input: {
      filePath: string;
      docType?: OfficialDocType;
      useOcr?: boolean;
      ocrEndpoint?: string;
    },
    context: ToolContext
  ): Promise<OfficialDocParseResult>;
}
```

### OfficialDocFields

```typescript
interface OfficialDocFields {
  applicationNumber?: string;        // 申请号
  inventionTitle?: string;            // 发明名称
  reviewSummary?: string;             // 审查意见摘要
  responseDeadline?: string;          // 答复期限
  examiner?: string;                  // 审查员
  referenceDocuments?: string[];      // 引用文献
  rejectionReason?: string;           // 驳回理由
  legalArticles?: string[];           // 法律条款
  decisionDate?: string;              // 决定日期
  feeType?: string;                   // 费用类型
  feeAmount?: number;                 // 缴费金额
  paymentDeadline?: string;           // 缴费截止日期
}
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

---

**YunPat Team** - 让专利工作更智能 🚀
