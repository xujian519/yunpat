# Phase 2 交互式CLI使用指南

## 🎯 新功能：交互式专利撰写

现在支持完整的人机协作工作流程！

---

## 🚀 快速开始

### 1. 基本用法

```bash
node packages/cli/dist/index.js draft-interactive \
  --title "一种基于深度学习的图像识别方法" \
  --field "人工智能" \
  --disclosure examples/disclosure-example.md
```

### 2. 指定输出文件

```bash
node packages/cli/dist/index.js draft-interactive \
  --title "一种基于深度学习的图像识别方法" \
  --field "人工智能" \
  --disclosure examples/disclosure-example.md \
  --output my-invention-report.md
```

---

## 🔄 交互式工作流程

### 步骤1: AI分析

系统会自动分析技术交底书，提取发明要点：

```
🔍 [发明理解] 步骤1: 规划阶段
   发明名称: 一种基于深度学习的图像识别方法
   技术领域: 人工智能

🧠 [发明理解] 步骤2: 分析阶段

✅ [发明理解] 分析完成 (置信度: 0.95)
   技术领域: 计算机视觉领域...
   关键特征: 5 个
```

### 步骤2: 查看报告

系统会展示完整的发明理解报告：

```markdown
=== 发明理解报告 ===

# 发明理解报告

## 技术领域

计算机视觉领域，尤其涉及一种基于深度学习的图像识别方法

## 背景技术

现有图像识别方法主要基于传统特征提取...

## 技术问题

复杂场景下（如遮挡、光照变化）识别准确率低...

## 技术方案

采用多尺度卷积神经网络作为特征提取器...

## 有益效果

在COCO数据集上mAP提升20%...

## 关键特征

1. 多尺度特征融合，结合特征金字塔网络
2. 自适应注意力机制，动态权重调整
   ...

置信度: 95.0%
```

### 步骤3: 人类确认

选择操作：

```
? 请选择操作:
  ✅ 通过 (y) - 确认结果并保存
  ✏️ 修正 (c) - 修正部分内容
  💬 补充 (s) - 补充更多信息
  🔄 重来 (r) - 重新分析
  ❌ 取消 - 退出不保存
```

---

## 📝 操作说明

### ✅ 通过 (y)

确认结果并保存到文件。

**保存位置**:

- 如果指定了`--output`，保存到指定文件
- 否则保存到`data/drafts/invention-understanding-YYYY-MM-DD.md`
- 同时保存JSON格式到`data/drafts/invention-understanding-YYYY-MM-DD.json`

### ✏️ 修正 (c)

修正报告中的特定字段。

**示例**:

```
? 请输入修正内容（格式：字段名: 新内容）:
> technicalProblem: 在复杂场景下识别准确率低，对光照变化和遮挡敏感
```

**可用字段**:

- `technicalField` - 技术领域
- `backgroundArt` - 背景技术
- `technicalProblem` - 技术问题
- `technicalSolution` - 技术方案
- `beneficialEffects` - 有益效果
- `keyFeatures` - 关键特征

### 💬 补充 (s)

提供更多信息，让AI重新分析。

**示例**:

```
? 请输入补充信息（将添加到技术方案中）:
> 该方法还支持迁移学习，可以在预训练模型基础上快速适应新场景
```

系统会将补充信息添加到交底书中，重新执行分析。

### 🔄 重来 (r)

不提供任何反馈，让AI重新分析。

适用于：

- 第一次分析结果不满意
- 想要看看AI的随机性
- LLM返回了不稳定的结果

### ❌ 取消

退出而不保存结果。

---

## 💡 使用场景

### 场景1: 快速验证

```bash
# 快速查看AI理解是否准确
yunpat draft-interactive --title "..." --field "..." --disclosure ...
# 选择 "取消" 不保存
```

### 场景2: 迭代优化

```bash
# 第一轮：查看初步结果
yunpat draft-interactive --title "..." --field "..." --disclosure ...
# 选择 "补充"，添加更多信息

# 第二轮：查看改进后的结果
# 选择 "修正"，修正不准确的部分

# 第三轮：确认并保存
# 选择 "通过"
```

