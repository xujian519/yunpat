# 官文解析工具 - 快速开始

## 1. 安装依赖

### Python 依赖（必需）

```bash
# 安装 Docling
pip install docling

# 验证安装
python -c "from docling.document_converter import DocumentConverter; print('✅ Docling 安装成功')"
```

### GLM-OCR 服务（必需）

```bash
# 启动 GLM-OCR 服务（端口 8009）
# 参考：https://github.com/ml-explore/mlx

# 测试服务
curl http://localhost:8009/health
```

## 2. 构建项目

```bash
# 构建所有包
cd /Users/xujian/projects/YunPat
pnpm build

# 或只构建 document-tools
pnpm --filter @yunpat/document-tools build
```

## 3. 使用示例

### 基础用法

```typescript
import { OfficialDocParserTool, OfficialDocType } from '@yunpat/document-tools'

const parser = new OfficialDocParserTool()

const result = await parser.execute(
  {
    filePath: '/path/to/review_opinion.pdf',
    docType: OfficialDocType.REVIEW_OPINION,
    useOcr: true,
    ocrEndpoint: 'http://localhost:8009',
  },
  context
)

console.log(result.fields)
// {
//   applicationNumber: '202310123456.7',
//   inventionTitle: '一种智能控制系统',
//   reviewSummary: '权利要求1-3不具备创造性...',
//   responseDeadline: '2024-06-01',
//   examiner: '张某某',
//   referenceDocuments: ['CN112345678A']
// }
```

### Python 脚本直接调用

```bash
# 解析文档
python3 packages/python-tools/official_doc_parser.py parse /path/to/doc.pdf

# 提取字段
python3 packages/python-tools/official_doc_parser.py extract \
  /path/to/doc.pdf \
  --doc-type review_opinion \
  --ocr-endpoint http://localhost:8009
```

## 4. 支持的官文类型

| 类型           | 枚举值                   | 提取字段                                               |
| -------------- | ------------------------ | ------------------------------------------------------ |
| 审查意见通知书 | `review_opinion`         | 申请号、发明名称、审查意见、答复期限、审查员、引用文献 |
| 驳回决定       | `rejection_decision`     | 申请号、发明名称、驳回理由、法律条款、决定日期         |
| 缴费通知书     | `payment_notice`         | 申请号、费用类型、缴费金额、截止日期                   |
| 授予决定       | `grant_decision`         | 申请号、发明名称、决定日期、授权专利号                 |
| 复审无效决定   | `reexamination_decision` | 申请号、决定类型、决定结果、法律条款、决定日期         |

## 5. 故障排查

### Docling 未安装

```bash
Error: Docling未安装。请运行: pip install docling
```

**解决方案：**

```bash
pip install docling
```

### GLM-OCR 服务未启动

```bash
Error: GLM-OCR请求失败: Connection refused
```

**解决方案：**

```bash
# 检查端口是否运行
lsof -i :8009

# 启动 GLM-OCR 服务
python -m omlx.server --port 8009 --model GLM-OCR-4bit
```

### 文件路径错误

```bash
Error: 文件不存在: /path/to/doc.pdf
```

**解决方案：**

- 检查文件路径是否正确
- 使用绝对路径而非相对路径

## 6. 性能优化建议

### 批量处理

```typescript
// 使用 Promise.all 并发处理多个文件
const files = ['doc1.pdf', 'doc2.pdf', 'doc3.pdf']
const results = await Promise.all(
  files.map((file) => parser.execute({ filePath: file, useOcr: true }, context))
)
```

### 缓存结果

```typescript
// 对于相同的文件，缓存解析结果
const cache = new Map()

async function parseWithCache(filePath: string) {
  if (cache.has(filePath)) {
    return cache.get(filePath)
  }

  const result = await parser.execute({ filePath, useOcr: true }, context)
  cache.set(filePath, result)
  return result
}
```

## 7. 下一步

- 查看 [README.md](./README.md) 了解完整功能
- 查看 [tests/official-doc-parser.test.ts](./tests/official-doc-parser.test.ts) 了解更多示例
- 集成到专利智能体中使用

---

**YunPat Team** - 让专利工作更智能 🚀
