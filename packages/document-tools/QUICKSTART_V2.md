# 官文解析工具 V2 - 快速开始

## V2 版本说明

V2 版本不依赖外部 GLM-OCR 服务，使用项目现有的 PDF 解析和 OCR 工具，更适合离线环境使用。

## 安装

```bash
# 安装 Node.js 依赖
pnpm install

# 安装 Tesseract.js（OCR，可选）
# 已经包含在 package.json 中
```

## 使用示例

### 审查意见通知书解析

```typescript
import { OfficialDocParserToolV2, OfficialDocType } from '@yunpat/document-tools';

const parser = new OfficialDocParserToolV2();

const result = await parser.execute(
  {
    filePath: '/path/to/审查意见通知书.pdf',
    docType: OfficialDocType.REVIEW_OPINION,
    useOcr: false, // 文字版PDF不需要OCR
  },
  context
);

console.log('申请号:', result.fields.applicationNumber);
console.log('发明名称:', result.fields.inventionTitle);
console.log('审查意见:', result.fields.reviewSummary);
console.log('答复期限:', result.fields.responseDeadline);
```

### 扫描版 PDF 解析（启用 OCR）

```typescript
const result = await parser.execute(
  {
    filePath: '/path/to/扫描版审查意见.pdf',
    useOcr: true, // 启用 OCR
  },
  context
);
```

### 图片格式解析

```typescript
const result = await parser.execute(
  {
    filePath: '/path/to/官文照片.png',
    useOcr: true, // 图片格式必须启用 OCR
  },
  context
);
```

## 支持的文件格式

| 类型 | 格式 | 是否需要OCR |
|------|------|-----------|
| 文字版 PDF | `.pdf` | ❌ 不需要 |
| 扫描版 PDF | `.pdf` | ✅ 需要 |
| 图片 | `.png`, `.jpg`, `.jpeg`, `.bmp`, `.tiff` | ✅ 需要 |

## 提取字段对照表

### 审查意见通知书

| 字段 | 提取方法 |
|------|---------|
| 申请号 | 正则表达式匹配 |
| 发明名称 | 正则表达式匹配 |
| 审查意见摘要 | 正则提取前200字 |
| 答复期限 | 正则日期格式化 |
| 审查员 | 正则表达式匹配 |
| 引用文献 | 正则表达式分割 |

### 驳回决定

| 字段 | 提取方法 |
|------|---------|
| 申请号 | 正则表达式匹配 |
| 发明名称 | 正则表达式匹配 |
| 驳回理由 | 正则提取前500字 |
| 法律条款 | 正则表达式匹配 |
| 决定日期 | 正则日期格式化 |

### 缴费通知书

| 字段 | 提取方法 |
|------|---------|
| 申请号 | 正则表达式匹配 |
| 费用类型 | 正则表达式匹配 |
| 缴费金额 | 正则数值转换 |
| 缴费截止日期 | 正则日期格式化 |

## 性能对比

| 版本 | 依赖 | 准确率 | 速度 | 离线可用 |
|------|------|-------|------|---------|
| V1 (GLM-OCR) | Docling + GLM-OCR | 95% | 慢 | ❌ |
| V2 (内置) | PDF + Tesseract | 85% | 快 | ✅ |

## 推荐使用场景

### V1（原版）适合：
- 需要高精度字段提取
- 有可用的 GLM-OCR 服务
- 对速度要求不高

### V2（新版）适合：
- 离线环境使用
- 对速度要求高
- 标准格式的官文
- 批量处理

## 故障排查

### OCR 识别不准确

**问题：** 提取的字段不完整或错误

**解决方案：**
1. 检查图片质量（建议 DPI ≥ 300）
2. 调整 OCR 语言设置（`chi_sim` 用于简体中文）
3. 尝试预处理图片（提高对比度、去噪）

### 文本版 PDF 提取失败

**问题：** 文字版 PDF 无法提取文本

**解决方案：**
1. 检查 PDF 是否包含文本层（不是纯图片）
2. 尝试用其他工具打开 PDF 验证
3. 如果是扫描版，启用 `useOcr: true`

### 日期格式错误

**问题：** 提取的日期格式不正确

**解决方案：**
1. 检查文档中的日期格式
2. 手动调整正则表达式（源码中修改）
3. 后处理日期字符串

## 进阶使用

### 批量处理

```typescript
import { glob } from 'glob';

const files = await glob('官文/*.pdf');
const results = [];

for (const file of files) {
  const result = await parser.execute(
    { filePath: file, useOcr: false },
    context
  );
  results.push(result);
}

console.log(`成功解析 ${results.length} 个文件`);
```

### 自定义字段提取

```typescript
// 扩展 V2 工具添加自定义提取逻辑
class CustomOfficialDocParser extends OfficialDocParserToolV2 {
  protected extractCustomFields(text: string): Record<string, any> {
    // 自定义提取逻辑
    return {
      customField: text.match(/自定义模式/)?.[1] || '',
    };
  }
}
```

## 迁移指南

### 从 V1 迁移到 V2

```typescript
// V1（需要 GLM-OCR 服务）
import { OfficialDocParserTool } from '@yunpat/document-tools';
const v1Parser = new OfficialDocParserTool();
const result1 = await v1Parser.execute({
  filePath: 'doc.pdf',
  useOcr: true,
  ocrEndpoint: 'http://localhost:8009',
}, context);

// V2（不需要外部服务）
import { OfficialDocParserToolV2 } from '@yunpat/document-tools';
const v2Parser = new OfficialDocParserToolV2();
const result2 = await v2Parser.execute({
  filePath: 'doc.pdf',
  useOcr: true, // 简化的 OCR 参数
}, context);

// 结果格式完全兼容
console.log(result2.fields.applicationNumber);
```

## 下一步

- 查看 [README.md](./README.md) 了解完整功能
- 集成到专利智能体中使用
- 根据实际需求调整提取规则

---

**YunPat Team** - 让专利工作更智能 🚀