### 场景3: 批量处理

```bash
# 处理多个交底书
for file in disclosures/*.md; do
  yunpat draft-interactive \
    --title "$(basename $file .md)" \
    --field "人工智能" \
    --disclosure "$file" \
    --output "outputs/$(basename $file .md).md"
done
```

---

## ⚠️ 注意事项

1. **API密钥**: 确保设置了`DEEPSEEK_API_KEY`或`OPENAI_API_KEY`
2. **文件路径**: 使用绝对路径或相对于当前目录的路径
3. **输出目录**: 如果不指定`--output`，会自动创建`data/drafts/`目录
4. **迭代限制**: 最多5次迭代，防止无限循环

---

## 🎓 最佳实践

### 1. 准备高质量的交底书

```markdown
# 技术交底书

## 发明名称

[清晰、具体的名称]

## 技术领域

[明确的技术领域]

## 背景技术

[现有技术及其问题]

## 技术问题

[要解决的具体问题]

## 技术方案

[详细的解决方案]

## 技术效果

[量化的效果数据]

## 附图说明

[各附图的内容描述]
```

### 2. 利用"补充"功能

如果AI遗漏了重要信息：

- 使用"补充"而非"重来"
- 提供具体的缺失信息
- 让AI基于新信息重新分析

### 3. 逐步修正

如果AI理解有偏差：

- 先用"修正"调整明显错误
- 再用"补充"添加缺失信息
- 最后"通过"确认

### 4. 保存中间结果

每次迭代都会更新报告，建议：

- 多次迭代后再保存
- 保存前仔细检查
- 保留JSON格式便于后续处理

---

## 🔧 高级用法

### 自定义输出路径

```bash
# 保存到项目目录
yunpat draft-interactive \
  --title "..." \
  --field "..." \
  --disclosure ... \
  --output ./reports/invention-report.md

# 保存到绝对路径
yunpat draft-interactive \
  --title "..." \
  --field "..." \
  --disclosure ... \
  --output /Users/xujian/projects/patents/report.md
```

### 与其他命令组合

```bash
# 1. 先用交互式命令验证
yunpat draft-interactive --title "..." --field "..." --disclosure ...

# 2. 确认后，用非交互式命令批量处理
yunpat draft --title "..." --field "..." --disclosure ... --output batch-report.md
```

---

## 📊 对比：交互式 vs 非交互式

| 特性     | 交互式命令          | 非交互式命令       |
| -------- | ------------------- | ------------------ |
| 命令     | `draft-interactive` | `draft`            |
| 人机协作 | ✅ 支持             | ❌ 不支持          |
| 迭代优化 | ✅ 支持             | ❌ 不支持          |
| 批量处理 | ❌ 不适合           | ✅ 适合            |
| 自动化   | ❌ 需要人工干预     | ✅ 完全自动        |
| 使用场景 | 首次分析、重要专利  | 后续处理、批量任务 |

---

## 🐛 故障排除

### 问题1: 提示"未找到API密钥"

**解决**:

```bash
export DEEPSEEK_API_KEY=your_key_here
# 或
export OPENAI_API_KEY=your_key_here
```

### 问题2: 提示"读取技术交底书失败"

**解决**:

- 检查文件路径是否正确
- 确认文件存在且可读
- 使用绝对路径

### 问题3: AI分析结果质量差

**解决**:

- 检查技术交底书是否完整
- 使用"补充"功能提供更多信息
- 使用"修正"功能调整不准确的部分
- 尝试"重来"获得不同的结果

### 问题4: 无法保存文件

**解决**:

- 检查输出目录的写权限
- 使用`--output`指定有写权限的路径
- 检查磁盘空间是否充足

---

## 📚 相关文档

- [Phase 2完成报告](../docs/reports/phase2-completion-report-2026-05-03.md)
- [端到端示例](../examples/phase2-invention-understanding-example.md)
- [验收测试报告](../test/reports/phase2-test-report-2026-05-03.md)

---

**更新时间**: 2026-05-03
**版本**: v1.0
